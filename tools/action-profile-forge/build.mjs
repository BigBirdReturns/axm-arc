#!/usr/bin/env node

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

const args = process.argv.slice(2);
function option(name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}.`);
  return value;
}

const sourceRoot = resolve(import.meta.dirname);
const outputRoot = resolve(option("--output") ?? "docs/action-profile-forge");
const profileSource = resolve(option("--profile") ?? join(sourceRoot, "examples", "first-charter.action-profile.json"));
const specSource = resolve(option("--spec") ?? join(sourceRoot, "examples", "first-charter.action-spec.json"));
const receiptSource = resolve(option("--template-receipt") ?? join(sourceRoot, "examples", "first-charter.template-receipt.json"));
const authorityCommit = option("--authority-commit") ?? process.env.ARC_ACTION_AUTHORITY_SHA ?? "unknown";

for (const path of [profileSource, specSource, receiptSource]) {
  if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`Required Forge source is absent: ${path}`);
}
if (!/^[0-9a-f]{40}$/.test(authorityCommit)) throw new Error("Forge build requires an exact 40-character Arc action authority commit.");

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(join(outputRoot, "examples"), { recursive: true });
for (const name of ["index.html", "styles.css", "app.js", "profile-forge.mjs"]) {
  const source = join(sourceRoot, name);
  if (!existsSync(source)) throw new Error(`Forge source is absent: ${source}`);
  cpSync(source, join(outputRoot, name));
}
cpSync(profileSource, join(outputRoot, "examples", "first-charter.action-profile.json"));
cpSync(specSource, join(outputRoot, "examples", "first-charter.action-spec.json"));
cpSync(receiptSource, join(outputRoot, "examples", "first-charter.template-receipt.json"));

const readme = `# AXM Action Profile Forge\n\nThis directory is a dependency-free static build generated from \`tools/action-profile-forge\`.\n\nThe bundled example profile and action spec were accepted by Arc action authority commit \`${authorityCommit}\`. The browser surface edits exact profile bytes and exports a Forge receipt. Successful Forge validation does not replace Arc compilation or issue an action receipt.\n`;
writeFileSync(join(outputRoot, "README.md"), readme);

function files(path) {
  return readdirSync(path, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const child = join(path, entry.name);
      return entry.isDirectory() ? files(child) : [child];
    });
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const prohibited = [
  { label: "remote runtime URL", pattern: /(?:https?:)?\/\/(?!www\.w3\.org\/)[A-Za-z0-9.-]+/i },
  { label: "dynamic evaluation", pattern: /\beval\s*\(|\bnew\s+Function\s*\(/ },
  { label: "service worker", pattern: /navigator\.serviceWorker|serviceWorker\.register/ },
];

const inventory = [];
for (const path of files(outputRoot)) {
  const name = relative(outputRoot, path).replace(/\\/g, "/");
  if (name === "manifest.json") continue;
  const bytes = readFileSync(path);
  const text = /\.(?:html|css|js|mjs|json|md)$/i.test(path) ? bytes.toString("utf8") : null;
  if (text !== null && !name.endsWith(".template-receipt.json")) {
    for (const rule of prohibited) {
      if (rule.pattern.test(text)) throw new Error(`${name} contains prohibited ${rule.label}.`);
    }
  }
  inventory.push({ path: name, bytes: bytes.length, sha256: sha256(bytes) });
}

const profile = JSON.parse(readFileSync(join(outputRoot, "examples", "first-charter.action-profile.json"), "utf8"));
const spec = JSON.parse(readFileSync(join(outputRoot, "examples", "first-charter.action-spec.json"), "utf8"));
const templateReceipt = JSON.parse(readFileSync(join(outputRoot, "examples", "first-charter.template-receipt.json"), "utf8"));
if (profile.format !== "axm-action-profile/1") throw new Error("Bundled Forge profile has the wrong format.");
if (spec.format !== "axm-action-spec/1" || !/^actspec1_[0-9a-f]{64}$/.test(spec.specDigest)) throw new Error("Bundled Forge action spec is invalid.");
if (templateReceipt.status !== "pass" || templateReceipt.actionSpecDigest !== spec.specDigest) throw new Error("Bundled Forge template receipt does not bind the exact action spec.");
if (templateReceipt.arcActionAuthorityCommit !== authorityCommit) throw new Error("Bundled Forge template receipt names a different Arc action authority commit.");

const manifest = {
  format: "axm-action-profile-forge-static/1",
  authorityCommit,
  profileFormat: profile.format,
  actionSpecFormat: spec.format,
  actionSpecDigest: spec.specDigest,
  challengeId: spec.challengeId,
  templateReceiptFormat: templateReceipt.format,
  files: inventory,
  totalBytes: inventory.reduce((sum, file) => sum + file.bytes, 0),
  remoteRuntimeReferences: 0,
  dynamicEvaluation: false,
  serviceWorker: false,
  status: "pass",
};
writeFileSync(join(outputRoot, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({
  format: "axm-action-profile-forge-build/1",
  status: "pass",
  output: outputRoot,
  authorityCommit,
  actionSpecDigest: spec.specDigest,
  challengeId: spec.challengeId,
  files: inventory.length + 1,
  totalBytes: manifest.totalBytes,
  manifestSha256: sha256(readFileSync(join(outputRoot, "manifest.json"))),
}, null, 2));
