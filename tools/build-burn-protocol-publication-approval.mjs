#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

const argv = process.argv.slice(2);

function fail(message) {
  throw new Error(message);
}

function option(name, fallback = null) {
  const index = argv.indexOf(name);
  if (index === -1) return fallback;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`Missing value for ${name}.`);
  return value;
}

function requiredOption(name) {
  return option(name) ?? fail(`${name} is required.`);
}

function compareCodepoints(a, b) {
  const left = a[Symbol.iterator]();
  const right = b[Symbol.iterator]();
  while (true) {
    const l = left.next();
    const r = right.next();
    if (l.done || r.done) return l.done === r.done ? 0 : l.done ? -1 : 1;
    const lcp = l.value.codePointAt(0);
    const rcp = r.value.codePointAt(0);
    if (lcp !== rcp) return lcp < rcp ? -1 : 1;
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareCodepoints)
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function canonicalString(value) {
  return JSON.stringify(canonical(value));
}

function canonicalText(value) {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function sha256File(filePath) {
  return sha256Buffer(readFileSync(filePath));
}

function readJson(filePath, maxBytes = 64 * 1024 * 1024) {
  const stats = statSync(filePath);
  if (!stats.isFile()) fail(`${filePath} is not a file.`);
  if (stats.size > maxBytes) fail(`${filePath} exceeds ${maxBytes} bytes.`);
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`${filePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function plainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object.`);
  return value;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) fail(`${label}: expected ${String(expected)}, got ${String(actual)}.`);
}

function assertCanonicalEqual(actual, expected, label) {
  if (canonicalString(actual) !== canonicalString(expected)) fail(`${label} does not match.`);
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.length === 0) fail(`${label} must be a non-empty string.`);
  return value;
}

function requiredInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${label} must be a non-negative safe integer.`);
  return value;
}

function safeAssetPath(value) {
  const pathValue = requiredString(value, "Asset path");
  if (pathValue.includes("\\")) fail(`Asset path uses a backslash: ${pathValue}`);
  if (pathValue.startsWith("/") || /^[A-Za-z]:\//.test(pathValue)) fail(`Asset path is absolute: ${pathValue}`);
  if (pathValue.split("/").some((part) => part === "..")) fail(`Asset path escapes its root: ${pathValue}`);
  return pathValue;
}

function validateAssetIndex(document) {
  const index = plainObject(document, "Asset index");
  assertEqual(index.format, "burn-protocol-corpus-asset-index/1", "Asset index format");
  if (!Array.isArray(index.assets)) fail("Asset index assets must be an array.");
  const allowedClassifications = new Set([
    "panel-raster",
    "scroll-plate",
    "reader-evidence",
    "visual-evidence",
  ]);
  const seen = new Set();
  const counts = {};
  for (const [position, raw] of index.assets.entries()) {
    const asset = plainObject(raw, `Asset ${position}`);
    const pathValue = safeAssetPath(asset.path);
    if (seen.has(pathValue)) fail(`Asset index duplicates ${pathValue}.`);
    seen.add(pathValue);
    const digest = requiredString(asset.sha256, `Asset ${pathValue} SHA-256`).toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(digest)) fail(`Asset ${pathValue} has an invalid SHA-256.`);
    requiredInteger(asset.bytes, `Asset ${pathValue} bytes`);
    const classification = requiredString(asset.classification, `Asset ${pathValue} classification`);
    if (!allowedClassifications.has(classification)) {
      fail(`Asset ${pathValue} has unsupported classification ${classification}.`);
    }
    counts[classification] = (counts[classification] ?? 0) + 1;
  }
  assertCanonicalEqual(index.counts, counts, "Asset index counts");
  return { index, counts, assets: index.assets.length };
}

function projection(value, keys, label) {
  const source = plainObject(value, label);
  const output = {};
  for (const key of keys) output[key] = source[key];
  return output;
}

function validateReceiptAgainstContract(receiptDocument, contractDocument, assetSummary, contractPath) {
  const receipt = plainObject(receiptDocument, "Intake receipt");
  const contract = plainObject(contractDocument, "Intake contract");
  assertEqual(receipt.format, "burn-protocol-handoff-intake-receipt/1", "Intake receipt format");
  assertEqual(receipt.status, "pass", "Intake receipt status");
  assertEqual(contract.format, "burn-protocol-handoff-intake-contract/1", "Intake contract format");

  const receiptContract = plainObject(receipt.contract, "Intake receipt contract");
  const handoff = plainObject(receipt.handoff, "Intake receipt handoff");
  const parent = plainObject(receipt.parent, "Intake receipt parent");
  const outerManifest = plainObject(receipt.outerManifest, "Intake receipt outer manifest");
  const receiptAssetIndex = plainObject(receipt.assetIndex, "Intake receipt asset index");

  assertEqual(receiptContract.sha256, sha256File(contractPath), "Intake contract SHA-256");
  assertCanonicalEqual(
    projection(handoff, ["sha256", "bytes", "entries"], "Intake receipt handoff"),
    projection(contract.handoff, ["sha256", "bytes", "entries"], "Intake contract handoff"),
    "Handoff identity",
  );
  assertCanonicalEqual(
    projection(
      parent,
      ["sha256", "bytes", "entries", "manifestRecords", "manifestUncompressedBytes"],
      "Intake receipt parent",
    ),
    projection(
      contract.parent,
      ["sha256", "bytes", "entries", "manifestRecords", "manifestUncompressedBytes"],
      "Intake contract parent",
    ),
    "Parent identity",
  );
  assertEqual(outerManifest.records, contract.outerManifest?.records, "Outer manifest record count");
  assertCanonicalEqual(receipt.authority, contract.authority, "Intake authority");
  assertEqual(receiptAssetIndex.assets, assetSummary.assets, "Receipt asset count");
  assertCanonicalEqual(receiptAssetIndex.counts, assetSummary.counts, "Receipt asset counts");
  return { receipt, contract, handoff, parent, outerManifest };
}

const intakeReceiptPath = resolve(requiredOption("--intake-receipt"));
const assetIndexPath = resolve(requiredOption("--asset-index"));
const intakeContractPath = resolve(requiredOption("--intake-contract"));
const outputPath = resolve(option("--output", resolve(process.cwd(), "handoff-publication-approval.json")));

const receiptDocument = readJson(intakeReceiptPath, 8 * 1024 * 1024);
const assetDocument = readJson(assetIndexPath);
const contractDocument = readJson(intakeContractPath, 8 * 1024 * 1024);
const assetSummary = validateAssetIndex(assetDocument);
const validated = validateReceiptAgainstContract(
  receiptDocument,
  contractDocument,
  assetSummary,
  intakeContractPath,
);

const core = {
  format: "burn-protocol-handoff-publication-approval/1",
  status: "approved",
  source: "verified-handoff-intake-output",
  intakeContract: {
    path: basename(intakeContractPath),
    sha256: sha256File(intakeContractPath),
    bytes: statSync(intakeContractPath).size,
  },
  intakeReceipt: {
    path: basename(intakeReceiptPath),
    sha256: sha256File(intakeReceiptPath),
    bytes: statSync(intakeReceiptPath).size,
  },
  assetIndex: {
    path: basename(assetIndexPath),
    sha256: sha256File(assetIndexPath),
    bytes: statSync(assetIndexPath).size,
    assets: assetSummary.assets,
    counts: assetSummary.counts,
  },
  handoff: projection(validated.handoff, ["sha256", "bytes", "entries"], "Handoff"),
  outerManifest: projection(validated.outerManifest, ["records", "uncompressedBytes"], "Outer manifest"),
  parent: projection(
    validated.parent,
    ["sha256", "bytes", "entries", "manifestRecords", "manifestUncompressedBytes"],
    "Parent",
  ),
  authority: validated.receipt.authority,
};
const approval = {
  ...core,
  integrity: {
    algorithm: "sha256",
    digest: `approval1_${sha256Buffer(Buffer.from(canonicalString(core), "utf8"))}`,
  },
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, canonicalText(approval));
console.log(canonicalText(approval).trimEnd());
