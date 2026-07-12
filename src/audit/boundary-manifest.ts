export type BoundaryCategory =
  | "decision_kernel"
  | "optional_org_policy"
  | "cartridge_data"
  | "game_only_policy"
  | "presentation_shell"
  | "browser_custody"
  | "external_verification_integration";

export interface CycleStageClassification {
  step: string;
  title: string;
  category: BoundaryCategory;
  removable: boolean;
  rationale: string;
}

/** Every current engine module has one primary disposition. Mixed files are
 * deliberately assigned to the stricter category: this audit measures the
 * boundary that exists, not the boundary the product thesis intends. */
export const MODULE_CLASSIFICATION: Record<string, BoundaryCategory> = {
  "access.ts": "game_only_policy",
  "cartridge-digest.ts": "cartridge_data",
  "character.ts": "game_only_policy",
  "constants.ts": "game_only_policy",
  "cycle.ts": "game_only_policy",
  "difficulty.ts": "optional_org_policy",
  "drama-triage.ts": "game_only_policy",
  "drama.ts": "game_only_policy",
  "economy.ts": "optional_org_policy",
  "infrastructure.ts": "optional_org_policy",
  "precedents.ts": "optional_org_policy",
  "prng.ts": "decision_kernel",
  "projections.ts": "decision_kernel",
  "recruitment.ts": "optional_org_policy",
  "relationships.ts": "optional_org_policy",
  "report.ts": "presentation_shell",
  "resolver.ts": "game_only_policy",
  "rewards.ts": "game_only_policy",
  "save.ts": "browser_custody",
  "schema.ts": "cartridge_data",
  "scoring.ts": "decision_kernel",
  "stress.ts": "optional_org_policy",
  "types.ts": "game_only_policy",
  "strategy-board/index.ts": "optional_org_policy",
  "strategy-board/program-of-record-mini.ts": "cartridge_data",
  "strategy-board/schema.ts": "cartridge_data",
  "strategy-board/turn.ts": "optional_org_policy",
  "strategy-board/types.ts": "optional_org_policy",
};

export const CYCLE_STAGES: CycleStageClassification[] = [
  { step: "0", title: "Downed-agent recovery", category: "game_only_policy", removable: false, rationale: "Mandatory downed-state recovery." },
  { step: "1", title: "Challenge Resolution", category: "game_only_policy", removable: false, rationale: "Always resolves simulated challenges, loot, downtime, and progression rewards." },
  { step: "2", title: "Reward Resolution", category: "game_only_policy", removable: false, rationale: "Mandatory item eligibility and loot choice lifecycle." },
  { step: "3", title: "Stress Processing", category: "optional_org_policy", removable: false, rationale: "Potential organizational policy, but hard-wired into runCycle." },
  { step: "4", title: "Relationship Updates", category: "optional_org_policy", removable: false, rationale: "Potential team policy, but hard-wired into runCycle." },
  { step: "5", title: "Morale Drift", category: "optional_org_policy", removable: false, rationale: "Potential workforce policy, but hard-wired into runCycle." },
  { step: "6", title: "Infrastructure Tick", category: "optional_org_policy", removable: false, rationale: "Potential capacity policy, but fixed facility mechanics are mandatory." },
  { step: "7", title: "Recruitment Pool Refresh", category: "optional_org_policy", removable: false, rationale: "Potential staffing policy, but generated-agent recruitment is mandatory." },
  { step: "8", title: "Token Regeneration", category: "optional_org_policy", removable: false, rationale: "A configurable resource policy executed unconditionally." },
  { step: "8b", title: "Upkeep", category: "optional_org_policy", removable: false, rationale: "A configurable cost policy executed unconditionally." },
  { step: "9", title: "Drama Card Queue Finalization", category: "game_only_policy", removable: false, rationale: "Mandatory narrative drama generation." },
  { step: "10", title: "Hidden Attribute / Trait Reveals", category: "game_only_policy", removable: false, rationale: "Mandatory hidden-trait progression." },
  { step: "10b", title: "Attunement stamping", category: "game_only_policy", removable: false, rationale: "Mandatory game progression gate." },
  { step: "11", title: "Save Checkpoint", category: "browser_custody", removable: false, rationale: "Serialization is part of the fixed cycle result." },
];

/** Generic decision vocabulary that currently lives in the game-shaped public
 * types module. Everything not overridden inherits its module disposition. */
export const PUBLIC_SYMBOL_OVERRIDES: Partial<Record<string, BoundaryCategory>> = {
  AttributeWeight: "decision_kernel",
  ThresholdMode: "decision_kernel",
  ResourceSpendLever: "decision_kernel",
  MechanicCheck: "decision_kernel",
  RosterRequirements: "decision_kernel",
  CompletionCriteriaType: "decision_kernel",
  CompletionCriteria: "decision_kernel",
  CheckDiagnostic: "decision_kernel",
  AgentContribution: "decision_kernel",
  RunDiagnostics: "decision_kernel",
  ScoreBreakdown: "decision_kernel",
  DeterministicScoreBreakdown: "decision_kernel",
  effectiveCheckThreshold: "decision_kernel",
  deterministicScoreBreakdown: "decision_kernel",
  deterministicAgentScore: "decision_kernel",
  Rng: "decision_kernel",
  hashSeed: "decision_kernel",
};

export const GAME_ONLY_SCHEMA_PREFIXES = [
  "tiers",
  "currencyName",
  "materialName",
  "tokenName",
  "reputationName",
  "tokensPerCycle",
  "maxTokens",
  "infrastructureTokenBonus",
  "namePool",
  "customTraits",
  "progressionTiers",
  "attunementChains",
  "items",
  "narrativeEvents",
  "challenges[].accessRequirements.agentAttunements",
  "challenges[].accessRequirements.attunementThreshold",
  "challenges[].outcomes.success.rewardTable",
  "challenges[].outcomes.partial.rewardTable",
  "challenges[].outcomes.failure.rewardTable",
  "challenges[].outcomes.success.agentDowntimeCycles",
  "challenges[].outcomes.partial.agentDowntimeCycles",
  "challenges[].outcomes.failure.agentDowntimeCycles",
  "challenges[].mechanicChecks[].failureConsequence",
] as const;
