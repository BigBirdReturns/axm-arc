import fs from "node:fs";
import path from "node:path";
import {
  collectorContentId,
  sha256,
} from "./asoiaf-external-estate.js";
import {
  planAsoiafAnswerDeskSupervisor,
  prepareAsoiafAnswerSupervisorIntent,
  readAsoiafAnswerSupervisorStatus,
  tickAsoiafAnswerDeskSupervisor,
  validateAsoiafAnswerSupervisorPolicy,
  validateAsoiafAnswerSupervisorProjection,
  validateAsoiafAnswerSupervisorRun,
  verifyAsoiafAnswerSupervisorEstate,
  type AsoiafAnswerSupervisorActorBinding,
  type AsoiafAnswerSupervisorDecisionKind,
  type AsoiafAnswerSupervisorIntent,
  type AsoiafAnswerSupervisorPolicy,
  type AsoiafAnswerSupervisorProjection,
  type AsoiafAnswerSupervisorRun,
  type AsoiafAnswerSupervisorTickInput,
} from "./asoiaf-answer-desk-supervisor.js";
import {
  asoiafAnswerTransportOperationsPaths,
  dispatchAsoiafAnswerTransport,
  readAsoiafAnswerTransportOperationsStatus,
  verifyAsoiafAnswerTransportOperationsEstate,
  type AsoiafAnswerTransportCertificateAdmission,
  type AsoiafAnswerTransportDispatchReceipt,
  type AsoiafAnswerTransportEndpointLease,
  type AsoiafAnswerTransportOperationsStatus,
  type AsoiafAnswerTransportRendezvous,
} from "./asoiaf-answer-desk-transport-operations.js";
import type {
  AsoiafAnswerTransportIssueBody,
} from "./asoiaf-answer-desk-transport.js";
import type {
  AsoiafAnswerExchangeActorRole,
  AsoiafAnswerExchangeAssignment,
  AsoiafAnswerExchangeIssueResult,
} from "./asoiaf-answer-desk-exchange.js";

export const ASOIAF_ANSWER_REMOTE_SUPERVISOR_BINDING_FORMAT =
  "axm-asoiaf-answer-remote-supervisor-binding/1" as const;
export const ASOIAF_ANSWER_REMOTE_SUPERVISOR_POLICY_FORMAT =
  "axm-asoiaf-answer-remote-supervisor-policy/1" as const;
export const ASOIAF_ANSWER_REMOTE_SUPERVISOR_PROJECTION_FORMAT =
  "axm-asoiaf-answer-remote-supervisor-projection/1" as const;
export const ASOIAF_ANSWER_REMOTE_SUPERVISOR_INTENT_FORMAT =
  "axm-asoiaf-answer-remote-supervisor-intent/1" as const;
export const ASOIAF_ANSWER_REMOTE_SUPERVISOR_RUN_FORMAT =
  "axm-asoiaf-answer-remote-supervisor-run/1" as const;

const MAX_REQUEST_KEY_CHARACTERS = 240;
const MAX_REMOTE_BINDINGS = 64;

export type AsoiafAnswerRemoteSupervisorDecisionKind =
  | "dispatch-external"
  | "wait-rendezvous"
  | Exclude<AsoiafAnswerSupervisorDecisionKind, "issue-external">;

export type AsoiafAnswerRemoteSupervisorRunOutcome =
  | "external-dispatched"
  | "waiting-rendezvous"
  | "automatic-rendered"
  | "waiting-external"
  | "unbound-external"
  | "saturated-external"
  | "automatic-disabled"
  | "idle";

export interface AsoiafAnswerRemoteSupervisorBindingInput {
  supervisorBindingId: string;
  certificateAdmissionId: string;
  rendezvousId: string;
}

export interface AsoiafAnswerRemoteSupervisorBinding {
  format: typeof ASOIAF_ANSWER_REMOTE_SUPERVISOR_BINDING_FORMAT;
  bindingId: string;
  supervisorBindingId: string;
  supervisorBindingFingerprint: `sha256:${string}`;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  certificateAdmissionId: string;
  certificateAdmissionFingerprint: `sha256:${string}`;
  certificateFingerprint: `sha256:${string}`;
  rendezvousId: string;
  rendezvousFingerprint: `sha256:${string}`;
  serverId: string;
  selection: "exact-certificate-and-rendezvous";
  automaticFailover: false;
  certificateRetained: false;
  privateKeyRetained: false;
  certificatePathRetained: false;
  privateKeyPathRetained: false;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  bindingFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerRemoteSupervisorPolicyInput {
  root: string;
  createdBy: string;
  createdAt: string;
  supervisorPolicy: AsoiafAnswerSupervisorPolicy;
  remoteBindings: AsoiafAnswerRemoteSupervisorBindingInput[];
}

export interface AsoiafAnswerRemoteSupervisorPolicy {
  format: typeof ASOIAF_ANSWER_REMOTE_SUPERVISOR_POLICY_FORMAT;
  policyId: string;
  createdBy: string;
  createdAt: string;
  supervisorPolicy: AsoiafAnswerSupervisorPolicy;
  supervisorPolicyFingerprint: `sha256:${string}`;
  remoteBindings: AsoiafAnswerRemoteSupervisorBinding[];
  selectionPolicy: "supervisor-decision-then-exact-pinned-rendezvous";
  credentialPolicy: "operator-supplied-ephemeral-material";
  dispatchPolicy: "remote-first-then-supervisor-replay";
  automaticFailover: false;
  networkDiscovery: "none";
  certificateIssuanceAuthority: "none";
  certificateRetained: false;
  privateKeyRetained: false;
  certificatePathRetained: false;
  privateKeyPathRetained: false;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  policyFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerRemoteSupervisorReadiness {
  supervisorBindingId: string;
  actorId: string;
  actorRole: AsoiafAnswerExchangeActorRole;
  certificateAdmissionId: string;
  certificateAdmissionFingerprint: `sha256:${string}`;
  certificateFingerprint: `sha256:${string}`;
  rendezvousId: string;
  rendezvousFingerprint: `sha256:${string}`;
  selectedEndpointLeaseId: string | null;
  selectedEndpointLeaseFingerprint: `sha256:${string}` | null;
  selectedBaseUrl: string | null;
  ready: boolean;
  exclusionReason: string | null;
}

export interface AsoiafAnswerRemoteSupervisorDecision {
  kind: AsoiafAnswerRemoteSupervisorDecisionKind;
  baseDecisionKind: AsoiafAnswerSupervisorDecisionKind;
  itemId: string | null;
  itemFingerprint: `sha256:${string}` | null;
  action: AsoiafAnswerSupervisorProjection["decision"]["action"];
  actorId: string | null;
  actorRole: AsoiafAnswerSupervisorProjection["decision"]["actorRole"];
  leaseMilliseconds: number | null;
  supervisorBindingId: string | null;
  remoteBindingId: string | null;
  certificateAdmissionId: string | null;
  rendezvousId: string | null;
  reason: string;
}

export interface AsoiafAnswerRemoteSupervisorProjection {
  format: typeof ASOIAF_ANSWER_REMOTE_SUPERVISOR_PROJECTION_FORMAT;
  projectionId: string;
  estateId: string;
  projectedAt: string;
  policy: AsoiafAnswerRemoteSupervisorPolicy;
  policyFingerprint: `sha256:${string}`;
  supervisorProjection: AsoiafAnswerSupervisorProjection;
  supervisorProjectionFingerprint: `sha256:${string}`;
  readiness: AsoiafAnswerRemoteSupervisorReadiness[];
  decision: AsoiafAnswerRemoteSupervisorDecision;
  automaticFailover: false;
  certificateRetained: false;
  privateKeyRetained: false;
  certificatePathRetained: false;
  privateKeyPathRetained: false;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  projectionFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerRemoteSupervisorTickInput {
  root: string;
  requestKey: string;
  policy: AsoiafAnswerRemoteSupervisorPolicy;
  requestedAt: string;
  automaticCompletedAt?: string | null;
  operatorId?: string;
  credentials?: AsoiafAnswerRemoteSupervisorCredentialMaterial | null;
}

export interface AsoiafAnswerRemoteSupervisorCredentialMaterial {
  certificateAdmissionId: string;
  clientCertificate: string | Buffer;
  clientPrivateKey: string | Buffer;
  serverCertificateAuthority: string | Buffer;
  timeoutMilliseconds?: number;
}

export interface AsoiafAnswerRemoteSupervisorIntent {
  format: typeof ASOIAF_ANSWER_REMOTE_SUPERVISOR_INTENT_FORMAT;
  intentId: string;
  intentFingerprint: `sha256:${string}`;
  requestKey: string;
  requestFingerprint: `sha256:${string}`;
  estateId: string;
  policy: AsoiafAnswerRemoteSupervisorPolicy;
  policyFingerprint: `sha256:${string}`;
  beforeProjection: AsoiafAnswerRemoteSupervisorProjection;
  beforeProjectionFingerprint: `sha256:${string}`;
  decision: AsoiafAnswerRemoteSupervisorDecision;
  requestedAt: string;
  automaticCompletedAt: string | null;
  operatorId: string;
  baseSupervisorRequestKey: string;
  dispatchIdempotencyKeyDigest: `sha256:${string}` | null;
  credentialMaterialRetained: false;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

export interface AsoiafAnswerRemoteSupervisorRun {
  format: typeof ASOIAF_ANSWER_REMOTE_SUPERVISOR_RUN_FORMAT;
  runId: string;
  runFingerprint: `sha256:${string}`;
  intentId: string;
  intentFingerprint: `sha256:${string}`;
  requestKey: string;
  requestFingerprint: `sha256:${string}`;
  estateId: string;
  decisionKind: AsoiafAnswerRemoteSupervisorDecisionKind;
  outcome: AsoiafAnswerRemoteSupervisorRunOutcome;
  startedAt: string;
  completedAt: string;
  beforeProjectionFingerprint: `sha256:${string}`;
  afterProjection: AsoiafAnswerRemoteSupervisorProjection;
  afterProjectionFingerprint: `sha256:${string}`;
  baseSupervisorIntentId: string | null;
  baseSupervisorIntentFingerprint: `sha256:${string}` | null;
  baseSupervisorRunId: string | null;
  baseSupervisorRunFingerprint: `sha256:${string}` | null;
  dispatchId: string | null;
  dispatchFingerprint: `sha256:${string}` | null;
  dispatchUri: string | null;
  assignmentId: string | null;
  assignmentFingerprint: `sha256:${string}` | null;
  leaseId: string | null;
  networkAttempted: boolean;
  operationReplayed: boolean;
  credentialMaterialRetained: false;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

export interface AsoiafAnswerRemoteSupervisorPaths {
  root: string;
  remoteSupervisorRoot: string;
  intents: string;
  runs: string;
}

export interface AsoiafAnswerRemoteSupervisorPrepareResult {
  projection: AsoiafAnswerRemoteSupervisorProjection;
  intent: AsoiafAnswerRemoteSupervisorIntent;
  intentUri: string;
  replayed: boolean;
}

export interface AsoiafAnswerRemoteSupervisorTickResult {
  intent: AsoiafAnswerRemoteSupervisorIntent;
  intentReplayed: boolean;
  run: AsoiafAnswerRemoteSupervisorRun;
  runReplayed: boolean;
  baseSupervisorIntent: AsoiafAnswerSupervisorIntent | null;
  baseSupervisorRun: AsoiafAnswerSupervisorRun | null;
  dispatch: AsoiafAnswerTransportDispatchReceipt | null;
  dispatchReplayed: boolean;
  networkAttempted: boolean;
}

export interface AsoiafAnswerRemoteSupervisorStatus {
  paths: AsoiafAnswerRemoteSupervisorPaths;
  projection: AsoiafAnswerRemoteSupervisorProjection | null;
  intents: AsoiafAnswerRemoteSupervisorIntent[];
  runs: AsoiafAnswerRemoteSupervisorRun[];
  pendingIntentIds: string[];
}

export interface AsoiafAnswerRemoteSupervisorFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

function finding(
  code: string,
  severity: AsoiafAnswerRemoteSupervisorFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafAnswerRemoteSupervisorFinding {
  return { code, severity, subjectId, detail };
}

function sortedFindings(
  findings: readonly AsoiafAnswerRemoteSupervisorFinding[],
): AsoiafAnswerRemoteSupervisorFinding[] {
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

function normalizedOperatorId(value: string | undefined): string {
  return value?.trim() || "asoiaf-answer-remote-supervisor";
}

function requireIdentity(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function bindingCore(
  binding: AsoiafAnswerRemoteSupervisorBinding,
): Omit<AsoiafAnswerRemoteSupervisorBinding, "bindingId" | "bindingFingerprint"> {
  const {
    bindingId: _bindingId,
    bindingFingerprint: _bindingFingerprint,
    ...core
  } = binding;
  return core;
}

function policyCore(
  policy: AsoiafAnswerRemoteSupervisorPolicy,
): Omit<AsoiafAnswerRemoteSupervisorPolicy, "policyId" | "policyFingerprint"> {
  const { policyId: _policyId, policyFingerprint: _fingerprint, ...core } = policy;
  return core;
}

function projectionCore(
  projection: AsoiafAnswerRemoteSupervisorProjection,
): Omit<AsoiafAnswerRemoteSupervisorProjection, "projectionId" | "projectionFingerprint"> {
  const {
    projectionId: _projectionId,
    projectionFingerprint: _fingerprint,
    ...core
  } = projection;
  return core;
}

function intentCore(
  intent: AsoiafAnswerRemoteSupervisorIntent,
): Omit<AsoiafAnswerRemoteSupervisorIntent, "intentId" | "intentFingerprint"> {
  const { intentId: _intentId, intentFingerprint: _fingerprint, ...core } = intent;
  return core;
}

function runCore(
  run: AsoiafAnswerRemoteSupervisorRun,
): Omit<AsoiafAnswerRemoteSupervisorRun, "runId" | "runFingerprint"> {
  const { runId: _runId, runFingerprint: _fingerprint, ...core } = run;
  return core;
}

function findSupervisorBinding(
  policy: AsoiafAnswerSupervisorPolicy,
  bindingId: string,
): AsoiafAnswerSupervisorActorBinding {
  const binding = policy.actorBindings.find((entry) => entry.bindingId === bindingId);
  if (!binding) {
    throw new Error(`remote supervisor binding references absent supervisor binding ${bindingId}`);
  }
  return binding;
}

function findCertificate(
  status: AsoiafAnswerTransportOperationsStatus,
  admissionId: string,
): AsoiafAnswerTransportCertificateAdmission {
  const admission = status.certificates.find((entry) => entry.admissionId === admissionId);
  if (!admission) {
    throw new Error(`remote supervisor certificate admission ${admissionId} is absent`);
  }
  return admission;
}

function findRendezvous(
  status: AsoiafAnswerTransportOperationsStatus,
  rendezvousId: string,
): AsoiafAnswerTransportRendezvous {
  const rendezvous = status.rendezvous.find((entry) => entry.rendezvousId === rendezvousId);
  if (!rendezvous) {
    throw new Error(`remote supervisor rendezvous ${rendezvousId} is absent`);
  }
  return rendezvous;
}

function buildRemoteBinding(input: {
  supervisorBinding: AsoiafAnswerSupervisorActorBinding;
  certificate: AsoiafAnswerTransportCertificateAdmission;
  rendezvous: AsoiafAnswerTransportRendezvous;
}): AsoiafAnswerRemoteSupervisorBinding {
  if (
    input.certificate.usage !== "client-auth"
    || input.certificate.principalId !== input.supervisorBinding.actorId
    || input.certificate.actorRole !== input.supervisorBinding.actorRole
  ) {
    throw new Error("remote supervisor certificate differs from supervisor actor identity or role");
  }
  if (
    input.rendezvous.clientCertificateAdmissionId !== input.certificate.admissionId
    || input.rendezvous.clientCertificateAdmissionFingerprint
      !== input.certificate.admissionFingerprint
    || input.rendezvous.clientCertificateFingerprint
      !== input.certificate.certificateFingerprint
    || input.rendezvous.clientActorId !== input.supervisorBinding.actorId
    || input.rendezvous.clientActorRole !== input.supervisorBinding.actorRole
  ) {
    throw new Error("remote supervisor rendezvous differs from its exact certificate and supervisor actor binding");
  }
  const core = {
    format: ASOIAF_ANSWER_REMOTE_SUPERVISOR_BINDING_FORMAT,
    supervisorBindingId: input.supervisorBinding.bindingId,
    supervisorBindingFingerprint: input.supervisorBinding.bindingFingerprint,
    actorId: input.supervisorBinding.actorId,
    actorRole: input.supervisorBinding.actorRole,
    certificateAdmissionId: input.certificate.admissionId,
    certificateAdmissionFingerprint: input.certificate.admissionFingerprint,
    certificateFingerprint: input.certificate.certificateFingerprint,
    rendezvousId: input.rendezvous.rendezvousId,
    rendezvousFingerprint: input.rendezvous.rendezvousFingerprint,
    serverId: input.rendezvous.serverId,
    selection: "exact-certificate-and-rendezvous" as const,
    automaticFailover: false as const,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    certificatePathRetained: false as const,
    privateKeyPathRetained: false as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const bindingFingerprint = sha256(core);
  return {
    ...core,
    bindingId: collectorContentId("asoiaf-answer-remote-supervisor-binding", {
      supervisorBindingId: core.supervisorBindingId,
      certificateAdmissionId: core.certificateAdmissionId,
      rendezvousId: core.rendezvousId,
      bindingFingerprint,
    }),
    bindingFingerprint,
  };
}

export function buildAsoiafAnswerRemoteSupervisorPolicy(
  input: AsoiafAnswerRemoteSupervisorPolicyInput,
): AsoiafAnswerRemoteSupervisorPolicy {
  const createdBy = requireIdentity(input.createdBy, "remote supervisor policy creator");
  if (!validTime(input.createdAt)) {
    throw new Error("remote supervisor policy creation time is invalid");
  }
  const supervisorErrors = validateAsoiafAnswerSupervisorPolicy(input.supervisorPolicy)
    .filter((entry) => entry.severity === "error");
  if (supervisorErrors.length > 0) {
    throw new Error(`remote supervisor policy contains invalid base supervisor policy ${input.supervisorPolicy.policyId}`);
  }
  if (input.remoteBindings.length > MAX_REMOTE_BINDINGS) {
    throw new Error("remote supervisor policy exceeds the bounded remote actor count");
  }
  const operations = readAsoiafAnswerTransportOperationsStatus(input.root);
  const bindings = input.remoteBindings.map((bindingInput) =>
    buildRemoteBinding({
      supervisorBinding: findSupervisorBinding(
        input.supervisorPolicy,
        requireIdentity(bindingInput.supervisorBindingId, "supervisor binding identity"),
      ),
      certificate: findCertificate(
        operations,
        requireIdentity(bindingInput.certificateAdmissionId, "certificate admission identity"),
      ),
      rendezvous: findRendezvous(
        operations,
        requireIdentity(bindingInput.rendezvousId, "rendezvous identity"),
      ),
    }),
  ).sort(
    (left, right) =>
      left.actorRole.localeCompare(right.actorRole)
      || left.actorId.localeCompare(right.actorId)
      || left.bindingId.localeCompare(right.bindingId),
  );
  const supervisorBindingIds = new Set<string>();
  for (const binding of bindings) {
    if (supervisorBindingIds.has(binding.supervisorBindingId)) {
      throw new Error(`remote supervisor binding ${binding.supervisorBindingId} is duplicated`);
    }
    supervisorBindingIds.add(binding.supervisorBindingId);
  }
  const core = {
    format: ASOIAF_ANSWER_REMOTE_SUPERVISOR_POLICY_FORMAT,
    createdBy,
    createdAt: input.createdAt,
    supervisorPolicy: input.supervisorPolicy,
    supervisorPolicyFingerprint: input.supervisorPolicy.policyFingerprint,
    remoteBindings: bindings,
    selectionPolicy: "supervisor-decision-then-exact-pinned-rendezvous" as const,
    credentialPolicy: "operator-supplied-ephemeral-material" as const,
    dispatchPolicy: "remote-first-then-supervisor-replay" as const,
    automaticFailover: false as const,
    networkDiscovery: "none" as const,
    certificateIssuanceAuthority: "none" as const,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    certificatePathRetained: false as const,
    privateKeyPathRetained: false as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const policyFingerprint = sha256(core);
  const policy: AsoiafAnswerRemoteSupervisorPolicy = {
    ...core,
    policyId: collectorContentId("asoiaf-answer-remote-supervisor-policy", {
      createdBy: core.createdBy,
      createdAt: core.createdAt,
      supervisorPolicyFingerprint: core.supervisorPolicyFingerprint,
      policyFingerprint,
    }),
    policyFingerprint,
  };
  const errors = validateAsoiafAnswerRemoteSupervisorPolicy(policy)
    .filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(`invalid remote supervisor policy ${policy.policyId}`);
  }
  return policy;
}

export function validateAsoiafAnswerRemoteSupervisorPolicy(
  policy: AsoiafAnswerRemoteSupervisorPolicy,
): AsoiafAnswerRemoteSupervisorFinding[] {
  const findings: AsoiafAnswerRemoteSupervisorFinding[] = [];
  for (const entry of validateAsoiafAnswerSupervisorPolicy(policy.supervisorPolicy)) {
    findings.push(finding(`supervisor:${entry.code}`, entry.severity, entry.subjectId, entry.detail));
  }
  if (
    policy.format !== ASOIAF_ANSWER_REMOTE_SUPERVISOR_POLICY_FORMAT
    || !policy.createdBy.trim()
    || !validTime(policy.createdAt)
    || policy.supervisorPolicyFingerprint !== policy.supervisorPolicy.policyFingerprint
  ) {
    findings.push(finding("remote-policy-custody", "error", policy.policyId, "remote policy identity, creation time, or supervisor policy custody is invalid"));
  }
  const expectedOrder = [...policy.remoteBindings].sort(
    (left, right) =>
      left.actorRole.localeCompare(right.actorRole)
      || left.actorId.localeCompare(right.actorId)
      || left.bindingId.localeCompare(right.bindingId),
  );
  if (JSON.stringify(expectedOrder) !== JSON.stringify(policy.remoteBindings)) {
    findings.push(finding("remote-policy-binding-order", "error", policy.policyId, "remote actor bindings are not deterministically ordered"));
  }
  const seen = new Set<string>();
  for (const binding of policy.remoteBindings) {
    if (seen.has(binding.supervisorBindingId)) {
      findings.push(finding("remote-policy-binding-duplicate", "error", binding.bindingId, "supervisor actor binding has multiple remote bindings"));
    }
    seen.add(binding.supervisorBindingId);
    const supervisorBinding = policy.supervisorPolicy.actorBindings.find(
      (entry) => entry.bindingId === binding.supervisorBindingId,
    );
    if (
      !supervisorBinding
      || supervisorBinding.bindingFingerprint !== binding.supervisorBindingFingerprint
      || supervisorBinding.actorId !== binding.actorId
      || supervisorBinding.actorRole !== binding.actorRole
    ) {
      findings.push(finding("remote-binding-supervisor", "error", binding.bindingId, "remote binding differs from its exact supervisor actor binding"));
    }
    if (
      binding.format !== ASOIAF_ANSWER_REMOTE_SUPERVISOR_BINDING_FORMAT
      || !validFingerprint(binding.supervisorBindingFingerprint)
      || !validFingerprint(binding.certificateAdmissionFingerprint)
      || !validFingerprint(binding.certificateFingerprint)
      || !validFingerprint(binding.rendezvousFingerprint)
      || binding.selection !== "exact-certificate-and-rendezvous"
      || binding.automaticFailover !== false
      || binding.certificateRetained !== false
      || binding.privateKeyRetained !== false
      || binding.certificatePathRetained !== false
      || binding.privateKeyPathRetained !== false
      || binding.authority !== "none"
      || binding.graphEffect !== "none"
      || binding.canonEffect !== "none"
      || binding.answerEffect !== "none"
    ) {
      findings.push(finding("remote-binding-boundary", "error", binding.bindingId, "remote binding format, identity, secret boundary, or authority is invalid"));
    }
    const expectedFingerprint = sha256(bindingCore(binding));
    if (binding.bindingFingerprint !== expectedFingerprint) {
      findings.push(finding("remote-binding-fingerprint", "error", binding.bindingId, "remote binding fingerprint is stale"));
    }
    const expectedId = collectorContentId("asoiaf-answer-remote-supervisor-binding", {
      supervisorBindingId: binding.supervisorBindingId,
      certificateAdmissionId: binding.certificateAdmissionId,
      rendezvousId: binding.rendezvousId,
      bindingFingerprint: expectedFingerprint,
    });
    if (binding.bindingId !== expectedId) {
      findings.push(finding("remote-binding-identity", "error", binding.bindingId, "remote binding identity is not content addressed"));
    }
  }
  if (
    policy.selectionPolicy !== "supervisor-decision-then-exact-pinned-rendezvous"
    || policy.credentialPolicy !== "operator-supplied-ephemeral-material"
    || policy.dispatchPolicy !== "remote-first-then-supervisor-replay"
    || policy.automaticFailover !== false
    || policy.networkDiscovery !== "none"
    || policy.certificateIssuanceAuthority !== "none"
    || policy.certificateRetained !== false
    || policy.privateKeyRetained !== false
    || policy.certificatePathRetained !== false
    || policy.privateKeyPathRetained !== false
    || policy.authority !== "none"
    || policy.graphEffect !== "none"
    || policy.canonEffect !== "none"
    || policy.answerEffect !== "none"
  ) {
    findings.push(finding("remote-policy-authority", "error", policy.policyId, "remote policy retained secrets, enabled discovery or failover, or acquired task authority"));
  }
  const expectedFingerprint = sha256(policyCore(policy));
  if (policy.policyFingerprint !== expectedFingerprint) {
    findings.push(finding("remote-policy-fingerprint", "error", policy.policyId, "remote policy fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-remote-supervisor-policy", {
    createdBy: policy.createdBy,
    createdAt: policy.createdAt,
    supervisorPolicyFingerprint: policy.supervisorPolicyFingerprint,
    policyFingerprint: expectedFingerprint,
  });
  if (policy.policyId !== expectedId) {
    findings.push(finding("remote-policy-identity", "error", policy.policyId, "remote policy identity is not content addressed"));
  }
  return sortedFindings(findings);
}

export function asoiafAnswerRemoteSupervisorPaths(
  root: string,
): AsoiafAnswerRemoteSupervisorPaths {
  const absolute = path.resolve(root);
  const remoteSupervisorRoot = path.join(absolute, "answer-remote-supervisor");
  return {
    root: absolute,
    remoteSupervisorRoot,
    intents: path.join(remoteSupervisorRoot, "intents"),
    runs: path.join(remoteSupervisorRoot, "runs"),
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
    const existing = fs.readFileSync(target, "utf8");
    if (existing !== serialized) {
      throw new Error(`remote supervisor immutable file collision at ${target}`);
    }
    return { value: JSON.parse(existing) as T, replayed: true };
  }
}

function digestPath(directory: string, fingerprint: `sha256:${string}`): string {
  return path.join(directory, `${fingerprint.slice("sha256:".length)}.json`);
}

function ensureRemoteBaseValid(root: string): void {
  const errors = [
    ...verifyAsoiafAnswerSupervisorEstate(root).map((entry) => ({
      code: `supervisor:${entry.code}`,
      severity: entry.severity,
      subjectId: entry.subjectId,
    })),
    ...verifyAsoiafAnswerTransportOperationsEstate(root).map((entry) => ({
      code: `operations:${entry.code}`,
      severity: entry.severity,
      subjectId: entry.objectId,
    })),
  ].filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(`invalid remote supervisor base: ${errors
      .map((entry) => `${entry.code}:${entry.subjectId}`)
      .join(", ")}`);
  }
}

function activeAt(input: {
  certificate: AsoiafAnswerTransportCertificateAdmission;
  operations: AsoiafAnswerTransportOperationsStatus;
  at: string;
}): { active: boolean; reason: string | null } {
  const at = Date.parse(input.at);
  if (
    at < Date.parse(input.certificate.validFrom)
    || at < Date.parse(input.certificate.activateAt)
    || at >= Date.parse(input.certificate.retireAfter)
    || at > Date.parse(input.certificate.validUntil)
  ) {
    return { active: false, reason: "The admitted client certificate is outside its active and valid interval." };
  }
  const retirement = input.operations.retirements.find(
    (entry) =>
      entry.certificateFingerprint === input.certificate.certificateFingerprint
      && Date.parse(entry.retiredAt) <= at,
  );
  if (retirement) {
    return { active: false, reason: "The admitted client certificate has an effective retirement and lower transport revocation." };
  }
  return { active: true, reason: null };
}

function readinessForBinding(input: {
  binding: AsoiafAnswerRemoteSupervisorBinding;
  operations: AsoiafAnswerTransportOperationsStatus;
  projectedAt: string;
}): AsoiafAnswerRemoteSupervisorReadiness {
  const base = {
    supervisorBindingId: input.binding.supervisorBindingId,
    actorId: input.binding.actorId,
    actorRole: input.binding.actorRole,
    certificateAdmissionId: input.binding.certificateAdmissionId,
    certificateAdmissionFingerprint: input.binding.certificateAdmissionFingerprint,
    certificateFingerprint: input.binding.certificateFingerprint,
    rendezvousId: input.binding.rendezvousId,
    rendezvousFingerprint: input.binding.rendezvousFingerprint,
  };
  const excluded = (
    reason: string,
    endpoint?: AsoiafAnswerTransportEndpointLease | null,
  ): AsoiafAnswerRemoteSupervisorReadiness => ({
    ...base,
    selectedEndpointLeaseId: endpoint?.endpointLeaseId ?? null,
    selectedEndpointLeaseFingerprint: endpoint?.endpointLeaseFingerprint ?? null,
    selectedBaseUrl: endpoint?.baseUrl ?? null,
    ready: false,
    exclusionReason: reason,
  });
  const certificate = input.operations.certificates.find(
    (entry) => entry.admissionId === input.binding.certificateAdmissionId,
  );
  if (!certificate || certificate.admissionFingerprint !== input.binding.certificateAdmissionFingerprint) {
    return excluded("The exact admitted client certificate is absent or has changed fingerprint custody.");
  }
  if (
    certificate.usage !== "client-auth"
    || certificate.certificateFingerprint !== input.binding.certificateFingerprint
    || certificate.principalId !== input.binding.actorId
    || certificate.actorRole !== input.binding.actorRole
  ) {
    return excluded("The admitted certificate no longer matches the remote actor identity and role.");
  }
  const active = activeAt({
    certificate,
    operations: input.operations,
    at: input.projectedAt,
  });
  if (!active.active) return excluded(active.reason!);
  const rendezvous = input.operations.rendezvous.find(
    (entry) => entry.rendezvousId === input.binding.rendezvousId,
  );
  if (!rendezvous || rendezvous.rendezvousFingerprint !== input.binding.rendezvousFingerprint) {
    return excluded("The exact retained rendezvous is absent or has changed fingerprint custody.");
  }
  if (
    rendezvous.clientCertificateAdmissionId !== certificate.admissionId
    || rendezvous.clientCertificateAdmissionFingerprint !== certificate.admissionFingerprint
    || rendezvous.clientCertificateFingerprint !== certificate.certificateFingerprint
    || rendezvous.clientActorId !== input.binding.actorId
    || rendezvous.clientActorRole !== input.binding.actorRole
    || rendezvous.serverId !== input.binding.serverId
    || rendezvous.automaticFailover !== false
  ) {
    return excluded("The pinned rendezvous differs from the admitted client, server, or no-failover boundary.");
  }
  if (Date.parse(rendezvous.generatedAt) > Date.parse(input.projectedAt)) {
    return excluded("The pinned rendezvous was generated after the requested scheduling time.");
  }
  if (
    !rendezvous.selectedEndpointLeaseId
    || !rendezvous.selectedEndpointLeaseFingerprint
    || !rendezvous.selectedBaseUrl
  ) {
    return excluded("The pinned rendezvous has no selected endpoint.");
  }
  const endpoint = input.operations.endpoints.find(
    (entry) => entry.endpointLeaseId === rendezvous.selectedEndpointLeaseId,
  );
  if (
    !endpoint
    || endpoint.endpointLeaseFingerprint !== rendezvous.selectedEndpointLeaseFingerprint
    || endpoint.baseUrl !== rendezvous.selectedBaseUrl
  ) {
    return excluded("The selected endpoint lease is absent or differs from the rendezvous custody.", endpoint);
  }
  const projectedAt = Date.parse(input.projectedAt);
  if (
    projectedAt < Date.parse(endpoint.availableFrom)
    || projectedAt >= Date.parse(endpoint.expiresAt)
  ) {
    return excluded("The selected endpoint lease is outside its advertised availability interval.", endpoint);
  }
  const serverCertificate = input.operations.certificates.find(
    (entry) => entry.admissionId === endpoint.serverCertificateAdmissionId,
  );
  if (
    !serverCertificate
    || serverCertificate.admissionFingerprint !== endpoint.serverCertificateAdmissionFingerprint
    || serverCertificate.usage !== "server-auth"
    || serverCertificate.certificateFingerprint !== endpoint.serverCertificateFingerprint
  ) {
    return excluded("The selected endpoint lacks its exact admitted server certificate.", endpoint);
  }
  const serverActive = activeAt({
    certificate: serverCertificate,
    operations: input.operations,
    at: input.projectedAt,
  });
  if (!serverActive.active) {
    return excluded("The selected endpoint server certificate is not active at scheduling time.", endpoint);
  }
  const entry = rendezvous.entries.find(
    (candidate) => candidate.endpointLeaseId === endpoint.endpointLeaseId,
  );
  if (
    !entry
    || !entry.eligible
    || entry.latestOutcome !== "available"
    || !entry.latestObservationId
    || !entry.latestObservationFingerprint
  ) {
    return excluded("The selected rendezvous entry lacks one eligible successful pinned observation.", endpoint);
  }
  const observation = input.operations.availability.find(
    (candidate) => candidate.observationId === entry.latestObservationId,
  );
  if (
    !observation
    || observation.observationFingerprint !== entry.latestObservationFingerprint
    || observation.endpointLeaseId !== endpoint.endpointLeaseId
    || observation.clientCertificateAdmissionId !== certificate.admissionId
    || observation.outcome !== "available"
    || observation.observedServerCertificateFingerprint !== endpoint.serverCertificateFingerprint
  ) {
    return excluded("The selected rendezvous observation is absent or differs from the exact client and server pins.", endpoint);
  }
  const age = projectedAt - Date.parse(observation.completedAt);
  if (age < 0 || age > rendezvous.maxObservationAgeMilliseconds) {
    return excluded("The selected pinned availability observation is stale at scheduling time.", endpoint);
  }
  return {
    ...base,
    selectedEndpointLeaseId: endpoint.endpointLeaseId,
    selectedEndpointLeaseFingerprint: endpoint.endpointLeaseFingerprint,
    selectedBaseUrl: endpoint.baseUrl,
    ready: true,
    exclusionReason: null,
  };
}

function remoteDecision(input: {
  supervisorProjection: AsoiafAnswerSupervisorProjection;
  policy: AsoiafAnswerRemoteSupervisorPolicy;
  readiness: AsoiafAnswerRemoteSupervisorReadiness[];
}): AsoiafAnswerRemoteSupervisorDecision {
  const base = input.supervisorProjection.decision;
  if (base.kind === "issue-external") {
    const remoteBinding = input.policy.remoteBindings.find(
      (binding) => binding.supervisorBindingId === base.actorBindingId,
    ) ?? null;
    const ready = remoteBinding
      ? input.readiness.find(
          (entry) => entry.supervisorBindingId === remoteBinding.supervisorBindingId,
        ) ?? null
      : null;
    if (remoteBinding && ready?.ready) {
      return {
        kind: "dispatch-external",
        baseDecisionKind: base.kind,
        itemId: base.itemId,
        itemFingerprint: base.itemFingerprint,
        action: base.action,
        actorId: base.actorId,
        actorRole: base.actorRole,
        leaseMilliseconds: base.leaseMilliseconds,
        supervisorBindingId: base.actorBindingId,
        remoteBindingId: remoteBinding.bindingId,
        certificateAdmissionId: remoteBinding.certificateAdmissionId,
        rendezvousId: remoteBinding.rendezvousId,
        reason:
          "The qualified supervisor selected one external assignment and its exact certificate-bound pinned rendezvous is fresh and eligible for remote dispatch.",
      };
    }
    return {
      kind: "wait-rendezvous",
      baseDecisionKind: base.kind,
      itemId: base.itemId,
      itemFingerprint: base.itemFingerprint,
      action: base.action,
      actorId: base.actorId,
      actorRole: base.actorRole,
      leaseMilliseconds: base.leaseMilliseconds,
      supervisorBindingId: base.actorBindingId,
      remoteBindingId: remoteBinding?.bindingId ?? null,
      certificateAdmissionId: remoteBinding?.certificateAdmissionId ?? null,
      rendezvousId: remoteBinding?.rendezvousId ?? null,
      reason: ready?.exclusionReason
        ?? "The qualified supervisor selected external work, but no exact remote binding exists for its actor binding.",
    };
  }
  return {
    kind: base.kind,
    baseDecisionKind: base.kind,
    itemId: base.itemId,
    itemFingerprint: base.itemFingerprint,
    action: base.action,
    actorId: base.actorId,
    actorRole: base.actorRole,
    leaseMilliseconds: base.leaseMilliseconds,
    supervisorBindingId: base.actorBindingId,
    remoteBindingId: null,
    certificateAdmissionId: null,
    rendezvousId: null,
    reason: base.reason,
  };
}

export function planAsoiafAnswerDeskRemoteSupervisor(input: {
  root: string;
  policy: AsoiafAnswerRemoteSupervisorPolicy;
  projectedAt: string;
}): AsoiafAnswerRemoteSupervisorProjection {
  ensureRemoteBaseValid(input.root);
  if (!validTime(input.projectedAt)) {
    throw new Error("remote supervisor projection time is invalid");
  }
  const policyErrors = validateAsoiafAnswerRemoteSupervisorPolicy(input.policy)
    .filter((entry) => entry.severity === "error");
  if (policyErrors.length > 0) {
    throw new Error(`invalid remote supervisor policy ${input.policy.policyId}`);
  }
  const supervisorProjection = planAsoiafAnswerDeskSupervisor({
    root: input.root,
    policy: input.policy.supervisorPolicy,
  });
  const operations = readAsoiafAnswerTransportOperationsStatus(input.root);
  const readiness = input.policy.remoteBindings.map((binding) =>
    readinessForBinding({ binding, operations, projectedAt: input.projectedAt }),
  );
  const decision = remoteDecision({
    supervisorProjection,
    policy: input.policy,
    readiness,
  });
  const core = {
    format: ASOIAF_ANSWER_REMOTE_SUPERVISOR_PROJECTION_FORMAT,
    estateId: supervisorProjection.estateId,
    projectedAt: input.projectedAt,
    policy: input.policy,
    policyFingerprint: input.policy.policyFingerprint,
    supervisorProjection,
    supervisorProjectionFingerprint: supervisorProjection.projectionFingerprint,
    readiness,
    decision,
    automaticFailover: false as const,
    certificateRetained: false as const,
    privateKeyRetained: false as const,
    certificatePathRetained: false as const,
    privateKeyPathRetained: false as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const projectionFingerprint = sha256(core);
  return {
    ...core,
    projectionId: collectorContentId("asoiaf-answer-remote-supervisor-projection", {
      estateId: core.estateId,
      projectedAt: core.projectedAt,
      policyFingerprint: core.policyFingerprint,
      supervisorProjectionFingerprint: core.supervisorProjectionFingerprint,
      projectionFingerprint,
    }),
    projectionFingerprint,
  };
}

export function validateAsoiafAnswerRemoteSupervisorProjection(
  projection: AsoiafAnswerRemoteSupervisorProjection,
  root: string,
): AsoiafAnswerRemoteSupervisorFinding[] {
  const findings = validateAsoiafAnswerRemoteSupervisorPolicy(projection.policy);
  for (const entry of validateAsoiafAnswerSupervisorProjection(projection.supervisorProjection)) {
    findings.push(finding(`supervisor:${entry.code}`, entry.severity, entry.subjectId, entry.detail));
  }
  if (
    projection.format !== ASOIAF_ANSWER_REMOTE_SUPERVISOR_PROJECTION_FORMAT
    || !validTime(projection.projectedAt)
    || projection.estateId !== projection.supervisorProjection.estateId
    || projection.policyFingerprint !== projection.policy.policyFingerprint
    || projection.supervisorProjectionFingerprint
      !== projection.supervisorProjection.projectionFingerprint
  ) {
    findings.push(finding("remote-projection-custody", "error", projection.projectionId, "remote projection differs from its policy, time, or supervisor projection custody"));
  }
  try {
    const operations = readAsoiafAnswerTransportOperationsStatus(root);
    const expectedReadiness = projection.policy.remoteBindings.map((binding) =>
      readinessForBinding({
        binding,
        operations,
        projectedAt: projection.projectedAt,
      }),
    );
    const expectedDecision = remoteDecision({
      supervisorProjection: projection.supervisorProjection,
      policy: projection.policy,
      readiness: expectedReadiness,
    });
    if (
      JSON.stringify(projection.readiness) !== JSON.stringify(expectedReadiness)
      || JSON.stringify(projection.decision) !== JSON.stringify(expectedDecision)
    ) {
      findings.push(finding("remote-projection-selection", "error", projection.projectionId, "remote projection differs from exact certificate and rendezvous readiness"));
    }
  } catch (error) {
    findings.push(finding("remote-projection-input", "error", projection.projectionId, error instanceof Error ? error.message : String(error)));
  }
  if (
    projection.automaticFailover !== false
    || projection.certificateRetained !== false
    || projection.privateKeyRetained !== false
    || projection.certificatePathRetained !== false
    || projection.privateKeyPathRetained !== false
    || projection.authority !== "none"
    || projection.graphEffect !== "none"
    || projection.canonEffect !== "none"
    || projection.answerEffect !== "none"
  ) {
    findings.push(finding("remote-projection-authority", "error", projection.projectionId, "remote projection retained secrets, enabled failover, or acquired task authority"));
  }
  const expectedFingerprint = sha256(projectionCore(projection));
  if (projection.projectionFingerprint !== expectedFingerprint) {
    findings.push(finding("remote-projection-fingerprint", "error", projection.projectionId, "remote projection fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-remote-supervisor-projection", {
    estateId: projection.estateId,
    projectedAt: projection.projectedAt,
    policyFingerprint: projection.policyFingerprint,
    supervisorProjectionFingerprint: projection.supervisorProjectionFingerprint,
    projectionFingerprint: expectedFingerprint,
  });
  if (projection.projectionId !== expectedId) {
    findings.push(finding("remote-projection-identity", "error", projection.projectionId, "remote projection identity is not content addressed"));
  }
  return sortedFindings(findings);
}

function dispatchIdempotencyKey(intent: {
  estateId: string;
  requestKey: string;
  policyFingerprint: `sha256:${string}`;
  beforeProjectionFingerprint: `sha256:${string}`;
}): string {
  const fingerprint = sha256(intent).slice("sha256:".length);
  return `remote-supervisor-${fingerprint}`;
}

function requestFingerprint(input: {
  estateId: string;
  requestKey: string;
  policyFingerprint: `sha256:${string}`;
  beforeProjectionFingerprint: `sha256:${string}`;
  requestedAt: string;
  automaticCompletedAt: string | null;
  operatorId: string;
}): `sha256:${string}` {
  return sha256(input);
}

function buildIntent(
  input: AsoiafAnswerRemoteSupervisorTickInput,
  projection: AsoiafAnswerRemoteSupervisorProjection,
): AsoiafAnswerRemoteSupervisorIntent {
  const requestKey = input.requestKey.trim();
  const operatorId = normalizedOperatorId(input.operatorId);
  const automaticCompletedAt = input.automaticCompletedAt ?? null;
  if (
    !requestKey
    || [...requestKey].length > MAX_REQUEST_KEY_CHARACTERS
    || !validTime(input.requestedAt)
    || Date.parse(input.requestedAt) < Date.parse(input.policy.createdAt)
  ) {
    throw new Error("remote supervisor request key or request time is invalid");
  }
  if (projection.decision.kind === "run-automatic") {
    if (
      !automaticCompletedAt
      || !validTime(automaticCompletedAt)
      || Date.parse(automaticCompletedAt) < Date.parse(input.requestedAt)
      || Date.parse(automaticCompletedAt)
        > Date.parse(input.requestedAt)
          + input.policy.supervisorPolicy.automaticLeaseMilliseconds
    ) {
      throw new Error("remote supervisor automatic decision requires a completion time within its lease");
    }
  } else if (automaticCompletedAt && !validTime(automaticCompletedAt)) {
    throw new Error("remote supervisor optional automatic completion time is invalid");
  }
  const requestFingerprintValue = requestFingerprint({
    estateId: projection.estateId,
    requestKey,
    policyFingerprint: input.policy.policyFingerprint,
    beforeProjectionFingerprint: projection.projectionFingerprint,
    requestedAt: input.requestedAt,
    automaticCompletedAt,
    operatorId,
  });
  const key = projection.decision.kind === "dispatch-external"
    ? dispatchIdempotencyKey({
        estateId: projection.estateId,
        requestKey,
        policyFingerprint: input.policy.policyFingerprint,
        beforeProjectionFingerprint: projection.projectionFingerprint,
      })
    : null;
  const core = {
    format: ASOIAF_ANSWER_REMOTE_SUPERVISOR_INTENT_FORMAT,
    requestKey,
    requestFingerprint: requestFingerprintValue,
    estateId: projection.estateId,
    policy: input.policy,
    policyFingerprint: input.policy.policyFingerprint,
    beforeProjection: projection,
    beforeProjectionFingerprint: projection.projectionFingerprint,
    decision: projection.decision,
    requestedAt: input.requestedAt,
    automaticCompletedAt,
    operatorId,
    baseSupervisorRequestKey: requestKey,
    dispatchIdempotencyKeyDigest: key ? sha256(key) : null,
    credentialMaterialRetained: false as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const intentFingerprint = sha256(core);
  return {
    ...core,
    intentId: collectorContentId("asoiaf-answer-remote-supervisor-intent", {
      estateId: core.estateId,
      requestKey: core.requestKey,
      requestFingerprint: core.requestFingerprint,
      intentFingerprint,
    }),
    intentFingerprint,
  };
}

export function validateAsoiafAnswerRemoteSupervisorIntent(
  intent: AsoiafAnswerRemoteSupervisorIntent,
  root: string,
): AsoiafAnswerRemoteSupervisorFinding[] {
  const findings = validateAsoiafAnswerRemoteSupervisorProjection(
    intent.beforeProjection,
    root,
  );
  if (
    intent.format !== ASOIAF_ANSWER_REMOTE_SUPERVISOR_INTENT_FORMAT
    || !intent.requestKey.trim()
    || [...intent.requestKey].length > MAX_REQUEST_KEY_CHARACTERS
    || !validTime(intent.requestedAt)
    || !intent.operatorId.trim()
    || intent.estateId !== intent.beforeProjection.estateId
    || intent.policyFingerprint !== intent.policy.policyFingerprint
    || JSON.stringify(intent.policy) !== JSON.stringify(intent.beforeProjection.policy)
    || intent.beforeProjectionFingerprint !== intent.beforeProjection.projectionFingerprint
    || JSON.stringify(intent.decision) !== JSON.stringify(intent.beforeProjection.decision)
    || intent.baseSupervisorRequestKey !== intent.requestKey
  ) {
    findings.push(finding("remote-intent-custody", "error", intent.intentId, "remote intent differs from its request, policy, projection, or supervisor request custody"));
  }
  const expectedRequestFingerprint = requestFingerprint({
    estateId: intent.estateId,
    requestKey: intent.requestKey,
    policyFingerprint: intent.policyFingerprint,
    beforeProjectionFingerprint: intent.beforeProjectionFingerprint,
    requestedAt: intent.requestedAt,
    automaticCompletedAt: intent.automaticCompletedAt,
    operatorId: intent.operatorId,
  });
  if (intent.requestFingerprint !== expectedRequestFingerprint) {
    findings.push(finding("remote-intent-request-fingerprint", "error", intent.intentId, "remote intent request fingerprint is stale"));
  }
  const key = intent.decision.kind === "dispatch-external"
    ? dispatchIdempotencyKey({
        estateId: intent.estateId,
        requestKey: intent.requestKey,
        policyFingerprint: intent.policyFingerprint,
        beforeProjectionFingerprint: intent.beforeProjectionFingerprint,
      })
    : null;
  if (intent.dispatchIdempotencyKeyDigest !== (key ? sha256(key) : null)) {
    findings.push(finding("remote-intent-idempotency", "error", intent.intentId, "remote intent dispatch idempotency digest is stale"));
  }
  if (
    intent.decision.kind === "run-automatic"
    && (
      !intent.automaticCompletedAt
      || !validTime(intent.automaticCompletedAt)
      || Date.parse(intent.automaticCompletedAt) < Date.parse(intent.requestedAt)
      || Date.parse(intent.automaticCompletedAt)
        > Date.parse(intent.requestedAt)
          + intent.policy.supervisorPolicy.automaticLeaseMilliseconds
    )
  ) {
    findings.push(finding("remote-intent-automatic-time", "error", intent.intentId, "remote automatic completion time is outside its bounded lease"));
  }
  if (
    intent.credentialMaterialRetained !== false
    || intent.authority !== "none"
    || intent.graphEffect !== "none"
    || intent.canonEffect !== "none"
    || intent.answerEffect !== "none"
  ) {
    findings.push(finding("remote-intent-authority", "error", intent.intentId, "remote intent retained credentials or acquired task authority"));
  }
  const expectedFingerprint = sha256(intentCore(intent));
  if (intent.intentFingerprint !== expectedFingerprint) {
    findings.push(finding("remote-intent-fingerprint", "error", intent.intentId, "remote intent fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-remote-supervisor-intent", {
    estateId: intent.estateId,
    requestKey: intent.requestKey,
    requestFingerprint: intent.requestFingerprint,
    intentFingerprint: expectedFingerprint,
  });
  if (intent.intentId !== expectedId) {
    findings.push(finding("remote-intent-identity", "error", intent.intentId, "remote intent identity is not content addressed"));
  }
  return sortedFindings(findings);
}

function intentPath(
  paths: AsoiafAnswerRemoteSupervisorPaths,
  intent: AsoiafAnswerRemoteSupervisorIntent,
): string {
  return digestPath(paths.intents, intent.intentFingerprint);
}

function runPath(
  paths: AsoiafAnswerRemoteSupervisorPaths,
  run: AsoiafAnswerRemoteSupervisorRun,
): string {
  return digestPath(paths.runs, run.runFingerprint);
}

function findIntentByRequestKey(
  root: string,
  requestKey: string,
): AsoiafAnswerRemoteSupervisorIntent | null {
  const matches = listJson<AsoiafAnswerRemoteSupervisorIntent>(
    asoiafAnswerRemoteSupervisorPaths(root).intents,
  ).filter((intent) => intent.requestKey === requestKey);
  if (matches.length > 1) {
    throw new Error(`remote supervisor request ${requestKey} has duplicate intents`);
  }
  return matches[0] ?? null;
}

function findRunByIntentId(
  root: string,
  intentId: string,
): AsoiafAnswerRemoteSupervisorRun | null {
  const matches = listJson<AsoiafAnswerRemoteSupervisorRun>(
    asoiafAnswerRemoteSupervisorPaths(root).runs,
  ).filter((run) => run.intentId === intentId);
  if (matches.length > 1) {
    throw new Error(`remote supervisor intent ${intentId} has duplicate runs`);
  }
  return matches[0] ?? null;
}

export function prepareAsoiafAnswerRemoteSupervisorIntent(
  input: AsoiafAnswerRemoteSupervisorTickInput,
): AsoiafAnswerRemoteSupervisorPrepareResult {
  ensureRemoteBaseValid(input.root);
  const requestKey = input.requestKey.trim();
  const existing = findIntentByRequestKey(input.root, requestKey);
  const projection = existing?.beforeProjection
    ?? planAsoiafAnswerDeskRemoteSupervisor({
      root: input.root,
      policy: input.policy,
      projectedAt: input.requestedAt,
    });
  const expected = buildIntent(input, projection);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(expected)) {
      throw new Error(`remote supervisor request ${requestKey} already has a different intent`);
    }
    return {
      projection,
      intent: existing,
      intentUri: relativeUri(
        input.root,
        intentPath(asoiafAnswerRemoteSupervisorPaths(input.root), existing),
      ),
      replayed: true,
    };
  }
  const errors = validateAsoiafAnswerRemoteSupervisorIntent(expected, input.root)
    .filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(`invalid remote supervisor intent ${expected.intentId}`);
  }
  const target = intentPath(asoiafAnswerRemoteSupervisorPaths(input.root), expected);
  const persisted = writeJsonExclusiveOrReplay(target, expected);
  return {
    projection,
    intent: persisted.value,
    intentUri: relativeUri(input.root, target),
    replayed: persisted.replayed,
  };
}

function outcomeForDecision(
  decision: AsoiafAnswerRemoteSupervisorDecisionKind,
): AsoiafAnswerRemoteSupervisorRunOutcome {
  switch (decision) {
    case "dispatch-external": return "external-dispatched";
    case "wait-rendezvous": return "waiting-rendezvous";
    case "run-automatic": return "automatic-rendered";
    case "wait-external": return "waiting-external";
    case "unbound-external": return "unbound-external";
    case "saturated-external": return "saturated-external";
    case "automatic-disabled": return "automatic-disabled";
    case "idle": return "idle";
  }
}

function buildRun(input: {
  intent: AsoiafAnswerRemoteSupervisorIntent;
  afterProjection: AsoiafAnswerRemoteSupervisorProjection;
  baseIntent: AsoiafAnswerSupervisorIntent | null;
  baseRun: AsoiafAnswerSupervisorRun | null;
  dispatch: AsoiafAnswerTransportDispatchReceipt | null;
  dispatchUri: string | null;
  assignment: AsoiafAnswerExchangeAssignment | null;
  networkAttempted: boolean;
  operationReplayed: boolean;
  completedAt: string;
}): AsoiafAnswerRemoteSupervisorRun {
  const core = {
    format: ASOIAF_ANSWER_REMOTE_SUPERVISOR_RUN_FORMAT,
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
    baseSupervisorIntentId: input.baseIntent?.intentId ?? null,
    baseSupervisorIntentFingerprint: input.baseIntent?.intentFingerprint ?? null,
    baseSupervisorRunId: input.baseRun?.runId ?? null,
    baseSupervisorRunFingerprint: input.baseRun?.runFingerprint ?? null,
    dispatchId: input.dispatch?.dispatchId ?? null,
    dispatchFingerprint: input.dispatch?.dispatchFingerprint ?? null,
    dispatchUri: input.dispatchUri,
    assignmentId: input.assignment?.assignmentId ?? null,
    assignmentFingerprint: input.assignment?.assignmentFingerprint ?? null,
    leaseId: input.assignment?.leaseId ?? input.baseRun?.leaseId ?? null,
    networkAttempted: input.networkAttempted,
    operationReplayed: input.operationReplayed,
    credentialMaterialRetained: false as const,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  const runFingerprint = sha256(core);
  return {
    ...core,
    runId: collectorContentId("asoiaf-answer-remote-supervisor-run", {
      intentId: core.intentId,
      outcome: core.outcome,
      runFingerprint,
    }),
    runFingerprint,
  };
}

function issuePayload(
  receipt: AsoiafAnswerTransportDispatchReceipt,
): AsoiafAnswerExchangeIssueResult {
  const response = receipt.envelope.response;
  if (
    receipt.statusCode !== 200
    || !receipt.envelope.ok
    || !response
    || response.outcome !== "succeeded"
    || response.payloadKind !== "answer-exchange-issue-result"
    || !response.payload
  ) {
    throw new Error("remote supervisor assignment dispatch did not return one successful typed issue result");
  }
  return response.payload as AsoiafAnswerExchangeIssueResult;
}

function baseTickInput(
  root: string,
  intent: AsoiafAnswerRemoteSupervisorIntent,
): AsoiafAnswerSupervisorTickInput {
  return {
    root,
    requestKey: intent.baseSupervisorRequestKey,
    policy: intent.policy.supervisorPolicy,
    requestedAt: intent.requestedAt,
    automaticCompletedAt: intent.automaticCompletedAt,
    operatorId: `${intent.operatorId}:base-supervisor`,
  };
}

export function validateAsoiafAnswerRemoteSupervisorRun(
  run: AsoiafAnswerRemoteSupervisorRun,
  intent: AsoiafAnswerRemoteSupervisorIntent,
  root: string,
): AsoiafAnswerRemoteSupervisorFinding[] {
  const findings = validateAsoiafAnswerRemoteSupervisorIntent(intent, root);
  if (
    run.format !== ASOIAF_ANSWER_REMOTE_SUPERVISOR_RUN_FORMAT
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
  ) {
    findings.push(finding("remote-run-custody", "error", run.runId, "remote run differs from its intent, time, or final projection custody"));
  }
  findings.push(...validateAsoiafAnswerRemoteSupervisorProjection(run.afterProjection, root));
  const delegated = run.decisionKind !== "wait-rendezvous";
  if (delegated) {
    if (
      !run.baseSupervisorIntentId
      || !run.baseSupervisorIntentFingerprint
      || !run.baseSupervisorRunId
      || !run.baseSupervisorRunFingerprint
    ) {
      findings.push(finding("remote-run-supervisor", "error", run.runId, "delegated remote run lacks exact base supervisor intent and run custody"));
    }
  } else if (
    run.baseSupervisorIntentId !== null
    || run.baseSupervisorIntentFingerprint !== null
    || run.baseSupervisorRunId !== null
    || run.baseSupervisorRunFingerprint !== null
    || run.dispatchId !== null
    || run.dispatchFingerprint !== null
    || run.assignmentId !== null
    || run.assignmentFingerprint !== null
    || run.leaseId !== null
    || run.networkAttempted
    || run.operationReplayed
  ) {
    findings.push(finding("remote-run-wait", "error", run.runId, "rendezvous-wait run acquired base supervisor or transport operation custody"));
  }
  if (run.decisionKind === "dispatch-external") {
    if (
      !run.dispatchId
      || !run.dispatchFingerprint
      || !run.dispatchUri
      || !run.assignmentId
      || !run.assignmentFingerprint
      || !run.leaseId
    ) {
      findings.push(finding("remote-run-dispatch", "error", run.runId, "external remote run lacks dispatch, assignment, or lease custody"));
    }
  } else if (
    run.dispatchId !== null
    || run.dispatchFingerprint !== null
    || run.dispatchUri !== null
    || run.assignmentId !== null
    || run.assignmentFingerprint !== null
    || (run.decisionKind !== "run-automatic" && run.leaseId !== null)
    || run.networkAttempted
  ) {
    findings.push(finding("remote-run-nondispatch", "error", run.runId, "non-external remote run acquired network dispatch or assignment custody"));
  }
  if (
    run.credentialMaterialRetained !== false
    || run.authority !== "none"
    || run.graphEffect !== "none"
    || run.canonEffect !== "none"
    || run.answerEffect !== "none"
  ) {
    findings.push(finding("remote-run-authority", "error", run.runId, "remote run retained credentials or acquired task authority"));
  }
  const expectedFingerprint = sha256(runCore(run));
  if (run.runFingerprint !== expectedFingerprint) {
    findings.push(finding("remote-run-fingerprint", "error", run.runId, "remote run fingerprint is stale"));
  }
  const expectedId = collectorContentId("asoiaf-answer-remote-supervisor-run", {
    intentId: run.intentId,
    outcome: run.outcome,
    runFingerprint: expectedFingerprint,
  });
  if (run.runId !== expectedId) {
    findings.push(finding("remote-run-identity", "error", run.runId, "remote run identity is not content addressed"));
  }
  return sortedFindings(findings);
}

function lowerRunFindings(
  root: string,
  run: AsoiafAnswerRemoteSupervisorRun,
): AsoiafAnswerRemoteSupervisorFinding[] {
  const findings: AsoiafAnswerRemoteSupervisorFinding[] = [];
  const supervisor = readAsoiafAnswerSupervisorStatus(root);
  const operations = readAsoiafAnswerTransportOperationsStatus(root);
  const baseIntent = run.baseSupervisorIntentId
    ? supervisor.intents.find((entry) => entry.intentId === run.baseSupervisorIntentId) ?? null
    : null;
  const baseRun = run.baseSupervisorRunId
    ? supervisor.runs.find((entry) => entry.runId === run.baseSupervisorRunId) ?? null
    : null;
  const dispatch = run.dispatchId
    ? operations.dispatches.find((entry) => entry.dispatchId === run.dispatchId) ?? null
    : null;
  if (run.baseSupervisorIntentId && (
    !baseIntent
    || baseIntent.intentFingerprint !== run.baseSupervisorIntentFingerprint
  )) {
    findings.push(finding("remote-run-base-intent-missing", "error", run.runId, "base supervisor intent is absent or differs from retained fingerprint custody"));
  }
  if (run.baseSupervisorRunId && (
    !baseRun
    || baseRun.runFingerprint !== run.baseSupervisorRunFingerprint
  )) {
    findings.push(finding("remote-run-base-run-missing", "error", run.runId, "base supervisor run is absent or differs from retained fingerprint custody"));
  }
  if (baseRun && baseIntent) {
    for (const entry of validateAsoiafAnswerSupervisorRun(baseRun, baseIntent)) {
      findings.push(finding(`supervisor:${entry.code}`, entry.severity, entry.subjectId, entry.detail));
    }
  }
  if (run.dispatchId && (
    !dispatch
    || dispatch.dispatchFingerprint !== run.dispatchFingerprint
  )) {
    findings.push(finding("remote-run-dispatch-missing", "error", run.runId, "operations dispatch is absent or differs from retained fingerprint custody"));
  }
  if (run.dispatchUri) {
    const target = resolveEstateUri(root, run.dispatchUri);
    if (!target || !fs.existsSync(target)) {
      findings.push(finding("remote-run-dispatch-uri", "error", run.runId, "dispatch URI is absent or escapes the holder-controlled estate"));
    }
  }
  if (run.decisionKind === "dispatch-external" && dispatch && baseRun) {
    try {
      const payload = issuePayload(dispatch);
      const assignment = payload.assignment;
      if (
        assignment.assignmentId !== run.assignmentId
        || assignment.assignmentFingerprint !== run.assignmentFingerprint
        || assignment.leaseId !== run.leaseId
        || !baseRun.operationReferences.some(
          (reference) =>
            reference.kind === "answer-exchange-assignment"
            && reference.objectId === assignment.assignmentId
            && reference.fingerprint === assignment.assignmentFingerprint,
        )
        || baseRun.decisionKind !== "issue-external"
        || !baseRun.operationReplayed
      ) {
        findings.push(finding("remote-run-dispatch-replay", "error", run.runId, "network dispatch, assignment, and replayed base supervisor run do not identify the same lower operation"));
      }
    } catch (error) {
      findings.push(finding("remote-run-dispatch-payload", "error", run.runId, error instanceof Error ? error.message : String(error)));
    }
  }
  return sortedFindings(findings);
}

export async function tickAsoiafAnswerDeskRemoteSupervisor(
  input: AsoiafAnswerRemoteSupervisorTickInput,
): Promise<AsoiafAnswerRemoteSupervisorTickResult> {
  ensureRemoteBaseValid(input.root);
  const prepared = prepareAsoiafAnswerRemoteSupervisorIntent(input);
  const existingRun = findRunByIntentId(input.root, prepared.intent.intentId);
  if (existingRun) {
    const errors = [
      ...validateAsoiafAnswerRemoteSupervisorRun(existingRun, prepared.intent, input.root),
      ...lowerRunFindings(input.root, existingRun),
    ].filter((entry) => entry.severity === "error");
    if (errors.length > 0) {
      throw new Error(`invalid retained remote supervisor run ${existingRun.runId}`);
    }
    const supervisor = readAsoiafAnswerSupervisorStatus(input.root);
    const operations = readAsoiafAnswerTransportOperationsStatus(input.root);
    return {
      intent: prepared.intent,
      intentReplayed: true,
      run: existingRun,
      runReplayed: true,
      baseSupervisorIntent: existingRun.baseSupervisorIntentId
        ? supervisor.intents.find((entry) => entry.intentId === existingRun.baseSupervisorIntentId) ?? null
        : null,
      baseSupervisorRun: existingRun.baseSupervisorRunId
        ? supervisor.runs.find((entry) => entry.runId === existingRun.baseSupervisorRunId) ?? null
        : null,
      dispatch: existingRun.dispatchId
        ? operations.dispatches.find((entry) => entry.dispatchId === existingRun.dispatchId) ?? null
        : null,
      dispatchReplayed: existingRun.dispatchId !== null,
      networkAttempted: false,
    };
  }

  let baseIntent: AsoiafAnswerSupervisorIntent | null = null;
  let baseRun: AsoiafAnswerSupervisorRun | null = null;
  let dispatchReceipt: AsoiafAnswerTransportDispatchReceipt | null = null;
  let dispatchUri: string | null = null;
  let assignment: AsoiafAnswerExchangeAssignment | null = null;
  let dispatchReplayed = false;
  let networkAttempted = false;
  let operationReplayed = false;
  let completedAt = prepared.intent.requestedAt;

  if (prepared.intent.decision.kind === "dispatch-external") {
    const baseInput = baseTickInput(input.root, prepared.intent);
    const basePrepared = prepareAsoiafAnswerSupervisorIntent(baseInput);
    baseIntent = basePrepared.intent;
    const remoteBinding = prepared.intent.policy.remoteBindings.find(
      (entry) => entry.bindingId === prepared.intent.decision.remoteBindingId,
    );
    if (!remoteBinding) {
      throw new Error("remote supervisor intent lacks its exact remote actor binding");
    }
    const operations = readAsoiafAnswerTransportOperationsStatus(input.root);
    const rendezvous = operations.rendezvous.find(
      (entry) => entry.rendezvousId === remoteBinding.rendezvousId,
    );
    if (!rendezvous || rendezvous.rendezvousFingerprint !== remoteBinding.rendezvousFingerprint) {
      throw new Error("remote supervisor intent rendezvous is absent or changed");
    }
    const body: AsoiafAnswerTransportIssueBody = {
      itemId: prepared.intent.decision.itemId,
      claimedAt: prepared.intent.requestedAt,
      issuedAt: prepared.intent.requestedAt,
      leaseMilliseconds: prepared.intent.decision.leaseMilliseconds!,
    };
    const idempotencyKey = dispatchIdempotencyKey({
      estateId: prepared.intent.estateId,
      requestKey: prepared.intent.requestKey,
      policyFingerprint: prepared.intent.policyFingerprint,
      beforeProjectionFingerprint: prepared.intent.beforeProjectionFingerprint,
    });
    const retainedDispatch = operations.dispatches.find(
      (entry) => entry.idempotencyKeyDigest === prepared.intent.dispatchIdempotencyKeyDigest,
    ) ?? null;
    if (retainedDispatch) {
      if (
        retainedDispatch.operation !== "issue-assignment"
        || retainedDispatch.bodyDigest !== sha256(body)
        || retainedDispatch.rendezvousId !== rendezvous.rendezvousId
        || retainedDispatch.rendezvousFingerprint !== rendezvous.rendezvousFingerprint
        || retainedDispatch.clientCertificateFingerprint !== remoteBinding.certificateFingerprint
      ) {
        throw new Error("retained remote supervisor dispatch differs from the exact intent operation custody");
      }
      dispatchReceipt = retainedDispatch;
      dispatchUri = relativeUri(
        input.root,
        digestPath(
          asoiafAnswerTransportOperationsPaths(input.root).dispatches,
          retainedDispatch.idempotencyKeyDigest,
        ),
      );
      dispatchReplayed = true;
      networkAttempted = false;
    } else {
      const credentials = input.credentials;
      if (!credentials) {
        throw new Error("remote external dispatch requires ephemeral certificate and private-key material");
      }
      if (credentials.certificateAdmissionId !== prepared.intent.decision.certificateAdmissionId) {
        throw new Error("remote external dispatch credentials differ from the intent certificate admission");
      }
      const dispatched = await dispatchAsoiafAnswerTransport({
        root: input.root,
        rendezvous,
        operation: "issue-assignment",
        body,
        idempotencyKey,
        clientCertificate: credentials.clientCertificate,
        clientPrivateKey: credentials.clientPrivateKey,
        serverCertificateAuthority: credentials.serverCertificateAuthority,
        dispatchedAt: prepared.intent.requestedAt,
        timeoutMilliseconds: credentials.timeoutMilliseconds,
      });
      dispatchReceipt = dispatched.receipt;
      dispatchUri = dispatched.receiptUri;
      dispatchReplayed = dispatched.replayed;
      networkAttempted = dispatched.networkAttempted;
    }
    assignment = issuePayload(dispatchReceipt!).assignment;
    const baseTick = tickAsoiafAnswerDeskSupervisor(baseInput);
    baseIntent = baseTick.intent;
    baseRun = baseTick.run;
    if (
      baseRun.decisionKind !== "issue-external"
      || baseRun.actorId !== prepared.intent.decision.actorId
      || baseRun.actorRole !== prepared.intent.decision.actorRole
      || baseRun.itemId !== prepared.intent.decision.itemId
      || baseRun.leaseId !== assignment.leaseId
      || !baseRun.operationReplayed
    ) {
      throw new Error("base supervisor did not replay the exact remotely dispatched assignment");
    }
    operationReplayed = dispatchReplayed
      && baseTick.intentReplayed
      && baseTick.runReplayed;
    completedAt = dispatchReceipt!.completedAt;
  } else if (prepared.intent.decision.kind !== "wait-rendezvous") {
    const baseTick = tickAsoiafAnswerDeskSupervisor(
      baseTickInput(input.root, prepared.intent),
    );
    baseIntent = baseTick.intent;
    baseRun = baseTick.run;
    operationReplayed = baseTick.runReplayed;
    completedAt = baseTick.run.completedAt;
  }

  const afterProjection = planAsoiafAnswerDeskRemoteSupervisor({
    root: input.root,
    policy: prepared.intent.policy,
    projectedAt: completedAt,
  });
  const run = buildRun({
    intent: prepared.intent,
    afterProjection,
    baseIntent,
    baseRun,
    dispatch: dispatchReceipt,
    dispatchUri,
    assignment,
    networkAttempted,
    operationReplayed,
    completedAt,
  });
  const errors = [
    ...validateAsoiafAnswerRemoteSupervisorRun(run, prepared.intent, input.root),
    ...lowerRunFindings(input.root, run),
  ].filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(`invalid remote supervisor run ${run.runId}: ${errors
      .map((entry) => `${entry.code}:${entry.subjectId}`)
      .join(", ")}`);
  }
  const target = runPath(asoiafAnswerRemoteSupervisorPaths(input.root), run);
  const persisted = writeJsonExclusiveOrReplay(target, run);
  return {
    intent: prepared.intent,
    intentReplayed: prepared.replayed,
    run: persisted.value,
    runReplayed: persisted.replayed,
    baseSupervisorIntent: baseIntent,
    baseSupervisorRun: baseRun,
    dispatch: dispatchReceipt,
    dispatchReplayed,
    networkAttempted,
  };
}

export function readAsoiafAnswerRemoteSupervisorStatus(
  root: string,
  policy?: AsoiafAnswerRemoteSupervisorPolicy | null,
  projectedAt?: string | null,
): AsoiafAnswerRemoteSupervisorStatus {
  const paths = asoiafAnswerRemoteSupervisorPaths(root);
  const intents = listJson<AsoiafAnswerRemoteSupervisorIntent>(paths.intents);
  const runs = listJson<AsoiafAnswerRemoteSupervisorRun>(paths.runs);
  const runIntentIds = new Set(runs.map((run) => run.intentId));
  return {
    paths,
    projection: policy && projectedAt
      ? planAsoiafAnswerDeskRemoteSupervisor({ root, policy, projectedAt })
      : null,
    intents,
    runs,
    pendingIntentIds: intents
      .filter((intent) => !runIntentIds.has(intent.intentId))
      .map((intent) => intent.intentId)
      .sort(),
  };
}

function secretMaterialFinding(
  root: string,
): AsoiafAnswerRemoteSupervisorFinding[] {
  const findings: AsoiafAnswerRemoteSupervisorFinding[] = [];
  const paths = asoiafAnswerRemoteSupervisorPaths(root);
  if (!fs.existsSync(paths.remoteSupervisorRoot)) return findings;
  const forbiddenName = /(?:^|[-_.])(private[-_.]?key|client[-_.]?certificate|server[-_.]?certificate[-_.]?authority|certificate[-_.]?path|key[-_.]?path)(?:[-_.]|$)/i;
  const pemMarker = /-----BEGIN (?:CERTIFICATE|PRIVATE KEY|RSA PRIVATE KEY|EC PRIVATE KEY|CERTIFICATE REQUEST)-----/;
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(target);
        continue;
      }
      if (forbiddenName.test(entry.name)) {
        findings.push(finding("remote-secret-filename", "error", relativeUri(root, target), "remote supervisor estate contains a credential-bearing filename"));
      }
      const content = fs.readFileSync(target, "utf8");
      if (pemMarker.test(content)) {
        findings.push(finding("remote-secret-material", "error", relativeUri(root, target), "remote supervisor estate contains certificate, CSR, or private-key PEM material"));
      }
      if (/"(?:clientCertificate|clientPrivateKey|serverCertificateAuthority|certificatePath|privateKeyPath)"\s*:/.test(content)) {
        findings.push(finding("remote-secret-field", "error", relativeUri(root, target), "remote supervisor estate retains an ephemeral credential field"));
      }
    }
  };
  visit(paths.remoteSupervisorRoot);
  return sortedFindings(findings);
}

export function verifyAsoiafAnswerRemoteSupervisorEstate(
  root: string,
): AsoiafAnswerRemoteSupervisorFinding[] {
  const findings: AsoiafAnswerRemoteSupervisorFinding[] = [];
  for (const entry of verifyAsoiafAnswerSupervisorEstate(root)) {
    findings.push(finding(`supervisor:${entry.code}`, entry.severity, entry.subjectId, entry.detail));
  }
  for (const entry of verifyAsoiafAnswerTransportOperationsEstate(root)) {
    findings.push(finding(`operations:${entry.code}`, entry.severity, entry.objectId, entry.message));
  }
  const status = readAsoiafAnswerRemoteSupervisorStatus(root);
  const intentsById = new Map<string, AsoiafAnswerRemoteSupervisorIntent>();
  const intentsByRequest = new Map<string, AsoiafAnswerRemoteSupervisorIntent>();
  for (const intent of status.intents) {
    findings.push(...validateAsoiafAnswerRemoteSupervisorIntent(intent, root));
    if (intentsById.has(intent.intentId)) {
      findings.push(finding("remote-intent-duplicate", "error", intent.intentId, "remote intent identity is duplicated"));
    }
    if (intentsByRequest.has(intent.requestKey)) {
      findings.push(finding("remote-request-duplicate", "error", intent.requestKey, "remote request key has multiple intents"));
    }
    intentsById.set(intent.intentId, intent);
    intentsByRequest.set(intent.requestKey, intent);
  }
  const runsByIntent = new Map<string, AsoiafAnswerRemoteSupervisorRun>();
  for (const run of status.runs) {
    if (runsByIntent.has(run.intentId)) {
      findings.push(finding("remote-run-duplicate", "error", run.intentId, "remote intent has multiple runs"));
    }
    runsByIntent.set(run.intentId, run);
    const intent = intentsById.get(run.intentId);
    if (!intent) {
      findings.push(finding("remote-run-intent-missing", "error", run.runId, "remote run references an absent intent"));
      continue;
    }
    findings.push(...validateAsoiafAnswerRemoteSupervisorRun(run, intent, root));
    findings.push(...lowerRunFindings(root, run));
  }
  for (const intent of status.intents) {
    if (!runsByIntent.has(intent.intentId)) {
      findings.push(finding("remote-intent-pending", "warning", intent.intentId, "remote intent has no retained run and may be resumed with the exact request"));
    }
  }
  for (const [directory, code] of [
    [status.paths.intents, "remote-intent-name"],
    [status.paths.runs, "remote-run-name"],
  ] as const) {
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory).sort()) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) {
        findings.push(finding(code, "error", name, "remote supervisor filename is not a SHA-256 digest"));
      }
    }
  }
  findings.push(...secretMaterialFinding(root));
  return sortedFindings(findings);
}
