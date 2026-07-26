#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

function fail(message) { console.error(message); process.exit(1); }
const args = process.argv.slice(2);
function values(name) {
  const out = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== name) continue;
    const value = args[index + 1];
    if (!value || value.startsWith("--")) fail(`Missing value for ${name}.`);
    out.push(value);
    index += 1;
  }
  return out;
}
function option(name, fallback = null) { return values(name)[0] ?? fallback; }
function normalizePath(value) { return value.replace(/\\/g, "/").replace(/\/+$/, ""); }
function isWithin(rootPath, candidatePath) {
  const root = normalizePath(rootPath);
  const candidate = normalizePath(candidatePath);
  return candidate === root || candidate.startsWith(`${root}/`);
}
function sha256(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function compareStrings(left, right) { return left < right ? -1 : left > right ? 1 : 0; }
function requireCommit(value) {
  if (!/^[0-9a-f]{40}$/.test(value)) fail("Arc commit must be a 40-character lowercase Git SHA.");
  return value;
}
function dependencyRecord(raw) {
  const split = raw.indexOf("=");
  if (split < 1 || split === raw.length - 1) fail(`Dependency must be name=digest-or-uri: ${raw}`);
  const name = raw.slice(0, split);
  const value = raw.slice(split + 1);
  return /^[0-9a-f]{64}$/.test(value)
    ? { uri: name, digest: { sha256: value } }
    : { uri: `${name}=${value}` };
}

const outputPath = resolve(option("--output") ?? "provenance.intoto.json");
const evidenceRoot = dirname(outputPath);
const evidenceRootReal = realpathSync(evidenceRoot);
const subjectPaths = values("--subject").map((path) => resolve(path));
if (subjectPaths.length === 0) fail("At least one --subject file is required.");
const seenSubjects = new Set();
const subjects = subjectPaths.map((path) => {
  let stat;
  try { stat = statSync(path); } catch { fail(`Subject is absent: ${path}`); }
  if (!stat.isFile()) fail(`Subject is not a file: ${path}`);
  const real = realpathSync(path);
  if (!isWithin(evidenceRootReal, real)) fail(`Subject resolves outside the evidence root: ${path}`);
  const name = normalizePath(relative(evidenceRoot, path));
  if (!name || name === ".." || name.startsWith("../") || name.startsWith("/")) fail(`Subject is not a contained evidence path: ${path}`);
  if (seenSubjects.has(name)) fail(`Duplicate provenance subject: ${name}`);
  seenSubjects.add(name);
  return { name, digest: { sha256: sha256(path) } };
}).sort((left, right) => compareStrings(left.name, right.name));

const repository = option("--repository") ?? process.env.GITHUB_REPOSITORY ?? "BigBirdReturns/axm-arc";
const commit = requireCommit(option("--commit") ?? process.env.GITHUB_SHA ?? "unknown");
const ref = option("--ref") ?? process.env.GITHUB_REF ?? "unknown";
const workflow = option("--workflow") ?? process.env.GITHUB_WORKFLOW_REF ?? "local";
const invocation = option("--invocation") ?? process.env.GITHUB_RUN_ID ?? "local";
const builder = option("--builder") ?? "https://github.com/actions/runner";
const sourceDateEpoch = option("--source-date-epoch") ?? process.env.SOURCE_DATE_EPOCH ?? "0";
if (!/^(0|[1-9][0-9]*)$/.test(sourceDateEpoch)) fail("SOURCE_DATE_EPOCH must be a non-negative integer.");
const nodeVersion = option("--node") ?? process.version;
const npmVersion = option("--npm") ?? "unknown";
const dependencies = values("--dependency").map(dependencyRecord).sort((left, right) => compareStrings(left.uri, right.uri));
const seenDependencies = new Set();
for (const dependency of dependencies) {
  if (seenDependencies.has(dependency.uri)) fail(`Duplicate resolved dependency: ${dependency.uri}`);
  seenDependencies.add(dependency.uri);
}

const statement = {
  _type: "https://in-toto.io/Statement/v1",
  subject: subjects,
  predicateType: "https://slsa.dev/provenance/v1",
  predicate: {
    buildDefinition: {
      buildType: "https://axm.tools/build-types/axm-arc-static/v1",
      externalParameters: { repository, commit, ref, sourceDateEpoch },
      internalParameters: { nodeVersion, npmVersion, workflow },
      resolvedDependencies: dependencies,
    },
    runDetails: {
      builder: { id: builder },
      metadata: { invocationId: invocation },
      byproducts: [],
    },
  },
};
writeFileSync(outputPath, `${JSON.stringify(statement, null, 2)}\n`);
console.log(JSON.stringify({
  format: "axm-arc-release-provenance-generation/2",
  output: normalizePath(relative(process.cwd(), outputPath)),
  subjects,
  predicateType: statement.predicateType,
  commit,
}, null, 2));
