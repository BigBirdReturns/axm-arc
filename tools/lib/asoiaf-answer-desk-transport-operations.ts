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
  ASOIAF_ANSWER_TRANSPORT_ADMIT_ROUTE,
  ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE,
  fingerprintAsoiafAnswerTransportCertificate,
  readAsoiafAnswerTransportStatus,
  registerAsoiafAnswerTransportActor,
  requestAsoiafAnswerTransport,
  revokeAsoiafAnswerTransportActor,
  verifyAsoiafAnswerTransportEstate,
  type AsoiafAnswerTransportActorRegistration,
  type AsoiafAnswerTransportActorRevocation,
  type AsoiafAnswerTransportBody,
  type AsoiafAnswerTransportCertificateFingerprint,
  type AsoiafAnswerTransportClientResult,
  type AsoiafAnswerTransportOperation,
  type AsoiafAnswerTransportRemoteEnvelope,
} from "./asoiaf-answer-desk-transport.js";
import type {
  AsoiafAnswerExchangeActorRole,
} from "./asoiaf-answer-desk-exchange.js";

export const ASOIAF_ANSWER_TRANSPORT_CERTIFICATE_ADMISSION_FORMAT =
  "axm-asoiaf-answer-transport-certificate-admission/1" as const;
export const ASOIAF_ANSWER_TRANSPORT_CERTIFICATE_RETIREMENT_FORMAT =
  "axm-asoiaf-answer-transport-certificate-retirement/1" as const;
export const ASOIAF_ANSWER_TRANSPORT_ENDPOINT_LEASE_FORMAT =
  "axm-asoiaf-answer-transport-endpoint-lease/1" as const;
export const ASOIAF_ANSWER_TRANSPORT_AVAILABILITY_FORMAT =
  "axm-asoiaf-answer-transport-availability-observation/1" as const;
export const ASOIAF_ANSWER_TRANSPORT_RENDEZVOUS_FORMAT =
  "axm-asoiaf-answer-transport-rendezvous/1" as const;
export const ASOIAF_ANSWER_TRANSPORT_DISPATCH_FORMAT =
  "axm-asoiaf-answer-transport-dispatch/1" as const;

export type AsoiafAnswerTransportCertificateUsage =
  | "client-auth"
  | "server-auth";

export type AsoiafAnswerTransportNetworkScope =
  | "loopback"
  | "lan"
  | "overlay"
  | "public"
  | "manual";

export type AsoiafAnswerTransportRetirementKind =
  | "scheduled"
  | "emergency";

export type AsoiafAnswerTransportAvailabilityOutcome =
  | "available"
  | "unreachable"
  | "tls-refused"
  | "server-certificate-mismatch";

export interface AsoiafAnswerTransportOperationsPaths {
  root: string;
  operationsRoot: string;
  certificates: string;
  retirements: string;
  endpoints: string;
  availability: string;
  rendezvous: string;
  dispatches: string;
}

export interface AsoiafAnswerTransportCertificateAdmission {
  format: typeof ASOIAF_ANSWER_TRANSPORT_CERTIFICATE_ADMISSION_FORMAT;
  admissionId: string;
  admissionFingerprint: `sha256:${string}`;
  usage: AsoiafAnswerTransportCertificateUsage;
  principalId: string;
  actorRole: AsoiafAnswerExchangeActorRole | null;
  certificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  issuerCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  publicKeyFingerprint: `sha256:${string}`;
  serialNumber: string;
  subject: string;
  issuer: string;
  extendedKeyUsageOids: string[];
  validFrom: string;
  validUntil: string;
  admittedAt: string;
  activateAt: string;
  renewAfter: string;
  retireAfter: string;
  predecessorCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint | null;
  rotationReason: string;
  operatorId: string;
  transportRegistrationId: string | null;
  transportRegistrationFingerprint: `sha256:${string}` | null;
  certificateRetained: false;
  privateKeyRetained: false;
  certificatePathRetained: false;
  privateKeyPathRetained: false;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

export interface AsoiafAnswerTransportCertificateRetirement {
  format: typeof ASOIAF_ANSWER_TRANSPORT_CERTIFICATE_RETIREMENT_FORMAT;
  retirementId: string;
  retirementFingerprint: `sha256:${string}`;
  admissionId: string;
  admissionFingerprint: `sha256:${string}`;
  certificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  usage: AsoiafAnswerTransportCertificateUsage;
  principalId: string;
  actorRole: AsoiafAnswerExchangeActorRole | null;
  retiredAt: string;
  kind: AsoiafAnswerTransportRetirementKind;
  successorAdmissionId: string | null;
  successorAdmissionFingerprint: `sha256:${string}` | null;
  reason: string;
  operatorId: string;
  transportRevocationId: string | null;
  transportRevocationFingerprint: `sha256:${string}` | null;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

export interface AsoiafAnswerTransportEndpointLease {
  format: typeof ASOIAF_ANSWER_TRANSPORT_ENDPOINT_LEASE_FORMAT;
  endpointLeaseId: string;
  endpointLeaseFingerprint: `sha256:${string}`;
  serverId: string;
  baseUrl: string;
  networkScope: AsoiafAnswerTransportNetworkScope;
  priority: number;
  serverCertificateAdmissionId: string;
  serverCertificateAdmissionFingerprint: `sha256:${string}`;
  serverCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  serverIssuerCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  acceptedClientCaCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  advertisedAt: string;
  availableFrom: string;
  expiresAt: string;
  operatorId: string;
  certificateRetained: false;
  privateKeyRetained: false;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

export interface AsoiafAnswerTransportAvailabilityObservation {
  format: typeof ASOIAF_ANSWER_TRANSPORT_AVAILABILITY_FORMAT;
  observationId: string;
  observationFingerprint: `sha256:${string}`;
  endpointLeaseId: string;
  endpointLeaseFingerprint: `sha256:${string}`;
  serverId: string;
  baseUrl: string;
  clientCertificateAdmissionId: string;
  clientCertificateAdmissionFingerprint: `sha256:${string}`;
  clientCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  expectedServerCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  observedServerCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint | null;
  observedAt: string;
  completedAt: string;
  latencyMilliseconds: number;
  outcome: AsoiafAnswerTransportAvailabilityOutcome;
  errorCode: string | null;
  reason: string;
  certificateRetained: false;
  privateKeyRetained: false;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

export interface AsoiafAnswerTransportRendezvousEntry {
  endpointLeaseId: string;
  endpointLeaseFingerprint: `sha256:${string}`;
  baseUrl: string;
  networkScope: AsoiafAnswerTransportNetworkScope;
  priority: number;
  serverCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  serverIssuerCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  acceptedClientCaCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  latestObservationId: string | null;
  latestObservationFingerprint: `sha256:${string}` | null;
  latestObservationAt: string | null;
  latestOutcome: AsoiafAnswerTransportAvailabilityOutcome | null;
  eligible: boolean;
  exclusionReason: string | null;
}

export interface AsoiafAnswerTransportRendezvous {
  format: typeof ASOIAF_ANSWER_TRANSPORT_RENDEZVOUS_FORMAT;
  rendezvousId: string;
  rendezvousFingerprint: `sha256:${string}`;
  serverId: string;
  clientCertificateAdmissionId: string;
  clientCertificateAdmissionFingerprint: `sha256:${string}`;
  clientCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  clientActorId: string;
  clientActorRole: AsoiafAnswerExchangeActorRole;
  generatedAt: string;
  maxObservationAgeMilliseconds: number;
  entries: AsoiafAnswerTransportRendezvousEntry[];
  selectedEndpointLeaseId: string | null;
  selectedEndpointLeaseFingerprint: `sha256:${string}` | null;
  selectedBaseUrl: string | null;
  operatorId: string;
  automaticFailover: false;
  certificateRetained: false;
  privateKeyRetained: false;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

export interface AsoiafAnswerTransportDispatchReceipt {
  format: typeof ASOIAF_ANSWER_TRANSPORT_DISPATCH_FORMAT;
  dispatchId: string;
  dispatchFingerprint: `sha256:${string}`;
  idempotencyKeyDigest: `sha256:${string}`;
  operation: AsoiafAnswerTransportOperation;
  route: typeof ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE | typeof ASOIAF_ANSWER_TRANSPORT_ADMIT_ROUTE;
  bodyDigest: `sha256:${string}`;
  rendezvousId: string;
  rendezvousFingerprint: `sha256:${string}`;
  endpointLeaseId: string;
  endpointLeaseFingerprint: `sha256:${string}`;
  baseUrl: string;
  clientCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  dispatchedAt: string;
  completedAt: string;
  statusCode: number;
  envelope: AsoiafAnswerTransportRemoteEnvelope;
  certificateRetained: false;
  privateKeyRetained: false;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

export interface AsoiafAnswerTransportOperationsStatus {
  format: "axm-asoiaf-answer-transport-operations-status/1";
  paths: AsoiafAnswerTransportOperationsPaths;
  certificates: AsoiafAnswerTransportCertificateAdmission[];
  retirements: AsoiafAnswerTransportCertificateRetirement[];
  endpoints: AsoiafAnswerTransportEndpointLease[];
  availability: AsoiafAnswerTransportAvailabilityObservation[];
  rendezvous: AsoiafAnswerTransportRendezvous[];
  dispatches: AsoiafAnswerTransportDispatchReceipt[];
}

export interface AsoiafAnswerTransportOperationsFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  objectId: string;
  message: string;
}

export interface AsoiafAnswerTransportCertificateAdmissionInput {
  root: string;
  usage: AsoiafAnswerTransportCertificateUsage;
  principalId: string;
  actorRole?: AsoiafAnswerExchangeActorRole | null;
  certificate: string | Buffer;
  issuerCertificate: string | Buffer;
  admittedAt: string;
  activateAt: string;
  renewAfter: string;
  retireAfter: string;
  predecessorCertificateFingerprint?: string | null;
  rotationReason: string;
  operatorId: string;
}

export interface AsoiafAnswerTransportEndpointProbeInput {
  root: string;
  endpointLeaseId: string;
  clientCertificate: string | Buffer;
  clientPrivateKey: string | Buffer;
  serverCertificateAuthority: string | Buffer;
  observedAt: string;
  timeoutMilliseconds?: number;
}

const CLIENT_AUTH_OID = "1.3.6.1.5.5.7.3.2";
const SERVER_AUTH_OID = "1.3.6.1.5.5.7.3.1";
const MIN_OVERLAP_MILLISECONDS = 60_000;
const MAX_CERTIFICATE_LIFETIME_MILLISECONDS = 398 * 24 * 60 * 60 * 1000;

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

function bytesDigest(value: Buffer): `sha256:${string}` {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function normalizeDigest(value: string, label: string): `sha256:${string}` {
  const normalized = value.trim().toLowerCase();
  if (!/^sha256:[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
  return normalized as `sha256:${string}`;
}

function validTime(value: string): boolean {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
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
  if (normalized.length < 24 || normalized.length > 2048) {
    throw new Error(`${label} must contain 24 through 2048 characters`);
  }
  return normalized;
}

function sorted<T>(values: T[], key: (value: T) => string): T[] {
  return [...values].sort((left, right) => key(left).localeCompare(key(right)));
}

function finding(
  code: string,
  severity: AsoiafAnswerTransportOperationsFinding["severity"],
  objectId: string,
  message: string,
): AsoiafAnswerTransportOperationsFinding {
  return { code, severity, objectId, message };
}

function sortedFindings(
  values: AsoiafAnswerTransportOperationsFinding[],
): AsoiafAnswerTransportOperationsFinding[] {
  return [...values].sort((left, right) =>
    `${left.severity}:${left.code}:${left.objectId}:${left.message}`.localeCompare(
      `${right.severity}:${right.code}:${right.objectId}:${right.message}`,
    ));
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
    .filter((name) => /^[a-f0-9]{64}\.json$/.test(name))
    .sort()
    .map((name) => readJson<T>(path.join(directory, name)));
}

function writeJsonExclusiveOrReplay<T>(
  target: string,
  value: T,
): { value: T; replayed: boolean } {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  ensureParent(target);
  try {
    fs.writeFileSync(target, serialized, { encoding: "utf8", flag: "wx" });
    return { value, replayed: false };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = fs.readFileSync(target, "utf8");
    if (existing !== serialized) {
      throw new Error(`answer transport operations immutable file collision at ${target}`);
    }
    return { value: JSON.parse(existing) as T, replayed: true };
  }
}

function relativeUri(root: string, target: string): string {
  return path.relative(path.resolve(root), path.resolve(target)).split(path.sep).join("/");
}

export function asoiafAnswerTransportOperationsPaths(
  root: string,
): AsoiafAnswerTransportOperationsPaths {
  const absolute = path.resolve(root);
  const operationsRoot = path.join(absolute, "answer-transport-operations");
  return {
    root: absolute,
    operationsRoot,
    certificates: path.join(operationsRoot, "certificates"),
    retirements: path.join(operationsRoot, "retirements"),
    endpoints: path.join(operationsRoot, "endpoints"),
    availability: path.join(operationsRoot, "availability"),
    rendezvous: path.join(operationsRoot, "rendezvous"),
    dispatches: path.join(operationsRoot, "dispatches"),
  };
}

function digestPath(directory: string, digest: string): string {
  return path.join(directory, `${normalizeDigest(digest, "object digest").slice("sha256:".length)}.json`);
}

function parseCertificate(value: string | Buffer): crypto.X509Certificate {
  try {
    return new crypto.X509Certificate(value);
  } catch (error) {
    throw new Error(`certificate is not a valid X.509 certificate: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function publicKeyFingerprint(certificate: crypto.X509Certificate): `sha256:${string}` {
  return bytesDigest(certificate.publicKey.export({ type: "spki", format: "der" }) as Buffer);
}

function assertCertificateKeyStrength(certificate: crypto.X509Certificate): void {
  const key = certificate.publicKey;
  const type = key.asymmetricKeyType;
  if (type === "rsa" || type === "rsa-pss") {
    const modulusLength = key.asymmetricKeyDetails?.modulusLength ?? 0;
    if (modulusLength < 2048) throw new Error("certificate RSA key must be at least 2048 bits");
    return;
  }
  if (type === "ec") {
    const curve = key.asymmetricKeyDetails?.namedCurve;
    if (!curve || !["prime256v1", "secp384r1", "secp521r1"].includes(curve)) {
      throw new Error("certificate EC key uses an unsupported curve");
    }
    return;
  }
  if (type !== "ed25519") {
    throw new Error(`certificate public key type ${type ?? "unknown"} is unsupported`);
  }
}

function inspectCertificate(
  certificateInput: string | Buffer,
  issuerInput: string | Buffer,
  usage: AsoiafAnswerTransportCertificateUsage,
): {
  certificate: crypto.X509Certificate;
  issuerCertificate: crypto.X509Certificate;
  certificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  issuerCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  publicKeyFingerprint: `sha256:${string}`;
  serialNumber: string;
  subject: string;
  issuer: string;
  extendedKeyUsageOids: string[];
  validFrom: string;
  validUntil: string;
} {
  const certificate = parseCertificate(certificateInput);
  const issuerCertificate = parseCertificate(issuerInput);
  if (!issuerCertificate.ca) throw new Error("issuer certificate is not a certificate authority");
  if (certificate.ca) throw new Error("transport leaf certificate must not be a certificate authority");
  if (!certificate.checkIssued(issuerCertificate) || !certificate.verify(issuerCertificate.publicKey)) {
    throw new Error("transport certificate is not issued and signed by the supplied certificate authority");
  }
  assertCertificateKeyStrength(certificate);
  const requiredUsage = usage === "client-auth" ? CLIENT_AUTH_OID : SERVER_AUTH_OID;
  const extendedKeyUsageOids = [...(certificate.keyUsage ?? [])].sort();
  if (!extendedKeyUsageOids.includes(requiredUsage)) {
    throw new Error(`transport ${usage} certificate lacks required extended key usage ${requiredUsage}`);
  }
  const validFrom = certificate.validFromDate.toISOString();
  const validUntil = certificate.validToDate.toISOString();
  const lifetime = Date.parse(validUntil) - Date.parse(validFrom);
  if (lifetime <= 0 || lifetime > MAX_CERTIFICATE_LIFETIME_MILLISECONDS) {
    throw new Error("transport certificate validity interval is empty or exceeds 398 days");
  }
  return {
    certificate,
    issuerCertificate,
    certificateFingerprint: fingerprintAsoiafAnswerTransportCertificate(certificateInput),
    issuerCertificateFingerprint: fingerprintAsoiafAnswerTransportCertificate(issuerInput),
    publicKeyFingerprint: publicKeyFingerprint(certificate),
    serialNumber: certificate.serialNumber.toLowerCase(),
    subject: certificate.subject,
    issuer: certificate.issuer,
    extendedKeyUsageOids,
    validFrom,
    validUntil,
  };
}

function admissionCore(
  admission: AsoiafAnswerTransportCertificateAdmission,
): Omit<AsoiafAnswerTransportCertificateAdmission, "admissionId" | "admissionFingerprint"> {
  const { admissionId: _id, admissionFingerprint: _fingerprint, ...core } = admission;
  return core;
}

function retirementCore(
  retirement: AsoiafAnswerTransportCertificateRetirement,
): Omit<AsoiafAnswerTransportCertificateRetirement, "retirementId" | "retirementFingerprint"> {
  const { retirementId: _id, retirementFingerprint: _fingerprint, ...core } = retirement;
  return core;
}

function endpointCore(
  endpoint: AsoiafAnswerTransportEndpointLease,
): Omit<AsoiafAnswerTransportEndpointLease, "endpointLeaseId" | "endpointLeaseFingerprint"> {
  const { endpointLeaseId: _id, endpointLeaseFingerprint: _fingerprint, ...core } = endpoint;
  return core;
}

function observationCore(
  observation: AsoiafAnswerTransportAvailabilityObservation,
): Omit<AsoiafAnswerTransportAvailabilityObservation, "observationId" | "observationFingerprint"> {
  const { observationId: _id, observationFingerprint: _fingerprint, ...core } = observation;
  return core;
}

function rendezvousCore(
  rendezvous: AsoiafAnswerTransportRendezvous,
): Omit<AsoiafAnswerTransportRendezvous, "rendezvousId" | "rendezvousFingerprint"> {
  const { rendezvousId: _id, rendezvousFingerprint: _fingerprint, ...core } = rendezvous;
  return core;
}

function dispatchCore(
  dispatch: AsoiafAnswerTransportDispatchReceipt,
): Omit<AsoiafAnswerTransportDispatchReceipt, "dispatchId" | "dispatchFingerprint"> {
  const { dispatchId: _id, dispatchFingerprint: _fingerprint, ...core } = dispatch;
  return core;
}

function findAdmission(
  root: string,
  certificateFingerprint: string,
): AsoiafAnswerTransportCertificateAdmission {
  const fingerprint = normalizeDigest(certificateFingerprint, "certificate fingerprint");
  const target = digestPath(asoiafAnswerTransportOperationsPaths(root).certificates, fingerprint);
  if (!fs.existsSync(target)) throw new Error("transport certificate admission does not exist");
  return readJson<AsoiafAnswerTransportCertificateAdmission>(target);
}

function findAdmissionById(
  root: string,
  admissionId: string,
): AsoiafAnswerTransportCertificateAdmission {
  const found = readAsoiafAnswerTransportOperationsStatus(root).certificates.find(
    (entry) => entry.admissionId === admissionId,
  );
  if (!found) throw new Error(`transport certificate admission ${admissionId} does not exist`);
  return found;
}

function findEndpoint(
  root: string,
  endpointLeaseId: string,
): AsoiafAnswerTransportEndpointLease {
  const found = readAsoiafAnswerTransportOperationsStatus(root).endpoints.find(
    (entry) => entry.endpointLeaseId === endpointLeaseId,
  );
  if (!found) throw new Error(`transport endpoint lease ${endpointLeaseId} does not exist`);
  return found;
}

function retirementFor(
  status: AsoiafAnswerTransportOperationsStatus,
  certificateFingerprint: string,
): AsoiafAnswerTransportCertificateRetirement | null {
  return status.retirements.find(
    (entry) => entry.certificateFingerprint === certificateFingerprint,
  ) ?? null;
}

function certificateActiveAt(
  admission: AsoiafAnswerTransportCertificateAdmission,
  retirement: AsoiafAnswerTransportCertificateRetirement | null,
  at: string,
): boolean {
  const instant = Date.parse(at);
  return instant >= Date.parse(admission.activateAt)
    && instant < Date.parse(admission.retireAfter)
    && instant >= Date.parse(admission.validFrom)
    && instant < Date.parse(admission.validUntil)
    && (!retirement || instant < Date.parse(retirement.retiredAt));
}

function assertSchedule(input: {
  admittedAt: string;
  activateAt: string;
  renewAfter: string;
  retireAfter: string;
  validFrom: string;
  validUntil: string;
}): {
  admittedAt: string;
  activateAt: string;
  renewAfter: string;
  retireAfter: string;
} {
  const admittedAt = requireTime(input.admittedAt, "certificate admission time");
  const activateAt = requireTime(input.activateAt, "certificate activation time");
  const renewAfter = requireTime(input.renewAfter, "certificate renewal time");
  const retireAfter = requireTime(input.retireAfter, "certificate retirement time");
  if (Date.parse(admittedAt) > Date.parse(activateAt)) {
    throw new Error("certificate admission must not follow activation");
  }
  if (Date.parse(activateAt) < Date.parse(input.validFrom)) {
    throw new Error("certificate activation precedes certificate validity");
  }
  if (Date.parse(renewAfter) <= Date.parse(activateAt)) {
    throw new Error("certificate renewal must follow activation");
  }
  if (Date.parse(retireAfter) <= Date.parse(renewAfter)) {
    throw new Error("certificate retirement must follow renewal");
  }
  if (Date.parse(retireAfter) > Date.parse(input.validUntil)) {
    throw new Error("certificate retirement exceeds certificate validity");
  }
  return { admittedAt, activateAt, renewAfter, retireAfter };
}

function assertPredecessor(input: {
  status: AsoiafAnswerTransportOperationsStatus;
  predecessor: AsoiafAnswerTransportCertificateAdmission | null;
  usage: AsoiafAnswerTransportCertificateUsage;
  principalId: string;
  actorRole: AsoiafAnswerExchangeActorRole | null;
  certificateFingerprint: string;
  activateAt: string;
}): void {
  const existingForPrincipal = input.status.certificates.filter(
    (entry) =>
      entry.usage === input.usage
      && entry.principalId === input.principalId
      && entry.certificateFingerprint !== input.certificateFingerprint,
  );
  if (!input.predecessor) {
    if (existingForPrincipal.length > 0) {
      throw new Error("a later certificate for this principal must name its exact predecessor");
    }
    return;
  }
  if (
    input.predecessor.usage !== input.usage
    || input.predecessor.principalId !== input.principalId
    || input.predecessor.actorRole !== input.actorRole
  ) {
    throw new Error("certificate predecessor belongs to a different usage, principal, or role");
  }
  if (input.predecessor.certificateFingerprint === input.certificateFingerprint) {
    throw new Error("certificate successor must use a different certificate fingerprint");
  }
  const successor = input.status.certificates.find(
    (entry) => entry.predecessorCertificateFingerprint === input.predecessor!.certificateFingerprint,
  );
  if (successor && successor.certificateFingerprint !== input.certificateFingerprint) {
    throw new Error("certificate predecessor already has a different admitted successor");
  }
  const overlap = Date.parse(input.predecessor.retireAfter) - Date.parse(input.activateAt);
  if (overlap < MIN_OVERLAP_MILLISECONDS) {
    throw new Error("certificate successor requires at least sixty seconds of overlap with its predecessor");
  }
}

export function admitAsoiafAnswerTransportCertificate(
  input: AsoiafAnswerTransportCertificateAdmissionInput,
): {
  admission: AsoiafAnswerTransportCertificateAdmission;
  admissionUri: string;
  admissionReplayed: boolean;
  transportRegistration: AsoiafAnswerTransportActorRegistration | null;
  transportRegistrationReplayed: boolean | null;
} {
  const usage = input.usage;
  if (usage !== "client-auth" && usage !== "server-auth") {
    throw new Error("transport certificate usage is invalid");
  }
  const principalId = requireIdentity(input.principalId, "certificate principal identity");
  const actorRole = usage === "client-auth" ? input.actorRole ?? null : null;
  if (usage === "client-auth" && !actorRole) {
    throw new Error("client-auth certificate admission requires an answer-work actor role");
  }
  if (usage === "server-auth" && input.actorRole) {
    throw new Error("server-auth certificate admission cannot carry an answer-work actor role");
  }
  const inspected = inspectCertificate(input.certificate, input.issuerCertificate, usage);
  const schedule = assertSchedule({
    admittedAt: input.admittedAt,
    activateAt: input.activateAt,
    renewAfter: input.renewAfter,
    retireAfter: input.retireAfter,
    validFrom: inspected.validFrom,
    validUntil: inspected.validUntil,
  });
  const operatorId = requireIdentity(input.operatorId, "certificate admission operator identity");
  const rotationReason = requireReason(input.rotationReason, "certificate admission reason");
  const status = readAsoiafAnswerTransportOperationsStatus(input.root);
  const predecessorFingerprint = input.predecessorCertificateFingerprint
    ? normalizeDigest(input.predecessorCertificateFingerprint, "predecessor certificate fingerprint")
    : null;
  const predecessor = predecessorFingerprint
    ? findAdmission(input.root, predecessorFingerprint)
    : null;
  assertPredecessor({
    status,
    predecessor,
    usage,
    principalId,
    actorRole,
    certificateFingerprint: inspected.certificateFingerprint,
    activateAt: schedule.activateAt,
  });

  let transportRegistration: AsoiafAnswerTransportActorRegistration | null = null;
  let transportRegistrationReplayed: boolean | null = null;
  if (usage === "client-auth") {
    const registered = registerAsoiafAnswerTransportActor({
      root: input.root,
      certificateFingerprint: inspected.certificateFingerprint,
      actorId: principalId,
      actorRole: actorRole!,
      registeredAt: schedule.activateAt,
      operatorId,
    });
    transportRegistration = registered.registration;
    transportRegistrationReplayed = registered.replayed;
  }

  const core = {
    format: ASOIAF_ANSWER_TRANSPORT_CERTIFICATE_ADMISSION_FORMAT,
    usage,
    principalId,
    actorRole,
    certificateFingerprint: inspected.certificateFingerprint,
    issuerCertificateFingerprint: inspected.issuerCertificateFingerprint,
    publicKeyFingerprint: inspected.publicKeyFingerprint,
    serialNumber: inspected.serialNumber,
    subject: inspected.subject,
    issuer: inspected.issuer,
    extendedKeyUsageOids: inspected.extendedKeyUsageOids,
    validFrom: inspected.validFrom,
    validUntil: inspected.validUntil,
    ...schedule,
    predecessorCertificateFingerprint: predecessorFingerprint,
    rotationReason,
    operatorId,
    transportRegistrationId: transportRegistration?.registrationId ?? null,
    transportRegistrationFingerprint: transportRegistration?.registrationFingerprint ?? null,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    certificatePathRetained: false as const,
    privateKeyPathRetained: false as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const admissionFingerprint = sha256(core);
  const admission: AsoiafAnswerTransportCertificateAdmission = {
    ...core,
    admissionId: collectorContentId("asoiaf-answer-transport-certificate", {
      usage,
      principalId,
      certificateFingerprint: inspected.certificateFingerprint,
      admissionFingerprint,
    }),
    admissionFingerprint,
  };
  const target = digestPath(
    asoiafAnswerTransportOperationsPaths(input.root).certificates,
    admission.certificateFingerprint,
  );
  const persisted = writeJsonExclusiveOrReplay(target, admission);
  return {
    admission: persisted.value,
    admissionUri: relativeUri(input.root, target),
    admissionReplayed: persisted.replayed,
    transportRegistration,
    transportRegistrationReplayed,
  };
}

export function validateAsoiafAnswerTransportCertificateAdmission(
  admission: AsoiafAnswerTransportCertificateAdmission,
  transportRegistration: AsoiafAnswerTransportActorRegistration | null,
): AsoiafAnswerTransportOperationsFinding[] {
  const findings: AsoiafAnswerTransportOperationsFinding[] = [];
  if (admission.format !== ASOIAF_ANSWER_TRANSPORT_CERTIFICATE_ADMISSION_FORMAT) {
    findings.push(finding("operations-certificate-format", "error", admission.admissionId, "certificate admission format is invalid"));
  }
  if (admission.admissionFingerprint !== sha256(admissionCore(admission))) {
    findings.push(finding("operations-certificate-fingerprint", "error", admission.admissionId, "certificate admission fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-transport-certificate", {
    usage: admission.usage,
    principalId: admission.principalId,
    certificateFingerprint: admission.certificateFingerprint,
    admissionFingerprint: admission.admissionFingerprint,
  });
  if (admission.admissionId !== expectedId) {
    findings.push(finding("operations-certificate-identity", "error", admission.admissionId, "certificate admission identity is stale"));
  }
  try {
    normalizeDigest(admission.certificateFingerprint, "certificate fingerprint");
    normalizeDigest(admission.issuerCertificateFingerprint, "issuer certificate fingerprint");
    normalizeDigest(admission.publicKeyFingerprint, "public-key fingerprint");
    assertSchedule(admission);
    requireIdentity(admission.principalId, "certificate principal identity");
    requireIdentity(admission.operatorId, "certificate admission operator identity");
    requireReason(admission.rotationReason, "certificate admission reason");
  } catch (error) {
    findings.push(finding("operations-certificate-input", "error", admission.admissionId, error instanceof Error ? error.message : String(error)));
  }
  if (admission.usage === "client-auth") {
    if (!admission.actorRole || !transportRegistration) {
      findings.push(finding("operations-certificate-registration", "error", admission.admissionId, "client certificate lacks its exact transport registration"));
    } else if (
      transportRegistration.certificateFingerprint !== admission.certificateFingerprint
      || transportRegistration.actorId !== admission.principalId
      || transportRegistration.actorRole !== admission.actorRole
      || transportRegistration.registeredAt !== admission.activateAt
      || transportRegistration.registrationId !== admission.transportRegistrationId
      || transportRegistration.registrationFingerprint !== admission.transportRegistrationFingerprint
    ) {
      findings.push(finding("operations-certificate-registration-parity", "error", admission.admissionId, "client certificate differs from its permanent transport registration"));
    }
  } else if (
    admission.actorRole !== null
    || admission.transportRegistrationId !== null
    || admission.transportRegistrationFingerprint !== null
  ) {
    findings.push(finding("operations-server-certificate-role", "error", admission.admissionId, "server certificate acquired an answer-work actor registration"));
  }
  if (
    admission.certificateRetained !== false
    || admission.privateKeyRetained !== false
    || admission.certificatePathRetained !== false
    || admission.privateKeyPathRetained !== false
    || admission.authority !== "none"
    || admission.graphEffect !== "none"
    || admission.canonEffect !== "none"
    || admission.answerEffect !== "none"
  ) {
    findings.push(finding("operations-certificate-authority", "error", admission.admissionId, "certificate admission retained secrets, paths, or task authority"));
  }
  return sortedFindings(findings);
}

export function retireAsoiafAnswerTransportCertificate(input: {
  root: string;
  certificateFingerprint: string;
  retiredAt: string;
  kind: AsoiafAnswerTransportRetirementKind;
  reason: string;
  operatorId: string;
}): {
  retirement: AsoiafAnswerTransportCertificateRetirement;
  retirementUri: string;
  retirementReplayed: boolean;
  transportRevocation: AsoiafAnswerTransportActorRevocation | null;
  transportRevocationReplayed: boolean | null;
} {
  const admission = findAdmission(input.root, input.certificateFingerprint);
  const retiredAt = requireTime(input.retiredAt, "certificate retirement time");
  const operatorId = requireIdentity(input.operatorId, "certificate retirement operator identity");
  const reason = requireReason(input.reason, "certificate retirement reason");
  if (input.kind !== "scheduled" && input.kind !== "emergency") {
    throw new Error("certificate retirement kind is invalid");
  }
  if (Date.parse(retiredAt) < Date.parse(admission.activateAt)) {
    throw new Error("certificate retirement precedes certificate activation");
  }
  const status = readAsoiafAnswerTransportOperationsStatus(input.root);
  const successor = status.certificates.find(
    (entry) => entry.predecessorCertificateFingerprint === admission.certificateFingerprint,
  ) ?? null;
  if (input.kind === "scheduled") {
    if (Date.parse(retiredAt) < Date.parse(admission.retireAfter)) {
      throw new Error("scheduled certificate retirement precedes the admitted retirement time");
    }
    if (!successor || !certificateActiveAt(successor, retirementFor(status, successor.certificateFingerprint), retiredAt)) {
      throw new Error("scheduled certificate retirement requires an active admitted successor");
    }
  }

  let transportRevocation: AsoiafAnswerTransportActorRevocation | null = null;
  let transportRevocationReplayed: boolean | null = null;
  if (admission.usage === "client-auth") {
    const revoked = revokeAsoiafAnswerTransportActor({
      root: input.root,
      certificateFingerprint: admission.certificateFingerprint,
      revokedAt: retiredAt,
      reason,
      operatorId,
    });
    transportRevocation = revoked.revocation;
    transportRevocationReplayed = revoked.replayed;
  }

  const core = {
    format: ASOIAF_ANSWER_TRANSPORT_CERTIFICATE_RETIREMENT_FORMAT,
    admissionId: admission.admissionId,
    admissionFingerprint: admission.admissionFingerprint,
    certificateFingerprint: admission.certificateFingerprint,
    usage: admission.usage,
    principalId: admission.principalId,
    actorRole: admission.actorRole,
    retiredAt,
    kind: input.kind,
    successorAdmissionId: successor?.admissionId ?? null,
    successorAdmissionFingerprint: successor?.admissionFingerprint ?? null,
    reason,
    operatorId,
    transportRevocationId: transportRevocation?.revocationId ?? null,
    transportRevocationFingerprint: transportRevocation?.revocationFingerprint ?? null,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const retirementFingerprint = sha256(core);
  const retirement: AsoiafAnswerTransportCertificateRetirement = {
    ...core,
    retirementId: collectorContentId("asoiaf-answer-transport-retirement", {
      certificateFingerprint: admission.certificateFingerprint,
      retiredAt,
      retirementFingerprint,
    }),
    retirementFingerprint,
  };
  const target = digestPath(
    asoiafAnswerTransportOperationsPaths(input.root).retirements,
    admission.certificateFingerprint,
  );
  const persisted = writeJsonExclusiveOrReplay(target, retirement);
  return {
    retirement: persisted.value,
    retirementUri: relativeUri(input.root, target),
    retirementReplayed: persisted.replayed,
    transportRevocation,
    transportRevocationReplayed,
  };
}

export function validateAsoiafAnswerTransportCertificateRetirement(
  retirement: AsoiafAnswerTransportCertificateRetirement,
  admission: AsoiafAnswerTransportCertificateAdmission,
  successor: AsoiafAnswerTransportCertificateAdmission | null,
  transportRevocation: AsoiafAnswerTransportActorRevocation | null,
): AsoiafAnswerTransportOperationsFinding[] {
  const findings: AsoiafAnswerTransportOperationsFinding[] = [];
  if (retirement.format !== ASOIAF_ANSWER_TRANSPORT_CERTIFICATE_RETIREMENT_FORMAT) {
    findings.push(finding("operations-retirement-format", "error", retirement.retirementId, "certificate retirement format is invalid"));
  }
  if (retirement.retirementFingerprint !== sha256(retirementCore(retirement))) {
    findings.push(finding("operations-retirement-fingerprint", "error", retirement.retirementId, "certificate retirement fingerprint is stale"));
  }
  if (
    retirement.admissionId !== admission.admissionId
    || retirement.admissionFingerprint !== admission.admissionFingerprint
    || retirement.certificateFingerprint !== admission.certificateFingerprint
    || retirement.usage !== admission.usage
    || retirement.principalId !== admission.principalId
    || retirement.actorRole !== admission.actorRole
  ) {
    findings.push(finding("operations-retirement-admission", "error", retirement.retirementId, "certificate retirement differs from its exact admission"));
  }
  if (retirement.kind === "scheduled") {
    if (!successor || retirement.successorAdmissionId !== successor.admissionId || retirement.successorAdmissionFingerprint !== successor.admissionFingerprint) {
      findings.push(finding("operations-retirement-successor", "error", retirement.retirementId, "scheduled certificate retirement lacks its exact successor"));
    }
  }
  if (admission.usage === "client-auth") {
    if (
      !transportRevocation
      || retirement.transportRevocationId !== transportRevocation.revocationId
      || retirement.transportRevocationFingerprint !== transportRevocation.revocationFingerprint
      || transportRevocation.revokedAt !== retirement.retiredAt
    ) {
      findings.push(finding("operations-retirement-revocation", "error", retirement.retirementId, "client certificate retirement differs from permanent transport revocation"));
    }
  } else if (retirement.transportRevocationId !== null || retirement.transportRevocationFingerprint !== null) {
    findings.push(finding("operations-server-retirement-revocation", "error", retirement.retirementId, "server certificate retirement acquired a client actor revocation"));
  }
  if (
    retirement.authority !== "none"
    || retirement.graphEffect !== "none"
    || retirement.canonEffect !== "none"
    || retirement.answerEffect !== "none"
  ) {
    findings.push(finding("operations-retirement-authority", "error", retirement.retirementId, "certificate retirement acquired task authority"));
  }
  return sortedFindings(findings);
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("transport endpoint must use HTTPS");
  if (url.username || url.password) throw new Error("transport endpoint cannot contain credentials");
  if (url.search || url.hash) throw new Error("transport endpoint cannot contain a query or fragment");
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error("transport endpoint must identify an HTTPS origin without a path");
  }
  if (["0.0.0.0", "::", "[::]"].includes(url.hostname)) {
    throw new Error("transport endpoint cannot advertise an unspecified address");
  }
  return `${url.origin}/`;
}

export function advertiseAsoiafAnswerTransportEndpoint(input: {
  root: string;
  serverId: string;
  baseUrl: string;
  networkScope: AsoiafAnswerTransportNetworkScope;
  priority: number;
  serverCertificateFingerprint: string;
  acceptedClientCaCertificateFingerprint: string;
  advertisedAt: string;
  availableFrom: string;
  expiresAt: string;
  operatorId: string;
}): {
  endpoint: AsoiafAnswerTransportEndpointLease;
  endpointUri: string;
  replayed: boolean;
} {
  const status = readAsoiafAnswerTransportOperationsStatus(input.root);
  const serverCertificate = findAdmission(input.root, input.serverCertificateFingerprint);
  if (serverCertificate.usage !== "server-auth") {
    throw new Error("transport endpoint requires a server-auth certificate admission");
  }
  const serverId = requireIdentity(input.serverId, "transport server identity");
  if (serverCertificate.principalId !== serverId) {
    throw new Error("transport endpoint server identity differs from its certificate admission");
  }
  if (!Number.isInteger(input.priority) || input.priority < 0 || input.priority > 1000) {
    throw new Error("transport endpoint priority must be an integer from 0 through 1000");
  }
  if (!["loopback", "lan", "overlay", "public", "manual"].includes(input.networkScope)) {
    throw new Error("transport endpoint network scope is invalid");
  }
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const advertisedAt = requireTime(input.advertisedAt, "endpoint advertisement time");
  const availableFrom = requireTime(input.availableFrom, "endpoint availability time");
  const expiresAt = requireTime(input.expiresAt, "endpoint expiry time");
  const operatorId = requireIdentity(input.operatorId, "endpoint operator identity");
  const acceptedClientCaCertificateFingerprint = normalizeDigest(
    input.acceptedClientCaCertificateFingerprint,
    "accepted client CA fingerprint",
  );
  if (Date.parse(advertisedAt) > Date.parse(availableFrom)) {
    throw new Error("endpoint advertisement must not follow endpoint availability");
  }
  if (Date.parse(availableFrom) < Date.parse(serverCertificate.activateAt)) {
    throw new Error("endpoint availability precedes server certificate activation");
  }
  if (
    Date.parse(expiresAt) > Date.parse(serverCertificate.retireAfter)
    || Date.parse(expiresAt) > Date.parse(serverCertificate.validUntil)
    || Date.parse(expiresAt) <= Date.parse(availableFrom)
  ) {
    throw new Error("endpoint expiry is outside the admitted server certificate interval");
  }
  const retirement = retirementFor(status, serverCertificate.certificateFingerprint);
  if (retirement && Date.parse(retirement.retiredAt) <= Date.parse(availableFrom)) {
    throw new Error("endpoint cannot begin after its server certificate retirement");
  }
  const core = {
    format: ASOIAF_ANSWER_TRANSPORT_ENDPOINT_LEASE_FORMAT,
    serverId,
    baseUrl,
    networkScope: input.networkScope,
    priority: input.priority,
    serverCertificateAdmissionId: serverCertificate.admissionId,
    serverCertificateAdmissionFingerprint: serverCertificate.admissionFingerprint,
    serverCertificateFingerprint: serverCertificate.certificateFingerprint,
    serverIssuerCertificateFingerprint: serverCertificate.issuerCertificateFingerprint,
    acceptedClientCaCertificateFingerprint,
    advertisedAt,
    availableFrom,
    expiresAt,
    operatorId,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const endpointLeaseFingerprint = sha256(core);
  const endpoint: AsoiafAnswerTransportEndpointLease = {
    ...core,
    endpointLeaseId: collectorContentId("asoiaf-answer-transport-endpoint", {
      serverId,
      baseUrl,
      availableFrom,
      expiresAt,
      endpointLeaseFingerprint,
    }),
    endpointLeaseFingerprint,
  };
  const target = digestPath(
    asoiafAnswerTransportOperationsPaths(input.root).endpoints,
    endpoint.endpointLeaseFingerprint,
  );
  const persisted = writeJsonExclusiveOrReplay(target, endpoint);
  return {
    endpoint: persisted.value,
    endpointUri: relativeUri(input.root, target),
    replayed: persisted.replayed,
  };
}

export function validateAsoiafAnswerTransportEndpointLease(
  endpoint: AsoiafAnswerTransportEndpointLease,
  serverCertificate: AsoiafAnswerTransportCertificateAdmission,
): AsoiafAnswerTransportOperationsFinding[] {
  const findings: AsoiafAnswerTransportOperationsFinding[] = [];
  if (endpoint.format !== ASOIAF_ANSWER_TRANSPORT_ENDPOINT_LEASE_FORMAT) {
    findings.push(finding("operations-endpoint-format", "error", endpoint.endpointLeaseId, "endpoint lease format is invalid"));
  }
  if (endpoint.endpointLeaseFingerprint !== sha256(endpointCore(endpoint))) {
    findings.push(finding("operations-endpoint-fingerprint", "error", endpoint.endpointLeaseId, "endpoint lease fingerprint is stale"));
  }
  if (
    endpoint.serverCertificateAdmissionId !== serverCertificate.admissionId
    || endpoint.serverCertificateAdmissionFingerprint !== serverCertificate.admissionFingerprint
    || endpoint.serverCertificateFingerprint !== serverCertificate.certificateFingerprint
    || endpoint.serverIssuerCertificateFingerprint !== serverCertificate.issuerCertificateFingerprint
    || endpoint.serverId !== serverCertificate.principalId
    || serverCertificate.usage !== "server-auth"
  ) {
    findings.push(finding("operations-endpoint-certificate", "error", endpoint.endpointLeaseId, "endpoint lease differs from its server certificate admission"));
  }
  try {
    normalizeBaseUrl(endpoint.baseUrl);
    normalizeDigest(endpoint.acceptedClientCaCertificateFingerprint, "accepted client CA fingerprint");
    requireTime(endpoint.advertisedAt, "endpoint advertisement time");
    requireTime(endpoint.availableFrom, "endpoint availability time");
    requireTime(endpoint.expiresAt, "endpoint expiry time");
  } catch (error) {
    findings.push(finding("operations-endpoint-input", "error", endpoint.endpointLeaseId, error instanceof Error ? error.message : String(error)));
  }
  if (
    endpoint.certificateRetained !== false
    || endpoint.privateKeyRetained !== false
    || endpoint.authority !== "none"
    || endpoint.graphEffect !== "none"
    || endpoint.canonEffect !== "none"
    || endpoint.answerEffect !== "none"
  ) {
    findings.push(finding("operations-endpoint-authority", "error", endpoint.endpointLeaseId, "endpoint lease retained secrets or acquired task authority"));
  }
  return sortedFindings(findings);
}

function privateKeyPublicFingerprint(value: string | Buffer): `sha256:${string}` {
  const privateKey = crypto.createPrivateKey(value);
  const publicKey = crypto.createPublicKey(privateKey);
  return bytesDigest(publicKey.export({ type: "spki", format: "der" }) as Buffer);
}

function assertClientMaterial(input: {
  root: string;
  certificate: string | Buffer;
  privateKey: string | Buffer;
  serverCertificateAuthority: string | Buffer;
  endpoint: AsoiafAnswerTransportEndpointLease;
  at: string;
}): AsoiafAnswerTransportCertificateAdmission {
  const certificateFingerprint = fingerprintAsoiafAnswerTransportCertificate(input.certificate);
  const admission = findAdmission(input.root, certificateFingerprint);
  const status = readAsoiafAnswerTransportOperationsStatus(input.root);
  if (admission.usage !== "client-auth" || !admission.actorRole) {
    throw new Error("endpoint probe requires an admitted client-auth certificate");
  }
  if (!certificateActiveAt(admission, retirementFor(status, certificateFingerprint), input.at)) {
    throw new Error("endpoint probe client certificate is not active at observation time");
  }
  if (admission.publicKeyFingerprint !== privateKeyPublicFingerprint(input.privateKey)) {
    throw new Error("endpoint probe private key does not match the admitted client certificate");
  }
  if (admission.issuerCertificateFingerprint !== input.endpoint.acceptedClientCaCertificateFingerprint) {
    throw new Error("endpoint does not advertise the client certificate authority used by this actor");
  }
  const serverCaFingerprint = fingerprintAsoiafAnswerTransportCertificate(input.serverCertificateAuthority);
  if (serverCaFingerprint !== input.endpoint.serverIssuerCertificateFingerprint) {
    throw new Error("server certificate authority differs from the endpoint lease pin");
  }
  return admission;
}

export function buildAsoiafAnswerTransportAvailabilityObservation(input: {
  endpoint: AsoiafAnswerTransportEndpointLease;
  clientAdmission: AsoiafAnswerTransportCertificateAdmission;
  observedServerCertificateFingerprint: string | null;
  observedAt: string;
  completedAt: string;
  latencyMilliseconds: number;
  outcome: AsoiafAnswerTransportAvailabilityOutcome;
  errorCode: string | null;
  reason: string;
}): AsoiafAnswerTransportAvailabilityObservation {
  const observedAt = requireTime(input.observedAt, "availability observation time");
  const completedAt = requireTime(input.completedAt, "availability completion time");
  if (Date.parse(completedAt) < Date.parse(observedAt)) {
    throw new Error("availability completion precedes observation start");
  }
  if (!Number.isInteger(input.latencyMilliseconds) || input.latencyMilliseconds < 0 || input.latencyMilliseconds > 600_000) {
    throw new Error("availability latency must be an integer from 0 through 600000 milliseconds");
  }
  if (!["available", "unreachable", "tls-refused", "server-certificate-mismatch"].includes(input.outcome)) {
    throw new Error("availability outcome is invalid");
  }
  const observedServerCertificateFingerprint = input.observedServerCertificateFingerprint
    ? normalizeDigest(input.observedServerCertificateFingerprint, "observed server certificate fingerprint")
    : null;
  const reason = requireReason(input.reason, "availability observation reason");
  if (input.outcome === "available" && observedServerCertificateFingerprint !== input.endpoint.serverCertificateFingerprint) {
    throw new Error("available observation must match the endpoint server certificate pin");
  }
  if (input.outcome === "server-certificate-mismatch" && (!observedServerCertificateFingerprint || observedServerCertificateFingerprint === input.endpoint.serverCertificateFingerprint)) {
    throw new Error("server-certificate-mismatch observation requires a different observed fingerprint");
  }
  const core = {
    format: ASOIAF_ANSWER_TRANSPORT_AVAILABILITY_FORMAT,
    endpointLeaseId: input.endpoint.endpointLeaseId,
    endpointLeaseFingerprint: input.endpoint.endpointLeaseFingerprint,
    serverId: input.endpoint.serverId,
    baseUrl: input.endpoint.baseUrl,
    clientCertificateAdmissionId: input.clientAdmission.admissionId,
    clientCertificateAdmissionFingerprint: input.clientAdmission.admissionFingerprint,
    clientCertificateFingerprint: input.clientAdmission.certificateFingerprint,
    expectedServerCertificateFingerprint: input.endpoint.serverCertificateFingerprint,
    observedServerCertificateFingerprint,
    observedAt,
    completedAt,
    latencyMilliseconds: input.latencyMilliseconds,
    outcome: input.outcome,
    errorCode: input.errorCode?.trim() || null,
    reason,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const observationFingerprint = sha256(core);
  return {
    ...core,
    observationId: collectorContentId("asoiaf-answer-transport-availability", {
      endpointLeaseId: input.endpoint.endpointLeaseId,
      clientCertificateFingerprint: input.clientAdmission.certificateFingerprint,
      observedAt,
      observationFingerprint,
    }),
    observationFingerprint,
  };
}

function persistAvailabilityObservation(
  root: string,
  observation: AsoiafAnswerTransportAvailabilityObservation,
): { observation: AsoiafAnswerTransportAvailabilityObservation; observationUri: string; replayed: boolean } {
  const target = digestPath(
    asoiafAnswerTransportOperationsPaths(root).availability,
    observation.observationFingerprint,
  );
  const persisted = writeJsonExclusiveOrReplay(target, observation);
  return {
    observation: persisted.value,
    observationUri: relativeUri(root, target),
    replayed: persisted.replayed,
  };
}

export async function probeAsoiafAnswerTransportEndpoint(
  input: AsoiafAnswerTransportEndpointProbeInput,
): Promise<{
  observation: AsoiafAnswerTransportAvailabilityObservation;
  observationUri: string;
  replayed: boolean;
}> {
  const endpoint = findEndpoint(input.root, input.endpointLeaseId);
  const observedAt = requireTime(input.observedAt, "availability observation time");
  const status = readAsoiafAnswerTransportOperationsStatus(input.root);
  const serverAdmission = findAdmissionById(input.root, endpoint.serverCertificateAdmissionId);
  if (!certificateActiveAt(serverAdmission, retirementFor(status, serverAdmission.certificateFingerprint), observedAt)) {
    throw new Error("endpoint server certificate is not active at observation time");
  }
  if (Date.parse(observedAt) < Date.parse(endpoint.availableFrom) || Date.parse(observedAt) >= Date.parse(endpoint.expiresAt)) {
    throw new Error("endpoint lease is not active at observation time");
  }
  const clientAdmission = assertClientMaterial({
    root: input.root,
    certificate: input.clientCertificate,
    privateKey: input.clientPrivateKey,
    serverCertificateAuthority: input.serverCertificateAuthority,
    endpoint,
    at: observedAt,
  });
  const endpointUrl = new URL(endpoint.baseUrl);
  const host = endpointUrl.hostname;
  const port = endpointUrl.port ? Number(endpointUrl.port) : 443;
  const started = Date.now();
  const timeoutMilliseconds = input.timeoutMilliseconds ?? 10_000;
  const result = await new Promise<{
    outcome: AsoiafAnswerTransportAvailabilityOutcome;
    observedServerCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint | null;
    errorCode: string | null;
    reason: string;
  }>((resolve) => {
    let settled = false;
    const finish = (value: {
      outcome: AsoiafAnswerTransportAvailabilityOutcome;
      observedServerCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint | null;
      errorCode: string | null;
      reason: string;
    }) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const socket = tls.connect({
      host,
      port,
      servername: net.isIP(host) ? undefined : host,
      ca: input.serverCertificateAuthority,
      cert: input.clientCertificate,
      key: input.clientPrivateKey,
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
      timeout: timeoutMilliseconds,
    });
    socket.once("secureConnect", () => {
      const peer = socket.getPeerCertificate(true);
      const observed = peer.raw && peer.raw.length > 0
        ? (`sha256:${crypto.createHash("sha256").update(peer.raw).digest("hex")}` as const)
        : null;
      if (!socket.authorized) {
        finish({
          outcome: "tls-refused",
          observedServerCertificateFingerprint: observed,
          errorCode: socket.authorizationError ? String(socket.authorizationError) : "tls-peer-unauthorized",
          reason: "The TLS peer was not authorized by the pinned server certificate authority.",
        });
      } else if (observed !== endpoint.serverCertificateFingerprint) {
        finish({
          outcome: "server-certificate-mismatch",
          observedServerCertificateFingerprint: observed,
          errorCode: "server-certificate-mismatch",
          reason: "The authorized TLS peer certificate differed from the endpoint lease fingerprint pin.",
        });
      } else {
        finish({
          outcome: "available",
          observedServerCertificateFingerprint: observed,
          errorCode: null,
          reason: "The endpoint completed mutual TLS under the admitted client certificate and exact server certificate pin.",
        });
      }
      socket.setTimeout(0);
      socket.destroy();
    });
    socket.once("timeout", () => {
      socket.destroy();
      finish({
        outcome: "unreachable",
        observedServerCertificateFingerprint: null,
        errorCode: "timeout",
        reason: "The endpoint did not complete a TLS handshake before the bounded probe timeout.",
      });
    });
    socket.once("error", (error: NodeJS.ErrnoException) => {
      const code = error.code ?? error.name ?? "tls-error";
      const tlsFailure = /TLS|CERT|SSL|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(`${code}:${error.message}`);
      finish({
        outcome: tlsFailure ? "tls-refused" : "unreachable",
        observedServerCertificateFingerprint: null,
        errorCode: String(code),
        reason: tlsFailure
          ? "The endpoint refused or failed the authenticated TLS handshake."
          : "The endpoint could not be reached at its advertised HTTPS origin.",
      });
      socket.destroy();
    });
  });
  const elapsedMilliseconds = Math.max(0, Date.now() - started);
  const completedAt = new Date(Date.parse(observedAt) + elapsedMilliseconds).toISOString();
  const observation = buildAsoiafAnswerTransportAvailabilityObservation({
    endpoint,
    clientAdmission,
    observedServerCertificateFingerprint: result.observedServerCertificateFingerprint,
    observedAt,
    completedAt,
    latencyMilliseconds: elapsedMilliseconds,
    outcome: result.outcome,
    errorCode: result.errorCode,
    reason: result.reason,
  });
  return persistAvailabilityObservation(input.root, observation);
}

export function validateAsoiafAnswerTransportAvailabilityObservation(
  observation: AsoiafAnswerTransportAvailabilityObservation,
  endpoint: AsoiafAnswerTransportEndpointLease,
  clientAdmission: AsoiafAnswerTransportCertificateAdmission,
): AsoiafAnswerTransportOperationsFinding[] {
  const findings: AsoiafAnswerTransportOperationsFinding[] = [];
  if (observation.format !== ASOIAF_ANSWER_TRANSPORT_AVAILABILITY_FORMAT) {
    findings.push(finding("operations-availability-format", "error", observation.observationId, "availability observation format is invalid"));
  }
  if (observation.observationFingerprint !== sha256(observationCore(observation))) {
    findings.push(finding("operations-availability-fingerprint", "error", observation.observationId, "availability observation fingerprint is stale"));
  }
  if (
    observation.endpointLeaseId !== endpoint.endpointLeaseId
    || observation.endpointLeaseFingerprint !== endpoint.endpointLeaseFingerprint
    || observation.serverId !== endpoint.serverId
    || observation.baseUrl !== endpoint.baseUrl
    || observation.expectedServerCertificateFingerprint !== endpoint.serverCertificateFingerprint
  ) {
    findings.push(finding("operations-availability-endpoint", "error", observation.observationId, "availability observation differs from its endpoint lease"));
  }
  if (
    observation.clientCertificateAdmissionId !== clientAdmission.admissionId
    || observation.clientCertificateAdmissionFingerprint !== clientAdmission.admissionFingerprint
    || observation.clientCertificateFingerprint !== clientAdmission.certificateFingerprint
    || clientAdmission.usage !== "client-auth"
  ) {
    findings.push(finding("operations-availability-client", "error", observation.observationId, "availability observation differs from its client certificate admission"));
  }
  if (
    observation.certificateRetained !== false
    || observation.privateKeyRetained !== false
    || observation.authority !== "none"
    || observation.graphEffect !== "none"
    || observation.canonEffect !== "none"
    || observation.answerEffect !== "none"
  ) {
    findings.push(finding("operations-availability-authority", "error", observation.observationId, "availability observation retained secrets or acquired task authority"));
  }
  return sortedFindings(findings);
}

function latestObservation(
  observations: AsoiafAnswerTransportAvailabilityObservation[],
  endpointLeaseId: string,
  clientCertificateFingerprint: string,
  at: string,
): AsoiafAnswerTransportAvailabilityObservation | null {
  return observations
    .filter(
      (entry) => entry.endpointLeaseId === endpointLeaseId
        && entry.clientCertificateFingerprint === clientCertificateFingerprint
        && Date.parse(entry.completedAt) <= Date.parse(at),
    )
    .sort((left, right) =>
      right.completedAt.localeCompare(left.completedAt)
      || right.observationFingerprint.localeCompare(left.observationFingerprint))[0] ?? null;
}

export function buildAsoiafAnswerTransportRendezvous(input: {
  root: string;
  serverId: string;
  clientCertificateFingerprint: string;
  generatedAt: string;
  maxObservationAgeMilliseconds: number;
  operatorId: string;
}): AsoiafAnswerTransportRendezvous {
  const status = readAsoiafAnswerTransportOperationsStatus(input.root);
  const generatedAt = requireTime(input.generatedAt, "rendezvous generation time");
  const serverId = requireIdentity(input.serverId, "rendezvous server identity");
  const operatorId = requireIdentity(input.operatorId, "rendezvous operator identity");
  if (
    !Number.isInteger(input.maxObservationAgeMilliseconds)
    || input.maxObservationAgeMilliseconds < 1_000
    || input.maxObservationAgeMilliseconds > 86_400_000
  ) {
    throw new Error("rendezvous observation age must be an integer from 1000 through 86400000 milliseconds");
  }
  const clientAdmission = findAdmission(input.root, input.clientCertificateFingerprint);
  if (clientAdmission.usage !== "client-auth" || !clientAdmission.actorRole) {
    throw new Error("rendezvous requires an admitted client-auth certificate");
  }
  if (!certificateActiveAt(clientAdmission, retirementFor(status, clientAdmission.certificateFingerprint), generatedAt)) {
    throw new Error("rendezvous client certificate is not active at generation time");
  }
  const entries = status.endpoints
    .filter((endpoint) => endpoint.serverId === serverId)
    .map((endpoint): AsoiafAnswerTransportRendezvousEntry => {
      const serverAdmission = status.certificates.find(
        (entry) => entry.admissionId === endpoint.serverCertificateAdmissionId,
      ) ?? null;
      const observation = latestObservation(
        status.availability,
        endpoint.endpointLeaseId,
        clientAdmission.certificateFingerprint,
        generatedAt,
      );
      let exclusionReason: string | null = null;
      if (Date.parse(generatedAt) < Date.parse(endpoint.availableFrom)) {
        exclusionReason = "endpoint-not-yet-available";
      } else if (Date.parse(generatedAt) >= Date.parse(endpoint.expiresAt)) {
        exclusionReason = "endpoint-lease-expired";
      } else if (!serverAdmission || !certificateActiveAt(
        serverAdmission,
        serverAdmission ? retirementFor(status, serverAdmission.certificateFingerprint) : null,
        generatedAt,
      )) {
        exclusionReason = "server-certificate-not-active";
      } else if (endpoint.acceptedClientCaCertificateFingerprint !== clientAdmission.issuerCertificateFingerprint) {
        exclusionReason = "client-ca-not-accepted";
      } else if (!observation) {
        exclusionReason = "availability-unobserved";
      } else if (observation.outcome !== "available") {
        exclusionReason = `availability-${observation.outcome}`;
      } else if (
        Date.parse(generatedAt) - Date.parse(observation.completedAt)
        > input.maxObservationAgeMilliseconds
      ) {
        exclusionReason = "availability-stale";
      }
      return {
        endpointLeaseId: endpoint.endpointLeaseId,
        endpointLeaseFingerprint: endpoint.endpointLeaseFingerprint,
        baseUrl: endpoint.baseUrl,
        networkScope: endpoint.networkScope,
        priority: endpoint.priority,
        serverCertificateFingerprint: endpoint.serverCertificateFingerprint,
        serverIssuerCertificateFingerprint: endpoint.serverIssuerCertificateFingerprint,
        acceptedClientCaCertificateFingerprint: endpoint.acceptedClientCaCertificateFingerprint,
        latestObservationId: observation?.observationId ?? null,
        latestObservationFingerprint: observation?.observationFingerprint ?? null,
        latestObservationAt: observation?.completedAt ?? null,
        latestOutcome: observation?.outcome ?? null,
        eligible: exclusionReason === null,
        exclusionReason,
      };
    })
    .sort((left, right) =>
      Number(right.eligible) - Number(left.eligible)
      || left.priority - right.priority
      || (right.latestObservationAt ?? "").localeCompare(left.latestObservationAt ?? "")
      || left.baseUrl.localeCompare(right.baseUrl)
      || left.endpointLeaseFingerprint.localeCompare(right.endpointLeaseFingerprint));
  const selected = entries.find((entry) => entry.eligible) ?? null;
  const core = {
    format: ASOIAF_ANSWER_TRANSPORT_RENDEZVOUS_FORMAT,
    serverId,
    clientCertificateAdmissionId: clientAdmission.admissionId,
    clientCertificateAdmissionFingerprint: clientAdmission.admissionFingerprint,
    clientCertificateFingerprint: clientAdmission.certificateFingerprint,
    clientActorId: clientAdmission.principalId,
    clientActorRole: clientAdmission.actorRole,
    generatedAt,
    maxObservationAgeMilliseconds: input.maxObservationAgeMilliseconds,
    entries,
    selectedEndpointLeaseId: selected?.endpointLeaseId ?? null,
    selectedEndpointLeaseFingerprint: selected?.endpointLeaseFingerprint ?? null,
    selectedBaseUrl: selected?.baseUrl ?? null,
    operatorId,
    automaticFailover: false as const,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const rendezvousFingerprint = sha256(core);
  return {
    ...core,
    rendezvousId: collectorContentId("asoiaf-answer-transport-rendezvous", {
      serverId,
      clientCertificateFingerprint: clientAdmission.certificateFingerprint,
      generatedAt,
      rendezvousFingerprint,
    }),
    rendezvousFingerprint,
  };
}

export function retainAsoiafAnswerTransportRendezvous(input: {
  root: string;
  serverId: string;
  clientCertificateFingerprint: string;
  generatedAt: string;
  maxObservationAgeMilliseconds: number;
  operatorId: string;
}): {
  rendezvous: AsoiafAnswerTransportRendezvous;
  rendezvousUri: string;
  replayed: boolean;
} {
  const rendezvous = buildAsoiafAnswerTransportRendezvous(input);
  const target = digestPath(
    asoiafAnswerTransportOperationsPaths(input.root).rendezvous,
    rendezvous.rendezvousFingerprint,
  );
  const persisted = writeJsonExclusiveOrReplay(target, rendezvous);
  return {
    rendezvous: persisted.value,
    rendezvousUri: relativeUri(input.root, target),
    replayed: persisted.replayed,
  };
}

export function validateAsoiafAnswerTransportRendezvous(
  rendezvous: AsoiafAnswerTransportRendezvous,
  expected: AsoiafAnswerTransportRendezvous,
): AsoiafAnswerTransportOperationsFinding[] {
  const findings: AsoiafAnswerTransportOperationsFinding[] = [];
  if (rendezvous.format !== ASOIAF_ANSWER_TRANSPORT_RENDEZVOUS_FORMAT) {
    findings.push(finding("operations-rendezvous-format", "error", rendezvous.rendezvousId, "rendezvous format is invalid"));
  }
  if (rendezvous.rendezvousFingerprint !== sha256(rendezvousCore(rendezvous))) {
    findings.push(finding("operations-rendezvous-fingerprint", "error", rendezvous.rendezvousId, "rendezvous fingerprint is stale"));
  }
  if (stableJson(rendezvous) !== stableJson(expected)) {
    findings.push(finding("operations-rendezvous-projection", "error", rendezvous.rendezvousId, "rendezvous differs from the current deterministic projection at its generation time"));
  }
  if (
    rendezvous.automaticFailover !== false
    || rendezvous.certificateRetained !== false
    || rendezvous.privateKeyRetained !== false
    || rendezvous.authority !== "none"
    || rendezvous.graphEffect !== "none"
    || rendezvous.canonEffect !== "none"
    || rendezvous.answerEffect !== "none"
  ) {
    findings.push(finding("operations-rendezvous-authority", "error", rendezvous.rendezvousId, "rendezvous retained secrets, enabled failover, or acquired task authority"));
  }
  return sortedFindings(findings);
}

function idempotencyDigest(value: string): `sha256:${string}` {
  if (value.length < 16 || value.length > 256 || !/^[\x21-\x7e]+$/.test(value)) {
    throw new Error("dispatch idempotency key must contain 16 through 256 visible ASCII characters");
  }
  return sha256(value);
}

function buildDispatchReceipt(input: {
  idempotencyKeyDigest: `sha256:${string}`;
  operation: AsoiafAnswerTransportOperation;
  body: AsoiafAnswerTransportBody;
  rendezvous: AsoiafAnswerTransportRendezvous;
  endpoint: AsoiafAnswerTransportEndpointLease;
  clientCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  dispatchedAt: string;
  completedAt: string;
  result: AsoiafAnswerTransportClientResult;
}): AsoiafAnswerTransportDispatchReceipt {
  const dispatchedAt = requireTime(input.dispatchedAt, "dispatch start time");
  const completedAt = requireTime(input.completedAt, "dispatch completion time");
  if (Date.parse(completedAt) < Date.parse(dispatchedAt)) {
    throw new Error("dispatch completion precedes dispatch start");
  }
  const route = input.operation === "issue-assignment"
    ? ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE
    : ASOIAF_ANSWER_TRANSPORT_ADMIT_ROUTE;
  const core = {
    format: ASOIAF_ANSWER_TRANSPORT_DISPATCH_FORMAT,
    idempotencyKeyDigest: input.idempotencyKeyDigest,
    operation: input.operation,
    route,
    bodyDigest: sha256(input.body),
    rendezvousId: input.rendezvous.rendezvousId,
    rendezvousFingerprint: input.rendezvous.rendezvousFingerprint,
    endpointLeaseId: input.endpoint.endpointLeaseId,
    endpointLeaseFingerprint: input.endpoint.endpointLeaseFingerprint,
    baseUrl: input.endpoint.baseUrl,
    clientCertificateFingerprint: input.clientCertificateFingerprint,
    dispatchedAt,
    completedAt,
    statusCode: input.result.statusCode,
    envelope: input.result.envelope,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const dispatchFingerprint = sha256(core);
  return {
    ...core,
    dispatchId: collectorContentId("asoiaf-answer-transport-dispatch", {
      idempotencyKeyDigest: input.idempotencyKeyDigest,
      dispatchFingerprint,
    }),
    dispatchFingerprint,
  };
}

export async function dispatchAsoiafAnswerTransport(input: {
  root: string;
  rendezvous: AsoiafAnswerTransportRendezvous;
  operation: AsoiafAnswerTransportOperation;
  body: AsoiafAnswerTransportBody;
  idempotencyKey: string;
  clientCertificate: string | Buffer;
  clientPrivateKey: string | Buffer;
  serverCertificateAuthority: string | Buffer;
  dispatchedAt: string;
  timeoutMilliseconds?: number;
}): Promise<{
  receipt: AsoiafAnswerTransportDispatchReceipt;
  receiptUri: string;
  replayed: boolean;
  networkAttempted: boolean;
}> {
  const keyDigest = idempotencyDigest(input.idempotencyKey);
  const paths = asoiafAnswerTransportOperationsPaths(input.root);
  const target = digestPath(paths.dispatches, keyDigest);
  const certificateFingerprint = fingerprintAsoiafAnswerTransportCertificate(input.clientCertificate);
  const existing = fs.existsSync(target)
    ? readJson<AsoiafAnswerTransportDispatchReceipt>(target)
    : null;
  if (existing) {
    if (
      existing.idempotencyKeyDigest !== keyDigest
      || existing.operation !== input.operation
      || existing.bodyDigest !== sha256(input.body)
      || existing.rendezvousId !== input.rendezvous.rendezvousId
      || existing.rendezvousFingerprint !== input.rendezvous.rendezvousFingerprint
      || existing.clientCertificateFingerprint !== certificateFingerprint
    ) {
      throw new Error("dispatch idempotency key is already bound to a different actor, rendezvous, operation, or body");
    }
    return {
      receipt: existing,
      receiptUri: relativeUri(input.root, target),
      replayed: true,
      networkAttempted: false,
    };
  }
  if (!input.rendezvous.selectedEndpointLeaseId || !input.rendezvous.selectedEndpointLeaseFingerprint || !input.rendezvous.selectedBaseUrl) {
    throw new Error("rendezvous has no eligible selected endpoint");
  }
  const endpoint = findEndpoint(input.root, input.rendezvous.selectedEndpointLeaseId);
  if (
    endpoint.endpointLeaseFingerprint !== input.rendezvous.selectedEndpointLeaseFingerprint
    || endpoint.baseUrl !== input.rendezvous.selectedBaseUrl
  ) {
    throw new Error("rendezvous selected endpoint differs from retained endpoint custody");
  }
  assertClientMaterial({
    root: input.root,
    certificate: input.clientCertificate,
    privateKey: input.clientPrivateKey,
    serverCertificateAuthority: input.serverCertificateAuthority,
    endpoint,
    at: input.dispatchedAt,
  });
  const result = await requestAsoiafAnswerTransport({
    operation: input.operation,
    baseUrl: endpoint.baseUrl,
    idempotencyKey: input.idempotencyKey,
    body: input.body,
    certificate: input.clientCertificate,
    privateKey: input.clientPrivateKey,
    certificateAuthority: input.serverCertificateAuthority,
    timeoutMilliseconds: input.timeoutMilliseconds,
  });
  const receipt = buildDispatchReceipt({
    idempotencyKeyDigest: keyDigest,
    operation: input.operation,
    body: input.body,
    rendezvous: input.rendezvous,
    endpoint,
    clientCertificateFingerprint: certificateFingerprint,
    dispatchedAt: input.dispatchedAt,
    completedAt: new Date().toISOString(),
    result,
  });
  const persisted = writeJsonExclusiveOrReplay(target, receipt);
  return {
    receipt: persisted.value,
    receiptUri: relativeUri(input.root, target),
    replayed: persisted.replayed,
    networkAttempted: true,
  };
}

export function validateAsoiafAnswerTransportDispatchReceipt(
  dispatch: AsoiafAnswerTransportDispatchReceipt,
  rendezvous: AsoiafAnswerTransportRendezvous,
  endpoint: AsoiafAnswerTransportEndpointLease,
): AsoiafAnswerTransportOperationsFinding[] {
  const findings: AsoiafAnswerTransportOperationsFinding[] = [];
  if (dispatch.format !== ASOIAF_ANSWER_TRANSPORT_DISPATCH_FORMAT) {
    findings.push(finding("operations-dispatch-format", "error", dispatch.dispatchId, "dispatch receipt format is invalid"));
  }
  if (dispatch.dispatchFingerprint !== sha256(dispatchCore(dispatch))) {
    findings.push(finding("operations-dispatch-fingerprint", "error", dispatch.dispatchId, "dispatch receipt fingerprint is stale"));
  }
  if (
    dispatch.rendezvousId !== rendezvous.rendezvousId
    || dispatch.rendezvousFingerprint !== rendezvous.rendezvousFingerprint
    || dispatch.endpointLeaseId !== endpoint.endpointLeaseId
    || dispatch.endpointLeaseFingerprint !== endpoint.endpointLeaseFingerprint
    || dispatch.baseUrl !== endpoint.baseUrl
  ) {
    findings.push(finding("operations-dispatch-custody", "error", dispatch.dispatchId, "dispatch receipt differs from rendezvous or endpoint custody"));
  }
  if (
    dispatch.certificateRetained !== false
    || dispatch.privateKeyRetained !== false
    || dispatch.authority !== "none"
    || dispatch.graphEffect !== "none"
    || dispatch.canonEffect !== "none"
    || dispatch.answerEffect !== "none"
  ) {
    findings.push(finding("operations-dispatch-authority", "error", dispatch.dispatchId, "dispatch receipt retained secrets or acquired task authority"));
  }
  return sortedFindings(findings);
}

export function readAsoiafAnswerTransportOperationsStatus(
  root: string,
): AsoiafAnswerTransportOperationsStatus {
  const paths = asoiafAnswerTransportOperationsPaths(root);
  return {
    format: "axm-asoiaf-answer-transport-operations-status/1",
    paths,
    certificates: sorted(
      listJson<AsoiafAnswerTransportCertificateAdmission>(paths.certificates),
      (entry) => `${entry.activateAt}:${entry.certificateFingerprint}`,
    ),
    retirements: sorted(
      listJson<AsoiafAnswerTransportCertificateRetirement>(paths.retirements),
      (entry) => `${entry.retiredAt}:${entry.certificateFingerprint}`,
    ),
    endpoints: sorted(
      listJson<AsoiafAnswerTransportEndpointLease>(paths.endpoints),
      (entry) => `${entry.serverId}:${entry.priority.toString().padStart(4, "0")}:${entry.baseUrl}:${entry.endpointLeaseFingerprint}`,
    ),
    availability: sorted(
      listJson<AsoiafAnswerTransportAvailabilityObservation>(paths.availability),
      (entry) => `${entry.completedAt}:${entry.observationFingerprint}`,
    ),
    rendezvous: sorted(
      listJson<AsoiafAnswerTransportRendezvous>(paths.rendezvous),
      (entry) => `${entry.generatedAt}:${entry.rendezvousFingerprint}`,
    ),
    dispatches: sorted(
      listJson<AsoiafAnswerTransportDispatchReceipt>(paths.dispatches),
      (entry) => `${entry.dispatchedAt}:${entry.dispatchFingerprint}`,
    ),
  };
}

function transportRegistrationFor(
  registrationByFingerprint: Map<string, AsoiafAnswerTransportActorRegistration>,
  admission: AsoiafAnswerTransportCertificateAdmission,
): AsoiafAnswerTransportActorRegistration | null {
  return registrationByFingerprint.get(admission.certificateFingerprint) ?? null;
}

function verifyDigestNamedDirectory<T>(input: {
  directory: string;
  values: T[];
  digest: (value: T) => string;
  code: string;
}): AsoiafAnswerTransportOperationsFinding[] {
  const findings: AsoiafAnswerTransportOperationsFinding[] = [];
  if (!fs.existsSync(input.directory)) return findings;
  const expected = new Set(input.values.map((value) => `${normalizeDigest(input.digest(value), "object digest").slice("sha256:".length)}.json`));
  for (const name of fs.readdirSync(input.directory).sort()) {
    if (!/^[a-f0-9]{64}\.json$/.test(name)) {
      findings.push(finding(`${input.code}-unsafe-name`, "error", name, "operations directory contains a non-digest JSON filename"));
    } else if (!expected.has(name)) {
      findings.push(finding(`${input.code}-orphan-name`, "error", name, "operations filename does not match any reconstructed object digest"));
    }
  }
  return findings;
}

function scanForSecretMaterial(
  root: string,
): AsoiafAnswerTransportOperationsFinding[] {
  const findings: AsoiafAnswerTransportOperationsFinding[] = [];
  if (!fs.existsSync(root)) return findings;
  const walk = (directory: string) => {
    for (const name of fs.readdirSync(directory).sort()) {
      const target = path.join(directory, name);
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        walk(target);
        continue;
      }
      if (/\.(key|pem|crt|cer|csr|p12|pfx)$/i.test(name)) {
        findings.push(finding("operations-secret-file", "error", relativeUri(root, target), "operations estate contains a certificate or private-key file"));
        continue;
      }
      if (stat.size <= 2_000_000) {
        const text = fs.readFileSync(target, "utf8");
        if (/-----BEGIN (?:CERTIFICATE|CERTIFICATE REQUEST|PRIVATE KEY|RSA PRIVATE KEY|EC PRIVATE KEY)-----/.test(text)) {
          findings.push(finding("operations-secret-payload", "error", relativeUri(root, target), "operations estate contains PEM certificate or private-key material"));
        }
      }
    }
  };
  walk(root);
  return findings;
}

export function verifyAsoiafAnswerTransportOperationsEstate(
  root: string,
): AsoiafAnswerTransportOperationsFinding[] {
  const findings: AsoiafAnswerTransportOperationsFinding[] = [];
  for (const lower of verifyAsoiafAnswerTransportEstate(root)) {
    findings.push(finding(`operations-lower-${lower.code}`, lower.severity, lower.subjectId, lower.detail));
  }
  const status = readAsoiafAnswerTransportOperationsStatus(root);
  const transport = readAsoiafAnswerTransportStatus(root);
  const registrationByFingerprint = new Map(
    transport.registrations.map((entry) => [entry.certificateFingerprint, entry]),
  );
  const revocationByFingerprint = new Map(
    transport.revocations.map((entry) => [entry.certificateFingerprint, entry]),
  );
  const admissionById = new Map(status.certificates.map((entry) => [entry.admissionId, entry]));
  const admissionByFingerprint = new Map<string, AsoiafAnswerTransportCertificateAdmission>();
  for (const admission of status.certificates) {
    if (admissionByFingerprint.has(admission.certificateFingerprint)) {
      findings.push(finding("operations-certificate-duplicate", "error", admission.admissionId, "certificate fingerprint has multiple admissions"));
    }
    admissionByFingerprint.set(admission.certificateFingerprint, admission);
    findings.push(...validateAsoiafAnswerTransportCertificateAdmission(
      admission,
      transportRegistrationFor(registrationByFingerprint, admission),
    ));
    if (admission.predecessorCertificateFingerprint) {
      const predecessor = admissionByFingerprint.get(admission.predecessorCertificateFingerprint)
        ?? status.certificates.find((entry) => entry.certificateFingerprint === admission.predecessorCertificateFingerprint)
        ?? null;
      if (!predecessor) {
        findings.push(finding("operations-certificate-predecessor", "error", admission.admissionId, "certificate admission references a missing predecessor"));
      } else if (
        predecessor.usage !== admission.usage
        || predecessor.principalId !== admission.principalId
        || predecessor.actorRole !== admission.actorRole
      ) {
        findings.push(finding("operations-certificate-predecessor-parity", "error", admission.admissionId, "certificate predecessor belongs to a different principal or role"));
      }
    }
  }

  const retirementByFingerprint = new Map<string, AsoiafAnswerTransportCertificateRetirement>();
  for (const retirement of status.retirements) {
    if (retirementByFingerprint.has(retirement.certificateFingerprint)) {
      findings.push(finding("operations-retirement-duplicate", "error", retirement.retirementId, "certificate admission has multiple retirements"));
    }
    retirementByFingerprint.set(retirement.certificateFingerprint, retirement);
    const admission = admissionByFingerprint.get(retirement.certificateFingerprint);
    if (!admission) {
      findings.push(finding("operations-retirement-orphan", "error", retirement.retirementId, "certificate retirement references a missing admission"));
      continue;
    }
    const successor = retirement.successorAdmissionId
      ? admissionById.get(retirement.successorAdmissionId) ?? null
      : null;
    findings.push(...validateAsoiafAnswerTransportCertificateRetirement(
      retirement,
      admission,
      successor,
      revocationByFingerprint.get(retirement.certificateFingerprint) ?? null,
    ));
  }

  const endpointById = new Map<string, AsoiafAnswerTransportEndpointLease>();
  for (const endpoint of status.endpoints) {
    if (endpointById.has(endpoint.endpointLeaseId)) {
      findings.push(finding("operations-endpoint-duplicate", "error", endpoint.endpointLeaseId, "endpoint lease identity is duplicated"));
    }
    endpointById.set(endpoint.endpointLeaseId, endpoint);
    const serverCertificate = admissionById.get(endpoint.serverCertificateAdmissionId);
    if (!serverCertificate) {
      findings.push(finding("operations-endpoint-orphan", "error", endpoint.endpointLeaseId, "endpoint lease references a missing server certificate admission"));
    } else {
      findings.push(...validateAsoiafAnswerTransportEndpointLease(endpoint, serverCertificate));
    }
  }

  const observationById = new Map<string, AsoiafAnswerTransportAvailabilityObservation>();
  for (const observation of status.availability) {
    if (observationById.has(observation.observationId)) {
      findings.push(finding("operations-availability-duplicate", "error", observation.observationId, "availability observation identity is duplicated"));
    }
    observationById.set(observation.observationId, observation);
    const endpoint = endpointById.get(observation.endpointLeaseId);
    const clientAdmission = admissionById.get(observation.clientCertificateAdmissionId);
    if (!endpoint || !clientAdmission) {
      findings.push(finding("operations-availability-orphan", "error", observation.observationId, "availability observation references missing endpoint or client certificate custody"));
    } else {
      findings.push(...validateAsoiafAnswerTransportAvailabilityObservation(observation, endpoint, clientAdmission));
    }
  }

  const rendezvousById = new Map<string, AsoiafAnswerTransportRendezvous>();
  for (const rendezvous of status.rendezvous) {
    if (rendezvousById.has(rendezvous.rendezvousId)) {
      findings.push(finding("operations-rendezvous-duplicate", "error", rendezvous.rendezvousId, "rendezvous identity is duplicated"));
    }
    rendezvousById.set(rendezvous.rendezvousId, rendezvous);
    try {
      const expected = buildAsoiafAnswerTransportRendezvous({
        root,
        serverId: rendezvous.serverId,
        clientCertificateFingerprint: rendezvous.clientCertificateFingerprint,
        generatedAt: rendezvous.generatedAt,
        maxObservationAgeMilliseconds: rendezvous.maxObservationAgeMilliseconds,
        operatorId: rendezvous.operatorId,
      });
      findings.push(...validateAsoiafAnswerTransportRendezvous(rendezvous, expected));
    } catch (error) {
      findings.push(finding("operations-rendezvous-input", "error", rendezvous.rendezvousId, error instanceof Error ? error.message : String(error)));
    }
  }

  for (const dispatch of status.dispatches) {
    const rendezvous = rendezvousById.get(dispatch.rendezvousId);
    const endpoint = endpointById.get(dispatch.endpointLeaseId);
    if (!rendezvous || !endpoint) {
      findings.push(finding("operations-dispatch-orphan", "error", dispatch.dispatchId, "dispatch receipt references missing rendezvous or endpoint custody"));
    } else {
      findings.push(...validateAsoiafAnswerTransportDispatchReceipt(dispatch, rendezvous, endpoint));
    }
  }

  findings.push(...verifyDigestNamedDirectory({
    directory: status.paths.certificates,
    values: status.certificates,
    digest: (entry) => entry.certificateFingerprint,
    code: "operations-certificate-name",
  }));
  findings.push(...verifyDigestNamedDirectory({
    directory: status.paths.retirements,
    values: status.retirements,
    digest: (entry) => entry.certificateFingerprint,
    code: "operations-retirement-name",
  }));
  findings.push(...verifyDigestNamedDirectory({
    directory: status.paths.endpoints,
    values: status.endpoints,
    digest: (entry) => entry.endpointLeaseFingerprint,
    code: "operations-endpoint-name",
  }));
  findings.push(...verifyDigestNamedDirectory({
    directory: status.paths.availability,
    values: status.availability,
    digest: (entry) => entry.observationFingerprint,
    code: "operations-availability-name",
  }));
  findings.push(...verifyDigestNamedDirectory({
    directory: status.paths.rendezvous,
    values: status.rendezvous,
    digest: (entry) => entry.rendezvousFingerprint,
    code: "operations-rendezvous-name",
  }));
  findings.push(...verifyDigestNamedDirectory({
    directory: status.paths.dispatches,
    values: status.dispatches,
    digest: (entry) => entry.idempotencyKeyDigest,
    code: "operations-dispatch-name",
  }));
  findings.push(...scanForSecretMaterial(status.paths.operationsRoot));
  return sortedFindings(findings);
}
