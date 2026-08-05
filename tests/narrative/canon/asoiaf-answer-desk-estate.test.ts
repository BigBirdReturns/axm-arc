import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildAsoiafAnswerDeskFixture,
} from "../../fixtures/asoiaf-answer-desk-fixture.js";
import {
  buildAsoiafAnswerWorkOrder,
  type AsoiafAnswerWorkItem,
  type AsoiafAnswerWorkOrder,
} from "../../../tools/lib/asoiaf-answer-work-order.js";
import {
  adoptAsoiafAnswerDeskWorkOrder,
  asoiafAnswerDeskEstatePaths,
  claimAsoiafAnswerDeskWork,
  readAsoiafAnswerDeskStatus,
  refreshAsoiafAnswerDeskState,
  settleAsoiafAnswerDeskWork,
  verifyAsoiafAnswerDeskEstate,
  type AsoiafAnswerDeskEstateManifest,
} from "../../../tools/lib/asoiaf-answer-desk-estate.js";

const roots: string[] = [];

function estateRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-answer-desk-"));
  roots.push(root);
  return root;
}

function item(
  workOrder: AsoiafAnswerWorkOrder,
  action: AsoiafAnswerWorkItem["action"],
): AsoiafAnswerWorkItem {
  const result = workOrder.items.find((entry) => entry.action === action);
  if (!result) throw new Error(`fixture work order lacks ${action}`);
  return result;
}

function adoptOpen(root: string) {
  const fixture = buildAsoiafAnswerDeskFixture();
  const adoption = adoptAsoiafAnswerDeskWorkOrder({
    root,
    workOrder: fixture.openWorkOrder,
    adoptedAt: "2026-08-05T06:20:01.000Z",
    operatorId: "operator:desk-init",
  });
  return { fixture, adoption };
}

function claimReview(root: string, fixture = buildAsoiafAnswerDeskFixture()) {
  return claimAsoiafAnswerDeskWork({
    root,
    itemId: item(fixture.openWorkOrder, "review-exact-locator").itemId,
    workerId: "worker:desk-review",
    claimedAt: "2026-08-05T06:21:00.000Z",
    leaseMilliseconds: 600_000,
  });
}

function transactionReference(fixture: ReturnType<typeof buildAsoiafAnswerDeskFixture>) {
  return {
    kind: "reviewed-answer-transaction",
    objectId: fixture.transaction.transactionId,
    fingerprint: fixture.transaction.transactionFingerprint,
    uri: null,
  };
}

function packetReference(fixture: ReturnType<typeof buildAsoiafAnswerDeskFixture>) {
  return {
    kind: "reviewed-answer-packet",
    objectId: fixture.answerPacket.answerPacketId,
    fingerprint: fixture.answerPacket.answerPacketFingerprint,
    uri: null,
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("ASOIAF answer desk estate", () => {
  it("adopts one qualified work order into portable append-only custody and replays exactly", () => {
    const root = estateRoot();
    const { fixture, adoption } = adoptOpen(root);
    const paths = asoiafAnswerDeskEstatePaths(root);

    expect(adoption.replayed).toBe(false);
    expect(adoption.manifest).toEqual(
      expect.objectContaining({
        dossierId: fixture.dossier.dossierId,
        questionId: fixture.dossier.question.questionId,
        latestWorkOrderId: fixture.openWorkOrder.workOrderId,
        workOrderCount: 1,
        leaseCount: 0,
        settlementCount: 0,
        authority: "none",
        graphEffect: "none",
        canonEffect: "none",
        answerEffect: "none",
      }),
    );
    expect(path.basename(adoption.record.workOrderUri)).not.toContain(":");
    expect(fs.existsSync(paths.workOrderLedger)).toBe(true);
    expect(verifyAsoiafAnswerDeskEstate(root)).toEqual([]);

    const replay = adoptAsoiafAnswerDeskWorkOrder({
      root,
      workOrder: fixture.openWorkOrder,
      adoptedAt: "2026-08-05T06:20:02.000Z",
      operatorId: "operator:desk-replay",
    });
    expect(replay.replayed).toBe(true);
    expect(replay.manifest.workOrderCount).toBe(1);
    expect(readAsoiafAnswerDeskStatus(root).workOrders).toHaveLength(1);
    expect(verifyAsoiafAnswerDeskEstate(root)).toEqual([]);
  });

  it("claims idempotently from authoritative ledgers and refuses an omitted concurrent lease", () => {
    const root = estateRoot();
    const { fixture } = adoptOpen(root);
    const first = claimReview(root, fixture);
    const second = claimReview(root, fixture);

    expect(second.replayed).toBe(true);
    expect(second.lease).toEqual(first.lease);
    expect(second.manifest.leaseCount).toBe(1);
    expect(second.state.activeLeaseIds).toEqual([first.lease.leaseId]);

    expect(() =>
      claimAsoiafAnswerDeskWork({
        root,
        itemId: item(fixture.openWorkOrder, "review-exact-locator").itemId,
        workerId: "worker:desk-duplicate",
        claimedAt: "2026-08-05T06:21:30.000Z",
        leaseMilliseconds: 600_000,
      }),
    ).toThrow(/already has active lease/);
    expect(readAsoiafAnswerDeskStatus(root).leases).toHaveLength(1);
    expect(verifyAsoiafAnswerDeskEstate(root)).toEqual([]);
  });

  it("recovers a stale transaction lock atomically and releases the lock after failure", () => {
    const root = estateRoot();
    const { fixture } = adoptOpen(root);
    const paths = asoiafAnswerDeskEstatePaths(root);
    fs.mkdirSync(paths.lockDirectory);
    fs.writeFileSync(paths.lockRecord, "{}\n", "utf8");

    const claim = claimReview(root, fixture);
    expect(claim.staleLocksRecovered).toBe(1);
    expect(claim.manifest.staleLockRecoveryCount).toBe(1);
    expect(fs.existsSync(paths.lockDirectory)).toBe(false);

    expect(() =>
      claimAsoiafAnswerDeskWork({
        root,
        itemId: "asoiaf-answer-work-item:missing",
        workerId: "worker:invalid",
        claimedAt: "2026-08-05T06:22:00.000Z",
        leaseMilliseconds: 60_000,
      }),
    ).toThrow(/absent/);
    expect(fs.existsSync(paths.lockDirectory)).toBe(false);
    expect(verifyAsoiafAnswerDeskEstate(root)).toEqual([]);
  });

  it("settles idempotently only after a refreshed qualified head proves advancement", () => {
    const root = estateRoot();
    const { fixture } = adoptOpen(root);
    const review = claimReview(root, fixture);
    const reconcileLease = claimAsoiafAnswerDeskWork({
      root,
      itemId: item(fixture.openWorkOrder, "reconcile-candidate").itemId,
      workerId: "worker:desk-reconcile",
      claimedAt: "2026-08-05T06:21:10.000Z",
      leaseMilliseconds: 600_000,
    });

    const settlementInput = {
      root,
      leaseId: review.lease.leaseId,
      completedAt: "2026-08-05T06:31:00.000Z",
      outcome: "satisfied" as const,
      afterWorkOrder: fixture.reconciledWorkOrder,
      resultReferences: [transactionReference(fixture)],
      reason:
        "The refreshed qualified work order proves exact primary review and private locator custody.",
    };
    const first = settleAsoiafAnswerDeskWork(settlementInput);
    const second = settleAsoiafAnswerDeskWork(settlementInput);

    expect(second.replayed).toBe(true);
    expect(second.settlement).toEqual(first.settlement);
    expect(second.manifest).toEqual(
      expect.objectContaining({
        latestWorkOrderId: fixture.reconciledWorkOrder.workOrderId,
        workOrderCount: 2,
        leaseCount: 2,
        settlementCount: 1,
      }),
    );
    expect(second.state.settledLeaseIds).toContain(review.lease.leaseId);
    expect(second.state.staleLeaseIds).toContain(reconcileLease.lease.leaseId);
    expect(readAsoiafAnswerDeskStatus(root).settlements).toHaveLength(1);
    expect(verifyAsoiafAnswerDeskEstate(root)).toEqual([]);
  });

  it("advances through gap closure, records rendering without a head change, and survives restart", () => {
    const root = estateRoot();
    const { fixture } = adoptOpen(root);
    const review = claimReview(root, fixture);
    settleAsoiafAnswerDeskWork({
      root,
      leaseId: review.lease.leaseId,
      completedAt: "2026-08-05T06:31:00.000Z",
      outcome: "satisfied",
      afterWorkOrder: fixture.reconciledWorkOrder,
      resultReferences: [transactionReference(fixture)],
      reason:
        "The refreshed qualified work order proves exact primary review and private locator custody.",
    });

    const close = claimAsoiafAnswerDeskWork({
      root,
      itemId: item(fixture.reconciledWorkOrder, "close-gap").itemId,
      workerId: "worker:desk-assembly",
      claimedAt: "2026-08-05T06:31:10.000Z",
      leaseMilliseconds: 600_000,
    });
    settleAsoiafAnswerDeskWork({
      root,
      leaseId: close.lease.leaseId,
      completedAt: "2026-08-05T06:41:00.000Z",
      outcome: "satisfied",
      afterWorkOrder: fixture.readyWorkOrder,
      resultReferences: [packetReference(fixture)],
      reason:
        "The refreshed qualified work order proves the immutable dossier gap received an exact content-addressed closure.",
    });

    const renderItem = item(fixture.readyWorkOrder, "render-reviewed-answer");
    const render = claimAsoiafAnswerDeskWork({
      root,
      itemId: renderItem.itemId,
      workerId: "worker:desk-render",
      claimedAt: "2026-08-05T06:41:10.000Z",
      leaseMilliseconds: 60_000,
    });
    settleAsoiafAnswerDeskWork({
      root,
      leaseId: render.lease.leaseId,
      completedAt: "2026-08-05T06:41:20.000Z",
      outcome: "rendered",
      resultReferences: [
        {
          kind: "reviewed-answer-render",
          objectId: `${fixture.answerPacket.answerPacketId}:rendered`,
          fingerprint: fixture.answerPacket.renderedTextDigest,
          uri: "renders/reviewed-answer.txt",
        },
      ],
      reason:
        "The deterministic renderer emitted only the reviewed packet text and exact citation ledger.",
    });

    const restarted = readAsoiafAnswerDeskStatus(root);
    expect(restarted.manifest.latestWorkOrderId).toBe(
      fixture.readyWorkOrder.workOrderId,
    );
    expect(restarted.workOrders).toHaveLength(3);
    expect(restarted.leases).toHaveLength(3);
    expect(restarted.settlements).toHaveLength(3);
    expect(restarted.state.settledLeaseIds).toContain(render.lease.leaseId);
    expect(restarted.state.availableItemIds).not.toContain(renderItem.itemId);
    expect(restarted.state.nextAvailableItemId).toBeNull();
    expect(() =>
      claimAsoiafAnswerDeskWork({
        root,
        itemId: renderItem.itemId,
        workerId: "worker:desk-second-render",
        claimedAt: "2026-08-05T06:41:30.000Z",
        leaseMilliseconds: 60_000,
      }),
    ).toThrow(/terminal settlement/);
    expect(verifyAsoiafAnswerDeskEstate(root)).toEqual([]);
  });

  it("refuses non-monotonic new work orders and cross-scope custody", () => {
    const root = estateRoot();
    const { fixture } = adoptOpen(root);
    const sameTimeDifferentOrder = buildAsoiafAnswerWorkOrder({
      dossier: fixture.dossier,
      createdBy: "desk-fixture:parallel",
      createdAt: fixture.openWorkOrder.createdAt,
      transactions: [],
      answerPacket: null,
    });
    expect(sameTimeDifferentOrder.workOrderId).not.toBe(
      fixture.openWorkOrder.workOrderId,
    );
    expect(() =>
      adoptAsoiafAnswerDeskWorkOrder({
        root,
        workOrder: sameTimeDifferentOrder,
        adoptedAt: "2026-08-05T06:22:00.000Z",
        operatorId: "operator:parallel",
      }),
    ).toThrow(/advance the latest creation time/);

    const otherDossier = buildAsoiafResearchQuestionDossierForEstateTest();
    const otherWorkOrder = buildAsoiafAnswerWorkOrder({
      dossier: otherDossier,
      createdBy: "desk-fixture:other-question",
      createdAt: "2026-08-05T06:50:00.000Z",
      transactions: [],
      answerPacket: null,
    });
    expect(() =>
      adoptAsoiafAnswerDeskWorkOrder({
        root,
        workOrder: otherWorkOrder,
        adoptedAt: "2026-08-05T06:50:01.000Z",
        operatorId: "operator:other-question",
      }),
    ).toThrow(/cannot mix dossiers or questions/);
    expect(verifyAsoiafAnswerDeskEstate(root)).toEqual([]);
  });

  it("regenerates time-sensitive state and detects manifest and ledger tampering", () => {
    const root = estateRoot();
    const { fixture } = adoptOpen(root);
    const review = claimReview(root, fixture);
    const refreshed = refreshAsoiafAnswerDeskState(
      root,
      "2026-08-05T06:31:01.000Z",
    );
    expect(refreshed.expiredLeaseIds).toContain(review.lease.leaseId);
    expect(refreshed.availableItemIds).toContain(
      item(fixture.openWorkOrder, "review-exact-locator").itemId,
    );
    expect(verifyAsoiafAnswerDeskEstate(root)).toEqual([]);

    const paths = asoiafAnswerDeskEstatePaths(root);
    const manifest = JSON.parse(
      fs.readFileSync(paths.manifest, "utf8"),
    ) as AsoiafAnswerDeskEstateManifest;
    fs.writeFileSync(
      paths.manifest,
      `${JSON.stringify({ ...manifest, leaseCount: manifest.leaseCount + 1 }, null, 2)}\n`,
      "utf8",
    );
    expect(
      verifyAsoiafAnswerDeskEstate(root).map((entry) => entry.code),
    ).toEqual(
      expect.arrayContaining([
        "manifest-fingerprint",
        "manifest-counts",
      ]),
    );
  });
});

function buildAsoiafResearchQuestionDossierForEstateTest() {
  const fixture = buildAsoiafAnswerDeskFixture();
  return {
    ...fixture.dossier,
    question: {
      ...fixture.dossier.question,
      questionId: `${fixture.dossier.question.questionId}:other`,
    },
  } as typeof fixture.dossier;
}