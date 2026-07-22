import type {
  Arc,
  ArcAttribute,
  ArcRole,
  ArcTier,
  AttunementChain,
  Challenge,
  DifficultyMode,
  Item,
  NarrativeEvent,
  ProgressionTier,
} from "../engine/types.js";

// The Waking Tower retains the historical cartridge id `karazhan` so existing
// held runs and imported revisions remain addressable. All player-facing names,
// fiction, and artwork are original. It is deliberately NOT a reskin of The
// First Charter: five attributes, a raid-trinity-plus-support role grammar,
// rank-pip tiers, wing progression, live attunement chains, and a heroic mode.
// Encounter ids are also retained as compatibility keys; presentation always
// uses the authored display names below.

// ── Attributes (asset sheet §3) ───────────────────────────────────────────────

const ATTRIBUTES: ArcAttribute[] = [
  { id: "power", name: "Power", description: "Raw damage output, martial or arcane." },
  { id: "resilience", name: "Resilience", description: "The capacity to absorb punishment and stay standing." },
  { id: "precision", name: "Precision", description: "Accuracy, timing, and clean execution under pressure." },
  { id: "adaptability", name: "Adaptability", description: "Reading a changing fight and moving before it punishes you." },
  { id: "focus", name: "Focus", description: "Sustained concentration — channeling, healing, holding a rotation." },
];

// ── Roles (asset sheet §2) ────────────────────────────────────────────────────

const ROLES: ArcRole[] = [
  { id: "tank", name: "Tank", attributeWeights: { resilience: 0.6, power: 0.2, adaptability: 0.1, focus: 0.1 } },
  { id: "healer", name: "Healer", attributeWeights: { focus: 0.6, adaptability: 0.2, resilience: 0.1, precision: 0.1 } },
  { id: "melee", name: "Melee", attributeWeights: { power: 0.6, precision: 0.3, adaptability: 0.1 } },
  { id: "ranged", name: "Ranged", attributeWeights: { precision: 0.6, focus: 0.3, adaptability: 0.1 } },
  { id: "support", name: "Support", attributeWeights: { adaptability: 0.5, focus: 0.3, precision: 0.2 } },
];

// ── Tiers (asset sheet §5 rank pips) ─────────────────────────────────────────
// Budgets assume 5 attributes (First Charter's assume 4) — same per-attribute
// averages: recruit ~6.5, veteran ~10, champion ~14.

const TIERS: ArcTier[] = [
  { id: "recruit", name: "Recruit", statBudgetMin: 25, statBudgetMax: 40, upkeepCost: 1, baseEfficiencyModifier: 1.5 },
  { id: "member", name: "Member", statBudgetMin: 33, statBudgetMax: 48, upkeepCost: 2, baseEfficiencyModifier: 1.2 },
  { id: "veteran", name: "Veteran", statBudgetMin: 42, statBudgetMax: 58, upkeepCost: 3, baseEfficiencyModifier: 1.0 },
  { id: "elite", name: "Elite", statBudgetMin: 52, statBudgetMax: 68, upkeepCost: 5, baseEfficiencyModifier: 0.7 },
  { id: "champion", name: "Champion", statBudgetMin: 62, statBudgetMax: 80, upkeepCost: 7, baseEfficiencyModifier: 0.5 },
];

// ── Name Pool ─────────────────────────────────────────────────────────────────

const NAME_POOL = {
  firstNames: [
    "Alaric", "Berenice", "Caedmon", "Delphine", "Emrys",
    "Fenella", "Gideon", "Hesper", "Ignatia", "Jorai",
    "Kestrel", "Lucan", "Morwenna", "Nazaire", "Ottoline",
  ],
  lastNames: [
    "Ashvane", "Blackwald", "Craven", "Duskwhisper", "Everlorn",
    "Fellgate", "Gravenholt", "Hollowspire", "Ilvermorn", "Violette",
  ],
};

// ── Items (asset sheet §4 classes: weapon / armor / trinket / key / loot) ────

const ITEMS: Item[] = [
  {
    id: "spectral-bridle",
    name: "Spectral Bridle",
    slot: "weapon",
    statBonuses: { power: 2 },
    tierRequirement: "recruit",
    flavorText: "Still warm from a horse that has been dead for decades.",
  },
  {
    id: "moroes-pocket-watch",
    name: "Last Steward's Pocket Watch",
    slot: "trinket",
    statBonuses: { adaptability: 2 },
    tierRequirement: "recruit",
    flavorText: "It keeps perfect time. The dinner guests were never late.",
  },
  {
    id: "chained-holy-sigil",
    name: "Chained Holy Sigil",
    slot: "trinket",
    statBonuses: { focus: 2, resilience: 1 },
    tierRequirement: "member",
    flavorText: "Sanctity, repurposed. The chains were hers; now they hold your nerve steady.",
  },
  {
    id: "twin-theater-masks",
    name: "Twin Theater Masks",
    slot: "trinket",
    statBonuses: { adaptability: 3 },
    tierRequirement: "member",
    flavorText: "Comedy on one face, tragedy on the other. The Night Stage never plays the same show twice.",
  },
  {
    id: "orrery-core",
    name: "Orrery Core",
    slot: "trinket",
    statBonuses: { precision: 3, focus: 1 },
    tierRequirement: "veteran",
    flavorText: "The Orrery Warden's heart: a public model of the heavens, still ticking after its keeper forgot the sky.",
  },
  {
    id: "construct-plating",
    name: "Construct Plating",
    slot: "chest",
    statBonuses: { resilience: 3 },
    tierRequirement: "veteran",
    flavorText: "Orrery-gallery armor. It has already survived one surveyor's fall.",
  },
  {
    id: "demon-chain-links",
    name: "Rift Chain Links",
    slot: "chest",
    statBonuses: { resilience: 2, power: 1 },
    tierRequirement: "veteran",
    flavorText: "Cinderling wore them first. They fit better on the willing.",
  },
  {
    id: "runed-focus",
    name: "Runed Focus",
    slot: "weapon",
    statBonuses: { precision: 3, focus: 2 },
    tierRequirement: "veteran",
    flavorText: "Ember Tutor's off-center star, ground into a lens. Do not move while it settles.",
  },
  {
    id: "kings-gambit",
    name: "King's Gambit",
    slot: "trinket",
    statBonuses: { adaptability: 2, precision: 2 },
    tierRequirement: "veteran",
    flavorText: "A knight from the enchanted board. It remembers every game ever lost on it.",
  },
  {
    id: "portal-shard",
    name: "Portal Shard",
    slot: "trinket",
    statBonuses: { focus: 3, adaptability: 2 },
    tierRequirement: "veteran",
    flavorText: "A splinter of one of the three beams. It hums when you stand where you shouldn't.",
  },
  {
    id: "infernal-spike",
    name: "Cinder Spike",
    slot: "weapon",
    statBonuses: { power: 4, precision: 2 },
    tierRequirement: "veteran",
    flavorText: "Snapped from the Cinder Prince's tilted crown. Still smoldering.",
  },
  {
    id: "blackened-urn",
    name: "The Bell-Blackened Urn",
    slot: "key",
    statBonuses: { focus: 1 },
    tierRequirement: "veteran",
    flavorText: "Ash of a dragon that is not finished dying. Ring the balcony bell and see.",
  },
  {
    id: "dragonbone-greaves",
    name: "Wyrmbone Greaves",
    slot: "legs",
    statBonuses: { resilience: 4, power: 1 },
    tierRequirement: "veteran",
    flavorText: "Carved from The Bell-Woken Wyrm's own remains. He will not need them twice.",
  },
  {
    id: "ogre-warlord-totem",
    name: "Council War Totem",
    slot: "trinket",
    statBonuses: { power: 3, resilience: 2 },
    tierRequirement: "veteran",
    flavorText: "The Fivefold King's council is dead. Their authority travels light.",
  },
  {
    id: "shattered-mountain-core",
    name: "Shattered Mountain Core",
    slot: "trinket",
    statBonuses: { power: 4, resilience: 2 },
    tierRequirement: "veteran",
    flavorText: "Growing Titan grew until the cave could not hold him. This is what was left of the cave.",
  },
  {
    id: "fel-manacle",
    name: "Furnace Manacle",
    slot: "trinket",
    statBonuses: { focus: 4, adaptability: 2 },
    tierRequirement: "veteran",
    flavorText: "One of the five that held the Bound Furnace. Broken open, still binding.",
  },
];

// ── Challenges (asset sheet §1 — encounter ids are the sheet's working ids) ──

const CHALLENGES: Challenge[] = [
  // ── Wing 1: The Servants' Quarters ─────────────────────────────────────────
  {
    id: "attumen",
    name: "The Ashen Huntsman",
    description:
      "The stables never emptied; the huntsman never dismounted. Break the spectral rider and his steed before the rest of the tower learns you are here.",
    rosterRequirements: { minAgents: 6, maxAgents: 10, roleRequirements: [{ roleId: "tank", count: 1 }] },
    accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
    difficultyRating: 20,
    mechanicChecks: [
      {
        id: "attumen-charge",
        name: "Intercept the Charge",
        description: "The tank must catch Gloamhoof's charge before it scatters the back line.",
        attributeWeights: [{ attributeId: "resilience", weight: 0.8 }, { attributeId: "adaptability", weight: 0.2 }],
        difficultyThreshold: 12,
        scope: "role_specific",
        roleIds: ["tank"],
        failureConsequence: { type: "agent_damage", severity: 0.4 },
      },
      {
        id: "attumen-sweep",
        name: "Clear the Stables",
        description: "Cut down horse and huntsman together — separated, they enrage.",
        attributeWeights: [{ attributeId: "power", weight: 0.7 }, { attributeId: "precision", weight: 0.3 }],
        difficultyThreshold: 7,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "team_damage", severity: 0.2 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: null,
    outcomes: {
      success: {
        rewardTable: [{ itemId: "spectral-bridle", dropRate: 1.0 }],
        narrative: "The huntsman falls from a horse that no longer exists. The stables go quiet for the first time in years.",
        reputationGain: 2,
        currencyReward: 60,
        milestoneFlag: "attumen-cleared",
      },
      partial: {
        rewardTable: [],
        narrative: "Rider and steed retreat into the mist between the stalls. The stables are passable — barely.",
        agentDowntimeCycles: 1,
      },
      failure: {
        rewardTable: [],
        narrative: "Gloamhoof's charge breaks your line. The tower's first door stays shut.",
        stressPenalty: 2,
        tokenRefund: 0.5,
      },
    },
  },

  {
    id: "moroes",
    name: "The Last Steward",
    description:
      "The steward still keeps the surveyor's table, and the guest circle does not appreciate interruptions. Someone will be caught in a silk noose. Plan for it.",
    rosterRequirements: { minAgents: 6, maxAgents: 10, roleRequirements: [{ roleId: "tank", count: 1 }, { roleId: "healer", count: 1 }] },
    accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
    difficultyRating: 25,
    mechanicChecks: [
      {
        id: "moroes-garrote",
        name: "Cut the Silk Noose",
        description: "Healers keep the marked raider alive while the silk noose tightens — it cannot be cut from inside the circle.",
        attributeWeights: [{ attributeId: "focus", weight: 0.8 }, { attributeId: "adaptability", weight: 0.2 }],
        difficultyThreshold: 13,
        scope: "role_specific",
        roleIds: ["healer"],
        failureConsequence: { type: "agent_damage", severity: 0.5 },
      },
      {
        id: "moroes-guests",
        name: "Manage the Dinner Guests",
        description: "Four uninvited problems, controlled and cut down in the right order.",
        attributeWeights: [{ attributeId: "precision", weight: 0.5 }, { attributeId: "power", weight: 0.5 }],
        difficultyThreshold: 7,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "team_damage", severity: 0.3 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: null,
    outcomes: {
      success: {
        rewardTable: [{ itemId: "moroes-pocket-watch", dropRate: 1.0 }],
        narrative: "The steward bows as he dies, apologetic to the last. Dinner is cancelled indefinitely.",
        reputationGain: 2,
        currencyReward: 70,
        milestoneFlag: "moroes-cleared",
      },
      partial: {
        rewardTable: [],
        narrative: "The Last Steward falls but his guests fight on. Your raiders limp out through the servant's passage.",
        agentDowntimeCycles: 1,
      },
      failure: {
        rewardTable: [],
        narrative: "The silk nooses tighten faster than your healers can answer. The banquet hall holds.",
        stressPenalty: 3,
        tokenRefund: 0.5,
      },
    },
  },

  {
    id: "maiden",
    name: "The Chained Saint",
    description:
      "She was built to enforce a vanished creed, and your raid qualifies as an exception. Survive her litany and the tower's lower halls are yours.",
    rosterRequirements: { minAgents: 6, maxAgents: 10, roleRequirements: [{ roleId: "healer", count: 1 }] },
    accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
    difficultyRating: 28,
    mechanicChecks: [
      {
        id: "maiden-ground",
        name: "Holy Ground",
        description: "Everyone endures the consecration — there is nowhere clean to stand.",
        attributeWeights: [{ attributeId: "resilience", weight: 1.0 }],
        difficultyThreshold: 7,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "stress", severity: 0.3 },
      },
      {
        id: "maiden-repentance",
        name: "Wake from the Litany",
        description: "When the whole raid drops to its knees, the healers must be the first ones up.",
        attributeWeights: [{ attributeId: "focus", weight: 0.7 }, { attributeId: "adaptability", weight: 0.3 }],
        difficultyThreshold: 14,
        scope: "role_specific",
        roleIds: ["healer"],
        failureConsequence: { type: "team_damage", severity: 0.4 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: null,
    outcomes: {
      success: {
        rewardTable: [{ itemId: "chained-holy-sigil", dropRate: 1.0 }],
        narrative: "The Chained Saint's light gutters out. Whatever she was holding below the chapel is loose upstairs — and so are you.",
        reputationGain: 3,
        currencyReward: 80,
        milestoneFlag: "maiden-cleared",
      },
      partial: {
        rewardTable: [],
        narrative: "She falls, but her last litany leaves half the raid on the chapel floor.",
        agentDowntimeCycles: 2,
      },
      failure: {
        rewardTable: [],
        narrative: "Holy fire fills the chapel. Your raiders carry each other out.",
        stressPenalty: 3,
        tokenRefund: 0.5,
      },
    },
  },

  // ── Wing 2: The Night Stage & the Orrery Galleries ───────────────────────────────
  {
    id: "opera",
    name: "The Night Stage",
    description:
      "The curtain rises on a show no one chose. Wolf, wizard, or romance — the script changes nightly and the audience does not accept refunds.",
    rosterRequirements: { minAgents: 6, maxAgents: 10, roleRequirements: [{ roleId: "support", count: 1 }] },
    accessRequirements: { orgMilestones: ["moroes-cleared"], agentAttunements: [], attunementThreshold: null },
    difficultyRating: 32,
    mechanicChecks: [
      {
        id: "opera-script",
        name: "Rewrite the Living Script",
        description: "Nobody knows which show it is until the curtain is up. Everyone adapts, immediately.",
        attributeWeights: [{ attributeId: "adaptability", weight: 0.8 }, { attributeId: "precision", weight: 0.2 }],
        difficultyThreshold: 8,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "team_damage", severity: 0.3 },
      },
      {
        id: "opera-stage",
        name: "Survive the Turning Stage",
        description: "Support calls the mechanics as they come — curtains, cyclones, moonlight.",
        attributeWeights: [{ attributeId: "adaptability", weight: 0.6 }, { attributeId: "focus", weight: 0.4 }],
        difficultyThreshold: 12,
        scope: "role_specific",
        roleIds: ["support"],
        failureConsequence: { type: "stress", severity: 0.4 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: null,
    outcomes: {
      success: {
        rewardTable: [{ itemId: "twin-theater-masks", dropRate: 1.0 }],
        narrative: "The audience of ghosts rises for a standing ovation. The stage door to the back halls swings open.",
        reputationGain: 3,
        currencyReward: 90,
        milestoneFlag: "opera-cleared",
      },
      partial: {
        rewardTable: [],
        narrative: "The show ends early, messily. The critics — undead, all of them — are unkind.",
        agentDowntimeCycles: 1,
      },
      failure: {
        rewardTable: [],
        narrative: "Wrong script, wrong positions, wrong night. The curtain falls on your raid.",
        stressPenalty: 3,
        tokenRefund: 0.5,
      },
    },
  },

  {
    id: "curator",
    name: "The Orrery Warden",
    description:
      "The Orrery Galleries' warden channels the tower's star-grid through its own chassis. Break its recharge cycle or be worn down by an endless gallery of star motes.",
    rosterRequirements: { minAgents: 7, maxAgents: 10, roleRequirements: [{ roleId: "tank", count: 1 }, { roleId: "ranged", count: 1 }] },
    accessRequirements: { orgMilestones: ["opera-cleared"], agentAttunements: [], attunementThreshold: 0.5 },
    difficultyRating: 38,
    mechanicChecks: [
      {
        id: "curator-evocation",
        name: "Break the Orrery Cycle",
        description: "Twenty seconds of double damage. Miss the window and the fight does not end.",
        attributeWeights: [{ attributeId: "power", weight: 0.5 }, { attributeId: "precision", weight: 0.5 }],
        difficultyThreshold: 8,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "team_damage", severity: 0.3 },
      },
      {
        id: "curator-flares",
        name: "Contain the Star Motes",
        description: "Ranged destroy each star mote the moment it forms, before it reaches the healers.",
        attributeWeights: [{ attributeId: "precision", weight: 0.8 }, { attributeId: "focus", weight: 0.2 }],
        difficultyThreshold: 14,
        scope: "role_specific",
        roleIds: ["ranged"],
        failureConsequence: { type: "agent_damage", severity: 0.4 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: { rounds: 10, aggregateThreshold: 120, attributeId: "precision" },
    outcomes: {
      success: {
        rewardTable: [{ itemId: "orrery-core", dropRate: 1.0 }, { itemId: "construct-plating", dropRate: 0.5 }],
        narrative: "The Orrery Warden's chassis vents its last charge. Behind it, the stair to the upper tower stands unguarded.",
        reputationGain: 4,
        currencyReward: 110,
        milestoneFlag: "curator-cleared",
      },
      partial: {
        rewardTable: [{ itemId: "construct-plating", dropRate: 1.0 }],
        narrative: "The construct collapses, but its star motes chased your raiders out of the gallery first.",
        reputationGain: 2,
        agentDowntimeCycles: 2,
      },
      failure: {
        rewardTable: [],
        narrative: "Mote after mote after mote. The Orrery Galleries remain closed.",
        stressPenalty: 4,
        tokenRefund: 0.25,
      },
    },
  },

  // ── Wing 3: The Broken Stair ──────────────────────────────────────────────
  {
    id: "chess",
    name: "The Legacy Board",
    description:
      "The Last Surveyor still plays against his own record in the gallery, and the pieces are life-sized. Take the board — by its inherited rules.",
    rosterRequirements: { minAgents: 6, maxAgents: 10, roleRequirements: [{ roleId: "support", count: 1 }] },
    accessRequirements: { orgMilestones: ["curator-cleared"], agentAttunements: [], attunementThreshold: null },
    difficultyRating: 35,
    mechanicChecks: [
      {
        id: "chess-board",
        name: "Outmaneuver the Legacy Board",
        description: "Every raider pilots a piece. Move like it matters, because it does.",
        attributeWeights: [{ attributeId: "adaptability", weight: 0.7 }, { attributeId: "focus", weight: 0.3 }],
        difficultyThreshold: 8,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "stress", severity: 0.2 },
      },
      {
        id: "chess-king",
        name: "Preserve the Crown Piece",
        description: "Support reads the Legacy's cheating moves and calls the counter before it lands.",
        attributeWeights: [{ attributeId: "adaptability", weight: 0.5 }, { attributeId: "precision", weight: 0.5 }],
        difficultyThreshold: 14,
        scope: "role_specific",
        roleIds: ["support"],
        failureConsequence: { type: "team_damage", severity: 0.3 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: null,
    outcomes: {
      success: {
        rewardTable: [{ itemId: "kings-gambit", dropRate: 1.0 }],
        narrative: "The final crown piece is cornered against the Last Surveyor's echo. The gallery doors unlock themselves in recognition.",
        reputationGain: 3,
        currencyReward: 100,
        milestoneFlag: "chess-cleared",
      },
      partial: {
        rewardTable: [],
        narrative: "The game drags to stalemate. The echo resets the board and waits, patient as only the dead can be.",
        agentDowntimeCycles: 1,
      },
      failure: {
        rewardTable: [],
        narrative: "The Legacy cheats. Your king falls in eleven moves.",
        stressPenalty: 2,
        tokenRefund: 0.5,
      },
    },
  },

  {
    id: "illhoof",
    name: "The Horned Reader",
    description:
      "In a study lined with the wrong kind of books, a satyr feeds the tower's guests to something on the other side. Cut the sacrifices down fast, or join them.",
    rosterRequirements: { minAgents: 7, maxAgents: 10, roleRequirements: [{ roleId: "melee", count: 1 }, { roleId: "healer", count: 1 }] },
    accessRequirements: { orgMilestones: ["curator-cleared"], agentAttunements: [], attunementThreshold: null },
    difficultyRating: 40,
    mechanicChecks: [
      {
        id: "illhoof-sacrifice",
        name: "Break the Sacrifice",
        description: "When the chains take someone, melee severs them before the ritual completes. Every time.",
        attributeWeights: [{ attributeId: "power", weight: 0.6 }, { attributeId: "precision", weight: 0.4 }],
        difficultyThreshold: 15,
        scope: "role_specific",
        roleIds: ["melee"],
        failureConsequence: { type: "agent_damage", severity: 0.6 },
      },
      {
        id: "illhoof-imps",
        name: "Contain the Cinderlings",
        description: "Cinderling's swarm never stops. The raid grinds it down without drowning.",
        attributeWeights: [{ attributeId: "power", weight: 0.8 }, { attributeId: "adaptability", weight: 0.2 }],
        difficultyThreshold: 8,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "team_damage", severity: 0.3 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: null,
    outcomes: {
      success: {
        rewardTable: [{ itemId: "demon-chain-links", dropRate: 1.0 }],
        narrative: "The reading circle gutters out with its keeper. Whatever listened from the other side goes hungry tonight.",
        reputationGain: 4,
        currencyReward: 120,
        milestoneFlag: "illhoof-cleared",
      },
      partial: {
        rewardTable: [],
        narrative: "Horned Reader falls, but not before the circle took its toll from your roster.",
        agentDowntimeCycles: 2,
      },
      failure: {
        rewardTable: [],
        narrative: "The chains find your healers first. The study's library gains a new chapter.",
        stressPenalty: 4,
        tokenRefund: 0.25,
      },
    },
  },

  {
    id: "aran",
    name: "The Ember Tutor",
    description:
      "The Last Surveyor's tutor does not remember dying, only teaching. His lessons are ember ring, whiteout, and furnace pulse — and the penalty for moving during the wrong one is total.",
    rosterRequirements: { minAgents: 7, maxAgents: 10, roleRequirements: [{ roleId: "ranged", count: 1 }] },
    accessRequirements: { orgMilestones: ["curator-cleared"], agentAttunements: [], attunementThreshold: null },
    difficultyRating: 44,
    mechanicChecks: [
      {
        id: "aran-stillness",
        name: "Hold Through the Ember Cant",
        description: "The ember ring is up. Every raider holds position through the instinct to run.",
        attributeWeights: [{ attributeId: "focus", weight: 0.8 }, { attributeId: "resilience", weight: 0.2 }],
        difficultyThreshold: 9,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "team_damage", severity: 0.5 },
      },
      {
        id: "aran-counterspell",
        name: "Interrupt the Tutor's Lesson",
        description: "Ranged interrupt the tutor's casts in rotation — miss two in a row and the whiteout walks the room.",
        attributeWeights: [{ attributeId: "precision", weight: 0.7 }, { attributeId: "focus", weight: 0.3 }],
        difficultyThreshold: 15,
        scope: "role_specific",
        roleIds: ["ranged"],
        failureConsequence: { type: "team_damage", severity: 0.4 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: null,
    outcomes: {
      success: {
        rewardTable: [{ itemId: "runed-focus", dropRate: 1.0 }],
        narrative: "The shade pauses mid-lecture, almost grateful, and lets the room go dark. Class dismissed.",
        reputationGain: 4,
        currencyReward: 130,
        milestoneFlag: "aran-cleared",
      },
      partial: {
        rewardTable: [],
        narrative: "Ember Tutor dissipates, but his last blizzard put half your raid on the infirmary list.",
        agentDowntimeCycles: 2,
      },
      failure: {
        rewardTable: [],
        narrative: "Someone moved. The ember ring explained why that was a mistake.",
        stressPenalty: 4,
        tokenRefund: 0.25,
      },
    },
  },

  // ── Wing 4: The Spire ─────────────────────────────────────────────────────
  {
    id: "netherspite",
    name: "The Rift Wyrm",
    description:
      "A rift dragon feeds on three beams of portal energy, and each beam must be intercepted by exactly the right body. The rotation is the fight.",
    rosterRequirements: { minAgents: 8, maxAgents: 10, roleRequirements: [{ roleId: "tank", count: 1 }, { roleId: "healer", count: 2 }] },
    accessRequirements: { orgMilestones: ["aran-cleared"], agentAttunements: [], attunementThreshold: null },
    difficultyRating: 50,
    mechanicChecks: [
      {
        id: "netherspite-beams",
        name: "Rotate the Rift Lenses",
        description: "Red, green, blue — every beam blocked, every rotation, with debuffs tracked across the whole raid.",
        attributeWeights: [{ attributeId: "adaptability", weight: 0.7 }, { attributeId: "focus", weight: 0.3 }],
        difficultyThreshold: 9,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "team_damage", severity: 0.4 },
      },
      {
        id: "netherspite-banish",
        name: "Cross the Vanishing Interval",
        description: "When the dragon phases out, void zones rain in. Stack, move, breathe, reset.",
        attributeWeights: [{ attributeId: "focus", weight: 0.5 }, { attributeId: "resilience", weight: 0.5 }],
        difficultyThreshold: 8,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "stress", severity: 0.4 },
      },
      {
        id: "netherspite-tank",
        name: "Hold the Rift Breath",
        description: "The tank eats the breath rotation while the red beam burns their mitigation away.",
        attributeWeights: [{ attributeId: "resilience", weight: 0.9 }, { attributeId: "focus", weight: 0.1 }],
        difficultyThreshold: 16,
        scope: "role_specific",
        roleIds: ["tank"],
        failureConsequence: { type: "agent_damage", severity: 0.6 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: null,
    outcomes: {
      success: {
        rewardTable: [{ itemId: "portal-shard", dropRate: 1.0 }],
        narrative: "Starved of all three beams at once, the dragon collapses into the portal that fed it.",
        reputationGain: 5,
        currencyReward: 150,
        milestoneFlag: "netherspite-cleared",
      },
      partial: {
        rewardTable: [],
        narrative: "The Rift Wyrm retreats through its portal, gorged but wounded. The beams dim.",
        reputationGain: 2,
        agentDowntimeCycles: 2,
      },
      failure: {
        rewardTable: [],
        narrative: "One missed beam, and the dragon drinks its fill. The spire shakes with its satisfaction.",
        stressPenalty: 5,
        tokenRefund: 0.25,
      },
    },
  },

  {
    id: "prince",
    name: "The Cinder Prince",
    description:
      "At the top of the tower, a riftborn prince tosses cinder stars like dice and holds all the aces. The roof is small, the fire is not, and the hollowing mark does not care who you were.",
    rosterRequirements: { minAgents: 8, maxAgents: 10, roleRequirements: [{ roleId: "tank", count: 1 }, { roleId: "healer", count: 2 }] },
    accessRequirements: { orgMilestones: ["aran-cleared"], agentAttunements: [], attunementThreshold: null },
    difficultyRating: 55,
    mechanicChecks: [
      {
        id: "prince-enfeeble",
        name: "Space the Hollowing Mark",
        description: "Five raiders at one health, every thirty seconds. Spacing is the only mitigation.",
        attributeWeights: [{ attributeId: "focus", weight: 0.5 }, { attributeId: "adaptability", weight: 0.5 }],
        difficultyThreshold: 9,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "team_damage", severity: 0.5 },
      },
      {
        id: "prince-infernals",
        name: "Cinderfall Weather",
        description: "The roof fills with falling cinder stars. The raid repositions around each impact — mid-fight, every time.",
        attributeWeights: [{ attributeId: "adaptability", weight: 0.8 }, { attributeId: "precision", weight: 0.2 }],
        difficultyThreshold: 9,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "team_damage", severity: 0.4 },
      },
      {
        id: "prince-nova",
        name: "Survive the Crown Burst",
        description: "Healers cover the hollow-marked through each crown burst, phase after phase.",
        attributeWeights: [{ attributeId: "focus", weight: 0.8 }, { attributeId: "adaptability", weight: 0.2 }],
        difficultyThreshold: 17,
        scope: "role_specific",
        roleIds: ["healer"],
        failureConsequence: { type: "agent_damage", severity: 0.6 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: { rounds: 12, aggregateThreshold: 150, attributeId: "power" },
    outcomes: {
      success: {
        rewardTable: [{ itemId: "infernal-spike", dropRate: 1.0 }, { itemId: "blackened-urn", dropRate: 1.0 }],
        narrative: "The prince falls among his own cinder stars, crown tilted, hands finally empty. In the wreckage: a bell-blackened urn, cold and heavy.",
        reputationGain: 6,
        currencyReward: 170,
        milestoneFlag: "prince-cleared",
      },
      partial: {
        rewardTable: [{ itemId: "infernal-spike", dropRate: 0.5 }],
        narrative: "The Cinder Prince staggers back through his summoning rift. The roof is yours; the prince is not.",
        reputationGain: 3,
        agentDowntimeCycles: 3,
      },
      failure: {
        rewardTable: [],
        narrative: "A cinderfall mass lands on the healers during the hollowing mark. The rest is arithmetic.",
        stressPenalty: 5,
        tokenRefund: 0.25,
      },
    },
  },

  {
    id: "nightbane",
    name: "The Bell-Woken Wyrm",
    description:
      "Ring the bell on the surveyor's balcony and the urn's owner answers: a skeletal wyrm that was promised rest and got you instead. Summoned adversaries do not forgive.",
    rosterRequirements: { minAgents: 8, maxAgents: 10, roleRequirements: [{ roleId: "tank", count: 1 }, { roleId: "healer", count: 2 }] },
    accessRequirements: { orgMilestones: ["prince-cleared"], agentAttunements: [], attunementThreshold: 0.1 },
    difficultyRating: 58,
    mechanicChecks: [
      {
        id: "nightbane-smolder",
        name: "Bellfire Breath",
        description: "The tank holds a dragon that ignites the ground it stands on.",
        attributeWeights: [{ attributeId: "resilience", weight: 0.9 }, { attributeId: "adaptability", weight: 0.1 }],
        difficultyThreshold: 18,
        scope: "role_specific",
        roleIds: ["tank"],
        failureConsequence: { type: "agent_damage", severity: 0.7 },
      },
      {
        id: "nightbane-bones",
        name: "Bonefall",
        description: "Air phase: skeletons pour down while the dragon strafes. Burn them before it lands.",
        attributeWeights: [{ attributeId: "power", weight: 0.7 }, { attributeId: "precision", weight: 0.3 }],
        difficultyThreshold: 9,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "team_damage", severity: 0.4 },
      },
      {
        id: "nightbane-earth",
        name: "Wakefire Ground",
        description: "The balcony shrinks as the ground burns. Everyone tracks the safe squares.",
        attributeWeights: [{ attributeId: "adaptability", weight: 0.8 }, { attributeId: "focus", weight: 0.2 }],
        difficultyThreshold: 9,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "stress", severity: 0.4 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: null,
    outcomes: {
      success: {
        rewardTable: [{ itemId: "dragonbone-greaves", dropRate: 1.0 }],
        narrative: "The Bell-Woken Wyrm crashes through the balcony rail and does not rise. This time, the rest is real.",
        reputationGain: 6,
        currencyReward: 190,
        milestoneFlag: "nightbane-cleared",
      },
      partial: {
        rewardTable: [],
        narrative: "The dragon returns to ash before the ash returns to dragon. Call it a draw.",
        reputationGain: 3,
        agentDowntimeCycles: 3,
      },
      failure: {
        rewardTable: [],
        narrative: "The wakefire closes like a fist. The urn sits on the balcony, ready to be rung again — braver, next time.",
        stressPenalty: 5,
        tokenRefund: 0.25,
      },
    },
  },

  // ── Wing 5: Beyond the Tower ──────────────────────────────────────────────
  {
    id: "maulgar",
    name: "The Fivefold King",
    description:
      "Beyond the tower, the giant council of Stonewake Lair: five targets, five simultaneous problems, one pull. The tower taught you rotations — this is the exam.",
    rosterRequirements: { minAgents: 8, maxAgents: 10, roleRequirements: [{ roleId: "tank", count: 2 }, { roleId: "healer", count: 2 }] },
    accessRequirements: { orgMilestones: ["prince-cleared"], agentAttunements: [], attunementThreshold: null },
    difficultyRating: 60,
    mechanicChecks: [
      {
        id: "maulgar-council",
        name: "Divide the Fivefold Court",
        description: "Five bosses claimed in the opening seconds, each by the right group, or the pull collapses.",
        attributeWeights: [{ attributeId: "adaptability", weight: 0.6 }, { attributeId: "precision", weight: 0.4 }],
        difficultyThreshold: 9,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "team_damage", severity: 0.5 },
      },
      {
        id: "maulgar-tanks",
        name: "Hold the Twin Thrones",
        description: "Both tanks anchor separate kill orders — the Fivefold King and the seer line.",
        attributeWeights: [{ attributeId: "resilience", weight: 0.8 }, { attributeId: "power", weight: 0.2 }],
        difficultyThreshold: 16,
        scope: "role_specific",
        roleIds: ["tank"],
        failureConsequence: { type: "agent_damage", severity: 0.6 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: null,
    outcomes: {
      success: {
        rewardTable: [{ itemId: "ogre-warlord-totem", dropRate: 1.0 }],
        narrative: "The Fivefold King dies last, bellowing at a council that can no longer hear him.",
        reputationGain: 7,
        currencyReward: 220,
        milestoneFlag: "maulgar-cleared",
      },
      partial: {
        rewardTable: [],
        narrative: "Three of five councilors fall before the retreat is called. The lair remembers you.",
        reputationGain: 3,
        agentDowntimeCycles: 3,
      },
      failure: {
        rewardTable: [],
        narrative: "The opening split fails, and five problems become one massacre.",
        stressPenalty: 6,
        tokenRefund: 0.25,
      },
    },
  },

  {
    id: "gruul",
    name: "The Growing Titan",
    description:
      "He killed dragons for sport and grows stronger every second the fight lasts. There is a timer on this one, and it is made of his patience.",
    rosterRequirements: { minAgents: 8, maxAgents: 10, roleRequirements: [{ roleId: "tank", count: 1 }, { roleId: "healer", count: 2 }] },
    accessRequirements: { orgMilestones: ["maulgar-cleared"], agentAttunements: [], attunementThreshold: null },
    difficultyRating: 65,
    mechanicChecks: [
      {
        id: "gruul-grow",
        name: "Outpace the Titan's Growth",
        description: "Every wave of growth makes him hit harder. Kill him before the math turns.",
        attributeWeights: [{ attributeId: "power", weight: 0.8 }, { attributeId: "precision", weight: 0.2 }],
        difficultyThreshold: 10,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "team_damage", severity: 0.5 },
      },
      {
        id: "gruul-shatter",
        name: "Break the Stone Echo",
        description: "Ground slam freezes the raid; shatter punishes anyone standing together. Spread while petrified — plan it before.",
        attributeWeights: [{ attributeId: "adaptability", weight: 0.9 }, { attributeId: "focus", weight: 0.1 }],
        difficultyThreshold: 9,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "team_damage", severity: 0.5 },
      },
      {
        id: "gruul-hurtful",
        name: "Catch the Crushing Blow",
        description: "The tank line absorbs strikes that would delete anyone else.",
        attributeWeights: [{ attributeId: "resilience", weight: 1.0 }],
        difficultyThreshold: 18,
        scope: "role_specific",
        roleIds: ["tank"],
        failureConsequence: { type: "agent_damage", severity: 0.7 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: { rounds: 10, aggregateThreshold: 140, attributeId: "power" },
    outcomes: {
      success: {
        rewardTable: [{ itemId: "shattered-mountain-core", dropRate: 1.0 }],
        narrative: "Growing Titan falls while still growing, and the mountain shakes twice — once for the impact, once in relief.",
        reputationGain: 8,
        currencyReward: 260,
        milestoneFlag: "gruul-cleared",
      },
      partial: {
        rewardTable: [],
        narrative: "He was two growths from unkillable when the retreat sounded. The lair's floor keeps your dead's names.",
        reputationGain: 3,
        agentDowntimeCycles: 3,
      },
      failure: {
        rewardTable: [],
        narrative: "The growth outpaces your burn. Shatter finishes the sentence.",
        stressPenalty: 6,
        tokenRefund: 0.25,
      },
    },
  },

  {
    id: "magtheridon",
    name: "The Bound Furnace",
    description:
      "Beneath the Furnace Vault, the Bound Furnace strains against five iron manacles. The furnace choir keeping it bound is the fight; the moment its last voice breaks, so does the order of the room. Do not confuse the sequence.",
    rosterRequirements: { minAgents: 8, maxAgents: 10, roleRequirements: [{ roleId: "tank", count: 1 }, { roleId: "healer", count: 2 }, { roleId: "support", count: 1 }] },
    accessRequirements: { orgMilestones: ["gruul-cleared"], agentAttunements: [], attunementThreshold: null },
    difficultyRating: 70,
    mechanicChecks: [
      {
        id: "magtheridon-cubes",
        name: "Manacle Discipline",
        description: "Five manacles, struck in perfect unison to interrupt the furnace wave. Support owns the count.",
        attributeWeights: [{ attributeId: "adaptability", weight: 0.5 }, { attributeId: "focus", weight: 0.5 }],
        difficultyThreshold: 15,
        scope: "role_specific",
        roleIds: ["support"],
        failureConsequence: { type: "team_damage", severity: 0.6 },
      },
      {
        id: "magtheridon-channelers",
        name: "Break the Furnace Choir",
        description: "Five binders fall together, or the Furnace rises angry and early.",
        attributeWeights: [{ attributeId: "power", weight: 0.7 }, { attributeId: "precision", weight: 0.3 }],
        difficultyThreshold: 9,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "team_damage", severity: 0.5 },
      },
      {
        id: "magtheridon-quake",
        name: "Endure the Chamber Quakes",
        description: "The chamber collapses in stages. Everyone survives the ceiling as well as the Bound Furnace.",
        attributeWeights: [{ attributeId: "resilience", weight: 0.7 }, { attributeId: "adaptability", weight: 0.3 }],
        difficultyThreshold: 9,
        thresholdMode: "perAssignedAgent",
        scope: "team_aggregate",
        failureConsequence: { type: "stress", severity: 0.5 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: { rounds: 12, aggregateThreshold: 160, attributeId: "power" },
    outcomes: {
      success: {
        rewardTable: [{ itemId: "fel-manacle", dropRate: 1.0 }],
        narrative: "The last manacle snaps shut around nothing. The Bound Furnace is finally, entirely still — and your roster has run out of tower.",
        reputationGain: 10,
        currencyReward: 320,
        milestoneFlag: "magtheridon-cleared",
      },
      partial: {
        rewardTable: [],
        narrative: "The Bound Furnace slumps back into its bonds, diminished. The vault above still stands.",
        reputationGain: 4,
        agentDowntimeCycles: 3,
      },
      failure: {
        rewardTable: [],
        narrative: "One manacle sounded late. The furnace wave writes the raid report for you.",
        stressPenalty: 6,
        tokenRefund: 0.25,
      },
    },
  },
];

// ── Progression Tiers (wings) ─────────────────────────────────────────────────

const PROGRESSION_TIERS: ProgressionTier[] = [
  {
    id: "wing-1",
    name: "The Servants' Quarters",
    flavorText: "Stables, banquet hall, chapel. The tower's staff still keep their posts, and their posts keep them.",
    unlockConditions: { orgMilestones: [], reputationMinimum: null },
    challenges: ["attumen", "moroes", "maiden"],
    requiredChallenges: ["attumen", "moroes"],
    optionalChallenges: ["maiden"],
  },
  {
    id: "wing-2",
    name: "The Night Stage & the Orrery Galleries",
    flavorText: "The guests came for a show. The Orrery Warden has kept the exhibits fed ever since.",
    unlockConditions: { orgMilestones: ["moroes-cleared"], reputationMinimum: 4 },
    challenges: ["opera", "curator"],
    requiredChallenges: ["curator"],
    optionalChallenges: ["opera"],
  },
  {
    id: "wing-3",
    name: "The Broken Stair",
    flavorText: "Libraries, galleries, a legacy board that plays back. The Last Surveyor's private floors do not welcome students.",
    unlockConditions: { orgMilestones: ["curator-cleared"], reputationMinimum: 10 },
    challenges: ["chess", "illhoof", "aran"],
    requiredChallenges: ["aran"],
    optionalChallenges: ["chess", "illhoof"],
  },
  {
    id: "wing-4",
    name: "The Spire",
    flavorText: "Above the observatory the tower stops pretending to be a building. Rifts, crowns, and a bell you should not ring — yet.",
    unlockConditions: { orgMilestones: ["aran-cleared"], reputationMinimum: 18 },
    challenges: ["netherspite", "prince", "nightbane"],
    requiredChallenges: ["prince"],
    optionalChallenges: ["netherspite", "nightbane"],
  },
  {
    id: "wing-5",
    name: "Beyond the Tower",
    flavorText: "The Waking Tower was the classroom. Stonewake Lair and the Furnace Vault are what it was preparing you for.",
    unlockConditions: { orgMilestones: ["prince-cleared"], reputationMinimum: 28 },
    challenges: ["maulgar", "gruul", "magtheridon"],
    requiredChallenges: ["magtheridon"],
    optionalChallenges: ["maulgar", "gruul"],
  },
];

// ── Attunement Chains ─────────────────────────────────────────────────────────
// Two chains, exercising both grant styles the engine supports:
// - the-masters-key (legacy id): earned by playing through the lower halls.
//   It grants the Surveyor's Key; half the raid must be tower-proven.
// - the-blackened-urn (legacy id): item-borne. One urn-bearer who also carries
//   the Surveyor's Key may ring the balcony bell.

const ATTUNEMENT_CHAINS: AttunementChain[] = [
  {
    id: "the-masters-key",
    name: "The Surveyor's Key",
    steps: [
      { type: "challenge_clear", target: "attumen" },
      { type: "challenge_clear", target: "moroes" },
      { type: "challenge_clear", target: "maiden" },
    ],
    grantsAccessTo: ["curator"],
  },
  {
    id: "the-blackened-urn",
    name: "The Bell-Blackened Urn",
    steps: [
      { type: "item_acquire", target: "blackened-urn" },
      { type: "chain_complete", target: "the-masters-key" },
    ],
    grantsAccessTo: ["nightbane"],
  },
];

// ── Difficulty Modes ──────────────────────────────────────────────────────────

const DIFFICULTY_MODES: DifficultyMode[] = [
  {
    id: "heroic",
    name: "Heroic",
    globalModifiers: {
      difficultyMultiplier: 1.3,
      rewardMultiplier: 1.5,
      mechanicAdditions: [
        {
          id: "heroic-unraveling",
          name: "The Tower Unravels",
          description: "On heroic, the Waking Tower itself works against you: shifting halls, hostile echoes, no safe pulls.",
          attributeWeights: [{ attributeId: "adaptability", weight: 0.6 }, { attributeId: "resilience", weight: 0.4 }],
          difficultyThreshold: 8,
          thresholdMode: "perAssignedAgent",
          scope: "team_aggregate",
          failureConsequence: { type: "stress", severity: 0.4 },
        },
      ],
    },
  },
];

// ── Narrative Events ──────────────────────────────────────────────────────────

const NARRATIVE_EVENTS: NarrativeEvent[] = [
  {
    trigger: { type: "first_clear", target: "attumen" },
    title: "The Stables Fall Silent",
    text: "Your raiders stand in a stable that has not been quiet since the Last Surveyor vanished. Somewhere above, the tower notices.",
    rewards: [],
    agentUnlock: null,
  },
  {
    trigger: { type: "tier_complete", target: "wing-1" },
    title: "The Lower Halls Are Yours",
    text: "Staff quarters cleared, chapel silenced. The raiders who walked every hall now carry the Surveyor's Key — the Orrery Galleries will open for them.",
    rewards: [],
    agentUnlock: null,
  },
  {
    trigger: { type: "first_clear", target: "prince" },
    title: "The Urn on the Balcony",
    text: "In the wreckage of the prince's court, a bell-blackened urn. The bell on the surveyor's balcony has a shape carved beside it: a wyrm, wings folded, waiting to be woken.",
    rewards: [],
    agentUnlock: null,
  },
  {
    trigger: { type: "first_clear", target: "nightbane" },
    title: "The Summoned Rest",
    text: "You rang the bell, and you answered for it. The Bell-Woken Wyrm's ashes settle for the last time. Very few rosters can claim a kill they chose to summon.",
    rewards: [],
    agentUnlock: null,
  },
  {
    trigger: { type: "arc_complete", target: "karazhan" },
    title: "Beyond the Lamplit Survey",
    text: "Tower, lair, and citadel chamber — cleared. The Lamplit Survey has no rank left to give you. Somewhere, a new raid instance is being drawn on someone's map.",
    rewards: [],
    agentUnlock: null,
  },
];

// ── Arc Definition ────────────────────────────────────────────────────────────

export const KARAZHAN: Arc = {
  meta: {
    id: "karazhan",
    name: "The Waking Tower",
    description:
      "A haunted observatory-fortress run as a raid campaign: fourteen encounters across five wings, gated by attunement chains, wing progression, and a heroic mode. Prove a full roster — tanks, healers, melee, ranged, support — from the ash stables to the Furnace Vault.",
    author: "axm-arc team",
    version: "1.2.0",
    engineVersion: "1.1.0",
    domain: "haunted-fantasy",
    estimatedCycles: 40,
  },
  attributes: [...ATTRIBUTES],
  roles: [...ROLES],
  tiers: [...TIERS],
  currencyName: "Gold",
  materialName: "Arcane Residue",
  tokenName: "Raid Nights",
  reputationName: "Survey Standing",
  tokensPerCycle: 2,
  maxTokens: 4,
  infrastructureTokenBonus: 0.25,
  namePool: NAME_POOL,
  customTraits: [],
  progressionTiers: [...PROGRESSION_TIERS],
  attunementChains: [...ATTUNEMENT_CHAINS],
  challenges: [...CHALLENGES],
  difficultyModes: [...DIFFICULTY_MODES],
  items: [...ITEMS],
  narrativeEvents: [...NARRATIVE_EVENTS],
  scaling: { type: "fixed", scalingRules: {} },
  opening: {
    triggerType: "warding-oath",
    narrativeText:
      "The Last Surveyor vanished, and his observatory-fortress has not gone quiet. Wards that held for a lifetime are thinning, and what they held is stirring — stables, halls, and the ruined court, all waking at once. The Lamplit Survey grants your raid the key and the tally both: clear the Waking Tower, and every wing you reclaim is counted against the order's name. The raiders wait at the door for your word.",
    options: [
      {
        id: "sworn-to-the-eye",
        label: "Answer to the Lamplit Survey",
        description:
          "You take the tower as the order's sanctioned raid — its key, its rules, its tally. The raiders stand a little straighter under a name worth answering to.",
        effects: [
          { scope: "all", type: "morale", value: 7 },
          { scope: "all", type: "loyalty", value: 3 },
        ],
      },
      {
        id: "for-the-standing",
        label: "Go in for the standing",
        description:
          "The Survey's ranks are climbed by those who clear what others cannot. You take the tower to prove the roster — drive ahead of devotion.",
        effects: [
          { scope: "all", type: "morale", value: 3 },
          { scope: "all", type: "stress", value: 1 },
        ],
      },
      {
        id: "for-the-vaults",
        label: "Strip the tower's vaults",
        description:
          "The Last Surveyor's sealed vaults outweigh an order's name. The raid goes in for what it can carry out — and knows it.",
        effects: [
          { scope: "all", type: "morale", value: -4 },
          { scope: "all", type: "stress", value: 2 },
        ],
      },
    ],
  },
  founding: {
    organization: { id: "player-raid", name: "The Lamplit Expedition" },
    resources: { currency: 150, materials: 0, tokens: 2 },
    facilities: [
      { type: "Quarters", level: 1 },
      { type: "Production", level: 0 },
      { type: "Recreation", level: 1 },
      { type: "Research", level: 0 },
      { type: "Training", level: 0 },
      { type: "Storage", level: 0 },
      { type: "Medical", level: 0 },
    ],
    distributionPolicy: "council",
    roster: [
      { id: "tank-veteran", tierId: "veteran", roleId: "tank" },
      { id: "tank-member", tierId: "member", roleId: "tank" },
      { id: "healer-veteran", tierId: "veteran", roleId: "healer" },
      { id: "healer-member", tierId: "member", roleId: "healer" },
      { id: "melee-veteran", tierId: "veteran", roleId: "melee" },
      { id: "melee-recruit", tierId: "recruit", roleId: "melee" },
      { id: "ranged-veteran", tierId: "veteran", roleId: "ranged" },
      { id: "ranged-member", tierId: "member", roleId: "ranged" },
      { id: "support-member", tierId: "member", roleId: "support" },
      { id: "support-recruit", tierId: "recruit", roleId: "support" },
    ],
    relationships: [],
  },
};
