import fs from "node:fs";
import path from "node:path";
import {
  collectorContentId,
  sha256,
} from "./asoiaf-external-estate.js";
import {
  readAsoiafAnswerSupervisedDeliveryStatus,
  verifyAsoiafAnswerSupervisedDeliveryEstate,
  type AsoiafAnswerSupervisedAssignmentDelivery,
  type AsoiafAnswerSupervisedResultReturn,
  type AsoiafAnswerSupervisedReturnBody,
} from "./asoiaf-answer-desk-supervised-delivery.js";
import {
  readAsoiafAnswerExchangeStatus,
  type AsoiafAnswerExchangeActorRole,
  type AsoiafAnswerExchangeOutcome,
  type AsoiafAnswerExchangeResult,
} from "./asoiaf-answer-desk-exchange.js";
import {
  readAsoiafAnswerCredentialProviderStatus,
  verifyAsoiafAnswerCredentialProviderHostEstate,
  type AsoiafAnswerCredentialProviderProfile,
  type AsoiafAnswerCredentialProviderResult,
} from "./asoiaf-answer-credential-provider-host.js";
import {
  readAsoiafAnswerCredentialBrokerStatus,
  type AsoiafAnswerCredentialBrokerBinding,
} from "./asoiaf-answer-credential-broker.js";
import {
  validateAsoiafAnswerWorkOrder,
  type AsoiafAnswerWorkOrder,
} from "./asoiaf-answer-work-order.js";
import type {
  AsoiafAnswerWorkResultReference,
} from "./asoiaf-answer-work-lease.js";

export const ASOIAF_ANSWER_ACTOR_RUNTIME_SLOT_FORMAT =
  "axm-asoiaf-answer-actor-runtime-slot/1" as const;
export const ASOIAF_ANSWER_ACTOR_RUNTIME_ACCEPTANCE_FORMAT =
  "axm-asoiaf-answer-actor-runtime-acceptance/1" as const;
export const ASOIAF_ANSWER_ACTOR_RUNTIME_EXECUTION_INTENT_FORMAT =
  "axm-asoiaf-answer-actor-runtime-execution-intent/1" as const;
export const ASOIAF_ANSWER_ACTOR_RUNTIME_RESULT_FORMAT =
  "axm-asoiaf-answer-actor-runtime-result/1" as const;
export const ASOIAF_ANSWER_ACTOR_RUNTIME_RETURN_INTENT_FORMAT =
  "axm-asoiaf-answer-actor-runtime-return-intent/1" as const;
export const ASOIAF_ANSWER_ACTOR_RUNTIME_RETURN_RECEIPT_FORMAT =
  "axm-asoiaf-answer-actor-runtime-return-receipt/1" as const;
export const ASOIAF_ANSWER_ACTOR_RUNTIME_RETIREMENT_FORMAT =
  "axm-asoiaf-answer-actor-runtime-retirement/1" as const;
export const ASOIAF_ANSWER_ACTOR_RUNTIME_STRANDED_FORMAT =
  "axm-asoiaf-answer-actor-runtime-stranded-assignment/1" as const;
export const ASOIAF_ANSWER_ACTOR_RUNTIME_STATE_FORMAT =
  "axm-asoiaf-answer-actor-runtime-state/1" as const;

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

export type AsoiafAnswerActorCredentialRelationship =
  | "same-principal"
  | "explicit-delegation";

export interface AsoiafAnswerActorRuntimePaths {
  root: string;
  runtimeRoot: string;
  slots: string;
  acceptances: string;
  executionIntents: string;
  results: string;
  returnIntents: string;
  returnReceipts: string;
  retirements: string;
  stranded: string;
  state: string;
}

export interface AsoiafAnswerActorRuntimeSlot extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_RUNTIME_SLOT_FORMAT;
  slotId: string;
  slotFingerprint: `sha256:${string}`;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  deliveryCertificateFingerprint: `sha256:${string}`;
  providerProfileId: string;
  providerProfileFingerprint: `sha256:${string}`;
  brokerBindingId: string;
  brokerBindingFingerprint: `sha256:${string}`;
  providerPrincipalId: string;
  providerActorRole: string | null;
  credentialRelationship: AsoiafAnswerActorCredentialRelationship;
  delegationReason: string | null;
  predecessorSlotId: string | null;
  predecessorSlotFingerprint: `sha256:${string}` | null;
  createdAt: string;
  operatorId: string;
  localBindingOnly: true;
  certificateRetained: false;
  privateKeyRetained: false;
  rawProviderSelectorRetained: false;
  providerSecretRetained: false;
  rawTaskInputRetained: false;
  rawTaskOutputRetained: false;
  slotAuthority: "local-runtime-binding-only";
}

export interface AsoiafAnswerActorRuntimeAcceptance extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_RUNTIME_ACCEPTANCE_FORMAT;
  acceptanceId: string;
  acceptanceFingerprint: `sha256:${string}`;
  slotId: string;
  slotFingerprint: `sha256:${string}`;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  deliveryCertificateFingerprint: `sha256:${string}`;
  deliveryId: string;
  deliveryFingerprint: `sha256:${string}`;
  assignmentId: string;
  assignmentFingerprint: `sha256:${string}`;
  leaseId: string;
  leaseFingerprint: `sha256:${string}`;
  itemId: string;
  itemFingerprint: `sha256:${string}`;
  action: AsoiafAnswerSupervisedAssignmentDelivery["assignment"]["action"];
  stage: AsoiafAnswerSupervisedAssignmentDelivery["assignment"]["stage"];
  acceptedResultKinds: string[];
  rendezvousId: string;
  rendezvousFingerprint: `sha256:${string}`;
  deliveredAt: string;
  assignmentExpiresAt: string;
  importedAt: string;
  operatorId: string;
  sourceTextIncluded: false;
  privateTextIncluded: false;
  rawTaskInputRetained: false;
  acceptanceAuthority: "assignment-custody-only";
}

export interface AsoiafAnswerActorRuntimeExecutionIntent extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_RUNTIME_EXECUTION_INTENT_FORMAT;
  executionIntentId: string;
  executionIntentFingerprint: `sha256:${string}`;
  acceptanceId: string;
  acceptanceFingerprint: `sha256:${string}`;
  slotId: string;
  slotFingerprint: `sha256:${string}`;
  providerProfileId: string;
  providerProfileFingerprint: `sha256:${string}`;
  adapterId: string;
  adapterVersion: string;
  inputDigest: `sha256:${string}`;
  inputBytes: number;
  preparedAt: string;
  expiresAt: string;
  operatorId: string;
  rawInputRetained: false;
  executionAuthority: "adapter-invocation-request-only";
}

export interface AsoiafAnswerActorRuntimeResult extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_RUNTIME_RESULT_FORMAT;
  runtimeResultId: string;
  runtimeResultFingerprint: `sha256:${string}`;
  executionIntentId: string;
  executionIntentFingerprint: `sha256:${string}`;
  acceptanceId: string;
  acceptanceFingerprint: `sha256:${string}`;
  slotId: string;
  slotFingerprint: `sha256:${string}`;
  providerProfileId: string;
  providerProfileFingerprint: `sha256:${string}`;
  providerResultId: string;
  providerResultFingerprint: `sha256:${string}`;
  outcome: AsoiafAnswerExchangeOutcome;
  afterWorkOrderId: string | null;
  afterWorkOrderFingerprint: `sha256:${string}` | null;
  afterWorkOrder: AsoiafAnswerWorkOrder | null;
  resultReferences: AsoiafAnswerWorkResultReference[];
  reason: string;
  outputDigest: `sha256:${string}`;
  outputBytes: number;
  completedAt: string;
  operatorId: string;
  rawOutputRetained: false;
  resultAuthority: "typed-local-result-only";
}

export interface AsoiafAnswerActorRuntimeReturnIntent extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_RUNTIME_RETURN_INTENT_FORMAT;
  returnIntentId: string;
  returnIntentFingerprint: `sha256:${string}`;
  runtimeResultId: string;
  runtimeResultFingerprint: `sha256:${string}`;
  acceptanceId: string;
  acceptanceFingerprint: `sha256:${string}`;
  slotId: string;
  slotFingerprint: `sha256:${string}`;
  deliveryId: string;
  deliveryFingerprint: `sha256:${string}`;
  deliveryCertificateFingerprint: `sha256:${string}`;
  rendezvousId: string;
  rendezvousFingerprint: `sha256:${string}`;
  idempotencyKeyDigest: `sha256:${string}`;
  body: AsoiafAnswerSupervisedReturnBody;
  bodyDigest: `sha256:${string}`;
  preparedAt: string;
  operatorId: string;
  rawIdempotencyKeyRetained: false;
  returnAuthority: "delivery-return-request-only";
}

export interface AsoiafAnswerActorRuntimeReturnReceipt extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_RUNTIME_RETURN_RECEIPT_FORMAT;
  returnReceiptId: string;
  returnReceiptFingerprint: `sha256:${string}`;
  returnIntentId: string;
  returnIntentFingerprint: `sha256:${string}`;
  runtimeResultId: string;
  runtimeResultFingerprint: `sha256:${string}`;
  acceptanceId: string;
  acceptanceFingerprint: `sha256:${string}`;
  slotId: string;
  slotFingerprint: `sha256:${string}`;
  supervisedReturnId: string;
  supervisedReturnFingerprint: `sha256:${string}`;
  exchangeResultId: string;
  exchangeResultFingerprint: `sha256:${string}`;
  settlementId: string;
  settlementFingerprint: `sha256:${string}`;
  recordedAt: string;
  operatorId: string;
  receiptAuthority: "acknowledgement-only";
}

export interface AsoiafAnswerActorRuntimeRetirement extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_RUNTIME_RETIREMENT_FORMAT;
  retirementId: string;
  retirementFingerprint: `sha256:${string}`;
  slotId: string;
  slotFingerprint: `sha256:${string}`;
  kind: "scheduled" | "emergency";
  pendingAcceptanceIds: string[];
  retiredAt: string;
  reason: string;
  operatorId: string;
  retirementAuthority: "local-slot-retirement-only";
}

export interface AsoiafAnswerActorRuntimeStrandedAssignment extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_RUNTIME_STRANDED_FORMAT;
  strandedId: string;
  strandedFingerprint: `sha256:${string}`;
  retirementId: string;
  retirementFingerprint: `sha256:${string}`;
  slotId: string;
  slotFingerprint: `sha256:${string}`;
  acceptanceId: string;
  acceptanceFingerprint: `sha256:${string}`;
  deliveryId: string;
  deliveryFingerprint: `sha256:${string}`;
  strandedAt: string;
  successorMayInherit: false;
  strandedAuthority: "exception-record-only";
}

export type AsoiafAnswerActorRuntimeAssignmentStatus =
  | "accepted"
  | "prepared"
  | "result-ready"
  | "return-pending"
  | "returned"
  | "stranded";

export interface AsoiafAnswerActorRuntimeStateEntry {
  acceptanceId: string;
  acceptanceFingerprint: `sha256:${string}`;
  slotId: string;
  deliveryId: string;
  executionIntentId: string | null;
  runtimeResultId: string | null;
  returnIntentId: string | null;
  returnReceiptId: string | null;
  strandedId: string | null;
  status: AsoiafAnswerActorRuntimeAssignmentStatus;
  updatedAt: string;
}

export interface AsoiafAnswerActorRuntimeState extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_RUNTIME_STATE_FORMAT;
  stateId: string;
  stateFingerprint: `sha256:${string}`;
  asOf: string;
  entries: AsoiafAnswerActorRuntimeStateEntry[];
  activeSlotIds: string[];
  retiredSlotIds: string[];
  stateAuthority: "projection-only";
}

export interface AsoiafAnswerActorRuntimeStatus {
  format: "axm-asoiaf-answer-actor-runtime-status/1";
  paths: AsoiafAnswerActorRuntimePaths;
  slots: AsoiafAnswerActorRuntimeSlot[];
  acceptances: AsoiafAnswerActorRuntimeAcceptance[];
  executionIntents: AsoiafAnswerActorRuntimeExecutionIntent[];
  results: AsoiafAnswerActorRuntimeResult[];
  returnIntents: AsoiafAnswerActorRuntimeReturnIntent[];
  returnReceipts: AsoiafAnswerActorRuntimeReturnReceipt[];
  retirements: AsoiafAnswerActorRuntimeRetirement[];
  stranded: AsoiafAnswerActorRuntimeStrandedAssignment[];
  state: AsoiafAnswerActorRuntimeState | null;
}

export interface AsoiafAnswerActorRuntimeFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

export interface AsoiafAnswerActorRuntimeSlotInput {
  root: string;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  deliveryCertificateFingerprint: `sha256:${string}`;
  providerProfileId: string;
  credentialRelationship: AsoiafAnswerActorCredentialRelationship;
  delegationReason?: string | null;
  predecessorSlotId?: string | null;
  createdAt: string;
  operatorId: string;
}

export interface AsoiafAnswerActorRuntimeAcceptInput {
  root: string;
  slotId: string;
  deliveryId: string;
  importedAt: string;
  operatorId: string;
}

export interface AsoiafAnswerActorRuntimePrepareInput {
  root: string;
  acceptanceId: string;
  adapterId: string;
  adapterVersion: string;
  inputDigest: `sha256:${string}`;
  inputBytes: number;
  preparedAt: string;
  expiresAt: string;
  operatorId: string;
}

export interface AsoiafAnswerActorRuntimeResultInput {
  root: string;
  executionIntentId: string;
  providerResultId: string;
  outcome: AsoiafAnswerExchangeOutcome;
  afterWorkOrder?: AsoiafAnswerWorkOrder | null;
  resultReferences?: AsoiafAnswerWorkResultReference[];
  reason: string;
  outputDigest: `sha256:${string}`;
  outputBytes: number;
  completedAt: string;
  operatorId: string;
}

export interface AsoiafAnswerActorRuntimePrepareReturnInput {
  root: string;
  runtimeResultId: string;
  slotId: string;
  idempotencyKey: string;
  preparedAt: string;
  operatorId: string;
}

export interface AsoiafAnswerActorRuntimeRecordReturnInput {
  root: string;
  returnIntentId: string;
  supervisedReturnId: string;
  recordedAt: string;
  operatorId: string;
}

export interface AsoiafAnswerActorRuntimeRetireInput {
  root: string;
  slotId: string;
  kind: "scheduled" | "emergency";
  retiredAt: string;
  reason: string;
  operatorId: string;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function requireId(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 1024 || /[\r\n\0]/.test(normalized)) {
    throw new Error(`${label} is invalid`);
  }
  return normalized;
}

function requireReason(value: string, label: string): string {
  const normalized = requireId(value, label);
  if (normalized.length < 24 || normalized.length > 4096) {
    throw new Error(`${label} must contain 24 through 4096 characters`);
  }
  return normalized;
}

function requireDigest(value: string, label: string): `sha256:${string}` {
  const normalized = value.trim().toLowerCase();
  if (!/^sha256:[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`${label} must be one lowercase SHA-256 digest`);
  }
  return normalized as `sha256:${string}`;
}

function requireTime(value: string, label: string): string {
  if (!value.trim() || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} is invalid`);
  }
  return new Date(value).toISOString();
}

function requireInteger(value: number, label: string, minimum = 0, maximum = 64 * 1024 * 1024): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} through ${maximum}`);
  }
  return value;
}

function finding(
  code: string,
  severity: AsoiafAnswerActorRuntimeFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafAnswerActorRuntimeFinding {
  return { code, severity, subjectId, detail };
}

function sortedFindings(
  values: readonly AsoiafAnswerActorRuntimeFinding[],
): AsoiafAnswerActorRuntimeFinding[] {
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
      throw new Error(`actor runtime immutable file collision at ${target}`);
    }
    return { value: JSON.parse(existing) as T, replayed: true };
  }
}

function writeAtomic(target: string, value: unknown): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
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

function objectCore(
  value: Record<string, unknown>,
  idKey: string,
  fingerprintKey: string,
): Record<string, unknown> {
  const clone = { ...value };
  delete clone[idKey];
  delete clone[fingerprintKey];
  return clone;
}

function fingerprintValid(
  value: Record<string, unknown>,
  idKey: string,
  fingerprintKey: string,
): boolean {
  return value[fingerprintKey] === sha256(objectCore(value, idKey, fingerprintKey));
}

function uniqueBy<T>(values: readonly T[], predicate: (value: T) => boolean, label: string): T {
  const matches = values.filter(predicate);
  if (matches.length !== 1) throw new Error(`${label} is absent or duplicated`);
  return matches[0]!;
}

export function asoiafAnswerActorRuntimePaths(root: string): AsoiafAnswerActorRuntimePaths {
  const absolute = path.resolve(root);
  const runtimeRoot = path.join(absolute, "answer-actor-runtime");
  return {
    root: absolute,
    runtimeRoot,
    slots: path.join(runtimeRoot, "slots"),
    acceptances: path.join(runtimeRoot, "acceptances"),
    executionIntents: path.join(runtimeRoot, "execution-intents"),
    results: path.join(runtimeRoot, "results"),
    returnIntents: path.join(runtimeRoot, "return-intents"),
    returnReceipts: path.join(runtimeRoot, "return-receipts"),
    retirements: path.join(runtimeRoot, "retirements"),
    stranded: path.join(runtimeRoot, "stranded"),
    state: path.join(runtimeRoot, "RUNTIME-STATE.json"),
  };
}

export function readAsoiafAnswerActorRuntimeStatus(root: string): AsoiafAnswerActorRuntimeStatus {
  const paths = asoiafAnswerActorRuntimePaths(root);
  return {
    format: "axm-asoiaf-answer-actor-runtime-status/1",
    paths,
    slots: listJson<AsoiafAnswerActorRuntimeSlot>(paths.slots),
    acceptances: listJson<AsoiafAnswerActorRuntimeAcceptance>(paths.acceptances),
    executionIntents: listJson<AsoiafAnswerActorRuntimeExecutionIntent>(paths.executionIntents),
    results: listJson<AsoiafAnswerActorRuntimeResult>(paths.results),
    returnIntents: listJson<AsoiafAnswerActorRuntimeReturnIntent>(paths.returnIntents),
    returnReceipts: listJson<AsoiafAnswerActorRuntimeReturnReceipt>(paths.returnReceipts),
    retirements: listJson<AsoiafAnswerActorRuntimeRetirement>(paths.retirements),
    stranded: listJson<AsoiafAnswerActorRuntimeStrandedAssignment>(paths.stranded),
    state: fs.existsSync(paths.state)
      ? readJson<AsoiafAnswerActorRuntimeState>(paths.state)
      : null,
  };
}

function slotById(root: string, slotId: string): AsoiafAnswerActorRuntimeSlot {
  return uniqueBy(
    readAsoiafAnswerActorRuntimeStatus(root).slots,
    (entry) => entry.slotId === slotId,
    `actor runtime slot ${slotId}`,
  );
}

function acceptanceById(root: string, acceptanceId: string): AsoiafAnswerActorRuntimeAcceptance {
  return uniqueBy(
    readAsoiafAnswerActorRuntimeStatus(root).acceptances,
    (entry) => entry.acceptanceId === acceptanceId,
    `actor runtime acceptance ${acceptanceId}`,
  );
}

function executionIntentById(root: string, intentId: string): AsoiafAnswerActorRuntimeExecutionIntent {
  return uniqueBy(
    readAsoiafAnswerActorRuntimeStatus(root).executionIntents,
    (entry) => entry.executionIntentId === intentId,
    `actor runtime execution intent ${intentId}`,
  );
}

function runtimeResultById(root: string, resultId: string): AsoiafAnswerActorRuntimeResult {
  return uniqueBy(
    readAsoiafAnswerActorRuntimeStatus(root).results,
    (entry) => entry.runtimeResultId === resultId,
    `actor runtime result ${resultId}`,
  );
}

function returnIntentById(root: string, returnIntentId: string): AsoiafAnswerActorRuntimeReturnIntent {
  return uniqueBy(
    readAsoiafAnswerActorRuntimeStatus(root).returnIntents,
    (entry) => entry.returnIntentId === returnIntentId,
    `actor runtime return intent ${returnIntentId}`,
  );
}

function retirementForSlot(root: string, slotId: string): AsoiafAnswerActorRuntimeRetirement | null {
  const matches = readAsoiafAnswerActorRuntimeStatus(root).retirements
    .filter((entry) => entry.slotId === slotId);
  if (matches.length > 1) throw new Error(`actor runtime slot ${slotId} has duplicate retirements`);
  return matches[0] ?? null;
}

function providerParents(root: string): {
  profiles: AsoiafAnswerCredentialProviderProfile[];
  results: AsoiafAnswerCredentialProviderResult[];
  bindings: AsoiafAnswerCredentialBrokerBinding[];
} {
  const errors = verifyAsoiafAnswerCredentialProviderHostEstate(root)
    .filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(`actor runtime requires a valid provider estate: ${errors.map((entry) => entry.code).join(", ")}`);
  }
  const provider = readAsoiafAnswerCredentialProviderStatus(root);
  return {
    profiles: provider.profiles,
    results: provider.results,
    bindings: readAsoiafAnswerCredentialBrokerStatus(root).bindings,
  };
}

function deliveryParents(root: string): {
  deliveries: AsoiafAnswerSupervisedAssignmentDelivery[];
  returns: AsoiafAnswerSupervisedResultReturn[];
  exchangeResults: AsoiafAnswerExchangeResult[];
} {
  const errors = verifyAsoiafAnswerSupervisedDeliveryEstate(root)
    .filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(`actor runtime requires a valid supervised-delivery estate: ${errors.map((entry) => entry.code).join(", ")}`);
  }
  const delivery = readAsoiafAnswerSupervisedDeliveryStatus(root);
  return {
    deliveries: delivery.deliveries,
    returns: delivery.returns,
    exchangeResults: readAsoiafAnswerExchangeStatus(root).results,
  };
}

function normalizeReferences(
  references: readonly AsoiafAnswerWorkResultReference[],
  acceptedKinds: readonly string[],
): AsoiafAnswerWorkResultReference[] {
  const normalized = references.map((entry) => {
    const kind = requireId(entry.kind, "runtime result reference kind");
    if (!acceptedKinds.includes(kind)) {
      throw new Error(`runtime result kind ${kind} is not accepted by the assignment`);
    }
    return {
      kind,
      objectId: requireId(entry.objectId, "runtime result object identity"),
      fingerprint: requireDigest(entry.fingerprint, "runtime result reference fingerprint"),
      uri: entry.uri === null ? null : requireId(entry.uri, "runtime result reference URI"),
    };
  });
  return [...new Map(normalized.map((entry) => [stableJson(entry), entry] as const)).values()]
    .sort((left, right) => stableJson(left).localeCompare(stableJson(right)));
}

function buildState(root: string): AsoiafAnswerActorRuntimeState {
  const status = readAsoiafAnswerActorRuntimeStatus(root);
  const entries = status.acceptances.map((acceptance): AsoiafAnswerActorRuntimeStateEntry => {
    const execution = status.executionIntents.find(
      (entry) => entry.acceptanceId === acceptance.acceptanceId,
    ) ?? null;
    const result = status.results.find(
      (entry) => entry.acceptanceId === acceptance.acceptanceId,
    ) ?? null;
    const returnIntent = status.returnIntents.find(
      (entry) => entry.acceptanceId === acceptance.acceptanceId,
    ) ?? null;
    const receipt = status.returnReceipts.find(
      (entry) => entry.acceptanceId === acceptance.acceptanceId,
    ) ?? null;
    const stranded = status.stranded.find(
      (entry) => entry.acceptanceId === acceptance.acceptanceId,
    ) ?? null;
    let state: AsoiafAnswerActorRuntimeAssignmentStatus = "accepted";
    let updatedAt = acceptance.importedAt;
    if (execution) {
      state = "prepared";
      updatedAt = execution.preparedAt;
    }
    if (result) {
      state = "result-ready";
      updatedAt = result.completedAt;
    }
    if (returnIntent) {
      state = "return-pending";
      updatedAt = returnIntent.preparedAt;
    }
    if (receipt) {
      state = "returned";
      updatedAt = receipt.recordedAt;
    }
    if (stranded) {
      state = "stranded";
      updatedAt = stranded.strandedAt;
    }
    return {
      acceptanceId: acceptance.acceptanceId,
      acceptanceFingerprint: acceptance.acceptanceFingerprint,
      slotId: acceptance.slotId,
      deliveryId: acceptance.deliveryId,
      executionIntentId: execution?.executionIntentId ?? null,
      runtimeResultId: result?.runtimeResultId ?? null,
      returnIntentId: returnIntent?.returnIntentId ?? null,
      returnReceiptId: receipt?.returnReceiptId ?? null,
      strandedId: stranded?.strandedId ?? null,
      status: state,
      updatedAt,
    };
  }).sort((left, right) => left.acceptanceId.localeCompare(right.acceptanceId));
  const retired = new Set(status.retirements.map((entry) => entry.slotId));
  const asOf = [
    ...status.slots.map((entry) => entry.createdAt),
    ...entries.map((entry) => entry.updatedAt),
    ...status.retirements.map((entry) => entry.retiredAt),
  ].sort().at(-1) ?? "1970-01-01T00:00:00.000Z";
  const stateCore = {
    format: ASOIAF_ANSWER_ACTOR_RUNTIME_STATE_FORMAT,
    asOf,
    entries,
    activeSlotIds: status.slots.map((entry) => entry.slotId)
      .filter((slotId) => !retired.has(slotId)).sort(),
    retiredSlotIds: [...retired].sort(),
    stateAuthority: "projection-only" as const,
    ...NO_AUTHORITY,
  };
  const stateFingerprint = sha256(stateCore);
  return {
    ...stateCore,
    stateId: collectorContentId("asoiaf-answer-actor-runtime-state", {
      asOf,
      stateFingerprint,
    }),
    stateFingerprint,
  };
}

function refreshState(root: string): AsoiafAnswerActorRuntimeState | null {
  const status = readAsoiafAnswerActorRuntimeStatus(root);
  if (status.slots.length === 0) return null;
  const state = buildState(root);
  writeAtomic(status.paths.state, state);
  return state;
}

export function retainAsoiafAnswerActorRuntimeSlot(
  input: AsoiafAnswerActorRuntimeSlotInput,
): { slot: AsoiafAnswerActorRuntimeSlot; replayed: boolean } {
  const actorId = requireId(input.actorId, "runtime actor identity");
  const actorRole = requireId(input.actorRole, "runtime actor role") as AsoiafAnswerExchangeActorRole;
  const deliveryCertificateFingerprint = requireDigest(
    input.deliveryCertificateFingerprint,
    "runtime delivery certificate fingerprint",
  );
  const parents = providerParents(input.root);
  const profile = uniqueBy(
    parents.profiles,
    (entry) => entry.profileId === input.providerProfileId,
    `credential provider profile ${input.providerProfileId}`,
  );
  const binding = uniqueBy(
    parents.bindings,
    (entry) => entry.bindingId === profile.brokerBindingId,
    `credential broker binding ${profile.brokerBindingId}`,
  );
  if (
    profile.brokerBindingFingerprint !== binding.bindingFingerprint
    || profile.profileFingerprint !== sha256(objectCore(
      profile as unknown as Record<string, unknown>,
      "profileId",
      "profileFingerprint",
    ))
  ) {
    throw new Error("runtime provider profile differs from broker binding custody");
  }
  const samePrincipal = binding.principalId === actorId && binding.actorRole === actorRole;
  if (input.credentialRelationship === "same-principal" && !samePrincipal) {
    throw new Error("same-principal runtime slot differs from provider binding principal or role");
  }
  const delegationReason = input.credentialRelationship === "explicit-delegation"
    ? requireReason(input.delegationReason ?? "", "runtime credential delegation reason")
    : null;
  if (input.credentialRelationship === "explicit-delegation" && samePrincipal) {
    throw new Error("explicit credential delegation is unnecessary for a matching provider principal");
  }
  let predecessor: AsoiafAnswerActorRuntimeSlot | null = null;
  if (input.predecessorSlotId) {
    predecessor = slotById(input.root, input.predecessorSlotId);
    if (
      predecessor.actorId !== actorId
      || predecessor.actorRole !== actorRole
      || predecessor.deliveryCertificateFingerprint === deliveryCertificateFingerprint
      || predecessor.providerProfileId !== profile.profileId
    ) {
      throw new Error("runtime successor slot differs from predecessor actor, role, provider profile, or certificate continuity");
    }
  }
  const slotCore = {
    format: ASOIAF_ANSWER_ACTOR_RUNTIME_SLOT_FORMAT,
    actorId,
    actorRole,
    deliveryCertificateFingerprint,
    providerProfileId: profile.profileId,
    providerProfileFingerprint: profile.profileFingerprint,
    brokerBindingId: binding.bindingId,
    brokerBindingFingerprint: binding.bindingFingerprint,
    providerPrincipalId: binding.principalId,
    providerActorRole: binding.actorRole,
    credentialRelationship: input.credentialRelationship,
    delegationReason,
    predecessorSlotId: predecessor?.slotId ?? null,
    predecessorSlotFingerprint: predecessor?.slotFingerprint ?? null,
    createdAt: requireTime(input.createdAt, "runtime slot creation time"),
    operatorId: requireId(input.operatorId, "runtime slot operator"),
    localBindingOnly: true as const,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    rawProviderSelectorRetained: false as const,
    providerSecretRetained: false as const,
    rawTaskInputRetained: false as const,
    rawTaskOutputRetained: false as const,
    slotAuthority: "local-runtime-binding-only" as const,
    ...NO_AUTHORITY,
  };
  const slotFingerprint = sha256(slotCore);
  const slot: AsoiafAnswerActorRuntimeSlot = {
    ...slotCore,
    slotId: collectorContentId("asoiaf-answer-actor-runtime-slot", {
      actorId,
      deliveryCertificateFingerprint,
      providerProfileId: profile.profileId,
      slotFingerprint,
    }),
    slotFingerprint,
  };
  const conflicts = readAsoiafAnswerActorRuntimeStatus(input.root).slots.filter(
    (entry) => entry.actorId === actorId
      && entry.actorRole === actorRole
      && entry.deliveryCertificateFingerprint === deliveryCertificateFingerprint,
  );
  if (conflicts.length > 0 && !conflicts.some((entry) => stableJson(entry) === stableJson(slot))) {
    throw new Error("delivery certificate is already bound to a different actor runtime slot");
  }
  const paths = asoiafAnswerActorRuntimePaths(input.root);
  const persisted = writeExact(digestPath(paths.slots, slotFingerprint), slot);
  refreshState(input.root);
  return { slot: persisted.value, replayed: persisted.replayed };
}

export function acceptAsoiafAnswerActorRuntimeDelivery(
  input: AsoiafAnswerActorRuntimeAcceptInput,
): { acceptance: AsoiafAnswerActorRuntimeAcceptance; replayed: boolean } {
  const slot = slotById(input.root, input.slotId);
  const parents = deliveryParents(input.root);
  const delivery = uniqueBy(
    parents.deliveries,
    (entry) => entry.deliveryId === input.deliveryId,
    `supervised assignment delivery ${input.deliveryId}`,
  );
  const importedAt = requireTime(input.importedAt, "runtime assignment import time");
  const retirement = retirementForSlot(input.root, slot.slotId);
  if (retirement && Date.parse(importedAt) >= Date.parse(retirement.retiredAt)) {
    throw new Error("runtime slot was retired before assignment import");
  }
  if (
    slot.actorId !== delivery.actorId
    || slot.actorRole !== delivery.actorRole
    || slot.deliveryCertificateFingerprint !== delivery.certificateFingerprint
  ) {
    throw new Error("runtime slot does not own the certificate-bound assignment delivery");
  }
  if (Date.parse(importedAt) < Date.parse(delivery.deliveredAt)) {
    throw new Error("runtime assignment import precedes supervised delivery");
  }
  if (Date.parse(importedAt) >= Date.parse(delivery.assignment.expiresAt)) {
    throw new Error("runtime assignment import follows assignment expiry");
  }
  const acceptanceCore = {
    format: ASOIAF_ANSWER_ACTOR_RUNTIME_ACCEPTANCE_FORMAT,
    slotId: slot.slotId,
    slotFingerprint: slot.slotFingerprint,
    actorId: slot.actorId,
    actorRole: slot.actorRole,
    deliveryCertificateFingerprint: slot.deliveryCertificateFingerprint,
    deliveryId: delivery.deliveryId,
    deliveryFingerprint: delivery.deliveryFingerprint,
    assignmentId: delivery.assignmentId,
    assignmentFingerprint: delivery.assignmentFingerprint,
    leaseId: delivery.leaseId,
    leaseFingerprint: delivery.leaseFingerprint,
    itemId: delivery.assignment.itemId,
    itemFingerprint: delivery.assignment.itemFingerprint,
    action: delivery.assignment.action,
    stage: delivery.assignment.stage,
    acceptedResultKinds: [...delivery.assignment.acceptedResultKinds].sort(),
    rendezvousId: delivery.rendezvousId,
    rendezvousFingerprint: delivery.rendezvousFingerprint,
    deliveredAt: delivery.deliveredAt,
    assignmentExpiresAt: delivery.assignment.expiresAt,
    importedAt,
    operatorId: requireId(input.operatorId, "runtime acceptance operator"),
    sourceTextIncluded: false as const,
    privateTextIncluded: false as const,
    rawTaskInputRetained: false as const,
    acceptanceAuthority: "assignment-custody-only" as const,
    ...NO_AUTHORITY,
  };
  const acceptanceFingerprint = sha256(acceptanceCore);
  const acceptance: AsoiafAnswerActorRuntimeAcceptance = {
    ...acceptanceCore,
    acceptanceId: collectorContentId("asoiaf-answer-actor-runtime-acceptance", {
      slotId: slot.slotId,
      deliveryId: delivery.deliveryId,
      acceptanceFingerprint,
    }),
    acceptanceFingerprint,
  };
  const conflicts = readAsoiafAnswerActorRuntimeStatus(input.root).acceptances.filter(
    (entry) => entry.deliveryId === delivery.deliveryId,
  );
  if (conflicts.length > 0 && !conflicts.some((entry) => stableJson(entry) === stableJson(acceptance))) {
    throw new Error("supervised delivery is already bound to a different runtime acceptance");
  }
  const paths = asoiafAnswerActorRuntimePaths(input.root);
  const persisted = writeExact(digestPath(paths.acceptances, acceptanceFingerprint), acceptance);
  refreshState(input.root);
  return { acceptance: persisted.value, replayed: persisted.replayed };
}

export function prepareAsoiafAnswerActorRuntimeExecution(
  input: AsoiafAnswerActorRuntimePrepareInput,
): { intent: AsoiafAnswerActorRuntimeExecutionIntent; replayed: boolean } {
  const acceptance = acceptanceById(input.root, input.acceptanceId);
  const slot = slotById(input.root, acceptance.slotId);
  const preparedAt = requireTime(input.preparedAt, "runtime execution preparation time");
  const expiresAt = requireTime(input.expiresAt, "runtime execution expiry time");
  const retirement = retirementForSlot(input.root, slot.slotId);
  if (retirement && Date.parse(preparedAt) >= Date.parse(retirement.retiredAt)) {
    throw new Error("runtime slot was retired before execution preparation");
  }
  if (Date.parse(preparedAt) < Date.parse(acceptance.importedAt)) {
    throw new Error("runtime execution preparation precedes assignment import");
  }
  if (
    Date.parse(expiresAt) <= Date.parse(preparedAt)
    || Date.parse(expiresAt) > Date.parse(acceptance.assignmentExpiresAt)
  ) {
    throw new Error("runtime execution expiry exceeds the assignment lease");
  }
  const intentCore = {
    format: ASOIAF_ANSWER_ACTOR_RUNTIME_EXECUTION_INTENT_FORMAT,
    acceptanceId: acceptance.acceptanceId,
    acceptanceFingerprint: acceptance.acceptanceFingerprint,
    slotId: slot.slotId,
    slotFingerprint: slot.slotFingerprint,
    providerProfileId: slot.providerProfileId,
    providerProfileFingerprint: slot.providerProfileFingerprint,
    adapterId: requireId(input.adapterId, "runtime adapter identity"),
    adapterVersion: requireId(input.adapterVersion, "runtime adapter version"),
    inputDigest: requireDigest(input.inputDigest, "runtime input digest"),
    inputBytes: requireInteger(input.inputBytes, "runtime input byte count", 1),
    preparedAt,
    expiresAt,
    operatorId: requireId(input.operatorId, "runtime execution operator"),
    rawInputRetained: false as const,
    executionAuthority: "adapter-invocation-request-only" as const,
    ...NO_AUTHORITY,
  };
  const executionIntentFingerprint = sha256(intentCore);
  const intent: AsoiafAnswerActorRuntimeExecutionIntent = {
    ...intentCore,
    executionIntentId: collectorContentId("asoiaf-answer-actor-runtime-execution-intent", {
      acceptanceId: acceptance.acceptanceId,
      executionIntentFingerprint,
    }),
    executionIntentFingerprint,
  };
  const conflicts = readAsoiafAnswerActorRuntimeStatus(input.root).executionIntents.filter(
    (entry) => entry.acceptanceId === acceptance.acceptanceId,
  );
  if (conflicts.length > 0 && !conflicts.some((entry) => stableJson(entry) === stableJson(intent))) {
    throw new Error("runtime acceptance already has a different execution intent");
  }
  const paths = asoiafAnswerActorRuntimePaths(input.root);
  const persisted = writeExact(digestPath(paths.executionIntents, executionIntentFingerprint), intent);
  refreshState(input.root);
  return { intent: persisted.value, replayed: persisted.replayed };
}

export function recordAsoiafAnswerActorRuntimeResult(
  input: AsoiafAnswerActorRuntimeResultInput,
): { result: AsoiafAnswerActorRuntimeResult; replayed: boolean } {
  const intent = executionIntentById(input.root, input.executionIntentId);
  const acceptance = acceptanceById(input.root, intent.acceptanceId);
  const slot = slotById(input.root, intent.slotId);
  const parents = providerParents(input.root);
  const providerResult = uniqueBy(
    parents.results,
    (entry) => entry.resultId === input.providerResultId,
    `credential provider result ${input.providerResultId}`,
  );
  if (
    providerResult.profileId !== intent.providerProfileId
    || providerResult.profileFingerprint !== intent.providerProfileFingerprint
  ) {
    throw new Error("runtime provider result differs from the execution intent profile");
  }
  const completedAt = requireTime(input.completedAt, "runtime result completion time");
  if (
    Date.parse(completedAt) < Date.parse(intent.preparedAt)
    || Date.parse(completedAt) > Date.parse(intent.expiresAt)
  ) {
    throw new Error("runtime result falls outside the execution interval");
  }
  const afterWorkOrder = input.afterWorkOrder ?? null;
  if (afterWorkOrder && validateAsoiafAnswerWorkOrder(afterWorkOrder).some(
    (entry) => entry.severity === "error",
  )) {
    throw new Error("runtime after-work-order fails deterministic validation");
  }
  const references = normalizeReferences(
    input.resultReferences ?? [],
    acceptance.acceptedResultKinds,
  );
  const resultCore = {
    format: ASOIAF_ANSWER_ACTOR_RUNTIME_RESULT_FORMAT,
    executionIntentId: intent.executionIntentId,
    executionIntentFingerprint: intent.executionIntentFingerprint,
    acceptanceId: acceptance.acceptanceId,
    acceptanceFingerprint: acceptance.acceptanceFingerprint,
    slotId: slot.slotId,
    slotFingerprint: slot.slotFingerprint,
    providerProfileId: intent.providerProfileId,
    providerProfileFingerprint: intent.providerProfileFingerprint,
    providerResultId: providerResult.resultId,
    providerResultFingerprint: providerResult.resultFingerprint,
    outcome: input.outcome,
    afterWorkOrderId: afterWorkOrder?.workOrderId ?? null,
    afterWorkOrderFingerprint: afterWorkOrder?.workOrderFingerprint ?? null,
    afterWorkOrder,
    resultReferences: references,
    reason: requireReason(input.reason, "runtime result reason"),
    outputDigest: requireDigest(input.outputDigest, "runtime result output digest"),
    outputBytes: requireInteger(input.outputBytes, "runtime result output byte count", 1),
    completedAt,
    operatorId: requireId(input.operatorId, "runtime result operator"),
    rawOutputRetained: false as const,
    resultAuthority: "typed-local-result-only" as const,
    ...NO_AUTHORITY,
  };
  const runtimeResultFingerprint = sha256(resultCore);
  const result: AsoiafAnswerActorRuntimeResult = {
    ...resultCore,
    runtimeResultId: collectorContentId("asoiaf-answer-actor-runtime-result", {
      executionIntentId: intent.executionIntentId,
      providerResultId: providerResult.resultId,
      runtimeResultFingerprint,
    }),
    runtimeResultFingerprint,
  };
  const conflicts = readAsoiafAnswerActorRuntimeStatus(input.root).results.filter(
    (entry) => entry.executionIntentId === intent.executionIntentId,
  );
  if (conflicts.length > 0 && !conflicts.some((entry) => stableJson(entry) === stableJson(result))) {
    throw new Error("runtime execution intent already has a different result");
  }
  const paths = asoiafAnswerActorRuntimePaths(input.root);
  const persisted = writeExact(digestPath(paths.results, runtimeResultFingerprint), result);
  refreshState(input.root);
  return { result: persisted.value, replayed: persisted.replayed };
}

export function prepareAsoiafAnswerActorRuntimeReturn(
  input: AsoiafAnswerActorRuntimePrepareReturnInput,
): { intent: AsoiafAnswerActorRuntimeReturnIntent; replayed: boolean } {
  const result = runtimeResultById(input.root, input.runtimeResultId);
  const acceptance = acceptanceById(input.root, result.acceptanceId);
  const originalSlot = slotById(input.root, acceptance.slotId);
  const requestedSlot = slotById(input.root, input.slotId);
  if (
    requestedSlot.slotId !== originalSlot.slotId
    || requestedSlot.slotFingerprint !== originalSlot.slotFingerprint
  ) {
    throw new Error("successor or alternate runtime slot cannot return predecessor-delivered work");
  }
  const retirement = retirementForSlot(input.root, originalSlot.slotId);
  const preparedAt = requireTime(input.preparedAt, "runtime return preparation time");
  if (retirement && Date.parse(preparedAt) >= Date.parse(retirement.retiredAt)) {
    throw new Error("runtime slot was retired before return preparation");
  }
  if (Date.parse(preparedAt) < Date.parse(result.completedAt)) {
    throw new Error("runtime return preparation precedes local result completion");
  }
  const body: AsoiafAnswerSupervisedReturnBody = {
    deliveryId: acceptance.deliveryId,
    rendezvousId: acceptance.rendezvousId,
    completedAt: result.completedAt,
    outcome: result.outcome,
    afterWorkOrder: result.afterWorkOrder,
    resultReferences: result.resultReferences,
    reason: result.reason,
  };
  const returnCore = {
    format: ASOIAF_ANSWER_ACTOR_RUNTIME_RETURN_INTENT_FORMAT,
    runtimeResultId: result.runtimeResultId,
    runtimeResultFingerprint: result.runtimeResultFingerprint,
    acceptanceId: acceptance.acceptanceId,
    acceptanceFingerprint: acceptance.acceptanceFingerprint,
    slotId: originalSlot.slotId,
    slotFingerprint: originalSlot.slotFingerprint,
    deliveryId: acceptance.deliveryId,
    deliveryFingerprint: acceptance.deliveryFingerprint,
    deliveryCertificateFingerprint: originalSlot.deliveryCertificateFingerprint,
    rendezvousId: acceptance.rendezvousId,
    rendezvousFingerprint: acceptance.rendezvousFingerprint,
    idempotencyKeyDigest: sha256(requireId(input.idempotencyKey, "runtime return idempotency key")),
    body,
    bodyDigest: sha256(body),
    preparedAt,
    operatorId: requireId(input.operatorId, "runtime return operator"),
    rawIdempotencyKeyRetained: false as const,
    returnAuthority: "delivery-return-request-only" as const,
    ...NO_AUTHORITY,
  };
  const returnIntentFingerprint = sha256(returnCore);
  const intent: AsoiafAnswerActorRuntimeReturnIntent = {
    ...returnCore,
    returnIntentId: collectorContentId("asoiaf-answer-actor-runtime-return-intent", {
      runtimeResultId: result.runtimeResultId,
      returnIntentFingerprint,
    }),
    returnIntentFingerprint,
  };
  const conflicts = readAsoiafAnswerActorRuntimeStatus(input.root).returnIntents.filter(
    (entry) => entry.runtimeResultId === result.runtimeResultId,
  );
  if (conflicts.length > 0 && !conflicts.some((entry) => stableJson(entry) === stableJson(intent))) {
    throw new Error("runtime result already has a different return intent");
  }
  const paths = asoiafAnswerActorRuntimePaths(input.root);
  const persisted = writeExact(digestPath(paths.returnIntents, returnIntentFingerprint), intent);
  refreshState(input.root);
  return { intent: persisted.value, replayed: persisted.replayed };
}

function compareExchangeResult(
  local: AsoiafAnswerActorRuntimeResult,
  parent: AsoiafAnswerExchangeResult,
): void {
  if (
    parent.outcome !== local.outcome
    || parent.afterWorkOrderId !== local.afterWorkOrderId
    || parent.afterWorkOrderFingerprint !== local.afterWorkOrderFingerprint
    || stableJson(parent.afterWorkOrder) !== stableJson(local.afterWorkOrder)
    || stableJson(parent.resultReferences) !== stableJson(local.resultReferences)
    || parent.reason !== local.reason
  ) {
    throw new Error("supervised return exchange result differs from the actor-local typed result");
  }
}

export function recordAsoiafAnswerActorRuntimeReturn(
  input: AsoiafAnswerActorRuntimeRecordReturnInput,
): { receipt: AsoiafAnswerActorRuntimeReturnReceipt; replayed: boolean } {
  const intent = returnIntentById(input.root, input.returnIntentId);
  const result = runtimeResultById(input.root, intent.runtimeResultId);
  const acceptance = acceptanceById(input.root, intent.acceptanceId);
  const slot = slotById(input.root, intent.slotId);
  const parents = deliveryParents(input.root);
  const returned = uniqueBy(
    parents.returns,
    (entry) => entry.returnId === input.supervisedReturnId,
    `supervised result return ${input.supervisedReturnId}`,
  );
  const exchangeResult = uniqueBy(
    parents.exchangeResults,
    (entry) => entry.resultId === returned.resultId,
    `exchange result ${returned.resultId}`,
  );
  if (
    returned.deliveryId !== acceptance.deliveryId
    || returned.deliveryFingerprint !== acceptance.deliveryFingerprint
    || returned.actorId !== slot.actorId
    || returned.actorRole !== slot.actorRole
    || returned.certificateFingerprint !== slot.deliveryCertificateFingerprint
    || returned.rendezvousId !== acceptance.rendezvousId
    || returned.rendezvousFingerprint !== acceptance.rendezvousFingerprint
    || returned.assignmentId !== acceptance.assignmentId
    || returned.assignmentFingerprint !== acceptance.assignmentFingerprint
  ) {
    throw new Error("supervised result return differs from the exact slot, delivery, or assignment custody");
  }
  compareExchangeResult(result, exchangeResult);
  if (Date.parse(intent.preparedAt) > Date.parse(returned.completedAt)) {
    throw new Error("runtime return intent follows the supervised return it claims to precede");
  }
  const recordedAt = requireTime(input.recordedAt, "runtime return receipt time");
  if (Date.parse(recordedAt) < Date.parse(returned.completedAt)) {
    throw new Error("runtime return receipt precedes the supervised return");
  }
  const receiptCore = {
    format: ASOIAF_ANSWER_ACTOR_RUNTIME_RETURN_RECEIPT_FORMAT,
    returnIntentId: intent.returnIntentId,
    returnIntentFingerprint: intent.returnIntentFingerprint,
    runtimeResultId: result.runtimeResultId,
    runtimeResultFingerprint: result.runtimeResultFingerprint,
    acceptanceId: acceptance.acceptanceId,
    acceptanceFingerprint: acceptance.acceptanceFingerprint,
    slotId: slot.slotId,
    slotFingerprint: slot.slotFingerprint,
    supervisedReturnId: returned.returnId,
    supervisedReturnFingerprint: returned.returnFingerprint,
    exchangeResultId: exchangeResult.resultId,
    exchangeResultFingerprint: exchangeResult.resultFingerprint,
    settlementId: returned.settlementId,
    settlementFingerprint: returned.settlementFingerprint,
    recordedAt,
    operatorId: requireId(input.operatorId, "runtime return receipt operator"),
    receiptAuthority: "acknowledgement-only" as const,
    ...NO_AUTHORITY,
  };
  const returnReceiptFingerprint = sha256(receiptCore);
  const receipt: AsoiafAnswerActorRuntimeReturnReceipt = {
    ...receiptCore,
    returnReceiptId: collectorContentId("asoiaf-answer-actor-runtime-return-receipt", {
      returnIntentId: intent.returnIntentId,
      supervisedReturnId: returned.returnId,
      returnReceiptFingerprint,
    }),
    returnReceiptFingerprint,
  };
  const conflicts = readAsoiafAnswerActorRuntimeStatus(input.root).returnReceipts.filter(
    (entry) => entry.returnIntentId === intent.returnIntentId,
  );
  if (conflicts.length > 0 && !conflicts.some((entry) => stableJson(entry) === stableJson(receipt))) {
    throw new Error("runtime return intent already has a different receipt");
  }
  const paths = asoiafAnswerActorRuntimePaths(input.root);
  const persisted = writeExact(digestPath(paths.returnReceipts, returnReceiptFingerprint), receipt);
  refreshState(input.root);
  return { receipt: persisted.value, replayed: persisted.replayed };
}

export function retireAsoiafAnswerActorRuntimeSlot(
  input: AsoiafAnswerActorRuntimeRetireInput,
): {
  retirement: AsoiafAnswerActorRuntimeRetirement;
  stranded: AsoiafAnswerActorRuntimeStrandedAssignment[];
  replayed: boolean;
} {
  const slot = slotById(input.root, input.slotId);
  const status = readAsoiafAnswerActorRuntimeStatus(input.root);
  const existing = status.retirements.filter((entry) => entry.slotId === slot.slotId);
  const receiptAcceptanceIds = new Set(status.returnReceipts.map((entry) => entry.acceptanceId));
  const pending = status.acceptances
    .filter((entry) => entry.slotId === slot.slotId && !receiptAcceptanceIds.has(entry.acceptanceId))
    .sort((left, right) => left.acceptanceId.localeCompare(right.acceptanceId));
  if (input.kind === "scheduled" && pending.length > 0) {
    throw new Error("scheduled runtime slot retirement requires a retained return receipt for every certificate-specific assignment");
  }
  const retirementCore = {
    format: ASOIAF_ANSWER_ACTOR_RUNTIME_RETIREMENT_FORMAT,
    slotId: slot.slotId,
    slotFingerprint: slot.slotFingerprint,
    kind: input.kind,
    pendingAcceptanceIds: pending.map((entry) => entry.acceptanceId),
    retiredAt: requireTime(input.retiredAt, "runtime slot retirement time"),
    reason: requireReason(input.reason, "runtime slot retirement reason"),
    operatorId: requireId(input.operatorId, "runtime slot retirement operator"),
    retirementAuthority: "local-slot-retirement-only" as const,
    ...NO_AUTHORITY,
  };
  const retirementFingerprint = sha256(retirementCore);
  const retirement: AsoiafAnswerActorRuntimeRetirement = {
    ...retirementCore,
    retirementId: collectorContentId("asoiaf-answer-actor-runtime-retirement", {
      slotId: slot.slotId,
      retirementFingerprint,
    }),
    retirementFingerprint,
  };
  if (existing.length > 0 && !existing.some((entry) => stableJson(entry) === stableJson(retirement))) {
    throw new Error("runtime slot already has a different retirement");
  }
  const paths = asoiafAnswerActorRuntimePaths(input.root);
  const persisted = writeExact(digestPath(paths.retirements, retirementFingerprint), retirement);
  const stranded = input.kind === "emergency"
    ? pending.map((acceptance) => {
        const strandedCore = {
          format: ASOIAF_ANSWER_ACTOR_RUNTIME_STRANDED_FORMAT,
          retirementId: persisted.value.retirementId,
          retirementFingerprint: persisted.value.retirementFingerprint,
          slotId: slot.slotId,
          slotFingerprint: slot.slotFingerprint,
          acceptanceId: acceptance.acceptanceId,
          acceptanceFingerprint: acceptance.acceptanceFingerprint,
          deliveryId: acceptance.deliveryId,
          deliveryFingerprint: acceptance.deliveryFingerprint,
          strandedAt: persisted.value.retiredAt,
          successorMayInherit: false as const,
          strandedAuthority: "exception-record-only" as const,
          ...NO_AUTHORITY,
        };
        const strandedFingerprint = sha256(strandedCore);
        const record: AsoiafAnswerActorRuntimeStrandedAssignment = {
          ...strandedCore,
          strandedId: collectorContentId("asoiaf-answer-actor-runtime-stranded-assignment", {
            acceptanceId: acceptance.acceptanceId,
            retirementId: persisted.value.retirementId,
            strandedFingerprint,
          }),
          strandedFingerprint,
        };
        return writeExact(digestPath(paths.stranded, strandedFingerprint), record).value;
      })
    : [];
  refreshState(input.root);
  return { retirement: persisted.value, stranded, replayed: persisted.replayed };
}

function secretFindings(root: string): AsoiafAnswerActorRuntimeFinding[] {
  const findings: AsoiafAnswerActorRuntimeFinding[] = [];
  const runtimeRoot = asoiafAnswerActorRuntimePaths(root).runtimeRoot;
  if (!fs.existsSync(runtimeRoot)) return findings;
  const directories = [runtimeRoot];
  const pattern = /BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY|BEGIN CERTIFICATE(?: REQUEST)?|provider(?:Pin|Password|Token|Secret|Session)\s*[":=]|pkcs11:[^\s"']+/i;
  while (directories.length > 0) {
    const directory = directories.pop()!;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        directories.push(target);
        continue;
      }
      if (/\.(?:key|crt|cer|pem|csr|p12|pfx)$/i.test(entry.name)) {
        findings.push(finding(
          "runtime-secret-path",
          "error",
          target,
          "actor runtime retained a credential-bearing path",
        ));
      }
      if (fs.statSync(target).size <= 2_000_000 && pattern.test(fs.readFileSync(target, "utf8"))) {
        findings.push(finding(
          "runtime-secret-content",
          "error",
          target,
          "actor runtime retained key, certificate, provider-selector, or provider-secret content",
        ));
      }
    }
  }
  return findings;
}

function verifyDigestDirectory(
  directory: string,
  expected: Set<string>,
  code: string,
): AsoiafAnswerActorRuntimeFinding[] {
  const findings: AsoiafAnswerActorRuntimeFinding[] = [];
  if (!fs.existsSync(directory)) return findings;
  for (const name of fs.readdirSync(directory).sort()) {
    if (!/^[a-f0-9]{64}\.json$/.test(name)) {
      findings.push(finding(code, "error", name, "runtime directory contains a non-digest JSON filename"));
    } else if (!expected.has(name)) {
      findings.push(finding(`${code}-orphan`, "error", name, "runtime filename does not match reconstructed custody"));
    }
  }
  return findings;
}

function noAuthority(value: NoAuthority): boolean {
  return value.authority === "none"
    && value.graphEffect === "none"
    && value.canonEffect === "none"
    && value.answerEffect === "none";
}

export function verifyAsoiafAnswerActorRuntimeEstate(
  root: string,
): AsoiafAnswerActorRuntimeFinding[] {
  const findings: AsoiafAnswerActorRuntimeFinding[] = [];
  for (const entry of verifyAsoiafAnswerSupervisedDeliveryEstate(root)) {
    findings.push(finding(`delivery:${entry.code}`, entry.severity, entry.subjectId, entry.detail));
  }
  for (const entry of verifyAsoiafAnswerCredentialProviderHostEstate(root)) {
    findings.push(finding(`provider:${entry.code}`, entry.severity, entry.subjectId, entry.detail));
  }
  let status: AsoiafAnswerActorRuntimeStatus;
  try {
    status = readAsoiafAnswerActorRuntimeStatus(root);
  } catch (error) {
    return [finding(
      "runtime-estate-read",
      "error",
      path.resolve(root),
      error instanceof Error ? error.message : String(error),
    )];
  }
  const delivery = readAsoiafAnswerSupervisedDeliveryStatus(root);
  const exchange = readAsoiafAnswerExchangeStatus(root);
  const provider = readAsoiafAnswerCredentialProviderStatus(root);
  const broker = readAsoiafAnswerCredentialBrokerStatus(root);

  const duplicate = <T>(values: readonly T[], id: (value: T) => string, code: string): void => {
    const seen = new Set<string>();
    for (const value of values) {
      const identity = id(value);
      if (seen.has(identity)) {
        findings.push(finding(code, "error", identity, "runtime identity is duplicated"));
      }
      seen.add(identity);
    }
  };
  duplicate(status.slots, (entry) => entry.slotId, "runtime-slot-duplicate");
  duplicate(status.acceptances, (entry) => entry.acceptanceId, "runtime-acceptance-duplicate");
  duplicate(status.executionIntents, (entry) => entry.executionIntentId, "runtime-intent-duplicate");
  duplicate(status.results, (entry) => entry.runtimeResultId, "runtime-result-duplicate");
  duplicate(status.returnIntents, (entry) => entry.returnIntentId, "runtime-return-intent-duplicate");
  duplicate(status.returnReceipts, (entry) => entry.returnReceiptId, "runtime-return-receipt-duplicate");
  duplicate(status.retirements, (entry) => entry.retirementId, "runtime-retirement-duplicate");
  duplicate(status.stranded, (entry) => entry.strandedId, "runtime-stranded-duplicate");

  for (const slot of status.slots) {
    if (!fingerprintValid(
      slot as unknown as Record<string, unknown>,
      "slotId",
      "slotFingerprint",
    )) {
      findings.push(finding("runtime-slot-fingerprint", "error", slot.slotId, "runtime slot fingerprint is stale"));
    }
    const profile = provider.profiles.find((entry) => entry.profileId === slot.providerProfileId);
    const binding = broker.bindings.find((entry) => entry.bindingId === slot.brokerBindingId);
    if (
      !profile
      || !binding
      || profile.profileFingerprint !== slot.providerProfileFingerprint
      || profile.brokerBindingId !== binding.bindingId
      || binding.bindingFingerprint !== slot.brokerBindingFingerprint
      || binding.principalId !== slot.providerPrincipalId
      || binding.actorRole !== slot.providerActorRole
    ) {
      findings.push(finding("runtime-slot-parent", "error", slot.slotId, "runtime slot differs from provider profile or broker binding custody"));
    }
    if (
      slot.credentialRelationship === "same-principal"
      && (slot.actorId !== slot.providerPrincipalId || slot.actorRole !== slot.providerActorRole)
    ) {
      findings.push(finding("runtime-slot-principal", "error", slot.slotId, "same-principal runtime slot differs from provider principal"));
    }
    if (slot.credentialRelationship === "explicit-delegation" && !slot.delegationReason) {
      findings.push(finding("runtime-slot-delegation", "error", slot.slotId, "delegated runtime slot lacks a reason"));
    }
    if (slot.predecessorSlotId) {
      const predecessor = status.slots.find((entry) => entry.slotId === slot.predecessorSlotId);
      if (
        !predecessor
        || predecessor.slotFingerprint !== slot.predecessorSlotFingerprint
        || predecessor.actorId !== slot.actorId
        || predecessor.actorRole !== slot.actorRole
        || predecessor.providerProfileId !== slot.providerProfileId
        || predecessor.deliveryCertificateFingerprint === slot.deliveryCertificateFingerprint
      ) {
        findings.push(finding("runtime-slot-predecessor", "error", slot.slotId, "runtime successor differs from predecessor continuity"));
      }
    }
    if (
      slot.certificateRetained
      || slot.privateKeyRetained
      || slot.rawProviderSelectorRetained
      || slot.providerSecretRetained
      || slot.rawTaskInputRetained
      || slot.rawTaskOutputRetained
      || !noAuthority(slot)
    ) {
      findings.push(finding("runtime-slot-retention", "error", slot.slotId, "runtime slot crossed retention or authority boundary"));
    }
  }

  const deliveryAcceptance = new Map<string, string>();
  for (const acceptance of status.acceptances) {
    if (!fingerprintValid(
      acceptance as unknown as Record<string, unknown>,
      "acceptanceId",
      "acceptanceFingerprint",
    )) {
      findings.push(finding("runtime-acceptance-fingerprint", "error", acceptance.acceptanceId, "runtime acceptance fingerprint is stale"));
    }
    const slot = status.slots.find((entry) => entry.slotId === acceptance.slotId);
    const parent = delivery.deliveries.find((entry) => entry.deliveryId === acceptance.deliveryId);
    if (
      !slot
      || !parent
      || slot.slotFingerprint !== acceptance.slotFingerprint
      || parent.deliveryFingerprint !== acceptance.deliveryFingerprint
      || parent.assignmentFingerprint !== acceptance.assignmentFingerprint
      || parent.actorId !== acceptance.actorId
      || parent.actorRole !== acceptance.actorRole
      || parent.certificateFingerprint !== acceptance.deliveryCertificateFingerprint
      || parent.rendezvousFingerprint !== acceptance.rendezvousFingerprint
      || parent.leaseFingerprint !== acceptance.leaseFingerprint
      || parent.assignment.itemFingerprint !== acceptance.itemFingerprint
      || parent.assignment.action !== acceptance.action
      || parent.assignment.stage !== acceptance.stage
      || stableJson([...parent.assignment.acceptedResultKinds].sort()) !== stableJson(acceptance.acceptedResultKinds)
    ) {
      findings.push(finding("runtime-acceptance-parent", "error", acceptance.acceptanceId, "runtime acceptance differs from slot or supervised delivery custody"));
    }
    const prior = deliveryAcceptance.get(acceptance.deliveryId);
    if (prior && prior !== acceptance.acceptanceId) {
      findings.push(finding("runtime-delivery-rebound", "error", acceptance.deliveryId, "supervised delivery is bound to multiple runtime acceptances"));
    }
    deliveryAcceptance.set(acceptance.deliveryId, acceptance.acceptanceId);
    if (
      acceptance.sourceTextIncluded
      || acceptance.privateTextIncluded
      || acceptance.rawTaskInputRetained
      || !noAuthority(acceptance)
    ) {
      findings.push(finding("runtime-acceptance-retention", "error", acceptance.acceptanceId, "runtime acceptance retained text, input, or authority"));
    }
  }

  const intentByAcceptance = new Map<string, string>();
  for (const intent of status.executionIntents) {
    if (!fingerprintValid(
      intent as unknown as Record<string, unknown>,
      "executionIntentId",
      "executionIntentFingerprint",
    )) {
      findings.push(finding("runtime-intent-fingerprint", "error", intent.executionIntentId, "runtime execution intent fingerprint is stale"));
    }
    const acceptance = status.acceptances.find((entry) => entry.acceptanceId === intent.acceptanceId);
    const slot = status.slots.find((entry) => entry.slotId === intent.slotId);
    if (
      !acceptance
      || !slot
      || acceptance.acceptanceFingerprint !== intent.acceptanceFingerprint
      || acceptance.slotId !== slot.slotId
      || slot.slotFingerprint !== intent.slotFingerprint
      || slot.providerProfileId !== intent.providerProfileId
      || slot.providerProfileFingerprint !== intent.providerProfileFingerprint
      || Date.parse(intent.preparedAt) < Date.parse(acceptance.importedAt)
      || Date.parse(intent.expiresAt) > Date.parse(acceptance.assignmentExpiresAt)
      || Date.parse(intent.expiresAt) <= Date.parse(intent.preparedAt)
    ) {
      findings.push(finding("runtime-intent-parent", "error", intent.executionIntentId, "runtime execution intent differs from acceptance, slot, provider, or lease custody"));
    }
    const prior = intentByAcceptance.get(intent.acceptanceId);
    if (prior && prior !== intent.executionIntentId) {
      findings.push(finding("runtime-acceptance-multiple-intents", "error", intent.acceptanceId, "runtime acceptance has multiple execution intents"));
    }
    intentByAcceptance.set(intent.acceptanceId, intent.executionIntentId);
    if (intent.rawInputRetained || !noAuthority(intent)) {
      findings.push(finding("runtime-intent-retention", "error", intent.executionIntentId, "runtime execution intent retained raw input or authority"));
    }
  }

  const resultByIntent = new Map<string, string>();
  for (const result of status.results) {
    if (!fingerprintValid(
      result as unknown as Record<string, unknown>,
      "runtimeResultId",
      "runtimeResultFingerprint",
    )) {
      findings.push(finding("runtime-result-fingerprint", "error", result.runtimeResultId, "runtime result fingerprint is stale"));
    }
    const intent = status.executionIntents.find((entry) => entry.executionIntentId === result.executionIntentId);
    const acceptance = status.acceptances.find((entry) => entry.acceptanceId === result.acceptanceId);
    const providerResult = provider.results.find((entry) => entry.resultId === result.providerResultId);
    if (
      !intent
      || !acceptance
      || !providerResult
      || intent.executionIntentFingerprint !== result.executionIntentFingerprint
      || acceptance.acceptanceFingerprint !== result.acceptanceFingerprint
      || intent.acceptanceId !== acceptance.acceptanceId
      || intent.slotId !== result.slotId
      || intent.providerProfileId !== result.providerProfileId
      || providerResult.resultFingerprint !== result.providerResultFingerprint
      || providerResult.profileId !== result.providerProfileId
      || Date.parse(result.completedAt) < Date.parse(intent.preparedAt)
      || Date.parse(result.completedAt) > Date.parse(intent.expiresAt)
    ) {
      findings.push(finding("runtime-result-parent", "error", result.runtimeResultId, "runtime result differs from execution, acceptance, provider, or chronology custody"));
    }
    if (result.afterWorkOrder && validateAsoiafAnswerWorkOrder(result.afterWorkOrder).some(
      (entry) => entry.severity === "error",
    )) {
      findings.push(finding("runtime-result-work-order", "error", result.runtimeResultId, "runtime after-work-order is invalid"));
    }
    if (acceptance) {
      for (const reference of result.resultReferences) {
        if (!acceptance.acceptedResultKinds.includes(reference.kind)) {
          findings.push(finding("runtime-result-kind", "error", result.runtimeResultId, `runtime result kind ${reference.kind} is not accepted by the assignment`));
        }
      }
    }
    const prior = resultByIntent.get(result.executionIntentId);
    if (prior && prior !== result.runtimeResultId) {
      findings.push(finding("runtime-intent-multiple-results", "error", result.executionIntentId, "runtime execution intent has multiple results"));
    }
    resultByIntent.set(result.executionIntentId, result.runtimeResultId);
    if (result.rawOutputRetained || !noAuthority(result)) {
      findings.push(finding("runtime-result-retention", "error", result.runtimeResultId, "runtime result retained raw output or authority"));
    }
  }

  const returnIntentByResult = new Map<string, string>();
  for (const intent of status.returnIntents) {
    if (!fingerprintValid(
      intent as unknown as Record<string, unknown>,
      "returnIntentId",
      "returnIntentFingerprint",
    )) {
      findings.push(finding("runtime-return-intent-fingerprint", "error", intent.returnIntentId, "runtime return intent fingerprint is stale"));
    }
    const result = status.results.find((entry) => entry.runtimeResultId === intent.runtimeResultId);
    const acceptance = status.acceptances.find((entry) => entry.acceptanceId === intent.acceptanceId);
    const slot = status.slots.find((entry) => entry.slotId === intent.slotId);
    const expectedBody = result && acceptance
      ? {
          deliveryId: acceptance.deliveryId,
          rendezvousId: acceptance.rendezvousId,
          completedAt: result.completedAt,
          outcome: result.outcome,
          afterWorkOrder: result.afterWorkOrder,
          resultReferences: result.resultReferences,
          reason: result.reason,
        }
      : null;
    if (
      !result
      || !acceptance
      || !slot
      || result.runtimeResultFingerprint !== intent.runtimeResultFingerprint
      || acceptance.acceptanceFingerprint !== intent.acceptanceFingerprint
      || result.acceptanceId !== acceptance.acceptanceId
      || acceptance.slotId !== slot.slotId
      || slot.slotFingerprint !== intent.slotFingerprint
      || acceptance.deliveryId !== intent.deliveryId
      || acceptance.deliveryFingerprint !== intent.deliveryFingerprint
      || slot.deliveryCertificateFingerprint !== intent.deliveryCertificateFingerprint
      || acceptance.rendezvousId !== intent.rendezvousId
      || acceptance.rendezvousFingerprint !== intent.rendezvousFingerprint
      || stableJson(expectedBody) !== stableJson(intent.body)
      || intent.bodyDigest !== sha256(intent.body)
      || Date.parse(intent.preparedAt) < Date.parse(result.completedAt)
    ) {
      findings.push(finding("runtime-return-intent-parent", "error", intent.returnIntentId, "runtime return intent differs from result, slot, delivery, body, or chronology custody"));
    }
    const prior = returnIntentByResult.get(intent.runtimeResultId);
    if (prior && prior !== intent.returnIntentId) {
      findings.push(finding("runtime-result-multiple-return-intents", "error", intent.runtimeResultId, "runtime result has multiple return intents"));
    }
    returnIntentByResult.set(intent.runtimeResultId, intent.returnIntentId);
    if (intent.rawIdempotencyKeyRetained || !noAuthority(intent)) {
      findings.push(finding("runtime-return-intent-retention", "error", intent.returnIntentId, "runtime return intent retained raw idempotency custody or authority"));
    }
  }

  const receiptByIntent = new Map<string, string>();
  for (const receipt of status.returnReceipts) {
    if (!fingerprintValid(
      receipt as unknown as Record<string, unknown>,
      "returnReceiptId",
      "returnReceiptFingerprint",
    )) {
      findings.push(finding("runtime-return-receipt-fingerprint", "error", receipt.returnReceiptId, "runtime return receipt fingerprint is stale"));
    }
    const intent = status.returnIntents.find((entry) => entry.returnIntentId === receipt.returnIntentId);
    const result = status.results.find((entry) => entry.runtimeResultId === receipt.runtimeResultId);
    const acceptance = status.acceptances.find((entry) => entry.acceptanceId === receipt.acceptanceId);
    const slot = status.slots.find((entry) => entry.slotId === receipt.slotId);
    const returned = delivery.returns.find((entry) => entry.returnId === receipt.supervisedReturnId);
    const exchangeResult = exchange.results.find((entry) => entry.resultId === receipt.exchangeResultId);
    if (
      !intent
      || !result
      || !acceptance
      || !slot
      || !returned
      || !exchangeResult
      || intent.returnIntentFingerprint !== receipt.returnIntentFingerprint
      || result.runtimeResultFingerprint !== receipt.runtimeResultFingerprint
      || acceptance.acceptanceFingerprint !== receipt.acceptanceFingerprint
      || slot.slotFingerprint !== receipt.slotFingerprint
      || returned.returnFingerprint !== receipt.supervisedReturnFingerprint
      || exchangeResult.resultFingerprint !== receipt.exchangeResultFingerprint
      || returned.resultId !== exchangeResult.resultId
      || returned.settlementId !== receipt.settlementId
      || returned.settlementFingerprint !== receipt.settlementFingerprint
      || returned.deliveryId !== acceptance.deliveryId
      || returned.certificateFingerprint !== slot.deliveryCertificateFingerprint
      || Date.parse(receipt.recordedAt) < Date.parse(returned.completedAt)
    ) {
      findings.push(finding("runtime-return-receipt-parent", "error", receipt.returnReceiptId, "runtime return receipt differs from intent, result, delivery, exchange, settlement, or chronology custody"));
    } else {
      try {
        compareExchangeResult(result, exchangeResult);
      } catch (error) {
        findings.push(finding(
          "runtime-return-receipt-result",
          "error",
          receipt.returnReceiptId,
          error instanceof Error ? error.message : String(error),
        ));
      }
    }
    const prior = receiptByIntent.get(receipt.returnIntentId);
    if (prior && prior !== receipt.returnReceiptId) {
      findings.push(finding("runtime-return-intent-multiple-receipts", "error", receipt.returnIntentId, "runtime return intent has multiple receipts"));
    }
    receiptByIntent.set(receipt.returnIntentId, receipt.returnReceiptId);
    if (!noAuthority(receipt)) {
      findings.push(finding("runtime-return-receipt-authority", "error", receipt.returnReceiptId, "runtime return receipt acquired task or mutation authority"));
    }
  }

  const retirementBySlot = new Map<string, string>();
  for (const retirement of status.retirements) {
    if (!fingerprintValid(
      retirement as unknown as Record<string, unknown>,
      "retirementId",
      "retirementFingerprint",
    )) {
      findings.push(finding("runtime-retirement-fingerprint", "error", retirement.retirementId, "runtime retirement fingerprint is stale"));
    }
    const slot = status.slots.find((entry) => entry.slotId === retirement.slotId);
    const receiptAcceptanceIds = new Set(status.returnReceipts.map((entry) => entry.acceptanceId));
    const expectedPending = status.acceptances
      .filter((entry) => entry.slotId === retirement.slotId && !receiptAcceptanceIds.has(entry.acceptanceId))
      .map((entry) => entry.acceptanceId).sort();
    if (
      !slot
      || slot.slotFingerprint !== retirement.slotFingerprint
      || stableJson(expectedPending) !== stableJson(retirement.pendingAcceptanceIds)
      || (retirement.kind === "scheduled" && retirement.pendingAcceptanceIds.length > 0)
    ) {
      findings.push(finding("runtime-retirement-parent", "error", retirement.retirementId, "runtime retirement differs from slot or pending-assignment custody"));
    }
    const prior = retirementBySlot.get(retirement.slotId);
    if (prior && prior !== retirement.retirementId) {
      findings.push(finding("runtime-slot-multiple-retirements", "error", retirement.slotId, "runtime slot has multiple retirements"));
    }
    retirementBySlot.set(retirement.slotId, retirement.retirementId);
    if (!noAuthority(retirement)) {
      findings.push(finding("runtime-retirement-authority", "error", retirement.retirementId, "runtime retirement acquired task or mutation authority"));
    }
  }

  const strandedByAcceptance = new Map<string, string>();
  for (const stranded of status.stranded) {
    if (!fingerprintValid(
      stranded as unknown as Record<string, unknown>,
      "strandedId",
      "strandedFingerprint",
    )) {
      findings.push(finding("runtime-stranded-fingerprint", "error", stranded.strandedId, "runtime stranded-assignment fingerprint is stale"));
    }
    const retirement = status.retirements.find((entry) => entry.retirementId === stranded.retirementId);
    const slot = status.slots.find((entry) => entry.slotId === stranded.slotId);
    const acceptance = status.acceptances.find((entry) => entry.acceptanceId === stranded.acceptanceId);
    if (
      !retirement
      || !slot
      || !acceptance
      || retirement.kind !== "emergency"
      || retirement.retirementFingerprint !== stranded.retirementFingerprint
      || slot.slotFingerprint !== stranded.slotFingerprint
      || acceptance.acceptanceFingerprint !== stranded.acceptanceFingerprint
      || acceptance.deliveryId !== stranded.deliveryId
      || acceptance.deliveryFingerprint !== stranded.deliveryFingerprint
      || !retirement.pendingAcceptanceIds.includes(acceptance.acceptanceId)
      || stranded.successorMayInherit !== false
      || stranded.strandedAt !== retirement.retiredAt
    ) {
      findings.push(finding("runtime-stranded-parent", "error", stranded.strandedId, "runtime stranded record differs from emergency retirement, slot, or acceptance custody"));
    }
    const prior = strandedByAcceptance.get(stranded.acceptanceId);
    if (prior && prior !== stranded.strandedId) {
      findings.push(finding("runtime-acceptance-multiple-stranded", "error", stranded.acceptanceId, "runtime acceptance has multiple stranded records"));
    }
    strandedByAcceptance.set(stranded.acceptanceId, stranded.strandedId);
    if (!noAuthority(stranded)) {
      findings.push(finding("runtime-stranded-authority", "error", stranded.strandedId, "runtime stranded record acquired task or mutation authority"));
    }
    findings.push(finding(
      "runtime-assignment-stranded",
      "notice",
      stranded.strandedId,
      "emergency retirement stranded one certificate-specific assignment with successor inheritance disabled",
    ));
  }

  if (status.slots.length > 0) {
    const expected = buildState(root);
    if (!status.state) {
      findings.push(finding("runtime-state-missing", "error", status.paths.state, "runtime state projection is absent"));
    } else if (
      !fingerprintValid(
        status.state as unknown as Record<string, unknown>,
        "stateId",
        "stateFingerprint",
      )
      || stableJson(status.state) !== stableJson(expected)
    ) {
      findings.push(finding("runtime-state-invalid", "error", status.state.stateId, "runtime state differs from append-only records"));
    }
  }

  const directories: Array<[string, string, `sha256:${string}`[]]> = [
    [status.paths.slots, "runtime-slot-filename", status.slots.map((entry) => entry.slotFingerprint)],
    [status.paths.acceptances, "runtime-acceptance-filename", status.acceptances.map((entry) => entry.acceptanceFingerprint)],
    [status.paths.executionIntents, "runtime-intent-filename", status.executionIntents.map((entry) => entry.executionIntentFingerprint)],
    [status.paths.results, "runtime-result-filename", status.results.map((entry) => entry.runtimeResultFingerprint)],
    [status.paths.returnIntents, "runtime-return-intent-filename", status.returnIntents.map((entry) => entry.returnIntentFingerprint)],
    [status.paths.returnReceipts, "runtime-return-receipt-filename", status.returnReceipts.map((entry) => entry.returnReceiptFingerprint)],
    [status.paths.retirements, "runtime-retirement-filename", status.retirements.map((entry) => entry.retirementFingerprint)],
    [status.paths.stranded, "runtime-stranded-filename", status.stranded.map((entry) => entry.strandedFingerprint)],
  ];
  for (const [directory, code, digests] of directories) {
    findings.push(...verifyDigestDirectory(
      directory,
      new Set(digests.map((digest) => `${digest.slice("sha256:".length)}.json`)),
      code,
    ));
  }
  findings.push(...secretFindings(root));
  return sortedFindings(findings);
}
