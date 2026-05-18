import type { Organization, Agent, Arc, ArcTier } from "../../src/engine/types.js";

// ── Minimal arc used only by state engine tests ───────────────────────────────

export const STATE_ARC: Arc = {
  meta: {
    id: "state-test-arc",
    name: "State Test Arc",
    description: "Minimal arc for state engine tests.",
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
    { id: "guardian", name: "Guardian", attributeWeights: { power: 0.3, focus: 0.7 } },
  ],
  tiers: [
    {
      id: "tier1",
      name: "Tier 1",
      statBudgetMin: 10,
      statBudgetMax: 15,
      upkeepCost: 1,
      baseEfficiencyModifier: 1.0,
    },
    {
      id: "tier2",
      name: "Tier 2",
      statBudgetMin: 20,
      statBudgetMax: 25,
      upkeepCost: 2,
      baseEfficiencyModifier: 0.9,
    },
    {
      id: "tier3",
      name: "Tier 3",
      statBudgetMin: 30,
      statBudgetMax: 35,
      upkeepCost: 4,
      baseEfficiencyModifier: 0.8,
    },
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
  challenges: [],
  difficultyModes: [],
  items: [
    {
      id: "basic-sword",
      name: "Basic Sword",
      slot: "weapon",
      statBonuses: { power: 4 },
      tierRequirement: "tier1",
      flavorText: "A simple blade.",
    },
    {
      id: "elite-sword",
      name: "Elite Sword",
      slot: "weapon",
      statBonuses: { power: 10 },
      tierRequirement: "tier2",
      flavorText: "A fine blade.",
    },
  ],
  narrativeEvents: [],
  scaling: null,
};

export const TIER1: ArcTier = STATE_ARC.tiers[0]!;
export const TIER2: ArcTier = STATE_ARC.tiers[1]!;
export const TIER3: ArcTier = STATE_ARC.tiers[2]!;

// ── Agent factory ─────────────────────────────────────────────────────────────

let _agentCounter = 0;

export function makeTestAgent(opts?: {
  id?: string;
  tier?: string;
  role?: string;
  traits?: string[];
  stress?: number;
  morale?: number;
  ambition?: number;
  loyalty?: number;
  affliction?: { kind: string; sinceCycle: number };
  assignmentHistory?: Agent["assignmentHistory"];
  rewardHistory?: Agent["rewardHistory"];
  equippedItems?: Record<string, string>;
}): Agent {
  const id = opts?.id ?? `agent-${++_agentCounter}`;
  return {
    id,
    name: `Agent ${id}`,
    attributes: { power: 10, focus: 8 },
    hiddenAttributes: {
      loyalty: opts?.loyalty ?? 10,
      ambition: opts?.ambition ?? 10,
      volatility: 5,
      leadership: 5,
    },
    traits: opts?.traits ?? [],
    role: opts?.role ?? "striker",
    secondaryRole: null,
    baseEfficiency: 10,
    tier: opts?.tier ?? "tier1",
    upkeep: 1,
    morale: opts?.morale ?? 60,
    stress: opts?.stress ?? 0,
    attunements: [],
    assignmentHistory: opts?.assignmentHistory ?? [],
    afflictionHistory: [],
    rewardHistory: opts?.rewardHistory ?? [],
    afflictionState: (opts?.affliction ?? { kind: "none" }) as Agent["afflictionState"],
    equippedItems: opts?.equippedItems ?? {},
    downedUntilCycle: null,
    lastClearCycle: {},
    revealedHiddenAttrs: 0,
    revealedTraits: 0,
  };
}

// ── Org factory ───────────────────────────────────────────────────────────────

export function makeTestOrg(agents: Agent[]): Organization {
  const agentMap: Record<string, Agent> = {};
  for (const a of agents) agentMap[a.id] = a;

  return {
    id: "test-org",
    name: "Test Organization",
    reputation: 50,
    resources: { currency: 100, materials: 50, tokens: 5 },
    infrastructure: {
      Quarters: { type: "Quarters", level: 1, assignedAgents: [] },
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
    rngSeed: 42,
  };
}
