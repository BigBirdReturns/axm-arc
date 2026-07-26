export const NARRATIVE_AGENCY_FORMAT = "axm-narrative-agency/1" as const;
export const NARRATIVE_HANDOFF_FORMAT = "axm-narrative-handoff/1" as const;
export const NARRATIVE_COLD_WALK_FORMAT = "axm-narrative-cold-walk/1" as const;

export type BeatFunction =
  | "establish"
  | "pressure"
  | "reveal"
  | "escalate"
  | "choose"
  | "consequence"
  | "inherit";

export interface SourceIdentity {
  id: string;
  title: string;
  description: string;
  author: string;
  version: string;
  estimatedCycles: number;
  parentCanons: string[];
  canonRelation: string;
}

export interface SourcePressure {
  kind: string;
  id: string;
  label: string;
  description: string;
}

export interface SourceEvidenceReceipt {
  id: string;
  label: string;
  source: string;
  intervention: string;
  limits: string;
}

export interface SourceEvidenceLedger {
  tier: string;
  claim: string;
  venue: string;
  legitimacyTarget: string;
  upsideIfAccepted: string;
  downsideIfAccepted: string;
  failureIfFalse: string;
  receipts: SourceEvidenceReceipt[];
}

export interface SourceFactionReceipt {
  factionId: string;
  factionName: string;
  variableControlled: string;
  publicGood: string;
  characteristicFailure: string;
}

export interface SourceCastMember {
  id: string;
  name: string;
  roleId: string;
  responsibility: string;
  description: string;
  factionId?: string;
}

export interface SourceConsequence {
  id: string;
  label: string;
  kind: string;
  description: string;
  inheritedBy: string;
}

export interface ContinuingUniverseSource {
  format: "godscar-pocket/1" | "dark-tomb-pocket/1";
  identity: SourceIdentity;
  controlQuestion: string;
  pressures: SourcePressure[];
  evidence: SourceEvidenceLedger;
  factionReceipts: SourceFactionReceipt[];
  cast: SourceCastMember[];
  consequences: SourceConsequence[];
  storyPhysics: Record<string, boolean>;
  [key: string]: unknown;
}

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

export interface NarrativeAgencyPolicy {
  requireIntentionReceipts: boolean;
  requireKnowledgeReceipts: boolean;
  requirePositiveGoalEffect: boolean;
  requireRiskReceipt: boolean;
  minimumBeliefConfidence: number;
  allowSuspectedBeliefs: boolean;
}

export interface NarrativeExpectedGoalEffect {
  goalId: string;
  delta: number;
}

export interface ActorMoveAgencyClaim {
  actorId: string;
  moveTag: string;
  intentionGoalIds: string[];
  knowledgePropositionIds: string[];
  expectedGoalEffects: NarrativeExpectedGoalEffect[];
  risk: number | null;
}

export type AgencyFailureCode =
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

export interface AgencyFailure {
  code: AgencyFailureCode;
  actorId?: string;
  subjectId: string;
  detail: string;
}

export interface ActorMoveAgencyReceipt extends ActorMoveAgencyClaim {
  falseBeliefPropositionIds: string[];
  failures: AgencyFailure[];
  passed: boolean;
}

export interface CandidateAgencyReceipt {
  format: "axm-narrative-agency-receipt/1";
  candidateId: string;
  estateFingerprint: string | null;
  policy: NarrativeAgencyPolicy;
  moves: ActorMoveAgencyReceipt[];
  failures: AgencyFailure[];
  passed: boolean;
}

export interface NarrativeIdentityAnchor {
  id: string;
  anyOfTags: string[];
  required: boolean;
}

export interface HandoffActor {
  id: string;
  name: string;
  roleId: string;
  responsibility: string;
  factionId?: string;
  baselineMoves: string[];
  movePreferences: Partial<Record<BeatFunction, string>>;
  forbiddenMoves: string[];
  goalIds: string[];
}

export interface HandoffFactSeed {
  id: string;
  group: BeatFunction;
  tags: string[];
  sourcePressureIds: string[];
  propositionIds: string[];
  preferredResponsibilities: string[];
  preferredActorIds: string[];
  requiredActorCount: number;
  statePaymentKind: string;
  requiresStatePaymentKinds: string[];
  opensObligationKind?: string;
  resolvesObligationKinds: string[];
  severity: number;
}

export interface NarrativeRail {
  id: string;
  functionOrder: BeatFunction[];
  prerequisites: Partial<Record<BeatFunction, BeatFunction[]>>;
  transitions: Record<string, BeatFunction[]>;
  terminalFunctions: BeatFunction[];
}

export interface ActiveIncident {
  id: string;
  title: string;
  summary: string;
  family: string;
  pitchId?: string;
  mechanism?: {
    ordinaryGood: string;
    actorMethod: string;
    pressure: string;
    affectedActor: string;
    evidenceLimit: string;
    concreteCost: string;
    persistentChange: string;
    controlQuestion: string;
  };
}

export interface NarrativeHandoffPacket {
  format: typeof NARRATIVE_HANDOFF_FORMAT;
  source: {
    format: ContinuingUniverseSource["format"];
    id: string;
    title: string;
    version: string;
    description: string;
    controlQuestion: string;
  };
  sourceFingerprint: string;
  /** Digest of the complete public handoff authority, excluding this field. */
  handoffFingerprint: string;
  referencePlotExcluded: boolean;
  identityAnchors: NarrativeIdentityAnchor[];
  minimumIdentityAnchorMatches: number;
  prohibitedMoves: string[];
  storyPhysicsTags: string[];
  actors: HandoffActor[];
  factSeeds: HandoffFactSeed[];
  rail: NarrativeRail;
  pressures: SourcePressure[];
  evidence: SourceEvidenceLedger;
  factions: SourceFactionReceipt[];
  consequences: SourceConsequence[];
  agency: NarrativeAgencyEstate;
  agencyPolicy: NarrativeAgencyPolicy;
  activeIncident?: ActiveIncident;
}

export interface NarrativeStatePayment {
  kind: string;
  target: string;
  tags: string[];
}

export interface NarrativeObligationDraft {
  id: string;
  kind: string;
  actorIds: string[];
  pressure: number;
}

export interface ColdRoomProposal {
  id: string;
  factSeedId: string;
  beatFunction: BeatFunction;
  actorMoves: ActorMoveAgencyClaim[];
  tags: string[];
  requiresStatePaymentKinds: string[];
  statePayments: NarrativeStatePayment[];
  opensObligations: NarrativeObligationDraft[];
  resolvesObligationKinds: string[];
  authoredPriority: number;
}

export type ColdWalkFindingSeverity = "error" | "warning" | "notice";

export interface ColdWalkFinding {
  code: string;
  severity: ColdWalkFindingSeverity;
  subjectId: string;
  detail: string;
}

export interface ColdWalkScoreBreakdown {
  authoredPriority: number;
  sourceSeverity: number;
  identityCoverage: number;
  obligationPressure: number;
  actorDiversity: number;
  responsibilityFit: number;
  localCastFit: number;
  intentionStrength: number;
  total: number;
}

export interface ColdWalkBeat {
  id: string;
  cycle: number;
  proposalId: string;
  factSeedId: string;
  beatFunction: BeatFunction;
  actorIds: string[];
  moveTags: string[];
  tags: string[];
  requiredStatePaymentKinds: string[];
  statePayments: NarrativeStatePayment[];
  causalParentBeatIds: string[];
  openedObligationIds: string[];
  resolvedObligationIds: string[];
  agencyReceipt: CandidateAgencyReceipt;
  eligibleProposalIds: string[];
  selectionPoolProposalIds: string[];
  selectionKey: number;
  selectionRegret: number;
  scoreBreakdown: ColdWalkScoreBreakdown;
  score: number;
}

export interface ColdWalkReceipt {
  format: typeof NARRATIVE_COLD_WALK_FORMAT;
  sourceId: string;
  seed: number;
  handoffFingerprint: string;
  proposalSetFingerprint: string;
  activeIncidentId?: string;
  activePitchId?: string;
  arrivalOrder: string[];
  beats: ColdWalkBeat[];
  proposalRejections: Array<{ proposalId: string; codes: string[] }>;
  openObligationIds: string[];
  identityCoveragePermille: number;
  distinctActorCount: number;
  maximumActorSharePermille: number;
  structuralCausalWidth: number;
  counterfactualCausalWidth: number;
  counterfactuallyLooseBeatIds: string[];
  maximumSelectionRegret: number;
  storyPhysicsCoveragePermille: number;
  findings: ColdWalkFinding[];
  passed: boolean;
}
