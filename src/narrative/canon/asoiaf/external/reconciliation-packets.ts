import {
  compareCodepoints,
  orderedStrings,
} from "../../../../engine/determinism.js";
import { narrativeFingerprint } from "../../../fingerprint.js";
import {
  ASOIAF_RECALL_ESTATE_PACKETS,
  ASOIAF_RECALL_SOURCE_HINTS,
} from "../recall/index.js";
import {
  asoiafExternalCandidateId,
  asoiafExternalObservationId,
  getAsoiafExternalSource,
  getAsoiafExternalWorkOrder,
  isSha256Digest,
} from "./index.js";
import {
  buildCanonReconciliationWorkOrder,
  canonEvidenceBundleFingerprint,
  compileCanonReconciliation,
  CANON_EVIDENCE_BUNDLE_FORMAT,
  CANON_REVIEW_DECISION_SET_FORMAT,
  type CanonEvidenceBundle,
  type CanonEvidenceRecord,
  type CanonReconciliationReceipt,
  type CanonReconciliationWorkOrder,
  type CanonReviewDecision,
  type CanonReviewDecisionSet,
  type CanonSourceEvidence,
  type CanonSourceLocator,
} from "../../reconcile/index.js";
import type {
  AsoiafExternalAuthorityClass,
  AsoiafExternalContinuity,
  AsoiafExternalRightsMode,
} from "./types.js";

export const ASOIAF_EXTERNAL_REVIEW_PACKET_FORMAT =
  "axm-asoiaf-external-review-packet/1" as const;
export const ASOIAF_EXTERNAL_RECONCILIATION_RECEIPT_FORMAT =
  "axm-asoiaf-external-reconciliation-receipt/1" as const;

export type AsoiafExternalClaimKind =
  | "fictional-event"
  | "world-state"
  | "actor-knowledge"
  | "lineage"
  | "adaptation-event"
  | "author-intent"
  | "production-intent"
  | "publication-record"
  | "community-consensus"
  | "theory-provenance"
  | "analogue-constraint"
  | "dataset-observation";

export type AsoiafExternalEvidenceRole =
  | "primary"
  | "supporting"
  | "provenance"
  | "constraint";

export type AsoiafExternalRightsReviewStatus =
  | "holder-controlled-private"
  | "public-domain"
  | "licensed-cache"
  | "metadata-only"
  | "link-only"
  | "cleared-after-review";

export interface AsoiafExternalRightsReview {
  status: AsoiafExternalRightsReviewStatus;
  reviewedBy: string;
  reviewedAt: string;
  rationale: string;
}

export interface AsoiafExternalExactLocator {
  id: string;
  kind: string;
  label: string;
  path: string;
  start: number;
  end: number;
  contentDigest?: `sha256:${string}`;
}

export interface AsoiafExternalReviewedClaim {
  id: string;
  evidenceRecordId: string;
  label: string;
  claimKind: AsoiafExternalClaimKind;
  authorityRole: AsoiafExternalEvidenceRole;
  continuityId: AsoiafExternalContinuity;
  locator: AsoiafExternalExactLocator;
  text: string;
  normalized: Record<string, unknown>;
  reconciliationKeys: string[];
  recallCandidateIds: string[];
}

export interface AsoiafExternalReviewedObservation {
  observationId: string;
  collectorCandidateId: string;
  sourceId: string;
  sourceRecordId: string;
  retrievedAt: string;
  contentDigest: `sha256:${string}`;
  receiptUri: string;
  responseBytes: number;
  graphEffect: "none";
  canonEffect: "none";
  promotionStatus: "reviewed";
  reviewerId: string;
  reviewedAt: string;
  rightsReview: AsoiafExternalRightsReview;
}

export interface AsoiafExternalReviewPacket {
  format: typeof ASOIAF_EXTERNAL_REVIEW_PACKET_FORMAT;
  id: string;
  universeId: "asoiaf";
  sourceId: string;
  continuityId: AsoiafExternalContinuity;
  observation: AsoiafExternalReviewedObservation;
  claims: AsoiafExternalReviewedClaim[];
  packetFingerprint: string;
}

export interface AsoiafExternalReviewPacketInput {
  id: string;
  sourceId: string;
  continuityId: AsoiafExternalContinuity;
  observation: AsoiafExternalReviewedObservation;
  claims: AsoiafExternalReviewedClaim[];
}

export interface AsoiafExternalDecisionInput {
  id: string;
  reviewerId: string;
  reviewedAt: string;
  decisions: CanonReviewDecision[];
}

export interface AsoiafExternalPacketFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

export interface AsoiafExternalReconciliationReceipt {
  format: typeof ASOIAF_EXTERNAL_RECONCILIATION_RECEIPT_FORMAT;
  packetId: string;
  packetFingerprint: string;
  sourceId: string;
  observationId: string;
  workOrderId: string | null;
  workOrderFingerprint: string | null;
  evidenceBundleId: string | null;
  evidenceBundleFingerprint: string | null;
  canonReceipt: CanonReconciliationReceipt | null;
  findings: AsoiafExternalPacketFinding[];
  passed: boolean;
  receiptFingerprint: string;
}

const PRIMARY_KINDS_BY_AUTHORITY: Partial<
  Record<AsoiafExternalAuthorityClass, ReadonlySet<AsoiafExternalClaimKind>>
> = {
  "primary-text": new Set([
    "fictional-event",
    "world-state",
    "actor-knowledge",
    "lineage",
  ]),
  "companion-text": new Set([
    "fictional-event",
    "world-state",
    "actor-knowledge",
    "lineage",
    "publication-record",
  ]),
  "released-author-text": new Set([
    "fictional-event",
    "world-state",
    "actor-knowledge",
    "lineage",
  ]),
  "adaptation-canon": new Set([
    "adaptation-event",
    "world-state",
    "actor-knowledge",
    "lineage",
  ]),
  "author-statement": new Set(["author-intent", "publication-record"]),
  "production-testimony": new Set([
    "production-intent",
    "publication-record",
  ]),
  "licensed-reference": new Set(["publication-record"]),
  "official-bibliography": new Set(["publication-record"]),
};

function finding(
  code: string,
  severity: AsoiafExternalPacketFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafExternalPacketFinding {
  return { code, severity, subjectId, detail };
}

function sortedFindings(
  findings: readonly AsoiafExternalPacketFinding[],
): AsoiafExternalPacketFinding[] {
  return [...findings].sort(
    (left, right) =>
      compareCodepoints(left.severity, right.severity)
      || compareCodepoints(left.code, right.code)
      || compareCodepoints(left.subjectId, right.subjectId),
  );
}

function packetCore(input: AsoiafExternalReviewPacketInput) {
  return {
    format: ASOIAF_EXTERNAL_REVIEW_PACKET_FORMAT,
    id: input.id,
    universeId: "asoiaf" as const,
    sourceId: input.sourceId,
    continuityId: input.continuityId,
    observation: {
      ...input.observation,
      rightsReview: { ...input.observation.rightsReview },
    },
    claims: [...input.claims]
      .map((claim) => ({
        ...claim,
        locator: { ...claim.locator },
        normalized: { ...claim.normalized },
        reconciliationKeys: orderedStrings(claim.reconciliationKeys),
        recallCandidateIds: orderedStrings(claim.recallCandidateIds),
      }))
      .sort((left, right) => compareCodepoints(left.id, right.id)),
  };
}

export function buildAsoiafExternalReviewPacket(
  input: AsoiafExternalReviewPacketInput,
): AsoiafExternalReviewPacket {
  const core = packetCore(input);
  return {
    ...core,
    packetFingerprint: narrativeFingerprint(core),
  };
}

function expectedEvidenceRole(
  authorityClass: AsoiafExternalAuthorityClass,
): Exclude<AsoiafExternalEvidenceRole, "primary"> {
  if (authorityClass === "discussion-provenance") return "provenance";
  if (authorityClass === "scholarly-analogue") return "constraint";
  return "supporting";
}

function rightsReviewCompatible(
  rightsMode: AsoiafExternalRightsMode,
  review: AsoiafExternalRightsReviewStatus,
): boolean {
  switch (rightsMode) {
    case "user-controlled-private":
      return review === "holder-controlled-private";
    case "public-domain":
    case "cc0":
      return review === "public-domain" || review === "licensed-cache";
    case "cc-by":
    case "cc-by-sa":
      return review === "licensed-cache";
    case "publisher-copyright":
      return review === "metadata-only" || review === "holder-controlled-private";
    case "link-only":
      return review === "link-only";
    case "unknown-review-required":
      return review === "cleared-after-review" || review === "metadata-only";
  }
}

function workOrderForSource(
  packet: AsoiafExternalReviewPacket,
): CanonReconciliationWorkOrder | null {
  const source = getAsoiafExternalSource(packet.sourceId);
  if (!source || source.sourceHintRoutes.length === 0) return null;
  return buildCanonReconciliationWorkOrder(
    ASOIAF_RECALL_ESTATE_PACKETS,
    ASOIAF_RECALL_SOURCE_HINTS,
    {
      id: `asoiaf-external-reconciliation:${packet.sourceId}:${packet.id}`,
      universeId: "asoiaf",
      sourceHintIds: source.sourceHintRoutes,
      contextDepth: 1,
    },
  );
}

export function validateAsoiafExternalReviewPacket(
  packet: AsoiafExternalReviewPacket,
): AsoiafExternalPacketFinding[] {
  const findings: AsoiafExternalPacketFinding[] = [];
  const source = getAsoiafExternalSource(packet.sourceId);
  const externalWorkOrder = getAsoiafExternalWorkOrder(packet.sourceId);
  const expectedPacket = buildAsoiafExternalReviewPacket(packet);

  if (packet.format !== ASOIAF_EXTERNAL_REVIEW_PACKET_FORMAT) {
    findings.push(
      finding("packet-format", "error", packet.id, "review packet format is invalid"),
    );
  }
  if (!packet.id.trim()) {
    findings.push(finding("packet-id", "error", "packet", "packet id is empty"));
  }
  if (packet.packetFingerprint !== expectedPacket.packetFingerprint) {
    findings.push(
      finding(
        "packet-fingerprint",
        "error",
        packet.id,
        "packet fingerprint does not match its canonical contents",
      ),
    );
  }
  if (!source || !externalWorkOrder) {
    findings.push(
      finding(
        "unknown-atlas-source",
        "error",
        packet.sourceId,
        "packet source is absent from the qualified external atlas",
      ),
    );
    return sortedFindings(findings);
  }
  if (!source.continuityIds.includes(packet.continuityId)) {
    findings.push(
      finding(
        "source-continuity-mismatch",
        "error",
        packet.id,
        `${packet.continuityId} is not declared by ${packet.sourceId}`,
      ),
    );
  }

  const observation = packet.observation;
  if (observation.sourceId !== packet.sourceId) {
    findings.push(
      finding(
        "observation-source-mismatch",
        "error",
        observation.observationId,
        "observation source differs from packet source",
      ),
    );
  }
  if (!isSha256Digest(observation.contentDigest)) {
    findings.push(
      finding(
        "observation-digest",
        "error",
        observation.observationId,
        "observation requires a lowercase SHA-256 digest",
      ),
    );
  } else {
    const expectedObservationId = asoiafExternalObservationId({
      sourceId: observation.sourceId,
      sourceRecordId: observation.sourceRecordId,
      contentDigest: observation.contentDigest,
    });
    if (expectedObservationId !== observation.observationId) {
      findings.push(
        finding(
          "observation-identity",
          "error",
          observation.observationId,
          "observation identity is not bound to source, record, and content digest",
        ),
      );
    }
  }
  if (
    observation.collectorCandidateId
    !== asoiafExternalCandidateId(
      observation.sourceId,
      observation.sourceRecordId,
    )
  ) {
    findings.push(
      finding(
        "collector-candidate-identity",
        "error",
        observation.collectorCandidateId,
        "collector candidate identity is not stable for the source record",
      ),
    );
  }
  if (
    observation.graphEffect !== "none"
    || observation.canonEffect !== "none"
  ) {
    findings.push(
      finding(
        "collector-authority-leak",
        "error",
        observation.observationId,
        "collector observation already claims graph or canon effect",
      ),
    );
  }
  if (observation.promotionStatus !== "reviewed") {
    findings.push(
      finding(
        "observation-not-reviewed",
        "error",
        observation.observationId,
        "intake-only observations cannot enter reconciliation packets",
      ),
    );
  }
  if (
    !observation.reviewerId.trim()
    || !observation.reviewedAt.trim()
    || !observation.receiptUri.trim()
    || observation.responseBytes <= 0
  ) {
    findings.push(
      finding(
        "incomplete-observation-review",
        "error",
        observation.observationId,
        "reviewer, review time, receipt, and positive source byte count are required",
      ),
    );
  }
  if (
    observation.rightsReview.reviewedBy !== observation.reviewerId
    || !observation.rightsReview.reviewedAt.trim()
    || !observation.rightsReview.rationale.trim()
  ) {
    findings.push(
      finding(
        "rights-review-custody",
        "error",
        observation.observationId,
        "rights review must be complete and owned by the packet reviewer",
      ),
    );
  }
  if (!rightsReviewCompatible(source.rightsMode, observation.rightsReview.status)) {
    findings.push(
      finding(
        "rights-review-mismatch",
        "error",
        observation.observationId,
        `${observation.rightsReview.status} is incompatible with ${source.rightsMode}`,
      ),
    );
  }

  if (packet.claims.length === 0) {
    findings.push(
      finding("empty-packet", "warning", packet.id, "packet contains no reviewed claims"),
    );
  }
  const claimIds = new Set<string>();
  const evidenceIds = new Set<string>();
  const recallCandidateIds = new Set(externalWorkOrder.candidateIds);
  for (const claim of packet.claims) {
    if (claimIds.has(claim.id)) {
      findings.push(
        finding("duplicate-claim", "error", claim.id, "claim id is duplicated"),
      );
    }
    claimIds.add(claim.id);
    if (evidenceIds.has(claim.evidenceRecordId)) {
      findings.push(
        finding(
          "duplicate-evidence-record",
          "error",
          claim.evidenceRecordId,
          "evidence record id is duplicated",
        ),
      );
    }
    evidenceIds.add(claim.evidenceRecordId);
    if (
      !claim.id.trim()
      || !claim.evidenceRecordId.trim()
      || !claim.label.trim()
      || !claim.text.trim()
    ) {
      findings.push(
        finding(
          "incomplete-claim",
          "error",
          claim.id || "claim",
          "claim identity, evidence identity, label, and reviewed text are required",
        ),
      );
    }
    if (claim.continuityId !== packet.continuityId) {
      findings.push(
        finding(
          "claim-continuity-mismatch",
          "error",
          claim.id,
          "claim continuity differs from packet continuity",
        ),
      );
    }
    if (
      !claim.locator.id.trim()
      || !claim.locator.path.trim()
      || claim.locator.start < 0
      || claim.locator.end <= claim.locator.start
    ) {
      findings.push(
        finding(
          "invalid-claim-locator",
          "error",
          claim.id,
          "claim requires a bounded exact locator",
        ),
      );
    }
    if (
      claim.locator.contentDigest
      && claim.locator.contentDigest !== observation.contentDigest
    ) {
      findings.push(
        finding(
          "locator-digest-mismatch",
          "error",
          claim.locator.id,
          "locator digest differs from the reviewed observation",
        ),
      );
    }
    if (claim.reconciliationKeys.length === 0) {
      findings.push(
        finding(
          "missing-reconciliation-key",
          "error",
          claim.id,
          "claim requires at least one reconciliation key",
        ),
      );
    }
    if (claim.recallCandidateIds.length === 0) {
      findings.push(
        finding(
          "missing-recall-candidate",
          "error",
          claim.id,
          "claim must identify the recall candidates it can adjudicate",
        ),
      );
    }
    for (const candidateId of claim.recallCandidateIds) {
      if (!recallCandidateIds.has(candidateId)) {
        findings.push(
          finding(
            "claim-candidate-outside-source-work-order",
            "error",
            claim.id,
            `${candidateId} is outside the atlas work order for ${packet.sourceId}`,
          ),
        );
      }
    }

    if (claim.authorityRole === "primary") {
      const allowed = PRIMARY_KINDS_BY_AUTHORITY[source.authorityClass];
      if (!allowed?.has(claim.claimKind)) {
        findings.push(
          finding(
            "primary-standing-forbidden",
            "error",
            claim.id,
            `${source.authorityClass} cannot be primary for ${claim.claimKind}`,
          ),
        );
      }
      if (
        source.rightsMode === "link-only"
        || source.authorityClass === "discovery-only"
        || source.authorityClass === "structured-dataset"
        || source.authorityClass === "community-reference"
        || source.authorityClass === "community-analysis"
        || source.authorityClass === "discussion-provenance"
        || source.authorityClass === "scholarly-analogue"
        || source.authorityClass === "archival-custody"
      ) {
        findings.push(
          finding(
            "nonprimary-source-promoted",
            "error",
            claim.id,
            `${source.authorityClass} cannot carry primary canon promotion in this packet`,
          ),
        );
      }
    } else {
      const expected = expectedEvidenceRole(source.authorityClass);
      if (
        [
          "community-reference",
          "community-analysis",
          "discussion-provenance",
          "scholarly-analogue",
          "structured-dataset",
          "archival-custody",
          "discovery-only",
        ].includes(source.authorityClass)
        && claim.authorityRole !== expected
      ) {
        findings.push(
          finding(
            "supporting-role-mismatch",
            "error",
            claim.id,
            `${source.authorityClass} must enter as ${expected}`,
          ),
        );
      }
    }
  }

  return sortedFindings(findings);
}

export function buildAsoiafExternalEvidenceBundle(
  packet: AsoiafExternalReviewPacket,
): CanonEvidenceBundle {
  const errors = validateAsoiafExternalReviewPacket(packet).filter(
    (entry) => entry.severity === "error",
  );
  if (errors.length > 0) {
    throw new Error(
      `invalid external review packet: ${errors
        .map((entry) => `${entry.code}:${entry.subjectId}`)
        .join(", ")}`,
    );
  }
  const source = getAsoiafExternalSource(packet.sourceId)!;
  const observation = packet.observation;
  const sourceEvidenceId = `external-source:${packet.sourceId}:${narrativeFingerprint({
    sourceRecordId: observation.sourceRecordId,
    contentDigest: observation.contentDigest,
  }).replace("fnv1a32:", "")}`;
  const sourceEvidence: CanonSourceEvidence = {
    id: sourceEvidenceId,
    universeId: "asoiaf",
    continuityId: packet.continuityId,
    sourceHintIds: orderedStrings(source.sourceHintRoutes),
    title: source.label,
    editionOrVersion: observation.sourceRecordId,
    custodyClass:
      source.rightsMode === "user-controlled-private"
        ? "holder-controlled-private"
        : "bounded-public-observation",
    fileName: `[logical-source:${packet.sourceId}]`,
    fileBytes: observation.responseBytes,
    contentDigest: observation.contentDigest.slice("sha256:".length),
  };
  const locators: CanonSourceLocator[] = packet.claims.map((claim) => ({
    id: claim.locator.id,
    sourceId: sourceEvidenceId,
    kind: claim.locator.kind,
    label: claim.locator.label,
    path: claim.locator.path,
    start: claim.locator.start,
    end: claim.locator.end,
    contentDigest: (
      claim.locator.contentDigest ?? observation.contentDigest
    ).slice("sha256:".length),
  }));
  const records: CanonEvidenceRecord[] = packet.claims.map((claim) => ({
    id: claim.evidenceRecordId,
    sourceId: sourceEvidenceId,
    continuityId: packet.continuityId,
    locatorIds: [claim.locator.id],
    label: claim.label,
    text: claim.text,
    normalized: {
      ...claim.normalized,
      externalObservationId: observation.observationId,
      externalCollectorCandidateId: observation.collectorCandidateId,
      externalClaimKind: claim.claimKind,
      externalAuthorityRole: claim.authorityRole,
      externalSourceId: packet.sourceId,
      externalSourceRecordId: observation.sourceRecordId,
      externalReceiptUri: observation.receiptUri,
      reconciliationKeys: orderedStrings(claim.reconciliationKeys),
    },
    reconciliationKeys: orderedStrings(claim.reconciliationKeys),
    extractionMethod: "human-reviewed-external-observation",
    reviewStatus: "reviewed",
    reviewedBy: observation.reviewerId,
  }));
  return {
    format: CANON_EVIDENCE_BUNDLE_FORMAT,
    id: `asoiaf-external-evidence:${packet.id}`,
    universeId: "asoiaf",
    extractionRunId: observation.observationId,
    extractedAt: observation.retrievedAt,
    reviewPolicy:
      "external observations require source-specific rights review, exact locators, and named human review before canon reconciliation",
    sources: [sourceEvidence],
    locators,
    records,
  };
}

export function buildAsoiafExternalReconciliationWorkOrder(
  packet: AsoiafExternalReviewPacket,
): CanonReconciliationWorkOrder | null {
  return workOrderForSource(packet);
}

export function bindAsoiafExternalDecisionSet(
  workOrder: CanonReconciliationWorkOrder,
  evidenceBundle: CanonEvidenceBundle,
  input: AsoiafExternalDecisionInput,
): CanonReviewDecisionSet {
  return {
    format: CANON_REVIEW_DECISION_SET_FORMAT,
    id: input.id,
    universeId: "asoiaf",
    workOrderId: workOrder.id,
    workOrderFingerprint: workOrder.workOrderFingerprint,
    evidenceBundleId: evidenceBundle.id,
    evidenceBundleFingerprint: canonEvidenceBundleFingerprint(evidenceBundle),
    reviewerId: input.reviewerId,
    reviewedAt: input.reviewedAt,
    decisions: [...input.decisions].sort((left, right) =>
      compareCodepoints(left.id, right.id),
    ),
  };
}

function decisionAuthorityFindings(
  packet: AsoiafExternalReviewPacket,
  input: AsoiafExternalDecisionInput,
): AsoiafExternalPacketFinding[] {
  const findings: AsoiafExternalPacketFinding[] = [];
  const claimsByEvidenceId = new Map(
    packet.claims.map((claim) => [claim.evidenceRecordId, claim] as const),
  );
  for (const decision of input.decisions) {
    if (decision.action === "defer") continue;
    for (const evidenceId of decision.evidenceRecordIds) {
      const claim = claimsByEvidenceId.get(evidenceId);
      if (!claim) {
        findings.push(
          finding(
            "decision-unknown-external-evidence",
            "error",
            decision.id,
            `decision cites ${evidenceId}, which is absent from the packet`,
          ),
        );
      } else if (claim.authorityRole !== "primary") {
        findings.push(
          finding(
            "decision-cites-nonprimary-evidence",
            "error",
            decision.id,
            `${evidenceId} enters as ${claim.authorityRole} and cannot adjudicate a canon candidate`,
          ),
        );
      }
    }
  }
  return findings;
}

function refusalReceipt(input: {
  packet: AsoiafExternalReviewPacket;
  findings: AsoiafExternalPacketFinding[];
  workOrder?: CanonReconciliationWorkOrder | null;
  evidenceBundle?: CanonEvidenceBundle | null;
}): AsoiafExternalReconciliationReceipt {
  const core = {
    format: ASOIAF_EXTERNAL_RECONCILIATION_RECEIPT_FORMAT,
    packetId: input.packet.id,
    packetFingerprint: input.packet.packetFingerprint,
    sourceId: input.packet.sourceId,
    observationId: input.packet.observation.observationId,
    workOrderId: input.workOrder?.id ?? null,
    workOrderFingerprint: input.workOrder?.workOrderFingerprint ?? null,
    evidenceBundleId: input.evidenceBundle?.id ?? null,
    evidenceBundleFingerprint: input.evidenceBundle
      ? canonEvidenceBundleFingerprint(input.evidenceBundle)
      : null,
    canonReceipt: null,
    findings: sortedFindings(input.findings),
    passed: false,
  };
  return {
    ...core,
    receiptFingerprint: narrativeFingerprint(core),
  };
}

export function compileAsoiafExternalReconciliationPacket(input: {
  packet: AsoiafExternalReviewPacket;
  decisionInput: AsoiafExternalDecisionInput;
}): AsoiafExternalReconciliationReceipt {
  const packetFindings = validateAsoiafExternalReviewPacket(input.packet);
  const authorityFindings = decisionAuthorityFindings(
    input.packet,
    input.decisionInput,
  );
  const preflight = [...packetFindings, ...authorityFindings];
  if (input.decisionInput.reviewerId !== input.packet.observation.reviewerId) {
    preflight.push(
      finding(
        "decision-reviewer-mismatch",
        "error",
        input.decisionInput.id,
        "decision reviewer differs from the observation and rights reviewer",
      ),
    );
  }
  if (preflight.some((entry) => entry.severity === "error")) {
    return refusalReceipt({ packet: input.packet, findings: preflight });
  }

  const workOrder = workOrderForSource(input.packet);
  if (!workOrder) {
    return refusalReceipt({
      packet: input.packet,
      findings: [
        ...preflight,
        finding(
          "source-has-no-canon-route",
          "error",
          input.packet.sourceId,
          "source has no exact recall source-hint route and may remain supporting evidence only",
        ),
      ],
    });
  }
  const evidenceBundle = buildAsoiafExternalEvidenceBundle(input.packet);
  const decisionSet = bindAsoiafExternalDecisionSet(
    workOrder,
    evidenceBundle,
    input.decisionInput,
  );
  const recallCandidates = ASOIAF_RECALL_ESTATE_PACKETS.flatMap(
    (packet) => packet.candidates,
  );
  const canonReceipt = compileCanonReconciliation(
    workOrder,
    recallCandidates,
    evidenceBundle,
    decisionSet,
  );
  const findings: AsoiafExternalPacketFinding[] = [
    ...preflight,
    ...canonReceipt.findings.map((entry) => ({
      code: `canon:${entry.code}`,
      severity: entry.severity,
      subjectId: entry.subjectId,
      detail: entry.detail,
    })),
  ];
  const core = {
    format: ASOIAF_EXTERNAL_RECONCILIATION_RECEIPT_FORMAT,
    packetId: input.packet.id,
    packetFingerprint: input.packet.packetFingerprint,
    sourceId: input.packet.sourceId,
    observationId: input.packet.observation.observationId,
    workOrderId: workOrder.id,
    workOrderFingerprint: workOrder.workOrderFingerprint,
    evidenceBundleId: evidenceBundle.id,
    evidenceBundleFingerprint: canonEvidenceBundleFingerprint(evidenceBundle),
    canonReceipt,
    findings: sortedFindings(findings),
    passed: canonReceipt.passed,
  };
  return {
    ...core,
    receiptFingerprint: narrativeFingerprint(core),
  };
}
