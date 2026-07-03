// ── Primitives ────────────────────────────────────────────────────────────────

// Provenance label for an arc as loaded into this runtime. Trust is a property
// of *how* an arc arrived (bundled with the build, imported via JSON, etc.),
// not of the arc's content — so this never appears on ArcMeta. Library entries
// carry it; UI surfaces it. "verified" and "quarantined" are placeholders for
// future Genesis signing / admin actions and have no runtime behavior yet.
export type TrustLabel = "bundled" | "imported-unsigned" | "verified" | "quarantined";

export type Affliction = "Resentful" | "Fearful" | "Defiant" | "Reckless" | "Withdrawn";

export type AfflictionState = { kind: "none" } | { kind: Affliction; sinceCycle: number };

export type RelationshipState =
  | "Neutral"
  | "Allied"
  | "Rivalrous"
  | "Hostile"
  | "Mentorship"
  | "Bonded";

export type RewardDistributionPolicy = "council" | "points" | "rotation";

export type InfrastructureFacility =
  | "Quarters"
  | "Production"
  | "Recreation"
  | "Research"
  | "Training"
  | "Storage"
  | "Medical";

export type ScalingMode = "fixed" | "scaled" | "invocation";

export type MoraleState = number; // 0-100

export type Tone = "neutral" | "tense" | "triumphant" | "grim" | "comedic";

// ── Trait Effects ─────────────────────────────────────────────────────────────

export type TraitEffect =
  | { kind: "infraEfficiencyMultiplier"; multiplier: number }
  | { kind: "moralePenaltyMultiplierOnRewardDisappointment"; multiplier: number }
  | { kind: "mentorshipTierGapBonus"; reducedGapRequired: number }
  | { kind: "relationshipFormationMultiplier"; multiplier: number }
  | { kind: "hostileStressImmunity" }
  | { kind: "recklessAfflictionChanceBonus"; bonus: number }
  | { kind: "attributeBonusWhenMoraleHigh"; attributeId: string; threshold: number; bonus: number }
  | { kind: "stressAccumulationMultiplier"; multiplier: number }
  | { kind: "moraleGainMultiplier"; multiplier: number }
  | { kind: "attributeCheckBonus"; attributeId: string; bonus: number }
  | { kind: "stressOnPartialSuccess"; amount: number }
  | { kind: "relationshipAffinityMultiplier"; multiplier: number }
  | { kind: "moraleSensitivityToTeamLoss"; multiplier: number }
  | { kind: "ambitionSignal" };

// ── Trait & Item ──────────────────────────────────────────────────────────────

export interface Trait {
  id: string;
  name: string;
  description: string;
  effects: TraitEffect[];
}

export interface Item {
  id: string;
  name: string;
  slot: string;
  statBonuses: Record<string, number>;
  tierRequirement: string;
  flavorText: string;
}

// ── Tier & Role ───────────────────────────────────────────────────────────────

export interface Tier {
  id: string;
  name: string;
  statBudgetMin: number;
  statBudgetMax: number;
  upkeepCost: number;
  baseEfficiencyModifier: number;
}

export interface Role {
  id: string;
  name: string;
  attributeWeights: Record<string, number>;
}

// ── Agent ─────────────────────────────────────────────────────────────────────

export interface AssignmentRecord {
  challengeId: string;
  cycle: number;
  outcome: "success" | "partial" | "failure";
}

export interface RewardRecord {
  itemId: string;
  cycle: number;
  challengeId: string;
}

export interface Agent {
  id: string;
  name: string;
  attributes: Record<string, number>;
  hiddenAttributes: {
    loyalty: number;
    ambition: number;
    volatility: number;
    leadership: number;
  };
  traits: string[];
  role: string | null;
  secondaryRole: string | null;
  baseEfficiency: number;
  tier: string;
  upkeep: number;
  morale: MoraleState;
  stress: number;
  attunements: string[];
  assignmentHistory: AssignmentRecord[];
  afflictionHistory: Affliction[];
  rewardHistory: RewardRecord[];
  afflictionState: AfflictionState;
  equippedItems: Record<string, string>;
  downedUntilCycle: number | null;
  lastClearCycle: Record<string, number>;
  revealedHiddenAttrs: number;
  revealedTraits: number;
}

// ── Organization ──────────────────────────────────────────────────────────────

export interface Facility {
  type: InfrastructureFacility;
  level: number;
  assignedAgents: string[];
}

export interface Relationship {
  agentIds: [string, string];
  state: RelationshipState;
  affinity: number;
}

export interface Precedent {
  cycle: number;
  type: "reward" | "promotion" | "benching" | "assignment";
  decisionBasis: "merit" | "seniority" | "need" | "favoritism" | "rotation";
  agentsInvolved: string[];
  winner: string | null;
  context: Record<string, unknown>;
}

export interface DramaCardEffect {
  target: string;
  type: string;
  value: number;
}

export interface DramaCardOption {
  id: string;
  label: string;
  description: string;
  effects: DramaCardEffect[];
  hiddenEffects: DramaCardEffect[];
}

export interface DramaCard {
  id: string;
  cycleGenerated: number;
  triggerType: string;
  agentsInvolved: string[];
  narrativeText: string;
  options: DramaCardOption[];
}

export interface Organization {
  id: string;
  name: string;
  reputation: number;
  resources: {
    currency: number;
    materials: number;
    tokens: number;
  };
  infrastructure: Record<InfrastructureFacility, Facility>;
  agents: Record<string, Agent>;
  relationships: Relationship[];
  precedents: Precedent[];
  dramaQueue: DramaCard[];
  cycle: number;
  distributionPolicy: RewardDistributionPolicy;
  rngSeed: number;
}

// ── Challenge ─────────────────────────────────────────────────────────────────

export interface AttributeWeight {
  attributeId: string;
  weight: number;
}

export interface FailureConsequence {
  type: "agent_damage" | "team_damage" | "stress" | "debuff" | "cascade";
  severity: number;
}

/** Controls how a team_aggregate check's threshold scales with party size.
 *  "fixed"           — threshold is an absolute total (default; more people always helps).
 *  "perAssignedAgent" — threshold multiplies by party size; every agent must pull their weight. */
export type ThresholdMode = "fixed" | "perAssignedAgent";

/** An authored, per-contract resource-spend lever. When present, the encounter
 *  may spend the arc's token to steady an ALREADY-PLAUSIBLE attempt — its only
 *  effect is a bounded, mean-preserving narrowing of the roll's symmetric
 *  (mean-zero) variance. It never changes the expected score, a threshold, a
 *  gate, or an outcome, and it never touches the asymmetric character-owned
 *  volatility swing. Absent = the contract authors no spend lever, and no spend
 *  option renders. See axm-world docs/design/RESOURCE_SPEND_ENGINE_PROPOSAL.md. */
export interface ResourceSpendLever {
  /** Max tokens honored toward steadiness. Spend beyond this is clamped — it is
   *  never "more power for more tokens" past the cap. */
  maxTokens: number;
  /** Fraction of the symmetric variance band removed per honored token, 0..1. */
  steadinessPerToken: number;
  /** Floor on the steadiness factor k, in (0,1]. The band never narrows below
   *  this, so a marginal party always keeps a real chance of failure — spend can
   *  never buy a guaranteed pass. */
  minSteadiness: number;
}

export interface MechanicCheck {
  id: string;
  name: string;
  description: string;
  attributeWeights: AttributeWeight[];
  difficultyThreshold: number;
  /** Only meaningful for team_aggregate. Defaults to "fixed" when omitted. */
  thresholdMode?: ThresholdMode;
  scope: "per_agent" | "team_aggregate" | "role_specific";
  /** Optional explicit role scope for role_specific checks. When omitted, legacy arcs
   *  fall back to the challenge-level required roles. */
  roleIds?: string[];
  failureConsequence: FailureConsequence;
  /** Optional per-check spend lever, overriding the challenge-level one for this
   *  check. Omitted = inherit the challenge's lever (or none). */
  resourceSpend?: ResourceSpendLever;
}

export interface RosterRequirements {
  minAgents: number;
  maxAgents: number;
  roleRequirements: Array<{ roleId: string; count: number }>;
}

export interface AccessRequirements {
  orgMilestones: string[];
  agentAttunements: string[];
  attunementThreshold: number | null;
}

export type CompletionCriteriaType =
  | "all_mechanics_passed"
  | "threshold_passed"
  | "dps_check"
  | "survival_check"
  | "composite";

export interface CompletionCriteria {
  type: CompletionCriteriaType;
  parameters: Record<string, unknown>;
}

export interface TimePressure {
  rounds: number;
  aggregateThreshold: number;
  attributeId: string;
}

export interface RewardTableEntry {
  itemId: string;
  dropRate: number;
}

export interface Outcome {
  rewardTable: RewardTableEntry[];
  narrative: string;
  reputationGain?: number;
  currencyReward?: number;
  milestoneFlag?: string;
  agentDowntimeCycles?: number;
  stressPenalty?: number;
  tokenRefund?: number;
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  rosterRequirements: RosterRequirements;
  accessRequirements: AccessRequirements;
  difficultyRating: number;
  mechanicChecks: MechanicCheck[];
  completionCriteria: CompletionCriteria;
  timePressure: TimePressure | null;
  outcomes: {
    success: Outcome;
    partial: Outcome;
    failure: Outcome;
  };
  /** Optional encounter-level spend lever. Applies to every check that does not
   *  author its own `resourceSpend`. Omitted = the contract offers no spend. */
  resourceSpend?: ResourceSpendLever;
}

// ── Run Report ────────────────────────────────────────────────────────────────

export interface MechanicResult {
  mechanicId: string;
  score: number;
  threshold: number;
  passed: boolean;
}

export interface AgentRunResult {
  agentId: string;
  mechanicResults: MechanicResult[];
  performanceRating: number;
  stressGained: number;
  wasDowned: boolean;
  isHeroic: boolean;
}

export interface LootDrop {
  itemId: string;
  eligibleAgents: string[];
}

export interface DramaTrigger {
  type: string;
  agentsInvolved: string[];
}

export interface RunReport {
  challengeId: string;
  outcome: "success" | "partial" | "failure";
  cycle: number;
  assignedAgents: AgentRunResult[];
  lootDrops: LootDrop[];
  dramaTriggers: DramaTrigger[];
  narrativeSeed: number;
  rewardsGranted?: { currency: number; reputation: number };
}

// ── Narrative ─────────────────────────────────────────────────────────────────

export interface NarrativeTemplate {
  trigger: string;
  tone: Tone;
  conditions: Record<string, unknown>;
  text: string;
}

export interface NarrativeEvent {
  trigger: {
    type:
      | "first_clear"
      | "tier_complete"
      | "arc_complete"
      | "agent_milestone"
      | "reputation_threshold";
    target: string;
  };
  title: string;
  text: string;
  rewards: string[];
  agentUnlock: { agentTemplate: Record<string, unknown> } | null;
}

// ── Arc (Part 3 schema) ───────────────────────────────────────────────────────

export interface ArcMeta {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  engineVersion: string;
  domain: string;
  estimatedCycles: number;
}

export interface ArcAttribute {
  id: string;
  name: string;
  description: string;
}

export interface ArcRole {
  id: string;
  name: string;
  attributeWeights: Record<string, number>;
}

export interface ArcTier {
  id: string;
  name: string;
  statBudgetMin: number;
  statBudgetMax: number;
  upkeepCost: number;
  baseEfficiencyModifier: number;
}

export interface AttunementStep {
  type: "challenge_clear" | "reputation_threshold" | "item_acquire" | "chain_complete";
  target: string;
}

export interface AttunementChain {
  id: string;
  name: string;
  steps: AttunementStep[];
  grantsAccessTo: string[];
}

export interface ProgressionTier {
  id: string;
  name: string;
  flavorText: string;
  unlockConditions: {
    orgMilestones: string[];
    reputationMinimum: number | null;
  };
  challenges: string[];
  requiredChallenges: string[];
  optionalChallenges: string[];
}

export interface DifficultyMode {
  id: string;
  name: string;
  globalModifiers: {
    difficultyMultiplier: number;
    rewardMultiplier: number;
    mechanicAdditions: MechanicCheck[];
  };
}

export interface ArcScaling {
  type: ScalingMode;
  scalingRules: Record<string, unknown>;
}

export interface Arc {
  meta: ArcMeta;
  attributes: ArcAttribute[];
  roles: ArcRole[];
  tiers: ArcTier[];
  currencyName: string;
  materialName: string;
  tokenName: string;
  reputationName: string;
  tokensPerCycle: number;
  maxTokens: number;
  infrastructureTokenBonus: number;
  namePool: { firstNames: string[]; lastNames: string[] };
  customTraits: Trait[];
  progressionTiers: ProgressionTier[];
  attunementChains: AttunementChain[];
  challenges: Challenge[];
  difficultyModes: DifficultyMode[];
  items: Item[];
  narrativeEvents: NarrativeEvent[];
  scaling: ArcScaling | null;
}
