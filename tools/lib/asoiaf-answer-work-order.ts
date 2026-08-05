import {
  compareCodepoints,
  orderedStrings,
} from "../../src/engine/determinism.js";
import {
  collectorContentId,
  sha256,
} from "./asoiaf-external-estate.js";
import {
  validateAsoiafResearchQuestionDossier,
  type AsoiafResearchGap,
  type AsoiafResearchNextAction,
  type AsoiafResearchQuestionDossier,
} from "./asoiaf-research-question-dossier.js";
import {
  buildAsoiafReviewedAnswerTransaction,
  validateAsoiafReviewedAnswerPacket,
  type AsoiafReviewedAnswerPacket,
  type AsoiafReviewedAnswerTransaction,
} from "./asoiaf-reviewed-answer-packet.js";

export const ASOIAF_ANSWER_WORK_ITEM_FORMAT =
  "axm-asoiaf-answer-work-item/1" as const;
export const ASOIAF_ANSWER_WORK_ORDER_FORMAT =
  "axm-asoiaf-answer-work-order/1" as const;

export type AsoiafAnswerWorkAction =
  | AsoiafResearchNextAction
  | "assemble-reviewed-answer"
  | "verify-reviewed-answer"
  | "render-reviewed-answer";

export type AsoiafAnswerWorkStage =
  | "research"
  | "review"
  | "reconciliation"
  | "assembly"
  | "verification"
  | "render";

export type AsoiafAnswerWorkItemStatus =
  | "open"
  | "satisfied"
  | "preserved-as-limitation"
  | "blocked";

export type AsoiafAnswerWorkOrderStatus =
  | "research-open"
  | "review-open"
  | "reconciliation-open"
  | "answer-assembly-open"
  | "answer-ready-partial"
  | "answer-ready-bounded";

export interface AsoiafAnswerWorkItem {
  format: typeof ASOIAF_ANSWER_WORK_ITEM_FORMAT;
  itemId: string;
  action: AsoiafAnswerWorkAction;
  stage: AsoiafAnswerWorkStage;
  status: AsoiafAnswerWorkItemStatus;
  requiredForBoundedComplete: boolean;
  subjectIds: string[];
  dependencyItemIds: string[];
  reason: string;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  itemFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerWorkOrderInput {
  dossier: AsoiafResearchQuestionDossier;
  createdBy: string;
  createdAt: string;
  transactions?: AsoiafReviewedAnswerTransaction[];
  answerPacket?: AsoiafReviewedAnswerPacket | null;
}

export interface AsoiafAnswerWorkOrder {
  format: typeof ASOIAF_ANSWER_WORK_ORDER_FORMAT;
  workOrderId: string;
  dossier: AsoiafResearchQuestionDossier;
  dossierId: string;
  dossierFingerprint: `sha256:${string}`;
  questionId: string;
  questionDigest: `sha256:${string}`;
  createdBy: string;
  createdAt: string;
  transactions: AsoiafReviewedAnswerTransaction[];
  answerPacket: AsoiafReviewedAnswerPacket | null;
  resolvedCandidateIds: string[];
  unresolvedCandidateIds: string[];
  reviewedPrivateReferenceIds: string[];
  unreviewedPrivateReferenceIds: string[];
  closedGapIds: string[];
  limitedGapIds: string[];
  openGapIds: string[];
  limitedReferenceIds: string[];
  openDispositionReferenceIds: string[];
  items: AsoiafAnswerWorkItem[];
  countsByStatus: Record<AsoiafAnswerWorkItemStatus, number>;
  status: AsoiafAnswerWorkOrderStatus;
  answerReady: boolean;
  boundedComplete: boolean;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  workOrderFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerWorkOrderFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

interface WorkItemInput {
  action: AsoiafAnswerWorkAction;
  status: AsoiafAnswerWorkItemStatus;
  requiredForBoundedComplete: boolean;
  subjectIds: string[];
  dependencyItemIds?: string[];
  reason: string;
}

interface WorkOrderProjection {
  transactions: AsoiafReviewedAnswerTransaction[];
  answerPacket: AsoiafReviewedAnswerPacket | null;
  resolvedCandidateIds: string[];
  unresolvedCandidateIds: string[];
  reviewedPrivateReferenceIds: string[];
  unreviewedPrivateReferenceIds: string[];
  closedGapIds: string[];
  limitedGapIds: string[];
  openGapIds: string[];
  limitedReferenceIds: string[];
  openDispositionReferenceIds: string[];
  items: AsoiafAnswerWorkItem[];
  countsByStatus: Record<AsoiafAnswerWorkItemStatus, number>;
  status: AsoiafAnswerWorkOrderStatus;
  answerReady: boolean;
  boundedComplete: boolean;
}

const STAGE_RANK: Record<AsoiafAnswerWorkStage, number> = {
  research: 0,
  review: 1,
  reconciliation: 2,
  assembly: 3,
  verification: 4,
  render: 5,
};

function finding(
  code: string,
  severity: AsoiafAnswerWorkOrderFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafAnswerWorkOrderFinding {
  return { code, severity, subjectId, detail };
}

function sortedFindings(
  values: readonly AsoiafAnswerWorkOrderFinding[],
): AsoiafAnswerWorkOrderFinding[] {
  const rank = { error: 0, warning: 1, notice: 2 } as const;
  return [...values].sort(
    (left, right) =>
      rank[left.severity] - rank[right.severity]
      || compareCodepoints(left.code, right.code)
      || compareCodepoints(left.subjectId, right.subjectId)
      || compareCodepoints(left.detail, right.detail),
  );
}

function stageForAction(action: AsoiafAnswerWorkAction): AsoiafAnswerWorkStage {
  switch (action) {
    case "acquire-public-record":
    case "search-private-edition":
    case "resolve-edition":
    case "inspect-disposition":
    case "split-continuity":
      return "research";
    case "review-structured-observation":
    case "review-exact-locator":
      return "review";
    case "reconcile-candidate":
      return "reconciliation";
    case "close-gap":
    case "assemble-reviewed-answer":
      return "assembly";
    case "verify-reviewed-answer":
      return "verification";
    case "render-reviewed-answer":
      return "render";
  }
}

function gapAction(gap: AsoiafResearchGap): AsoiafResearchNextAction {
  switch (gap.kind) {
    case "private-source-missing":
      return "search-private-edition";
    case "public-record-missing":
      return "acquire-public-record";
    case "edition-unresolved":
      return "resolve-edition";
    case "locator-review-required":
      return "review-exact-locator";
    case "structured-review-required":
      return "review-structured-observation";
    case "disposition-rejected":
    case "disposition-deferred":
      return "inspect-disposition";
    case "recall-unreconciled":
      return "reconcile-candidate";
    case "continuity-conflict":
      return "split-continuity";
    case "source-conflict":
    case "question-unresolved":
      return "close-gap";
  }
}

function approvedResolutionAction(value: string): boolean {
  return value === "confirm"
    || value === "correct"
    || value === "split"
    || value === "merge";
}

function itemCore(input: WorkItemInput) {
  return {
    format: ASOIAF_ANSWER_WORK_ITEM_FORMAT,
    action: input.action,
    stage: stageForAction(input.action),
    status: input.status,
    requiredForBoundedComplete: input.requiredForBoundedComplete,
    subjectIds: orderedStrings(input.subjectIds),
    dependencyItemIds: orderedStrings(input.dependencyItemIds ?? []),
    reason: input.reason,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
}

function buildItem(
  dossierId: string,
  input: WorkItemInput,
): AsoiafAnswerWorkItem {
  const core = itemCore(input);
  const itemFingerprint = sha256(core);
  return {
    ...core,
    itemId: collectorContentId("asoiaf-answer-work-item", {
      dossierId,
      action: core.action,
      subjectIds: core.subjectIds,
      itemFingerprint,
    }),
    itemFingerprint,
  };
}

function normalizeTransactions(
  input: AsoiafAnswerWorkOrderInput,
): AsoiafReviewedAnswerTransaction[] {
  const supplied = input.transactions ?? [];
  const packetTransactions = input.answerPacket?.transactions ?? [];
  if (supplied.length === 0 && packetTransactions.length > 0) {
    return [...packetTransactions].sort((left, right) =>
      compareCodepoints(left.transactionId, right.transactionId),
    );
  }
  const normalized = [...supplied].sort((left, right) =>
    compareCodepoints(left.transactionId, right.transactionId),
  );
  if (
    packetTransactions.length > 0
    && JSON.stringify(normalized.map((entry) => entry.transactionId))
      !== JSON.stringify(
        [...packetTransactions]
          .sort((left, right) => compareCodepoints(left.transactionId, right.transactionId))
          .map((entry) => entry.transactionId),
      )
  ) {
    throw new Error("answer packet transaction identities differ from the work-order input");
  }
  return normalized;
}

function validateInput(input: AsoiafAnswerWorkOrderInput): void {
  const dossierErrors = validateAsoiafResearchQuestionDossier(input.dossier)
    .filter((entry) => entry.severity === "error");
  if (dossierErrors.length > 0) {
    throw new Error(
      `invalid research dossier: ${dossierErrors
        .map((entry) => `${entry.code}:${entry.subjectId}`)
        .join(", ")}`,
    );
  }
  if (!input.createdBy.trim() || !Number.isFinite(Date.parse(input.createdAt))) {
    throw new Error("answer work order requires a creator and valid creation time");
  }
  const transactions = normalizeTransactions(input);
  const transactionIds = new Set<string>();
  for (const transaction of transactions) {
    if (transactionIds.has(transaction.transactionId)) {
      throw new Error(`duplicate answer transaction ${transaction.transactionId}`);
    }
    transactionIds.add(transaction.transactionId);
    const rebuilt = buildAsoiafReviewedAnswerTransaction({
      packet: transaction.packet,
      reconciliationReceipt: transaction.reconciliationReceipt,
    });
    if (JSON.stringify(rebuilt) !== JSON.stringify(transaction)) {
      throw new Error(`stale answer transaction ${transaction.transactionId}`);
    }
    if (!input.dossier.route.sourceIds.includes(transaction.packet.sourceId)) {
      throw new Error(
        `answer transaction ${transaction.transactionId} is outside the dossier route`,
      );
    }
    if (!input.dossier.question.continuityIds.includes(transaction.packet.continuityId)) {
      throw new Error(
        `answer transaction ${transaction.transactionId} is outside the dossier continuity scope`,
      );
    }
  }
  if (input.answerPacket) {
    const answerErrors = validateAsoiafReviewedAnswerPacket(input.answerPacket)
      .filter((entry) => entry.severity === "error");
    if (answerErrors.length > 0) {
      throw new Error(
        `invalid reviewed answer packet: ${answerErrors
          .map((entry) => `${entry.code}:${entry.subjectId}`)
          .join(", ")}`,
      );
    }
    if (
      input.answerPacket.dossierId !== input.dossier.dossierId
      || input.answerPacket.dossierFingerprint !== input.dossier.dossierFingerprint
    ) {
      throw new Error("reviewed answer packet differs from the work-order dossier");
    }
  }
}

function transactionCoverage(
  transactions: readonly AsoiafReviewedAnswerTransaction[],
): {
  candidateIds: Set<string>;
  sourceIds: Set<string>;
  observationIds: Set<string>;
  privateDigests: Set<string>;
} {
  const candidateIds = new Set<string>();
  const sourceIds = new Set<string>();
  const observationIds = new Set<string>();
  const privateDigests = new Set<string>();
  for (const transaction of transactions) {
    sourceIds.add(transaction.packet.sourceId);
    observationIds.add(transaction.packet.observation.observationId);
    for (const claim of transaction.packet.claims) {
      if (claim.authorityRole === "primary" && claim.locator.contentDigest) {
        privateDigests.add(claim.locator.contentDigest);
      }
    }
    for (const resolution of transaction.reconciliationReceipt.canonReceipt?.resolutions ?? []) {
      if (approvedResolutionAction(resolution.action)) {
        for (const candidateId of resolution.candidateIds) {
          candidateIds.add(candidateId);
        }
      }
    }
  }
  return { candidateIds, sourceIds, observationIds, privateDigests };
}

function compileProjection(
  input: AsoiafAnswerWorkOrderInput,
): WorkOrderProjection {
  const dossier = input.dossier;
  const transactions = normalizeTransactions(input);
  const answerPacket = input.answerPacket ?? null;
  const coverage = transactionCoverage(transactions);
  const dossierCandidateIds = orderedStrings(
    dossier.recallReferences.map((reference) => reference.candidateId),
  );
  const resolvedCandidateIds = dossierCandidateIds.filter((candidateId) =>
    coverage.candidateIds.has(candidateId),
  );
  const unresolvedCandidateIds = dossierCandidateIds.filter((candidateId) =>
    !coverage.candidateIds.has(candidateId),
  );
  const reviewedPrivateReferenceIds = orderedStrings(
    dossier.privateReferences
      .filter((reference) => coverage.privateDigests.has(reference.paragraphDigest))
      .map((reference) => reference.referenceId),
  );
  const reviewedPrivateSet = new Set(reviewedPrivateReferenceIds);
  const unreviewedPrivateReferenceIds = orderedStrings(
    dossier.privateReferences
      .filter((reference) => !reviewedPrivateSet.has(reference.referenceId))
      .map((reference) => reference.referenceId),
  );
  const closedGapIds = orderedStrings(
    answerPacket?.gapClosures.map((closure) => closure.gapId) ?? [],
  );
  const limitedGapIds = orderedStrings(
    answerPacket?.limitations.flatMap((limitation) =>
      limitation.relatedGapIds ?? [],
    ) ?? [],
  );
  const closedGapSet = new Set(closedGapIds);
  const limitedGapSet = new Set(limitedGapIds);
  const openGapIds = orderedStrings(
    dossier.gaps
      .filter((gap) => !closedGapSet.has(gap.gapId) && !limitedGapSet.has(gap.gapId))
      .map((gap) => gap.gapId),
  );
  const limitedReferenceIds = orderedStrings(
    answerPacket?.limitations.flatMap((limitation) =>
      limitation.relatedReferenceIds ?? [],
    ) ?? [],
  );
  const limitedReferenceSet = new Set(limitedReferenceIds);
  const dispositionReferences = dossier.structuredReferences.filter(
    (reference) =>
      reference.standing === "rejected"
      || reference.standing === "deferred",
  );
  const openDispositionReferenceIds = orderedStrings(
    dispositionReferences
      .filter((reference) => !limitedReferenceSet.has(reference.referenceId))
      .map((reference) => reference.referenceId),
  );

  const rawItems: AsoiafAnswerWorkItem[] = [];
  const itemKeys = new Set<string>();
  const addItem = (work: WorkItemInput): AsoiafAnswerWorkItem => {
    const normalizedSubjects = orderedStrings(work.subjectIds);
    const key = `${work.action}\u0000${normalizedSubjects.join("\u0000")}`;
    const existing = rawItems.find((item) =>
      `${item.action}\u0000${item.subjectIds.join("\u0000")}` === key,
    );
    if (existing) return existing;
    if (itemKeys.has(key)) throw new Error(`duplicate answer work item ${key}`);
    itemKeys.add(key);
    const item = buildItem(dossier.dossierId, {
      ...work,
      subjectIds: normalizedSubjects,
    });
    rawItems.push(item);
    return item;
  };

  const reconciliationTasks = new Map<string, AsoiafAnswerWorkItem>();
  for (const reference of dossier.recallReferences) {
    const satisfied = coverage.candidateIds.has(reference.candidateId);
    const item = addItem({
      action: "reconcile-candidate",
      status: satisfied ? "satisfied" : "open",
      requiredForBoundedComplete: true,
      subjectIds: [reference.referenceId, reference.candidateId],
      reason: satisfied
        ? "A passed reconciliation transaction contains an approved resolution for this dossier candidate."
        : "The dossier candidate has no approved reconciliation resolution in the supplied transactions.",
    });
    reconciliationTasks.set(reference.candidateId, item);
  }

  for (const reference of dossier.privateReferences) {
    const satisfied = reviewedPrivateSet.has(reference.referenceId);
    addItem({
      action: "review-exact-locator",
      status: satisfied ? "satisfied" : "open",
      requiredForBoundedComplete: true,
      subjectIds: [
        reference.referenceId,
        reference.sourceId,
        reference.paragraphDigest,
      ],
      reason: satisfied
        ? "A supplied reviewed transaction carries primary evidence with this exact private paragraph digest."
        : "The private retrieval reference remains navigation-only until a named review packet binds its exact digest and locator.",
    });
  }

  for (const reference of dispositionReferences) {
    const limited = limitedReferenceSet.has(reference.referenceId);
    addItem({
      action: "inspect-disposition",
      status: limited ? "preserved-as-limitation" : "open",
      requiredForBoundedComplete: true,
      subjectIds: [
        reference.referenceId,
        reference.admission.admissionId,
        reference.observationId,
      ],
      reason: limited
        ? "The reviewed answer packet preserves this rejected or deferred structured observation as an explicit limitation."
        : "The rejected or deferred structured observation requires inspection or an explicit answer limitation.",
    });
  }

  for (const gap of dossier.gaps) {
    const closed = closedGapSet.has(gap.gapId);
    const limited = limitedGapSet.has(gap.gapId);
    const resolvable = Boolean(
      (gap.candidateId && coverage.candidateIds.has(gap.candidateId))
      || (gap.observationId && coverage.observationIds.has(gap.observationId))
      || (gap.sourceId && coverage.sourceIds.has(gap.sourceId)),
    );
    const action = closed || resolvable ? "close-gap" : gapAction(gap);
    const dependency = gap.candidateId
      ? reconciliationTasks.get(gap.candidateId)?.itemId
      : undefined;
    addItem({
      action,
      status: closed
        ? "satisfied"
        : limited
          ? "preserved-as-limitation"
          : "open",
      requiredForBoundedComplete: true,
      subjectIds: [
        gap.gapId,
        gap.sourceId ?? "source:none",
        gap.candidateId ?? "candidate:none",
        gap.observationId ?? "observation:none",
      ],
      dependencyItemIds: dependency ? [dependency] : [],
      reason: closed
        ? "The reviewed answer packet contains a content-addressed closure for this dossier gap."
        : limited
          ? "The reviewed answer packet preserves this dossier gap as an explicit limitation."
          : resolvable
            ? "Supplied adjudicated custody can close this immutable dossier gap during answer assembly."
            : `The dossier gap remains open and requires ${gapAction(gap)}.`,
    });
  }

  for (const action of dossier.nextActions) {
    if (rawItems.some((item) => item.action === action)) continue;
    addItem({
      action,
      status: "open",
      requiredForBoundedComplete: true,
      subjectIds: [dossier.dossierId],
      reason: `The qualified dossier projects ${action} and no more specific work item represents it.`,
    });
  }

  const openPrerequisites = rawItems
    .filter((item) => item.status === "open")
    .map((item) => item.itemId);
  const canAssemble = transactions.length > 0
    && transactions.some((transaction) =>
      (transaction.reconciliationReceipt.canonReceipt?.resolutions ?? [])
        .some((resolution) => approvedResolutionAction(resolution.action)),
    );
  const assembly = addItem({
    action: "assemble-reviewed-answer",
    status: answerPacket
      ? "satisfied"
      : canAssemble
        ? "open"
        : "blocked",
    requiredForBoundedComplete: true,
    subjectIds: [dossier.dossierId, dossier.question.questionId],
    dependencyItemIds: openPrerequisites,
    reason: answerPacket
      ? "A valid reviewed answer packet binds this exact dossier."
      : canAssemble
        ? "Adjudicated claim custody is available; answer assembly may proceed while preserving remaining work as closures or limitations."
        : "No supplied transaction contains an approved resolution that can support reviewed answer text.",
  });
  const verification = addItem({
    action: "verify-reviewed-answer",
    status: answerPacket ? "satisfied" : "blocked",
    requiredForBoundedComplete: true,
    subjectIds: [answerPacket?.answerPacketId ?? dossier.dossierId],
    dependencyItemIds: [assembly.itemId],
    reason: answerPacket
      ? "The supplied answer packet passes the permanent packet validator."
      : "Answer verification requires a completed reviewed answer packet.",
  });
  addItem({
    action: "render-reviewed-answer",
    status: answerPacket ? "open" : "blocked",
    requiredForBoundedComplete: false,
    subjectIds: [answerPacket?.answerPacketId ?? dossier.dossierId],
    dependencyItemIds: [verification.itemId],
    reason: answerPacket
      ? "The verified packet is ready for deterministic reviewed-text rendering."
      : "Rendering requires a verified reviewed answer packet.",
  });

  const items = rawItems.sort(
    (left, right) =>
      STAGE_RANK[left.stage] - STAGE_RANK[right.stage]
      || compareCodepoints(left.action, right.action)
      || compareCodepoints(left.itemId, right.itemId),
  );
  const countsByStatus: Record<AsoiafAnswerWorkItemStatus, number> = {
    open: 0,
    satisfied: 0,
    "preserved-as-limitation": 0,
    blocked: 0,
  };
  for (const item of items) countsByStatus[item.status] += 1;

  const openStages = new Set(
    items.filter((item) => item.status === "open").map((item) => item.stage),
  );
  const answerReady = answerPacket !== null;
  const boundedComplete = Boolean(
    answerPacket
    && answerPacket.scope === "bounded-complete"
    && items.every(
      (item) =>
        !item.requiredForBoundedComplete
        || item.status === "satisfied",
    ),
  );
  let status: AsoiafAnswerWorkOrderStatus;
  if (answerPacket) {
    status = boundedComplete ? "answer-ready-bounded" : "answer-ready-partial";
  } else if (openStages.has("research")) {
    status = "research-open";
  } else if (openStages.has("review")) {
    status = "review-open";
  } else if (openStages.has("reconciliation")) {
    status = "reconciliation-open";
  } else {
    status = "answer-assembly-open";
  }

  return {
    transactions,
    answerPacket,
    resolvedCandidateIds,
    unresolvedCandidateIds,
    reviewedPrivateReferenceIds,
    unreviewedPrivateReferenceIds,
    closedGapIds,
    limitedGapIds,
    openGapIds,
    limitedReferenceIds,
    openDispositionReferenceIds,
    items,
    countsByStatus,
    status,
    answerReady,
    boundedComplete,
  };
}

function workOrderCore(
  workOrder: AsoiafAnswerWorkOrder,
): Omit<AsoiafAnswerWorkOrder, "workOrderId" | "workOrderFingerprint"> {
  const {
    workOrderId: _workOrderId,
    workOrderFingerprint: _workOrderFingerprint,
    ...core
  } = workOrder;
  return core;
}

export function buildAsoiafAnswerWorkOrder(
  input: AsoiafAnswerWorkOrderInput,
): AsoiafAnswerWorkOrder {
  validateInput(input);
  const projection = compileProjection(input);
  const core = {
    format: ASOIAF_ANSWER_WORK_ORDER_FORMAT,
    dossier: input.dossier,
    dossierId: input.dossier.dossierId,
    dossierFingerprint: input.dossier.dossierFingerprint,
    questionId: input.dossier.question.questionId,
    questionDigest: input.dossier.question.questionDigest,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    ...projection,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const workOrderFingerprint = sha256(core);
  const workOrder: AsoiafAnswerWorkOrder = {
    ...core,
    workOrderId: collectorContentId("asoiaf-answer-work-order", {
      dossierId: input.dossier.dossierId,
      workOrderFingerprint,
    }),
    workOrderFingerprint,
  };
  const errors = validateAsoiafAnswerWorkOrder(workOrder)
    .filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `invalid answer work order: ${errors
        .map((entry) => `${entry.code}:${entry.subjectId}`)
        .join(", ")}`,
    );
  }
  return workOrder;
}

export function validateAsoiafAnswerWorkOrder(
  workOrder: AsoiafAnswerWorkOrder,
): AsoiafAnswerWorkOrderFinding[] {
  const findings: AsoiafAnswerWorkOrderFinding[] = [];
  if (workOrder.format !== ASOIAF_ANSWER_WORK_ORDER_FORMAT) {
    findings.push(
      finding("work-order-format", "error", workOrder.workOrderId, "answer work-order format is invalid"),
    );
  }
  try {
    validateInput({
      dossier: workOrder.dossier,
      createdBy: workOrder.createdBy,
      createdAt: workOrder.createdAt,
      transactions: workOrder.transactions,
      answerPacket: workOrder.answerPacket,
    });
  } catch (error) {
    findings.push(
      finding(
        "work-order-input",
        "error",
        workOrder.workOrderId,
        error instanceof Error ? error.message : String(error),
      ),
    );
  }
  if (
    workOrder.dossierId !== workOrder.dossier.dossierId
    || workOrder.dossierFingerprint !== workOrder.dossier.dossierFingerprint
    || workOrder.questionId !== workOrder.dossier.question.questionId
    || workOrder.questionDigest !== workOrder.dossier.question.questionDigest
  ) {
    findings.push(
      finding("work-order-dossier", "error", workOrder.workOrderId, "answer work order differs from its dossier custody"),
    );
  }
  const itemIds = new Set<string>();
  for (const item of workOrder.items) {
    if (itemIds.has(item.itemId)) {
      findings.push(finding("duplicate-work-item", "error", item.itemId, "answer work item identity is duplicated"));
    }
    itemIds.add(item.itemId);
    const expectedCore = itemCore(item);
    const expectedFingerprint = sha256(expectedCore);
    if (item.itemFingerprint !== expectedFingerprint) {
      findings.push(finding("work-item-fingerprint", "error", item.itemId, "answer work item fingerprint is stale"));
    }
    const expectedId = collectorContentId("asoiaf-answer-work-item", {
      dossierId: workOrder.dossierId,
      action: item.action,
      subjectIds: expectedCore.subjectIds,
      itemFingerprint: expectedFingerprint,
    });
    if (item.itemId !== expectedId) {
      findings.push(finding("work-item-identity", "error", item.itemId, "answer work item identity is not content addressed"));
    }
    if (
      item.authority !== "none"
      || item.graphEffect !== "none"
      || item.canonEffect !== "none"
      || item.answerEffect !== "none"
    ) {
      findings.push(finding("work-item-authority", "error", item.itemId, "answer work item acquired execution or authority"));
    }
    if (item.dependencyItemIds.includes(item.itemId)) {
      findings.push(finding("work-item-self-dependency", "error", item.itemId, "answer work item depends on itself"));
    }
  }
  for (const item of workOrder.items) {
    for (const dependency of item.dependencyItemIds) {
      if (!itemIds.has(dependency)) {
        findings.push(finding("work-item-dependency", "error", item.itemId, `${dependency} is absent from the work order`));
      }
    }
  }
  try {
    const projection = compileProjection({
      dossier: workOrder.dossier,
      createdBy: workOrder.createdBy,
      createdAt: workOrder.createdAt,
      transactions: workOrder.transactions,
      answerPacket: workOrder.answerPacket,
    });
    for (const key of [
      "transactions",
      "answerPacket",
      "resolvedCandidateIds",
      "unresolvedCandidateIds",
      "reviewedPrivateReferenceIds",
      "unreviewedPrivateReferenceIds",
      "closedGapIds",
      "limitedGapIds",
      "openGapIds",
      "limitedReferenceIds",
      "openDispositionReferenceIds",
      "items",
      "countsByStatus",
      "status",
      "answerReady",
      "boundedComplete",
    ] as const) {
      if (JSON.stringify(workOrder[key]) !== JSON.stringify(projection[key])) {
        findings.push(
          finding(
            `work-order-projection:${key}`,
            "error",
            workOrder.workOrderId,
            `${key} differs from the deterministic answer work-order projection`,
          ),
        );
      }
    }
  } catch (error) {
    findings.push(
      finding(
        "work-order-projection",
        "error",
        workOrder.workOrderId,
        error instanceof Error ? error.message : String(error),
      ),
    );
  }
  if (
    workOrder.authority !== "none"
    || workOrder.graphEffect !== "none"
    || workOrder.canonEffect !== "none"
    || workOrder.answerEffect !== "none"
  ) {
    findings.push(
      finding("work-order-authority", "error", workOrder.workOrderId, "answer work order acquired execution, graph, canon, or answer authority"),
    );
  }
  const expectedFingerprint = sha256(workOrderCore(workOrder));
  if (workOrder.workOrderFingerprint !== expectedFingerprint) {
    findings.push(finding("work-order-fingerprint", "error", workOrder.workOrderId, "answer work-order fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-work-order", {
    dossierId: workOrder.dossierId,
    workOrderFingerprint: expectedFingerprint,
  });
  if (workOrder.workOrderId !== expectedId) {
    findings.push(finding("work-order-identity", "error", workOrder.workOrderId, "answer work-order identity is not content addressed"));
  }
  return sortedFindings(findings);
}