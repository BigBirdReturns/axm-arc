import fs from "node:fs";
import path from "node:path";
import {
  collectorContentId,
  sha256,
} from "./asoiaf-external-estate.js";
import {
  renderAsoiafReviewedAnswerPacket,
  validateAsoiafReviewedAnswerPacket,
  type AsoiafReviewedAnswerPacket,
} from "./asoiaf-reviewed-answer-packet.js";
import {
  validateAsoiafAnswerWorkOrder,
  type AsoiafAnswerWorkAction,
  type AsoiafAnswerWorkItem,
  type AsoiafAnswerWorkItemStatus,
  type AsoiafAnswerWorkOrder,
} from "./asoiaf-answer-work-order.js";
import {
  asoiafAnswerWorkItemKey,
  validateAsoiafAnswerWorkLease,
  type AsoiafAnswerDeskState,
  type AsoiafAnswerWorkLease,
  type AsoiafAnswerWorkResultReference,
  type AsoiafAnswerWorkSettlement,
} from "./asoiaf-answer-work-lease.js";
import {
  asoiafAnswerDeskEstatePaths,
  claimAsoiafAnswerDeskWork,
  readAsoiafAnswerDeskStatus,
  settleAsoiafAnswerDeskWork,
  verifyAsoiafAnswerDeskEstate,
  type AsoiafAnswerDeskClaimResult,
  type AsoiafAnswerDeskSettleResult,
  type AsoiafAnswerDeskWorkOrderRecord,
} from "./asoiaf-answer-desk-estate.js";

export const ASOIAF_ANSWER_WORKER_MANIFEST_FORMAT =
  "axm-asoiaf-answer-worker-manifest/1" as const;
export const ASOIAF_ANSWER_WORKER_ASSIGNMENT_FORMAT =
  "axm-asoiaf-answer-worker-assignment/1" as const;
export const ASOIAF_ANSWER_WORKER_PLAN_FORMAT =
  "axm-asoiaf-answer-worker-plan/1" as const;
export const ASOIAF_ANSWER_WORKER_INVOCATION_FORMAT =
  "axm-asoiaf-answer-worker-invocation/1" as const;
export const ASOIAF_ANSWER_WORKER_RESULT_FORMAT =
  "axm-asoiaf-answer-worker-result/1" as const;

export const ASOIAF_REVIEWED_RENDER_WORKER_ID =
  "asoiaf-answer-worker:reviewed-renderer-v1" as const;

export type AsoiafAnswerWorkerExecutionMode =
  | "automatic"
  | "external-required";

export type AsoiafAnswerWorkerRequiredActor =
  | "network-collector"
  | "holder-controlled-search"
  | "edition-reviewer"
  | "structured-observation-reviewer"
  | "exact-locator-reviewer"
  | "disposition-reviewer"
  | "canon-reconciler"
  | "continuity-reviewer"
  | "answer-assembler"
  | "answer-verifier"
  | "reviewed-renderer";

export type AsoiafAnswerWorkerDeskStatus =
  | AsoiafAnswerWorkItemStatus
  | "available"
  | "active-lease"
  | "expired-lease"
  | "stale-lease"
  | "settled"
  | "unavailable";

export interface AsoiafAnswerWorkerCapability {
  action: AsoiafAnswerWorkAction;
  executionMode: AsoiafAnswerWorkerExecutionMode;
  workerId: string | null;
  requiredActor: AsoiafAnswerWorkerRequiredActor;
  networkAccess: "none" | "required";
  privateTextAccess: "none" | "required";
  humanReview: "none" | "required";
  resultKinds: string[];
}

export interface AsoiafAnswerWorkerManifest {
  format: typeof ASOIAF_ANSWER_WORKER_MANIFEST_FORMAT;
  workerId: typeof ASOIAF_REVIEWED_RENDER_WORKER_ID;
  version: "1";
  capabilities: AsoiafAnswerWorkerCapability[];
  automaticActions: AsoiafAnswerWorkAction[];
  networkAccess: "none";
  privateTextAccess: "none";
  humanReviewAuthority: "none";
  acquisitionAuthority: "none";
  reconciliationAuthority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "render-reviewed-packet";
  manifestFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerWorkerAssignment {
  format: typeof ASOIAF_ANSWER_WORKER_ASSIGNMENT_FORMAT;
  assignmentId: string;
  workOrderId: string;
  workOrderFingerprint: `sha256:${string}`;
  stateId: string;
  stateFingerprint: `sha256:${string}`;
  itemId: string;
  itemFingerprint: `sha256:${string}`;
  itemKey: `sha256:${string}`;
  action: AsoiafAnswerWorkAction;
  stage: AsoiafAnswerWorkItem["stage"];
  subjectIds: string[];
  dependencyItemIds: string[];
  itemStatus: AsoiafAnswerWorkItemStatus;
  deskStatus: AsoiafAnswerWorkerDeskStatus;
  executionMode: AsoiafAnswerWorkerExecutionMode;
  workerId: string | null;
  requiredActor: AsoiafAnswerWorkerRequiredActor;
  networkAccess: "none" | "required";
  privateTextAccess: "none" | "required";
  humanReview: "none" | "required";
  eligible: boolean;
  reason: string;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  assignmentFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerWorkerPlan {
  format: typeof ASOIAF_ANSWER_WORKER_PLAN_FORMAT;
  planId: string;
  estateId: string;
  workOrderId: string;
  workOrderFingerprint: `sha256:${string}`;
  stateId: string;
  stateFingerprint: `sha256:${string}`;
  asOf: string;
  assignments: AsoiafAnswerWorkerAssignment[];
  nextAutomaticItemId: string | null;
  automaticAvailableItemIds: string[];
  externalAvailableItemIds: string[];
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  planFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerWorkerInvocation {
  format: typeof ASOIAF_ANSWER_WORKER_INVOCATION_FORMAT;
  invocationId: string;
  workerManifestFingerprint: `sha256:${string}`;
  leaseId: string;
  leaseFingerprint: `sha256:${string}`;
  workOrderId: string;
  workOrderFingerprint: `sha256:${string}`;
  itemId: string;
  itemFingerprint: `sha256:${string}`;
  itemKey: `sha256:${string}`;
  action: "render-reviewed-answer";
  workerId: typeof ASOIAF_REVIEWED_RENDER_WORKER_ID;
  requestedAt: string;
  outputDirectoryUri: "answer-worker/outputs";
  resultDirectoryUri: "answer-worker/results";
  networkAccess: "none";
  privateTextAccess: "none";
  humanReviewAuthority: "none";
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  invocationFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerWorkerResult {
  format: typeof ASOIAF_ANSWER_WORKER_RESULT_FORMAT;
  resultId: string;
  invocationId: string;
  invocationFingerprint: `sha256:${string}`;
  leaseId: string;
  leaseFingerprint: `sha256:${string}`;
  workOrderId: string;
  workOrderFingerprint: `sha256:${string}`;
  itemId: string;
  itemKey: `sha256:${string}`;
  action: "render-reviewed-answer";
  workerId: typeof ASOIAF_REVIEWED_RENDER_WORKER_ID;
  startedAt: string;
  completedAt: string;
  outcome: "rendered";
  resultReferences: AsoiafAnswerWorkResultReference[];
  renderedTextCharacters: number;
  reason: string;
  settlementOutcome: "rendered";
  networkAccess: "none";
  privateTextAccess: "none";
  humanReviewAuthority: "none";
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  resultFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerDeskWorkerPaths {
  root: string;
  workerRoot: string;
  invocations: string;
  results: string;
  outputs: string;
}

export interface AsoiafAnswerDeskWorkerRunInput {
  root: string;
  itemId?: string | null;
  workerId?: typeof ASOIAF_REVIEWED_RENDER_WORKER_ID;
  claimedAt: string;
  requestedAt?: string;
  completedAt: string;
  leaseMilliseconds: number;
  operatorId?: string;
}

export interface AsoiafAnswerDeskWorkerRunResult {
  plan: AsoiafAnswerWorkerPlan;
  claim: AsoiafAnswerDeskClaimResult;
  invocation: AsoiafAnswerWorkerInvocation;
  invocationReplayed: boolean;
  result: AsoiafAnswerWorkerResult;
  resultReplayed: boolean;
  settlement: AsoiafAnswerDeskSettleResult;
}

export interface AsoiafAnswerDeskWorkerStatus {
  paths: AsoiafAnswerDeskWorkerPaths;
  manifest: AsoiafAnswerWorkerManifest;
  plan: AsoiafAnswerWorkerPlan;
  invocations: AsoiafAnswerWorkerInvocation[];
  results: AsoiafAnswerWorkerResult[];
}

export interface AsoiafAnswerDeskWorkerFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

const ALL_ACTIONS: AsoiafAnswerWorkAction[] = [
  "acquire-public-record",
  "search-private-edition",
  "resolve-edition",
  "inspect-disposition",
  "split-continuity",
  "review-structured-observation",
  "review-exact-locator",
  "reconcile-candidate",
  "close-gap",
  "assemble-reviewed-answer",
  "verify-reviewed-answer",
  "render-reviewed-answer",
];

function finding(
  code: string,
  severity: AsoiafAnswerDeskWorkerFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafAnswerDeskWorkerFinding {
  return { code, severity, subjectId, detail };
}

function sortedFindings(
  findings: readonly AsoiafAnswerDeskWorkerFinding[],
): AsoiafAnswerDeskWorkerFinding[] {
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

function capabilityForAction(
  action: AsoiafAnswerWorkAction,
): AsoiafAnswerWorkerCapability {
  switch (action) {
    case "acquire-public-record":
      return {
        action,
        executionMode: "external-required",
        workerId: null,
        requiredActor: "network-collector",
        networkAccess: "required",
        privateTextAccess: "none",
        humanReview: "none",
        resultKinds: ["structured-public-observation"],
      };
    case "search-private-edition":
      return {
        action,
        executionMode: "external-required",
        workerId: null,
        requiredActor: "holder-controlled-search",
        networkAccess: "none",
        privateTextAccess: "required",
        humanReview: "none",
        resultKinds: ["private-search-result"],
      };
    case "resolve-edition":
      return {
        action,
        executionMode: "external-required",
        workerId: null,
        requiredActor: "edition-reviewer",
        networkAccess: "none",
        privateTextAccess: "none",
        humanReview: "required",
        resultKinds: ["edition-resolution"],
      };
    case "review-structured-observation":
      return {
        action,
        executionMode: "external-required",
        workerId: null,
        requiredActor: "structured-observation-reviewer",
        networkAccess: "none",
        privateTextAccess: "none",
        humanReview: "required",
        resultKinds: ["reviewed-structured-observation"],
      };
    case "review-exact-locator":
      return {
        action,
        executionMode: "external-required",
        workerId: null,
        requiredActor: "exact-locator-reviewer",
        networkAccess: "none",
        privateTextAccess: "required",
        humanReview: "required",
        resultKinds: ["reviewed-private-locator"],
      };
    case "inspect-disposition":
      return {
        action,
        executionMode: "external-required",
        workerId: null,
        requiredActor: "disposition-reviewer",
        networkAccess: "none",
        privateTextAccess: "none",
        humanReview: "required",
        resultKinds: ["disposition-inspection"],
      };
    case "reconcile-candidate":
      return {
        action,
        executionMode: "external-required",
        workerId: null,
        requiredActor: "canon-reconciler",
        networkAccess: "none",
        privateTextAccess: "none",
        humanReview: "required",
        resultKinds: ["reviewed-answer-transaction"],
      };
    case "split-continuity":
      return {
        action,
        executionMode: "external-required",
        workerId: null,
        requiredActor: "continuity-reviewer",
        networkAccess: "none",
        privateTextAccess: "none",
        humanReview: "required",
        resultKinds: ["continuity-split-decision"],
      };
    case "close-gap":
    case "assemble-reviewed-answer":
      return {
        action,
        executionMode: "external-required",
        workerId: null,
        requiredActor: "answer-assembler",
        networkAccess: "none",
        privateTextAccess: "none",
        humanReview: "required",
        resultKinds: ["reviewed-answer-packet"],
      };
    case "verify-reviewed-answer":
      return {
        action,
        executionMode: "external-required",
        workerId: null,
        requiredActor: "answer-verifier",
        networkAccess: "none",
        privateTextAccess: "none",
        humanReview: "required",
        resultKinds: ["reviewed-answer-verification"],
      };
    case "render-reviewed-answer":
      return {
        action,
        executionMode: "automatic",
        workerId: ASOIAF_REVIEWED_RENDER_WORKER_ID,
        requiredActor: "reviewed-renderer",
        networkAccess: "none",
        privateTextAccess: "none",
        humanReview: "none",
        resultKinds: ["reviewed-answer-render"],
      };
  }
}

function manifestCore(
  manifest: AsoiafAnswerWorkerManifest,
): Omit<AsoiafAnswerWorkerManifest, "manifestFingerprint"> {
  const { manifestFingerprint: _fingerprint, ...core } = manifest;
  return core;
}

export function buildAsoiafAnswerWorkerManifest(): AsoiafAnswerWorkerManifest {
  const core = {
    format: ASOIAF_ANSWER_WORKER_MANIFEST_FORMAT,
    workerId: ASOIAF_REVIEWED_RENDER_WORKER_ID,
    version: "1" as const,
    capabilities: ALL_ACTIONS.map(capabilityForAction),
    automaticActions: ["render-reviewed-answer"] as AsoiafAnswerWorkAction[],
    networkAccess: "none" as const,
    privateTextAccess: "none" as const,
    humanReviewAuthority: "none" as const,
    acquisitionAuthority: "none" as const,
    reconciliationAuthority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "render-reviewed-packet" as const,
  };
  return { ...core, manifestFingerprint: sha256(core) };
}

export function validateAsoiafAnswerWorkerManifest(
  manifest: AsoiafAnswerWorkerManifest,
): AsoiafAnswerDeskWorkerFinding[] {
  const findings: AsoiafAnswerDeskWorkerFinding[] = [];
  if (
    manifest.format !== ASOIAF_ANSWER_WORKER_MANIFEST_FORMAT
    || manifest.workerId !== ASOIAF_REVIEWED_RENDER_WORKER_ID
    || manifest.version !== "1"
  ) {
    findings.push(finding("worker-manifest-format", "error", manifest.workerId, "answer worker manifest identity or version is invalid"));
  }
  if (
    JSON.stringify(manifest.capabilities)
    !== JSON.stringify(ALL_ACTIONS.map(capabilityForAction))
    || JSON.stringify(manifest.automaticActions)
      !== JSON.stringify(["render-reviewed-answer"])
  ) {
    findings.push(finding("worker-manifest-capabilities", "error", manifest.workerId, "answer worker capabilities differ from the bounded registry"));
  }
  if (
    manifest.networkAccess !== "none"
    || manifest.privateTextAccess !== "none"
    || manifest.humanReviewAuthority !== "none"
    || manifest.acquisitionAuthority !== "none"
    || manifest.reconciliationAuthority !== "none"
    || manifest.graphEffect !== "none"
    || manifest.canonEffect !== "none"
    || manifest.answerEffect !== "render-reviewed-packet"
  ) {
    findings.push(finding("worker-manifest-authority", "error", manifest.workerId, "answer worker crossed its deterministic render-only boundary"));
  }
  if (manifest.manifestFingerprint !== sha256(manifestCore(manifest))) {
    findings.push(finding("worker-manifest-fingerprint", "error", manifest.workerId, "answer worker manifest fingerprint is stale"));
  }
  return sortedFindings(findings);
}

export function asoiafAnswerDeskWorkerPaths(
  root: string,
): AsoiafAnswerDeskWorkerPaths {
  const absolute = path.resolve(root);
  const workerRoot = path.join(absolute, "answer-worker");
  return {
    root: absolute,
    workerRoot,
    invocations: path.join(workerRoot, "invocations"),
    results: path.join(workerRoot, "results"),
    outputs: path.join(workerRoot, "outputs"),
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

function writeExclusiveOrReplay(
  target: string,
  serialized: string,
): boolean {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    fs.writeFileSync(target, serialized, { encoding: "utf8", flag: "wx" });
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = fs.readFileSync(target, "utf8");
    if (existing !== serialized) {
      throw new Error(`answer worker immutable file collision at ${target}`);
    }
    return true;
  }
}

function writeJsonExclusiveOrReplay(target: string, value: unknown): boolean {
  return writeExclusiveOrReplay(target, `${JSON.stringify(value, null, 2)}\n`);
}

function ensureDeskValid(root: string): void {
  const errors = verifyAsoiafAnswerDeskEstate(root)
    .filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `invalid answer desk estate: ${errors
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

function currentWorkOrder(root: string): AsoiafAnswerWorkOrder {
  const status = readAsoiafAnswerDeskStatus(root);
  const record = status.workOrders.find(
    (entry) => entry.workOrderId === status.manifest.latestWorkOrderId,
  );
  if (!record) throw new Error("answer desk latest work-order record is absent");
  return readJson<AsoiafAnswerWorkOrder>(workOrderPathFromRecord(root, record));
}

function deskStatusForItem(input: {
  item: AsoiafAnswerWorkItem;
  state: AsoiafAnswerDeskState;
  leases: readonly AsoiafAnswerWorkLease[];
  settlements: readonly AsoiafAnswerWorkSettlement[];
}): AsoiafAnswerWorkerDeskStatus {
  if (input.item.status !== "open") return input.item.status;
  if (input.state.availableItemIds.includes(input.item.itemId)) return "available";
  const key = asoiafAnswerWorkItemKey(input.item);
  const matchingLeases = input.leases.filter((lease) => lease.itemKey === key);
  const settlementLeaseIds = new Set(input.settlements.map((entry) => entry.leaseId));
  if (matchingLeases.some((lease) => settlementLeaseIds.has(lease.leaseId))) {
    return "settled";
  }
  if (matchingLeases.some((lease) => input.state.activeLeaseIds.includes(lease.leaseId))) {
    return "active-lease";
  }
  if (matchingLeases.some((lease) => input.state.expiredLeaseIds.includes(lease.leaseId))) {
    return "expired-lease";
  }
  if (matchingLeases.some((lease) => input.state.staleLeaseIds.includes(lease.leaseId))) {
    return "stale-lease";
  }
  return "unavailable";
}

function assignmentCore(
  assignment: AsoiafAnswerWorkerAssignment,
): Omit<
  AsoiafAnswerWorkerAssignment,
  "assignmentId" | "assignmentFingerprint"
> {
  const {
    assignmentId: _id,
    assignmentFingerprint: _fingerprint,
    ...core
  } = assignment;
  return core;
}

function buildAssignment(input: {
  workOrder: AsoiafAnswerWorkOrder;
  state: AsoiafAnswerDeskState;
  item: AsoiafAnswerWorkItem;
  leases: readonly AsoiafAnswerWorkLease[];
  settlements: readonly AsoiafAnswerWorkSettlement[];
}): AsoiafAnswerWorkerAssignment {
  const capability = capabilityForAction(input.item.action);
  const deskStatus = deskStatusForItem(input);
  const eligible = deskStatus === "available"
    && capability.executionMode === "automatic";
  const core = {
    format: ASOIAF_ANSWER_WORKER_ASSIGNMENT_FORMAT,
    workOrderId: input.workOrder.workOrderId,
    workOrderFingerprint: input.workOrder.workOrderFingerprint,
    stateId: input.state.stateId,
    stateFingerprint: input.state.stateFingerprint,
    itemId: input.item.itemId,
    itemFingerprint: input.item.itemFingerprint,
    itemKey: asoiafAnswerWorkItemKey(input.item),
    action: input.item.action,
    stage: input.item.stage,
    subjectIds: [...input.item.subjectIds],
    dependencyItemIds: [...input.item.dependencyItemIds],
    itemStatus: input.item.status,
    deskStatus,
    executionMode: capability.executionMode,
    workerId: capability.workerId,
    requiredActor: capability.requiredActor,
    networkAccess: capability.networkAccess,
    privateTextAccess: capability.privateTextAccess,
    humanReview: capability.humanReview,
    eligible,
    reason: eligible
      ? "The verified reviewed answer packet may be rendered deterministically without network, private-text, review, reconciliation, graph, or canon authority."
      : capability.executionMode === "external-required"
        ? `This action remains external and requires ${capability.requiredActor}; the built-in renderer will not claim it.`
        : `The deterministic renderer is not eligible while desk status is ${deskStatus}.`,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const assignmentFingerprint = sha256(core);
  return {
    ...core,
    assignmentId: collectorContentId("asoiaf-answer-worker-assignment", {
      workOrderId: core.workOrderId,
      itemKey: core.itemKey,
      stateFingerprint: core.stateFingerprint,
      assignmentFingerprint,
    }),
    assignmentFingerprint,
  };
}

function planCore(
  plan: AsoiafAnswerWorkerPlan,
): Omit<AsoiafAnswerWorkerPlan, "planId" | "planFingerprint"> {
  const { planId: _id, planFingerprint: _fingerprint, ...core } = plan;
  return core;
}

export function planAsoiafAnswerDeskWorkers(
  root: string,
): AsoiafAnswerWorkerPlan {
  ensureDeskValid(root);
  const status = readAsoiafAnswerDeskStatus(root);
  const workOrder = currentWorkOrder(root);
  const assignments = workOrder.items.map((item) =>
    buildAssignment({
      workOrder,
      state: status.state,
      item,
      leases: status.leases,
      settlements: status.settlements,
    }),
  );
  const automaticAvailableItemIds = assignments
    .filter((entry) => entry.eligible)
    .map((entry) => entry.itemId);
  const externalAvailableItemIds = assignments
    .filter(
      (entry) =>
        entry.deskStatus === "available"
        && entry.executionMode === "external-required",
    )
    .map((entry) => entry.itemId);
  const core = {
    format: ASOIAF_ANSWER_WORKER_PLAN_FORMAT,
    estateId: status.manifest.estateId,
    workOrderId: workOrder.workOrderId,
    workOrderFingerprint: workOrder.workOrderFingerprint,
    stateId: status.state.stateId,
    stateFingerprint: status.state.stateFingerprint,
    asOf: status.state.asOf,
    assignments,
    nextAutomaticItemId: automaticAvailableItemIds[0] ?? null,
    automaticAvailableItemIds,
    externalAvailableItemIds,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const planFingerprint = sha256(core);
  return {
    ...core,
    planId: collectorContentId("asoiaf-answer-worker-plan", {
      estateId: core.estateId,
      workOrderId: core.workOrderId,
      stateFingerprint: core.stateFingerprint,
      planFingerprint,
    }),
    planFingerprint,
  };
}

export function validateAsoiafAnswerWorkerPlan(
  plan: AsoiafAnswerWorkerPlan,
  root: string,
): AsoiafAnswerDeskWorkerFinding[] {
  const findings: AsoiafAnswerDeskWorkerFinding[] = [];
  let expected: AsoiafAnswerWorkerPlan | null = null;
  try {
    expected = planAsoiafAnswerDeskWorkers(root);
  } catch (error) {
    findings.push(finding("worker-plan-input", "error", plan.planId, error instanceof Error ? error.message : String(error)));
  }
  if (plan.format !== ASOIAF_ANSWER_WORKER_PLAN_FORMAT) {
    findings.push(finding("worker-plan-format", "error", plan.planId, "answer worker plan format is invalid"));
  }
  if (expected && JSON.stringify(plan) !== JSON.stringify(expected)) {
    findings.push(finding("worker-plan-projection", "error", plan.planId, "answer worker plan differs from the deterministic desk projection"));
  }
  if (plan.planFingerprint !== sha256(planCore(plan))) {
    findings.push(finding("worker-plan-fingerprint", "error", plan.planId, "answer worker plan fingerprint is stale"));
  }
  if (
    plan.authority !== "none"
    || plan.graphEffect !== "none"
    || plan.canonEffect !== "none"
    || plan.answerEffect !== "none"
  ) {
    findings.push(finding("worker-plan-authority", "error", plan.planId, "answer worker plan acquired execution or authority"));
  }
  return sortedFindings(findings);
}

function invocationCore(
  invocation: AsoiafAnswerWorkerInvocation,
): Omit<
  AsoiafAnswerWorkerInvocation,
  "invocationId" | "invocationFingerprint"
> {
  const {
    invocationId: _id,
    invocationFingerprint: _fingerprint,
    ...core
  } = invocation;
  return core;
}

export function buildAsoiafAnswerWorkerInvocation(input: {
  lease: AsoiafAnswerWorkLease;
  workOrder: AsoiafAnswerWorkOrder;
  requestedAt: string;
}): AsoiafAnswerWorkerInvocation {
  const manifest = buildAsoiafAnswerWorkerManifest();
  const leaseErrors = validateAsoiafAnswerWorkLease(input.lease, input.workOrder)
    .filter((entry) => entry.severity === "error");
  if (leaseErrors.length > 0) {
    throw new Error(`invalid answer work lease ${input.lease.leaseId}`);
  }
  if (
    input.lease.workerId !== manifest.workerId
    || input.lease.action !== "render-reviewed-answer"
  ) {
    throw new Error("built-in answer worker may execute only its exact reviewed-render lease");
  }
  if (
    !validTime(input.requestedAt)
    || Date.parse(input.requestedAt) < Date.parse(input.lease.claimedAt)
    || Date.parse(input.requestedAt) > Date.parse(input.lease.expiresAt)
  ) {
    throw new Error("answer worker invocation time is outside the active lease");
  }
  const packet = input.workOrder.answerPacket;
  if (!packet || !input.lease.subjectIds.includes(packet.answerPacketId)) {
    throw new Error("render lease does not bind the exact reviewed answer packet");
  }
  const packetErrors = validateAsoiafReviewedAnswerPacket(packet)
    .filter((entry) => entry.severity === "error");
  if (packetErrors.length > 0) {
    throw new Error(`reviewed answer packet ${packet.answerPacketId} is invalid`);
  }
  const core = {
    format: ASOIAF_ANSWER_WORKER_INVOCATION_FORMAT,
    workerManifestFingerprint: manifest.manifestFingerprint,
    leaseId: input.lease.leaseId,
    leaseFingerprint: input.lease.leaseFingerprint,
    workOrderId: input.workOrder.workOrderId,
    workOrderFingerprint: input.workOrder.workOrderFingerprint,
    itemId: input.lease.itemId,
    itemFingerprint: input.lease.itemFingerprint,
    itemKey: input.lease.itemKey,
    action: "render-reviewed-answer" as const,
    workerId: manifest.workerId,
    requestedAt: input.requestedAt,
    outputDirectoryUri: "answer-worker/outputs" as const,
    resultDirectoryUri: "answer-worker/results" as const,
    networkAccess: "none" as const,
    privateTextAccess: "none" as const,
    humanReviewAuthority: "none" as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const invocationFingerprint = sha256(core);
  return {
    ...core,
    invocationId: collectorContentId("asoiaf-answer-worker-invocation", {
      leaseId: core.leaseId,
      workerId: core.workerId,
      invocationFingerprint,
    }),
    invocationFingerprint,
  };
}

export function validateAsoiafAnswerWorkerInvocation(
  invocation: AsoiafAnswerWorkerInvocation,
  input: {
    lease: AsoiafAnswerWorkLease;
    workOrder: AsoiafAnswerWorkOrder;
  },
): AsoiafAnswerDeskWorkerFinding[] {
  const findings: AsoiafAnswerDeskWorkerFinding[] = [];
  let expected: AsoiafAnswerWorkerInvocation | null = null;
  try {
    expected = buildAsoiafAnswerWorkerInvocation({
      lease: input.lease,
      workOrder: input.workOrder,
      requestedAt: invocation.requestedAt,
    });
  } catch (error) {
    findings.push(finding("worker-invocation-input", "error", invocation.invocationId, error instanceof Error ? error.message : String(error)));
  }
  if (invocation.format !== ASOIAF_ANSWER_WORKER_INVOCATION_FORMAT) {
    findings.push(finding("worker-invocation-format", "error", invocation.invocationId, "answer worker invocation format is invalid"));
  }
  if (expected && JSON.stringify(invocation) !== JSON.stringify(expected)) {
    findings.push(finding("worker-invocation-projection", "error", invocation.invocationId, "answer worker invocation differs from exact lease custody"));
  }
  if (invocation.invocationFingerprint !== sha256(invocationCore(invocation))) {
    findings.push(finding("worker-invocation-fingerprint", "error", invocation.invocationId, "answer worker invocation fingerprint is stale"));
  }
  if (
    invocation.networkAccess !== "none"
    || invocation.privateTextAccess !== "none"
    || invocation.humanReviewAuthority !== "none"
    || invocation.authority !== "none"
    || invocation.graphEffect !== "none"
    || invocation.canonEffect !== "none"
    || invocation.answerEffect !== "none"
  ) {
    findings.push(finding("worker-invocation-authority", "error", invocation.invocationId, "answer worker invocation crossed its render-only boundary"));
  }
  return sortedFindings(findings);
}

function invocationPath(
  paths: AsoiafAnswerDeskWorkerPaths,
  invocation: AsoiafAnswerWorkerInvocation,
): string {
  return path.join(
    paths.invocations,
    `${invocation.invocationFingerprint.slice("sha256:".length)}.json`,
  );
}

function resultCore(
  result: AsoiafAnswerWorkerResult,
): Omit<AsoiafAnswerWorkerResult, "resultId" | "resultFingerprint"> {
  const { resultId: _id, resultFingerprint: _fingerprint, ...core } = result;
  return core;
}

function resultPath(
  paths: AsoiafAnswerDeskWorkerPaths,
  result: AsoiafAnswerWorkerResult,
): string {
  return path.join(
    paths.results,
    `${result.resultFingerprint.slice("sha256:".length)}.json`,
  );
}

function outputPath(
  paths: AsoiafAnswerDeskWorkerPaths,
  digest: `sha256:${string}`,
): string {
  return path.join(paths.outputs, `${digest.slice("sha256:".length)}.txt`);
}

export function persistAsoiafAnswerWorkerInvocation(
  root: string,
  invocation: AsoiafAnswerWorkerInvocation,
): { path: string; uri: string; replayed: boolean } {
  const paths = asoiafAnswerDeskWorkerPaths(root);
  const target = invocationPath(paths, invocation);
  const replayed = writeJsonExclusiveOrReplay(target, invocation);
  return { path: target, uri: relativeUri(root, target), replayed };
}

export function executeAsoiafAnswerWorkerInvocation(input: {
  root: string;
  invocation: AsoiafAnswerWorkerInvocation;
  lease: AsoiafAnswerWorkLease;
  workOrder: AsoiafAnswerWorkOrder;
  completedAt: string;
}): { result: AsoiafAnswerWorkerResult; replayed: boolean } {
  const invocationErrors = validateAsoiafAnswerWorkerInvocation(
    input.invocation,
    { lease: input.lease, workOrder: input.workOrder },
  ).filter((entry) => entry.severity === "error");
  if (invocationErrors.length > 0) {
    throw new Error(`invalid answer worker invocation ${input.invocation.invocationId}`);
  }
  if (
    !validTime(input.completedAt)
    || Date.parse(input.completedAt) < Date.parse(input.invocation.requestedAt)
    || Date.parse(input.completedAt) > Date.parse(input.lease.expiresAt)
  ) {
    throw new Error("answer worker completion time is outside the active lease");
  }
  const packet = input.workOrder.answerPacket as AsoiafReviewedAnswerPacket;
  const rendered = renderAsoiafReviewedAnswerPacket(packet);
  if (
    sha256(rendered) !== packet.renderedTextDigest
    || [...rendered].length !== packet.renderedTextCharacters
  ) {
    throw new Error("deterministic reviewed-answer render differs from packet custody");
  }
  const paths = asoiafAnswerDeskWorkerPaths(input.root);
  const target = outputPath(paths, packet.renderedTextDigest);
  const outputReplayed = writeExclusiveOrReplay(target, rendered);
  const reference: AsoiafAnswerWorkResultReference = {
    kind: "reviewed-answer-render",
    objectId: `${packet.answerPacketId}:rendered`,
    fingerprint: packet.renderedTextDigest,
    uri: relativeUri(input.root, target),
  };
  const core = {
    format: ASOIAF_ANSWER_WORKER_RESULT_FORMAT,
    invocationId: input.invocation.invocationId,
    invocationFingerprint: input.invocation.invocationFingerprint,
    leaseId: input.lease.leaseId,
    leaseFingerprint: input.lease.leaseFingerprint,
    workOrderId: input.workOrder.workOrderId,
    workOrderFingerprint: input.workOrder.workOrderFingerprint,
    itemId: input.lease.itemId,
    itemKey: input.lease.itemKey,
    action: "render-reviewed-answer" as const,
    workerId: ASOIAF_REVIEWED_RENDER_WORKER_ID,
    startedAt: input.invocation.requestedAt,
    completedAt: input.completedAt,
    outcome: "rendered" as const,
    resultReferences: [reference],
    renderedTextCharacters: [...rendered].length,
    reason:
      "The built-in worker emitted only the exact text already authorized by the validated reviewed answer packet.",
    settlementOutcome: "rendered" as const,
    networkAccess: "none" as const,
    privateTextAccess: "none" as const,
    humanReviewAuthority: "none" as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const resultFingerprint = sha256(core);
  const result: AsoiafAnswerWorkerResult = {
    ...core,
    resultId: collectorContentId("asoiaf-answer-worker-result", {
      invocationId: core.invocationId,
      resultFingerprint,
    }),
    resultFingerprint,
  };
  const resultTarget = resultPath(paths, result);
  const resultReplayed = writeJsonExclusiveOrReplay(resultTarget, result);
  return { result, replayed: outputReplayed && resultReplayed };
}

export function validateAsoiafAnswerWorkerResult(
  result: AsoiafAnswerWorkerResult,
  input: {
    root: string;
    invocation: AsoiafAnswerWorkerInvocation;
    lease: AsoiafAnswerWorkLease;
    workOrder: AsoiafAnswerWorkOrder;
  },
): AsoiafAnswerDeskWorkerFinding[] {
  const findings = validateAsoiafAnswerWorkerInvocation(
    input.invocation,
    { lease: input.lease, workOrder: input.workOrder },
  );
  if (result.format !== ASOIAF_ANSWER_WORKER_RESULT_FORMAT) {
    findings.push(finding("worker-result-format", "error", result.resultId, "answer worker result format is invalid"));
  }
  if (
    result.invocationId !== input.invocation.invocationId
    || result.invocationFingerprint !== input.invocation.invocationFingerprint
    || result.leaseId !== input.lease.leaseId
    || result.leaseFingerprint !== input.lease.leaseFingerprint
    || result.workOrderId !== input.workOrder.workOrderId
    || result.workOrderFingerprint !== input.workOrder.workOrderFingerprint
    || result.itemId !== input.lease.itemId
    || result.itemKey !== input.lease.itemKey
    || result.action !== "render-reviewed-answer"
    || result.workerId !== ASOIAF_REVIEWED_RENDER_WORKER_ID
    || result.startedAt !== input.invocation.requestedAt
    || result.outcome !== "rendered"
    || result.settlementOutcome !== "rendered"
  ) {
    findings.push(finding("worker-result-custody", "error", result.resultId, "answer worker result differs from invocation, lease, or work-order custody"));
  }
  if (
    !validTime(result.completedAt)
    || Date.parse(result.completedAt) < Date.parse(result.startedAt)
    || Date.parse(result.completedAt) > Date.parse(input.lease.expiresAt)
  ) {
    findings.push(finding("worker-result-time", "error", result.resultId, "answer worker result completion time is outside the lease"));
  }
  const packet = input.workOrder.answerPacket;
  const reference = result.resultReferences[0];
  if (
    !packet
    || result.resultReferences.length !== 1
    || !reference
    || reference.kind !== "reviewed-answer-render"
    || reference.objectId !== `${packet.answerPacketId}:rendered`
    || reference.fingerprint !== packet.renderedTextDigest
    || reference.uri === null
    || result.renderedTextCharacters !== packet.renderedTextCharacters
  ) {
    findings.push(finding("worker-result-render", "error", result.resultId, "answer worker result does not bind the exact reviewed render"));
  } else {
    const target = resolveEstateUri(input.root, reference.uri);
    if (!target || !fs.existsSync(target)) {
      findings.push(finding("worker-result-output", "error", result.resultId, "answer worker output is absent or escapes the estate"));
    } else {
      const rendered = fs.readFileSync(target, "utf8");
      if (
        sha256(rendered) !== reference.fingerprint
        || [...rendered].length !== result.renderedTextCharacters
        || rendered !== renderAsoiafReviewedAnswerPacket(packet)
      ) {
        findings.push(finding("worker-result-output-digest", "error", result.resultId, "answer worker output differs from reviewed packet custody"));
      }
    }
  }
  if (
    result.networkAccess !== "none"
    || result.privateTextAccess !== "none"
    || result.humanReviewAuthority !== "none"
    || result.authority !== "none"
    || result.graphEffect !== "none"
    || result.canonEffect !== "none"
    || result.answerEffect !== "none"
  ) {
    findings.push(finding("worker-result-authority", "error", result.resultId, "answer worker result acquired review, acquisition, graph, canon, or answer authority"));
  }
  const expectedFingerprint = sha256(resultCore(result));
  if (result.resultFingerprint !== expectedFingerprint) {
    findings.push(finding("worker-result-fingerprint", "error", result.resultId, "answer worker result fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-worker-result", {
    invocationId: result.invocationId,
    resultFingerprint: expectedFingerprint,
  });
  if (result.resultId !== expectedId) {
    findings.push(finding("worker-result-identity", "error", result.resultId, "answer worker result identity is not content addressed"));
  }
  return sortedFindings(findings);
}

function existingRendererLease(input: {
  root: string;
  itemId?: string | null;
  workerId: typeof ASOIAF_REVIEWED_RENDER_WORKER_ID;
  claimedAt: string;
  leaseMilliseconds: number;
}): AsoiafAnswerWorkLease | null {
  const status = readAsoiafAnswerDeskStatus(input.root);
  return status.leases.find(
    (lease) =>
      lease.workerId === input.workerId
      && lease.action === "render-reviewed-answer"
      && lease.claimedAt === input.claimedAt
      && lease.leaseMilliseconds === input.leaseMilliseconds
      && (!input.itemId || lease.itemId === input.itemId),
  ) ?? null;
}

export function runAsoiafAnswerDeskWorker(
  input: AsoiafAnswerDeskWorkerRunInput,
): AsoiafAnswerDeskWorkerRunResult {
  ensureDeskValid(input.root);
  const workerId = input.workerId ?? ASOIAF_REVIEWED_RENDER_WORKER_ID;
  if (workerId !== ASOIAF_REVIEWED_RENDER_WORKER_ID) {
    throw new Error(`unknown automatic answer worker ${workerId}`);
  }
  const plan = planAsoiafAnswerDeskWorkers(input.root);
  const existingLease = existingRendererLease({
    root: input.root,
    itemId: input.itemId,
    workerId,
    claimedAt: input.claimedAt,
    leaseMilliseconds: input.leaseMilliseconds,
  });
  const itemId = existingLease?.itemId
    ?? input.itemId
    ?? plan.nextAutomaticItemId;
  if (!itemId) {
    if (plan.externalAvailableItemIds.length > 0) {
      const assignment = plan.assignments.find(
        (entry) => entry.itemId === plan.externalAvailableItemIds[0],
      );
      throw new Error(
        `next available answer work requires external actor ${assignment?.requiredActor ?? "unknown"}; no automatic item was claimed`,
      );
    }
    throw new Error("answer desk has no available automatic work item");
  }
  const assignment = plan.assignments.find((entry) => entry.itemId === itemId);
  if (!existingLease && (!assignment || !assignment.eligible)) {
    throw new Error(`answer work item ${itemId} is not eligible for the built-in renderer`);
  }
  const claim = claimAsoiafAnswerDeskWork({
    root: input.root,
    itemId,
    workerId,
    claimedAt: input.claimedAt,
    leaseMilliseconds: input.leaseMilliseconds,
    operatorId: input.operatorId ?? `${workerId}:claim`,
  });
  const status = readAsoiafAnswerDeskStatus(input.root);
  const orders = readWorkOrders(input.root, status.workOrders);
  const workOrder = orders.get(claim.lease.workOrderId);
  if (!workOrder) {
    throw new Error(`answer worker lease work order ${claim.lease.workOrderId} is absent`);
  }
  const invocation = buildAsoiafAnswerWorkerInvocation({
    lease: claim.lease,
    workOrder,
    requestedAt: input.requestedAt ?? input.claimedAt,
  });
  const invocationRecord = persistAsoiafAnswerWorkerInvocation(
    input.root,
    invocation,
  );
  const execution = executeAsoiafAnswerWorkerInvocation({
    root: input.root,
    invocation,
    lease: claim.lease,
    workOrder,
    completedAt: input.completedAt,
  });
  const paths = asoiafAnswerDeskWorkerPaths(input.root);
  const resultUri = relativeUri(input.root, resultPath(paths, execution.result));
  const resultReferences: AsoiafAnswerWorkResultReference[] = [
    {
      kind: "answer-worker-result",
      objectId: execution.result.resultId,
      fingerprint: execution.result.resultFingerprint,
      uri: resultUri,
    },
    ...execution.result.resultReferences,
  ];
  const settlement = settleAsoiafAnswerDeskWork({
    root: input.root,
    leaseId: claim.lease.leaseId,
    completedAt: input.completedAt,
    outcome: "rendered",
    resultReferences,
    reason: execution.result.reason,
    operatorId: input.operatorId ?? `${workerId}:settle`,
  });
  return {
    plan,
    claim,
    invocation,
    invocationReplayed: invocationRecord.replayed,
    result: execution.result,
    resultReplayed: execution.replayed,
    settlement,
  };
}

export function readAsoiafAnswerDeskWorkerStatus(
  root: string,
): AsoiafAnswerDeskWorkerStatus {
  return {
    paths: asoiafAnswerDeskWorkerPaths(root),
    manifest: buildAsoiafAnswerWorkerManifest(),
    plan: planAsoiafAnswerDeskWorkers(root),
    invocations: listJson<AsoiafAnswerWorkerInvocation>(
      asoiafAnswerDeskWorkerPaths(root).invocations,
    ),
    results: listJson<AsoiafAnswerWorkerResult>(
      asoiafAnswerDeskWorkerPaths(root).results,
    ),
  };
}

export function verifyAsoiafAnswerDeskWorkerEstate(
  root: string,
): AsoiafAnswerDeskWorkerFinding[] {
  const findings: AsoiafAnswerDeskWorkerFinding[] = [];
  for (const entry of verifyAsoiafAnswerDeskEstate(root)) {
    findings.push(finding(`desk:${entry.code}`, entry.severity, entry.subjectId, entry.detail));
  }
  const manifest = buildAsoiafAnswerWorkerManifest();
  findings.push(...validateAsoiafAnswerWorkerManifest(manifest));
  let status: ReturnType<typeof readAsoiafAnswerDeskStatus>;
  let workerStatus: AsoiafAnswerDeskWorkerStatus;
  try {
    status = readAsoiafAnswerDeskStatus(root);
    workerStatus = readAsoiafAnswerDeskWorkerStatus(root);
  } catch (error) {
    findings.push(finding("worker-estate-read", "error", path.resolve(root), error instanceof Error ? error.message : String(error)));
    return sortedFindings(findings);
  }
  const orders = readWorkOrders(root, status.workOrders);
  const leasesById = new Map(
    status.leases.map((lease) => [lease.leaseId, lease] as const),
  );
  const invocationsById = new Map<string, AsoiafAnswerWorkerInvocation>();
  const invocationLeaseIds = new Set<string>();
  for (const invocation of workerStatus.invocations) {
    if (invocationsById.has(invocation.invocationId)) {
      findings.push(finding("worker-invocation-duplicate", "error", invocation.invocationId, "answer worker invocation identity is duplicated"));
    }
    invocationsById.set(invocation.invocationId, invocation);
    if (invocationLeaseIds.has(invocation.leaseId)) {
      findings.push(finding("worker-invocation-lease-duplicate", "error", invocation.leaseId, "answer worker lease has multiple invocation files"));
    }
    invocationLeaseIds.add(invocation.leaseId);
    const lease = leasesById.get(invocation.leaseId);
    const workOrder = orders.get(invocation.workOrderId);
    if (!lease || !workOrder) {
      findings.push(finding("worker-invocation-custody", "error", invocation.invocationId, "answer worker invocation references an absent lease or work order"));
      continue;
    }
    findings.push(...validateAsoiafAnswerWorkerInvocation(
      invocation,
      { lease, workOrder },
    ));
  }
  const resultsByInvocation = new Map<string, AsoiafAnswerWorkerResult>();
  for (const result of workerStatus.results) {
    if (resultsByInvocation.has(result.invocationId)) {
      findings.push(finding("worker-result-invocation-duplicate", "error", result.invocationId, "answer worker invocation has multiple results"));
    }
    resultsByInvocation.set(result.invocationId, result);
    const invocation = invocationsById.get(result.invocationId);
    const lease = leasesById.get(result.leaseId);
    const workOrder = orders.get(result.workOrderId);
    if (!invocation || !lease || !workOrder) {
      findings.push(finding("worker-result-custody-missing", "error", result.resultId, "answer worker result references an absent invocation, lease, or work order"));
      continue;
    }
    findings.push(...validateAsoiafAnswerWorkerResult(
      result,
      { root, invocation, lease, workOrder },
    ));
    const settlement = status.settlements.find(
      (entry) => entry.leaseId === result.leaseId,
    );
    const resultPathUri = relativeUri(
      root,
      resultPath(workerStatus.paths, result),
    );
    if (
      !settlement
      || settlement.outcome !== "rendered"
      || !settlement.resultReferences.some(
        (reference) =>
          reference.kind === "answer-worker-result"
          && reference.objectId === result.resultId
          && reference.fingerprint === result.resultFingerprint
          && reference.uri === resultPathUri,
      )
      || !result.resultReferences.every((expected) =>
        settlement.resultReferences.some((reference) =>
          JSON.stringify(reference) === JSON.stringify(expected),
        ),
      )
    ) {
      findings.push(finding("worker-result-settlement", "error", result.resultId, "answer worker result is not bound by the exact rendered settlement"));
    }
  }
  for (const invocation of workerStatus.invocations) {
    if (!resultsByInvocation.has(invocation.invocationId)) {
      findings.push(finding("worker-invocation-pending", "warning", invocation.invocationId, "answer worker invocation has no retained result"));
    }
  }
  for (const settlement of status.settlements) {
    if (
      settlement.workerId === ASOIAF_REVIEWED_RENDER_WORKER_ID
      && settlement.outcome === "rendered"
      && !workerStatus.results.some((result) => result.leaseId === settlement.leaseId)
    ) {
      findings.push(finding("worker-settlement-result-missing", "error", settlement.settlementId, "built-in renderer settlement lacks its content-addressed result"));
    }
  }
  const resultOutputUris = new Set(
    workerStatus.results.flatMap((result) =>
      result.resultReferences
        .map((reference) => reference.uri)
        .filter((uri): uri is string => uri !== null),
    ),
  );
  if (fs.existsSync(workerStatus.paths.outputs)) {
    for (const name of fs.readdirSync(workerStatus.paths.outputs).sort()) {
      if (!/^[a-f0-9]{64}\.txt$/.test(name)) {
        findings.push(finding("worker-output-name", "error", name, "answer worker output filename is not a SHA-256 digest"));
        continue;
      }
      const uri = relativeUri(root, path.join(workerStatus.paths.outputs, name));
      if (!resultOutputUris.has(uri)) {
        findings.push(finding("worker-output-orphan", "warning", uri, "answer worker output is not referenced by a result"));
      }
    }
  }
  return sortedFindings(findings);
}
