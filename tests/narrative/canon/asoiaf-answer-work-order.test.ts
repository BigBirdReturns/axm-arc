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
  buildAsoiafResearchQuestionDossier,
  type AsoiafResearchQuestionDossier,
} from "../../../tools/lib/asoiaf-research-question-dossier.js";
import {
  buildAsoiafReviewedAnswerPacket,
  buildAsoiafReviewedAnswerTransaction,
  type AsoiafReviewedAnswerPacket,
  type AsoiafReviewedAnswerTransaction,
} from "../../../tools/lib/asoiaf-reviewed-answer-packet.js";
import {
  buildAsoiafAnswerWorkOrder,
  validateAsoiafAnswerWorkOrder,
} from "../../../tools/lib/asoiaf-answer-work-order.js";

const DIGEST = `sha256:${"a".repeat(64)}` as const;
const SOURCE_REVIEWER = "reviewer:source";
const ANSWER_REVIEWER = "reviewer:answer";
const SOURCE_REVIEWED_AT = "2026-08-05T04:00:00.000Z";
const ANSWER_REVIEWED_AT = "2026-08-05T04:15:00.000Z";
const WORK_ORDER_CREATED_AT = "2026-08-05T04:30:00.000Z";

const agotCandidates = ASOIAF_RECALL_ESTATE_PACKETS
  .flatMap((packet) => packet.candidates)
  .filter(
    (candidate) =>
      candidate.sourceHints.includes("AGOT")
      && candidate.reconciliationKeys.length > 0,
  );
const primaryCandidate = agotCandidates[0];
const secondaryCandidate = agotCandidates[1];
if (!primaryCandidate || !secondaryCandidate) {
  throw new Error("answer work-order tests require two AGOT recall candidates");
}

function reviewPacket(): AsoiafExternalReviewPacket {
  const sourceId = "local-agot";
  const sourceRecordId = "isbn:9780553593716:work-order-holder-copy";
  return buildAsoiafExternalReviewPacket({
    id: "external-review:work-order:agot",
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
      retrievedAt: "2026-08-05T03:45:00.000Z",
      contentDigest: DIGEST,
      receiptUri: "receipts/work-order-agot-observation.json",
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
          "The synthetic exact-edition fixture retains only reviewed normalization, digest, and locator custody.",
      },
    },
    claims: [
      {
        id: "reviewed-claim:work-order:agot",
        evidenceRecordId: "external-evidence:work-order:agot",
        label: primaryCandidate.label,
        claimKind: "world-state",
        authorityRole: "primary",
        continuityId: "book-main",
        locator: {
          id: "external-locator:work-order:agot",
          kind: "chapter",
          unit: "AGOT/work-order-reviewed-range-1",
          start: 1,
          end: 2,
          contentDigest: DIGEST,
        },
        text:
          "Human-reviewed synthetic normalization supports the bounded candidate without retaining source prose.",
        normalized: {
          statement: primaryCandidate.summary,
          sourceStanding: "exact-holder-edition",
        },
        reconciliationKeys: [primaryCandidate.reconciliationKeys[0]!],
        recallCandidateIds: [primaryCandidate.id],
      },
    ],
  });
}

function decisionInput(
  packet: AsoiafExternalReviewPacket,
): AsoiafExternalDecisionInput {
  const claim = packet.claims[0]!;
  return {
    id: "external-decisions:work-order:agot",
    reviewerId: SOURCE_REVIEWER,
    reviewedAt: SOURCE_REVIEWED_AT,
    decisions: [
      {
        id: "external-decision:work-order:confirm-agot",
        action: "confirm",
        candidateIds: [primaryCandidate.id],
        evidenceRecordIds: [claim.evidenceRecordId],
        promotedRecordIds: [claim.evidenceRecordId],
        rationale:
          "The exact holder-controlled edition identity and locator confirm the bounded candidate.",
      },
    ],
  };
}

function transaction(): AsoiafReviewedAnswerTransaction {
  const packet = reviewPacket();
  const reconciliationReceipt = compileAsoiafExternalReconciliationPacket({
    packet,
    decisionInput: decisionInput(packet),
  });
  expect(reconciliationReceipt.passed).toBe(true);
  expect(reconciliationReceipt.canonReceipt?.passed).toBe(true);
  return buildAsoiafReviewedAnswerTransaction({
    packet,
    reconciliationReceipt,
  });
}

function dossier(input?: {
  includeGap?: boolean;
  includeSecondaryCandidate?: boolean;
}): AsoiafResearchQuestionDossier {
  const includeGap = input?.includeGap ?? true;
  const includeSecondaryCandidate = input?.includeSecondaryCandidate ?? false;
  return buildAsoiafResearchQuestionDossier({
    questionText:
      "What does the exact holder-controlled AGOT evidence establish for the bounded candidates?",
    createdBy: "researcher:work-order",
    createdAt: "2026-08-05T03:30:00.000Z",
    laneIds: ["entity-resolution"],
    continuityIds: ["book-main"],
    privateReferences: [
      {
        sourceId: "local-agot",
        editionKey: "work-order-holder-edition",
        continuityId: "book-main",
        unitId: "work-order-chapter-1",
        paragraphId: "work-order-paragraph-1",
        locator:
          "local-agot/work-order-holder-edition/work-order-chapter-1/work-order-paragraph-1",
        paragraphDigest: DIGEST,
        queryMode: "phrase",
        matchedTerms: ["bounded", "candidate"],
        tokenPositions: [3, 12],
        snippetDigest: null,
        snippetCharacters: null,
      },
    ],
    recallReferences: [
      {
        candidateId: primaryCandidate.id,
        continuityId: "book-main",
      },
      ...(includeSecondaryCandidate
        ? [
            {
              candidateId: secondaryCandidate.id,
              continuityId: "book-main" as const,
            },
          ]
        : []),
    ],
    gaps: includeGap
      ? [
          {
            kind: "recall-unreconciled",
            laneId: "entity-resolution",
            continuityId: "book-main",
            candidateId: primaryCandidate.id,
            detail:
              "The recall candidate remained unresolved when the immutable dossier was compiled.",
          },
        ]
      : [],
  });
}

function answerPacket(input?: {
  researchDossier?: AsoiafResearchQuestionDossier;
  answerTransaction?: AsoiafReviewedAnswerTransaction;
  limitGap?: boolean;
}): AsoiafReviewedAnswerPacket {
  const researchDossier = input?.researchDossier ?? dossier();
  const answerTransaction = input?.answerTransaction ?? transaction();
  const resolution = answerTransaction.reconciliationReceipt.canonReceipt!
    .resolutions.find((entry) => entry.action === "confirm");
  if (!resolution) throw new Error("answer work-order fixture lacks resolution");
  const claim = {
    id: "answer-claim:work-order:agot",
    order: 1,
    continuityId: "book-main",
    text:
      "The exact reviewed AGOT record confirms the bounded candidate in the book continuity.",
    transactionId: answerTransaction.transactionId,
    evidenceRecordIds: [
      answerTransaction.packet.claims[0]!.evidenceRecordId,
    ],
    resolutionDecisionIds: [resolution.decisionId],
  };
  const gap = researchDossier.gaps[0];
  return buildAsoiafReviewedAnswerPacket({
    dossier: researchDossier,
    reviewedBy: ANSWER_REVIEWER,
    reviewedAt: ANSWER_REVIEWED_AT,
    transactions: [answerTransaction],
    claims: [claim],
    gapClosures: gap && !input?.limitGap
      ? [
          {
            id: "answer-gap-closure:work-order:agot",
            gapId: gap.gapId,
            claimIds: [claim.id],
            rationale:
              "The cited primary reconciliation transaction resolves the exact dossier candidate named by this immutable gap.",
          },
        ]
      : [],
    limitations: gap && input?.limitGap
      ? [
          {
            id: "answer-limitation:work-order:agot",
            text:
              "The original dossier gap remains explicit because this partial answer packet does not claim to close it.",
            relatedGapIds: [gap.gapId],
          },
        ]
      : [],
  });
}

function compile(input: {
  researchDossier: AsoiafResearchQuestionDossier;
  transactions?: AsoiafReviewedAnswerTransaction[];
  packet?: AsoiafReviewedAnswerPacket | null;
}) {
  return buildAsoiafAnswerWorkOrder({
    dossier: input.researchDossier,
    createdBy: "operator:answer-desk",
    createdAt: WORK_ORDER_CREATED_AT,
    transactions: input.transactions,
    answerPacket: input.packet,
  });
}

describe("ASOIAF answer work order", () => {
  it("compiles deterministic review and reconciliation work before evidence is adjudicated", () => {
    const researchDossier = dossier();
    const first = compile({ researchDossier });
    const second = compile({ researchDossier });

    expect(second).toEqual(first);
    expect(validateAsoiafAnswerWorkOrder(first)).toEqual([]);
    expect(first.status).toBe("review-open");
    expect(first.answerReady).toBe(false);
    expect(first.boundedComplete).toBe(false);
    expect(first.unresolvedCandidateIds).toEqual([primaryCandidate.id]);
    expect(first.unreviewedPrivateReferenceIds).toHaveLength(1);
    expect(first.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "review-exact-locator",
          status: "open",
          authority: "none",
        }),
        expect.objectContaining({
          action: "reconcile-candidate",
          status: "open",
        }),
        expect.objectContaining({
          action: "assemble-reviewed-answer",
          status: "blocked",
        }),
      ]),
    );
  });

  it("moves to answer assembly when exact private and candidate custody are adjudicated", () => {
    const researchDossier = dossier();
    const answerTransaction = transaction();
    const workOrder = compile({
      researchDossier,
      transactions: [answerTransaction],
    });

    expect(validateAsoiafAnswerWorkOrder(workOrder)).toEqual([]);
    expect(workOrder.status).toBe("answer-assembly-open");
    expect(workOrder.resolvedCandidateIds).toEqual([primaryCandidate.id]);
    expect(workOrder.reviewedPrivateReferenceIds).toHaveLength(1);
    expect(workOrder.openGapIds).toHaveLength(1);
    expect(workOrder.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "review-exact-locator",
          status: "satisfied",
        }),
        expect.objectContaining({
          action: "reconcile-candidate",
          status: "satisfied",
        }),
        expect.objectContaining({
          action: "close-gap",
          status: "open",
        }),
        expect.objectContaining({
          action: "assemble-reviewed-answer",
          status: "open",
        }),
      ]),
    );
  });

  it("reports a bounded ready lifecycle only after exact gap closure and packet verification", () => {
    const researchDossier = dossier();
    const answerTransaction = transaction();
    const packet = answerPacket({ researchDossier, answerTransaction });
    const workOrder = compile({
      researchDossier,
      transactions: [answerTransaction],
      packet,
    });

    expect(validateAsoiafAnswerWorkOrder(workOrder)).toEqual([]);
    expect(workOrder.status).toBe("answer-ready-bounded");
    expect(workOrder.answerReady).toBe(true);
    expect(workOrder.boundedComplete).toBe(true);
    expect(workOrder.closedGapIds).toEqual([researchDossier.gaps[0]!.gapId]);
    expect(workOrder.openGapIds).toEqual([]);
    expect(workOrder.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "assemble-reviewed-answer",
          status: "satisfied",
        }),
        expect.objectContaining({
          action: "verify-reviewed-answer",
          status: "satisfied",
        }),
        expect.objectContaining({
          action: "render-reviewed-answer",
          status: "open",
          requiredForBoundedComplete: false,
        }),
      ]),
    );
  });

  it("preserves an unresolved dossier gap as a partial answer limitation", () => {
    const researchDossier = dossier();
    const answerTransaction = transaction();
    const packet = answerPacket({
      researchDossier,
      answerTransaction,
      limitGap: true,
    });
    const workOrder = compile({
      researchDossier,
      packet,
    });

    expect(validateAsoiafAnswerWorkOrder(workOrder)).toEqual([]);
    expect(workOrder.status).toBe("answer-ready-partial");
    expect(workOrder.answerReady).toBe(true);
    expect(workOrder.boundedComplete).toBe(false);
    expect(workOrder.limitedGapIds).toEqual([researchDossier.gaps[0]!.gapId]);
    expect(workOrder.items).toContainEqual(
      expect.objectContaining({
        action: "close-gap",
        status: "preserved-as-limitation",
      }),
    );
  });

  it("detects an unresolved dossier candidate hidden behind a locally valid answer packet", () => {
    const researchDossier = dossier({
      includeGap: false,
      includeSecondaryCandidate: true,
    });
    const answerTransaction = transaction();
    const packet = answerPacket({ researchDossier, answerTransaction });
    const workOrder = compile({
      researchDossier,
      transactions: [answerTransaction],
      packet,
    });

    expect(workOrder.answerReady).toBe(true);
    expect(workOrder.boundedComplete).toBe(false);
    expect(workOrder.status).toBe("answer-ready-partial");
    expect(workOrder.unresolvedCandidateIds).toEqual([secondaryCandidate.id]);
    expect(workOrder.items).toContainEqual(
      expect.objectContaining({
        action: "reconcile-candidate",
        status: "open",
        subjectIds: expect.arrayContaining([secondaryCandidate.id]),
      }),
    );
  });

  it("refuses answer-packet and transaction-set divergence", () => {
    const researchDossier = dossier();
    const answerTransaction = transaction();
    const packet = answerPacket({ researchDossier, answerTransaction });

    expect(() =>
      buildAsoiafAnswerWorkOrder({
        dossier: researchDossier,
        createdBy: "operator:answer-desk",
        createdAt: WORK_ORDER_CREATED_AT,
        transactions: [],
        answerPacket: packet,
      }),
    ).not.toThrow();

    const altered = {
      ...answerTransaction,
      transactionId: `${answerTransaction.transactionId}:other`,
    };
    expect(() =>
      buildAsoiafAnswerWorkOrder({
        dossier: researchDossier,
        createdBy: "operator:answer-desk",
        createdAt: WORK_ORDER_CREATED_AT,
        transactions: [altered],
        answerPacket: packet,
      }),
    ).toThrow(/transaction identities differ|invalid reviewed answer transaction/);
  });

  it("detects stale task, status, and work-order fingerprints", () => {
    const researchDossier = dossier();
    const workOrder = compile({ researchDossier });
    const tampered = {
      ...workOrder,
      status: "answer-ready-bounded" as const,
      items: [
        {
          ...workOrder.items[0]!,
          reason: `${workOrder.items[0]!.reason} Altered.`,
        },
        ...workOrder.items.slice(1),
      ],
    };
    expect(
      validateAsoiafAnswerWorkOrder(tampered).map((entry) => entry.code),
    ).toEqual(
      expect.arrayContaining([
        "work-item-fingerprint",
        "work-order-projection:items",
        "work-order-projection:status",
        "work-order-fingerprint",
        "work-order-identity",
      ]),
    );
  });
});