import type { Arc } from "../../src/engine/types.js";
import { validateArc } from "../../src/engine/schema.js";
import { CYCLE_ARC } from "./cycle-arc.js";

// CYCLE_ARC extended with everything the gating vocabulary can express:
// attunement chains (one per step type), a challenge gated both by an org
// milestone and an attunement threshold, progression tiers with milestone +
// reputation unlocks, and a heroic difficulty mode. Passed through
// validateArc so the fixture can never drift from the schema.

const base = structuredClone(CYCLE_ARC);

export const GATED_ARC: Arc = validateArc({
  ...base,
  meta: { ...base.meta, id: "gated-test-arc", name: "Gated Test Arc" },
  // CYCLE_ARC predates validateArc's 3-attribute floor; pad to stay schema-legal.
  attributes: [...base.attributes, { id: "reflex", name: "Reflex", description: "Speed." }],
  attunementChains: [
    {
      id: "keyholder",
      name: "Keyholder",
      steps: [{ type: "challenge_clear", target: "test-challenge" }],
      grantsAccessTo: ["inner-vault"],
    },
    {
      id: "exalted",
      name: "Exalted",
      steps: [{ type: "reputation_threshold", target: "50" }],
      grantsAccessTo: [],
    },
    {
      id: "master",
      name: "Master of the Vault",
      steps: [
        { type: "item_acquire", target: "test-item" },
        { type: "chain_complete", target: "keyholder" },
      ],
      grantsAccessTo: [],
    },
  ],
  progressionTiers: [
    {
      id: "tier-1",
      name: "Tier I",
      flavorText: "Open from the start.",
      unlockConditions: { orgMilestones: [], reputationMinimum: null },
      challenges: ["test-challenge"],
      requiredChallenges: ["test-challenge"],
      optionalChallenges: [],
    },
    {
      id: "tier-2",
      name: "Tier II",
      flavorText: "The vault floor.",
      unlockConditions: { orgMilestones: ["test-challenge-cleared"], reputationMinimum: 40 },
      challenges: ["inner-vault"],
      requiredChallenges: [],
      optionalChallenges: [],
    },
  ],
  challenges: [
    ...base.challenges,
    {
      id: "inner-vault",
      name: "Inner Vault",
      description: "Milestone-gated and attunement-gated.",
      rosterRequirements: { minAgents: 2, maxAgents: 4, roleRequirements: [] },
      accessRequirements: {
        orgMilestones: ["test-challenge-cleared"],
        agentAttunements: [],
        attunementThreshold: 0.5,
      },
      difficultyRating: 40,
      mechanicChecks: [
        {
          id: "vault-power",
          name: "Vault Power Check",
          description: "Hold the doors.",
          attributeWeights: [{ attributeId: "power", weight: 1.0 }],
          difficultyThreshold: 7,
          scope: "per_agent",
          failureConsequence: { type: "stress", severity: 0.3 },
        },
      ],
      completionCriteria: { type: "all_mechanics_passed", parameters: {} },
      timePressure: { rounds: 3, aggregateThreshold: 20, attributeId: "power" },
      outcomes: {
        success: { rewardTable: [], narrative: "Vault opened.", reputationGain: 5, currencyReward: 100 },
        partial: { rewardTable: [], narrative: "Half looted.", currencyReward: 40 },
        failure: { rewardTable: [], narrative: "Sealed again.", stressPenalty: 1 },
      },
    },
  ],
  difficultyModes: [
    {
      id: "heroic",
      name: "Heroic",
      globalModifiers: {
        difficultyMultiplier: 1.5,
        rewardMultiplier: 2,
        mechanicAdditions: [
          {
            id: "heroic-focus",
            name: "Heroic Focus Check",
            description: "Mode-only mechanic.",
            attributeWeights: [{ attributeId: "focus", weight: 1.0 }],
            difficultyThreshold: 6,
            scope: "per_agent",
            failureConsequence: { type: "stress", severity: 0.3 },
          },
        ],
      },
    },
  ],
});
