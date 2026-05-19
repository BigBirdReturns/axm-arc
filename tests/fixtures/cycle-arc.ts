import type { Organization, Agent, Arc } from "../../src/engine/types.js";

// ── Minimal arc for cycle tests ───────────────────────────────────────────────

export const CYCLE_ARC: Arc = {
  meta: {
    id: "cycle-test-arc",
    name: "Cycle Test Arc",
    description: "Minimal arc for cycle engine tests.",
    author: "test",
    version: "1.0.0",
    engineVersion: "1.0",
    domain: "test",
    estimatedCycles: 10,
  },
  attributes: [
    { id: "power", name: "Power", description: "Strength." },
    { id: "focus", name: "Focus", description: "Mental acuity." },
  ],
  roles: [
    { id: "striker", name: "Striker", attributeWeights: { power: 0.8, focus: 0.2 } },
  ],
  tiers: [
    { id: "common", name: "Common", statBudgetMin: 10, statBudgetMax: 15, upkeepCost: 1, baseEfficiencyModifier: 1.0 },
    { id: "uncommon", name: "Uncommon", statBudgetMin: 16, statBudgetMax: 22, upkeepCost: 2, baseEfficiencyModifier: 0.9 },
    { id: "rare", name: "Rare", statBudgetMin: 23, statBudgetMax: 30, upkeepCost: 3, baseEfficiencyModifier: 0.8 },
    { id: "epic", name: "Epic", statBudgetMin: 31, statBudgetMax: 38, upkeepCost: 4, baseEfficiencyModifier: 0.7 },
  ],
  currencyName: "Gold",
  materialName: "Materials",
  tokenName: "Tokens",
  reputationName: "Reputation",
  tokensPerCycle: 3,
  maxTokens: 10,
  infrastructureTokenBonus: 0.1,
  namePool: { firstNames: ["Aric", "Lira", "Vex"], lastNames: ["Ashveil", "Bracken"] },
  customTraits: [],
  progressionTiers: [],
  attunementChains: [],
  challenges: [
    {
      id: "test-challenge",
      name: "Test Challenge",
      description: "A test challenge.",
      rosterRequirements: { minAgents: 1, maxAgents: 3, roleRequirements: [] },
      accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
      difficultyRating: 20,
      mechanicChecks: [
        {
          id: "check-power",
          name: "Power Check",
          description: "Strength test.",
          attributeWeights: [{ attributeId: "power", weight: 1.0 }],
          difficultyThreshold: 5,
          scope: "per_agent",
          failureConsequence: { type: "stress", severity: 0.2 },
        },
      ],
      completionCriteria: { type: "all_mechanics_passed", parameters: {} },
      timePressure: null,
      outcomes: {
        success: { rewardTable: [{ itemId: "test-item", dropRate: 1.0 }], narrative: "Victory!", reputationGain: 3 },
        partial: { rewardTable: [], narrative: "Partial." },
        failure: { rewardTable: [], narrative: "Defeat.", stressPenalty: 1 },
      },
    },
  ],
  difficultyModes: [],
  items: [
    {
      id: "test-item",
      name: "Test Item",
      slot: "weapon",
      statBonuses: { power: 2 },
      tierRequirement: "common",
      flavorText: "A test weapon.",
    },
  ],
  narrativeEvents: [],
  scaling: null,
};

// ── Agent factory ─────────────────────────────────────────────────────────────

let _counter = 0;

export function makeCycleAgent(opts?: {
  id?: string;
  stress?: number;
  morale?: number;
  upkeep?: number;
  assignmentCount?: number;
  downedUntilCycle?: number | null;
  traits?: string[];
}): Agent {
  const id = opts?.id ?? `cycle-agent-${++_counter}`;
  const assignmentCount = opts?.assignmentCount ?? 0;
  const history = Array.from({ length: assignmentCount }, (_, i) => ({
    challengeId: "test-challenge",
    cycle: i + 1,
    outcome: "success" as const,
  }));

  return {
    id,
    name: `Agent ${id}`,
    attributes: { power: 12, focus: 8 },
    hiddenAttributes: { loyalty: 10, ambition: 8, volatility: 5, leadership: 5 },
    traits: opts?.traits ?? [],
    role: "striker",
    secondaryRole: null,
    baseEfficiency: 8,
    tier: "common",
    upkeep: opts?.upkeep ?? 1,
    morale: opts?.morale ?? 60,
    stress: opts?.stress ?? 0,
    attunements: [],
    assignmentHistory: history,
    afflictionHistory: [],
    rewardHistory: [],
    afflictionState: { kind: "none" },
    equippedItems: {},
    downedUntilCycle: opts?.downedUntilCycle ?? null,
    lastClearCycle: {},
    revealedHiddenAttrs: 0,
    revealedTraits: 1,
  };
}

// ── Org factory ───────────────────────────────────────────────────────────────

export function makeCycleOrg(agents: Agent[], opts?: { tokens?: number; currency?: number; reputation?: number }): Organization {
  const agentMap: Record<string, Agent> = {};
  for (const a of agents) agentMap[a.id] = a;

  return {
    id: "cycle-org",
    name: "Cycle Test Org",
    reputation: opts?.reputation ?? 30,
    resources: {
      currency: opts?.currency ?? 200,
      materials: 20,
      tokens: opts?.tokens ?? 5,
    },
    infrastructure: {
      Quarters: { type: "Quarters", level: 2, assignedAgents: [] },
      Production: { type: "Production", level: 1, assignedAgents: [] },
      Recreation: { type: "Recreation", level: 2, assignedAgents: [] },
      Research: { type: "Research", level: 1, assignedAgents: [] },
      Training: { type: "Training", level: 1, assignedAgents: [] },
      Storage: { type: "Storage", level: 1, assignedAgents: [] },
      Medical: { type: "Medical", level: 1, assignedAgents: [] },
    },
    agents: agentMap,
    relationships: [],
    precedents: [],
    dramaQueue: [],
    cycle: 1,
    distributionPolicy: "council",
    rngSeed: 12345,
  };
}
