#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

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

function safeRelativePath(value, label) {
  const pathValue = requiredString(value, label);
  if (pathValue.includes("\\")) fail(`${label} uses a backslash: ${pathValue}`);
  if (pathValue.startsWith("/") || /^[A-Za-z]:\//.test(pathValue)) fail(`${label} is absolute: ${pathValue}`);
  if (pathValue.split("/").some((part) => part === "..")) fail(`${label} escapes its root: ${pathValue}`);
  return pathValue;
}

function safeBasename(value, label) {
  const pathValue = safeRelativePath(value, label);
  if (basename(pathValue) !== pathValue) fail(`${label} must be a basename.`);
  return pathValue;
}

function projection(value, keys, label) {
  const source = plainObject(value, label);
  const output = {};
  for (const key of keys) output[key] = source[key];
  return output;
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
    const pathValue = safeRelativePath(asset.path, `Asset ${position} path`);
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

function validateApproval(approvalDocument, paths, receipt, assetSummary, intakeContract) {
  const approval = plainObject(approvalDocument, "Publication approval");
  assertEqual(approval.format, "burn-protocol-handoff-publication-approval/1", "Approval format");
  assertEqual(approval.status, "approved", "Approval status");
  assertEqual(approval.source, "verified-handoff-intake-output", "Approval source");

  const integrity = plainObject(approval.integrity, "Approval integrity");
  assertEqual(integrity.algorithm, "sha256", "Approval integrity algorithm");
  const { integrity: _ignored, ...core } = approval;
  const expectedDigest = `approval1_${sha256Buffer(Buffer.from(canonicalString(core), "utf8"))}`;
  assertEqual(integrity.digest, expectedDigest, "Approval integrity digest");

  const approvalReceipt = plainObject(approval.intakeReceipt, "Approval intake receipt");
  const approvalIndex = plainObject(approval.assetIndex, "Approval asset index");
  const approvalContract = plainObject(approval.intakeContract, "Approval intake contract");
  assertEqual(approvalReceipt.sha256, sha256File(paths.intakeReceipt), "Intake receipt SHA-256");
  assertEqual(approvalReceipt.bytes, statSync(paths.intakeReceipt).size, "Intake receipt bytes");
  assertEqual(approvalIndex.sha256, sha256File(paths.assetIndex), "Asset index SHA-256");
  assertEqual(approvalIndex.bytes, statSync(paths.assetIndex).size, "Asset index bytes");
  assertEqual(approvalContract.sha256, sha256File(paths.intakeContract), "Intake contract SHA-256");
  assertEqual(approvalContract.bytes, statSync(paths.intakeContract).size, "Intake contract bytes");
  assertEqual(approvalIndex.assets, assetSummary.assets, "Approval asset count");
  assertCanonicalEqual(approvalIndex.counts, assetSummary.counts, "Approval asset counts");

  assertCanonicalEqual(
    approval.handoff,
    projection(receipt.handoff, ["sha256", "bytes", "entries"], "Receipt handoff"),
    "Approval handoff",
  );
  assertCanonicalEqual(
    approval.parent,
    projection(
      receipt.parent,
      ["sha256", "bytes", "entries", "manifestRecords", "manifestUncompressedBytes"],
      "Receipt parent",
    ),
    "Approval parent",
  );
  assertCanonicalEqual(approval.authority, receipt.authority, "Approval authority");
  assertCanonicalEqual(approval.authority, intakeContract.authority, "Approval contract authority");
  return approval;
}

function validateIntake(receiptDocument, intakeContractDocument, assetSummary, intakeContractPath) {
  const receipt = plainObject(receiptDocument, "Intake receipt");
  const intakeContract = plainObject(intakeContractDocument, "Intake contract");
  assertEqual(receipt.format, "burn-protocol-handoff-intake-receipt/1", "Intake receipt format");
  assertEqual(receipt.status, "pass", "Intake receipt status");
  assertEqual(intakeContract.format, "burn-protocol-handoff-intake-contract/1", "Intake contract format");
  const receiptContract = plainObject(receipt.contract, "Receipt contract");
  assertEqual(receiptContract.sha256, sha256File(intakeContractPath), "Receipt intake contract SHA-256");
  assertCanonicalEqual(
    projection(receipt.handoff, ["sha256", "bytes", "entries"], "Receipt handoff"),
    projection(intakeContract.handoff, ["sha256", "bytes", "entries"], "Contract handoff"),
    "Intake handoff identity",
  );
  assertCanonicalEqual(
    projection(
      receipt.parent,
      ["sha256", "bytes", "entries", "manifestRecords", "manifestUncompressedBytes"],
      "Receipt parent",
    ),
    projection(
      intakeContract.parent,
      ["sha256", "bytes", "entries", "manifestRecords", "manifestUncompressedBytes"],
      "Contract parent",
    ),
    "Intake parent identity",
  );
  assertEqual(receipt.outerManifest?.records, intakeContract.outerManifest?.records, "Outer manifest records");
  assertCanonicalEqual(receipt.authority, intakeContract.authority, "Intake authority");
  assertEqual(receipt.assetIndex?.assets, assetSummary.assets, "Receipt asset count");
  assertCanonicalEqual(receipt.assetIndex?.counts, assetSummary.counts, "Receipt asset counts");
  return { receipt, intakeContract };
}

const RESERVED_ENVELOPE_KEYS = new Set([
  "digest",
  "cartridgeDigest",
  "signature",
  "signatures",
  "trust",
  "trustLabel",
  "provenance",
  "importedAt",
  "source",
  "sourcePath",
  "verifiedAt",
  "verification",
  "publisher",
  "publisherKey",
  "genesis",
  "attestation",
  "attestations",
]);

function cartridgeDigest(arc) {
  const root = plainObject(arc, "Arc");
  const authored = {};
  for (const key of Object.keys(root).sort(compareCodepoints)) {
    if (!RESERVED_ENVELOPE_KEYS.has(key)) authored[key] = root[key];
  }
  return `cart1_${sha256Buffer(Buffer.from(canonicalString(authored), "utf8"))}`;
}

function verifyPublicationFile(publicationDir, name, expected) {
  const path = resolve(publicationDir, safeRelativePath(name, `Publication file ${name}`));
  const record = plainObject(expected, `Publication receipt file ${name}`);
  assertEqual(statSync(path).size, record.bytes, `${name} bytes`);
  assertEqual(sha256File(path), record.sha256, `${name} SHA-256`);
  return path;
}

function validatePublication(publicationDir, activationContract) {
  const publication = plainObject(activationContract.publication, "Activation publication");
  const files = plainObject(publication.files, "Activation publication files");
  const receiptPath = resolve(publicationDir, safeRelativePath(files.receipt, "Publication receipt path"));
  const publicationReceipt = plainObject(readJson(receiptPath, 8 * 1024 * 1024), "Publication receipt");
  assertEqual(publicationReceipt.format, "rodoh-corpus-publication-receipt/1", "Publication receipt format");
  assertEqual(publicationReceipt.status, "pass", "Publication receipt status");
  assertEqual(publicationReceipt.cartridgeId, publication.cartridgeId, "Publication cartridge id");
  assertEqual(publicationReceipt.engineVersion, publication.engineVersion, "Publication engine version");
  assertEqual(publicationReceipt.sourcePlane, publication.sourcePlane, "Publication source plane");
  assertEqual(publicationReceipt.exactParentSha256, publication.exactParentSha256, "Publication parent SHA-256");

  const publishedFiles = plainObject(publicationReceipt.files, "Publication receipt files");
  const corpusPath = verifyPublicationFile(publicationDir, files.corpus, publishedFiles[files.corpus]);
  const sourcePath = verifyPublicationFile(publicationDir, files.source, publishedFiles[files.source]);
  const arcPath = verifyPublicationFile(publicationDir, files.arc, publishedFiles[files.arc]);
  const corpus = plainObject(readJson(corpusPath, 8 * 1024 * 1024), "Corpus record");
  const source = plainObject(readJson(sourcePath), "Common Ship source");
  const arc = plainObject(readJson(arcPath), "Arc");

  assertEqual(corpus.classification, "metadata-only-private-branch-probe", "Corpus source classification");
  assertEqual(corpus.exactParent?.sha256, publication.exactParentSha256, "Corpus parent SHA-256");
  assertEqual(corpus.publication?.assetPolicy, "no-panel-payloads-in-probe", "Corpus authored asset policy");
  assertEqual(source.format, publication.sourcePlane, "Common Ship source plane");
  assertEqual(source.identity?.id, publication.cartridgeId, "Source cartridge id");
  assertEqual(source.identity?.version, publication.version, "Source version");
  assertEqual(arc.meta?.id, publication.cartridgeId, "Arc cartridge id");
  assertEqual(arc.meta?.version, publication.version, "Arc version");
  assertEqual(arc.meta?.engineVersion, publication.engineVersion, "Arc engine version");
  const digest = cartridgeDigest(arc);
  assertEqual(digest, publication.cartridgeDigest, "Cartridge digest");
  const extension = plainObject(arc.extensions, "Arc extensions")[publication.sourceExtension];
  assertCanonicalEqual(extension, source, "Arc Common Ship source extension");
  assertCanonicalEqual(source.notes?.canonicalBoundary, activationContract.publicationBoundary, "Publication canon boundary");
  assertEqual(source.notes?.exactParentSha256, publication.exactParentSha256, "Source parent SHA-256");

  return {
    publication,
    publicationReceipt,
    corpus,
    source,
    arc,
    digest,
    paths: { receiptPath, corpusPath, sourcePath, arcPath },
  };
}

function validateActivationContract(document, intake, approval, publicationState) {
  const contract = plainObject(document, "Activation contract");
  assertEqual(
    contract.format,
    "burn-protocol-handoff-publication-activation-contract/1",
    "Activation contract format",
  );
  const tier = requiredString(contract.evidenceTier, "Activation evidence tier");
  if (!["production-exact-intake", "mechanism-fixture"].includes(tier)) {
    fail(`Unsupported activation evidence tier ${tier}.`);
  }
  const binding = requiredString(contract.parentBinding, "Activation parent binding");
  if (tier === "production-exact-intake" && binding !== "exact-publication-parent") {
    fail("Production activation requires exact-publication-parent binding.");
  }
  if (tier === "mechanism-fixture" && binding !== "fixture-structural-only") {
    fail("Fixture activation requires fixture-structural-only binding.");
  }

  const expectedIntake = plainObject(contract.intake, "Activation intake");
  assertEqual(expectedIntake.contractFormat, intake.intakeContract.format, "Activation intake contract format");
  assertCanonicalEqual(
    expectedIntake.handoff,
    projection(approval.handoff, ["sha256", "bytes", "entries"], "Approval handoff"),
    "Activation handoff identity",
  );
  assertCanonicalEqual(
    expectedIntake.parent,
    projection(
      approval.parent,
      ["sha256", "bytes", "entries", "manifestRecords", "manifestUncompressedBytes"],
      "Approval parent",
    ),
    "Activation parent identity",
  );
  assertEqual(expectedIntake.outerManifestRecords, intake.receipt.outerManifest?.records, "Activation outer records");
  assertCanonicalEqual(contract.intakeAuthority, approval.authority, "Activation intake authority");

  const custodyAuthority = plainObject(contract.authority, "Activation custody authority");
  requiredString(custodyAuthority.custodyRelation, "Activation custody relation");
  assertEqual(custodyAuthority.runtimeBundling, "none", "Activation runtime bundling");
  if (tier === "production-exact-intake") {
    assertEqual(approval.parent.sha256, publicationState.publication.exactParentSha256, "Production parent binding");
  }
  return { contract, tier, binding, custodyAuthority };
}

const paths = {
  activationContract: resolve(requiredOption("--activation-contract")),
  approval: resolve(requiredOption("--approval")),
  intakeReceipt: resolve(requiredOption("--intake-receipt")),
  assetIndex: resolve(requiredOption("--asset-index")),
  intakeContract: resolve(requiredOption("--intake-contract")),
  publicationDir: resolve(requiredOption("--publication-dir")),
  outputDir: resolve(option("--output", resolve(process.cwd(), "burn-protocol-handoff-publication-activation"))),
};

const activationContractDocument = readJson(paths.activationContract, 8 * 1024 * 1024);
const intakeReceiptDocument = readJson(paths.intakeReceipt, 8 * 1024 * 1024);
const assetIndexDocument = readJson(paths.assetIndex);
const intakeContractDocument = readJson(paths.intakeContract, 8 * 1024 * 1024);
const approvalDocument = readJson(paths.approval, 8 * 1024 * 1024);
const assetSummary = validateAssetIndex(assetIndexDocument);
const intake = validateIntake(intakeReceiptDocument, intakeContractDocument, assetSummary, paths.intakeContract);
const approval = validateApproval(
  approvalDocument,
  paths,
  intake.receipt,
  assetSummary,
  intake.intakeContract,
);
const publicationState = validatePublication(paths.publicationDir, activationContractDocument);
const activation = validateActivationContract(
  activationContractDocument,
  intake,
  approval,
  publicationState,
);

const outputNames = plainObject(activation.contract.output, "Activation output");
const overlayName = safeBasename(outputNames.overlay, "Activation overlay name");
const receiptName = safeBasename(outputNames.receipt, "Activation receipt name");
mkdirSync(paths.outputDir, { recursive: true });

const overlay = {
  format: "burn-protocol-handoff-publication-overlay/1",
  status: "pass",
  evidenceTier: activation.tier,
  classification: activation.tier === "production-exact-intake"
    ? "exact-handoff-verified-external-custody"
    : "mechanism-fixture-external-custody",
  cartridge: {
    id: publicationState.publication.cartridgeId,
    version: publicationState.publication.version,
    engineVersion: publicationState.publication.engineVersion,
    authoredArcDigest: publicationState.digest,
    sourcePlane: publicationState.publication.sourcePlane,
    publicationAuthorityHead: publicationState.publication.arcHead,
    exactParentSha256: publicationState.publication.exactParentSha256,
  },
  authoredBoundary: activation.contract.publicationBoundary,
  externalCustody: {
    relationship: activation.custodyAuthority.custodyRelation,
    runtimeBundling: activation.custodyAuthority.runtimeBundling,
    handoff: approval.handoff,
    parent: approval.parent,
    assetIndex: {
      sha256: approval.assetIndex.sha256,
      bytes: approval.assetIndex.bytes,
      assets: assetSummary.assets,
      counts: assetSummary.counts,
    },
  },
  sourceEvidence: {
    intakeContractSha256: approval.intakeContract.sha256,
    intakeReceiptSha256: approval.intakeReceipt.sha256,
    approvalSha256: sha256File(paths.approval),
    publicationReceiptSha256: sha256File(publicationState.paths.receiptPath),
  },
  controlQuestion: publicationState.corpus.controlQuestion,
};
const overlayPath = join(paths.outputDir, overlayName);
writeFileSync(overlayPath, canonicalText(overlay));

const receipt = {
  format: "burn-protocol-handoff-publication-activation-receipt/1",
  status: "pass",
  evidenceTier: activation.tier,
  activationContract: {
    path: basename(paths.activationContract),
    sha256: sha256File(paths.activationContract),
    bytes: statSync(paths.activationContract).size,
  },
  approval: {
    path: basename(paths.approval),
    sha256: sha256File(paths.approval),
    bytes: statSync(paths.approval).size,
  },
  overlay: {
    path: overlayName,
    sha256: sha256File(overlayPath),
    bytes: statSync(overlayPath).size,
  },
  cartridge: overlay.cartridge,
  externalAssets: overlay.externalCustody.assetIndex,
  authority: {
    authoredBoundary: overlay.authoredBoundary,
    custodyRelation: overlay.externalCustody.relationship,
    runtimeBundling: overlay.externalCustody.runtimeBundling,
  },
};
const receiptPath = join(paths.outputDir, receiptName);
writeFileSync(receiptPath, canonicalText(receipt));
console.log(canonicalText(receipt).trimEnd());
