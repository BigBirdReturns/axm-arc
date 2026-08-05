import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildAsoiafAnswerDeskFixture,
} from "../../fixtures/asoiaf-answer-desk-fixture.js";
import {
  adoptAsoiafAnswerDeskWorkOrder,
  readAsoiafAnswerDeskStatus,
} from "../../../tools/lib/asoiaf-answer-desk-estate.js";
import {
  admitAsoiafAnswerExchangeResult,
  issueAsoiafAnswerExchangeAssignment,
  readAsoiafAnswerExchangeStatus,
  type AsoiafAnswerExchangeResultInput,
} from "../../../tools/lib/asoiaf-answer-desk-exchange.js";
import {
  readAsoiafAnswerDeskWorkerStatus,
} from "../../../tools/lib/asoiaf-answer-desk-worker.js";
import {
  asoiafAnswerSupervisorPaths,
  buildAsoiafAnswerSupervisorPolicy,
  planAsoiafAnswerDeskSupervisor,
  prepareAsoiafAnswerSupervisorIntent,
  readAsoiafAnswerSupervisorStatus,
  tickAsoiafAnswerDeskSupervisor,
  validateAsoiafAnswerSupervisorIntent,
  validateAsoiafAnswerSupervisorPolicy,
  validateAsoiafAnswerSupervisorProjection,
  validateAsoiafAnswerSupervisorRun,
  verifyAsoiafAnswerSupervisorEstate,
  type AsoiafAnswerSupervisorActorBindingInput,
  type AsoiafAnswerSupervisorPolicy,
  type AsoiafAnswerSupervisorTickInput,
} from "../../../tools/lib/asoiaf-answer-desk-supervisor.js";
import {
  buildAsoiafAnswerWorkOrder,
  type AsoiafAnswerWorkAction,
  type AsoiafAnswerWorkItem,
  type AsoiafAnswerWorkOrder,
} from "../../../tools/lib/asoiaf-answer-work-order.js";
import {
  buildAsoiafResearchQuestionDossier,
} from "../../../tools/lib/asoiaf-research-question-dossier.js";

const roots: string[] = [];

function estateRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-answer-supervisor-"));
  roots.push(root);
  return root;
}

function item(
  workOrder: AsoiafAnswerWorkOrder,
  action: AsoiafAnswerWorkAction,
): AsoiafAnswerWorkItem {
  const result = workOrder.items.find((entry) => entry.action === action);
  if (!result) throw new Error(`fixture work order lacks ${action}`);
  return result;
}

function adoptOpen(root: string) {
  const fixture = buildAsoiafAnswerDeskFixture();
  adoptAsoiafAnswerDeskWorkOrder({
    root,
    workOrder: fixture.openWorkOrder,
    adoptedAt: "2026-08-05T06:20:01.000Z",
    operatorId: "operator:supervisor-open",
  });
  return fixture;
}

function adoptReady(root: string) {
  const fixture = buildAsoiafAnswerDeskFixture();
  adoptAsoiafAnswerDeskWorkOrder({
    root,
    workOrder: fixture.readyWorkOrder,
    adoptedAt: "2026-08-05T06:40:01.000Z",
    operatorId: "operator:supervisor-ready",
  });
  return fixture;
}

function adoptDoubleReview(root: string): AsoiafAnswerWorkOrder {
  const dossier = buildAsoiafResearchQuestionDossier({
    questionText:
      "Which two exact holder-controlled passages require independent locator review?",
    createdBy: "researcher:supervisor-double-review",
    createdAt: "2026-08-05T06:10:00.000Z",
    laneIds: ["entity-resolution"],
    continuityIds: ["book-main"],
    privateReferences: [
      {
        sourceId: "local-agot",
        editionKey: "supervisor-double-review-edition",
        continuityId: "book-main",
        unitId: "supervisor-double-review-unit",
        paragraphId: "supervisor-double-review-a",
        locator:
          "local-agot/supervisor-double-review-edition/supervisor-double-review-unit/supervisor-double-review-a",
        paragraphDigest:
          "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        queryMode: "phrase",
        matchedTerms: ["first", "passage"],
        tokenPositions: [1, 5],
        snippetDigest: null,
        snippetCharacters: null,
      },
      {
        sourceId: "local-agot",
        editionKey: "supervisor-double-review-edition",
        continuityId: "book-main",
        unitId: "supervisor-double-review-unit",
        paragraphId: "supervisor-double-review-b",
        locator:
          "local-agot/supervisor-double-review-edition/supervisor-double-review-unit/supervisor-double-review-b",
        paragraphDigest:
          "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        queryMode: "phrase",
        matchedTerms: ["second", "passage"],
        tokenPositions: [2, 8],
        snippetDigest: null,
        snippetCharacters: null,
      },
    ],
    gaps: [],
  });
  const workOrder = buildAsoiafAnswerWorkOrder({
    dossier,
    createdBy: "operator:supervisor-double-review-order",
    createdAt: "2026-08-05T06:20:00.000Z",
    transactions: [],
    answerPacket: null,
  });
  adoptAsoiafAnswerDeskWorkOrder({
    root,
    workOrder,
    adoptedAt: "2026-08-05T06:20:01.000Z",
    operatorId: "operator:supervisor-double-review-adopt",
  });
  return workOrder;
}

function policy(input?: {
  automaticWorkerEnabled?: boolean;
  includeReview?: boolean;
  includeReconcile?: boolean;
  includeAssembler?: boolean;
  secondReviewActor?: boolean;
}): AsoiafAnswerSupervisorPolicy {
  const bindings: AsoiafAnswerSupervisorActorBindingInput[] = [];
  if (input?.includeReview ?? true) {
    bindings.push({
      actorRole: "exact-locator-reviewer" as const,
      actorId: "actor:supervisor:exact-locator-reviewer",
      leaseMilliseconds: 600_000,
      priority: 20,
      capacity: 1,
    });
  }
  if (input?.secondReviewActor) {
    bindings.push({
      actorRole: "exact-locator-reviewer" as const,
      actorId: "actor:supervisor:backup-locator-reviewer",
      leaseMilliseconds: 600_000,
      priority: 10,
      capacity: 1,
    });
  }
  if (input?.includeReconcile) {
    bindings.push({
      actorRole: "canon-reconciler" as const,
      actorId: "actor:supervisor:canon-reconciler",
      leaseMilliseconds: 600_000,
      priority: 30,
      capacity: 1,
    });
  }
  if (input?.includeAssembler ?? true) {
    bindings.push({
      actorRole: "answer-assembler" as const,
      actorId: "actor:supervisor:answer-assembler",
      leaseMilliseconds: 600_000,
      priority: 40,
      capacity: 1,
    });
  }
  return buildAsoiafAnswerSupervisorPolicy({
    createdBy: "operator:supervisor-policy",
    createdAt: "2026-08-05T06:20:00.000Z",
    automaticWorkerEnabled: input?.automaticWorkerEnabled ?? true,
    automaticLeaseMilliseconds: 60_000,
    actorBindings: bindings,
  });
}

function tickInput(input: {
  root: string;
  policy: AsoiafAnswerSupervisorPolicy;
  requestKey: string;
  requestedAt: string;
  automaticCompletedAt?: string | null;
}): AsoiafAnswerSupervisorTickInput {
  return {
    ...input,
    automaticCompletedAt: input.automaticCompletedAt ?? null,
    operatorId: "operator:supervisor-tick",
  };
}

function reviewResult(
  root: string,
  assignmentId: string,
  fixture: ReturnType<typeof buildAsoiafAnswerDeskFixture>,
): AsoiafAnswerExchangeResultInput {
  return {
    root,
    assignmentId,
    actorId: "actor:supervisor:exact-locator-reviewer",
    actorRole: "exact-locator-reviewer",
    completedAt: "2026-08-05T06:30:00.000Z",
    outcome: "satisfied",
    afterWorkOrder: fixture.reconciledWorkOrder,
    resultReferences: [
      {
        kind: "reviewed-answer-transaction",
        objectId: fixture.transaction.transactionId,
        fingerprint: fixture.transaction.transactionFingerprint,
        uri: null,
      },
    ],
    reason:
      "The supervisor-bound exact-locator reviewer admitted the exact transaction that proves the stable review item satisfied.",
    operatorId: "operator:supervisor-review-admit",
  };
}

function closeResult(
  root: string,
  assignmentId: string,
  fixture: ReturnType<typeof buildAsoiafAnswerDeskFixture>,
): AsoiafAnswerExchangeResultInput {
  return {
    root,
    assignmentId,
    actorId: "actor:supervisor:answer-assembler",
    actorRole: "answer-assembler",
    completedAt: "2026-08-05T06:40:00.000Z",
    outcome: "satisfied",
    afterWorkOrder: fixture.readyWorkOrder,
    resultReferences: [
      {
        kind: "reviewed-answer-packet",
        objectId: fixture.answerPacket.answerPacketId,
        fingerprint: fixture.answerPacket.answerPacketFingerprint,
        uri: null,
      },
    ],
    reason:
      "The supervisor-bound answer assembler admitted the exact reviewed packet that closes the immutable gap and proves the close item satisfied.",
    operatorId: "operator:supervisor-close-admit",
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("ASOIAF persistent answer desk supervisor", () => {
  it("builds a deterministic capacity policy with no task or access authority", () => {
    const first = policy({ secondReviewActor: true });
    const second = policy({ secondReviewActor: true });

    expect(second).toEqual(first);
    expect(validateAsoiafAnswerSupervisorPolicy(first)).toEqual([]);
    expect(first.actorBindings.map((entry) => entry.actorId)).toEqual([
      "actor:supervisor:answer-assembler",
      "actor:supervisor:backup-locator-reviewer",
      "actor:supervisor:exact-locator-reviewer",
    ]);
    expect(first).toEqual(
      expect.objectContaining({
        automaticWorkerEnabled: true,
        automaticLeaseMilliseconds: 60_000,
        selectionPolicy: "work-order-order-then-binding-priority",
        leasePolicy: "claim-only-on-dispatch",
        transportPolicy: "local-content-addressed-files",
        networkAccess: "none",
        privateTextAccess: "none",
        humanReviewAuthority: "none",
        acquisitionAuthority: "none",
        reconciliationAuthority: "none",
        authority: "none",
        graphEffect: "none",
        canonEffect: "none",
        answerEffect: "none",
      }),
    );
    expect(() =>
      buildAsoiafAnswerSupervisorPolicy({
        createdBy: "operator:duplicate-policy",
        createdAt: "2026-08-05T06:20:00.000Z",
        actorBindings: [
          {
            actorRole: "answer-assembler",
            actorId: "actor:duplicate",
            leaseMilliseconds: 60_000,
          },
          {
            actorRole: "answer-assembler",
            actorId: "actor:duplicate",
            leaseMilliseconds: 60_000,
          },
        ],
      }),
    ).toThrow(/duplicated/);
  });

  it("plans and prepares external work without claiming it before dispatch", () => {
    const root = estateRoot();
    const fixture = adoptOpen(root);
    const currentPolicy = policy();
    const input = tickInput({
      root,
      policy: currentPolicy,
      requestKey: "request:prepare-review",
      requestedAt: "2026-08-05T06:21:00.000Z",
    });

    const projection = planAsoiafAnswerDeskSupervisor({
      root,
      policy: currentPolicy,
    });
    expect(validateAsoiafAnswerSupervisorProjection(projection)).toEqual([]);
    expect(projection.decision).toEqual(
      expect.objectContaining({
        kind: "issue-external",
        itemId: item(fixture.openWorkOrder, "review-exact-locator").itemId,
        action: "review-exact-locator",
        actorId: "actor:supervisor:exact-locator-reviewer",
        actorRole: "exact-locator-reviewer",
        leaseMilliseconds: 600_000,
      }),
    );
    expect(readAsoiafAnswerDeskStatus(root).leases).toEqual([]);

    const prepared = prepareAsoiafAnswerSupervisorIntent(input);
    expect(prepared.replayed).toBe(false);
    expect(validateAsoiafAnswerSupervisorIntent(prepared.intent)).toEqual([]);
    expect(prepared.intent.decision).toEqual(projection.decision);
    expect(readAsoiafAnswerDeskStatus(root).leases).toEqual([]);
    expect(readAsoiafAnswerSupervisorStatus(root).pendingIntentIds).toEqual([
      prepared.intent.intentId,
    ]);
    expect(fs.existsSync(path.resolve(root, prepared.intentUri))).toBe(true);
  });

  it("issues and replays one exact external assignment without reopening claim creation", () => {
    const root = estateRoot();
    adoptOpen(root);
    const input = tickInput({
      root,
      policy: policy(),
      requestKey: "request:issue-review",
      requestedAt: "2026-08-05T06:21:00.000Z",
    });
    const first = tickAsoiafAnswerDeskSupervisor(input);
    const second = tickAsoiafAnswerDeskSupervisor(input);
    const desk = readAsoiafAnswerDeskStatus(root);
    const exchange = readAsoiafAnswerExchangeStatus(root);
    const supervisor = readAsoiafAnswerSupervisorStatus(root);

    expect(first.intentReplayed).toBe(false);
    expect(first.runReplayed).toBe(false);
    expect(first.run.outcome).toBe("external-issued");
    expect(first.externalIssue?.claim.replayed).toBe(false);
    expect(first.run.operationReferences).toEqual([
      expect.objectContaining({
        kind: "answer-exchange-assignment",
        objectId: first.externalIssue?.assignment.assignmentId,
        fingerprint: first.externalIssue?.assignment.assignmentFingerprint,
      }),
    ]);
    expect(validateAsoiafAnswerSupervisorRun(first.run, first.intent)).toEqual([]);

    expect(second.intentReplayed).toBe(true);
    expect(second.runReplayed).toBe(true);
    expect(second.run).toEqual(first.run);
    expect(second.externalIssue).toBeNull();
    expect(desk.leases).toHaveLength(1);
    expect(exchange.assignments).toHaveLength(1);
    expect(supervisor.intents).toHaveLength(1);
    expect(supervisor.runs).toHaveLength(1);
    expect(supervisor.pendingIntentIds).toEqual([]);
    expect(
      verifyAsoiafAnswerSupervisorEstate(root).filter(
        (entry) => entry.severity === "error",
      ),
    ).toEqual([]);
  });

  it("recovers a retained intent after the underlying assignment was issued before the supervisor run receipt", () => {
    const root = estateRoot();
    adoptOpen(root);
    const input = tickInput({
      root,
      policy: policy(),
      requestKey: "request:recover-review",
      requestedAt: "2026-08-05T06:21:00.000Z",
    });
    const prepared = prepareAsoiafAnswerSupervisorIntent(input);
    const decision = prepared.intent.decision;
    const issued = issueAsoiafAnswerExchangeAssignment({
      root,
      itemId: decision.itemId,
      actorId: decision.actorId!,
      actorRole: "exact-locator-reviewer",
      claimedAt: prepared.intent.requestedAt,
      issuedAt: prepared.intent.requestedAt,
      leaseMilliseconds: decision.leaseMilliseconds!,
      operatorId: `${prepared.intent.operatorId}:external`,
    });
    expect(issued.claim.replayed).toBe(false);

    const recovered = tickAsoiafAnswerDeskSupervisor(input);
    expect(recovered.intentReplayed).toBe(true);
    expect(recovered.runReplayed).toBe(false);
    expect(recovered.externalIssue?.claim.replayed).toBe(true);
    expect(recovered.externalIssue?.assignmentReplayed).toBe(true);
    expect(recovered.run.operationReplayed).toBe(true);
    expect(readAsoiafAnswerDeskStatus(root).leases).toHaveLength(1);
    expect(readAsoiafAnswerExchangeStatus(root).assignments).toHaveLength(1);
  });

  it("retains an unbound scheduling decision without manufacturing a lease", () => {
    const root = estateRoot();
    const fixture = adoptOpen(root);
    const currentPolicy = policy({ includeReview: false, includeAssembler: false });
    const input = tickInput({
      root,
      policy: currentPolicy,
      requestKey: "request:unbound",
      requestedAt: "2026-08-05T06:21:00.000Z",
    });
    const result = tickAsoiafAnswerDeskSupervisor(input);

    expect(result.run.outcome).toBe("unbound-external");
    expect(result.run.itemId).toBe(
      item(fixture.openWorkOrder, "review-exact-locator").itemId,
    );
    expect(result.run.actorRole).toBe("exact-locator-reviewer");
    expect(result.run.leaseId).toBeNull();
    expect(result.run.operationReferences).toEqual([]);
    expect(readAsoiafAnswerDeskStatus(root).leases).toEqual([]);
    expect(readAsoiafAnswerExchangeStatus(root).assignments).toEqual([]);
    expect(verifyAsoiafAnswerSupervisorEstate(root)).toEqual([]);
  });

  it("fans out independent external work and waits without over-claiming", () => {
  const root = estateRoot();
  adoptOpen(root);
  const currentPolicy = policy({ includeReconcile: true, includeAssembler: false });
  const review = tickAsoiafAnswerDeskSupervisor(tickInput({
    root,
    policy: currentPolicy,
    requestKey: "request:fanout-review",
    requestedAt: "2026-08-05T06:21:00.000Z",
  }));
  const reconcile = tickAsoiafAnswerDeskSupervisor(tickInput({
    root,
    policy: currentPolicy,
    requestKey: "request:fanout-reconcile",
    requestedAt: "2026-08-05T06:21:01.000Z",
  }));
  const wait = tickAsoiafAnswerDeskSupervisor(tickInput({
    root,
    policy: currentPolicy,
    requestKey: "request:fanout-wait",
    requestedAt: "2026-08-05T06:21:02.000Z",
  }));

  expect(review.run.outcome).toBe("external-issued");
  expect(review.run.action).toBe("review-exact-locator");
  expect(reconcile.run.outcome).toBe("external-issued");
  expect(reconcile.run.action).toBe("reconcile-candidate");
  expect(wait.run.outcome).toBe("waiting-external");
  expect(wait.intent.decision.kind).toBe("wait-external");
  expect(wait.intent.beforeProjection.activeExternalAssignments).toHaveLength(2);
  expect(wait.run.leaseId).toBeNull();
  expect(wait.run.operationReferences).toEqual([]);
  expect(readAsoiafAnswerDeskStatus(root).leases).toHaveLength(2);
  expect(readAsoiafAnswerExchangeStatus(root).assignments).toHaveLength(2);
  expect(readAsoiafAnswerSupervisorStatus(root).runs).toHaveLength(3);
});

it("exposes actor saturation while independent dependency-ready work remains", () => {
  const root = estateRoot();
  const workOrder = adoptDoubleReview(root);
  const currentPolicy = policy({ includeAssembler: false });
  const first = tickAsoiafAnswerDeskSupervisor(tickInput({
    root,
    policy: currentPolicy,
    requestKey: "request:saturation-first",
    requestedAt: "2026-08-05T06:21:00.000Z",
  }));
  const saturated = tickAsoiafAnswerDeskSupervisor(tickInput({
    root,
    policy: currentPolicy,
    requestKey: "request:saturation-second",
    requestedAt: "2026-08-05T06:21:01.000Z",
  }));

  expect(
    workOrder.items.filter((entry) => entry.action === "review-exact-locator"),
  ).toHaveLength(2);
  expect(first.run.outcome).toBe("external-issued");
  expect(first.run.action).toBe("review-exact-locator");
  expect(saturated.run.outcome).toBe("saturated-external");
  expect(saturated.intent.decision.kind).toBe("saturated-external");
  expect(saturated.intent.beforeProjection.saturatedExternalItemIds).toHaveLength(1);
  expect(saturated.run.leaseId).toBeNull();
  expect(saturated.run.operationReferences).toEqual([]);
  expect(readAsoiafAnswerDeskStatus(root).leases).toHaveLength(1);
  expect(readAsoiafAnswerExchangeStatus(root).assignments).toHaveLength(1);
  expect(readAsoiafAnswerSupervisorStatus(root).runs).toHaveLength(2);
});

  it("runs and replays the bounded automatic renderer from an answer-ready desk", () => {
    const root = estateRoot();
    const fixture = adoptReady(root);
    const input = tickInput({
      root,
      policy: policy(),
      requestKey: "request:render-ready",
      requestedAt: "2026-08-05T06:41:10.000Z",
      automaticCompletedAt: "2026-08-05T06:41:20.000Z",
    });
    const first = tickAsoiafAnswerDeskSupervisor(input);
    const second = tickAsoiafAnswerDeskSupervisor(input);
    const worker = readAsoiafAnswerDeskWorkerStatus(root);

    expect(first.intent.decision).toEqual(
      expect.objectContaining({
        kind: "run-automatic",
        itemId: item(fixture.readyWorkOrder, "render-reviewed-answer").itemId,
        actorRole: "reviewed-renderer",
      }),
    );
    expect(first.run.outcome).toBe("automatic-rendered");
    expect(first.run.settlementId).toBe(
      first.automaticRun?.settlement.settlement.settlementId,
    );
    expect(first.run.operationReferences.map((entry) => entry.kind)).toEqual([
      "answer-worker-invocation",
      "answer-worker-result",
      "reviewed-answer-render",
      "answer-work-settlement",
    ]);
    expect(second.runReplayed).toBe(true);
    expect(second.run).toEqual(first.run);
    expect(worker.invocations).toHaveLength(1);
    expect(worker.results).toHaveLength(1);
    expect(readAsoiafAnswerDeskStatus(root).state.availableItemIds).toEqual([]);
    expect(verifyAsoiafAnswerSupervisorEstate(root)).toEqual([]);
  });

  it("rotates review, gap closure, and automatic rendering through exact JIT intents", () => {
    const root = estateRoot();
    const fixture = adoptOpen(root);
    const currentPolicy = policy();

    const reviewTick = tickAsoiafAnswerDeskSupervisor(tickInput({
      root,
      policy: currentPolicy,
      requestKey: "request:rotation-review",
      requestedAt: "2026-08-05T06:21:00.000Z",
    }));
    const reviewAssignment = reviewTick.externalIssue!.assignment;
    const reviewAdmitted = admitAsoiafAnswerExchangeResult(
      reviewResult(root, reviewAssignment.assignmentId, fixture),
    );
    expect(reviewAdmitted.settlement.manifest.latestWorkOrderId).toBe(
      fixture.reconciledWorkOrder.workOrderId,
    );

    const closeTick = tickAsoiafAnswerDeskSupervisor(tickInput({
      root,
      policy: currentPolicy,
      requestKey: "request:rotation-close",
      requestedAt: "2026-08-05T06:31:00.000Z",
    }));
    expect(closeTick.run.action).toBe("close-gap");
    expect(closeTick.intent.beforeProjection.dependencyBlockedItemIds).toContain(
      item(fixture.reconciledWorkOrder, "assemble-reviewed-answer").itemId,
    );
    const closeAssignment = closeTick.externalIssue!.assignment;
    const closeAdmitted = admitAsoiafAnswerExchangeResult(
      closeResult(root, closeAssignment.assignmentId, fixture),
    );
    expect(closeAdmitted.settlement.manifest.latestWorkOrderId).toBe(
      fixture.readyWorkOrder.workOrderId,
    );

    const renderTick = tickAsoiafAnswerDeskSupervisor(tickInput({
      root,
      policy: currentPolicy,
      requestKey: "request:rotation-render",
      requestedAt: "2026-08-05T06:41:10.000Z",
      automaticCompletedAt: "2026-08-05T06:41:20.000Z",
    }));
    expect(renderTick.run.outcome).toBe("automatic-rendered");

    const desk = readAsoiafAnswerDeskStatus(root);
    const exchange = readAsoiafAnswerExchangeStatus(root);
    const worker = readAsoiafAnswerDeskWorkerStatus(root);
    const supervisor = readAsoiafAnswerSupervisorStatus(root, currentPolicy);
    expect(desk.workOrders).toHaveLength(3);
    expect(desk.leases).toHaveLength(3);
    expect(desk.settlements).toHaveLength(3);
    expect(desk.state.availableItemIds).toEqual([]);
    expect(desk.state.nextAvailableItemId).toBeNull();
    expect(exchange.assignments).toHaveLength(2);
    expect(exchange.results).toHaveLength(2);
    expect(worker.invocations).toHaveLength(1);
    expect(worker.results).toHaveLength(1);
    expect(supervisor.intents).toHaveLength(3);
    expect(supervisor.runs).toHaveLength(3);
    expect(supervisor.pendingIntentIds).toEqual([]);
    expect(supervisor.projection?.decision.kind).toBe("idle");
    expect(verifyAsoiafAnswerSupervisorEstate(root)).toEqual([]);
  });

  it("refuses request-key retargeting after an immutable intent exists", () => {
    const root = estateRoot();
    adoptOpen(root);
    const currentPolicy = policy({ includeReview: false, includeAssembler: false });
    const first = tickInput({
      root,
      policy: currentPolicy,
      requestKey: "request:immutable-key",
      requestedAt: "2026-08-05T06:21:00.000Z",
    });
    tickAsoiafAnswerDeskSupervisor(first);

    expect(() =>
      tickAsoiafAnswerDeskSupervisor({
        ...first,
        requestedAt: "2026-08-05T06:21:01.000Z",
      }),
    ).toThrow(/already has a different intent/);
    expect(readAsoiafAnswerSupervisorStatus(root).intents).toHaveLength(1);
    expect(readAsoiafAnswerSupervisorStatus(root).runs).toHaveLength(1);
  });

  it("detects intent and run tampering through content and operation reconstruction", () => {
    const intentRoot = estateRoot();
    adoptOpen(intentRoot);
    const intentTick = tickAsoiafAnswerDeskSupervisor(tickInput({
      root: intentRoot,
      policy: policy({ includeReview: false, includeAssembler: false }),
      requestKey: "request:tamper-intent",
      requestedAt: "2026-08-05T06:21:00.000Z",
    }));
    const intentPath = path.join(
      asoiafAnswerSupervisorPaths(intentRoot).intents,
      `${intentTick.intent.intentFingerprint.slice("sha256:".length)}.json`,
    );
    fs.writeFileSync(
      intentPath,
      `${JSON.stringify({
        ...intentTick.intent,
        operatorId: "operator:tampered",
      }, null, 2)}\n`,
      "utf8",
    );
    expect(
      verifyAsoiafAnswerSupervisorEstate(intentRoot).map((entry) => entry.code),
    ).toEqual(
      expect.arrayContaining([
        "supervisor-intent-request-fingerprint",
        "supervisor-intent-fingerprint",
      ]),
    );

    const runRoot = estateRoot();
    adoptOpen(runRoot);
    const runTick = tickAsoiafAnswerDeskSupervisor(tickInput({
      root: runRoot,
      policy: policy(),
      requestKey: "request:tamper-run",
      requestedAt: "2026-08-05T06:21:00.000Z",
    }));
    const runPath = path.join(
      asoiafAnswerSupervisorPaths(runRoot).runs,
      `${runTick.run.runFingerprint.slice("sha256:".length)}.json`,
    );
    fs.writeFileSync(
      runPath,
      `${JSON.stringify({
        ...runTick.run,
        reason: "Tampered scheduling reason that invalidates the retained run fingerprint.",
      }, null, 2)}\n`,
      "utf8",
    );
    expect(
      verifyAsoiafAnswerSupervisorEstate(runRoot).map((entry) => entry.code),
    ).toEqual(
      expect.arrayContaining([
        "supervisor-run-fingerprint",
      ]),
    );
  });
});
