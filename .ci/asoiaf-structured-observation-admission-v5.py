from __future__ import annotations

from pathlib import Path

BRIDGE = Path("tools/lib/asoiaf-structured-acquisition-reconciliation.ts")
TEST = Path("tests/narrative/canon/asoiaf-structured-acquisition-reconciliation.test.ts")
WORKFLOW = Path(".github/workflows/asoiaf-structured-acquisition-reconciliation.yml")
DOCS = Path("docs/ASOIAF_STRUCTURED_ACQUISITION_RECONCILIATION.md")


def ensure_replace(path: Path, marker: str, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if marker in text:
        print(f"ALREADY_APPLIED {path}: {marker}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"{path}: expected one target, found {count}: {old[:180]!r}"
        )
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def integrate_bridge() -> None:
    ensure_replace(
        BRIDGE,
        'type AsoiafStructuredObservationAdmission,',
        '''import {
  collectorContentId,
  sha256,
} from "./asoiaf-external-estate.js";
''',
        '''import {
  collectorContentId,
  sha256,
} from "./asoiaf-external-estate.js";
import {
  assertAsoiafStructuredObservationAdmitted,
  validateAsoiafStructuredObservationAdmission,
  type AsoiafStructuredObservationAdmission,
} from "./asoiaf-structured-observation-admission.js";
''',
    )
    ensure_replace(
        BRIDGE,
        'admission: AsoiafStructuredObservationAdmission;',
        '''  adapterReceiptUri: string;
  observation: AsoiafExternalReviewedObservation;
}
''',
        '''  adapterReceiptUri: string;
  observation: AsoiafExternalReviewedObservation;
  admission: AsoiafStructuredObservationAdmission;
}
''',
    )
    ensure_replace(
        BRIDGE,
        'admissionFingerprint: `sha256:${string}`;',
        '''  normalizedCandidateId: string;
  normalizedContentDigest: `sha256:${string}`;
  collectorReceiptUri: string;
''',
        '''  normalizedCandidateId: string;
  normalizedContentDigest: `sha256:${string}`;
  admissionId: string;
  admissionFingerprint: `sha256:${string}`;
  admissionOutcome: AsoiafStructuredObservationAdmission["outcome"];
  admissionReason: AsoiafStructuredObservationAdmission["reason"];
  admissionReviewedBy: string;
  admissionReviewedAt: string;
  admissionQuestionLaneIds: string[];
  collectorReceiptUri: string;
''',
    )
    ensure_replace(
        BRIDGE,
        'const {\n    plan,\n    acquisitionReceipt,\n    adapterReceipt,\n    observation,\n    admission,\n  } = input;',
        '''  const findings: AsoiafStructuredAcquisitionReviewFinding[] = [];
  const { plan, acquisitionReceipt, adapterReceipt, observation } = input;
  const source = getAsoiafExternalSource(plan.sourceId);
''',
        '''  const findings: AsoiafStructuredAcquisitionReviewFinding[] = [];
  const {
    plan,
    acquisitionReceipt,
    adapterReceipt,
    observation,
    admission,
  } = input;
  const source = getAsoiafExternalSource(plan.sourceId);
''',
    )
    ensure_replace(
        BRIDGE,
        '"observation-not-admitted",',
        '''  if (!validDigest(observation.contentDigest) || observation.responseBytes <= 0) {
    findings.push(finding("normalized-observation-custody", observation.observationId, "reviewed observation lacks a positive normalized digest and byte count"));
  }
  if (
    !safeRelativeUri(input.acquisitionReceiptUri)
''',
        '''  if (!validDigest(observation.contentDigest) || observation.responseBytes <= 0) {
    findings.push(finding("normalized-observation-custody", observation.observationId, "reviewed observation lacks a positive normalized digest and byte count"));
  }
  if (!admission) {
    findings.push(
      finding(
        "admission-missing",
        observation.observationId,
        "structured observation admission disposition is required",
      ),
    );
  } else {
    for (const admissionFinding of validateAsoiafStructuredObservationAdmission(admission)) {
      findings.push(
        finding(
          `admission-${admissionFinding.code}`,
          admissionFinding.subjectId,
          admissionFinding.detail,
        ),
      );
    }
    if (admission.outcome !== "admit-to-review") {
      findings.push(
        finding(
          "observation-not-admitted",
          admission.admissionId,
          `structured observation disposition is ${admission.outcome}`,
        ),
      );
    }
    if (
      admission.sourceId !== plan.sourceId
      || admission.adapterId !== plan.adapterId
      || admission.requestId !== plan.requestId
      || admission.planFingerprint !== plan.planFingerprint
      || admission.acquisitionReceiptId !== acquisitionReceipt.receiptId
      || admission.acquisitionReceiptFingerprint !== acquisitionReceipt.receiptFingerprint
      || admission.adapterReceiptFingerprint !== adapterReceipt.receiptFingerprint
      || admission.observationId !== observation.observationId
      || admission.candidateId !== observation.collectorCandidateId
      || admission.normalizedContentDigest !== observation.contentDigest
      || admission.reviewedBy !== observation.reviewerId
    ) {
      findings.push(
        finding(
          "admission-custody-parity",
          admission.admissionId,
          "admission disposition differs from the signed plan, receipts, reviewed observation, candidate, digest, or reviewer",
        ),
      );
    }
  }
  if (
    !safeRelativeUri(input.acquisitionReceiptUri)
''',
    )
    ensure_replace(
        BRIDGE,
        'assertAsoiafStructuredObservationAdmitted(admission);',
        '''  const { plan, acquisitionReceipt, adapterReceipt, observation } = input;
  const core = {
''',
        '''  const {
    plan,
    acquisitionReceipt,
    adapterReceipt,
    observation,
    admission,
  } = input;
  assertAsoiafStructuredObservationAdmitted(admission);
  const core = {
''',
    )
    ensure_replace(
        BRIDGE,
        'admissionId: admission.admissionId,',
        '''    normalizedObservationId: observation.observationId,
    normalizedCandidateId: observation.collectorCandidateId,
    normalizedContentDigest: observation.contentDigest,
    collectorReceiptUri: observation.receiptUri,
''',
        '''    normalizedObservationId: observation.observationId,
    normalizedCandidateId: observation.collectorCandidateId,
    normalizedContentDigest: observation.contentDigest,
    admissionId: admission.admissionId,
    admissionFingerprint: admission.admissionFingerprint,
    admissionOutcome: admission.outcome,
    admissionReason: admission.reason,
    admissionReviewedBy: admission.reviewedBy,
    admissionReviewedAt: admission.reviewedAt,
    admissionQuestionLaneIds: [...admission.questionLaneIds],
    collectorReceiptUri: observation.receiptUri,
''',
    )
    ensure_replace(
        BRIDGE,
        '|| !validDigest(binding.admissionFingerprint)',
        '''    || !validDigest(binding.sourceResponseDigest)
    || !validDigest(binding.normalizedContentDigest)
''',
        '''    || !validDigest(binding.sourceResponseDigest)
    || !validDigest(binding.normalizedContentDigest)
    || !validDigest(binding.admissionFingerprint)
''',
    )
    ensure_replace(
        BRIDGE,
        '|| binding.admissionOutcome !== "admit-to-review"',
        '''    binding.rawResponseRetained !== false
    || binding.authorityRole !== "supporting-only"
    || binding.graphEffect !== "none"
    || binding.canonEffect !== "none"
''',
        '''    binding.rawResponseRetained !== false
    || binding.authorityRole !== "supporting-only"
    || binding.admissionOutcome !== "admit-to-review"
    || (
      binding.admissionReason !== "exact-identity-and-question-match"
      && binding.admissionReason !== "bounded-relevant-metadata"
    )
    || !binding.admissionReviewedBy.trim()
    || !Number.isFinite(Date.parse(binding.admissionReviewedAt))
    || binding.admissionQuestionLaneIds.length === 0
    || binding.graphEffect !== "none"
    || binding.canonEffect !== "none"
''',
    )
    ensure_replace(
        BRIDGE,
        'structuredAdmissionId: binding.admissionId,',
        '''    adapterReceiptFingerprint: binding.adapterReceiptFingerprint,
    adapterReceiptUri: binding.adapterReceiptUri,
  } as AsoiafExternalReviewedObservation;
''',
        '''    adapterReceiptFingerprint: binding.adapterReceiptFingerprint,
    adapterReceiptUri: binding.adapterReceiptUri,
    structuredAdmissionId: binding.admissionId,
    structuredAdmissionFingerprint: binding.admissionFingerprint,
    structuredAdmissionOutcome: binding.admissionOutcome,
    structuredAdmissionReason: binding.admissionReason,
    structuredAdmissionReviewedBy: binding.admissionReviewedBy,
    structuredAdmissionReviewedAt: binding.admissionReviewedAt,
    structuredAdmissionQuestionLaneIds: binding.admissionQuestionLaneIds,
  } as AsoiafExternalReviewedObservation;
''',
    )
    ensure_replace(
        BRIDGE,
        'structuredAdmissionFingerprint: binding.admissionFingerprint,',
        '''      acquisitionRawResponseRetained: false,
      normalizedObservationDigest: binding.normalizedContentDigest,
''',
        '''      acquisitionRawResponseRetained: false,
      normalizedObservationDigest: binding.normalizedContentDigest,
      structuredAdmissionId: binding.admissionId,
      structuredAdmissionFingerprint: binding.admissionFingerprint,
      structuredAdmissionOutcome: binding.admissionOutcome,
      structuredAdmissionReason: binding.admissionReason,
      structuredAdmissionReviewedBy: binding.admissionReviewedBy,
      structuredAdmissionReviewedAt: binding.admissionReviewedAt,
      structuredAdmissionQuestionLaneIds: binding.admissionQuestionLaneIds,
''',
    )
    ensure_replace(
        BRIDGE,
        'observation.structuredAdmissionId !== binding.admissionId',
        '''    || observation.acquisitionReceiptFingerprint !== binding.acquisitionReceiptFingerprint
    || observation.adapterReceiptFingerprint !== binding.adapterReceiptFingerprint
''',
        '''    || observation.acquisitionReceiptFingerprint !== binding.acquisitionReceiptFingerprint
    || observation.adapterReceiptFingerprint !== binding.adapterReceiptFingerprint
    || observation.structuredAdmissionId !== binding.admissionId
    || observation.structuredAdmissionFingerprint !== binding.admissionFingerprint
    || observation.structuredAdmissionOutcome !== "admit-to-review"
''',
    )
    ensure_replace(
        BRIDGE,
        'claim.normalized.structuredAdmissionFingerprint !== binding.admissionFingerprint',
        '''      || claim.normalized.normalizedObservationDigest !== binding.normalizedContentDigest
      || claim.normalized.acquisitionRawResponseRetained !== false
''',
        '''      || claim.normalized.normalizedObservationDigest !== binding.normalizedContentDigest
      || claim.normalized.acquisitionRawResponseRetained !== false
      || claim.normalized.structuredAdmissionId !== binding.admissionId
      || claim.normalized.structuredAdmissionFingerprint !== binding.admissionFingerprint
      || claim.normalized.structuredAdmissionOutcome !== "admit-to-review"
''',
    )


def integrate_test() -> None:
    ensure_replace(
        TEST,
        'type AsoiafStructuredObservationAdmission,',
        '''} from "../../../tools/lib/asoiaf-structured-acquisition-reconciliation.js";
''',
        '''} from "../../../tools/lib/asoiaf-structured-acquisition-reconciliation.js";
import {
  buildAsoiafStructuredObservationAdmission,
  type AsoiafStructuredObservationAdmission,
} from "../../../tools/lib/asoiaf-structured-observation-admission.js";
''',
    )
    ensure_replace(
        TEST,
        'admission?: AsoiafStructuredObservationAdmission;',
        '''function reviewInput(input?: {
  outcome?: "observed" | "cache-hit";
  adapter?: AsoiafStructuredAdapterReceipt;
  observation?: AsoiafExternalReviewedObservation;
  acquisitionReceiptUri?: string;
}): AsoiafStructuredAcquisitionReviewInput {
  const adapter = input?.adapter ?? adapterReceipt();
  return {
    plan: signedPlan(),
    acquisitionReceipt: acquisitionReceipt({
      outcome: input?.outcome,
      adapter,
    }),
    acquisitionReceiptUri:
      input?.acquisitionReceiptUri
      ?? "structured-acquisition-receipts/acquisition-Q285779.json",
    adapterReceipt: adapter,
    adapterReceiptUri: "structured-adapter-receipts/wikidata-varys-Q285779.json",
    observation: input?.observation ?? reviewedObservation(),
  };
}
''',
        '''function reviewInput(input?: {
  outcome?: "observed" | "cache-hit";
  adapter?: AsoiafStructuredAdapterReceipt;
  observation?: AsoiafExternalReviewedObservation;
  acquisitionReceiptUri?: string;
  admission?: AsoiafStructuredObservationAdmission;
}): AsoiafStructuredAcquisitionReviewInput {
  const adapter = input?.adapter ?? adapterReceipt();
  const plan = signedPlan();
  const acquisition = acquisitionReceipt({
    outcome: input?.outcome,
    adapter,
  });
  const observation = input?.observation ?? reviewedObservation();
  const admission = input?.admission ?? buildAsoiafStructuredObservationAdmission({
    sourceId: SOURCE_ID,
    adapterId: ADAPTER_ID,
    requestId: REQUEST_ID,
    planFingerprint: plan.planFingerprint,
    acquisitionReceiptId: acquisition.receiptId,
    acquisitionReceiptFingerprint: acquisition.receiptFingerprint,
    adapterReceiptFingerprint: adapter.receiptFingerprint,
    observationId: observation.observationId,
    candidateId: observation.collectorCandidateId,
    normalizedContentDigest: observation.contentDigest,
    questionLaneIds: ["entity-resolution"],
    evidence: [
      {
        field: "upstream-record",
        value: SOURCE_RECORD_ID,
        effect: "supports-admission",
        note: "The exact Wikidata record identity matches the selected structured entity-resolution fixture.",
      },
      {
        field: "title",
        value: "Varys",
        effect: "supports-admission",
        note: "The reviewed label and record identity serve the bounded Varys entity-resolution question.",
      },
    ],
    outcome: "admit-to-review",
    reason: "exact-identity-and-question-match",
    rationale:
      "The exact upstream record identity and reviewed label match the selected Varys entity-resolution question, while the structured record remains supporting-only evidence.",
    reviewedBy: REVIEWER,
    reviewedAt: REVIEWED_AT,
    authorityRole: "admission-only",
    graphEffect: "none",
    canonEffect: "none",
  });
  return {
    plan,
    acquisitionReceipt: acquisition,
    acquisitionReceiptUri:
      input?.acquisitionReceiptUri
      ?? "structured-acquisition-receipts/acquisition-Q285779.json",
    adapterReceipt: adapter,
    adapterReceiptUri: "structured-adapter-receipts/wikidata-varys-Q285779.json",
    observation,
    admission,
  };
}
''',
    )
    ensure_replace(
        TEST,
        'admissionOutcome: "admit-to-review",',
        '''        normalizedContentDigest: NORMALIZED_DIGEST,
        rawResponseRetained: false,
''',
        '''        normalizedContentDigest: NORMALIZED_DIGEST,
        admissionOutcome: "admit-to-review",
        admissionReason: "exact-identity-and-question-match",
        admissionReviewedBy: REVIEWER,
        admissionQuestionLaneIds: ["entity-resolution"],
        rawResponseRetained: false,
''',
    )
    ensure_replace(
        TEST,
        'structuredAdmissionOutcome: "admit-to-review",',
        '''        normalizedObservationDigest: NORMALIZED_DIGEST,
        acquisitionRawResponseRetained: false,
''',
        '''        normalizedObservationDigest: NORMALIZED_DIGEST,
        acquisitionRawResponseRetained: false,
        structuredAdmissionOutcome: "admit-to-review",
        structuredAdmissionReason: "exact-identity-and-question-match",
''',
    )
    ensure_replace(
        TEST,
        'refuses an off-topic observation before claim construction',
        '''  it("refuses structured reference evidence that attempts primary adjudicating authority", () => {
''',
        '''  it("refuses an off-topic observation before claim construction", () => {
    const admitted = reviewInput();
    const rejected = buildAsoiafStructuredObservationAdmission({
      sourceId: admitted.plan.sourceId,
      adapterId: admitted.plan.adapterId,
      requestId: admitted.plan.requestId,
      planFingerprint: admitted.plan.planFingerprint,
      acquisitionReceiptId: admitted.acquisitionReceipt.receiptId,
      acquisitionReceiptFingerprint: admitted.acquisitionReceipt.receiptFingerprint,
      adapterReceiptFingerprint: admitted.adapterReceipt.receiptFingerprint,
      observationId: admitted.observation.observationId,
      candidateId: admitted.observation.collectorCandidateId,
      normalizedContentDigest: admitted.observation.contentDigest,
      questionLaneIds: ["entity-resolution"],
      evidence: [
        {
          field: "container",
          value: "Unrelated reference work",
          effect: "supports-rejection",
          note: "The retained container identifies a lexical collision outside the selected ASOIAF question.",
        },
      ],
      outcome: "reject-off-topic",
      reason: "off-topic-query-collision",
      rationale:
        "The exact retained work identity does not serve the selected ASOIAF question, so the observation remains intake-only and cannot enter supporting claim construction.",
      reviewedBy: REVIEWER,
      reviewedAt: REVIEWED_AT,
      authorityRole: "admission-only",
      graphEffect: "none",
      canonEffect: "none",
    });
    const rejectedInput = { ...admitted, admission: rejected };
    expect(
      validateAsoiafStructuredAcquisitionReviewInput(rejectedInput).map(
        (entry) => entry.code,
      ),
    ).toContain("observation-not-admitted");
    expect(() =>
      buildAsoiafStructuredAcquisitionReviewPacket({
        ...rejectedInput,
        packetId: "external-review:wikidata:off-topic-refusal",
        continuityId,
        claims: [claim()],
      }),
    ).toThrow(/observation-not-admitted/);
  });

  it("refuses structured reference evidence that attempts primary adjudicating authority", () => {
''',
    )


def integrate_workflow_and_docs() -> None:
    text = WORKFLOW.read_text(encoding="utf-8")
    text = text.replace(
        "      - 'tools/lib/asoiaf-structured-acquisition-reconciliation.ts'\n",
        "      - 'tools/lib/asoiaf-structured-acquisition-reconciliation.ts'\n"
        "      - 'tools/lib/asoiaf-structured-observation-admission.ts'\n",
    )
    text = text.replace(
        "      - 'tests/narrative/canon/asoiaf-structured-acquisition-reconciliation.test.ts'\n",
        "      - 'tests/narrative/canon/asoiaf-structured-acquisition-reconciliation.test.ts'\n"
        "      - 'tests/narrative/canon/asoiaf-structured-observation-admission.test.ts'\n",
    )
    text = text.replace(
        "          npm test -- \\\n            tests/narrative/canon/asoiaf-structured-acquisition-reconciliation.test.ts \\\n",
        "          npm test -- \\\n            tests/narrative/canon/asoiaf-structured-observation-admission.test.ts \\\n            tests/narrative/canon/asoiaf-structured-acquisition-reconciliation.test.ts \\\n",
    )
    text = text.replace(
        "            'reviewedObservationParity=required' \\\n",
        "            'reviewedObservationParity=required' \\\n"
        "            'semanticAdmission=fingerprinted-required' \\\n"
        "            'admissionOutcomes=admit-reject-defer' \\\n"
        "            'workIdentityEvidence=retained-required' \\\n"
        "            'questionRelevanceEvidence=retained-required' \\\n",
    )
    WORKFLOW.write_text(text, encoding="utf-8")

    docs = DOCS.read_text(encoding="utf-8")
    if "## Structured observation admission" not in docs:
        docs = docs.rstrip() + '''

## Structured observation admission

Successful acquisition and valid normalized custody are necessary but insufficient for claim construction. Every structured observation requires one fingerprinted named-review disposition before the acquisition-to-review bridge can build a packet: `admit-to-review`, `reject-off-topic`, or `defer-insufficient-identity`.

The disposition binds the exact source, adapter, request, plan fingerprint, acquisition receipt, adapter receipt, observation, candidate, normalized digest, question lanes, work-identity evidence, relevance evidence, outcome, reason, rationale, reviewer, and review time. Admission requires evidence supporting exact identity and question relevance. A lexical collision, continuity mismatch, or unsupported lane remains a rejection. Missing durable identity or relevance remains a defer.

Rejection and defer preserve the acquisition and collector ledgers but cannot construct a reviewed claim, evidence bundle, reconciliation proposal, graph effect, or canon effect. Admitted observations remain supporting-only. The bridge carries the admission identity and fingerprint into the reviewed observation, every normalized evidence record, and packet verification.

This gate was operationalized after the live canary returned a mechanically valid Crossref record whose title overlapped “A Song of Ice and Fire” while its DOI, container, and publisher identified an unrelated work. HTTP success, lexical overlap, and normalized metadata therefore remain insufficient for semantic admission.
'''
        DOCS.write_text(docs + "\n", encoding="utf-8")


def verify_markers() -> None:
    requirements = {
        BRIDGE: [
            'admission: AsoiafStructuredObservationAdmission;',
            '"observation-not-admitted",',
            'assertAsoiafStructuredObservationAdmitted(admission);',
            'claim.normalized.structuredAdmissionFingerprint !== binding.admissionFingerprint',
        ],
        TEST: [
            'admission?: AsoiafStructuredObservationAdmission;',
            'refuses an off-topic observation before claim construction',
            'structuredAdmissionOutcome: "admit-to-review"',
        ],
        WORKFLOW: [
            'asoiaf-structured-observation-admission.test.ts',
            'semanticAdmission=fingerprinted-required',
        ],
    }
    for path, markers in requirements.items():
        content = path.read_text(encoding="utf-8")
        for marker in markers:
            if marker not in content:
                raise SystemExit(f"{path}: missing permanent marker {marker!r}")


integrate_bridge()
integrate_test()
integrate_workflow_and_docs()
verify_markers()
print("STRUCTURED_OBSERVATION_ADMISSION_V5_INTEGRATION_COMPLETE")
