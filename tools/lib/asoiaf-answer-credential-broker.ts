import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  collectorContentId,
  sha256,
} from "./asoiaf-external-estate.js";
import {
  readAsoiafAnswerCredentialDeploymentStatus,
  verifyAsoiafAnswerCredentialDeploymentEstate,
  type AsoiafAnswerCredentialActivation,
  type AsoiafAnswerCredentialDeploymentPlan,
  type AsoiafAnswerCredentialDeploymentStateEntry,
  type AsoiafAnswerCredentialDevice,
  type AsoiafAnswerCredentialKeyReference,
  type AsoiafAnswerCredentialProviderClass,
} from "./asoiaf-answer-credential-deployment.js";
import type {
  AsoiafAnswerTransportProofAlgorithm,
} from "./asoiaf-answer-desk-transport-enrollment.js";

export const ASOIAF_ANSWER_CREDENTIAL_BROKER_POLICY_FORMAT =
  "axm-asoiaf-answer-credential-broker-policy/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_BROKER_BINDING_FORMAT =
  "axm-asoiaf-answer-credential-broker-binding/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_BROKER_INVOCATION_FORMAT =
  "axm-asoiaf-answer-credential-broker-invocation/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_POSSESSION_PROOF_FORMAT =
  "axm-asoiaf-answer-credential-possession-proof/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_TRANSPORT_RESULT_FORMAT =
  "axm-asoiaf-answer-credential-transport-result/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_BROKER_STATE_FORMAT =
  "axm-asoiaf-answer-credential-broker-state/1" as const;

export type AsoiafAnswerCredentialBrokerOperation =
  | "prove-possession"
  | "mutual-tls-request";

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

export interface AsoiafAnswerCredentialBrokerPaths {
  root: string;
  brokerRoot: string;
  policies: string;
  bindings: string;
  invocations: string;
  proofs: string;
  transportResults: string;
  state: string;
}

export interface AsoiafAnswerCredentialBrokerPolicy extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_BROKER_POLICY_FORMAT;
  policyId: string;
  policyFingerprint: `sha256:${string}`;
  brokerId: string;
  deviceId: string;
  deviceFingerprint: `sha256:${string}`;
  serviceId: string;
  localEndpoint: string;
  allowedProviderClasses: AsoiafAnswerCredentialProviderClass[];
  allowedOperations: AsoiafAnswerCredentialBrokerOperation[];
  maxInvocationLifetimeMilliseconds: number;
  maxPossessionProofAgeMilliseconds: number;
  maxResponseBytes: number;
  deviceAgentPublicKeyFingerprint: `sha256:${string}`;
  createdAt: string;
  operatorId: string;
  localEndpointOnly: true;
  privateKeyRetained: false;
  privateKeyPathRetained: false;
  rawProviderHandleRetained: false;
  providerSecretRetained: false;
  brokerAuthority: "policy-only";
}

export interface AsoiafAnswerCredentialBrokerBinding extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_BROKER_BINDING_FORMAT;
  bindingId: string;
  bindingFingerprint: `sha256:${string}`;
  policyId: string;
  policyFingerprint: `sha256:${string}`;
  deploymentStateId: string;
  deploymentStateFingerprint: `sha256:${string}`;
  deploymentStateAsOf: string;
  deploymentStateOrigin: AsoiafAnswerCredentialDeploymentStateEntry["stateOrigin"];
  planId: string;
  planFingerprint: `sha256:${string}`;
  activationId: string;
  activationFingerprint: `sha256:${string}`;
  deviceId: string;
  deviceFingerprint: `sha256:${string}`;
  deviceAgentId: string;
  deviceAgentPublicKeyFingerprint: `sha256:${string}`;
  keyReferenceId: string;
  keyReferenceFingerprint: `sha256:${string}`;
  providerClass: AsoiafAnswerCredentialProviderClass;
  providerHandleDigest: `sha256:${string}`;
  publicKeyFingerprint: `sha256:${string}`;
  certificateFingerprint: `sha256:${string}`;
  issuerCertificateFingerprint: `sha256:${string}`;
  serviceId: string;
  principalId: string;
  actorRole: string | null;
  certificateValidUntil: string;
  boundAt: string;
  operatorId: string;
  certificateRetained: false;
  privateKeyRetained: false;
  rawProviderHandleRetained: false;
  providerSecretRetained: false;
  bindingAuthority: "active-deployment-reference-only";
}

export interface AsoiafAnswerCredentialPossessionRequest {
  kind: "possession";
  challengeDigest: `sha256:${string}`;
  contextDigest: `sha256:${string}`;
}

export interface AsoiafAnswerCredentialMutualTlsRequest {
  kind: "mutual-tls";
  possessionProofId: string;
  possessionProofFingerprint: `sha256:${string}`;
  method: "GET" | "POST";
  targetUrl: string;
  requestBodyDigest: `sha256:${string}`;
  requestBodyBytes: number;
  lowerIdempotencyKeyDigest: `sha256:${string}`;
  expectedServerCertificateFingerprint: `sha256:${string}`;
  expectedServerIssuerFingerprint: `sha256:${string}`;
  maxResponseBytes: number;
}

export type AsoiafAnswerCredentialBrokerRequest =
  | AsoiafAnswerCredentialPossessionRequest
  | AsoiafAnswerCredentialMutualTlsRequest;

export interface AsoiafAnswerCredentialBrokerInvocation extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_BROKER_INVOCATION_FORMAT;
  invocationId: string;
  invocationFingerprint: `sha256:${string}`;
  policyId: string;
  policyFingerprint: `sha256:${string}`;
  bindingId: string;
  bindingFingerprint: `sha256:${string}`;
  deploymentStateId: string;
  deploymentStateFingerprint: `sha256:${string}`;
  serviceId: string;
  deviceId: string;
  keyReferenceId: string;
  providerClass: AsoiafAnswerCredentialProviderClass;
  providerHandleDigest: `sha256:${string}`;
  certificateFingerprint: `sha256:${string}`;
  publicKeyFingerprint: `sha256:${string}`;
  localEndpoint: string;
  operation: AsoiafAnswerCredentialBrokerOperation;
  idempotencyKeyDigest: `sha256:${string}`;
  request: AsoiafAnswerCredentialBrokerRequest;
  createdAt: string;
  expiresAt: string;
  operatorId: string;
  privateKeyRetained: false;
  privateKeyPathRetained: false;
  rawProviderHandleRetained: false;
  providerSecretRetained: false;
  invocationAuthority: "provider-request-only";
}

export interface AsoiafAnswerCredentialPossessionProof extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_POSSESSION_PROOF_FORMAT;
  proofId: string;
  proofFingerprint: `sha256:${string}`;
  invocationId: string;
  invocationFingerprint: `sha256:${string}`;
  policyId: string;
  policyFingerprint: `sha256:${string}`;
  bindingId: string;
  bindingFingerprint: `sha256:${string}`;
  activationId: string;
  activationFingerprint: `sha256:${string}`;
  keyReferenceId: string;
  keyReferenceFingerprint: `sha256:${string}`;
  certificateFingerprint: `sha256:${string}`;
  publicKeyFingerprint: `sha256:${string}`;
  challengeDigest: `sha256:${string}`;
  contextDigest: `sha256:${string}`;
  signatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  signatureBase64: string;
  signatureDigest: `sha256:${string}`;
  signatureVerified: true;
  provedAt: string;
  operatorId: string;
  privateKeyRetained: false;
  rawProviderHandleRetained: false;
  proofAuthority: "possession-proof-only";
}

export interface AsoiafAnswerCredentialTransportResultStatement {
  format: "axm-asoiaf-answer-credential-transport-result-statement/1";
  invocationId: string;
  invocationFingerprint: `sha256:${string}`;
  possessionProofId: string;
  possessionProofFingerprint: `sha256:${string}`;
  bindingId: string;
  bindingFingerprint: `sha256:${string}`;
  deviceId: string;
  deviceFingerprint: `sha256:${string}`;
  deviceAgentId: string;
  keyReferenceId: string;
  keyReferenceFingerprint: `sha256:${string}`;
  providerClass: AsoiafAnswerCredentialProviderClass;
  providerHandleDigest: `sha256:${string}`;
  certificateFingerprint: `sha256:${string}`;
  targetUrl: string;
  method: "GET" | "POST";
  lowerIdempotencyKeyDigest: `sha256:${string}`;
  lowerRequestId: string;
  lowerRequestFingerprint: `sha256:${string}`;
  lowerResponseId: string;
  lowerResponseFingerprint: `sha256:${string}`;
  observedServerCertificateFingerprint: `sha256:${string}`;
  observedServerIssuerFingerprint: `sha256:${string}`;
  httpStatus: number;
  responseBytes: number;
  responseDigest: `sha256:${string}`;
  providerReceiptDigest: `sha256:${string}`;
  startedAt: string;
  completedAt: string;
  networkAttempted: true;
  rawResponseRetained: false;
  certificateRetained: false;
  privateKeyRetained: false;
  rawProviderHandleRetained: false;
  providerSecretRetained: false;
}

export interface AsoiafAnswerCredentialTransportResult extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_TRANSPORT_RESULT_FORMAT;
  resultId: string;
  resultFingerprint: `sha256:${string}`;
  statement: AsoiafAnswerCredentialTransportResultStatement;
  deviceAgentSignatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  deviceAgentSignatureBase64: string;
  deviceAgentSignatureDigest: `sha256:${string}`;
  deviceAgentSignatureVerified: true;
  operatorId: string;
  resultAuthority: "attested-transport-reference-only";
}

export interface AsoiafAnswerCredentialBrokerStateEntry {
  bindingId: string;
  bindingFingerprint: `sha256:${string}`;
  serviceId: string;
  deviceId: string;
  planId: string;
  activationId: string;
  certificateFingerprint: `sha256:${string}`;
  latestProofId: string | null;
  latestProofFingerprint: `sha256:${string}` | null;
  latestTransportResultId: string | null;
  latestTransportResultFingerprint: `sha256:${string}` | null;
  updatedAt: string;
}

export interface AsoiafAnswerCredentialBrokerState extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_BROKER_STATE_FORMAT;
  stateId: string;
  stateFingerprint: `sha256:${string}`;
  asOf: string;
  entries: AsoiafAnswerCredentialBrokerStateEntry[];
  stateAuthority: "projection-only";
}

export interface AsoiafAnswerCredentialBrokerStatus {
  format: "axm-asoiaf-answer-credential-broker-status/1";
  paths: AsoiafAnswerCredentialBrokerPaths;
  policies: AsoiafAnswerCredentialBrokerPolicy[];
  bindings: AsoiafAnswerCredentialBrokerBinding[];
  invocations: AsoiafAnswerCredentialBrokerInvocation[];
  proofs: AsoiafAnswerCredentialPossessionProof[];
  transportResults: AsoiafAnswerCredentialTransportResult[];
  state: AsoiafAnswerCredentialBrokerState | null;
}

export interface AsoiafAnswerCredentialBrokerFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

const MAX_INVOCATION_LIFETIME = 60 * 60 * 1000;
const MAX_PROOF_AGE = 24 * 60 * 60 * 1000;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

function finding(
  code: string,
  severity: AsoiafAnswerCredentialBrokerFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafAnswerCredentialBrokerFinding {
  return { code, severity, subjectId, detail };
}

function sortedFindings(
  values: readonly AsoiafAnswerCredentialBrokerFinding[],
): AsoiafAnswerCredentialBrokerFinding[] {
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
  if (normalized.length < 3 || normalized.length > 512) {
    throw new Error(`${label} must contain 3 through 512 characters`);
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

function requirePositiveInteger(
  value: number,
  label: string,
  maximum: number,
): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} must be an integer from 1 through ${maximum}`);
  }
  return value;
}

function requireOperation(value: string): AsoiafAnswerCredentialBrokerOperation {
  if (value !== "prove-possession" && value !== "mutual-tls-request") {
    throw new Error(`credential broker operation ${value} is invalid`);
  }
  return value;
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
    throw new Error(`credential broker provider class ${value} is invalid`);
  }
  return value as AsoiafAnswerCredentialProviderClass;
}

function requireLocalEndpoint(value: string): string {
  const normalized = value.trim();
  if (!/^(?:npipe|unix|loopback-https):\/\/.+/.test(normalized)) {
    throw new Error("credential broker endpoint must use npipe://, unix://, or loopback-https:// custody");
  }
  if (/\s/.test(normalized)) {
    throw new Error("credential broker endpoint cannot contain whitespace");
  }
  return normalized;
}

function requireHttpsTarget(value: string): string {
  const target = new URL(value);
  if (
    target.protocol !== "https:"
    || target.username
    || target.password
    || target.hash
  ) {
    throw new Error("credential broker target must be credential-free HTTPS without a fragment");
  }
  return target.toString();
}

function sortedUnique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values.map((entry) => entry.trim()).filter(Boolean) as T[])]
    .sort((left, right) => left.localeCompare(right));
}

function bytesDigest(value: Buffer): `sha256:${string}` {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function publicKeyObject(spkiBase64: string): crypto.KeyObject {
  return crypto.createPublicKey({
    key: Buffer.from(spkiBase64, "base64"),
    format: "der",
    type: "spki",
  });
}

function expectedSignatureAlgorithm(
  key: crypto.KeyObject,
): AsoiafAnswerTransportProofAlgorithm {
  if (key.asymmetricKeyType === "ed25519") return "ed25519";
  if (key.asymmetricKeyType === "ec") return "ecdsa-sha256";
  if (key.asymmetricKeyType === "rsa" || key.asymmetricKeyType === "rsa-pss") {
    return "rsa-sha256";
  }
  throw new Error(`unsupported credential broker key type ${key.asymmetricKeyType ?? "unknown"}`);
}

function signatureBuffer(value: string | Buffer): Buffer {
  if (Buffer.isBuffer(value)) return value;
  const normalized = value.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error("credential broker signature must be canonical base64");
  }
  return Buffer.from(normalized, "base64");
}

function verifySignature(input: {
  key: crypto.KeyObject;
  algorithm: AsoiafAnswerTransportProofAlgorithm;
  message: Buffer;
  signature: Buffer;
}): boolean {
  if (expectedSignatureAlgorithm(input.key) !== input.algorithm) return false;
  return crypto.verify(
    input.algorithm === "ed25519" ? null : "sha256",
    input.message,
    input.key,
    input.signature,
  );
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
      throw new Error(`credential broker immutable file collision at ${target}`);
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

export function asoiafAnswerCredentialBrokerPaths(
  root: string,
): AsoiafAnswerCredentialBrokerPaths {
  const absolute = path.resolve(root);
  const brokerRoot = path.join(absolute, "answer-credential-broker");
  return {
    root: absolute,
    brokerRoot,
    policies: path.join(brokerRoot, "policies"),
    bindings: path.join(brokerRoot, "bindings"),
    invocations: path.join(brokerRoot, "invocations"),
    proofs: path.join(brokerRoot, "proofs"),
    transportResults: path.join(brokerRoot, "transport-results"),
    state: path.join(brokerRoot, "BROKER-STATE.json"),
  };
}

function byId<T>(
  values: readonly T[],
  id: string,
  idOf: (entry: T) => string,
  label: string,
): T {
  const matches = values.filter((entry) => idOf(entry) === id);
  if (matches.length !== 1) throw new Error(`${label} ${id} is absent or duplicated`);
  return matches[0]!;
}

function policyCore(
  policy: AsoiafAnswerCredentialBrokerPolicy,
): Omit<AsoiafAnswerCredentialBrokerPolicy, "policyId" | "policyFingerprint"> {
  const { policyId: _id, policyFingerprint: _fingerprint, ...core } = policy;
  return core;
}

function bindingCore(
  binding: AsoiafAnswerCredentialBrokerBinding,
): Omit<AsoiafAnswerCredentialBrokerBinding, "bindingId" | "bindingFingerprint"> {
  const { bindingId: _id, bindingFingerprint: _fingerprint, ...core } = binding;
  return core;
}

function invocationCore(
  invocation: AsoiafAnswerCredentialBrokerInvocation,
): Omit<AsoiafAnswerCredentialBrokerInvocation, "invocationId" | "invocationFingerprint"> {
  const { invocationId: _id, invocationFingerprint: _fingerprint, ...core } = invocation;
  return core;
}

function proofCore(
  proof: AsoiafAnswerCredentialPossessionProof,
): Omit<AsoiafAnswerCredentialPossessionProof, "proofId" | "proofFingerprint"> {
  const { proofId: _id, proofFingerprint: _fingerprint, ...core } = proof;
  return core;
}

function resultCore(
  result: AsoiafAnswerCredentialTransportResult,
): Omit<AsoiafAnswerCredentialTransportResult, "resultId" | "resultFingerprint"> {
  const { resultId: _id, resultFingerprint: _fingerprint, ...core } = result;
  return core;
}

function stateCore(
  state: AsoiafAnswerCredentialBrokerState,
): Omit<AsoiafAnswerCredentialBrokerState, "stateId" | "stateFingerprint"> {
  const { stateId: _id, stateFingerprint: _fingerprint, ...core } = state;
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

function deploymentObjects(root: string, serviceId: string): {
  stateEntry: AsoiafAnswerCredentialDeploymentStateEntry;
  plan: AsoiafAnswerCredentialDeploymentPlan;
  activation: AsoiafAnswerCredentialActivation;
  device: AsoiafAnswerCredentialDevice;
  keyReference: AsoiafAnswerCredentialKeyReference;
  stateId: string;
  stateFingerprint: `sha256:${string}`;
  stateAsOf: string;
} {
  const deploymentErrors = verifyAsoiafAnswerCredentialDeploymentEstate(root)
    .filter((entry) => entry.severity === "error");
  if (deploymentErrors.length > 0) {
    throw new Error(
      `credential broker requires a valid deployment estate: ${deploymentErrors
        .map((entry) => `${entry.code}:${entry.subjectId}`)
        .join(", ")}`,
    );
  }
  const status = readAsoiafAnswerCredentialDeploymentStatus(root);
  if (!status.state) throw new Error("credential broker requires deployment state");
  const stateEntry = byId(
    status.state.entries,
    serviceId,
    (entry) => entry.serviceId,
    "active deployment service",
  );
  const plan = byId(status.plans, stateEntry.planId, (entry) => entry.planId, "deployment plan");
  const activation = byId(
    status.activations,
    stateEntry.activationId,
    (entry) => entry.activationId,
    "deployment activation",
  );
  const device = byId(status.devices, stateEntry.deviceId, (entry) => entry.deviceId, "deployment device");
  const keyReference = byId(
    status.keys,
    stateEntry.keyReferenceId,
    (entry) => entry.keyReferenceId,
    "deployment key reference",
  );
  if (
    plan.planFingerprint !== stateEntry.planFingerprint
    || activation.activationFingerprint !== stateEntry.activationFingerprint
    || device.deviceFingerprint !== plan.deviceFingerprint
    || keyReference.keyReferenceFingerprint !== stateEntry.keyReferenceFingerprint
    || activation.statement.planId !== plan.planId
    || plan.certificateFingerprint !== stateEntry.certificateFingerprint
  ) {
    throw new Error("credential broker active deployment projection is stale");
  }
  return {
    stateEntry,
    plan,
    activation,
    device,
    keyReference,
    stateId: status.state.stateId,
    stateFingerprint: status.state.stateFingerprint,
    stateAsOf: status.state.asOf,
  };
}

export function retainAsoiafAnswerCredentialBrokerPolicy(input: {
  root: string;
  brokerId: string;
  deviceId: string;
  serviceId: string;
  localEndpoint: string;
  allowedProviderClasses: AsoiafAnswerCredentialProviderClass[];
  allowedOperations: AsoiafAnswerCredentialBrokerOperation[];
  maxInvocationLifetimeMilliseconds: number;
  maxPossessionProofAgeMilliseconds: number;
  maxResponseBytes: number;
  createdAt: string;
  operatorId: string;
}): {
  policy: AsoiafAnswerCredentialBrokerPolicy;
  policyUri: string;
  replayed: boolean;
} {
  const active = deploymentObjects(input.root, input.serviceId);
  if (active.device.deviceId !== input.deviceId) {
    throw new Error("credential broker policy device differs from active deployment");
  }
  const allowedProviderClasses = sortedUnique(
    input.allowedProviderClasses.map(requireProviderClass),
  );
  if (
    allowedProviderClasses.length === 0
    || !allowedProviderClasses.includes(active.keyReference.providerClass)
  ) {
    throw new Error("credential broker policy must permit the active provider class");
  }
  const allowedOperations = sortedUnique(
    input.allowedOperations.map(requireOperation),
  );
  if (allowedOperations.length === 0) {
    throw new Error("credential broker policy requires at least one operation");
  }
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_BROKER_POLICY_FORMAT,
    brokerId: requireIdentity(input.brokerId, "credential broker identity"),
    deviceId: active.device.deviceId,
    deviceFingerprint: active.device.deviceFingerprint,
    serviceId: active.plan.serviceId,
    localEndpoint: requireLocalEndpoint(input.localEndpoint),
    allowedProviderClasses,
    allowedOperations,
    maxInvocationLifetimeMilliseconds: requirePositiveInteger(
      input.maxInvocationLifetimeMilliseconds,
      "maximum broker invocation lifetime",
      MAX_INVOCATION_LIFETIME,
    ),
    maxPossessionProofAgeMilliseconds: requirePositiveInteger(
      input.maxPossessionProofAgeMilliseconds,
      "maximum possession-proof age",
      MAX_PROOF_AGE,
    ),
    maxResponseBytes: requirePositiveInteger(
      input.maxResponseBytes,
      "maximum broker response bytes",
      MAX_RESPONSE_BYTES,
    ),
    deviceAgentPublicKeyFingerprint: active.device.deviceAgentPublicKeyFingerprint,
    createdAt: requireTime(input.createdAt, "credential broker policy time"),
    operatorId: requireIdentity(input.operatorId, "credential broker policy operator"),
    localEndpointOnly: true as const,
    privateKeyRetained: false as const,
    privateKeyPathRetained: false as const,
    rawProviderHandleRetained: false as const,
    providerSecretRetained: false as const,
    brokerAuthority: "policy-only" as const,
    ...NO_TASK_AUTHORITY,
  };
  if (Date.parse(core.createdAt) < Date.parse(active.activation.statement.activatedAt)) {
    throw new Error("credential broker policy predates the active credential deployment");
  }
  const policyFingerprint = sha256(core);
  const policy: AsoiafAnswerCredentialBrokerPolicy = {
    ...core,
    policyId: collectorContentId("asoiaf-answer-credential-broker-policy", {
      brokerId: core.brokerId,
      deviceId: core.deviceId,
      serviceId: core.serviceId,
      policyFingerprint,
    }),
    policyFingerprint,
  };
  const existing = readAsoiafAnswerCredentialBrokerStatus(input.root).policies
    .filter((entry) => entry.brokerId === policy.brokerId);
  if (
    existing.length > 0
    && !existing.some((entry) => entry.policyFingerprint === policy.policyFingerprint)
  ) {
    throw new Error("credential broker identity already has a different policy");
  }
  const target = digestPath(
    asoiafAnswerCredentialBrokerPaths(input.root).policies,
    policy.policyFingerprint,
  );
  const persisted = writeExact(target, policy);
  return {
    policy: persisted.value,
    policyUri: path.relative(path.resolve(input.root), target).split(path.sep).join("/"),
    replayed: persisted.replayed,
  };
}

function policyById(root: string, policyId: string): AsoiafAnswerCredentialBrokerPolicy {
  return byId(
    readAsoiafAnswerCredentialBrokerStatus(root).policies,
    policyId,
    (entry) => entry.policyId,
    "credential broker policy",
  );
}

function bindingById(root: string, bindingId: string): AsoiafAnswerCredentialBrokerBinding {
  return byId(
    readAsoiafAnswerCredentialBrokerStatus(root).bindings,
    bindingId,
    (entry) => entry.bindingId,
    "credential broker binding",
  );
}

function invocationById(root: string, invocationId: string): AsoiafAnswerCredentialBrokerInvocation {
  return byId(
    readAsoiafAnswerCredentialBrokerStatus(root).invocations,
    invocationId,
    (entry) => entry.invocationId,
    "credential broker invocation",
  );
}

function proofById(root: string, proofId: string): AsoiafAnswerCredentialPossessionProof {
  return byId(
    readAsoiafAnswerCredentialBrokerStatus(root).proofs,
    proofId,
    (entry) => entry.proofId,
    "credential possession proof",
  );
}

export function bindAsoiafAnswerCredentialBrokerDeployment(input: {
  root: string;
  policyId: string;
  boundAt: string;
  operatorId: string;
}): {
  binding: AsoiafAnswerCredentialBrokerBinding;
  bindingUri: string;
  replayed: boolean;
} {
  const policy = policyById(input.root, input.policyId);
  const active = deploymentObjects(input.root, policy.serviceId);
  if (
    active.device.deviceId !== policy.deviceId
    || active.device.deviceFingerprint !== policy.deviceFingerprint
    || active.device.deviceAgentPublicKeyFingerprint
      !== policy.deviceAgentPublicKeyFingerprint
    || !policy.allowedProviderClasses.includes(active.keyReference.providerClass)
  ) {
    throw new Error("credential broker policy differs from active deployment custody");
  }
  const boundAt = requireTime(input.boundAt, "credential broker binding time");
  if (
    Date.parse(boundAt) < Date.parse(policy.createdAt)
    || Date.parse(boundAt) < Date.parse(active.activation.statement.activatedAt)
    || Date.parse(boundAt) > Date.parse(active.plan.certificateValidUntil)
  ) {
    throw new Error("credential broker binding time is outside policy or certificate custody");
  }
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_BROKER_BINDING_FORMAT,
    policyId: policy.policyId,
    policyFingerprint: policy.policyFingerprint,
    deploymentStateId: active.stateId,
    deploymentStateFingerprint: active.stateFingerprint,
    deploymentStateAsOf: active.stateAsOf,
    deploymentStateOrigin: active.stateEntry.stateOrigin,
    planId: active.plan.planId,
    planFingerprint: active.plan.planFingerprint,
    activationId: active.activation.activationId,
    activationFingerprint: active.activation.activationFingerprint,
    deviceId: active.device.deviceId,
    deviceFingerprint: active.device.deviceFingerprint,
    deviceAgentId: active.device.deviceAgentId,
    deviceAgentPublicKeyFingerprint: active.device.deviceAgentPublicKeyFingerprint,
    keyReferenceId: active.keyReference.keyReferenceId,
    keyReferenceFingerprint: active.keyReference.keyReferenceFingerprint,
    providerClass: active.keyReference.providerClass,
    providerHandleDigest: active.keyReference.providerHandleDigest,
    publicKeyFingerprint: active.keyReference.publicKeyFingerprint,
    certificateFingerprint: active.plan.certificateFingerprint,
    issuerCertificateFingerprint: active.plan.issuerCertificateFingerprint,
    serviceId: active.plan.serviceId,
    principalId: active.plan.principalId,
    actorRole: active.plan.actorRole,
    certificateValidUntil: active.plan.certificateValidUntil,
    boundAt,
    operatorId: requireIdentity(input.operatorId, "credential broker binding operator"),
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    rawProviderHandleRetained: false as const,
    providerSecretRetained: false as const,
    bindingAuthority: "active-deployment-reference-only" as const,
    ...NO_TASK_AUTHORITY,
  };
  const bindingFingerprint = sha256(core);
  const binding: AsoiafAnswerCredentialBrokerBinding = {
    ...core,
    bindingId: collectorContentId("asoiaf-answer-credential-broker-binding", {
      policyId: core.policyId,
      planId: core.planId,
      activationId: core.activationId,
      bindingFingerprint,
    }),
    bindingFingerprint,
  };
  const existing = readAsoiafAnswerCredentialBrokerStatus(input.root).bindings
    .filter((entry) => entry.policyId === policy.policyId);
  if (
    existing.length > 0
    && !existing.some((entry) => entry.bindingFingerprint === binding.bindingFingerprint)
  ) {
    throw new Error("credential broker policy already has a different deployment binding");
  }
  const target = digestPath(
    asoiafAnswerCredentialBrokerPaths(input.root).bindings,
    binding.bindingFingerprint,
  );
  const persisted = writeExact(target, binding);
  const state = rebuildAsoiafAnswerCredentialBrokerState(input.root);
  writeJsonAtomic(asoiafAnswerCredentialBrokerPaths(input.root).state, state);
  return {
    binding: persisted.value,
    bindingUri: path.relative(path.resolve(input.root), target).split(path.sep).join("/"),
    replayed: persisted.replayed,
  };
}

function normalizeRequest(input: {
  root: string;
  operation: AsoiafAnswerCredentialBrokerOperation;
  request: AsoiafAnswerCredentialBrokerRequest;
  policy: AsoiafAnswerCredentialBrokerPolicy;
  binding: AsoiafAnswerCredentialBrokerBinding;
  createdAt: string;
}): AsoiafAnswerCredentialBrokerRequest {
  if (input.operation === "prove-possession") {
    if (input.request.kind !== "possession") {
      throw new Error("prove-possession invocation requires a possession request");
    }
    return {
      kind: "possession",
      challengeDigest: requireSha256(
        input.request.challengeDigest,
        "possession challenge digest",
      ),
      contextDigest: requireSha256(
        input.request.contextDigest,
        "possession context digest",
      ),
    };
  }
  if (input.request.kind !== "mutual-tls") {
    throw new Error("mutual-tls invocation requires a transport request");
  }
  const proof = proofById(input.root, input.request.possessionProofId);
  if (
    proof.proofFingerprint !== input.request.possessionProofFingerprint
    || proof.bindingId !== input.binding.bindingId
    || proof.bindingFingerprint !== input.binding.bindingFingerprint
    || Date.parse(input.createdAt) < Date.parse(proof.provedAt)
    || Date.parse(input.createdAt) - Date.parse(proof.provedAt)
      > input.policy.maxPossessionProofAgeMilliseconds
  ) {
    throw new Error("mutual-tls invocation possession proof is stale or belongs to different custody");
  }
  const maxResponseBytes = requirePositiveInteger(
    input.request.maxResponseBytes,
    "invocation response-byte ceiling",
    input.policy.maxResponseBytes,
  );
  return {
    kind: "mutual-tls",
    possessionProofId: proof.proofId,
    possessionProofFingerprint: proof.proofFingerprint,
    method: input.request.method === "GET" ? "GET" : input.request.method === "POST" ? "POST" : (() => {
      throw new Error(`credential broker HTTP method ${String(input.request.method)} is invalid`);
    })(),
    targetUrl: requireHttpsTarget(input.request.targetUrl),
    requestBodyDigest: requireSha256(input.request.requestBodyDigest, "request body digest"),
    requestBodyBytes: requirePositiveInteger(
      input.request.requestBodyBytes,
      "request body bytes",
      8 * 1024 * 1024,
    ),
    lowerIdempotencyKeyDigest: requireSha256(
      input.request.lowerIdempotencyKeyDigest,
      "lower idempotency-key digest",
    ),
    expectedServerCertificateFingerprint: requireSha256(
      input.request.expectedServerCertificateFingerprint,
      "expected server certificate fingerprint",
    ),
    expectedServerIssuerFingerprint: requireSha256(
      input.request.expectedServerIssuerFingerprint,
      "expected server issuer fingerprint",
    ),
    maxResponseBytes,
  };
}

export function retainAsoiafAnswerCredentialBrokerInvocation(input: {
  root: string;
  policyId: string;
  bindingId: string;
  operation: AsoiafAnswerCredentialBrokerOperation;
  idempotencyKey: string;
  request: AsoiafAnswerCredentialBrokerRequest;
  createdAt: string;
  expiresAt: string;
  operatorId: string;
}): {
  invocation: AsoiafAnswerCredentialBrokerInvocation;
  invocationUri: string;
  replayed: boolean;
} {
  const policy = policyById(input.root, input.policyId);
  const binding = bindingById(input.root, input.bindingId);
  const operation = requireOperation(input.operation);
  if (
    binding.policyId !== policy.policyId
    || binding.policyFingerprint !== policy.policyFingerprint
    || !policy.allowedOperations.includes(operation)
  ) {
    throw new Error("credential broker invocation differs from policy or binding custody");
  }
  const active = deploymentObjects(input.root, binding.serviceId);
  if (
    active.stateId !== binding.deploymentStateId
    || active.stateFingerprint !== binding.deploymentStateFingerprint
    || active.plan.planId !== binding.planId
    || active.activation.activationId !== binding.activationId
  ) {
    throw new Error("credential broker binding is no longer the active deployment projection");
  }
  const createdAt = requireTime(input.createdAt, "credential broker invocation time");
  const expiresAt = requireTime(input.expiresAt, "credential broker invocation expiry");
  if (
    Date.parse(createdAt) < Date.parse(binding.boundAt)
    || Date.parse(createdAt) > Date.parse(binding.certificateValidUntil)
    || Date.parse(expiresAt) <= Date.parse(createdAt)
    || Date.parse(expiresAt) - Date.parse(createdAt)
      > policy.maxInvocationLifetimeMilliseconds
    || Date.parse(expiresAt) > Date.parse(binding.certificateValidUntil)
  ) {
    throw new Error("credential broker invocation lifetime is outside binding or certificate custody");
  }
  const idempotencyKey = requireIdentity(input.idempotencyKey, "credential broker idempotency key");
  const idempotencyKeyDigest = sha256(idempotencyKey);
  const request = normalizeRequest({
    root: input.root,
    operation,
    request: input.request,
    policy,
    binding,
    createdAt,
  });
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_BROKER_INVOCATION_FORMAT,
    policyId: policy.policyId,
    policyFingerprint: policy.policyFingerprint,
    bindingId: binding.bindingId,
    bindingFingerprint: binding.bindingFingerprint,
    deploymentStateId: binding.deploymentStateId,
    deploymentStateFingerprint: binding.deploymentStateFingerprint,
    serviceId: binding.serviceId,
    deviceId: binding.deviceId,
    keyReferenceId: binding.keyReferenceId,
    providerClass: binding.providerClass,
    providerHandleDigest: binding.providerHandleDigest,
    certificateFingerprint: binding.certificateFingerprint,
    publicKeyFingerprint: binding.publicKeyFingerprint,
    localEndpoint: policy.localEndpoint,
    operation,
    idempotencyKeyDigest,
    request,
    createdAt,
    expiresAt,
    operatorId: requireIdentity(input.operatorId, "credential broker invocation operator"),
    privateKeyRetained: false as const,
    privateKeyPathRetained: false as const,
    rawProviderHandleRetained: false as const,
    providerSecretRetained: false as const,
    invocationAuthority: "provider-request-only" as const,
    ...NO_TASK_AUTHORITY,
  };
  const invocationFingerprint = sha256(core);
  const invocation: AsoiafAnswerCredentialBrokerInvocation = {
    ...core,
    invocationId: collectorContentId("asoiaf-answer-credential-broker-invocation", {
      bindingId: core.bindingId,
      operation: core.operation,
      idempotencyKeyDigest: core.idempotencyKeyDigest,
      invocationFingerprint,
    }),
    invocationFingerprint,
  };
  const existing = readAsoiafAnswerCredentialBrokerStatus(input.root).invocations
    .filter((entry) => entry.idempotencyKeyDigest === idempotencyKeyDigest);
  if (
    existing.length > 0
    && !existing.some((entry) => entry.invocationFingerprint === invocation.invocationFingerprint)
  ) {
    throw new Error("credential broker idempotency key was reused with different custody");
  }
  const target = digestPath(
    asoiafAnswerCredentialBrokerPaths(input.root).invocations,
    invocation.invocationFingerprint,
  );
  const persisted = writeExact(target, invocation);
  return {
    invocation: persisted.value,
    invocationUri: path.relative(path.resolve(input.root), target).split(path.sep).join("/"),
    replayed: persisted.replayed,
  };
}

export function serializeAsoiafAnswerCredentialBrokerInvocation(
  invocation: AsoiafAnswerCredentialBrokerInvocation,
): Buffer {
  return stableBytes(invocation);
}

export function admitAsoiafAnswerCredentialPossessionProof(input: {
  root: string;
  invocationId: string;
  signatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  signature: string | Buffer;
  provedAt: string;
  operatorId: string;
}): {
  proof: AsoiafAnswerCredentialPossessionProof;
  proofUri: string;
  replayed: boolean;
  state: AsoiafAnswerCredentialBrokerState;
} {
  const invocation = invocationById(input.root, input.invocationId);
  if (invocation.operation !== "prove-possession" || invocation.request.kind !== "possession") {
    throw new Error("credential possession proof requires a prove-possession invocation");
  }
  const binding = bindingById(input.root, invocation.bindingId);
  const deployment = readAsoiafAnswerCredentialDeploymentStatus(input.root);
  const keyReference = byId(
    deployment.keys,
    binding.keyReferenceId,
    (entry) => entry.keyReferenceId,
    "deployment key reference",
  );
  const signature = signatureBuffer(input.signature);
  if (!verifySignature({
    key: publicKeyObject(keyReference.publicKeySpkiBase64),
    algorithm: input.signatureAlgorithm,
    message: serializeAsoiafAnswerCredentialBrokerInvocation(invocation),
    signature,
  })) {
    throw new Error("credential possession signature is invalid");
  }
  const provedAt = requireTime(input.provedAt, "credential possession proof time");
  if (
    Date.parse(provedAt) < Date.parse(invocation.createdAt)
    || Date.parse(provedAt) > Date.parse(invocation.expiresAt)
  ) {
    throw new Error("credential possession proof time is outside the invocation");
  }
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_POSSESSION_PROOF_FORMAT,
    invocationId: invocation.invocationId,
    invocationFingerprint: invocation.invocationFingerprint,
    policyId: invocation.policyId,
    policyFingerprint: invocation.policyFingerprint,
    bindingId: binding.bindingId,
    bindingFingerprint: binding.bindingFingerprint,
    activationId: binding.activationId,
    activationFingerprint: binding.activationFingerprint,
    keyReferenceId: binding.keyReferenceId,
    keyReferenceFingerprint: binding.keyReferenceFingerprint,
    certificateFingerprint: binding.certificateFingerprint,
    publicKeyFingerprint: binding.publicKeyFingerprint,
    challengeDigest: invocation.request.challengeDigest,
    contextDigest: invocation.request.contextDigest,
    signatureAlgorithm: input.signatureAlgorithm,
    signatureBase64: signature.toString("base64"),
    signatureDigest: bytesDigest(signature),
    signatureVerified: true as const,
    provedAt,
    operatorId: requireIdentity(input.operatorId, "credential possession proof operator"),
    privateKeyRetained: false as const,
    rawProviderHandleRetained: false as const,
    proofAuthority: "possession-proof-only" as const,
    ...NO_TASK_AUTHORITY,
  };
  const proofFingerprint = sha256(core);
  const proof: AsoiafAnswerCredentialPossessionProof = {
    ...core,
    proofId: collectorContentId("asoiaf-answer-credential-possession-proof", {
      invocationId: core.invocationId,
      certificateFingerprint: core.certificateFingerprint,
      proofFingerprint,
    }),
    proofFingerprint,
  };
  const existing = readAsoiafAnswerCredentialBrokerStatus(input.root).proofs
    .filter((entry) => entry.invocationId === invocation.invocationId);
  if (
    existing.length > 0
    && !existing.some((entry) => entry.proofFingerprint === proof.proofFingerprint)
  ) {
    throw new Error("credential possession invocation already has a different proof");
  }
  const target = digestPath(
    asoiafAnswerCredentialBrokerPaths(input.root).proofs,
    proof.proofFingerprint,
  );
  const persisted = writeExact(target, proof);
  const state = rebuildAsoiafAnswerCredentialBrokerState(input.root);
  writeJsonAtomic(asoiafAnswerCredentialBrokerPaths(input.root).state, state);
  return {
    proof: persisted.value,
    proofUri: path.relative(path.resolve(input.root), target).split(path.sep).join("/"),
    replayed: persisted.replayed,
    state,
  };
}

export function buildAsoiafAnswerCredentialTransportResultStatement(input: {
  root: string;
  invocationId: string;
  lowerRequestId: string;
  lowerRequestFingerprint: string;
  lowerResponseId: string;
  lowerResponseFingerprint: string;
  observedServerCertificateFingerprint: string;
  observedServerIssuerFingerprint: string;
  httpStatus: number;
  responseBytes: number;
  responseDigest: string;
  providerReceiptDigest: string;
  startedAt: string;
  completedAt: string;
}): AsoiafAnswerCredentialTransportResultStatement {
  const invocation = invocationById(input.root, input.invocationId);
  if (invocation.operation !== "mutual-tls-request" || invocation.request.kind !== "mutual-tls") {
    throw new Error("credential transport result requires a mutual-tls invocation");
  }
  const proof = proofById(input.root, invocation.request.possessionProofId);
  const binding = bindingById(input.root, invocation.bindingId);
  const deployment = readAsoiafAnswerCredentialDeploymentStatus(input.root);
  const device = byId(
    deployment.devices,
    binding.deviceId,
    (entry) => entry.deviceId,
    "deployment device",
  );
  const startedAt = requireTime(input.startedAt, "credential transport start time");
  const completedAt = requireTime(input.completedAt, "credential transport completion time");
  if (
    Date.parse(startedAt) < Date.parse(invocation.createdAt)
    || Date.parse(completedAt) < Date.parse(startedAt)
    || Date.parse(completedAt) > Date.parse(invocation.expiresAt)
  ) {
    throw new Error("credential transport result time is outside the invocation");
  }
  const observedServerCertificateFingerprint = requireSha256(
    input.observedServerCertificateFingerprint,
    "observed server certificate fingerprint",
  );
  const observedServerIssuerFingerprint = requireSha256(
    input.observedServerIssuerFingerprint,
    "observed server issuer fingerprint",
  );
  if (
    observedServerCertificateFingerprint
      !== invocation.request.expectedServerCertificateFingerprint
    || observedServerIssuerFingerprint
      !== invocation.request.expectedServerIssuerFingerprint
  ) {
    throw new Error("credential transport observed server identity differs from invocation pins");
  }
  const responseBytes = requirePositiveInteger(
    input.responseBytes,
    "credential transport response bytes",
    invocation.request.maxResponseBytes,
  );
  if (!Number.isInteger(input.httpStatus) || input.httpStatus < 100 || input.httpStatus > 599) {
    throw new Error("credential transport HTTP status is invalid");
  }
  return {
    format: "axm-asoiaf-answer-credential-transport-result-statement/1",
    invocationId: invocation.invocationId,
    invocationFingerprint: invocation.invocationFingerprint,
    possessionProofId: proof.proofId,
    possessionProofFingerprint: proof.proofFingerprint,
    bindingId: binding.bindingId,
    bindingFingerprint: binding.bindingFingerprint,
    deviceId: device.deviceId,
    deviceFingerprint: device.deviceFingerprint,
    deviceAgentId: device.deviceAgentId,
    keyReferenceId: binding.keyReferenceId,
    keyReferenceFingerprint: binding.keyReferenceFingerprint,
    providerClass: binding.providerClass,
    providerHandleDigest: binding.providerHandleDigest,
    certificateFingerprint: binding.certificateFingerprint,
    targetUrl: invocation.request.targetUrl,
    method: invocation.request.method,
    lowerIdempotencyKeyDigest: invocation.request.lowerIdempotencyKeyDigest,
    lowerRequestId: requireIdentity(input.lowerRequestId, "lower transport request identity"),
    lowerRequestFingerprint: requireSha256(
      input.lowerRequestFingerprint,
      "lower transport request fingerprint",
    ),
    lowerResponseId: requireIdentity(input.lowerResponseId, "lower transport response identity"),
    lowerResponseFingerprint: requireSha256(
      input.lowerResponseFingerprint,
      "lower transport response fingerprint",
    ),
    observedServerCertificateFingerprint,
    observedServerIssuerFingerprint,
    httpStatus: input.httpStatus,
    responseBytes,
    responseDigest: requireSha256(input.responseDigest, "credential transport response digest"),
    providerReceiptDigest: requireSha256(
      input.providerReceiptDigest,
      "credential provider receipt digest",
    ),
    startedAt,
    completedAt,
    networkAttempted: true,
    rawResponseRetained: false,
    certificateRetained: false,
    privateKeyRetained: false,
    rawProviderHandleRetained: false,
    providerSecretRetained: false,
  };
}

export function serializeAsoiafAnswerCredentialTransportResultStatement(
  statement: AsoiafAnswerCredentialTransportResultStatement,
): Buffer {
  return stableBytes(statement);
}

export function admitAsoiafAnswerCredentialTransportResult(input: {
  root: string;
  invocationId: string;
  lowerRequestId: string;
  lowerRequestFingerprint: string;
  lowerResponseId: string;
  lowerResponseFingerprint: string;
  observedServerCertificateFingerprint: string;
  observedServerIssuerFingerprint: string;
  httpStatus: number;
  responseBytes: number;
  responseDigest: string;
  providerReceiptDigest: string;
  startedAt: string;
  completedAt: string;
  deviceAgentSignatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  deviceAgentSignature: string | Buffer;
  operatorId: string;
}): {
  result: AsoiafAnswerCredentialTransportResult;
  resultUri: string;
  replayed: boolean;
  state: AsoiafAnswerCredentialBrokerState;
} {
  const statement = buildAsoiafAnswerCredentialTransportResultStatement(input);
  const deployment = readAsoiafAnswerCredentialDeploymentStatus(input.root);
  const device = byId(
    deployment.devices,
    statement.deviceId,
    (entry) => entry.deviceId,
    "deployment device",
  );
  const signature = signatureBuffer(input.deviceAgentSignature);
  if (!verifySignature({
    key: publicKeyObject(device.deviceAgentPublicKeySpkiBase64),
    algorithm: input.deviceAgentSignatureAlgorithm,
    message: serializeAsoiafAnswerCredentialTransportResultStatement(statement),
    signature,
  })) {
    throw new Error("credential transport device-agent signature is invalid");
  }
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_TRANSPORT_RESULT_FORMAT,
    statement,
    deviceAgentSignatureAlgorithm: input.deviceAgentSignatureAlgorithm,
    deviceAgentSignatureBase64: signature.toString("base64"),
    deviceAgentSignatureDigest: bytesDigest(signature),
    deviceAgentSignatureVerified: true as const,
    operatorId: requireIdentity(input.operatorId, "credential transport result operator"),
    resultAuthority: "attested-transport-reference-only" as const,
    ...NO_TASK_AUTHORITY,
  };
  const resultFingerprint = sha256(core);
  const result: AsoiafAnswerCredentialTransportResult = {
    ...core,
    resultId: collectorContentId("asoiaf-answer-credential-transport-result", {
      invocationId: statement.invocationId,
      lowerResponseId: statement.lowerResponseId,
      resultFingerprint,
    }),
    resultFingerprint,
  };
  const existing = readAsoiafAnswerCredentialBrokerStatus(input.root).transportResults
    .filter((entry) => entry.statement.invocationId === statement.invocationId);
  if (
    existing.length > 0
    && !existing.some((entry) => entry.resultFingerprint === result.resultFingerprint)
  ) {
    throw new Error("credential transport invocation already has a different result");
  }
  const target = digestPath(
    asoiafAnswerCredentialBrokerPaths(input.root).transportResults,
    result.resultFingerprint,
  );
  const persisted = writeExact(target, result);
  const state = rebuildAsoiafAnswerCredentialBrokerState(input.root);
  writeJsonAtomic(asoiafAnswerCredentialBrokerPaths(input.root).state, state);
  return {
    result: persisted.value,
    resultUri: path.relative(path.resolve(input.root), target).split(path.sep).join("/"),
    replayed: persisted.replayed,
    state,
  };
}

export function readAsoiafAnswerCredentialBrokerStatus(
  root: string,
): AsoiafAnswerCredentialBrokerStatus {
  const paths = asoiafAnswerCredentialBrokerPaths(root);
  return {
    format: "axm-asoiaf-answer-credential-broker-status/1",
    paths,
    policies: listJson<AsoiafAnswerCredentialBrokerPolicy>(paths.policies),
    bindings: listJson<AsoiafAnswerCredentialBrokerBinding>(paths.bindings),
    invocations: listJson<AsoiafAnswerCredentialBrokerInvocation>(paths.invocations),
    proofs: listJson<AsoiafAnswerCredentialPossessionProof>(paths.proofs),
    transportResults: listJson<AsoiafAnswerCredentialTransportResult>(paths.transportResults),
    state: fs.existsSync(paths.state)
      ? readJson<AsoiafAnswerCredentialBrokerState>(paths.state)
      : null,
  };
}

export function rebuildAsoiafAnswerCredentialBrokerState(
  root: string,
): AsoiafAnswerCredentialBrokerState {
  const status = readAsoiafAnswerCredentialBrokerStatus(root);
  const invocations = new Map(
    status.invocations.map((entry) => [entry.invocationId, entry] as const),
  );
  const proofsByBinding = new Map<string, AsoiafAnswerCredentialPossessionProof[]>();
  const resultsByBinding = new Map<string, AsoiafAnswerCredentialTransportResult[]>();
  for (const proof of status.proofs) {
    const values = proofsByBinding.get(proof.bindingId) ?? [];
    values.push(proof);
    proofsByBinding.set(proof.bindingId, values);
  }
  for (const result of status.transportResults) {
    const invocation = invocations.get(result.statement.invocationId);
    if (!invocation) continue;
    const values = resultsByBinding.get(invocation.bindingId) ?? [];
    values.push(result);
    resultsByBinding.set(invocation.bindingId, values);
  }
  const entries = status.bindings.map((binding): AsoiafAnswerCredentialBrokerStateEntry => {
    const proofs = (proofsByBinding.get(binding.bindingId) ?? []).sort((left, right) =>
      left.provedAt.localeCompare(right.provedAt)
      || left.proofId.localeCompare(right.proofId));
    const results = (resultsByBinding.get(binding.bindingId) ?? []).sort((left, right) =>
      left.statement.completedAt.localeCompare(right.statement.completedAt)
      || left.resultId.localeCompare(right.resultId));
    const latestProof = proofs.at(-1) ?? null;
    const latestResult = results.at(-1) ?? null;
    const updatedAt = [
      binding.boundAt,
      latestProof?.provedAt,
      latestResult?.statement.completedAt,
    ].filter((entry): entry is string => Boolean(entry)).sort().at(-1)!;
    return {
      bindingId: binding.bindingId,
      bindingFingerprint: binding.bindingFingerprint,
      serviceId: binding.serviceId,
      deviceId: binding.deviceId,
      planId: binding.planId,
      activationId: binding.activationId,
      certificateFingerprint: binding.certificateFingerprint,
      latestProofId: latestProof?.proofId ?? null,
      latestProofFingerprint: latestProof?.proofFingerprint ?? null,
      latestTransportResultId: latestResult?.resultId ?? null,
      latestTransportResultFingerprint: latestResult?.resultFingerprint ?? null,
      updatedAt,
    };
  }).sort((left, right) => left.bindingId.localeCompare(right.bindingId));
  const asOf = entries.map((entry) => entry.updatedAt).sort().at(-1)
    ?? "1970-01-01T00:00:00.000Z";
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_BROKER_STATE_FORMAT,
    asOf,
    entries,
    stateAuthority: "projection-only" as const,
    ...NO_TASK_AUTHORITY,
  };
  const stateFingerprint = sha256(core);
  return {
    ...core,
    stateId: collectorContentId("asoiaf-answer-credential-broker-state", {
      asOf,
      entries,
      stateFingerprint,
    }),
    stateFingerprint,
  };
}

function secretFindings(root: string): AsoiafAnswerCredentialBrokerFinding[] {
  const findings: AsoiafAnswerCredentialBrokerFinding[] = [];
  const paths = asoiafAnswerCredentialBrokerPaths(root);
  if (!fs.existsSync(paths.brokerRoot)) return findings;
  const forbiddenName = /(?:^|[._-])(private[-_]?key|secret|password|passwd|pin|token|session|pkcs12|p12|pfx|csr|certificate|cert|pem|key)(?:[._-]|$)/i;
  const forbiddenContent = /-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----|-----BEGIN CERTIFICATE(?: REQUEST)?-----|pkcs11:[^\s"']+|provider(?:Pin|Password|Token|Secret|Session)\s*[":=]/i;
  const stack = [paths.brokerRoot];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      const subject = path.relative(path.resolve(root), target).split(path.sep).join("/");
      if (entry.isDirectory()) {
        stack.push(target);
        continue;
      }
      if (forbiddenName.test(entry.name)) {
        findings.push(finding(
          "broker-secret-path",
          "error",
          subject,
          "credential broker estate contains a secret-bearing filename",
        ));
      }
      const bytes = fs.readFileSync(target);
      if (bytes.length <= 8 * 1024 * 1024 && forbiddenContent.test(bytes.toString("utf8"))) {
        findings.push(finding(
          "broker-secret-content",
          "error",
          subject,
          "credential broker estate contains forbidden certificate, key, or provider-secret material",
        ));
      }
    }
  }
  return findings;
}

export function verifyAsoiafAnswerCredentialBrokerEstate(
  root: string,
): AsoiafAnswerCredentialBrokerFinding[] {
  const findings: AsoiafAnswerCredentialBrokerFinding[] = [];
  for (const entry of verifyAsoiafAnswerCredentialDeploymentEstate(root)) {
    findings.push(finding(`deployment:${entry.code}`, entry.severity, entry.subjectId, entry.detail));
  }
  let status: AsoiafAnswerCredentialBrokerStatus;
  try {
    status = readAsoiafAnswerCredentialBrokerStatus(root);
  } catch (error) {
    return [finding(
      "broker-estate-read",
      "error",
      path.resolve(root),
      error instanceof Error ? error.message : String(error),
    )];
  }
  const deployment = readAsoiafAnswerCredentialDeploymentStatus(root);
  const policyIds = new Set<string>();
  const bindingIds = new Set<string>();
  const invocationIds = new Set<string>();
  const proofIds = new Set<string>();
  const resultIds = new Set<string>();

  for (const policy of status.policies) {
    try {
      if (policyIds.has(policy.policyId)) throw new Error("credential broker policy identity is duplicated");
      policyIds.add(policy.policyId);
      validateAuthority(policy, "credential broker policy");
      requireLocalEndpoint(policy.localEndpoint);
      policy.allowedProviderClasses.forEach(requireProviderClass);
      policy.allowedOperations.forEach(requireOperation);
      if (policy.policyFingerprint !== sha256(policyCore(policy))) {
        throw new Error("credential broker policy fingerprint is stale");
      }
      const device = byId(deployment.devices, policy.deviceId, (entry) => entry.deviceId, "deployment device");
      if (
        device.deviceFingerprint !== policy.deviceFingerprint
        || device.deviceAgentPublicKeyFingerprint !== policy.deviceAgentPublicKeyFingerprint
      ) {
        throw new Error("credential broker policy differs from deployment device custody");
      }
    } catch (error) {
      findings.push(finding("broker-policy-invalid", "error", policy.policyId, error instanceof Error ? error.message : String(error)));
    }
  }

  for (const binding of status.bindings) {
    try {
      if (bindingIds.has(binding.bindingId)) throw new Error("credential broker binding identity is duplicated");
      bindingIds.add(binding.bindingId);
      validateAuthority(binding, "credential broker binding");
      if (binding.bindingFingerprint !== sha256(bindingCore(binding))) {
        throw new Error("credential broker binding fingerprint is stale");
      }
      const policy = byId(status.policies, binding.policyId, (entry) => entry.policyId, "credential broker policy");
      const plan = byId(deployment.plans, binding.planId, (entry) => entry.planId, "deployment plan");
      const activation = byId(deployment.activations, binding.activationId, (entry) => entry.activationId, "deployment activation");
      const keyReference = byId(deployment.keys, binding.keyReferenceId, (entry) => entry.keyReferenceId, "deployment key reference");
      if (
        policy.policyFingerprint !== binding.policyFingerprint
        || plan.planFingerprint !== binding.planFingerprint
        || activation.activationFingerprint !== binding.activationFingerprint
        || keyReference.keyReferenceFingerprint !== binding.keyReferenceFingerprint
        || plan.certificateFingerprint !== binding.certificateFingerprint
        || keyReference.publicKeyFingerprint !== binding.publicKeyFingerprint
      ) {
        throw new Error("credential broker binding differs from policy or deployment custody");
      }
    } catch (error) {
      findings.push(finding("broker-binding-invalid", "error", binding.bindingId, error instanceof Error ? error.message : String(error)));
    }
  }

  for (const invocation of status.invocations) {
    try {
      if (invocationIds.has(invocation.invocationId)) throw new Error("credential broker invocation identity is duplicated");
      invocationIds.add(invocation.invocationId);
      validateAuthority(invocation, "credential broker invocation");
      if (invocation.invocationFingerprint !== sha256(invocationCore(invocation))) {
        throw new Error("credential broker invocation fingerprint is stale");
      }
      const policy = byId(status.policies, invocation.policyId, (entry) => entry.policyId, "credential broker policy");
      const binding = byId(status.bindings, invocation.bindingId, (entry) => entry.bindingId, "credential broker binding");
      if (
        policy.policyFingerprint !== invocation.policyFingerprint
        || binding.bindingFingerprint !== invocation.bindingFingerprint
        || binding.deploymentStateId !== invocation.deploymentStateId
        || binding.deploymentStateFingerprint !== invocation.deploymentStateFingerprint
      ) {
        throw new Error("credential broker invocation differs from policy or binding custody");
      }
      const duplicates = status.invocations.filter(
        (entry) => entry.idempotencyKeyDigest === invocation.idempotencyKeyDigest,
      );
      if (duplicates.length !== 1) {
        throw new Error("credential broker idempotency-key digest is duplicated");
      }
      if (invocation.request.kind === "mutual-tls") {
        const proof = byId(status.proofs, invocation.request.possessionProofId, (entry) => entry.proofId, "credential possession proof");
        if (proof.proofFingerprint !== invocation.request.possessionProofFingerprint) {
          throw new Error("credential broker invocation possession proof fingerprint is stale");
        }
      }
    } catch (error) {
      findings.push(finding("broker-invocation-invalid", "error", invocation.invocationId, error instanceof Error ? error.message : String(error)));
    }
  }

  for (const proof of status.proofs) {
    try {
      if (proofIds.has(proof.proofId)) throw new Error("credential possession proof identity is duplicated");
      proofIds.add(proof.proofId);
      validateAuthority(proof, "credential possession proof");
      if (proof.proofFingerprint !== sha256(proofCore(proof))) {
        throw new Error("credential possession proof fingerprint is stale");
      }
      const invocation = byId(status.invocations, proof.invocationId, (entry) => entry.invocationId, "credential broker invocation");
      const binding = byId(status.bindings, proof.bindingId, (entry) => entry.bindingId, "credential broker binding");
      const keyReference = byId(deployment.keys, proof.keyReferenceId, (entry) => entry.keyReferenceId, "deployment key reference");
      if (
        invocation.invocationFingerprint !== proof.invocationFingerprint
        || binding.bindingFingerprint !== proof.bindingFingerprint
        || invocation.operation !== "prove-possession"
        || invocation.request.kind !== "possession"
      ) {
        throw new Error("credential possession proof differs from invocation or binding custody");
      }
      if (!verifySignature({
        key: publicKeyObject(keyReference.publicKeySpkiBase64),
        algorithm: proof.signatureAlgorithm,
        message: serializeAsoiafAnswerCredentialBrokerInvocation(invocation),
        signature: Buffer.from(proof.signatureBase64, "base64"),
      })) {
        throw new Error("credential possession retained signature is invalid");
      }
    } catch (error) {
      findings.push(finding("broker-proof-invalid", "error", proof.proofId, error instanceof Error ? error.message : String(error)));
    }
  }

  for (const result of status.transportResults) {
    try {
      if (resultIds.has(result.resultId)) throw new Error("credential transport result identity is duplicated");
      resultIds.add(result.resultId);
      validateAuthority(result, "credential transport result");
      if (result.resultFingerprint !== sha256(resultCore(result))) {
        throw new Error("credential transport result fingerprint is stale");
      }
      const invocation = byId(status.invocations, result.statement.invocationId, (entry) => entry.invocationId, "credential broker invocation");
      const device = byId(deployment.devices, result.statement.deviceId, (entry) => entry.deviceId, "deployment device");
      const expected = buildAsoiafAnswerCredentialTransportResultStatement({
        root,
        invocationId: invocation.invocationId,
        lowerRequestId: result.statement.lowerRequestId,
        lowerRequestFingerprint: result.statement.lowerRequestFingerprint,
        lowerResponseId: result.statement.lowerResponseId,
        lowerResponseFingerprint: result.statement.lowerResponseFingerprint,
        observedServerCertificateFingerprint:
          result.statement.observedServerCertificateFingerprint,
        observedServerIssuerFingerprint:
          result.statement.observedServerIssuerFingerprint,
        httpStatus: result.statement.httpStatus,
        responseBytes: result.statement.responseBytes,
        responseDigest: result.statement.responseDigest,
        providerReceiptDigest: result.statement.providerReceiptDigest,
        startedAt: result.statement.startedAt,
        completedAt: result.statement.completedAt,
      });
      if (stableJson(expected) !== stableJson(result.statement)) {
        throw new Error("credential transport result statement differs from retained invocation custody");
      }
      if (!verifySignature({
        key: publicKeyObject(device.deviceAgentPublicKeySpkiBase64),
        algorithm: result.deviceAgentSignatureAlgorithm,
        message: serializeAsoiafAnswerCredentialTransportResultStatement(result.statement),
        signature: Buffer.from(result.deviceAgentSignatureBase64, "base64"),
      })) {
        throw new Error("credential transport retained device-agent signature is invalid");
      }
      const duplicates = status.transportResults.filter(
        (entry) => entry.statement.invocationId === result.statement.invocationId,
      );
      if (duplicates.length !== 1) {
        throw new Error("credential transport invocation has duplicate terminal results");
      }
    } catch (error) {
      findings.push(finding("broker-transport-result-invalid", "error", result.resultId, error instanceof Error ? error.message : String(error)));
    }
  }

  const expectedState = rebuildAsoiafAnswerCredentialBrokerState(root);
  if (status.bindings.length > 0) {
    if (!status.state) {
      findings.push(finding("broker-state-missing", "error", status.paths.state, "credential broker state is absent"));
    } else {
      if (status.state.stateFingerprint !== sha256(stateCore(status.state))) {
        findings.push(finding("broker-state-fingerprint", "error", status.state.stateId, "credential broker state fingerprint is stale"));
      }
      if (stableJson(status.state) !== stableJson(expectedState)) {
        findings.push(finding("broker-state-projection", "error", status.state.stateId, "credential broker state differs from append-only records"));
      }
    }
  }

  for (const invocation of status.invocations) {
    if (
      invocation.operation === "prove-possession"
      && !status.proofs.some((entry) => entry.invocationId === invocation.invocationId)
    ) {
      findings.push(finding("broker-invocation-pending-proof", "notice", invocation.invocationId, "credential broker possession invocation has no proof"));
    }
    if (
      invocation.operation === "mutual-tls-request"
      && !status.transportResults.some(
        (entry) => entry.statement.invocationId === invocation.invocationId,
      )
    ) {
      findings.push(finding("broker-invocation-pending-transport", "notice", invocation.invocationId, "credential broker mutual-TLS invocation has no transport result"));
    }
  }

  for (const [directory, code] of [
    [status.paths.policies, "broker-policy-filename"],
    [status.paths.bindings, "broker-binding-filename"],
    [status.paths.invocations, "broker-invocation-filename"],
    [status.paths.proofs, "broker-proof-filename"],
    [status.paths.transportResults, "broker-result-filename"],
  ] as const) {
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory).sort()) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) {
        findings.push(finding(code, "error", name, "credential broker filename is not a SHA-256 digest"));
      }
    }
  }

  findings.push(...secretFindings(root));
  return sortedFindings(findings);
}
