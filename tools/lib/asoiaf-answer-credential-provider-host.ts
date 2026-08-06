import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  collectorContentId,
  sha256,
} from "./asoiaf-external-estate.js";
import {
  buildAsoiafAnswerCredentialTransportResultStatement,
  readAsoiafAnswerCredentialBrokerStatus,
  serializeAsoiafAnswerCredentialBrokerInvocation,
  serializeAsoiafAnswerCredentialTransportResultStatement,
  verifyAsoiafAnswerCredentialBrokerEstate,
  type AsoiafAnswerCredentialBrokerBinding,
  type AsoiafAnswerCredentialBrokerInvocation,
  type AsoiafAnswerCredentialBrokerPolicy,
  type AsoiafAnswerCredentialPossessionProof,
  type AsoiafAnswerCredentialTransportResultStatement,
} from "./asoiaf-answer-credential-broker.js";
import {
  readAsoiafAnswerCredentialDeploymentStatus,
  type AsoiafAnswerCredentialProviderClass,
} from "./asoiaf-answer-credential-deployment.js";
import type {
  AsoiafAnswerTransportProofAlgorithm,
} from "./asoiaf-answer-desk-transport-enrollment.js";

export const ASOIAF_ANSWER_CREDENTIAL_PROVIDER_PROFILE_FORMAT =
  "axm-asoiaf-answer-credential-provider-profile/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_PROVIDER_INVOCATION_FORMAT =
  "axm-asoiaf-answer-credential-provider-invocation/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_PROVIDER_RESULT_FORMAT =
  "axm-asoiaf-answer-credential-provider-result/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_PROVIDER_STATE_FORMAT =
  "axm-asoiaf-answer-credential-provider-state/1" as const;

export type AsoiafAnswerCredentialProviderHostKind =
  | "synthetic-fixture"
  | "windows-cng";

interface NoAuthority {
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

const NO_AUTHORITY: NoAuthority = {
  authority: "none",
  graphEffect: "none",
  canonEffect: "none",
  answerEffect: "none",
};

export interface AsoiafAnswerCredentialProviderHostPaths {
  root: string;
  providerRoot: string;
  profiles: string;
  invocations: string;
  results: string;
  state: string;
}

export interface AsoiafAnswerCredentialProviderProfile extends NoAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_PROVIDER_PROFILE_FORMAT;
  profileId: string;
  profileFingerprint: `sha256:${string}`;
  brokerPolicyId: string;
  brokerPolicyFingerprint: `sha256:${string}`;
  brokerBindingId: string;
  brokerBindingFingerprint: `sha256:${string}`;
  deploymentStateId: string;
  deploymentStateFingerprint: `sha256:${string}`;
  deviceId: string;
  serviceId: string;
  keyReferenceId: string;
  providerClass: AsoiafAnswerCredentialProviderClass;
  hostKind: AsoiafAnswerCredentialProviderHostKind;
  credentialSelectorDigest: `sha256:${string}`;
  deviceAgentSelectorDigest: `sha256:${string}`;
  allowedTargetOrigins: string[];
  maxResponseBytes: number;
  createdAt: string;
  operatorId: string;
  localExecutionOnly: true;
  certificateRetained: false;
  privateKeyRetained: false;
  privateKeyPathRetained: false;
  rawProviderSelectorRetained: false;
  providerSecretRetained: false;
  rawResponseRetained: false;
  profileAuthority: "provider-routing-only";
}

export interface AsoiafAnswerCredentialProviderInvocation extends NoAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_PROVIDER_INVOCATION_FORMAT;
  providerInvocationId: string;
  providerInvocationFingerprint: `sha256:${string}`;
  profileId: string;
  profileFingerprint: `sha256:${string}`;
  brokerInvocationId: string;
  brokerInvocationFingerprint: `sha256:${string}`;
  brokerInvocationBytesDigest: `sha256:${string}`;
  brokerBindingId: string;
  brokerBindingFingerprint: `sha256:${string}`;
  operation: AsoiafAnswerCredentialBrokerInvocation["operation"];
  idempotencyKeyDigest: `sha256:${string}`;
  preparedAt: string;
  expiresAt: string;
  operatorId: string;
  networkAuthorized: boolean;
  certificateRetained: false;
  privateKeyRetained: false;
  privateKeyPathRetained: false;
  rawProviderSelectorRetained: false;
  providerSecretRetained: false;
  rawResponseRetained: false;
  invocationAuthority: "provider-execution-request-only";
}

export interface AsoiafAnswerCredentialProviderPossessionOutput {
  kind: "possession-proof";
  signatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  signatureBase64: string;
  signatureDigest: `sha256:${string}`;
  provedAt: string;
  brokerAdmissionInput: {
    invocationId: string;
    signatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
    signatureBase64: string;
    provedAt: string;
    operatorId: string;
  };
}

export interface AsoiafAnswerCredentialProviderTransportOutput {
  kind: "transport-result";
  statement: AsoiafAnswerCredentialTransportResultStatement;
  deviceAgentSignatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  deviceAgentSignatureBase64: string;
  deviceAgentSignatureDigest: `sha256:${string}`;
  brokerAdmissionInput: {
    invocationId: string;
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
    deviceAgentSignatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
    deviceAgentSignatureBase64: string;
    operatorId: string;
  };
}

export interface AsoiafAnswerCredentialProviderResult extends NoAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_PROVIDER_RESULT_FORMAT;
  resultId: string;
  resultFingerprint: `sha256:${string}`;
  providerInvocationId: string;
  providerInvocationFingerprint: `sha256:${string}`;
  profileId: string;
  profileFingerprint: `sha256:${string}`;
  brokerInvocationId: string;
  brokerInvocationFingerprint: `sha256:${string}`;
  hostKind: AsoiafAnswerCredentialProviderHostKind;
  providerClass: AsoiafAnswerCredentialProviderClass;
  operation: AsoiafAnswerCredentialBrokerInvocation["operation"];
  startedAt: string;
  completedAt: string;
  providerReceiptDigest: `sha256:${string}`;
  output:
    | AsoiafAnswerCredentialProviderPossessionOutput
    | AsoiafAnswerCredentialProviderTransportOutput;
  certificateRetained: false;
  privateKeyRetained: false;
  privateKeyPathRetained: false;
  rawProviderSelectorRetained: false;
  providerSecretRetained: false;
  rawResponseRetained: false;
  resultAuthority: "public-provider-proof-only";
}

export interface AsoiafAnswerCredentialProviderStateEntry {
  profileId: string;
  profileFingerprint: `sha256:${string}`;
  deviceId: string;
  serviceId: string;
  latestProviderInvocationId: string | null;
  latestProviderInvocationFingerprint: `sha256:${string}` | null;
  latestResultId: string | null;
  latestResultFingerprint: `sha256:${string}` | null;
  updatedAt: string;
}

export interface AsoiafAnswerCredentialProviderState extends NoAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_PROVIDER_STATE_FORMAT;
  stateId: string;
  stateFingerprint: `sha256:${string}`;
  asOf: string;
  entries: AsoiafAnswerCredentialProviderStateEntry[];
  stateAuthority: "projection-only";
}

export interface AsoiafAnswerCredentialProviderStatus {
  format: "axm-asoiaf-answer-credential-provider-status/1";
  paths: AsoiafAnswerCredentialProviderHostPaths;
  profiles: AsoiafAnswerCredentialProviderProfile[];
  invocations: AsoiafAnswerCredentialProviderInvocation[];
  results: AsoiafAnswerCredentialProviderResult[];
  state: AsoiafAnswerCredentialProviderState | null;
}

export interface AsoiafAnswerCredentialProviderFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

export interface AsoiafAnswerCredentialProviderProfileInput {
  root: string;
  brokerPolicyId: string;
  brokerBindingId: string;
  hostKind: AsoiafAnswerCredentialProviderHostKind;
  credentialSelector: string;
  deviceAgentSelector: string;
  allowedTargetOrigins: string[];
  maxResponseBytes: number;
  createdAt: string;
  operatorId: string;
}

export interface AsoiafAnswerCredentialProviderPrepareInput {
  root: string;
  profileId: string;
  brokerInvocationId: string;
  idempotencyKey: string;
  preparedAt: string;
  expiresAt: string;
  operatorId: string;
}

export interface AsoiafAnswerCredentialSyntheticPossessionInput {
  root: string;
  providerInvocationId: string;
  credentialPrivateKeyPem: string;
  completedAt: string;
  operatorId: string;
}

export interface AsoiafAnswerCredentialSyntheticTransportInput {
  root: string;
  providerInvocationId: string;
  deviceAgentPrivateKeyPem: string;
  lowerRequestId: string;
  lowerRequestFingerprint: `sha256:${string}`;
  lowerResponseId: string;
  lowerResponseFingerprint: `sha256:${string}`;
  observedServerCertificateFingerprint: `sha256:${string}`;
  observedServerIssuerFingerprint: `sha256:${string}`;
  httpStatus: number;
  responseBodyBase64: string;
  providerReceiptDigest: `sha256:${string}`;
  startedAt: string;
  completedAt: string;
  operatorId: string;
}

export interface AsoiafAnswerCredentialWindowsPossessionInput {
  root: string;
  providerInvocationId: string;
  credentialCertificateThumbprint: string;
  completedAt: string;
  operatorId: string;
  powershellExecutable?: string;
}

export interface AsoiafAnswerCredentialWindowsTransportInput {
  root: string;
  providerInvocationId: string;
  credentialCertificateThumbprint: string;
  deviceAgentCertificateThumbprint: string;
  requestBodyBase64: string;
  completedAt: string;
  operatorId: string;
  powershellExecutable?: string;
}

const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const MAX_PROVIDER_LIFETIME = 60 * 60 * 1000;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function bytesDigest(value: Buffer): `sha256:${string}` {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function requireDigest(value: string, label: string): `sha256:${string}` {
  const normalized = value.trim().toLowerCase();
  if (!/^sha256:[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
  return normalized as `sha256:${string}`;
}

function requireTime(value: string, label: string): string {
  if (!value.trim() || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} is invalid`);
  }
  return new Date(value).toISOString();
}

function requireId(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 1024 || /[\r\n\0]/.test(normalized)) {
    throw new Error(`${label} is invalid`);
  }
  return normalized;
}

function requireInteger(value: number, label: string, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} must be an integer from 1 through ${maximum}`);
  }
  return value;
}

function requireOrigins(values: readonly string[]): string[] {
  const origins = [...new Set(values.map((entry) => {
    const url = new URL(entry);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.pathname !== "/"
      || url.search
      || url.hash
    ) {
      throw new Error("credential provider allowed targets must be credential-free HTTPS origins");
    }
    return url.origin;
  }))].sort();
  if (origins.length < 1 || origins.length > 32) {
    throw new Error("credential provider profile requires 1 through 32 allowed HTTPS origins");
  }
  return origins;
}

function expectedHostKind(providerClass: AsoiafAnswerCredentialProviderClass): AsoiafAnswerCredentialProviderHostKind {
  if (providerClass === "synthetic-fixture") return "synthetic-fixture";
  if (providerClass === "windows-cng") return "windows-cng";
  throw new Error(`provider class ${providerClass} requires a separately qualified native host`);
}

function keyAlgorithm(key: crypto.KeyObject): AsoiafAnswerTransportProofAlgorithm {
  if (key.asymmetricKeyType === "ed25519") return "ed25519";
  if (key.asymmetricKeyType === "ec") return "ecdsa-sha256";
  if (key.asymmetricKeyType === "rsa" || key.asymmetricKeyType === "rsa-pss") {
    return "rsa-sha256";
  }
  throw new Error(`unsupported provider key type ${key.asymmetricKeyType ?? "unknown"}`);
}

function sign(key: crypto.KeyObject, message: Buffer): {
  algorithm: AsoiafAnswerTransportProofAlgorithm;
  signature: Buffer;
} {
  const algorithm = keyAlgorithm(key);
  return {
    algorithm,
    signature: crypto.sign(algorithm === "ed25519" ? null : "sha256", message, key),
  };
}

function publicKeyDigest(key: crypto.KeyObject): `sha256:${string}` {
  return bytesDigest(crypto.createPublicKey(key).export({ type: "spki", format: "der" }) as Buffer);
}

function verifySignature(input: {
  spkiBase64: string;
  algorithm: AsoiafAnswerTransportProofAlgorithm;
  message: Buffer;
  signatureBase64: string;
}): boolean {
  const key = crypto.createPublicKey({
    key: Buffer.from(input.spkiBase64, "base64"),
    format: "der",
    type: "spki",
  });
  if (keyAlgorithm(key) !== input.algorithm) return false;
  return crypto.verify(
    input.algorithm === "ed25519" ? null : "sha256",
    input.message,
    key,
    Buffer.from(input.signatureBase64, "base64"),
  );
}

function finding(
  code: string,
  severity: AsoiafAnswerCredentialProviderFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafAnswerCredentialProviderFinding {
  return { code, severity, subjectId, detail };
}

function sortFindings(values: readonly AsoiafAnswerCredentialProviderFinding[]): AsoiafAnswerCredentialProviderFinding[] {
  const rank = { error: 0, warning: 1, notice: 2 } as const;
  return [...values].sort((left, right) =>
    rank[left.severity] - rank[right.severity]
    || left.code.localeCompare(right.code)
    || left.subjectId.localeCompare(right.subjectId)
    || left.detail.localeCompare(right.detail));
}

function writeExact<T>(target: string, value: T): { value: T; replayed: boolean } {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    fs.writeFileSync(target, serialized, { encoding: "utf8", flag: "wx" });
    return { value, replayed: false };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = fs.readFileSync(target, "utf8");
    if (existing !== serialized) {
      throw new Error(`credential provider immutable file collision at ${target}`);
    }
    return { value: JSON.parse(existing) as T, replayed: true };
  }
}

function writeAtomic(target: string, value: unknown): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, target);
}

function readJson<T>(target: string): T {
  return JSON.parse(fs.readFileSync(target, "utf8")) as T;
}

function listJson<T>(directory: string): T[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name) => /^[a-f0-9]{64}\.json$/.test(name))
    .sort()
    .map((name) => readJson<T>(path.join(directory, name)));
}

function digestPath(directory: string, digest: `sha256:${string}`): string {
  return path.join(directory, `${digest.slice("sha256:".length)}.json`);
}

function profileCore(value: AsoiafAnswerCredentialProviderProfile) {
  const { profileId: _id, profileFingerprint: _fingerprint, ...core } = value;
  return core;
}
function invocationCore(value: AsoiafAnswerCredentialProviderInvocation) {
  const { providerInvocationId: _id, providerInvocationFingerprint: _fingerprint, ...core } = value;
  return core;
}
function resultCore(value: AsoiafAnswerCredentialProviderResult) {
  const { resultId: _id, resultFingerprint: _fingerprint, ...core } = value;
  return core;
}
function stateCore(value: AsoiafAnswerCredentialProviderState) {
  const { stateId: _id, stateFingerprint: _fingerprint, ...core } = value;
  return core;
}

export function asoiafAnswerCredentialProviderHostPaths(
  root: string,
): AsoiafAnswerCredentialProviderHostPaths {
  const absolute = path.resolve(root);
  const providerRoot = path.join(absolute, "answer-credential-provider-host");
  return {
    root: absolute,
    providerRoot,
    profiles: path.join(providerRoot, "profiles"),
    invocations: path.join(providerRoot, "invocations"),
    results: path.join(providerRoot, "results"),
    state: path.join(providerRoot, "PROVIDER-STATE.json"),
  };
}

function parentObjects(root: string): {
  policies: AsoiafAnswerCredentialBrokerPolicy[];
  bindings: AsoiafAnswerCredentialBrokerBinding[];
  invocations: AsoiafAnswerCredentialBrokerInvocation[];
  proofs: AsoiafAnswerCredentialPossessionProof[];
} {
  const errors = verifyAsoiafAnswerCredentialBrokerEstate(root)
    .filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(`credential provider requires a valid broker estate: ${errors.map((entry) => entry.code).join(", ")}`);
  }
  const status = readAsoiafAnswerCredentialBrokerStatus(root);
  return {
    policies: status.policies,
    bindings: status.bindings,
    invocations: status.invocations,
    proofs: status.proofs,
  };
}

export function readAsoiafAnswerCredentialProviderStatus(
  root: string,
): AsoiafAnswerCredentialProviderStatus {
  const paths = asoiafAnswerCredentialProviderHostPaths(root);
  return {
    format: "axm-asoiaf-answer-credential-provider-status/1",
    paths,
    profiles: listJson<AsoiafAnswerCredentialProviderProfile>(paths.profiles),
    invocations: listJson<AsoiafAnswerCredentialProviderInvocation>(paths.invocations),
    results: listJson<AsoiafAnswerCredentialProviderResult>(paths.results),
    state: fs.existsSync(paths.state)
      ? readJson<AsoiafAnswerCredentialProviderState>(paths.state)
      : null,
  };
}

function profileById(root: string, profileId: string): AsoiafAnswerCredentialProviderProfile {
  const matches = readAsoiafAnswerCredentialProviderStatus(root).profiles
    .filter((entry) => entry.profileId === profileId);
  if (matches.length !== 1) {
    throw new Error(`credential provider profile ${profileId} is absent or duplicated`);
  }
  return matches[0]!;
}

function providerInvocationById(
  root: string,
  invocationId: string,
): AsoiafAnswerCredentialProviderInvocation {
  const matches = readAsoiafAnswerCredentialProviderStatus(root).invocations
    .filter((entry) => entry.providerInvocationId === invocationId);
  if (matches.length !== 1) {
    throw new Error(`credential provider invocation ${invocationId} is absent or duplicated`);
  }
  return matches[0]!;
}

function brokerInvocationById(
  root: string,
  invocationId: string,
): AsoiafAnswerCredentialBrokerInvocation {
  const matches = parentObjects(root).invocations
    .filter((entry) => entry.invocationId === invocationId);
  if (matches.length !== 1) {
    throw new Error(`credential broker invocation ${invocationId} is absent or duplicated`);
  }
  return matches[0]!;
}

function bindingById(root: string, bindingId: string): AsoiafAnswerCredentialBrokerBinding {
  const matches = parentObjects(root).bindings.filter((entry) => entry.bindingId === bindingId);
  if (matches.length !== 1) {
    throw new Error(`credential broker binding ${bindingId} is absent or duplicated`);
  }
  return matches[0]!;
}

function buildState(root: string): AsoiafAnswerCredentialProviderState {
  const status = readAsoiafAnswerCredentialProviderStatus(root);
  const entries = status.profiles.map((profile) => {
    const invocations = status.invocations
      .filter((entry) => entry.profileId === profile.profileId)
      .sort((left, right) => left.preparedAt.localeCompare(right.preparedAt));
    const results = status.results
      .filter((entry) => entry.profileId === profile.profileId)
      .sort((left, right) => left.completedAt.localeCompare(right.completedAt));
    const invocation = invocations.at(-1) ?? null;
    const result = results.at(-1) ?? null;
    return {
      profileId: profile.profileId,
      profileFingerprint: profile.profileFingerprint,
      deviceId: profile.deviceId,
      serviceId: profile.serviceId,
      latestProviderInvocationId: invocation?.providerInvocationId ?? null,
      latestProviderInvocationFingerprint: invocation?.providerInvocationFingerprint ?? null,
      latestResultId: result?.resultId ?? null,
      latestResultFingerprint: result?.resultFingerprint ?? null,
      updatedAt: result?.completedAt ?? invocation?.preparedAt ?? profile.createdAt,
    };
  }).sort((left, right) => left.profileId.localeCompare(right.profileId));
  const asOf = entries.map((entry) => entry.updatedAt).sort().at(-1)
    ?? "1970-01-01T00:00:00.000Z";
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_PROVIDER_STATE_FORMAT,
    asOf,
    entries,
    stateAuthority: "projection-only" as const,
    ...NO_AUTHORITY,
  };
  const stateFingerprint = sha256(core);
  return {
    ...core,
    stateId: collectorContentId("asoiaf-answer-credential-provider-state", {
      asOf,
      stateFingerprint,
    }),
    stateFingerprint,
  };
}

function refreshState(root: string): AsoiafAnswerCredentialProviderState | null {
  const paths = asoiafAnswerCredentialProviderHostPaths(root);
  if (listJson<AsoiafAnswerCredentialProviderProfile>(paths.profiles).length === 0) {
    return null;
  }
  const state = buildState(root);
  writeAtomic(paths.state, state);
  return state;
}

export function retainAsoiafAnswerCredentialProviderProfile(
  input: AsoiafAnswerCredentialProviderProfileInput,
): { profile: AsoiafAnswerCredentialProviderProfile; replayed: boolean } {
  const parent = parentObjects(input.root);
  const policy = parent.policies.find((entry) => entry.policyId === input.brokerPolicyId);
  const binding = parent.bindings.find((entry) => entry.bindingId === input.brokerBindingId);
  if (!policy || !binding) {
    throw new Error("credential provider profile requires exact broker policy and binding custody");
  }
  if (binding.policyId !== policy.policyId || binding.policyFingerprint !== policy.policyFingerprint) {
    throw new Error("credential provider binding differs from broker policy custody");
  }
  if (expectedHostKind(binding.providerClass) !== input.hostKind) {
    throw new Error(`credential provider ${input.hostKind} cannot execute deployment class ${binding.providerClass}`);
  }
  const maxResponseBytes = requireInteger(
    input.maxResponseBytes,
    "provider response ceiling",
    MAX_RESPONSE_BYTES,
  );
  if (maxResponseBytes > policy.maxResponseBytes) {
    throw new Error("credential provider response ceiling exceeds broker policy");
  }
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_PROVIDER_PROFILE_FORMAT,
    brokerPolicyId: policy.policyId,
    brokerPolicyFingerprint: policy.policyFingerprint,
    brokerBindingId: binding.bindingId,
    brokerBindingFingerprint: binding.bindingFingerprint,
    deploymentStateId: binding.deploymentStateId,
    deploymentStateFingerprint: binding.deploymentStateFingerprint,
    deviceId: binding.deviceId,
    serviceId: binding.serviceId,
    keyReferenceId: binding.keyReferenceId,
    providerClass: binding.providerClass,
    hostKind: input.hostKind,
    credentialSelectorDigest: sha256(requireId(input.credentialSelector, "credential selector")),
    deviceAgentSelectorDigest: sha256(requireId(input.deviceAgentSelector, "device-agent selector")),
    allowedTargetOrigins: requireOrigins(input.allowedTargetOrigins),
    maxResponseBytes,
    createdAt: requireTime(input.createdAt, "provider profile creation time"),
    operatorId: requireId(input.operatorId, "provider profile operator"),
    localExecutionOnly: true as const,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    privateKeyPathRetained: false as const,
    rawProviderSelectorRetained: false as const,
    providerSecretRetained: false as const,
    rawResponseRetained: false as const,
    profileAuthority: "provider-routing-only" as const,
    ...NO_AUTHORITY,
  };
  const profileFingerprint = sha256(core);
  const profile: AsoiafAnswerCredentialProviderProfile = {
    ...core,
    profileId: collectorContentId("asoiaf-answer-credential-provider-profile", {
      brokerBindingId: binding.bindingId,
      hostKind: input.hostKind,
      profileFingerprint,
    }),
    profileFingerprint,
  };
  const paths = asoiafAnswerCredentialProviderHostPaths(input.root);
  const persisted = writeExact(digestPath(paths.profiles, profileFingerprint), profile);
  refreshState(input.root);
  return { profile: persisted.value, replayed: persisted.replayed };
}

export function prepareAsoiafAnswerCredentialProviderInvocation(
  input: AsoiafAnswerCredentialProviderPrepareInput,
): { invocation: AsoiafAnswerCredentialProviderInvocation; replayed: boolean } {
  const profile = profileById(input.root, input.profileId);
  const brokerInvocation = brokerInvocationById(input.root, input.brokerInvocationId);
  if (
    brokerInvocation.policyId !== profile.brokerPolicyId
    || brokerInvocation.policyFingerprint !== profile.brokerPolicyFingerprint
    || brokerInvocation.bindingId !== profile.brokerBindingId
    || brokerInvocation.bindingFingerprint !== profile.brokerBindingFingerprint
  ) {
    throw new Error("credential provider invocation differs from profile broker custody");
  }
  if (brokerInvocation.operation === "mutual-tls-request") {
    if (brokerInvocation.request.kind !== "mutual-tls") {
      throw new Error("credential provider mutual-TLS operation lacks a mutual-TLS request");
    }
    const origin = new URL(brokerInvocation.request.targetUrl).origin;
    if (!profile.allowedTargetOrigins.includes(origin)) {
      throw new Error(`credential provider target origin ${origin} is outside profile policy`);
    }
    if (brokerInvocation.request.maxResponseBytes > profile.maxResponseBytes) {
      throw new Error("credential provider invocation response ceiling exceeds profile");
    }
  }
  const preparedAt = requireTime(input.preparedAt, "provider invocation preparation time");
  const expiresAt = requireTime(input.expiresAt, "provider invocation expiry");
  if (
    Date.parse(expiresAt) <= Date.parse(preparedAt)
    || Date.parse(expiresAt) > Date.parse(brokerInvocation.expiresAt)
    || Date.parse(expiresAt) - Date.parse(preparedAt) > MAX_PROVIDER_LIFETIME
  ) {
    throw new Error("credential provider invocation lifetime is outside broker custody");
  }
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_PROVIDER_INVOCATION_FORMAT,
    profileId: profile.profileId,
    profileFingerprint: profile.profileFingerprint,
    brokerInvocationId: brokerInvocation.invocationId,
    brokerInvocationFingerprint: brokerInvocation.invocationFingerprint,
    brokerInvocationBytesDigest: bytesDigest(
      serializeAsoiafAnswerCredentialBrokerInvocation(brokerInvocation),
    ),
    brokerBindingId: profile.brokerBindingId,
    brokerBindingFingerprint: profile.brokerBindingFingerprint,
    operation: brokerInvocation.operation,
    idempotencyKeyDigest: sha256(requireId(input.idempotencyKey, "provider idempotency key")),
    preparedAt,
    expiresAt,
    operatorId: requireId(input.operatorId, "provider invocation operator"),
    networkAuthorized: brokerInvocation.operation === "mutual-tls-request",
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    privateKeyPathRetained: false as const,
    rawProviderSelectorRetained: false as const,
    providerSecretRetained: false as const,
    rawResponseRetained: false as const,
    invocationAuthority: "provider-execution-request-only" as const,
    ...NO_AUTHORITY,
  };
  const providerInvocationFingerprint = sha256(core);
  const invocation: AsoiafAnswerCredentialProviderInvocation = {
    ...core,
    providerInvocationId: collectorContentId("asoiaf-answer-credential-provider-invocation", {
      profileId: profile.profileId,
      brokerInvocationId: brokerInvocation.invocationId,
      providerInvocationFingerprint,
    }),
    providerInvocationFingerprint,
  };
  const existing = readAsoiafAnswerCredentialProviderStatus(input.root).invocations
    .filter((entry) => entry.idempotencyKeyDigest === invocation.idempotencyKeyDigest);
  if (existing.length > 0) {
    if (existing.length !== 1 || stableJson(existing[0]) !== stableJson(invocation)) {
      throw new Error("credential provider idempotency key conflicts with retained invocation");
    }
    return { invocation: existing[0]!, replayed: true };
  }
  const paths = asoiafAnswerCredentialProviderHostPaths(input.root);
  const persisted = writeExact(
    digestPath(paths.invocations, providerInvocationFingerprint),
    invocation,
  );
  refreshState(input.root);
  return { invocation: persisted.value, replayed: persisted.replayed };
}

function retainResult(
  root: string,
  result: AsoiafAnswerCredentialProviderResult,
): { result: AsoiafAnswerCredentialProviderResult; replayed: boolean } {
  const existing = readAsoiafAnswerCredentialProviderStatus(root).results
    .filter((entry) => entry.providerInvocationId === result.providerInvocationId);
  if (existing.length > 0) {
    if (existing.length !== 1 || stableJson(existing[0]) !== stableJson(result)) {
      throw new Error("credential provider invocation already has a different terminal result");
    }
    return { result: existing[0]!, replayed: true };
  }
  const paths = asoiafAnswerCredentialProviderHostPaths(root);
  const persisted = writeExact(digestPath(paths.results, result.resultFingerprint), result);
  refreshState(root);
  return { result: persisted.value, replayed: persisted.replayed };
}

function buildPossessionResult(input: {
  root: string;
  providerInvocation: AsoiafAnswerCredentialProviderInvocation;
  profile: AsoiafAnswerCredentialProviderProfile;
  algorithm: AsoiafAnswerTransportProofAlgorithm;
  signature: Buffer;
  completedAt: string;
  operatorId: string;
}): AsoiafAnswerCredentialProviderResult {
  const brokerInvocation = brokerInvocationById(
    input.root,
    input.providerInvocation.brokerInvocationId,
  );
  if (
    brokerInvocation.operation !== "prove-possession"
    || brokerInvocation.request.kind !== "possession"
  ) {
    throw new Error("credential provider possession execution requires a possession invocation");
  }
  const provedAt = requireTime(input.completedAt, "provider possession completion time");
  const signatureBase64 = input.signature.toString("base64");
  const signatureDigest = bytesDigest(input.signature);
  const output: AsoiafAnswerCredentialProviderPossessionOutput = {
    kind: "possession-proof",
    signatureAlgorithm: input.algorithm,
    signatureBase64,
    signatureDigest,
    provedAt,
    brokerAdmissionInput: {
      invocationId: brokerInvocation.invocationId,
      signatureAlgorithm: input.algorithm,
      signatureBase64,
      provedAt,
      operatorId: requireId(input.operatorId, "provider possession operator"),
    },
  };
  const providerReceiptDigest = sha256({
    providerInvocationFingerprint: input.providerInvocation.providerInvocationFingerprint,
    signatureDigest,
    provedAt,
  });
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_PROVIDER_RESULT_FORMAT,
    providerInvocationId: input.providerInvocation.providerInvocationId,
    providerInvocationFingerprint: input.providerInvocation.providerInvocationFingerprint,
    profileId: input.profile.profileId,
    profileFingerprint: input.profile.profileFingerprint,
    brokerInvocationId: brokerInvocation.invocationId,
    brokerInvocationFingerprint: brokerInvocation.invocationFingerprint,
    hostKind: input.profile.hostKind,
    providerClass: input.profile.providerClass,
    operation: "prove-possession" as const,
    startedAt: input.providerInvocation.preparedAt,
    completedAt: provedAt,
    providerReceiptDigest,
    output,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    privateKeyPathRetained: false as const,
    rawProviderSelectorRetained: false as const,
    providerSecretRetained: false as const,
    rawResponseRetained: false as const,
    resultAuthority: "public-provider-proof-only" as const,
    ...NO_AUTHORITY,
  };
  const resultFingerprint = sha256(core);
  return {
    ...core,
    resultId: collectorContentId("asoiaf-answer-credential-provider-result", {
      providerInvocationId: input.providerInvocation.providerInvocationId,
      operation: core.operation,
      resultFingerprint,
    }),
    resultFingerprint,
  };
}

function buildTransportResult(input: {
  root: string;
  providerInvocation: AsoiafAnswerCredentialProviderInvocation;
  profile: AsoiafAnswerCredentialProviderProfile;
  statement: AsoiafAnswerCredentialTransportResultStatement;
  algorithm: AsoiafAnswerTransportProofAlgorithm;
  signature: Buffer;
  operatorId: string;
}): AsoiafAnswerCredentialProviderResult {
  const brokerInvocation = brokerInvocationById(
    input.root,
    input.providerInvocation.brokerInvocationId,
  );
  if (
    brokerInvocation.operation !== "mutual-tls-request"
    || brokerInvocation.request.kind !== "mutual-tls"
  ) {
    throw new Error("credential provider transport execution requires a mutual-TLS invocation");
  }
  const signatureBase64 = input.signature.toString("base64");
  const output: AsoiafAnswerCredentialProviderTransportOutput = {
    kind: "transport-result",
    statement: input.statement,
    deviceAgentSignatureAlgorithm: input.algorithm,
    deviceAgentSignatureBase64: signatureBase64,
    deviceAgentSignatureDigest: bytesDigest(input.signature),
    brokerAdmissionInput: {
      invocationId: brokerInvocation.invocationId,
      lowerRequestId: input.statement.lowerRequestId,
      lowerRequestFingerprint: input.statement.lowerRequestFingerprint,
      lowerResponseId: input.statement.lowerResponseId,
      lowerResponseFingerprint: input.statement.lowerResponseFingerprint,
      observedServerCertificateFingerprint:
        input.statement.observedServerCertificateFingerprint,
      observedServerIssuerFingerprint:
        input.statement.observedServerIssuerFingerprint,
      httpStatus: input.statement.httpStatus,
      responseBytes: input.statement.responseBytes,
      responseDigest: input.statement.responseDigest,
      providerReceiptDigest: input.statement.providerReceiptDigest,
      startedAt: input.statement.startedAt,
      completedAt: input.statement.completedAt,
      deviceAgentSignatureAlgorithm: input.algorithm,
      deviceAgentSignatureBase64: signatureBase64,
      operatorId: requireId(input.operatorId, "provider transport operator"),
    },
  };
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_PROVIDER_RESULT_FORMAT,
    providerInvocationId: input.providerInvocation.providerInvocationId,
    providerInvocationFingerprint: input.providerInvocation.providerInvocationFingerprint,
    profileId: input.profile.profileId,
    profileFingerprint: input.profile.profileFingerprint,
    brokerInvocationId: brokerInvocation.invocationId,
    brokerInvocationFingerprint: brokerInvocation.invocationFingerprint,
    hostKind: input.profile.hostKind,
    providerClass: input.profile.providerClass,
    operation: "mutual-tls-request" as const,
    startedAt: input.statement.startedAt,
    completedAt: input.statement.completedAt,
    providerReceiptDigest: input.statement.providerReceiptDigest,
    output,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    privateKeyPathRetained: false as const,
    rawProviderSelectorRetained: false as const,
    providerSecretRetained: false as const,
    rawResponseRetained: false as const,
    resultAuthority: "public-provider-proof-only" as const,
    ...NO_AUTHORITY,
  };
  const resultFingerprint = sha256(core);
  return {
    ...core,
    resultId: collectorContentId("asoiaf-answer-credential-provider-result", {
      providerInvocationId: input.providerInvocation.providerInvocationId,
      operation: core.operation,
      resultFingerprint,
    }),
    resultFingerprint,
  };
}

export function executeAsoiafAnswerSyntheticPossession(
  input: AsoiafAnswerCredentialSyntheticPossessionInput,
): { result: AsoiafAnswerCredentialProviderResult; replayed: boolean } {
  const providerInvocation = providerInvocationById(input.root, input.providerInvocationId);
  const profile = profileById(input.root, providerInvocation.profileId);
  if (profile.hostKind !== "synthetic-fixture") {
    throw new Error("synthetic execution requires a synthetic provider profile");
  }
  const existing = readAsoiafAnswerCredentialProviderStatus(input.root).results
    .find((entry) => entry.providerInvocationId === providerInvocation.providerInvocationId);
  if (existing) return { result: existing, replayed: true };
  const brokerInvocation = brokerInvocationById(input.root, providerInvocation.brokerInvocationId);
  const binding = bindingById(input.root, profile.brokerBindingId);
  const key = crypto.createPrivateKey(input.credentialPrivateKeyPem);
  if (publicKeyDigest(key) !== binding.publicKeyFingerprint) {
    throw new Error("synthetic credential key differs from active deployment binding");
  }
  const signed = sign(key, serializeAsoiafAnswerCredentialBrokerInvocation(brokerInvocation));
  return retainResult(input.root, buildPossessionResult({
    root: input.root,
    providerInvocation,
    profile,
    algorithm: signed.algorithm,
    signature: signed.signature,
    completedAt: input.completedAt,
    operatorId: input.operatorId,
  }));
}

export function executeAsoiafAnswerSyntheticTransport(
  input: AsoiafAnswerCredentialSyntheticTransportInput,
): { result: AsoiafAnswerCredentialProviderResult; replayed: boolean } {
  const providerInvocation = providerInvocationById(input.root, input.providerInvocationId);
  const profile = profileById(input.root, providerInvocation.profileId);
  if (profile.hostKind !== "synthetic-fixture") {
    throw new Error("synthetic execution requires a synthetic provider profile");
  }
  const existing = readAsoiafAnswerCredentialProviderStatus(input.root).results
    .find((entry) => entry.providerInvocationId === providerInvocation.providerInvocationId);
  if (existing) return { result: existing, replayed: true };
  const brokerInvocation = brokerInvocationById(input.root, providerInvocation.brokerInvocationId);
  if (
    brokerInvocation.operation !== "mutual-tls-request"
    || brokerInvocation.request.kind !== "mutual-tls"
  ) {
    throw new Error("synthetic transport execution requires a mutual-TLS broker invocation");
  }
  const proof = parentObjects(input.root).proofs.find(
    (entry) => entry.proofId === brokerInvocation.request.possessionProofId,
  );
  if (!proof || proof.proofFingerprint !== brokerInvocation.request.possessionProofFingerprint) {
    throw new Error("credential provider transport invocation lacks its exact possession proof");
  }
  const response = Buffer.from(input.responseBodyBase64, "base64");
  if (
    response.length > profile.maxResponseBytes
    || response.length > brokerInvocation.request.maxResponseBytes
  ) {
    throw new Error("synthetic provider response exceeds retained response ceiling");
  }
  const statement = buildAsoiafAnswerCredentialTransportResultStatement({
    root: input.root,
    invocationId: brokerInvocation.invocationId,
    lowerRequestId: requireId(input.lowerRequestId, "lower request identity"),
    lowerRequestFingerprint: requireDigest(
      input.lowerRequestFingerprint,
      "lower request fingerprint",
    ),
    lowerResponseId: requireId(input.lowerResponseId, "lower response identity"),
    lowerResponseFingerprint: requireDigest(
      input.lowerResponseFingerprint,
      "lower response fingerprint",
    ),
    observedServerCertificateFingerprint: requireDigest(
      input.observedServerCertificateFingerprint,
      "observed server certificate fingerprint",
    ),
    observedServerIssuerFingerprint: requireDigest(
      input.observedServerIssuerFingerprint,
      "observed server issuer fingerprint",
    ),
    httpStatus: requireInteger(input.httpStatus, "HTTP status", 599),
    responseBytes: response.length,
    responseDigest: bytesDigest(response),
    providerReceiptDigest: requireDigest(
      input.providerReceiptDigest,
      "provider receipt digest",
    ),
    startedAt: requireTime(input.startedAt, "provider transport start time"),
    completedAt: requireTime(input.completedAt, "provider transport completion time"),
  });
  const binding = bindingById(input.root, profile.brokerBindingId);
  const key = crypto.createPrivateKey(input.deviceAgentPrivateKeyPem);
  if (publicKeyDigest(key) !== binding.deviceAgentPublicKeyFingerprint) {
    throw new Error("synthetic device-agent key differs from active deployment binding");
  }
  const signed = sign(
    key,
    serializeAsoiafAnswerCredentialTransportResultStatement(statement),
  );
  return retainResult(input.root, buildTransportResult({
    root: input.root,
    providerInvocation,
    profile,
    statement,
    algorithm: signed.algorithm,
    signature: signed.signature,
    operatorId: input.operatorId,
  }));
}

export function asoiafAnswerCredentialWindowsCngPowerShell(): string {
  return String.raw`param([Parameter(Mandatory=$true)][string]$InputPath)
$ErrorActionPreference = 'Stop'
$inputObject = Get-Content -Raw -LiteralPath $InputPath | ConvertFrom-Json
function Normalize-Thumbprint([string]$value) { return ($value -replace '[^A-Fa-f0-9]', '').ToUpperInvariant() }
function Resolve-Certificate([string]$thumbprint) {
  $certificate = Get-Item -LiteralPath ("Cert:\CurrentUser\My\" + (Normalize-Thumbprint $thumbprint)) -ErrorAction Stop
  if (-not $certificate.HasPrivateKey) { throw 'certificate does not expose a non-exported private key to CurrentUser' }
  return $certificate
}
function Sign-Bytes($certificate, [byte[]]$message) {
  $rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($certificate)
  if ($null -ne $rsa) {
    try {
      $signature = $rsa.SignData($message, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
      return @{ algorithm = 'rsa-sha256'; signatureBase64 = [Convert]::ToBase64String($signature) }
    } finally { $rsa.Dispose() }
  }
  $ecdsa = [System.Security.Cryptography.X509Certificates.ECDsaCertificateExtensions]::GetECDsaPrivateKey($certificate)
  if ($null -ne $ecdsa) {
    try {
      $signature = $ecdsa.SignData($message, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
      return @{ algorithm = 'ecdsa-sha256'; signatureBase64 = [Convert]::ToBase64String($signature) }
    } finally { $ecdsa.Dispose() }
  }
  throw 'Windows CNG certificate key type is unsupported'
}
function Fingerprint([System.Security.Cryptography.X509Certificates.X509Certificate2]$certificate) {
  return 'sha256:' + [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($certificate.RawData)).ToLowerInvariant()
}
if ($inputObject.command -eq 'sign') {
  $certificate = Resolve-Certificate $inputObject.thumbprint
  $signed = Sign-Bytes $certificate ([Convert]::FromBase64String([string]$inputObject.messageBase64))
  [pscustomobject]@{
    algorithm = $signed.algorithm
    signatureBase64 = $signed.signatureBase64
    certificateFingerprint = Fingerprint $certificate
  } | ConvertTo-Json -Compress
  exit 0
}
if ($inputObject.command -ne 'mutual-tls') { throw 'unsupported Windows CNG provider command' }
$client = Resolve-Certificate $inputObject.credentialThumbprint
$handler = [System.Net.Http.HttpClientHandler]::new()
$handler.ClientCertificates.Add($client)
$observedLeaf = $null
$observedIssuer = $null
$handler.ServerCertificateCustomValidationCallback = {
  param($request, $certificate, $chain, $errors)
  $script:observedLeaf = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($certificate)
  $script:observedIssuer = if ($null -ne $chain -and $chain.ChainElements.Count -gt 1) {
    [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($chain.ChainElements[1].Certificate)
  } else { $script:observedLeaf }
  return $errors -eq [System.Net.Security.SslPolicyErrors]::None
}
$http = [System.Net.Http.HttpClient]::new($handler)
try {
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new([string]$inputObject.method), [string]$inputObject.targetUrl)
  if ([string]$inputObject.method -eq 'POST') {
    $body = [Convert]::FromBase64String([string]$inputObject.requestBodyBase64)
    $request.Content = [System.Net.Http.ByteArrayContent]::new($body)
    $request.Content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new('application/json')
  }
  $started = [DateTimeOffset]::UtcNow
  $response = $http.SendAsync($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
  $bytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
  $completed = [DateTimeOffset]::UtcNow
  if ($bytes.Length -gt [int]$inputObject.maxResponseBytes) { throw 'response exceeded provider ceiling' }
  $leafFingerprint = Fingerprint $script:observedLeaf
  $issuerFingerprint = Fingerprint $script:observedIssuer
  if ($leafFingerprint -ne [string]$inputObject.expectedServerCertificateFingerprint) { throw 'server certificate fingerprint mismatch' }
  if ($issuerFingerprint -ne [string]$inputObject.expectedServerIssuerFingerprint) { throw 'server issuer fingerprint mismatch' }
  [pscustomobject]@{
    httpStatus = [int]$response.StatusCode
    responseBytes = $bytes.Length
    responseDigest = 'sha256:' + [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
    observedServerCertificateFingerprint = $leafFingerprint
    observedServerIssuerFingerprint = $issuerFingerprint
    startedAt = $started.ToString('o')
    completedAt = $completed.ToString('o')
  } | ConvertTo-Json -Compress
} finally {
  $http.Dispose()
  $handler.Dispose()
}`;
}

function selector(value: string, expected: `sha256:${string}`, label: string): string {
  const normalized = requireId(value, label);
  if (sha256(normalized) !== expected) {
    throw new Error(`${label} differs from retained profile selector digest`);
  }
  return normalized;
}

function runWindows(input: Record<string, unknown>, executable?: string): Record<string, unknown> {
  if (process.platform !== "win32") {
    throw new Error("Windows CNG provider execution requires Windows");
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-provider-host-"));
  const scriptPath = path.join(directory, "provider.ps1");
  const inputPath = path.join(directory, "input.json");
  try {
    fs.writeFileSync(scriptPath, asoiafAnswerCredentialWindowsCngPowerShell(), "utf8");
    fs.writeFileSync(inputPath, `${JSON.stringify(input)}\n`, "utf8");
    return JSON.parse(execFileSync(executable ?? "powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy", "Bypass",
      "-File", scriptPath,
      "-InputPath", inputPath,
    ], { encoding: "utf8", windowsHide: true }).trim()) as Record<string, unknown>;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

export function executeAsoiafAnswerWindowsCngPossession(
  input: AsoiafAnswerCredentialWindowsPossessionInput,
): { result: AsoiafAnswerCredentialProviderResult; replayed: boolean } {
  const providerInvocation = providerInvocationById(input.root, input.providerInvocationId);
  const profile = profileById(input.root, providerInvocation.profileId);
  if (profile.hostKind !== "windows-cng") {
    throw new Error("Windows CNG execution requires a Windows CNG profile");
  }
  const existing = readAsoiafAnswerCredentialProviderStatus(input.root).results
    .find((entry) => entry.providerInvocationId === providerInvocation.providerInvocationId);
  if (existing) return { result: existing, replayed: true };
  const brokerInvocation = brokerInvocationById(input.root, providerInvocation.brokerInvocationId);
  const output = runWindows({
    command: "sign",
    thumbprint: selector(
      input.credentialCertificateThumbprint,
      profile.credentialSelectorDigest,
      "credential certificate selector",
    ),
    messageBase64: serializeAsoiafAnswerCredentialBrokerInvocation(brokerInvocation)
      .toString("base64"),
  }, input.powershellExecutable);
  const binding = bindingById(input.root, profile.brokerBindingId);
  if (String(output.certificateFingerprint).toLowerCase() !== binding.certificateFingerprint) {
    throw new Error("Windows CNG certificate differs from active deployment binding");
  }
  return retainResult(input.root, buildPossessionResult({
    root: input.root,
    providerInvocation,
    profile,
    algorithm: String(output.algorithm) as AsoiafAnswerTransportProofAlgorithm,
    signature: Buffer.from(String(output.signatureBase64), "base64"),
    completedAt: input.completedAt,
    operatorId: input.operatorId,
  }));
}

export function executeAsoiafAnswerWindowsCngTransport(
  input: AsoiafAnswerCredentialWindowsTransportInput,
): { result: AsoiafAnswerCredentialProviderResult; replayed: boolean } {
  const providerInvocation = providerInvocationById(input.root, input.providerInvocationId);
  const profile = profileById(input.root, providerInvocation.profileId);
  if (profile.hostKind !== "windows-cng") {
    throw new Error("Windows CNG execution requires a Windows CNG profile");
  }
  const existing = readAsoiafAnswerCredentialProviderStatus(input.root).results
    .find((entry) => entry.providerInvocationId === providerInvocation.providerInvocationId);
  if (existing) return { result: existing, replayed: true };
  const brokerInvocation = brokerInvocationById(input.root, providerInvocation.brokerInvocationId);
  if (
    brokerInvocation.operation !== "mutual-tls-request"
    || brokerInvocation.request.kind !== "mutual-tls"
  ) {
    throw new Error("Windows CNG transport requires a mutual-TLS broker invocation");
  }
  const requestBody = Buffer.from(input.requestBodyBase64, "base64");
  if (
    requestBody.length !== brokerInvocation.request.requestBodyBytes
    || bytesDigest(requestBody) !== brokerInvocation.request.requestBodyDigest
  ) {
    throw new Error("Windows CNG request body differs from broker invocation custody");
  }
  const network = runWindows({
    command: "mutual-tls",
    credentialThumbprint: selector(
      input.credentialCertificateThumbprint,
      profile.credentialSelectorDigest,
      "credential certificate selector",
    ),
    method: brokerInvocation.request.method,
    targetUrl: brokerInvocation.request.targetUrl,
    requestBodyBase64: input.requestBodyBase64,
    maxResponseBytes: Math.min(profile.maxResponseBytes, brokerInvocation.request.maxResponseBytes),
    expectedServerCertificateFingerprint:
      brokerInvocation.request.expectedServerCertificateFingerprint,
    expectedServerIssuerFingerprint:
      brokerInvocation.request.expectedServerIssuerFingerprint,
  }, input.powershellExecutable);
  const responseDigest = requireDigest(String(network.responseDigest), "Windows response digest");
  const lowerRequestFingerprint = sha256({
    brokerInvocationFingerprint: brokerInvocation.invocationFingerprint,
    requestBodyDigest: brokerInvocation.request.requestBodyDigest,
  });
  const lowerResponseFingerprint = sha256({
    lowerRequestFingerprint,
    httpStatus: Number(network.httpStatus),
    responseDigest,
  });
  const providerReceiptDigest = sha256({
    providerInvocationFingerprint: providerInvocation.providerInvocationFingerprint,
    network,
  });
  const statement = buildAsoiafAnswerCredentialTransportResultStatement({
    root: input.root,
    invocationId: brokerInvocation.invocationId,
    lowerRequestId: collectorContentId(
      "asoiaf-answer-provider-lower-request",
      lowerRequestFingerprint,
    ),
    lowerRequestFingerprint,
    lowerResponseId: collectorContentId(
      "asoiaf-answer-provider-lower-response",
      lowerResponseFingerprint,
    ),
    lowerResponseFingerprint,
    observedServerCertificateFingerprint: requireDigest(
      String(network.observedServerCertificateFingerprint),
      "observed server certificate fingerprint",
    ),
    observedServerIssuerFingerprint: requireDigest(
      String(network.observedServerIssuerFingerprint),
      "observed server issuer fingerprint",
    ),
    httpStatus: requireInteger(Number(network.httpStatus), "HTTP status", 599),
    responseBytes: requireInteger(
      Number(network.responseBytes),
      "response byte count",
      profile.maxResponseBytes,
    ),
    responseDigest,
    providerReceiptDigest,
    startedAt: requireTime(String(network.startedAt), "Windows transport start time"),
    completedAt: requireTime(String(network.completedAt), "Windows transport completion time"),
  });
  const signed = runWindows({
    command: "sign",
    thumbprint: selector(
      input.deviceAgentCertificateThumbprint,
      profile.deviceAgentSelectorDigest,
      "device-agent certificate selector",
    ),
    messageBase64: serializeAsoiafAnswerCredentialTransportResultStatement(statement)
      .toString("base64"),
  }, input.powershellExecutable);
  return retainResult(input.root, buildTransportResult({
    root: input.root,
    providerInvocation,
    profile,
    statement,
    algorithm: String(signed.algorithm) as AsoiafAnswerTransportProofAlgorithm,
    signature: Buffer.from(String(signed.signatureBase64), "base64"),
    operatorId: input.operatorId,
  }));
}

function secretFindings(root: string): AsoiafAnswerCredentialProviderFinding[] {
  const findings: AsoiafAnswerCredentialProviderFinding[] = [];
  const providerRoot = asoiafAnswerCredentialProviderHostPaths(root).providerRoot;
  if (!fs.existsSync(providerRoot)) return findings;
  const directories = [providerRoot];
  const pattern = /BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY|BEGIN CERTIFICATE(?: REQUEST)?|provider(?:Pin|Password|Token|Secret|Session)\s*[":=]|pkcs11:[^\s"']+/i;
  while (directories.length > 0) {
    const directory = directories.pop()!;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        directories.push(target);
        continue;
      }
      if (/\.(?:key|crt|pem|csr|p12|pfx)$/i.test(entry.name)) {
        findings.push(finding(
          "provider-secret-path",
          "error",
          target,
          "credential provider retained a forbidden credential path",
        ));
      }
      if (pattern.test(fs.readFileSync(target, "utf8"))) {
        findings.push(finding(
          "provider-secret-content",
          "error",
          target,
          "credential provider retained forbidden key, certificate, or provider-secret content",
        ));
      }
    }
  }
  return findings;
}

export function verifyAsoiafAnswerCredentialProviderHostEstate(
  root: string,
): AsoiafAnswerCredentialProviderFinding[] {
  const findings: AsoiafAnswerCredentialProviderFinding[] = [];
  for (const entry of verifyAsoiafAnswerCredentialBrokerEstate(root)) {
    findings.push(finding(
      `broker:${entry.code}`,
      entry.severity,
      entry.subjectId,
      entry.detail,
    ));
  }
  let status: AsoiafAnswerCredentialProviderStatus;
  try {
    status = readAsoiafAnswerCredentialProviderStatus(root);
  } catch (error) {
    return [finding(
      "provider-estate-read",
      "error",
      path.resolve(root),
      error instanceof Error ? error.message : String(error),
    )];
  }
  const broker = readAsoiafAnswerCredentialBrokerStatus(root);
  const deployment = readAsoiafAnswerCredentialDeploymentStatus(root);

  for (const profile of status.profiles) {
    try {
      if (profile.format !== ASOIAF_ANSWER_CREDENTIAL_PROVIDER_PROFILE_FORMAT) {
        throw new Error("provider profile format is invalid");
      }
      if (profile.profileFingerprint !== sha256(profileCore(profile))) {
        throw new Error("provider profile fingerprint is stale");
      }
      const policy = broker.policies.find((entry) => entry.policyId === profile.brokerPolicyId);
      const binding = broker.bindings.find((entry) => entry.bindingId === profile.brokerBindingId);
      if (!policy || !binding) {
        throw new Error("provider profile references absent broker policy or binding");
      }
      if (
        policy.policyFingerprint !== profile.brokerPolicyFingerprint
        || binding.bindingFingerprint !== profile.brokerBindingFingerprint
        || binding.deploymentStateId !== profile.deploymentStateId
        || binding.deploymentStateFingerprint !== profile.deploymentStateFingerprint
        || binding.deviceId !== profile.deviceId
        || binding.serviceId !== profile.serviceId
        || binding.keyReferenceId !== profile.keyReferenceId
        || binding.providerClass !== profile.providerClass
        || expectedHostKind(binding.providerClass) !== profile.hostKind
      ) {
        throw new Error("provider profile differs from broker binding custody");
      }
      if (
        profile.certificateRetained
        || profile.privateKeyRetained
        || profile.privateKeyPathRetained
        || profile.rawProviderSelectorRetained
        || profile.providerSecretRetained
        || profile.rawResponseRetained
        || profile.authority !== "none"
        || profile.graphEffect !== "none"
        || profile.canonEffect !== "none"
        || profile.answerEffect !== "none"
      ) {
        throw new Error("provider profile crossed retention or authority boundary");
      }
    } catch (error) {
      findings.push(finding(
        "provider-profile-invalid",
        "error",
        profile.profileId,
        error instanceof Error ? error.message : String(error),
      ));
    }
  }

  for (const invocation of status.invocations) {
    try {
      if (invocation.format !== ASOIAF_ANSWER_CREDENTIAL_PROVIDER_INVOCATION_FORMAT) {
        throw new Error("provider invocation format is invalid");
      }
      if (invocation.providerInvocationFingerprint !== sha256(invocationCore(invocation))) {
        throw new Error("provider invocation fingerprint is stale");
      }
      const profile = status.profiles.find((entry) => entry.profileId === invocation.profileId);
      const brokerInvocation = broker.invocations.find(
        (entry) => entry.invocationId === invocation.brokerInvocationId,
      );
      if (!profile || !brokerInvocation) {
        throw new Error("provider invocation references absent profile or broker invocation");
      }
      if (
        profile.profileFingerprint !== invocation.profileFingerprint
        || brokerInvocation.invocationFingerprint !== invocation.brokerInvocationFingerprint
        || invocation.brokerInvocationBytesDigest !== bytesDigest(
          serializeAsoiafAnswerCredentialBrokerInvocation(brokerInvocation),
        )
        || brokerInvocation.bindingId !== invocation.brokerBindingId
        || brokerInvocation.bindingFingerprint !== invocation.brokerBindingFingerprint
        || brokerInvocation.operation !== invocation.operation
      ) {
        throw new Error("provider invocation differs from broker custody");
      }
    } catch (error) {
      findings.push(finding(
        "provider-invocation-invalid",
        "error",
        invocation.providerInvocationId,
        error instanceof Error ? error.message : String(error),
      ));
    }
  }

  for (const result of status.results) {
    try {
      if (result.format !== ASOIAF_ANSWER_CREDENTIAL_PROVIDER_RESULT_FORMAT) {
        throw new Error("provider result format is invalid");
      }
      if (result.resultFingerprint !== sha256(resultCore(result))) {
        throw new Error("provider result fingerprint is stale");
      }
      const invocation = status.invocations.find(
        (entry) => entry.providerInvocationId === result.providerInvocationId,
      );
      const profile = status.profiles.find((entry) => entry.profileId === result.profileId);
      const binding = broker.bindings.find(
        (entry) => entry.bindingId === invocation?.brokerBindingId,
      );
      const key = deployment.keys.find(
        (entry) => entry.keyReferenceId === binding?.keyReferenceId,
      );
      const device = deployment.devices.find(
        (entry) => entry.deviceId === binding?.deviceId,
      );
      const brokerInvocation = broker.invocations.find(
        (entry) => entry.invocationId === result.brokerInvocationId,
      );
      if (!invocation || !profile || !binding || !key || !device || !brokerInvocation) {
        throw new Error("provider result references absent parent custody");
      }
      if (result.output.kind === "possession-proof") {
        if (!verifySignature({
          spkiBase64: key.publicKeySpkiBase64,
          algorithm: result.output.signatureAlgorithm,
          message: serializeAsoiafAnswerCredentialBrokerInvocation(brokerInvocation),
          signatureBase64: result.output.signatureBase64,
        })) {
          throw new Error("provider possession signature is invalid");
        }
      } else if (!verifySignature({
        spkiBase64: device.deviceAgentPublicKeySpkiBase64,
        algorithm: result.output.deviceAgentSignatureAlgorithm,
        message: serializeAsoiafAnswerCredentialTransportResultStatement(
          result.output.statement,
        ),
        signatureBase64: result.output.deviceAgentSignatureBase64,
      })) {
        throw new Error("provider transport device-agent signature is invalid");
      }
      if (
        result.certificateRetained
        || result.privateKeyRetained
        || result.privateKeyPathRetained
        || result.rawProviderSelectorRetained
        || result.providerSecretRetained
        || result.rawResponseRetained
        || result.authority !== "none"
        || result.graphEffect !== "none"
        || result.canonEffect !== "none"
        || result.answerEffect !== "none"
      ) {
        throw new Error("provider result crossed retention or authority boundary");
      }
    } catch (error) {
      findings.push(finding(
        "provider-result-invalid",
        "error",
        result.resultId,
        error instanceof Error ? error.message : String(error),
      ));
    }
  }

  if (status.profiles.length > 0) {
    const expected = buildState(root);
    if (!status.state) {
      findings.push(finding(
        "provider-state-missing",
        "error",
        status.paths.state,
        "provider state is absent",
      ));
    } else if (
      status.state.stateFingerprint !== sha256(stateCore(status.state))
      || stableJson(status.state) !== stableJson(expected)
    ) {
      findings.push(finding(
        "provider-state-invalid",
        "error",
        status.state.stateId,
        "provider state differs from append-only records",
      ));
    }
  }

  for (const invocation of status.invocations) {
    if (!status.results.some(
      (entry) => entry.providerInvocationId === invocation.providerInvocationId,
    )) {
      findings.push(finding(
        "provider-invocation-pending",
        "notice",
        invocation.providerInvocationId,
        "provider invocation has no public terminal result",
      ));
    }
  }

  for (const [directory, code] of [
    [status.paths.profiles, "provider-profile-filename"],
    [status.paths.invocations, "provider-invocation-filename"],
    [status.paths.results, "provider-result-filename"],
  ] as const) {
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory).sort()) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) {
        findings.push(finding(
          code,
          "error",
          name,
          "provider filename is not a SHA-256 digest",
        ));
      }
    }
  }
  findings.push(...secretFindings(root));
  return sortFindings(findings);
}
