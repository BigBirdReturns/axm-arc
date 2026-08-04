import { describe, expect, it } from "vitest";
import {
  ASOIAF_RECALL_ESTATE_PACKETS,
} from "../../../src/narrative/canon/asoiaf/recall/index.js";
import {
  asoiafExternalCandidateId,
  asoiafExternalObservationId,
  buildAsoiafExternalEvidenceBundle,
  buildAsoiafExternalReconciliationWorkOrder,
  buildAsoiafExternalReviewPacket,
  compileAsoiafExternalReconciliationPacket,
  validateAsoiafExternalReviewPacket,
  type AsoiafExternalDecisionInput,
  type AsoiafExternalReviewPacket,
} from "../../../src/narrative/canon/asoiaf/external/index.js";

const DIGEST = `sha256:${"a".repeat(64)}` as const;
const REVIEWER = "reviewer:jonathan";
const REVIEWED_AT = "2026-08-04T12:00:00.000Z";

const recallCandidates = ASOIAF_RECALL_ESTATE_PACKETS.flatMap(
  (packet) => packet.candidates,
);
const agotCandidate = recallCandidates.find(
  (candidate) =>
    candidate.sourceHints.includes("AGOT")
    && candidate.reconciliationKeys.length > 0,
)!;

function primaryAgotPacket(): AsoiafExternalReviewPacket {
  const sourceId = "local-agot";
  const sourceRecordId = "isbn:9780553593716:holder-copy-1";
  return buildAsoiafExternalReviewPacket({
    id: "external-review:agot:bran-1",
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
      retrievedAt: "2026-08-04T10:00:00.000Z",
      contentDigest: DIGEST,
      receiptUri: "receipts/asoiaf-external-observation-agot.json",
      responseBytes: 987_654,
      graphEffect: "none",
      canonEffect: "none",
      promotionStatus: "reviewed",
      reviewerId: REVIEWER,
      reviewedAt: REVIEWED_AT,
      rightsReview: {
        status: "holder-controlled-private",
        reviewedBy: REVIEWER,
        reviewedAt: REVIEWED_AT,
        rationale:
          "The holder supplied the exact edition and only digest, locator, and reviewed normalization enter the packet.",
      },
    },
    claims: [
      {
        id: "reviewed-claim:agot:bran-1",
        evidenceRecordId: "external-evidence:agot:bran-1",
        label: agotCandidate.label,
        claimKind: "world-state",
        authorityRole: "primary",
        continuityId: "book-main",
        locator: {
          id: "external-locator:agot:bran-1",
          kind: "chapter-character-range",
          label: "AGOT reviewed chapter range",
          path: "AGOT/Bran-I/reviewed-range-1",
          start: 1,
          end: 2,
          contentDigest: DIGEST,
        },
        text:
          "Human-reviewed normalized evidence supporting the candidate without publishing the source passage.",
        normalized: {
          statement: agotCandidate.summary,
          sourceStanding: "exact-holder-edition",
        },
        reconciliationKeys: [agotCandidate.reconciliationKeys[0]!],
        recallCandidateIds: [agotCandidate.id],
      },
    ],
  });
}

function confirmDecision(packet: AsoiafExternalReviewPacket): AsoiafExternalDecisionInput {
  const claim = packet.claims[0]!;
  return {
    id: "external-decisions:agot:bran-1",
    reviewerId: REVIEWER,
    reviewedAt: REVIEWED_AT,
    decisions: [
      {
        id: "external-decision:confirm-agot-candidate",
        action: "confirm",
        candidateIds: [agotCandidate.id],
        evidenceRecordIds: [claim.evidenceRecordId],
        promotedRecords: [
          {
            id: "external-promoted:agot:bran-1",
            targetType: "proposition",
            normalized: {
              statement: agotCandidate.summary,
              reconciliationKeys: [agotCandidate.reconciliationKeys[0]!],
            },
            sourceEvidenceRecordIds: [claim.evidenceRecordId],
          },
        ],
        rationale:
          "The exact holder-controlled edition and locator confirm the bounded candidate.",
      },
    ],
  };
}

describe("ASOIAF external reconciliation packets", () => {
  it("builds deterministic review packets and exact evidence bundles", () => {
    const packet = primaryAgotPacket();
    const reordered = buildAsoiafExternalReviewPacket({
      ...packet,
      claims: [...packet.claims].reverse().map((claim) => ({
        ...claim,
        reconciliationKeys: [...claim.reconciliationKeys].reverse(),
        recallCandidateIds: [...claim.recallCandidateIds].reverse(),
      })),
    });
    expect(reordered).toEqual(packet);
    expect(validateAsoiafExternalReviewPacket(packet)).toEqual([]);
    const bundle = buildAsoiafExternalEvidenceBundle(packet);
    expect(bundle.sources).toHaveLength(1);
    expect(bundle.sources[0]?.fileName).toBe("[logical-source:local-agot]");
    expect(bundle.sources[0]?.fileName).not.toContain(".epub");
    expect(bundle.sources[0]?.contentDigest).toBe("a".repeat(64));
    expect(bundle.records[0]?.reviewStatus).toBe("reviewed");
    expect(bundle.records[0]?.reviewedBy).toBe(REVIEWER);
  });

  it("compiles exact primary evidence through the existing canon reconciliation transaction", () => {
    const packet = primaryAgotPacket();
    const workOrder = buildAsoiafExternalReconciliationWorkOrder(packet);
    expect(workOrder).not.toBeNull();
    expect(workOrder?.candidateIds).toContain(agotCandidate.id);
    const receipt = compileAsoiafExternalReconciliationPacket({
      packet,
      decisionInput: confirmDecision(packet),
    });
    expect(receipt.passed).toBe(true);
    expect(receipt.canonReceipt?.passed).toBe(true);
    expect(receipt.canonReceipt?.resolvedCandidateIds).toContain(
      agotCandidate.id,
    );
    expect(receipt.canonReceipt?.promotedRecords).toHaveLength(1);
    expect(receipt.findings.filter((entry) => entry.severity === "error")).toEqual([]);
  });

  it("refuses collector intake that has not acquired named human review", () => {
    const valid = primaryAgotPacket();
    const invalid = {
      ...valid,
      observation: {
        ...valid.observation,
        promotionStatus: "intake-only",
      },
    } as unknown as AsoiafExternalReviewPacket;
    const findings = validateAsoiafExternalReviewPacket(invalid);
    expect(findings.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "observation-not-reviewed",
        "packet-fingerprint",
      ]),
    );
    const receipt = compileAsoiafExternalReconciliationPacket({
      packet: invalid,
      decisionInput: confirmDecision(valid),
    });
    expect(receipt.passed).toBe(false);
    expect(receipt.canonReceipt).toBeNull();
  });

  it("refuses a reviewer crossing between observation review and canon decision", () => {
    const packet = primaryAgotPacket();
    const decision = {
      ...confirmDecision(packet),
      reviewerId: "reviewer:different",
    };
    const receipt = compileAsoiafExternalReconciliationPacket({
      packet,
      decisionInput: decision,
    });
    expect(receipt.passed).toBe(false);
    expect(receipt.canonReceipt).toBeNull();
    expect(receipt.findings.map((entry) => entry.code)).toContain(
      "decision-reviewer-mismatch",
    );
  });

  it("keeps community reference evidence supporting rather than primary", () => {
    const sourceId = "community-awoiaf";
    const sourceRecordId = "awoiaf:pageid:123";
    const packet = buildAsoiafExternalReviewPacket({
      id: "external-review:community:varys",
      sourceId,
      continuityId: "analysis",
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
        retrievedAt: REVIEWED_AT,
        contentDigest: DIGEST,
        receiptUri: "receipts/community-varys.json",
        responseBytes: 10_000,
        graphEffect: "none",
        canonEffect: "none",
        promotionStatus: "reviewed",
        reviewerId: REVIEWER,
        reviewedAt: REVIEWED_AT,
        rightsReview: {
          status: "link-only",
          reviewedBy: REVIEWER,
          reviewedAt: REVIEWED_AT,
          rationale: "Community landing page retained as a provenance route only.",
        },
      },
      claims: [
        {
          id: "community-claim:varys",
          evidenceRecordId: "community-evidence:varys",
          label: "Community Varys reference",
          claimKind: "fictional-event",
          authorityRole: "primary",
          continuityId: "analysis",
          locator: {
            id: "community-locator:varys",
            kind: "page-route",
            label: "Community route",
            path: "awoiaf/Varys",
            start: 1,
            end: 2,
          },
          text: "Community summary offered as if it were primary evidence.",
          normalized: { reconciliationKeys: [agotCandidate.reconciliationKeys[0]!] },
          reconciliationKeys: [agotCandidate.reconciliationKeys[0]!],
          recallCandidateIds: [agotCandidate.id],
        },
      ],
    });
    expect(
      validateAsoiafExternalReviewPacket(packet).map((entry) => entry.code),
    ).toEqual(
      expect.arrayContaining([
        "nonprimary-source-promoted",
        "primary-standing-forbidden",
        "rights-review-mismatch",
      ]),
    );
  });

  it("allows scholarly material to constrain a hypothesis but not adjudicate canon", () => {
    const sourceId = "scholarly-sacred-texts";
    const sourceRecordId = "sacred-texts:cybele-entry";
    const packet = buildAsoiafExternalReviewPacket({
      id: "external-review:analogue:cybele",
      sourceId,
      continuityId: "historical-analogue",
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
        retrievedAt: REVIEWED_AT,
        contentDigest: DIGEST,
        receiptUri: "receipts/analogue-cybele.json",
        responseBytes: 12_000,
        graphEffect: "none",
        canonEffect: "none",
        promotionStatus: "reviewed",
        reviewerId: REVIEWER,
        reviewedAt: REVIEWED_AT,
        rightsReview: {
          status: "metadata-only",
          reviewedBy: REVIEWER,
          reviewedAt: REVIEWED_AT,
          rationale: "Only bibliographic metadata and locator were retained.",
        },
      },
      claims: [
        {
          id: "analogue-claim:cybele",
          evidenceRecordId: "analogue-evidence:cybele",
          label: "Cybele analogue constraint",
          claimKind: "analogue-constraint",
          authorityRole: "constraint",
          continuityId: "historical-analogue",
          locator: {
            id: "analogue-locator:cybele",
            kind: "bibliographic-route",
            label: "Cybele source route",
            path: "sacred-texts/cybele",
            start: 1,
            end: 2,
          },
          text: "The historical source constrains the ritual analogy.",
          normalized: { reconciliationKeys: [agotCandidate.reconciliationKeys[0]!] },
          reconciliationKeys: [agotCandidate.reconciliationKeys[0]!],
          recallCandidateIds: [agotCandidate.id],
        },
      ],
    });
    const decision: AsoiafExternalDecisionInput = {
      id: "external-decisions:analogue",
      reviewerId: REVIEWER,
      reviewedAt: REVIEWED_AT,
      decisions: [
        {
          id: "external-decision:analogue-confirm",
          action: "confirm",
          candidateIds: [agotCandidate.id],
          evidenceRecordIds: ["analogue-evidence:cybele"],
          promotedRecords: [
            {
              id: "external-promoted:analogue",
              targetType: "proposition",
              normalized: {
                reconciliationKeys: [agotCandidate.reconciliationKeys[0]!],
              },
              sourceEvidenceRecordIds: ["analogue-evidence:cybele"],
            },
          ],
          rationale: "Attempted canon promotion from an analogue.",
        },
      ],
    };
    const receipt = compileAsoiafExternalReconciliationPacket({
      packet,
      decisionInput: decision,
    });
    expect(receipt.passed).toBe(false);
    expect(receipt.canonReceipt).toBeNull();
    expect(receipt.findings.map((entry) => entry.code)).toContain(
      "decision-cites-nonprimary-evidence",
    );
  });

  it("refuses cross-continuity claims inside one source packet", () => {
    const valid = primaryAgotPacket();
    const invalid = buildAsoiafExternalReviewPacket({
      ...valid,
      claims: valid.claims.map((claim) => ({
        ...claim,
        continuityId: "hbo-got" as const,
      })),
    });
    expect(
      validateAsoiafExternalReviewPacket(invalid).map((entry) => entry.code),
    ).toContain("claim-continuity-mismatch");
  });
});
