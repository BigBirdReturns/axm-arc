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
  // Tier names are authored vocabulary, so rarity is positional. The last tier
  // is ALWAYS the arc's top tier and is intentionally excluded from the open
  // pool (§1.9): it can only arrive through an authored milestone/event. The
  // previous fixed four-slot mapping accidentally admitted the top tier for
  // every three- and four-tier cartridge.
  const eligibleTiers = arc.tiers.slice(0, -1);
  const rankWeights = [weights.common, weights.uncommon, weights.rare, weights.epic];
  const items = eligibleTiers
    .map((item, index) => ({
      item,
      // Arcs normally use 3–5 tiers. If an authored arc defines more, keep the
      // remaining non-top ranks in the highest open-pool bucket rather than
      // silently making them unreachable.
      weight: rankWeights[Math.min(index, rankWeights.length - 1)] ?? 0,
    }))
    .filter((entry) => entry.weight > 0);

  if (items.length === 0) {
    // A one-tier arc has no below-top tier to recruit. Returning no candidate is
    // more honest than violating the top-tier exclusion.
    return null;
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
