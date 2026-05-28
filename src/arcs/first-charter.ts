import type {
  Arc,
  ArcAttribute,
  ArcRole,
  ArcTier,
  Item,
  Challenge,
  ProgressionTier,
  AttunementChain,
  NarrativeEvent,
} from "../engine/types.js";

// ── Attributes ────────────────────────────────────────────────────────────────

const ATTRIBUTES: ArcAttribute[] = [
  {
    id: "power",
    name: "Power",
    description: "Raw physical strength and martial capability.",
  },
  {
    id: "wits",
    name: "Wits",
    description: "Tactical acuity, perception, and quick thinking.",
  },
  {
    id: "spirit",
    name: "Spirit",
    description: "Force of will, healing attunement, and morale fortitude.",
  },
  {
    id: "mettle",
    name: "Mettle",
    description: "Endurance, resilience, and the ability to hold the line.",
  },
];

// ── Roles ─────────────────────────────────────────────────────────────────────

const ROLES: ArcRole[] = [
  {
    id: "vanguard",
    name: "Vanguard",
    attributeWeights: { power: 0.2, wits: 0.1, spirit: 0.1, mettle: 0.6 },
  },
  {
    id: "skirmisher",
    name: "Skirmisher",
    attributeWeights: { power: 0.6, wits: 0.2, spirit: 0.1, mettle: 0.1 },
  },
  {
    id: "mender",
    name: "Mender",
    attributeWeights: { power: 0.1, wits: 0.2, spirit: 0.6, mettle: 0.1 },
  },
];

// ── Tiers ─────────────────────────────────────────────────────────────────────

const TIERS: ArcTier[] = [
  {
    id: "recruit",
    name: "Recruit",
    statBudgetMin: 20,
    statBudgetMax: 32,
    upkeepCost: 1,
    baseEfficiencyModifier: 1.5,
  },
  {
    id: "veteran",
    name: "Veteran",
    statBudgetMin: 32,
    statBudgetMax: 48,
    upkeepCost: 3,
    baseEfficiencyModifier: 1.0,
  },
  {
    id: "champion",
    name: "Champion",
    statBudgetMin: 48,
    statBudgetMax: 60,
    upkeepCost: 6,
    baseEfficiencyModifier: 0.5,
  },
];

// ── Name Pool ─────────────────────────────────────────────────────────────────

const NAME_POOL = {
  firstNames: [
    "Aldric", "Brynna", "Caelum", "Dara", "Eiran",
    "Fylan", "Gwenna", "Harwick", "Isolde", "Jareth",
    "Kael", "Lyris", "Mordain", "Nyara", "Oswin",
  ],
  lastNames: [
    "Ashgate", "Brimstone", "Crestfall", "Dunmark", "Emberveil",
    "Forhaven", "Greymantle", "Hollowfen", "Ironcroft", "Jarndace",
  ],
};

// ── Items ─────────────────────────────────────────────────────────────────────

const ITEMS: Item[] = [
  {
    id: "rusty-blade",
    name: "Rusty Blade",
    slot: "weapon",
    statBonuses: { power: 1 },
    tierRequirement: "recruit",
    flavorText: "Worn but serviceable — a fitting start for any charter.",
  },
  {
    id: "iron-pauldrons",
    name: "Iron Pauldrons",
    slot: "chest",
    statBonuses: { mettle: 2 },
    tierRequirement: "recruit",
    flavorText: "Salvaged from the troll's lair, dented but solid.",
  },
  {
    id: "trollhide-cloak",
    name: "Trollhide Cloak",
    slot: "cloak",
    statBonuses: { mettle: 1, spirit: 1 },
    tierRequirement: "recruit",
    flavorText: "Remarkably warm. Smells of river mud and victory.",
  },
  {
    id: "merchants-favor",
    name: "Merchant's Favor",
    slot: "trinket",
    statBonuses: { wits: 2 },
    tierRequirement: "recruit",
    flavorText: "A gilded token pressed into your hand with a grateful smile.",
  },
  {
    id: "miners-pick",
    name: "Miner's Pick",
    slot: "weapon",
    statBonuses: { power: 2, mettle: 1 },
    tierRequirement: "veteran",
    flavorText: "Tempered for breaking rock — and anything else in the way.",
  },
  {
    id: "bandit-trophy",
    name: "Bandit Trophy",
    slot: "trinket",
    statBonuses: { power: 1, wits: 1 },
    tierRequirement: "veteran",
    flavorText: "A crude signet ring, now yours. A warning to others.",
  },
  {
    id: "wardens-blade",
    name: "Warden's Blade",
    slot: "weapon",
    statBonuses: { power: 4, mettle: 2 },
    tierRequirement: "champion",
    flavorText: "Forged for the keep's lord. Now it serves a better cause.",
  },
  {
    id: "wardens-seal",
    name: "Warden's Seal",
    slot: "trinket",
    statBonuses: { spirit: 3, wits: 2 },
    tierRequirement: "veteran",
    flavorText: "The keep's authority, transferred. Open new doors.",
  },
];

// ── Challenges ────────────────────────────────────────────────────────────────

const CHALLENGES: Challenge[] = [
  // ── Tier 1 ────────────────────────────────────────────────────────────────
  {
    id: "cellar",
    name: "The Cellar",
    description:
      "A nest of giant rats has infested the guild cellar. An easy first contract to get your charter on its feet.",
    rosterRequirements: {
      minAgents: 6,
      maxAgents: 6,
      roleRequirements: [],
    },
    accessRequirements: {
      orgMilestones: [],
      agentAttunements: [],
      attunementThreshold: null,
    },
    difficultyRating: 10,
    mechanicChecks: [
      {
        id: "cellar-sweep",
        name: "Cellar Sweep",
        description: "Coordinate to drive the rats out. Brute force works fine.",
        attributeWeights: [{ attributeId: "power", weight: 1.0 }],
        difficultyThreshold: 5,
        scope: "team_aggregate",
        failureConsequence: { type: "stress", severity: 0.1 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: null,
    outcomes: {
      success: {
        rewardTable: [{ itemId: "rusty-blade", dropRate: 1.0 }],
        narrative:
          "The rats scatter before your charter's first coordinated advance. A small victory — but it's a start.",
        reputationGain: 1,
        currencyReward: 30,
        milestoneFlag: "cellar-cleared",
      },
      partial: {
        rewardTable: [],
        narrative: "Most of the cellar is clear. A few rats remain, but the immediate threat is handled.",
        agentDowntimeCycles: 1,
      },
      failure: {
        rewardTable: [],
        narrative: "The rats hold the cellar. Your charter returns empty-handed.",
        stressPenalty: 2,
        tokenRefund: 0.5,
      },
    },
  },

  {
    id: "bridge-troll",
    name: "The Bridge Troll",
    description:
      "A troll has claimed the river crossing north of town, demanding tolls and smashing merchant wagons. The local council needs it gone.",
    rosterRequirements: {
      minAgents: 4,
      maxAgents: 6,
      roleRequirements: [{ roleId: "vanguard", count: 1 }],
    },
    accessRequirements: {
      orgMilestones: [],
      agentAttunements: [],
      attunementThreshold: null,
    },
    difficultyRating: 18,
    mechanicChecks: [
      {
        id: "troll-tank",
        name: "Hold the Line",
        description: "The Vanguard must endure the troll's punishing strikes.",
        attributeWeights: [{ attributeId: "mettle", weight: 1.0 }],
        difficultyThreshold: 12,
        scope: "role_specific",
        failureConsequence: { type: "agent_damage", severity: 0.5 },
      },
      {
        id: "troll-assault",
        name: "Coordinated Assault",
        description: "The whole team strikes while the troll is occupied.",
        attributeWeights: [{ attributeId: "power", weight: 1.0 }],
        difficultyThreshold: 8,
        scope: "team_aggregate",
        failureConsequence: { type: "team_damage", severity: 0.3 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: null,
    outcomes: {
      success: {
        rewardTable: [{ itemId: "iron-pauldrons", dropRate: 1.0 }, { itemId: "trollhide-cloak", dropRate: 1.0 }],
        narrative:
          "The troll is driven into the river. The crossing is open, and the merchants are grateful.",
        reputationGain: 2,
        currencyReward: 50,
        milestoneFlag: "bridge-troll-cleared",
      },
      partial: {
        rewardTable: [{ itemId: "iron-pauldrons", dropRate: 1.0 }],
        narrative:
          "The troll retreats, wounded. The bridge is passable, though the beast may return.",
        agentDowntimeCycles: 1,
      },
      failure: {
        rewardTable: [],
        narrative:
          "The troll proves too much. Your charter falls back, bruised and humbled.",
        stressPenalty: 3,
        tokenRefund: 0.5,
      },
    },
  },

  {
    id: "merchant-escort",
    name: "The Merchant Escort",
    description:
      "A merchant caravan must reach the capital before the season's end. Bandits and treacherous roads await. This is your charter's first real test.",
    rosterRequirements: {
      minAgents: 5,
      maxAgents: 7,
      roleRequirements: [
        { roleId: "vanguard", count: 1 },
        { roleId: "mender", count: 1 },
      ],
    },
    accessRequirements: {
      orgMilestones: [],
      agentAttunements: [],
      attunementThreshold: null,
    },
    difficultyRating: 25,
    mechanicChecks: [
      {
        id: "escort-guard",
        name: "Guard the Wagons",
        description: "The Vanguard keeps ambushers away from the caravan.",
        attributeWeights: [{ attributeId: "mettle", weight: 1.0 }],
        difficultyThreshold: 14,
        scope: "role_specific",
        failureConsequence: { type: "agent_damage", severity: 0.4 },
      },
      {
        id: "escort-navigation",
        name: "Navigate the Route",
        description: "The team reads the terrain and avoids ambush points.",
        attributeWeights: [
          { attributeId: "wits", weight: 0.7 },
          { attributeId: "power", weight: 0.3 },
        ],
        difficultyThreshold: 8,
        scope: "team_aggregate",
        failureConsequence: { type: "stress", severity: 0.3 },
      },
      {
        id: "escort-sustain",
        name: "Sustain the March",
        description: "The Mender keeps the caravan moving through injury and exhaustion.",
        attributeWeights: [{ attributeId: "spirit", weight: 1.0 }],
        difficultyThreshold: 14,
        scope: "role_specific",
        failureConsequence: { type: "stress", severity: 0.4 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: null,
    outcomes: {
      success: {
        rewardTable: [{ itemId: "merchants-favor", dropRate: 1.0 }],
        narrative:
          "The caravan arrives intact. The merchant presses a weighty pouch into your hand and promises to spread word of your charter's reliability.",
        reputationGain: 3,
        currencyReward: 70,
        milestoneFlag: "merchant-escort-cleared",
      },
      partial: {
        rewardTable: [],
        narrative:
          "The caravan arrives, but not without cost. The merchant is grateful, if less enthusiastic.",
        reputationGain: 1,
        agentDowntimeCycles: 1,
      },
      failure: {
        rewardTable: [],
        narrative:
          "The caravan is ransacked. Your charter returns with nothing but regret.",
        stressPenalty: 4,
        tokenRefund: 0.25,
      },
    },
  },

  // ── Tier 2 ────────────────────────────────────────────────────────────────
  {
    id: "mine-collapse",
    name: "The Mine Collapse",
    description:
      "A silver mine has partially collapsed with workers still inside. Time and earth pressure work against you. You'll need every able hand your charter can muster.",
    rosterRequirements: {
      minAgents: 6,
      maxAgents: 8,
      roleRequirements: [
        { roleId: "vanguard", count: 1 },
        { roleId: "mender", count: 1 },
      ],
    },
    accessRequirements: {
      orgMilestones: ["merchant-escort-cleared"],
      agentAttunements: [],
      attunementThreshold: null,
    },
    difficultyRating: 32,
    mechanicChecks: [
      {
        id: "mine-breach",
        name: "Breach the Rubble",
        description: "Shift tons of collapsed rock to open a path.",
        attributeWeights: [
          { attributeId: "power", weight: 0.8 },
          { attributeId: "mettle", weight: 0.2 },
        ],
        difficultyThreshold: 9,
        scope: "team_aggregate",
        failureConsequence: { type: "team_damage", severity: 0.4 },
      },
      {
        id: "mine-hold",
        name: "Shore Up the Shaft",
        description: "The Vanguard braces crumbling supports while others work.",
        attributeWeights: [{ attributeId: "mettle", weight: 1.0 }],
        difficultyThreshold: 16,
        scope: "role_specific",
        failureConsequence: { type: "cascade", severity: 0.6 },
      },
      {
        id: "mine-triage",
        name: "Triage the Wounded",
        description: "The Mender stabilizes injured workers for the long carry out.",
        attributeWeights: [
          { attributeId: "spirit", weight: 0.7 },
          { attributeId: "wits", weight: 0.3 },
        ],
        difficultyThreshold: 16,
        scope: "role_specific",
        failureConsequence: { type: "stress", severity: 0.5 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: null,
    outcomes: {
      success: {
        rewardTable: [{ itemId: "miners-pick", dropRate: 1.0 }],
        narrative:
          "The last survivor emerges blinking into daylight. The mine foreman clasps your hand, wordless with relief.",
        reputationGain: 3,
        currencyReward: 90,
        milestoneFlag: "mine-collapse-cleared",
      },
      partial: {
        rewardTable: [],
        narrative:
          "Most workers are saved. Some shafts remain blocked. The outcome is bittersweet.",
        reputationGain: 1,
        agentDowntimeCycles: 2,
      },
      failure: {
        rewardTable: [],
        narrative:
          "The mine is lost. Your charter retreats from the groaning earth with nothing.",
        stressPenalty: 5,
        tokenRefund: 0.25,
      },
    },
  },

  {
    id: "bandit-camp",
    name: "The Bandit Camp",
    description:
      "A well-organized bandit operation has been raiding farmsteads across the valley. Their camp is fortified and they fight with discipline. Take them down before they melt into the hills.",
    rosterRequirements: {
      minAgents: 6,
      maxAgents: 8,
      roleRequirements: [
        { roleId: "vanguard", count: 1 },
        { roleId: "skirmisher", count: 2 },
        { roleId: "mender", count: 1 },
      ],
    },
    accessRequirements: {
      orgMilestones: ["mine-collapse-cleared"],
      agentAttunements: [],
      attunementThreshold: null,
    },
    difficultyRating: 40,
    mechanicChecks: [
      {
        id: "bandit-breach",
        name: "Breach the Palisade",
        description: "Fight through the outer defenders to reach the camp proper.",
        attributeWeights: [
          { attributeId: "power", weight: 0.6 },
          { attributeId: "mettle", weight: 0.4 },
        ],
        difficultyThreshold: 10,
        scope: "team_aggregate",
        failureConsequence: { type: "agent_damage", severity: 0.5 },
      },
      {
        id: "bandit-pursuit",
        name: "Cut Off the Retreat",
        description: "The Skirmishers run down fleeing bandits before they can warn others.",
        attributeWeights: [
          { attributeId: "power", weight: 0.5 },
          { attributeId: "wits", weight: 0.5 },
        ],
        difficultyThreshold: 18,
        scope: "role_specific",
        failureConsequence: { type: "debuff", severity: 0.3 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: {
      rounds: 8,
      aggregateThreshold: 90,
      attributeId: "power",
    },
    outcomes: {
      success: {
        rewardTable: [{ itemId: "bandit-trophy", dropRate: 1.0 }],
        narrative:
          "The camp falls. Farmers across the valley can breathe again. Word of your charter spreads.",
        reputationGain: 4,
        currencyReward: 120,
        milestoneFlag: "bandit-camp-cleared",
      },
      partial: {
        rewardTable: [],
        narrative:
          "The camp is broken, but the bandit captain escaped. The threat is reduced, not ended.",
        reputationGain: 2,
        agentDowntimeCycles: 2,
      },
      failure: {
        rewardTable: [],
        narrative:
          "The bandits hold their ground. Your charter is forced to withdraw.",
        stressPenalty: 5,
        tokenRefund: 0.25,
      },
    },
  },

  {
    id: "wardens-keep",
    name: "The Warden's Keep",
    description:
      "The old Warden has gone rogue, hoarding the region's tax revenue and fortifying his keep against all comers. The lord has authorized your charter to retake it — with extreme prejudice.",
    rosterRequirements: {
      minAgents: 6,
      maxAgents: 8,
      roleRequirements: [
        { roleId: "vanguard", count: 1 },
        { roleId: "skirmisher", count: 2 },
        { roleId: "mender", count: 2 },
      ],
    },
    accessRequirements: {
      orgMilestones: ["bandit-camp-cleared"],
      agentAttunements: ["veteran-charter"],
      attunementThreshold: null,
    },
    difficultyRating: 55,
    mechanicChecks: [
      {
        id: "keep-gate",
        name: "Breach the Gate",
        description: "Force the keep's reinforced gate under withering arrow fire.",
        attributeWeights: [
          { attributeId: "power", weight: 0.5 },
          { attributeId: "mettle", weight: 0.5 },
        ],
        difficultyThreshold: 11,
        scope: "team_aggregate",
        failureConsequence: { type: "agent_damage", severity: 0.6 },
      },
      {
        id: "keep-hold",
        name: "Hold the Courtyard",
        description: "The Vanguard anchors the courtyard against the Warden's elite guard.",
        attributeWeights: [{ attributeId: "mettle", weight: 1.0 }],
        difficultyThreshold: 20,
        scope: "role_specific",
        failureConsequence: { type: "cascade", severity: 0.7 },
      },
      {
        id: "keep-flanks",
        name: "Clear the Flanks",
        description: "Skirmishers neutralize archers on the battlements.",
        attributeWeights: [
          { attributeId: "power", weight: 0.4 },
          { attributeId: "wits", weight: 0.6 },
        ],
        difficultyThreshold: 20,
        scope: "role_specific",
        failureConsequence: { type: "team_damage", severity: 0.4 },
      },
      {
        id: "keep-sustain",
        name: "Sustain the Assault",
        description: "Menders keep your agents fighting through the grueling siege.",
        attributeWeights: [
          { attributeId: "spirit", weight: 0.8 },
          { attributeId: "wits", weight: 0.2 },
        ],
        difficultyThreshold: 18,
        scope: "role_specific",
        failureConsequence: { type: "stress", severity: 0.6 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: {
      rounds: 12,
      aggregateThreshold: 160,
      attributeId: "power",
    },
    outcomes: {
      success: {
        rewardTable: [{ itemId: "wardens-blade", dropRate: 1.0 }, { itemId: "wardens-seal", dropRate: 1.0 }],
        narrative:
          "The Warden's banner falls. Your charter stands in the courtyard, bloodied but triumphant. The lord sends his thanks — and an invitation to expand your operations.",
        reputationGain: 6,
        currencyReward: 180,
        milestoneFlag: "wardens-keep-cleared",
      },
      partial: {
        rewardTable: [{ itemId: "wardens-seal", dropRate: 1.0 }],
        narrative:
          "The keep falls, but the cost is steep. Several agents will need time to recover.",
        reputationGain: 3,
        agentDowntimeCycles: 3,
      },
      failure: {
        rewardTable: [],
        narrative:
          "The keep holds. Your charter retreats to regroup. The Warden's walls have not yet been broken.",
        stressPenalty: 6,
        tokenRefund: 0.25,
      },
    },
  },
];

// ── Progression Tiers ─────────────────────────────────────────────────────────

const PROGRESSION_TIERS: ProgressionTier[] = [
  {
    id: "tier-1",
    name: "Proving Grounds",
    flavorText:
      "Every charter starts here. Three contracts to prove your agents can follow orders, hold a line, and bring someone home alive.",
    unlockConditions: {
      orgMilestones: [],
      reputationMinimum: null,
    },
    challenges: ["cellar", "bridge-troll", "merchant-escort"],
    requiredChallenges: ["cellar", "bridge-troll", "merchant-escort"],
    optionalChallenges: [],
  },
  {
    id: "tier-2",
    name: "The Contract",
    flavorText:
      "You've proven you can do the work. Now comes the real test: harder contracts, deeper stakes, and a keep that won't fall without a fight.",
    unlockConditions: {
      orgMilestones: ["merchant-escort-cleared"],
      reputationMinimum: 5,
    },
    challenges: ["mine-collapse", "bandit-camp", "wardens-keep"],
    requiredChallenges: ["mine-collapse", "bandit-camp", "wardens-keep"],
    optionalChallenges: [],
  },
];

// ── Attunement Chains ─────────────────────────────────────────────────────────

const ATTUNEMENT_CHAINS: AttunementChain[] = [
  {
    id: "veteran-charter",
    name: "Veteran of the Charter",
    steps: [
      { type: "challenge_clear", target: "merchant-escort" },
    ],
    grantsAccessTo: ["mine-collapse"],
  },
];

// ── Narrative Events ──────────────────────────────────────────────────────────

const NARRATIVE_EVENTS: NarrativeEvent[] = [
  {
    trigger: { type: "first_clear", target: "cellar" },
    title: "The Charter Begins",
    text: "Your agents return from the cellar, grinning. A small job, yes — but yours. The First Charter is open for business.",
    rewards: [],
    agentUnlock: null,
  },
  {
    trigger: { type: "tier_complete", target: "tier-1" },
    title: "Proving Grounds Complete",
    text: "Three contracts cleared. Word has reached the capital that a new charter is making waves in the provinces. The harder work is about to begin.",
    rewards: [],
    agentUnlock: null,
  },
  {
    trigger: { type: "first_clear", target: "wardens-keep" },
    title: "The Keep Falls — Production Unlocked",
    text: "The Warden's keep is yours. Among the seized assets: a functional forge and supply depot. Your charter now has the infrastructure to produce its own equipment. The Production facility is now available for upgrade.",
    rewards: ["wardens-blade"],
    agentUnlock: null,
  },
  {
    trigger: { type: "arc_complete", target: "first-charter" },
    title: "The First Charter Fulfilled",
    text: "You have cleared every contract of the First Charter. Your guild's founding story is written in victories across the province. The arc selection screen beckons — which chapter comes next?",
    rewards: [],
    agentUnlock: null,
  },
];

// ── Arc Definition ────────────────────────────────────────────────────────────

export const FIRST_CHARTER: Arc = {
  meta: {
    id: "first-charter",
    name: "The First Charter",
    description:
      "Your guild's founding contract. Six challenges across two tiers introduce every core system: assignment, role composition, reward decisions, drama resolution, recruitment, attunement, and infrastructure. Complete the Warden's Keep to earn your place among the province's recognized guilds.",
    author: "axm-arc team",
    version: "1.0.0",
    engineVersion: "1.0.0",
    domain: "fantasy",
    estimatedCycles: 10,
  },
  attributes: [...ATTRIBUTES],
  roles: [...ROLES],
  tiers: [...TIERS],
  currencyName: "Gold",
  materialName: "Supplies",
  tokenName: "Contracts",
  reputationName: "Charter Renown",
  tokensPerCycle: 2,
  maxTokens: 4,
  infrastructureTokenBonus: 0.25,
  namePool: NAME_POOL,
  customTraits: [],
  progressionTiers: [...PROGRESSION_TIERS],
  attunementChains: [...ATTUNEMENT_CHAINS],
  challenges: [...CHALLENGES],
  difficultyModes: [],
  items: [...ITEMS],
  narrativeEvents: [...NARRATIVE_EVENTS],
  scaling: { type: "fixed", scalingRules: {} },
};
