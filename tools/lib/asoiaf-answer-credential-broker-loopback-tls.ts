import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import {
  collectorContentId,
  sha256,
} from "./asoiaf-external-estate.js";
import {
  ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_WIRE_REQUEST_FORMAT,
  ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_WIRE_RESPONSE_FORMAT,
  dispatchAsoiafAnswerCredentialBrokerServiceRequest,
  readAsoiafAnswerCredentialBrokerServiceStatus,
  verifyAsoiafAnswerCredentialBrokerServiceEstate,
  type AsoiafAnswerCredentialBrokerServicePayload,
  type AsoiafAnswerCredentialBrokerServicePolicy,
  type AsoiafAnswerCredentialBrokerServiceRequest,
  type AsoiafAnswerCredentialBrokerServiceWireRequest,
  type AsoiafAnswerCredentialBrokerServiceWireResponse,
} from "./asoiaf-answer-credential-broker-service.js";
import {
  probeAsoiafAnswerTransportEndpoint,
  readAsoiafAnswerTransportOperationsStatus,
  verifyAsoiafAnswerTransportOperationsEstate,
  type AsoiafAnswerTransportAvailabilityObservation,
  type AsoiafAnswerTransportCertificateAdmission,
  type AsoiafAnswerTransportEndpointLease,
} from "./asoiaf-answer-desk-transport-operations.js";
import {
  fingerprintAsoiafAnswerTransportCertificate,
} from "./asoiaf-answer-desk-transport.js";

export const ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_POLICY_FORMAT =
  "axm-asoiaf-answer-credential-broker-loopback-tls-policy/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_SESSION_FORMAT =
  "axm-asoiaf-answer-credential-broker-loopback-tls-session/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_LIFECYCLE_FORMAT =
  "axm-asoiaf-answer-credential-broker-loopback-tls-lifecycle/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_STATE_FORMAT =
  "axm-asoiaf-answer-credential-broker-loopback-tls-state/1" as const;
export const ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_LOCK_FORMAT =
  "axm-asoiaf-answer-credential-broker-loopback-tls-lock/1" as const;

export type AsoiafAnswerCredentialBrokerLoopbackTlsLifecycleKind =
  | "ready"
  | "stopped"
  | "recovered";

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

export interface AsoiafAnswerCredentialBrokerLoopbackTlsPaths {
  root: string;
  listenerRoot: string;
  policies: string;
  sessions: string;
  lifecycle: string;
  state: string;
  lock: string;
}

export interface AsoiafAnswerCredentialBrokerLoopbackTlsPolicy
  extends NoAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_POLICY_FORMAT;
  listenerPolicyId: string;
  listenerPolicyFingerprint: `sha256:${string}`;
  brokerServicePolicyId: string;
  brokerServicePolicyFingerprint: `sha256:${string}`;
  brokerPolicyId: string;
  brokerPolicyFingerprint: `sha256:${string}`;
  providerProfileId: string;
  providerProfileFingerprint: `sha256:${string}`;
  endpointLeaseId: string;
  endpointLeaseFingerprint: `sha256:${string}`;
  serverId: string;
  baseUrl: string;
  host: "127.0.0.1" | "::1";
  port: number;
  serverCertificateAdmissionId: string;
  serverCertificateAdmissionFingerprint: `sha256:${string}`;
  serverCertificateFingerprint: `sha256:${string}`;
  serverIssuerCertificateFingerprint: `sha256:${string}`;
  clientCertificateAdmissionId: string;
  clientCertificateAdmissionFingerprint: `sha256:${string}`;
  clientCertificateFingerprint: `sha256:${string}`;
  clientIssuerCertificateFingerprint: `sha256:${string}`;
  clientPublicKeyFingerprint: `sha256:${string}`;
  serviceClientId: string;
  serviceClientPublicKeyFingerprint: `sha256:${string}`;
  maxSessionLifetimeMilliseconds: number;
  maxWireBytes: number;
  maxResponseBytes: number;
  createdAt: string;
  operatorId: string;
  loopbackOnly: true;
  mutualTlsRequired: true;
  privateKeyRetained: false;
  privateKeyPathRetained: false;
  certificateRetained: false;
  certificatePathRetained: false;
  rawRequestBodyRetained: false;
  rawResponseBodyRetained: false;
  listenerAuthority: "loopback-tls-admission-only";
}

export interface AsoiafAnswerCredentialBrokerLoopbackTlsSession
  extends NoAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_SESSION_FORMAT;
  sessionId: string;
  sessionFingerprint: `sha256:${string}`;
  listenerPolicyId: string;
  listenerPolicyFingerprint: `sha256:${string}`;
  brokerServicePolicyId: string;
  brokerServicePolicyFingerprint: `sha256:${string}`;
  endpointLeaseId: string;
  endpointLeaseFingerprint: `sha256:${string}`;
  idempotencyKeyDigest: `sha256:${string}`;
  preparedAt: string;
  expiresAt: string;
  operatorId: string;
  loopbackOnly: true;
  mutualTlsRequired: true;
  privateKeyRetained: false;
  privateKeyPathRetained: false;
  certificateRetained: false;
  certificatePathRetained: false;
  rawRequestBodyRetained: false;
  rawResponseBodyRetained: false;
  sessionAuthority: "listener-start-intent-only";
}

export interface AsoiafAnswerCredentialBrokerLoopbackTlsLifecycle
  extends NoAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_LIFECYCLE_FORMAT;
  lifecycleId: string;
  lifecycleFingerprint: `sha256:${string}`;
  listenerPolicyId: string;
  listenerPolicyFingerprint: `sha256:${string}`;
  sessionId: string;
  sessionFingerprint: `sha256:${string}`;
  endpointLeaseId: string;
  endpointLeaseFingerprint: `sha256:${string}`;
  kind: AsoiafAnswerCredentialBrokerLoopbackTlsLifecycleKind;
  eventAt: string;
  recoveredBySessionId: string | null;
  recoveredBySessionFingerprint: `sha256:${string}` | null;
  servedConnections: number | null;
  servedRequests: number | null;
  rejectedConnections: number | null;
  staleLockDigest: `sha256:${string}` | null;
  reason: string;
  loopbackOnly: true;
  mutualTlsRequired: true;
  privateKeyRetained: false;
  privateKeyPathRetained: false;
  certificateRetained: false;
  certificatePathRetained: false;
  rawRequestBodyRetained: false;
  rawResponseBodyRetained: false;
  lifecycleAuthority: "listener-runtime-reference-only";
}

export interface AsoiafAnswerCredentialBrokerLoopbackTlsStateEntry {
  listenerPolicyId: string;
  listenerPolicyFingerprint: `sha256:${string}`;
  endpointLeaseId: string;
  latestSessionId: string | null;
  latestSessionFingerprint: `sha256:${string}` | null;
  latestLifecycleId: string | null;
  latestLifecycleFingerprint: `sha256:${string}` | null;
  preparedSessionIds: string[];
  activeSessionIds: string[];
  stoppedSessionIds: string[];
  recoveredSessionIds: string[];
  updatedAt: string;
}

export interface AsoiafAnswerCredentialBrokerLoopbackTlsState
  extends NoAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_STATE_FORMAT;
  stateId: string;
  stateFingerprint: `sha256:${string}`;
  asOf: string;
  entries: AsoiafAnswerCredentialBrokerLoopbackTlsStateEntry[];
  stateAuthority: "projection-only";
}

export interface AsoiafAnswerCredentialBrokerLoopbackTlsStatus {
  format: "axm-asoiaf-answer-credential-broker-loopback-tls-status/1";
  paths: AsoiafAnswerCredentialBrokerLoopbackTlsPaths;
  policies: AsoiafAnswerCredentialBrokerLoopbackTlsPolicy[];
  sessions: AsoiafAnswerCredentialBrokerLoopbackTlsSession[];
  lifecycle: AsoiafAnswerCredentialBrokerLoopbackTlsLifecycle[];
  state: AsoiafAnswerCredentialBrokerLoopbackTlsState | null;
}

export interface AsoiafAnswerCredentialBrokerLoopbackTlsFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

export interface AsoiafAnswerCredentialBrokerLoopbackTlsPolicyInput {
  root: string;
  brokerServicePolicyId: string;
  endpointLeaseId: string;
  clientCertificateFingerprint: string;
  maxSessionLifetimeMilliseconds: number;
  createdAt: string;
  operatorId: string;
}

export interface AsoiafAnswerCredentialBrokerLoopbackTlsSessionInput {
  root: string;
  listenerPolicyId: string;
  idempotencyKey: string;
  preparedAt: string;
  expiresAt: string;
  operatorId: string;
}

export interface AsoiafAnswerCredentialBrokerLoopbackTlsServerInput {
  root: string;
  sessionId: string;
  serverCertificate: string | Buffer;
  serverPrivateKey: string | Buffer;
  clientCertificateAuthority: string | Buffer;
  maxRequests?: number;
  clock?: () => string;
}

export interface AsoiafAnswerCredentialBrokerLoopbackTlsServer {
  listenerPolicyId: string;
  sessionId: string;
  endpointLeaseId: string;
  baseUrl: string;
  host: "127.0.0.1" | "::1";
  port: number;
  ready: AsoiafAnswerCredentialBrokerLoopbackTlsLifecycle;
  servedConnections: () => number;
  servedRequests: () => number;
  rejectedConnections: () => number;
  close: (reason?: string) => Promise<void>;
  closed: Promise<{
    listenerPolicyId: string;
    sessionId: string;
    endpointLeaseId: string;
    baseUrl: string;
    startedAt: string;
    stoppedAt: string;
    servedConnections: number;
    servedRequests: number;
    rejectedConnections: number;
    stopLifecycle: AsoiafAnswerCredentialBrokerLoopbackTlsLifecycle;
  }>;
}

export interface AsoiafAnswerCredentialBrokerLoopbackTlsInvokeInput {
  baseUrl: string;
  expectedServerCertificateFingerprint: string;
  clientCertificate: string | Buffer;
  clientPrivateKey: string | Buffer;
  serverCertificateAuthority: string | Buffer;
  request: AsoiafAnswerCredentialBrokerServiceRequest;
  payload: AsoiafAnswerCredentialBrokerServicePayload;
  timeoutMilliseconds?: number;
  maxResponseBytes?: number;
}

export interface AsoiafAnswerCredentialBrokerLoopbackTlsProbeInput {
  root: string;
  listenerPolicyId: string;
  clientCertificate: string | Buffer;
  clientPrivateKey: string | Buffer;
  serverCertificateAuthority: string | Buffer;
  observedAt: string;
  timeoutMilliseconds?: number;
}

interface ListenerLock extends NoAuthority {
  format: typeof ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_LOCK_FORMAT;
  lockFingerprint: `sha256:${string}`;
  listenerPolicyId: string;
  listenerPolicyFingerprint: `sha256:${string}`;
  sessionId: string;
  sessionFingerprint: `sha256:${string}`;
  endpointLeaseId: string;
  endpointLeaseFingerprint: `sha256:${string}`;
  processId: number;
  acquiredAt: string;
  lockAuthority: "runtime-exclusion-only";
}

const MAX_SESSION_LIFETIME = 24 * 60 * 60 * 1000;
const MAX_WIRE_BYTES = 4 * 1024 * 1024 + 256 * 1024;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024 + 256 * 1024;
const MAX_REQUESTS = 1_000_000;

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

function requireReason(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length < 24 || normalized.length > 2048) {
    throw new Error(`${label} must contain 24 through 2048 characters`);
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

function finding(
  code: string,
  severity: AsoiafAnswerCredentialBrokerLoopbackTlsFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafAnswerCredentialBrokerLoopbackTlsFinding {
  return { code, severity, subjectId, detail };
}

function sortFindings(
  values: readonly AsoiafAnswerCredentialBrokerLoopbackTlsFinding[],
): AsoiafAnswerCredentialBrokerLoopbackTlsFinding[] {
  const rank = { error: 0, warning: 1, notice: 2 } as const;
  return [...values].sort((left, right) =>
    rank[left.severity] - rank[right.severity]
    || left.code.localeCompare(right.code)
    || left.subjectId.localeCompare(right.subjectId)
    || left.detail.localeCompare(right.detail));
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
      throw new Error(`loopback TLS immutable file collision at ${target}`);
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

function recursiveFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const values: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) values.push(...recursiveFiles(target));
    else if (entry.isFile()) values.push(target);
  }
  return values.sort();
}

export function asoiafAnswerCredentialBrokerLoopbackTlsPaths(
  root: string,
): AsoiafAnswerCredentialBrokerLoopbackTlsPaths {
  const absolute = path.resolve(root);
  const listenerRoot = path.join(
    absolute,
    "answer-credential-broker-loopback-tls",
  );
  return {
    root: absolute,
    listenerRoot,
    policies: path.join(listenerRoot, "policies"),
    sessions: path.join(listenerRoot, "sessions"),
    lifecycle: path.join(listenerRoot, "lifecycle"),
    state: path.join(listenerRoot, "LISTENER-STATE.json"),
    lock: path.join(listenerRoot, ".listener-lock"),
  };
}

export function readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(
  root: string,
): AsoiafAnswerCredentialBrokerLoopbackTlsStatus {
  const paths = asoiafAnswerCredentialBrokerLoopbackTlsPaths(root);
  return {
    format: "axm-asoiaf-answer-credential-broker-loopback-tls-status/1",
    paths,
    policies: listJson<AsoiafAnswerCredentialBrokerLoopbackTlsPolicy>(
      paths.policies,
    ),
    sessions: listJson<AsoiafAnswerCredentialBrokerLoopbackTlsSession>(
      paths.sessions,
    ),
    lifecycle: listJson<AsoiafAnswerCredentialBrokerLoopbackTlsLifecycle>(
      paths.lifecycle,
    ),
    state: fs.existsSync(paths.state)
      ? readJson<AsoiafAnswerCredentialBrokerLoopbackTlsState>(paths.state)
      : null,
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

function parentObjects(root: string): {
  servicePolicies: AsoiafAnswerCredentialBrokerServicePolicy[];
  certificates: AsoiafAnswerTransportCertificateAdmission[];
  endpoints: AsoiafAnswerTransportEndpointLease[];
} {
  const serviceErrors = verifyAsoiafAnswerCredentialBrokerServiceEstate(root)
    .filter((entry) => entry.severity === "error");
  if (serviceErrors.length > 0) {
    throw new Error(
      `loopback TLS requires a valid broker service estate: ${serviceErrors.map((entry) => entry.code).join(", ")}`,
    );
  }
  const operationsErrors = verifyAsoiafAnswerTransportOperationsEstate(root)
    .filter((entry) => entry.severity === "error");
  if (operationsErrors.length > 0) {
    throw new Error(
      `loopback TLS requires valid transport operations custody: ${operationsErrors.map((entry) => entry.code).join(", ")}`,
    );
  }
  const service = readAsoiafAnswerCredentialBrokerServiceStatus(root);
  const operations = readAsoiafAnswerTransportOperationsStatus(root);
  return {
    servicePolicies: service.policies,
    certificates: operations.certificates,
    endpoints: operations.endpoints,
  };
}

function listenerPolicyById(
  root: string,
  listenerPolicyId: string,
): AsoiafAnswerCredentialBrokerLoopbackTlsPolicy {
  return exactlyOne(
    readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(root).policies,
    (entry) => entry.listenerPolicyId === listenerPolicyId,
    `loopback TLS policy ${listenerPolicyId}`,
  );
}

function sessionById(
  root: string,
  sessionId: string,
): AsoiafAnswerCredentialBrokerLoopbackTlsSession {
  return exactlyOne(
    readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(root).sessions,
    (entry) => entry.sessionId === sessionId,
    `loopback TLS session ${sessionId}`,
  );
}

function policyCore(value: AsoiafAnswerCredentialBrokerLoopbackTlsPolicy) {
  const {
    listenerPolicyId: _id,
    listenerPolicyFingerprint: _fingerprint,
    ...core
  } = value;
  return core;
}

function sessionCore(value: AsoiafAnswerCredentialBrokerLoopbackTlsSession) {
  const {
    sessionId: _id,
    sessionFingerprint: _fingerprint,
    ...core
  } = value;
  return core;
}

function lifecycleCore(
  value: AsoiafAnswerCredentialBrokerLoopbackTlsLifecycle,
) {
  const {
    lifecycleId: _id,
    lifecycleFingerprint: _fingerprint,
    ...core
  } = value;
  return core;
}

function stateCore(value: AsoiafAnswerCredentialBrokerLoopbackTlsState) {
  const {
    stateId: _id,
    stateFingerprint: _fingerprint,
    ...core
  } = value;
  return core;
}

function lockCore(value: ListenerLock) {
  const { lockFingerprint: _fingerprint, ...core } = value;
  return core;
}

function normalizeLoopbackBaseUrl(value: string): {
  baseUrl: string;
  host: "127.0.0.1" | "::1";
  port: number;
} {
  const url = new URL(value);
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.search
    || url.hash
    || (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error(
      "loopback TLS endpoint must be one credential-free HTTPS origin",
    );
  }
  const host = url.hostname;
  if (host !== "127.0.0.1" && host !== "::1") {
    throw new Error(
      "loopback TLS endpoint must use the literal 127.0.0.1 or ::1 address",
    );
  }
  if (!url.port) {
    throw new Error("loopback TLS endpoint must declare an explicit port");
  }
  const port = Number(url.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("loopback TLS endpoint port is invalid");
  }
  return {
    baseUrl: `${url.origin}/`,
    host,
    port,
  };
}

function publicKeyFingerprint(key: crypto.KeyObject): `sha256:${string}` {
  const publicKey = key.type === "public" ? key : crypto.createPublicKey(key);
  return bytesDigest(
    publicKey.export({ type: "spki", format: "der" }) as Buffer,
  );
}

function certificatePublicKeyFingerprint(
  certificate: string | Buffer,
): `sha256:${string}` {
  return publicKeyFingerprint(new crypto.X509Certificate(certificate).publicKey);
}

function certificateFingerprintFromRaw(raw: Buffer): `sha256:${string}` {
  return bytesDigest(raw);
}

function buildState(
  root: string,
): AsoiafAnswerCredentialBrokerLoopbackTlsState {
  const status = readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(root);
  const entries = status.policies.map((policy) => {
    const sessions = status.sessions
      .filter((entry) => entry.listenerPolicyId === policy.listenerPolicyId)
      .sort((left, right) =>
        left.preparedAt.localeCompare(right.preparedAt)
        || left.sessionId.localeCompare(right.sessionId));
    const lifecycle = status.lifecycle
      .filter((entry) => entry.listenerPolicyId === policy.listenerPolicyId)
      .sort((left, right) =>
        left.eventAt.localeCompare(right.eventAt)
        || left.lifecycleId.localeCompare(right.lifecycleId));
    const ready = new Set(
      lifecycle.filter((entry) => entry.kind === "ready")
        .map((entry) => entry.sessionId),
    );
    const stopped = new Set(
      lifecycle.filter((entry) => entry.kind === "stopped")
        .map((entry) => entry.sessionId),
    );
    const recovered = new Set(
      lifecycle.filter((entry) => entry.kind === "recovered")
        .map((entry) => entry.sessionId),
    );
    const terminal = new Set([...stopped, ...recovered]);
    const latestSession = sessions.at(-1) ?? null;
    const latestLifecycle = lifecycle.at(-1) ?? null;
    return {
      listenerPolicyId: policy.listenerPolicyId,
      listenerPolicyFingerprint: policy.listenerPolicyFingerprint,
      endpointLeaseId: policy.endpointLeaseId,
      latestSessionId: latestSession?.sessionId ?? null,
      latestSessionFingerprint: latestSession?.sessionFingerprint ?? null,
      latestLifecycleId: latestLifecycle?.lifecycleId ?? null,
      latestLifecycleFingerprint:
        latestLifecycle?.lifecycleFingerprint ?? null,
      preparedSessionIds: sessions
        .filter((entry) => !ready.has(entry.sessionId))
        .map((entry) => entry.sessionId)
        .sort(),
      activeSessionIds: sessions
        .filter((entry) =>
          ready.has(entry.sessionId) && !terminal.has(entry.sessionId))
        .map((entry) => entry.sessionId)
        .sort(),
      stoppedSessionIds: [...stopped].sort(),
      recoveredSessionIds: [...recovered].sort(),
      updatedAt:
        latestLifecycle?.eventAt
        ?? latestSession?.preparedAt
        ?? policy.createdAt,
    };
  }).sort((left, right) =>
    left.listenerPolicyId.localeCompare(right.listenerPolicyId));
  const asOf = entries.map((entry) => entry.updatedAt).sort().at(-1)
    ?? "1970-01-01T00:00:00.000Z";
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_STATE_FORMAT,
    asOf,
    entries,
    stateAuthority: "projection-only" as const,
    ...NO_AUTHORITY,
  };
  const stateFingerprint = sha256(core);
  return {
    ...core,
    stateId: collectorContentId(
      "asoiaf-answer-credential-broker-loopback-tls-state",
      { asOf, stateFingerprint },
    ),
    stateFingerprint,
  };
}

function refreshState(
  root: string,
): AsoiafAnswerCredentialBrokerLoopbackTlsState | null {
  const paths = asoiafAnswerCredentialBrokerLoopbackTlsPaths(root);
  if (
    listJson<AsoiafAnswerCredentialBrokerLoopbackTlsPolicy>(
      paths.policies,
    ).length === 0
  ) {
    fs.rmSync(paths.state, { force: true });
    return null;
  }
  const state = buildState(root);
  writeAtomic(paths.state, state);
  return state;
}

export function retainAsoiafAnswerCredentialBrokerLoopbackTlsPolicy(
  input: AsoiafAnswerCredentialBrokerLoopbackTlsPolicyInput,
): {
  policy: AsoiafAnswerCredentialBrokerLoopbackTlsPolicy;
  replayed: boolean;
} {
  const parent = parentObjects(input.root);
  const servicePolicy = exactlyOne(
    parent.servicePolicies,
    (entry) => entry.servicePolicyId === input.brokerServicePolicyId,
    `broker service policy ${input.brokerServicePolicyId}`,
  );
  const endpoint = exactlyOne(
    parent.endpoints,
    (entry) => entry.endpointLeaseId === input.endpointLeaseId,
    `transport endpoint lease ${input.endpointLeaseId}`,
  );
  const clientFingerprint = requireDigest(
    input.clientCertificateFingerprint,
    "listener client certificate fingerprint",
  );
  const client = exactlyOne(
    parent.certificates,
    (entry) => entry.certificateFingerprint === clientFingerprint,
    `client certificate admission ${clientFingerprint}`,
  );
  const server = exactlyOne(
    parent.certificates,
    (entry) => entry.admissionId === endpoint.serverCertificateAdmissionId,
    `server certificate admission ${endpoint.serverCertificateAdmissionId}`,
  );
  if (endpoint.networkScope !== "loopback") {
    throw new Error("loopback TLS policy requires a loopback endpoint lease");
  }
  const parsed = normalizeLoopbackBaseUrl(endpoint.baseUrl);
  if (
    server.usage !== "server-auth"
    || server.certificateFingerprint !== endpoint.serverCertificateFingerprint
    || server.admissionFingerprint
      !== endpoint.serverCertificateAdmissionFingerprint
    || server.issuerCertificateFingerprint
      !== endpoint.serverIssuerCertificateFingerprint
  ) {
    throw new Error(
      "loopback TLS endpoint differs from its exact server certificate admission",
    );
  }
  if (
    client.usage !== "client-auth"
    || !client.actorRole
    || client.issuerCertificateFingerprint
      !== endpoint.acceptedClientCaCertificateFingerprint
  ) {
    throw new Error(
      "loopback TLS client certificate is not admitted under the endpoint client CA",
    );
  }
  if (
    client.principalId !== servicePolicy.clientId
    || client.publicKeyFingerprint !== servicePolicy.clientPublicKeyFingerprint
  ) {
    throw new Error(
      "loopback TLS client certificate differs from the broker service client identity",
    );
  }
  const createdAt = requireTime(input.createdAt, "listener policy creation time");
  if (
    Date.parse(createdAt) < Date.parse(servicePolicy.createdAt)
    || Date.parse(createdAt) < Date.parse(endpoint.advertisedAt)
    || Date.parse(createdAt) < Date.parse(server.admittedAt)
    || Date.parse(createdAt) < Date.parse(client.admittedAt)
  ) {
    throw new Error("loopback TLS policy predates parent custody");
  }
  const maxSessionLifetimeMilliseconds = requireInteger(
    input.maxSessionLifetimeMilliseconds,
    "listener maximum session lifetime",
    MAX_SESSION_LIFETIME,
  );
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_POLICY_FORMAT,
    brokerServicePolicyId: servicePolicy.servicePolicyId,
    brokerServicePolicyFingerprint: servicePolicy.servicePolicyFingerprint,
    brokerPolicyId: servicePolicy.brokerPolicyId,
    brokerPolicyFingerprint: servicePolicy.brokerPolicyFingerprint,
    providerProfileId: servicePolicy.providerProfileId,
    providerProfileFingerprint: servicePolicy.providerProfileFingerprint,
    endpointLeaseId: endpoint.endpointLeaseId,
    endpointLeaseFingerprint: endpoint.endpointLeaseFingerprint,
    serverId: endpoint.serverId,
    baseUrl: parsed.baseUrl,
    host: parsed.host,
    port: parsed.port,
    serverCertificateAdmissionId: server.admissionId,
    serverCertificateAdmissionFingerprint: server.admissionFingerprint,
    serverCertificateFingerprint: server.certificateFingerprint,
    serverIssuerCertificateFingerprint: server.issuerCertificateFingerprint,
    clientCertificateAdmissionId: client.admissionId,
    clientCertificateAdmissionFingerprint: client.admissionFingerprint,
    clientCertificateFingerprint: client.certificateFingerprint,
    clientIssuerCertificateFingerprint: client.issuerCertificateFingerprint,
    clientPublicKeyFingerprint: client.publicKeyFingerprint,
    serviceClientId: servicePolicy.clientId,
    serviceClientPublicKeyFingerprint:
      servicePolicy.clientPublicKeyFingerprint,
    maxSessionLifetimeMilliseconds,
    maxWireBytes: Math.min(
      servicePolicy.maxRequestBytes + 256 * 1024,
      MAX_WIRE_BYTES,
    ),
    maxResponseBytes: Math.min(
      servicePolicy.maxResponseBytes + 256 * 1024,
      MAX_RESPONSE_BYTES,
    ),
    createdAt,
    operatorId: requireId(input.operatorId, "listener policy operator"),
    loopbackOnly: true as const,
    mutualTlsRequired: true as const,
    privateKeyRetained: false as const,
    privateKeyPathRetained: false as const,
    certificateRetained: false as const,
    certificatePathRetained: false as const,
    rawRequestBodyRetained: false as const,
    rawResponseBodyRetained: false as const,
    listenerAuthority: "loopback-tls-admission-only" as const,
    ...NO_AUTHORITY,
  };
  const listenerPolicyFingerprint = sha256(core);
  const policy: AsoiafAnswerCredentialBrokerLoopbackTlsPolicy = {
    ...core,
    listenerPolicyId: collectorContentId(
      "asoiaf-answer-credential-broker-loopback-tls-policy",
      {
        brokerServicePolicyId: servicePolicy.servicePolicyId,
        endpointLeaseId: endpoint.endpointLeaseId,
        clientCertificateFingerprint: client.certificateFingerprint,
        listenerPolicyFingerprint,
      },
    ),
    listenerPolicyFingerprint,
  };
  const paths = asoiafAnswerCredentialBrokerLoopbackTlsPaths(input.root);
  const persisted = writeExact(
    digestPath(paths.policies, listenerPolicyFingerprint),
    policy,
  );
  refreshState(input.root);
  return { policy: persisted.value, replayed: persisted.replayed };
}

export function retainAsoiafAnswerCredentialBrokerLoopbackTlsSession(
  input: AsoiafAnswerCredentialBrokerLoopbackTlsSessionInput,
): {
  session: AsoiafAnswerCredentialBrokerLoopbackTlsSession;
  replayed: boolean;
} {
  const policy = listenerPolicyById(input.root, input.listenerPolicyId);
  const preparedAt = requireTime(input.preparedAt, "listener session preparation time");
  const expiresAt = requireTime(input.expiresAt, "listener session expiry");
  const lifetime = Date.parse(expiresAt) - Date.parse(preparedAt);
  if (
    lifetime < 1
    || lifetime > policy.maxSessionLifetimeMilliseconds
    || Date.parse(preparedAt) < Date.parse(policy.createdAt)
  ) {
    throw new Error("loopback TLS session lifetime or chronology is invalid");
  }
  const operations = readAsoiafAnswerTransportOperationsStatus(input.root);
  const endpoint = exactlyOne(
    operations.endpoints,
    (entry) => entry.endpointLeaseId === policy.endpointLeaseId,
    `transport endpoint lease ${policy.endpointLeaseId}`,
  );
  if (
    Date.parse(preparedAt) < Date.parse(endpoint.availableFrom)
    || Date.parse(expiresAt) > Date.parse(endpoint.expiresAt)
  ) {
    throw new Error("loopback TLS session falls outside the endpoint lease");
  }
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_SESSION_FORMAT,
    listenerPolicyId: policy.listenerPolicyId,
    listenerPolicyFingerprint: policy.listenerPolicyFingerprint,
    brokerServicePolicyId: policy.brokerServicePolicyId,
    brokerServicePolicyFingerprint: policy.brokerServicePolicyFingerprint,
    endpointLeaseId: policy.endpointLeaseId,
    endpointLeaseFingerprint: policy.endpointLeaseFingerprint,
    idempotencyKeyDigest: sha256(requireId(
      input.idempotencyKey,
      "listener session idempotency key",
    )),
    preparedAt,
    expiresAt,
    operatorId: requireId(input.operatorId, "listener session operator"),
    loopbackOnly: true as const,
    mutualTlsRequired: true as const,
    privateKeyRetained: false as const,
    privateKeyPathRetained: false as const,
    certificateRetained: false as const,
    certificatePathRetained: false as const,
    rawRequestBodyRetained: false as const,
    rawResponseBodyRetained: false as const,
    sessionAuthority: "listener-start-intent-only" as const,
    ...NO_AUTHORITY,
  };
  const sessionFingerprint = sha256(core);
  const session: AsoiafAnswerCredentialBrokerLoopbackTlsSession = {
    ...core,
    sessionId: collectorContentId(
      "asoiaf-answer-credential-broker-loopback-tls-session",
      {
        listenerPolicyId: policy.listenerPolicyId,
        idempotencyKeyDigest: core.idempotencyKeyDigest,
        sessionFingerprint,
      },
    ),
    sessionFingerprint,
  };
  const existing = readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(
    input.root,
  ).sessions.filter(
    (entry) => entry.idempotencyKeyDigest === session.idempotencyKeyDigest,
  );
  if (existing.length > 0) {
    if (
      existing.length !== 1
      || stableJson(existing[0]) !== stableJson(session)
    ) {
      throw new Error(
        "loopback TLS session idempotency key conflicts with retained intent",
      );
    }
    return { session: existing[0]!, replayed: true };
  }
  const paths = asoiafAnswerCredentialBrokerLoopbackTlsPaths(input.root);
  const persisted = writeExact(
    digestPath(paths.sessions, sessionFingerprint),
    session,
  );
  refreshState(input.root);
  return { session: persisted.value, replayed: persisted.replayed };
}

function retainLifecycle(
  root: string,
  input: Omit<
    AsoiafAnswerCredentialBrokerLoopbackTlsLifecycle,
    "lifecycleId" | "lifecycleFingerprint"
  >,
): {
  lifecycle: AsoiafAnswerCredentialBrokerLoopbackTlsLifecycle;
  replayed: boolean;
} {
  const lifecycleFingerprint = sha256(input);
  const lifecycle: AsoiafAnswerCredentialBrokerLoopbackTlsLifecycle = {
    ...input,
    lifecycleId: collectorContentId(
      "asoiaf-answer-credential-broker-loopback-tls-lifecycle",
      {
        sessionId: input.sessionId,
        kind: input.kind,
        eventAt: input.eventAt,
        lifecycleFingerprint,
      },
    ),
    lifecycleFingerprint,
  };
  const status = readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(root);
  const sameKind = status.lifecycle.filter(
    (entry) => entry.sessionId === lifecycle.sessionId
      && entry.kind === lifecycle.kind,
  );
  if (sameKind.length > 0) {
    if (
      sameKind.length !== 1
      || stableJson(sameKind[0]) !== stableJson(lifecycle)
    ) {
      throw new Error(
        `loopback TLS session already has a different ${lifecycle.kind} lifecycle`,
      );
    }
    return { lifecycle: sameKind[0]!, replayed: true };
  }
  if (
    lifecycle.kind !== "ready"
    && status.lifecycle.some(
      (entry) => entry.sessionId === lifecycle.sessionId
        && (entry.kind === "stopped" || entry.kind === "recovered"),
    )
  ) {
    throw new Error("loopback TLS session already has a terminal lifecycle");
  }
  const paths = asoiafAnswerCredentialBrokerLoopbackTlsPaths(root);
  const persisted = writeExact(
    digestPath(paths.lifecycle, lifecycleFingerprint),
    lifecycle,
  );
  refreshState(root);
  return { lifecycle: persisted.value, replayed: persisted.replayed };
}

function lifecycleBase(input: {
  policy: AsoiafAnswerCredentialBrokerLoopbackTlsPolicy;
  session: AsoiafAnswerCredentialBrokerLoopbackTlsSession;
  kind: AsoiafAnswerCredentialBrokerLoopbackTlsLifecycleKind;
  eventAt: string;
  recoveredBySession?: AsoiafAnswerCredentialBrokerLoopbackTlsSession | null;
  servedConnections?: number | null;
  servedRequests?: number | null;
  rejectedConnections?: number | null;
  staleLockDigest?: `sha256:${string}` | null;
  reason: string;
}): Omit<
  AsoiafAnswerCredentialBrokerLoopbackTlsLifecycle,
  "lifecycleId" | "lifecycleFingerprint"
> {
  return {
    format: ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_LIFECYCLE_FORMAT,
    listenerPolicyId: input.policy.listenerPolicyId,
    listenerPolicyFingerprint: input.policy.listenerPolicyFingerprint,
    sessionId: input.session.sessionId,
    sessionFingerprint: input.session.sessionFingerprint,
    endpointLeaseId: input.policy.endpointLeaseId,
    endpointLeaseFingerprint: input.policy.endpointLeaseFingerprint,
    kind: input.kind,
    eventAt: requireTime(input.eventAt, "listener lifecycle time"),
    recoveredBySessionId: input.recoveredBySession?.sessionId ?? null,
    recoveredBySessionFingerprint:
      input.recoveredBySession?.sessionFingerprint ?? null,
    servedConnections: input.servedConnections ?? null,
    servedRequests: input.servedRequests ?? null,
    rejectedConnections: input.rejectedConnections ?? null,
    staleLockDigest: input.staleLockDigest ?? null,
    reason: requireReason(input.reason, "listener lifecycle reason"),
    loopbackOnly: true,
    mutualTlsRequired: true,
    privateKeyRetained: false,
    privateKeyPathRetained: false,
    certificateRetained: false,
    certificatePathRetained: false,
    rawRequestBodyRetained: false,
    rawResponseBodyRetained: false,
    lifecycleAuthority: "listener-runtime-reference-only",
    ...NO_AUTHORITY,
  };
}

function buildLock(input: {
  policy: AsoiafAnswerCredentialBrokerLoopbackTlsPolicy;
  session: AsoiafAnswerCredentialBrokerLoopbackTlsSession;
  acquiredAt: string;
}): ListenerLock {
  const core = {
    format: ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_LOCK_FORMAT,
    listenerPolicyId: input.policy.listenerPolicyId,
    listenerPolicyFingerprint: input.policy.listenerPolicyFingerprint,
    sessionId: input.session.sessionId,
    sessionFingerprint: input.session.sessionFingerprint,
    endpointLeaseId: input.policy.endpointLeaseId,
    endpointLeaseFingerprint: input.policy.endpointLeaseFingerprint,
    processId: process.pid,
    acquiredAt: requireTime(input.acquiredAt, "listener lock time"),
    lockAuthority: "runtime-exclusion-only" as const,
    ...NO_AUTHORITY,
  };
  return {
    ...core,
    lockFingerprint: sha256(core),
  };
}

function validateRuntimeMaterial(input: {
  policy: AsoiafAnswerCredentialBrokerLoopbackTlsPolicy;
  serverCertificate: string | Buffer;
  serverPrivateKey: string | Buffer;
  clientCertificateAuthority: string | Buffer;
}): void {
  const serverFingerprint = fingerprintAsoiafAnswerTransportCertificate(
    input.serverCertificate,
  );
  if (serverFingerprint !== input.policy.serverCertificateFingerprint) {
    throw new Error(
      "loopback TLS server certificate differs from the endpoint lease pin",
    );
  }
  if (
    certificatePublicKeyFingerprint(input.serverCertificate)
    !== publicKeyFingerprint(crypto.createPrivateKey(input.serverPrivateKey))
  ) {
    throw new Error(
      "loopback TLS server private key differs from the admitted certificate",
    );
  }
  const clientCaFingerprint = fingerprintAsoiafAnswerTransportCertificate(
    input.clientCertificateAuthority,
  );
  if (clientCaFingerprint !== input.policy.clientIssuerCertificateFingerprint) {
    throw new Error(
      "loopback TLS client CA differs from the retained endpoint policy",
    );
  }
}

function activeSessions(
  root: string,
  listenerPolicyId: string,
): AsoiafAnswerCredentialBrokerLoopbackTlsSession[] {
  refreshState(root);
  const status = readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(root);
  const entry = status.state?.entries.find(
    (value) => value.listenerPolicyId === listenerPolicyId,
  );
  if (!entry) return [];
  return entry.activeSessionIds.map((sessionId) =>
    exactlyOne(
      status.sessions,
      (session) => session.sessionId === sessionId,
      `active listener session ${sessionId}`,
    ));
}

function lockDigestAndRemove(
  paths: AsoiafAnswerCredentialBrokerLoopbackTlsPaths,
): `sha256:${string}` | null {
  if (!fs.existsSync(paths.lock)) return null;
  const bytes = fs.readFileSync(paths.lock);
  const digest = bytesDigest(bytes);
  fs.rmSync(paths.lock, { force: true });
  return digest;
}

function writeLock(
  paths: AsoiafAnswerCredentialBrokerLoopbackTlsPaths,
  lock: ListenerLock,
): void {
  fs.mkdirSync(paths.listenerRoot, { recursive: true });
  fs.writeFileSync(
    paths.lock,
    `${JSON.stringify(lock, null, 2)}\n`,
    { encoding: "utf8", flag: "wx", mode: 0o600 },
  );
}

function removeOwnLock(
  paths: AsoiafAnswerCredentialBrokerLoopbackTlsPaths,
  sessionId: string,
): void {
  if (!fs.existsSync(paths.lock)) return;
  const lock = readJson<ListenerLock>(paths.lock);
  if (lock.sessionId !== sessionId) {
    throw new Error(
      "loopback TLS runtime lock belongs to a different session",
    );
  }
  fs.rmSync(paths.lock, { force: true });
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
  if (
    actual.length !== expected.length
    || actual.some((entry, index) => entry !== expected[index])
  ) {
    throw new Error(`${label} contains unsupported or missing fields`);
  }
  return record;
}

function rejectionResponse(message: string): Buffer {
  return Buffer.from(`${JSON.stringify({
    format: ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_WIRE_RESPONSE_FORMAT,
    ok: false,
    error: {
      code: "service-request-rejected",
      message,
    },
  })}\n`, "utf8");
}

export async function startAsoiafAnswerCredentialBrokerLoopbackTls(
  input: AsoiafAnswerCredentialBrokerLoopbackTlsServerInput,
): Promise<AsoiafAnswerCredentialBrokerLoopbackTlsServer> {
  const session = sessionById(input.root, input.sessionId);
  const policy = listenerPolicyById(input.root, session.listenerPolicyId);
  const existingLifecycle =
    readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(input.root).lifecycle
      .filter((entry) => entry.sessionId === session.sessionId);
  if (existingLifecycle.some((entry) => entry.kind === "ready")) {
    throw new Error("loopback TLS session has already entered runtime");
  }
  validateRuntimeMaterial({
    policy,
    serverCertificate: input.serverCertificate,
    serverPrivateKey: input.serverPrivateKey,
    clientCertificateAuthority: input.clientCertificateAuthority,
  });
  const maxRequests = input.maxRequests === undefined
    ? MAX_REQUESTS
    : requireInteger(input.maxRequests, "listener maximum request count", MAX_REQUESTS);
  const clock = input.clock ?? (() => new Date().toISOString());
  const startedAt = requireTime(clock(), "listener start time");
  if (
    Date.parse(startedAt) < Date.parse(session.preparedAt)
    || Date.parse(startedAt) > Date.parse(session.expiresAt)
  ) {
    throw new Error("loopback TLS session is not live at listener start");
  }
  const operations = readAsoiafAnswerTransportOperationsStatus(input.root);
  const endpoint = exactlyOne(
    operations.endpoints,
    (entry) => entry.endpointLeaseId === policy.endpointLeaseId,
    `transport endpoint lease ${policy.endpointLeaseId}`,
  );
  if (
    Date.parse(startedAt) < Date.parse(endpoint.availableFrom)
    || Date.parse(startedAt) >= Date.parse(endpoint.expiresAt)
  ) {
    throw new Error("loopback TLS endpoint lease is not active at listener start");
  }
  const paths = asoiafAnswerCredentialBrokerLoopbackTlsPaths(input.root);
  let accepting = false;
  let servedConnections = 0;
  let servedRequests = 0;
  let rejectedConnections = 0;
  let stopReason =
    "The loopback TLS listener completed its bounded runtime and closed normally.";
  let stopLifecycle:
    | AsoiafAnswerCredentialBrokerLoopbackTlsLifecycle
    | null = null;
  let resolveClosed!: (
    value: Awaited<
      AsoiafAnswerCredentialBrokerLoopbackTlsServer["closed"]
    >,
  ) => void;
  let rejectClosed!: (error: Error) => void;
  const closed = new Promise<
    Awaited<AsoiafAnswerCredentialBrokerLoopbackTlsServer["closed"]>
  >((resolve, reject) => {
    resolveClosed = resolve;
    rejectClosed = reject;
  });

  const server = tls.createServer({
    key: input.serverPrivateKey,
    cert: input.serverCertificate,
    ca: input.clientCertificateAuthority,
    requestCert: true,
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
    maxVersion: "TLSv1.3",
  }, (socket) => {
    servedConnections += 1;
    if (!accepting || !socket.authorized) {
      rejectedConnections += 1;
      socket.end(rejectionResponse(
        accepting
          ? "loopback TLS peer is not authorized"
          : "loopback TLS listener is not ready",
      ));
      return;
    }
    const peer = socket.getPeerCertificate(true);
    const peerFingerprint = peer.raw && peer.raw.length > 0
      ? certificateFingerprintFromRaw(peer.raw)
      : null;
    let peerPublicKeyFingerprint: `sha256:${string}` | null = null;
    if (peer.raw && peer.raw.length > 0) {
      try {
        peerPublicKeyFingerprint = publicKeyFingerprint(
          new crypto.X509Certificate(peer.raw).publicKey,
        );
      } catch {
        peerPublicKeyFingerprint = null;
      }
    }
    if (
      peerFingerprint !== policy.clientCertificateFingerprint
      || peerPublicKeyFingerprint !== policy.clientPublicKeyFingerprint
    ) {
      rejectedConnections += 1;
      socket.end(rejectionResponse(
        "loopback TLS peer certificate differs from retained client custody",
      ));
      return;
    }

    let buffer = Buffer.alloc(0);
    let handled = false;
    const finish = (response: Buffer, rejected: boolean): void => {
      if (handled) return;
      handled = true;
      servedRequests += 1;
      if (rejected) rejectedConnections += 1;
      socket.end(response, () => {
        if (servedRequests >= maxRequests && server.listening) {
          server.close();
        }
      });
    };
    const processFrame = (frame: Buffer): void => {
      if (handled) return;
      try {
        const value = JSON.parse(frame.toString("utf8")) as unknown;
        const record = requireExactKeys(
          value,
          ["format", "request", "payload"],
          "loopback TLS service wire request",
        );
        if (
          record.format
          !== ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_WIRE_REQUEST_FORMAT
        ) {
          throw new Error("loopback TLS service wire request format is invalid");
        }
        const receivedAt = requireTime(clock(), "loopback TLS request receipt time");
        const result = dispatchAsoiafAnswerCredentialBrokerServiceRequest({
          root: input.root,
          request: record.request as AsoiafAnswerCredentialBrokerServiceRequest,
          payload: record.payload as AsoiafAnswerCredentialBrokerServicePayload,
          receivedAt,
          completedAt: requireTime(
            clock(),
            "loopback TLS request completion time",
          ),
        });
        const response: AsoiafAnswerCredentialBrokerServiceWireResponse = {
          format:
            ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_WIRE_RESPONSE_FORMAT,
          ok: true,
          result,
        };
        const bytes = Buffer.from(`${JSON.stringify(response)}\n`, "utf8");
        if (bytes.length > policy.maxResponseBytes) {
          throw new Error("loopback TLS response exceeds retained ceiling");
        }
        finish(bytes, false);
      } catch (error) {
        finish(
          rejectionResponse(
            error instanceof Error ? error.message : String(error),
          ),
          true,
        );
      }
    };
    socket.on("data", (chunk: Buffer) => {
      if (handled) return;
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > policy.maxWireBytes) {
        finish(
          rejectionResponse("loopback TLS request exceeds retained ceiling"),
          true,
        );
        return;
      }
      const newline = buffer.indexOf(0x0a);
      if (newline >= 0) {
        const trailing = buffer.subarray(newline + 1).toString("utf8").trim();
        if (trailing) {
          finish(
            rejectionResponse(
              "loopback TLS accepts one request frame per connection",
            ),
            true,
          );
          return;
        }
        socket.pause();
        processFrame(buffer.subarray(0, newline));
      }
    });
    socket.on("end", () => {
      if (!handled && buffer.length > 0) processFrame(buffer);
      else if (!handled && buffer.length === 0) {
        rejectedConnections += 1;
      }
    });
    socket.on("error", () => {
      socket.destroy();
    });
  });

  server.on("tlsClientError", () => {
    rejectedConnections += 1;
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
    server.listen(policy.port, policy.host);
  });

  let ready: AsoiafAnswerCredentialBrokerLoopbackTlsLifecycle;
  try {
    const staleLockDigest = lockDigestAndRemove(paths);
    const oldActive = activeSessions(
      input.root,
      policy.listenerPolicyId,
    ).filter((entry) => entry.sessionId !== session.sessionId);
    for (const oldSession of oldActive) {
      retainLifecycle(input.root, lifecycleBase({
        policy,
        session: oldSession,
        kind: "recovered",
        eventAt: startedAt,
        recoveredBySession: session,
        staleLockDigest,
        reason:
          "A later listener bound the exact loopback endpoint, proving the prior ready session no longer owned the port; the prior runtime is closed as interrupted recovery.",
      }));
    }
    const lock = buildLock({ policy, session, acquiredAt: startedAt });
    writeLock(paths, lock);
    ready = retainLifecycle(input.root, lifecycleBase({
      policy,
      session,
      kind: "ready",
      eventAt: startedAt,
      staleLockDigest,
      reason:
        "The listener bound the exact loopback endpoint under the admitted server certificate, required the retained client CA, and entered authenticated request service.",
    })).lifecycle;
    accepting = true;
  } catch (error) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw error;
  }

  server.on("close", () => {
    try {
      accepting = false;
      const stoppedAt = requireTime(clock(), "listener stop time");
      stopLifecycle = retainLifecycle(input.root, lifecycleBase({
        policy,
        session,
        kind: "stopped",
        eventAt: stoppedAt,
        servedConnections,
        servedRequests,
        rejectedConnections,
        reason: stopReason,
      })).lifecycle;
      removeOwnLock(paths, session.sessionId);
      resolveClosed({
        listenerPolicyId: policy.listenerPolicyId,
        sessionId: session.sessionId,
        endpointLeaseId: policy.endpointLeaseId,
        baseUrl: policy.baseUrl,
        startedAt,
        stoppedAt,
        servedConnections,
        servedRequests,
        rejectedConnections,
        stopLifecycle,
      });
    } catch (error) {
      rejectClosed(error instanceof Error ? error : new Error(String(error)));
    }
  });

  return {
    listenerPolicyId: policy.listenerPolicyId,
    sessionId: session.sessionId,
    endpointLeaseId: policy.endpointLeaseId,
    baseUrl: policy.baseUrl,
    host: policy.host,
    port: policy.port,
    ready,
    servedConnections: () => servedConnections,
    servedRequests: () => servedRequests,
    rejectedConnections: () => rejectedConnections,
    close: async (reason) => {
      if (reason) stopReason = requireReason(reason, "listener stop reason");
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

export async function invokeAsoiafAnswerCredentialBrokerLoopbackTls(
  input: AsoiafAnswerCredentialBrokerLoopbackTlsInvokeInput,
): Promise<AsoiafAnswerCredentialBrokerServiceWireResponse> {
  const parsed = normalizeLoopbackBaseUrl(input.baseUrl);
  const expectedServerCertificateFingerprint = requireDigest(
    input.expectedServerCertificateFingerprint,
    "expected listener server certificate fingerprint",
  );
  const timeoutMilliseconds = input.timeoutMilliseconds ?? 30_000;
  requireInteger(timeoutMilliseconds, "loopback TLS invoke timeout", 120_000);
  const maxResponseBytes = input.maxResponseBytes ?? MAX_RESPONSE_BYTES;
  requireInteger(
    maxResponseBytes,
    "loopback TLS invoke response ceiling",
    MAX_RESPONSE_BYTES,
  );
  const value: AsoiafAnswerCredentialBrokerServiceWireRequest = {
    format: ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_WIRE_REQUEST_FORMAT,
    request: input.request,
    payload: input.payload,
  };
  const frame = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
  return await new Promise<AsoiafAnswerCredentialBrokerServiceWireResponse>(
    (resolve, reject) => {
      const socket = tls.connect({
        host: parsed.host,
        port: parsed.port,
        servername: undefined,
        ca: input.serverCertificateAuthority,
        cert: input.clientCertificate,
        key: input.clientPrivateKey,
        rejectUnauthorized: true,
        minVersion: "TLSv1.2",
        timeout: timeoutMilliseconds,
      });
      let response = Buffer.alloc(0);
      let settled = false;
      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(error);
      };
      socket.once("secureConnect", () => {
        const peer = socket.getPeerCertificate(true);
        const observed = peer.raw && peer.raw.length > 0
          ? certificateFingerprintFromRaw(peer.raw)
          : null;
        if (
          !socket.authorized
          || observed !== expectedServerCertificateFingerprint
        ) {
          fail(new Error(
            "loopback TLS listener certificate differs from the retained pin",
          ));
          return;
        }
        socket.write(frame);
      });
      socket.on("data", (chunk: Buffer) => {
        response = Buffer.concat([response, chunk]);
        if (response.length > maxResponseBytes) {
          fail(new Error("loopback TLS response exceeds invoke ceiling"));
        }
      });
      socket.once("timeout", () => {
        fail(new Error("loopback TLS invocation timed out"));
      });
      socket.once("error", (error) => fail(error));
      socket.once("end", () => {
        if (settled) return;
        settled = true;
        try {
          const text = response.toString("utf8").trim();
          if (!text) throw new Error("loopback TLS listener returned no response");
          const parsedResponse = JSON.parse(text) as unknown;
          const record = requireExactKeys(
            parsedResponse,
            [
              "format",
              "ok",
              ...(parsedResponse
                && typeof parsedResponse === "object"
                && (parsedResponse as { ok?: unknown }).ok === true
                ? ["result"]
                : ["error"]),
            ],
            "loopback TLS service wire response",
          );
          if (
            record.format
            !== ASOIAF_ANSWER_CREDENTIAL_BROKER_SERVICE_WIRE_RESPONSE_FORMAT
          ) {
            throw new Error("loopback TLS service response format is invalid");
          }
          resolve(parsedResponse as AsoiafAnswerCredentialBrokerServiceWireResponse);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },
  );
}

export async function probeAsoiafAnswerCredentialBrokerLoopbackTls(
  input: AsoiafAnswerCredentialBrokerLoopbackTlsProbeInput,
): Promise<{
  observation: AsoiafAnswerTransportAvailabilityObservation;
  observationUri: string;
  replayed: boolean;
}> {
  const policy = listenerPolicyById(input.root, input.listenerPolicyId);
  return await probeAsoiafAnswerTransportEndpoint({
    root: input.root,
    endpointLeaseId: policy.endpointLeaseId,
    clientCertificate: input.clientCertificate,
    clientPrivateKey: input.clientPrivateKey,
    serverCertificateAuthority: input.serverCertificateAuthority,
    observedAt: input.observedAt,
    ...(input.timeoutMilliseconds === undefined
      ? {}
      : { timeoutMilliseconds: input.timeoutMilliseconds }),
  });
}

export function verifyAsoiafAnswerCredentialBrokerLoopbackTlsEstate(
  root: string,
): AsoiafAnswerCredentialBrokerLoopbackTlsFinding[] {
  const findings: AsoiafAnswerCredentialBrokerLoopbackTlsFinding[] = [];
  const paths = asoiafAnswerCredentialBrokerLoopbackTlsPaths(root);
  const serviceFindings = verifyAsoiafAnswerCredentialBrokerServiceEstate(root);
  for (const entry of serviceFindings.filter((value) => value.severity === "error")) {
    findings.push(finding(
      "loopback-tls-parent-service-invalid",
      "error",
      entry.subjectId,
      entry.detail,
    ));
  }
  const operationsFindings = verifyAsoiafAnswerTransportOperationsEstate(root);
  for (const entry of operationsFindings.filter((value) => value.severity === "error")) {
    findings.push(finding(
      "loopback-tls-parent-operations-invalid",
      "error",
      entry.objectId,
      entry.message,
    ));
  }
  const service = readAsoiafAnswerCredentialBrokerServiceStatus(root);
  const operations = readAsoiafAnswerTransportOperationsStatus(root);
  const status = readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(root);
  const policyMap = new Map<
    string,
    AsoiafAnswerCredentialBrokerLoopbackTlsPolicy
  >();

  for (const policy of status.policies) {
    try {
      if (
        policy.format
        !== ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_POLICY_FORMAT
        || policy.listenerPolicyFingerprint !== sha256(policyCore(policy))
        || policy.listenerPolicyId !== collectorContentId(
          "asoiaf-answer-credential-broker-loopback-tls-policy",
          {
            brokerServicePolicyId: policy.brokerServicePolicyId,
            endpointLeaseId: policy.endpointLeaseId,
            clientCertificateFingerprint: policy.clientCertificateFingerprint,
            listenerPolicyFingerprint: policy.listenerPolicyFingerprint,
          },
        )
        || !fs.existsSync(
          digestPath(paths.policies, policy.listenerPolicyFingerprint),
        )
      ) {
        throw new Error("identity or path");
      }
      const servicePolicy = exactlyOne(
        service.policies,
        (entry) => entry.servicePolicyId === policy.brokerServicePolicyId,
        `broker service policy ${policy.brokerServicePolicyId}`,
      );
      const endpoint = exactlyOne(
        operations.endpoints,
        (entry) => entry.endpointLeaseId === policy.endpointLeaseId,
        `endpoint lease ${policy.endpointLeaseId}`,
      );
      const server = exactlyOne(
        operations.certificates,
        (entry) =>
          entry.admissionId === policy.serverCertificateAdmissionId,
        `server admission ${policy.serverCertificateAdmissionId}`,
      );
      const client = exactlyOne(
        operations.certificates,
        (entry) =>
          entry.admissionId === policy.clientCertificateAdmissionId,
        `client admission ${policy.clientCertificateAdmissionId}`,
      );
      const parsed = normalizeLoopbackBaseUrl(policy.baseUrl);
      if (
        policy.brokerServicePolicyFingerprint
          !== servicePolicy.servicePolicyFingerprint
        || policy.brokerPolicyId !== servicePolicy.brokerPolicyId
        || policy.brokerPolicyFingerprint !== servicePolicy.brokerPolicyFingerprint
        || policy.providerProfileId !== servicePolicy.providerProfileId
        || policy.providerProfileFingerprint
          !== servicePolicy.providerProfileFingerprint
        || policy.serviceClientId !== servicePolicy.clientId
        || policy.serviceClientPublicKeyFingerprint
          !== servicePolicy.clientPublicKeyFingerprint
        || policy.endpointLeaseFingerprint !== endpoint.endpointLeaseFingerprint
        || policy.baseUrl !== endpoint.baseUrl
        || policy.host !== parsed.host
        || policy.port !== parsed.port
        || endpoint.networkScope !== "loopback"
        || policy.serverCertificateAdmissionFingerprint
          !== server.admissionFingerprint
        || policy.serverCertificateFingerprint
          !== server.certificateFingerprint
        || policy.serverIssuerCertificateFingerprint
          !== server.issuerCertificateFingerprint
        || policy.clientCertificateAdmissionFingerprint
          !== client.admissionFingerprint
        || policy.clientCertificateFingerprint
          !== client.certificateFingerprint
        || policy.clientIssuerCertificateFingerprint
          !== client.issuerCertificateFingerprint
        || policy.clientPublicKeyFingerprint !== client.publicKeyFingerprint
        || client.principalId !== servicePolicy.clientId
        || client.publicKeyFingerprint
          !== servicePolicy.clientPublicKeyFingerprint
        || policy.maxSessionLifetimeMilliseconds < 1
        || policy.maxSessionLifetimeMilliseconds > MAX_SESSION_LIFETIME
        || policy.maxWireBytes < 1
        || policy.maxWireBytes > MAX_WIRE_BYTES
        || policy.maxResponseBytes < 1
        || policy.maxResponseBytes > MAX_RESPONSE_BYTES
        || policy.loopbackOnly !== true
        || policy.mutualTlsRequired !== true
        || policy.privateKeyRetained !== false
        || policy.privateKeyPathRetained !== false
        || policy.certificateRetained !== false
        || policy.certificatePathRetained !== false
        || policy.rawRequestBodyRetained !== false
        || policy.rawResponseBodyRetained !== false
        || policy.listenerAuthority !== "loopback-tls-admission-only"
        || policy.authority !== "none"
        || policy.graphEffect !== "none"
        || policy.canonEffect !== "none"
        || policy.answerEffect !== "none"
      ) {
        throw new Error("parent parity, ceiling, retention, or authority");
      }
      if (policyMap.has(policy.listenerPolicyId)) {
        throw new Error("duplicate policy");
      }
      policyMap.set(policy.listenerPolicyId, policy);
    } catch (error) {
      findings.push(finding(
        "loopback-tls-policy-invalid",
        "error",
        policy.listenerPolicyId ?? "unknown-loopback-tls-policy",
        error instanceof Error ? error.message : String(error),
      ));
    }
  }

  const sessionMap = new Map<
    string,
    AsoiafAnswerCredentialBrokerLoopbackTlsSession
  >();
  const idempotency = new Map<string, string>();
  for (const session of status.sessions) {
    try {
      const policy = policyMap.get(session.listenerPolicyId);
      if (!policy) throw new Error("policy");
      if (
        session.format
        !== ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_SESSION_FORMAT
        || session.sessionFingerprint !== sha256(sessionCore(session))
        || session.sessionId !== collectorContentId(
          "asoiaf-answer-credential-broker-loopback-tls-session",
          {
            listenerPolicyId: session.listenerPolicyId,
            idempotencyKeyDigest: session.idempotencyKeyDigest,
            sessionFingerprint: session.sessionFingerprint,
          },
        )
        || !fs.existsSync(
          digestPath(paths.sessions, session.sessionFingerprint),
        )
        || session.listenerPolicyFingerprint
          !== policy.listenerPolicyFingerprint
        || session.brokerServicePolicyId !== policy.brokerServicePolicyId
        || session.brokerServicePolicyFingerprint
          !== policy.brokerServicePolicyFingerprint
        || session.endpointLeaseId !== policy.endpointLeaseId
        || session.endpointLeaseFingerprint !== policy.endpointLeaseFingerprint
        || Date.parse(session.preparedAt) < Date.parse(policy.createdAt)
        || Date.parse(session.expiresAt) <= Date.parse(session.preparedAt)
        || Date.parse(session.expiresAt) - Date.parse(session.preparedAt)
          > policy.maxSessionLifetimeMilliseconds
        || session.loopbackOnly !== true
        || session.mutualTlsRequired !== true
        || session.privateKeyRetained !== false
        || session.privateKeyPathRetained !== false
        || session.certificateRetained !== false
        || session.certificatePathRetained !== false
        || session.rawRequestBodyRetained !== false
        || session.rawResponseBodyRetained !== false
        || session.sessionAuthority !== "listener-start-intent-only"
        || session.authority !== "none"
        || session.graphEffect !== "none"
        || session.canonEffect !== "none"
        || session.answerEffect !== "none"
      ) {
        throw new Error("identity, chronology, retention, or authority");
      }
      const existing = idempotency.get(session.idempotencyKeyDigest);
      if (existing && existing !== session.sessionId) {
        throw new Error("idempotency collision");
      }
      idempotency.set(session.idempotencyKeyDigest, session.sessionId);
      if (sessionMap.has(session.sessionId)) throw new Error("duplicate session");
      sessionMap.set(session.sessionId, session);
    } catch (error) {
      findings.push(finding(
        "loopback-tls-session-invalid",
        "error",
        session.sessionId ?? "unknown-loopback-tls-session",
        error instanceof Error ? error.message : String(error),
      ));
    }
  }

  const bySession = new Map<
    string,
    AsoiafAnswerCredentialBrokerLoopbackTlsLifecycle[]
  >();
  for (const lifecycle of status.lifecycle) {
    try {
      const policy = policyMap.get(lifecycle.listenerPolicyId);
      const session = sessionMap.get(lifecycle.sessionId);
      if (!policy || !session) throw new Error("policy or session");
      if (
        lifecycle.format
        !== ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_LIFECYCLE_FORMAT
        || lifecycle.lifecycleFingerprint !== sha256(lifecycleCore(lifecycle))
        || lifecycle.lifecycleId !== collectorContentId(
          "asoiaf-answer-credential-broker-loopback-tls-lifecycle",
          {
            sessionId: lifecycle.sessionId,
            kind: lifecycle.kind,
            eventAt: lifecycle.eventAt,
            lifecycleFingerprint: lifecycle.lifecycleFingerprint,
          },
        )
        || !fs.existsSync(
          digestPath(paths.lifecycle, lifecycle.lifecycleFingerprint),
        )
        || lifecycle.listenerPolicyFingerprint
          !== policy.listenerPolicyFingerprint
        || lifecycle.sessionFingerprint !== session.sessionFingerprint
        || lifecycle.endpointLeaseId !== policy.endpointLeaseId
        || lifecycle.endpointLeaseFingerprint
          !== policy.endpointLeaseFingerprint
        || Date.parse(lifecycle.eventAt) < Date.parse(session.preparedAt)
        || lifecycle.loopbackOnly !== true
        || lifecycle.mutualTlsRequired !== true
        || lifecycle.privateKeyRetained !== false
        || lifecycle.privateKeyPathRetained !== false
        || lifecycle.certificateRetained !== false
        || lifecycle.certificatePathRetained !== false
        || lifecycle.rawRequestBodyRetained !== false
        || lifecycle.rawResponseBodyRetained !== false
        || lifecycle.lifecycleAuthority
          !== "listener-runtime-reference-only"
        || lifecycle.authority !== "none"
        || lifecycle.graphEffect !== "none"
        || lifecycle.canonEffect !== "none"
        || lifecycle.answerEffect !== "none"
      ) {
        throw new Error("identity, chronology, retention, or authority");
      }
      if (lifecycle.kind === "ready") {
        if (
          lifecycle.recoveredBySessionId !== null
          || lifecycle.recoveredBySessionFingerprint !== null
          || lifecycle.servedConnections !== null
          || lifecycle.servedRequests !== null
          || lifecycle.rejectedConnections !== null
        ) {
          throw new Error("ready lifecycle acquired terminal fields");
        }
      } else if (lifecycle.kind === "stopped") {
        if (
          lifecycle.recoveredBySessionId !== null
          || lifecycle.recoveredBySessionFingerprint !== null
          || lifecycle.servedConnections === null
          || lifecycle.servedRequests === null
          || lifecycle.rejectedConnections === null
          || lifecycle.servedConnections < 0
          || lifecycle.servedRequests < 0
          || lifecycle.rejectedConnections < 0
        ) {
          throw new Error("stopped lifecycle fields are invalid");
        }
      } else if (lifecycle.kind === "recovered") {
        const recoveredBy = lifecycle.recoveredBySessionId
          ? sessionMap.get(lifecycle.recoveredBySessionId)
          : null;
        if (
          !recoveredBy
          || lifecycle.recoveredBySessionFingerprint
            !== recoveredBy.sessionFingerprint
          || recoveredBy.sessionId === session.sessionId
          || Date.parse(recoveredBy.preparedAt)
            < Date.parse(session.preparedAt)
          || lifecycle.servedConnections !== null
          || lifecycle.servedRequests !== null
          || lifecycle.rejectedConnections !== null
        ) {
          throw new Error("recovery lifecycle fields are invalid");
        }
      } else {
        throw new Error("lifecycle kind");
      }
      const values = bySession.get(session.sessionId) ?? [];
      values.push(lifecycle);
      bySession.set(session.sessionId, values);
    } catch (error) {
      findings.push(finding(
        "loopback-tls-lifecycle-invalid",
        "error",
        lifecycle.lifecycleId ?? "unknown-loopback-tls-lifecycle",
        error instanceof Error ? error.message : String(error),
      ));
    }
  }

  for (const [sessionId, values] of bySession) {
    const ready = values.filter((entry) => entry.kind === "ready");
    const terminal = values.filter(
      (entry) => entry.kind === "stopped" || entry.kind === "recovered",
    );
    if (ready.length > 1 || terminal.length > 1) {
      findings.push(finding(
        "loopback-tls-lifecycle-cardinality",
        "error",
        sessionId,
        "listener session has duplicate ready or terminal lifecycle custody",
      ));
    }
    if (terminal.length > 0 && ready.length !== 1) {
      findings.push(finding(
        "loopback-tls-terminal-without-ready",
        "error",
        sessionId,
        "listener session became terminal without one ready lifecycle",
      ));
    }
    if (
      ready.length === 1
      && terminal.length === 1
      && Date.parse(terminal[0]!.eventAt) < Date.parse(ready[0]!.eventAt)
    ) {
      findings.push(finding(
        "loopback-tls-terminal-chronology",
        "error",
        sessionId,
        "listener terminal lifecycle precedes readiness",
      ));
    }
  }

  for (const session of status.sessions) {
    const values = bySession.get(session.sessionId) ?? [];
    if (!values.some((entry) => entry.kind === "ready")) {
      findings.push(finding(
        "loopback-tls-session-unstarted",
        "notice",
        session.sessionId,
        "prepared listener session has no ready lifecycle",
      ));
    } else if (
      !values.some(
        (entry) => entry.kind === "stopped" || entry.kind === "recovered",
      )
    ) {
      findings.push(finding(
        "loopback-tls-session-active",
        "notice",
        session.sessionId,
        "ready listener session has no terminal lifecycle",
      ));
    }
  }

  if (status.policies.length > 0) {
    try {
      if (!status.state) throw new Error("missing state");
      const rebuilt = buildState(root);
      if (
        stableJson(status.state) !== stableJson(rebuilt)
        || status.state.stateFingerprint !== sha256(stateCore(status.state))
        || !fs.existsSync(paths.state)
      ) {
        throw new Error("state differs from reconstructed projection");
      }
      if (
        status.state.entries.some(
          (entry) => entry.activeSessionIds.length > 1,
        )
      ) {
        throw new Error("more than one active listener session");
      }
    } catch (error) {
      findings.push(finding(
        "loopback-tls-state-invalid",
        "error",
        status.state?.stateId
          ?? "answer-credential-broker-loopback-tls-state",
        error instanceof Error ? error.message : String(error),
      ));
    }
  } else if (status.state) {
    findings.push(finding(
      "loopback-tls-state-unexpected",
      "error",
      status.state.stateId,
      "listener state exists without a retained policy",
    ));
  }

  if (fs.existsSync(paths.lock)) {
    try {
      const lock = readJson<ListenerLock>(paths.lock);
      if (
        lock.format
          !== ASOIAF_ANSWER_CREDENTIAL_BROKER_LOOPBACK_TLS_LOCK_FORMAT
        || lock.lockFingerprint !== sha256(lockCore(lock))
      ) {
        throw new Error("lock identity");
      }
    } catch {
      findings.push(finding(
        "loopback-tls-lock-invalid",
        "error",
        paths.lock,
        "listener lock bytes are invalid",
      ));
    }
    findings.push(finding(
      "loopback-tls-lock-retained",
      "error",
      paths.lock,
      "listener runtime lock remained after qualification",
    ));
  }

  const secretPath = /\.(?:key|pem|p12|pfx|csr|crt)$/i;
  const secretContent =
    /BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY|BEGIN CERTIFICATE(?: REQUEST)?|"(?:serverCertificate|serverPrivateKey|clientCertificateAuthority|clientCertificate|clientPrivateKey|requestBodyBase64|responseBodyBase64|payload)"\s*:/;
  for (const file of recursiveFiles(paths.listenerRoot)) {
    if (secretPath.test(file)) {
      findings.push(finding(
        "loopback-tls-secret-path",
        "error",
        file,
        "listener estate contains a forbidden secret-bearing path",
      ));
    }
    const content = fs.readFileSync(file, "utf8");
    if (secretContent.test(content)) {
      findings.push(finding(
        "loopback-tls-secret-content",
        "error",
        file,
        "listener estate contains certificate, key, payload, or raw body material",
      ));
    }
  }
  return sortFindings(findings);
}
