import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  collectorContentId,
  sha256,
} from "./asoiaf-external-estate.js";
import type {
  AsoiafAnswerExchangeActorRole,
} from "./asoiaf-answer-desk-exchange.js";
import type {
  AsoiafAnswerTransportAdmissionLink,
  AsoiafAnswerTransportCertificateUsage,
  AsoiafAnswerTransportIssuanceReceipt,
  AsoiafAnswerTransportKeyCustodyClass,
  AsoiafAnswerTransportProofAlgorithm,
} from "./asoiaf-answer-desk-transport-enrollment.js";

export const ASOIAF_ANSWER_CREDENTIAL_DEVICE_FORMAT =
  "axm-asoiaf-answer-credential-device/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_KEY_REFERENCE_FORMAT =
  "axm-asoiaf-answer-credential-key-reference/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_DEPLOYMENT_PLAN_FORMAT =
  "axm-asoiaf-answer-credential-deployment-plan/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_INSTALLATION_STATEMENT_FORMAT =
  "axm-asoiaf-answer-credential-installation-statement/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_INSTALLATION_FORMAT =
  "axm-asoiaf-answer-credential-installation/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_ACTIVATION_STATEMENT_FORMAT =
  "axm-asoiaf-answer-credential-activation-statement/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_ACTIVATION_FORMAT =
  "axm-asoiaf-answer-credential-activation/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_ROLLBACK_STATEMENT_FORMAT =
  "axm-asoiaf-answer-credential-rollback-statement/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_ROLLBACK_FORMAT =
  "axm-asoiaf-answer-credential-rollback/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_DEPLOYMENT_STATE_FORMAT =
  "axm-asoiaf-answer-credential-deployment-state/1" as const;

export type AsoiafAnswerCredentialPlatform =
  | "windows"
  | "linux"
  | "macos"
  | "appliance"
  | "synthetic";

export type AsoiafAnswerCredentialProviderClass =
  | "windows-cng"
  | "tpm2-pkcs11"
  | "pkcs11"
  | "secure-enclave"
  | "external-reference"
  | "synthetic-fixture";

export type AsoiafAnswerCredentialDeploymentMode =
  | "initial"
  | "successor";

interface NoTaskAuthority {
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

const NO_TASK_AUTHORITY: NoTaskAuthority = {
  authority: "none",
  graphEffect: "none",
  canonEffect: "none",
  answerEffect: "none",
};

export interface AsoiafAnswerCredentialDeploymentPaths {
  root: string;
  deploymentRoot: string;
  devices: string;
  keys: string;
  plans: string;
  installations: string;
  activations: string;
  rollbacks: string;
  state: string;
}

export interface AsoiafAnswerCredentialDevice extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_DEVICE_FORMAT;
  deviceId: string;
  deviceFingerprint: `sha256:${string}`;
  deviceAgentId: string;
  deviceAgentPublicKeyFingerprint: `sha256:${string}`;
  deviceAgentPublicKeySpkiBase64: string;
  deviceAgentPublicKeyType: string;
  platform: AsoiafAnswerCredentialPlatform;
  trustDomain: string;
  allowedProviderClasses: AsoiafAnswerCredentialProviderClass[];
  registeredAt: string;
  operatorId: string;
  privateKeyRetained: false;
  privateKeyPathRetained: false;
  rawAgentKeyReferenceRetained: false;
  registrationAuthority: "device-custody-only";
}

export interface AsoiafAnswerCredentialKeyReference extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_KEY_REFERENCE_FORMAT;
  keyReferenceId: string;
  keyReferenceFingerprint: `sha256:${string}`;
  deviceId: string;
  deviceFingerprint: `sha256:${string}`;
  providerClass: AsoiafAnswerCredentialProviderClass;
  providerKeyId: string;
  providerHandleDigest: `sha256:${string}`;
  publicKeyFingerprint: `sha256:${string}`;
  publicKeySpkiBase64: string;
  publicKeyType: string;
  custodyClass: AsoiafAnswerTransportKeyCustodyClass;
  privateKeyExportable: false;
  registeredAt: string;
  operatorId: string;
  privateKeyRetained: false;
  privateKeyPathRetained: false;
  rawProviderHandleRetained: false;
  providerSecretRetained: false;
  registrationAuthority: "opaque-key-reference-only";
}

export interface AsoiafAnswerCredentialDeploymentPlan extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_DEPLOYMENT_PLAN_FORMAT;
  planId: string;
  planFingerprint: `sha256:${string}`;
  mode: AsoiafAnswerCredentialDeploymentMode;
  serviceId: string;
  deviceId: string;
  deviceFingerprint: `sha256:${string}`;
  keyReferenceId: string;
  keyReferenceFingerprint: `sha256:${string}`;
  providerClass: AsoiafAnswerCredentialProviderClass;
  providerHandleDigest: `sha256:${string}`;
  publicKeyFingerprint: `sha256:${string}`;
  issuanceId: string;
  issuanceFingerprint: `sha256:${string}`;
  policyId: string;
  policyFingerprint: `sha256:${string}`;
  requestId: string;
  requestFingerprint: `sha256:${string}`;
  orderId: string;
  orderFingerprint: `sha256:${string}`;
  certificateFingerprint: `sha256:${string}`;
  issuerCertificateFingerprint: `sha256:${string}`;
  certificateUsage: AsoiafAnswerTransportCertificateUsage;
  principalId: string;
  actorRole: AsoiafAnswerExchangeActorRole | null;
  certificateValidFrom: string;
  certificateValidUntil: string;
  admissionLinkId: string | null;
  admissionLinkFingerprint: `sha256:${string}` | null;
  runtimeAdmissionId: string | null;
  runtimeAdmissionFingerprint: `sha256:${string}` | null;
  predecessorPlanId: string | null;
  predecessorPlanFingerprint: `sha256:${string}` | null;
  predecessorActivationId: string | null;
  predecessorActivationFingerprint: `sha256:${string}` | null;
  plannedInstallAt: string;
  plannedActivateAt: string;
  rollbackUntil: string;
  retirePredecessorAfter: string;
  createdAt: string;
  operatorId: string;
  issuance: AsoiafAnswerTransportIssuanceReceipt;
  admissionLink: AsoiafAnswerTransportAdmissionLink | null;
  certificateRetained: false;
  privateKeyRetained: false;
  rawProviderHandleRetained: false;
  deploymentAuthority: "plan-only";
}

export interface AsoiafAnswerCredentialInstallationStatement {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_INSTALLATION_STATEMENT_FORMAT;
  planId: string;
  planFingerprint: `sha256:${string}`;
  deviceId: string;
  deviceFingerprint: `sha256:${string}`;
  deviceAgentId: string;
  keyReferenceId: string;
  keyReferenceFingerprint: `sha256:${string}`;
  providerClass: AsoiafAnswerCredentialProviderClass;
  providerHandleDigest: `sha256:${string}`;
  serviceId: string;
  certificateFingerprint: `sha256:${string}`;
  issuerCertificateFingerprint: `sha256:${string}`;
  publicKeyFingerprint: `sha256:${string}`;
  providerReceiptDigest: `sha256:${string}`;
  installedAt: string;
  certificateRetained: false;
  privateKeyRetained: false;
  rawProviderHandleRetained: false;
  providerSecretRetained: false;
}

export interface AsoiafAnswerCredentialInstallation extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_INSTALLATION_FORMAT;
  installationId: string;
  installationFingerprint: `sha256:${string}`;
  statement: AsoiafAnswerCredentialInstallationStatement;
  deviceAgentSignatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  deviceAgentSignatureBase64: string;
  deviceAgentSignatureDigest: `sha256:${string}`;
  deviceAgentSignatureVerified: true;
  certificateSerialNumber: string;
  certificateSubject: string;
  certificateSubjectAltNames: string[];
  certificateValidFrom: string;
  certificateValidUntil: string;
  certificateExtendedKeyUsageOids: string[];
  operatorId: string;
  certificateRetained: false;
  certificatePathRetained: false;
  privateKeyRetained: false;
  privateKeyPathRetained: false;
  rawProviderHandleRetained: false;
  installationAuthority: "verified-installation-only";
}

export interface AsoiafAnswerCredentialActivationStatement {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_ACTIVATION_STATEMENT_FORMAT;
  planId: string;
  planFingerprint: `sha256:${string}`;
  installationId: string;
  installationFingerprint: `sha256:${string}`;
  deviceId: string;
  deviceFingerprint: `sha256:${string}`;
  deviceAgentId: string;
  keyReferenceId: string;
  keyReferenceFingerprint: `sha256:${string}`;
  providerClass: AsoiafAnswerCredentialProviderClass;
  providerHandleDigest: `sha256:${string}`;
  serviceId: string;
  certificateFingerprint: `sha256:${string}`;
  publicKeyFingerprint: `sha256:${string}`;
  predecessorPlanId: string | null;
  predecessorActivationId: string | null;
  challengeDigest: `sha256:${string}`;
  activatedAt: string;
  rollbackUntil: string;
  certificateRetained: false;
  privateKeyRetained: false;
  rawProviderHandleRetained: false;
  providerSecretRetained: false;
}

export interface AsoiafAnswerCredentialActivation extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_ACTIVATION_FORMAT;
  activationId: string;
  activationFingerprint: `sha256:${string}`;
  statement: AsoiafAnswerCredentialActivationStatement;
  credentialSignatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  credentialSignatureBase64: string;
  credentialSignatureDigest: `sha256:${string}`;
  credentialSignatureVerified: true;
  deviceAgentSignatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  deviceAgentSignatureBase64: string;
  deviceAgentSignatureDigest: `sha256:${string}`;
  deviceAgentSignatureVerified: true;
  operatorId: string;
  activationAuthority: "verified-device-and-key-use-only";
}

export interface AsoiafAnswerCredentialRollbackStatement {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_ROLLBACK_STATEMENT_FORMAT;
  planId: string;
  planFingerprint: `sha256:${string}`;
  activationId: string;
  activationFingerprint: `sha256:${string}`;
  predecessorPlanId: string;
  predecessorActivationId: string;
  deviceId: string;
  deviceFingerprint: `sha256:${string}`;
  deviceAgentId: string;
  serviceId: string;
  failedCertificateFingerprint: `sha256:${string}`;
  restoredCertificateFingerprint: `sha256:${string}`;
  providerReceiptDigest: `sha256:${string}`;
  rolledBackAt: string;
  reasonDigest: `sha256:${string}`;
  certificateRetained: false;
  privateKeyRetained: false;
  rawProviderHandleRetained: false;
  providerSecretRetained: false;
}

export interface AsoiafAnswerCredentialRollback extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_ROLLBACK_FORMAT;
  rollbackId: string;
  rollbackFingerprint: `sha256:${string}`;
  statement: AsoiafAnswerCredentialRollbackStatement;
  reason: string;
  deviceAgentSignatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  deviceAgentSignatureBase64: string;
  deviceAgentSignatureDigest: `sha256:${string}`;
  deviceAgentSignatureVerified: true;
  operatorId: string;
  rollbackAuthority: "restore-predecessor-reference-only";
}

export interface AsoiafAnswerCredentialDeploymentStateEntry {
  serviceId: string;
  deviceId: string;
  planId: string;
  planFingerprint: `sha256:${string}`;
  activationId: string;
  activationFingerprint: `sha256:${string}`;
  certificateFingerprint: `sha256:${string}`;
  keyReferenceId: string;
  keyReferenceFingerprint: `sha256:${string}`;
  stateOrigin: "activation" | "rollback";
  updatedAt: string;
}

export interface AsoiafAnswerCredentialDeploymentState extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_DEPLOYMENT_STATE_FORMAT;
  stateId: string;
  stateFingerprint: `sha256:${string}`;
  asOf: string;
  entries: AsoiafAnswerCredentialDeploymentStateEntry[];
  stateAuthority: "projection-only";
}

export interface AsoiafAnswerCredentialDeploymentStatus {
  format: "axm-asoiaf-answer-credential-deployment-status/1";
  paths: AsoiafAnswerCredentialDeploymentPaths;
  devices: AsoiafAnswerCredentialDevice[];
  keys: AsoiafAnswerCredentialKeyReference[];
  plans: AsoiafAnswerCredentialDeploymentPlan[];
  installations: AsoiafAnswerCredentialInstallation[];
  activations: AsoiafAnswerCredentialActivation[];
  rollbacks: AsoiafAnswerCredentialRollback[];
  state: AsoiafAnswerCredentialDeploymentState | null;
}

export interface AsoiafAnswerCredentialDeploymentFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

export interface AsoiafAnswerCredentialDeviceInput {
  root: string;
  deviceAgentId: string;
  deviceAgentPublicKey: string | Buffer | crypto.KeyObject;
  platform: AsoiafAnswerCredentialPlatform;
  trustDomain: string;
  allowedProviderClasses: AsoiafAnswerCredentialProviderClass[];
  registeredAt: string;
  operatorId: string;
}

export interface AsoiafAnswerCredentialKeyReferenceInput {
  root: string;
  deviceId: string;
  providerClass: AsoiafAnswerCredentialProviderClass;
  providerKeyId: string;
  providerHandleDigest: string;
  publicKey: string | Buffer | crypto.KeyObject;
  custodyClass: AsoiafAnswerTransportKeyCustodyClass;
  privateKeyExportable: boolean;
  registeredAt: string;
  operatorId: string;
}

export interface AsoiafAnswerCredentialDeploymentPlanInput {
  root: string;
  mode: AsoiafAnswerCredentialDeploymentMode;
  serviceId: string;
  deviceId: string;
  keyReferenceId: string;
  issuance: AsoiafAnswerTransportIssuanceReceipt;
  admissionLink?: AsoiafAnswerTransportAdmissionLink | null;
  predecessorPlanId?: string | null;
  predecessorActivationId?: string | null;
  plannedInstallAt: string;
  plannedActivateAt: string;
  rollbackUntil: string;
  retirePredecessorAfter: string;
  createdAt: string;
  operatorId: string;
}

const CLIENT_AUTH_OID = "1.3.6.1.5.5.7.3.2";
const SERVER_AUTH_OID = "1.3.6.1.5.5.7.3.1";
const MIN_OVERLAP_MS = 60_000;

function finding(
  code: string,
  severity: AsoiafAnswerCredentialDeploymentFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafAnswerCredentialDeploymentFinding {
  return { code, severity, subjectId, detail };
}

function sortedFindings(
  values: readonly AsoiafAnswerCredentialDeploymentFinding[],
): AsoiafAnswerCredentialDeploymentFinding[] {
  const rank = { error: 0, warning: 1, notice: 2 } as const;
  return [...values].sort(
    (left, right) =>
      rank[left.severity] - rank[right.severity]
      || left.code.localeCompare(right.code)
      || left.subjectId.localeCompare(right.subjectId)
      || left.detail.localeCompare(right.detail),
  );
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function stableBytes(value: unknown): Buffer {
  return Buffer.from(stableJson(value), "utf8");
}

function validTime(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0
    && Number.isFinite(Date.parse(value));
}

function requireTime(value: string, label: string): string {
  if (!validTime(value)) throw new Error(`${label} is invalid`);
  return new Date(value).toISOString();
}

function requireIdentity(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 256) {
    throw new Error(`${label} must contain 3 through 256 characters`);
  }
  return normalized;
}

function requireReason(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length < 24 || normalized.length > 4096) {
    throw new Error(`${label} must contain 24 through 4096 characters`);
  }
  return normalized;
}

function requireSha256(value: string, label: string): `sha256:${string}` {
  const normalized = value.trim().toLowerCase();
  if (!/^sha256:[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
  return normalized as `sha256:${string}`;
}

function bytesDigest(value: Buffer): `sha256:${string}` {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function sortedUnique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values.map((entry) => entry.trim()).filter(Boolean) as T[])]
    .sort((left, right) => left.localeCompare(right));
}

function requirePlatform(value: string): AsoiafAnswerCredentialPlatform {
  if (!["windows", "linux", "macos", "appliance", "synthetic"].includes(value)) {
    throw new Error(`credential deployment platform ${value} is invalid`);
  }
  return value as AsoiafAnswerCredentialPlatform;
}

function requireProviderClass(value: string): AsoiafAnswerCredentialProviderClass {
  if (![
    "windows-cng",
    "tpm2-pkcs11",
    "pkcs11",
    "secure-enclave",
    "external-reference",
    "synthetic-fixture",
  ].includes(value)) {
    throw new Error(`credential provider class ${value} is invalid`);
  }
  return value as AsoiafAnswerCredentialProviderClass;
}

function requireCustodyClass(value: string): AsoiafAnswerTransportKeyCustodyClass {
  if (![
    "hardware-backed",
    "operating-system-keychain",
    "encrypted-file",
    "external-agent",
  ].includes(value)) {
    throw new Error(`key custody class ${value} is invalid`);
  }
  return value as AsoiafAnswerTransportKeyCustodyClass;
}

function requireMode(value: string): AsoiafAnswerCredentialDeploymentMode {
  if (value !== "initial" && value !== "successor") {
    throw new Error(`credential deployment mode ${value} is invalid`);
  }
  return value;
}

function publicKeyObject(
  value: string | Buffer | crypto.KeyObject,
): crypto.KeyObject {
  const key = value instanceof crypto.KeyObject
    ? value
    : Buffer.isBuffer(value)
      ? value.subarray(0, 11).toString("ascii") === "-----BEGIN "
        ? crypto.createPublicKey(value)
        : crypto.createPublicKey({ key: value, format: "der", type: "spki" })
      : crypto.createPublicKey(value);
  return key.type === "public" ? key : crypto.createPublicKey(key);
}

function publicKeySpki(key: crypto.KeyObject): Buffer {
  return key.export({ format: "der", type: "spki" }) as Buffer;
}

function publicKeyFingerprint(key: crypto.KeyObject): `sha256:${string}` {
  return bytesDigest(publicKeySpki(key));
}

function keyType(key: crypto.KeyObject): string {
  return key.asymmetricKeyType ?? "unknown";
}

function expectedSignatureAlgorithm(
  key: crypto.KeyObject,
): AsoiafAnswerTransportProofAlgorithm {
  if (key.asymmetricKeyType === "ed25519") return "ed25519";
  if (key.asymmetricKeyType === "ec") return "ecdsa-sha256";
  if (key.asymmetricKeyType === "rsa" || key.asymmetricKeyType === "rsa-pss") {
    return "rsa-sha256";
  }
  throw new Error(`unsupported signature key type ${key.asymmetricKeyType ?? "unknown"}`);
}

function assertKeyStrength(key: crypto.KeyObject): void {
  const type = key.asymmetricKeyType;
  if (type === "rsa" || type === "rsa-pss") {
    if ((key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
      throw new Error("RSA credential key must be at least 2048 bits");
    }
    return;
  }
  if (type === "ec") {
    const curve = key.asymmetricKeyDetails?.namedCurve;
    if (!curve || !["prime256v1", "secp384r1", "secp521r1"].includes(curve)) {
      throw new Error("EC credential key uses an unsupported curve");
    }
    return;
  }
  if (type !== "ed25519") {
    throw new Error(`credential key type ${type ?? "unknown"} is unsupported`);
  }
}

function signatureBuffer(value: string | Buffer): Buffer {
  if (Buffer.isBuffer(value)) return value;
  const normalized = value.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error("signature must be canonical base64");
  }
  return Buffer.from(normalized, "base64");
}

function verifySignature(input: {
  publicKey: crypto.KeyObject;
  algorithm: AsoiafAnswerTransportProofAlgorithm;
  message: Buffer;
  signature: Buffer;
}): boolean {
  if (expectedSignatureAlgorithm(input.publicKey) !== input.algorithm) return false;
  return crypto.verify(
    input.algorithm === "ed25519" ? null : "sha256",
    input.message,
    input.publicKey,
    input.signature,
  );
}

function parseCertificate(value: string | Buffer): crypto.X509Certificate {
  try {
    return new crypto.X509Certificate(value);
  } catch (error) {
    throw new Error(
      `certificate is not a valid X.509 certificate: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function parseSubjectAltNames(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value.split(/,\s*/).map((entry) => entry.trim()).filter(Boolean).sort();
}

function ensureParent(target: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
}

function readJson<T>(target: string): T {
  return JSON.parse(fs.readFileSync(target, "utf8")) as T;
}

function listJson<T>(directory: string): T[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((entry) => /^[a-f0-9]{64}\.json$/.test(entry))
    .sort()
    .map((entry) => readJson<T>(path.join(directory, entry)));
}

function digestPath(directory: string, digest: `sha256:${string}`): string {
  return path.join(directory, `${digest.slice("sha256:".length)}.json`);
}

function relativeUri(root: string, target: string): string {
  return path.relative(path.resolve(root), path.resolve(target)).split(path.sep).join("/");
}

function writeExact<T>(target: string, value: T): { value: T; replayed: boolean } {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  ensureParent(target);
  try {
    fs.writeFileSync(target, serialized, { encoding: "utf8", flag: "wx" });
    return { value, replayed: false };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = fs.readFileSync(target, "utf8");
    if (existing !== serialized) {
      throw new Error(`credential deployment immutable file collision at ${target}`);
    }
    return { value: JSON.parse(existing) as T, replayed: true };
  }
}

function writeJsonAtomic(target: string, value: unknown): void {
  ensureParent(target);
  const temporary = `${target}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, target);
}

export function asoiafAnswerCredentialDeploymentPaths(
  root: string,
): AsoiafAnswerCredentialDeploymentPaths {
  const absolute = path.resolve(root);
  const deploymentRoot = path.join(absolute, "answer-credential-deployment");
  return {
    root: absolute,
    deploymentRoot,
    devices: path.join(deploymentRoot, "devices"),
    keys: path.join(deploymentRoot, "keys"),
    plans: path.join(deploymentRoot, "plans"),
    installations: path.join(deploymentRoot, "installations"),
    activations: path.join(deploymentRoot, "activations"),
    rollbacks: path.join(deploymentRoot, "rollbacks"),
    state: path.join(deploymentRoot, "STATE.json"),
  };
}

function deviceCore(
  device: AsoiafAnswerCredentialDevice,
): Omit<AsoiafAnswerCredentialDevice, "deviceId" | "deviceFingerprint"> {
  const { deviceId: _id, deviceFingerprint: _fingerprint, ...core } = device;
  return core;
}

function keyReferenceCore(
  keyReference: AsoiafAnswerCredentialKeyReference,
): Omit<AsoiafAnswerCredentialKeyReference, "keyReferenceId" | "keyReferenceFingerprint"> {
  const {
    keyReferenceId: _id,
    keyReferenceFingerprint: _fingerprint,
    ...core
  } = keyReference;
  return core;
}

function planCore(
  plan: AsoiafAnswerCredentialDeploymentPlan,
): Omit<AsoiafAnswerCredentialDeploymentPlan, "planId" | "planFingerprint"> {
  const { planId: _id, planFingerprint: _fingerprint, ...core } = plan;
  return core;
}

function installationCore(
  installation: AsoiafAnswerCredentialInstallation,
): Omit<AsoiafAnswerCredentialInstallation, "installationId" | "installationFingerprint"> {
  const {
    installationId: _id,
    installationFingerprint: _fingerprint,
    ...core
  } = installation;
  return core;
}

function activationCore(
  activation: AsoiafAnswerCredentialActivation,
): Omit<AsoiafAnswerCredentialActivation, "activationId" | "activationFingerprint"> {
  const { activationId: _id, activationFingerprint: _fingerprint, ...core } = activation;
  return core;
}

function rollbackCore(
  rollback: AsoiafAnswerCredentialRollback,
): Omit<AsoiafAnswerCredentialRollback, "rollbackId" | "rollbackFingerprint"> {
  const { rollbackId: _id, rollbackFingerprint: _fingerprint, ...core } = rollback;
  return core;
}

function stateCore(
  state: AsoiafAnswerCredentialDeploymentState,
): Omit<AsoiafAnswerCredentialDeploymentState, "stateId" | "stateFingerprint"> {
  const { stateId: _id, stateFingerprint: _fingerprint, ...core } = state;
  return core;
}

function issuanceCore(
  issuance: AsoiafAnswerTransportIssuanceReceipt,
): Omit<AsoiafAnswerTransportIssuanceReceipt, "issuanceId" | "issuanceFingerprint"> {
  const { issuanceId: _id, issuanceFingerprint: _fingerprint, ...core } = issuance;
  return core;
}

function admissionLinkCore(
  link: AsoiafAnswerTransportAdmissionLink,
): Omit<AsoiafAnswerTransportAdmissionLink, "linkId" | "linkFingerprint"> {
  const { linkId: _id, linkFingerprint: _fingerprint, ...core } = link;
  return core;
}

function validateAuthority(value: NoTaskAuthority, label: string): void {
  if (
    value.authority !== "none"
    || value.graphEffect !== "none"
    || value.canonEffect !== "none"
    || value.answerEffect !== "none"
  ) {
    throw new Error(`${label} crossed its no-task-authority boundary`);
  }
}

function validateIssuance(issuance: AsoiafAnswerTransportIssuanceReceipt): void {
  validateAuthority(issuance, "issuance receipt");
  if (issuance.format !== "axm-asoiaf-answer-transport-issuance-receipt/1") {
    throw new Error("credential deployment issuance receipt format is invalid");
  }
  const expectedFingerprint = sha256(issuanceCore(issuance));
  if (issuance.issuanceFingerprint !== expectedFingerprint) {
    throw new Error("credential deployment issuance fingerprint is stale");
  }
  const expectedId = collectorContentId("asoiaf-answer-transport-issuance", {
    orderId: issuance.orderId,
    certificateFingerprint: issuance.certificate.certificateFingerprint,
    issuanceFingerprint: expectedFingerprint,
  });
  if (issuance.issuanceId !== expectedId) {
    throw new Error("credential deployment issuance identity is not content addressed");
  }
  if (
    issuance.certificateRetained !== false
    || issuance.privateKeyRetained !== false
    || issuance.certificatePathRetained !== false
    || issuance.privateKeyPathRetained !== false
  ) {
    throw new Error("credential deployment issuance retained forbidden certificate or key material");
  }
}

function validateAdmissionLink(
  link: AsoiafAnswerTransportAdmissionLink,
  issuance: AsoiafAnswerTransportIssuanceReceipt,
): void {
  validateAuthority(link, "runtime admission link");
  if (link.format !== "axm-asoiaf-answer-transport-admission-link/1") {
    throw new Error("credential deployment runtime admission link format is invalid");
  }
  const expectedFingerprint = sha256(admissionLinkCore(link));
  if (link.linkFingerprint !== expectedFingerprint) {
    throw new Error("credential deployment runtime admission link fingerprint is stale");
  }
  const expectedId = collectorContentId("asoiaf-answer-transport-admission-link", {
    issuanceId: link.issuanceId,
    admissionId: link.admission.admissionId,
    linkFingerprint: expectedFingerprint,
  });
  if (link.linkId !== expectedId) {
    throw new Error("credential deployment runtime admission link identity is not content addressed");
  }
  if (
    link.issuanceId !== issuance.issuanceId
    || link.issuanceFingerprint !== issuance.issuanceFingerprint
    || link.admission.certificateFingerprint !== issuance.certificate.certificateFingerprint
    || link.admission.publicKeyFingerprint !== issuance.certificate.publicKeyFingerprint
    || link.admission.issuerCertificateFingerprint
      !== issuance.certificate.issuerCertificateFingerprint
    || link.admission.usage !== issuance.admissionInstruction.usage
    || link.admission.principalId !== issuance.admissionInstruction.principalId
    || link.admission.actorRole !== issuance.admissionInstruction.actorRole
  ) {
    throw new Error("credential deployment runtime admission link differs from issuance custody");
  }
}

function byId<T>(values: readonly T[], id: string, idOf: (entry: T) => string, label: string): T {
  const matches = values.filter((entry) => idOf(entry) === id);
  if (matches.length !== 1) throw new Error(`${label} ${id} is absent or duplicated`);
  return matches[0]!;
}

function deviceById(root: string, deviceId: string): AsoiafAnswerCredentialDevice {
  return byId(
    readAsoiafAnswerCredentialDeploymentStatus(root).devices,
    deviceId,
    (entry) => entry.deviceId,
    "credential device",
  );
}

function keyById(root: string, keyReferenceId: string): AsoiafAnswerCredentialKeyReference {
  return byId(
    readAsoiafAnswerCredentialDeploymentStatus(root).keys,
    keyReferenceId,
    (entry) => entry.keyReferenceId,
    "credential key reference",
  );
}

function planById(root: string, planId: string): AsoiafAnswerCredentialDeploymentPlan {
  return byId(
    readAsoiafAnswerCredentialDeploymentStatus(root).plans,
    planId,
    (entry) => entry.planId,
    "credential deployment plan",
  );
}

function installationById(root: string, installationId: string): AsoiafAnswerCredentialInstallation {
  return byId(
    readAsoiafAnswerCredentialDeploymentStatus(root).installations,
    installationId,
    (entry) => entry.installationId,
    "credential installation",
  );
}

function activationById(root: string, activationId: string): AsoiafAnswerCredentialActivation {
  return byId(
    readAsoiafAnswerCredentialDeploymentStatus(root).activations,
    activationId,
    (entry) => entry.activationId,
    "credential activation",
  );
}

export function retainAsoiafAnswerCredentialDevice(
  input: AsoiafAnswerCredentialDeviceInput,
): { device: AsoiafAnswerCredentialDevice; deviceUri: string; replayed: boolean } {
  const key = publicKeyObject(input.deviceAgentPublicKey);
  assertKeyStrength(key);
  const allowedProviderClasses = sortedUnique(
    input.allowedProviderClasses.map(requireProviderClass),
  );
  if (allowedProviderClasses.length === 0) {
    throw new Error("credential device requires at least one allowed provider class");
  }
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_DEVICE_FORMAT,
    deviceAgentId: requireIdentity(input.deviceAgentId, "device agent identity"),
    deviceAgentPublicKeyFingerprint: publicKeyFingerprint(key),
    deviceAgentPublicKeySpkiBase64: publicKeySpki(key).toString("base64"),
    deviceAgentPublicKeyType: keyType(key),
    platform: requirePlatform(input.platform),
    trustDomain: requireIdentity(input.trustDomain, "device trust domain"),
    allowedProviderClasses,
    registeredAt: requireTime(input.registeredAt, "device registration time"),
    operatorId: requireIdentity(input.operatorId, "device registration operator identity"),
    privateKeyRetained: false as const,
    privateKeyPathRetained: false as const,
    rawAgentKeyReferenceRetained: false as const,
    registrationAuthority: "device-custody-only" as const,
    ...NO_TASK_AUTHORITY,
  };
  const deviceFingerprint = sha256(core);
  const device: AsoiafAnswerCredentialDevice = {
    ...core,
    deviceId: collectorContentId("asoiaf-answer-credential-device", {
      deviceAgentId: core.deviceAgentId,
      trustDomain: core.trustDomain,
      deviceAgentPublicKeyFingerprint: core.deviceAgentPublicKeyFingerprint,
      deviceFingerprint,
    }),
    deviceFingerprint,
  };
  const existing = readAsoiafAnswerCredentialDeploymentStatus(input.root).devices
    .filter((entry) =>
      entry.deviceAgentId === device.deviceAgentId
      || (
        entry.trustDomain === device.trustDomain
        && entry.deviceAgentPublicKeyFingerprint === device.deviceAgentPublicKeyFingerprint
      )
    );
  if (
    existing.length > 0
    && !existing.some((entry) => entry.deviceFingerprint === device.deviceFingerprint)
  ) {
    throw new Error("credential device identity already has different retained registration");
  }
  const target = digestPath(
    asoiafAnswerCredentialDeploymentPaths(input.root).devices,
    device.deviceFingerprint,
  );
  const persisted = writeExact(target, device);
  return {
    device: persisted.value,
    deviceUri: relativeUri(input.root, target),
    replayed: persisted.replayed,
  };
}

export function retainAsoiafAnswerCredentialKeyReference(
  input: AsoiafAnswerCredentialKeyReferenceInput,
): {
  keyReference: AsoiafAnswerCredentialKeyReference;
  keyReferenceUri: string;
  replayed: boolean;
} {
  const device = deviceById(input.root, input.deviceId);
  const providerClass = requireProviderClass(input.providerClass);
  if (!device.allowedProviderClasses.includes(providerClass)) {
    throw new Error(`credential device does not permit provider class ${providerClass}`);
  }
  if (input.privateKeyExportable) {
    throw new Error("credential deployment requires a non-exportable private key");
  }
  const key = publicKeyObject(input.publicKey);
  assertKeyStrength(key);
  const registeredAt = requireTime(input.registeredAt, "key-reference registration time");
  if (Date.parse(registeredAt) < Date.parse(device.registeredAt)) {
    throw new Error("key-reference registration precedes device registration");
  }
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_KEY_REFERENCE_FORMAT,
    deviceId: device.deviceId,
    deviceFingerprint: device.deviceFingerprint,
    providerClass,
    providerKeyId: requireIdentity(input.providerKeyId, "provider key identity"),
    providerHandleDigest: requireSha256(input.providerHandleDigest, "provider handle digest"),
    publicKeyFingerprint: publicKeyFingerprint(key),
    publicKeySpkiBase64: publicKeySpki(key).toString("base64"),
    publicKeyType: keyType(key),
    custodyClass: requireCustodyClass(input.custodyClass),
    privateKeyExportable: false as const,
    registeredAt,
    operatorId: requireIdentity(input.operatorId, "key-reference operator identity"),
    privateKeyRetained: false as const,
    privateKeyPathRetained: false as const,
    rawProviderHandleRetained: false as const,
    providerSecretRetained: false as const,
    registrationAuthority: "opaque-key-reference-only" as const,
    ...NO_TASK_AUTHORITY,
  };
  const keyReferenceFingerprint = sha256(core);
  const keyReference: AsoiafAnswerCredentialKeyReference = {
    ...core,
    keyReferenceId: collectorContentId("asoiaf-answer-credential-key-reference", {
      deviceId: core.deviceId,
      providerClass: core.providerClass,
      providerKeyId: core.providerKeyId,
      publicKeyFingerprint: core.publicKeyFingerprint,
      keyReferenceFingerprint,
    }),
    keyReferenceFingerprint,
  };
  const existing = readAsoiafAnswerCredentialDeploymentStatus(input.root).keys
    .filter((entry) =>
      entry.deviceId === keyReference.deviceId
      && (
        entry.providerKeyId === keyReference.providerKeyId
        || entry.providerHandleDigest === keyReference.providerHandleDigest
        || entry.publicKeyFingerprint === keyReference.publicKeyFingerprint
      )
    );
  if (
    existing.length > 0
    && !existing.some(
      (entry) => entry.keyReferenceFingerprint === keyReference.keyReferenceFingerprint,
    )
  ) {
    throw new Error("credential key identity already has different retained registration");
  }
  const target = digestPath(
    asoiafAnswerCredentialDeploymentPaths(input.root).keys,
    keyReference.keyReferenceFingerprint,
  );
  const persisted = writeExact(target, keyReference);
  return {
    keyReference: persisted.value,
    keyReferenceUri: relativeUri(input.root, target),
    replayed: persisted.replayed,
  };
}

export function planAsoiafAnswerCredentialDeployment(
  input: AsoiafAnswerCredentialDeploymentPlanInput,
): { plan: AsoiafAnswerCredentialDeploymentPlan; planUri: string; replayed: boolean } {
  const device = deviceById(input.root, input.deviceId);
  const keyReference = keyById(input.root, input.keyReferenceId);
  if (
    keyReference.deviceId !== device.deviceId
    || keyReference.deviceFingerprint !== device.deviceFingerprint
  ) {
    throw new Error("credential deployment key reference differs from device custody");
  }
  validateIssuance(input.issuance);
  const admissionLink = input.admissionLink ?? null;
  if (admissionLink) validateAdmissionLink(admissionLink, input.issuance);
  if (input.issuance.certificate.publicKeyFingerprint !== keyReference.publicKeyFingerprint) {
    throw new Error("issued certificate public key differs from device-bound key reference");
  }
  if (
    input.issuance.admissionInstruction.keyCustodyClass !== keyReference.custodyClass
    || input.issuance.admissionInstruction.keyReferenceDigest
      !== keyReference.providerHandleDigest
    || input.issuance.admissionInstruction.privateKeyExportable !== false
  ) {
    throw new Error("issued certificate key-custody instruction differs from key reference");
  }
  const mode = requireMode(input.mode);
  const createdAt = requireTime(input.createdAt, "deployment-plan creation time");
  const plannedInstallAt = requireTime(input.plannedInstallAt, "planned installation time");
  const plannedActivateAt = requireTime(input.plannedActivateAt, "planned activation time");
  const rollbackUntil = requireTime(input.rollbackUntil, "rollback deadline");
  const retirePredecessorAfter = requireTime(
    input.retirePredecessorAfter,
    "predecessor retirement time",
  );
  if (
    Date.parse(createdAt) > Date.parse(plannedInstallAt)
    || Date.parse(plannedInstallAt) > Date.parse(plannedActivateAt)
    || Date.parse(plannedActivateAt) >= Date.parse(rollbackUntil)
    || Date.parse(rollbackUntil) > Date.parse(retirePredecessorAfter)
  ) {
    throw new Error("credential deployment schedule is not monotonic");
  }
  if (
    Date.parse(plannedInstallAt) < Date.parse(input.issuance.certificate.validFrom)
    || Date.parse(retirePredecessorAfter) > Date.parse(input.issuance.certificate.validUntil)
  ) {
    throw new Error("credential deployment schedule exceeds certificate validity");
  }
  if (
    Date.parse(plannedActivateAt)
      < Date.parse(input.issuance.admissionInstruction.activateAt)
    || Date.parse(retirePredecessorAfter)
      > Date.parse(input.issuance.admissionInstruction.retireAfter)
  ) {
    throw new Error("credential deployment schedule exceeds governed operating schedule");
  }

  let predecessorPlan: AsoiafAnswerCredentialDeploymentPlan | null = null;
  let predecessorActivation: AsoiafAnswerCredentialActivation | null = null;
  if (mode === "initial") {
    if (input.predecessorPlanId || input.predecessorActivationId) {
      throw new Error("initial credential deployment cannot name a predecessor");
    }
    if (input.issuance.admissionInstruction.predecessorCertificateFingerprint) {
      throw new Error("initial credential deployment issuance unexpectedly names a predecessor");
    }
  } else {
    if (!input.predecessorPlanId || !input.predecessorActivationId) {
      throw new Error("successor credential deployment requires exact predecessor plan and activation");
    }
    predecessorPlan = planById(input.root, input.predecessorPlanId);
    predecessorActivation = activationById(input.root, input.predecessorActivationId);
    if (
      predecessorActivation.statement.planId !== predecessorPlan.planId
      || predecessorPlan.deviceId !== device.deviceId
      || predecessorPlan.serviceId !== requireIdentity(input.serviceId, "deployment service identity")
      || predecessorPlan.certificateUsage !== input.issuance.admissionInstruction.usage
      || predecessorPlan.principalId !== input.issuance.admissionInstruction.principalId
      || predecessorPlan.actorRole !== input.issuance.admissionInstruction.actorRole
    ) {
      throw new Error("successor credential deployment differs from predecessor service custody");
    }
    if (
      predecessorPlan.certificateFingerprint
        === input.issuance.certificate.certificateFingerprint
      || input.issuance.admissionInstruction.predecessorCertificateFingerprint
        !== predecessorPlan.certificateFingerprint
    ) {
      throw new Error("successor credential deployment certificate lineage is invalid");
    }
    if (
      Date.parse(plannedActivateAt) < Date.parse(predecessorActivation.statement.activatedAt)
      || Date.parse(plannedActivateAt) + MIN_OVERLAP_MS
        > Date.parse(predecessorPlan.retirePredecessorAfter)
    ) {
      throw new Error("successor activation lacks a valid predecessor overlap interval");
    }
    const rolledBack = readAsoiafAnswerCredentialDeploymentStatus(input.root).rollbacks
      .some((entry) => entry.statement.activationId === predecessorActivation!.activationId);
    if (rolledBack) {
      throw new Error("successor credential deployment predecessor activation was rolled back");
    }
  }

  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_DEPLOYMENT_PLAN_FORMAT,
    mode,
    serviceId: requireIdentity(input.serviceId, "deployment service identity"),
    deviceId: device.deviceId,
    deviceFingerprint: device.deviceFingerprint,
    keyReferenceId: keyReference.keyReferenceId,
    keyReferenceFingerprint: keyReference.keyReferenceFingerprint,
    providerClass: keyReference.providerClass,
    providerHandleDigest: keyReference.providerHandleDigest,
    publicKeyFingerprint: keyReference.publicKeyFingerprint,
    issuanceId: input.issuance.issuanceId,
    issuanceFingerprint: input.issuance.issuanceFingerprint,
    policyId: input.issuance.policyId,
    policyFingerprint: input.issuance.policyFingerprint,
    requestId: input.issuance.requestId,
    requestFingerprint: input.issuance.requestFingerprint,
    orderId: input.issuance.orderId,
    orderFingerprint: input.issuance.orderFingerprint,
    certificateFingerprint: input.issuance.certificate.certificateFingerprint,
    issuerCertificateFingerprint: input.issuance.certificate.issuerCertificateFingerprint,
    certificateUsage: input.issuance.admissionInstruction.usage,
    principalId: input.issuance.admissionInstruction.principalId,
    actorRole: input.issuance.admissionInstruction.actorRole,
    certificateValidFrom: input.issuance.certificate.validFrom,
    certificateValidUntil: input.issuance.certificate.validUntil,
    admissionLinkId: admissionLink?.linkId ?? null,
    admissionLinkFingerprint: admissionLink?.linkFingerprint ?? null,
    runtimeAdmissionId: admissionLink?.admission.admissionId ?? null,
    runtimeAdmissionFingerprint: admissionLink?.admission.admissionFingerprint ?? null,
    predecessorPlanId: predecessorPlan?.planId ?? null,
    predecessorPlanFingerprint: predecessorPlan?.planFingerprint ?? null,
    predecessorActivationId: predecessorActivation?.activationId ?? null,
    predecessorActivationFingerprint: predecessorActivation?.activationFingerprint ?? null,
    plannedInstallAt,
    plannedActivateAt,
    rollbackUntil,
    retirePredecessorAfter,
    createdAt,
    operatorId: requireIdentity(input.operatorId, "deployment-plan operator identity"),
    issuance: input.issuance,
    admissionLink,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    rawProviderHandleRetained: false as const,
    deploymentAuthority: "plan-only" as const,
    ...NO_TASK_AUTHORITY,
  };
  const planFingerprint = sha256(core);
  const plan: AsoiafAnswerCredentialDeploymentPlan = {
    ...core,
    planId: collectorContentId("asoiaf-answer-credential-deployment-plan", {
      serviceId: core.serviceId,
      deviceId: core.deviceId,
      certificateFingerprint: core.certificateFingerprint,
      planFingerprint,
    }),
    planFingerprint,
  };
  const existing = readAsoiafAnswerCredentialDeploymentStatus(input.root).plans
    .filter((entry) =>
      entry.serviceId === plan.serviceId
      && entry.certificateFingerprint === plan.certificateFingerprint
    );
  if (
    existing.length > 0
    && !existing.some((entry) => entry.planFingerprint === plan.planFingerprint)
  ) {
    throw new Error("credential certificate already has a different deployment plan");
  }
  const target = digestPath(
    asoiafAnswerCredentialDeploymentPaths(input.root).plans,
    plan.planFingerprint,
  );
  const persisted = writeExact(target, plan);
  return {
    plan: persisted.value,
    planUri: relativeUri(input.root, target),
    replayed: persisted.replayed,
  };
}

export function buildAsoiafAnswerCredentialInstallationStatement(input: {
  root: string;
  planId: string;
  installedAt: string;
  providerReceiptDigest: string;
}): AsoiafAnswerCredentialInstallationStatement {
  const plan = planById(input.root, input.planId);
  const device = deviceById(input.root, plan.deviceId);
  const keyReference = keyById(input.root, plan.keyReferenceId);
  const installedAt = requireTime(input.installedAt, "credential installation time");
  if (
    Date.parse(installedAt) < Date.parse(plan.plannedInstallAt)
    || Date.parse(installedAt) > Date.parse(plan.plannedActivateAt)
  ) {
    throw new Error("credential installation time is outside the deployment plan");
  }
  return {
    format: ASOIAF_ANSWER_CREDENTIAL_INSTALLATION_STATEMENT_FORMAT,
    planId: plan.planId,
    planFingerprint: plan.planFingerprint,
    deviceId: device.deviceId,
    deviceFingerprint: device.deviceFingerprint,
    deviceAgentId: device.deviceAgentId,
    keyReferenceId: keyReference.keyReferenceId,
    keyReferenceFingerprint: keyReference.keyReferenceFingerprint,
    providerClass: keyReference.providerClass,
    providerHandleDigest: keyReference.providerHandleDigest,
    serviceId: plan.serviceId,
    certificateFingerprint: plan.certificateFingerprint,
    issuerCertificateFingerprint: plan.issuerCertificateFingerprint,
    publicKeyFingerprint: plan.publicKeyFingerprint,
    providerReceiptDigest: requireSha256(
      input.providerReceiptDigest,
      "installation provider receipt digest",
    ),
    installedAt,
    certificateRetained: false,
    privateKeyRetained: false,
    rawProviderHandleRetained: false,
    providerSecretRetained: false,
  };
}

export function serializeAsoiafAnswerCredentialInstallationStatement(
  statement: AsoiafAnswerCredentialInstallationStatement,
): Buffer {
  return stableBytes(statement);
}

function verifyCertificateForPlan(input: {
  plan: AsoiafAnswerCredentialDeploymentPlan;
  keyReference: AsoiafAnswerCredentialKeyReference;
  certificate: string | Buffer;
  issuerCertificate: string | Buffer;
  at: string;
}): {
  serialNumber: string;
  subject: string;
  subjectAltNames: string[];
  validFrom: string;
  validUntil: string;
  extendedKeyUsageOids: string[];
} {
  const certificate = parseCertificate(input.certificate);
  const issuer = parseCertificate(input.issuerCertificate);
  if (!issuer.ca) throw new Error("credential installation issuer is not a certificate authority");
  if (!certificate.checkIssued(issuer) || !certificate.verify(issuer.publicKey)) {
    throw new Error("credential installation certificate is not signed by its governed issuer");
  }
  if (certificate.ca) throw new Error("credential installation leaf cannot be a certificate authority");
  assertKeyStrength(certificate.publicKey);
  const certificateFp = bytesDigest(certificate.raw);
  const issuerFp = bytesDigest(issuer.raw);
  const publicFp = publicKeyFingerprint(certificate.publicKey);
  if (
    certificateFp !== input.plan.certificateFingerprint
    || issuerFp !== input.plan.issuerCertificateFingerprint
    || publicFp !== input.plan.publicKeyFingerprint
    || publicFp !== input.keyReference.publicKeyFingerprint
  ) {
    throw new Error("credential installation certificate, issuer, or public key differs from plan custody");
  }
  if (
    certificate.subject !== input.plan.issuance.certificate.subject
    || certificate.issuer !== input.plan.issuance.certificate.issuer
    || certificate.serialNumber.toLowerCase()
      !== input.plan.issuance.certificate.serialNumber.toLowerCase()
    || stableJson(parseSubjectAltNames(certificate.subjectAltName))
      !== stableJson(input.plan.issuance.certificate.subjectAltNames)
  ) {
    throw new Error("credential installation certificate metadata differs from issuance receipt");
  }
  const validFrom = certificate.validFromDate.toISOString();
  const validUntil = certificate.validToDate.toISOString();
  if (
    validFrom !== input.plan.issuance.certificate.validFrom
    || validUntil !== input.plan.issuance.certificate.validUntil
    || Date.parse(input.at) < Date.parse(validFrom)
    || Date.parse(input.at) > Date.parse(validUntil)
  ) {
    throw new Error("credential installation certificate validity differs from issuance or installation time");
  }
  const requiredUsage = input.plan.certificateUsage === "client-auth"
    ? CLIENT_AUTH_OID
    : SERVER_AUTH_OID;
  const extendedKeyUsageOids = [...(certificate.keyUsage ?? [])].sort();
  if (!extendedKeyUsageOids.includes(requiredUsage)) {
    throw new Error(`credential installation certificate lacks required usage ${requiredUsage}`);
  }
  return {
    serialNumber: certificate.serialNumber.toLowerCase(),
    subject: certificate.subject,
    subjectAltNames: parseSubjectAltNames(certificate.subjectAltName),
    validFrom,
    validUntil,
    extendedKeyUsageOids,
  };
}

export function admitAsoiafAnswerCredentialInstallation(input: {
  root: string;
  planId: string;
  certificate: string | Buffer;
  issuerCertificate: string | Buffer;
  installedAt: string;
  providerReceiptDigest: string;
  deviceAgentSignatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  deviceAgentSignature: string | Buffer;
  operatorId: string;
}): {
  installation: AsoiafAnswerCredentialInstallation;
  installationUri: string;
  replayed: boolean;
} {
  const plan = planById(input.root, input.planId);
  const device = deviceById(input.root, plan.deviceId);
  const keyReference = keyById(input.root, plan.keyReferenceId);
  const statement = buildAsoiafAnswerCredentialInstallationStatement(input);
  const signature = signatureBuffer(input.deviceAgentSignature);
  const agentKey = publicKeyObject(
    Buffer.from(device.deviceAgentPublicKeySpkiBase64, "base64"),
  );
  if (!verifySignature({
    publicKey: agentKey,
    algorithm: input.deviceAgentSignatureAlgorithm,
    message: serializeAsoiafAnswerCredentialInstallationStatement(statement),
    signature,
  })) {
    throw new Error("credential installation device-agent signature is invalid");
  }
  const certificate = verifyCertificateForPlan({
    plan,
    keyReference,
    certificate: input.certificate,
    issuerCertificate: input.issuerCertificate,
    at: statement.installedAt,
  });
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_INSTALLATION_FORMAT,
    statement,
    deviceAgentSignatureAlgorithm: input.deviceAgentSignatureAlgorithm,
    deviceAgentSignatureBase64: signature.toString("base64"),
    deviceAgentSignatureDigest: bytesDigest(signature),
    deviceAgentSignatureVerified: true as const,
    certificateSerialNumber: certificate.serialNumber,
    certificateSubject: certificate.subject,
    certificateSubjectAltNames: certificate.subjectAltNames,
    certificateValidFrom: certificate.validFrom,
    certificateValidUntil: certificate.validUntil,
    certificateExtendedKeyUsageOids: certificate.extendedKeyUsageOids,
    operatorId: requireIdentity(input.operatorId, "installation operator identity"),
    certificateRetained: false as const,
    certificatePathRetained: false as const,
    privateKeyRetained: false as const,
    privateKeyPathRetained: false as const,
    rawProviderHandleRetained: false as const,
    installationAuthority: "verified-installation-only" as const,
    ...NO_TASK_AUTHORITY,
  };
  const installationFingerprint = sha256(core);
  const installation: AsoiafAnswerCredentialInstallation = {
    ...core,
    installationId: collectorContentId("asoiaf-answer-credential-installation", {
      planId: plan.planId,
      deviceId: device.deviceId,
      providerReceiptDigest: statement.providerReceiptDigest,
      installationFingerprint,
    }),
    installationFingerprint,
  };
  const existing = readAsoiafAnswerCredentialDeploymentStatus(input.root).installations
    .filter((entry) => entry.statement.planId === plan.planId);
  if (
    existing.length > 0
    && !existing.some(
      (entry) => entry.installationFingerprint === installation.installationFingerprint,
    )
  ) {
    throw new Error("credential deployment plan already has a different installation receipt");
  }
  const target = digestPath(
    asoiafAnswerCredentialDeploymentPaths(input.root).installations,
    installation.installationFingerprint,
  );
  const persisted = writeExact(target, installation);
  return {
    installation: persisted.value,
    installationUri: relativeUri(input.root, target),
    replayed: persisted.replayed,
  };
}

export function buildAsoiafAnswerCredentialActivationStatement(input: {
  root: string;
  planId: string;
  installationId: string;
  challengeDigest: string;
  activatedAt: string;
}): AsoiafAnswerCredentialActivationStatement {
  const plan = planById(input.root, input.planId);
  const installation = installationById(input.root, input.installationId);
  if (
    installation.statement.planId !== plan.planId
    || installation.statement.planFingerprint !== plan.planFingerprint
  ) {
    throw new Error("credential activation installation differs from deployment plan");
  }
  const device = deviceById(input.root, plan.deviceId);
  const keyReference = keyById(input.root, plan.keyReferenceId);
  const activatedAt = requireTime(input.activatedAt, "credential activation time");
  if (
    Date.parse(activatedAt) < Date.parse(plan.plannedActivateAt)
    || Date.parse(activatedAt) < Date.parse(installation.statement.installedAt)
    || Date.parse(activatedAt) > Date.parse(plan.rollbackUntil)
    || Date.parse(activatedAt) > Date.parse(plan.certificateValidUntil)
  ) {
    throw new Error("credential activation time is outside the deployment plan");
  }
  return {
    format: ASOIAF_ANSWER_CREDENTIAL_ACTIVATION_STATEMENT_FORMAT,
    planId: plan.planId,
    planFingerprint: plan.planFingerprint,
    installationId: installation.installationId,
    installationFingerprint: installation.installationFingerprint,
    deviceId: device.deviceId,
    deviceFingerprint: device.deviceFingerprint,
    deviceAgentId: device.deviceAgentId,
    keyReferenceId: keyReference.keyReferenceId,
    keyReferenceFingerprint: keyReference.keyReferenceFingerprint,
    providerClass: keyReference.providerClass,
    providerHandleDigest: keyReference.providerHandleDigest,
    serviceId: plan.serviceId,
    certificateFingerprint: plan.certificateFingerprint,
    publicKeyFingerprint: plan.publicKeyFingerprint,
    predecessorPlanId: plan.predecessorPlanId,
    predecessorActivationId: plan.predecessorActivationId,
    challengeDigest: requireSha256(input.challengeDigest, "activation challenge digest"),
    activatedAt,
    rollbackUntil: plan.rollbackUntil,
    certificateRetained: false,
    privateKeyRetained: false,
    rawProviderHandleRetained: false,
    providerSecretRetained: false,
  };
}

export function serializeAsoiafAnswerCredentialActivationStatement(
  statement: AsoiafAnswerCredentialActivationStatement,
): Buffer {
  return stableBytes(statement);
}

export function admitAsoiafAnswerCredentialActivation(input: {
  root: string;
  planId: string;
  installationId: string;
  challengeDigest: string;
  activatedAt: string;
  credentialSignatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  credentialSignature: string | Buffer;
  deviceAgentSignatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  deviceAgentSignature: string | Buffer;
  operatorId: string;
}): {
  activation: AsoiafAnswerCredentialActivation;
  activationUri: string;
  replayed: boolean;
  state: AsoiafAnswerCredentialDeploymentState;
} {
  const plan = planById(input.root, input.planId);
  const device = deviceById(input.root, plan.deviceId);
  const keyReference = keyById(input.root, plan.keyReferenceId);
  const statement = buildAsoiafAnswerCredentialActivationStatement(input);
  const credentialSignature = signatureBuffer(input.credentialSignature);
  const agentSignature = signatureBuffer(input.deviceAgentSignature);
  const keyPublic = publicKeyObject(
    Buffer.from(keyReference.publicKeySpkiBase64, "base64"),
  );
  const agentPublic = publicKeyObject(
    Buffer.from(device.deviceAgentPublicKeySpkiBase64, "base64"),
  );
  const message = serializeAsoiafAnswerCredentialActivationStatement(statement);
  if (!verifySignature({
    publicKey: keyPublic,
    algorithm: input.credentialSignatureAlgorithm,
    message,
    signature: credentialSignature,
  })) {
    throw new Error("credential activation private-key possession signature is invalid");
  }
  if (!verifySignature({
    publicKey: agentPublic,
    algorithm: input.deviceAgentSignatureAlgorithm,
    message,
    signature: agentSignature,
  })) {
    throw new Error("credential activation device-agent signature is invalid");
  }
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_ACTIVATION_FORMAT,
    statement,
    credentialSignatureAlgorithm: input.credentialSignatureAlgorithm,
    credentialSignatureBase64: credentialSignature.toString("base64"),
    credentialSignatureDigest: bytesDigest(credentialSignature),
    credentialSignatureVerified: true as const,
    deviceAgentSignatureAlgorithm: input.deviceAgentSignatureAlgorithm,
    deviceAgentSignatureBase64: agentSignature.toString("base64"),
    deviceAgentSignatureDigest: bytesDigest(agentSignature),
    deviceAgentSignatureVerified: true as const,
    operatorId: requireIdentity(input.operatorId, "activation operator identity"),
    activationAuthority: "verified-device-and-key-use-only" as const,
    ...NO_TASK_AUTHORITY,
  };
  const activationFingerprint = sha256(core);
  const activation: AsoiafAnswerCredentialActivation = {
    ...core,
    activationId: collectorContentId("asoiaf-answer-credential-activation", {
      planId: plan.planId,
      installationId: statement.installationId,
      challengeDigest: statement.challengeDigest,
      activationFingerprint,
    }),
    activationFingerprint,
  };
  const existing = readAsoiafAnswerCredentialDeploymentStatus(input.root).activations
    .filter((entry) => entry.statement.planId === plan.planId);
  if (
    existing.length > 0
    && !existing.some((entry) => entry.activationFingerprint === activation.activationFingerprint)
  ) {
    throw new Error("credential deployment plan already has a different activation receipt");
  }
  const target = digestPath(
    asoiafAnswerCredentialDeploymentPaths(input.root).activations,
    activation.activationFingerprint,
  );
  const persisted = writeExact(target, activation);
  const state = rebuildAsoiafAnswerCredentialDeploymentState(input.root);
  writeJsonAtomic(asoiafAnswerCredentialDeploymentPaths(input.root).state, state);
  return {
    activation: persisted.value,
    activationUri: relativeUri(input.root, target),
    replayed: persisted.replayed,
    state,
  };
}

export function buildAsoiafAnswerCredentialRollbackStatement(input: {
  root: string;
  planId: string;
  activationId: string;
  predecessorActivationId: string;
  providerReceiptDigest: string;
  rolledBackAt: string;
  reason: string;
}): AsoiafAnswerCredentialRollbackStatement {
  const plan = planById(input.root, input.planId);
  if (plan.mode !== "successor" || !plan.predecessorPlanId || !plan.predecessorActivationId) {
    throw new Error("credential rollback requires a successor deployment plan");
  }
  const activation = activationById(input.root, input.activationId);
  const predecessorActivation = activationById(input.root, input.predecessorActivationId);
  const predecessorPlan = planById(input.root, plan.predecessorPlanId);
  if (
    activation.statement.planId !== plan.planId
    || predecessorActivation.activationId !== plan.predecessorActivationId
    || predecessorActivation.statement.planId !== predecessorPlan.planId
    || input.predecessorActivationId !== plan.predecessorActivationId
  ) {
    throw new Error("credential rollback differs from predecessor deployment custody");
  }
  const rolledBackAt = requireTime(input.rolledBackAt, "credential rollback time");
  if (
    Date.parse(rolledBackAt) < Date.parse(activation.statement.activatedAt)
    || Date.parse(rolledBackAt) > Date.parse(plan.rollbackUntil)
  ) {
    throw new Error("credential rollback time is outside the bounded rollback window");
  }
  const reason = requireReason(input.reason, "credential rollback reason");
  const device = deviceById(input.root, plan.deviceId);
  return {
    format: ASOIAF_ANSWER_CREDENTIAL_ROLLBACK_STATEMENT_FORMAT,
    planId: plan.planId,
    planFingerprint: plan.planFingerprint,
    activationId: activation.activationId,
    activationFingerprint: activation.activationFingerprint,
    predecessorPlanId: predecessorPlan.planId,
    predecessorActivationId: predecessorActivation.activationId,
    deviceId: device.deviceId,
    deviceFingerprint: device.deviceFingerprint,
    deviceAgentId: device.deviceAgentId,
    serviceId: plan.serviceId,
    failedCertificateFingerprint: plan.certificateFingerprint,
    restoredCertificateFingerprint: predecessorPlan.certificateFingerprint,
    providerReceiptDigest: requireSha256(
      input.providerReceiptDigest,
      "rollback provider receipt digest",
    ),
    rolledBackAt,
    reasonDigest: sha256(reason),
    certificateRetained: false,
    privateKeyRetained: false,
    rawProviderHandleRetained: false,
    providerSecretRetained: false,
  };
}

export function serializeAsoiafAnswerCredentialRollbackStatement(
  statement: AsoiafAnswerCredentialRollbackStatement,
): Buffer {
  return stableBytes(statement);
}

export function retainAsoiafAnswerCredentialRollback(input: {
  root: string;
  planId: string;
  activationId: string;
  predecessorActivationId: string;
  providerReceiptDigest: string;
  rolledBackAt: string;
  reason: string;
  deviceAgentSignatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  deviceAgentSignature: string | Buffer;
  operatorId: string;
}): {
  rollback: AsoiafAnswerCredentialRollback;
  rollbackUri: string;
  replayed: boolean;
  state: AsoiafAnswerCredentialDeploymentState;
} {
  const statement = buildAsoiafAnswerCredentialRollbackStatement(input);
  const device = deviceById(input.root, statement.deviceId);
  const signature = signatureBuffer(input.deviceAgentSignature);
  const agentKey = publicKeyObject(
    Buffer.from(device.deviceAgentPublicKeySpkiBase64, "base64"),
  );
  if (!verifySignature({
    publicKey: agentKey,
    algorithm: input.deviceAgentSignatureAlgorithm,
    message: serializeAsoiafAnswerCredentialRollbackStatement(statement),
    signature,
  })) {
    throw new Error("credential rollback device-agent signature is invalid");
  }
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_ROLLBACK_FORMAT,
    statement,
    reason: requireReason(input.reason, "credential rollback reason"),
    deviceAgentSignatureAlgorithm: input.deviceAgentSignatureAlgorithm,
    deviceAgentSignatureBase64: signature.toString("base64"),
    deviceAgentSignatureDigest: bytesDigest(signature),
    deviceAgentSignatureVerified: true as const,
    operatorId: requireIdentity(input.operatorId, "rollback operator identity"),
    rollbackAuthority: "restore-predecessor-reference-only" as const,
    ...NO_TASK_AUTHORITY,
  };
  const rollbackFingerprint = sha256(core);
  const rollback: AsoiafAnswerCredentialRollback = {
    ...core,
    rollbackId: collectorContentId("asoiaf-answer-credential-rollback", {
      activationId: statement.activationId,
      predecessorActivationId: statement.predecessorActivationId,
      rolledBackAt: statement.rolledBackAt,
      rollbackFingerprint,
    }),
    rollbackFingerprint,
  };
  const existing = readAsoiafAnswerCredentialDeploymentStatus(input.root).rollbacks
    .filter((entry) => entry.statement.activationId === statement.activationId);
  if (
    existing.length > 0
    && !existing.some((entry) => entry.rollbackFingerprint === rollback.rollbackFingerprint)
  ) {
    throw new Error("credential activation already has a different rollback receipt");
  }
  const target = digestPath(
    asoiafAnswerCredentialDeploymentPaths(input.root).rollbacks,
    rollback.rollbackFingerprint,
  );
  const persisted = writeExact(target, rollback);
  const state = rebuildAsoiafAnswerCredentialDeploymentState(input.root);
  writeJsonAtomic(asoiafAnswerCredentialDeploymentPaths(input.root).state, state);
  return {
    rollback: persisted.value,
    rollbackUri: relativeUri(input.root, target),
    replayed: persisted.replayed,
    state,
  };
}

export function rebuildAsoiafAnswerCredentialDeploymentState(
  root: string,
): AsoiafAnswerCredentialDeploymentState {
  const status = readAsoiafAnswerCredentialDeploymentStatus(root);
  const plans = new Map(status.plans.map((entry) => [entry.planId, entry] as const));
  const activations = new Map(
    status.activations.map((entry) => [entry.activationId, entry] as const),
  );
  const events: Array<{
    at: string;
    kind: "activation" | "rollback";
    activationId: string;
    serviceId: string;
  }> = [];
  for (const activation of status.activations) {
    events.push({
      at: activation.statement.activatedAt,
      kind: "activation",
      activationId: activation.activationId,
      serviceId: activation.statement.serviceId,
    });
  }
  for (const rollback of status.rollbacks) {
    events.push({
      at: rollback.statement.rolledBackAt,
      kind: "rollback",
      activationId: rollback.statement.predecessorActivationId,
      serviceId: rollback.statement.serviceId,
    });
  }
  events.sort(
    (left, right) =>
      left.at.localeCompare(right.at)
      || left.kind.localeCompare(right.kind)
      || left.activationId.localeCompare(right.activationId),
  );
  const current = new Map<string, AsoiafAnswerCredentialDeploymentStateEntry>();
  for (const event of events) {
    const activation = activations.get(event.activationId);
    if (!activation) continue;
    const plan = plans.get(activation.statement.planId);
    if (!plan) continue;
    current.set(event.serviceId, {
      serviceId: event.serviceId,
      deviceId: plan.deviceId,
      planId: plan.planId,
      planFingerprint: plan.planFingerprint,
      activationId: activation.activationId,
      activationFingerprint: activation.activationFingerprint,
      certificateFingerprint: plan.certificateFingerprint,
      keyReferenceId: plan.keyReferenceId,
      keyReferenceFingerprint: plan.keyReferenceFingerprint,
      stateOrigin: event.kind,
      updatedAt: event.at,
    });
  }
  const entries = [...current.values()].sort((left, right) =>
    left.serviceId.localeCompare(right.serviceId));
  const asOf = events.at(-1)?.at
    ?? status.plans.map((entry) => entry.createdAt).sort().at(-1)
    ?? status.keys.map((entry) => entry.registeredAt).sort().at(-1)
    ?? status.devices.map((entry) => entry.registeredAt).sort().at(-1)
    ?? "1970-01-01T00:00:00.000Z";
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_DEPLOYMENT_STATE_FORMAT,
    asOf,
    entries,
    stateAuthority: "projection-only" as const,
    ...NO_TASK_AUTHORITY,
  };
  const stateFingerprint = sha256(core);
  return {
    ...core,
    stateId: collectorContentId("asoiaf-answer-credential-deployment-state", {
      asOf,
      entries,
      stateFingerprint,
    }),
    stateFingerprint,
  };
}

export function readAsoiafAnswerCredentialDeploymentStatus(
  root: string,
): AsoiafAnswerCredentialDeploymentStatus {
  const paths = asoiafAnswerCredentialDeploymentPaths(root);
  return {
    format: "axm-asoiaf-answer-credential-deployment-status/1",
    paths,
    devices: listJson<AsoiafAnswerCredentialDevice>(paths.devices),
    keys: listJson<AsoiafAnswerCredentialKeyReference>(paths.keys),
    plans: listJson<AsoiafAnswerCredentialDeploymentPlan>(paths.plans),
    installations: listJson<AsoiafAnswerCredentialInstallation>(paths.installations),
    activations: listJson<AsoiafAnswerCredentialActivation>(paths.activations),
    rollbacks: listJson<AsoiafAnswerCredentialRollback>(paths.rollbacks),
    state: fs.existsSync(paths.state)
      ? readJson<AsoiafAnswerCredentialDeploymentState>(paths.state)
      : null,
  };
}

function addFingerprintFinding(input: {
  findings: AsoiafAnswerCredentialDeploymentFinding[];
  code: string;
  subjectId: string;
  actual: string;
  expected: string;
  detail: string;
}): void {
  if (input.actual !== input.expected) {
    input.findings.push(
      finding(input.code, "error", input.subjectId, input.detail),
    );
  }
}

function secretFindings(root: string): AsoiafAnswerCredentialDeploymentFinding[] {
  const findings: AsoiafAnswerCredentialDeploymentFinding[] = [];
  const paths = asoiafAnswerCredentialDeploymentPaths(root);
  if (!fs.existsSync(paths.deploymentRoot)) return findings;
  const forbiddenName = /(?:^|[._-])(private[-_]?key|secret|password|passwd|pin|token|session|pkcs12|p12|pfx|csr|certificate|cert|pem|key)(?:[._-]|$)/i;
  const forbiddenContent = /-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----|-----BEGIN CERTIFICATE(?: REQUEST)?-----|pkcs11:[^\s"']+|provider(?:Pin|Password|Token|Secret|Session)\s*[":=]/i;
  const stack = [paths.deploymentRoot];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      const relative = relativeUri(root, target);
      if (entry.isDirectory()) {
        stack.push(target);
        continue;
      }
      if (forbiddenName.test(entry.name)) {
        findings.push(finding(
          "deployment-secret-path",
          "error",
          relative,
          "credential deployment estate contains a secret-bearing filename",
        ));
      }
      const bytes = fs.readFileSync(target);
      if (bytes.length <= 8 * 1024 * 1024) {
        const text = bytes.toString("utf8");
        if (forbiddenContent.test(text)) {
          findings.push(finding(
            "deployment-secret-content",
            "error",
            relative,
            "credential deployment estate contains forbidden key, certificate, or provider-secret material",
          ));
        }
      }
    }
  }
  return findings;
}

export function verifyAsoiafAnswerCredentialDeploymentEstate(
  root: string,
): AsoiafAnswerCredentialDeploymentFinding[] {
  const findings: AsoiafAnswerCredentialDeploymentFinding[] = [];
  const status = readAsoiafAnswerCredentialDeploymentStatus(root);
  const deviceIds = new Set<string>();
  const keyIds = new Set<string>();
  const planIds = new Set<string>();
  const installationIds = new Set<string>();
  const activationIds = new Set<string>();
  const rollbackIds = new Set<string>();

  for (const device of status.devices) {
    if (deviceIds.has(device.deviceId)) {
      findings.push(finding("deployment-device-duplicate", "error", device.deviceId, "credential device identity is duplicated"));
    }
    deviceIds.add(device.deviceId);
    try {
      requirePlatform(device.platform);
      device.allowedProviderClasses.forEach(requireProviderClass);
      validateAuthority(device, "credential device");
      const expectedFingerprint = sha256(deviceCore(device));
      addFingerprintFinding({
        findings,
        code: "deployment-device-fingerprint",
        subjectId: device.deviceId,
        actual: device.deviceFingerprint,
        expected: expectedFingerprint,
        detail: "credential device fingerprint is stale",
      });
      const expectedId = collectorContentId("asoiaf-answer-credential-device", {
        deviceAgentId: device.deviceAgentId,
        trustDomain: device.trustDomain,
        deviceAgentPublicKeyFingerprint: device.deviceAgentPublicKeyFingerprint,
        deviceFingerprint: expectedFingerprint,
      });
      if (device.deviceId !== expectedId) {
        findings.push(finding("deployment-device-identity", "error", device.deviceId, "credential device identity is not content addressed"));
      }
      const key = publicKeyObject(Buffer.from(device.deviceAgentPublicKeySpkiBase64, "base64"));
      if (publicKeyFingerprint(key) !== device.deviceAgentPublicKeyFingerprint) {
        findings.push(finding("deployment-device-key", "error", device.deviceId, "credential device public-key fingerprint is stale"));
      }
    } catch (error) {
      findings.push(finding("deployment-device-invalid", "error", device.deviceId, error instanceof Error ? error.message : String(error)));
    }
  }

  for (const keyReference of status.keys) {
    if (keyIds.has(keyReference.keyReferenceId)) {
      findings.push(finding("deployment-key-duplicate", "error", keyReference.keyReferenceId, "credential key identity is duplicated"));
    }
    keyIds.add(keyReference.keyReferenceId);
    try {
      requireProviderClass(keyReference.providerClass);
      requireCustodyClass(keyReference.custodyClass);
      validateAuthority(keyReference, "credential key reference");
      const device = byId(status.devices, keyReference.deviceId, (entry) => entry.deviceId, "credential device");
      if (
        device.deviceFingerprint !== keyReference.deviceFingerprint
        || !device.allowedProviderClasses.includes(keyReference.providerClass)
      ) {
        throw new Error("credential key reference differs from device registration");
      }
      if (
        keyReference.privateKeyExportable !== false
        || keyReference.privateKeyRetained !== false
        || keyReference.rawProviderHandleRetained !== false
        || keyReference.providerSecretRetained !== false
      ) {
        throw new Error("credential key reference crossed secret-retention boundary");
      }
      const key = publicKeyObject(Buffer.from(keyReference.publicKeySpkiBase64, "base64"));
      if (publicKeyFingerprint(key) !== keyReference.publicKeyFingerprint) {
        throw new Error("credential key-reference public-key fingerprint is stale");
      }
      const expectedFingerprint = sha256(keyReferenceCore(keyReference));
      addFingerprintFinding({
        findings,
        code: "deployment-key-fingerprint",
        subjectId: keyReference.keyReferenceId,
        actual: keyReference.keyReferenceFingerprint,
        expected: expectedFingerprint,
        detail: "credential key-reference fingerprint is stale",
      });
    } catch (error) {
      findings.push(finding("deployment-key-invalid", "error", keyReference.keyReferenceId, error instanceof Error ? error.message : String(error)));
    }
  }

  for (const plan of status.plans) {
    if (planIds.has(plan.planId)) {
      findings.push(finding("deployment-plan-duplicate", "error", plan.planId, "credential deployment plan identity is duplicated"));
    }
    planIds.add(plan.planId);
    try {
      requireMode(plan.mode);
      validateAuthority(plan, "credential deployment plan");
      validateIssuance(plan.issuance);
      if (plan.admissionLink) validateAdmissionLink(plan.admissionLink, plan.issuance);
      const device = byId(status.devices, plan.deviceId, (entry) => entry.deviceId, "credential device");
      const keyReference = byId(status.keys, plan.keyReferenceId, (entry) => entry.keyReferenceId, "credential key reference");
      if (
        device.deviceFingerprint !== plan.deviceFingerprint
        || keyReference.keyReferenceFingerprint !== plan.keyReferenceFingerprint
        || keyReference.publicKeyFingerprint !== plan.publicKeyFingerprint
        || keyReference.providerHandleDigest !== plan.providerHandleDigest
        || keyReference.providerClass !== plan.providerClass
      ) {
        throw new Error("credential deployment plan differs from device or key custody");
      }
      if (
        plan.issuanceId !== plan.issuance.issuanceId
        || plan.issuanceFingerprint !== plan.issuance.issuanceFingerprint
        || plan.certificateFingerprint !== plan.issuance.certificate.certificateFingerprint
      ) {
        throw new Error("credential deployment plan differs from issuance custody");
      }
      if (plan.mode === "successor") {
        if (!plan.predecessorPlanId || !plan.predecessorActivationId) {
          throw new Error("successor deployment plan lacks predecessor custody");
        }
        const predecessorPlan = byId(status.plans, plan.predecessorPlanId, (entry) => entry.planId, "predecessor plan");
        const predecessorActivation = byId(status.activations, plan.predecessorActivationId, (entry) => entry.activationId, "predecessor activation");
        if (
          predecessorPlan.planFingerprint !== plan.predecessorPlanFingerprint
          || predecessorActivation.activationFingerprint !== plan.predecessorActivationFingerprint
          || predecessorActivation.statement.planId !== predecessorPlan.planId
        ) {
          throw new Error("successor deployment predecessor fingerprints are stale");
        }
      }
      const expectedFingerprint = sha256(planCore(plan));
      addFingerprintFinding({
        findings,
        code: "deployment-plan-fingerprint",
        subjectId: plan.planId,
        actual: plan.planFingerprint,
        expected: expectedFingerprint,
        detail: "credential deployment plan fingerprint is stale",
      });
    } catch (error) {
      findings.push(finding("deployment-plan-invalid", "error", plan.planId, error instanceof Error ? error.message : String(error)));
    }
  }

  for (const installation of status.installations) {
    if (installationIds.has(installation.installationId)) {
      findings.push(finding("deployment-installation-duplicate", "error", installation.installationId, "credential installation identity is duplicated"));
    }
    installationIds.add(installation.installationId);
    try {
      validateAuthority(installation, "credential installation");
      const plan = byId(status.plans, installation.statement.planId, (entry) => entry.planId, "credential deployment plan");
      const device = byId(status.devices, installation.statement.deviceId, (entry) => entry.deviceId, "credential device");
      const statement = buildAsoiafAnswerCredentialInstallationStatement({
        root,
        planId: plan.planId,
        installedAt: installation.statement.installedAt,
        providerReceiptDigest: installation.statement.providerReceiptDigest,
      });
      if (stableJson(statement) !== stableJson(installation.statement)) {
        throw new Error("credential installation statement differs from current plan custody");
      }
      const signature = Buffer.from(installation.deviceAgentSignatureBase64, "base64");
      const agentKey = publicKeyObject(Buffer.from(device.deviceAgentPublicKeySpkiBase64, "base64"));
      if (!verifySignature({
        publicKey: agentKey,
        algorithm: installation.deviceAgentSignatureAlgorithm,
        message: serializeAsoiafAnswerCredentialInstallationStatement(statement),
        signature,
      })) {
        throw new Error("credential installation retained signature is invalid");
      }
      const expectedFingerprint = sha256(installationCore(installation));
      addFingerprintFinding({
        findings,
        code: "deployment-installation-fingerprint",
        subjectId: installation.installationId,
        actual: installation.installationFingerprint,
        expected: expectedFingerprint,
        detail: "credential installation fingerprint is stale",
      });
    } catch (error) {
      findings.push(finding("deployment-installation-invalid", "error", installation.installationId, error instanceof Error ? error.message : String(error)));
    }
  }

  for (const activation of status.activations) {
    if (activationIds.has(activation.activationId)) {
      findings.push(finding("deployment-activation-duplicate", "error", activation.activationId, "credential activation identity is duplicated"));
    }
    activationIds.add(activation.activationId);
    try {
      validateAuthority(activation, "credential activation");
      const plan = byId(status.plans, activation.statement.planId, (entry) => entry.planId, "credential deployment plan");
      const installation = byId(status.installations, activation.statement.installationId, (entry) => entry.installationId, "credential installation");
      const device = byId(status.devices, activation.statement.deviceId, (entry) => entry.deviceId, "credential device");
      const keyReference = byId(status.keys, activation.statement.keyReferenceId, (entry) => entry.keyReferenceId, "credential key reference");
      const statement = buildAsoiafAnswerCredentialActivationStatement({
        root,
        planId: plan.planId,
        installationId: installation.installationId,
        challengeDigest: activation.statement.challengeDigest,
        activatedAt: activation.statement.activatedAt,
      });
      if (stableJson(statement) !== stableJson(activation.statement)) {
        throw new Error("credential activation statement differs from current custody");
      }
      const message = serializeAsoiafAnswerCredentialActivationStatement(statement);
      const keyPublic = publicKeyObject(Buffer.from(keyReference.publicKeySpkiBase64, "base64"));
      const agentPublic = publicKeyObject(Buffer.from(device.deviceAgentPublicKeySpkiBase64, "base64"));
      if (!verifySignature({
        publicKey: keyPublic,
        algorithm: activation.credentialSignatureAlgorithm,
        message,
        signature: Buffer.from(activation.credentialSignatureBase64, "base64"),
      })) {
        throw new Error("credential activation retained credential signature is invalid");
      }
      if (!verifySignature({
        publicKey: agentPublic,
        algorithm: activation.deviceAgentSignatureAlgorithm,
        message,
        signature: Buffer.from(activation.deviceAgentSignatureBase64, "base64"),
      })) {
        throw new Error("credential activation retained device signature is invalid");
      }
      const expectedFingerprint = sha256(activationCore(activation));
      addFingerprintFinding({
        findings,
        code: "deployment-activation-fingerprint",
        subjectId: activation.activationId,
        actual: activation.activationFingerprint,
        expected: expectedFingerprint,
        detail: "credential activation fingerprint is stale",
      });
    } catch (error) {
      findings.push(finding("deployment-activation-invalid", "error", activation.activationId, error instanceof Error ? error.message : String(error)));
    }
  }

  for (const rollback of status.rollbacks) {
    if (rollbackIds.has(rollback.rollbackId)) {
      findings.push(finding("deployment-rollback-duplicate", "error", rollback.rollbackId, "credential rollback identity is duplicated"));
    }
    rollbackIds.add(rollback.rollbackId);
    try {
      validateAuthority(rollback, "credential rollback");
      const statement = buildAsoiafAnswerCredentialRollbackStatement({
        root,
        planId: rollback.statement.planId,
        activationId: rollback.statement.activationId,
        predecessorActivationId: rollback.statement.predecessorActivationId,
        providerReceiptDigest: rollback.statement.providerReceiptDigest,
        rolledBackAt: rollback.statement.rolledBackAt,
        reason: rollback.reason,
      });
      if (stableJson(statement) !== stableJson(rollback.statement)) {
        throw new Error("credential rollback statement differs from current custody");
      }
      const device = byId(status.devices, statement.deviceId, (entry) => entry.deviceId, "credential device");
      const agentKey = publicKeyObject(Buffer.from(device.deviceAgentPublicKeySpkiBase64, "base64"));
      if (!verifySignature({
        publicKey: agentKey,
        algorithm: rollback.deviceAgentSignatureAlgorithm,
        message: serializeAsoiafAnswerCredentialRollbackStatement(statement),
        signature: Buffer.from(rollback.deviceAgentSignatureBase64, "base64"),
      })) {
        throw new Error("credential rollback retained device signature is invalid");
      }
      const expectedFingerprint = sha256(rollbackCore(rollback));
      addFingerprintFinding({
        findings,
        code: "deployment-rollback-fingerprint",
        subjectId: rollback.rollbackId,
        actual: rollback.rollbackFingerprint,
        expected: expectedFingerprint,
        detail: "credential rollback fingerprint is stale",
      });
    } catch (error) {
      findings.push(finding("deployment-rollback-invalid", "error", rollback.rollbackId, error instanceof Error ? error.message : String(error)));
    }
  }

  const expectedState = rebuildAsoiafAnswerCredentialDeploymentState(root);
  if (status.activations.length > 0 || status.rollbacks.length > 0) {
    if (!status.state) {
      findings.push(finding("deployment-state-missing", "error", status.paths.state, "credential deployment state projection is absent"));
    } else {
      const expectedFingerprint = sha256(stateCore(status.state));
      if (status.state.stateFingerprint !== expectedFingerprint) {
        findings.push(finding("deployment-state-fingerprint", "error", status.state.stateId, "credential deployment state fingerprint is stale"));
      }
      const expectedId = collectorContentId("asoiaf-answer-credential-deployment-state", {
        asOf: status.state.asOf,
        entries: status.state.entries,
        stateFingerprint: expectedFingerprint,
      });
      if (status.state.stateId !== expectedId) {
        findings.push(finding("deployment-state-identity", "error", status.state.stateId, "credential deployment state identity is not content addressed"));
      }
      if (stableJson(status.state) !== stableJson(expectedState)) {
        findings.push(finding("deployment-state-projection", "error", status.state.stateId, "credential deployment state differs from append-only records"));
      }
    }
  } else if (status.state && stableJson(status.state) !== stableJson(expectedState)) {
    findings.push(finding("deployment-state-empty-projection", "error", status.state.stateId, "empty credential deployment state differs from current estate"));
  }

  for (const [directory, code] of [
    [status.paths.devices, "deployment-device-filename"],
    [status.paths.keys, "deployment-key-filename"],
    [status.paths.plans, "deployment-plan-filename"],
    [status.paths.installations, "deployment-installation-filename"],
    [status.paths.activations, "deployment-activation-filename"],
    [status.paths.rollbacks, "deployment-rollback-filename"],
  ] as const) {
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory).sort()) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) {
        findings.push(finding(code, "error", name, "credential deployment filename is not a SHA-256 digest"));
      }
    }
  }

  findings.push(...secretFindings(root));

  const installedPlanIds = new Set(status.installations.map((entry) => entry.statement.planId));
  const activatedPlanIds = new Set(status.activations.map((entry) => entry.statement.planId));
  for (const plan of status.plans) {
    if (!installedPlanIds.has(plan.planId)) {
      findings.push(finding("deployment-plan-pending-installation", "notice", plan.planId, "credential deployment plan has no retained installation"));
    } else if (!activatedPlanIds.has(plan.planId)) {
      findings.push(finding("deployment-installation-pending-activation", "notice", plan.planId, "credential installation has no retained activation"));
    }
  }

  return sortedFindings(findings);
}
