export const NARRATIVE_AGENCY_FORMAT = "axm-narrative-agency/1" as const;
export const NARRATIVE_AGENCY_RECEIPT_FORMAT = "axm-narrative-agency-receipt/1" as const;

export type NarrativeActorGoalStatus = "open" | "satisfied" | "abandoned" | "inherited";
export type NarrativePropositionTruth = "true" | "false" | "unknown";
export type NarrativeBeliefStance = "knows" | "believes" | "suspects" | "disbelieves";

export interface NarrativeActorGoal {
  id: string;
  actorId: string;
  tags: string[];
  priority: number;
  status: NarrativeActorGoalStatus;
  openedByReceipt: string;
  closedByReceipt?: string;
}

export interface NarrativeProposition {
  id: string;
  tags: string[];
  truth: NarrativePropositionTruth;
  sourceReceiptRefs: string[];
}

export interface NarrativeActorBelief {
  actorId: string;
  propositionId: string;
  stance: NarrativeBeliefStance;
  confidence: number;
  acquiredCycle: number;
  sourceReceiptRef: string;
}

export interface NarrativeAgencyEstate {
  format: typeof NARRATIVE_AGENCY_FORMAT;
  goals: NarrativeActorGoal[];
  propositions: NarrativeProposition[];
  beliefs: NarrativeActorBelief[];
  commonKnowledgePropositionIds: string[];
}

export interface NarrativeExpectedGoalEffect {
  goalId: string;
  delta: number;
}

export interface NarrativeAgencyPolicy {
  requireIntentionReceipts: boolean;
  requireKnowledgeReceipts: boolean;
  requirePositiveGoalEffect: boolean;
  requireRiskReceipt: boolean;
  minimumBeliefConfidence: number;
  allowSuspectedBeliefs: boolean;
}

export const DEFAULT_NARRATIVE_AGENCY_POLICY: NarrativeAgencyPolicy = {
  requireIntentionReceipts: true,
  requireKnowledgeReceipts: true,
  requirePositiveGoalEffect: true,
  requireRiskReceipt: true,
  minimumBeliefConfidence: 500,
  allowSuspectedBeliefs: false,
};

export type NarrativeAgencyFailureCode =
  | "missing-agency-estate"
  | "duplicate-goal-id"
  | "duplicate-proposition-id"
  | "duplicate-belief"
  | "missing-belief-provenance"
  | "invalid-goal-priority"
  | "invalid-belief-confidence"
  | "invalid-knowledge-claim"
  | "missing-intention"
  | "missing-goal"
  | "foreign-goal"
  | "inactive-goal"
  | "missing-goal-effect"
  | "invalid-goal-effect"
  | "unserved-intention"
  | "missing-knowledge-receipt"
  | "missing-proposition"
  | "actor-lacks-proposition"
  | "disbelieved-proposition"
  | "low-confidence-belief"
  | "suspected-proposition-not-authorized"
  | "missing-risk-receipt"
  | "invalid-actor-risk";

export interface NarrativeAgencyFailure {
  code: NarrativeAgencyFailureCode;
  actorId?: string;
  subjectId: string;
  detail: string;
}

export interface NarrativeActorMoveAgencyReceipt {
  actorId: string;
  moveTag: string;
  intentionGoalIds: string[];
  knowledgePropositionIds: string[];
  falseBeliefPropositionIds: string[];
  expectedGoalEffects: NarrativeExpectedGoalEffect[];
  risk: number | null;
  failures: NarrativeAgencyFailure[];
  passed: boolean;
}

export interface NarrativeCandidateAgencyReceipt {
  format: typeof NARRATIVE_AGENCY_RECEIPT_FORMAT;
  candidateId: string;
  estateFingerprint: string | null;
  policy: NarrativeAgencyPolicy;
  moves: NarrativeActorMoveAgencyReceipt[];
  failures: NarrativeAgencyFailure[];
  passed: boolean;
}
