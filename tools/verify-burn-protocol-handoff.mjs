#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function canonicalText(value) {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  if (result.error) fail(`${commandName} could not run: ${result.error.message}`);
  if (result.status !== 0) {
    fail(`${commandName} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  await new Promise((accept, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", accept);
  });
  return hash.digest("hex");
}

function toPosix(pathValue) {
  return pathValue.split(sep).join("/");
}

function walk(root) {
  const records = [];
  function visit(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) records.push({
        absolute,
        path: toPosix(relative(root, absolute)),
        bytes: statSync(absolute).size,
      });
    }
  }
  visit(root);
  return records.sort((left, right) => left.path.localeCompare(right.path));
}

function listZipEntries(zipPath) {
  const output = command("unzip", ["-Z1", zipPath]);
  const entries = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const seen = new Set();
  for (const entry of entries) {
    if (entry.includes("\\")) fail(`ZIP entry uses a backslash path: ${entry}`);
    if (entry.startsWith("/") || /^[A-Za-z]:\//.test(entry)) fail(`ZIP entry is absolute: ${entry}`);
    const parts = entry.split("/").filter(Boolean);
    if (parts.some((part) => part === "..")) fail(`ZIP entry escapes its root: ${entry}`);
    if (seen.has(entry)) fail(`ZIP entry is duplicated: ${entry}`);
    seen.add(entry);
  }
  return entries;
}

function testZip(zipPath) {
  command("unzip", ["-tqq", zipPath]);
}

function extractZip(zipPath, outputRoot) {
  mkdirSync(outputRoot, { recursive: true });
  command("unzip", ["-qq", zipPath, "-d", outputRoot]);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) fail(`${label}: expected ${expected}, got ${actual}.`);
}

function findByBasename(root, expectedBasename) {
  const matches = walk(root).filter((record) => basename(record.path) === expectedBasename);
  if (matches.length !== 1) {
    fail(`Expected exactly one ${expectedBasename} in ${root}, found ${matches.length}.`);
  }
  return matches[0];
}

function manifestRecord(record, fallbackPath = null) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const pathValue = record.path ?? record.name ?? record.file ?? record.relativePath ?? fallbackPath;
  let hashValue = record.sha256 ?? record.sha256Hex ?? record.hash ?? record.digest;
  const bytesValue = record.bytes ?? record.size ?? record.byteLength ?? record.uncompressedBytes;
  if (typeof pathValue !== "string" || typeof hashValue !== "string") return null;
  hashValue = hashValue.replace(/^sha256:/i, "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hashValue)) return null;
  const bytes = Number(bytesValue);
  if (!Number.isSafeInteger(bytes) || bytes < 0) return null;
  return { path: toPosix(pathValue), sha256: hashValue, bytes };
}

function manifestCandidates(value, depth = 0, label = "root") {
  if (depth > 4 || !value || typeof value !== "object") return [];
  const candidates = [];
  if (Array.isArray(value)) {
    const records = value.map((item) => manifestRecord(item)).filter(Boolean);
    if (records.length === value.length && records.length > 0) candidates.push({ label, records });
    return candidates;
  }
  for (const [key, child] of Object.entries(value)) {
    if (Array.isArray(child)) {
      const records = child.map((item) => manifestRecord(item)).filter(Boolean);
      if (records.length === child.length && records.length > 0) {
        candidates.push({ label: `${label}.${key}`, records });
      }
    } else if (child && typeof child === "object") {
      const mapRecords = Object.entries(child)
        .map(([pathValue, metadata]) => manifestRecord(metadata, pathValue))
        .filter(Boolean);
      if (mapRecords.length === Object.keys(child).length && mapRecords.length > 0) {
        candidates.push({ label: `${label}.${key}`, records: mapRecords });
      }
      candidates.push(...manifestCandidates(child, depth + 1, `${label}.${key}`));
    }
  }
  return candidates;
}

function parseManifest(filePath, expectedRecords) {
  let document;
  try {
    document = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`Manifest ${filePath} is not valid JSON: ${String(error)}`);
  }
  const candidates = manifestCandidates(document);
  const exact = candidates.filter((candidate) => candidate.records.length === expectedRecords);
  if (exact.length !== 1) {
    fail(`Manifest ${filePath} has ${exact.length} candidate record sets with ${expectedRecords} records.`);
  }
  const seen = new Set();
  for (const record of exact[0].records) {
    if (seen.has(record.path)) fail(`Manifest ${filePath} duplicates ${record.path}.`);
    seen.add(record.path);
  }
  return exact[0].records;
}

async function verifyManifest(root, records, expectedBytes, label) {
  let totalBytes = 0;
  for (const record of records) {
    const absolute = resolve(root, record.path);
    const rel = toPosix(relative(root, absolute));
    if (rel.startsWith("../") || rel === "..") fail(`${label} record escapes root: ${record.path}`);
    if (!existsSync(absolute)) fail(`${label} record is missing: ${record.path}`);
    const stats = statSync(absolute);
    if (!stats.isFile()) fail(`${label} record is not a file: ${record.path}`);
    assertEqual(stats.size, record.bytes, `${label} bytes for ${record.path}`);
    assertEqual(await sha256File(absolute), record.sha256, `${label} SHA-256 for ${record.path}`);
    totalBytes += stats.size;
  }
  if (expectedBytes !== null && expectedBytes !== undefined) {
    assertEqual(totalBytes, expectedBytes, `${label} total uncompressed bytes`);
  }
  return totalBytes;
}

function discoverOuterManifest(root, recordCount, excludedBasenames = []) {
  const candidates = [];
  for (const file of walk(root)) {
    if (extname(file.path).toLowerCase() !== ".json") continue;
    if (excludedBasenames.includes(basename(file.path))) continue;
    try {
      const records = parseManifest(file.absolute, recordCount);
      candidates.push({ file, records });
    } catch {
      // Other JSON evidence files are intentionally ignored.
    }
  }
  if (candidates.length !== 1) {
    fail(`Expected one outer manifest with ${recordCount} records, found ${candidates.length}.`);
  }
  return candidates[0];
}

function findVerifier(entries, patterns) {
  const matches = entries.filter((entry) => patterns.some((pattern) => new RegExp(pattern, "i").test(entry)));
  if (matches.length !== 1) fail(`Expected one executable verifier entry, found ${matches.length}: ${matches.join(", ")}`);
  return matches[0];
}

function scanForTerms(root, terms, maxBytes) {
  const allowed = new Set([".json", ".md", ".txt", ".js", ".mjs", ".ts", ".html"]);
  const hits = [];
  for (const file of walk(root)) {
    if (file.bytes > maxBytes || !allowed.has(extname(file.path).toLowerCase())) continue;
    const text = readFileSync(file.absolute, "utf8");
    if (terms.every((term) => text.includes(term))) hits.push(file.path);
  }
  if (hits.length === 0) fail(`No extracted parent file contains all state-pointer terms: ${terms.join(", ")}.`);
  return hits;
}

function classifyAsset(pathValue) {
  const lower = pathValue.toLowerCase();
  if (!/\.(png|jpe?g|webp|gif|svg)$/.test(lower)) return null;
  if (lower.includes("reader-art-smoke")) return "reader-evidence";
  if (lower.includes("plate")) return "scroll-plate";
  if (/e\d+[-_]c\d+[-_]p\d+/.test(lower) || lower.includes("/panels/")) return "panel-raster";
  return "visual-evidence";
}

function buildAssetIndex(parentRecords) {
  const assets = parentRecords
    .map((record) => ({ ...record, classification: classifyAsset(record.path) }))
    .filter((record) => record.classification !== null);
  const counts = {};
  for (const asset of assets) counts[asset.classification] = (counts[asset.classification] ?? 0) + 1;
  return {
    format: "burn-protocol-corpus-asset-index/1",
    generatedFrom: "verified nested v0.58.0 manifest",
    counts,
    assets,
  };
}

async function main() {
  const handoffPath = resolve(requiredOption("--handoff"));
  const contractPath = resolve(option(
    "--contract",
    resolve(dirname(fileURLToPath(import.meta.url)), "..", "docs", "contracts", "burn-protocol-v0.58.0-a13c1-handoff.contract.json"),
  ));
  const outputRoot = resolve(option("--output", resolve(process.cwd(), "burn-protocol-handoff-intake")));
  if (!existsSync(handoffPath)) fail(`Handoff does not exist: ${handoffPath}`);
  if (!existsSync(contractPath)) fail(`Contract does not exist: ${contractPath}`);
  const contract = JSON.parse(readFileSync(contractPath, "utf8"));
  if (contract.format !== "burn-protocol-handoff-intake-contract/1") {
    fail(`Unsupported intake contract: ${String(contract.format)}.`);
  }

  const tempRoot = mkdtempSync(join(tmpdir(), "burn-protocol-handoff-"));
  const outerRoot = join(tempRoot, "outer");
  const parentRoot = join(tempRoot, "parent");
  try {
    assertEqual(basename(handoffPath), contract.handoff.basename, "Handoff basename");
    assertEqual(statSync(handoffPath).size, contract.handoff.bytes, "Handoff bytes");
    assertEqual(await sha256File(handoffPath), contract.handoff.sha256, "Handoff SHA-256");
    testZip(handoffPath);
    const outerEntries = listZipEntries(handoffPath);
    assertEqual(outerEntries.length, contract.handoff.entries, "Handoff ZIP entries");
    extractZip(handoffPath, outerRoot);

    for (const required of contract.requiredBasenames ?? []) findByBasename(outerRoot, required);
    const verifierEntry = findVerifier(outerEntries, contract.verifierPatterns ?? []);

    const parentArchive = findByBasename(outerRoot, contract.parent.basename);
    assertEqual(parentArchive.bytes, contract.parent.bytes, "Nested parent bytes");
    assertEqual(await sha256File(parentArchive.absolute), contract.parent.sha256, "Nested parent SHA-256");
    const parentSidecar = findByBasename(outerRoot, contract.parent.sha256ReceiptBasename);
    const sidecarHash = readFileSync(parentSidecar.absolute, "utf8").match(/[0-9a-f]{64}/i)?.[0]?.toLowerCase();
    assertEqual(sidecarHash, contract.parent.sha256, "Nested parent sidecar SHA-256");

    testZip(parentArchive.absolute);
    const parentEntries = listZipEntries(parentArchive.absolute);
    assertEqual(parentEntries.length, contract.parent.entries, "Nested parent ZIP entries");
    extractZip(parentArchive.absolute, parentRoot);

    const parentManifestFile = findByBasename(parentRoot, contract.parent.manifestBasename);
    const parentRecords = parseManifest(parentManifestFile.absolute, contract.parent.manifestRecords);
    const parentManifestBytes = await verifyManifest(
      parentRoot,
      parentRecords,
      contract.parent.manifestUncompressedBytes,
      "Nested parent manifest",
    );

    const outerManifest = discoverOuterManifest(
      outerRoot,
      contract.outerManifest.records,
      [contract.parent.manifestBasename],
    );
    const outerManifestBytes = await verifyManifest(
      outerRoot,
      outerManifest.records,
      contract.outerManifest.uncompressedBytes ?? null,
      "Outer handoff manifest",
    );

    const productionContract = findByBasename(outerRoot, contract.productionContract.basename);
    if (productionContract.bytes < contract.productionContract.minBytes || productionContract.bytes > contract.productionContract.maxBytes) {
      fail(`Production contract bytes ${productionContract.bytes} are outside ${contract.productionContract.minBytes}-${contract.productionContract.maxBytes}.`);
    }
    const productionText = readFileSync(productionContract.absolute, "utf8");
    for (const requiredText of contract.productionContract.requiredText ?? []) {
      if (!productionText.includes(requiredText)) fail(`Production contract is missing ${JSON.stringify(requiredText)}.`);
    }

    const statePointerFiles = scanForTerms(
      parentRoot,
      contract.statePointer.requiredTerms,
      contract.statePointer.maxFileBytes,
    );

    const validationFile = findByBasename(outerRoot, contract.corpusValidation.basename);
    const validationText = readFileSync(validationFile.absolute, "utf8");
    for (const requiredText of contract.corpusValidation.requiredText ?? []) {
      if (!validationText.includes(requiredText)) fail(`Corpus validation record is missing ${JSON.stringify(requiredText)}.`);
    }

    mkdirSync(outputRoot, { recursive: true });
    const assetIndex = buildAssetIndex(parentRecords);
    writeFileSync(join(outputRoot, "corpus-asset-index.json"), canonicalText(assetIndex));

    const receipt = {
      format: "burn-protocol-handoff-intake-receipt/1",
      status: "pass",
      contract: {
        path: contractPath,
        sha256: await sha256File(contractPath),
      },
      handoff: {
        path: handoffPath,
        sha256: contract.handoff.sha256,
        bytes: contract.handoff.bytes,
        entries: outerEntries.length,
      },
      outerManifest: {
        path: outerManifest.file.path,
        records: outerManifest.records.length,
        uncompressedBytes: outerManifestBytes,
      },
      verifierEntry,
      parent: {
        path: parentArchive.path,
        sha256: contract.parent.sha256,
        bytes: parentArchive.bytes,
        entries: parentEntries.length,
        manifest: parentManifestFile.path,
        manifestRecords: parentRecords.length,
        manifestUncompressedBytes: parentManifestBytes,
      },
      productionContract: {
        path: productionContract.path,
        bytes: productionContract.bytes,
      },
      statePointerFiles,
      assetIndex: {
        path: "corpus-asset-index.json",
        counts: assetIndex.counts,
        assets: assetIndex.assets.length,
      },
      authority: contract.authority,
    };
    writeFileSync(join(outputRoot, "handoff-intake-receipt.json"), canonicalText(receipt));
    console.log(canonicalText(receipt).trimEnd());
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
