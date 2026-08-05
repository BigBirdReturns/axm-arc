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
  asoiafAnswerExchangePaths,
  issueAsoiafAnswerExchangeAssignment,
  readAsoiafAnswerExchangeStatus,
  validateAsoiafAnswerExchangeAssignment,
  validateAsoiafAnswerExchangeResult,
  verifyAsoiafAnswerExchangeEstate,
  type AsoiafAnswerExchangeIssueInput,
  type AsoiafAnswerExchangeResultInput,
} from "../../../tools/lib/asoiaf-answer-desk-exchange.js";
import {
  runAsoiafAnswerDeskWorker,
  verifyAsoiafAnswerDeskWorkerEstate,
} from "../../../tools/lib/asoiaf-answer-desk-worker.js";
import type {
  AsoiafAnswerWorkAction,
  AsoiafAnswerWorkItem,
  AsoiafAnswerWorkOrder,
} from "../../../tools/lib/asoiaf-answer-work-order.js";

const roots: string[] = [];

function estateRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-answer-exchange-"));
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
    operatorId: "operator:exchange-open",
  });
  return fixture;
}

function adoptReady(root: string) {
  const fixture = buildAsoiafAnswerDeskFixture();
  adoptAsoiafAnswerDeskWorkOrder({
    root,
    workOrder: fixture.readyWorkOrder,
    adoptedAt: "2026-08-05T06:40:01.000Z",
    operatorId: "operator:exchange-ready",
  });
  return fixture;
}

function reviewIssueInput(
  root: string,
  workOrder: AsoiafAnswerWorkOrder,
): AsoiafAnswerExchangeIssueInput {
  return {
    root,
    itemId: item(workOrder, "review-exact-locator").itemId,
    actorId: "actor:exact-locator-reviewer",
    actorRole: "exact-locator-reviewer",
    claimedAt: "2026-08-05T06:21:00.000Z",
    issuedAt: "2026-08-05T06:21:01.000Z",
    leaseMilliseconds: 600_000,
    operatorId: "operator:exchange-review-issue",
  };
}

function reviewResultInput(
  root: string,
  assignmentId: string,
  fixture: ReturnType<typeof buildAsoiafAnswerDeskFixture>,
): AsoiafAnswerExchangeResultInput {
  return {
    root,
    assignmentId,
    actorId: "actor:exact-locator-reviewer",
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
      "The exact-locator reviewer admitted the content-addressed reconciliation transaction that proves the stable review item satisfied.",
    operatorId: "operator:exchange-review-admit",
  };
}

function closeIssueInput(
  root: string,
  workOrder: AsoiafAnswerWorkOrder,
): AsoiafAnswerExchangeIssueInput {
  return {
    root,
    itemId: item(workOrder, "close-gap").itemId,
    actorId: "actor:answer-assembler",
    actorRole: "answer-assembler",
    claimedAt: "2026-08-05T06:31:00.000Z",
    issuedAt: "2026-08-05T06:31:01.000Z",
    leaseMilliseconds: 600_000,
    operatorId: "operator:exchange-gap-issue",
  };
}

function closeResultInput(
  root: string,
  assignmentId: string,
  fixture: ReturnType<typeof buildAsoiafAnswerDeskFixture>,
): AsoiafAnswerExchangeResultInput {
  return {
    root,
    assignmentId,
    actorId: "actor:answer-assembler",
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
      "The answer assembler admitted the exact reviewed packet that closes the immutable dossier gap and proves the stable close item satisfied.",
    operatorId: "operator:exchange-gap-admit",
  };
}

function renderRunInput(root: string) {
  return {
    root,
    claimedAt: "2026-08-05T06:41:10.000Z",
    requestedAt: "2026-08-05T06:41:11.000Z",
    completedAt: "2026-08-05T06:41:20.000Z",
    leaseMilliseconds: 60_000,
    operatorId: "operator:exchange-render",
  } as const;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("ASOIAF external answer desk exchange", () => {
  it("issues one actor-bound locator-review bundle without source or private text", () => {
    const root = estateRoot();
    const fixture = adoptOpen(root);
    const issued = issueAsoiafAnswerExchangeAssignment(
      reviewIssueInput(root, fixture.openWorkOrder),
    );

    expect(issued.claim.replayed).toBe(false);
    expect(issued.assignmentReplayed).toBe(false);
    expect(validateAsoiafAnswerExchangeAssignment(issued.assignment)).toEqual([]);
    expect(issued.assignment).toEqual(
      expect.objectContaining({
        action: "review-exact-locator",
        actorId: "actor:exact-locator-reviewer",
        actorRole: "exact-locator-reviewer",
        networkAccess: "none",
        privateTextAccess: "required",
        humanReview: "required",
        acceptedResultKinds: ["reviewed-answer-transaction"],
        privateTextIncluded: false,
        sourceTextIncluded: false,
        workOrderId: fixture.openWorkOrder.workOrderId,
        leaseId: issued.claim.lease.leaseId,
        authority: "none",
        graphEffect: "none",
        canonEffect: "none",
        answerEffect: "none",
      }),
    );
    expect(issued.assignment.workOrder).toEqual(fixture.openWorkOrder);
    expect(issued.assignment.lease).toEqual(issued.claim.lease);
    expect(fs.existsSync(path.resolve(root, issued.assignmentUri))).toBe(true);
    expect(path.basename(issued.assignmentUri)).toBe(
      `${issued.assignment.assignmentFingerprint.slice("sha256:".length)}.json`,
    );
    expect(
      JSON.stringify(issued.assignment).includes(fixture.packet.claims[0]!.text),
    ).toBe(false);
    expect(readAsoiafAnswerDeskStatus(root).leases).toHaveLength(1);
  });

  it("replays one exact assignment without duplicate lease or file custody", () => {
    const root = estateRoot();
    const fixture = adoptOpen(root);
    const input = reviewIssueInput(root, fixture.openWorkOrder);
    const first = issueAsoiafAnswerExchangeAssignment(input);
    const second = issueAsoiafAnswerExchangeAssignment(input);
    const exchange = readAsoiafAnswerExchangeStatus(root);
    const desk = readAsoiafAnswerDeskStatus(root);

    expect(second.claim.replayed).toBe(true);
    expect(second.claim.lease).toEqual(first.claim.lease);
    expect(second.assignmentReplayed).toBe(true);
    expect(second.assignment).toEqual(first.assignment);
    expect(exchange.assignments).toEqual([first.assignment]);
    expect(exchange.results).toEqual([]);
    expect(desk.leases).toHaveLength(1);
    expect(
      verifyAsoiafAnswerExchangeEstate(root).filter(
        (entry) => entry.severity === "error",
      ),
    ).toEqual([]);
  });

  it("refuses role mismatch and automatic rendering before creating an external lease", () => {
    const roleRoot = estateRoot();
    const roleFixture = adoptOpen(roleRoot);
    expect(() =>
      issueAsoiafAnswerExchangeAssignment({
        ...reviewIssueInput(roleRoot, roleFixture.openWorkOrder),
        actorId: "actor:answer-assembler",
        actorRole: "answer-assembler",
      }),
    ).toThrow(/not available to external actor role/);
    expect(readAsoiafAnswerDeskStatus(roleRoot).leases).toEqual([]);

    const readyRoot = estateRoot();
    const readyFixture = adoptReady(readyRoot);
    expect(() =>
      issueAsoiafAnswerExchangeAssignment({
        root: readyRoot,
        itemId: item(readyFixture.readyWorkOrder, "render-reviewed-answer").itemId,
        actorId: "actor:answer-assembler",
        actorRole: "answer-assembler",
        claimedAt: "2026-08-05T06:41:00.000Z",
        leaseMilliseconds: 60_000,
      }),
    ).toThrow(/not available to external actor role/);
    expect(readAsoiafAnswerDeskStatus(readyRoot).leases).toEqual([]);
  });

  it("refuses an unaccepted result kind and missing advancing head before retaining a result", () => {
    const kindRoot = estateRoot();
    const kindFixture = adoptOpen(kindRoot);
    const issued = issueAsoiafAnswerExchangeAssignment(
      reviewIssueInput(kindRoot, kindFixture.openWorkOrder),
    );
    expect(() =>
      admitAsoiafAnswerExchangeResult({
        ...reviewResultInput(kindRoot, issued.assignment.assignmentId, kindFixture),
        resultReferences: [
          {
            kind: "reviewed-answer-packet",
            objectId: kindFixture.answerPacket.answerPacketId,
            fingerprint: kindFixture.answerPacket.answerPacketFingerprint,
            uri: null,
          },
        ],
      }),
    ).toThrow(/result kind must remain within/);
    expect(
      fs.existsSync(asoiafAnswerExchangePaths(kindRoot).results),
    ).toBe(false);

    const headRoot = estateRoot();
    const headFixture = adoptOpen(headRoot);
    const headIssued = issueAsoiafAnswerExchangeAssignment(
      reviewIssueInput(headRoot, headFixture.openWorkOrder),
    );
    expect(() =>
      admitAsoiafAnswerExchangeResult({
        ...reviewResultInput(
          headRoot,
          headIssued.assignment.assignmentId,
          headFixture,
        ),
        afterWorkOrder: null,
      }),
    ).toThrow(/advancing settlement requires a refreshed answer work order/);
    expect(
      fs.existsSync(asoiafAnswerExchangePaths(headRoot).results),
    ).toBe(false);
  });

  it("admits exact review and gap results, then hands the ready render to the automatic worker", () => {
    const root = estateRoot();
    const fixture = adoptOpen(root);

    const reviewIssued = issueAsoiafAnswerExchangeAssignment(
      reviewIssueInput(root, fixture.openWorkOrder),
    );
    const reviewInput = reviewResultInput(
      root,
      reviewIssued.assignment.assignmentId,
      fixture,
    );
    const reviewAdmitted = admitAsoiafAnswerExchangeResult(reviewInput);
    const reviewReplay = admitAsoiafAnswerExchangeResult(reviewInput);

    expect(reviewAdmitted.resultReplayed).toBe(false);
    expect(reviewAdmitted.settlement.replayed).toBe(false);
    expect(reviewReplay.resultReplayed).toBe(true);
    expect(reviewReplay.result).toEqual(reviewAdmitted.result);
    expect(reviewReplay.settlement.replayed).toBe(true);
    expect(reviewReplay.settlement.settlement).toEqual(
      reviewAdmitted.settlement.settlement,
    );
    expect(validateAsoiafAnswerExchangeResult(
      root,
      reviewAdmitted.result,
      reviewIssued.assignment,
    )).toEqual([]);
    expect(reviewAdmitted.settlement.manifest.latestWorkOrderId).toBe(
      fixture.reconciledWorkOrder.workOrderId,
    );

    const closeIssued = issueAsoiafAnswerExchangeAssignment(
      closeIssueInput(root, fixture.reconciledWorkOrder),
    );
    const closeAdmitted = admitAsoiafAnswerExchangeResult(
      closeResultInput(root, closeIssued.assignment.assignmentId, fixture),
    );
    expect(closeAdmitted.settlement.manifest.latestWorkOrderId).toBe(
      fixture.readyWorkOrder.workOrderId,
    );

    const exchangeBeforeRender = readAsoiafAnswerExchangeStatus(root);
    expect(exchangeBeforeRender.assignments).toHaveLength(2);
    expect(exchangeBeforeRender.results).toHaveLength(2);
    expect(exchangeBeforeRender.plan.externalAvailableItemIds).toEqual([]);
    expect(exchangeBeforeRender.plan.automaticAvailableItemIds).toHaveLength(1);
    expect(exchangeBeforeRender.plan.nextAutomaticItemId).toBe(
      item(fixture.readyWorkOrder, "render-reviewed-answer").itemId,
    );

    const rendered = runAsoiafAnswerDeskWorker(renderRunInput(root));
    expect(rendered.result.outcome).toBe("rendered");
    expect(rendered.settlement.state.availableItemIds).toEqual([]);
    expect(rendered.settlement.state.nextAvailableItemId).toBeNull();

    const desk = readAsoiafAnswerDeskStatus(root);
    const exchange = readAsoiafAnswerExchangeStatus(root);
    expect(desk.workOrders).toHaveLength(3);
    expect(desk.leases).toHaveLength(3);
    expect(desk.settlements).toHaveLength(3);
    expect(exchange.assignments).toHaveLength(2);
    expect(exchange.results).toHaveLength(2);
    expect(exchange.plan.automaticAvailableItemIds).toEqual([]);
    expect(exchange.plan.externalAvailableItemIds).toEqual([]);
    expect(verifyAsoiafAnswerExchangeEstate(root)).toEqual([]);
    expect(verifyAsoiafAnswerDeskWorkerEstate(root)).toEqual([]);
  });

  it("retains an honest failed external result and releases the item for a later attempt", () => {
    const root = estateRoot();
    const fixture = adoptOpen(root);
    const issued = issueAsoiafAnswerExchangeAssignment(
      reviewIssueInput(root, fixture.openWorkOrder),
    );
    const failed = admitAsoiafAnswerExchangeResult({
      root,
      assignmentId: issued.assignment.assignmentId,
      actorId: "actor:exact-locator-reviewer",
      actorRole: "exact-locator-reviewer",
      completedAt: "2026-08-05T06:22:00.000Z",
      outcome: "failed",
      reason:
        "The external reviewer could not complete the exact-locator transaction and produced no admissible reviewed evidence.",
    });

    expect(failed.result.outcome).toBe("failed");
    expect(failed.result.afterWorkOrder).toBeNull();
    expect(failed.result.resultReferences).toEqual([]);
    expect(failed.settlement.settlement.outcome).toBe("failed");
    expect(failed.settlement.settlement.resultReferences).toEqual([
      expect.objectContaining({
        kind: "answer-exchange-result",
        objectId: failed.result.resultId,
        fingerprint: failed.result.resultFingerprint,
      }),
    ]);
    expect(failed.settlement.state.availableItemIds).toContain(
      issued.assignment.itemId,
    );
    expect(
      verifyAsoiafAnswerExchangeEstate(root).filter(
        (entry) => entry.severity === "error",
      ),
    ).toEqual([]);
  });

  it("detects assignment and result tampering through deterministic custody reconstruction", () => {
    const assignmentRoot = estateRoot();
    const assignmentFixture = adoptOpen(assignmentRoot);
    const assignmentIssued = issueAsoiafAnswerExchangeAssignment(
      reviewIssueInput(assignmentRoot, assignmentFixture.openWorkOrder),
    );
    const assignmentPath = path.resolve(
      assignmentRoot,
      assignmentIssued.assignmentUri,
    );
    fs.writeFileSync(
      assignmentPath,
      `${JSON.stringify({
        ...assignmentIssued.assignment,
        actorId: "actor:tampered",
      }, null, 2)}\n`,
      "utf8",
    );
    expect(
      verifyAsoiafAnswerExchangeEstate(assignmentRoot).map(
        (entry) => entry.code,
      ),
    ).toEqual(
      expect.arrayContaining([
        "exchange-assignment-projection",
        "exchange-assignment-desk-custody",
      ]),
    );

    const resultRoot = estateRoot();
    const resultFixture = adoptOpen(resultRoot);
    const resultIssued = issueAsoiafAnswerExchangeAssignment(
      reviewIssueInput(resultRoot, resultFixture.openWorkOrder),
    );
    const admitted = admitAsoiafAnswerExchangeResult(
      reviewResultInput(
        resultRoot,
        resultIssued.assignment.assignmentId,
        resultFixture,
      ),
    );
    const resultPath = path.resolve(resultRoot, admitted.resultUri);
    fs.writeFileSync(
      resultPath,
      `${JSON.stringify({
        ...admitted.result,
        reason: "Tampered external result reason that invalidates content custody.",
      }, null, 2)}\n`,
      "utf8",
    );
    expect(
      verifyAsoiafAnswerExchangeEstate(resultRoot).map(
        (entry) => entry.code,
      ),
    ).toEqual(
      expect.arrayContaining([
        "exchange-result-projection",
        "exchange-result-fingerprint",
        "exchange-result-settlement",
      ]),
    );
  });

  it("refuses an actor identity mismatch before retaining the external result", () => {
    const root = estateRoot();
    const fixture = adoptOpen(root);
    const issued = issueAsoiafAnswerExchangeAssignment(
      reviewIssueInput(root, fixture.openWorkOrder),
    );
    expect(() =>
      admitAsoiafAnswerExchangeResult({
        ...reviewResultInput(root, issued.assignment.assignmentId, fixture),
        actorId: "actor:different-reviewer",
      }),
    ).toThrow(/actor differs from the issued assignment/);
    expect(
      fs.existsSync(asoiafAnswerExchangePaths(root).results),
    ).toBe(false);
  });
});
