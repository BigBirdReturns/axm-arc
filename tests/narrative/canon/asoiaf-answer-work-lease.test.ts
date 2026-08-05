import { describe, expect, it } from "vitest";
import {
  ASOIAF_RECALL_ESTATE_PACKETS,
} from "../../../src/narrative/canon/asoiaf/recall/index.js";
import {
  asoiafExternalCandidateId,
  asoiafExternalObservationId,
  buildAsoiafExternalReviewPacket,
  compileAsoiafExternalReconciliationPacket,
  type AsoiafExternalDecisionInput,
  type AsoiafExternalReviewPacket,
} from "../../../src/narrative/canon/asoiaf/external/index.js";
import {
  sha256,
} from "../../../tools/lib/asoiaf-external-estate.js";
import {
  buildAsoiafResearchQuestionDossier,
} from "../../../tools/lib/asoiaf-research-question-dossier.js";
import {
  buildAsoiafReviewedAnswerPacket,
  buildAsoiafReviewedAnswerTransaction,
} from "../../../tools/lib/asoiaf-reviewed-answer-packet.js";
import {
  buildAsoiafAnswerWorkOrder,
  type AsoiafAnswerWorkItem,
  type AsoiafAnswerWorkOrder,
} from "../../../tools/lib/asoiaf-answer-work-order.js";
import {
  asoiafAnswerWorkItemKey,
  buildAsoiafAnswerDeskState,
  claimAsoiafAnswerWorkItem,
  settleAsoiafAnswerWorkItem,
  validateAsoiafAnswerDeskState,
  validateAsoiafAnswerWorkLease,
  validateAsoiafAnswerWorkSettlement,
} from "../../../tools/lib/asoiaf-answer-work-lease.js";

const DIGEST = `sha256:${"a".repeat(64)}` as const;
const SOURCE_REVIEWER = "reviewer:lease-source";
const ANSWER_REVIEWER = "reviewer:lease-answer";
const SOURCE_REVIEWED_AT = "2026-08-05T05:00:00.000Z";
const ANSWER_REVIEWED_AT = "2026-08-05T05:15:00.000Z";
const OPEN_ORDER_AT = "2026-08-05T05:20:00.000Z";
const RECONCILED_ORDER_AT = "2026-08-05T05:30:00.000Z";
const READY_ORDER_AT = "2026-08-05T05:40:00.000Z";

const selectedCandidate = ASOIAF_RECALL_ESTATE_PACKETS
  .flatMap((packet) => packet.candidates)
  .find(
    (entry) =>
      entry.sourceHints.includes("AGOT")
      && entry.reconciliationKeys.length > 0,
  );
if (!selectedCandidate) {
  throw new Error("lease fixture requires one AGOT candidate");
}
const candidate = selectedCandidate;

function reviewPacket(): AsoiafExternalReviewPacket {
  const sourceId = "local-agot";
  const sourceRecordId = "isbn:9780553593716:lease-holder-copy";
  return buildAsoiafExternalReviewPacket({
    id: "external-review:lease:agot",
    sourceId,
    continuityId: "book-main",
    observation: {
      observationId: asoiafExternalObservationId({
        sourceId,
        sourceRecordId,
        contentDigest: DIGEST,
      }),
      collectorCandidateId: asoiafExternalCandidateId(
        sourceId,
        sourceRecordId,
      ),
      sourceId,
      sourceRecordId,
      retrievedAt: "2026-08-05T04:45:00.000Z",
      contentDigest: DIGEST,
      receiptUri: "receipts/lease-agot-observation.json",
      responseBytes: 987_654,
      graphEffect: "none",
      canonEffect: "none",
      promotionStatus: "reviewed",
      reviewerId: SOURCE_REVIEWER,
      reviewedAt: SOURCE_REVIEWED_AT,
      rightsReview: {
        status: "holder-controlled-private",
        reviewedBy: SOURCE_REVIEWER,
        reviewedAt: SOURCE_REVIEWED_AT,
        rationale:
          "The synthetic exact-edition fixture retains only digest, locator, and reviewed normalization custody.",
      },
    },
    claims: [
      {
        id: "reviewed-claim:lease:agot",
        evidenceRecordId: "external-evidence:lease:agot",
        label: candidate.label,
        claimKind: "world-state",
        authorityRole: "primary",
        continuityId: "book-main",
        locator: {
          id: "external-locator:lease:agot",
          kind: "chapter",
          unit: "AGOT/lease-reviewed-range-1",
          start: 1,
          end: 2,
          contentDigest: DIGEST,
        },
        text:
          "Human-reviewed synthetic normalization supports the bounded candidate without retaining source prose.",
        normalized: {
          statement: candidate.summary,
          sourceStanding: "exact-holder-edition",
        },
        reconciliationKeys: [candidate.reconciliationKeys[0]!],
        recallCandidateIds: [candidate.id],
      },
    ],
  });
}

function decisionInput(
  packet: AsoiafExternalReviewPacket,
): AsoiafExternalDecisionInput {
  const claim = packet.claims[0]!;
  return {
    id: "external-decisions:lease:agot",
    reviewerId: SOURCE_REVIEWER,
    reviewedAt: SOURCE_REVIEWED_AT,
    decisions: [
      {
        id: "external-decision:lease:confirm-agot",
        action: "confirm",
        candidateIds: [candidate.id],
        evidenceRecordIds: [claim.evidenceRecordId],
        promotedRecordIds: [claim.evidenceRecordId],
        rationale:
          "The exact holder-controlled edition identity and locator confirm the bounded candidate.",
      },
    ],
  };
}

function fixture() {
  const packet = reviewPacket();
  const reconciliationReceipt = compileAsoiafExternalReconciliationPacket({
    packet,
    decisionInput: decisionInput(packet),
  });
  if (!reconciliationReceipt.passed || !reconciliationReceipt.canonReceipt?.passed) {
    throw new Error("lease fixture reconciliation did not pass");
  }
  const transaction = buildAsoiafReviewedAnswerTransaction({
    packet,
    reconciliationReceipt,
  });
  const resolution = reconciliationReceipt.canonReceipt.resolutions.find(
    (entry) => entry.action === "confirm",
  );
  if (!resolution) throw new Error("lease fixture lacks confirmed resolution");

  const dossier = buildAsoiafResearchQuestionDossier({
    questionText:
      "What does the exact holder-controlled AGOT evidence establish for this leased candidate?",
    createdBy: "researcher:lease",
    createdAt: "2026-08-05T04:30:00.000Z",
    laneIds: ["entity-resolution"],
    continuityIds: ["book-main"],
    privateReferences: [
      {
        sourceId: "local-agot",
        editionKey: "lease-holder-edition",
        continuityId: "book-main",
        unitId: "lease-chapter-1",
        paragraphId: "lease-paragraph-1",
        locator:
          "local-agot/lease-holder-edition/lease-chapter-1/lease-paragraph-1",
        paragraphDigest: DIGEST,
        queryMode: "phrase",
        matchedTerms: ["leased", "candidate"],
        tokenPositions: [3, 12],
        snippetDigest: null,
        snippetCharacters: null,
      },
    ],
    recallReferences: [
      {
        candidateId: candidate.id,
        continuityId: "book-main",
      },
    ],
    gaps: [
      {
        kind: "recall-unreconciled",
        laneId: "entity-resolution",
        continuityId: "book-main",
        candidateId: candidate.id,
        detail:
          "The candidate remained unresolved when the immutable lease fixture dossier was compiled.",
      },
    ],
  });

  const openOrder = buildAsoiafAnswerWorkOrder({
    dossier,
    createdBy: "desk:lease-open",
    createdAt: OPEN_ORDER_AT,
    transactions: [],
    answerPacket: null,
  });
  const reconciledOrder = buildAsoiafAnswerWorkOrder({
    dossier,
    createdBy: "desk:lease-reconciled",
    createdAt: RECONCILED_ORDER_AT,
    transactions: [transaction],
    answerPacket: null,
  });
  const claim = {
    id: "answer-claim:lease:agot",
    order: 1,
    continuityId: "book-main",
    text:
      "The exact reviewed AGOT record confirms the bounded candidate in the book continuity.",
    transactionId: transaction.transactionId,
    evidenceRecordIds: [packet.claims[0]!.evidenceRecordId],
    resolutionDecisionIds: [resolution.decisionId],
  };
  const answerPacket = buildAsoiafReviewedAnswerPacket({
    dossier,
    reviewedBy: ANSWER_REVIEWER,
    reviewedAt: ANSWER_REVIEWED_AT,
    transactions: [transaction],
    claims: [claim],
    gapClosures: [
      {
        id: "answer-gap-closure:lease:agot",
        gapId: dossier.gaps[0]!.gapId,
        claimIds: [claim.id],
        rationale:
          "The cited primary reconciliation transaction resolves the exact candidate named by the immutable dossier gap.",
      },
    ],
    limitations: [],
  });
  const readyOrder = buildAsoiafAnswerWorkOrder({
    dossier,
    createdBy: "desk:lease-ready",
    createdAt: READY_ORDER_AT,
    transactions: [transaction],
    answerPacket,
  });
  return {
    packet,
    transaction,
    dossier,
    answerPacket,
    openOrder,
    reconciledOrder,
    readyOrder,
  };
}

function item(
  workOrder: AsoiafAnswerWorkOrder,
  action: AsoiafAnswerWorkItem["action"],
): AsoiafAnswerWorkItem {
  const found = workOrder.items.find((entry) => entry.action === action);
  if (!found) throw new Error(`work order lacks action ${action}`);
  return found;
}

function resultReference(kind: string, objectId: string, fingerprint: string) {
  return {
    kind,
    objectId,
    fingerprint,
    uri: null,
  };
}

describe("ASOIAF answer work leases", () => {
  it("claims one exact open item deterministically and removes it from desk availability", () => {
    const { openOrder } = fixture();
    const reviewItem = item(openOrder, "review-exact-locator");
    const first = claimAsoiafAnswerWorkItem({
      workOrder: openOrder,
      itemId: reviewItem.itemId,
      workerId: "worker:alpha",
      claimedAt: "2026-08-05T05:21:00.000Z",
      leaseMilliseconds: 60_000,
    });
    const second = claimAsoiafAnswerWorkItem({
      workOrder: openOrder,
      itemId: reviewItem.itemId,
      workerId: "worker:alpha",
      claimedAt: "2026-08-05T05:21:00.000Z",
      leaseMilliseconds: 60_000,
    });

    expect(second).toEqual(first);
    expect(validateAsoiafAnswerWorkLease(first, openOrder)).toEqual([]);
    expect(first).toEqual(
      expect.objectContaining({
        workOrderId: openOrder.workOrderId,
        itemId: reviewItem.itemId,
        itemKey: asoiafAnswerWorkItemKey(reviewItem),
        action: "review-exact-locator",
        workerId: "worker:alpha",
        authority: "none",
        graphEffect: "none",
        canonEffect: "none",
        answerEffect: "none",
      }),
    );

    const state = buildAsoiafAnswerDeskState({
      workOrder: openOrder,
      leases: [first],
      settlements: [],
      asOf: "2026-08-05T05:21:30.000Z",
    });
    expect(validateAsoiafAnswerDeskState(state, {
      workOrder: openOrder,
      leases: [first],
      settlements: [],
      asOf: "2026-08-05T05:21:30.000Z",
    })).toEqual([]);
    expect(state.activeLeaseIds).toEqual([first.leaseId]);
    expect(state.availableItemIds).not.toContain(reviewItem.itemId);
  });

  it("refuses a concurrent active lease and releases an expired lease", () => {
    const { openOrder } = fixture();
    const reviewItem = item(openOrder, "review-exact-locator");
    const lease = claimAsoiafAnswerWorkItem({
      workOrder: openOrder,
      itemId: reviewItem.itemId,
      workerId: "worker:alpha",
      claimedAt: "2026-08-05T05:21:00.000Z",
      leaseMilliseconds: 60_000,
    });

    expect(() =>
      claimAsoiafAnswerWorkItem({
        workOrder: openOrder,
        itemId: reviewItem.itemId,
        workerId: "worker:beta",
        claimedAt: "2026-08-05T05:21:30.000Z",
        leaseMilliseconds: 60_000,
        existingLeases: [lease],
      }),
    ).toThrow(/already has active lease/);

    const state = buildAsoiafAnswerDeskState({
      workOrder: openOrder,
      leases: [lease],
      settlements: [],
      asOf: "2026-08-05T05:22:01.000Z",
    });
    expect(state.expiredLeaseIds).toEqual([lease.leaseId]);
    expect(state.availableItemIds).toContain(reviewItem.itemId);

    expect(() =>
      claimAsoiafAnswerWorkItem({
        workOrder: openOrder,
        itemId: reviewItem.itemId,
        workerId: "worker:beta",
        claimedAt: "2026-08-05T05:22:01.000Z",
        leaseMilliseconds: 60_000,
        existingLeases: [lease],
      }),
    ).not.toThrow();
  });

  it("accepts advancement only when a refreshed work order proves the exact item satisfied", () => {
    const { transaction, openOrder, reconciledOrder } = fixture();
    const reviewItem = item(openOrder, "review-exact-locator");
    const lease = claimAsoiafAnswerWorkItem({
      workOrder: openOrder,
      itemId: reviewItem.itemId,
      workerId: "worker:review",
      claimedAt: "2026-08-05T05:21:00.000Z",
      leaseMilliseconds: 600_000,
    });
    const settlement = settleAsoiafAnswerWorkItem({
      lease,
      beforeWorkOrder: openOrder,
      completedAt: "2026-08-05T05:31:00.000Z",
      outcome: "satisfied",
      afterWorkOrder: reconciledOrder,
      resultReferences: [
        resultReference(
          "reviewed-answer-transaction",
          transaction.transactionId,
          transaction.transactionFingerprint,
        ),
      ],
      reason:
        "The refreshed qualified work order proves that the exact private locator is now carried by primary reviewed evidence.",
    });

    expect(validateAsoiafAnswerWorkSettlement(settlement, {
      lease,
      beforeWorkOrder: openOrder,
      afterWorkOrder: reconciledOrder,
    })).toEqual([]);
    expect(settlement.afterStatus).toBe("satisfied");
    expect(settlement.afterWorkOrderId).toBe(reconciledOrder.workOrderId);

    expect(() =>
      settleAsoiafAnswerWorkItem({
        lease,
        beforeWorkOrder: openOrder,
        completedAt: "2026-08-05T05:31:00.000Z",
        outcome: "satisfied",
        afterWorkOrder: openOrder,
        resultReferences: [
          resultReference(
            "reviewed-answer-transaction",
            transaction.transactionId,
            transaction.transactionFingerprint,
          ),
        ],
        reason:
          "The caller attempts to satisfy the lease without a refreshed qualified work-order transition.",
      }),
    ).toThrow(/work-order-transition|item-transition/);
  });

  it("settles a gap closure only when the ready work order proves exact closure", () => {
    const { answerPacket, reconciledOrder, readyOrder } = fixture();
    const closeItem = item(reconciledOrder, "close-gap");
    const lease = claimAsoiafAnswerWorkItem({
      workOrder: reconciledOrder,
      itemId: closeItem.itemId,
      workerId: "worker:assembly",
      claimedAt: "2026-08-05T05:31:00.000Z",
      leaseMilliseconds: 600_000,
    });
    const settlement = settleAsoiafAnswerWorkItem({
      lease,
      beforeWorkOrder: reconciledOrder,
      completedAt: "2026-08-05T05:41:00.000Z",
      outcome: "satisfied",
      afterWorkOrder: readyOrder,
      resultReferences: [
        resultReference(
          "reviewed-answer-packet",
          answerPacket.answerPacketId,
          answerPacket.answerPacketFingerprint,
        ),
      ],
      reason:
        "The refreshed qualified work order proves that the immutable dossier gap received an exact content-addressed closure.",
    });
    expect(validateAsoiafAnswerWorkSettlement(settlement, {
      lease,
      beforeWorkOrder: reconciledOrder,
      afterWorkOrder: readyOrder,
    })).toEqual([]);
    expect(settlement.afterStatus).toBe("satisfied");
  });

  it("records render completion without pretending the work order changed", () => {
    const { answerPacket, readyOrder } = fixture();
    const renderItem = item(readyOrder, "render-reviewed-answer");
    const lease = claimAsoiafAnswerWorkItem({
      workOrder: readyOrder,
      itemId: renderItem.itemId,
      workerId: "worker:renderer",
      claimedAt: "2026-08-05T05:41:00.000Z",
      leaseMilliseconds: 60_000,
    });
    const settlement = settleAsoiafAnswerWorkItem({
      lease,
      beforeWorkOrder: readyOrder,
      completedAt: "2026-08-05T05:41:10.000Z",
      outcome: "rendered",
      resultReferences: [
        resultReference(
          "reviewed-answer-render",
          `${answerPacket.answerPacketId}:rendered`,
          sha256("The exact reviewed AGOT record confirms the bounded candidate."),
        ),
      ],
      reason:
        "The deterministic renderer emitted only the reviewed packet text and exact citation ledger.",
    });
    expect(validateAsoiafAnswerWorkSettlement(settlement, {
      lease,
      beforeWorkOrder: readyOrder,
      afterWorkOrder: null,
    })).toEqual([]);
    expect(settlement.afterWorkOrderId).toBeNull();
    expect(settlement.afterStatus).toBe("rendered");
  });

  it("preserves failed, expired, and stale attempts as non-advancing terminals", () => {
    const { openOrder, reconciledOrder } = fixture();
    const reviewItem = item(openOrder, "review-exact-locator");
    const lease = claimAsoiafAnswerWorkItem({
      workOrder: openOrder,
      itemId: reviewItem.itemId,
      workerId: "worker:failure",
      claimedAt: "2026-08-05T05:21:00.000Z",
      leaseMilliseconds: 60_000,
    });

    const failed = settleAsoiafAnswerWorkItem({
      lease,
      beforeWorkOrder: openOrder,
      completedAt: "2026-08-05T05:21:20.000Z",
      outcome: "failed",
      reason:
        "The external review transaction failed before it produced any qualified reviewed observation or receipt.",
    });
    expect(failed.afterWorkOrderId).toBeNull();
    expect(failed.afterStatus).toBeNull();

    const expired = settleAsoiafAnswerWorkItem({
      lease,
      beforeWorkOrder: openOrder,
      completedAt: "2026-08-05T05:22:01.000Z",
      outcome: "expired",
      reason: "The lease expired without an external transaction result.",
    });
    expect(expired.outcome).toBe("expired");

    const stale = settleAsoiafAnswerWorkItem({
      lease,
      beforeWorkOrder: openOrder,
      completedAt: "2026-08-05T05:31:00.000Z",
      outcome: "stale",
      afterWorkOrder: reconciledOrder,
      reason:
        "A newer qualified work order superseded the exact head before this lease produced an admissible result.",
    });
    expect(stale.afterWorkOrderId).toBe(reconciledOrder.workOrderId);

    const state = buildAsoiafAnswerDeskState({
      workOrder: reconciledOrder,
      leases: [lease],
      settlements: [],
      asOf: "2026-08-05T05:31:00.000Z",
    });
    expect(state.staleLeaseIds).toEqual([lease.leaseId]);
  });

  it("refuses terminal replay and detects lease, settlement, and state tampering", () => {
    const { transaction, openOrder, reconciledOrder } = fixture();
    const reviewItem = item(openOrder, "review-exact-locator");
    const lease = claimAsoiafAnswerWorkItem({
      workOrder: openOrder,
      itemId: reviewItem.itemId,
      workerId: "worker:tamper",
      claimedAt: "2026-08-05T05:21:00.000Z",
      leaseMilliseconds: 600_000,
    });
    const settlement = settleAsoiafAnswerWorkItem({
      lease,
      beforeWorkOrder: openOrder,
      completedAt: "2026-08-05T05:31:00.000Z",
      outcome: "satisfied",
      afterWorkOrder: reconciledOrder,
      resultReferences: [
        resultReference(
          "reviewed-answer-transaction",
          transaction.transactionId,
          transaction.transactionFingerprint,
        ),
      ],
      reason:
        "The refreshed qualified work order proves exact primary review and locator custody.",
    });

    expect(() =>
      settleAsoiafAnswerWorkItem({
        lease,
        beforeWorkOrder: openOrder,
        completedAt: "2026-08-05T05:31:01.000Z",
        outcome: "failed",
        reason:
          "A second settlement is forbidden because the exact lease already has a terminal receipt.",
        priorSettlements: [settlement],
      }),
    ).toThrow(/already settled/);

    const tamperedLease = {
      ...lease,
      workerId: "worker:different",
    };
    expect(
      validateAsoiafAnswerWorkLease(tamperedLease, openOrder).map(
        (entry) => entry.code,
      ),
    ).toEqual(
      expect.arrayContaining([
        "lease-fingerprint",
        "lease-identity",
      ]),
    );

    const tamperedSettlement = {
      ...settlement,
      reason: `${settlement.reason} Altered.`,
    };
    expect(
      validateAsoiafAnswerWorkSettlement(tamperedSettlement, {
        lease,
        beforeWorkOrder: openOrder,
        afterWorkOrder: reconciledOrder,
      }).map((entry) => entry.code),
    ).toEqual(
      expect.arrayContaining([
        "settlement-fingerprint",
        "settlement-identity",
      ]),
    );

    const stateInput = {
      workOrder: openOrder,
      leases: [lease],
      settlements: [],
      asOf: "2026-08-05T05:21:30.000Z",
    };
    const state = buildAsoiafAnswerDeskState(stateInput);
    const tamperedState = {
      ...state,
      nextAvailableItemId: lease.itemId,
    };
    expect(
      validateAsoiafAnswerDeskState(tamperedState, stateInput).map(
        (entry) => entry.code),
    ).toEqual(
      expect.arrayContaining([
        "desk-state-projection",
        "desk-state-fingerprint",
        "desk-state-identity",
      ]),
    );
  });
});