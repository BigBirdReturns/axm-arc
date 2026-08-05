import fs from "node:fs";
import path from "node:path";
import {
  collectorContentId,
  sha256,
} from "./asoiaf-external-estate.js";
import {
  validateAsoiafAnswerWorkOrder,
  type AsoiafAnswerWorkAction,
  type AsoiafAnswerWorkItem,
  type AsoiafAnswerWorkOrder,
} from "./asoiaf-answer-work-order.js";
import {
  settleAsoiafAnswerWorkItem,
  validateAsoiafAnswerWorkLease,
  type AsoiafAnswerWorkLease,
  type AsoiafAnswerWorkResultReference,
  type AsoiafAnswerWorkSettlement,
  type AsoiafAnswerWorkSettlementOutcome,
} from "./asoiaf-answer-work-lease.js";
import {
  claimAsoiafAnswerDeskWork,
  readAsoiafAnswerDeskStatus,
  settleAsoiafAnswerDeskWork,
  type AsoiafAnswerDeskClaimResult,
  type AsoiafAnswerDeskSettleResult,
  type AsoiafAnswerDeskWorkOrderRecord,
} from "./asoiaf-answer-desk-estate.js";
import {
  ASOIAF_REVIEWED_RENDER_WORKER_ID,
  buildAsoiafAnswerWorkerManifest,
  planAsoiafAnswerDeskWorkers,
  verifyAsoiafAnswerDeskWorkerEstate,
  type AsoiafAnswerWorkerPlan,
  type AsoiafAnswerWorkerRequiredActor,
} from "./asoiaf-answer-desk-worker.js";

export const ASOIAF_ANSWER_EXCHANGE_ASSIGNMENT_FORMAT =
  "axm-asoiaf-answer-exchange-assignment/1" as const;
export const ASOIAF_ANSWER_EXCHANGE_RESULT_FORMAT =
  "axm-asoiaf-answer-exchange-result/1" as const;

export type AsoiafAnswerExchangeActorRole = Exclude<
  AsoiafAnswerWorkerRequiredActor,
  "reviewed-renderer"
>;

export type AsoiafAnswerExchangeOutcome = Exclude<
  AsoiafAnswerWorkSettlementOutcome,
  "rendered"
>;

export interface AsoiafAnswerExchangePaths {
  root: string;
  exchangeRoot: string;
  assignments: string;
  results: string;
}

export interface AsoiafAnswerExchangeAssignment {
  format: typeof ASOIAF_ANSWER_EXCHANGE_ASSIGNMENT_FORMAT;
  assignmentId: string;
  assignmentFingerprint: `sha256:${string}`;
  workerManifestFingerprint: `sha256:${string}`;
  workOrderId: string;
  workOrderFingerprint: `sha256:${string}`;
  dossierId: string;
  questionId: string;
  itemId: string;
  itemFingerprint: `sha256:${string}`;
  itemKey: `sha256:${string}`;
  action: Exclude<AsoiafAnswerWorkAction, "render-reviewed-answer">;
  stage: AsoiafAnswerWorkItem["stage"];
  subjectIds: string[];
  dependencyItemIds: string[];
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  claimedAt: string;
  issuedAt: string;
  expiresAt: string;
  leaseMilliseconds: number;
  leaseId: string;
  leaseFingerprint: `sha256:${string}`;
  networkAccess: "none" | "required";
  privateTextAccess: "none" | "required";
  humanReview: "none" | "required";
  acceptedResultKinds: string[];
  privateTextIncluded: false;
  sourceTextIncluded: false;
  workOrder: AsoiafAnswerWorkOrder;
  lease: AsoiafAnswerWorkLease;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

export interface AsoiafAnswerExchangeIssueInput {
  root: string;
  itemId?: string | null;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  claimedAt: string;
  issuedAt?: string;
  leaseMilliseconds: number;
  operatorId?: string;
}

export interface AsoiafAnswerExchangeIssueResult {
  plan: AsoiafAnswerWorkerPlan;
  claim: AsoiafAnswerDeskClaimResult;
  assignment: AsoiafAnswerExchangeAssignment;
  assignmentUri: string;
  assignmentReplayed: boolean;
}

export interface AsoiafAnswerExchangeResultInput {
  root: string;
  assignmentId: string;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  completedAt: string;
  outcome: AsoiafAnswerExchangeOutcome;
  afterWorkOrder?: AsoiafAnswerWorkOrder | null;
  resultReferences?: AsoiafAnswerWorkResultReference[];
  reason: string;
  operatorId?: string;
}

export interface AsoiafAnswerExchangeResult {
  format: typeof ASOIAF_ANSWER_EXCHANGE_RESULT_FORMAT;
  resultId: string;
  resultFingerprint: `sha256:${string}`;
  assignmentId: string;
  assignmentFingerprint: `sha256:${string}`;
  leaseId: string;
  leaseFingerprint: `sha256:${string}`;
  workOrderId: string;
  workOrderFingerprint: `sha256:${string}`;
  itemId: string;
  itemFingerprint: `sha256:${string}`;
  itemKey: `sha256:${string}`;
  action: Exclude<AsoiafAnswerWorkAction, "render-reviewed-answer">;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  claimedAt: string;
  issuedAt: string;
  completedAt: string;
  outcome: AsoiafAnswerExchangeOutcome;
  afterWorkOrderId: string | null;
  afterWorkOrderFingerprint: `sha256:${string}` | null;
  afterWorkOrder: AsoiafAnswerWorkOrder | null;
  resultReferences: AsoiafAnswerWorkResultReference[];
  reason: string;
  declaredNetworkAccess: "none" | "required";
  declaredPrivateTextAccess: "none" | "required";
  declaredHumanReview: "none" | "required";
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

export interface AsoiafAnswerExchangeAdmitResult {
  result: AsoiafAnswerExchangeResult;
  resultUri: string;
  resultReplayed: boolean;
  settlement: AsoiafAnswerDeskSettleResult;
}

export interface AsoiafAnswerExchangeStatus {
  paths: AsoiafAnswerExchangePaths;
  plan: AsoiafAnswerWorkerPlan;
  assignments: AsoiafAnswerExchangeAssignment[];
  results: AsoiafAnswerExchangeResult[];
}

export interface AsoiafAnswerExchangeFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

function finding(
  code: string,
  severity: AsoiafAnswerExchangeFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafAnswerExchangeFinding {
  return { code, severity, subjectId, detail };
}

function sortedFindings(
  findings: readonly AsoiafAnswerExchangeFinding[],
): AsoiafAnswerExchangeFinding[] {
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

function validFingerprint(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/.test(value);
}

function normalizedStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function normalizedResultReferences(
  references: readonly AsoiafAnswerWorkResultReference[],
): AsoiafAnswerWorkResultReference[] {
  const normalized = references.map((reference) => {
    if (
      !reference.kind.trim()
      || !reference.objectId.trim()
      || !validFingerprint(reference.fingerprint)
      || (reference.uri !== null && !reference.uri.trim())
    ) {
      throw new Error("external answer result reference is malformed");
    }
    return {
      kind: reference.kind.trim(),
      objectId: reference.objectId.trim(),
      fingerprint: reference.fingerprint,
      uri: reference.uri?.trim() ?? null,
    };
  });
  const byIdentity = new Map(
    normalized.map((reference) => [JSON.stringify(reference), reference] as const),
  );
  return [...byIdentity.values()].sort(
    (left, right) =>
      left.kind.localeCompare(right.kind)
      || left.objectId.localeCompare(right.objectId)
      || left.fingerprint.localeCompare(right.fingerprint)
      || (left.uri ?? "").localeCompare(right.uri ?? ""),
  );
}

export function acceptedAsoiafAnswerExchangeResultKinds(
  action: AsoiafAnswerWorkAction,
): string[] {
  switch (action) {
    case "acquire-public-record":
      return ["structured-public-observation"];
    case "search-private-edition":
      return ["private-search-result"];
    case "resolve-edition":
      return ["edition-resolution"];
    case "inspect-disposition":
      return ["disposition-inspection"];
    case "split-continuity":
      return ["continuity-split-decision", "reviewed-answer-transaction"];
    case "review-structured-observation":
    case "review-exact-locator":
    case "reconcile-candidate":
      return ["reviewed-answer-transaction"];
    case "close-gap":
    case "assemble-reviewed-answer":
      return ["reviewed-answer-packet"];
    case "verify-reviewed-answer":
      return ["reviewed-answer-packet", "reviewed-answer-verification"];
    case "render-reviewed-answer":
      return [];
  }
}

export function asoiafAnswerExchangePaths(
  root: string,
): AsoiafAnswerExchangePaths {
  const absolute = path.resolve(root);
  const exchangeRoot = path.join(absolute, "answer-exchange");
  return {
    root: absolute,
    exchangeRoot,
    assignments: path.join(exchangeRoot, "assignments"),
    results: path.join(exchangeRoot, "results"),
  };
}

function relativeUri(root: string, target: string): string {
  return path.relative(path.resolve(root), path.resolve(target)).split(path.sep).join("/");
}

function resolveEstateUri(root: string, uri: string): string | null {
  if (
    !uri.trim()
    || path.isAbsolute(uri)
    || uri.includes("\\")
    || /^[a-z][a-z0-9+.-]*:/i.test(uri)
  ) {
    return null;
  }
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, uri);
  if (target !== absoluteRoot && !target.startsWith(`${absoluteRoot}${path.sep}`)) {
    return null;
  }
  return target;
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

function writeJsonExclusiveOrReplay(target: string, value: unknown): boolean {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    fs.writeFileSync(target, serialized, { encoding: "utf8", flag: "wx" });
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = fs.readFileSync(target, "utf8");
    if (existing !== serialized) {
      throw new Error(`answer exchange immutable file collision at ${target}`);
    }
    return true;
  }
}

function ensureExchangeBaseValid(root: string): void {
  const errors = verifyAsoiafAnswerDeskWorkerEstate(root)
    .filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `invalid answer desk worker estate: ${errors
        .map((entry) => `${entry.code}:${entry.subjectId}`)
        .join(", ")}`,
    );
  }
}

function workOrderPathFromRecord(
  root: string,
  record: AsoiafAnswerDeskWorkOrderRecord,
): string {
  const target = resolveEstateUri(root, record.workOrderUri);
  if (!target || !fs.existsSync(target)) {
    throw new Error(`answer desk work-order file ${record.workOrderUri} is absent or unsafe`);
  }
  return target;
}

function readWorkOrders(
  root: string,
  records: readonly AsoiafAnswerDeskWorkOrderRecord[],
): Map<string, AsoiafAnswerWorkOrder> {
  const orders = new Map<string, AsoiafAnswerWorkOrder>();
  for (const record of records) {
    const workOrder = readJson<AsoiafAnswerWorkOrder>(
      workOrderPathFromRecord(root, record),
    );
    const errors = validateAsoiafAnswerWorkOrder(workOrder)
      .filter((entry) => entry.severity === "error");
    if (errors.length > 0) {
      throw new Error(`stored answer work order ${workOrder.workOrderId} is invalid`);
    }
    orders.set(workOrder.workOrderId, workOrder);
  }
  return orders;
}

function capabilityForAction(action: AsoiafAnswerWorkAction) {
  const capability = buildAsoiafAnswerWorkerManifest().capabilities.find(
    (entry) => entry.action === action,
  );
  if (!capability) throw new Error(`answer worker capability ${action} is absent`);
  return capability;
}

function externalRole(value: AsoiafAnswerWorkerRequiredActor): value is AsoiafAnswerExchangeActorRole {
  return value !== "reviewed-renderer";
}

function assignmentCore(
  assignment: AsoiafAnswerExchangeAssignment,
): Omit<
  AsoiafAnswerExchangeAssignment,
  "assignmentId" | "assignmentFingerprint"
> {
  const {
    assignmentId: _id,
    assignmentFingerprint: _fingerprint,
    ...core
  } = assignment;
  return core;
}

export function buildAsoiafAnswerExchangeAssignment(input: {
  workOrder: AsoiafAnswerWorkOrder;
  lease: AsoiafAnswerWorkLease;
  actorRole: AsoiafAnswerExchangeActorRole;
  issuedAt: string;
}): AsoiafAnswerExchangeAssignment {
  const workOrderErrors = validateAsoiafAnswerWorkOrder(input.workOrder)
    .filter((entry) => entry.severity === "error");
  if (workOrderErrors.length > 0) {
    throw new Error(`invalid exchange work order ${input.workOrder.workOrderId}`);
  }
  const leaseErrors = validateAsoiafAnswerWorkLease(input.lease, input.workOrder)
    .filter((entry) => entry.severity === "error");
  if (leaseErrors.length > 0) {
    throw new Error(`invalid exchange lease ${input.lease.leaseId}`);
  }
  if (input.lease.action === "render-reviewed-answer") {
    throw new Error("reviewed rendering belongs to the built-in automatic worker");
  }
  const capability = capabilityForAction(input.lease.action);
  if (
    capability.executionMode !== "external-required"
    || !externalRole(capability.requiredActor)
    || capability.requiredActor !== input.actorRole
  ) {
    throw new Error(`answer action ${input.lease.action} does not belong to actor role ${input.actorRole}`);
  }
  if (
    !validTime(input.issuedAt)
    || Date.parse(input.issuedAt) < Date.parse(input.lease.claimedAt)
    || Date.parse(input.issuedAt) > Date.parse(input.lease.expiresAt)
  ) {
    throw new Error("external assignment issue time is outside the active lease");
  }
  const item = input.workOrder.items.find(
    (entry) => entry.itemId === input.lease.itemId,
  );
  if (!item) throw new Error("external assignment lease item is absent");
  const acceptedResultKinds = acceptedAsoiafAnswerExchangeResultKinds(item.action);
  if (acceptedResultKinds.length === 0) {
    throw new Error(`answer action ${item.action} has no external settlement result kind`);
  }
  const manifest = buildAsoiafAnswerWorkerManifest();
  const core = {
    format: ASOIAF_ANSWER_EXCHANGE_ASSIGNMENT_FORMAT,
    workerManifestFingerprint: manifest.manifestFingerprint,
    workOrderId: input.workOrder.workOrderId,
    workOrderFingerprint: input.workOrder.workOrderFingerprint,
    dossierId: input.workOrder.dossierId,
    questionId: input.workOrder.questionId,
    itemId: item.itemId,
    itemFingerprint: item.itemFingerprint,
    itemKey: input.lease.itemKey,
    action: item.action as Exclude<AsoiafAnswerWorkAction, "render-reviewed-answer">,
    stage: item.stage,
    subjectIds: [...item.subjectIds],
    dependencyItemIds: [...item.dependencyItemIds],
    actorId: input.lease.workerId,
    actorRole: input.actorRole,
    claimedAt: input.lease.claimedAt,
    issuedAt: input.issuedAt,
    expiresAt: input.lease.expiresAt,
    leaseMilliseconds: input.lease.leaseMilliseconds,
    leaseId: input.lease.leaseId,
    leaseFingerprint: input.lease.leaseFingerprint,
    networkAccess: capability.networkAccess,
    privateTextAccess: capability.privateTextAccess,
    humanReview: capability.humanReview,
    acceptedResultKinds,
    privateTextIncluded: false as const,
    sourceTextIncluded: false as const,
    workOrder: input.workOrder,
    lease: input.lease,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const assignmentFingerprint = sha256(core);
  return {
    ...core,
    assignmentId: collectorContentId("asoiaf-answer-exchange-assignment", {
      leaseId: core.leaseId,
      actorRole: core.actorRole,
      assignmentFingerprint,
    }),
    assignmentFingerprint,
  };
}

export function validateAsoiafAnswerExchangeAssignment(
  assignment: AsoiafAnswerExchangeAssignment,
): AsoiafAnswerExchangeFinding[] {
  const findings: AsoiafAnswerExchangeFinding[] = [];
  let expected: AsoiafAnswerExchangeAssignment | null = null;
  try {
    expected = buildAsoiafAnswerExchangeAssignment({
      workOrder: assignment.workOrder,
      lease: assignment.lease,
      actorRole: assignment.actorRole,
      issuedAt: assignment.issuedAt,
    });
  } catch (error) {
    findings.push(finding("exchange-assignment-input", "error", assignment.assignmentId, error instanceof Error ? error.message : String(error)));
  }
  if (assignment.format !== ASOIAF_ANSWER_EXCHANGE_ASSIGNMENT_FORMAT) {
    findings.push(finding("exchange-assignment-format", "error", assignment.assignmentId, "external assignment format is invalid"));
  }
  if (expected && JSON.stringify(assignment) !== JSON.stringify(expected)) {
    findings.push(finding("exchange-assignment-projection", "error", assignment.assignmentId, "external assignment differs from its exact work order, lease, actor, or capability"));
  }
  if (assignment.assignmentFingerprint !== sha256(assignmentCore(assignment))) {
    findings.push(finding("exchange-assignment-fingerprint", "error", assignment.assignmentId, "external assignment fingerprint is stale"));
  }
  if (
    assignment.privateTextIncluded !== false
    || assignment.sourceTextIncluded !== false
    || assignment.authority !== "none"
    || assignment.graphEffect !== "none"
    || assignment.canonEffect !== "none"
    || assignment.answerEffect !== "none"
  ) {
    findings.push(finding("exchange-assignment-authority", "error", assignment.assignmentId, "external assignment acquired source text or task authority"));
  }
  return sortedFindings(findings);
}

function assignmentPath(
  paths: AsoiafAnswerExchangePaths,
  assignment: AsoiafAnswerExchangeAssignment,
): string {
  return path.join(
    paths.assignments,
    `${assignment.assignmentFingerprint.slice("sha256:".length)}.json`,
  );
}

function persistAssignment(
  root: string,
  assignment: AsoiafAnswerExchangeAssignment,
): { uri: string; replayed: boolean } {
  const paths = asoiafAnswerExchangePaths(root);
  const target = assignmentPath(paths, assignment);
  return {
    uri: relativeUri(root, target),
    replayed: writeJsonExclusiveOrReplay(target, assignment),
  };
}

function matchingExistingLease(input: AsoiafAnswerExchangeIssueInput): AsoiafAnswerWorkLease | null {
  const status = readAsoiafAnswerDeskStatus(input.root);
  return status.leases.find(
    (lease) =>
      lease.workerId === input.actorId
      && lease.claimedAt === input.claimedAt
      && lease.leaseMilliseconds === input.leaseMilliseconds
      && lease.action !== "render-reviewed-answer"
      && (!input.itemId || lease.itemId === input.itemId),
  ) ?? null;
}

export function issueAsoiafAnswerExchangeAssignment(
  input: AsoiafAnswerExchangeIssueInput,
): AsoiafAnswerExchangeIssueResult {
  ensureExchangeBaseValid(input.root);
  if (!input.actorId.trim()) throw new Error("external actor identity is required");
  const plan = planAsoiafAnswerDeskWorkers(input.root);
  const existingLease = matchingExistingLease(input);
  const itemId = existingLease?.itemId
    ?? input.itemId
    ?? plan.externalAvailableItemIds[0]
    ?? null;
  if (!itemId) {
    if (plan.nextAutomaticItemId) {
      throw new Error("next available answer work is automatic and belongs to the built-in renderer");
    }
    throw new Error("answer desk has no available external work item");
  }
  if (!existingLease) {
    const assignment = plan.assignments.find((entry) => entry.itemId === itemId);
    if (
      !assignment
      || assignment.deskStatus !== "available"
      || assignment.executionMode !== "external-required"
      || assignment.requiredActor !== input.actorRole
    ) {
      throw new Error(`answer work item ${itemId} is not available to external actor role ${input.actorRole}`);
    }
  }
  const claim = claimAsoiafAnswerDeskWork({
    root: input.root,
    itemId,
    workerId: input.actorId,
    claimedAt: input.claimedAt,
    leaseMilliseconds: input.leaseMilliseconds,
    operatorId: input.operatorId ?? `${input.actorId}:exchange-claim`,
  });
  const status = readAsoiafAnswerDeskStatus(input.root);
  const workOrderRecord = status.workOrders.find(
    (entry) => entry.workOrderId === claim.lease.workOrderId,
  );
  if (!workOrderRecord) {
    throw new Error(`external assignment work-order record ${claim.lease.workOrderId} is absent`);
  }
  const workOrder = readJson<AsoiafAnswerWorkOrder>(
    workOrderPathFromRecord(input.root, workOrderRecord),
  );
  const assignment = buildAsoiafAnswerExchangeAssignment({
    workOrder,
    lease: claim.lease,
    actorRole: input.actorRole,
    issuedAt: input.issuedAt ?? input.claimedAt,
  });
  const persisted = persistAssignment(input.root, assignment);
  return {
    plan,
    claim,
    assignment,
    assignmentUri: persisted.uri,
    assignmentReplayed: persisted.replayed,
  };
}

function resultCore(
  result: AsoiafAnswerExchangeResult,
): Omit<AsoiafAnswerExchangeResult, "resultId" | "resultFingerprint"> {
  const { resultId: _id, resultFingerprint: _fingerprint, ...core } = result;
  return core;
}

export function buildAsoiafAnswerExchangeResult(input: {
  assignment: AsoiafAnswerExchangeAssignment;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  completedAt: string;
  outcome: AsoiafAnswerExchangeOutcome;
  afterWorkOrder?: AsoiafAnswerWorkOrder | null;
  resultReferences?: AsoiafAnswerWorkResultReference[];
  reason: string;
}): AsoiafAnswerExchangeResult {
  const assignmentErrors = validateAsoiafAnswerExchangeAssignment(input.assignment)
    .filter((entry) => entry.severity === "error");
  if (assignmentErrors.length > 0) {
    throw new Error(`invalid external assignment ${input.assignment.assignmentId}`);
  }
  if (
    input.actorId !== input.assignment.actorId
    || input.actorRole !== input.assignment.actorRole
  ) {
    throw new Error("external result actor differs from the issued assignment");
  }
  if (
    !validTime(input.completedAt)
    || Date.parse(input.completedAt) < Date.parse(input.assignment.issuedAt)
  ) {
    throw new Error("external result completion time is invalid or precedes assignment issue");
  }
  if (input.outcome === "rendered") {
    throw new Error("external exchange cannot admit the built-in rendered outcome");
  }
  if (input.reason.trim().length < 24) {
    throw new Error("external result requires a substantive reason");
  }
  const resultReferences = normalizedResultReferences(input.resultReferences ?? []);
  const acceptedKinds = new Set(input.assignment.acceptedResultKinds);
  if (resultReferences.some((reference) => !acceptedKinds.has(reference.kind))) {
    throw new Error(
      `external result kind must remain within ${input.assignment.acceptedResultKinds.join(", ")}`,
    );
  }
  const advancing = input.outcome === "satisfied"
    || input.outcome === "preserved-as-limitation";
  if (advancing && resultReferences.length === 0) {
    throw new Error("advancing external result requires at least one accepted result reference");
  }
  const afterWorkOrder = input.afterWorkOrder ?? null;
  const core = {
    format: ASOIAF_ANSWER_EXCHANGE_RESULT_FORMAT,
    assignmentId: input.assignment.assignmentId,
    assignmentFingerprint: input.assignment.assignmentFingerprint,
    leaseId: input.assignment.leaseId,
    leaseFingerprint: input.assignment.leaseFingerprint,
    workOrderId: input.assignment.workOrderId,
    workOrderFingerprint: input.assignment.workOrderFingerprint,
    itemId: input.assignment.itemId,
    itemFingerprint: input.assignment.itemFingerprint,
    itemKey: input.assignment.itemKey,
    action: input.assignment.action,
    actorId: input.actorId,
    actorRole: input.actorRole,
    claimedAt: input.assignment.claimedAt,
    issuedAt: input.assignment.issuedAt,
    completedAt: input.completedAt,
    outcome: input.outcome,
    afterWorkOrderId: afterWorkOrder?.workOrderId ?? null,
    afterWorkOrderFingerprint: afterWorkOrder?.workOrderFingerprint ?? null,
    afterWorkOrder,
    resultReferences,
    reason: input.reason.trim(),
    declaredNetworkAccess: input.assignment.networkAccess,
    declaredPrivateTextAccess: input.assignment.privateTextAccess,
    declaredHumanReview: input.assignment.humanReview,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const resultFingerprint = sha256(core);
  return {
    ...core,
    resultId: collectorContentId("asoiaf-answer-exchange-result", {
      assignmentId: core.assignmentId,
      actorId: core.actorId,
      outcome: core.outcome,
      resultFingerprint,
    }),
    resultFingerprint,
  };
}

function resultPath(
  paths: AsoiafAnswerExchangePaths,
  result: AsoiafAnswerExchangeResult,
): string {
  return path.join(
    paths.results,
    `${result.resultFingerprint.slice("sha256:".length)}.json`,
  );
}

function externalResultReference(
  root: string,
  result: AsoiafAnswerExchangeResult,
): AsoiafAnswerWorkResultReference {
  return {
    kind: "answer-exchange-result",
    objectId: result.resultId,
    fingerprint: result.resultFingerprint,
    uri: relativeUri(root, resultPath(asoiafAnswerExchangePaths(root), result)),
  };
}

function settlementReferences(
  root: string,
  result: AsoiafAnswerExchangeResult,
): AsoiafAnswerWorkResultReference[] {
  return normalizedResultReferences([
    externalResultReference(root, result),
    ...result.resultReferences,
  ]);
}

function previewSettlement(
  root: string,
  assignment: AsoiafAnswerExchangeAssignment,
  result: AsoiafAnswerExchangeResult,
): AsoiafAnswerWorkSettlement {
  return settleAsoiafAnswerWorkItem({
    lease: assignment.lease,
    beforeWorkOrder: assignment.workOrder,
    completedAt: result.completedAt,
    outcome: result.outcome,
    afterWorkOrder: result.afterWorkOrder,
    resultReferences: settlementReferences(root, result),
    reason: result.reason,
  });
}

export function validateAsoiafAnswerExchangeResult(
  root: string,
  result: AsoiafAnswerExchangeResult,
  assignment: AsoiafAnswerExchangeAssignment,
): AsoiafAnswerExchangeFinding[] {
  const findings = validateAsoiafAnswerExchangeAssignment(assignment);
  let expected: AsoiafAnswerExchangeResult | null = null;
  try {
    expected = buildAsoiafAnswerExchangeResult({
      assignment,
      actorId: result.actorId,
      actorRole: result.actorRole,
      completedAt: result.completedAt,
      outcome: result.outcome,
      afterWorkOrder: result.afterWorkOrder,
      resultReferences: result.resultReferences,
      reason: result.reason,
    });
    previewSettlement(root, assignment, expected);
  } catch (error) {
    findings.push(finding("exchange-result-input", "error", result.resultId, error instanceof Error ? error.message : String(error)));
  }
  if (result.format !== ASOIAF_ANSWER_EXCHANGE_RESULT_FORMAT) {
    findings.push(finding("exchange-result-format", "error", result.resultId, "external result format is invalid"));
  }
  if (expected && JSON.stringify(result) !== JSON.stringify(expected)) {
    findings.push(finding("exchange-result-projection", "error", result.resultId, "external result differs from its assignment, actor, work order, or payload custody"));
  }
  if (result.resultFingerprint !== sha256(resultCore(result))) {
    findings.push(finding("exchange-result-fingerprint", "error", result.resultId, "external result fingerprint is stale"));
  }
  if (
    result.authority !== "none"
    || result.graphEffect !== "none"
    || result.canonEffect !== "none"
    || result.answerEffect !== "none"
  ) {
    findings.push(finding("exchange-result-authority", "error", result.resultId, "external result envelope acquired task, graph, canon, or answer authority"));
  }
  return sortedFindings(findings);
}

function findAssignmentById(
  root: string,
  assignmentId: string,
): AsoiafAnswerExchangeAssignment {
  const matches = listJson<AsoiafAnswerExchangeAssignment>(
    asoiafAnswerExchangePaths(root).assignments,
  ).filter((entry) => entry.assignmentId === assignmentId);
  if (matches.length !== 1) {
    throw new Error(`external assignment ${assignmentId} is absent or duplicated`);
  }
  return matches[0]!;
}

export function admitAsoiafAnswerExchangeResult(
  input: AsoiafAnswerExchangeResultInput,
): AsoiafAnswerExchangeAdmitResult {
  ensureExchangeBaseValid(input.root);
  const assignment = findAssignmentById(input.root, input.assignmentId);
  const result = buildAsoiafAnswerExchangeResult({
    assignment,
    actorId: input.actorId,
    actorRole: input.actorRole,
    completedAt: input.completedAt,
    outcome: input.outcome,
    afterWorkOrder: input.afterWorkOrder,
    resultReferences: input.resultReferences,
    reason: input.reason,
  });
  const expectedSettlement = previewSettlement(input.root, assignment, result);
  const paths = asoiafAnswerExchangePaths(input.root);
  const target = resultPath(paths, result);
  const resultReplayed = writeJsonExclusiveOrReplay(target, result);
  const settlement = settleAsoiafAnswerDeskWork({
    root: input.root,
    leaseId: assignment.leaseId,
    completedAt: result.completedAt,
    outcome: result.outcome,
    afterWorkOrder: result.afterWorkOrder,
    resultReferences: settlementReferences(input.root, result),
    reason: result.reason,
    operatorId: input.operatorId ?? `${input.actorId}:exchange-settle`,
  });
  if (JSON.stringify(settlement.settlement) !== JSON.stringify(expectedSettlement)) {
    throw new Error("persistent desk settlement differs from prevalidated external result custody");
  }
  return {
    result,
    resultUri: relativeUri(input.root, target),
    resultReplayed,
    settlement,
  };
}

export function readAsoiafAnswerExchangeStatus(
  root: string,
): AsoiafAnswerExchangeStatus {
  return {
    paths: asoiafAnswerExchangePaths(root),
    plan: planAsoiafAnswerDeskWorkers(root),
    assignments: listJson<AsoiafAnswerExchangeAssignment>(
      asoiafAnswerExchangePaths(root).assignments,
    ),
    results: listJson<AsoiafAnswerExchangeResult>(
      asoiafAnswerExchangePaths(root).results,
    ),
  };
}

export function verifyAsoiafAnswerExchangeEstate(
  root: string,
): AsoiafAnswerExchangeFinding[] {
  const findings: AsoiafAnswerExchangeFinding[] = [];
  for (const entry of verifyAsoiafAnswerDeskWorkerEstate(root)) {
    findings.push(finding(`worker:${entry.code}`, entry.severity, entry.subjectId, entry.detail));
  }
  let desk: ReturnType<typeof readAsoiafAnswerDeskStatus>;
  let exchange: AsoiafAnswerExchangeStatus;
  try {
    desk = readAsoiafAnswerDeskStatus(root);
    exchange = readAsoiafAnswerExchangeStatus(root);
  } catch (error) {
    findings.push(finding("exchange-estate-read", "error", path.resolve(root), error instanceof Error ? error.message : String(error)));
    return sortedFindings(findings);
  }
  const workOrders = readWorkOrders(root, desk.workOrders);
  const leasesById = new Map(desk.leases.map((lease) => [lease.leaseId, lease] as const));
  const settlementsByLease = new Map(
    desk.settlements.map((settlement) => [settlement.leaseId, settlement] as const),
  );
  const assignmentsById = new Map<string, AsoiafAnswerExchangeAssignment>();
  const assignmentsByLease = new Map<string, AsoiafAnswerExchangeAssignment>();
  for (const assignment of exchange.assignments) {
    if (assignmentsById.has(assignment.assignmentId)) {
      findings.push(finding("exchange-assignment-duplicate", "error", assignment.assignmentId, "external assignment identity is duplicated"));
    }
    if (assignmentsByLease.has(assignment.leaseId)) {
      findings.push(finding("exchange-assignment-lease-duplicate", "error", assignment.leaseId, "external lease has multiple assignment bundles"));
    }
    assignmentsById.set(assignment.assignmentId, assignment);
    assignmentsByLease.set(assignment.leaseId, assignment);
    findings.push(...validateAsoiafAnswerExchangeAssignment(assignment));
    const lease = leasesById.get(assignment.leaseId);
    const workOrder = workOrders.get(assignment.workOrderId);
    if (
      !lease
      || !workOrder
      || JSON.stringify(lease) !== JSON.stringify(assignment.lease)
      || JSON.stringify(workOrder) !== JSON.stringify(assignment.workOrder)
    ) {
      findings.push(finding("exchange-assignment-desk-custody", "error", assignment.assignmentId, "external assignment differs from persistent lease or work-order custody"));
    }
  }
  const resultsByAssignment = new Map<string, AsoiafAnswerExchangeResult>();
  for (const result of exchange.results) {
    if (resultsByAssignment.has(result.assignmentId)) {
      findings.push(finding("exchange-result-assignment-duplicate", "error", result.assignmentId, "external assignment has multiple result envelopes"));
    }
    resultsByAssignment.set(result.assignmentId, result);
    const assignment = assignmentsById.get(result.assignmentId);
    if (!assignment) {
      findings.push(finding("exchange-result-assignment-missing", "error", result.resultId, "external result references an absent assignment"));
      continue;
    }
    findings.push(...validateAsoiafAnswerExchangeResult(root, result, assignment));
    const settlement = settlementsByLease.get(result.leaseId);
    let expectedSettlement: AsoiafAnswerWorkSettlement | null = null;
    try {
      expectedSettlement = previewSettlement(root, assignment, result);
    } catch {
      // The validator above already reports the structural result failure.
    }
    if (!settlement || !expectedSettlement || JSON.stringify(settlement) !== JSON.stringify(expectedSettlement)) {
      findings.push(finding("exchange-result-settlement", "error", result.resultId, "external result is not bound by its exact persistent settlement"));
    }
  }
  for (const assignment of exchange.assignments) {
    const result = resultsByAssignment.get(assignment.assignmentId);
    const settlement = settlementsByLease.get(assignment.leaseId);
    if (!result && settlement) {
      findings.push(finding("exchange-assignment-result-missing", "error", assignment.assignmentId, "external assignment settled without its typed result envelope"));
    } else if (!result && !settlement) {
      findings.push(finding("exchange-assignment-pending", "warning", assignment.assignmentId, "external assignment has no admitted result"));
    }
  }
  for (const lease of desk.leases) {
    if (
      lease.action !== "render-reviewed-answer"
      && lease.workerId !== ASOIAF_REVIEWED_RENDER_WORKER_ID
      && !assignmentsByLease.has(lease.leaseId)
    ) {
      findings.push(finding("exchange-lease-assignment-missing", "warning", lease.leaseId, "external lease has no retained assignment bundle"));
    }
  }
  for (const [directory, code] of [
    [exchange.paths.assignments, "exchange-assignment-name"],
    [exchange.paths.results, "exchange-result-name"],
  ] as const) {
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory).sort()) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) {
        findings.push(finding(code, "error", name, "exchange filename is not a SHA-256 digest"));
      }
    }
  }
  return sortedFindings(findings);
}
