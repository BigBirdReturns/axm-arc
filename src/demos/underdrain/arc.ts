import { validateArc } from "../../engine/schema.js";
import type { Arc } from "../../engine/types.js";
import {
  ACTION_EXTENSION_KEY,
  ACTION_PROFILE_FORMAT,
  type ActionProfile,
} from "../../engine/action/types.js";

export const UNDERDRAIN_DEMO_ID = "underdrain-draft" as const;
export const UNDERDRAIN_CHALLENGE_ID = "breach-crown-pump" as const;
export const UNDERDRAIN_STRATEGY_IDS = [
  "emergency-plan",
  "service-tunnel",
  "truce-offer",
] as const;
export type UnderdrainStrategyId = typeof UNDERDRAIN_STRATEGY_IDS[number];

export const UNDERDRAIN_ACTION_PROFILE: ActionProfile = {
  format: ACTION_PROFILE_FORMAT,
  encounters: {
    [UNDERDRAIN_CHALLENGE_ID]: {
      arenaKit: "lane",
      playerKit: "hammer",
      durationSeconds: 90,
      arenaScale: 1,
      enemyScale: 1,
      objectiveOrder: [
        "flush-spore-valves",
        "hold-pump-line",
        "break-crown-matron",
      ],
      objectiveKits: {
        "flush-spore-valves": "skirmisher",
        "hold-pump-line": "swarm",
        "break-crown-matron": "breaker",
      },
    },
  },
};

const RAW_UNDERDRAIN_ARC = {
  meta: {
    id: UNDERDRAIN_DEMO_ID,
    name: "UNDERDRAIN: The Bloom Below",
    description:
      "Bellwether's municipal plumber is drafted into a hidden infrastructure war after luminous mycelium backs up every drain in town.",
    author: "AXM standalone-demo author",
    version: "1.0.0",
    engineVersion: "1.4.0",
    domain: "municipal-fungal-action-comedy",
    estimatedCycles: 3,
  },
  attributes: [
    { id: "pressure", name: "Pressure", description: "Hydraulic force, leverage, and the courage to open a live main." },
    { id: "diagnosis", name: "Diagnosis", description: "Reading infrastructure, symptoms, and hidden causes." },
    { id: "nerve", name: "Nerve", description: "Working under alarms, spores, and municipal observation." },
  ],
  roles: [
    { id: "pipefighter", name: "Pipefighter", attributeWeights: { pressure: 0.5, diagnosis: 0.25, nerve: 0.25 } },
    { id: "spotter", name: "Spotter", attributeWeights: { pressure: 0.15, diagnosis: 0.55, nerve: 0.3 } },
  ],
  tiers: [
    { id: "licensed", name: "Licensed", statBudgetMin: 30, statBudgetMax: 42, upkeepCost: 2, baseEfficiencyModifier: 1 },
    { id: "apprentice", name: "Apprentice", statBudgetMin: 20, statBudgetMax: 30, upkeepCost: 1, baseEfficiencyModifier: 1.1 },
  ],
  currencyName: "Civic Credit",
  materialName: "Burst Seals",
  tokenName: "Emergency Orders",
  reputationName: "Public Works Standing",
  tokensPerCycle: 2,
  maxTokens: 4,
  infrastructureTokenBonus: 0.1,
  namePool: {
    firstNames: ["Rhea", "Dax", "Tess", "Marta", "Morrowcap"],
    lastNames: ["Venn", "Loam", "Sump", "Rusk"],
  },
  customTraits: [],
  progressionTiers: [{
    id: "mandatory-pipe-service",
    name: "Mandatory Pipe Service",
    flavorText: "The city cannot admit the fungus kingdom exists, so it drafts a plumber to fight a staffing shortage.",
    unlockConditions: { orgMilestones: [], reputationMinimum: null },
    challenges: [UNDERDRAIN_CHALLENGE_ID],
    requiredChallenges: [UNDERDRAIN_CHALLENGE_ID],
    optionalChallenges: [],
  }],
  attunementChains: [],
  challenges: [{
    id: UNDERDRAIN_CHALLENGE_ID,
    name: "Breach the Crown Pump",
    description:
      "Flush three spore valves, keep the pump line alive, and break the Crown Matron's root armor before Bellwether enters toilet rationing.",
    rosterRequirements: {
      minAgents: 1,
      maxAgents: 3,
      roleRequirements: [{ roleId: "pipefighter", count: 1 }],
    },
    accessRequirements: {
      orgMilestones: [],
      agentAttunements: [],
      attunementThreshold: null,
    },
    difficultyRating: 44,
    mechanicChecks: [
      {
        id: "flush-spore-valves",
        name: "Flush the Spore Valves",
        description: "Clear the living blockages and reverse the contaminated flow.",
        attributeWeights: [
          { attributeId: "diagnosis", weight: 0.55 },
          { attributeId: "pressure", weight: 0.45 },
        ],
        difficultyThreshold: 11,
        scope: "team_aggregate" as const,
        failureConsequence: { type: "stress" as const, severity: 0.3 },
      },
      {
        id: "hold-pump-line",
        name: "Hold the Pump Line",
        description: "Keep the municipal pump online while the fungus court counter-mobilizes.",
        attributeWeights: [
          { attributeId: "nerve", weight: 0.55 },
          { attributeId: "pressure", weight: 0.45 },
        ],
        difficultyThreshold: 12,
        scope: "team_aggregate" as const,
        failureConsequence: { type: "team_damage" as const, severity: 0.45 },
      },
      {
        id: "break-crown-matron",
        name: "Break the Crown Matron",
        description: "Strip the root armor grown from Dax's compostable drain caps.",
        attributeWeights: [
          { attributeId: "pressure", weight: 0.6 },
          { attributeId: "diagnosis", weight: 0.25 },
          { attributeId: "nerve", weight: 0.15 },
        ],
        difficultyThreshold: 14,
        scope: "team_aggregate" as const,
        failureConsequence: { type: "cascade" as const, severity: 0.7 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed" as const, parameters: {} },
    timePressure: { rounds: 3, aggregateThreshold: 35, attributeId: "pressure" },
    outcomes: {
      success: {
        rewardTable: [],
        narrative:
          "The Crown Pump clears. Bellwether recognizes a fungal embassy in the condemned annex and schedules the first municipal compost delivery.",
        reputationGain: 4,
        currencyReward: 80,
        milestoneFlag: "bellwether-drain-concord",
      },
      partial: {
        rewardTable: [],
        narrative:
          "The valves hold, but the Crown Matron retreats into the old mains. The ceasefire survives on paperwork and mutual exhaustion.",
        reputationGain: 2,
        agentDowntimeCycles: 1,
      },
      failure: {
        rewardTable: [],
        narrative:
          "Bellwether enters emergency toilet rationing while the officially imaginary fungus kingdom sends an invoice for battlefield substrate.",
        stressPenalty: 3,
        tokenRefund: 0.5,
      },
    },
  }],
  difficultyModes: [
    {
      id: "service-tunnel",
      name: "Old Service Tunnel",
      globalModifiers: { difficultyMultiplier: 1.1, rewardMultiplier: 1.15, mechanicAdditions: [] },
    },
    {
      id: "truce-offer",
      name: "Carry the Truce",
      globalModifiers: { difficultyMultiplier: 0.85, rewardMultiplier: 0.9, mechanicAdditions: [] },
    },
  ],
  items: [],
  narrativeEvents: [],
  scaling: null,
  opening: {
    triggerType: "municipal-draft",
    narrativeText:
      "Director Marta Sump slides Form 8-B across Rhea's breakfast table. Bellwether has classified the fungal invasion as a sanitation staffing shortage.",
    options: [
      {
        id: "emergency-plan",
        label: "Follow the emergency plan",
        description: "Take the armor, the route map, and every future audit.",
        effects: [{ scope: "all" as const, type: "stress" as const, value: 1 }],
      },
      {
        id: "service-tunnel",
        label: "Cut through the old service tunnel",
        description: "Move fast, ignore the map, and discover what Dax sold into the drains.",
        effects: [{ scope: "all" as const, type: "morale" as const, value: 3 }],
      },
      {
        id: "truce-offer",
        label: "Carry Morrowcap's truce",
        description: "Enter under a literal promise and inherit whatever the promise costs.",
        effects: [{ scope: "all" as const, type: "loyalty" as const, value: 2 }],
      },
    ],
  },
  founding: {
    organization: { id: "bellwether-sanitary-reserve", name: "Bellwether Sanitary Defense Reserve" },
    resources: { currency: 40, materials: 3, tokens: 2 },
    facilities: [
      { type: "Quarters" as const, level: 1 },
      { type: "Production" as const, level: 1 },
      { type: "Recreation" as const, level: 0 },
      { type: "Research" as const, level: 1 },
      { type: "Training" as const, level: 0 },
      { type: "Storage" as const, level: 1 },
      { type: "Medical" as const, level: 0 },
    ],
    distributionPolicy: "council" as const,
    roster: [
      { id: "rhea-venn", name: "Rhea Venn", tierId: "licensed", roleId: "pipefighter" },
      { id: "tess-loam", name: "Tess Loam", tierId: "apprentice", roleId: "spotter" },
    ],
    relationships: [{
      rosterSlotIds: ["rhea-venn", "tess-loam"] as [string, string],
      state: "Mentorship" as const,
      affinity: 8,
    }],
  },
  extensions: {
    [ACTION_EXTENSION_KEY]: UNDERDRAIN_ACTION_PROFILE,
    "axm.demo@1": {
      format: "axm-standalone-demo/1",
      episodeId: "mandatory-pipe-service",
      noAccount: true,
      noBackend: true,
      noNetwork: true,
    },
  },
};

export const UNDERDRAIN_DRAFT_ARC: Arc = validateArc(RAW_UNDERDRAIN_ARC);
export const UNDERDRAIN_CHALLENGE = UNDERDRAIN_DRAFT_ARC.challenges[0]!;
