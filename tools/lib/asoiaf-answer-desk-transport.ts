import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import tls from "node:tls";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  collectorContentId,
  sha256,
} from "./asoiaf-external-estate.js";
import {
  admitAsoiafAnswerExchangeResult,
  issueAsoiafAnswerExchangeAssignment,
  readAsoiafAnswerExchangeStatus,
  validateAsoiafAnswerExchangeAssignment,
  validateAsoiafAnswerExchangeResult,
  verifyAsoiafAnswerExchangeEstate,
  type AsoiafAnswerExchangeActorRole,
  type AsoiafAnswerExchangeAdmitResult,
  type AsoiafAnswerExchangeIssueResult,
  type AsoiafAnswerExchangeOutcome,
} from "./asoiaf-answer-desk-exchange.js";
import {
  readAsoiafAnswerDeskStatus,
} from "./asoiaf-answer-desk-estate.js";
import {
  buildAsoiafAnswerWorkerManifest,
} from "./asoiaf-answer-desk-worker.js";
import type {
  AsoiafAnswerWorkResultReference,
} from "./asoiaf-answer-work-lease.js";
import type {
  AsoiafAnswerWorkOrder,
} from "./asoiaf-answer-work-order.js";

export const ASOIAF_ANSWER_TRANSPORT_ACTOR_FORMAT =
  "axm-asoiaf-answer-transport-actor/1" as const;
export const ASOIAF_ANSWER_TRANSPORT_REVOCATION_FORMAT =
  "axm-asoiaf-answer-transport-revocation/1" as const;
export const ASOIAF_ANSWER_TRANSPORT_REQUEST_FORMAT =
  "axm-asoiaf-answer-transport-request/1" as const;
export const ASOIAF_ANSWER_TRANSPORT_RESPONSE_FORMAT =
  "axm-asoiaf-answer-transport-response/1" as const;

export const ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE =
  "/v1/assignments/issue" as const;
export const ASOIAF_ANSWER_TRANSPORT_ADMIT_ROUTE =
  "/v1/results/admit" as const;

export type AsoiafAnswerTransportOperation =
  | "issue-assignment"
  | "admit-result";

export type AsoiafAnswerTransportCertificateFingerprint = `sha256:${string}`;

export interface AsoiafAnswerTransportPaths {
  root: string;
  transportRoot: string;
  actors: string;
  revocations: string;
  requests: string;
  responses: string;
}

export interface AsoiafAnswerTransportActorRegistration {
  format: typeof ASOIAF_ANSWER_TRANSPORT_ACTOR_FORMAT;
  registrationId: string;
  registrationFingerprint: `sha256:${string}`;
  certificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  registeredAt: string;
  operatorId: string;
  certificateRetained: false;
  privateKeyRetained: false;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

export interface AsoiafAnswerTransportActorRevocation {
  format: typeof ASOIAF_ANSWER_TRANSPORT_REVOCATION_FORMAT;
  revocationId: string;
  revocationFingerprint: `sha256:${string}`;
  certificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  registrationId: string;
  registrationFingerprint: `sha256:${string}`;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  revokedAt: string;
  reason: string;
  operatorId: string;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

export interface AsoiafAnswerTransportIssueBody {
  itemId: string | null;
  claimedAt: string;
  issuedAt: string | null;
  leaseMilliseconds: number;
}

export interface AsoiafAnswerTransportAdmitBody {
  assignmentId: string;
  completedAt: string;
  outcome: AsoiafAnswerExchangeOutcome;
  afterWorkOrder: AsoiafAnswerWorkOrder | null;
  resultReferences: AsoiafAnswerWorkResultReference[];
  reason: string;
}

export type AsoiafAnswerTransportBody =
  | AsoiafAnswerTransportIssueBody
  | AsoiafAnswerTransportAdmitBody;

export interface AsoiafAnswerTransportRequest {
  format: typeof ASOIAF_ANSWER_TRANSPORT_REQUEST_FORMAT;
  requestId: string;
  requestFingerprint: `sha256:${string}`;
  operation: AsoiafAnswerTransportOperation;
  method: "POST";
  route:
    | typeof ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE
    | typeof ASOIAF_ANSWER_TRANSPORT_ADMIT_ROUTE;
  idempotencyKeyDigest: `sha256:${string}`;
  peerCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  actorRegistrationId: string;
  actorRegistrationFingerprint: `sha256:${string}`;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  receivedAt: string;
  bodyDigest: `sha256:${string}`;
  body: AsoiafAnswerTransportBody;
  privateTextIncluded: false;
  sourceTextIncluded: false;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

export type AsoiafAnswerTransportPayload =
  | AsoiafAnswerExchangeIssueResult
  | AsoiafAnswerExchangeAdmitResult;

export interface AsoiafAnswerTransportResponse {
  format: typeof ASOIAF_ANSWER_TRANSPORT_RESPONSE_FORMAT;
  responseId: string;
  responseFingerprint: `sha256:${string}`;
  requestId: string;
  requestFingerprint: `sha256:${string}`;
  operation: AsoiafAnswerTransportOperation;
  actorRegistrationId: string;
  actorRegistrationFingerprint: `sha256:${string}`;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  completedAt: string;
  outcome: "succeeded" | "refused";
  httpStatus: 200 | 409;
  payloadKind:
    | "answer-exchange-issue-result"
    | "answer-exchange-admit-result"
    | null;
  payloadFingerprint: `sha256:${string}` | null;
  payload: AsoiafAnswerTransportPayload | null;
  errorCode: string | null;
  errorMessage: string | null;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

export interface AsoiafAnswerTransportProcessInput {
  root: string;
  certificateFingerprint: string;
  method?: string;
  route: string;
  idempotencyKey: string;
  body: unknown;
  receivedAt?: string;
  completedAt?: string;
  operatorId?: string;
  now?: () => string;
}

export interface AsoiafAnswerTransportProcessResult {
  request: AsoiafAnswerTransportRequest;
  response: AsoiafAnswerTransportResponse;
  requestUri: string;
  responseUri: string;
  requestReplayed: boolean;
  responseReplayed: boolean;
}

export interface AsoiafAnswerTransportStatus {
  paths: AsoiafAnswerTransportPaths;
  registrations: AsoiafAnswerTransportActorRegistration[];
  revocations: AsoiafAnswerTransportActorRevocation[];
  requests: AsoiafAnswerTransportRequest[];
  responses: AsoiafAnswerTransportResponse[];
}

export interface AsoiafAnswerTransportFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

export interface AsoiafAnswerTransportServerConfig {
  root: string;
  certificate: string | Buffer;
  privateKey: string | Buffer;
  clientCertificateAuthority: string | Buffer | Array<string | Buffer>;
  host?: string;
  port?: number;
  maxBodyBytes?: number;
  operatorId?: string;
  now?: () => string;
}

export interface AsoiafAnswerTransportRemoteEnvelope {
  ok: boolean;
  request: AsoiafAnswerTransportRequest | null;
  response: AsoiafAnswerTransportResponse | null;
  requestReplayed: boolean;
  responseReplayed: boolean;
  error: {
    code: string;
    message: string;
  } | null;
}

export interface AsoiafAnswerTransportClientInput {
  baseUrl: string;
  operation: AsoiafAnswerTransportOperation;
  idempotencyKey: string;
  body: unknown;
  certificate: string | Buffer;
  privateKey: string | Buffer;
  certificateAuthority: string | Buffer | Array<string | Buffer>;
  timeoutMilliseconds?: number;
}

export interface AsoiafAnswerTransportClientResult {
  statusCode: number;
  envelope: AsoiafAnswerTransportRemoteEnvelope;
}

export class AsoiafAnswerTransportAuthorizationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AsoiafAnswerTransportAuthorizationError";
    this.code = code;
  }
}

export class AsoiafAnswerTransportRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AsoiafAnswerTransportRequestError";
    this.code = code;
  }
}

function finding(
  code: string,
  severity: AsoiafAnswerTransportFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafAnswerTransportFinding {
  return { code, severity, subjectId, detail };
}

function sortedFindings(
  findings: readonly AsoiafAnswerTransportFinding[],
): AsoiafAnswerTransportFinding[] {
  const rank = { error: 0, warning: 1, notice: 2 } as const;
  return [...findings].sort(
    (left, right) =>
      rank[left.severity] - rank[right.severity]
      || left.code.localeCompare(right.code)
      || left.subjectId.localeCompare(right.subjectId)
      || left.detail.localeCompare(right.detail),
  );
}

function validTime(value: string): boolean {
  return value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function validFingerprint(value: string): value is `sha256:${string}` {
  return /^sha256:[a-f0-9]{64}$/.test(value);
}

function normalizeCertificateFingerprint(
  value: string,
): AsoiafAnswerTransportCertificateFingerprint {
  const normalized = value.trim().toLowerCase();
  if (!validFingerprint(normalized)) {
    throw new AsoiafAnswerTransportRequestError(
      "certificate-fingerprint-invalid",
      "peer certificate fingerprint must be a lowercase SHA-256 digest",
    );
  }
  return normalized;
}

function validActorRole(value: string): value is AsoiafAnswerExchangeActorRole {
  return buildAsoiafAnswerWorkerManifest().capabilities.some(
    (capability) =>
      capability.executionMode === "external-required"
      && capability.requiredActor === value,
  );
}

function requireActorRole(value: string): AsoiafAnswerExchangeActorRole {
  if (!validActorRole(value)) {
    throw new Error(`external actor role ${value} is not registered by the worker manifest`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allowedSet.has(key)).sort();
  if (unknown.length > 0) {
    throw new AsoiafAnswerTransportRequestError(
      "request-body-field-refused",
      `transport request contains forbidden or unknown fields: ${unknown.join(", ")}`,
    );
  }
}

function normalizedIssueBody(value: unknown): AsoiafAnswerTransportIssueBody {
  if (!isRecord(value)) {
    throw new AsoiafAnswerTransportRequestError(
      "request-body-invalid",
      "assignment issue request body must be a JSON object",
    );
  }
  assertAllowedKeys(value, ["itemId", "claimedAt", "issuedAt", "leaseMilliseconds"]);
  const itemId = value.itemId ?? null;
  const issuedAt = value.issuedAt ?? null;
  if (itemId !== null && (typeof itemId !== "string" || !itemId.trim())) {
    throw new AsoiafAnswerTransportRequestError(
      "request-item-invalid",
      "assignment issue itemId must be a non-empty string or null",
    );
  }
  if (typeof value.claimedAt !== "string" || !validTime(value.claimedAt)) {
    throw new AsoiafAnswerTransportRequestError(
      "request-claimed-at-invalid",
      "assignment issue claimedAt must be a valid timestamp",
    );
  }
  if (issuedAt !== null && (typeof issuedAt !== "string" || !validTime(issuedAt))) {
    throw new AsoiafAnswerTransportRequestError(
      "request-issued-at-invalid",
      "assignment issue issuedAt must be a valid timestamp or null",
    );
  }
  if (
    typeof value.leaseMilliseconds !== "number"
    || !Number.isSafeInteger(value.leaseMilliseconds)
    || value.leaseMilliseconds <= 0
    || value.leaseMilliseconds > 86_400_000
  ) {
    throw new AsoiafAnswerTransportRequestError(
      "request-lease-invalid",
      "assignment issue leaseMilliseconds must be an integer from 1 through 86400000",
    );
  }
  return {
    itemId: itemId === null ? null : itemId.trim(),
    claimedAt: value.claimedAt,
    issuedAt: issuedAt === null ? null : issuedAt,
    leaseMilliseconds: value.leaseMilliseconds,
  };
}

function normalizedAdmitBody(value: unknown): AsoiafAnswerTransportAdmitBody {
  if (!isRecord(value)) {
    throw new AsoiafAnswerTransportRequestError(
      "request-body-invalid",
      "result admission request body must be a JSON object",
    );
  }
  assertAllowedKeys(value, [
    "assignmentId",
    "completedAt",
    "outcome",
    "afterWorkOrder",
    "resultReferences",
    "reason",
  ]);
  if (typeof value.assignmentId !== "string" || !value.assignmentId.trim()) {
    throw new AsoiafAnswerTransportRequestError(
      "request-assignment-invalid",
      "result admission assignmentId must be a non-empty string",
    );
  }
  if (typeof value.completedAt !== "string" || !validTime(value.completedAt)) {
    throw new AsoiafAnswerTransportRequestError(
      "request-completed-at-invalid",
      "result admission completedAt must be a valid timestamp",
    );
  }
  const outcomes = new Set<AsoiafAnswerExchangeOutcome>([
    "satisfied",
    "preserved-as-limitation",
    "refused",
    "failed",
    "cancelled",
    "expired",
    "stale",
  ]);
  if (typeof value.outcome !== "string" || !outcomes.has(value.outcome as AsoiafAnswerExchangeOutcome)) {
    throw new AsoiafAnswerTransportRequestError(
      "request-outcome-invalid",
      "result admission outcome is not accepted by the external exchange",
    );
  }
  const afterWorkOrder = value.afterWorkOrder ?? null;
  if (afterWorkOrder !== null && !isRecord(afterWorkOrder)) {
    throw new AsoiafAnswerTransportRequestError(
      "request-work-order-invalid",
      "result admission afterWorkOrder must be an object or null",
    );
  }
  const resultReferences = value.resultReferences ?? [];
  if (!Array.isArray(resultReferences)) {
    throw new AsoiafAnswerTransportRequestError(
      "request-result-references-invalid",
      "result admission resultReferences must be an array",
    );
  }
  if (typeof value.reason !== "string") {
    throw new AsoiafAnswerTransportRequestError(
      "request-reason-invalid",
      "result admission reason must be a string",
    );
  }
  return {
    assignmentId: value.assignmentId.trim(),
    completedAt: value.completedAt,
    outcome: value.outcome as AsoiafAnswerExchangeOutcome,
    afterWorkOrder: afterWorkOrder as AsoiafAnswerWorkOrder | null,
    resultReferences: resultReferences as AsoiafAnswerWorkResultReference[],
    reason: value.reason,
  };
}

function operationFromRoute(
  method: string,
  route: string,
): AsoiafAnswerTransportOperation {
  if (method !== "POST") {
    throw new AsoiafAnswerTransportRequestError(
      "method-not-allowed",
      "answer transport accepts POST only",
    );
  }
  if (route === ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE) return "issue-assignment";
  if (route === ASOIAF_ANSWER_TRANSPORT_ADMIT_ROUTE) return "admit-result";
  throw new AsoiafAnswerTransportRequestError(
    "route-not-found",
    `answer transport route ${route} is not registered`,
  );
}

function routeForOperation(
  operation: AsoiafAnswerTransportOperation,
): AsoiafAnswerTransportRequest["route"] {
  return operation === "issue-assignment"
    ? ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE
    : ASOIAF_ANSWER_TRANSPORT_ADMIT_ROUTE;
}

function normalizedBody(
  operation: AsoiafAnswerTransportOperation,
  value: unknown,
): AsoiafAnswerTransportBody {
  return operation === "issue-assignment"
    ? normalizedIssueBody(value)
    : normalizedAdmitBody(value);
}

function assertIdempotencyKey(value: string): void {
  if (
    value.length < 16
    || value.length > 256
    || !/^[\x21-\x7e]+$/.test(value)
  ) {
    throw new AsoiafAnswerTransportRequestError(
      "idempotency-key-invalid",
      "Idempotency-Key must contain 16 through 256 visible ASCII characters",
    );
  }
}

function relativeUri(root: string, target: string): string {
  return path.relative(path.resolve(root), path.resolve(target)).split(path.sep).join("/");
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
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    fs.writeFileSync(target, serialized, { encoding: "utf8", flag: "wx" });
    return { value, replayed: false };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existingSerialized = fs.readFileSync(target, "utf8");
    if (existingSerialized !== serialized) {
      throw new Error(`answer transport immutable file collision at ${target}`);
    }
    return { value: JSON.parse(existingSerialized) as T, replayed: true };
  }
}

export function asoiafAnswerTransportPaths(
  root: string,
): AsoiafAnswerTransportPaths {
  const absolute = path.resolve(root);
  const transportRoot = path.join(absolute, "answer-transport");
  return {
    root: absolute,
    transportRoot,
    actors: path.join(transportRoot, "actors"),
    revocations: path.join(transportRoot, "revocations"),
    requests: path.join(transportRoot, "requests"),
    responses: path.join(transportRoot, "responses"),
  };
}

function actorPath(
  paths: AsoiafAnswerTransportPaths,
  certificateFingerprint: AsoiafAnswerTransportCertificateFingerprint,
): string {
  return path.join(paths.actors, `${certificateFingerprint.slice("sha256:".length)}.json`);
}

function revocationPath(
  paths: AsoiafAnswerTransportPaths,
  certificateFingerprint: AsoiafAnswerTransportCertificateFingerprint,
): string {
  return path.join(paths.revocations, `${certificateFingerprint.slice("sha256:".length)}.json`);
}

function requestPath(
  paths: AsoiafAnswerTransportPaths,
  idempotencyKeyDigest: `sha256:${string}`,
): string {
  return path.join(paths.requests, `${idempotencyKeyDigest.slice("sha256:".length)}.json`);
}

function responsePath(
  paths: AsoiafAnswerTransportPaths,
  requestFingerprint: `sha256:${string}`,
): string {
  return path.join(paths.responses, `${requestFingerprint.slice("sha256:".length)}.json`);
}

function registrationCore(
  registration: AsoiafAnswerTransportActorRegistration,
): Omit<
  AsoiafAnswerTransportActorRegistration,
  "registrationId" | "registrationFingerprint"
> {
  const {
    registrationId: _id,
    registrationFingerprint: _fingerprint,
    ...core
  } = registration;
  return core;
}

export function buildAsoiafAnswerTransportActorRegistration(input: {
  certificateFingerprint: string;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  registeredAt: string;
  operatorId: string;
}): AsoiafAnswerTransportActorRegistration {
  const certificateFingerprint = normalizeCertificateFingerprint(
    input.certificateFingerprint,
  );
  if (!input.actorId.trim()) throw new Error("transport actor identity is required");
  requireActorRole(input.actorRole);
  if (!validTime(input.registeredAt)) {
    throw new Error("transport actor registration time is invalid");
  }
  if (!input.operatorId.trim()) throw new Error("transport actor operator identity is required");
  const core = {
    format: ASOIAF_ANSWER_TRANSPORT_ACTOR_FORMAT,
    certificateFingerprint,
    actorId: input.actorId.trim(),
    actorRole: input.actorRole,
    registeredAt: input.registeredAt,
    operatorId: input.operatorId.trim(),
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const registrationFingerprint = sha256(core);
  return {
    ...core,
    registrationId: collectorContentId("asoiaf-answer-transport-actor", {
      certificateFingerprint,
      actorId: core.actorId,
      actorRole: core.actorRole,
      registrationFingerprint,
    }),
    registrationFingerprint,
  };
}

export function validateAsoiafAnswerTransportActorRegistration(
  registration: AsoiafAnswerTransportActorRegistration,
): AsoiafAnswerTransportFinding[] {
  const findings: AsoiafAnswerTransportFinding[] = [];
  let expected: AsoiafAnswerTransportActorRegistration | null = null;
  try {
    expected = buildAsoiafAnswerTransportActorRegistration({
      certificateFingerprint: registration.certificateFingerprint,
      actorId: registration.actorId,
      actorRole: registration.actorRole,
      registeredAt: registration.registeredAt,
      operatorId: registration.operatorId,
    });
  } catch (error) {
    findings.push(finding(
      "transport-actor-input",
      "error",
      registration.registrationId,
      error instanceof Error ? error.message : String(error),
    ));
  }
  if (registration.format !== ASOIAF_ANSWER_TRANSPORT_ACTOR_FORMAT) {
    findings.push(finding(
      "transport-actor-format",
      "error",
      registration.registrationId,
      "transport actor registration format is invalid",
    ));
  }
  if (expected && JSON.stringify(expected) !== JSON.stringify(registration)) {
    findings.push(finding(
      "transport-actor-projection",
      "error",
      registration.registrationId,
      "transport actor registration differs from its certificate, actor, role, time, or operator",
    ));
  }
  if (registration.registrationFingerprint !== sha256(registrationCore(registration))) {
    findings.push(finding(
      "transport-actor-fingerprint",
      "error",
      registration.registrationId,
      "transport actor registration fingerprint is stale",
    ));
  }
  if (
    registration.certificateRetained !== false
    || registration.privateKeyRetained !== false
    || registration.authority !== "none"
    || registration.graphEffect !== "none"
    || registration.canonEffect !== "none"
    || registration.answerEffect !== "none"
  ) {
    findings.push(finding(
      "transport-actor-authority",
      "error",
      registration.registrationId,
      "transport actor registration retained key material or acquired task authority",
    ));
  }
  return sortedFindings(findings);
}

export function registerAsoiafAnswerTransportActor(input: {
  root: string;
  certificateFingerprint: string;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  registeredAt: string;
  operatorId?: string;
}): {
  registration: AsoiafAnswerTransportActorRegistration;
  registrationUri: string;
  replayed: boolean;
} {
  const registration = buildAsoiafAnswerTransportActorRegistration({
    certificateFingerprint: input.certificateFingerprint,
    actorId: input.actorId,
    actorRole: input.actorRole,
    registeredAt: input.registeredAt,
    operatorId: input.operatorId ?? `${input.actorId}:transport-register`,
  });
  const paths = asoiafAnswerTransportPaths(input.root);
  const revokedTarget = revocationPath(paths, registration.certificateFingerprint);
  if (fs.existsSync(revokedTarget)) {
    throw new Error("revoked transport certificate cannot be registered again");
  }
  const target = actorPath(paths, registration.certificateFingerprint);
  const persisted = writeJsonExclusiveOrReplay(target, registration);
  return {
    registration: persisted.value,
    registrationUri: relativeUri(input.root, target),
    replayed: persisted.replayed,
  };
}

function revocationCore(
  revocation: AsoiafAnswerTransportActorRevocation,
): Omit<
  AsoiafAnswerTransportActorRevocation,
  "revocationId" | "revocationFingerprint"
> {
  const {
    revocationId: _id,
    revocationFingerprint: _fingerprint,
    ...core
  } = revocation;
  return core;
}

export function buildAsoiafAnswerTransportActorRevocation(input: {
  registration: AsoiafAnswerTransportActorRegistration;
  revokedAt: string;
  reason: string;
  operatorId: string;
}): AsoiafAnswerTransportActorRevocation {
  const registrationErrors = validateAsoiafAnswerTransportActorRegistration(
    input.registration,
  ).filter((entry) => entry.severity === "error");
  if (registrationErrors.length > 0) {
    throw new Error(`invalid transport actor registration ${input.registration.registrationId}`);
  }
  if (
    !validTime(input.revokedAt)
    || Date.parse(input.revokedAt) < Date.parse(input.registration.registeredAt)
  ) {
    throw new Error("transport actor revocation time is invalid or precedes registration");
  }
  if (input.reason.trim().length < 24) {
    throw new Error("transport actor revocation requires a substantive reason");
  }
  if (!input.operatorId.trim()) throw new Error("transport revocation operator identity is required");
  const core = {
    format: ASOIAF_ANSWER_TRANSPORT_REVOCATION_FORMAT,
    certificateFingerprint: input.registration.certificateFingerprint,
    registrationId: input.registration.registrationId,
    registrationFingerprint: input.registration.registrationFingerprint,
    actorId: input.registration.actorId,
    actorRole: input.registration.actorRole,
    revokedAt: input.revokedAt,
    reason: input.reason.trim(),
    operatorId: input.operatorId.trim(),
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const revocationFingerprint = sha256(core);
  return {
    ...core,
    revocationId: collectorContentId("asoiaf-answer-transport-revocation", {
      registrationId: core.registrationId,
      revokedAt: core.revokedAt,
      revocationFingerprint,
    }),
    revocationFingerprint,
  };
}

export function validateAsoiafAnswerTransportActorRevocation(
  revocation: AsoiafAnswerTransportActorRevocation,
  registration: AsoiafAnswerTransportActorRegistration,
): AsoiafAnswerTransportFinding[] {
  const findings: AsoiafAnswerTransportFinding[] = [];
  let expected: AsoiafAnswerTransportActorRevocation | null = null;
  try {
    expected = buildAsoiafAnswerTransportActorRevocation({
      registration,
      revokedAt: revocation.revokedAt,
      reason: revocation.reason,
      operatorId: revocation.operatorId,
    });
  } catch (error) {
    findings.push(finding(
      "transport-revocation-input",
      "error",
      revocation.revocationId,
      error instanceof Error ? error.message : String(error),
    ));
  }
  if (revocation.format !== ASOIAF_ANSWER_TRANSPORT_REVOCATION_FORMAT) {
    findings.push(finding(
      "transport-revocation-format",
      "error",
      revocation.revocationId,
      "transport actor revocation format is invalid",
    ));
  }
  if (expected && JSON.stringify(expected) !== JSON.stringify(revocation)) {
    findings.push(finding(
      "transport-revocation-projection",
      "error",
      revocation.revocationId,
      "transport actor revocation differs from its exact registration or operator decision",
    ));
  }
  if (revocation.revocationFingerprint !== sha256(revocationCore(revocation))) {
    findings.push(finding(
      "transport-revocation-fingerprint",
      "error",
      revocation.revocationId,
      "transport actor revocation fingerprint is stale",
    ));
  }
  if (
    revocation.authority !== "none"
    || revocation.graphEffect !== "none"
    || revocation.canonEffect !== "none"
    || revocation.answerEffect !== "none"
  ) {
    findings.push(finding(
      "transport-revocation-authority",
      "error",
      revocation.revocationId,
      "transport actor revocation acquired task authority",
    ));
  }
  return sortedFindings(findings);
}

function findRegistration(
  root: string,
  certificateFingerprint: AsoiafAnswerTransportCertificateFingerprint,
): AsoiafAnswerTransportActorRegistration {
  const target = actorPath(asoiafAnswerTransportPaths(root), certificateFingerprint);
  if (!fs.existsSync(target)) {
    throw new AsoiafAnswerTransportAuthorizationError(
      "actor-not-registered",
      "authenticated certificate is not registered to an answer-desk actor",
    );
  }
  const registration = readJson<AsoiafAnswerTransportActorRegistration>(target);
  const errors = validateAsoiafAnswerTransportActorRegistration(registration)
    .filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new AsoiafAnswerTransportAuthorizationError(
      "actor-registration-invalid",
      "authenticated certificate actor registration is invalid",
    );
  }
  return registration;
}

function activeRegistration(
  root: string,
  certificateFingerprint: AsoiafAnswerTransportCertificateFingerprint,
  at: string,
): AsoiafAnswerTransportActorRegistration {
  const registration = findRegistration(root, certificateFingerprint);
  if (!validTime(at) || Date.parse(at) < Date.parse(registration.registeredAt)) {
    throw new AsoiafAnswerTransportAuthorizationError(
      "actor-registration-not-active",
      "authenticated certificate registration is not active at request time",
    );
  }
  const target = revocationPath(
    asoiafAnswerTransportPaths(root),
    certificateFingerprint,
  );
  if (fs.existsSync(target)) {
    throw new AsoiafAnswerTransportAuthorizationError(
      "actor-certificate-revoked",
      "authenticated certificate has been revoked",
    );
  }
  return registration;
}

export function revokeAsoiafAnswerTransportActor(input: {
  root: string;
  certificateFingerprint: string;
  revokedAt: string;
  reason: string;
  operatorId?: string;
}): {
  revocation: AsoiafAnswerTransportActorRevocation;
  revocationUri: string;
  replayed: boolean;
} {
  const certificateFingerprint = normalizeCertificateFingerprint(
    input.certificateFingerprint,
  );
  const registration = findRegistration(input.root, certificateFingerprint);
  const revocation = buildAsoiafAnswerTransportActorRevocation({
    registration,
    revokedAt: input.revokedAt,
    reason: input.reason,
    operatorId: input.operatorId ?? `${registration.actorId}:transport-revoke`,
  });
  const target = revocationPath(
    asoiafAnswerTransportPaths(input.root),
    certificateFingerprint,
  );
  const persisted = writeJsonExclusiveOrReplay(target, revocation);
  return {
    revocation: persisted.value,
    revocationUri: relativeUri(input.root, target),
    replayed: persisted.replayed,
  };
}

function requestCore(
  request: AsoiafAnswerTransportRequest,
): Omit<AsoiafAnswerTransportRequest, "requestId" | "requestFingerprint"> {
  const { requestId: _id, requestFingerprint: _fingerprint, ...core } = request;
  return core;
}

export function buildAsoiafAnswerTransportRequest(input: {
  registration: AsoiafAnswerTransportActorRegistration;
  operation: AsoiafAnswerTransportOperation;
  idempotencyKeyDigest: `sha256:${string}`;
  receivedAt: string;
  body: AsoiafAnswerTransportBody;
}): AsoiafAnswerTransportRequest {
  const registrationErrors = validateAsoiafAnswerTransportActorRegistration(
    input.registration,
  ).filter((entry) => entry.severity === "error");
  if (registrationErrors.length > 0) {
    throw new Error(`invalid transport actor registration ${input.registration.registrationId}`);
  }
  if (!validFingerprint(input.idempotencyKeyDigest)) {
    throw new Error("transport idempotency key digest is invalid");
  }
  if (
    !validTime(input.receivedAt)
    || Date.parse(input.receivedAt) < Date.parse(input.registration.registeredAt)
  ) {
    throw new Error("transport request time is invalid or precedes actor registration");
  }
  const route = routeForOperation(input.operation);
  const body = normalizedBody(input.operation, input.body);
  const core = {
    format: ASOIAF_ANSWER_TRANSPORT_REQUEST_FORMAT,
    operation: input.operation,
    method: "POST" as const,
    route,
    idempotencyKeyDigest: input.idempotencyKeyDigest,
    peerCertificateFingerprint: input.registration.certificateFingerprint,
    actorRegistrationId: input.registration.registrationId,
    actorRegistrationFingerprint: input.registration.registrationFingerprint,
    actorId: input.registration.actorId,
    actorRole: input.registration.actorRole,
    receivedAt: input.receivedAt,
    bodyDigest: sha256(body),
    body,
    privateTextIncluded: false as const,
    sourceTextIncluded: false as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const requestFingerprint = sha256(core);
  return {
    ...core,
    requestId: collectorContentId("asoiaf-answer-transport-request", {
      idempotencyKeyDigest: core.idempotencyKeyDigest,
      requestFingerprint,
    }),
    requestFingerprint,
  };
}

export function validateAsoiafAnswerTransportRequest(
  request: AsoiafAnswerTransportRequest,
  registration: AsoiafAnswerTransportActorRegistration,
): AsoiafAnswerTransportFinding[] {
  const findings: AsoiafAnswerTransportFinding[] = [];
  let expected: AsoiafAnswerTransportRequest | null = null;
  try {
    expected = buildAsoiafAnswerTransportRequest({
      registration,
      operation: request.operation,
      idempotencyKeyDigest: request.idempotencyKeyDigest,
      receivedAt: request.receivedAt,
      body: request.body,
    });
  } catch (error) {
    findings.push(finding(
      "transport-request-input",
      "error",
      request.requestId,
      error instanceof Error ? error.message : String(error),
    ));
  }
  if (request.format !== ASOIAF_ANSWER_TRANSPORT_REQUEST_FORMAT) {
    findings.push(finding(
      "transport-request-format",
      "error",
      request.requestId,
      "transport request format is invalid",
    ));
  }
  if (expected && JSON.stringify(expected) !== JSON.stringify(request)) {
    findings.push(finding(
      "transport-request-projection",
      "error",
      request.requestId,
      "transport request differs from its authenticated actor, route, method, body, or idempotency custody",
    ));
  }
  if (request.requestFingerprint !== sha256(requestCore(request))) {
    findings.push(finding(
      "transport-request-fingerprint",
      "error",
      request.requestId,
      "transport request fingerprint is stale",
    ));
  }
  if (
    request.privateTextIncluded !== false
    || request.sourceTextIncluded !== false
    || request.authority !== "none"
    || request.graphEffect !== "none"
    || request.canonEffect !== "none"
    || request.answerEffect !== "none"
  ) {
    findings.push(finding(
      "transport-request-authority",
      "error",
      request.requestId,
      "transport request retained source text or acquired task authority",
    ));
  }
  return sortedFindings(findings);
}

function responseCore(
  response: AsoiafAnswerTransportResponse,
): Omit<AsoiafAnswerTransportResponse, "responseId" | "responseFingerprint"> {
  const { responseId: _id, responseFingerprint: _fingerprint, ...core } = response;
  return core;
}

export function buildAsoiafAnswerTransportResponse(input: {
  request: AsoiafAnswerTransportRequest;
  completedAt: string;
  payload?: AsoiafAnswerTransportPayload | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}): AsoiafAnswerTransportResponse {
  if (
    !validTime(input.completedAt)
    || Date.parse(input.completedAt) < Date.parse(input.request.receivedAt)
  ) {
    throw new Error("transport response time is invalid or precedes request receipt");
  }
  const payload = input.payload ?? null;
  const errorCode = input.errorCode?.trim() || null;
  const errorMessage = input.errorMessage?.trim().slice(0, 1000) || null;
  const succeeded = payload !== null;
  if (succeeded && (errorCode || errorMessage)) {
    throw new Error("successful transport response cannot retain an error");
  }
  if (!succeeded && (!errorCode || !errorMessage)) {
    throw new Error("refused transport response requires an error code and message");
  }
  const payloadKind = succeeded
    ? input.request.operation === "issue-assignment"
      ? "answer-exchange-issue-result" as const
      : "answer-exchange-admit-result" as const
    : null;
  const core = {
    format: ASOIAF_ANSWER_TRANSPORT_RESPONSE_FORMAT,
    requestId: input.request.requestId,
    requestFingerprint: input.request.requestFingerprint,
    operation: input.request.operation,
    actorRegistrationId: input.request.actorRegistrationId,
    actorRegistrationFingerprint: input.request.actorRegistrationFingerprint,
    actorId: input.request.actorId,
    actorRole: input.request.actorRole,
    completedAt: input.completedAt,
    outcome: succeeded ? "succeeded" as const : "refused" as const,
    httpStatus: succeeded ? 200 as const : 409 as const,
    payloadKind,
    payloadFingerprint: succeeded ? sha256(payload) : null,
    payload,
    errorCode,
    errorMessage,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const responseFingerprint = sha256(core);
  return {
    ...core,
    responseId: collectorContentId("asoiaf-answer-transport-response", {
      requestId: core.requestId,
      outcome: core.outcome,
      responseFingerprint,
    }),
    responseFingerprint,
  };
}

export function validateAsoiafAnswerTransportResponse(
  response: AsoiafAnswerTransportResponse,
  request: AsoiafAnswerTransportRequest,
): AsoiafAnswerTransportFinding[] {
  const findings: AsoiafAnswerTransportFinding[] = [];
  let expected: AsoiafAnswerTransportResponse | null = null;
  try {
    expected = buildAsoiafAnswerTransportResponse({
      request,
      completedAt: response.completedAt,
      payload: response.payload,
      errorCode: response.errorCode,
      errorMessage: response.errorMessage,
    });
  } catch (error) {
    findings.push(finding(
      "transport-response-input",
      "error",
      response.responseId,
      error instanceof Error ? error.message : String(error),
    ));
  }
  if (response.format !== ASOIAF_ANSWER_TRANSPORT_RESPONSE_FORMAT) {
    findings.push(finding(
      "transport-response-format",
      "error",
      response.responseId,
      "transport response format is invalid",
    ));
  }
  if (expected && JSON.stringify(expected) !== JSON.stringify(response)) {
    findings.push(finding(
      "transport-response-projection",
      "error",
      response.responseId,
      "transport response differs from its request, payload, error, or completion custody",
    ));
  }
  if (response.responseFingerprint !== sha256(responseCore(response))) {
    findings.push(finding(
      "transport-response-fingerprint",
      "error",
      response.responseId,
      "transport response fingerprint is stale",
    ));
  }
  if (
    response.authority !== "none"
    || response.graphEffect !== "none"
    || response.canonEffect !== "none"
    || response.answerEffect !== "none"
  ) {
    findings.push(finding(
      "transport-response-authority",
      "error",
      response.responseId,
      "transport response acquired task authority",
    ));
  }
  return sortedFindings(findings);
}

function transportIntegrityErrors(root: string): AsoiafAnswerTransportFinding[] {
  return verifyAsoiafAnswerTransportEstate(root)
    .filter((entry) => entry.severity === "error");
}

function retainedResponseForRequest(
  root: string,
  request: AsoiafAnswerTransportRequest,
): AsoiafAnswerTransportResponse | null {
  const target = responsePath(
    asoiafAnswerTransportPaths(root),
    request.requestFingerprint,
  );
  if (!fs.existsSync(target)) return null;
  const response = readJson<AsoiafAnswerTransportResponse>(target);
  const errors = validateAsoiafAnswerTransportResponse(response, request)
    .filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(`retained transport response ${response.responseId} is invalid`);
  }
  return response;
}

function persistResponse(
  root: string,
  request: AsoiafAnswerTransportRequest,
  response: AsoiafAnswerTransportResponse,
): { response: AsoiafAnswerTransportResponse; replayed: boolean; uri: string } {
  const target = responsePath(
    asoiafAnswerTransportPaths(root),
    request.requestFingerprint,
  );
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const serialized = `${JSON.stringify(response, null, 2)}\n`;
  try {
    fs.writeFileSync(target, serialized, { encoding: "utf8", flag: "wx" });
    return {
      response,
      replayed: false,
      uri: relativeUri(root, target),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = readJson<AsoiafAnswerTransportResponse>(target);
    const errors = validateAsoiafAnswerTransportResponse(existing, request)
      .filter((entry) => entry.severity === "error");
    if (errors.length > 0) {
      throw new Error(`answer transport immutable response collision at ${target}`);
    }
    return {
      response: existing,
      replayed: true,
      uri: relativeUri(root, target),
    };
  }
}

function executeTransportRequest(
  root: string,
  request: AsoiafAnswerTransportRequest,
  operatorId: string,
): AsoiafAnswerTransportPayload {
  if (request.operation === "issue-assignment") {
    const body = request.body as AsoiafAnswerTransportIssueBody;
    return issueAsoiafAnswerExchangeAssignment({
      root,
      itemId: body.itemId,
      actorId: request.actorId,
      actorRole: request.actorRole,
      claimedAt: body.claimedAt,
      issuedAt: body.issuedAt ?? undefined,
      leaseMilliseconds: body.leaseMilliseconds,
      operatorId: `${operatorId}:issue:${request.requestId}`,
    });
  }
  const body = request.body as AsoiafAnswerTransportAdmitBody;
  return admitAsoiafAnswerExchangeResult({
    root,
    assignmentId: body.assignmentId,
    actorId: request.actorId,
    actorRole: request.actorRole,
    completedAt: body.completedAt,
    outcome: body.outcome,
    afterWorkOrder: body.afterWorkOrder,
    resultReferences: body.resultReferences,
    reason: body.reason,
    operatorId: `${operatorId}:admit:${request.requestId}`,
  });
}

export function processAsoiafAnswerTransportRequest(
  input: AsoiafAnswerTransportProcessInput,
): AsoiafAnswerTransportProcessResult {
  const clock = input.now ?? (() => new Date().toISOString());
  const method = (input.method ?? "POST").toUpperCase();
  const operation = operationFromRoute(method, input.route);
  assertIdempotencyKey(input.idempotencyKey);
  const certificateFingerprint = normalizeCertificateFingerprint(
    input.certificateFingerprint,
  );
  const authorizationTime = input.receivedAt ?? clock();
  const registration = activeRegistration(
    input.root,
    certificateFingerprint,
    authorizationTime,
  );
  const body = normalizedBody(operation, input.body);
  const priorErrors = transportIntegrityErrors(input.root);
  if (priorErrors.length > 0) {
    throw new Error(
      `invalid answer transport estate: ${priorErrors
        .map((entry) => `${entry.code}:${entry.subjectId}`)
        .join(", ")}`,
    );
  }
  const paths = asoiafAnswerTransportPaths(input.root);
  const idempotencyKeyDigest = sha256(input.idempotencyKey);
  const target = requestPath(paths, idempotencyKeyDigest);
  let request: AsoiafAnswerTransportRequest;
  let requestReplayed: boolean;
  if (fs.existsSync(target)) {
    const existing = readJson<AsoiafAnswerTransportRequest>(target);
    const expected = buildAsoiafAnswerTransportRequest({
      registration,
      operation,
      idempotencyKeyDigest,
      receivedAt: existing.receivedAt,
      body,
    });
    if (JSON.stringify(existing) !== JSON.stringify(expected)) {
      throw new AsoiafAnswerTransportRequestError(
        "idempotency-key-conflict",
        "Idempotency-Key is already bound to a different actor, route, method, or body",
      );
    }
    request = existing;
    requestReplayed = true;
  } else {
    const built = buildAsoiafAnswerTransportRequest({
      registration,
      operation,
      idempotencyKeyDigest,
      receivedAt: authorizationTime,
      body,
    });
    const persisted = writeJsonExclusiveOrReplay(target, built);
    if (JSON.stringify(persisted.value) !== JSON.stringify(built)) {
      throw new AsoiafAnswerTransportRequestError(
        "idempotency-key-conflict",
        "Idempotency-Key became bound to a different authenticated request",
      );
    }
    request = persisted.value;
    requestReplayed = persisted.replayed;
  }
  const retainedResponse = retainedResponseForRequest(input.root, request);
  if (retainedResponse) {
    return {
      request,
      response: retainedResponse,
      requestUri: relativeUri(input.root, target),
      responseUri: relativeUri(
        input.root,
        responsePath(paths, request.requestFingerprint),
      ),
      requestReplayed: true,
      responseReplayed: true,
    };
  }
  let response: AsoiafAnswerTransportResponse;
  try {
    const payload = executeTransportRequest(
      input.root,
      request,
      input.operatorId ?? "operator:answer-transport",
    );
    response = buildAsoiafAnswerTransportResponse({
      request,
      completedAt: input.completedAt ?? clock(),
      payload,
    });
  } catch (error) {
    response = buildAsoiafAnswerTransportResponse({
      request,
      completedAt: input.completedAt ?? clock(),
      errorCode: "exchange-operation-refused",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
  const persistedResponse = persistResponse(input.root, request, response);
  return {
    request,
    response: persistedResponse.response,
    requestUri: relativeUri(input.root, target),
    responseUri: persistedResponse.uri,
    requestReplayed,
    responseReplayed: persistedResponse.replayed,
  };
}

export function readAsoiafAnswerTransportStatus(
  root: string,
): AsoiafAnswerTransportStatus {
  const paths = asoiafAnswerTransportPaths(root);
  return {
    paths,
    registrations: listJson<AsoiafAnswerTransportActorRegistration>(paths.actors),
    revocations: listJson<AsoiafAnswerTransportActorRevocation>(paths.revocations),
    requests: listJson<AsoiafAnswerTransportRequest>(paths.requests),
    responses: listJson<AsoiafAnswerTransportResponse>(paths.responses),
  };
}

function responseCustodyFindings(
  root: string,
  response: AsoiafAnswerTransportResponse,
  request: AsoiafAnswerTransportRequest,
): AsoiafAnswerTransportFinding[] {
  const findings: AsoiafAnswerTransportFinding[] = [];
  if (response.outcome !== "succeeded" || !response.payload) return findings;
  try {
    const exchange = readAsoiafAnswerExchangeStatus(root);
    if (request.operation === "issue-assignment") {
      const payload = response.payload as AsoiafAnswerExchangeIssueResult;
      const retained = exchange.assignments.find(
        (entry) => entry.assignmentId === payload.assignment.assignmentId,
      );
      const assignmentErrors = validateAsoiafAnswerExchangeAssignment(
        payload.assignment,
      ).filter((entry) => entry.severity === "error");
      if (
        assignmentErrors.length > 0
        || !retained
        || JSON.stringify(retained) !== JSON.stringify(payload.assignment)
        || payload.assignment.actorId !== request.actorId
        || payload.assignment.actorRole !== request.actorRole
      ) {
        findings.push(finding(
          "transport-response-assignment-custody",
          "error",
          response.responseId,
          "successful issue response is not bound to the exact retained assignment and authenticated actor",
        ));
      }
    } else {
      const payload = response.payload as AsoiafAnswerExchangeAdmitResult;
      const retainedResult = exchange.results.find(
        (entry) => entry.resultId === payload.result.resultId,
      );
      const assignment = exchange.assignments.find(
        (entry) => entry.assignmentId === payload.result.assignmentId,
      );
      const desk = readAsoiafAnswerDeskStatus(root);
      const settlement = desk.settlements.find(
        (entry) => entry.leaseId === payload.result.leaseId,
      );
      const resultErrors = assignment
        ? validateAsoiafAnswerExchangeResult(root, payload.result, assignment)
          .filter((entry) => entry.severity === "error")
        : [finding(
            "transport-response-result-assignment",
            "error",
            response.responseId,
            "admission response assignment is absent",
          )];
      if (
        resultErrors.length > 0
        || !retainedResult
        || JSON.stringify(retainedResult) !== JSON.stringify(payload.result)
        || !settlement
        || JSON.stringify(settlement) !== JSON.stringify(payload.settlement.settlement)
        || payload.result.actorId !== request.actorId
        || payload.result.actorRole !== request.actorRole
      ) {
        findings.push(finding(
          "transport-response-result-custody",
          "error",
          response.responseId,
          "successful admission response is not bound to the exact retained result, settlement, and authenticated actor",
        ));
      }
    }
  } catch (error) {
    findings.push(finding(
      "transport-response-custody-read",
      "error",
      response.responseId,
      error instanceof Error ? error.message : String(error),
    ));
  }
  return findings;
}

export function verifyAsoiafAnswerTransportEstate(
  root: string,
): AsoiafAnswerTransportFinding[] {
  const findings: AsoiafAnswerTransportFinding[] = [];
  for (const entry of verifyAsoiafAnswerExchangeEstate(root)) {
    findings.push(finding(
      `exchange:${entry.code}`,
      entry.severity,
      entry.subjectId,
      entry.detail,
    ));
  }
  let status: AsoiafAnswerTransportStatus;
  try {
    status = readAsoiafAnswerTransportStatus(root);
  } catch (error) {
    findings.push(finding(
      "transport-estate-read",
      "error",
      path.resolve(root),
      error instanceof Error ? error.message : String(error),
    ));
    return sortedFindings(findings);
  }
  const registrationsByCertificate = new Map<
    string,
    AsoiafAnswerTransportActorRegistration
  >();
  const registrationsById = new Map<string, AsoiafAnswerTransportActorRegistration>();
  for (const registration of status.registrations) {
    if (registrationsByCertificate.has(registration.certificateFingerprint)) {
      findings.push(finding(
        "transport-actor-certificate-duplicate",
        "error",
        registration.certificateFingerprint,
        "transport certificate has multiple actor registrations",
      ));
    }
    if (registrationsById.has(registration.registrationId)) {
      findings.push(finding(
        "transport-actor-identity-duplicate",
        "error",
        registration.registrationId,
        "transport actor registration identity is duplicated",
      ));
    }
    registrationsByCertificate.set(registration.certificateFingerprint, registration);
    registrationsById.set(registration.registrationId, registration);
    findings.push(...validateAsoiafAnswerTransportActorRegistration(registration));
  }
  const revocationsByCertificate = new Map<
    string,
    AsoiafAnswerTransportActorRevocation
  >();
  for (const revocation of status.revocations) {
    if (revocationsByCertificate.has(revocation.certificateFingerprint)) {
      findings.push(finding(
        "transport-revocation-certificate-duplicate",
        "error",
        revocation.certificateFingerprint,
        "transport certificate has multiple revocations",
      ));
    }
    revocationsByCertificate.set(revocation.certificateFingerprint, revocation);
    const registration = registrationsByCertificate.get(
      revocation.certificateFingerprint,
    );
    if (!registration) {
      findings.push(finding(
        "transport-revocation-registration-missing",
        "error",
        revocation.revocationId,
        "transport revocation references an absent actor registration",
      ));
    } else {
      findings.push(...validateAsoiafAnswerTransportActorRevocation(
        revocation,
        registration,
      ));
    }
  }
  const requestsById = new Map<string, AsoiafAnswerTransportRequest>();
  const requestsByFingerprint = new Map<string, AsoiafAnswerTransportRequest>();
  for (const request of status.requests) {
    if (requestsById.has(request.requestId)) {
      findings.push(finding(
        "transport-request-identity-duplicate",
        "error",
        request.requestId,
        "transport request identity is duplicated",
      ));
    }
    requestsById.set(request.requestId, request);
    requestsByFingerprint.set(request.requestFingerprint, request);
    const registration = registrationsById.get(request.actorRegistrationId);
    if (!registration) {
      findings.push(finding(
        "transport-request-registration-missing",
        "error",
        request.requestId,
        "transport request references an absent actor registration",
      ));
      continue;
    }
    findings.push(...validateAsoiafAnswerTransportRequest(request, registration));
    const revocation = revocationsByCertificate.get(
      request.peerCertificateFingerprint,
    );
    if (
      revocation
      && Date.parse(revocation.revokedAt) <= Date.parse(request.receivedAt)
    ) {
      findings.push(finding(
        "transport-request-after-revocation",
        "error",
        request.requestId,
        "transport request was accepted at or after certificate revocation",
      ));
    }
  }
  const responsesByRequest = new Map<string, AsoiafAnswerTransportResponse>();
  for (const response of status.responses) {
    if (responsesByRequest.has(response.requestId)) {
      findings.push(finding(
        "transport-response-request-duplicate",
        "error",
        response.requestId,
        "transport request has multiple retained responses",
      ));
    }
    responsesByRequest.set(response.requestId, response);
    const request = requestsById.get(response.requestId);
    if (!request) {
      findings.push(finding(
        "transport-response-request-missing",
        "error",
        response.responseId,
        "transport response references an absent request",
      ));
      continue;
    }
    findings.push(...validateAsoiafAnswerTransportResponse(response, request));
    findings.push(...responseCustodyFindings(root, response, request));
  }
  for (const request of status.requests) {
    if (!responsesByRequest.has(request.requestId)) {
      findings.push(finding(
        "transport-request-pending",
        "warning",
        request.requestId,
        "transport request has no retained response and may be recovered by exact replay",
      ));
    }
  }
  for (const [directory, expectedName, code] of [
    [status.paths.actors, (value: AsoiafAnswerTransportActorRegistration) => value.certificateFingerprint, "transport-actor-name"],
    [status.paths.revocations, (value: AsoiafAnswerTransportActorRevocation) => value.certificateFingerprint, "transport-revocation-name"],
    [status.paths.requests, (value: AsoiafAnswerTransportRequest) => value.idempotencyKeyDigest, "transport-request-name"],
    [status.paths.responses, (value: AsoiafAnswerTransportResponse) => value.requestFingerprint, "transport-response-name"],
  ] as const) {
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory).sort()) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) {
        findings.push(finding(code, "error", name, "transport filename is not a SHA-256 digest"));
        continue;
      }
      try {
        const value = readJson<
          AsoiafAnswerTransportActorRegistration
          | AsoiafAnswerTransportActorRevocation
          | AsoiafAnswerTransportRequest
          | AsoiafAnswerTransportResponse
        >(path.join(directory, name));
        const digest = expectedName(value as never).slice("sha256:".length);
        if (name !== `${digest}.json`) {
          findings.push(finding(code, "error", name, "transport filename differs from its bound digest"));
        }
      } catch (error) {
        findings.push(finding(
          `${code}-read`,
          "error",
          name,
          error instanceof Error ? error.message : String(error),
        ));
      }
    }
  }
  return sortedFindings(findings);
}

export function fingerprintAsoiafAnswerTransportCertificate(
  certificate: string | Buffer,
): AsoiafAnswerTransportCertificateFingerprint {
  const parsed = new crypto.X509Certificate(certificate);
  return `sha256:${crypto.createHash("sha256").update(parsed.raw).digest("hex")}`;
}

function peerCertificateFingerprint(
  request: IncomingMessage,
): AsoiafAnswerTransportCertificateFingerprint {
  const socket = request.socket as tls.TLSSocket;
  if (!socket.authorized) {
    throw new AsoiafAnswerTransportAuthorizationError(
      "tls-peer-unauthorized",
      "mutual TLS peer certificate is not authorized by the configured client CA",
    );
  }
  const certificate = socket.getPeerCertificate(true);
  if (!certificate.raw || certificate.raw.length === 0) {
    throw new AsoiafAnswerTransportAuthorizationError(
      "tls-peer-certificate-missing",
      "mutual TLS peer certificate is absent",
    );
  }
  return `sha256:${crypto.createHash("sha256").update(certificate.raw).digest("hex")}`;
}

async function readRequestBody(
  request: IncomingMessage,
  maxBodyBytes: number,
): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBodyBytes) {
      throw new AsoiafAnswerTransportRequestError(
        "request-body-too-large",
        `transport request exceeds ${maxBodyBytes} bytes`,
      );
    }
    chunks.push(buffer);
  }
  if (total === 0) {
    throw new AsoiafAnswerTransportRequestError(
      "request-body-missing",
      "transport request requires a JSON body",
    );
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new AsoiafAnswerTransportRequestError(
      "request-json-invalid",
      "transport request body is not valid JSON",
    );
  }
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  value: unknown,
): void {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  response.end(body);
}

function errorStatus(error: unknown): number {
  if (error instanceof AsoiafAnswerTransportAuthorizationError) return 403;
  if (error instanceof AsoiafAnswerTransportRequestError) {
    if (error.code === "route-not-found") return 404;
    if (error.code === "method-not-allowed") return 405;
    return 400;
  }
  return 500;
}

function errorCode(error: unknown): string {
  if (
    error instanceof AsoiafAnswerTransportAuthorizationError
    || error instanceof AsoiafAnswerTransportRequestError
  ) {
    return error.code;
  }
  return "transport-internal-error";
}

function publicErrorMessage(error: unknown): string {
  if (
    error instanceof AsoiafAnswerTransportAuthorizationError
    || error instanceof AsoiafAnswerTransportRequestError
  ) {
    return error.message;
  }
  return "answer transport could not process the authenticated request";
}

export function createAsoiafAnswerTransportServer(
  config: AsoiafAnswerTransportServerConfig,
): https.Server {
  const maxBodyBytes = config.maxBodyBytes ?? 8 * 1024 * 1024;
  const clock = config.now ?? (() => new Date().toISOString());
  const server = https.createServer(
    {
      cert: config.certificate,
      key: config.privateKey,
      ca: config.clientCertificateAuthority,
      requestCert: true,
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
    },
    (request, response) => {
      void (async () => {
        try {
          const fingerprint = peerCertificateFingerprint(request);
          const requestUrl = new URL(
            request.url ?? "/",
            "https://answer-transport.invalid",
          );
          if (requestUrl.search) {
            throw new AsoiafAnswerTransportRequestError(
              "query-string-refused",
              "answer transport routes do not accept query parameters",
            );
          }
          const contentType = request.headers["content-type"] ?? "";
          if (!String(contentType).toLowerCase().startsWith("application/json")) {
            throw new AsoiafAnswerTransportRequestError(
              "content-type-refused",
              "answer transport requires application/json",
            );
          }
          const idempotencyHeader = request.headers["idempotency-key"];
          if (Array.isArray(idempotencyHeader) || typeof idempotencyHeader !== "string") {
            throw new AsoiafAnswerTransportRequestError(
              "idempotency-key-missing",
              "answer transport requires one Idempotency-Key header",
            );
          }
          const body = await readRequestBody(request, maxBodyBytes);
          const processed = processAsoiafAnswerTransportRequest({
            root: config.root,
            certificateFingerprint: fingerprint,
            method: request.method,
            route: requestUrl.pathname,
            idempotencyKey: idempotencyHeader,
            body,
            receivedAt: clock(),
            operatorId: config.operatorId ?? "operator:answer-transport-server",
            now: clock,
          });
          const envelope: AsoiafAnswerTransportRemoteEnvelope = {
            ok: processed.response.outcome === "succeeded",
            request: processed.request,
            response: processed.response,
            requestReplayed: processed.requestReplayed,
            responseReplayed: processed.responseReplayed,
            error: processed.response.outcome === "refused"
              ? {
                  code: processed.response.errorCode ?? "exchange-operation-refused",
                  message: processed.response.errorMessage ?? "exchange operation was refused",
                }
              : null,
          };
          sendJson(response, processed.response.httpStatus, envelope);
        } catch (error) {
          const envelope: AsoiafAnswerTransportRemoteEnvelope = {
            ok: false,
            request: null,
            response: null,
            requestReplayed: false,
            responseReplayed: false,
            error: {
              code: errorCode(error),
              message: publicErrorMessage(error),
            },
          };
          sendJson(response, errorStatus(error), envelope);
        }
      })();
    },
  );
  return server;
}

export async function listenAsoiafAnswerTransportServer(
  server: https.Server,
  host = "127.0.0.1",
  port = 0,
): Promise<{ host: string; port: number }> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("answer transport server did not expose a TCP address");
  }
  return { host, port: address.port };
}

export async function requestAsoiafAnswerTransport(
  input: AsoiafAnswerTransportClientInput,
): Promise<AsoiafAnswerTransportClientResult> {
  assertIdempotencyKey(input.idempotencyKey);
  const route = routeForOperation(input.operation);
  const body = normalizedBody(input.operation, input.body);
  const serialized = JSON.stringify(body);
  const endpoint = new URL(route, input.baseUrl.endsWith("/")
    ? input.baseUrl
    : `${input.baseUrl}/`);
  return await new Promise<AsoiafAnswerTransportClientResult>((resolve, reject) => {
    const request = https.request(
      endpoint,
      {
        method: "POST",
        cert: input.certificate,
        key: input.privateKey,
        ca: input.certificateAuthority,
        rejectUnauthorized: true,
        minVersion: "TLSv1.2",
        timeout: input.timeoutMilliseconds ?? 15_000,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(serialized),
          "idempotency-key": input.idempotencyKey,
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          try {
            const parsed = JSON.parse(
              Buffer.concat(chunks).toString("utf8"),
            ) as AsoiafAnswerTransportRemoteEnvelope;
            resolve({
              statusCode: response.statusCode ?? 0,
              envelope: parsed,
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("timeout", () => {
      request.destroy(new Error("answer transport request timed out"));
    });
    request.on("error", reject);
    request.end(serialized);
  });
}
