import {
  compareCodepoints,
  orderedStrings,
} from "../../src/engine/determinism.js";
import {
  collectorContentId,
  sha256,
} from "./asoiaf-external-estate.js";
import {
  validateAsoiafAnswerWorkOrder,
  type AsoiafAnswerWorkAction,
  type AsoiafAnswerWorkItem,
  type AsoiafAnswerWorkItemStatus,
  type AsoiafAnswerWorkOrder,
  type AsoiafAnswerWorkStage,
} from "./asoiaf-answer-work-order.js";

export const ASOIAF_ANSWER_WORK_LEASE_FORMAT =
  "axm-asoiaf-answer-work-lease/1" as const;
export const ASOIAF_ANSWER_WORK_SETTLEMENT_FORMAT =
  "axm-asoiaf-answer-work-settlement/1" as const;
export const ASOIAF_ANSWER_DESK_STATE_FORMAT =
  "axm-asoiaf-answer-desk-state/1" as const;

export type AsoiafAnswerWorkSettlementOutcome =
  | "satisfied"
  | "preserved-as-limitation"
  | "rendered"
  | "refused"
  | "failed"
  | "cancelled"
  | "expired"
  | "stale";

export interface AsoiafAnswerWorkResultReference {
  kind: string;
  objectId: string;
  fingerprint: string;
  uri: string | null;
}

export interface AsoiafAnswerWorkLease {
  format: typeof ASOIAF_ANSWER_WORK_LEASE_FORMAT;
  leaseId: string;
  workOrderId: string;
  workOrderFingerprint: `sha256:${string}`;
  dossierId: string;
  questionId: string;
  itemId: string;
  itemFingerprint: `sha256:${string}`;
  itemKey: `sha256:${string}`;
  action: AsoiafAnswerWorkAction;
  stage: AsoiafAnswerWorkStage;
  subjectIds: string[];
  dependencyItemIds: string[];
  workerId: string;
  claimedAt: string;
  expiresAt: string;
  leaseMilliseconds: number;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  leaseFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerWorkLeaseInput {
  workOrder: AsoiafAnswerWorkOrder;
  itemId: string;
  workerId: string;
  claimedAt: string;
  leaseMilliseconds: number;
  existingLeases?: AsoiafAnswerWorkLease[];
  settlements?: AsoiafAnswerWorkSettlement[];
}

export interface AsoiafAnswerWorkSettlement {
  format: typeof ASOIAF_ANSWER_WORK_SETTLEMENT_FORMAT;
  settlementId: string;
  leaseId: string;
  leaseFingerprint: `sha256:${string}`;
  beforeWorkOrderId: string;
  beforeWorkOrderFingerprint: `sha256:${string}`;
  afterWorkOrderId: string | null;
  afterWorkOrderFingerprint: `sha256:${string}` | null;
  dossierId: string;
  questionId: string;
  itemId: string;
  itemKey: `sha256:${string}`;
  action: AsoiafAnswerWorkAction;
  workerId: string;
  startedAt: string;
  completedAt: string;
  outcome: AsoiafAnswerWorkSettlementOutcome;
  beforeStatus: "open";
  afterStatus: AsoiafAnswerWorkItemStatus | "rendered" | null;
  resultReferences: AsoiafAnswerWorkResultReference[];
  reason: string;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  settlementFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerWorkSettlementInput {
  lease: AsoiafAnswerWorkLease;
  beforeWorkOrder: AsoiafAnswerWorkOrder;
  completedAt: string;
  outcome: AsoiafAnswerWorkSettlementOutcome;
  afterWorkOrder?: AsoiafAnswerWorkOrder | null;
  resultReferences?: AsoiafAnswerWorkResultReference[];
  reason: string;
  priorSettlements?: AsoiafAnswerWorkSettlement[];
}

export interface AsoiafAnswerDeskStateInput {
  workOrder: AsoiafAnswerWorkOrder;
  leases: AsoiafAnswerWorkLease[];
  settlements: AsoiafAnswerWorkSettlement[];
  asOf: string;
}

export interface AsoiafAnswerDeskState {
  format: typeof ASOIAF_ANSWER_DESK_STATE_FORMAT;
  stateId: string;
  workOrderId: string;
  workOrderFingerprint: `sha256:${string}`;
  dossierId: string;
  questionId: string;
  asOf: string;
  activeLeaseIds: string[];
  expiredLeaseIds: string[];
  staleLeaseIds: string[];
  settledLeaseIds: string[];
  openItemIds: string[];
  availableItemIds: string[];
  blockedItemIds: string[];
  nextAvailableItemId: string | null;
  answerReady: boolean;
  boundedComplete: boolean;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  stateFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerWorkLeaseFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

function finding(
  code: string,
  severity: AsoiafAnswerWorkLeaseFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafAnswerWorkLeaseFinding {
  return { code, severity, subjectId, detail };
}

function sortedFindings(
  findings: readonly AsoiafAnswerWorkLeaseFinding[],
): AsoiafAnswerWorkLeaseFinding[] {
  const rank = { error: 0, warning: 1, notice: 2 } as const;
  return [...findings].sort(
    (left, right) =>
      rank[left.severity] - rank[right.severity]
      || compareCodepoints(left.code, right.code)
      || compareCodepoints(left.subjectId, right.subjectId)
      || compareCodepoints(left.detail, right.detail),
  );
}

function validTime(value: string): boolean {
  return value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function validFingerprint(value: string): boolean {
  return /^(?:sha256:[a-f0-9]{64}|fnv1a32:[a-f0-9]{8})$/.test(value);
}

function itemKeyCore(item: Pick<AsoiafAnswerWorkItem, "action" | "subjectIds">) {
  return {
    action: item.action,
    subjectIds: orderedStrings(item.subjectIds),
  };
}

export function asoiafAnswerWorkItemKey(
  item: Pick<AsoiafAnswerWorkItem, "action" | "subjectIds">,
): `sha256:${string}` {
  return sha256(itemKeyCore(item));
}

function leaseCore(
  lease: AsoiafAnswerWorkLease,
): Omit<AsoiafAnswerWorkLease, "leaseId" | "leaseFingerprint"> {
  const {
    leaseId: _leaseId,
    leaseFingerprint: _leaseFingerprint,
    ...core
  } = lease;
  return core;
}

function settlementCore(
  settlement: AsoiafAnswerWorkSettlement,
): Omit<AsoiafAnswerWorkSettlement, "settlementId" | "settlementFingerprint"> {
  const {
    settlementId: _settlementId,
    settlementFingerprint: _settlementFingerprint,
    ...core
  } = settlement;
  return core;
}

function stateCore(
  state: AsoiafAnswerDeskState,
): Omit<AsoiafAnswerDeskState, "stateId" | "stateFingerprint"> {
  const {
    stateId: _stateId,
    stateFingerprint: _stateFingerprint,
    ...core
  } = state;
  return core;
}

function workOrderErrors(
  workOrder: AsoiafAnswerWorkOrder,
): AsoiafAnswerWorkLeaseFinding[] {
  return validateAsoiafAnswerWorkOrder(workOrder)
    .filter((entry) => entry.severity === "error")
    .map((entry) =>
      finding(
        `work-order:${entry.code}`,
        "error",
        entry.subjectId,
        entry.detail,
      ),
    );
}

function itemByKey(
  workOrder: AsoiafAnswerWorkOrder,
  itemKey: string,
): AsoiafAnswerWorkItem | undefined {
  return workOrder.items.find((item) => asoiafAnswerWorkItemKey(item) === itemKey);
}

function normalizedResultReferences(
  references: readonly AsoiafAnswerWorkResultReference[],
): AsoiafAnswerWorkResultReference[] {
  return [...references]
    .map((reference) => ({ ...reference, uri: reference.uri ?? null }))
    .sort(
      (left, right) =>
        compareCodepoints(left.kind, right.kind)
        || compareCodepoints(left.objectId, right.objectId)
        || compareCodepoints(left.fingerprint, right.fingerprint)
        || compareCodepoints(left.uri ?? "", right.uri ?? ""),
    );
}

function resultReferenceFindings(
  references: readonly AsoiafAnswerWorkResultReference[],
  subjectId: string,
): AsoiafAnswerWorkLeaseFinding[] {
  const findings: AsoiafAnswerWorkLeaseFinding[] = [];
  const identities = new Set<string>();
  for (const [index, reference] of references.entries()) {
    const identity = `${reference.kind}\u0000${reference.objectId}\u0000${reference.fingerprint}`;
    if (identities.has(identity)) {
      findings.push(
        finding(
          "result-reference-duplicate",
          "error",
          `${subjectId}:${index}`,
          "result reference identity is duplicated",
        ),
      );
    }
    identities.add(identity);
    if (
      !reference.kind.trim()
      || !reference.objectId.trim()
      || !validFingerprint(reference.fingerprint)
    ) {
      findings.push(
        finding(
          "result-reference-invalid",
          "error",
          `${subjectId}:${index}`,
          "result reference requires kind, object identity, and a supported fingerprint",
        ),
      );
    }
    if (
      reference.uri !== null
      && (!reference.uri.trim() || /[\r\n]/.test(reference.uri))
    ) {
      findings.push(
        finding(
          "result-reference-uri",
          "error",
          `${subjectId}:${index}`,
          "result reference URI is empty or multiline",
        ),
      );
    }
  }
  return findings;
}

export function validateAsoiafAnswerWorkLease(
  lease: AsoiafAnswerWorkLease,
  workOrder: AsoiafAnswerWorkOrder,
): AsoiafAnswerWorkLeaseFinding[] {
  const findings = workOrderErrors(workOrder);
  const item = workOrder.items.find((entry) => entry.itemId === lease.itemId);
  if (lease.format !== ASOIAF_ANSWER_WORK_LEASE_FORMAT) {
    findings.push(finding("lease-format", "error", lease.leaseId, "answer work lease format is invalid"));
  }
  if (
    lease.workOrderId !== workOrder.workOrderId
    || lease.workOrderFingerprint !== workOrder.workOrderFingerprint
    || lease.dossierId !== workOrder.dossierId
    || lease.questionId !== workOrder.questionId
  ) {
    findings.push(finding("lease-work-order", "error", lease.leaseId, "answer work lease differs from its exact work-order custody"));
  }
  if (!item) {
    findings.push(finding("lease-item-missing", "error", lease.itemId, "leased item is absent from the exact work order"));
  } else {
    if (item.status !== "open") {
      findings.push(finding("lease-item-not-open", "error", lease.itemId, `leased item status is ${item.status}`));
    }
    if (
      lease.itemFingerprint !== item.itemFingerprint
      || lease.itemKey !== asoiafAnswerWorkItemKey(item)
      || lease.action !== item.action
      || lease.stage !== item.stage
      || JSON.stringify(lease.subjectIds) !== JSON.stringify(item.subjectIds)
      || JSON.stringify(lease.dependencyItemIds) !== JSON.stringify(item.dependencyItemIds)
    ) {
      findings.push(finding("lease-item-custody", "error", lease.itemId, "lease action, subjects, dependencies, or fingerprints differ from the exact item"));
    }
  }
  if (!lease.workerId.trim()) {
    findings.push(finding("lease-worker", "error", lease.leaseId, "answer work lease requires a worker identity"));
  }
  if (!validTime(lease.claimedAt) || !validTime(lease.expiresAt)) {
    findings.push(finding("lease-time", "error", lease.leaseId, "answer work lease requires valid claim and expiry times"));
  } else {
    const duration = Date.parse(lease.expiresAt) - Date.parse(lease.claimedAt);
    if (
      duration !== lease.leaseMilliseconds
      || !Number.isSafeInteger(lease.leaseMilliseconds)
      || lease.leaseMilliseconds < 1_000
      || lease.leaseMilliseconds > 86_400_000
    ) {
      findings.push(finding("lease-duration", "error", lease.leaseId, "lease duration must equal the timestamps and remain between one second and twenty-four hours"));
    }
  }
  if (
    lease.authority !== "none"
    || lease.graphEffect !== "none"
    || lease.canonEffect !== "none"
    || lease.answerEffect !== "none"
  ) {
    findings.push(finding("lease-authority", "error", lease.leaseId, "answer work lease acquired execution, graph, canon, or answer authority"));
  }
  const expectedFingerprint = sha256(leaseCore(lease));
  if (lease.leaseFingerprint !== expectedFingerprint) {
    findings.push(finding("lease-fingerprint", "error", lease.leaseId, "answer work lease fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-work-lease", {
    workOrderId: lease.workOrderId,
    itemKey: lease.itemKey,
    workerId: lease.workerId,
    claimedAt: lease.claimedAt,
    leaseFingerprint: expectedFingerprint,
  });
  if (lease.leaseId !== expectedId) {
    findings.push(finding("lease-identity", "error", lease.leaseId, "answer work lease identity is not content addressed"));
  }
  return sortedFindings(findings);
}

export function claimAsoiafAnswerWorkItem(
  input: AsoiafAnswerWorkLeaseInput,
): AsoiafAnswerWorkLease {
  const workOrderFindings = workOrderErrors(input.workOrder);
  if (workOrderFindings.length > 0) {
    throw new Error(
      `invalid answer work order: ${workOrderFindings
        .map((entry) => `${entry.code}:${entry.subjectId}`)
        .join(", ")}`,
    );
  }
  const item = input.workOrder.items.find((entry) => entry.itemId === input.itemId);
  if (!item) throw new Error(`answer work item ${input.itemId} is absent`);
  if (item.status !== "open") {
    throw new Error(`answer work item ${input.itemId} is ${item.status}, not open`);
  }
  if (!input.workerId.trim()) throw new Error("worker identity is required");
  if (!validTime(input.claimedAt)) throw new Error("claim time is invalid");
  if (
    !Number.isSafeInteger(input.leaseMilliseconds)
    || input.leaseMilliseconds < 1_000
    || input.leaseMilliseconds > 86_400_000
  ) {
    throw new Error("lease duration must remain between one second and twenty-four hours");
  }

  const existingLeases = input.existingLeases ?? [];
  const settlements = input.settlements ?? [];
  const settlementByLease = new Map(
    settlements.map((settlement) => [settlement.leaseId, settlement] as const),
  );
  const key = asoiafAnswerWorkItemKey(item);
  const claimTime = Date.parse(input.claimedAt);
  for (const lease of existingLeases) {
    const leaseErrors = validateAsoiafAnswerWorkLease(lease, input.workOrder)
      .filter((entry) => entry.severity === "error");
    if (leaseErrors.length > 0) {
      throw new Error(`existing lease ${lease.leaseId} is invalid`);
    }
    const settlement = settlementByLease.get(lease.leaseId);
    if (
      lease.itemKey === key
      && !settlement
      && Date.parse(lease.expiresAt) > claimTime
    ) {
      throw new Error(`answer work item ${item.itemId} already has active lease ${lease.leaseId}`);
    }
    if (
      lease.itemKey === key
      && settlement
      && (
        settlement.outcome === "satisfied"
        || settlement.outcome === "preserved-as-limitation"
        || settlement.outcome === "rendered"
      )
    ) {
      throw new Error(`answer work item ${item.itemId} already has terminal settlement ${settlement.settlementId}`);
    }
  }

  const expiresAt = new Date(claimTime + input.leaseMilliseconds).toISOString();
  const core = {
    format: ASOIAF_ANSWER_WORK_LEASE_FORMAT,
    workOrderId: input.workOrder.workOrderId,
    workOrderFingerprint: input.workOrder.workOrderFingerprint,
    dossierId: input.workOrder.dossierId,
    questionId: input.workOrder.questionId,
    itemId: item.itemId,
    itemFingerprint: item.itemFingerprint,
    itemKey: key,
    action: item.action,
    stage: item.stage,
    subjectIds: [...item.subjectIds],
    dependencyItemIds: [...item.dependencyItemIds],
    workerId: input.workerId,
    claimedAt: input.claimedAt,
    expiresAt,
    leaseMilliseconds: input.leaseMilliseconds,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const leaseFingerprint = sha256(core);
  const lease: AsoiafAnswerWorkLease = {
    ...core,
    leaseId: collectorContentId("asoiaf-answer-work-lease", {
      workOrderId: core.workOrderId,
      itemKey: core.itemKey,
      workerId: core.workerId,
      claimedAt: core.claimedAt,
      leaseFingerprint,
    }),
    leaseFingerprint,
  };
  const errors = validateAsoiafAnswerWorkLease(lease, input.workOrder)
    .filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `invalid answer work lease: ${errors
        .map((entry) => `${entry.code}:${entry.subjectId}`)
        .join(", ")}`,
    );
  }
  return lease;
}

export function validateAsoiafAnswerWorkSettlement(
  settlement: AsoiafAnswerWorkSettlement,
  input: {
    lease: AsoiafAnswerWorkLease;
    beforeWorkOrder: AsoiafAnswerWorkOrder;
    afterWorkOrder?: AsoiafAnswerWorkOrder | null;
  },
): AsoiafAnswerWorkLeaseFinding[] {
  const findings = validateAsoiafAnswerWorkLease(
    input.lease,
    input.beforeWorkOrder,
  );
  const afterWorkOrder = input.afterWorkOrder ?? null;
  if (settlement.format !== ASOIAF_ANSWER_WORK_SETTLEMENT_FORMAT) {
    findings.push(finding("settlement-format", "error", settlement.settlementId, "answer work settlement format is invalid"));
  }
  if (
    settlement.leaseId !== input.lease.leaseId
    || settlement.leaseFingerprint !== input.lease.leaseFingerprint
    || settlement.beforeWorkOrderId !== input.beforeWorkOrder.workOrderId
    || settlement.beforeWorkOrderFingerprint !== input.beforeWorkOrder.workOrderFingerprint
    || settlement.dossierId !== input.lease.dossierId
    || settlement.questionId !== input.lease.questionId
    || settlement.itemId !== input.lease.itemId
    || settlement.itemKey !== input.lease.itemKey
    || settlement.action !== input.lease.action
    || settlement.workerId !== input.lease.workerId
    || settlement.startedAt !== input.lease.claimedAt
    || settlement.beforeStatus !== "open"
  ) {
    findings.push(finding("settlement-lease-custody", "error", settlement.settlementId, "settlement differs from its lease or before-work-order custody"));
  }
  if (!validTime(settlement.completedAt) || Date.parse(settlement.completedAt) < Date.parse(settlement.startedAt)) {
    findings.push(finding("settlement-time", "error", settlement.settlementId, "settlement completion time is invalid or precedes the lease"));
  }
  findings.push(...resultReferenceFindings(settlement.resultReferences, settlement.settlementId));

  const advancing = settlement.outcome === "satisfied"
    || settlement.outcome === "preserved-as-limitation";
  if (advancing) {
    if (!afterWorkOrder) {
      findings.push(finding("settlement-after-work-order", "error", settlement.settlementId, "advancing settlement requires a refreshed answer work order"));
    } else {
      findings.push(...workOrderErrors(afterWorkOrder));
      if (
        afterWorkOrder.dossierId !== input.beforeWorkOrder.dossierId
        || afterWorkOrder.questionId !== input.beforeWorkOrder.questionId
        || afterWorkOrder.workOrderId === input.beforeWorkOrder.workOrderId
        || Date.parse(afterWorkOrder.createdAt) < Date.parse(input.beforeWorkOrder.createdAt)
      ) {
        findings.push(finding("settlement-work-order-transition", "error", settlement.settlementId, "refreshed work order must advance the same dossier and question"));
      }
      const afterItem = itemByKey(afterWorkOrder, settlement.itemKey);
      const expectedStatus = settlement.outcome === "satisfied"
        ? "satisfied"
        : "preserved-as-limitation";
      if (!afterItem || afterItem.status !== expectedStatus) {
        findings.push(finding("settlement-item-transition", "error", settlement.settlementId, `refreshed work order does not prove item status ${expectedStatus}`));
      }
      if (
        settlement.afterWorkOrderId !== afterWorkOrder.workOrderId
        || settlement.afterWorkOrderFingerprint !== afterWorkOrder.workOrderFingerprint
        || settlement.afterStatus !== expectedStatus
      ) {
        findings.push(finding("settlement-after-custody", "error", settlement.settlementId, "settlement does not bind the refreshed work order and resulting item status"));
      }
    }
    if (settlement.resultReferences.length === 0) {
      findings.push(finding("settlement-result-required", "error", settlement.settlementId, "advancing settlement requires at least one exact result reference"));
    }
  } else if (settlement.outcome === "rendered") {
    if (
      input.lease.action !== "render-reviewed-answer"
      || input.beforeWorkOrder.answerReady !== true
      || afterWorkOrder !== null
      || settlement.afterWorkOrderId !== null
      || settlement.afterWorkOrderFingerprint !== null
      || settlement.afterStatus !== "rendered"
      || settlement.resultReferences.length === 0
    ) {
      findings.push(finding("settlement-render", "error", settlement.settlementId, "rendered settlement requires an answer-ready render lease, result reference, and no refreshed work order"));
    }
  } else if (settlement.outcome === "expired") {
    if (
      Date.parse(settlement.completedAt) < Date.parse(input.lease.expiresAt)
      || afterWorkOrder !== null
      || settlement.afterWorkOrderId !== null
      || settlement.afterWorkOrderFingerprint !== null
      || settlement.afterStatus !== null
    ) {
      findings.push(finding("settlement-expiry", "error", settlement.settlementId, "expired settlement must occur at or after lease expiry without advancement"));
    }
  } else if (settlement.outcome === "stale") {
    if (
      !afterWorkOrder
      || afterWorkOrder.dossierId !== input.beforeWorkOrder.dossierId
      || afterWorkOrder.questionId !== input.beforeWorkOrder.questionId
      || afterWorkOrder.workOrderId === input.beforeWorkOrder.workOrderId
      || settlement.afterWorkOrderId !== afterWorkOrder.workOrderId
      || settlement.afterWorkOrderFingerprint !== afterWorkOrder.workOrderFingerprint
      || settlement.afterStatus !== (itemByKey(afterWorkOrder, settlement.itemKey)?.status ?? null)
    ) {
      findings.push(finding("settlement-stale", "error", settlement.settlementId, "stale settlement requires a newer exact work order for the same dossier and question"));
    }
  } else {
    if (
      afterWorkOrder !== null
      || settlement.afterWorkOrderId !== null
      || settlement.afterWorkOrderFingerprint !== null
      || settlement.afterStatus !== null
    ) {
      findings.push(finding("settlement-nonadvancing-work-order", "error", settlement.settlementId, "refused, failed, or cancelled settlement cannot claim a refreshed work order"));
    }
    if (settlement.reason.trim().length < 24) {
      findings.push(finding("settlement-reason", "error", settlement.settlementId, "non-advancing settlement requires a substantive reason"));
    }
  }

  if (
    settlement.authority !== "none"
    || settlement.graphEffect !== "none"
    || settlement.canonEffect !== "none"
    || settlement.answerEffect !== "none"
  ) {
    findings.push(finding("settlement-authority", "error", settlement.settlementId, "answer work settlement acquired execution, graph, canon, or answer authority"));
  }
  const expectedFingerprint = sha256(settlementCore(settlement));
  if (settlement.settlementFingerprint !== expectedFingerprint) {
    findings.push(finding("settlement-fingerprint", "error", settlement.settlementId, "answer work settlement fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-work-settlement", {
    leaseId: settlement.leaseId,
    outcome: settlement.outcome,
    completedAt: settlement.completedAt,
    settlementFingerprint: expectedFingerprint,
  });
  if (settlement.settlementId !== expectedId) {
    findings.push(finding("settlement-identity", "error", settlement.settlementId, "answer work settlement identity is not content addressed"));
  }
  return sortedFindings(findings);
}

export function settleAsoiafAnswerWorkItem(
  input: AsoiafAnswerWorkSettlementInput,
): AsoiafAnswerWorkSettlement {
  const priorSettlements = input.priorSettlements ?? [];
  if (priorSettlements.some((entry) => entry.leaseId === input.lease.leaseId)) {
    throw new Error(`answer work lease ${input.lease.leaseId} is already settled`);
  }
  const leaseErrors = validateAsoiafAnswerWorkLease(
    input.lease,
    input.beforeWorkOrder,
  ).filter((entry) => entry.severity === "error");
  if (leaseErrors.length > 0) {
    throw new Error(
      `invalid answer work lease: ${leaseErrors
        .map((entry) => `${entry.code}:${entry.subjectId}`)
        .join(", ")}`,
    );
  }
  if (!validTime(input.completedAt)) throw new Error("settlement completion time is invalid");
  if (Date.parse(input.completedAt) < Date.parse(input.lease.claimedAt)) {
    throw new Error("settlement completion precedes the lease claim");
  }

  const afterWorkOrder = input.afterWorkOrder ?? null;
  const afterItem = afterWorkOrder
    ? itemByKey(afterWorkOrder, input.lease.itemKey)
    : undefined;
  const resultReferences = normalizedResultReferences(input.resultReferences ?? []);
  const core = {
    format: ASOIAF_ANSWER_WORK_SETTLEMENT_FORMAT,
    leaseId: input.lease.leaseId,
    leaseFingerprint: input.lease.leaseFingerprint,
    beforeWorkOrderId: input.beforeWorkOrder.workOrderId,
    beforeWorkOrderFingerprint: input.beforeWorkOrder.workOrderFingerprint,
    afterWorkOrderId: afterWorkOrder?.workOrderId ?? null,
    afterWorkOrderFingerprint: afterWorkOrder?.workOrderFingerprint ?? null,
    dossierId: input.lease.dossierId,
    questionId: input.lease.questionId,
    itemId: input.lease.itemId,
    itemKey: input.lease.itemKey,
    action: input.lease.action,
    workerId: input.lease.workerId,
    startedAt: input.lease.claimedAt,
    completedAt: input.completedAt,
    outcome: input.outcome,
    beforeStatus: "open" as const,
    afterStatus: input.outcome === "rendered"
      ? "rendered" as const
      : afterItem?.status ?? null,
    resultReferences,
    reason: input.reason,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const settlementFingerprint = sha256(core);
  const settlement: AsoiafAnswerWorkSettlement = {
    ...core,
    settlementId: collectorContentId("asoiaf-answer-work-settlement", {
      leaseId: core.leaseId,
      outcome: core.outcome,
      completedAt: core.completedAt,
      settlementFingerprint,
    }),
    settlementFingerprint,
  };
  const errors = validateAsoiafAnswerWorkSettlement(settlement, {
    lease: input.lease,
    beforeWorkOrder: input.beforeWorkOrder,
    afterWorkOrder,
  }).filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `invalid answer work settlement: ${errors
        .map((entry) => `${entry.code}:${entry.subjectId}`)
        .join(", ")}`,
    );
  }
  return settlement;
}

export function buildAsoiafAnswerDeskState(
  input: AsoiafAnswerDeskStateInput,
): AsoiafAnswerDeskState {
  const workOrderFindings = workOrderErrors(input.workOrder);
  if (workOrderFindings.length > 0) {
    throw new Error(`invalid answer work order ${input.workOrder.workOrderId}`);
  }
  if (!validTime(input.asOf)) throw new Error("answer desk state time is invalid");

  const settlementsByLease = new Map<string, AsoiafAnswerWorkSettlement>();
  for (const settlement of input.settlements) {
    if (settlementsByLease.has(settlement.leaseId)) {
      throw new Error(`answer work lease ${settlement.leaseId} has duplicate settlements`);
    }
    settlementsByLease.set(settlement.leaseId, settlement);
  }

  const asOf = Date.parse(input.asOf);
  const activeLeaseIds: string[] = [];
  const expiredLeaseIds: string[] = [];
  const staleLeaseIds: string[] = [];
  const settledLeaseIds: string[] = [];
  const activeItemKeys = new Set<string>();
  const terminalItemKeys = new Set<string>();

  for (const lease of input.leases) {
    const settlement = settlementsByLease.get(lease.leaseId);
    if (settlement) {
      settledLeaseIds.push(lease.leaseId);
      if (
        lease.workOrderId === input.workOrder.workOrderId
        && settlement.outcome === "rendered"
      ) {
        const settlementErrors = validateAsoiafAnswerWorkSettlement(
          settlement,
          {
            lease,
            beforeWorkOrder: input.workOrder,
            afterWorkOrder: null,
          },
        ).filter((entry) => entry.severity === "error");
        if (settlementErrors.length > 0) {
          throw new Error(
            `invalid rendered answer work settlement ${settlement.settlementId}`,
          );
        }
        terminalItemKeys.add(lease.itemKey);
      }
      continue;
    }
    if (
      lease.dossierId !== input.workOrder.dossierId
      || lease.questionId !== input.workOrder.questionId
      || lease.workOrderId !== input.workOrder.workOrderId
    ) {
      staleLeaseIds.push(lease.leaseId);
      continue;
    }
    const currentItem = itemByKey(input.workOrder, lease.itemKey);
    if (!currentItem || currentItem.status !== "open") {
      staleLeaseIds.push(lease.leaseId);
      continue;
    }
    const leaseErrors = validateAsoiafAnswerWorkLease(lease, input.workOrder)
      .filter((entry) => entry.severity === "error");
    if (leaseErrors.length > 0) {
      throw new Error(`invalid active answer work lease ${lease.leaseId}`);
    }
    if (Date.parse(lease.expiresAt) <= asOf) {
      expiredLeaseIds.push(lease.leaseId);
    } else {
      activeLeaseIds.push(lease.leaseId);
      activeItemKeys.add(lease.itemKey);
    }
  }

  const openItems = input.workOrder.items.filter((item) => item.status === "open");
  const availableItemIds = openItems
    .filter((item) => {
      const itemKey = asoiafAnswerWorkItemKey(item);
      return !activeItemKeys.has(itemKey) && !terminalItemKeys.has(itemKey);
    })
    .map((item) => item.itemId);
  const blockedItemIds = input.workOrder.items
    .filter((item) => item.status === "blocked")
    .map((item) => item.itemId);
  const core = {
    format: ASOIAF_ANSWER_DESK_STATE_FORMAT,
    workOrderId: input.workOrder.workOrderId,
    workOrderFingerprint: input.workOrder.workOrderFingerprint,
    dossierId: input.workOrder.dossierId,
    questionId: input.workOrder.questionId,
    asOf: input.asOf,
    activeLeaseIds: orderedStrings(activeLeaseIds),
    expiredLeaseIds: orderedStrings(expiredLeaseIds),
    staleLeaseIds: orderedStrings(staleLeaseIds),
    settledLeaseIds: orderedStrings(settledLeaseIds),
    openItemIds: openItems.map((item) => item.itemId),
    availableItemIds,
    blockedItemIds,
    nextAvailableItemId: availableItemIds[0] ?? null,
    answerReady: input.workOrder.answerReady,
    boundedComplete: input.workOrder.boundedComplete,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const stateFingerprint = sha256(core);
  return {
    ...core,
    stateId: collectorContentId("asoiaf-answer-desk-state", {
      workOrderId: core.workOrderId,
      asOf: core.asOf,
      stateFingerprint,
    }),
    stateFingerprint,
  };
}

export function validateAsoiafAnswerDeskState(
  state: AsoiafAnswerDeskState,
  input: AsoiafAnswerDeskStateInput,
): AsoiafAnswerWorkLeaseFinding[] {
  const findings: AsoiafAnswerWorkLeaseFinding[] = [];
  let expected: AsoiafAnswerDeskState | null = null;
  try {
    expected = buildAsoiafAnswerDeskState(input);
  } catch (error) {
    findings.push(
      finding(
        "desk-state-input",
        "error",
        state.stateId,
        error instanceof Error ? error.message : String(error),
      ),
    );
  }
  if (state.format !== ASOIAF_ANSWER_DESK_STATE_FORMAT) {
    findings.push(finding("desk-state-format", "error", state.stateId, "answer desk state format is invalid"));
  }
  if (expected && JSON.stringify(state) !== JSON.stringify(expected)) {
    findings.push(finding("desk-state-projection", "error", state.stateId, "answer desk state differs from the deterministic lease projection"));
  }
  if (
    state.authority !== "none"
    || state.graphEffect !== "none"
    || state.canonEffect !== "none"
    || state.answerEffect !== "none"
  ) {
    findings.push(finding("desk-state-authority", "error", state.stateId, "answer desk state acquired execution, graph, canon, or answer authority"));
  }
  const expectedFingerprint = sha256(stateCore(state));
  if (state.stateFingerprint !== expectedFingerprint) {
    findings.push(finding("desk-state-fingerprint", "error", state.stateId, "answer desk state fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-desk-state", {
    workOrderId: state.workOrderId,
    asOf: state.asOf,
    stateFingerprint: expectedFingerprint,
  });
  if (state.stateId !== expectedId) {
    findings.push(finding("desk-state-identity", "error", state.stateId, "answer desk state identity is not content addressed"));
  }
  return sortedFindings(findings);
}