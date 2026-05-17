import type { Organization, Arc, Agent } from "./types.js";
import type { Rng } from "./prng.js";
import { generateAgent } from "./character.js";

// ── OrgWithPool ───────────────────────────────────────────────────────────────
// The engine returns full Agent objects; the game layer chooses what to render.
// Per §1.9: visible info at signing = tier, primary role, primary attrs, ONE trait, upkeep.
// All other fields (hiddenAttributes, secondaryRole, remaining traits, baseEfficiency) are hidden.

export type OrgWithPool = Organization & { recruitmentPool?: Agent[] };

// ── Tier weight tables by reputation ─────────────────────────────────────────

type TierWeights = { common: number; uncommon: number; rare: number; epic: number };

function getTierWeights(reputation: number): TierWeights {
  if (reputation < 10) {
    return { common: 80, uncommon: 20, rare: 0, epic: 0 };
  } else if (reputation <= 50) {
    return { common: 30, uncommon: 40, rare: 25, epic: 5 };
  } else {
    // high rep (>50): legendary never in open pool per spec — clamp to 0
    return { common: 5, uncommon: 20, rare: 40, epic: 35 };
  }
}

function pickTier(arc: Arc, weights: TierWeights, rng: Rng): import("./types.js").ArcTier | null {
  const tierIds = Object.keys(weights) as (keyof TierWeights)[];

  // Map weight names to actual arc tiers by position (common=0, uncommon=1, rare=2, epic=3)
  const tierByRank = [
    arc.tiers[0], // common
    arc.tiers[1], // uncommon
    arc.tiers[2], // rare
    arc.tiers[3], // epic
  ];

  const items = tierIds
    .map((key, i) => ({
      item: tierByRank[i] ?? null,
      weight: weights[key],
    }))
    .filter((x) => x.item !== null && x.weight > 0) as {
    item: import("./types.js").ArcTier;
    weight: number;
  }[];

  if (items.length === 0) {
    // Fallback to first tier
    return arc.tiers[0] ?? null;
  }

  return rng.weightedPick(items);
}

// ── refreshOpenPool ───────────────────────────────────────────────────────────

export function refreshOpenPool(
  org: Organization,
  arc: Arc,
  rng: Rng,
  _cycle: number,
): { pool: Agent[]; org: OrgWithPool } {
  const recLevel = org.infrastructure["Recreation"]?.level ?? 0;
  const poolSize = Math.min(8, 3 + Math.floor(recLevel / 2));
  const weights = getTierWeights(org.reputation);

  const pool: Agent[] = [];
  for (let i = 0; i < poolSize; i++) {
    const tier = pickTier(arc, weights, rng);
    if (!tier) continue;

    const agent = generateAgent({
      rng,
      tier,
      arc,
      cycle: _cycle,
    });
    pool.push(agent);
  }

  const orgWithPool: OrgWithPool = { ...org, recruitmentPool: pool };
  return { pool, org: orgWithPool };
}

// ── hireAgent ─────────────────────────────────────────────────────────────────

export function hireAgent(
  org: Organization,
  candidate: Agent,
  _cycle: number,
): Organization {
  // Quarters cap: level * 5
  const quartersLevel = org.infrastructure["Quarters"]?.level ?? 1;
  const maxAgents = quartersLevel * 5;
  const currentCount = Object.keys(org.agents).length;

  if (currentCount >= maxAgents) {
    throw new Error(
      `Roster full: ${currentCount}/${maxAgents} agents (Quarters level ${quartersLevel})`,
    );
  }

  return {
    ...org,
    agents: {
      ...org.agents,
      [candidate.id]: candidate,
    },
  };
}
