import type { Trait, TraitEffect } from "./types";

// ── Trait Pool ─────────────────────────────────────────────────────────────────

function fx(...effects: TraitEffect[]): TraitEffect[] {
  return effects;
}

export const DEFAULT_TRAIT_POOL: Trait[] = [
  {
    id: "industrious",
    name: "Industrious",
    description: "+30% efficiency in infrastructure assignments.",
    effects: fx({ kind: "infraEfficiencyMultiplier", multiplier: 1.3 }),
  },
  {
    id: "greedy",
    name: "Greedy",
    description: "2x morale penalty from reward disappointment.",
    effects: fx({ kind: "moralePenaltyMultiplierOnRewardDisappointment", multiplier: 2.0 }),
  },
  {
    id: "mentor_inclined",
    name: "Mentor-Inclined",
    description: "Can form Mentorship relationships with one tier gap instead of two.",
    effects: fx({ kind: "mentorshipTierGapBonus", reducedGapRequired: 1 }),
  },
  {
    id: "loner",
    name: "Loner",
    description: "Relationship formation rate halved; immune to stress from Hostile relationships.",
    effects: fx(
      { kind: "relationshipFormationMultiplier", multiplier: 0.5 },
      { kind: "hostileStressImmunity" },
    ),
  },
  {
    id: "hothead",
    name: "Hothead",
    description:
      "+20% Reckless affliction chance at stress threshold; +10 to highest attribute when morale > 80.",
    effects: fx(
      { kind: "recklessAfflictionChanceBonus", bonus: 0.2 },
      // attributeId placeholder — real agents resolve this against their highest attribute
      { kind: "attributeBonusWhenMoraleHigh", attributeId: "__highest__", threshold: 80, bonus: 10 },
    ),
  },
  {
    id: "stoic",
    name: "Stoic",
    description: "-30% stress accumulation; -50% morale gain from positive events.",
    effects: fx(
      { kind: "stressAccumulationMultiplier", multiplier: 0.7 },
      { kind: "moraleGainMultiplier", multiplier: 0.5 },
    ),
  },
  {
    id: "perfectionist",
    name: "Perfectionist",
    description: "+15% to Precision-equivalent checks; +1 stress on any partial-success.",
    effects: fx(
      // attributeId set to arc-specific precision equivalent; arcs should override
      { kind: "attributeCheckBonus", attributeId: "__precision__", bonus: 15 },
      { kind: "stressOnPartialSuccess", amount: 1 },
    ),
  },
  {
    id: "team_player",
    name: "Team Player",
    description: "Relationship affinity gains at 1.5x; morale more sensitive to team losses.",
    effects: fx(
      { kind: "relationshipAffinityMultiplier", multiplier: 1.5 },
      { kind: "moraleSensitivityToTeamLoss", multiplier: 1.5 },
    ),
  },
  {
    id: "ambitious_trait",
    name: "Ambitious",
    description: "Visible signal that hidden Ambition attribute is likely high.",
    effects: fx({ kind: "ambitionSignal" }),
  },
  // Additional traits beyond the core 9
  {
    id: "methodical",
    name: "Methodical",
    description: "-20% stress accumulation; no bonus variance modifiers apply.",
    effects: fx({ kind: "stressAccumulationMultiplier", multiplier: 0.8 }),
  },
  {
    id: "restless",
    name: "Restless",
    description: "+25% morale gain from active challenge assignments.",
    effects: fx({ kind: "moraleGainMultiplier", multiplier: 1.25 }),
  },
  {
    id: "charismatic",
    name: "Charismatic",
    description: "Relationship formation rate at 1.3x.",
    effects: fx({ kind: "relationshipFormationMultiplier", multiplier: 1.3 }),
  },
];

// ── Name Pool ──────────────────────────────────────────────────────────────────

export const DEFAULT_NAME_POOL = {
  firstNames: [
    "Aric", "Brennan", "Lira", "Vex", "Korrin", "Maeve", "Tarek", "Iona",
    "Jorah", "Sela", "Davan", "Rhea", "Orin", "Tessa", "Calder", "Nira",
    "Brent", "Kyra", "Zale", "Petra", "Elan", "Mira", "Cael", "Vara",
    "Holt", "Faye", "Soren", "Ilya", "Dusk", "Ren",
  ] as const,
  lastNames: [
    "Ashveil", "Bracken", "Coldwater", "Dorne", "Evenmere",
    "Frostholm", "Gravenmoor", "Harwick", "Ironfeld", "Keswick",
    "Lorne", "Maren", "Nighthollow", "Oakhurst", "Proudfen",
    "Ravenscroft", "Steelmark", "Tallow", "Underhill", "Voss",
  ] as const,
};

// ── Reveal Thresholds ──────────────────────────────────────────────────────────

/** [oneRevealed, allRevealed] assignment counts */
export const HIDDEN_ATTR_REVEAL_THRESHOLDS: [number, number] = [3, 8];

/** assignment counts at which trait 1/2/3 become visible */
export const TRAIT_REVEAL_THRESHOLDS: [number, number, number] = [0, 5, 12];

// ── Stress / Affliction ────────────────────────────────────────────────────────

export const STRESS_THRESHOLD = 10;
export const AFFLICTION_CHANCE = 0.75;
export const MAX_DRAMA_CARDS_PER_CYCLE = 5;
export const PRECEDENT_LOOKBACK = 10;

/** Per-affliction score/morale/stress effects (§1.5.3) */
export const AFFLICTION_PENALTIES = {
  Resentful: { scoreMod: -3, moraleDrain: true, stressToTeam: 0 },
  Fearful: { scoreMod: -4, moraleDrain: true, stressToTeam: 1 },
  Defiant: { scoreMod: -1, moraleDrain: false, stressToTeam: 2 },
  Reckless: { scoreMod: 0, moraleDrain: false, stressToTeam: 0, forceMaxVolatility: true },
  Withdrawn: { scoreMod: -2, moraleDrain: false, stressToTeam: 0, relationshipRateMultiplier: 0.5 },
} as const;

// ── Relationship Modifiers ─────────────────────────────────────────────────────

/** Per-relationship-state bonus to relationship_mod (§1.3.2) */
export const RELATIONSHIP_MODS = {
  Allied: 2,
  Rivalrous: 1,
  Hostile: -3,
  Bonded: 4,
  Mentorship: 1,
  Neutral: 0,
} as const;
