import fs from "node:fs";
import path from "node:path";
import {
  collectorContentId,
  sha256,
} from "./asoiaf-external-estate.js";
import {
  readAsoiafAnswerDeskStatus,
  type AsoiafAnswerDeskSettleResult,
} from "./asoiaf-answer-desk-estate.js";
import {
  ASOIAF_REVIEWED_RENDER_WORKER_ID,
  asoiafAnswerDeskWorkerPaths,
  planAsoiafAnswerDeskWorkers,
  readAsoiafAnswerDeskWorkerStatus,
  runAsoiafAnswerDeskWorker,
  verifyAsoiafAnswerDeskWorkerEstate,
  type AsoiafAnswerDeskWorkerRunResult,
  type AsoiafAnswerWorkerAssignment,
  type AsoiafAnswerWorkerPlan,
  type AsoiafAnswerWorkerRequiredActor,
} from "./asoiaf-answer-desk-worker.js";
import {
  asoiafAnswerExchangePaths,
  issueAsoiafAnswerExchangeAssignment,
  readAsoiafAnswerExchangeStatus,
  verifyAsoiafAnswerExchangeEstate,
  type AsoiafAnswerExchangeActorRole,
  type AsoiafAnswerExchangeAssignment,
  type AsoiafAnswerExchangeIssueResult,
} from "./asoiaf-answer-desk-exchange.js";

export const ASOIAF_ANSWER_SUPERVISOR_ACTOR_BINDING_FORMAT =
  "axm-asoiaf-answer-supervisor-actor-binding/1" as const;
export const ASOIAF_ANSWER_SUPERVISOR_POLICY_FORMAT =
  "axm-asoiaf-answer-supervisor-policy/1" as const;
export const ASOIAF_ANSWER_SUPERVISOR_PROJECTION_FORMAT =
  "axm-asoiaf-answer-supervisor-projection/1" as const;
export const ASOIAF_ANSWER_SUPERVISOR_INTENT_FORMAT =
  "axm-asoiaf-answer-supervisor-intent/1" as const;
export const ASOIAF_ANSWER_SUPERVISOR_RUN_FORMAT =
  "axm-asoiaf-answer-supervisor-run/1" as const;

const MIN_LEASE_MILLISECONDS = 1_000;
const MAX_LEASE_MILLISECONDS = 86_400_000;
const MAX_BINDING_CAPACITY = 32;
const MAX_BINDING_PRIORITY = 10_000;
const MAX_REQUEST_KEY_CHARACTERS = 240;

const EXTERNAL_ACTOR_ROLES = new Set<AsoiafAnswerExchangeActorRole>([
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
]);

export type AsoiafAnswerSupervisorDecisionKind =
  | "run-automatic"
  | "issue-external"
  | "wait-external"
  | "unbound-external"
  | "saturated-external"
  | "automatic-disabled"
  | "idle";

export type AsoiafAnswerSupervisorRunOutcome =
  | "automatic-rendered"
  | "external-issued"
  | "waiting-external"
  | "unbound-external"
  | "saturated-external"
  | "automatic-disabled"
  | "idle";

export interface AsoiafAnswerSupervisorActorBindingInput {
  actorRole: AsoiafAnswerExchangeActorRole;
  actorId: string;
  enabled?: boolean;
  capacity?: number;
  leaseMilliseconds: number;
  priority?: number;
}

export interface AsoiafAnswerSupervisorActorBinding {
  format: typeof ASOIAF_ANSWER_SUPERVISOR_ACTOR_BINDING_FORMAT;
  bindingId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  actorId: string;
  enabled: boolean;
  capacity: number;
  leaseMilliseconds: number;
  priority: number;
  transport: "answer-exchange-files";
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  bindingFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerSupervisorPolicyInput {
  createdBy: string;
  createdAt: string;
  automaticWorkerEnabled?: boolean;
  automaticLeaseMilliseconds?: number;
  actorBindings?: AsoiafAnswerSupervisorActorBindingInput[];
}

export interface AsoiafAnswerSupervisorPolicy {
  format: typeof ASOIAF_ANSWER_SUPERVISOR_POLICY_FORMAT;
  policyId: string;
  createdBy: string;
  createdAt: string;
  automaticWorkerId: typeof ASOIAF_REVIEWED_RENDER_WORKER_ID;
  automaticWorkerEnabled: boolean;
  automaticLeaseMilliseconds: number;
  actorBindings: AsoiafAnswerSupervisorActorBinding[];
  selectionPolicy: "work-order-order-then-binding-priority";
  leasePolicy: "claim-only-on-dispatch";
  transportPolicy: "local-content-addressed-files";
  networkAccess: "none";
  privateTextAccess: "none";
  humanReviewAuthority: "none";
  acquisitionAuthority: "none";
  reconciliationAuthority: "none";
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  policyFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerSupervisorActiveAssignment {
  assignmentId: string;
  assignmentFingerprint: `sha256:${string}`;
  leaseId: string;
  leaseFingerprint: `sha256:${string}`;
  itemId: string;
  action: AsoiafAnswerExchangeAssignment["action"];
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  expiresAt: string;
}

export interface AsoiafAnswerSupervisorActorLoad {
  bindingId: string;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  enabled: boolean;
  capacity: number;
  activeAssignmentIds: string[];
  activeCount: number;
  availableSlots: number;
}

export interface AsoiafAnswerSupervisorDecision {
  kind: AsoiafAnswerSupervisorDecisionKind;
  itemId: string | null;
  itemFingerprint: `sha256:${string}` | null;
  action: AsoiafAnswerWorkerAssignment["action"] | null;
  actorBindingId: string | null;
  actorId: string | null;
  actorRole: AsoiafAnswerWorkerRequiredActor | null;
  leaseMilliseconds: number | null;
  reason: string;
}

export interface AsoiafAnswerSupervisorProjection {
  format: typeof ASOIAF_ANSWER_SUPERVISOR_PROJECTION_FORMAT;
  projectionId: string;
  estateId: string;
  policy: AsoiafAnswerSupervisorPolicy;
  policyFingerprint: `sha256:${string}`;
  workerPlan: AsoiafAnswerWorkerPlan;
  workerPlanFingerprint: `sha256:${string}`;
  activeExternalAssignments: AsoiafAnswerSupervisorActiveAssignment[];
  actorLoads: AsoiafAnswerSupervisorActorLoad[];
  automaticAvailableItemIds: string[];
  externalAvailableItemIds: string[];
  unboundExternalItemIds: string[];
  saturatedExternalItemIds: string[];
  automaticDisabledItemIds: string[];
  dependencyBlockedItemIds: string[];
  decision: AsoiafAnswerSupervisorDecision;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  projectionFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerSupervisorTickInput {
  root: string;
  requestKey: string;
  policy: AsoiafAnswerSupervisorPolicy;
  requestedAt: string;
  automaticCompletedAt?: string | null;
  operatorId?: string;
}

export interface AsoiafAnswerSupervisorIntent {
  format: typeof ASOIAF_ANSWER_SUPERVISOR_INTENT_FORMAT;
  intentId: string;
  requestKey: string;
  requestFingerprint: `sha256:${string}`;
  estateId: string;
  policy: AsoiafAnswerSupervisorPolicy;
  policyFingerprint: `sha256:${string}`;
  beforeProjection: AsoiafAnswerSupervisorProjection;
  beforeProjectionFingerprint: `sha256:${string}`;
  beforeWorkOrderId: string;
  beforeWorkOrderFingerprint: `sha256:${string}`;
  beforeStateId: string;
  beforeStateFingerprint: `sha256:${string}`;
  decision: AsoiafAnswerSupervisorDecision;
  requestedAt: string;
  automaticCompletedAt: string | null;
  operatorId: string;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  intentFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerSupervisorOperationReference {
  kind:
    | "answer-exchange-assignment"
    | "answer-worker-invocation"
    | "answer-worker-result"
    | "reviewed-answer-render"
    | "answer-work-settlement";
  objectId: string;
  fingerprint: `sha256:${string}`;
  uri: string | null;
}

export interface AsoiafAnswerSupervisorRun {
  format: typeof ASOIAF_ANSWER_SUPERVISOR_RUN_FORMAT;
  runId: string;
  intentId: string;
  intentFingerprint: `sha256:${string}`;
  requestKey: string;
  requestFingerprint: `sha256:${string}`;
  estateId: string;
  decisionKind: AsoiafAnswerSupervisorDecisionKind;
  outcome: AsoiafAnswerSupervisorRunOutcome;
  startedAt: string;
  completedAt: string;
  beforeProjectionFingerprint: `sha256:${string}`;
  afterProjection: AsoiafAnswerSupervisorProjection;
  afterProjectionFingerprint: `sha256:${string}`;
  beforeWorkOrderId: string;
  afterWorkOrderId: string;
  beforeStateFingerprint: `sha256:${string}`;
  afterStateFingerprint: `sha256:${string}`;
  itemId: string | null;
  action: AsoiafAnswerWorkerAssignment["action"] | null;
  actorId: string | null;
  actorRole: AsoiafAnswerWorkerRequiredActor | null;
  leaseId: string | null;
  settlementId: string | null;
  operationReferences: AsoiafAnswerSupervisorOperationReference[];
  operationReplayed: boolean;
  reason: string;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  runFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerSupervisorPaths {
  root: string;
  supervisorRoot: string;
  intents: string;
  runs: string;
}

export interface AsoiafAnswerSupervisorPrepareResult {
  projection: AsoiafAnswerSupervisorProjection;
  intent: AsoiafAnswerSupervisorIntent;
  intentUri: string;
  replayed: boolean;
}

export interface AsoiafAnswerSupervisorTickResult {
  intent: AsoiafAnswerSupervisorIntent;
  intentReplayed: boolean;
  run: AsoiafAnswerSupervisorRun;
  runReplayed: boolean;
  externalIssue: AsoiafAnswerExchangeIssueResult | null;
  automaticRun: AsoiafAnswerDeskWorkerRunResult | null;
}

export interface AsoiafAnswerSupervisorStatus {
  paths: AsoiafAnswerSupervisorPaths;
  projection: AsoiafAnswerSupervisorProjection | null;
  intents: AsoiafAnswerSupervisorIntent[];
  runs: AsoiafAnswerSupervisorRun[];
  pendingIntentIds: string[];
}

export interface AsoiafAnswerSupervisorFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

function finding(
  code: string,
  severity: AsoiafAnswerSupervisorFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafAnswerSupervisorFinding {
  return { code, severity, subjectId, detail };
}

function sortedFindings(
  findings: readonly AsoiafAnswerSupervisorFinding[],
): AsoiafAnswerSupervisorFinding[] {
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

function validLeaseMilliseconds(value: number): boolean {
  return Number.isSafeInteger(value)
    && value >= MIN_LEASE_MILLISECONDS
    && value <= MAX_LEASE_MILLISECONDS;
}

function normalizedOperatorId(value: string | undefined): string {
  return value?.trim() || "asoiaf-answer-supervisor";
}

function bindingCore(
  binding: AsoiafAnswerSupervisorActorBinding,
): Omit<
  AsoiafAnswerSupervisorActorBinding,
  "bindingId" | "bindingFingerprint"
> {
  const {
    bindingId: _bindingId,
    bindingFingerprint: _bindingFingerprint,
    ...core
  } = binding;
  return core;
}

function buildActorBinding(
  input: AsoiafAnswerSupervisorActorBindingInput,
): AsoiafAnswerSupervisorActorBinding {
  const actorId = input.actorId.trim();
  if (!actorId) throw new Error("answer supervisor actor identity is required");
  if (!EXTERNAL_ACTOR_ROLES.has(input.actorRole)) {
    throw new Error("answer supervisor actor role is not an external answer role");
  }
  const capacity = input.capacity ?? 1;
  const priority = input.priority ?? 100;
  if (
    !Number.isSafeInteger(capacity)
    || capacity < 1
    || capacity > MAX_BINDING_CAPACITY
  ) {
    throw new Error("answer supervisor actor capacity is outside the bounded range");
  }
  if (
    !Number.isSafeInteger(priority)
    || priority < 0
    || priority > MAX_BINDING_PRIORITY
  ) {
    throw new Error("answer supervisor actor priority is outside the bounded range");
  }
  if (!validLeaseMilliseconds(input.leaseMilliseconds)) {
    throw new Error("answer supervisor actor lease duration is outside the bounded range");
  }
  const core = {
    format: ASOIAF_ANSWER_SUPERVISOR_ACTOR_BINDING_FORMAT,
    actorRole: input.actorRole,
    actorId,
    enabled: input.enabled ?? true,
    capacity,
    leaseMilliseconds: input.leaseMilliseconds,
    priority,
    transport: "answer-exchange-files" as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const bindingFingerprint = sha256(core);
  return {
    ...core,
    bindingId: collectorContentId("asoiaf-answer-supervisor-binding", {
      actorRole: core.actorRole,
      actorId: core.actorId,
      bindingFingerprint,
    }),
    bindingFingerprint,
  };
}

function policyCore(
  policy: AsoiafAnswerSupervisorPolicy,
): Omit<AsoiafAnswerSupervisorPolicy, "policyId" | "policyFingerprint"> {
  const {
    policyId: _policyId,
    policyFingerprint: _policyFingerprint,
    ...core
  } = policy;
  return core;
}

export function buildAsoiafAnswerSupervisorPolicy(
  input: AsoiafAnswerSupervisorPolicyInput,
): AsoiafAnswerSupervisorPolicy {
  const createdBy = input.createdBy.trim();
  if (!createdBy || !validTime(input.createdAt)) {
    throw new Error("answer supervisor policy requires a creator and valid creation time");
  }
  const automaticLeaseMilliseconds = input.automaticLeaseMilliseconds ?? 60_000;
  if (!validLeaseMilliseconds(automaticLeaseMilliseconds)) {
    throw new Error("answer supervisor automatic lease duration is outside the bounded range");
  }
  const bindings = (input.actorBindings ?? []).map(buildActorBinding).sort(
    (left, right) =>
      left.actorRole.localeCompare(right.actorRole)
      || left.priority - right.priority
      || left.actorId.localeCompare(right.actorId)
      || left.bindingId.localeCompare(right.bindingId),
  );
  const bindingKeys = new Set<string>();
  for (const binding of bindings) {
    const key = `${binding.actorRole}\u0000${binding.actorId}`;
    if (bindingKeys.has(key)) {
      throw new Error(`answer supervisor actor binding ${key} is duplicated`);
    }
    bindingKeys.add(key);
  }
  const core = {
    format: ASOIAF_ANSWER_SUPERVISOR_POLICY_FORMAT,
    createdBy,
    createdAt: input.createdAt,
    automaticWorkerId: ASOIAF_REVIEWED_RENDER_WORKER_ID,
    automaticWorkerEnabled: input.automaticWorkerEnabled ?? true,
    automaticLeaseMilliseconds,
    actorBindings: bindings,
    selectionPolicy: "work-order-order-then-binding-priority" as const,
    leasePolicy: "claim-only-on-dispatch" as const,
    transportPolicy: "local-content-addressed-files" as const,
    networkAccess: "none" as const,
    privateTextAccess: "none" as const,
    humanReviewAuthority: "none" as const,
    acquisitionAuthority: "none" as const,
    reconciliationAuthority: "none" as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const policyFingerprint = sha256(core);
  const policy: AsoiafAnswerSupervisorPolicy = {
    ...core,
    policyId: collectorContentId("asoiaf-answer-supervisor-policy", {
      createdBy: core.createdBy,
      createdAt: core.createdAt,
      policyFingerprint,
    }),
    policyFingerprint,
  };
  const errors = validateAsoiafAnswerSupervisorPolicy(policy)
    .filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(`invalid answer supervisor policy: ${errors
      .map((entry) => `${entry.code}:${entry.subjectId}`)
      .join(", ")}`);
  }
  return policy;
}

export function validateAsoiafAnswerSupervisorPolicy(
  policy: AsoiafAnswerSupervisorPolicy,
): AsoiafAnswerSupervisorFinding[] {
  const findings: AsoiafAnswerSupervisorFinding[] = [];
  if (
    policy.format !== ASOIAF_ANSWER_SUPERVISOR_POLICY_FORMAT
    || !policy.createdBy.trim()
    || !validTime(policy.createdAt)
    || policy.automaticWorkerId !== ASOIAF_REVIEWED_RENDER_WORKER_ID
  ) {
    findings.push(finding("supervisor-policy-format", "error", policy.policyId, "answer supervisor policy identity or creation custody is invalid"));
  }
  if (!validLeaseMilliseconds(policy.automaticLeaseMilliseconds)) {
    findings.push(finding("supervisor-policy-automatic-lease", "error", policy.policyId, "automatic lease duration is outside the bounded range"));
  }
  const expectedBindings = [...policy.actorBindings].sort(
    (left, right) =>
      left.actorRole.localeCompare(right.actorRole)
      || left.priority - right.priority
      || left.actorId.localeCompare(right.actorId)
      || left.bindingId.localeCompare(right.bindingId),
  );
  if (JSON.stringify(expectedBindings) !== JSON.stringify(policy.actorBindings)) {
    findings.push(finding("supervisor-policy-binding-order", "error", policy.policyId, "actor bindings are not deterministically ordered"));
  }
  const keys = new Set<string>();
  for (const binding of policy.actorBindings) {
    const key = `${binding.actorRole}\u0000${binding.actorId}`;
    if (keys.has(key)) {
      findings.push(finding("supervisor-policy-binding-duplicate", "error", binding.bindingId, "actor role and identity are duplicated"));
    }
    keys.add(key);
    if (
      binding.format !== ASOIAF_ANSWER_SUPERVISOR_ACTOR_BINDING_FORMAT
      || !EXTERNAL_ACTOR_ROLES.has(binding.actorRole)
      || !binding.actorId.trim()
      || !Number.isSafeInteger(binding.capacity)
      || binding.capacity < 1
      || binding.capacity > MAX_BINDING_CAPACITY
      || !validLeaseMilliseconds(binding.leaseMilliseconds)
      || !Number.isSafeInteger(binding.priority)
      || binding.priority < 0
      || binding.priority > MAX_BINDING_PRIORITY
      || binding.transport !== "answer-exchange-files"
      || binding.authority !== "none"
      || binding.graphEffect !== "none"
      || binding.canonEffect !== "none"
      || binding.answerEffect !== "none"
    ) {
      findings.push(finding("supervisor-binding-boundary", "error", binding.bindingId, "actor binding format, capacity, lease, transport, or authority is invalid"));
    }
    const expectedFingerprint = sha256(bindingCore(binding));
    if (binding.bindingFingerprint !== expectedFingerprint) {
      findings.push(finding("supervisor-binding-fingerprint", "error", binding.bindingId, "actor binding fingerprint is stale"));
    }
    const expectedId = collectorContentId("asoiaf-answer-supervisor-binding", {
      actorRole: binding.actorRole,
      actorId: binding.actorId,
      bindingFingerprint: expectedFingerprint,
    });
    if (binding.bindingId !== expectedId) {
      findings.push(finding("supervisor-binding-identity", "error", binding.bindingId, "actor binding identity is not content addressed"));
    }
  }
  if (
    policy.selectionPolicy !== "work-order-order-then-binding-priority"
    || policy.leasePolicy !== "claim-only-on-dispatch"
    || policy.transportPolicy !== "local-content-addressed-files"
    || policy.networkAccess !== "none"
    || policy.privateTextAccess !== "none"
    || policy.humanReviewAuthority !== "none"
    || policy.acquisitionAuthority !== "none"
    || policy.reconciliationAuthority !== "none"
    || policy.authority !== "none"
    || policy.graphEffect !== "none"
    || policy.canonEffect !== "none"
    || policy.answerEffect !== "none"
  ) {
    findings.push(finding("supervisor-policy-authority", "error", policy.policyId, "answer supervisor policy crossed its scheduling-only boundary"));
  }
  const expectedFingerprint = sha256(policyCore(policy));
  if (policy.policyFingerprint !== expectedFingerprint) {
    findings.push(finding("supervisor-policy-fingerprint", "error", policy.policyId, "answer supervisor policy fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-supervisor-policy", {
    createdBy: policy.createdBy,
    createdAt: policy.createdAt,
    policyFingerprint: expectedFingerprint,
  });
  if (policy.policyId !== expectedId) {
    findings.push(finding("supervisor-policy-identity", "error", policy.policyId, "answer supervisor policy identity is not content addressed"));
  }
  return sortedFindings(findings);
}

export function asoiafAnswerSupervisorPaths(
  root: string,
): AsoiafAnswerSupervisorPaths {
  const absolute = path.resolve(root);
  const supervisorRoot = path.join(absolute, "answer-supervisor");
  return {
    root: absolute,
    supervisorRoot,
    intents: path.join(supervisorRoot, "intents"),
    runs: path.join(supervisorRoot, "runs"),
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
      throw new Error(`answer supervisor immutable file collision at ${target}`);
    }
    return true;
  }
}

function workerAssignmentCore(
  assignment: AsoiafAnswerWorkerAssignment,
): Omit<AsoiafAnswerWorkerAssignment, "assignmentId" | "assignmentFingerprint"> {
  const {
    assignmentId: _assignmentId,
    assignmentFingerprint: _assignmentFingerprint,
    ...core
  } = assignment;
  return core;
}

function workerPlanCore(
  plan: AsoiafAnswerWorkerPlan,
): Omit<AsoiafAnswerWorkerPlan, "planId" | "planFingerprint"> {
  const { planId: _planId, planFingerprint: _planFingerprint, ...core } = plan;
  return core;
}

function validateWorkerPlanSnapshot(
  plan: AsoiafAnswerWorkerPlan,
): AsoiafAnswerSupervisorFinding[] {
  const findings: AsoiafAnswerSupervisorFinding[] = [];
  for (const assignment of plan.assignments) {
    const expectedFingerprint = sha256(workerAssignmentCore(assignment));
    if (assignment.assignmentFingerprint !== expectedFingerprint) {
      findings.push(finding("supervisor-plan-assignment-fingerprint", "error", assignment.assignmentId, "embedded worker assignment fingerprint is stale"));
    }
    const expectedId = collectorContentId("asoiaf-answer-worker-assignment", {
      workOrderId: assignment.workOrderId,
      itemKey: assignment.itemKey,
      stateFingerprint: assignment.stateFingerprint,
      assignmentFingerprint: expectedFingerprint,
    });
    if (assignment.assignmentId !== expectedId) {
      findings.push(finding("supervisor-plan-assignment-identity", "error", assignment.assignmentId, "embedded worker assignment identity is not content addressed"));
    }
  }
  const expectedFingerprint = sha256(workerPlanCore(plan));
  if (plan.planFingerprint !== expectedFingerprint) {
    findings.push(finding("supervisor-plan-fingerprint", "error", plan.planId, "embedded worker plan fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-worker-plan", {
    estateId: plan.estateId,
    workOrderId: plan.workOrderId,
    stateFingerprint: plan.stateFingerprint,
    planFingerprint: expectedFingerprint,
  });
  if (plan.planId !== expectedId) {
    findings.push(finding("supervisor-plan-identity", "error", plan.planId, "embedded worker plan identity is not content addressed"));
  }
  return sortedFindings(findings);
}

function ensureSupervisorBaseValid(root: string): void {
  const errors = verifyAsoiafAnswerExchangeEstate(root)
    .filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(`invalid answer exchange estate: ${errors
      .map((entry) => `${entry.code}:${entry.subjectId}`)
      .join(", ")}`);
  }
}

function activeExternalAssignments(
  root: string,
): AsoiafAnswerSupervisorActiveAssignment[] {
  const desk = readAsoiafAnswerDeskStatus(root);
  const exchange = readAsoiafAnswerExchangeStatus(root);
  const activeLeaseIds = new Set(desk.state.activeLeaseIds);
  return exchange.assignments
    .filter((assignment) => activeLeaseIds.has(assignment.leaseId))
    .map((assignment) => ({
      assignmentId: assignment.assignmentId,
      assignmentFingerprint: assignment.assignmentFingerprint,
      leaseId: assignment.leaseId,
      leaseFingerprint: assignment.leaseFingerprint,
      itemId: assignment.itemId,
      action: assignment.action,
      actorId: assignment.actorId,
      actorRole: assignment.actorRole,
      expiresAt: assignment.expiresAt,
    }))
    .sort(
      (left, right) =>
        left.actorRole.localeCompare(right.actorRole)
        || left.actorId.localeCompare(right.actorId)
        || left.assignmentId.localeCompare(right.assignmentId),
    );
}

function actorLoads(
  policy: AsoiafAnswerSupervisorPolicy,
  activeAssignments: readonly AsoiafAnswerSupervisorActiveAssignment[],
): AsoiafAnswerSupervisorActorLoad[] {
  return policy.actorBindings.map((binding) => {
    const activeAssignmentIds = activeAssignments
      .filter(
        (assignment) =>
          assignment.actorRole === binding.actorRole
          && assignment.actorId === binding.actorId,
      )
      .map((assignment) => assignment.assignmentId)
      .sort();
    return {
      bindingId: binding.bindingId,
      actorId: binding.actorId,
      actorRole: binding.actorRole,
      enabled: binding.enabled,
      capacity: binding.capacity,
      activeAssignmentIds,
      activeCount: activeAssignmentIds.length,
      availableSlots: binding.enabled
        ? Math.max(0, binding.capacity - activeAssignmentIds.length)
        : 0,
    };
  });
}

function selectDecision(input: {
  policy: AsoiafAnswerSupervisorPolicy;
  workerPlan: AsoiafAnswerWorkerPlan;
  activeAssignments: readonly AsoiafAnswerSupervisorActiveAssignment[];
  loads: readonly AsoiafAnswerSupervisorActorLoad[];
}): {
  decision: AsoiafAnswerSupervisorDecision;
  unboundExternalItemIds: string[];
  saturatedExternalItemIds: string[];
  automaticDisabledItemIds: string[];
  dependencyBlockedItemIds: string[];
} {
  const unboundExternalItemIds: string[] = [];
  const saturatedExternalItemIds: string[] = [];
  const automaticDisabledItemIds: string[] = [];
  const dependencyBlockedItemIds: string[] = [];
  const assignmentsById = new Map(
    input.workerPlan.assignments.map((assignment) => [assignment.itemId, assignment] as const),
  );

  for (const assignment of input.workerPlan.assignments) {
    if (assignment.deskStatus !== "available") continue;
    const dependenciesSatisfied = assignment.dependencyItemIds.every(
      (dependencyItemId) => {
        const dependency = assignmentsById.get(dependencyItemId);
        return Boolean(
          dependency
          && (
            dependency.itemStatus === "satisfied"
            || dependency.itemStatus === "preserved-as-limitation"
          )
        );
      },
    );
    if (!dependenciesSatisfied) {
      dependencyBlockedItemIds.push(assignment.itemId);
      continue;
    }
    if (assignment.executionMode === "automatic") {
      if (assignment.eligible && input.policy.automaticWorkerEnabled) {
        return {
          decision: {
            kind: "run-automatic",
            itemId: assignment.itemId,
            itemFingerprint: assignment.itemFingerprint,
            action: assignment.action,
            actorBindingId: null,
            actorId: ASOIAF_REVIEWED_RENDER_WORKER_ID,
            actorRole: "reviewed-renderer",
            leaseMilliseconds: input.policy.automaticLeaseMilliseconds,
            reason:
              "The first available work-order assignment is covered by the bounded automatic renderer and may be claimed only at execution time.",
          },
          unboundExternalItemIds,
          saturatedExternalItemIds,
          automaticDisabledItemIds,
          dependencyBlockedItemIds,
        };
      }
      automaticDisabledItemIds.push(assignment.itemId);
      continue;
    }

    const bindings = input.policy.actorBindings.filter(
      (binding) =>
        binding.enabled
        && binding.actorRole === assignment.requiredActor,
    );
    if (bindings.length === 0) {
      unboundExternalItemIds.push(assignment.itemId);
      continue;
    }
    const availableBinding = bindings.find((binding) =>
      input.loads.find((load) => load.bindingId === binding.bindingId)!.availableSlots > 0,
    );
    if (availableBinding) {
      return {
        decision: {
          kind: "issue-external",
          itemId: assignment.itemId,
          itemFingerprint: assignment.itemFingerprint,
          action: assignment.action,
          actorBindingId: availableBinding.bindingId,
          actorId: availableBinding.actorId,
          actorRole: availableBinding.actorRole,
          leaseMilliseconds: availableBinding.leaseMilliseconds,
          reason:
            "The first dispatchable external assignment has a matching enabled actor binding with available capacity; its lease will be created only with the assignment bundle.",
        },
        unboundExternalItemIds,
        saturatedExternalItemIds,
        automaticDisabledItemIds,
        dependencyBlockedItemIds,
      };
    }
    saturatedExternalItemIds.push(assignment.itemId);
  }

  const firstAvailable = input.workerPlan.assignments.find(
    (assignment) => assignment.deskStatus === "available",
  );
  if (unboundExternalItemIds.length > 0) {
    const assignment = input.workerPlan.assignments.find(
      (entry) => entry.itemId === unboundExternalItemIds[0],
    )!;
    return {
      decision: {
        kind: "unbound-external",
        itemId: assignment.itemId,
        itemFingerprint: assignment.itemFingerprint,
        action: assignment.action,
        actorBindingId: null,
        actorId: null,
        actorRole: assignment.requiredActor,
        leaseMilliseconds: null,
        reason: `Available external work requires ${assignment.requiredActor}, but the supervisor policy has no enabled binding for that role.`,
      },
      unboundExternalItemIds,
      saturatedExternalItemIds,
      automaticDisabledItemIds,
      dependencyBlockedItemIds,
    };
  }
  if (saturatedExternalItemIds.length > 0) {
    const assignment = input.workerPlan.assignments.find(
      (entry) => entry.itemId === saturatedExternalItemIds[0],
    )!;
    return {
      decision: {
        kind: "saturated-external",
        itemId: assignment.itemId,
        itemFingerprint: assignment.itemFingerprint,
        action: assignment.action,
        actorBindingId: null,
        actorId: null,
        actorRole: assignment.requiredActor,
        leaseMilliseconds: null,
        reason: `Available external work requires ${assignment.requiredActor}, but every enabled binding for that role is at capacity.`,
      },
      unboundExternalItemIds,
      saturatedExternalItemIds,
      automaticDisabledItemIds,
      dependencyBlockedItemIds,
    };
  }
  if (automaticDisabledItemIds.length > 0) {
    const assignment = input.workerPlan.assignments.find(
      (entry) => entry.itemId === automaticDisabledItemIds[0],
    )!;
    return {
      decision: {
        kind: "automatic-disabled",
        itemId: assignment.itemId,
        itemFingerprint: assignment.itemFingerprint,
        action: assignment.action,
        actorBindingId: null,
        actorId: ASOIAF_REVIEWED_RENDER_WORKER_ID,
        actorRole: "reviewed-renderer",
        leaseMilliseconds: null,
        reason:
          "Automatic work is available, but the supervisor policy has disabled the bounded renderer.",
      },
      unboundExternalItemIds,
      saturatedExternalItemIds,
      automaticDisabledItemIds,
      dependencyBlockedItemIds,
    };
  }
  if (input.activeAssignments.length > 0) {
    const pending = input.activeAssignments[0]!;
    return {
      decision: {
        kind: "wait-external",
        itemId: pending.itemId,
        itemFingerprint: null,
        action: pending.action,
        actorBindingId: null,
        actorId: pending.actorId,
        actorRole: pending.actorRole,
        leaseMilliseconds: null,
        reason:
          "No further work is dispatchable while one or more externally leased assignments remain active.",
      },
      unboundExternalItemIds,
      saturatedExternalItemIds,
      automaticDisabledItemIds,
      dependencyBlockedItemIds,
    };
  }
  return {
    decision: {
      kind: "idle",
      itemId: firstAvailable?.itemId ?? null,
      itemFingerprint: firstAvailable?.itemFingerprint ?? null,
      action: firstAvailable?.action ?? null,
      actorBindingId: null,
      actorId: null,
      actorRole: firstAvailable?.requiredActor ?? null,
      leaseMilliseconds: null,
      reason:
        "The verified answer desk exposes no dispatchable automatic or external work and has no active external assignment.",
    },
    unboundExternalItemIds,
    saturatedExternalItemIds,
    automaticDisabledItemIds,
    dependencyBlockedItemIds,
  };
}

function projectionCore(
  projection: AsoiafAnswerSupervisorProjection,
): Omit<AsoiafAnswerSupervisorProjection, "projectionId" | "projectionFingerprint"> {
  const {
    projectionId: _projectionId,
    projectionFingerprint: _projectionFingerprint,
    ...core
  } = projection;
  return core;
}

export function planAsoiafAnswerDeskSupervisor(input: {
  root: string;
  policy: AsoiafAnswerSupervisorPolicy;
}): AsoiafAnswerSupervisorProjection {
  ensureSupervisorBaseValid(input.root);
  const policyErrors = validateAsoiafAnswerSupervisorPolicy(input.policy)
    .filter((entry) => entry.severity === "error");
  if (policyErrors.length > 0) {
    throw new Error(`invalid answer supervisor policy ${input.policy.policyId}`);
  }
  const workerPlan = planAsoiafAnswerDeskWorkers(input.root);
  const activeAssignments = activeExternalAssignments(input.root);
  const loads = actorLoads(input.policy, activeAssignments);
  const selected = selectDecision({
    policy: input.policy,
    workerPlan,
    activeAssignments,
    loads,
  });
  const core = {
    format: ASOIAF_ANSWER_SUPERVISOR_PROJECTION_FORMAT,
    estateId: workerPlan.estateId,
    policy: input.policy,
    policyFingerprint: input.policy.policyFingerprint,
    workerPlan,
    workerPlanFingerprint: workerPlan.planFingerprint,
    activeExternalAssignments: activeAssignments,
    actorLoads: loads,
    automaticAvailableItemIds: [...workerPlan.automaticAvailableItemIds],
    externalAvailableItemIds: [...workerPlan.externalAvailableItemIds],
    unboundExternalItemIds: selected.unboundExternalItemIds,
    saturatedExternalItemIds: selected.saturatedExternalItemIds,
    automaticDisabledItemIds: selected.automaticDisabledItemIds,
    dependencyBlockedItemIds: selected.dependencyBlockedItemIds,
    decision: selected.decision,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const projectionFingerprint = sha256(core);
  return {
    ...core,
    projectionId: collectorContentId("asoiaf-answer-supervisor-projection", {
      estateId: core.estateId,
      policyFingerprint: core.policyFingerprint,
      workerPlanFingerprint: core.workerPlanFingerprint,
      projectionFingerprint,
    }),
    projectionFingerprint,
  };
}

export function validateAsoiafAnswerSupervisorProjection(
  projection: AsoiafAnswerSupervisorProjection,
): AsoiafAnswerSupervisorFinding[] {
  const findings = [
    ...validateAsoiafAnswerSupervisorPolicy(projection.policy),
    ...validateWorkerPlanSnapshot(projection.workerPlan),
  ];
  if (
    projection.format !== ASOIAF_ANSWER_SUPERVISOR_PROJECTION_FORMAT
    || projection.estateId !== projection.workerPlan.estateId
    || projection.policyFingerprint !== projection.policy.policyFingerprint
    || projection.workerPlanFingerprint !== projection.workerPlan.planFingerprint
  ) {
    findings.push(finding("supervisor-projection-custody", "error", projection.projectionId, "supervisor projection differs from its policy or worker-plan custody"));
  }
  const expectedLoads = actorLoads(
    projection.policy,
    projection.activeExternalAssignments,
  );
  const selected = selectDecision({
    policy: projection.policy,
    workerPlan: projection.workerPlan,
    activeAssignments: projection.activeExternalAssignments,
    loads: expectedLoads,
  });
  if (
    JSON.stringify(projection.actorLoads) !== JSON.stringify(expectedLoads)
    || JSON.stringify(projection.decision) !== JSON.stringify(selected.decision)
    || JSON.stringify(projection.unboundExternalItemIds)
      !== JSON.stringify(selected.unboundExternalItemIds)
    || JSON.stringify(projection.saturatedExternalItemIds)
      !== JSON.stringify(selected.saturatedExternalItemIds)
    || JSON.stringify(projection.automaticDisabledItemIds)
      !== JSON.stringify(selected.automaticDisabledItemIds)
    || JSON.stringify(projection.dependencyBlockedItemIds)
      !== JSON.stringify(selected.dependencyBlockedItemIds)
    || JSON.stringify(projection.automaticAvailableItemIds)
      !== JSON.stringify(projection.workerPlan.automaticAvailableItemIds)
    || JSON.stringify(projection.externalAvailableItemIds)
      !== JSON.stringify(projection.workerPlan.externalAvailableItemIds)
  ) {
    findings.push(finding("supervisor-projection-selection", "error", projection.projectionId, "supervisor projection differs from deterministic scheduling selection"));
  }
  if (
    projection.authority !== "none"
    || projection.graphEffect !== "none"
    || projection.canonEffect !== "none"
    || projection.answerEffect !== "none"
  ) {
    findings.push(finding("supervisor-projection-authority", "error", projection.projectionId, "supervisor projection acquired execution or answer authority"));
  }
  const expectedFingerprint = sha256(projectionCore(projection));
  if (projection.projectionFingerprint !== expectedFingerprint) {
    findings.push(finding("supervisor-projection-fingerprint", "error", projection.projectionId, "supervisor projection fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-supervisor-projection", {
    estateId: projection.estateId,
    policyFingerprint: projection.policyFingerprint,
    workerPlanFingerprint: projection.workerPlanFingerprint,
    projectionFingerprint: expectedFingerprint,
  });
  if (projection.projectionId !== expectedId) {
    findings.push(finding("supervisor-projection-identity", "error", projection.projectionId, "supervisor projection identity is not content addressed"));
  }
  return sortedFindings(findings);
}

function requestFingerprint(input: {
  estateId: string;
  requestKey: string;
  policyFingerprint: `sha256:${string}`;
  requestedAt: string;
  automaticCompletedAt: string | null;
  operatorId: string;
}): `sha256:${string}` {
  return sha256(input);
}

function intentCore(
  intent: AsoiafAnswerSupervisorIntent,
): Omit<AsoiafAnswerSupervisorIntent, "intentId" | "intentFingerprint"> {
  const { intentId: _intentId, intentFingerprint: _intentFingerprint, ...core } = intent;
  return core;
}

function buildIntent(
  input: AsoiafAnswerSupervisorTickInput,
  projection: AsoiafAnswerSupervisorProjection,
): AsoiafAnswerSupervisorIntent {
  const requestKey = input.requestKey.trim();
  const operatorId = normalizedOperatorId(input.operatorId);
  const automaticCompletedAt = input.automaticCompletedAt ?? null;
  if (
    !requestKey
    || [...requestKey].length > MAX_REQUEST_KEY_CHARACTERS
    || !validTime(input.requestedAt)
    || Date.parse(input.requestedAt) < Date.parse(projection.workerPlan.asOf)
  ) {
    throw new Error("answer supervisor request key or request time is invalid");
  }
  if (Date.parse(input.requestedAt) < Date.parse(input.policy.createdAt)) {
    throw new Error("answer supervisor request precedes its policy");
  }
  if (projection.decision.kind === "run-automatic") {
    if (
      !automaticCompletedAt
      || !validTime(automaticCompletedAt)
      || Date.parse(automaticCompletedAt) < Date.parse(input.requestedAt)
      || Date.parse(automaticCompletedAt)
        > Date.parse(input.requestedAt) + input.policy.automaticLeaseMilliseconds
    ) {
      throw new Error("automatic supervisor decision requires a completion time within its lease");
    }
  } else if (automaticCompletedAt && !validTime(automaticCompletedAt)) {
    throw new Error("answer supervisor automatic completion time is invalid");
  }
  const fingerprint = requestFingerprint({
    estateId: projection.estateId,
    requestKey,
    policyFingerprint: input.policy.policyFingerprint,
    requestedAt: input.requestedAt,
    automaticCompletedAt,
    operatorId,
  });
  const core = {
    format: ASOIAF_ANSWER_SUPERVISOR_INTENT_FORMAT,
    requestKey,
    requestFingerprint: fingerprint,
    estateId: projection.estateId,
    policy: input.policy,
    policyFingerprint: input.policy.policyFingerprint,
    beforeProjection: projection,
    beforeProjectionFingerprint: projection.projectionFingerprint,
    beforeWorkOrderId: projection.workerPlan.workOrderId,
    beforeWorkOrderFingerprint: projection.workerPlan.workOrderFingerprint,
    beforeStateId: projection.workerPlan.stateId,
    beforeStateFingerprint: projection.workerPlan.stateFingerprint,
    decision: projection.decision,
    requestedAt: input.requestedAt,
    automaticCompletedAt,
    operatorId,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const intentFingerprint = sha256(core);
  return {
    ...core,
    intentId: collectorContentId("asoiaf-answer-supervisor-intent", {
      estateId: core.estateId,
      requestKey: core.requestKey,
      requestFingerprint: core.requestFingerprint,
      intentFingerprint,
    }),
    intentFingerprint,
  };
}

export function validateAsoiafAnswerSupervisorIntent(
  intent: AsoiafAnswerSupervisorIntent,
): AsoiafAnswerSupervisorFinding[] {
  const findings = validateAsoiafAnswerSupervisorProjection(
    intent.beforeProjection,
  );
  if (
    intent.format !== ASOIAF_ANSWER_SUPERVISOR_INTENT_FORMAT
    || !intent.requestKey.trim()
    || [...intent.requestKey].length > MAX_REQUEST_KEY_CHARACTERS
    || !validTime(intent.requestedAt)
    || !intent.operatorId.trim()
    || intent.estateId !== intent.beforeProjection.estateId
    || intent.policyFingerprint !== intent.policy.policyFingerprint
    || JSON.stringify(intent.policy) !== JSON.stringify(intent.beforeProjection.policy)
    || intent.beforeProjectionFingerprint
      !== intent.beforeProjection.projectionFingerprint
    || intent.beforeWorkOrderId !== intent.beforeProjection.workerPlan.workOrderId
    || intent.beforeWorkOrderFingerprint
      !== intent.beforeProjection.workerPlan.workOrderFingerprint
    || intent.beforeStateId !== intent.beforeProjection.workerPlan.stateId
    || intent.beforeStateFingerprint
      !== intent.beforeProjection.workerPlan.stateFingerprint
    || JSON.stringify(intent.decision)
      !== JSON.stringify(intent.beforeProjection.decision)
  ) {
    findings.push(finding("supervisor-intent-custody", "error", intent.intentId, "supervisor intent differs from its request, policy, projection, or desk-head custody"));
  }
  const expectedRequestFingerprint = requestFingerprint({
    estateId: intent.estateId,
    requestKey: intent.requestKey,
    policyFingerprint: intent.policyFingerprint,
    requestedAt: intent.requestedAt,
    automaticCompletedAt: intent.automaticCompletedAt,
    operatorId: intent.operatorId,
  });
  if (intent.requestFingerprint !== expectedRequestFingerprint) {
    findings.push(finding("supervisor-intent-request-fingerprint", "error", intent.intentId, "supervisor intent request fingerprint is stale"));
  }
  if (intent.decision.kind === "run-automatic") {
    if (
      !intent.automaticCompletedAt
      || !validTime(intent.automaticCompletedAt)
      || Date.parse(intent.automaticCompletedAt) < Date.parse(intent.requestedAt)
      || Date.parse(intent.automaticCompletedAt)
        > Date.parse(intent.requestedAt) + intent.policy.automaticLeaseMilliseconds
    ) {
      findings.push(finding("supervisor-intent-automatic-time", "error", intent.intentId, "automatic intent completion time is outside its lease"));
    }
  } else if (intent.automaticCompletedAt && !validTime(intent.automaticCompletedAt)) {
    findings.push(finding("supervisor-intent-time", "error", intent.intentId, "supervisor intent contains an invalid optional completion time"));
  }
  if (
    intent.authority !== "none"
    || intent.graphEffect !== "none"
    || intent.canonEffect !== "none"
    || intent.answerEffect !== "none"
  ) {
    findings.push(finding("supervisor-intent-authority", "error", intent.intentId, "supervisor intent acquired execution or answer authority"));
  }
  const expectedFingerprint = sha256(intentCore(intent));
  if (intent.intentFingerprint !== expectedFingerprint) {
    findings.push(finding("supervisor-intent-fingerprint", "error", intent.intentId, "supervisor intent fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-supervisor-intent", {
    estateId: intent.estateId,
    requestKey: intent.requestKey,
    requestFingerprint: intent.requestFingerprint,
    intentFingerprint: expectedFingerprint,
  });
  if (intent.intentId !== expectedId) {
    findings.push(finding("supervisor-intent-identity", "error", intent.intentId, "supervisor intent identity is not content addressed"));
  }
  return sortedFindings(findings);
}

function intentPath(
  paths: AsoiafAnswerSupervisorPaths,
  intent: AsoiafAnswerSupervisorIntent,
): string {
  return path.join(
    paths.intents,
    `${intent.intentFingerprint.slice("sha256:".length)}.json`,
  );
}

function runPath(
  paths: AsoiafAnswerSupervisorPaths,
  run: AsoiafAnswerSupervisorRun,
): string {
  return path.join(
    paths.runs,
    `${run.runFingerprint.slice("sha256:".length)}.json`,
  );
}

function findIntentByRequestKey(
  root: string,
  requestKey: string,
): AsoiafAnswerSupervisorIntent | null {
  const matches = listJson<AsoiafAnswerSupervisorIntent>(
    asoiafAnswerSupervisorPaths(root).intents,
  ).filter((intent) => intent.requestKey === requestKey);
  if (matches.length > 1) {
    throw new Error(`answer supervisor request ${requestKey} has duplicate intents`);
  }
  return matches[0] ?? null;
}

function findRunByIntentId(
  root: string,
  intentId: string,
): AsoiafAnswerSupervisorRun | null {
  const matches = listJson<AsoiafAnswerSupervisorRun>(
    asoiafAnswerSupervisorPaths(root).runs,
  ).filter((run) => run.intentId === intentId);
  if (matches.length > 1) {
    throw new Error(`answer supervisor intent ${intentId} has duplicate runs`);
  }
  return matches[0] ?? null;
}

export function prepareAsoiafAnswerSupervisorIntent(
  input: AsoiafAnswerSupervisorTickInput,
): AsoiafAnswerSupervisorPrepareResult {
  ensureSupervisorBaseValid(input.root);
  const requestKey = input.requestKey.trim();
  const existing = findIntentByRequestKey(input.root, requestKey);
  const projection = existing?.beforeProjection
    ?? planAsoiafAnswerDeskSupervisor({ root: input.root, policy: input.policy });
  const expected = buildIntent(input, projection);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(expected)) {
      throw new Error(`answer supervisor request ${requestKey} already has a different intent`);
    }
    return {
      projection,
      intent: existing,
      intentUri: relativeUri(
        input.root,
        intentPath(asoiafAnswerSupervisorPaths(input.root), existing),
      ),
      replayed: true,
    };
  }
  const errors = validateAsoiafAnswerSupervisorIntent(expected)
    .filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(`invalid answer supervisor intent ${expected.intentId}`);
  }
  const paths = asoiafAnswerSupervisorPaths(input.root);
  const target = intentPath(paths, expected);
  const replayed = writeJsonExclusiveOrReplay(target, expected);
  return {
    projection,
    intent: expected,
    intentUri: relativeUri(input.root, target),
    replayed,
  };
}

function operationReference(
  kind: AsoiafAnswerSupervisorOperationReference["kind"],
  objectId: string,
  fingerprint: string,
  uri: string | null,
): AsoiafAnswerSupervisorOperationReference {
  if (!validFingerprint(fingerprint)) {
    throw new Error(`answer supervisor operation reference ${objectId} has an invalid fingerprint`);
  }
  return {
    kind,
    objectId,
    fingerprint: fingerprint as `sha256:${string}`,
    uri,
  };
}

function outcomeForDecision(
  decision: AsoiafAnswerSupervisorDecisionKind,
): AsoiafAnswerSupervisorRunOutcome {
  switch (decision) {
    case "run-automatic": return "automatic-rendered";
    case "issue-external": return "external-issued";
    case "wait-external": return "waiting-external";
    case "unbound-external": return "unbound-external";
    case "saturated-external": return "saturated-external";
    case "automatic-disabled": return "automatic-disabled";
    case "idle": return "idle";
  }
}

function runCore(
  run: AsoiafAnswerSupervisorRun,
): Omit<AsoiafAnswerSupervisorRun, "runId" | "runFingerprint"> {
  const { runId: _runId, runFingerprint: _runFingerprint, ...core } = run;
  return core;
}

function automaticReferences(
  root: string,
  run: AsoiafAnswerDeskWorkerRunResult,
): AsoiafAnswerSupervisorOperationReference[] {
  const paths = asoiafAnswerDeskWorkerPaths(root);
  const invocationUri = relativeUri(
    root,
    path.join(
      paths.invocations,
      `${run.invocation.invocationFingerprint.slice("sha256:".length)}.json`,
    ),
  );
  const resultUri = relativeUri(
    root,
    path.join(
      paths.results,
      `${run.result.resultFingerprint.slice("sha256:".length)}.json`,
    ),
  );
  return [
    operationReference(
      "answer-worker-invocation",
      run.invocation.invocationId,
      run.invocation.invocationFingerprint,
      invocationUri,
    ),
    operationReference(
      "answer-worker-result",
      run.result.resultId,
      run.result.resultFingerprint,
      resultUri,
    ),
    ...run.result.resultReferences.map((reference) =>
      operationReference(
        "reviewed-answer-render",
        reference.objectId,
        reference.fingerprint,
        reference.uri,
      ),
    ),
    operationReference(
      "answer-work-settlement",
      run.settlement.settlement.settlementId,
      run.settlement.settlement.settlementFingerprint,
      null,
    ),
  ];
}

function externalReferences(
  issue: AsoiafAnswerExchangeIssueResult,
): AsoiafAnswerSupervisorOperationReference[] {
  return [
    operationReference(
      "answer-exchange-assignment",
      issue.assignment.assignmentId,
      issue.assignment.assignmentFingerprint,
      issue.assignmentUri,
    ),
  ];
}

function buildRun(input: {
  intent: AsoiafAnswerSupervisorIntent;
  afterProjection: AsoiafAnswerSupervisorProjection;
  operationReferences: AsoiafAnswerSupervisorOperationReference[];
  operationReplayed: boolean;
  leaseId: string | null;
  settlement: AsoiafAnswerDeskSettleResult | null;
  completedAt: string;
}): AsoiafAnswerSupervisorRun {
  const core = {
    format: ASOIAF_ANSWER_SUPERVISOR_RUN_FORMAT,
    intentId: input.intent.intentId,
    intentFingerprint: input.intent.intentFingerprint,
    requestKey: input.intent.requestKey,
    requestFingerprint: input.intent.requestFingerprint,
    estateId: input.intent.estateId,
    decisionKind: input.intent.decision.kind,
    outcome: outcomeForDecision(input.intent.decision.kind),
    startedAt: input.intent.requestedAt,
    completedAt: input.completedAt,
    beforeProjectionFingerprint: input.intent.beforeProjectionFingerprint,
    afterProjection: input.afterProjection,
    afterProjectionFingerprint: input.afterProjection.projectionFingerprint,
    beforeWorkOrderId: input.intent.beforeWorkOrderId,
    afterWorkOrderId: input.afterProjection.workerPlan.workOrderId,
    beforeStateFingerprint: input.intent.beforeStateFingerprint,
    afterStateFingerprint: input.afterProjection.workerPlan.stateFingerprint,
    itemId: input.intent.decision.itemId,
    action: input.intent.decision.action,
    actorId: input.intent.decision.actorId,
    actorRole: input.intent.decision.actorRole,
    leaseId: input.leaseId,
    settlementId: input.settlement?.settlement.settlementId ?? null,
    operationReferences: input.operationReferences,
    operationReplayed: input.operationReplayed,
    reason: input.intent.decision.reason,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const runFingerprint = sha256(core);
  return {
    ...core,
    runId: collectorContentId("asoiaf-answer-supervisor-run", {
      intentId: core.intentId,
      outcome: core.outcome,
      runFingerprint,
    }),
    runFingerprint,
  };
}

export function validateAsoiafAnswerSupervisorRun(
  run: AsoiafAnswerSupervisorRun,
  intent: AsoiafAnswerSupervisorIntent,
): AsoiafAnswerSupervisorFinding[] {
  const findings = validateAsoiafAnswerSupervisorIntent(intent);
  if (
    run.format !== ASOIAF_ANSWER_SUPERVISOR_RUN_FORMAT
    || run.intentId !== intent.intentId
    || run.intentFingerprint !== intent.intentFingerprint
    || run.requestKey !== intent.requestKey
    || run.requestFingerprint !== intent.requestFingerprint
    || run.estateId !== intent.estateId
    || run.decisionKind !== intent.decision.kind
    || run.outcome !== outcomeForDecision(intent.decision.kind)
    || run.startedAt !== intent.requestedAt
    || !validTime(run.completedAt)
    || Date.parse(run.completedAt) < Date.parse(run.startedAt)
    || run.beforeProjectionFingerprint !== intent.beforeProjectionFingerprint
    || run.afterProjectionFingerprint !== run.afterProjection.projectionFingerprint
    || run.afterProjection.estateId !== intent.estateId
    || run.afterWorkOrderId !== run.afterProjection.workerPlan.workOrderId
    || run.afterStateFingerprint !== run.afterProjection.workerPlan.stateFingerprint
    || run.beforeWorkOrderId !== intent.beforeWorkOrderId
    || run.beforeStateFingerprint !== intent.beforeStateFingerprint
    || run.itemId !== intent.decision.itemId
    || run.action !== intent.decision.action
    || run.actorId !== intent.decision.actorId
    || run.actorRole !== intent.decision.actorRole
  ) {
    findings.push(finding("supervisor-run-custody", "error", run.runId, "supervisor run differs from its intent or completion custody"));
  }
  findings.push(...validateAsoiafAnswerSupervisorProjection(run.afterProjection));
  const sideEffecting = run.decisionKind === "run-automatic"
    || run.decisionKind === "issue-external";
  if (sideEffecting && (run.leaseId === null || run.operationReferences.length === 0)) {
    findings.push(finding("supervisor-run-operation", "error", run.runId, "side-effecting supervisor run lacks lease or operation custody"));
  }
  if (!sideEffecting && (
    run.leaseId !== null
    || run.settlementId !== null
    || run.operationReferences.length !== 0
    || run.operationReplayed
  )) {
    findings.push(finding("supervisor-run-noop", "error", run.runId, "non-dispatch supervisor run acquired operation custody"));
  }
  if (run.decisionKind === "run-automatic") {
    if (
      run.settlementId === null
      || !run.operationReferences.some((reference) => reference.kind === "answer-worker-result")
      || !run.operationReferences.some((reference) => reference.kind === "answer-work-settlement")
      || !run.operationReferences.some((reference) => reference.kind === "reviewed-answer-render")
    ) {
      findings.push(finding("supervisor-run-automatic", "error", run.runId, "automatic supervisor run lacks invocation, result, render, or settlement custody"));
    }
  }
  if (run.decisionKind === "issue-external") {
    if (
      run.settlementId !== null
      || run.operationReferences.length !== 1
      || run.operationReferences[0]?.kind !== "answer-exchange-assignment"
    ) {
      findings.push(finding("supervisor-run-external", "error", run.runId, "external supervisor run differs from one assignment-only dispatch"));
    }
  }
  for (const reference of run.operationReferences) {
    if (
      !reference.objectId.trim()
      || !validFingerprint(reference.fingerprint)
      || (reference.uri !== null && !reference.uri.trim())
    ) {
      findings.push(finding("supervisor-run-reference", "error", run.runId, "supervisor operation reference is malformed"));
    }
  }
  if (
    run.authority !== "none"
    || run.graphEffect !== "none"
    || run.canonEffect !== "none"
    || run.answerEffect !== "none"
  ) {
    findings.push(finding("supervisor-run-authority", "error", run.runId, "supervisor run acquired task, graph, canon, or answer authority"));
  }
  const expectedFingerprint = sha256(runCore(run));
  if (run.runFingerprint !== expectedFingerprint) {
    findings.push(finding("supervisor-run-fingerprint", "error", run.runId, "supervisor run fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-supervisor-run", {
    intentId: run.intentId,
    outcome: run.outcome,
    runFingerprint: expectedFingerprint,
  });
  if (run.runId !== expectedId) {
    findings.push(finding("supervisor-run-identity", "error", run.runId, "supervisor run identity is not content addressed"));
  }
  return sortedFindings(findings);
}

function operationStillExists(
  root: string,
  run: AsoiafAnswerSupervisorRun,
): AsoiafAnswerSupervisorFinding[] {
  const findings: AsoiafAnswerSupervisorFinding[] = [];
  const desk = readAsoiafAnswerDeskStatus(root);
  const exchange = readAsoiafAnswerExchangeStatus(root);
  const worker = readAsoiafAnswerDeskWorkerStatus(root);
  for (const reference of run.operationReferences) {
    let matched = false;
    switch (reference.kind) {
      case "answer-exchange-assignment":
        matched = exchange.assignments.some(
          (entry) =>
            entry.assignmentId === reference.objectId
            && entry.assignmentFingerprint === reference.fingerprint,
        );
        break;
      case "answer-worker-invocation":
        matched = worker.invocations.some(
          (entry) =>
            entry.invocationId === reference.objectId
            && entry.invocationFingerprint === reference.fingerprint,
        );
        break;
      case "answer-worker-result":
        matched = worker.results.some(
          (entry) =>
            entry.resultId === reference.objectId
            && entry.resultFingerprint === reference.fingerprint,
        );
        break;
      case "reviewed-answer-render":
        matched = worker.results.some((result) =>
          result.resultReferences.some(
            (entry) =>
              entry.objectId === reference.objectId
              && entry.fingerprint === reference.fingerprint
              && entry.uri === reference.uri,
          ),
        );
        break;
      case "answer-work-settlement":
        matched = desk.settlements.some(
          (entry) =>
            entry.settlementId === reference.objectId
            && entry.settlementFingerprint === reference.fingerprint,
        );
        break;
    }
    if (!matched) {
      findings.push(finding("supervisor-run-reference-missing", "error", run.runId, `${reference.kind}:${reference.objectId} is absent from underlying custody`));
    }
    if (reference.uri !== null) {
      const target = resolveEstateUri(root, reference.uri);
      if (!target || !fs.existsSync(target)) {
        findings.push(finding("supervisor-run-reference-uri", "error", run.runId, `${reference.uri} is absent or escapes the estate`));
      }
    }
  }
  return sortedFindings(findings);
}

export function tickAsoiafAnswerDeskSupervisor(
  input: AsoiafAnswerSupervisorTickInput,
): AsoiafAnswerSupervisorTickResult {
  ensureSupervisorBaseValid(input.root);
  const prepared = prepareAsoiafAnswerSupervisorIntent(input);
  const existingRun = findRunByIntentId(input.root, prepared.intent.intentId);
  if (existingRun) {
    const errors = [
      ...validateAsoiafAnswerSupervisorRun(existingRun, prepared.intent),
      ...operationStillExists(input.root, existingRun),
    ].filter((entry) => entry.severity === "error");
    if (errors.length > 0) {
      throw new Error(`invalid retained answer supervisor run ${existingRun.runId}`);
    }
    return {
      intent: prepared.intent,
      intentReplayed: true,
      run: existingRun,
      runReplayed: true,
      externalIssue: null,
      automaticRun: null,
    };
  }

  let externalIssue: AsoiafAnswerExchangeIssueResult | null = null;
  let automaticRun: AsoiafAnswerDeskWorkerRunResult | null = null;
  let operationReferences: AsoiafAnswerSupervisorOperationReference[] = [];
  let operationReplayed = false;
  let leaseId: string | null = null;
  let settlement: AsoiafAnswerDeskSettleResult | null = null;
  let completedAt = prepared.intent.requestedAt;

  switch (prepared.intent.decision.kind) {
    case "issue-external": {
      externalIssue = issueAsoiafAnswerExchangeAssignment({
        root: input.root,
        itemId: prepared.intent.decision.itemId,
        actorId: prepared.intent.decision.actorId!,
        actorRole: prepared.intent.decision.actorRole as AsoiafAnswerExchangeActorRole,
        claimedAt: prepared.intent.requestedAt,
        issuedAt: prepared.intent.requestedAt,
        leaseMilliseconds: prepared.intent.decision.leaseMilliseconds!,
        operatorId: `${prepared.intent.operatorId}:external`,
      });
      operationReferences = externalReferences(externalIssue);
      operationReplayed = externalIssue.claim.replayed
        && externalIssue.assignmentReplayed;
      leaseId = externalIssue.claim.lease.leaseId;
      break;
    }
    case "run-automatic": {
      automaticRun = runAsoiafAnswerDeskWorker({
        root: input.root,
        itemId: prepared.intent.decision.itemId,
        workerId: ASOIAF_REVIEWED_RENDER_WORKER_ID,
        claimedAt: prepared.intent.requestedAt,
        requestedAt: prepared.intent.requestedAt,
        completedAt: prepared.intent.automaticCompletedAt!,
        leaseMilliseconds: prepared.intent.decision.leaseMilliseconds!,
        operatorId: `${prepared.intent.operatorId}:automatic`,
      });
      operationReferences = automaticReferences(input.root, automaticRun);
      operationReplayed = automaticRun.claim.replayed
        && automaticRun.invocationReplayed
        && automaticRun.resultReplayed
        && automaticRun.settlement.replayed;
      leaseId = automaticRun.claim.lease.leaseId;
      settlement = automaticRun.settlement;
      completedAt = prepared.intent.automaticCompletedAt!;
      break;
    }
    case "wait-external":
    case "unbound-external":
    case "saturated-external":
    case "automatic-disabled":
    case "idle": {
      const current = planAsoiafAnswerDeskSupervisor({
        root: input.root,
        policy: prepared.intent.policy,
      });
      if (
        current.workerPlan.planFingerprint
        !== prepared.intent.beforeProjection.workerPlan.planFingerprint
      ) {
        throw new Error(
          `non-dispatch supervisor intent ${prepared.intent.intentId} became stale before completion`,
        );
      }
      break;
    }
  }

  const afterProjection = planAsoiafAnswerDeskSupervisor({
    root: input.root,
    policy: prepared.intent.policy,
  });
  const run = buildRun({
    intent: prepared.intent,
    afterProjection,
    operationReferences,
    operationReplayed,
    leaseId,
    settlement,
    completedAt,
  });
  const errors = validateAsoiafAnswerSupervisorRun(run, prepared.intent)
    .filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(`invalid answer supervisor run ${run.runId}`);
  }
  const paths = asoiafAnswerSupervisorPaths(input.root);
  const runTarget = runPath(paths, run);
  const runReplayed = writeJsonExclusiveOrReplay(runTarget, run);
  return {
    intent: prepared.intent,
    intentReplayed: prepared.replayed,
    run,
    runReplayed,
    externalIssue,
    automaticRun,
  };
}

export function readAsoiafAnswerSupervisorStatus(
  root: string,
  policy?: AsoiafAnswerSupervisorPolicy | null,
): AsoiafAnswerSupervisorStatus {
  const paths = asoiafAnswerSupervisorPaths(root);
  const intents = listJson<AsoiafAnswerSupervisorIntent>(paths.intents);
  const runs = listJson<AsoiafAnswerSupervisorRun>(paths.runs);
  const runIntentIds = new Set(runs.map((run) => run.intentId));
  return {
    paths,
    projection: policy
      ? planAsoiafAnswerDeskSupervisor({ root, policy })
      : null,
    intents,
    runs,
    pendingIntentIds: intents
      .filter((intent) => !runIntentIds.has(intent.intentId))
      .map((intent) => intent.intentId)
      .sort(),
  };
}

export function verifyAsoiafAnswerSupervisorEstate(
  root: string,
): AsoiafAnswerSupervisorFinding[] {
  const findings: AsoiafAnswerSupervisorFinding[] = [];
  for (const entry of verifyAsoiafAnswerExchangeEstate(root)) {
    findings.push(finding(`exchange:${entry.code}`, entry.severity, entry.subjectId, entry.detail));
  }
  const paths = asoiafAnswerSupervisorPaths(root);
  let intents: AsoiafAnswerSupervisorIntent[];
  let runs: AsoiafAnswerSupervisorRun[];
  try {
    intents = listJson<AsoiafAnswerSupervisorIntent>(paths.intents);
    runs = listJson<AsoiafAnswerSupervisorRun>(paths.runs);
  } catch (error) {
    findings.push(finding("supervisor-estate-read", "error", path.resolve(root), error instanceof Error ? error.message : String(error)));
    return sortedFindings(findings);
  }

  const intentsById = new Map<string, AsoiafAnswerSupervisorIntent>();
  const intentsByRequest = new Map<string, AsoiafAnswerSupervisorIntent>();
  for (const intent of intents) {
    findings.push(...validateAsoiafAnswerSupervisorIntent(intent));
    if (intentsById.has(intent.intentId)) {
      findings.push(finding("supervisor-intent-duplicate", "error", intent.intentId, "supervisor intent identity is duplicated"));
    }
    if (intentsByRequest.has(intent.requestKey)) {
      findings.push(finding("supervisor-request-duplicate", "error", intent.requestKey, "supervisor request key has multiple intents"));
    }
    intentsById.set(intent.intentId, intent);
    intentsByRequest.set(intent.requestKey, intent);
  }

  const runsByIntent = new Map<string, AsoiafAnswerSupervisorRun>();
  for (const run of runs) {
    if (runsByIntent.has(run.intentId)) {
      findings.push(finding("supervisor-run-duplicate", "error", run.intentId, "supervisor intent has multiple runs"));
    }
    runsByIntent.set(run.intentId, run);
    const intent = intentsById.get(run.intentId);
    if (!intent) {
      findings.push(finding("supervisor-run-intent-missing", "error", run.runId, "supervisor run references an absent intent"));
      continue;
    }
    findings.push(...validateAsoiafAnswerSupervisorRun(run, intent));
    findings.push(...operationStillExists(root, run));
  }

  for (const intent of intents) {
    if (!runsByIntent.has(intent.intentId)) {
      findings.push(finding("supervisor-intent-pending", "warning", intent.intentId, "supervisor intent has no retained run and may be resumed with the exact request"));
    }
  }

  for (const [directory, code] of [
    [paths.intents, "supervisor-intent-name"],
    [paths.runs, "supervisor-run-name"],
  ] as const) {
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory).sort()) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) {
        findings.push(finding(code, "error", name, "supervisor filename is not a SHA-256 digest"));
      }
    }
  }

  return sortedFindings(findings);
}
