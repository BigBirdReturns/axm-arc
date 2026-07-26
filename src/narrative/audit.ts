import { compareCodepoints } from "../engine/determinism.js";
import { narrativeStateFingerprint } from "./fingerprint.js";
import { buildNarrativeCausalGraph } from "./audit-graph.js";
import { auditNarrativeQuality } from "./audit-quality.js";
import { validateNarrativeCausalAuditPolicy } from "./audit-shared.js";
import {
  DEFAULT_NARRATIVE_CAUSAL_AUDIT_POLICY,
  NARRATIVE_CAUSAL_AUDIT_FORMAT,
  type NarrativeCausalAuditPolicy,
  type NarrativeCausalAuditReceipt,
} from "./audit-types.js";
import type { NarrativeRuntimeState } from "./types.js";

export * from "./audit-types.js";

export function auditNarrativeCausality(
  state: NarrativeRuntimeState,
  policy: NarrativeCausalAuditPolicy = DEFAULT_NARRATIVE_CAUSAL_AUDIT_POLICY,
): NarrativeCausalAuditReceipt {
  validateNarrativeCausalAuditPolicy(policy);
  const graph = buildNarrativeCausalGraph(state);
  const quality = auditNarrativeQuality(state, graph.beats, policy);
  const findings = [...graph.findings, ...quality.findings].sort(
    (left, right) =>
      compareCodepoints(left.severity, right.severity) ||
      compareCodepoints(left.code, right.code) ||
      compareCodepoints(left.subjectId, right.subjectId) ||
      compareCodepoints(left.detail, right.detail),
  );

  return {
    format: NARRATIVE_CAUSAL_AUDIT_FORMAT,
    stateFingerprint: narrativeStateFingerprint(state),
    cycle: state.cycle,
    policy: { ...policy },
    beatCount: state.ledger.beats.length,
    trackCount: state.tracks.length,
    obligationCount: state.ledger.obligations.length,
    structuralCausalWidth: quality.looseBeatIds.length,
    looseBeatIds: quality.looseBeatIds,
    stalledTrackIds: quality.stalledTrackIds,
    overdueObligationIds: quality.overdueObligationIds,
    highPressureObligationIds: quality.highPressureObligationIds,
    maximumRecipeRunObserved: quality.maximumRecipeRunObserved,
    maximumActorSharePermilleObserved: quality.maximumActorSharePermilleObserved,
    beats: graph.beats,
    findings,
    passed: findings.every((entry) => entry.severity !== "error"),
  };
}
