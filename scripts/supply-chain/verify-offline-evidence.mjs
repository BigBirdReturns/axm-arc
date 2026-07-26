#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

function fail(message) {
  console.error(message);
  process.exit(1);
}
const args = process.argv.slice(2);
function option(name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) fail(`Missing value for ${name}.`);
  return value;
}
function flag(name) {
  return args.includes(name);
}
function normalizePath(path) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}
function isWithin(rootPath, candidatePath) {
  const normalizedRoot = normalizePath(rootPath);
  const normalizedCandidate = normalizePath(candidatePath);
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}/`);
}

const root = resolve(option("--root") ?? ".");
if (!existsSync(root)) fail(`Evidence root is absent: ${root}`);
const rootReal = realpathSync(root);
const sumsPath = resolve(root, option("--sums") ?? "SHA256SUMS");
const provenancePath = resolve(root, option("--provenance") ?? "provenance.intoto.json");
const repo = option("--repo") ?? "BigBirdReturns/axm-arc";
const bundle = option("--bundle");
const trustedRoot = option("--trusted-root");
const attestedSubject = option("--attested-subject");
const requireSignature = flag("--require-signature");

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
function insideRoot(path) {
  const resolved = resolve(root, path);
  if (!isWithin(root, resolved)) fail(`Checksum path escapes evidence root: ${path}`);
  if (existsSync(resolved)) {
    const real = realpathSync(resolved);
    if (!isWithin(rootReal, real)) fail(`Checksum path resolves outside evidence root: ${path}`);
  }
  return resolved;
}

if (!existsSync(sumsPath)) fail(`Missing checksum ledger: ${sumsPath}`);
const checked = [];
for (const [lineNumber, line] of readFileSync(sumsPath, "utf8").split(/\r?\n/).entries()) {
  if (!line.trim()) continue;
  const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
  if (!match) fail(`Malformed SHA256SUMS line ${lineNumber + 1}.`);
  const path = insideRoot(match[2]);
  if (!existsSync(path)) fail(`Missing checksummed file: ${match[2]}`);
  const actual = sha256(path);
  if (actual !== match[1]) fail(`Checksum mismatch for ${match[2]}: expected ${match[1]}, got ${actual}`);
  checked.push({ path: match[2], sha256: actual });
}

if (!existsSync(provenancePath)) fail(`Missing provenance statement: ${provenancePath}`);
const statement = JSON.parse(readFileSync(provenancePath, "utf8"));
if (statement?._type !== "https://in-toto.io/Statement/v1") fail("Provenance is not an in-toto Statement v1.");
if (statement?.predicateType !== "https://slsa.dev/provenance/v1") fail("Provenance predicate is not SLSA provenance v1.");
if (!Array.isArray(statement.subject) || statement.subject.length === 0) fail("Provenance has no subjects.");
for (const subject of statement.subject) {
  if (!subject || typeof subject.name !== "string") fail("Provenance subject has no name.");
  const path = insideRoot(subject.name);
  if (!existsSync(path)) fail(`Provenance subject is absent: ${subject.name}`);
  const expected = subject?.digest?.sha256;
  if (!/^[0-9a-f]{64}$/.test(expected ?? "")) fail(`Provenance subject has no SHA-256: ${subject.name}`);
  const actual = sha256(path);
  if (actual !== expected) fail(`Provenance subject mismatch for ${subject.name}.`);
}

const sboms = checked.filter((entry) => entry.path.endsWith(".cdx.json"));
for (const sbom of sboms) {
  const document = JSON.parse(readFileSync(insideRoot(sbom.path), "utf8"));
  if (document?.bomFormat !== "CycloneDX" || document?.specVersion !== "1.7") {
    fail(`Unsupported SBOM format: ${sbom.path}`);
  }
  if (!Array.isArray(document.components) || document.components.length === 0) {
    fail(`SBOM has no components: ${sbom.path}`);
  }
}

let signature = { attempted: false, verified: false, subject: null };
if (bundle || trustedRoot || attestedSubject || requireSignature) {
  signature.attempted = true;
  if (!bundle || !trustedRoot) fail("Offline signature verification requires both --bundle and --trusted-root.");
  if (!existsSync(resolve(bundle))) fail(`Attestation bundle is absent: ${bundle}`);
  if (!existsSync(resolve(trustedRoot))) fail(`Trusted root is absent: ${trustedRoot}`);
  const artifact = attestedSubject
    ?? statement.subject.find((subject) => subject?.name === "artifacts/axm-arc-game.tar.gz")?.name;
  if (!artifact || !statement.subject.some((subject) => subject?.name === artifact)) {
    fail(`Attested subject is absent from provenance: ${artifact ?? "<unspecified>"}`);
  }
  const result = spawnSync("gh", [
    "attestation", "verify", insideRoot(artifact),
    "--repo", repo,
    "--bundle", resolve(bundle),
    "--custom-trusted-root", resolve(trustedRoot),
    "--format", "json",
  ], { encoding: "utf8", shell: process.platform === "win32" });
  if (result.error) fail(`Could not launch GitHub attestation verifier: ${result.error.message}`);
  if (result.status !== 0) fail(`GitHub attestation verification failed.\n${result.stdout}\n${result.stderr}`);
  signature = { attempted: true, verified: true, subject: artifact };
}

console.log(JSON.stringify({
  format: "axm-arc-offline-evidence-verification/1",
  root,
  filesChecked: checked.length,
  provenanceSubjects: statement.subject.length,
  sboms: sboms.length,
  signature,
  status: "pass",
}, null, 2));
