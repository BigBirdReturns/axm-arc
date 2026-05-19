import type { Arc, ArcTier, Agent } from "../../src/engine/types";
import { validateArc } from "../../src/engine/schema";
import { Rng } from "../../src/engine/prng";
import { generateAgent } from "../../src/engine/character";

const RAW_ARC = {
  meta: {
    id: "mini-arc",
    name: "Mini Arc",
    description: "Minimal arc for testing.",
    author: "test",
    version: "1.0.0",
    engineVersion: "1.0",
    domain: "fantasy",
    estimatedCycles: 10,
  },
  attributes: [
    { id: "power", name: "Power", description: "Raw strength." },
    { id: "focus", name: "Focus", description: "Mental acuity." },
    { id: "reflex", name: "Reflex", description: "Speed and dodge." },
  ],
  roles: [
    { id: "striker", name: "Striker", attributeWeights: { power: 0.6, focus: 0.2, reflex: 0.2 } },
    { id: "guardian", name: "Guardian", attributeWeights: { power: 0.2, focus: 0.3, reflex: 0.5 } },
  ],
  tiers: [
    { id: "common", name: "Common", statBudgetMin: 18, statBudgetMax: 24, upkeepCost: 2, baseEfficiencyModifier: 1.0 },
    { id: "elite", name: "Elite", statBudgetMin: 30, statBudgetMax: 36, upkeepCost: 5, baseEfficiencyModifier: 0.8 },
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
  progressionTiers: [
    {
      id: "tier1",
      name: "Tier 1",
      flavorText: "The beginning.",
      unlockConditions: { orgMilestones: [], reputationMinimum: null },
      challenges: ["mini-challenge"],
      requiredChallenges: ["mini-challenge"],
      optionalChallenges: [],
    },
  ],
  attunementChains: [],
  challenges: [
    {
      id: "mini-challenge",
      name: "The First Trial",
      description: "A basic test of skill.",
      rosterRequirements: {
        minAgents: 1,
        maxAgents: 3,
        roleRequirements: [],
      },
      accessRequirements: {
        orgMilestones: [],
        agentAttunements: [],
        attunementThreshold: null,
      },
      difficultyRating: 40,
      mechanicChecks: [
        {
          id: "check-power",
          name: "Power Check",
          description: "Brute force.",
          attributeWeights: [
            { attributeId: "power", weight: 0.7 },
            { attributeId: "reflex", weight: 0.3 },
          ],
          difficultyThreshold: 8,
          scope: "per_agent" as const,
          failureConsequence: { type: "stress" as const, severity: 0.3 },
        },
        {
          id: "check-focus",
          name: "Focus Check",
          description: "Team concentration.",
          attributeWeights: [
            { attributeId: "focus", weight: 0.6 },
            { attributeId: "reflex", weight: 0.4 },
          ],
          difficultyThreshold: 12,
          scope: "team_aggregate" as const,
          failureConsequence: { type: "stress" as const, severity: 0.2 },
        },
      ],
      completionCriteria: {
        type: "all_mechanics_passed" as const,
        parameters: {},
      },
      timePressure: {
        rounds: 2,
        aggregateThreshold: 10,
        attributeId: "power",
      },
      outcomes: {
        success: {
          rewardTable: [{ itemId: "sword-of-dawn", dropRate: 1.0 }],
          narrative: "Victory!",
          reputationGain: 5,
          milestoneFlag: "mini-challenge-clear",
        },
        partial: {
          rewardTable: [{ itemId: "shield-shard", dropRate: 1.0 }],
          narrative: "A partial win.",
          agentDowntimeCycles: 1,
        },
        failure: {
          rewardTable: [],
          narrative: "Defeat.",
          stressPenalty: 2,
          tokenRefund: 0.5,
        },
      },
    },
  ],
  difficultyModes: [],
  items: [
    {
      id: "sword-of-dawn",
      name: "Sword of Dawn",
      slot: "weapon",
      statBonuses: { power: 3, reflex: 1 },
      tierRequirement: "common",
      flavorText: "A blade that never rusts.",
    },
    {
      id: "shield-shard",
      name: "Shield Shard",
      slot: "offhand",
      statBonuses: { reflex: 2 },
      tierRequirement: "common",
      flavorText: "A fragment of an ancient shield.",
    },
  ],
  narrativeEvents: [],
  scaling: null,
};

export const MINI_ARC: Arc = validateArc(RAW_ARC);

export const MINI_TANK: ArcTier = MINI_ARC.tiers[0]!;
export const MINI_ELITE_TIER: ArcTier = MINI_ARC.tiers[1]!;

export function makeAgent(seed: number, opts?: { tierId?: string; preferredRoleId?: string }): Agent {
  const tier = opts?.tierId === "elite" ? MINI_ELITE_TIER : MINI_TANK;
  return generateAgent({
    rng: new Rng(seed),
    tier,
    arc: MINI_ARC,
    cycle: 1,
    preferredRoleId: opts?.preferredRoleId,
  });
}
