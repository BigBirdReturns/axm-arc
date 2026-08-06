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

export const ASOIAF_ANSWER_TRANSPORT_ISSUER_POLICY_FORMAT =
  "axm-asoiaf-answer-transport-issuer-policy/1" as const;
export const ASOIAF_ANSWER_TRANSPORT_ENROLLMENT_REQUEST_FORMAT =
  "axm-asoiaf-answer-transport-enrollment-request/1" as const;
export const ASOIAF_ANSWER_TRANSPORT_ENROLLMENT_APPROVAL_FORMAT =
  "axm-asoiaf-answer-transport-enrollment-approval/1" as const;
export const ASOIAF_ANSWER_TRANSPORT_ISSUANCE_ORDER_FORMAT =
  "axm-asoiaf-answer-transport-issuance-order/1" as const;
export const ASOIAF_ANSWER_TRANSPORT_ISSUANCE_RECEIPT_FORMAT =
  "axm-asoiaf-answer-transport-issuance-receipt/1" as const;
export const ASOIAF_ANSWER_TRANSPORT_ADMISSION_LINK_FORMAT =
  "axm-asoiaf-answer-transport-admission-link/1" as const;
export const ASOIAF_ANSWER_TRANSPORT_PROOF_STATEMENT_FORMAT =
  "axm-asoiaf-answer-transport-proof-of-possession/1" as const;
export const ASOIAF_ANSWER_TRANSPORT_APPROVAL_STATEMENT_FORMAT =
  "axm-asoiaf-answer-transport-approval-statement/1" as const;

export type AsoiafAnswerTransportCertificateUsage =
  | "client-auth"
  | "server-auth";

export type AsoiafAnswerTransportEnrollmentMode =
  | "initial"
  | "renewal"
  | "emergency-recovery";

export type AsoiafAnswerTransportApprovalRole =
  | "issuer-operator"
  | "actor-owner"
  | "security-officer"
  | "service-owner";

export type AsoiafAnswerTransportApprovalDecision =
  | "approve"
  | "reject";

export type AsoiafAnswerTransportKeyCustodyClass =
  | "hardware-backed"
  | "operating-system-keychain"
  | "encrypted-file"
  | "external-agent";

export type AsoiafAnswerTransportProofAlgorithm =
  | "rsa-sha256"
  | "ecdsa-sha256"
  | "ed25519";

export const ASOIAF_ANSWER_TRANSPORT_ACTOR_ROLES = [
  "network-collector",
  "holder-controlled-search",
  "edition-reviewer",
  "structured-observation-reviewer",
  "exact-locator-reviewer",
  "disposition-reviewer",
  "canon-reconciler",
  "continuity-reviewer",
  "answer-assembler",
  "answer-verifier",
] as const satisfies readonly AsoiafAnswerExchangeActorRole[];

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

export interface AsoiafAnswerTransportEnrollmentPaths {
  root: string;
  enrollmentRoot: string;
  policies: string;
  requests: string;
  approvals: string;
  orders: string;
  issuances: string;
  admissionLinks: string;
}

export interface AsoiafAnswerTransportApprover {
  approverId: string;
  role: AsoiafAnswerTransportApprovalRole;
  publicKeyFingerprint: `sha256:${string}`;
  publicKeySpkiBase64: string;
  publicKeyType: string;
}

export interface AsoiafAnswerTransportIssuerPolicy extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_TRANSPORT_ISSUER_POLICY_FORMAT;
  policyId: string;
  policyFingerprint: `sha256:${string}`;
  issuerId: string;
  issuerCertificateFingerprint: `sha256:${string}`;
  issuerPublicKeyFingerprint: `sha256:${string}`;
  issuerSubject: string;
  issuerValidFrom: string;
  issuerValidUntil: string;
  allowedUsages: AsoiafAnswerTransportCertificateUsage[];
  allowedActorRoles: AsoiafAnswerExchangeActorRole[];
  allowedPrincipalPrefixes: string[];
  allowedKeyCustodyClasses: AsoiafAnswerTransportKeyCustodyClass[];
  allowExportablePrivateKeys: boolean;
  maxLeafLifetimeMilliseconds: number;
  maxRequestLifetimeMilliseconds: number;
  maxOrderLifetimeMilliseconds: number;
  minimumRenewalOverlapMilliseconds: number;
  approvalThreshold: number;
  emergencyApprovalThreshold: number;
  requiredApprovalRoles: AsoiafAnswerTransportApprovalRole[];
  emergencyRequiredApprovalRoles: AsoiafAnswerTransportApprovalRole[];
  approvers: AsoiafAnswerTransportApprover[];
  createdAt: string;
  operatorId: string;
  issuerCertificateRetained: false;
  privateKeyRetained: false;
  privateKeyPathRetained: false;
  issuanceAuthority: "policy-only";
}

export interface AsoiafAnswerTransportKeyCustodyAttestation {
  custodyClass: AsoiafAnswerTransportKeyCustodyClass;
  providerId: string;
  keyReferenceDigest: `sha256:${string}`;
  attestationDigest: `sha256:${string}`;
  attestationUri: string | null;
  privateKeyExportable: boolean;
  privateKeyRetained: false;
  rawKeyReferenceRetained: false;
}

export interface AsoiafAnswerTransportProofStatement {
  format: typeof ASOIAF_ANSWER_TRANSPORT_PROOF_STATEMENT_FORMAT;
  policyId: string;
  policyFingerprint: `sha256:${string}`;
  principalId: string;
  usage: AsoiafAnswerTransportCertificateUsage;
  actorRole: AsoiafAnswerExchangeActorRole | null;
  mode: AsoiafAnswerTransportEnrollmentMode;
  publicKeyFingerprint: `sha256:${string}`;
  requestedSubject: string;
  requestedSubjectAltNames: string[];
  requestedValidFrom: string;
  requestedValidUntil: string;
  activateAt: string;
  renewAfter: string;
  retireAfter: string;
  predecessorCertificateFingerprint: `sha256:${string}` | null;
  custody: AsoiafAnswerTransportKeyCustodyAttestation;
  nonceDigest: `sha256:${string}`;
  createdAt: string;
  expiresAt: string;
  requesterId: string;
}

export interface AsoiafAnswerTransportEnrollmentRequest
  extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_TRANSPORT_ENROLLMENT_REQUEST_FORMAT;
  requestId: string;
  requestFingerprint: `sha256:${string}`;
  proofStatement: AsoiafAnswerTransportProofStatement;
  publicKeySpkiBase64: string;
  publicKeyType: string;
  proofAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  proofSignatureBase64: string;
  proofSignatureDigest: `sha256:${string}`;
  proofVerified: true;
  publicKeyRetained: true;
  privateKeyRetained: false;
  privateKeyPathRetained: false;
  requestAuthority: "none";
}

export interface AsoiafAnswerTransportApprovalStatement {
  format: typeof ASOIAF_ANSWER_TRANSPORT_APPROVAL_STATEMENT_FORMAT;
  policyId: string;
  policyFingerprint: `sha256:${string}`;
  requestId: string;
  requestFingerprint: `sha256:${string}`;
  approverId: string;
  approverRole: AsoiafAnswerTransportApprovalRole;
  decision: AsoiafAnswerTransportApprovalDecision;
  decidedAt: string;
  reasonDigest: `sha256:${string}`;
}

export interface AsoiafAnswerTransportEnrollmentApproval
  extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_TRANSPORT_ENROLLMENT_APPROVAL_FORMAT;
  approvalId: string;
  approvalFingerprint: `sha256:${string}`;
  statement: AsoiafAnswerTransportApprovalStatement;
  reason: string;
  signatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  signatureBase64: string;
  signatureDigest: `sha256:${string}`;
  signatureVerified: true;
  approvalAuthority: "approve-enrollment-only";
}

export interface AsoiafAnswerTransportIssuanceProfile {
  usage: AsoiafAnswerTransportCertificateUsage;
  principalId: string;
  actorRole: AsoiafAnswerExchangeActorRole | null;
  publicKeyFingerprint: `sha256:${string}`;
  requestedSubject: string;
  requestedSubjectAltNames: string[];
  requestedValidFrom: string;
  requestedValidUntil: string;
  activateAt: string;
  renewAfter: string;
  retireAfter: string;
  predecessorCertificateFingerprint: `sha256:${string}` | null;
  custody: AsoiafAnswerTransportKeyCustodyAttestation;
}

export interface AsoiafAnswerTransportIssuanceOrder
  extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_TRANSPORT_ISSUANCE_ORDER_FORMAT;
  orderId: string;
  orderFingerprint: `sha256:${string}`;
  policyId: string;
  policyFingerprint: `sha256:${string}`;
  requestId: string;
  requestFingerprint: `sha256:${string}`;
  approvalIds: string[];
  approvalFingerprints: `sha256:${string}`[];
  approvalRoles: AsoiafAnswerTransportApprovalRole[];
  issuanceProfile: AsoiafAnswerTransportIssuanceProfile;
  orderedAt: string;
  expiresAt: string;
  operatorId: string;
  issuerCertificateFingerprint: `sha256:${string}`;
  issuerPublicKeyFingerprint: `sha256:${string}`;
  issuanceAuthority: "authorize-one-leaf";
  certificateRetained: false;
  privateKeyRetained: false;
}

export interface AsoiafAnswerTransportCertificateMetadata {
  certificateFingerprint: `sha256:${string}`;
  publicKeyFingerprint: `sha256:${string}`;
  issuerCertificateFingerprint: `sha256:${string}`;
  serialNumber: string;
  subject: string;
  subjectAltNames: string[];
  issuer: string;
  validFrom: string;
  validUntil: string;
  extendedKeyUsageOids: string[];
}

export interface AsoiafAnswerTransportAdmissionInstruction {
  usage: AsoiafAnswerTransportCertificateUsage;
  principalId: string;
  actorRole: AsoiafAnswerExchangeActorRole | null;
  certificateFingerprint: `sha256:${string}`;
  issuerCertificateFingerprint: `sha256:${string}`;
  publicKeyFingerprint: `sha256:${string}`;
  admittedAt: string;
  activateAt: string;
  renewAfter: string;
  retireAfter: string;
  predecessorCertificateFingerprint: `sha256:${string}` | null;
  keyCustodyClass: AsoiafAnswerTransportKeyCustodyClass;
  keyReferenceDigest: `sha256:${string}`;
  privateKeyExportable: boolean;
  reason: string;
  operatorId: string;
}

export interface AsoiafAnswerTransportIssuanceReceipt
  extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_TRANSPORT_ISSUANCE_RECEIPT_FORMAT;
  issuanceId: string;
  issuanceFingerprint: `sha256:${string}`;
  policyId: string;
  policyFingerprint: `sha256:${string}`;
  requestId: string;
  requestFingerprint: `sha256:${string}`;
  orderId: string;
  orderFingerprint: `sha256:${string}`;
  certificate: AsoiafAnswerTransportCertificateMetadata;
  admissionInstruction: AsoiafAnswerTransportAdmissionInstruction;
  issuedAt: string;
  recordedAt: string;
  operatorId: string;
  certificateRetained: false;
  privateKeyRetained: false;
  certificatePathRetained: false;
  privateKeyPathRetained: false;
  issuanceAuthority: "verified-issued-leaf";
}

export interface AsoiafAnswerTransportRuntimeAdmissionReference {
  admissionId: string;
  admissionFingerprint: `sha256:${string}`;
  certificateFingerprint: `sha256:${string}`;
  publicKeyFingerprint: `sha256:${string}`;
  issuerCertificateFingerprint: `sha256:${string}`;
  usage: AsoiafAnswerTransportCertificateUsage;
  principalId: string;
  actorRole: AsoiafAnswerExchangeActorRole | null;
  predecessorCertificateFingerprint: `sha256:${string}` | null;
  admittedAt: string;
}

export interface AsoiafAnswerTransportAdmissionLink
  extends NoTaskAuthority {
  format: typeof ASOIAF_ANSWER_TRANSPORT_ADMISSION_LINK_FORMAT;
  linkId: string;
  linkFingerprint: `sha256:${string}`;
  issuanceId: string;
  issuanceFingerprint: `sha256:${string}`;
  admission: AsoiafAnswerTransportRuntimeAdmissionReference;
  linkedAt: string;
  operatorId: string;
  admissionAuthority: "runtime-admission-reference-only";
}

export interface AsoiafAnswerTransportEnrollmentStatus {
  format: "axm-asoiaf-answer-transport-enrollment-status/1";
  paths: AsoiafAnswerTransportEnrollmentPaths;
  policies: AsoiafAnswerTransportIssuerPolicy[];
  requests: AsoiafAnswerTransportEnrollmentRequest[];
  approvals: AsoiafAnswerTransportEnrollmentApproval[];
  orders: AsoiafAnswerTransportIssuanceOrder[];
  issuances: AsoiafAnswerTransportIssuanceReceipt[];
  admissionLinks: AsoiafAnswerTransportAdmissionLink[];
}

export interface AsoiafAnswerTransportEnrollmentFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

export interface AsoiafAnswerTransportIssuerPolicyInput {
  root: string;
  issuerId: string;
  issuerCertificate: string | Buffer;
  allowedUsages: AsoiafAnswerTransportCertificateUsage[];
  allowedActorRoles: AsoiafAnswerExchangeActorRole[];
  allowedPrincipalPrefixes: string[];
  allowedKeyCustodyClasses: AsoiafAnswerTransportKeyCustodyClass[];
  allowExportablePrivateKeys: boolean;
  maxLeafLifetimeMilliseconds: number;
  maxRequestLifetimeMilliseconds: number;
  maxOrderLifetimeMilliseconds: number;
  minimumRenewalOverlapMilliseconds: number;
  approvalThreshold: number;
  emergencyApprovalThreshold: number;
  requiredApprovalRoles: AsoiafAnswerTransportApprovalRole[];
  emergencyRequiredApprovalRoles: AsoiafAnswerTransportApprovalRole[];
  approvers: Array<{
    approverId: string;
    role: AsoiafAnswerTransportApprovalRole;
    publicKey: string | Buffer | crypto.KeyObject;
  }>;
  createdAt: string;
  operatorId: string;
}

export interface AsoiafAnswerTransportEnrollmentRequestInput {
  root: string;
  policyId: string;
  principalId: string;
  usage: AsoiafAnswerTransportCertificateUsage;
  actorRole?: AsoiafAnswerExchangeActorRole | null;
  mode: AsoiafAnswerTransportEnrollmentMode;
  publicKey: string | Buffer | crypto.KeyObject;
  proofAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  proofSignature: string | Buffer;
  requestedSubject: string;
  requestedSubjectAltNames?: string[];
  requestedValidFrom: string;
  requestedValidUntil: string;
  activateAt: string;
  renewAfter: string;
  retireAfter: string;
  predecessorCertificateFingerprint?: string | null;
  custody: Omit<
    AsoiafAnswerTransportKeyCustodyAttestation,
    "privateKeyRetained" | "rawKeyReferenceRetained"
  >;
  nonce: string;
  createdAt: string;
  expiresAt: string;
  requesterId: string;
}

const CLIENT_AUTH_OID = "1.3.6.1.5.5.7.3.2";
const SERVER_AUTH_OID = "1.3.6.1.5.5.7.3.1";
const MAX_RUNTIME_LEAF_LIFETIME = 398 * 24 * 60 * 60 * 1000;
const MIN_PROOF_NONCE_CHARACTERS = 24;

function finding(
  code: string,
  severity: AsoiafAnswerTransportEnrollmentFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafAnswerTransportEnrollmentFinding {
  return { code, severity, subjectId, detail };
}

function sortedFindings(
  values: readonly AsoiafAnswerTransportEnrollmentFinding[],
): AsoiafAnswerTransportEnrollmentFinding[] {
  const rank = { error: 0, warning: 1, notice: 2 } as const;
  return [...values].sort(
    (left, right) =>
      rank[left.severity] - rank[right.severity]
      || left.code.localeCompare(right.code)
      || left.subjectId.localeCompare(right.subjectId)
      || left.detail.localeCompare(right.detail),
  );
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

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.map((entry) => entry.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
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

export function serializeAsoiafAnswerTransportProofStatement(
  statement: AsoiafAnswerTransportProofStatement,
): Buffer {
  return stableBytes(statement);
}

export function serializeAsoiafAnswerTransportApprovalStatement(
  statement: AsoiafAnswerTransportApprovalStatement,
): Buffer {
  return stableBytes(statement);
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

function certificateFingerprint(value: string | Buffer): `sha256:${string}` {
  return bytesDigest(parseCertificate(value).raw);
}

function publicKeyObject(
  value: string | Buffer | crypto.KeyObject,
): crypto.KeyObject {
  const key = value instanceof crypto.KeyObject ? value : crypto.createPublicKey(value);
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

function assertKeyStrength(key: crypto.KeyObject): void {
  const type = key.asymmetricKeyType;
  if (type === "rsa" || type === "rsa-pss") {
    if ((key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
      throw new Error("RSA enrollment key must be at least 2048 bits");
    }
    return;
  }
  if (type === "ec") {
    const curve = key.asymmetricKeyDetails?.namedCurve;
    if (!curve || !["prime256v1", "secp384r1", "secp521r1"].includes(curve)) {
      throw new Error("EC enrollment key uses an unsupported curve");
    }
    return;
  }
  if (type !== "ed25519") {
    throw new Error(`enrollment public-key type ${type ?? "unknown"} is unsupported`);
  }
}

function expectedProofAlgorithm(key: crypto.KeyObject): AsoiafAnswerTransportProofAlgorithm {
  if (key.asymmetricKeyType === "ed25519") return "ed25519";
  if (key.asymmetricKeyType === "ec") return "ecdsa-sha256";
  if (key.asymmetricKeyType === "rsa" || key.asymmetricKeyType === "rsa-pss") {
    return "rsa-sha256";
  }
  throw new Error(`unsupported proof key type ${key.asymmetricKeyType ?? "unknown"}`);
}

function verifySignature(input: {
  key: crypto.KeyObject;
  algorithm: AsoiafAnswerTransportProofAlgorithm;
  message: Buffer;
  signature: Buffer;
}): boolean {
  if (expectedProofAlgorithm(input.key) !== input.algorithm) return false;
  return crypto.verify(
    input.algorithm === "ed25519" ? null : "sha256",
    input.message,
    input.key,
    input.signature,
  );
}

function signatureBuffer(value: string | Buffer): Buffer {
  if (Buffer.isBuffer(value)) return value;
  const normalized = value.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error("signature must be canonical base64");
  }
  return Buffer.from(normalized, "base64");
}

function normalizeSubjectAltNames(values: readonly string[]): string[] {
  return sortedUnique(values).map((entry) => {
    if (!/^(DNS|IP Address|URI|email):[^\s]+$/.test(entry)) {
      throw new Error(`subject alternative name ${entry} is invalid`);
    }
    return entry;
  });
}

function parseSubjectAltNames(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value.split(/,\s*/).map((entry) => entry.trim()).filter(Boolean).sort();
}

function requirePositiveInteger(
  value: number,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} through ${maximum}`);
  }
  return value;
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
      throw new Error(`answer transport enrollment immutable file collision at ${target}`);
    }
    return { value: JSON.parse(existing) as T, replayed: true };
  }
}

function relativeUri(root: string, target: string): string {
  return path.relative(path.resolve(root), path.resolve(target)).split(path.sep).join("/");
}

function digestPath(directory: string, digest: string): string {
  return path.join(directory, `${requireSha256(digest, "object digest").slice(7)}.json`);
}

export function asoiafAnswerTransportEnrollmentPaths(
  root: string,
): AsoiafAnswerTransportEnrollmentPaths {
  const absolute = path.resolve(root);
  const enrollmentRoot = path.join(absolute, "answer-transport-enrollment");
  return {
    root: absolute,
    enrollmentRoot,
    policies: path.join(enrollmentRoot, "policies"),
    requests: path.join(enrollmentRoot, "requests"),
    approvals: path.join(enrollmentRoot, "approvals"),
    orders: path.join(enrollmentRoot, "orders"),
    issuances: path.join(enrollmentRoot, "issuances"),
    admissionLinks: path.join(enrollmentRoot, "admission-links"),
  };
}

function issuerPolicyCore(
  policy: AsoiafAnswerTransportIssuerPolicy,
): Omit<AsoiafAnswerTransportIssuerPolicy, "policyId" | "policyFingerprint"> {
  const { policyId: _id, policyFingerprint: _fingerprint, ...core } = policy;
  return core;
}

function enrollmentRequestCore(
  request: AsoiafAnswerTransportEnrollmentRequest,
): Omit<AsoiafAnswerTransportEnrollmentRequest, "requestId" | "requestFingerprint"> {
  const { requestId: _id, requestFingerprint: _fingerprint, ...core } = request;
  return core;
}

function approvalCore(
  approval: AsoiafAnswerTransportEnrollmentApproval,
): Omit<AsoiafAnswerTransportEnrollmentApproval, "approvalId" | "approvalFingerprint"> {
  const { approvalId: _id, approvalFingerprint: _fingerprint, ...core } = approval;
  return core;
}

function orderCore(
  order: AsoiafAnswerTransportIssuanceOrder,
): Omit<AsoiafAnswerTransportIssuanceOrder, "orderId" | "orderFingerprint"> {
  const { orderId: _id, orderFingerprint: _fingerprint, ...core } = order;
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

function parseCaCertificate(value: string | Buffer): {
  certificate: crypto.X509Certificate;
  certificateFingerprint: `sha256:${string}`;
  publicKeyFingerprint: `sha256:${string}`;
} {
  const certificate = parseCertificate(value);
  if (!certificate.ca) throw new Error("issuer policy certificate is not a certificate authority");
  assertKeyStrength(certificate.publicKey);
  return {
    certificate,
    certificateFingerprint: bytesDigest(certificate.raw),
    publicKeyFingerprint: publicKeyFingerprint(certificate.publicKey),
  };
}

function requireActorRole(value: string): AsoiafAnswerExchangeActorRole {
  if (!(ASOIAF_ANSWER_TRANSPORT_ACTOR_ROLES as readonly string[]).includes(value)) {
    throw new Error(`answer exchange actor role ${value} is invalid`);
  }
  return value as AsoiafAnswerExchangeActorRole;
}

function requireApprovalRole(value: string): AsoiafAnswerTransportApprovalRole {
  if (![
    "issuer-operator",
    "actor-owner",
    "security-officer",
    "service-owner",
  ].includes(value)) {
    throw new Error(`approval role ${value} is invalid`);
  }
  return value as AsoiafAnswerTransportApprovalRole;
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

function requireUsage(value: string): AsoiafAnswerTransportCertificateUsage {
  if (value !== "client-auth" && value !== "server-auth") {
    throw new Error(`certificate usage ${value} is invalid`);
  }
  return value;
}

function requireMode(value: string): AsoiafAnswerTransportEnrollmentMode {
  if (!["initial", "renewal", "emergency-recovery"].includes(value)) {
    throw new Error(`enrollment mode ${value} is invalid`);
  }
  return value as AsoiafAnswerTransportEnrollmentMode;
}

export function retainAsoiafAnswerTransportIssuerPolicy(
  input: AsoiafAnswerTransportIssuerPolicyInput,
): {
  policy: AsoiafAnswerTransportIssuerPolicy;
  policyUri: string;
  replayed: boolean;
} {
  const issuer = parseCaCertificate(input.issuerCertificate);
  const createdAt = requireTime(input.createdAt, "issuer policy creation time");
  if (
    Date.parse(createdAt) < issuer.certificate.validFromDate.getTime()
    || Date.parse(createdAt) > issuer.certificate.validToDate.getTime()
  ) {
    throw new Error("issuer policy creation time is outside issuer certificate validity");
  }
  const allowedUsages = sortedUnique(
    input.allowedUsages.map(requireUsage),
  ) as AsoiafAnswerTransportCertificateUsage[];
  if (allowedUsages.length === 0) throw new Error("issuer policy requires at least one usage");
  const allowedActorRoles = sortedUnique(input.allowedActorRoles)
    .map(requireActorRole) as AsoiafAnswerExchangeActorRole[];
  const allowedPrincipalPrefixes = sortedUnique(input.allowedPrincipalPrefixes);
  if (allowedPrincipalPrefixes.length === 0) {
    throw new Error("issuer policy requires at least one principal prefix");
  }
  const allowedKeyCustodyClasses = sortedUnique(
    input.allowedKeyCustodyClasses.map(requireCustodyClass),
  ) as AsoiafAnswerTransportKeyCustodyClass[];
  if (allowedKeyCustodyClasses.length === 0) {
    throw new Error("issuer policy requires at least one key custody class");
  }
  const maxLeafLifetimeMilliseconds = requirePositiveInteger(
    input.maxLeafLifetimeMilliseconds,
    "maximum leaf lifetime",
    60_000,
    MAX_RUNTIME_LEAF_LIFETIME,
  );
  const maxRequestLifetimeMilliseconds = requirePositiveInteger(
    input.maxRequestLifetimeMilliseconds,
    "maximum request lifetime",
    60_000,
    30 * 24 * 60 * 60 * 1000,
  );
  const maxOrderLifetimeMilliseconds = requirePositiveInteger(
    input.maxOrderLifetimeMilliseconds,
    "maximum order lifetime",
    60_000,
    maxRequestLifetimeMilliseconds,
  );
  const minimumRenewalOverlapMilliseconds = requirePositiveInteger(
    input.minimumRenewalOverlapMilliseconds,
    "minimum renewal overlap",
    60_000,
    maxLeafLifetimeMilliseconds,
  );
  const approvers = input.approvers.map((entry): AsoiafAnswerTransportApprover => {
    const key = publicKeyObject(entry.publicKey);
    assertKeyStrength(key);
    return {
      approverId: requireIdentity(entry.approverId, "approver identity"),
      role: requireApprovalRole(entry.role),
      publicKeyFingerprint: publicKeyFingerprint(key),
      publicKeySpkiBase64: publicKeySpki(key).toString("base64"),
      publicKeyType: keyType(key),
    };
  }).sort((left, right) =>
    left.approverId.localeCompare(right.approverId)
    || left.publicKeyFingerprint.localeCompare(right.publicKeyFingerprint));
  if (new Set(approvers.map((entry) => entry.approverId)).size !== approvers.length) {
    throw new Error("issuer policy approver identities must be unique");
  }
  if (new Set(approvers.map((entry) => entry.publicKeyFingerprint)).size !== approvers.length) {
    throw new Error("issuer policy approver public keys must be unique");
  }
  const approvalThreshold = requirePositiveInteger(
    input.approvalThreshold,
    "approval threshold",
    1,
    approvers.length,
  );
  const emergencyApprovalThreshold = requirePositiveInteger(
    input.emergencyApprovalThreshold,
    "emergency approval threshold",
    approvalThreshold,
    approvers.length,
  );
  const requiredApprovalRoles = sortedUnique(
    input.requiredApprovalRoles.map(requireApprovalRole),
  ) as AsoiafAnswerTransportApprovalRole[];
  const emergencyRequiredApprovalRoles = sortedUnique(
    input.emergencyRequiredApprovalRoles.map(requireApprovalRole),
  ) as AsoiafAnswerTransportApprovalRole[];
  const availableRoles = new Set(approvers.map((entry) => entry.role));
  for (const role of [...requiredApprovalRoles, ...emergencyRequiredApprovalRoles]) {
    if (!availableRoles.has(role)) {
      throw new Error(`issuer policy requires approval role ${role} without a registered approver`);
    }
  }
  const core = {
    format: ASOIAF_ANSWER_TRANSPORT_ISSUER_POLICY_FORMAT,
    issuerId: requireIdentity(input.issuerId, "issuer identity"),
    issuerCertificateFingerprint: issuer.certificateFingerprint,
    issuerPublicKeyFingerprint: issuer.publicKeyFingerprint,
    issuerSubject: issuer.certificate.subject,
    issuerValidFrom: issuer.certificate.validFromDate.toISOString(),
    issuerValidUntil: issuer.certificate.validToDate.toISOString(),
    allowedUsages,
    allowedActorRoles,
    allowedPrincipalPrefixes,
    allowedKeyCustodyClasses,
    allowExportablePrivateKeys: input.allowExportablePrivateKeys,
    maxLeafLifetimeMilliseconds,
    maxRequestLifetimeMilliseconds,
    maxOrderLifetimeMilliseconds,
    minimumRenewalOverlapMilliseconds,
    approvalThreshold,
    emergencyApprovalThreshold,
    requiredApprovalRoles,
    emergencyRequiredApprovalRoles,
    approvers,
    createdAt,
    operatorId: requireIdentity(input.operatorId, "issuer policy operator identity"),
    issuerCertificateRetained: false as const,
    privateKeyRetained: false as const,
    privateKeyPathRetained: false as const,
    issuanceAuthority: "policy-only" as const,
    ...NO_TASK_AUTHORITY,
  };
  const policyFingerprint = sha256(core);
  const policy: AsoiafAnswerTransportIssuerPolicy = {
    ...core,
    policyId: collectorContentId("asoiaf-answer-transport-issuer-policy", {
      issuerId: core.issuerId,
      issuerCertificateFingerprint: core.issuerCertificateFingerprint,
      policyFingerprint,
    }),
    policyFingerprint,
  };
  const target = digestPath(
    asoiafAnswerTransportEnrollmentPaths(input.root).policies,
    policy.policyFingerprint,
  );
  const persisted = writeExact(target, policy);
  return {
    policy: persisted.value,
    policyUri: relativeUri(input.root, target),
    replayed: persisted.replayed,
  };
}

function findById<T>(
  values: readonly T[],
  readId: (entry: T) => string,
  id: string,
  label: string,
): T {
  const matches = values.filter((entry) => readId(entry) === id);
  if (matches.length !== 1) throw new Error(`${label} ${id} is absent or duplicated`);
  return matches[0]!;
}

export function readAsoiafAnswerTransportEnrollmentStatus(
  root: string,
): AsoiafAnswerTransportEnrollmentStatus {
  const paths = asoiafAnswerTransportEnrollmentPaths(root);
  return {
    format: "axm-asoiaf-answer-transport-enrollment-status/1",
    paths,
    policies: listJson<AsoiafAnswerTransportIssuerPolicy>(paths.policies)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    requests: listJson<AsoiafAnswerTransportEnrollmentRequest>(paths.requests)
      .sort((left, right) => left.proofStatement.createdAt.localeCompare(right.proofStatement.createdAt)),
    approvals: listJson<AsoiafAnswerTransportEnrollmentApproval>(paths.approvals)
      .sort((left, right) => left.statement.decidedAt.localeCompare(right.statement.decidedAt)),
    orders: listJson<AsoiafAnswerTransportIssuanceOrder>(paths.orders)
      .sort((left, right) => left.orderedAt.localeCompare(right.orderedAt)),
    issuances: listJson<AsoiafAnswerTransportIssuanceReceipt>(paths.issuances)
      .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt)),
    admissionLinks: listJson<AsoiafAnswerTransportAdmissionLink>(paths.admissionLinks)
      .sort((left, right) => left.linkedAt.localeCompare(right.linkedAt)),
  };
}

function policyById(root: string, policyId: string): AsoiafAnswerTransportIssuerPolicy {
  return findById(
    readAsoiafAnswerTransportEnrollmentStatus(root).policies,
    (entry) => entry.policyId,
    policyId,
    "issuer policy",
  );
}

function requestById(root: string, requestId: string): AsoiafAnswerTransportEnrollmentRequest {
  return findById(
    readAsoiafAnswerTransportEnrollmentStatus(root).requests,
    (entry) => entry.requestId,
    requestId,
    "enrollment request",
  );
}

function orderById(root: string, orderId: string): AsoiafAnswerTransportIssuanceOrder {
  return findById(
    readAsoiafAnswerTransportEnrollmentStatus(root).orders,
    (entry) => entry.orderId,
    orderId,
    "issuance order",
  );
}

function issuanceById(root: string, issuanceId: string): AsoiafAnswerTransportIssuanceReceipt {
  return findById(
    readAsoiafAnswerTransportEnrollmentStatus(root).issuances,
    (entry) => entry.issuanceId,
    issuanceId,
    "issuance receipt",
  );
}

function assertPolicyAllowsRequest(
  policy: AsoiafAnswerTransportIssuerPolicy,
  statement: AsoiafAnswerTransportProofStatement,
): void {
  if (!policy.allowedUsages.includes(statement.usage)) {
    throw new Error(`issuer policy does not allow ${statement.usage}`);
  }
  if (!policy.allowedPrincipalPrefixes.some((prefix) => statement.principalId.startsWith(prefix))) {
    throw new Error("enrollment principal is outside issuer policy prefixes");
  }
  if (statement.usage === "client-auth") {
    if (
      !statement.actorRole
      || requireActorRole(statement.actorRole) !== statement.actorRole
      || !policy.allowedActorRoles.includes(statement.actorRole)
    ) {
      throw new Error("enrollment actor role is outside issuer policy");
    }
  } else if (statement.actorRole !== null) {
    throw new Error("server-auth enrollment cannot carry an answer-work actor role");
  }
  if (!policy.allowedKeyCustodyClasses.includes(statement.custody.custodyClass)) {
    throw new Error("enrollment key custody class is outside issuer policy");
  }
  if (statement.custody.privateKeyExportable && !policy.allowExportablePrivateKeys) {
    throw new Error("issuer policy forbids exportable private keys");
  }
  const leafLifetime = Date.parse(statement.requestedValidUntil)
    - Date.parse(statement.requestedValidFrom);
  if (leafLifetime <= 0 || leafLifetime > policy.maxLeafLifetimeMilliseconds) {
    throw new Error("requested certificate lifetime exceeds issuer policy");
  }
  if (
    Date.parse(statement.activateAt) < Date.parse(statement.requestedValidFrom)
    || Date.parse(statement.renewAfter) <= Date.parse(statement.activateAt)
    || Date.parse(statement.retireAfter) <= Date.parse(statement.renewAfter)
    || Date.parse(statement.retireAfter) > Date.parse(statement.requestedValidUntil)
  ) {
    throw new Error("requested certificate operating schedule is invalid");
  }
  if (statement.mode === "initial" && statement.predecessorCertificateFingerprint !== null) {
    throw new Error("initial enrollment cannot name a predecessor certificate");
  }
  if (statement.mode !== "initial" && !statement.predecessorCertificateFingerprint) {
    throw new Error(`${statement.mode} enrollment requires a predecessor certificate`);
  }
  if (
    statement.mode === "renewal"
    && Date.parse(statement.retireAfter) - Date.parse(statement.activateAt)
      < policy.minimumRenewalOverlapMilliseconds
  ) {
    throw new Error("renewal enrollment does not provide the policy overlap interval");
  }
}

export function buildAsoiafAnswerTransportProofStatement(input: {
  policy: AsoiafAnswerTransportIssuerPolicy;
  principalId: string;
  usage: AsoiafAnswerTransportCertificateUsage;
  actorRole?: AsoiafAnswerExchangeActorRole | null;
  mode: AsoiafAnswerTransportEnrollmentMode;
  publicKey: string | Buffer | crypto.KeyObject;
  requestedSubject: string;
  requestedSubjectAltNames?: string[];
  requestedValidFrom: string;
  requestedValidUntil: string;
  activateAt: string;
  renewAfter: string;
  retireAfter: string;
  predecessorCertificateFingerprint?: string | null;
  custody: Omit<
    AsoiafAnswerTransportKeyCustodyAttestation,
    "privateKeyRetained" | "rawKeyReferenceRetained"
  >;
  nonce: string;
  createdAt: string;
  expiresAt: string;
  requesterId: string;
}): AsoiafAnswerTransportProofStatement {
  const key = publicKeyObject(input.publicKey);
  assertKeyStrength(key);
  const createdAt = requireTime(input.createdAt, "enrollment request creation time");
  const expiresAt = requireTime(input.expiresAt, "enrollment request expiry time");
  if (
    Date.parse(expiresAt) <= Date.parse(createdAt)
    || Date.parse(expiresAt) - Date.parse(createdAt)
      > input.policy.maxRequestLifetimeMilliseconds
  ) {
    throw new Error("enrollment request expiry is outside issuer policy");
  }
  if (input.nonce.length < MIN_PROOF_NONCE_CHARACTERS) {
    throw new Error(`proof nonce must contain at least ${MIN_PROOF_NONCE_CHARACTERS} characters`);
  }
  const custody: AsoiafAnswerTransportKeyCustodyAttestation = {
    custodyClass: requireCustodyClass(input.custody.custodyClass),
    providerId: requireIdentity(input.custody.providerId, "key custody provider identity"),
    keyReferenceDigest: requireSha256(input.custody.keyReferenceDigest, "key-reference digest"),
    attestationDigest: requireSha256(input.custody.attestationDigest, "key attestation digest"),
    attestationUri: input.custody.attestationUri?.trim() || null,
    privateKeyExportable: input.custody.privateKeyExportable,
    privateKeyRetained: false,
    rawKeyReferenceRetained: false,
  };
  const statement: AsoiafAnswerTransportProofStatement = {
    format: ASOIAF_ANSWER_TRANSPORT_PROOF_STATEMENT_FORMAT,
    policyId: input.policy.policyId,
    policyFingerprint: input.policy.policyFingerprint,
    principalId: requireIdentity(input.principalId, "enrollment principal identity"),
    usage: requireUsage(input.usage),
    actorRole: input.usage === "client-auth"
      ? input.actorRole ? requireActorRole(input.actorRole) : null
      : null,
    mode: requireMode(input.mode),
    publicKeyFingerprint: publicKeyFingerprint(key),
    requestedSubject: requireIdentity(input.requestedSubject, "requested certificate subject"),
    requestedSubjectAltNames: normalizeSubjectAltNames(input.requestedSubjectAltNames ?? []),
    requestedValidFrom: requireTime(input.requestedValidFrom, "requested certificate valid-from"),
    requestedValidUntil: requireTime(input.requestedValidUntil, "requested certificate valid-until"),
    activateAt: requireTime(input.activateAt, "requested activation time"),
    renewAfter: requireTime(input.renewAfter, "requested renewal time"),
    retireAfter: requireTime(input.retireAfter, "requested retirement time"),
    predecessorCertificateFingerprint: input.predecessorCertificateFingerprint
      ? requireSha256(input.predecessorCertificateFingerprint, "predecessor certificate fingerprint")
      : null,
    custody,
    nonceDigest: sha256(input.nonce),
    createdAt,
    expiresAt,
    requesterId: requireIdentity(input.requesterId, "enrollment requester identity"),
  };
  assertPolicyAllowsRequest(input.policy, statement);
  return statement;
}

export function submitAsoiafAnswerTransportEnrollmentRequest(
  input: AsoiafAnswerTransportEnrollmentRequestInput,
): {
  request: AsoiafAnswerTransportEnrollmentRequest;
  requestUri: string;
  replayed: boolean;
} {
  const policy = policyById(input.root, input.policyId);
  const key = publicKeyObject(input.publicKey);
  assertKeyStrength(key);
  if (expectedProofAlgorithm(key) !== input.proofAlgorithm) {
    throw new Error("proof algorithm does not match enrollment public key");
  }
  const proofStatement = buildAsoiafAnswerTransportProofStatement({
    policy,
    principalId: input.principalId,
    usage: input.usage,
    actorRole: input.actorRole,
    mode: input.mode,
    publicKey: key,
    requestedSubject: input.requestedSubject,
    requestedSubjectAltNames: input.requestedSubjectAltNames,
    requestedValidFrom: input.requestedValidFrom,
    requestedValidUntil: input.requestedValidUntil,
    activateAt: input.activateAt,
    renewAfter: input.renewAfter,
    retireAfter: input.retireAfter,
    predecessorCertificateFingerprint: input.predecessorCertificateFingerprint,
    custody: input.custody,
    nonce: input.nonce,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    requesterId: input.requesterId,
  });
  const signature = signatureBuffer(input.proofSignature);
  if (!verifySignature({
    key,
    algorithm: input.proofAlgorithm,
    message: stableBytes(proofStatement),
    signature,
  })) {
    throw new Error("enrollment proof-of-possession signature is invalid");
  }
  const core = {
    format: ASOIAF_ANSWER_TRANSPORT_ENROLLMENT_REQUEST_FORMAT,
    proofStatement,
    publicKeySpkiBase64: publicKeySpki(key).toString("base64"),
    publicKeyType: keyType(key),
    proofAlgorithm: input.proofAlgorithm,
    proofSignatureBase64: signature.toString("base64"),
    proofSignatureDigest: bytesDigest(signature),
    proofVerified: true as const,
    publicKeyRetained: true as const,
    privateKeyRetained: false as const,
    privateKeyPathRetained: false as const,
    requestAuthority: "none" as const,
    ...NO_TASK_AUTHORITY,
  };
  const requestFingerprint = sha256(core);
  const request: AsoiafAnswerTransportEnrollmentRequest = {
    ...core,
    requestId: collectorContentId("asoiaf-answer-transport-enrollment-request", {
      policyId: policy.policyId,
      principalId: proofStatement.principalId,
      publicKeyFingerprint: proofStatement.publicKeyFingerprint,
      requestFingerprint,
    }),
    requestFingerprint,
  };
  const target = digestPath(
    asoiafAnswerTransportEnrollmentPaths(input.root).requests,
    request.requestFingerprint,
  );
  const persisted = writeExact(target, request);
  return {
    request: persisted.value,
    requestUri: relativeUri(input.root, target),
    replayed: persisted.replayed,
  };
}

export function buildAsoiafAnswerTransportApprovalStatement(input: {
  policy: AsoiafAnswerTransportIssuerPolicy;
  request: AsoiafAnswerTransportEnrollmentRequest;
  approverId: string;
  decision: AsoiafAnswerTransportApprovalDecision;
  decidedAt: string;
  reason: string;
}): AsoiafAnswerTransportApprovalStatement {
  const approver = input.policy.approvers.find(
    (entry) => entry.approverId === input.approverId,
  );
  if (!approver) throw new Error(`approver ${input.approverId} is not registered by the issuer policy`);
  if (input.decision !== "approve" && input.decision !== "reject") {
    throw new Error("enrollment approval decision is invalid");
  }
  const decidedAt = requireTime(input.decidedAt, "enrollment approval time");
  if (
    Date.parse(decidedAt) < Date.parse(input.request.proofStatement.createdAt)
    || Date.parse(decidedAt) > Date.parse(input.request.proofStatement.expiresAt)
  ) {
    throw new Error("enrollment approval time is outside the request interval");
  }
  return {
    format: ASOIAF_ANSWER_TRANSPORT_APPROVAL_STATEMENT_FORMAT,
    policyId: input.policy.policyId,
    policyFingerprint: input.policy.policyFingerprint,
    requestId: input.request.requestId,
    requestFingerprint: input.request.requestFingerprint,
    approverId: approver.approverId,
    approverRole: approver.role,
    decision: input.decision,
    decidedAt,
    reasonDigest: sha256(requireReason(input.reason, "enrollment approval reason")),
  };
}

export function retainAsoiafAnswerTransportEnrollmentApproval(input: {
  root: string;
  requestId: string;
  approverId: string;
  decision: AsoiafAnswerTransportApprovalDecision;
  decidedAt: string;
  reason: string;
  signatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  signature: string | Buffer;
}): {
  approval: AsoiafAnswerTransportEnrollmentApproval;
  approvalUri: string;
  replayed: boolean;
} {
  const request = requestById(input.root, input.requestId);
  const policy = policyById(input.root, request.proofStatement.policyId);
  const approver = policy.approvers.find((entry) => entry.approverId === input.approverId);
  if (!approver) throw new Error(`approver ${input.approverId} is not registered by the issuer policy`);
  const statement = buildAsoiafAnswerTransportApprovalStatement({
    policy,
    request,
    approverId: input.approverId,
    decision: input.decision,
    decidedAt: input.decidedAt,
    reason: input.reason,
  });
  const key = crypto.createPublicKey({
    key: Buffer.from(approver.publicKeySpkiBase64, "base64"),
    format: "der",
    type: "spki",
  });
  const signature = signatureBuffer(input.signature);
  if (!verifySignature({
    key,
    algorithm: input.signatureAlgorithm,
    message: stableBytes(statement),
    signature,
  })) {
    throw new Error("enrollment approval signature is invalid");
  }
  const core = {
    format: ASOIAF_ANSWER_TRANSPORT_ENROLLMENT_APPROVAL_FORMAT,
    statement,
    reason: requireReason(input.reason, "enrollment approval reason"),
    signatureAlgorithm: input.signatureAlgorithm,
    signatureBase64: signature.toString("base64"),
    signatureDigest: bytesDigest(signature),
    signatureVerified: true as const,
    approvalAuthority: "approve-enrollment-only" as const,
    ...NO_TASK_AUTHORITY,
  };
  const approvalFingerprint = sha256(core);
  const approval: AsoiafAnswerTransportEnrollmentApproval = {
    ...core,
    approvalId: collectorContentId("asoiaf-answer-transport-enrollment-approval", {
      requestId: request.requestId,
      approverId: approver.approverId,
      decision: input.decision,
      approvalFingerprint,
    }),
    approvalFingerprint,
  };
  const existingForApprover = readAsoiafAnswerTransportEnrollmentStatus(input.root).approvals
    .filter(
      (entry) =>
        entry.statement.requestId === request.requestId
        && entry.statement.approverId === approver.approverId,
    );
  if (
    existingForApprover.length > 0
    && !existingForApprover.some((entry) => entry.approvalFingerprint === approval.approvalFingerprint)
  ) {
    throw new Error("approver already submitted a different terminal enrollment decision");
  }
  const target = digestPath(
    asoiafAnswerTransportEnrollmentPaths(input.root).approvals,
    approval.approvalFingerprint,
  );
  const persisted = writeExact(target, approval);
  return {
    approval: persisted.value,
    approvalUri: relativeUri(input.root, target),
    replayed: persisted.replayed,
  };
}

function approvalsForRequest(
  status: AsoiafAnswerTransportEnrollmentStatus,
  requestId: string,
): AsoiafAnswerTransportEnrollmentApproval[] {
  return status.approvals.filter((entry) => entry.statement.requestId === requestId);
}

function approvalRequirements(
  policy: AsoiafAnswerTransportIssuerPolicy,
  request: AsoiafAnswerTransportEnrollmentRequest,
): {
  threshold: number;
  requiredRoles: AsoiafAnswerTransportApprovalRole[];
} {
  return request.proofStatement.mode === "emergency-recovery"
    ? {
        threshold: policy.emergencyApprovalThreshold,
        requiredRoles: policy.emergencyRequiredApprovalRoles,
      }
    : {
        threshold: policy.approvalThreshold,
        requiredRoles: policy.requiredApprovalRoles,
      };
}

function approvedEnrollmentDecisions(input: {
  policy: AsoiafAnswerTransportIssuerPolicy;
  request: AsoiafAnswerTransportEnrollmentRequest;
  approvals: readonly AsoiafAnswerTransportEnrollmentApproval[];
}): AsoiafAnswerTransportEnrollmentApproval[] {
  const approverIds = input.approvals.map((entry) => entry.statement.approverId);
  if (new Set(approverIds).size !== approverIds.length) {
    throw new Error("enrollment request has duplicate approver decisions");
  }
  if (input.approvals.some((entry) => entry.statement.decision === "reject")) {
    throw new Error("enrollment request has a retained rejection");
  }
  const approved = input.approvals
    .filter((entry) => entry.statement.decision === "approve")
    .sort((left, right) =>
      left.statement.approverId.localeCompare(right.statement.approverId));
  const { threshold, requiredRoles } = approvalRequirements(
    input.policy,
    input.request,
  );
  if (new Set(approved.map((entry) => entry.statement.approverId)).size < threshold) {
    throw new Error(`enrollment request requires ${threshold} distinct approvals`);
  }
  const approvedRoles = new Set(approved.map((entry) => entry.statement.approverRole));
  for (const role of requiredRoles) {
    if (!approvedRoles.has(role)) {
      throw new Error(`enrollment request lacks required approval role ${role}`);
    }
  }
  return approved;
}

function issuanceProfileForRequest(
  request: AsoiafAnswerTransportEnrollmentRequest,
): AsoiafAnswerTransportIssuanceProfile {
  return {
    usage: request.proofStatement.usage,
    principalId: request.proofStatement.principalId,
    actorRole: request.proofStatement.actorRole,
    publicKeyFingerprint: request.proofStatement.publicKeyFingerprint,
    requestedSubject: request.proofStatement.requestedSubject,
    requestedSubjectAltNames: [...request.proofStatement.requestedSubjectAltNames],
    requestedValidFrom: request.proofStatement.requestedValidFrom,
    requestedValidUntil: request.proofStatement.requestedValidUntil,
    activateAt: request.proofStatement.activateAt,
    renewAfter: request.proofStatement.renewAfter,
    retireAfter: request.proofStatement.retireAfter,
    predecessorCertificateFingerprint:
      request.proofStatement.predecessorCertificateFingerprint,
    custody: request.proofStatement.custody,
  };
}

export function compileAsoiafAnswerTransportIssuanceOrder(input: {
  root: string;
  requestId: string;
  orderedAt: string;
  expiresAt: string;
  operatorId: string;
}): {
  order: AsoiafAnswerTransportIssuanceOrder;
  orderUri: string;
  replayed: boolean;
} {
  const request = requestById(input.root, input.requestId);
  const policy = policyById(input.root, request.proofStatement.policyId);
  const status = readAsoiafAnswerTransportEnrollmentStatus(input.root);
  const approvals = approvalsForRequest(status, request.requestId);
  const approved = approvedEnrollmentDecisions({ policy, request, approvals });
  const orderedAt = requireTime(input.orderedAt, "issuance order time");
  const expiresAt = requireTime(input.expiresAt, "issuance order expiry time");
  if (approved.some((entry) => Date.parse(entry.statement.decidedAt) > Date.parse(orderedAt))) {
    throw new Error("issuance order precedes one or more retained approvals");
  }
  if (
    Date.parse(orderedAt) < Date.parse(request.proofStatement.createdAt)
    || Date.parse(orderedAt) > Date.parse(request.proofStatement.expiresAt)
    || Date.parse(expiresAt) <= Date.parse(orderedAt)
    || Date.parse(expiresAt) > Date.parse(request.proofStatement.expiresAt)
    || Date.parse(expiresAt) - Date.parse(orderedAt) > policy.maxOrderLifetimeMilliseconds
  ) {
    throw new Error("issuance order interval is outside request or policy custody");
  }
  const orderedApprovals = approved;
  const profile = issuanceProfileForRequest(request);
  const core = {
    format: ASOIAF_ANSWER_TRANSPORT_ISSUANCE_ORDER_FORMAT,
    policyId: policy.policyId,
    policyFingerprint: policy.policyFingerprint,
    requestId: request.requestId,
    requestFingerprint: request.requestFingerprint,
    approvalIds: orderedApprovals.map((entry) => entry.approvalId),
    approvalFingerprints: orderedApprovals.map((entry) => entry.approvalFingerprint),
    approvalRoles: sortedUnique(
      orderedApprovals.map((entry) => entry.statement.approverRole),
    ) as AsoiafAnswerTransportApprovalRole[],
    issuanceProfile: profile,
    orderedAt,
    expiresAt,
    operatorId: requireIdentity(input.operatorId, "issuance order operator identity"),
    issuerCertificateFingerprint: policy.issuerCertificateFingerprint,
    issuerPublicKeyFingerprint: policy.issuerPublicKeyFingerprint,
    issuanceAuthority: "authorize-one-leaf" as const,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    ...NO_TASK_AUTHORITY,
  };
  const orderFingerprint = sha256(core);
  const order: AsoiafAnswerTransportIssuanceOrder = {
    ...core,
    orderId: collectorContentId("asoiaf-answer-transport-issuance-order", {
      requestId: request.requestId,
      issuerCertificateFingerprint: policy.issuerCertificateFingerprint,
      orderFingerprint,
    }),
    orderFingerprint,
  };
  const existing = status.orders.filter((entry) => entry.requestId === request.requestId);
  if (
    existing.length > 0
    && !existing.some((entry) => entry.orderFingerprint === order.orderFingerprint)
  ) {
    throw new Error("enrollment request already has a different issuance order");
  }
  const target = digestPath(
    asoiafAnswerTransportEnrollmentPaths(input.root).orders,
    order.orderFingerprint,
  );
  const persisted = writeExact(target, order);
  return {
    order: persisted.value,
    orderUri: relativeUri(input.root, target),
    replayed: persisted.replayed,
  };
}

function certificateMetadata(input: {
  certificate: string | Buffer;
  issuerCertificate: string | Buffer;
  order: AsoiafAnswerTransportIssuanceOrder;
  recordedAt: string;
}): AsoiafAnswerTransportCertificateMetadata {
  const certificate = parseCertificate(input.certificate);
  const issuer = parseCertificate(input.issuerCertificate);
  if (!issuer.ca) throw new Error("issuance receipt issuer is not a certificate authority");
  if (!certificate.checkIssued(issuer) || !certificate.verify(issuer.publicKey)) {
    throw new Error("issued certificate is not signed by the ordered issuer");
  }
  if (certificate.ca) throw new Error("issued transport certificate cannot be a certificate authority");
  assertKeyStrength(certificate.publicKey);
  const issuerFingerprint = bytesDigest(issuer.raw);
  if (issuerFingerprint !== input.order.issuerCertificateFingerprint) {
    throw new Error("issued certificate authority differs from the issuance order");
  }
  const publicFingerprint = publicKeyFingerprint(certificate.publicKey);
  if (publicFingerprint !== input.order.issuanceProfile.publicKeyFingerprint) {
    throw new Error("issued certificate public key differs from the enrollment request");
  }
  if (certificate.subject !== input.order.issuanceProfile.requestedSubject) {
    throw new Error("issued certificate subject differs from the issuance order");
  }
  const subjectAltNames = parseSubjectAltNames(certificate.subjectAltName);
  if (
    stableJson(subjectAltNames)
    !== stableJson(input.order.issuanceProfile.requestedSubjectAltNames)
  ) {
    throw new Error("issued certificate subject alternatives differ from the issuance order");
  }
  const validFrom = certificate.validFromDate.toISOString();
  const validUntil = certificate.validToDate.toISOString();
  if (
    Date.parse(validFrom) < Date.parse(input.order.issuanceProfile.requestedValidFrom)
    || Date.parse(validUntil) > Date.parse(input.order.issuanceProfile.requestedValidUntil)
  ) {
    throw new Error("issued certificate validity exceeds the issuance order bounds");
  }
  if (
    Date.parse(input.order.issuanceProfile.activateAt) < Date.parse(validFrom)
    || Date.parse(input.order.issuanceProfile.retireAfter) > Date.parse(validUntil)
  ) {
    throw new Error("issued certificate does not contain the ordered operating schedule");
  }
  if (
    Date.parse(input.recordedAt) < Date.parse(input.order.orderedAt)
    || Date.parse(input.recordedAt) > Date.parse(input.order.expiresAt)
  ) {
    throw new Error("issued certificate recording time is outside the issuance order");
  }
  const requiredUsage = input.order.issuanceProfile.usage === "client-auth"
    ? CLIENT_AUTH_OID
    : SERVER_AUTH_OID;
  const extendedKeyUsageOids = [...(certificate.keyUsage ?? [])].sort();
  if (!extendedKeyUsageOids.includes(requiredUsage)) {
    throw new Error(`issued certificate lacks required extended key usage ${requiredUsage}`);
  }
  return {
    certificateFingerprint: bytesDigest(certificate.raw),
    publicKeyFingerprint: publicFingerprint,
    issuerCertificateFingerprint: issuerFingerprint,
    serialNumber: certificate.serialNumber.toLowerCase(),
    subject: certificate.subject,
    subjectAltNames,
    issuer: certificate.issuer,
    validFrom,
    validUntil,
    extendedKeyUsageOids,
  };
}

export function recordAsoiafAnswerTransportIssuedCertificate(input: {
  root: string;
  orderId: string;
  certificate: string | Buffer;
  issuerCertificate: string | Buffer;
  issuedAt: string;
  recordedAt: string;
  operatorId: string;
}): {
  issuance: AsoiafAnswerTransportIssuanceReceipt;
  issuanceUri: string;
  replayed: boolean;
} {
  const order = orderById(input.root, input.orderId);
  const request = requestById(input.root, order.requestId);
  const policy = policyById(input.root, order.policyId);
  const issuedAt = requireTime(input.issuedAt, "certificate issuance time");
  const recordedAt = requireTime(input.recordedAt, "certificate recording time");
  if (
    Date.parse(issuedAt) < Date.parse(order.orderedAt)
    || Date.parse(issuedAt) > Date.parse(order.expiresAt)
    || Date.parse(recordedAt) < Date.parse(issuedAt)
  ) {
    throw new Error("certificate issuance or recording time is outside the issuance order");
  }
  const metadata = certificateMetadata({
    certificate: input.certificate,
    issuerCertificate: input.issuerCertificate,
    order,
    recordedAt,
  });
  const instruction: AsoiafAnswerTransportAdmissionInstruction = {
    usage: order.issuanceProfile.usage,
    principalId: order.issuanceProfile.principalId,
    actorRole: order.issuanceProfile.actorRole,
    certificateFingerprint: metadata.certificateFingerprint,
    issuerCertificateFingerprint: metadata.issuerCertificateFingerprint,
    publicKeyFingerprint: metadata.publicKeyFingerprint,
    admittedAt: recordedAt,
    activateAt: order.issuanceProfile.activateAt,
    renewAfter: order.issuanceProfile.renewAfter,
    retireAfter: order.issuanceProfile.retireAfter,
    predecessorCertificateFingerprint:
      order.issuanceProfile.predecessorCertificateFingerprint,
    keyCustodyClass: order.issuanceProfile.custody.custodyClass,
    keyReferenceDigest: order.issuanceProfile.custody.keyReferenceDigest,
    privateKeyExportable: order.issuanceProfile.custody.privateKeyExportable,
    reason:
      `The quorum-approved issuance order ${order.orderId} authorizes this exact leaf for later runtime admission only.`,
    operatorId: requireIdentity(input.operatorId, "issuance receipt operator identity"),
  };
  const core = {
    format: ASOIAF_ANSWER_TRANSPORT_ISSUANCE_RECEIPT_FORMAT,
    policyId: policy.policyId,
    policyFingerprint: policy.policyFingerprint,
    requestId: request.requestId,
    requestFingerprint: request.requestFingerprint,
    orderId: order.orderId,
    orderFingerprint: order.orderFingerprint,
    certificate: metadata,
    admissionInstruction: instruction,
    issuedAt,
    recordedAt,
    operatorId: instruction.operatorId,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    certificatePathRetained: false as const,
    privateKeyPathRetained: false as const,
    issuanceAuthority: "verified-issued-leaf" as const,
    ...NO_TASK_AUTHORITY,
  };
  const issuanceFingerprint = sha256(core);
  const issuance: AsoiafAnswerTransportIssuanceReceipt = {
    ...core,
    issuanceId: collectorContentId("asoiaf-answer-transport-issuance", {
      orderId: order.orderId,
      certificateFingerprint: metadata.certificateFingerprint,
      issuanceFingerprint,
    }),
    issuanceFingerprint,
  };
  const existing = readAsoiafAnswerTransportEnrollmentStatus(input.root).issuances
    .filter((entry) => entry.orderId === order.orderId);
  if (
    existing.length > 0
    && !existing.some((entry) => entry.issuanceFingerprint === issuance.issuanceFingerprint)
  ) {
    throw new Error("issuance order already produced a different certificate receipt");
  }
  const target = digestPath(
    asoiafAnswerTransportEnrollmentPaths(input.root).issuances,
    issuance.issuanceFingerprint,
  );
  const persisted = writeExact(target, issuance);
  return {
    issuance: persisted.value,
    issuanceUri: relativeUri(input.root, target),
    replayed: persisted.replayed,
  };
}

export function linkAsoiafAnswerTransportRuntimeAdmission(input: {
  root: string;
  issuanceId: string;
  admission: AsoiafAnswerTransportRuntimeAdmissionReference;
  linkedAt: string;
  operatorId: string;
}): {
  link: AsoiafAnswerTransportAdmissionLink;
  linkUri: string;
  replayed: boolean;
} {
  const issuance = issuanceById(input.root, input.issuanceId);
  const expected = issuance.admissionInstruction;
  const admission: AsoiafAnswerTransportRuntimeAdmissionReference = {
    admissionId: requireIdentity(input.admission.admissionId, "runtime admission identity"),
    admissionFingerprint: requireSha256(
      input.admission.admissionFingerprint,
      "runtime admission fingerprint",
    ),
    certificateFingerprint: requireSha256(
      input.admission.certificateFingerprint,
      "runtime admission certificate fingerprint",
    ),
    publicKeyFingerprint: requireSha256(
      input.admission.publicKeyFingerprint,
      "runtime admission public-key fingerprint",
    ),
    issuerCertificateFingerprint: requireSha256(
      input.admission.issuerCertificateFingerprint,
      "runtime admission issuer fingerprint",
    ),
    usage: requireUsage(input.admission.usage),
    principalId: requireIdentity(input.admission.principalId, "runtime admission principal"),
    actorRole: input.admission.actorRole === null
      ? null
      : requireActorRole(input.admission.actorRole),
    predecessorCertificateFingerprint: input.admission.predecessorCertificateFingerprint
      ? requireSha256(
          input.admission.predecessorCertificateFingerprint,
          "runtime admission predecessor fingerprint",
        )
      : null,
    admittedAt: requireTime(input.admission.admittedAt, "runtime admission time"),
  };
  if (
    admission.certificateFingerprint !== expected.certificateFingerprint
    || admission.publicKeyFingerprint !== expected.publicKeyFingerprint
    || admission.issuerCertificateFingerprint !== expected.issuerCertificateFingerprint
    || admission.usage !== expected.usage
    || admission.principalId !== expected.principalId
    || admission.actorRole !== expected.actorRole
    || admission.predecessorCertificateFingerprint
      !== expected.predecessorCertificateFingerprint
    || admission.admittedAt !== expected.admittedAt
  ) {
    throw new Error("runtime certificate admission differs from the verified issuance receipt");
  }
  const linkedAt = requireTime(input.linkedAt, "runtime admission link time");
  if (
    Date.parse(linkedAt) < Date.parse(issuance.recordedAt)
    || Date.parse(linkedAt) < Date.parse(admission.admittedAt)
  ) {
    throw new Error("runtime admission link precedes issuance or admission custody");
  }
  const core = {
    format: ASOIAF_ANSWER_TRANSPORT_ADMISSION_LINK_FORMAT,
    issuanceId: issuance.issuanceId,
    issuanceFingerprint: issuance.issuanceFingerprint,
    admission,
    linkedAt,
    operatorId: requireIdentity(input.operatorId, "runtime admission link operator"),
    admissionAuthority: "runtime-admission-reference-only" as const,
    ...NO_TASK_AUTHORITY,
  };
  const linkFingerprint = sha256(core);
  const link: AsoiafAnswerTransportAdmissionLink = {
    ...core,
    linkId: collectorContentId("asoiaf-answer-transport-admission-link", {
      issuanceId: issuance.issuanceId,
      admissionId: admission.admissionId,
      linkFingerprint,
    }),
    linkFingerprint,
  };
  const existing = readAsoiafAnswerTransportEnrollmentStatus(input.root).admissionLinks
    .filter((entry) => entry.issuanceId === issuance.issuanceId);
  if (
    existing.length > 0
    && !existing.some((entry) => entry.linkFingerprint === link.linkFingerprint)
  ) {
    throw new Error("issuance receipt already links to a different runtime admission");
  }
  const target = digestPath(
    asoiafAnswerTransportEnrollmentPaths(input.root).admissionLinks,
    link.linkFingerprint,
  );
  const persisted = writeExact(target, link);
  return {
    link: persisted.value,
    linkUri: relativeUri(input.root, target),
    replayed: persisted.replayed,
  };
}

function verifyPolicy(
  policy: AsoiafAnswerTransportIssuerPolicy,
): AsoiafAnswerTransportEnrollmentFinding[] {
  const findings: AsoiafAnswerTransportEnrollmentFinding[] = [];
  if (policy.format !== ASOIAF_ANSWER_TRANSPORT_ISSUER_POLICY_FORMAT) {
    findings.push(finding("enrollment-policy-format", "error", policy.policyId, "issuer policy format is invalid"));
  }
  if (policy.policyFingerprint !== sha256(issuerPolicyCore(policy))) {
    findings.push(finding("enrollment-policy-fingerprint", "error", policy.policyId, "issuer policy fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-transport-issuer-policy", {
    issuerId: policy.issuerId,
    issuerCertificateFingerprint: policy.issuerCertificateFingerprint,
    policyFingerprint: policy.policyFingerprint,
  });
  if (policy.policyId !== expectedId) {
    findings.push(finding("enrollment-policy-identity", "error", policy.policyId, "issuer policy identity is stale"));
  }
  try {
    requireIdentity(policy.issuerId, "issuer identity");
    requireSha256(policy.issuerCertificateFingerprint, "issuer certificate fingerprint");
    requireSha256(policy.issuerPublicKeyFingerprint, "issuer public-key fingerprint");
    requireTime(policy.issuerValidFrom, "issuer validity start");
    requireTime(policy.issuerValidUntil, "issuer validity end");
    requireTime(policy.createdAt, "issuer policy creation time");
    requireIdentity(policy.operatorId, "issuer policy operator identity");
    if (Date.parse(policy.issuerValidUntil) <= Date.parse(policy.issuerValidFrom)) {
      throw new Error("issuer validity interval is empty");
    }
    if (
      Date.parse(policy.createdAt) < Date.parse(policy.issuerValidFrom)
      || Date.parse(policy.createdAt) > Date.parse(policy.issuerValidUntil)
    ) {
      throw new Error("issuer policy creation time is outside issuer validity");
    }
    if (
      policy.allowedUsages.length === 0
      || new Set(policy.allowedUsages).size !== policy.allowedUsages.length
      || policy.allowedUsages.some((entry) => requireUsage(entry) !== entry)
    ) {
      throw new Error("issuer policy usage registry is empty or duplicated");
    }
    if (
      new Set(policy.allowedActorRoles).size !== policy.allowedActorRoles.length
      || policy.allowedActorRoles.some((entry) => requireActorRole(entry) !== entry)
      || new Set(policy.allowedPrincipalPrefixes).size !== policy.allowedPrincipalPrefixes.length
      || policy.allowedPrincipalPrefixes.length === 0
      || policy.allowedPrincipalPrefixes.some((entry) => !entry.trim())
    ) {
      throw new Error("issuer policy principal or role registry is empty or duplicated");
    }
    if (
      policy.allowedKeyCustodyClasses.length === 0
      || new Set(policy.allowedKeyCustodyClasses).size
        !== policy.allowedKeyCustodyClasses.length
      || policy.allowedKeyCustodyClasses.some(
        (entry) => requireCustodyClass(entry) !== entry,
      )
    ) {
      throw new Error("issuer policy key-custody registry is empty or duplicated");
    }
    requirePositiveInteger(
      policy.maxLeafLifetimeMilliseconds,
      "maximum leaf lifetime",
      60_000,
      MAX_RUNTIME_LEAF_LIFETIME,
    );
    requirePositiveInteger(
      policy.maxRequestLifetimeMilliseconds,
      "maximum request lifetime",
      60_000,
      30 * 24 * 60 * 60 * 1000,
    );
    requirePositiveInteger(
      policy.maxOrderLifetimeMilliseconds,
      "maximum order lifetime",
      60_000,
      policy.maxRequestLifetimeMilliseconds,
    );
    requirePositiveInteger(
      policy.minimumRenewalOverlapMilliseconds,
      "minimum renewal overlap",
      60_000,
      policy.maxLeafLifetimeMilliseconds,
    );
    if (
      policy.approvers.length === 0
      || new Set(policy.approvers.map((entry) => entry.approverId)).size
        !== policy.approvers.length
      || new Set(policy.approvers.map((entry) => entry.publicKeyFingerprint)).size
        !== policy.approvers.length
    ) {
      throw new Error("issuer policy approver registry is empty or duplicated");
    }
    requirePositiveInteger(
      policy.approvalThreshold,
      "approval threshold",
      1,
      policy.approvers.length,
    );
    requirePositiveInteger(
      policy.emergencyApprovalThreshold,
      "emergency approval threshold",
      policy.approvalThreshold,
      policy.approvers.length,
    );
    const approverRoles = new Set(policy.approvers.map((entry) => entry.role));
    for (const role of [
      ...policy.requiredApprovalRoles,
      ...policy.emergencyRequiredApprovalRoles,
    ]) {
      requireApprovalRole(role);
      if (!approverRoles.has(role)) {
        throw new Error(`issuer policy lacks approver role ${role}`);
      }
    }
    for (const approver of policy.approvers) {
      requireIdentity(approver.approverId, "approver identity");
      requireApprovalRole(approver.role);
      const key = crypto.createPublicKey({
        key: Buffer.from(approver.publicKeySpkiBase64, "base64"),
        format: "der",
        type: "spki",
      });
      assertKeyStrength(key);
      if (
        publicKeyFingerprint(key) !== approver.publicKeyFingerprint
        || keyType(key) !== approver.publicKeyType
      ) {
        throw new Error(`approver ${approver.approverId} key custody is stale`);
      }
    }
  } catch (error) {
    findings.push(finding(
      "enrollment-policy-input",
      "error",
      policy.policyId,
      error instanceof Error ? error.message : String(error),
    ));
  }
  if (
    policy.issuerCertificateRetained !== false
    || policy.privateKeyRetained !== false
    || policy.privateKeyPathRetained !== false
    || policy.issuanceAuthority !== "policy-only"
    || policy.authority !== "none"
    || policy.graphEffect !== "none"
    || policy.canonEffect !== "none"
    || policy.answerEffect !== "none"
  ) {
    findings.push(finding("enrollment-policy-authority", "error", policy.policyId, "issuer policy retained secrets or acquired task authority"));
  }
  return sortedFindings(findings);
}

function verifyRequest(
  request: AsoiafAnswerTransportEnrollmentRequest,
  policy: AsoiafAnswerTransportIssuerPolicy,
): AsoiafAnswerTransportEnrollmentFinding[] {
  const findings: AsoiafAnswerTransportEnrollmentFinding[] = [];
  if (request.format !== ASOIAF_ANSWER_TRANSPORT_ENROLLMENT_REQUEST_FORMAT) {
    findings.push(finding("enrollment-request-format", "error", request.requestId, "enrollment request format is invalid"));
  }
  if (request.requestFingerprint !== sha256(enrollmentRequestCore(request))) {
    findings.push(finding("enrollment-request-fingerprint", "error", request.requestId, "enrollment request fingerprint is stale"));
  }
  try {
    assertPolicyAllowsRequest(policy, request.proofStatement);
    const key = crypto.createPublicKey({
      key: Buffer.from(request.publicKeySpkiBase64, "base64"),
      format: "der",
      type: "spki",
    });
    if (publicKeyFingerprint(key) !== request.proofStatement.publicKeyFingerprint) {
      throw new Error("retained public key differs from request fingerprint");
    }
    if (!verifySignature({
      key,
      algorithm: request.proofAlgorithm,
      message: stableBytes(request.proofStatement),
      signature: Buffer.from(request.proofSignatureBase64, "base64"),
    })) {
      throw new Error("retained proof-of-possession signature is invalid");
    }
  } catch (error) {
    findings.push(finding(
      "enrollment-request-proof",
      "error",
      request.requestId,
      error instanceof Error ? error.message : String(error),
    ));
  }
  if (
    request.proofVerified !== true
    || request.publicKeyRetained !== true
    || request.privateKeyRetained !== false
    || request.privateKeyPathRetained !== false
    || request.requestAuthority !== "none"
    || request.authority !== "none"
    || request.graphEffect !== "none"
    || request.canonEffect !== "none"
    || request.answerEffect !== "none"
  ) {
    findings.push(finding("enrollment-request-authority", "error", request.requestId, "enrollment request crossed its proof-only boundary"));
  }
  return findings;
}

function verifyApproval(
  approval: AsoiafAnswerTransportEnrollmentApproval,
  request: AsoiafAnswerTransportEnrollmentRequest,
  policy: AsoiafAnswerTransportIssuerPolicy,
): AsoiafAnswerTransportEnrollmentFinding[] {
  const findings: AsoiafAnswerTransportEnrollmentFinding[] = [];
  if (approval.format !== ASOIAF_ANSWER_TRANSPORT_ENROLLMENT_APPROVAL_FORMAT) {
    findings.push(finding("enrollment-approval-format", "error", approval.approvalId, "enrollment approval format is invalid"));
  }
  if (approval.statement.format !== ASOIAF_ANSWER_TRANSPORT_APPROVAL_STATEMENT_FORMAT) {
    findings.push(finding("enrollment-approval-statement-format", "error", approval.approvalId, "enrollment approval statement format is invalid"));
  }
  if (approval.approvalFingerprint !== sha256(approvalCore(approval))) {
    findings.push(finding("enrollment-approval-fingerprint", "error", approval.approvalId, "enrollment approval fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-transport-enrollment-approval", {
    requestId: approval.statement.requestId,
    approverId: approval.statement.approverId,
    decision: approval.statement.decision,
    approvalFingerprint: approval.approvalFingerprint,
  });
  if (approval.approvalId !== expectedId) {
    findings.push(finding("enrollment-approval-identity", "error", approval.approvalId, "enrollment approval identity is stale"));
  }
  const approver = policy.approvers.find(
    (entry) => entry.approverId === approval.statement.approverId,
  );
  if (!approver) {
    findings.push(finding("enrollment-approval-approver", "error", approval.approvalId, "approval references an absent policy approver"));
  } else {
    try {
      const key = crypto.createPublicKey({
        key: Buffer.from(approver.publicKeySpkiBase64, "base64"),
        format: "der",
        type: "spki",
      });
      if (
        approver.role !== approval.statement.approverRole
        || publicKeyFingerprint(key) !== approver.publicKeyFingerprint
        || keyType(key) !== approver.publicKeyType
      ) {
        throw new Error("approval approver role or key differs from issuer policy");
      }
      const signature = Buffer.from(approval.signatureBase64, "base64");
      if (!verifySignature({
        key,
        algorithm: approval.signatureAlgorithm,
        message: stableBytes(approval.statement),
        signature,
      })) {
        throw new Error("approval signature no longer verifies");
      }
      if (approval.signatureDigest !== bytesDigest(signature)) {
        throw new Error("approval signature digest is stale");
      }
    } catch (error) {
      findings.push(finding(
        "enrollment-approval-signature",
        "error",
        approval.approvalId,
        error instanceof Error ? error.message : String(error),
      ));
    }
  }
  if (
    approval.statement.requestId !== request.requestId
    || approval.statement.requestFingerprint !== request.requestFingerprint
    || approval.statement.policyId !== policy.policyId
    || approval.statement.policyFingerprint !== policy.policyFingerprint
  ) {
    findings.push(finding("enrollment-approval-custody", "error", approval.approvalId, "approval differs from request or policy custody"));
  }
  try {
    if (
      approval.statement.decision !== "approve"
      && approval.statement.decision !== "reject"
    ) {
      throw new Error("approval decision is invalid");
    }
    const decidedAt = requireTime(
      approval.statement.decidedAt,
      "enrollment approval time",
    );
    if (
      Date.parse(decidedAt) < Date.parse(request.proofStatement.createdAt)
      || Date.parse(decidedAt) > Date.parse(request.proofStatement.expiresAt)
    ) {
      throw new Error("approval time is outside the enrollment request interval");
    }
    if (approval.statement.reasonDigest !== sha256(approval.reason)) {
      throw new Error("approval reason digest is stale");
    }
    requireReason(approval.reason, "enrollment approval reason");
  } catch (error) {
    findings.push(finding(
      "enrollment-approval-input",
      "error",
      approval.approvalId,
      error instanceof Error ? error.message : String(error),
    ));
  }
  if (
    approval.signatureVerified !== true
    || approval.approvalAuthority !== "approve-enrollment-only"
    || approval.authority !== "none"
    || approval.graphEffect !== "none"
    || approval.canonEffect !== "none"
    || approval.answerEffect !== "none"
  ) {
    findings.push(finding("enrollment-approval-authority", "error", approval.approvalId, "approval crossed its enrollment-only boundary"));
  }
  return sortedFindings(findings);
}

function verifyOrder(
  order: AsoiafAnswerTransportIssuanceOrder,
  request: AsoiafAnswerTransportEnrollmentRequest,
  policy: AsoiafAnswerTransportIssuerPolicy,
  approvals: AsoiafAnswerTransportEnrollmentApproval[],
): AsoiafAnswerTransportEnrollmentFinding[] {
  const findings: AsoiafAnswerTransportEnrollmentFinding[] = [];
  if (order.format !== ASOIAF_ANSWER_TRANSPORT_ISSUANCE_ORDER_FORMAT) {
    findings.push(finding("enrollment-order-format", "error", order.orderId, "issuance order format is invalid"));
  }
  if (order.orderFingerprint !== sha256(orderCore(order))) {
    findings.push(finding("enrollment-order-fingerprint", "error", order.orderId, "issuance order fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-transport-issuance-order", {
    requestId: order.requestId,
    issuerCertificateFingerprint: order.issuerCertificateFingerprint,
    orderFingerprint: order.orderFingerprint,
  });
  if (order.orderId !== expectedId) {
    findings.push(finding("enrollment-order-identity", "error", order.orderId, "issuance order identity is stale"));
  }
  if (
    order.requestId !== request.requestId
    || order.requestFingerprint !== request.requestFingerprint
    || order.policyId !== policy.policyId
    || order.policyFingerprint !== policy.policyFingerprint
    || order.issuerCertificateFingerprint !== policy.issuerCertificateFingerprint
    || order.issuerPublicKeyFingerprint !== policy.issuerPublicKeyFingerprint
  ) {
    findings.push(finding("enrollment-order-custody", "error", order.orderId, "issuance order differs from request or policy custody"));
  }
  try {
    const orderedAt = requireTime(order.orderedAt, "issuance order time");
    const approvalsAtOrder = approvals.filter(
      (entry) => Date.parse(entry.statement.decidedAt) <= Date.parse(orderedAt),
    );
    const approved = approvedEnrollmentDecisions({
      policy,
      request,
      approvals: approvalsAtOrder,
    });
    const expectedIds = approved.map((entry) => entry.approvalId);
    const expectedFingerprints = approved.map((entry) => entry.approvalFingerprint);
    const expectedRoles = sortedUnique(
      approved.map((entry) => entry.statement.approverRole),
    );
    if (
      stableJson(order.approvalIds) !== stableJson(expectedIds)
      || stableJson(order.approvalFingerprints) !== stableJson(expectedFingerprints)
      || stableJson(order.approvalRoles) !== stableJson(expectedRoles)
    ) {
      throw new Error("issuance order approval quorum differs from retained approvals");
    }
    if (
      stableJson(order.issuanceProfile)
      !== stableJson(issuanceProfileForRequest(request))
    ) {
      throw new Error("issuance order profile differs from the enrollment request");
    }
    const expiresAt = requireTime(order.expiresAt, "issuance order expiry time");
    if (
      Date.parse(orderedAt) < Date.parse(request.proofStatement.createdAt)
      || Date.parse(orderedAt) > Date.parse(request.proofStatement.expiresAt)
      || Date.parse(expiresAt) <= Date.parse(orderedAt)
      || Date.parse(expiresAt) > Date.parse(request.proofStatement.expiresAt)
      || Date.parse(expiresAt) - Date.parse(orderedAt)
        > policy.maxOrderLifetimeMilliseconds
    ) {
      throw new Error("issuance order time interval or approval ordering is invalid");
    }
    requireIdentity(order.operatorId, "issuance order operator identity");
  } catch (error) {
    findings.push(finding(
      "enrollment-order-quorum",
      "error",
      order.orderId,
      error instanceof Error ? error.message : String(error),
    ));
  }
  if (
    order.issuanceAuthority !== "authorize-one-leaf"
    || order.certificateRetained !== false
    || order.privateKeyRetained !== false
    || order.authority !== "none"
    || order.graphEffect !== "none"
    || order.canonEffect !== "none"
    || order.answerEffect !== "none"
  ) {
    findings.push(finding("enrollment-order-authority", "error", order.orderId, "issuance order crossed its one-leaf authority boundary"));
  }
  return sortedFindings(findings);
}

function verifyIssuance(
  issuance: AsoiafAnswerTransportIssuanceReceipt,
  order: AsoiafAnswerTransportIssuanceOrder,
): AsoiafAnswerTransportEnrollmentFinding[] {
  const findings: AsoiafAnswerTransportEnrollmentFinding[] = [];
  if (issuance.format !== ASOIAF_ANSWER_TRANSPORT_ISSUANCE_RECEIPT_FORMAT) {
    findings.push(finding("enrollment-issuance-format", "error", issuance.issuanceId, "issuance receipt format is invalid"));
  }
  if (issuance.issuanceFingerprint !== sha256(issuanceCore(issuance))) {
    findings.push(finding("enrollment-issuance-fingerprint", "error", issuance.issuanceId, "issuance receipt fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-transport-issuance", {
    orderId: issuance.orderId,
    certificateFingerprint: issuance.certificate.certificateFingerprint,
    issuanceFingerprint: issuance.issuanceFingerprint,
  });
  if (issuance.issuanceId !== expectedId) {
    findings.push(finding("enrollment-issuance-identity", "error", issuance.issuanceId, "issuance receipt identity is stale"));
  }
  if (
    issuance.orderId !== order.orderId
    || issuance.orderFingerprint !== order.orderFingerprint
    || issuance.policyId !== order.policyId
    || issuance.policyFingerprint !== order.policyFingerprint
    || issuance.requestId !== order.requestId
    || issuance.requestFingerprint !== order.requestFingerprint
  ) {
    findings.push(finding("enrollment-issuance-custody", "error", issuance.issuanceId, "issuance receipt differs from its order"));
  }
  try {
    const certificate = issuance.certificate;
    requireSha256(certificate.certificateFingerprint, "issued certificate fingerprint");
    requireSha256(certificate.publicKeyFingerprint, "issued public-key fingerprint");
    requireSha256(
      certificate.issuerCertificateFingerprint,
      "issued certificate issuer fingerprint",
    );
    const validFrom = requireTime(certificate.validFrom, "issued validity start");
    const validUntil = requireTime(certificate.validUntil, "issued validity end");
    const issuedAt = requireTime(issuance.issuedAt, "certificate issuance time");
    const recordedAt = requireTime(issuance.recordedAt, "certificate recording time");
    const requiredUsage = order.issuanceProfile.usage === "client-auth"
      ? CLIENT_AUTH_OID
      : SERVER_AUTH_OID;
    if (
      certificate.publicKeyFingerprint !== order.issuanceProfile.publicKeyFingerprint
      || certificate.issuerCertificateFingerprint !== order.issuerCertificateFingerprint
      || certificate.subject !== order.issuanceProfile.requestedSubject
      || stableJson(certificate.subjectAltNames)
        !== stableJson(order.issuanceProfile.requestedSubjectAltNames)
      || !certificate.extendedKeyUsageOids.includes(requiredUsage)
      || Date.parse(validFrom) < Date.parse(order.issuanceProfile.requestedValidFrom)
      || Date.parse(validUntil) > Date.parse(order.issuanceProfile.requestedValidUntil)
      || Date.parse(order.issuanceProfile.activateAt) < Date.parse(validFrom)
      || Date.parse(order.issuanceProfile.retireAfter) > Date.parse(validUntil)
      || Date.parse(validUntil) <= Date.parse(validFrom)
      || Date.parse(issuedAt) < Date.parse(order.orderedAt)
      || Date.parse(issuedAt) > Date.parse(order.expiresAt)
      || Date.parse(recordedAt) < Date.parse(issuedAt)
      || Date.parse(recordedAt) > Date.parse(order.expiresAt)
    ) {
      throw new Error("issued certificate metadata or timing differs from the issuance order");
    }
    const instruction = issuance.admissionInstruction;
    if (
      instruction.usage !== order.issuanceProfile.usage
      || instruction.principalId !== order.issuanceProfile.principalId
      || instruction.actorRole !== order.issuanceProfile.actorRole
      || instruction.certificateFingerprint !== certificate.certificateFingerprint
      || instruction.issuerCertificateFingerprint
        !== certificate.issuerCertificateFingerprint
      || instruction.publicKeyFingerprint !== certificate.publicKeyFingerprint
      || instruction.admittedAt !== issuance.recordedAt
      || instruction.activateAt !== order.issuanceProfile.activateAt
      || instruction.renewAfter !== order.issuanceProfile.renewAfter
      || instruction.retireAfter !== order.issuanceProfile.retireAfter
      || instruction.predecessorCertificateFingerprint
        !== order.issuanceProfile.predecessorCertificateFingerprint
      || instruction.keyCustodyClass
        !== order.issuanceProfile.custody.custodyClass
      || instruction.keyReferenceDigest
        !== order.issuanceProfile.custody.keyReferenceDigest
      || instruction.privateKeyExportable
        !== order.issuanceProfile.custody.privateKeyExportable
      || instruction.operatorId !== issuance.operatorId
      || instruction.reason
        !== `The quorum-approved issuance order ${order.orderId} authorizes this exact leaf for later runtime admission only.`
    ) {
      throw new Error("runtime admission instruction differs from verified issuance custody");
    }
  } catch (error) {
    findings.push(finding(
      "enrollment-issuance-metadata",
      "error",
      issuance.issuanceId,
      error instanceof Error ? error.message : String(error),
    ));
  }
  if (
    issuance.certificateRetained !== false
    || issuance.privateKeyRetained !== false
    || issuance.certificatePathRetained !== false
    || issuance.privateKeyPathRetained !== false
    || issuance.issuanceAuthority !== "verified-issued-leaf"
    || issuance.authority !== "none"
    || issuance.graphEffect !== "none"
    || issuance.canonEffect !== "none"
    || issuance.answerEffect !== "none"
  ) {
    findings.push(finding("enrollment-issuance-authority", "error", issuance.issuanceId, "issuance receipt retained secrets or acquired task authority"));
  }
  return sortedFindings(findings);
}

function verifyAdmissionLink(
  link: AsoiafAnswerTransportAdmissionLink,
  issuance: AsoiafAnswerTransportIssuanceReceipt,
): AsoiafAnswerTransportEnrollmentFinding[] {
  const findings: AsoiafAnswerTransportEnrollmentFinding[] = [];
  if (link.format !== ASOIAF_ANSWER_TRANSPORT_ADMISSION_LINK_FORMAT) {
    findings.push(finding("enrollment-link-format", "error", link.linkId, "admission link format is invalid"));
  }
  if (link.linkFingerprint !== sha256(admissionLinkCore(link))) {
    findings.push(finding("enrollment-link-fingerprint", "error", link.linkId, "admission link fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-transport-admission-link", {
    issuanceId: link.issuanceId,
    admissionId: link.admission.admissionId,
    linkFingerprint: link.linkFingerprint,
  });
  if (link.linkId !== expectedId) {
    findings.push(finding("enrollment-link-identity", "error", link.linkId, "admission link identity is stale"));
  }
  const expected = issuance.admissionInstruction;
  try {
    requireIdentity(link.admission.admissionId, "runtime admission identity");
    requireSha256(link.admission.admissionFingerprint, "runtime admission fingerprint");
    const linkedAt = requireTime(link.linkedAt, "runtime admission link time");
    if (
      link.issuanceId !== issuance.issuanceId
      || link.issuanceFingerprint !== issuance.issuanceFingerprint
      || link.admission.certificateFingerprint !== expected.certificateFingerprint
      || link.admission.publicKeyFingerprint !== expected.publicKeyFingerprint
      || link.admission.issuerCertificateFingerprint
        !== expected.issuerCertificateFingerprint
      || link.admission.usage !== expected.usage
      || link.admission.principalId !== expected.principalId
      || link.admission.actorRole !== expected.actorRole
      || link.admission.predecessorCertificateFingerprint
        !== expected.predecessorCertificateFingerprint
      || link.admission.admittedAt !== expected.admittedAt
      || Date.parse(linkedAt) < Date.parse(issuance.recordedAt)
      || Date.parse(linkedAt) < Date.parse(link.admission.admittedAt)
    ) {
      throw new Error("runtime admission link differs from issuance custody");
    }
    requireIdentity(link.operatorId, "runtime admission link operator");
  } catch (error) {
    findings.push(finding(
      "enrollment-link-custody",
      "error",
      link.linkId,
      error instanceof Error ? error.message : String(error),
    ));
  }
  if (
    link.admissionAuthority !== "runtime-admission-reference-only"
    || link.authority !== "none"
    || link.graphEffect !== "none"
    || link.canonEffect !== "none"
    || link.answerEffect !== "none"
  ) {
    findings.push(finding("enrollment-link-authority", "error", link.linkId, "admission link acquired runtime or task authority"));
  }
  return sortedFindings(findings);
}

function verifyDigestDirectory<T>(input: {
  directory: string;
  values: readonly T[];
  digest: (value: T) => string;
  code: string;
}): AsoiafAnswerTransportEnrollmentFinding[] {
  if (!fs.existsSync(input.directory)) return [];
  const expected = new Set(
    input.values.map((entry) => `${requireSha256(input.digest(entry), "object digest").slice(7)}.json`),
  );
  const findings: AsoiafAnswerTransportEnrollmentFinding[] = [];
  for (const name of fs.readdirSync(input.directory).sort()) {
    if (!/^[a-f0-9]{64}\.json$/.test(name)) {
      findings.push(finding(`${input.code}-unsafe-name`, "error", name, "enrollment directory contains a non-digest filename"));
    } else if (!expected.has(name)) {
      findings.push(finding(`${input.code}-orphan-name`, "error", name, "enrollment filename does not match reconstructed custody"));
    }
  }
  return findings;
}

function scanSecrets(root: string): AsoiafAnswerTransportEnrollmentFinding[] {
  const findings: AsoiafAnswerTransportEnrollmentFinding[] = [];
  if (!fs.existsSync(root)) return findings;
  const walk = (directory: string): void => {
    for (const name of fs.readdirSync(directory).sort()) {
      const target = path.join(directory, name);
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        walk(target);
      } else if (/\.(key|pem|p12|pfx|csr)$/i.test(name)) {
        findings.push(finding("enrollment-secret-file", "error", relativeUri(root, target), "enrollment estate contains private-key or request material"));
      } else if (stat.size <= 2_000_000) {
        const text = fs.readFileSync(target, "utf8");
        if (/-----BEGIN (?:PRIVATE KEY|RSA PRIVATE KEY|EC PRIVATE KEY|CERTIFICATE REQUEST)-----/.test(text)) {
          findings.push(finding("enrollment-secret-payload", "error", relativeUri(root, target), "enrollment estate contains private-key or CSR PEM material"));
        }
      }
    }
  };
  walk(root);
  return findings;
}

export function verifyAsoiafAnswerTransportEnrollmentEstate(
  root: string,
): AsoiafAnswerTransportEnrollmentFinding[] {
  const findings: AsoiafAnswerTransportEnrollmentFinding[] = [];
  const status = readAsoiafAnswerTransportEnrollmentStatus(root);
  const policyByIdMap = new Map(status.policies.map((entry) => [entry.policyId, entry]));
  const requestByIdMap = new Map(status.requests.map((entry) => [entry.requestId, entry]));
  const orderByIdMap = new Map(status.orders.map((entry) => [entry.orderId, entry]));
  const issuanceByIdMap = new Map(status.issuances.map((entry) => [entry.issuanceId, entry]));

  const duplicateKeys = <T>(
    values: readonly T[],
    key: (entry: T) => string,
  ): string[] => {
    const counts = new Map<string, number>();
    for (const entry of values) {
      const value = key(entry);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([value]) => value)
      .sort();
  };
  for (const value of duplicateKeys(
    status.approvals,
    (entry) => `${entry.statement.requestId}:${entry.statement.approverId}`,
  )) {
    findings.push(finding(
      "enrollment-approval-terminal-duplicate",
      "error",
      value,
      "one approver has multiple retained terminal decisions for one request",
    ));
  }
  for (const value of duplicateKeys(status.orders, (entry) => entry.requestId)) {
    findings.push(finding(
      "enrollment-order-request-duplicate",
      "error",
      value,
      "one enrollment request has multiple issuance orders",
    ));
  }
  for (const value of duplicateKeys(status.issuances, (entry) => entry.orderId)) {
    findings.push(finding(
      "enrollment-issuance-order-duplicate",
      "error",
      value,
      "one issuance order has multiple issued-certificate receipts",
    ));
  }
  for (const value of duplicateKeys(
    status.issuances,
    (entry) => entry.certificate.certificateFingerprint,
  )) {
    findings.push(finding(
      "enrollment-issuance-certificate-duplicate",
      "error",
      value,
      "one certificate fingerprint appears in multiple issuance receipts",
    ));
  }
  for (const value of duplicateKeys(status.admissionLinks, (entry) => entry.issuanceId)) {
    findings.push(finding(
      "enrollment-link-issuance-duplicate",
      "error",
      value,
      "one issuance receipt has multiple runtime admission links",
    ));
  }

  for (const policy of status.policies) findings.push(...verifyPolicy(policy));
  for (const request of status.requests) {
    const policy = policyByIdMap.get(request.proofStatement.policyId);
    if (!policy) {
      findings.push(finding("enrollment-request-policy-missing", "error", request.requestId, "enrollment request references a missing policy"));
    } else {
      findings.push(...verifyRequest(request, policy));
    }
  }
  for (const approval of status.approvals) {
    const request = requestByIdMap.get(approval.statement.requestId);
    const policy = policyByIdMap.get(approval.statement.policyId);
    if (!request || !policy) {
      findings.push(finding("enrollment-approval-input-missing", "error", approval.approvalId, "approval references missing request or policy custody"));
    } else {
      findings.push(...verifyApproval(approval, request, policy));
    }
  }
  for (const order of status.orders) {
    const request = requestByIdMap.get(order.requestId);
    const policy = policyByIdMap.get(order.policyId);
    if (!request || !policy) {
      findings.push(finding("enrollment-order-input-missing", "error", order.orderId, "order references missing request or policy custody"));
    } else {
      findings.push(...verifyOrder(
        order,
        request,
        policy,
        approvalsForRequest(status, request.requestId),
      ));
    }
  }
  for (const issuance of status.issuances) {
    const order = orderByIdMap.get(issuance.orderId);
    if (!order) {
      findings.push(finding("enrollment-issuance-order-missing", "error", issuance.issuanceId, "issuance references a missing order"));
    } else {
      findings.push(...verifyIssuance(issuance, order));
    }
  }
  for (const link of status.admissionLinks) {
    const issuance = issuanceByIdMap.get(link.issuanceId);
    if (!issuance) {
      findings.push(finding("enrollment-link-issuance-missing", "error", link.linkId, "admission link references a missing issuance"));
    } else {
      findings.push(...verifyAdmissionLink(link, issuance));
    }
  }

  findings.push(...verifyDigestDirectory({
    directory: status.paths.policies,
    values: status.policies,
    digest: (entry) => entry.policyFingerprint,
    code: "enrollment-policy-name",
  }));
  findings.push(...verifyDigestDirectory({
    directory: status.paths.requests,
    values: status.requests,
    digest: (entry) => entry.requestFingerprint,
    code: "enrollment-request-name",
  }));
  findings.push(...verifyDigestDirectory({
    directory: status.paths.approvals,
    values: status.approvals,
    digest: (entry) => entry.approvalFingerprint,
    code: "enrollment-approval-name",
  }));
  findings.push(...verifyDigestDirectory({
    directory: status.paths.orders,
    values: status.orders,
    digest: (entry) => entry.orderFingerprint,
    code: "enrollment-order-name",
  }));
  findings.push(...verifyDigestDirectory({
    directory: status.paths.issuances,
    values: status.issuances,
    digest: (entry) => entry.issuanceFingerprint,
    code: "enrollment-issuance-name",
  }));
  findings.push(...verifyDigestDirectory({
    directory: status.paths.admissionLinks,
    values: status.admissionLinks,
    digest: (entry) => entry.linkFingerprint,
    code: "enrollment-link-name",
  }));
  findings.push(...scanSecrets(status.paths.enrollmentRoot));
  return sortedFindings(findings);
}
