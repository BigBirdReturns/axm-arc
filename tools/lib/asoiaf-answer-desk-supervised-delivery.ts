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
  readAsoiafAnswerExchangeStatus,
  validateAsoiafAnswerExchangeAssignment,
  validateAsoiafAnswerExchangeResult,
  verifyAsoiafAnswerExchangeEstate,
  type AsoiafAnswerExchangeActorRole,
  type AsoiafAnswerExchangeAdmitResult,
  type AsoiafAnswerExchangeAssignment,
  type AsoiafAnswerExchangeIssueResult,
  type AsoiafAnswerExchangeOutcome,
  type AsoiafAnswerExchangeResult,
} from "./asoiaf-answer-desk-exchange.js";
import {
  readAsoiafAnswerDeskStatus,
  verifyAsoiafAnswerDeskEstate,
} from "./asoiaf-answer-desk-estate.js";
import {
  asoiafAnswerSupervisorPaths,
  readAsoiafAnswerSupervisorStatus,
  tickAsoiafAnswerDeskSupervisor,
  validateAsoiafAnswerSupervisorIntent,
  validateAsoiafAnswerSupervisorRun,
  verifyAsoiafAnswerSupervisorEstate,
  type AsoiafAnswerSupervisorIntent,
  type AsoiafAnswerSupervisorRun,
} from "./asoiaf-answer-desk-supervisor.js";
import {
  ASOIAF_ANSWER_TRANSPORT_ADMIT_ROUTE,
  ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE,
  fingerprintAsoiafAnswerTransportCertificate,
  processAsoiafAnswerTransportRequest,
  readAsoiafAnswerTransportStatus,
  validateAsoiafAnswerTransportRequest,
  validateAsoiafAnswerTransportResponse,
  verifyAsoiafAnswerTransportEstate,
  type AsoiafAnswerTransportActorRegistration,
  type AsoiafAnswerTransportCertificateFingerprint,
  type AsoiafAnswerTransportProcessResult,
  type AsoiafAnswerTransportRequest,
  type AsoiafAnswerTransportResponse,
} from "./asoiaf-answer-desk-transport.js";
import {
  buildAsoiafAnswerTransportRendezvous,
  readAsoiafAnswerTransportOperationsStatus,
  validateAsoiafAnswerTransportCertificateAdmission,
  validateAsoiafAnswerTransportEndpointLease,
  validateAsoiafAnswerTransportRendezvous,
  verifyAsoiafAnswerTransportOperationsEstate,
  type AsoiafAnswerTransportCertificateAdmission,
  type AsoiafAnswerTransportCertificateRetirement,
  type AsoiafAnswerTransportEndpointLease,
  type AsoiafAnswerTransportRendezvous,
} from "./asoiaf-answer-desk-transport-operations.js";
import type {
  AsoiafAnswerWorkResultReference,
  AsoiafAnswerWorkSettlement,
} from "./asoiaf-answer-work-lease.js";
import type {
  AsoiafAnswerWorkOrder,
} from "./asoiaf-answer-work-order.js";

export const ASOIAF_ANSWER_SUPERVISED_REQUEST_FORMAT =
  "axm-asoiaf-answer-supervised-delivery-request/1" as const;
export const ASOIAF_ANSWER_SUPERVISED_RESPONSE_FORMAT =
  "axm-asoiaf-answer-supervised-delivery-response/1" as const;
export const ASOIAF_ANSWER_SUPERVISED_ASSIGNMENT_DELIVERY_FORMAT =
  "axm-asoiaf-answer-supervised-assignment-delivery/1" as const;
export const ASOIAF_ANSWER_SUPERVISED_RESULT_RETURN_FORMAT =
  "axm-asoiaf-answer-supervised-result-return/1" as const;

export const ASOIAF_ANSWER_SUPERVISED_PULL_ROUTE =
  "/v1/supervisor/assignments/pull" as const;
export const ASOIAF_ANSWER_SUPERVISED_RETURN_ROUTE =
  "/v1/supervisor/results/return" as const;

const MAX_REQUEST_KEY_CHARACTERS = 256;
const MAX_BODY_BYTES = 8 * 1024 * 1024;

export type AsoiafAnswerSupervisedDeliveryOperation =
  | "pull-assignment"
  | "return-result";

export interface AsoiafAnswerSupervisedDeliveryPaths {
  root: string;
  deliveryRoot: string;
  requests: string;
  responses: string;
  deliveries: string;
  returns: string;
}

export interface AsoiafAnswerSupervisedPullBody {
  intentId: string;
  rendezvousId: string;
}

export interface AsoiafAnswerSupervisedReturnBody {
  deliveryId: string;
  rendezvousId: string;
  completedAt: string;
  outcome: AsoiafAnswerExchangeOutcome;
  afterWorkOrder: AsoiafAnswerWorkOrder | null;
  resultReferences: AsoiafAnswerWorkResultReference[];
  reason: string;
}

export type AsoiafAnswerSupervisedDeliveryBody =
  | AsoiafAnswerSupervisedPullBody
  | AsoiafAnswerSupervisedReturnBody;

export interface AsoiafAnswerSupervisedDeliveryRequest {
  format: typeof ASOIAF_ANSWER_SUPERVISED_REQUEST_FORMAT;
  requestId: string;
  requestFingerprint: `sha256:${string}`;
  operation: AsoiafAnswerSupervisedDeliveryOperation;
  method: "POST";
  route:
    | typeof ASOIAF_ANSWER_SUPERVISED_PULL_ROUTE
    | typeof ASOIAF_ANSWER_SUPERVISED_RETURN_ROUTE;
  idempotencyKeyDigest: `sha256:${string}`;
  peerCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  actorRegistrationId: string;
  actorRegistrationFingerprint: `sha256:${string}`;
  certificateAdmissionId: string;
  certificateAdmissionFingerprint: `sha256:${string}`;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  requestHost: string;
  rendezvousId: string;
  rendezvousFingerprint: `sha256:${string}`;
  endpointLeaseId: string;
  endpointLeaseFingerprint: `sha256:${string}`;
  serverCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  receivedAt: string;
  bodyDigest: `sha256:${string}`;
  body: AsoiafAnswerSupervisedDeliveryBody;
  certificateRetained: false;
  privateKeyRetained: false;
  privateTextIncluded: false;
  sourceTextIncluded: false;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

export interface AsoiafAnswerSupervisedAssignmentDelivery {
  format: typeof ASOIAF_ANSWER_SUPERVISED_ASSIGNMENT_DELIVERY_FORMAT;
  deliveryId: string;
  deliveryFingerprint: `sha256:${string}`;
  requestId: string;
  requestFingerprint: `sha256:${string}`;
  intentId: string;
  intentFingerprint: `sha256:${string}`;
  supervisorRunId: string;
  supervisorRunFingerprint: `sha256:${string}`;
  policyFingerprint: `sha256:${string}`;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  certificateAdmissionId: string;
  certificateAdmissionFingerprint: `sha256:${string}`;
  certificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  rendezvousId: string;
  rendezvousFingerprint: `sha256:${string}`;
  endpointLeaseId: string;
  endpointLeaseFingerprint: `sha256:${string}`;
  assignmentId: string;
  assignmentFingerprint: `sha256:${string}`;
  assignmentUri: string;
  assignment: AsoiafAnswerExchangeAssignment;
  leaseId: string;
  leaseFingerprint: `sha256:${string}`;
  lowerTransportRequestId: string;
  lowerTransportRequestFingerprint: `sha256:${string}`;
  lowerTransportResponseId: string;
  lowerTransportResponseFingerprint: `sha256:${string}`;
  deliveredAt: string;
  supervisorIntentReplayed: boolean;
  supervisorRunReplayed: boolean;
  assignmentReplayed: boolean;
  lowerTransportRequestReplayed: boolean;
  lowerTransportResponseReplayed: boolean;
  certificateRetained: false;
  privateKeyRetained: false;
  privateTextIncluded: false;
  sourceTextIncluded: false;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

export interface AsoiafAnswerSupervisedResultReturn {
  format: typeof ASOIAF_ANSWER_SUPERVISED_RESULT_RETURN_FORMAT;
  returnId: string;
  returnFingerprint: `sha256:${string}`;
  requestId: string;
  requestFingerprint: `sha256:${string}`;
  deliveryId: string;
  deliveryFingerprint: `sha256:${string}`;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  certificateAdmissionId: string;
  certificateAdmissionFingerprint: `sha256:${string}`;
  certificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  rendezvousId: string;
  rendezvousFingerprint: `sha256:${string}`;
  assignmentId: string;
  assignmentFingerprint: `sha256:${string}`;
  lowerTransportRequestId: string;
  lowerTransportRequestFingerprint: `sha256:${string}`;
  lowerTransportResponseId: string;
  lowerTransportResponseFingerprint: `sha256:${string}`;
  resultId: string;
  resultFingerprint: `sha256:${string}`;
  settlementId: string;
  settlementFingerprint: `sha256:${string}`;
  afterWorkOrderId: string | null;
  afterWorkOrderFingerprint: `sha256:${string}` | null;
  completedAt: string;
  lowerTransportRequestReplayed: boolean;
  lowerTransportResponseReplayed: boolean;
  resultReplayed: boolean;
  settlementReplayed: boolean;
  certificateRetained: false;
  privateKeyRetained: false;
  privateTextIncluded: false;
  sourceTextIncluded: false;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

export type AsoiafAnswerSupervisedDeliveryPayload =
  | {
      kind: "assignment-delivery";
      delivery: AsoiafAnswerSupervisedAssignmentDelivery;
      assignment: AsoiafAnswerExchangeAssignment;
      supervisorRun: AsoiafAnswerSupervisorRun;
      lowerTransportRequest: AsoiafAnswerTransportRequest;
      lowerTransportResponse: AsoiafAnswerTransportResponse;
    }
  | {
      kind: "result-return";
      return: AsoiafAnswerSupervisedResultReturn;
      result: AsoiafAnswerExchangeResult;
      settlement: AsoiafAnswerWorkSettlement;
      lowerTransportRequest: AsoiafAnswerTransportRequest;
      lowerTransportResponse: AsoiafAnswerTransportResponse;
    };

export interface AsoiafAnswerSupervisedDeliveryResponse {
  format: typeof ASOIAF_ANSWER_SUPERVISED_RESPONSE_FORMAT;
  responseId: string;
  responseFingerprint: `sha256:${string}`;
  requestId: string;
  requestFingerprint: `sha256:${string}`;
  operation: AsoiafAnswerSupervisedDeliveryOperation;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  certificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  completedAt: string;
  outcome: "succeeded" | "refused";
  httpStatus: 200 | 409;
  payloadKind: "assignment-delivery" | "result-return" | null;
  payloadFingerprint: `sha256:${string}` | null;
  payload: AsoiafAnswerSupervisedDeliveryPayload | null;
  errorCode: string | null;
  errorMessage: string | null;
  certificateRetained: false;
  privateKeyRetained: false;
  privateTextIncluded: false;
  sourceTextIncluded: false;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

export interface AsoiafAnswerSupervisedDeliveryStatus {
  paths: AsoiafAnswerSupervisedDeliveryPaths;
  requests: AsoiafAnswerSupervisedDeliveryRequest[];
  responses: AsoiafAnswerSupervisedDeliveryResponse[];
  deliveries: AsoiafAnswerSupervisedAssignmentDelivery[];
  returns: AsoiafAnswerSupervisedResultReturn[];
}

export interface AsoiafAnswerSupervisedDeliveryFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

export interface AsoiafAnswerSupervisedDeliveryProcessInput {
  root: string;
  certificateFingerprint: string;
  serverCertificateFingerprint?: string;
  requestHost?: string;
  method?: string;
  route: string;
  idempotencyKey: string;
  body: unknown;
  receivedAt?: string;
  completedAt?: string;
  operatorId?: string;
  now?: () => string;
}

export interface AsoiafAnswerSupervisedDeliveryProcessResult {
  request: AsoiafAnswerSupervisedDeliveryRequest;
  response: AsoiafAnswerSupervisedDeliveryResponse;
  requestUri: string;
  responseUri: string;
  requestReplayed: boolean;
  responseReplayed: boolean;
}

export interface AsoiafAnswerSupervisedDeliveryServerConfig {
  root: string;
  certificate: string | Buffer;
  privateKey: string | Buffer;
  clientCertificateAuthority: string | Buffer | Array<string | Buffer>;
  maxBodyBytes?: number;
  operatorId?: string;
  now?: () => string;
}

export interface AsoiafAnswerSupervisedDeliveryRemoteEnvelope {
  ok: boolean;
  request: AsoiafAnswerSupervisedDeliveryRequest | null;
  response: AsoiafAnswerSupervisedDeliveryResponse | null;
  requestReplayed: boolean;
  responseReplayed: boolean;
  error: { code: string; message: string } | null;
}

export interface AsoiafAnswerSupervisedDeliveryClientInput {
  baseUrl: string;
  operation: AsoiafAnswerSupervisedDeliveryOperation;
  idempotencyKey: string;
  body: unknown;
  certificate: string | Buffer;
  privateKey: string | Buffer;
  certificateAuthority: string | Buffer | Array<string | Buffer>;
  timeoutMilliseconds?: number;
}

export interface AsoiafAnswerSupervisedDeliveryClientResult {
  statusCode: number;
  envelope: AsoiafAnswerSupervisedDeliveryRemoteEnvelope;
}

export class AsoiafAnswerSupervisedDeliveryAuthorizationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AsoiafAnswerSupervisedDeliveryAuthorizationError";
    this.code = code;
  }
}

export class AsoiafAnswerSupervisedDeliveryRequestError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AsoiafAnswerSupervisedDeliveryRequestError";
    this.code = code;
  }
}

class AsoiafAnswerSupervisedDeliveryRefusalError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AsoiafAnswerSupervisedDeliveryRefusalError";
    this.code = code;
  }
}

function finding(
  code: string,
  severity: AsoiafAnswerSupervisedDeliveryFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafAnswerSupervisedDeliveryFinding {
  return { code, severity, subjectId, detail };
}

function sortedFindings(
  values: readonly AsoiafAnswerSupervisedDeliveryFinding[],
): AsoiafAnswerSupervisedDeliveryFinding[] {
  const rank = { error: 0, warning: 1, notice: 2 } as const;
  return [...values].sort((left, right) =>
    rank[left.severity] - rank[right.severity]
    || left.code.localeCompare(right.code)
    || left.subjectId.localeCompare(right.subjectId)
    || left.detail.localeCompare(right.detail));
}

function validTime(value: string): boolean {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function normalizeTime(value: string, label: string): string {
  if (!validTime(value)) throw new Error(`${label} is invalid`);
  return new Date(value).toISOString();
}

function validFingerprint(value: string): value is `sha256:${string}` {
  return /^sha256:[a-f0-9]{64}$/.test(value);
}

function normalizeFingerprint(value: string, label: string): `sha256:${string}` {
  const normalized = value.trim().toLowerCase();
  if (!validFingerprint(normalized)) throw new Error(`${label} is invalid`);
  return normalized;
}

function assertIdempotencyKey(value: string): void {
  if (
    value.length < 16
    || value.length > MAX_REQUEST_KEY_CHARACTERS
    || !/^[\x21-\x7e]+$/.test(value)
  ) {
    throw new AsoiafAnswerSupervisedDeliveryRequestError(
      "idempotency-key-invalid",
      "supervised delivery Idempotency-Key must contain 16 through 256 visible ASCII characters",
    );
  }
}

function requireIdentity(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length < 3 || value.trim().length > 512) {
    throw new AsoiafAnswerSupervisedDeliveryRequestError(
      "request-body-invalid",
      `${label} must contain 3 through 512 characters`,
    );
  }
  return value.trim();
}

function exactObject(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AsoiafAnswerSupervisedDeliveryRequestError(
      "request-body-invalid",
      `${label} must be a JSON object`,
    );
  }
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new AsoiafAnswerSupervisedDeliveryRequestError(
      "request-body-selector-refused",
      `${label} contains missing, unknown, or forbidden fields`,
    );
  }
  return record;
}

function normalizeResultReferences(value: unknown): AsoiafAnswerWorkResultReference[] {
  if (!Array.isArray(value)) {
    throw new AsoiafAnswerSupervisedDeliveryRequestError(
      "request-body-invalid",
      "resultReferences must be an array",
    );
  }
  return value.map((entry, index) => {
    const record = exactObject(entry, ["kind", "objectId", "fingerprint", "uri"], `resultReferences[${index}]`);
    const kind = requireIdentity(record.kind, `resultReferences[${index}].kind`);
    const objectId = requireIdentity(record.objectId, `resultReferences[${index}].objectId`);
    const fingerprint = normalizeFingerprint(
      requireIdentity(record.fingerprint, `resultReferences[${index}].fingerprint`),
      `resultReferences[${index}].fingerprint`,
    );
    const uri = record.uri === null
      ? null
      : requireIdentity(record.uri, `resultReferences[${index}].uri`);
    return { kind, objectId, fingerprint, uri };
  }).sort((left, right) =>
    `${left.kind}:${left.objectId}:${left.fingerprint}:${left.uri ?? ""}`.localeCompare(
      `${right.kind}:${right.objectId}:${right.fingerprint}:${right.uri ?? ""}`,
    ));
}

function normalizePullBody(value: unknown): AsoiafAnswerSupervisedPullBody {
  const record = exactObject(value, ["intentId", "rendezvousId"], "assignment pull body");
  return {
    intentId: requireIdentity(record.intentId, "supervisor intent identity"),
    rendezvousId: requireIdentity(record.rendezvousId, "transport rendezvous identity"),
  };
}

function normalizeReturnBody(value: unknown): AsoiafAnswerSupervisedReturnBody {
  const record = exactObject(
    value,
    [
      "deliveryId",
      "rendezvousId",
      "completedAt",
      "outcome",
      "afterWorkOrder",
      "resultReferences",
      "reason",
    ],
    "result return body",
  );
  const outcome = requireIdentity(record.outcome, "result outcome") as AsoiafAnswerExchangeOutcome;
  if (!["satisfied", "preserved-as-limitation", "refused", "failed", "cancelled", "expired", "stale"].includes(outcome)) {
    throw new AsoiafAnswerSupervisedDeliveryRequestError(
      "request-body-invalid",
      "result return outcome is invalid",
    );
  }
  const reason = requireIdentity(record.reason, "result reason");
  if (reason.length < 24 || reason.length > 4096) {
    throw new AsoiafAnswerSupervisedDeliveryRequestError(
      "request-body-invalid",
      "result return reason must contain 24 through 4096 characters",
    );
  }
  const afterWorkOrder = record.afterWorkOrder === null
    ? null
    : record.afterWorkOrder as AsoiafAnswerWorkOrder;
  return {
    deliveryId: requireIdentity(record.deliveryId, "assignment delivery identity"),
    rendezvousId: requireIdentity(record.rendezvousId, "transport rendezvous identity"),
    completedAt: normalizeTime(requireIdentity(record.completedAt, "result completion time"), "result completion time"),
    outcome,
    afterWorkOrder,
    resultReferences: normalizeResultReferences(record.resultReferences),
    reason,
  };
}

function normalizedBody(
  operation: AsoiafAnswerSupervisedDeliveryOperation,
  value: unknown,
): AsoiafAnswerSupervisedDeliveryBody {
  return operation === "pull-assignment"
    ? normalizePullBody(value)
    : normalizeReturnBody(value);
}

function routeForOperation(
  operation: AsoiafAnswerSupervisedDeliveryOperation,
): typeof ASOIAF_ANSWER_SUPERVISED_PULL_ROUTE | typeof ASOIAF_ANSWER_SUPERVISED_RETURN_ROUTE {
  return operation === "pull-assignment"
    ? ASOIAF_ANSWER_SUPERVISED_PULL_ROUTE
    : ASOIAF_ANSWER_SUPERVISED_RETURN_ROUTE;
}

function operationFromRoute(method: string, route: string): AsoiafAnswerSupervisedDeliveryOperation {
  if (method !== "POST") {
    throw new AsoiafAnswerSupervisedDeliveryRequestError(
      "method-not-allowed",
      "supervised delivery accepts only POST",
    );
  }
  if (route === ASOIAF_ANSWER_SUPERVISED_PULL_ROUTE) return "pull-assignment";
  if (route === ASOIAF_ANSWER_SUPERVISED_RETURN_ROUTE) return "return-result";
  throw new AsoiafAnswerSupervisedDeliveryRequestError(
    "route-not-found",
    "supervised delivery route is not supported",
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
    .filter((name) => /^[a-f0-9]{64}\.json$/.test(name))
    .sort()
    .map((name) => readJson<T>(path.join(directory, name)));
}

function writeJsonExclusiveOrReplay<T>(target: string, value: T): { value: T; replayed: boolean } {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  ensureParent(target);
  try {
    fs.writeFileSync(target, serialized, { encoding: "utf8", flag: "wx" });
    return { value, replayed: false };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = fs.readFileSync(target, "utf8");
    if (existing !== serialized) {
      throw new Error(`answer supervised delivery immutable file collision at ${target}`);
    }
    return { value: JSON.parse(existing) as T, replayed: true };
  }
}

function relativeUri(root: string, target: string): string {
  return path.relative(path.resolve(root), path.resolve(target)).split(path.sep).join("/");
}

function resolveUri(root: string, uri: string): string | null {
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, uri);
  return target === absoluteRoot || target.startsWith(`${absoluteRoot}${path.sep}`)
    ? target
    : null;
}

export function asoiafAnswerSupervisedDeliveryPaths(
  root: string,
): AsoiafAnswerSupervisedDeliveryPaths {
  const absolute = path.resolve(root);
  const deliveryRoot = path.join(absolute, "answer-supervised-delivery");
  return {
    root: absolute,
    deliveryRoot,
    requests: path.join(deliveryRoot, "requests"),
    responses: path.join(deliveryRoot, "responses"),
    deliveries: path.join(deliveryRoot, "deliveries"),
    returns: path.join(deliveryRoot, "returns"),
  };
}

function digestPath(directory: string, digest: string): string {
  return path.join(directory, `${normalizeFingerprint(digest, "object digest").slice("sha256:".length)}.json`);
}

function requestPath(paths: AsoiafAnswerSupervisedDeliveryPaths, keyDigest: `sha256:${string}`): string {
  return digestPath(paths.requests, keyDigest);
}

function responsePath(paths: AsoiafAnswerSupervisedDeliveryPaths, requestFingerprint: `sha256:${string}`): string {
  return digestPath(paths.responses, requestFingerprint);
}

function deliveryPath(paths: AsoiafAnswerSupervisedDeliveryPaths, deliveryFingerprint: `sha256:${string}`): string {
  return digestPath(paths.deliveries, deliveryFingerprint);
}

function returnPath(paths: AsoiafAnswerSupervisedDeliveryPaths, returnFingerprint: `sha256:${string}`): string {
  return digestPath(paths.returns, returnFingerprint);
}

function retirementAt(
  retirements: readonly AsoiafAnswerTransportCertificateRetirement[],
  certificateFingerprint: string,
): AsoiafAnswerTransportCertificateRetirement | null {
  return retirements.find((entry) => entry.certificateFingerprint === certificateFingerprint) ?? null;
}

function activeAt(
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

interface AuthenticatedCustody {
  registration: AsoiafAnswerTransportActorRegistration;
  admission: AsoiafAnswerTransportCertificateAdmission;
}

function authenticatedCustody(
  root: string,
  certificateFingerprint: AsoiafAnswerTransportCertificateFingerprint,
  at: string,
): AuthenticatedCustody {
  const transport = readAsoiafAnswerTransportStatus(root);
  const operations = readAsoiafAnswerTransportOperationsStatus(root);
  const registration = transport.registrations.find(
    (entry) => entry.certificateFingerprint === certificateFingerprint,
  ) ?? null;
  if (!registration) {
    throw new AsoiafAnswerSupervisedDeliveryAuthorizationError(
      "actor-not-registered",
      "authenticated certificate is not registered to an answer-desk actor",
    );
  }
  if (Date.parse(at) < Date.parse(registration.registeredAt)) {
    throw new AsoiafAnswerSupervisedDeliveryAuthorizationError(
      "actor-registration-not-active",
      "authenticated actor registration is not active at receipt time",
    );
  }
  const revocation = transport.revocations.find(
    (entry) => entry.certificateFingerprint === certificateFingerprint,
  );
  if (revocation && Date.parse(at) >= Date.parse(revocation.revokedAt)) {
    throw new AsoiafAnswerSupervisedDeliveryAuthorizationError(
      "actor-certificate-revoked",
      "authenticated certificate has been revoked",
    );
  }
  const admission = operations.certificates.find(
    (entry) => entry.certificateFingerprint === certificateFingerprint,
  ) ?? null;
  if (!admission || admission.usage !== "client-auth" || !admission.actorRole) {
    throw new AsoiafAnswerSupervisedDeliveryAuthorizationError(
      "actor-certificate-not-admitted",
      "authenticated certificate lacks one active client admission",
    );
  }
  const admissionErrors = validateAsoiafAnswerTransportCertificateAdmission(
    admission,
    registration,
  ).filter((entry) => entry.severity === "error");
  if (admissionErrors.length > 0 || !activeAt(
    admission,
    retirementAt(operations.retirements, certificateFingerprint),
    at,
  )) {
    throw new AsoiafAnswerSupervisedDeliveryAuthorizationError(
      "actor-certificate-not-active",
      "authenticated certificate admission is invalid, inactive, expired, or retired",
    );
  }
  if (
    registration.actorId !== admission.principalId
    || registration.actorRole !== admission.actorRole
    || registration.registrationId !== admission.transportRegistrationId
    || registration.registrationFingerprint !== admission.transportRegistrationFingerprint
  ) {
    throw new AsoiafAnswerSupervisedDeliveryAuthorizationError(
      "actor-certificate-custody-mismatch",
      "authenticated actor registration differs from certificate admission custody",
    );
  }
  return { registration, admission };
}

interface RendezvousCustody {
  rendezvous: AsoiafAnswerTransportRendezvous;
  endpoint: AsoiafAnswerTransportEndpointLease;
}

function normalizeHost(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized || /[\s/?#]/.test(normalized)) {
    throw new AsoiafAnswerSupervisedDeliveryRequestError(
      "request-host-invalid",
      "supervised delivery request host is invalid",
    );
  }
  return normalized;
}

function rendezvousCustody(input: {
  root: string;
  rendezvousId: string;
  authenticated: AuthenticatedCustody;
  at: string;
  requestHost?: string;
  serverCertificateFingerprint?: string;
}): RendezvousCustody {
  const status = readAsoiafAnswerTransportOperationsStatus(input.root);
  const matches = status.rendezvous.filter((entry) => entry.rendezvousId === input.rendezvousId);
  if (matches.length !== 1) {
    throw new AsoiafAnswerSupervisedDeliveryAuthorizationError(
      "rendezvous-not-found",
      "named transport rendezvous is absent or duplicated",
    );
  }
  const rendezvous = matches[0]!;
  let expected: AsoiafAnswerTransportRendezvous;
  try {
    expected = buildAsoiafAnswerTransportRendezvous({
      root: input.root,
      serverId: rendezvous.serverId,
      clientCertificateFingerprint: rendezvous.clientCertificateFingerprint,
      generatedAt: rendezvous.generatedAt,
      maxObservationAgeMilliseconds: rendezvous.maxObservationAgeMilliseconds,
      operatorId: rendezvous.operatorId,
    });
  } catch (error) {
    throw new AsoiafAnswerSupervisedDeliveryAuthorizationError(
      "rendezvous-invalid",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (validateAsoiafAnswerTransportRendezvous(rendezvous, expected).some(
    (entry) => entry.severity === "error",
  )) {
    throw new AsoiafAnswerSupervisedDeliveryAuthorizationError(
      "rendezvous-invalid",
      "named transport rendezvous fails deterministic reconstruction",
    );
  }
  if (
    rendezvous.clientCertificateAdmissionId !== input.authenticated.admission.admissionId
    || rendezvous.clientCertificateAdmissionFingerprint !== input.authenticated.admission.admissionFingerprint
    || rendezvous.clientCertificateFingerprint !== input.authenticated.admission.certificateFingerprint
    || rendezvous.clientActorId !== input.authenticated.registration.actorId
    || rendezvous.clientActorRole !== input.authenticated.registration.actorRole
  ) {
    throw new AsoiafAnswerSupervisedDeliveryAuthorizationError(
      "rendezvous-actor-mismatch",
      "named rendezvous belongs to another certificate-bound actor",
    );
  }
  if (
    Date.parse(input.at) < Date.parse(rendezvous.generatedAt)
    || Date.parse(input.at) - Date.parse(rendezvous.generatedAt)
      > rendezvous.maxObservationAgeMilliseconds
  ) {
    throw new AsoiafAnswerSupervisedDeliveryAuthorizationError(
      "rendezvous-stale",
      "named rendezvous is not fresh at receipt time",
    );
  }
  if (
    !rendezvous.selectedEndpointLeaseId
    || !rendezvous.selectedEndpointLeaseFingerprint
    || !rendezvous.selectedBaseUrl
  ) {
    throw new AsoiafAnswerSupervisedDeliveryAuthorizationError(
      "rendezvous-unavailable",
      "named rendezvous has no eligible selected endpoint",
    );
  }
  const endpoint = status.endpoints.find(
    (entry) => entry.endpointLeaseId === rendezvous.selectedEndpointLeaseId,
  ) ?? null;
  if (
    !endpoint
    || endpoint.endpointLeaseFingerprint !== rendezvous.selectedEndpointLeaseFingerprint
    || endpoint.baseUrl !== rendezvous.selectedBaseUrl
  ) {
    throw new AsoiafAnswerSupervisedDeliveryAuthorizationError(
      "rendezvous-endpoint-mismatch",
      "named rendezvous differs from its retained endpoint lease",
    );
  }
  const serverAdmission = status.certificates.find(
    (entry) => entry.admissionId === endpoint.serverCertificateAdmissionId,
  ) ?? null;
  if (
    !serverAdmission
    || validateAsoiafAnswerTransportEndpointLease(endpoint, serverAdmission).some(
      (entry) => entry.severity === "error",
    )
    || !activeAt(
      serverAdmission,
      retirementAt(status.retirements, serverAdmission.certificateFingerprint),
      input.at,
    )
    || Date.parse(input.at) < Date.parse(endpoint.availableFrom)
    || Date.parse(input.at) >= Date.parse(endpoint.expiresAt)
  ) {
    throw new AsoiafAnswerSupervisedDeliveryAuthorizationError(
      "rendezvous-endpoint-inactive",
      "selected endpoint or server certificate is not active at receipt time",
    );
  }
  const selectedHost = normalizeHost(new URL(rendezvous.selectedBaseUrl).host);
  const requestHost = input.requestHost
    ? normalizeHost(input.requestHost)
    : selectedHost;
  if (requestHost !== selectedHost) {
    throw new AsoiafAnswerSupervisedDeliveryAuthorizationError(
      "rendezvous-host-mismatch",
      "request host differs from the selected rendezvous endpoint",
    );
  }
  const serverFingerprint = input.serverCertificateFingerprint
    ? normalizeFingerprint(input.serverCertificateFingerprint, "server certificate fingerprint")
    : endpoint.serverCertificateFingerprint;
  if (serverFingerprint !== endpoint.serverCertificateFingerprint) {
    throw new AsoiafAnswerSupervisedDeliveryAuthorizationError(
      "rendezvous-server-certificate-mismatch",
      "current server certificate differs from selected endpoint custody",
    );
  }
  return { rendezvous, endpoint };
}

function requestCore(
  request: AsoiafAnswerSupervisedDeliveryRequest,
): Omit<AsoiafAnswerSupervisedDeliveryRequest, "requestId" | "requestFingerprint"> {
  const { requestId: _id, requestFingerprint: _fingerprint, ...core } = request;
  return core;
}

function buildRequest(input: {
  operation: AsoiafAnswerSupervisedDeliveryOperation;
  idempotencyKeyDigest: `sha256:${string}`;
  authenticated: AuthenticatedCustody;
  rendezvous: AsoiafAnswerTransportRendezvous;
  endpoint: AsoiafAnswerTransportEndpointLease;
  requestHost: string;
  serverCertificateFingerprint: AsoiafAnswerTransportCertificateFingerprint;
  receivedAt: string;
  body: AsoiafAnswerSupervisedDeliveryBody;
}): AsoiafAnswerSupervisedDeliveryRequest {
  const route = routeForOperation(input.operation);
  const core = {
    format: ASOIAF_ANSWER_SUPERVISED_REQUEST_FORMAT,
    operation: input.operation,
    method: "POST" as const,
    route,
    idempotencyKeyDigest: input.idempotencyKeyDigest,
    peerCertificateFingerprint: input.authenticated.registration.certificateFingerprint,
    actorRegistrationId: input.authenticated.registration.registrationId,
    actorRegistrationFingerprint: input.authenticated.registration.registrationFingerprint,
    certificateAdmissionId: input.authenticated.admission.admissionId,
    certificateAdmissionFingerprint: input.authenticated.admission.admissionFingerprint,
    actorId: input.authenticated.registration.actorId,
    actorRole: input.authenticated.registration.actorRole,
    requestHost: normalizeHost(input.requestHost),
    rendezvousId: input.rendezvous.rendezvousId,
    rendezvousFingerprint: input.rendezvous.rendezvousFingerprint,
    endpointLeaseId: input.endpoint.endpointLeaseId,
    endpointLeaseFingerprint: input.endpoint.endpointLeaseFingerprint,
    serverCertificateFingerprint: input.serverCertificateFingerprint,
    receivedAt: normalizeTime(input.receivedAt, "supervised delivery receipt time"),
    bodyDigest: sha256(input.body),
    body: input.body,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
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
    requestId: collectorContentId("asoiaf-answer-supervised-request", {
      idempotencyKeyDigest: core.idempotencyKeyDigest,
      requestFingerprint,
    }),
    requestFingerprint,
  };
}

function deliveryCore(
  delivery: AsoiafAnswerSupervisedAssignmentDelivery,
): Omit<AsoiafAnswerSupervisedAssignmentDelivery, "deliveryId" | "deliveryFingerprint"> {
  const { deliveryId: _id, deliveryFingerprint: _fingerprint, ...core } = delivery;
  return core;
}

function resultReturnCore(
  value: AsoiafAnswerSupervisedResultReturn,
): Omit<AsoiafAnswerSupervisedResultReturn, "returnId" | "returnFingerprint"> {
  const { returnId: _id, returnFingerprint: _fingerprint, ...core } = value;
  return core;
}

function responseCore(
  response: AsoiafAnswerSupervisedDeliveryResponse,
): Omit<AsoiafAnswerSupervisedDeliveryResponse, "responseId" | "responseFingerprint"> {
  const { responseId: _id, responseFingerprint: _fingerprint, ...core } = response;
  return core;
}

function payloadFingerprint(
  payload: AsoiafAnswerSupervisedDeliveryPayload,
): `sha256:${string}` {
  return payload.kind === "assignment-delivery"
    ? payload.delivery.deliveryFingerprint
    : payload.return.returnFingerprint;
}

function buildResponse(input: {
  request: AsoiafAnswerSupervisedDeliveryRequest;
  completedAt: string;
  payload?: AsoiafAnswerSupervisedDeliveryPayload | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}): AsoiafAnswerSupervisedDeliveryResponse {
  const payload = input.payload ?? null;
  const refused = !payload;
  const core = {
    format: ASOIAF_ANSWER_SUPERVISED_RESPONSE_FORMAT,
    requestId: input.request.requestId,
    requestFingerprint: input.request.requestFingerprint,
    operation: input.request.operation,
    actorId: input.request.actorId,
    actorRole: input.request.actorRole,
    certificateFingerprint: input.request.peerCertificateFingerprint,
    completedAt: normalizeTime(input.completedAt, "supervised delivery response time"),
    outcome: refused ? "refused" as const : "succeeded" as const,
    httpStatus: refused ? 409 as const : 200 as const,
    payloadKind: payload?.kind ?? null,
    payloadFingerprint: payload ? payloadFingerprint(payload) : null,
    payload,
    errorCode: refused ? input.errorCode ?? "supervised-delivery-refused" : null,
    errorMessage: refused ? input.errorMessage ?? "supervised delivery operation was refused" : null,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    privateTextIncluded: false as const,
    sourceTextIncluded: false as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const responseFingerprint = sha256(core);
  return {
    ...core,
    responseId: collectorContentId("asoiaf-answer-supervised-response", {
      requestId: core.requestId,
      outcome: core.outcome,
      responseFingerprint,
    }),
    responseFingerprint,
  };
}

function lowerIdempotencyKey(
  operation: "issue" | "return",
  request: AsoiafAnswerSupervisedDeliveryRequest,
): string {
  return `asoiaf-supervised-${operation}:${request.requestFingerprint.slice("sha256:".length)}`;
}

function supervisorIntent(root: string, intentId: string): AsoiafAnswerSupervisorIntent {
  const matches = readAsoiafAnswerSupervisorStatus(root).intents.filter(
    (entry) => entry.intentId === intentId,
  );
  if (matches.length !== 1) {
    throw new AsoiafAnswerSupervisedDeliveryRefusalError(
      "intent-not-found",
      "prepared supervisor intent is absent or duplicated",
    );
  }
  const intent = matches[0]!;
  if (validateAsoiafAnswerSupervisorIntent(intent).some((entry) => entry.severity === "error")) {
    throw new AsoiafAnswerSupervisedDeliveryRefusalError(
      "intent-invalid",
      "prepared supervisor intent fails deterministic validation",
    );
  }
  return intent;
}

function assignmentFromRun(
  root: string,
  run: AsoiafAnswerSupervisorRun,
  issue: AsoiafAnswerExchangeIssueResult | null,
): { assignment: AsoiafAnswerExchangeAssignment; assignmentUri: string; replayed: boolean } {
  if (issue) {
    return {
      assignment: issue.assignment,
      assignmentUri: issue.assignmentUri,
      replayed: issue.assignmentReplayed,
    };
  }
  const reference = run.operationReferences.find(
    (entry) => entry.kind === "answer-exchange-assignment",
  );
  if (!reference) {
    throw new AsoiafAnswerSupervisedDeliveryRefusalError(
      "supervisor-run-assignment-missing",
      "supervisor run does not retain one exchange assignment",
    );
  }
  const assignment = readAsoiafAnswerExchangeStatus(root).assignments.find(
    (entry) => entry.assignmentId === reference.objectId
      && entry.assignmentFingerprint === reference.fingerprint,
  );
  if (!assignment) {
    throw new AsoiafAnswerSupervisedDeliveryRefusalError(
      "supervisor-run-assignment-missing",
      "supervisor assignment reference is absent from exchange custody",
    );
  }
  const target = path.join(
    path.resolve(root),
    "answer-exchange",
    "assignments",
    `${assignment.assignmentFingerprint.slice("sha256:".length)}.json`,
  );
  return {
    assignment,
    assignmentUri: relativeUri(root, target),
    replayed: true,
  };
}

function lowerIssue(input: {
  root: string;
  request: AsoiafAnswerSupervisedDeliveryRequest;
  intent: AsoiafAnswerSupervisorIntent;
  operatorId: string;
}): AsoiafAnswerTransportProcessResult {
  const decision = input.intent.decision;
  const processed = processAsoiafAnswerTransportRequest({
    root: input.root,
    certificateFingerprint: input.request.peerCertificateFingerprint,
    method: "POST",
    route: ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE,
    idempotencyKey: lowerIdempotencyKey("issue", input.request),
    body: {
      itemId: decision.itemId,
      claimedAt: input.intent.requestedAt,
      issuedAt: input.intent.requestedAt,
      leaseMilliseconds: decision.leaseMilliseconds,
    },
    receivedAt: input.request.receivedAt,
    completedAt: input.request.receivedAt,
    operatorId: `${input.operatorId}:lower-pull`,
  });
  if (processed.response.outcome !== "succeeded") {
    throw new AsoiafAnswerSupervisedDeliveryRefusalError(
      "lower-pull-refused",
      processed.response.errorMessage ?? "lower transport refused prepared assignment dispatch",
    );
  }
  return processed;
}

function buildDelivery(input: {
  request: AsoiafAnswerSupervisedDeliveryRequest;
  intent: AsoiafAnswerSupervisorIntent;
  run: AsoiafAnswerSupervisorRun;
  assignment: AsoiafAnswerExchangeAssignment;
  assignmentUri: string;
  lower: AsoiafAnswerTransportProcessResult;
  deliveredAt: string;
  intentReplayed: boolean;
  runReplayed: boolean;
  assignmentReplayed: boolean;
}): AsoiafAnswerSupervisedAssignmentDelivery {
  const core = {
    format: ASOIAF_ANSWER_SUPERVISED_ASSIGNMENT_DELIVERY_FORMAT,
    requestId: input.request.requestId,
    requestFingerprint: input.request.requestFingerprint,
    intentId: input.intent.intentId,
    intentFingerprint: input.intent.intentFingerprint,
    supervisorRunId: input.run.runId,
    supervisorRunFingerprint: input.run.runFingerprint,
    policyFingerprint: input.intent.policyFingerprint,
    actorId: input.request.actorId,
    actorRole: input.request.actorRole,
    certificateAdmissionId: input.request.certificateAdmissionId,
    certificateAdmissionFingerprint: input.request.certificateAdmissionFingerprint,
    certificateFingerprint: input.request.peerCertificateFingerprint,
    rendezvousId: input.request.rendezvousId,
    rendezvousFingerprint: input.request.rendezvousFingerprint,
    endpointLeaseId: input.request.endpointLeaseId,
    endpointLeaseFingerprint: input.request.endpointLeaseFingerprint,
    assignmentId: input.assignment.assignmentId,
    assignmentFingerprint: input.assignment.assignmentFingerprint,
    assignmentUri: input.assignmentUri,
    assignment: input.assignment,
    leaseId: input.assignment.leaseId,
    leaseFingerprint: input.assignment.leaseFingerprint,
    lowerTransportRequestId: input.lower.request.requestId,
    lowerTransportRequestFingerprint: input.lower.request.requestFingerprint,
    lowerTransportResponseId: input.lower.response.responseId,
    lowerTransportResponseFingerprint: input.lower.response.responseFingerprint,
    deliveredAt: normalizeTime(input.deliveredAt, "assignment delivery time"),
    supervisorIntentReplayed: input.intentReplayed,
    supervisorRunReplayed: input.runReplayed,
    assignmentReplayed: input.assignmentReplayed,
    lowerTransportRequestReplayed: input.lower.requestReplayed,
    lowerTransportResponseReplayed: input.lower.responseReplayed,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    privateTextIncluded: false as const,
    sourceTextIncluded: false as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const deliveryFingerprint = sha256(core);
  return {
    ...core,
    deliveryId: collectorContentId("asoiaf-answer-supervised-delivery", {
      requestId: core.requestId,
      assignmentId: core.assignmentId,
      deliveryFingerprint,
    }),
    deliveryFingerprint,
  };
}

function executePull(
  root: string,
  request: AsoiafAnswerSupervisedDeliveryRequest,
  operatorId: string,
): AsoiafAnswerSupervisedDeliveryPayload {
  const body = request.body as AsoiafAnswerSupervisedPullBody;
  const intent = supervisorIntent(root, body.intentId);
  if (intent.decision.kind !== "issue-external") {
    throw new AsoiafAnswerSupervisedDeliveryRefusalError(
      "intent-not-external",
      "prepared supervisor intent is not one external issue decision",
    );
  }
  if (
    intent.decision.actorId !== request.actorId
    || intent.decision.actorRole !== request.actorRole
  ) {
    throw new AsoiafAnswerSupervisedDeliveryRefusalError(
      "intent-actor-mismatch",
      "authenticated actor does not own the prepared supervisor intent",
    );
  }
  const tick = tickAsoiafAnswerDeskSupervisor({
    root,
    requestKey: intent.requestKey,
    policy: intent.policy,
    requestedAt: intent.requestedAt,
    automaticCompletedAt: intent.automaticCompletedAt,
    operatorId: intent.operatorId,
  });
  if (
    tick.run.decisionKind !== "issue-external"
    || tick.run.intentId !== intent.intentId
    || validateAsoiafAnswerSupervisorRun(tick.run, intent).some(
      (entry) => entry.severity === "error",
    )
  ) {
    throw new AsoiafAnswerSupervisedDeliveryRefusalError(
      "supervisor-run-mismatch",
      "supervisor execution differs from the prepared external intent",
    );
  }
  const assignmentCustody = assignmentFromRun(root, tick.run, tick.externalIssue);
  const assignment = assignmentCustody.assignment;
  if (
    validateAsoiafAnswerExchangeAssignment(assignment).some(
      (entry) => entry.severity === "error",
    )
    || assignment.itemId !== intent.decision.itemId
    || assignment.actorId !== request.actorId
    || assignment.actorRole !== request.actorRole
    || assignment.claimedAt !== intent.requestedAt
    || assignment.issuedAt !== intent.requestedAt
    || assignment.leaseMilliseconds !== intent.decision.leaseMilliseconds
    || tick.run.leaseId !== assignment.leaseId
  ) {
    throw new AsoiafAnswerSupervisedDeliveryRefusalError(
      "assignment-intent-mismatch",
      "exchange assignment differs from exact supervisor intent custody",
    );
  }
  const lower = lowerIssue({ root, request, intent, operatorId });
  const lowerPayload = lower.response.payload as AsoiafAnswerExchangeIssueResult | null;
  if (
    !lowerPayload
    || lowerPayload.assignment.assignmentId !== assignment.assignmentId
    || lowerPayload.assignment.assignmentFingerprint !== assignment.assignmentFingerprint
  ) {
    throw new AsoiafAnswerSupervisedDeliveryRefusalError(
      "lower-assignment-mismatch",
      "lower authenticated transport differs from supervisor assignment custody",
    );
  }
  const delivery = buildDelivery({
    request,
    intent,
    run: tick.run,
    assignment,
    assignmentUri: assignmentCustody.assignmentUri,
    lower,
    deliveredAt: request.receivedAt,
    intentReplayed: tick.intentReplayed,
    runReplayed: tick.runReplayed,
    assignmentReplayed: assignmentCustody.replayed,
  });
  const paths = asoiafAnswerSupervisedDeliveryPaths(root);
  const persisted = writeJsonExclusiveOrReplay(
    deliveryPath(paths, delivery.deliveryFingerprint),
    delivery,
  );
  return {
    kind: "assignment-delivery",
    delivery: persisted.value,
    assignment,
    supervisorRun: tick.run,
    lowerTransportRequest: lower.request,
    lowerTransportResponse: lower.response,
  };
}

function findDelivery(root: string, deliveryId: string): AsoiafAnswerSupervisedAssignmentDelivery {
  const matches = readAsoiafAnswerSupervisedDeliveryStatus(root).deliveries.filter(
    (entry) => entry.deliveryId === deliveryId,
  );
  if (matches.length !== 1) {
    throw new AsoiafAnswerSupervisedDeliveryRefusalError(
      "delivery-not-found",
      "assignment delivery is absent or duplicated",
    );
  }
  return matches[0]!;
}

function lowerReturn(input: {
  root: string;
  request: AsoiafAnswerSupervisedDeliveryRequest;
  delivery: AsoiafAnswerSupervisedAssignmentDelivery;
  body: AsoiafAnswerSupervisedReturnBody;
  operatorId: string;
}): AsoiafAnswerTransportProcessResult {
  const processed = processAsoiafAnswerTransportRequest({
    root: input.root,
    certificateFingerprint: input.request.peerCertificateFingerprint,
    method: "POST",
    route: ASOIAF_ANSWER_TRANSPORT_ADMIT_ROUTE,
    idempotencyKey: lowerIdempotencyKey("return", input.request),
    body: {
      assignmentId: input.delivery.assignmentId,
      completedAt: input.body.completedAt,
      outcome: input.body.outcome,
      afterWorkOrder: input.body.afterWorkOrder,
      resultReferences: input.body.resultReferences,
      reason: input.body.reason,
    },
    receivedAt: input.request.receivedAt,
    completedAt: input.request.receivedAt,
    operatorId: `${input.operatorId}:lower-return`,
  });
  if (processed.response.outcome !== "succeeded") {
    throw new AsoiafAnswerSupervisedDeliveryRefusalError(
      "lower-result-refused",
      processed.response.errorMessage ?? "lower transport refused typed result return",
    );
  }
  return processed;
}

function buildResultReturn(input: {
  request: AsoiafAnswerSupervisedDeliveryRequest;
  delivery: AsoiafAnswerSupervisedAssignmentDelivery;
  lower: AsoiafAnswerTransportProcessResult;
  admit: AsoiafAnswerExchangeAdmitResult;
  completedAt: string;
}): AsoiafAnswerSupervisedResultReturn {
  const settlement = input.admit.settlement.settlement;
  const result = input.admit.result;
  const core = {
    format: ASOIAF_ANSWER_SUPERVISED_RESULT_RETURN_FORMAT,
    requestId: input.request.requestId,
    requestFingerprint: input.request.requestFingerprint,
    deliveryId: input.delivery.deliveryId,
    deliveryFingerprint: input.delivery.deliveryFingerprint,
    actorId: input.request.actorId,
    actorRole: input.request.actorRole,
    certificateAdmissionId: input.request.certificateAdmissionId,
    certificateAdmissionFingerprint: input.request.certificateAdmissionFingerprint,
    certificateFingerprint: input.request.peerCertificateFingerprint,
    rendezvousId: input.request.rendezvousId,
    rendezvousFingerprint: input.request.rendezvousFingerprint,
    assignmentId: input.delivery.assignmentId,
    assignmentFingerprint: input.delivery.assignmentFingerprint,
    lowerTransportRequestId: input.lower.request.requestId,
    lowerTransportRequestFingerprint: input.lower.request.requestFingerprint,
    lowerTransportResponseId: input.lower.response.responseId,
    lowerTransportResponseFingerprint: input.lower.response.responseFingerprint,
    resultId: result.resultId,
    resultFingerprint: result.resultFingerprint,
    settlementId: settlement.settlementId,
    settlementFingerprint: settlement.settlementFingerprint,
    afterWorkOrderId: result.afterWorkOrderId,
    afterWorkOrderFingerprint: result.afterWorkOrderFingerprint,
    completedAt: normalizeTime(input.completedAt, "result return completion time"),
    lowerTransportRequestReplayed: input.lower.requestReplayed,
    lowerTransportResponseReplayed: input.lower.responseReplayed,
    resultReplayed: input.admit.resultReplayed,
    settlementReplayed: input.admit.settlement.replayed,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    privateTextIncluded: false as const,
    sourceTextIncluded: false as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const returnFingerprint = sha256(core);
  return {
    ...core,
    returnId: collectorContentId("asoiaf-answer-supervised-return", {
      requestId: core.requestId,
      deliveryId: core.deliveryId,
      resultId: core.resultId,
      returnFingerprint,
    }),
    returnFingerprint,
  };
}

function executeReturn(
  root: string,
  request: AsoiafAnswerSupervisedDeliveryRequest,
  operatorId: string,
): AsoiafAnswerSupervisedDeliveryPayload {
  const body = request.body as AsoiafAnswerSupervisedReturnBody;
  const delivery = findDelivery(root, body.deliveryId);
  if (
    delivery.actorId !== request.actorId
    || delivery.actorRole !== request.actorRole
    || delivery.certificateFingerprint !== request.peerCertificateFingerprint
    || delivery.certificateAdmissionId !== request.certificateAdmissionId
    || delivery.certificateAdmissionFingerprint !== request.certificateAdmissionFingerprint
    || delivery.rendezvousId !== request.rendezvousId
    || delivery.rendezvousFingerprint !== request.rendezvousFingerprint
  ) {
    throw new AsoiafAnswerSupervisedDeliveryRefusalError(
      "delivery-owner-mismatch",
      "authenticated actor, certificate, or rendezvous does not own the retained delivery",
    );
  }
  if (Date.parse(body.completedAt) > Date.parse(request.receivedAt)) {
    throw new AsoiafAnswerSupervisedDeliveryRefusalError(
      "result-completion-in-future",
      "result completion time follows the authenticated return receipt time",
    );
  }
  const lower = lowerReturn({ root, request, delivery, body, operatorId });
  const admit = lower.response.payload as AsoiafAnswerExchangeAdmitResult | null;
  if (
    !admit
    || admit.result.assignmentId !== delivery.assignmentId
    || admit.result.actorId !== request.actorId
    || admit.result.actorRole !== request.actorRole
    || validateAsoiafAnswerExchangeResult(root, admit.result, delivery.assignment).some(
      (entry) => entry.severity === "error",
    )
  ) {
    throw new AsoiafAnswerSupervisedDeliveryRefusalError(
      "result-delivery-mismatch",
      "typed external result differs from retained assignment delivery custody",
    );
  }
  const value = buildResultReturn({
    request,
    delivery,
    lower,
    admit,
    completedAt: request.receivedAt,
  });
  const paths = asoiafAnswerSupervisedDeliveryPaths(root);
  const persisted = writeJsonExclusiveOrReplay(
    returnPath(paths, value.returnFingerprint),
    value,
  );
  return {
    kind: "result-return",
    return: persisted.value,
    result: admit.result,
    settlement: admit.settlement.settlement,
    lowerTransportRequest: lower.request,
    lowerTransportResponse: lower.response,
  };
}

function executeRequest(
  root: string,
  request: AsoiafAnswerSupervisedDeliveryRequest,
  operatorId: string,
): AsoiafAnswerSupervisedDeliveryPayload {
  return request.operation === "pull-assignment"
    ? executePull(root, request, operatorId)
    : executeReturn(root, request, operatorId);
}

function retainedResponseForRequest(
  root: string,
  request: AsoiafAnswerSupervisedDeliveryRequest,
): AsoiafAnswerSupervisedDeliveryResponse | null {
  const matches = readAsoiafAnswerSupervisedDeliveryStatus(root).responses.filter(
    (entry) => entry.requestId === request.requestId,
  );
  if (matches.length > 1) {
    throw new Error(`supervised delivery request ${request.requestId} has duplicate responses`);
  }
  return matches[0] ?? null;
}

function persistResponse(
  root: string,
  response: AsoiafAnswerSupervisedDeliveryResponse,
): { response: AsoiafAnswerSupervisedDeliveryResponse; replayed: boolean; uri: string } {
  const target = responsePath(
    asoiafAnswerSupervisedDeliveryPaths(root),
    response.requestFingerprint,
  );
  const persisted = writeJsonExclusiveOrReplay(target, response);
  return {
    response: persisted.value,
    replayed: persisted.replayed,
    uri: relativeUri(root, target),
  };
}

function historicalCustodyForExisting(
  root: string,
  request: AsoiafAnswerSupervisedDeliveryRequest,
): { authenticated: AuthenticatedCustody; rendezvous: RendezvousCustody } {
  const authenticated = authenticatedCustody(
    root,
    request.peerCertificateFingerprint,
    request.receivedAt,
  );
  if (
    authenticated.registration.registrationId !== request.actorRegistrationId
    || authenticated.registration.registrationFingerprint !== request.actorRegistrationFingerprint
    || authenticated.admission.admissionId !== request.certificateAdmissionId
    || authenticated.admission.admissionFingerprint !== request.certificateAdmissionFingerprint
  ) {
    throw new Error(`retained supervised delivery request ${request.requestId} differs from historical actor custody`);
  }
  const rendezvous = rendezvousCustody({
    root,
    rendezvousId: request.rendezvousId,
    authenticated,
    at: request.receivedAt,
    requestHost: request.requestHost,
    serverCertificateFingerprint: request.serverCertificateFingerprint,
  });
  return { authenticated, rendezvous };
}

export function processAsoiafAnswerSupervisedDeliveryRequest(
  input: AsoiafAnswerSupervisedDeliveryProcessInput,
): AsoiafAnswerSupervisedDeliveryProcessResult {
  const clock = input.now ?? (() => new Date().toISOString());
  const method = (input.method ?? "POST").toUpperCase();
  const operation = operationFromRoute(method, input.route);
  assertIdempotencyKey(input.idempotencyKey);
  const body = normalizedBody(operation, input.body);
  const certificateFingerprint = normalizeFingerprint(
    input.certificateFingerprint,
    "authenticated certificate fingerprint",
  );
  const paths = asoiafAnswerSupervisedDeliveryPaths(input.root);
  const idempotencyKeyDigest = sha256(input.idempotencyKey);
  const target = requestPath(paths, idempotencyKeyDigest);
  let request: AsoiafAnswerSupervisedDeliveryRequest;
  let requestReplayed = false;

  if (fs.existsSync(target)) {
    const existing = readJson<AsoiafAnswerSupervisedDeliveryRequest>(target);
    if (
      existing.operation !== operation
      || existing.method !== method
      || existing.route !== input.route
      || existing.idempotencyKeyDigest !== idempotencyKeyDigest
      || existing.peerCertificateFingerprint !== certificateFingerprint
      || existing.bodyDigest !== sha256(body)
      || JSON.stringify(existing.body) !== JSON.stringify(body)
    ) {
      throw new AsoiafAnswerSupervisedDeliveryRequestError(
        "idempotency-key-conflict",
        "Idempotency-Key is already bound to a different actor, route, method, or body",
      );
    }
    historicalCustodyForExisting(input.root, existing);
    request = existing;
    requestReplayed = true;
  } else {
    const receivedAt = normalizeTime(input.receivedAt ?? clock(), "supervised delivery receipt time");
    const authenticated = authenticatedCustody(
      input.root,
      certificateFingerprint,
      receivedAt,
    );
    const rendezvousId = operation === "pull-assignment"
      ? (body as AsoiafAnswerSupervisedPullBody).rendezvousId
      : (body as AsoiafAnswerSupervisedReturnBody).rendezvousId;
    const rendezvous = rendezvousCustody({
      root: input.root,
      rendezvousId,
      authenticated,
      at: receivedAt,
      requestHost: input.requestHost,
      serverCertificateFingerprint: input.serverCertificateFingerprint,
    });
    const requestHost = input.requestHost
      ? normalizeHost(input.requestHost)
      : normalizeHost(new URL(rendezvous.rendezvous.selectedBaseUrl!).host);
    const serverCertificateFingerprint = input.serverCertificateFingerprint
      ? normalizeFingerprint(input.serverCertificateFingerprint, "server certificate fingerprint")
      : rendezvous.endpoint.serverCertificateFingerprint;
    const built = buildRequest({
      operation,
      idempotencyKeyDigest,
      authenticated,
      rendezvous: rendezvous.rendezvous,
      endpoint: rendezvous.endpoint,
      requestHost,
      serverCertificateFingerprint,
      receivedAt,
      body,
    });
    const persisted = writeJsonExclusiveOrReplay(target, built);
    if (JSON.stringify(persisted.value) !== JSON.stringify(built)) {
      throw new AsoiafAnswerSupervisedDeliveryRequestError(
        "idempotency-key-conflict",
        "Idempotency-Key became bound to a different supervised delivery request",
      );
    }
    request = persisted.value;
    requestReplayed = persisted.replayed;
  }

  const retained = retainedResponseForRequest(input.root, request);
  if (retained) {
    return {
      request,
      response: retained,
      requestUri: relativeUri(input.root, target),
      responseUri: relativeUri(input.root, responsePath(paths, request.requestFingerprint)),
      requestReplayed: true,
      responseReplayed: true,
    };
  }

  let response: AsoiafAnswerSupervisedDeliveryResponse;
  try {
    const payload = executeRequest(
      input.root,
      request,
      input.operatorId ?? "operator:answer-supervised-delivery",
    );
    response = buildResponse({
      request,
      completedAt: input.completedAt ?? clock(),
      payload,
    });
  } catch (error) {
    const code = error instanceof AsoiafAnswerSupervisedDeliveryRefusalError
      ? error.code
      : "supervised-delivery-operation-refused";
    response = buildResponse({
      request,
      completedAt: input.completedAt ?? clock(),
      errorCode: code,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
  const persisted = persistResponse(input.root, response);
  return {
    request,
    response: persisted.response,
    requestUri: relativeUri(input.root, target),
    responseUri: persisted.uri,
    requestReplayed,
    responseReplayed: persisted.replayed,
  };
}

function validateRequest(
  root: string,
  request: AsoiafAnswerSupervisedDeliveryRequest,
): AsoiafAnswerSupervisedDeliveryFinding[] {
  const findings: AsoiafAnswerSupervisedDeliveryFinding[] = [];
  let expected: AsoiafAnswerSupervisedDeliveryRequest | null = null;
  try {
    const custody = historicalCustodyForExisting(root, request);
    expected = buildRequest({
      operation: request.operation,
      idempotencyKeyDigest: request.idempotencyKeyDigest,
      authenticated: custody.authenticated,
      rendezvous: custody.rendezvous.rendezvous,
      endpoint: custody.rendezvous.endpoint,
      requestHost: request.requestHost,
      serverCertificateFingerprint: request.serverCertificateFingerprint,
      receivedAt: request.receivedAt,
      body: normalizedBody(request.operation, request.body),
    });
  } catch (error) {
    findings.push(finding(
      "supervised-request-input",
      "error",
      request.requestId,
      error instanceof Error ? error.message : String(error),
    ));
  }
  if (request.format !== ASOIAF_ANSWER_SUPERVISED_REQUEST_FORMAT) {
    findings.push(finding("supervised-request-format", "error", request.requestId, "supervised delivery request format is invalid"));
  }
  if (expected && JSON.stringify(expected) !== JSON.stringify(request)) {
    findings.push(finding("supervised-request-projection", "error", request.requestId, "supervised request differs from authenticated actor, rendezvous, endpoint, or body custody"));
  }
  if (request.requestFingerprint !== sha256(requestCore(request))) {
    findings.push(finding("supervised-request-fingerprint", "error", request.requestId, "supervised request fingerprint is stale"));
  }
  if (
    request.certificateRetained !== false
    || request.privateKeyRetained !== false
    || request.privateTextIncluded !== false
    || request.sourceTextIncluded !== false
    || request.authority !== "none"
    || request.graphEffect !== "none"
    || request.canonEffect !== "none"
    || request.answerEffect !== "none"
  ) {
    findings.push(finding("supervised-request-authority", "error", request.requestId, "supervised request retained secrets, text, or task authority"));
  }
  return sortedFindings(findings);
}

function validateDelivery(
  root: string,
  delivery: AsoiafAnswerSupervisedAssignmentDelivery,
): AsoiafAnswerSupervisedDeliveryFinding[] {
  const findings: AsoiafAnswerSupervisedDeliveryFinding[] = [];
  const status = readAsoiafAnswerSupervisedDeliveryStatus(root);
  const request = status.requests.find((entry) => entry.requestId === delivery.requestId);
  const intent = readAsoiafAnswerSupervisorStatus(root).intents.find(
    (entry) => entry.intentId === delivery.intentId,
  );
  const run = readAsoiafAnswerSupervisorStatus(root).runs.find(
    (entry) => entry.runId === delivery.supervisorRunId,
  );
  const assignment = readAsoiafAnswerExchangeStatus(root).assignments.find(
    (entry) => entry.assignmentId === delivery.assignmentId,
  );
  const transport = readAsoiafAnswerTransportStatus(root);
  const lowerRequest = transport.requests.find(
    (entry) => entry.requestId === delivery.lowerTransportRequestId,
  );
  const lowerResponse = transport.responses.find(
    (entry) => entry.responseId === delivery.lowerTransportResponseId,
  );
  const lowerRegistration = lowerRequest
    ? transport.registrations.find(
        (entry) => entry.registrationId === lowerRequest.actorRegistrationId,
      ) ?? null
    : null;
  if (!request || !intent || !run || !assignment || !lowerRequest || !lowerResponse || !lowerRegistration) {
    findings.push(finding("supervised-delivery-orphan", "error", delivery.deliveryId, "assignment delivery references missing request, intent, run, assignment, or lower transport custody"));
  } else {
    if (
      request.requestFingerprint !== delivery.requestFingerprint
      || intent.intentFingerprint !== delivery.intentFingerprint
      || run.runFingerprint !== delivery.supervisorRunFingerprint
      || assignment.assignmentFingerprint !== delivery.assignmentFingerprint
      || JSON.stringify(assignment) !== JSON.stringify(delivery.assignment)
      || lowerRequest.requestFingerprint !== delivery.lowerTransportRequestFingerprint
      || lowerResponse.responseFingerprint !== delivery.lowerTransportResponseFingerprint
      || delivery.actorId !== request.actorId
      || delivery.actorRole !== request.actorRole
      || delivery.certificateFingerprint !== request.peerCertificateFingerprint
      || delivery.rendezvousId !== request.rendezvousId
      || delivery.rendezvousFingerprint !== request.rendezvousFingerprint
      || delivery.endpointLeaseId !== request.endpointLeaseId
      || delivery.endpointLeaseFingerprint !== request.endpointLeaseFingerprint
      || delivery.assignmentId !== assignment.assignmentId
      || delivery.leaseId !== assignment.leaseId
      || delivery.leaseFingerprint !== assignment.leaseFingerprint
      || run.intentId !== intent.intentId
      || run.leaseId !== assignment.leaseId
    ) {
      findings.push(finding("supervised-delivery-custody", "error", delivery.deliveryId, "assignment delivery differs from request, intent, run, assignment, lease, or lower transport custody"));
    }
    for (const lower of [
      ...validateAsoiafAnswerTransportRequest(lowerRequest, lowerRegistration),
      ...validateAsoiafAnswerTransportResponse(lowerResponse, lowerRequest),
    ]) {
      if (lower.severity === "error") {
        findings.push(finding(`supervised-delivery-lower-${lower.code}`, "error", delivery.deliveryId, lower.detail));
      }
    }
  }
  if (delivery.format !== ASOIAF_ANSWER_SUPERVISED_ASSIGNMENT_DELIVERY_FORMAT) {
    findings.push(finding("supervised-delivery-format", "error", delivery.deliveryId, "assignment delivery format is invalid"));
  }
  if (delivery.deliveryFingerprint !== sha256(deliveryCore(delivery))) {
    findings.push(finding("supervised-delivery-fingerprint", "error", delivery.deliveryId, "assignment delivery fingerprint is stale"));
  }
  const resolvedAssignment = resolveUri(root, delivery.assignmentUri);
  if (!resolvedAssignment || !fs.existsSync(resolvedAssignment)) {
    findings.push(finding("supervised-delivery-assignment-uri", "error", delivery.deliveryId, "assignment delivery URI is absent or escapes the estate"));
  }
  if (
    delivery.certificateRetained !== false
    || delivery.privateKeyRetained !== false
    || delivery.privateTextIncluded !== false
    || delivery.sourceTextIncluded !== false
    || delivery.authority !== "none"
    || delivery.graphEffect !== "none"
    || delivery.canonEffect !== "none"
    || delivery.answerEffect !== "none"
  ) {
    findings.push(finding("supervised-delivery-authority", "error", delivery.deliveryId, "assignment delivery retained secrets, text, or task authority"));
  }
  return sortedFindings(findings);
}

function validateResultReturn(
  root: string,
  value: AsoiafAnswerSupervisedResultReturn,
): AsoiafAnswerSupervisedDeliveryFinding[] {
  const findings: AsoiafAnswerSupervisedDeliveryFinding[] = [];
  const deliveryStatus = readAsoiafAnswerSupervisedDeliveryStatus(root);
  const request = deliveryStatus.requests.find((entry) => entry.requestId === value.requestId);
  const delivery = deliveryStatus.deliveries.find((entry) => entry.deliveryId === value.deliveryId);
  const exchange = readAsoiafAnswerExchangeStatus(root);
  const result = exchange.results.find((entry) => entry.resultId === value.resultId);
  const desk = readAsoiafAnswerDeskStatus(root);
  const settlement = desk.settlements.find((entry) => entry.settlementId === value.settlementId);
  const transport = readAsoiafAnswerTransportStatus(root);
  const lowerRequest = transport.requests.find((entry) => entry.requestId === value.lowerTransportRequestId);
  const lowerResponse = transport.responses.find((entry) => entry.responseId === value.lowerTransportResponseId);
  if (!request || !delivery || !result || !settlement || !lowerRequest || !lowerResponse) {
    findings.push(finding("supervised-return-orphan", "error", value.returnId, "result return references missing request, delivery, result, settlement, or lower transport custody"));
  } else {
    if (
      request.requestFingerprint !== value.requestFingerprint
      || delivery.deliveryFingerprint !== value.deliveryFingerprint
      || result.resultFingerprint !== value.resultFingerprint
      || settlement.settlementFingerprint !== value.settlementFingerprint
      || lowerRequest.requestFingerprint !== value.lowerTransportRequestFingerprint
      || lowerResponse.responseFingerprint !== value.lowerTransportResponseFingerprint
      || value.actorId !== request.actorId
      || value.actorRole !== request.actorRole
      || value.certificateFingerprint !== request.peerCertificateFingerprint
      || value.rendezvousId !== request.rendezvousId
      || value.assignmentId !== delivery.assignmentId
      || result.assignmentId !== delivery.assignmentId
      || settlement.leaseId !== delivery.leaseId
      || value.afterWorkOrderId !== result.afterWorkOrderId
      || value.afterWorkOrderFingerprint !== result.afterWorkOrderFingerprint
    ) {
      findings.push(finding("supervised-return-custody", "error", value.returnId, "result return differs from request, delivery, result, settlement, or lower transport custody"));
    }
  }
  if (value.format !== ASOIAF_ANSWER_SUPERVISED_RESULT_RETURN_FORMAT) {
    findings.push(finding("supervised-return-format", "error", value.returnId, "result return format is invalid"));
  }
  if (value.returnFingerprint !== sha256(resultReturnCore(value))) {
    findings.push(finding("supervised-return-fingerprint", "error", value.returnId, "result return fingerprint is stale"));
  }
  if (
    value.certificateRetained !== false
    || value.privateKeyRetained !== false
    || value.privateTextIncluded !== false
    || value.sourceTextIncluded !== false
    || value.authority !== "none"
    || value.graphEffect !== "none"
    || value.canonEffect !== "none"
    || value.answerEffect !== "none"
  ) {
    findings.push(finding("supervised-return-authority", "error", value.returnId, "result return retained secrets, text, or task authority"));
  }
  return sortedFindings(findings);
}

function validateResponse(
  root: string,
  response: AsoiafAnswerSupervisedDeliveryResponse,
  request: AsoiafAnswerSupervisedDeliveryRequest,
): AsoiafAnswerSupervisedDeliveryFinding[] {
  const findings: AsoiafAnswerSupervisedDeliveryFinding[] = [];
  if (
    response.format !== ASOIAF_ANSWER_SUPERVISED_RESPONSE_FORMAT
    || response.requestId !== request.requestId
    || response.requestFingerprint !== request.requestFingerprint
    || response.operation !== request.operation
    || response.actorId !== request.actorId
    || response.actorRole !== request.actorRole
    || response.certificateFingerprint !== request.peerCertificateFingerprint
    || !validTime(response.completedAt)
    || Date.parse(response.completedAt) < Date.parse(request.receivedAt)
  ) {
    findings.push(finding("supervised-response-custody", "error", response.responseId, "supervised response differs from request or completion custody"));
  }
  if (response.outcome === "succeeded") {
    if (
      !response.payload
      || !response.payloadKind
      || !response.payloadFingerprint
      || response.errorCode !== null
      || response.errorMessage !== null
      || response.httpStatus !== 200
    ) {
      findings.push(finding("supervised-response-success", "error", response.responseId, "successful supervised response lacks exact payload custody"));
    } else if (response.payloadFingerprint !== payloadFingerprint(response.payload)) {
      findings.push(finding("supervised-response-payload", "error", response.responseId, "supervised response payload fingerprint is stale"));
    }
  } else if (
    response.payload !== null
    || response.payloadKind !== null
    || response.payloadFingerprint !== null
    || !response.errorCode
    || !response.errorMessage
    || response.httpStatus !== 409
  ) {
    findings.push(finding("supervised-response-refusal", "error", response.responseId, "refused supervised response acquired payload custody or lacks an error"));
  }
  if (response.responseFingerprint !== sha256(responseCore(response))) {
    findings.push(finding("supervised-response-fingerprint", "error", response.responseId, "supervised response fingerprint is stale"));
  }
  if (
    response.certificateRetained !== false
    || response.privateKeyRetained !== false
    || response.privateTextIncluded !== false
    || response.sourceTextIncluded !== false
    || response.authority !== "none"
    || response.graphEffect !== "none"
    || response.canonEffect !== "none"
    || response.answerEffect !== "none"
  ) {
    findings.push(finding("supervised-response-authority", "error", response.responseId, "supervised response retained secrets, text, or task authority"));
  }
  return sortedFindings(findings);
}

export function readAsoiafAnswerSupervisedDeliveryStatus(
  root: string,
): AsoiafAnswerSupervisedDeliveryStatus {
  const paths = asoiafAnswerSupervisedDeliveryPaths(root);
  return {
    paths,
    requests: listJson<AsoiafAnswerSupervisedDeliveryRequest>(paths.requests),
    responses: listJson<AsoiafAnswerSupervisedDeliveryResponse>(paths.responses),
    deliveries: listJson<AsoiafAnswerSupervisedAssignmentDelivery>(paths.deliveries),
    returns: listJson<AsoiafAnswerSupervisedResultReturn>(paths.returns),
  };
}

function verifyDigestDirectory(input: {
  directory: string;
  expected: Set<string>;
  code: string;
}): AsoiafAnswerSupervisedDeliveryFinding[] {
  const findings: AsoiafAnswerSupervisedDeliveryFinding[] = [];
  if (!fs.existsSync(input.directory)) return findings;
  for (const name of fs.readdirSync(input.directory).sort()) {
    if (!/^[a-f0-9]{64}\.json$/.test(name)) {
      findings.push(finding(`${input.code}-unsafe-name`, "error", name, "delivery directory contains a non-digest JSON filename"));
    } else if (!input.expected.has(name)) {
      findings.push(finding(`${input.code}-orphan-name`, "error", name, "delivery filename does not match reconstructed custody"));
    }
  }
  return findings;
}

function scanForSecretMaterial(root: string): AsoiafAnswerSupervisedDeliveryFinding[] {
  const findings: AsoiafAnswerSupervisedDeliveryFinding[] = [];
  if (!fs.existsSync(root)) return findings;
  const walk = (directory: string): void => {
    for (const name of fs.readdirSync(directory).sort()) {
      const target = path.join(directory, name);
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        walk(target);
      } else if (/\.(key|pem|crt|cer|csr|p12|pfx)$/i.test(name)) {
        findings.push(finding("supervised-secret-file", "error", relativeUri(root, target), "delivery estate contains certificate or private-key material"));
      } else if (stat.size <= 2_000_000) {
        const text = fs.readFileSync(target, "utf8");
        if (/-----BEGIN (?:CERTIFICATE|CERTIFICATE REQUEST|PRIVATE KEY|RSA PRIVATE KEY|EC PRIVATE KEY)-----/.test(text)) {
          findings.push(finding("supervised-secret-payload", "error", relativeUri(root, target), "delivery estate contains PEM certificate or private-key material"));
        }
      }
    }
  };
  walk(root);
  return findings;
}

export function verifyAsoiafAnswerSupervisedDeliveryEstate(
  root: string,
): AsoiafAnswerSupervisedDeliveryFinding[] {
  const findings: AsoiafAnswerSupervisedDeliveryFinding[] = [];
  for (const lower of verifyAsoiafAnswerTransportOperationsEstate(root)) {
    findings.push(finding(`supervised-lower-operations-${lower.code}`, lower.severity, lower.objectId, lower.message));
  }
  for (const lower of verifyAsoiafAnswerSupervisorEstate(root)) {
    findings.push(finding(`supervised-lower-supervisor-${lower.code}`, lower.severity, lower.subjectId, lower.detail));
  }
  for (const lower of verifyAsoiafAnswerExchangeEstate(root)) {
    findings.push(finding(`supervised-lower-exchange-${lower.code}`, lower.severity, lower.subjectId, lower.detail));
  }
  for (const lower of verifyAsoiafAnswerTransportEstate(root)) {
    findings.push(finding(`supervised-lower-transport-${lower.code}`, lower.severity, lower.subjectId, lower.detail));
  }
  for (const lower of verifyAsoiafAnswerDeskEstate(root)) {
    findings.push(finding(`supervised-lower-desk-${lower.code}`, lower.severity, lower.subjectId, lower.detail));
  }
  const status = readAsoiafAnswerSupervisedDeliveryStatus(root);
  const requestById = new Map<string, AsoiafAnswerSupervisedDeliveryRequest>();
  for (const request of status.requests) {
    if (requestById.has(request.requestId)) {
      findings.push(finding("supervised-request-duplicate", "error", request.requestId, "supervised request identity is duplicated"));
    }
    requestById.set(request.requestId, request);
    findings.push(...validateRequest(root, request));
  }
  const responseByRequest = new Map<string, AsoiafAnswerSupervisedDeliveryResponse>();
  for (const response of status.responses) {
    const request = requestById.get(response.requestId);
    if (!request) {
      findings.push(finding("supervised-response-orphan", "error", response.responseId, "supervised response references a missing request"));
      continue;
    }
    if (responseByRequest.has(response.requestId)) {
      findings.push(finding("supervised-response-duplicate", "error", response.responseId, "supervised request has multiple responses"));
    }
    responseByRequest.set(response.requestId, response);
    findings.push(...validateResponse(root, response, request));
  }
  for (const request of status.requests) {
    if (!responseByRequest.has(request.requestId)) {
      findings.push(finding("supervised-request-incomplete", "warning", request.requestId, "supervised request has no retained terminal response"));
    }
  }
  for (const delivery of status.deliveries) findings.push(...validateDelivery(root, delivery));
  for (const value of status.returns) findings.push(...validateResultReturn(root, value));

  const successfulPayloads = status.responses
    .filter((entry) => entry.outcome === "succeeded" && entry.payload)
    .map((entry) => entry.payload!);
  const deliveryIds = new Set(successfulPayloads
    .filter((entry): entry is Extract<AsoiafAnswerSupervisedDeliveryPayload, { kind: "assignment-delivery" }> => entry.kind === "assignment-delivery")
    .map((entry) => entry.delivery.deliveryId));
  const returnIds = new Set(successfulPayloads
    .filter((entry): entry is Extract<AsoiafAnswerSupervisedDeliveryPayload, { kind: "result-return" }> => entry.kind === "result-return")
    .map((entry) => entry.return.returnId));
  for (const delivery of status.deliveries) {
    if (!deliveryIds.has(delivery.deliveryId)) {
      findings.push(finding("supervised-delivery-orphan-response", "error", delivery.deliveryId, "assignment delivery lacks its successful response"));
    }
  }
  for (const value of status.returns) {
    if (!returnIds.has(value.returnId)) {
      findings.push(finding("supervised-return-orphan-response", "error", value.returnId, "result return lacks its successful response"));
    }
  }

  findings.push(...verifyDigestDirectory({
    directory: status.paths.requests,
    expected: new Set(status.requests.map((entry) => `${entry.idempotencyKeyDigest.slice("sha256:".length)}.json`)),
    code: "supervised-request-name",
  }));
  findings.push(...verifyDigestDirectory({
    directory: status.paths.responses,
    expected: new Set(status.responses.map((entry) => `${entry.requestFingerprint.slice("sha256:".length)}.json`)),
    code: "supervised-response-name",
  }));
  findings.push(...verifyDigestDirectory({
    directory: status.paths.deliveries,
    expected: new Set(status.deliveries.map((entry) => `${entry.deliveryFingerprint.slice("sha256:".length)}.json`)),
    code: "supervised-delivery-name",
  }));
  findings.push(...verifyDigestDirectory({
    directory: status.paths.returns,
    expected: new Set(status.returns.map((entry) => `${entry.returnFingerprint.slice("sha256:".length)}.json`)),
    code: "supervised-return-name",
  }));
  findings.push(...scanForSecretMaterial(status.paths.deliveryRoot));
  return sortedFindings(findings);
}

function peerCertificateFingerprint(
  request: IncomingMessage,
): AsoiafAnswerTransportCertificateFingerprint {
  const socket = request.socket as tls.TLSSocket;
  if (!socket.authorized) {
    throw new AsoiafAnswerSupervisedDeliveryAuthorizationError(
      "tls-peer-unauthorized",
      "mutual TLS peer is not authorized by the configured client CA",
    );
  }
  const certificate = socket.getPeerCertificate(true);
  if (!certificate.raw || certificate.raw.length === 0) {
    throw new AsoiafAnswerSupervisedDeliveryAuthorizationError(
      "tls-peer-certificate-missing",
      "mutual TLS peer certificate is absent",
    );
  }
  return `sha256:${crypto.createHash("sha256").update(certificate.raw).digest("hex")}`;
}

async function readRequestBody(request: IncomingMessage, maxBodyBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBodyBytes) {
      throw new AsoiafAnswerSupervisedDeliveryRequestError(
        "request-body-too-large",
        `supervised delivery request exceeds ${maxBodyBytes} bytes`,
      );
    }
    chunks.push(buffer);
  }
  if (total === 0) {
    throw new AsoiafAnswerSupervisedDeliveryRequestError(
      "request-body-missing",
      "supervised delivery request requires one JSON body",
    );
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new AsoiafAnswerSupervisedDeliveryRequestError(
      "request-json-invalid",
      "supervised delivery request body is not valid JSON",
    );
  }
}

function sendJson(response: ServerResponse, statusCode: number, value: unknown): void {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  response.end(body);
}

function errorStatus(error: unknown): number {
  if (error instanceof AsoiafAnswerSupervisedDeliveryAuthorizationError) return 403;
  if (error instanceof AsoiafAnswerSupervisedDeliveryRequestError) {
    if (error.code === "route-not-found") return 404;
    if (error.code === "method-not-allowed") return 405;
    return 400;
  }
  return 500;
}

function errorCode(error: unknown): string {
  if (
    error instanceof AsoiafAnswerSupervisedDeliveryAuthorizationError
    || error instanceof AsoiafAnswerSupervisedDeliveryRequestError
  ) return error.code;
  return "supervised-delivery-internal-error";
}

function publicErrorMessage(error: unknown): string {
  if (
    error instanceof AsoiafAnswerSupervisedDeliveryAuthorizationError
    || error instanceof AsoiafAnswerSupervisedDeliveryRequestError
  ) return error.message;
  return "supervised delivery could not process the authenticated request";
}

export function createAsoiafAnswerSupervisedDeliveryServer(
  config: AsoiafAnswerSupervisedDeliveryServerConfig,
): https.Server {
  const maxBodyBytes = config.maxBodyBytes ?? MAX_BODY_BYTES;
  const clock = config.now ?? (() => new Date().toISOString());
  const serverCertificateFingerprint = fingerprintAsoiafAnswerTransportCertificate(
    config.certificate,
  );
  return https.createServer(
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
            "https://answer-supervised-delivery.invalid",
          );
          if (requestUrl.search) {
            throw new AsoiafAnswerSupervisedDeliveryRequestError(
              "query-string-refused",
              "supervised delivery routes do not accept query parameters",
            );
          }
          const contentType = request.headers["content-type"] ?? "";
          if (!String(contentType).toLowerCase().startsWith("application/json")) {
            throw new AsoiafAnswerSupervisedDeliveryRequestError(
              "content-type-refused",
              "supervised delivery requires application/json",
            );
          }
          const key = request.headers["idempotency-key"];
          if (Array.isArray(key) || typeof key !== "string") {
            throw new AsoiafAnswerSupervisedDeliveryRequestError(
              "idempotency-key-missing",
              "supervised delivery requires one Idempotency-Key header",
            );
          }
          const host = request.headers.host;
          if (!host) {
            throw new AsoiafAnswerSupervisedDeliveryRequestError(
              "request-host-missing",
              "supervised delivery requires one Host header",
            );
          }
          const body = await readRequestBody(request, maxBodyBytes);
          const processed = processAsoiafAnswerSupervisedDeliveryRequest({
            root: config.root,
            certificateFingerprint: fingerprint,
            serverCertificateFingerprint,
            requestHost: host,
            method: request.method,
            route: requestUrl.pathname,
            idempotencyKey: key,
            body,
            receivedAt: clock(),
            operatorId: config.operatorId ?? "operator:answer-supervised-delivery-server",
            now: clock,
          });
          const envelope: AsoiafAnswerSupervisedDeliveryRemoteEnvelope = {
            ok: processed.response.outcome === "succeeded",
            request: processed.request,
            response: processed.response,
            requestReplayed: processed.requestReplayed,
            responseReplayed: processed.responseReplayed,
            error: processed.response.outcome === "refused"
              ? {
                  code: processed.response.errorCode ?? "supervised-delivery-refused",
                  message: processed.response.errorMessage ?? "supervised delivery was refused",
                }
              : null,
          };
          sendJson(response, processed.response.httpStatus, envelope);
        } catch (error) {
          const envelope: AsoiafAnswerSupervisedDeliveryRemoteEnvelope = {
            ok: false,
            request: null,
            response: null,
            requestReplayed: false,
            responseReplayed: false,
            error: { code: errorCode(error), message: publicErrorMessage(error) },
          };
          sendJson(response, errorStatus(error), envelope);
        }
      })();
    },
  );
}

export async function listenAsoiafAnswerSupervisedDeliveryServer(
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
    throw new Error("supervised delivery server did not expose a TCP address");
  }
  return { host, port: address.port };
}

export async function requestAsoiafAnswerSupervisedDelivery(
  input: AsoiafAnswerSupervisedDeliveryClientInput,
): Promise<AsoiafAnswerSupervisedDeliveryClientResult> {
  assertIdempotencyKey(input.idempotencyKey);
  const route = routeForOperation(input.operation);
  const body = normalizedBody(input.operation, input.body);
  const serialized = JSON.stringify(body);
  const endpoint = new URL(route, input.baseUrl.endsWith("/") ? input.baseUrl : `${input.baseUrl}/`);
  return await new Promise<AsoiafAnswerSupervisedDeliveryClientResult>((resolve, reject) => {
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
        agent: false,
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
            const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as AsoiafAnswerSupervisedDeliveryRemoteEnvelope;
            resolve({ statusCode: response.statusCode ?? 0, envelope: parsed });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("timeout", () => request.destroy(new Error("supervised delivery request timed out")));
    request.on("error", reject);
    request.end(serialized);
  });
}
