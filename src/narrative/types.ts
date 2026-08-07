export const NARRATIVE_RAILS_FORMAT = "axm-narrative-rails/1" as const;
export const NARRATIVE_LEDGER_FORMAT = "axm-narrative-ledger/1" as const;

export type NarrativeBeatFunction =
  | "establish"
  | "pressure"
  | "escalate"
  | "reveal"
  | "choose"
  | "reverse"
  | "consequence"
  | "inherit";

export type NarrativeTrackStatus = "open" | "resolved" | "inherited";
export type NarrativeTrackDisposition = "continue" | "resolve" | "inherit";
export type NarrativeAuthority = "authoritative" | "presentation";
export type NarrativeObligationStatus = "open" | "resolved" | "breached" | "transferred";

export interface NarrativeFact {
  id: string;
  type: string;
  cycle: number;
  actorIds: string[];
  actorRoles?: Record<string, string>;
  tags: string[];
  severity: number;
  receiptRef: string;
  data?: Record<string, string | number | boolean | null>;
}

export interface NarrativeActorSnapshot {
  id: string;
  tags: string[];
  metrics: Record<string, number>;
}

export interface NarrativeRoleScoreTerm {
  metric: string;
  weight: number;
}

export interface NarrativeRoleTagBonus {
  tag: string;
  value: number;
}

export interface NarrativeRoleQuery {
  id: string;
  required: boolean;
  fromActorIds?: string[];
  requiredTags?: string[];
  forbiddenTags?: string[];
  minimumMetrics?: Record<string, number>;
  scoreTerms?: NarrativeRoleScoreTerm[];
  tagBonuses?: NarrativeRoleTagBonus[];
  notAlreadyBound?: string[];
}

export interface NarrativeRoleCandidateReceipt {
  actorId: string;
  eligible: boolean;
  score: number;
  failures: string[];
}

export interface NarrativeRoleBindingReceipt {
  roleId: string;
  selectedActorId: string | null;
  candidates: NarrativeRoleCandidateReceipt[];
}

export interface NarrativeBindingReceipt {
  bindings: Record<string, string>;
  roles: NarrativeRoleBindingReceipt[];
  failures: string[];
}

export interface NarrativeRailDefinition {
  id: string;
  openingFunctions: NarrativeBeatFunction[];
  transitions: Partial<Record<NarrativeBeatFunction, NarrativeBeatFunction[]>>;
  terminalFunctions: NarrativeBeatFunction[];
}

export interface NarrativeIdentityAnchor {
  id: string;
  anyOfTags: string[];
}

export interface NarrativeConditionalMove {
  moveTag: string;
  requiresAnyTags: string[];
}

export interface NarrativeActorPolicy {
  actorId: string;
  baselineMoves: string[];
  conditionalMoves: NarrativeConditionalMove[];
  forbiddenMoves: string[];
  deviationPolicy: "allow" | "justify" | "reject";
  deviationRequiresAnyTags?: string[];
}

export interface NarrativeRailScoreWeights {
  authoredPriority: number;
  sourceSeverity: number;
  conditionComplexity: number;
  obligationPressure: number;
  identityRelevance: number;
  closure: number;
  freshness: number;
  actorFit: number;
  repetition: number;
  trackUrgency: number;
}

export interface NarrativeConstitution {
  format: typeof NARRATIVE_RAILS_FORMAT;
  id: string;
  version: string;
  identityAnchors: NarrativeIdentityAnchor[];
  prohibitedMoveTags: string[];
  actorPolicies: NarrativeActorPolicy[];
  rails: NarrativeRailDefinition[];
  weights: NarrativeRailScoreWeights;
  freshnessCap: number;
}

export interface NarrativeActorMove {
  actorId: string;
  moveTag: string;
  justificationFactIds?: string[];
}

export interface NarrativeStatePayment {
  kind: string;
  target: string;
  tags: string[];
  receiptRef?: string;
}

export interface NarrativeObligationDraft {
  id: string;
  kind: string;
  actorIds: string[];
  tags: string[];
  pressure: number;
  dueCycle?: number;
}

export interface NarrativeObligation extends NarrativeObligationDraft {
  openedByBeatId: string;
  status: NarrativeObligationStatus;
  closedByBeatId?: string;
}

export type NarrativeTrackDirective =
  | {
      kind: "open";
      trackId: string;
      railId: string;
      controllingQuestion: string;
      actorIds: string[];
      pressureTags: string[];
    }
  | {
      kind: "advance";
      trackId: string;
    };

export interface NarrativeCandidate {
  id: string;
  recipeId: string;
  authority: NarrativeAuthority;
  track: NarrativeTrackDirective;
  trackDisposition?: NarrativeTrackDisposition;
  beatFunction: NarrativeBeatFunction;
  sourceFactIds: string[];
  causalParentBeatIds: string[];
  roleBindings: Record<string, string>;
  actorMoves: NarrativeActorMove[];
  tags: string[];
  pressureTags: string[];
  statePayments: NarrativeStatePayment[];
  opensObligations: NarrativeObligationDraft[];
  resolvesObligationIds: string[];
  authoredPriority: number;
  conditionComplexity: number;
  cooldownCycles: number;
  presentationKey: string;
}

export interface NarrativeTrackState {
  id: string;
  railId: string;
  controllingQuestion: string;
  actorIds: string[];
  pressureTags: string[];
  currentFunction: NarrativeBeatFunction;
  beatIds: string[];
  openObligationIds: string[];
  status: NarrativeTrackStatus;
}

export interface NarrativeScoreBreakdown {
  authoredPriority: number;
  sourceSeverity: number;
  conditionComplexity: number;
  obligationPressure: number;
  identityRelevance: number;
  closure: number;
  freshness: number;
  actorFit: number;
  repetition: number;
  trackUrgency: number;
}

export interface NarrativeCandidateScore {
  candidateId: string;
  total: number;
  breakdown: NarrativeScoreBreakdown;
  matchedIdentityAnchors: string[];
  roleBindings: Record<string, string>;
}

export type NarrativeRailFailureCode =
  | "duplicate-candidate-id"
  | "missing-source-fact"
  | "missing-actor"
  | "missing-causal-parent"
  | "missing-track"
  | "track-not-open"
  | "duplicate-track-id"
  | "unknown-rail"
  | "rail-transition"
  | "invalid-track-disposition"
  | "missing-state-payment"
  | "presentation-mutates-state"
  | "missing-identity-anchor"
  | "prohibited-move"
  | "forbidden-character-move"
  | "conditional-character-move"
  | "unjustified-character-deviation"
  | "missing-obligation"
  | "closed-obligation"
  | "duplicate-obligation-id"
  | "cooldown";

export interface NarrativeRailFailure {
  code: NarrativeRailFailureCode;
  detail: string;
}

export interface NarrativeCandidateRejection {
  candidateId: string;
  failures: NarrativeRailFailure[];
}

export interface NarrativeSelectionReceipt {
  format: "axm-narrative-selection/1";
  constitutionId: string;
  constitutionVersion: string;
  constitutionFingerprint: string;
  stateFingerprint: string;
  candidateSetFingerprint: string;
  cycle: number;
  eligible: NarrativeCandidateScore[];
  rejected: NarrativeCandidateRejection[];
  selectedCandidateId: string | null;
}

export interface NarrativeBeat {
  id: string;
  sequence: number;
  cycle: number;
  candidateId: string;
  recipeId: string;
  authority: NarrativeAuthority;
  trackId: string;
  beatFunction: NarrativeBeatFunction;
  sourceFactIds: string[];
  causalParentBeatIds: string[];
  roleBindings: Record<string, string>;
  actorMoves: NarrativeActorMove[];
  tags: string[];
  pressureTags: string[];
  statePayments: NarrativeStatePayment[];
  openedObligationIds: string[];
  resolvedObligationIds: string[];
  presentationKey: string;
  score: NarrativeCandidateScore;
}

export interface NarrativeLedger {
  format: typeof NARRATIVE_LEDGER_FORMAT;
  beats: NarrativeBeat[];
  obligations: NarrativeObligation[];
}

export interface NarrativeRuntimeState {
  cycle: number;
  facts: NarrativeFact[];
  actors: NarrativeActorSnapshot[];
  tracks: NarrativeTrackState[];
  ledger: NarrativeLedger;
}

export interface NarrativeCommitReceipt {
  format: "axm-narrative-commit/1";
  beatId: string;
  sequence: number;
  selectionFingerprint: string;
  stateBeforeFingerprint: string;
  stateAfterFingerprint: string;
  trackId: string;
  openedObligationIds: string[];
  resolvedObligationIds: string[];
  trackStatus: NarrativeTrackStatus;
}

export interface NarrativeCommitResult {
  state: NarrativeRuntimeState;
  receipt: NarrativeCommitReceipt;
}
