import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  collectorContentId,
  sha256,
} from "../../../tools/lib/asoiaf-external-estate.js";

function contentAddress<
  T extends Record<string, unknown>,
  I extends string,
  F extends string,
>(
  prefix: string,
  core: T,
  idKey: I,
  fingerprintKey: F,
): T & Record<I, string> & Record<F, `sha256:${string}`> {
  const fingerprint = sha256(core);
  return {
    ...core,
    [idKey]: collectorContentId(prefix, { fingerprint }),
    [fingerprintKey]: fingerprint,
  } as T & Record<I, string> & Record<F, `sha256:${string}`>;
}

const actorRole = "exact-locator-reviewer" as const;
const providerBindingCore = {
  format: "axm-asoiaf-answer-credential-broker-binding/1",
  policyId: "policy:runtime-test",
  policyFingerprint: sha256("policy:runtime-test"),
  deploymentStateId: "deployment-state:runtime-test",
  deploymentStateFingerprint: sha256("deployment-state:runtime-test"),
  deploymentStateAsOf: "2026-08-07T00:00:00.000Z",
  deploymentStateOrigin: "activation",
  planId: "plan:runtime-test",
  planFingerprint: sha256("plan:runtime-test"),
  activationId: "activation:runtime-test",
  activationFingerprint: sha256("activation:runtime-test"),
  deviceId: "device:runtime-test",
  deviceFingerprint: sha256("device:runtime-test"),
  deviceAgentId: "device-agent:runtime-test",
  deviceAgentPublicKeyFingerprint: sha256("device-agent-key:runtime-test"),
  keyReferenceId: "key-reference:runtime-test",
  keyReferenceFingerprint: sha256("key-reference:runtime-test"),
  providerClass: "synthetic-fixture",
  providerHandleDigest: sha256("provider-handle:runtime-test"),
  publicKeyFingerprint: sha256("public-key:runtime-test"),
  certificateFingerprint: sha256("provider-certificate:runtime-test"),
  issuerCertificateFingerprint: sha256("provider-issuer:runtime-test"),
  serviceId: "service:runtime-test",
  principalId: "actor:provider:runtime-test",
  actorRole,
  certificateValidUntil: "2026-08-08T00:00:00.000Z",
  boundAt: "2026-08-07T00:00:00.000Z",
  operatorId: "operator:runtime-test:binding",
  certificateRetained: false,
  privateKeyRetained: false,
  rawProviderHandleRetained: false,
  providerSecretRetained: false,
  bindingAuthority: "active-deployment-reference-only",
  authority: "none",
  graphEffect: "none",
  canonEffect: "none",
  answerEffect: "none",
} as const;
const providerBinding = contentAddress(
  "asoiaf-answer-credential-broker-binding",
  providerBindingCore,
  "bindingId",
  "bindingFingerprint",
);
const providerProfileCore = {
  format: "axm-asoiaf-answer-credential-provider-profile/1",
  brokerPolicyId: providerBinding.policyId,
  brokerPolicyFingerprint: providerBinding.policyFingerprint,
  brokerBindingId: providerBinding.bindingId,
  brokerBindingFingerprint: providerBinding.bindingFingerprint,
  deploymentStateId: providerBinding.deploymentStateId,
  deploymentStateFingerprint: providerBinding.deploymentStateFingerprint,
  deviceId: providerBinding.deviceId,
  serviceId: providerBinding.serviceId,
  keyReferenceId: providerBinding.keyReferenceId,
  providerClass: "synthetic-fixture",
  hostKind: "synthetic-fixture",
  credentialSelectorDigest: sha256("credential-selector:runtime-test"),
  deviceAgentSelectorDigest: sha256("device-agent-selector:runtime-test"),
  allowedTargetOrigins: ["https://runtime.example.test"],
  maxResponseBytes: 65536,
  createdAt: "2026-08-07T00:00:00.000Z",
  operatorId: "operator:runtime-test:profile",
  localExecutionOnly: true,
  certificateRetained: false,
  privateKeyRetained: false,
  privateKeyPathRetained: false,
  rawProviderSelectorRetained: false,
  providerSecretRetained: false,
  rawResponseRetained: false,
  profileAuthority: "provider-routing-only",
  authority: "none",
  graphEffect: "none",
  canonEffect: "none",
  answerEffect: "none",
} as const;
const providerProfile = contentAddress(
  "asoiaf-answer-credential-provider-profile",
  providerProfileCore,
  "profileId",
  "profileFingerprint",
);
const providerResultCore = {
  format: "axm-asoiaf-answer-credential-provider-result/1",
  providerInvocationId: "provider-invocation:runtime-test",
  providerInvocationFingerprint: sha256("provider-invocation:runtime-test"),
  profileId: providerProfile.profileId,
  profileFingerprint: providerProfile.profileFingerprint,
  brokerInvocationId: "broker-invocation:runtime-test",
  brokerInvocationFingerprint: sha256("broker-invocation:runtime-test"),
  hostKind: "synthetic-fixture",
  providerClass: "synthetic-fixture",
  operation: "prove-possession",
  startedAt: "2026-08-07T00:00:00.000Z",
  completedAt: "2026-08-07T00:00:01.000Z",
  providerReceiptDigest: sha256("provider-receipt:runtime-test"),
  output: {
    kind: "possession-proof",
    signatureAlgorithm: "ed25519",
    signatureBase64: "AA==",
    signatureDigest: sha256(Buffer.from([0])),
    provedAt: "2026-08-07T00:00:01.000Z",
    brokerAdmissionInput: {
      invocationId: "broker-invocation:runtime-test",
      signatureAlgorithm: "ed25519",
      signatureBase64: "AA==",
      provedAt: "2026-08-07T00:00:01.000Z",
      operatorId: "operator:runtime-test:provider",
    },
  },
  certificateRetained: false,
  privateKeyRetained: false,
  privateKeyPathRetained: false,
  rawProviderSelectorRetained: false,
  providerSecretRetained: false,
  rawResponseRetained: false,
  resultAuthority: "public-provider-proof-only",
  authority: "none",
  graphEffect: "none",
  canonEffect: "none",
  answerEffect: "none",
} as const;
const providerResult = contentAddress(
  "asoiaf-answer-credential-provider-result",
  providerResultCore,
  "resultId",
  "resultFingerprint",
);

function delivery(label: string, actorId: string, certificateFingerprint: `sha256:${string}`) {
  const assignmentCore = {
    format: "axm-asoiaf-answer-exchange-assignment/1",
    workerManifestFingerprint: sha256(`worker:${label}`),
    workOrderId: `work-order:${label}`,
    workOrderFingerprint: sha256(`work-order:${label}`),
    dossierId: "dossier:runtime-test",
    questionId: "question:runtime-test",
    itemId: `item:${label}`,
    itemFingerprint: sha256(`item:${label}`),
    itemKey: sha256(`item-key:${label}`),
    action: "review-exact-locator",
    stage: "review",
    subjectIds: ["subject:runtime-test"],
    dependencyItemIds: [],
    actorId,
    actorRole,
    claimedAt: "2026-08-07T00:00:02.000Z",
    issuedAt: "2026-08-07T00:00:02.000Z",
    expiresAt: "2026-08-07T00:10:00.000Z",
    leaseMilliseconds: 598000,
    leaseId: `lease:${label}`,
    leaseFingerprint: sha256(`lease:${label}`),
    networkAccess: "none",
    privateTextAccess: "none",
    humanReview: "required",
    acceptedResultKinds: ["reviewed-answer-transaction"],
    privateTextIncluded: false,
    sourceTextIncluded: false,
    workOrder: {},
    lease: {},
    authority: "none",
    graphEffect: "none",
    canonEffect: "none",
    answerEffect: "none",
  } as const;
  const assignment = contentAddress(
    "asoiaf-answer-exchange-assignment",
    assignmentCore,
    "assignmentId",
    "assignmentFingerprint",
  );
  const core = {
    format: "axm-asoiaf-answer-supervised-assignment-delivery/1",
    requestId: `request:${label}`,
    requestFingerprint: sha256(`request:${label}`),
    intentId: `intent:${label}`,
    intentFingerprint: sha256(`intent:${label}`),
    supervisorRunId: `run:${label}`,
    supervisorRunFingerprint: sha256(`run:${label}`),
    policyFingerprint: sha256("policy:runtime-test:delivery"),
    actorId,
    actorRole,
    certificateAdmissionId: `admission:${label}`,
    certificateAdmissionFingerprint: sha256(`admission:${label}`),
    certificateFingerprint,
    rendezvousId: `rendezvous:${label}`,
    rendezvousFingerprint: sha256(`rendezvous:${label}`),
    endpointLeaseId: `endpoint:${label}`,
    endpointLeaseFingerprint: sha256(`endpoint:${label}`),
    assignmentId: assignment.assignmentId,
    assignmentFingerprint: assignment.assignmentFingerprint,
    assignmentUri: `answer-exchange/assignments/${label}.json`,
    assignment,
    leaseId: assignment.leaseId,
    leaseFingerprint: assignment.leaseFingerprint,
    lowerTransportRequestId: `lower-request:${label}`,
    lowerTransportRequestFingerprint: sha256(`lower-request:${label}`),
    lowerTransportResponseId: `lower-response:${label}`,
    lowerTransportResponseFingerprint: sha256(`lower-response:${label}`),
    deliveredAt: "2026-08-07T00:00:03.000Z",
    supervisorIntentReplayed: false,
    supervisorRunReplayed: false,
    assignmentReplayed: false,
    lowerTransportRequestReplayed: false,
    lowerTransportResponseReplayed: false,
    certificateRetained: false,
    privateKeyRetained: false,
    privateTextIncluded: false,
    sourceTextIncluded: false,
    authority: "none",
    graphEffect: "none",
    canonEffect: "none",
    answerEffect: "none",
  } as const;
  return contentAddress(
    "asoiaf-answer-supervised-delivery",
    core,
    "deliveryId",
    "deliveryFingerprint",
  );
}

const certificateOne = sha256("delivery-certificate:one");
const certificateTwo = sha256("delivery-certificate:two");
const deliveryOne = delivery("one", "actor:runtime-test:one", certificateOne);
const deliveryTwo = delivery("two", "actor:runtime-test:two", certificateTwo);
const resultReference = {
  kind: "reviewed-answer-transaction",
  objectId: "transaction:runtime-test",
  fingerprint: sha256("transaction:runtime-test"),
  uri: null,
};
const exchangeResultCore = {
  format: "axm-asoiaf-answer-exchange-result/1",
  assignmentId: deliveryOne.assignmentId,
  assignmentFingerprint: deliveryOne.assignmentFingerprint,
  leaseId: deliveryOne.leaseId,
  leaseFingerprint: deliveryOne.leaseFingerprint,
  workOrderId: deliveryOne.assignment.workOrderId,
  workOrderFingerprint: deliveryOne.assignment.workOrderFingerprint,
  itemId: deliveryOne.assignment.itemId,
  itemFingerprint: deliveryOne.assignment.itemFingerprint,
  itemKey: deliveryOne.assignment.itemKey,
  action: deliveryOne.assignment.action,
  actorId: deliveryOne.actorId,
  actorRole,
  claimedAt: deliveryOne.assignment.claimedAt,
  issuedAt: deliveryOne.assignment.issuedAt,
  completedAt: "2026-08-07T00:00:06.000Z",
  outcome: "satisfied",
  afterWorkOrderId: null,
  afterWorkOrderFingerprint: null,
  afterWorkOrder: null,
  resultReferences: [resultReference],
  reason: "The runtime test retains one exact reviewed transaction reference for the delivered assignment.",
  declaredNetworkAccess: "none",
  declaredPrivateTextAccess: "none",
  declaredHumanReview: "required",
  authority: "none",
  graphEffect: "none",
  canonEffect: "none",
  answerEffect: "none",
} as const;
const exchangeResult = contentAddress(
  "asoiaf-answer-exchange-result",
  exchangeResultCore,
  "resultId",
  "resultFingerprint",
);
const supervisedReturnCore = {
  format: "axm-asoiaf-answer-supervised-result-return/1",
  requestId: "return-request:runtime-test",
  requestFingerprint: sha256("return-request:runtime-test"),
  deliveryId: deliveryOne.deliveryId,
  deliveryFingerprint: deliveryOne.deliveryFingerprint,
  actorId: deliveryOne.actorId,
  actorRole,
  certificateAdmissionId: deliveryOne.certificateAdmissionId,
  certificateAdmissionFingerprint: deliveryOne.certificateAdmissionFingerprint,
  certificateFingerprint: deliveryOne.certificateFingerprint,
  rendezvousId: deliveryOne.rendezvousId,
  rendezvousFingerprint: deliveryOne.rendezvousFingerprint,
  assignmentId: deliveryOne.assignmentId,
  assignmentFingerprint: deliveryOne.assignmentFingerprint,
  lowerTransportRequestId: "return-lower-request:runtime-test",
  lowerTransportRequestFingerprint: sha256("return-lower-request:runtime-test"),
  lowerTransportResponseId: "return-lower-response:runtime-test",
  lowerTransportResponseFingerprint: sha256("return-lower-response:runtime-test"),
  resultId: exchangeResult.resultId,
  resultFingerprint: exchangeResult.resultFingerprint,
  settlementId: "settlement:runtime-test",
  settlementFingerprint: sha256("settlement:runtime-test"),
  afterWorkOrderId: null,
  afterWorkOrderFingerprint: null,
  completedAt: "2026-08-07T00:00:08.000Z",
  lowerTransportRequestReplayed: false,
  lowerTransportResponseReplayed: false,
  resultReplayed: false,
  settlementReplayed: false,
  certificateRetained: false,
  privateKeyRetained: false,
  privateTextIncluded: false,
  sourceTextIncluded: false,
  authority: "none",
  graphEffect: "none",
  canonEffect: "none",
  answerEffect: "none",
} as const;
const supervisedReturn = contentAddress(
  "asoiaf-answer-supervised-return",
  supervisedReturnCore,
  "returnId",
  "returnFingerprint",
);

let runtime: typeof import("../../../tools/lib/asoiaf-answer-actor-runtime.js");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-actor-runtime-unit-"));

beforeAll(async () => {
  vi.doMock("../../../tools/lib/asoiaf-answer-desk-supervised-delivery.js", () => ({
    readAsoiafAnswerSupervisedDeliveryStatus: () => ({
      paths: {}, requests: [], responses: [], deliveries: [deliveryOne, deliveryTwo], returns: [supervisedReturn],
    }),
    verifyAsoiafAnswerSupervisedDeliveryEstate: () => [],
  }));
  vi.doMock("../../../tools/lib/asoiaf-answer-desk-exchange.js", () => ({
    readAsoiafAnswerExchangeStatus: () => ({ paths: {}, plan: {}, assignments: [], results: [exchangeResult] }),
  }));
  vi.doMock("../../../tools/lib/asoiaf-answer-credential-provider-host.js", () => ({
    readAsoiafAnswerCredentialProviderStatus: () => ({
      format: "axm-asoiaf-answer-credential-provider-status/1",
      paths: {}, profiles: [providerProfile], invocations: [], results: [providerResult], state: null,
    }),
    verifyAsoiafAnswerCredentialProviderHostEstate: () => [],
  }));
  vi.doMock("../../../tools/lib/asoiaf-answer-credential-broker.js", () => ({
    readAsoiafAnswerCredentialBrokerStatus: () => ({
      paths: {}, policies: [], bindings: [providerBinding], invocations: [], proofs: [], transportResults: [], state: null,
    }),
  }));
  vi.doMock("../../../tools/lib/asoiaf-answer-work-order.js", () => ({
    validateAsoiafAnswerWorkOrder: () => [],
  }));
  runtime = await import("../../../tools/lib/asoiaf-answer-actor-runtime.js");
});

afterAll(() => {
  vi.resetModules();
  vi.clearAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("ASOIAF actor runtime and durable mailbox", () => {
  it("binds delivery credentials to explicit provider slots without retaining secrets", () => {
    const first = runtime.retainAsoiafAnswerActorRuntimeSlot({
      root,
      actorId: deliveryOne.actorId,
      actorRole,
      deliveryCertificateFingerprint: certificateOne,
      providerProfileId: providerProfile.profileId,
      credentialRelationship: "explicit-delegation",
      delegationReason: "The holder explicitly assigns the provider credential to this certificate-bound test actor without transferring task authority.",
      createdAt: "2026-08-07T00:00:02.000Z",
      operatorId: "operator:runtime-test:slot-one",
    });
    const replay = runtime.retainAsoiafAnswerActorRuntimeSlot({
      root,
      actorId: deliveryOne.actorId,
      actorRole,
      deliveryCertificateFingerprint: certificateOne,
      providerProfileId: providerProfile.profileId,
      credentialRelationship: "explicit-delegation",
      delegationReason: "The holder explicitly assigns the provider credential to this certificate-bound test actor without transferring task authority.",
      createdAt: "2026-08-07T00:00:02.000Z",
      operatorId: "operator:runtime-test:slot-one",
    });
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(first.slot.privateKeyRetained).toBe(false);
    expect(first.slot.certificateRetained).toBe(false);
  });

  it("runs digest-only execution through durable return acknowledgement and bounded retirement", () => {
    const slot = runtime.readAsoiafAnswerActorRuntimeStatus(root).slots[0]!;
    const acceptance = runtime.acceptAsoiafAnswerActorRuntimeDelivery({
      root,
      slotId: slot.slotId,
      deliveryId: deliveryOne.deliveryId,
      importedAt: "2026-08-07T00:00:03.000Z",
      operatorId: "operator:runtime-test:accept-one",
    }).acceptance;
    const intent = runtime.prepareAsoiafAnswerActorRuntimeExecution({
      root,
      acceptanceId: acceptance.acceptanceId,
      adapterId: "adapter:runtime-test",
      adapterVersion: "1.0.0",
      inputDigest: sha256("runtime-test-input"),
      inputBytes: 18,
      preparedAt: "2026-08-07T00:00:04.000Z",
      expiresAt: "2026-08-07T00:09:00.000Z",
      operatorId: "operator:runtime-test:prepare-one",
    }).intent;
    const result = runtime.recordAsoiafAnswerActorRuntimeResult({
      root,
      executionIntentId: intent.executionIntentId,
      providerResultId: providerResult.resultId,
      outcome: "satisfied",
      afterWorkOrder: null,
      resultReferences: [resultReference],
      reason: exchangeResult.reason,
      outputDigest: sha256("runtime-test-output"),
      outputBytes: 19,
      completedAt: "2026-08-07T00:00:06.000Z",
      operatorId: "operator:runtime-test:result-one",
    }).result;
    const returnIntent = runtime.prepareAsoiafAnswerActorRuntimeReturn({
      root,
      runtimeResultId: result.runtimeResultId,
      slotId: slot.slotId,
      idempotencyKey: "runtime-test-return-idempotency-0001",
      preparedAt: "2026-08-07T00:00:07.000Z",
      operatorId: "operator:runtime-test:return-one",
    }).intent;
    const receipt = runtime.recordAsoiafAnswerActorRuntimeReturn({
      root,
      returnIntentId: returnIntent.returnIntentId,
      supervisedReturnId: supervisedReturn.returnId,
      recordedAt: "2026-08-07T00:00:09.000Z",
      operatorId: "operator:runtime-test:receipt-one",
    }).receipt;
    expect(receipt.receiptAuthority).toBe("acknowledgement-only");
    expect(runtime.retireAsoiafAnswerActorRuntimeSlot({
      root,
      slotId: slot.slotId,
      kind: "scheduled",
      retiredAt: "2026-08-07T00:00:10.000Z",
      reason: "Every assignment delivered under this exact runtime slot has a retained supervised return acknowledgement.",
      operatorId: "operator:runtime-test:retire-one",
    }).stranded).toEqual([]);
  });

  it("refuses successor return and strands unresolved work without inheritance", () => {
    const predecessor = runtime.readAsoiafAnswerActorRuntimeStatus(root).slots[0]!;
    const successor = runtime.retainAsoiafAnswerActorRuntimeSlot({
      root,
      actorId: predecessor.actorId,
      actorRole: predecessor.actorRole,
      deliveryCertificateFingerprint: sha256("delivery-certificate:successor"),
      providerProfileId: providerProfile.profileId,
      credentialRelationship: "explicit-delegation",
      delegationReason: "The holder explicitly assigns the successor delivery certificate to the same provider credential without inheriting predecessor work.",
      predecessorSlotId: predecessor.slotId,
      createdAt: "2026-08-07T00:00:11.000Z",
      operatorId: "operator:runtime-test:successor",
    }).slot;
    const secondSlot = runtime.retainAsoiafAnswerActorRuntimeSlot({
      root,
      actorId: deliveryTwo.actorId,
      actorRole,
      deliveryCertificateFingerprint: certificateTwo,
      providerProfileId: providerProfile.profileId,
      credentialRelationship: "explicit-delegation",
      delegationReason: "The holder explicitly assigns the provider credential to the second certificate-bound actor without transferring task authority.",
      createdAt: "2026-08-07T00:00:02.000Z",
      operatorId: "operator:runtime-test:slot-two",
    }).slot;
    const acceptance = runtime.acceptAsoiafAnswerActorRuntimeDelivery({
      root,
      slotId: secondSlot.slotId,
      deliveryId: deliveryTwo.deliveryId,
      importedAt: "2026-08-07T00:00:03.000Z",
      operatorId: "operator:runtime-test:accept-two",
    }).acceptance;
    const intent = runtime.prepareAsoiafAnswerActorRuntimeExecution({
      root,
      acceptanceId: acceptance.acceptanceId,
      adapterId: "adapter:runtime-test:two",
      adapterVersion: "1.0.0",
      inputDigest: sha256("runtime-test-input-two"),
      inputBytes: 22,
      preparedAt: "2026-08-07T00:00:04.000Z",
      expiresAt: "2026-08-07T00:09:00.000Z",
      operatorId: "operator:runtime-test:prepare-two",
    }).intent;
    const result = runtime.recordAsoiafAnswerActorRuntimeResult({
      root,
      executionIntentId: intent.executionIntentId,
      providerResultId: providerResult.resultId,
      outcome: "satisfied",
      resultReferences: [resultReference],
      reason: "The second runtime test result remains durable locally while its delivery return is intentionally unresolved.",
      outputDigest: sha256("runtime-test-output-two"),
      outputBytes: 23,
      completedAt: "2026-08-07T00:00:06.000Z",
      operatorId: "operator:runtime-test:result-two",
    }).result;
    expect(() => runtime.prepareAsoiafAnswerActorRuntimeReturn({
      root,
      runtimeResultId: runtime.readAsoiafAnswerActorRuntimeStatus(root).results[0]!.runtimeResultId,
      slotId: successor.slotId,
      idempotencyKey: "runtime-test-successor-return-refusal",
      preparedAt: "2026-08-07T00:00:12.000Z",
      operatorId: "operator:runtime-test:successor-return",
    })).toThrow(/successor or alternate runtime slot/);
    runtime.prepareAsoiafAnswerActorRuntimeReturn({
      root,
      runtimeResultId: result.runtimeResultId,
      slotId: secondSlot.slotId,
      idempotencyKey: "runtime-test-return-idempotency-0002",
      preparedAt: "2026-08-07T00:00:07.000Z",
      operatorId: "operator:runtime-test:return-two",
    });
    expect(() => runtime.retireAsoiafAnswerActorRuntimeSlot({
      root,
      slotId: secondSlot.slotId,
      kind: "scheduled",
      retiredAt: "2026-08-07T00:00:08.000Z",
      reason: "Scheduled retirement must refuse because the second assignment has no retained return receipt.",
      operatorId: "operator:runtime-test:retire-two-scheduled",
    })).toThrow(/scheduled runtime slot retirement requires/);
    const emergency = runtime.retireAsoiafAnswerActorRuntimeSlot({
      root,
      slotId: secondSlot.slotId,
      kind: "emergency",
      retiredAt: "2026-08-07T00:00:08.000Z",
      reason: "Emergency retirement permanently strands the unresolved assignment and forbids successor inheritance.",
      operatorId: "operator:runtime-test:retire-two-emergency",
    });
    expect(emergency.stranded).toHaveLength(1);
    expect(emergency.stranded[0]!.successorMayInherit).toBe(false);
    const findings = runtime.verifyAsoiafAnswerActorRuntimeEstate(root);
    expect(findings.filter((entry) => entry.severity === "error")).toEqual([]);
    expect(findings.filter((entry) => entry.code === "runtime-assignment-stranded")).toHaveLength(1);
  });

  it("detects immutable-record tampering and forbidden secret material", () => {
    const status = runtime.readAsoiafAnswerActorRuntimeStatus(root);
    const paths = runtime.asoiafAnswerActorRuntimePaths(root);
    const slotPath = path.join(paths.slots, `${status.slots[0]!.slotFingerprint.slice("sha256:".length)}.json`);
    const original = fs.readFileSync(slotPath, "utf8");
    const value = JSON.parse(original) as { operatorId: string };
    value.operatorId = `${value.operatorId}:tampered`;
    fs.writeFileSync(slotPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    expect(runtime.verifyAsoiafAnswerActorRuntimeEstate(root).some(
      (entry) => entry.code === "runtime-slot-fingerprint" && entry.severity === "error",
    )).toBe(true);
    fs.writeFileSync(slotPath, original, "utf8");
    const secret = path.join(paths.runtimeRoot, "forbidden.pem");
    fs.writeFileSync(secret, "-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n", "utf8");
    const findings = runtime.verifyAsoiafAnswerActorRuntimeEstate(root);
    expect(findings.some((entry) => entry.code === "runtime-secret-path")).toBe(true);
    expect(findings.some((entry) => entry.code === "runtime-secret-content")).toBe(true);
    fs.rmSync(secret, { force: true });
  });
});
