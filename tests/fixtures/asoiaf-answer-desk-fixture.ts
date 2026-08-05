import {
  ASOIAF_RECALL_ESTATE_PACKETS,
} from "../../src/narrative/canon/asoiaf/recall/index.js";
import {
  asoiafExternalCandidateId,
  asoiafExternalObservationId,
  buildAsoiafExternalReviewPacket,
  compileAsoiafExternalReconciliationPacket,
  type AsoiafExternalDecisionInput,
  type AsoiafExternalReviewPacket,
} from "../../src/narrative/canon/asoiaf/external/index.js";
import {
  buildAsoiafResearchQuestionDossier,
  type AsoiafResearchQuestionDossier,
} from "../../tools/lib/asoiaf-research-question-dossier.js";
import {
  buildAsoiafReviewedAnswerPacket,
  buildAsoiafReviewedAnswerTransaction,
  type AsoiafReviewedAnswerPacket,
  type AsoiafReviewedAnswerTransaction,
} from "../../tools/lib/asoiaf-reviewed-answer-packet.js";
import {
  buildAsoiafAnswerWorkOrder,
  type AsoiafAnswerWorkOrder,
} from "../../tools/lib/asoiaf-answer-work-order.js";

export const ASOIAF_ANSWER_DESK_FIXTURE_DIGEST =
  `sha256:${"a".repeat(64)}` as const;
export const ASOIAF_ANSWER_DESK_FIXTURE_SOURCE_REVIEWER =
  "reviewer:desk-source";
export const ASOIAF_ANSWER_DESK_FIXTURE_ANSWER_REVIEWER =
  "reviewer:desk-answer";
export const ASOIAF_ANSWER_DESK_FIXTURE_OPEN_AT =
  "2026-08-05T06:20:00.000Z";
export const ASOIAF_ANSWER_DESK_FIXTURE_RECONCILED_AT =
  "2026-08-05T06:30:00.000Z";
export const ASOIAF_ANSWER_DESK_FIXTURE_READY_AT =
  "2026-08-05T06:40:00.000Z";

const selectedCandidate = ASOIAF_RECALL_ESTATE_PACKETS
  .flatMap((packet) => packet.candidates)
  .find(
    (candidate) =>
      candidate.sourceHints.includes("AGOT")
      && candidate.reconciliationKeys.length > 0,
  );
if (!selectedCandidate) {
  throw new Error("answer desk fixture requires one AGOT recall candidate");
}
export const ASOIAF_ANSWER_DESK_FIXTURE_CANDIDATE = selectedCandidate;

function buildReviewPacket(): AsoiafExternalReviewPacket {
  const sourceId = "local-agot";
  const sourceRecordId = "isbn:9780553593716:desk-holder-copy";
  return buildAsoiafExternalReviewPacket({
    id: "external-review:desk:agot",
    sourceId,
    continuityId: "book-main",
    observation: {
      observationId: asoiafExternalObservationId({
        sourceId,
        sourceRecordId,
        contentDigest: ASOIAF_ANSWER_DESK_FIXTURE_DIGEST,
      }),
      collectorCandidateId: asoiafExternalCandidateId(
        sourceId,
        sourceRecordId,
      ),
      sourceId,
      sourceRecordId,
      retrievedAt: "2026-08-05T06:00:00.000Z",
      contentDigest: ASOIAF_ANSWER_DESK_FIXTURE_DIGEST,
      receiptUri: "receipts/desk-agot-observation.json",
      responseBytes: 987_654,
      graphEffect: "none",
      canonEffect: "none",
      promotionStatus: "reviewed",
      reviewerId: ASOIAF_ANSWER_DESK_FIXTURE_SOURCE_REVIEWER,
      reviewedAt: "2026-08-05T06:05:00.000Z",
      rightsReview: {
        status: "holder-controlled-private",
        reviewedBy: ASOIAF_ANSWER_DESK_FIXTURE_SOURCE_REVIEWER,
        reviewedAt: "2026-08-05T06:05:00.000Z",
        rationale:
          "The reusable desk fixture retains only digest, locator, and reviewed normalization custody.",
      },
    },
    claims: [
      {
        id: "reviewed-claim:desk:agot",
        evidenceRecordId: "external-evidence:desk:agot",
        label: ASOIAF_ANSWER_DESK_FIXTURE_CANDIDATE.label,
        claimKind: "world-state",
        authorityRole: "primary",
        continuityId: "book-main",
        locator: {
          id: "external-locator:desk:agot",
          kind: "chapter",
          unit: "AGOT/desk-reviewed-range-1",
          start: 1,
          end: 2,
          contentDigest: ASOIAF_ANSWER_DESK_FIXTURE_DIGEST,
        },
        text:
          "Human-reviewed synthetic normalization supports the bounded candidate without retaining source prose.",
        normalized: {
          statement: ASOIAF_ANSWER_DESK_FIXTURE_CANDIDATE.summary,
          sourceStanding: "exact-holder-edition",
        },
        reconciliationKeys: [
          ASOIAF_ANSWER_DESK_FIXTURE_CANDIDATE.reconciliationKeys[0]!,
        ],
        recallCandidateIds: [ASOIAF_ANSWER_DESK_FIXTURE_CANDIDATE.id],
      },
    ],
  });
}

function buildDecisionInput(
  packet: AsoiafExternalReviewPacket,
): AsoiafExternalDecisionInput {
  const claim = packet.claims[0]!;
  return {
    id: "external-decisions:desk:agot",
    reviewerId: ASOIAF_ANSWER_DESK_FIXTURE_SOURCE_REVIEWER,
    reviewedAt: "2026-08-05T06:05:00.000Z",
    decisions: [
      {
        id: "external-decision:desk:confirm-agot",
        action: "confirm",
        candidateIds: [ASOIAF_ANSWER_DESK_FIXTURE_CANDIDATE.id],
        evidenceRecordIds: [claim.evidenceRecordId],
        promotedRecordIds: [claim.evidenceRecordId],
        rationale:
          "The exact holder-controlled edition identity and locator confirm the bounded desk candidate.",
      },
    ],
  };
}

function buildDossier(): AsoiafResearchQuestionDossier {
  return buildAsoiafResearchQuestionDossier({
    questionText:
      "What does the exact holder-controlled AGOT evidence establish for this desk candidate?",
    createdBy: "researcher:desk-fixture",
    createdAt: "2026-08-05T05:55:00.000Z",
    laneIds: ["entity-resolution"],
    continuityIds: ["book-main"],
    privateReferences: [
      {
        sourceId: "local-agot",
        editionKey: "desk-holder-edition",
        continuityId: "book-main",
        unitId: "desk-chapter-1",
        paragraphId: "desk-paragraph-1",
        locator:
          "local-agot/desk-holder-edition/desk-chapter-1/desk-paragraph-1",
        paragraphDigest: ASOIAF_ANSWER_DESK_FIXTURE_DIGEST,
        queryMode: "phrase",
        matchedTerms: ["desk", "candidate"],
        tokenPositions: [3, 12],
        snippetDigest: null,
        snippetCharacters: null,
      },
    ],
    recallReferences: [
      {
        candidateId: ASOIAF_ANSWER_DESK_FIXTURE_CANDIDATE.id,
        continuityId: "book-main",
      },
    ],
    gaps: [
      {
        kind: "recall-unreconciled",
        laneId: "entity-resolution",
        continuityId: "book-main",
        candidateId: ASOIAF_ANSWER_DESK_FIXTURE_CANDIDATE.id,
        detail:
          "The candidate remained unresolved when the immutable desk fixture dossier was compiled.",
      },
    ],
  });
}

export interface AsoiafAnswerDeskFixture {
  packet: AsoiafExternalReviewPacket;
  transaction: AsoiafReviewedAnswerTransaction;
  dossier: AsoiafResearchQuestionDossier;
  answerPacket: AsoiafReviewedAnswerPacket;
  openWorkOrder: AsoiafAnswerWorkOrder;
  reconciledWorkOrder: AsoiafAnswerWorkOrder;
  readyWorkOrder: AsoiafAnswerWorkOrder;
}

export function buildAsoiafAnswerDeskFixture(): AsoiafAnswerDeskFixture {
  const packet = buildReviewPacket();
  const reconciliationReceipt = compileAsoiafExternalReconciliationPacket({
    packet,
    decisionInput: buildDecisionInput(packet),
  });
  if (!reconciliationReceipt.passed || !reconciliationReceipt.canonReceipt?.passed) {
    throw new Error("answer desk fixture reconciliation did not pass");
  }
  const transaction = buildAsoiafReviewedAnswerTransaction({
    packet,
    reconciliationReceipt,
  });
  const resolution = reconciliationReceipt.canonReceipt.resolutions.find(
    (entry) => entry.action === "confirm",
  );
  if (!resolution) throw new Error("answer desk fixture lacks a confirmed resolution");
  const dossier = buildDossier();
  const claim = {
    id: "answer-claim:desk:agot",
    order: 1,
    continuityId: "book-main",
    text:
      "The exact reviewed AGOT record confirms the bounded desk candidate in the book continuity.",
    transactionId: transaction.transactionId,
    evidenceRecordIds: [packet.claims[0]!.evidenceRecordId],
    resolutionDecisionIds: [resolution.decisionId],
  };
  const answerPacket = buildAsoiafReviewedAnswerPacket({
    dossier,
    reviewedBy: ASOIAF_ANSWER_DESK_FIXTURE_ANSWER_REVIEWER,
    reviewedAt: "2026-08-05T06:15:00.000Z",
    transactions: [transaction],
    claims: [claim],
    gapClosures: [
      {
        id: "answer-gap-closure:desk:agot",
        gapId: dossier.gaps[0]!.gapId,
        claimIds: [claim.id],
        rationale:
          "The cited primary reconciliation transaction resolves the exact candidate named by the immutable desk gap.",
      },
    ],
    limitations: [],
  });
  const openWorkOrder = buildAsoiafAnswerWorkOrder({
    dossier,
    createdBy: "desk-fixture:open",
    createdAt: ASOIAF_ANSWER_DESK_FIXTURE_OPEN_AT,
    transactions: [],
    answerPacket: null,
  });
  const reconciledWorkOrder = buildAsoiafAnswerWorkOrder({
    dossier,
    createdBy: "desk-fixture:reconciled",
    createdAt: ASOIAF_ANSWER_DESK_FIXTURE_RECONCILED_AT,
    transactions: [transaction],
    answerPacket: null,
  });
  const readyWorkOrder = buildAsoiafAnswerWorkOrder({
    dossier,
    createdBy: "desk-fixture:ready",
    createdAt: ASOIAF_ANSWER_DESK_FIXTURE_READY_AT,
    transactions: [transaction],
    answerPacket,
  });
  return {
    packet,
    transaction,
    dossier,
    answerPacket,
    openWorkOrder,
    reconciledWorkOrder,
    readyWorkOrder,
  };
}