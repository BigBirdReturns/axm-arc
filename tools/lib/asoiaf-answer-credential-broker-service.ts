import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import {
  collectorContentId,
  sha256,
} from "./asoiaf-external-estate.js";
import {
  readAsoiafAnswerCredentialBrokerStatus,
  verifyAsoiafAnswerCredentialBrokerEstate,
  type AsoiafAnswerCredentialBrokerPolicy,
} from "./asoiaf-answer-credential-broker.js";
import {
  executeAsoiafAnswerSyntheticPossession,
  executeAsoiafAnswerSyntheticTransport,
  executeAsoiafAnswerWindowsCngPossession,
  executeAsoiafAnswerWindowsCngTransport,
  prepareAsoiafAnswerCredentialProviderInvocation,
  readAsoiafAnswerCredentialProviderStatus,
  verifyAsoiafAnswerCredentialProviderHostEstate,
  type AsoiafAnswerCredentialProviderHostKind,
  type AsoiafAnswerCredentialProviderInvocation,
  type AsoiafAnswerCredentialProviderProfile,
  type AsoiafAnswerCredentialProviderResult,
  type AsoiafAnswerCredentialProviderStatus,
} from "./asoiaf-answer-credential-provider-host.js";
import type {
  AsoiafAnswerTransportProofAlgorithm,
} from "./asoiaf-answer-desk-transport-enrollment.js";

export const ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_POLICY_FORMAT =
  "axm-asoiaf-answer-credential-broker-service-policy/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_REQUEST_FORMAT =
  "axm-asoiaf-answer-credential-broker-service-request/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_RECEIPT_FORMAT =
  "axm-asoiaf-answer-credential-broker-service-receipt/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_STATE_FORMAT =
  "axm-asoiaf-answer-credential-broker-service-state/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_WIRE_REQUEST_FORMAT =
  "axm-asoiaf-answer-credential-broker-service-wire-request/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_WIRE_RESPONSE_FORMAT =
  "axm-asoiaf-answer-credential-broker-service-wire-response/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_ENDPOINT_PROBE_FORMAT =
  "axm-asoiaf-answer-credential-broker-service-endpoint-probe/1" as const;

export type AsoiafAnswerCredentialBrokerServiceOperation =
  | "prepare-provider-invocation"
  | "execute-possession"
  | "execute-transport";

export type AsoiafAnswerCredentialBrokerServiceEndpointKind =
  | "unix"
  | "npipe";

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

export interface AsoiafAnswerCredentialBrokerServicePaths {
  root: string;
  serviceRoot: string;
  policies: string;
  requests: string;
  receipts: string;
  state: string;
  lock: string;
}

export interface AsoiafAnswerCredentialBrokerServicePolicy extends NoAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_POLICY_FORMAT;
  servicePolicyId: string;
  servicePolicyFingerprint: `sha256:${string}`;
  brokerPolicyId: string;
  brokerPolicyFingerprint: `sha256:${string}`;
  providerProfileId: string;
  providerProfileFingerprint: `sha256:${string}`;
  deviceId: string;
  serviceId: string;
  providerHostKind: AsoiafAnswerCredentialProviderHostKind;
  localEndpoint: string;
  endpointKind: AsoiafAnswerCredentialBrokerServiceEndpointKind;
  clientId: string;
  clientPublicKeySpkiBase64: string;
  clientPublicKeyFingerprint: `sha256:${string}`;
  clientSignatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  allowedOperations: AsoiafAnswerCredentialBrokerServiceOperation[];
  maxRequestLifetimeMilliseconds: number;
  maxRequestBytes: number;
  maxResponseBytes: number;
  createdAt: string;
  operatorId: string;
  localEndpointOnly: true;
  privateKeyRetained: false;
  privateKeyPathRetained: false;
  rawProviderSelectorRetained: false;
  providerSecretRetained: false;
  rawRequestBodyRetained: false;
  rawResponseBodyRetained: false;
  serviceAuthority: "local-request-admission-only";
}

interface ServiceRequestUnsigned extends NoAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_REQUEST_FORMAT;
  servicePolicyId: string;
  servicePolicyFingerprint: `sha256:${string}`;
  brokerPolicyId: string;
  brokerPolicyFingerprint: `sha256:${string}`;
  providerProfileId: string;
  providerProfileFingerprint: `sha256:${string}`;
  localEndpoint: string;
  endpointKind: AsoiafAnswerCredentialBrokerServiceEndpointKind;
  clientId: string;
  clientPublicKeyFingerprint: `sha256:${string}`;
  operation: AsoiafAnswerCredentialBrokerServiceOperation;
  idempotencyKeyDigest: `sha256:${string}`;
  payloadDigest: `sha256:${string}`;
  payloadBytes: number;
  issuedAt: string;
  expiresAt: string;
  privateKeyRetained: false;
  privateKeyPathRetained: false;
  rawProviderSelectorRetained: false;
  providerSecretRetained: false;
  rawRequestBodyRetained: false;
  requestAuthority: "caller-request-only";
}

export interface AsoiafAnswerCredentialBrokerServiceRequest
  extends ServiceRequestUnsigned {
  requestId: string;
  requestFingerprint: `sha256:${string}`;
  signatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  signatureBase64: string;
  signatureDigest: `sha256:${string}`;
  signatureVerified: true;
}

export interface AsoiafAnswerCredentialBrokerServicePreparePayload {
  kind: "prepare-provider-invocation";
  brokerInvocationId: string;
  providerIdempotencyKey: string;
  preparedAt: string;
  expiresAt: string;
}

export interface AsoiafAnswerCredentialBrokerServiceSyntheticPossessionPayload {
  kind: "execute-possession";
  hostKind: "synthetic-fixture";
  providerInvocationId: string;
  credentialPrivateKeyPem: string;
  completedAt: string;
}

export interface AsoiafAnswerCredentialBrokerServiceWindowsPossessionPayload {
  kind: "execute-possession";
  hostKind: "windows-cng";
  providerInvocationId: string;
  credentialCertificateThumbprint: string;
  completedAt: string;
}

export interface AsoiafAnswerCredentialBrokerServiceSyntheticTransportPayload {
  kind: "execute-transport";
  hostKind: "synthetic-fixture";
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
}

export interface AsoiafAnswerCredentialBrokerServiceWindowsTransportPayload {
  kind: "execute-transport";
  hostKind: "windows-cng";
  providerInvocationId: string;
  credentialCertificateThumbprint: string;
  deviceAgentCertificateThumbprint: string;
  requestBodyBase64: string;
  completedAt: string;
}

export type AsoiafAnswerCredentialBrokerServicePayload =
  | AsoiafAnswerCredentialBrokerServicePreparePayload
  | AsoiafAnswerCredentialBrokerServiceSyntheticPossessionPayload
  | AsoiafAnswerCredentialBrokerServiceWindowsPossessionPayload
  | AsoiafAnswerCredentialBrokerServiceSyntheticTransportPayload
  | AsoiafAnswerCredentialBrokerServiceWindowsTransportPayload;

export interface AsoiafAnswerCredentialBrokerServiceProviderInvocationResponse {
  kind: "provider-invocation";
  providerReplayed: boolean;
  invocation: AsoiafAnswerCredentialProviderInvocation;
}

export interface AsoiafAnswerCredentialBrokerServiceProviderResultResponse {
  kind: "provider-result";
  providerReplayed: boolean;
  result: AsoiafAnswerCredentialProviderResult;
}

export type AsoiafAnswerCredentialBrokerServiceResponse =
  | AsoiafAnswerCredentialBrokerServiceProviderInvocationResponse
  | AsoiafAnswerCredentialBrokerServiceProviderResultResponse;

export interface AsoiafAnswerCredentialBrokerServiceReceipt extends NoAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_RECEIPT_FORMAT;
  receiptId: string;
  receiptFingerprint: `sha256:${string}`;
  requestId: string;
  requestFingerprint: `sha256:${string}`;
  servicePolicyId: string;
  servicePolicyFingerprint: `sha256:${string}`;
  brokerPolicyId: string;
  providerProfileId: string;
  providerProfileFingerprint: `sha256:${string}`;
  clientId: string;
  operation: AsoiafAnswerCredentialBrokerServiceOperation;
  idempotencyKeyDigest: `sha256:${string}`;
  payloadDigest: `sha256:${string}`;
  acceptedAt: string;
  completedAt: string;
  response: AsoiafAnswerCredentialBrokerServiceResponse;
  responseDigest: `sha256:${string}`;
  responseBytes: number;
  privateKeyRetained: false;
  privateKeyPathRetained: false;
  rawProviderSelectorRetained: false;
  providerSecretRetained: false;
  rawRequestBodyRetained: false;
  rawResponseBodyRetained: false;
  receiptAuthority: "provider-execution-reference-only";
}

export interface AsoiafAnswerCredentialBrokerServiceStateEntry {
  servicePolicyId: string;
  servicePolicyFingerprint: `sha256:${string}`;
  providerProfileId: string;
  localEndpoint: string;
  clientId: string;
  latestRequestId: string | null;
  latestRequestFingerprint: `sha256:${string}` | null;
  latestReceiptId: string | null;
  latestReceiptFingerprint: `sha256:${string}` | null;
  pendingRequestIds: string[];
  updatedAt: string;
}

export interface AsoiafAnswerCredentialBrokerServiceState extends NoAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_STATE_FORMAT;
  stateId: string;
  stateFingerprint: `sha256:${string}`;
  asOf: string;
  entries: AsoiafAnswerCredentialBrokerServiceStateEntry[];
  stateAuthority: "projection-only";
}

export interface AsoiafAnswerCredentialBrokerServiceStatus {
  format: "axm-asoiaf-answer-credential-broker-service-status/1";
  paths: AsoiafAnswerCredentialBrokerServicePaths;
  policies: AsoiafAnswerCredentialBrokerServicePolicy[];
  requests: AsoiafAnswerCredentialBrokerServiceRequest[];
  receipts: AsoiafAnswerCredentialBrokerServiceReceipt[];
  state: AsoiafAnswerCredentialBrokerServiceState | null;
}

export interface AsoiafAnswerCredentialBrokerServiceFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

export interface AsoiafAnswerCredentialBrokerServicePolicyInput {
  root: string;
  brokerPolicyId: string;
  providerProfileId: string;
  clientId: string;
  clientPublicKeySpkiBase64: string;
  allowedOperations: AsoiafAnswerCredentialBrokerServiceOperation[];
  maxRequestLifetimeMilliseconds: number;
  maxRequestBytes: number;
  maxResponseBytes: number;
  createdAt: string;
  operatorId: string;
}

export interface AsoiafAnswerCredentialBrokerServiceRequestInput {
  root: string;
  servicePolicyId: string;
  operation: AsoiafAnswerCredentialBrokerServiceOperation;
  idempotencyKey: string;
  payload: AsoiafAnswerCredentialBrokerServicePayload;
  issuedAt: string;
  expiresAt: string;
  clientPrivateKeyPem: string;
}

export interface AsoiafAnswerCredentialBrokerServiceDispatchInput {
  root: string;
  request: AsoiafAnswerCredentialBrokerServiceRequest;
  payload: AsoiafAnswerCredentialBrokerServicePayload;
  receivedAt: string;
  completedAt?: string;
  powershellExecutable?: string;
}

export interface AsoiafAnswerCredentialBrokerServiceDispatchResult {
  request: AsoiafAnswerCredentialBrokerServiceRequest;
  receipt: AsoiafAnswerCredentialBrokerServiceReceipt;
  response: AsoiafAnswerCredentialBrokerServiceResponse;
  requestReplayed: boolean;
  receiptReplayed: boolean;
}

export interface AsoiafAnswerCredentialBrokerServiceWireRequest {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_WIRE_REQUEST_FORMAT;
  request: AsoiafAnswerCredentialBrokerServiceRequest;
  payload: AsoiafAnswerCredentialBrokerServicePayload;
}

export type AsoiafAnswerCredentialBrokerServiceWireResponse =
  | {
      format: typeof ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_WIRE_RESPONSE_FORMAT;
      ok: true;
      result: AsoiafAnswerCredentialBrokerServiceDispatchResult;
    }
  | {
      format: typeof ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_WIRE_RESPONSE_FORMAT;
      ok: false;
      error: {
        code: "service-request-rejected";
        message: string;
      };
    };

export interface AsoiafAnswerCredentialBrokerServiceServerInput {
  root: string;
  servicePolicyId: string;
  maxRequests?: number;
  powershellExecutable?: string;
  clock?: () => string;
}

export interface AsoiafAnswerCredentialBrokerServiceServer {
  endpoint: string;
  endpointKind: AsoiafAnswerCredentialBrokerServiceEndpointKind;
  address: string;
  startedAt: string;
  servedRequests: () => number;
  close: () => Promise<void>;
  closed: Promise<{
    endpoint: string;
    startedAt: string;
    stoppedAt: string;
    servedRequests: number;
  }>;
}

export interface AsoiafAnswerCredentialBrokerServiceInvokeInput {
  endpoint: string;
  request: AsoiafAnswerCredentialBrokerServiceRequest;
  payload: AsoiafAnswerCredentialBrokerServicePayload;
  timeoutMilliseconds?: number;
  maxResponseBytes?: number;
}

export interface AsoiafAnswerCredentialBrokerServiceEndpointProbe extends NoAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_ENDPOINT_PROBE_FORMAT;
  endpoint: string;
  endpointKind: AsoiafAnswerCredentialBrokerServiceEndpointKind;
  addressDigest: `sha256:${string}`;
  challengeDigest: `sha256:${string}`;
  responseDigest: `sha256:${string}`;
  startedAt: string;
  completedAt: string;
  localEndpointOnly: true;
  requestBodyRetained: false;
  responseBodyRetained: false;
  probeAuthority: "transport-health-only";
}

const MAX_REQUEST_LIFETIME = 15 * 60 * 1000;
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_WIRE_OVERHEAD = 256 * 1024;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function stableBytes(value: unknown): Buffer {
  return Buffer.from(stableJson(value), "utf8");
}

function bytesDigest(value: Buffer): `sha256:${string}` {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function requireTime(value: string, label: string): string {
  if (!value.trim() || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} is invalid`);
  }
  return new Date(value).toISOString();
}

function requireId(value: string, label: string, maximum = 1024): string {
  const normalized = value.trim();
  if (
    normalized.length < 3
    || normalized.length > maximum
    || /[\r\n\0]/.test(normalized)
  ) {
    throw new Error(`${label} is invalid`);
  }
  return normalized;
}

function requireDigest(value: string, label: string): `sha256:${string}` {
  const normalized = value.trim().toLowerCase();
  if (!/^sha256:[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
  return normalized as `sha256:${string}`;
}

function requireInteger(value: number, label: string, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} must be an integer from 1 through ${maximum}`);
  }
  return value;
}

function requireBase64(value: string, label: string, allowEmpty = false): string {
  const normalized = value.trim();
  if (!normalized && allowEmpty) return "";
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)) {
    throw new Error(`${label} must be canonical base64`);
  }
  return normalized;
}

function requirePem(value: string, label: string): string {
  if (
    value.length < 64
    || value.length > 128 * 1024
    || !/-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/.test(value)
  ) {
    throw new Error(`${label} is not a bounded private-key PEM`);
  }
  return value;
}

function requireExactKeys(
  value: unknown,
  keys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((entry, index) => entry !== expected[index])) {
    throw new Error(`${label} contains unsupported or missing fields`);
  }
  return record;
}

function requireOperation(value: string): AsoiafAnswerCredentialBrokerServiceOperation {
  if (![
    "prepare-provider-invocation",
    "execute-possession",
    "execute-transport",
  ].includes(value)) {
    throw new Error(`credential broker service operation ${value} is invalid`);
  }
  return value as AsoiafAnswerCredentialBrokerServiceOperation;
}

function sortedOperations(
  values: readonly AsoiafAnswerCredentialBrokerServiceOperation[],
): AsoiafAnswerCredentialBrokerServiceOperation[] {
  const operations = [...new Set(values.map(requireOperation))]
    .sort((left, right) => left.localeCompare(right));
  if (operations.length < 1) {
    throw new Error("credential broker service policy requires at least one operation");
  }
  return operations;
}

function keyAlgorithm(key: crypto.KeyObject): AsoiafAnswerTransportProofAlgorithm {
  if (key.asymmetricKeyType === "ed25519") return "ed25519";
  if (key.asymmetricKeyType === "ec") return "ecdsa-sha256";
  if (key.asymmetricKeyType === "rsa" || key.asymmetricKeyType === "rsa-pss") {
    return "rsa-sha256";
  }
  throw new Error(`unsupported credential broker service key type ${key.asymmetricKeyType ?? "unknown"}`);
}

function signBytes(key: crypto.KeyObject, message: Buffer): {
  algorithm: AsoiafAnswerTransportProofAlgorithm;
  signature: Buffer;
} {
  const algorithm = keyAlgorithm(key);
  return {
    algorithm,
    signature: crypto.sign(algorithm === "ed25519" ? null : "sha256", message, key),
  };
}

function verifyBytes(input: {
  key: crypto.KeyObject;
  algorithm: AsoiafAnswerTransportProofAlgorithm;
  message: Buffer;
  signature: Buffer;
}): boolean {
  if (keyAlgorithm(input.key) !== input.algorithm) return false;
  return crypto.verify(
    input.algorithm === "ed25519" ? null : "sha256",
    input.message,
    input.key,
    input.signature,
  );
}

function publicKeyFromSpki(spkiBase64: string): crypto.KeyObject {
  return crypto.createPublicKey({
    key: Buffer.from(requireBase64(spkiBase64, "client public key"), "base64"),
    type: "spki",
    format: "der",
  });
}

function asPublicKey(key: crypto.KeyObject): crypto.KeyObject {
  if (key.type === "public") return key;
  if (key.type === "private") return crypto.createPublicKey(key);
  throw new Error("credential broker service key must be public or private asymmetric material");
}

function publicKeySpkiBase64(key: crypto.KeyObject): string {
  return (asPublicKey(key).export({ type: "spki", format: "der" }) as Buffer)
    .toString("base64");
}

function publicKeyFingerprint(key: crypto.KeyObject): `sha256:${string}` {
  return bytesDigest(
    asPublicKey(key).export({ type: "spki", format: "der" }) as Buffer,
  );
}

function normalizeSignatureAlgorithm(value: string): AsoiafAnswerTransportProofAlgorithm {
  if (![
    "ed25519",
    "ecdsa-sha256",
    "rsa-sha256",
  ].includes(value)) {
    throw new Error(`credential broker service signature algorithm ${value} is invalid`);
  }
  return value as AsoiafAnswerTransportProofAlgorithm;
}

function finding(
  code: string,
  severity: AsoiafAnswerCredentialBrokerServiceFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafAnswerCredentialBrokerServiceFinding {
  return { code, severity, subjectId, detail };
}

function sortFindings(
  values: readonly AsoiafAnswerCredentialBrokerServiceFinding[],
): AsoiafAnswerCredentialBrokerServiceFinding[] {
  const rank = { error: 0, warning: 1, notice: 2 } as const;
  return [...values].sort((left, right) =>
    rank[left.severity] - rank[right.severity]
    || left.code.localeCompare(right.code)
    || left.subjectId.localeCompare(right.subjectId)
    || left.detail.localeCompare(right.detail));
}

export function asoiafAnswerCredentialBrokerServiceEndpoint(input: string): {
  endpoint: string;
  endpointKind: AsoiafAnswerCredentialBrokerServiceEndpointKind;
  address: string;
} {
  const endpoint = input.trim();
  if (/\s/.test(endpoint)) {
    throw new Error("credential broker service endpoint cannot contain whitespace");
  }
  if (endpoint.startsWith("unix://")) {
    const socketPath = endpoint.slice("unix://".length);
    if (
      !socketPath.startsWith("/")
      || socketPath.length > 512
      || socketPath.includes("%")
      || path.posix.normalize(socketPath) !== socketPath
    ) {
      throw new Error("credential broker service unix endpoint must contain one normalized absolute socket path");
    }
    return { endpoint: `unix://${socketPath}`, endpointKind: "unix", address: socketPath };
  }
  if (endpoint.startsWith("npipe://")) {
    const name = endpoint.slice("npipe://".length);
    if (!/^[A-Za-z0-9._-]{3,128}$/.test(name)) {
      throw new Error("credential broker service npipe endpoint must contain one bounded pipe name");
    }
    return {
      endpoint: `npipe://${name}`,
      endpointKind: "npipe",
      address: `\\\\.\\pipe\\${name}`,
    };
  }
  if (endpoint.startsWith("loopback-https://")) {
    throw new Error("loopback-https requires the separately qualified broker-service TLS listener");
  }
  throw new Error("credential broker service endpoint must use unix:// or npipe:// local IPC custody");
}

export function asoiafAnswerCredentialBrokerServicePaths(
  root: string,
): AsoiafAnswerCredentialBrokerServicePaths {
  const absolute = path.resolve(root);
  const serviceRoot = path.join(absolute, "answer-credential-broker-service");
  return {
    root: absolute,
    serviceRoot,
    policies: path.join(serviceRoot, "policies"),
    requests: path.join(serviceRoot, "requests"),
    receipts: path.join(serviceRoot, "receipts"),
    state: path.join(serviceRoot, "SERVICE-STATE.json"),
    lock: path.join(serviceRoot, ".service-lock"),
  };
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
      throw new Error(`credential broker service immutable file collision at ${target}`);
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

function withServiceLock<T>(root: string, operation: () => T): T {
  const paths = asoiafAnswerCredentialBrokerServicePaths(root);
  fs.mkdirSync(paths.serviceRoot, { recursive: true });
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(paths.lock, "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("credential broker service estate is already processing a request");
    }
    throw error;
  }
  try {
    return operation();
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
    fs.rmSync(paths.lock, { force: true });
  }
}

function parentObjects(root: string): {
  brokerPolicies: AsoiafAnswerCredentialBrokerPolicy[];
  providerProfiles: AsoiafAnswerCredentialProviderProfile[];
  providerStatus: AsoiafAnswerCredentialProviderStatus;
} {
  const brokerErrors = verifyAsoiafAnswerCredentialBrokerEstate(root)
    .filter((entry) => entry.severity === "error");
  if (brokerErrors.length > 0) {
    throw new Error(`credential broker service requires a valid broker estate: ${brokerErrors.map((entry) => entry.code).join(", ")}`);
  }
  const providerErrors = verifyAsoiafAnswerCredentialProviderHostEstate(root)
    .filter((entry) => entry.severity === "error");
  if (providerErrors.length > 0) {
    throw new Error(`credential broker service requires a valid provider estate: ${providerErrors.map((entry) => entry.code).join(", ")}`);
  }
  const broker = readAsoiafAnswerCredentialBrokerStatus(root);
  const provider = readAsoiafAnswerCredentialProviderStatus(root);
  return {
    brokerPolicies: broker.policies,
    providerProfiles: provider.profiles,
    providerStatus: provider,
  };
}

function exactlyOne<T>(
  values: readonly T[],
  predicate: (entry: T) => boolean,
  label: string,
): T {
  const matches = values.filter(predicate);
  if (matches.length !== 1) {
    throw new Error(`${label} is absent or duplicated`);
  }
  return matches[0]!;
}

function servicePolicyById(
  root: string,
  servicePolicyId: string,
): AsoiafAnswerCredentialBrokerServicePolicy {
  return exactlyOne(
    readAsoiafAnswerCredentialBrokerServiceStatus(root).policies,
    (entry) => entry.servicePolicyId === servicePolicyId,
    `credential broker service policy ${servicePolicyId}`,
  );
}

function policyCore(value: AsoiafAnswerCredentialBrokerServicePolicy) {
  const {
    servicePolicyId: _id,
    servicePolicyFingerprint: _fingerprint,
    ...core
  } = value;
  return core;
}

function requestUnsigned(value: AsoiafAnswerCredentialBrokerServiceRequest): ServiceRequestUnsigned {
  const {
    requestId: _id,
    requestFingerprint: _fingerprint,
    signatureAlgorithm: _algorithm,
    signatureBase64: _signature,
    signatureDigest: _signatureDigest,
    signatureVerified: _verified,
    ...unsigned
  } = value;
  return unsigned;
}

function receiptCore(value: AsoiafAnswerCredentialBrokerServiceReceipt) {
  const {
    receiptId: _id,
    receiptFingerprint: _fingerprint,
    ...core
  } = value;
  return core;
}

function stateCore(value: AsoiafAnswerCredentialBrokerServiceState) {
  const {
    stateId: _id,
    stateFingerprint: _fingerprint,
    ...core
  } = value;
  return core;
}

export function serializeAsoiafAnswerCredentialBrokerServiceRequest(
  request: AsoiafAnswerCredentialBrokerServiceRequest,
): Buffer {
  return stableBytes({
    ...requestUnsigned(request),
    requestId: request.requestId,
    requestFingerprint: request.requestFingerprint,
  });
}

function buildState(root: string): AsoiafAnswerCredentialBrokerServiceState {
  const status = readAsoiafAnswerCredentialBrokerServiceStatus(root);
  const entries = status.policies.map((policy) => {
    const requests = status.requests
      .filter((entry) => entry.servicePolicyId === policy.servicePolicyId)
      .sort((left, right) =>
        left.issuedAt.localeCompare(right.issuedAt)
        || left.requestId.localeCompare(right.requestId));
    const receipts = status.receipts
      .filter((entry) => entry.servicePolicyId === policy.servicePolicyId)
      .sort((left, right) =>
        left.completedAt.localeCompare(right.completedAt)
        || left.receiptId.localeCompare(right.receiptId));
    const receiptRequestIds = new Set(receipts.map((entry) => entry.requestId));
    const latestRequest = requests.at(-1) ?? null;
    const latestReceipt = receipts.at(-1) ?? null;
    const pendingRequestIds = requests
      .filter((entry) => !receiptRequestIds.has(entry.requestId))
      .map((entry) => entry.requestId)
      .sort();
    return {
      servicePolicyId: policy.servicePolicyId,
      servicePolicyFingerprint: policy.servicePolicyFingerprint,
      providerProfileId: policy.providerProfileId,
      localEndpoint: policy.localEndpoint,
      clientId: policy.clientId,
      latestRequestId: latestRequest?.requestId ?? null,
      latestRequestFingerprint: latestRequest?.requestFingerprint ?? null,
      latestReceiptId: latestReceipt?.receiptId ?? null,
      latestReceiptFingerprint: latestReceipt?.receiptFingerprint ?? null,
      pendingRequestIds,
      updatedAt: latestReceipt?.completedAt
        ?? latestRequest?.issuedAt
        ?? policy.createdAt,
    };
  }).sort((left, right) => left.servicePolicyId.localeCompare(right.servicePolicyId));
  const asOf = entries.map((entry) => entry.updatedAt).sort().at(-1)
    ?? "1970-01-01T00:00:00.000Z";
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_STATE_FORMAT,
    asOf,
    entries,
    stateAuthority: "projection-only" as const,
    ...NO_AUTHORITY,
  };
  const stateFingerprint = sha256(core);
  return {
    ...core,
    stateId: collectorContentId("asoiaf-answer-credential-broker-service-state", {
      asOf,
      stateFingerprint,
    }),
    stateFingerprint,
  };
}

function refreshState(root: string): AsoiafAnswerCredentialBrokerServiceState | null {
  const paths = asoiafAnswerCredentialBrokerServicePaths(root);
  if (listJson<AsoiafAnswerCredentialBrokerServicePolicy>(paths.policies).length === 0) {
    return null;
  }
  const state = buildState(root);
  writeAtomic(paths.state, state);
  return state;
}

export function readAsoiafAnswerCredentialBrokerServiceStatus(
  root: string,
): AsoiafAnswerCredentialBrokerServiceStatus {
  const paths = asoiafAnswerCredentialBrokerServicePaths(root);
  return {
    format: "axm-asoiaf-answer-credential-broker-service-status/1",
    paths,
    policies: listJson<AsoiafAnswerCredentialBrokerServicePolicy>(paths.policies),
    requests: listJson<AsoiafAnswerCredentialBrokerServiceRequest>(paths.requests),
    receipts: listJson<AsoiafAnswerCredentialBrokerServiceReceipt>(paths.receipts),
    state: fs.existsSync(paths.state)
      ? readJson<AsoiafAnswerCredentialBrokerServiceState>(paths.state)
      : null,
  };
}

export function retainAsoiafAnswerCredentialBrokerServicePolicy(
  input: AsoiafAnswerCredentialBrokerServicePolicyInput,
): { policy: AsoiafAnswerCredentialBrokerServicePolicy; replayed: boolean } {
  const parents = parentObjects(input.root);
  const brokerPolicy = exactlyOne(
    parents.brokerPolicies,
    (entry) => entry.policyId === input.brokerPolicyId,
    `credential broker policy ${input.brokerPolicyId}`,
  );
  const providerProfile = exactlyOne(
    parents.providerProfiles,
    (entry) => entry.profileId === input.providerProfileId,
    `credential provider profile ${input.providerProfileId}`,
  );
  if (
    providerProfile.brokerPolicyId !== brokerPolicy.policyId
    || providerProfile.brokerPolicyFingerprint !== brokerPolicy.policyFingerprint
  ) {
    throw new Error("credential broker service provider profile differs from broker policy custody");
  }
  const endpoint = asoiafAnswerCredentialBrokerServiceEndpoint(brokerPolicy.localEndpoint);
  const clientPublicKeySpkiBase64 = requireBase64(
    input.clientPublicKeySpkiBase64,
    "credential broker service client public key",
  );
  const clientPublicKey = publicKeyFromSpki(clientPublicKeySpkiBase64);
  const maxRequestLifetimeMilliseconds = requireInteger(
    input.maxRequestLifetimeMilliseconds,
    "credential broker service request lifetime",
    MAX_REQUEST_LIFETIME,
  );
  const maxRequestBytes = requireInteger(
    input.maxRequestBytes,
    "credential broker service request ceiling",
    MAX_REQUEST_BYTES,
  );
  const maxResponseBytes = requireInteger(
    input.maxResponseBytes,
    "credential broker service response ceiling",
    MAX_RESPONSE_BYTES,
  );
  const createdAt = requireTime(
    input.createdAt,
    "credential broker service policy creation time",
  );
  if (
    Date.parse(createdAt) < Date.parse(brokerPolicy.createdAt)
    || Date.parse(createdAt) < Date.parse(providerProfile.createdAt)
  ) {
    throw new Error("credential broker service policy predates its broker or provider parent");
  }
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_POLICY_FORMAT,
    brokerPolicyId: brokerPolicy.policyId,
    brokerPolicyFingerprint: brokerPolicy.policyFingerprint,
    providerProfileId: providerProfile.profileId,
    providerProfileFingerprint: providerProfile.profileFingerprint,
    deviceId: providerProfile.deviceId,
    serviceId: providerProfile.serviceId,
    providerHostKind: providerProfile.hostKind,
    localEndpoint: endpoint.endpoint,
    endpointKind: endpoint.endpointKind,
    clientId: requireId(input.clientId, "credential broker service client identity"),
    clientPublicKeySpkiBase64,
    clientPublicKeyFingerprint: publicKeyFingerprint(clientPublicKey),
    clientSignatureAlgorithm: keyAlgorithm(clientPublicKey),
    allowedOperations: sortedOperations(input.allowedOperations),
    maxRequestLifetimeMilliseconds,
    maxRequestBytes,
    maxResponseBytes,
    createdAt,
    operatorId: requireId(input.operatorId, "credential broker service policy operator"),
    localEndpointOnly: true as const,
    privateKeyRetained: false as const,
    privateKeyPathRetained: false as const,
    rawProviderSelectorRetained: false as const,
    providerSecretRetained: false as const,
    rawRequestBodyRetained: false as const,
    rawResponseBodyRetained: false as const,
    serviceAuthority: "local-request-admission-only" as const,
    ...NO_AUTHORITY,
  };
  const servicePolicyFingerprint = sha256(core);
  const policy: AsoiafAnswerCredentialBrokerServicePolicy = {
    ...core,
    servicePolicyId: collectorContentId("asoiaf-answer-credential-broker-service-policy", {
      brokerPolicyId: brokerPolicy.policyId,
      providerProfileId: providerProfile.profileId,
      clientId: core.clientId,
      servicePolicyFingerprint,
    }),
    servicePolicyFingerprint,
  };
  const paths = asoiafAnswerCredentialBrokerServicePaths(input.root);
  const persisted = writeExact(
    digestPath(paths.policies, servicePolicyFingerprint),
    policy,
  );
  refreshState(input.root);
  return { policy: persisted.value, replayed: persisted.replayed };
}

function normalizePayload(
  value: AsoiafAnswerCredentialBrokerServicePayload,
): AsoiafAnswerCredentialBrokerServicePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("credential broker service payload must be an object");
  }
  const kind = (value as { kind?: unknown }).kind;
  if (kind === "prepare-provider-invocation") {
    const record = requireExactKeys(value, [
      "kind",
      "brokerInvocationId",
      "providerIdempotencyKey",
      "preparedAt",
      "expiresAt",
    ], "credential broker service prepare payload");
    return {
      kind,
      brokerInvocationId: requireId(String(record.brokerInvocationId), "broker invocation identity"),
      providerIdempotencyKey: requireId(
        String(record.providerIdempotencyKey),
        "provider idempotency key",
      ),
      preparedAt: requireTime(String(record.preparedAt), "provider preparation time"),
      expiresAt: requireTime(String(record.expiresAt), "provider invocation expiry"),
    };
  }
  if (kind === "execute-possession") {
    const hostKind = (value as { hostKind?: unknown }).hostKind;
    if (hostKind === "synthetic-fixture") {
      const record = requireExactKeys(value, [
        "kind",
        "hostKind",
        "providerInvocationId",
        "credentialPrivateKeyPem",
        "completedAt",
      ], "credential broker service synthetic possession payload");
      return {
        kind,
        hostKind,
        providerInvocationId: requireId(
          String(record.providerInvocationId),
          "provider invocation identity",
        ),
        credentialPrivateKeyPem: requirePem(
          String(record.credentialPrivateKeyPem),
          "synthetic credential private key",
        ),
        completedAt: requireTime(
          String(record.completedAt),
          "provider possession completion time",
        ),
      };
    }
    if (hostKind === "windows-cng") {
      const record = requireExactKeys(value, [
        "kind",
        "hostKind",
        "providerInvocationId",
        "credentialCertificateThumbprint",
        "completedAt",
      ], "credential broker service Windows possession payload");
      return {
        kind,
        hostKind,
        providerInvocationId: requireId(
          String(record.providerInvocationId),
          "provider invocation identity",
        ),
        credentialCertificateThumbprint: requireId(
          String(record.credentialCertificateThumbprint),
          "credential certificate thumbprint",
          256,
        ),
        completedAt: requireTime(
          String(record.completedAt),
          "provider possession completion time",
        ),
      };
    }
    throw new Error("credential broker service possession payload requires a qualified host kind");
  }
  if (kind === "execute-transport") {
    const hostKind = (value as { hostKind?: unknown }).hostKind;
    if (hostKind === "synthetic-fixture") {
      const record = requireExactKeys(value, [
        "kind",
        "hostKind",
        "providerInvocationId",
        "deviceAgentPrivateKeyPem",
        "lowerRequestId",
        "lowerRequestFingerprint",
        "lowerResponseId",
        "lowerResponseFingerprint",
        "observedServerCertificateFingerprint",
        "observedServerIssuerFingerprint",
        "httpStatus",
        "responseBodyBase64",
        "providerReceiptDigest",
        "startedAt",
        "completedAt",
      ], "credential broker service synthetic transport payload");
      return {
        kind,
        hostKind,
        providerInvocationId: requireId(
          String(record.providerInvocationId),
          "provider invocation identity",
        ),
        deviceAgentPrivateKeyPem: requirePem(
          String(record.deviceAgentPrivateKeyPem),
          "synthetic device-agent private key",
        ),
        lowerRequestId: requireId(String(record.lowerRequestId), "lower request identity"),
        lowerRequestFingerprint: requireDigest(
          String(record.lowerRequestFingerprint),
          "lower request fingerprint",
        ),
        lowerResponseId: requireId(String(record.lowerResponseId), "lower response identity"),
        lowerResponseFingerprint: requireDigest(
          String(record.lowerResponseFingerprint),
          "lower response fingerprint",
        ),
        observedServerCertificateFingerprint: requireDigest(
          String(record.observedServerCertificateFingerprint),
          "observed server certificate fingerprint",
        ),
        observedServerIssuerFingerprint: requireDigest(
          String(record.observedServerIssuerFingerprint),
          "observed server issuer fingerprint",
        ),
        httpStatus: requireInteger(Number(record.httpStatus), "HTTP status", 599),
        responseBodyBase64: requireBase64(
          String(record.responseBodyBase64),
          "synthetic provider response body",
          true,
        ),
        providerReceiptDigest: requireDigest(
          String(record.providerReceiptDigest),
          "provider receipt digest",
        ),
        startedAt: requireTime(String(record.startedAt), "provider transport start time"),
        completedAt: requireTime(String(record.completedAt), "provider transport completion time"),
      };
    }
    if (hostKind === "windows-cng") {
      const record = requireExactKeys(value, [
        "kind",
        "hostKind",
        "providerInvocationId",
        "credentialCertificateThumbprint",
        "deviceAgentCertificateThumbprint",
        "requestBodyBase64",
        "completedAt",
      ], "credential broker service Windows transport payload");
      return {
        kind,
        hostKind,
        providerInvocationId: requireId(
          String(record.providerInvocationId),
          "provider invocation identity",
        ),
        credentialCertificateThumbprint: requireId(
          String(record.credentialCertificateThumbprint),
          "credential certificate thumbprint",
          256,
        ),
        deviceAgentCertificateThumbprint: requireId(
          String(record.deviceAgentCertificateThumbprint),
          "device-agent certificate thumbprint",
          256,
        ),
        requestBodyBase64: requireBase64(
          String(record.requestBodyBase64),
          "Windows provider request body",
          true,
        ),
        completedAt: requireTime(
          String(record.completedAt),
          "provider transport completion time",
        ),
      };
    }
    throw new Error("credential broker service transport payload requires a qualified host kind");
  }
  throw new Error("credential broker service payload kind is invalid");
}

function requestCoreFromUnsigned(unsigned: ServiceRequestUnsigned) {
  return unsigned;
}

function normalizeAndVerifyRequest(input: {
  policy: AsoiafAnswerCredentialBrokerServicePolicy;
  request: AsoiafAnswerCredentialBrokerServiceRequest;
}): AsoiafAnswerCredentialBrokerServiceRequest {
  const record = requireExactKeys(input.request, [
    "format",
    "requestId",
    "requestFingerprint",
    "servicePolicyId",
    "servicePolicyFingerprint",
    "brokerPolicyId",
    "brokerPolicyFingerprint",
    "providerProfileId",
    "providerProfileFingerprint",
    "localEndpoint",
    "endpointKind",
    "clientId",
    "clientPublicKeyFingerprint",
    "operation",
    "idempotencyKeyDigest",
    "payloadDigest",
    "payloadBytes",
    "issuedAt",
    "expiresAt",
    "signatureAlgorithm",
    "signatureBase64",
    "signatureDigest",
    "signatureVerified",
    "privateKeyRetained",
    "privateKeyPathRetained",
    "rawProviderSelectorRetained",
    "providerSecretRetained",
    "rawRequestBodyRetained",
    "requestAuthority",
    "authority",
    "graphEffect",
    "canonEffect",
    "answerEffect",
  ], "credential broker service request");
  if (record.format !== ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_REQUEST_FORMAT) {
    throw new Error("credential broker service request format is invalid");
  }
  const operation = requireOperation(String(record.operation));
  const endpoint = asoiafAnswerCredentialBrokerServiceEndpoint(String(record.localEndpoint));
  const unsigned: ServiceRequestUnsigned = {
    format: ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_REQUEST_FORMAT,
    servicePolicyId: requireId(String(record.servicePolicyId), "service policy identity"),
    servicePolicyFingerprint: requireDigest(
      String(record.servicePolicyFingerprint),
      "service policy fingerprint",
    ),
    brokerPolicyId: requireId(String(record.brokerPolicyId), "broker policy identity"),
    brokerPolicyFingerprint: requireDigest(
      String(record.brokerPolicyFingerprint),
      "broker policy fingerprint",
    ),
    providerProfileId: requireId(String(record.providerProfileId), "provider profile identity"),
    providerProfileFingerprint: requireDigest(
      String(record.providerProfileFingerprint),
      "provider profile fingerprint",
    ),
    localEndpoint: endpoint.endpoint,
    endpointKind: endpoint.endpointKind,
    clientId: requireId(String(record.clientId), "service client identity"),
    clientPublicKeyFingerprint: requireDigest(
      String(record.clientPublicKeyFingerprint),
      "service client public-key fingerprint",
    ),
    operation,
    idempotencyKeyDigest: requireDigest(
      String(record.idempotencyKeyDigest),
      "service request idempotency digest",
    ),
    payloadDigest: requireDigest(String(record.payloadDigest), "service payload digest"),
    payloadBytes: requireInteger(
      Number(record.payloadBytes),
      "service payload byte count",
      input.policy.maxRequestBytes,
    ),
    issuedAt: requireTime(String(record.issuedAt), "service request issue time"),
    expiresAt: requireTime(String(record.expiresAt), "service request expiry"),
    privateKeyRetained: false,
    privateKeyPathRetained: false,
    rawProviderSelectorRetained: false,
    providerSecretRetained: false,
    rawRequestBodyRetained: false,
    requestAuthority: "caller-request-only",
    ...NO_AUTHORITY,
  };
  if (
    record.privateKeyRetained !== false
    || record.privateKeyPathRetained !== false
    || record.rawProviderSelectorRetained !== false
    || record.providerSecretRetained !== false
    || record.rawRequestBodyRetained !== false
    || record.requestAuthority !== "caller-request-only"
    || record.authority !== "none"
    || record.graphEffect !== "none"
    || record.canonEffect !== "none"
    || record.answerEffect !== "none"
    || record.signatureVerified !== true
  ) {
    throw new Error("credential broker service request authority or retention boundary is invalid");
  }
  if (
    unsigned.servicePolicyId !== input.policy.servicePolicyId
    || unsigned.servicePolicyFingerprint !== input.policy.servicePolicyFingerprint
    || unsigned.brokerPolicyId !== input.policy.brokerPolicyId
    || unsigned.brokerPolicyFingerprint !== input.policy.brokerPolicyFingerprint
    || unsigned.providerProfileId !== input.policy.providerProfileId
    || unsigned.providerProfileFingerprint !== input.policy.providerProfileFingerprint
    || unsigned.localEndpoint !== input.policy.localEndpoint
    || unsigned.endpointKind !== input.policy.endpointKind
    || unsigned.clientId !== input.policy.clientId
    || unsigned.clientPublicKeyFingerprint !== input.policy.clientPublicKeyFingerprint
    || !input.policy.allowedOperations.includes(operation)
  ) {
    throw new Error("credential broker service request differs from retained policy custody");
  }
  const lifetime = Date.parse(unsigned.expiresAt) - Date.parse(unsigned.issuedAt);
  if (lifetime < 1 || lifetime > input.policy.maxRequestLifetimeMilliseconds) {
    throw new Error("credential broker service request lifetime exceeds policy");
  }
  if (Date.parse(unsigned.issuedAt) < Date.parse(input.policy.createdAt)) {
    throw new Error("credential broker service request predates retained policy");
  }
  const requestFingerprint = sha256(requestCoreFromUnsigned(unsigned));
  const requestId = collectorContentId("asoiaf-answer-credential-broker-service-request", {
    servicePolicyId: unsigned.servicePolicyId,
    idempotencyKeyDigest: unsigned.idempotencyKeyDigest,
    requestFingerprint,
  });
  if (
    String(record.requestFingerprint) !== requestFingerprint
    || String(record.requestId) !== requestId
  ) {
    throw new Error("credential broker service request identity is invalid");
  }
  const signatureAlgorithm = normalizeSignatureAlgorithm(String(record.signatureAlgorithm));
  if (signatureAlgorithm !== input.policy.clientSignatureAlgorithm) {
    throw new Error("credential broker service request signature algorithm differs from policy");
  }
  const signatureBase64 = requireBase64(
    String(record.signatureBase64),
    "credential broker service request signature",
  );
  const signature = Buffer.from(signatureBase64, "base64");
  const signatureDigest = bytesDigest(signature);
  if (String(record.signatureDigest) !== signatureDigest) {
    throw new Error("credential broker service request signature digest is invalid");
  }
  const normalized: AsoiafAnswerCredentialBrokerServiceRequest = {
    ...unsigned,
    requestId,
    requestFingerprint,
    signatureAlgorithm,
    signatureBase64,
    signatureDigest,
    signatureVerified: true,
  };
  if (!verifyBytes({
    key: publicKeyFromSpki(input.policy.clientPublicKeySpkiBase64),
    algorithm: signatureAlgorithm,
    message: serializeAsoiafAnswerCredentialBrokerServiceRequest(normalized),
    signature,
  })) {
    throw new Error("credential broker service request signature is invalid");
  }
  return normalized;
}

export function createAsoiafAnswerCredentialBrokerServiceRequest(
  input: AsoiafAnswerCredentialBrokerServiceRequestInput,
): { request: AsoiafAnswerCredentialBrokerServiceRequest } {
  const policy = servicePolicyById(input.root, input.servicePolicyId);
  const operation = requireOperation(input.operation);
  if (!policy.allowedOperations.includes(operation)) {
    throw new Error(`credential broker service operation ${operation} is not allowed by policy`);
  }
  const payload = normalizePayload(input.payload);
  if (payload.kind !== operation) {
    throw new Error("credential broker service request operation differs from payload kind");
  }
  if (
    "hostKind" in payload
    && payload.hostKind !== policy.providerHostKind
  ) {
    throw new Error("credential broker service payload host differs from retained provider profile");
  }
  const payloadBytes = stableBytes(payload);
  if (payloadBytes.length > policy.maxRequestBytes) {
    throw new Error("credential broker service payload exceeds policy request ceiling");
  }
  const issuedAt = requireTime(input.issuedAt, "credential broker service request issue time");
  const expiresAt = requireTime(input.expiresAt, "credential broker service request expiry");
  const lifetime = Date.parse(expiresAt) - Date.parse(issuedAt);
  if (lifetime < 1 || lifetime > policy.maxRequestLifetimeMilliseconds) {
    throw new Error("credential broker service request lifetime exceeds policy");
  }
  const unsigned: ServiceRequestUnsigned = {
    format: ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_REQUEST_FORMAT,
    servicePolicyId: policy.servicePolicyId,
    servicePolicyFingerprint: policy.servicePolicyFingerprint,
    brokerPolicyId: policy.brokerPolicyId,
    brokerPolicyFingerprint: policy.brokerPolicyFingerprint,
    providerProfileId: policy.providerProfileId,
    providerProfileFingerprint: policy.providerProfileFingerprint,
    localEndpoint: policy.localEndpoint,
    endpointKind: policy.endpointKind,
    clientId: policy.clientId,
    clientPublicKeyFingerprint: policy.clientPublicKeyFingerprint,
    operation,
    idempotencyKeyDigest: sha256(requireId(
      input.idempotencyKey,
      "credential broker service idempotency key",
    )),
    payloadDigest: bytesDigest(payloadBytes),
    payloadBytes: payloadBytes.length,
    issuedAt,
    expiresAt,
    privateKeyRetained: false,
    privateKeyPathRetained: false,
    rawProviderSelectorRetained: false,
    providerSecretRetained: false,
    rawRequestBodyRetained: false,
    requestAuthority: "caller-request-only",
    ...NO_AUTHORITY,
  };
  const requestFingerprint = sha256(requestCoreFromUnsigned(unsigned));
  const requestId = collectorContentId("asoiaf-answer-credential-broker-service-request", {
    servicePolicyId: policy.servicePolicyId,
    idempotencyKeyDigest: unsigned.idempotencyKeyDigest,
    requestFingerprint,
  });
  const privateKey = crypto.createPrivateKey(input.clientPrivateKeyPem);
  if (
    publicKeyFingerprint(privateKey) !== policy.clientPublicKeyFingerprint
    || publicKeySpkiBase64(privateKey) !== policy.clientPublicKeySpkiBase64
  ) {
    throw new Error("credential broker service signing key differs from retained client identity");
  }
  const provisional: AsoiafAnswerCredentialBrokerServiceRequest = {
    ...unsigned,
    requestId,
    requestFingerprint,
    signatureAlgorithm: policy.clientSignatureAlgorithm,
    signatureBase64: "",
    signatureDigest: bytesDigest(Buffer.alloc(0)),
    signatureVerified: true,
  };
  const signed = signBytes(
    privateKey,
    serializeAsoiafAnswerCredentialBrokerServiceRequest(provisional),
  );
  const signatureBase64 = signed.signature.toString("base64");
  const request: AsoiafAnswerCredentialBrokerServiceRequest = {
    ...provisional,
    signatureAlgorithm: signed.algorithm,
    signatureBase64,
    signatureDigest: bytesDigest(signed.signature),
  };
  normalizeAndVerifyRequest({ policy, request });
  return { request };
}

function executeServiceOperation(input: {
  root: string;
  policy: AsoiafAnswerCredentialBrokerServicePolicy;
  request: AsoiafAnswerCredentialBrokerServiceRequest;
  payload: AsoiafAnswerCredentialBrokerServicePayload;
  powershellExecutable?: string;
}): AsoiafAnswerCredentialBrokerServiceResponse {
  const operatorId = `credential-broker-service:${input.policy.clientId}:${input.request.requestId}`;
  if (input.payload.kind === "prepare-provider-invocation") {
    const result = prepareAsoiafAnswerCredentialProviderInvocation({
      root: input.root,
      profileId: input.policy.providerProfileId,
      brokerInvocationId: input.payload.brokerInvocationId,
      idempotencyKey: input.payload.providerIdempotencyKey,
      preparedAt: input.payload.preparedAt,
      expiresAt: input.payload.expiresAt,
      operatorId,
    });
    return {
      kind: "provider-invocation",
      providerReplayed: result.replayed,
      invocation: result.invocation,
    };
  }
  if (input.payload.kind === "execute-possession") {
    if (input.payload.hostKind === "synthetic-fixture") {
      const result = executeAsoiafAnswerSyntheticPossession({
        root: input.root,
        providerInvocationId: input.payload.providerInvocationId,
        credentialPrivateKeyPem: input.payload.credentialPrivateKeyPem,
        completedAt: input.payload.completedAt,
        operatorId,
      });
      return {
        kind: "provider-result",
        providerReplayed: result.replayed,
        result: result.result,
      };
    }
    const result = executeAsoiafAnswerWindowsCngPossession({
      root: input.root,
      providerInvocationId: input.payload.providerInvocationId,
      credentialCertificateThumbprint: input.payload.credentialCertificateThumbprint,
      completedAt: input.payload.completedAt,
      operatorId,
      ...(input.powershellExecutable
        ? { powershellExecutable: input.powershellExecutable }
        : {}),
    });
    return {
      kind: "provider-result",
      providerReplayed: result.replayed,
      result: result.result,
    };
  }
  if (input.payload.hostKind === "synthetic-fixture") {
    const result = executeAsoiafAnswerSyntheticTransport({
      root: input.root,
      providerInvocationId: input.payload.providerInvocationId,
      deviceAgentPrivateKeyPem: input.payload.deviceAgentPrivateKeyPem,
      lowerRequestId: input.payload.lowerRequestId,
      lowerRequestFingerprint: input.payload.lowerRequestFingerprint,
      lowerResponseId: input.payload.lowerResponseId,
      lowerResponseFingerprint: input.payload.lowerResponseFingerprint,
      observedServerCertificateFingerprint:
        input.payload.observedServerCertificateFingerprint,
      observedServerIssuerFingerprint:
        input.payload.observedServerIssuerFingerprint,
      httpStatus: input.payload.httpStatus,
      responseBodyBase64: input.payload.responseBodyBase64,
      providerReceiptDigest: input.payload.providerReceiptDigest,
      startedAt: input.payload.startedAt,
      completedAt: input.payload.completedAt,
      operatorId,
    });
    return {
      kind: "provider-result",
      providerReplayed: result.replayed,
      result: result.result,
    };
  }
  const result = executeAsoiafAnswerWindowsCngTransport({
    root: input.root,
    providerInvocationId: input.payload.providerInvocationId,
    credentialCertificateThumbprint: input.payload.credentialCertificateThumbprint,
    deviceAgentCertificateThumbprint: input.payload.deviceAgentCertificateThumbprint,
    requestBodyBase64: input.payload.requestBodyBase64,
    completedAt: input.payload.completedAt,
    operatorId,
    ...(input.powershellExecutable
      ? { powershellExecutable: input.powershellExecutable }
      : {}),
  });
  return {
    kind: "provider-result",
    providerReplayed: result.replayed,
    result: result.result,
  };
}

export function dispatchAsoiafAnswerCredentialBrokerServiceRequest(
  input: AsoiafAnswerCredentialBrokerServiceDispatchInput,
): AsoiafAnswerCredentialBrokerServiceDispatchResult {
  return withServiceLock(input.root, () => {
    const policy = servicePolicyById(input.root, input.request.servicePolicyId);
    const request = normalizeAndVerifyRequest({ policy, request: input.request });
    const payload = normalizePayload(input.payload);
    if (payload.kind !== request.operation) {
      throw new Error("credential broker service payload differs from request operation");
    }
    if ("hostKind" in payload && payload.hostKind !== policy.providerHostKind) {
      throw new Error("credential broker service payload host differs from retained provider profile");
    }
    const payloadBytes = stableBytes(payload);
    if (
      payloadBytes.length !== request.payloadBytes
      || bytesDigest(payloadBytes) !== request.payloadDigest
    ) {
      throw new Error("credential broker service payload differs from signed request custody");
    }
    const receivedAt = requireTime(input.receivedAt, "credential broker service receipt time");
    if (
      Date.parse(receivedAt) < Date.parse(request.issuedAt)
      || Date.parse(receivedAt) > Date.parse(request.expiresAt)
    ) {
      throw new Error("credential broker service request is not live at receipt time");
    }
    const status = readAsoiafAnswerCredentialBrokerServiceStatus(input.root);
    const conflicts = status.requests.filter(
      (entry) => entry.idempotencyKeyDigest === request.idempotencyKeyDigest,
    );
    if (
      conflicts.length > 0
      && (
        conflicts.length !== 1
        || stableJson(conflicts[0]) !== stableJson(request)
      )
    ) {
      throw new Error("credential broker service idempotency key conflicts with retained request");
    }
    const paths = asoiafAnswerCredentialBrokerServicePaths(input.root);
    const persistedRequest = writeExact(
      digestPath(paths.requests, request.requestFingerprint),
      request,
    );
    refreshState(input.root);
    const existingReceipts = readAsoiafAnswerCredentialBrokerServiceStatus(input.root).receipts
      .filter((entry) => entry.requestId === request.requestId);
    if (existingReceipts.length > 0) {
      if (existingReceipts.length !== 1) {
        throw new Error("credential broker service request has duplicate receipts");
      }
      const receipt = existingReceipts[0]!;
      return {
        request: persistedRequest.value,
        receipt,
        response: receipt.response,
        requestReplayed: true,
        receiptReplayed: true,
      };
    }
    const response = executeServiceOperation({
      root: input.root,
      policy,
      request,
      payload,
      powershellExecutable: input.powershellExecutable,
    });
    const responseBytes = stableBytes(response);
    if (responseBytes.length > policy.maxResponseBytes) {
      throw new Error("credential broker service response exceeds policy ceiling");
    }
    const completedAt = requireTime(
      input.completedAt ?? receivedAt,
      "credential broker service completion time",
    );
    if (Date.parse(completedAt) < Date.parse(receivedAt)) {
      throw new Error("credential broker service completion precedes receipt time");
    }
    const core = {
      format: ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_RECEIPT_FORMAT,
      requestId: request.requestId,
      requestFingerprint: request.requestFingerprint,
      servicePolicyId: policy.servicePolicyId,
      servicePolicyFingerprint: policy.servicePolicyFingerprint,
      brokerPolicyId: policy.brokerPolicyId,
      providerProfileId: policy.providerProfileId,
      providerProfileFingerprint: policy.providerProfileFingerprint,
      clientId: policy.clientId,
      operation: request.operation,
      idempotencyKeyDigest: request.idempotencyKeyDigest,
      payloadDigest: request.payloadDigest,
      acceptedAt: receivedAt,
      completedAt,
      response,
      responseDigest: bytesDigest(responseBytes),
      responseBytes: responseBytes.length,
      privateKeyRetained: false as const,
      privateKeyPathRetained: false as const,
      rawProviderSelectorRetained: false as const,
      providerSecretRetained: false as const,
      rawRequestBodyRetained: false as const,
      rawResponseBodyRetained: false as const,
      receiptAuthority: "provider-execution-reference-only" as const,
      ...NO_AUTHORITY,
    };
    const receiptFingerprint = sha256(core);
    const receipt: AsoiafAnswerCredentialBrokerServiceReceipt = {
      ...core,
      receiptId: collectorContentId("asoiaf-answer-credential-broker-service-receipt", {
        requestId: request.requestId,
        responseDigest: core.responseDigest,
        receiptFingerprint,
      }),
      receiptFingerprint,
    };
    const persistedReceipt = writeExact(
      digestPath(paths.receipts, receiptFingerprint),
      receipt,
    );
    refreshState(input.root);
    return {
      request: persistedRequest.value,
      receipt: persistedReceipt.value,
      response: persistedReceipt.value.response,
      requestReplayed: persistedRequest.replayed,
      receiptReplayed: persistedReceipt.replayed,
    };
  });
}

function recursiveFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  const visit = (current: string): void => {
    for (const name of fs.readdirSync(current).sort()) {
      const target = path.join(current, name);
      const stat = fs.lstatSync(target);
      if (stat.isDirectory()) visit(target);
      else if (stat.isFile()) files.push(target);
    }
  };
  visit(root);
  return files;
}

export function verifyAsoiafAnswerCredentialBrokerServiceEstate(
  root: string,
): AsoiafAnswerCredentialBrokerServiceFinding[] {
  const findings: AsoiafAnswerCredentialBrokerServiceFinding[] = [];
  const paths = asoiafAnswerCredentialBrokerServicePaths(root);
  const status = readAsoiafAnswerCredentialBrokerServiceStatus(root);
  const brokerErrors = verifyAsoiafAnswerCredentialBrokerEstate(root)
    .filter((entry) => entry.severity === "error");
  for (const entry of brokerErrors) {
    findings.push(finding(
      "service-parent-broker-invalid",
      "error",
      entry.subjectId,
      entry.code,
    ));
  }
  const providerErrors = verifyAsoiafAnswerCredentialProviderHostEstate(root)
    .filter((entry) => entry.severity === "error");
  for (const entry of providerErrors) {
    findings.push(finding(
      "service-parent-provider-invalid",
      "error",
      entry.subjectId,
      entry.code,
    ));
  }
  const broker = readAsoiafAnswerCredentialBrokerStatus(root);
  const provider = readAsoiafAnswerCredentialProviderStatus(root);
  const policyMap = new Map<string, AsoiafAnswerCredentialBrokerServicePolicy>();
  for (const policy of status.policies) {
    try {
      if (policy.format !== ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_POLICY_FORMAT) {
        throw new Error("format");
      }
      const fingerprint = sha256(policyCore(policy));
      const id = collectorContentId("asoiaf-answer-credential-broker-service-policy", {
        brokerPolicyId: policy.brokerPolicyId,
        providerProfileId: policy.providerProfileId,
        clientId: policy.clientId,
        servicePolicyFingerprint: fingerprint,
      });
      if (
        policy.servicePolicyFingerprint !== fingerprint
        || policy.servicePolicyId !== id
        || path.basename(digestPath(paths.policies, fingerprint))
          !== `${fingerprint.slice("sha256:".length)}.json`
      ) {
        throw new Error("identity");
      }
      const brokerPolicy = exactlyOne(
        broker.policies,
        (entry) => entry.policyId === policy.brokerPolicyId,
        `broker policy ${policy.brokerPolicyId}`,
      );
      const profile = exactlyOne(
        provider.profiles,
        (entry) => entry.profileId === policy.providerProfileId,
        `provider profile ${policy.providerProfileId}`,
      );
      const endpoint = asoiafAnswerCredentialBrokerServiceEndpoint(policy.localEndpoint);
      const clientKey = publicKeyFromSpki(policy.clientPublicKeySpkiBase64);
      if (
        policy.brokerPolicyFingerprint !== brokerPolicy.policyFingerprint
        || policy.providerProfileFingerprint !== profile.profileFingerprint
        || profile.brokerPolicyId !== brokerPolicy.policyId
        || profile.brokerPolicyFingerprint !== brokerPolicy.policyFingerprint
        || policy.deviceId !== profile.deviceId
        || policy.serviceId !== profile.serviceId
        || policy.providerHostKind !== profile.hostKind
        || policy.localEndpoint !== brokerPolicy.localEndpoint
        || policy.endpointKind !== endpoint.endpointKind
        || policy.clientPublicKeyFingerprint !== publicKeyFingerprint(clientKey)
        || policy.clientSignatureAlgorithm !== keyAlgorithm(clientKey)
        || stableJson(policy.allowedOperations) !== stableJson(sortedOperations(policy.allowedOperations))
        || policy.maxRequestLifetimeMilliseconds < 1
        || policy.maxRequestLifetimeMilliseconds > MAX_REQUEST_LIFETIME
        || policy.maxRequestBytes < 1
        || policy.maxRequestBytes > MAX_REQUEST_BYTES
        || policy.maxResponseBytes < 1
        || policy.maxResponseBytes > MAX_RESPONSE_BYTES
        || policy.localEndpointOnly !== true
        || policy.privateKeyRetained !== false
        || policy.privateKeyPathRetained !== false
        || policy.rawProviderSelectorRetained !== false
        || policy.providerSecretRetained !== false
        || policy.rawRequestBodyRetained !== false
        || policy.rawResponseBodyRetained !== false
        || policy.serviceAuthority !== "local-request-admission-only"
        || policy.authority !== "none"
        || policy.graphEffect !== "none"
        || policy.canonEffect !== "none"
        || policy.answerEffect !== "none"
      ) {
        throw new Error("custody");
      }
      policyMap.set(policy.servicePolicyId, policy);
    } catch (error) {
      findings.push(finding(
        "service-policy-invalid",
        "error",
        policy.servicePolicyId ?? "unknown-service-policy",
        error instanceof Error ? error.message : String(error),
      ));
    }
  }
  if (policyMap.size !== status.policies.length) {
    findings.push(finding(
      "service-policy-duplicate",
      "error",
      "answer-credential-broker-service",
      "service policy identities are absent, duplicated, or invalid",
    ));
  }

  const requestMap = new Map<string, AsoiafAnswerCredentialBrokerServiceRequest>();
  const idempotency = new Map<string, string>();
  for (const request of status.requests) {
    try {
      const policy = policyMap.get(request.servicePolicyId);
      if (!policy) throw new Error("policy");
      const normalized = normalizeAndVerifyRequest({ policy, request });
      const expectedPath = digestPath(paths.requests, normalized.requestFingerprint);
      if (!fs.existsSync(expectedPath)) throw new Error("path");
      if (Date.parse(normalized.issuedAt) < Date.parse(policy.createdAt)) {
        throw new Error("request predates policy");
      }
      const existing = idempotency.get(normalized.idempotencyKeyDigest);
      if (existing && existing !== normalized.requestId) {
        throw new Error("idempotency collision");
      }
      idempotency.set(normalized.idempotencyKeyDigest, normalized.requestId);
      if (requestMap.has(normalized.requestId)) throw new Error("duplicate request");
      requestMap.set(normalized.requestId, normalized);
    } catch (error) {
      findings.push(finding(
        "service-request-invalid",
        "error",
        request.requestId ?? "unknown-service-request",
        error instanceof Error ? error.message : String(error),
      ));
    }
  }

  const receiptRequests = new Map<string, string>();
  for (const receipt of status.receipts) {
    try {
      if (receipt.format !== ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_RECEIPT_FORMAT) {
        throw new Error("format");
      }
      const request = requestMap.get(receipt.requestId);
      const policy = policyMap.get(receipt.servicePolicyId);
      if (!request || !policy) throw new Error("request or policy");
      const responseBytes = stableBytes(receipt.response);
      const fingerprint = sha256(receiptCore(receipt));
      const id = collectorContentId("asoiaf-answer-credential-broker-service-receipt", {
        requestId: receipt.requestId,
        responseDigest: receipt.responseDigest,
        receiptFingerprint: fingerprint,
      });
      if (
        receipt.receiptFingerprint !== fingerprint
        || receipt.receiptId !== id
        || receipt.requestFingerprint !== request.requestFingerprint
        || receipt.servicePolicyFingerprint !== policy.servicePolicyFingerprint
        || receipt.brokerPolicyId !== policy.brokerPolicyId
        || receipt.providerProfileId !== policy.providerProfileId
        || receipt.providerProfileFingerprint !== policy.providerProfileFingerprint
        || receipt.clientId !== policy.clientId
        || receipt.operation !== request.operation
        || receipt.idempotencyKeyDigest !== request.idempotencyKeyDigest
        || receipt.payloadDigest !== request.payloadDigest
        || receipt.responseDigest !== bytesDigest(responseBytes)
        || receipt.responseBytes !== responseBytes.length
        || receipt.responseBytes > policy.maxResponseBytes
        || Date.parse(receipt.acceptedAt) < Date.parse(request.issuedAt)
        || Date.parse(receipt.acceptedAt) > Date.parse(request.expiresAt)
        || Date.parse(receipt.completedAt) < Date.parse(receipt.acceptedAt)
        || receipt.privateKeyRetained !== false
        || receipt.privateKeyPathRetained !== false
        || receipt.rawProviderSelectorRetained !== false
        || receipt.providerSecretRetained !== false
        || receipt.rawRequestBodyRetained !== false
        || receipt.rawResponseBodyRetained !== false
        || receipt.receiptAuthority !== "provider-execution-reference-only"
        || receipt.authority !== "none"
        || receipt.graphEffect !== "none"
        || receipt.canonEffect !== "none"
        || receipt.answerEffect !== "none"
      ) {
        throw new Error("identity or custody");
      }
      const response = receipt.response;
      if (response.kind === "provider-invocation") {
        const invocationId = response.invocation.providerInvocationId;
        const invocation = exactlyOne(
          provider.invocations,
          (entry) => entry.providerInvocationId === invocationId,
          `provider invocation ${invocationId}`,
        );
        if (
          stableJson(invocation) !== stableJson(response.invocation)
          || receipt.operation !== "prepare-provider-invocation"
        ) {
          throw new Error("provider invocation response");
        }
      } else {
        const resultId = response.result.resultId;
        const result = exactlyOne(
          provider.results,
          (entry) => entry.resultId === resultId,
          `provider result ${resultId}`,
        );
        if (
          stableJson(result) !== stableJson(response.result)
          || receipt.operation === "prepare-provider-invocation"
        ) {
          throw new Error("provider result response");
        }
      }
      const existing = receiptRequests.get(receipt.requestId);
      if (existing && existing !== receipt.receiptId) {
        throw new Error("duplicate receipt");
      }
      receiptRequests.set(receipt.requestId, receipt.receiptId);
      if (!fs.existsSync(digestPath(paths.receipts, receipt.receiptFingerprint))) {
        throw new Error("path");
      }
    } catch (error) {
      findings.push(finding(
        "service-receipt-invalid",
        "error",
        receipt.receiptId ?? "unknown-service-receipt",
        error instanceof Error ? error.message : String(error),
      ));
    }
  }

  for (const request of status.requests) {
    if (!receiptRequests.has(request.requestId)) {
      findings.push(finding(
        "service-request-pending",
        "notice",
        request.requestId,
        "signed local request has no retained terminal receipt",
      ));
    }
  }

  if (status.policies.length > 0) {
    try {
      if (!status.state) throw new Error("missing state");
      const rebuilt = buildState(root);
      if (stableJson(status.state) !== stableJson(rebuilt)) {
        throw new Error("state differs from reconstructed projection");
      }
      if (
        status.state.stateFingerprint !== sha256(stateCore(status.state))
        || !fs.existsSync(paths.state)
      ) {
        throw new Error("state identity or path");
      }
    } catch (error) {
      findings.push(finding(
        "service-state-invalid",
        "error",
        status.state?.stateId ?? "answer-credential-broker-service-state",
        error instanceof Error ? error.message : String(error),
      ));
    }
  } else if (status.state) {
    findings.push(finding(
      "service-state-unexpected",
      "error",
      status.state.stateId,
      "service state exists without a retained policy",
    ));
  }

  if (fs.existsSync(paths.lock)) {
    findings.push(finding(
      "service-lock-retained",
      "error",
      paths.lock,
      "service transaction lock remained after operation completion",
    ));
  }
  const secretPath = /\.(?:key|pem|p12|pfx|csr|crt)$/i;
  const secretContent = /BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY|BEGIN CERTIFICATE(?: REQUEST)?|"(?:clientPrivateKeyPem|credentialPrivateKeyPem|deviceAgentPrivateKeyPem|credentialCertificateThumbprint|deviceAgentCertificateThumbprint|requestBodyBase64|responseBodyBase64|powershellExecutable|payload)"\s*:/;
  for (const file of recursiveFiles(paths.serviceRoot)) {
    if (secretPath.test(file)) {
      findings.push(finding(
        "service-secret-path",
        "error",
        file,
        "service estate contains a forbidden secret-bearing path",
      ));
    }
    const content = fs.readFileSync(file, "utf8");
    if (secretContent.test(content)) {
      findings.push(finding(
        "service-secret-content",
        "error",
        file,
        "service estate contains transient credential, selector, body, or executable input",
      ));
    }
  }
  return sortFindings(findings);
}

interface LocalJsonServerInput {
  endpoint: string;
  maxWireBytes: number;
  maxResponseBytes: number;
  maxRequests: number;
  clock: () => string;
  handle: (value: unknown) => unknown | Promise<unknown>;
}

interface LocalJsonServer {
  endpoint: string;
  endpointKind: AsoiafAnswerCredentialBrokerServiceEndpointKind;
  address: string;
  startedAt: string;
  servedRequests: () => number;
  close: () => Promise<void>;
  closed: Promise<{
    endpoint: string;
    startedAt: string;
    stoppedAt: string;
    servedRequests: number;
  }>;
}

function assertPlatformEndpoint(
  endpointKind: AsoiafAnswerCredentialBrokerServiceEndpointKind,
): void {
  if (endpointKind === "unix" && process.platform === "win32") {
    throw new Error("unix credential broker service endpoints are unavailable on Windows");
  }
  if (endpointKind === "npipe" && process.platform !== "win32") {
    throw new Error("npipe credential broker service endpoints require Windows");
  }
}

async function startLocalJsonServer(input: LocalJsonServerInput): Promise<LocalJsonServer> {
  const endpoint = asoiafAnswerCredentialBrokerServiceEndpoint(input.endpoint);
  assertPlatformEndpoint(endpoint.endpointKind);
  const maxWireBytes = requireInteger(
    input.maxWireBytes,
    "credential broker service wire request ceiling",
    MAX_REQUEST_BYTES + MAX_WIRE_OVERHEAD,
  );
  const maxResponseBytes = requireInteger(
    input.maxResponseBytes,
    "credential broker service wire response ceiling",
    MAX_RESPONSE_BYTES + MAX_WIRE_OVERHEAD,
  );
  const maxRequests = requireInteger(
    input.maxRequests,
    "credential broker service maximum request count",
    1_000_000,
  );
  if (endpoint.endpointKind === "unix") {
    fs.mkdirSync(path.dirname(endpoint.address), { recursive: true });
    if (fs.existsSync(endpoint.address)) {
      const stat = fs.lstatSync(endpoint.address);
      if (!stat.isSocket()) {
        throw new Error("credential broker service unix endpoint collides with a non-socket path");
      }
      throw new Error("credential broker service unix endpoint already exists; implicit socket unlink is refused");
    }
  }
  const startedAt = requireTime(input.clock(), "credential broker service start time");
  let served = 0;
  let stoppedAt = startedAt;
  let resolveClosed!: (value: {
    endpoint: string;
    startedAt: string;
    stoppedAt: string;
    servedRequests: number;
  }) => void;
  const closed = new Promise<{
    endpoint: string;
    startedAt: string;
    stoppedAt: string;
    servedRequests: number;
  }>((resolve) => {
    resolveClosed = resolve;
  });
  const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(0);
    let handled = false;
    const reject = (message: string): void => {
      if (handled) return;
      handled = true;
      const response = Buffer.from(`${JSON.stringify({
        format: ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_WIRE_RESPONSE_FORMAT,
        ok: false,
        error: {
          code: "service-request-rejected",
          message,
        },
      })}\n`, "utf8");
      socket.end(response, () => {
        served += 1;
        if (served >= maxRequests && server.listening) server.close();
      });
    };
    const processFrame = async (frame: Buffer): Promise<void> => {
      if (handled) return;
      handled = true;
      try {
        const parsed = JSON.parse(frame.toString("utf8")) as unknown;
        const responseValue = await input.handle(parsed);
        const response = Buffer.from(`${JSON.stringify(responseValue)}\n`, "utf8");
        if (response.length > maxResponseBytes) {
          throw new Error("credential broker service wire response exceeds ceiling");
        }
        socket.end(response, () => {
          served += 1;
          if (served >= maxRequests && server.listening) server.close();
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const response = Buffer.from(`${JSON.stringify({
          format: ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_WIRE_RESPONSE_FORMAT,
          ok: false,
          error: {
            code: "service-request-rejected",
            message,
          },
        })}\n`, "utf8");
        socket.end(response, () => {
          served += 1;
          if (served >= maxRequests && server.listening) server.close();
        });
      }
    };
    socket.on("data", (chunk: Buffer) => {
      if (handled) return;
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > maxWireBytes) {
        reject("credential broker service wire request exceeds ceiling");
        return;
      }
      const newline = buffer.indexOf(0x0a);
      if (newline >= 0) {
        const trailing = buffer.subarray(newline + 1).toString("utf8").trim();
        if (trailing) {
          reject("credential broker service accepts one request frame per connection");
          return;
        }
        socket.pause();
        void processFrame(buffer.subarray(0, newline));
      }
    });
    socket.on("end", () => {
      if (!handled && buffer.length > 0) void processFrame(buffer);
      else if (!handled) reject("credential broker service request frame is empty");
    });
    socket.on("error", () => {
      socket.destroy();
    });
  });
  server.on("close", () => {
    stoppedAt = requireTime(input.clock(), "credential broker service stop time");
    if (endpoint.endpointKind === "unix") {
      fs.rmSync(endpoint.address, { force: true });
    }
    resolveClosed({
      endpoint: endpoint.endpoint,
      startedAt,
      stoppedAt,
      servedRequests: served,
    });
  });
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(endpoint.address);
  });
  if (endpoint.endpointKind === "unix") {
    fs.chmodSync(endpoint.address, 0o600);
  }
  return {
    endpoint: endpoint.endpoint,
    endpointKind: endpoint.endpointKind,
    address: endpoint.address,
    startedAt,
    servedRequests: () => served,
    close: async () => {
      if (!server.listening) {
        await closed;
        return;
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
      await closed;
    },
    closed,
  };
}

async function invokeLocalJson(input: {
  endpoint: string;
  value: unknown;
  timeoutMilliseconds: number;
  maxResponseBytes: number;
}): Promise<unknown> {
  const endpoint = asoiafAnswerCredentialBrokerServiceEndpoint(input.endpoint);
  assertPlatformEndpoint(endpoint.endpointKind);
  const timeoutMilliseconds = requireInteger(
    input.timeoutMilliseconds,
    "credential broker service invoke timeout",
    120_000,
  );
  const maxResponseBytes = requireInteger(
    input.maxResponseBytes,
    "credential broker service invoke response ceiling",
    MAX_RESPONSE_BYTES + MAX_WIRE_OVERHEAD,
  );
  const frame = Buffer.from(`${JSON.stringify(input.value)}\n`, "utf8");
  return await new Promise<unknown>((resolve, reject) => {
    const socket = net.createConnection(endpoint.address);
    let response = Buffer.alloc(0);
    let settled = false;
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(error);
    };
    socket.setTimeout(timeoutMilliseconds, () => {
      fail(new Error("credential broker service invocation timed out"));
    });
    socket.on("connect", () => socket.write(frame));
    socket.on("data", (chunk: Buffer) => {
      response = Buffer.concat([response, chunk]);
      if (response.length > maxResponseBytes) {
        fail(new Error("credential broker service invocation response exceeds ceiling"));
      }
    });
    socket.on("error", (error) => fail(error));
    socket.on("end", () => {
      if (settled) return;
      settled = true;
      try {
        const text = response.toString("utf8").trim();
        if (!text) throw new Error("credential broker service returned an empty response");
        resolve(JSON.parse(text) as unknown);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}

export async function startAsoiafAnswerCredentialBrokerService(
  input: AsoiafAnswerCredentialBrokerServiceServerInput,
): Promise<AsoiafAnswerCredentialBrokerServiceServer> {
  const policy = servicePolicyById(input.root, input.servicePolicyId);
  const maxRequests = input.maxRequests === undefined
    ? 1_000_000
    : requireInteger(input.maxRequests, "credential broker service maximum request count", 1_000_000);
  const clock = input.clock ?? (() => new Date().toISOString());
  const server = await startLocalJsonServer({
    endpoint: policy.localEndpoint,
    maxWireBytes: policy.maxRequestBytes + MAX_WIRE_OVERHEAD,
    maxResponseBytes: policy.maxResponseBytes + MAX_WIRE_OVERHEAD,
    maxRequests,
    clock,
    handle: (value) => {
      const record = requireExactKeys(value, [
        "format",
        "request",
        "payload",
      ], "credential broker service wire request");
      if (record.format !== ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_WIRE_REQUEST_FORMAT) {
        throw new Error("credential broker service wire request format is invalid");
      }
      const receivedAt = requireTime(clock(), "credential broker service wire receipt time");
      const result = dispatchAsoiafAnswerCredentialBrokerServiceRequest({
        root: input.root,
        request: record.request as AsoiafAnswerCredentialBrokerServiceRequest,
        payload: record.payload as AsoiafAnswerCredentialBrokerServicePayload,
        receivedAt,
        completedAt: requireTime(clock(), "credential broker service wire completion time"),
        powershellExecutable: input.powershellExecutable,
      });
      const response: AsoiafAnswerCredentialBrokerServiceWireResponse = {
        format: ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_WIRE_RESPONSE_FORMAT,
        ok: true,
        result,
      };
      return response;
    },
  });
  return server;
}

export async function invokeAsoiafAnswerCredentialBrokerService(
  input: AsoiafAnswerCredentialBrokerServiceInvokeInput,
): Promise<AsoiafAnswerCredentialBrokerServiceWireResponse> {
  const value: AsoiafAnswerCredentialBrokerServiceWireRequest = {
    format: ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_WIRE_REQUEST_FORMAT,
    request: input.request,
    payload: input.payload,
  };
  const response = await invokeLocalJson({
    endpoint: input.endpoint,
    value,
    timeoutMilliseconds: input.timeoutMilliseconds ?? 30_000,
    maxResponseBytes: input.maxResponseBytes ?? MAX_RESPONSE_BYTES + MAX_WIRE_OVERHEAD,
  });
  const record = requireExactKeys(response, [
    "format",
    "ok",
    ...(response && typeof response === "object" && (response as { ok?: unknown }).ok === true
      ? ["result"]
      : ["error"]),
  ], "credential broker service wire response");
  if (record.format !== ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_WIRE_RESPONSE_FORMAT) {
    throw new Error("credential broker service wire response format is invalid");
  }
  return response as AsoiafAnswerCredentialBrokerServiceWireResponse;
}

export async function probeAsoiafAnswerCredentialBrokerServiceEndpoint(input: {
  endpoint: string;
  challenge: string;
  timeoutMilliseconds?: number;
}): Promise<AsoiafAnswerCredentialBrokerServiceEndpointProbe> {
  const endpoint = asoiafAnswerCredentialBrokerServiceEndpoint(input.endpoint);
  const challengeDigest = sha256(requireId(input.challenge, "credential broker service probe challenge"));
  const clock = () => new Date().toISOString();
  const server = await startLocalJsonServer({
    endpoint: endpoint.endpoint,
    maxWireBytes: 64 * 1024,
    maxResponseBytes: 64 * 1024,
    maxRequests: 1,
    clock,
    handle: (value) => {
      const record = requireExactKeys(value, [
        "format",
        "challengeDigest",
      ], "credential broker service endpoint probe request");
      if (record.format !== ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_ENDPOINT_PROBE_FORMAT) {
        throw new Error("credential broker service endpoint probe format is invalid");
      }
      if (record.challengeDigest !== challengeDigest) {
        throw new Error("credential broker service endpoint probe challenge differs");
      }
      return {
        format: ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_ENDPOINT_PROBE_FORMAT,
        endpointKind: endpoint.endpointKind,
        challengeDigest,
        localEndpointOnly: true,
        authority: "none",
      };
    },
  });
  const response = await invokeLocalJson({
    endpoint: endpoint.endpoint,
    value: {
      format: ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_ENDPOINT_PROBE_FORMAT,
      challengeDigest,
    },
    timeoutMilliseconds: input.timeoutMilliseconds ?? 30_000,
    maxResponseBytes: 64 * 1024,
  });
  const summary = await server.closed;
  const responseDigest = bytesDigest(stableBytes(response));
  return {
    format: ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_ENDPOINT_PROBE_FORMAT,
    endpoint: endpoint.endpoint,
    endpointKind: endpoint.endpointKind,
    addressDigest: sha256(endpoint.address),
    challengeDigest,
    responseDigest,
    startedAt: summary.startedAt,
    completedAt: summary.stoppedAt,
    localEndpointOnly: true,
    requestBodyRetained: false,
    responseBodyRetained: false,
    probeAuthority: "transport-health-only",
    ...NO_AUTHORITY,
  };
}
