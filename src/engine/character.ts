import type { Agent, Arc, ArcTier, Trait } from "./types";
import { DEFAULT_TRAIT_POOL, DEFAULT_NAME_POOL } from "./constants";
import { Rng } from "./prng";

export interface GenerateAgentOpts {
  rng: Rng;
  tier: ArcTier;
  arc: Arc;
  cycle: number;
  preferredRoleId?: string;
}

function buildTraitPool(arc: Arc): Trait[] {
  const arcIds = new Set(arc.customTraits.map((t) => t.id));
  const base = DEFAULT_TRAIT_POOL.filter((t) => !arcIds.has(t.id));
  return [...arc.customTraits, ...base];
}

function distributeStats(
  rng: Rng,
  tier: ArcTier,
  attrIds: string[],
  weights: Record<string, number>,
): Record<string, number> {
  const budget = rng.int(tier.statBudgetMin, tier.statBudgetMax);
  const n = attrIds.length;
  const totalWeight = attrIds.reduce((s, id) => s + (weights[id] ?? 1), 0);

  // Weighted proportional allocation, clamped 1-20
  const raw = attrIds.map((id) => {
    const w = (weights[id] ?? 1) / totalWeight;
    return Math.max(1, Math.min(20, Math.round(w * budget)));
  });

  // Adjust sum to match budget via random perturbation
  let diff = budget - raw.reduce((s, v) => s + v, 0);
  const indices = attrIds.map((_, i) => i);
  while (diff !== 0) {
    const idx = rng.int(0, n - 1);
    const cur = raw[idx] ?? 0;
    if (diff > 0 && cur < 20) {
      (raw[idx] as number)++;
      diff--;
    } else if (diff < 0 && cur > 1) {
      (raw[idx] as number)--;
      diff++;
    }
    // avoid infinite loop: if all at boundary just break
    if (indices.every((i) => (raw[i] ?? 0) <= 1 || (raw[i] ?? 0) >= 20)) break;
  }

  const result: Record<string, number> = {};
  attrIds.forEach((id, i) => {
    result[id] = raw[i] ?? 1;
  });
  return result;
}

// Base efficiency per §1.2.5. Shared by generateAgent and the designer editor
// (Editor tier/trait patches must reconcile through the exact same formula —
// no duplicated math). Deliberately takes only arc/tier/traitIds: the stat
// distribution itself has never fed this formula (statSum/statAvg were dead
// code here previously), so this stays behavior-identical to the original
// inline computation.
export function computeBaseEfficiency(arc: Arc, tier: ArcTier, traitIds: string[]): number {
  const attrIds = arc.attributes.map((a) => a.id);
  const tierMidpoint = (tier.statBudgetMin + tier.statBudgetMax) / 2;
  const tierMidpointAttrAvg = attrIds.length > 0 ? tierMidpoint / attrIds.length : tierMidpoint;
  let baseEfficiency = 20 - tierMidpointAttrAvg * 0.6;
  if (traitIds.includes("industrious")) baseEfficiency *= 1.3;
  return baseEfficiency;
}

export function generateAgent(opts: GenerateAgentOpts): Agent {
  const { rng, tier, arc, cycle, preferredRoleId } = opts;

  // Role
  const role = preferredRoleId
    ? (arc.roles.find((r) => r.id === preferredRoleId) ?? null)
    : arc.roles.length > 0
      ? rng.pick(arc.roles)
      : null;

  const attrIds = arc.attributes.map((a) => a.id);
  const weights: Record<string, number> = role ? { ...role.attributeWeights } : {};

  const attributes = distributeStats(rng, tier, attrIds, weights);

  // Traits: pick 2-3 from combined pool
  const pool = buildTraitPool(arc);
  const traitCount = rng.int(2, 3);
  const picked: Trait[] = [];
  const available = [...pool];
  for (let i = 0; i < traitCount && available.length > 0; i++) {
    const idx = rng.int(0, available.length - 1);
    picked.push(available[idx] as Trait);
    available.splice(idx, 1);
  }
  const traitIds = picked.map((t) => t.id);

  // Hidden attrs: uniform 1-20
  const hiddenAttributes = {
    loyalty: rng.int(1, 20),
    ambition: rng.int(1, 20),
    volatility: rng.int(1, 20),
    leadership: rng.int(1, 20),
  };

  const baseEfficiency = computeBaseEfficiency(arc, tier, traitIds);

  // Name
  const namePool = arc.namePool.firstNames.length > 0 ? arc.namePool : DEFAULT_NAME_POOL;
  const firstName = rng.pick(namePool.firstNames as string[]);
  const lastName =
    namePool.lastNames.length > 0 ? " " + rng.pick(namePool.lastNames as string[]) : "";
  const name = firstName + lastName;

  // Unique id from cycle + rng call count proxy
  const id = `agent-${rng.int(100000, 999999)}`;

  return {
    id,
    name,
    attributes,
    hiddenAttributes,
    traits: traitIds,
    role: role?.id ?? null,
    secondaryRole: null,
    baseEfficiency,
    tier: tier.id,
    upkeep: tier.upkeepCost,
    morale: 50,
    stress: 0,
    attunements: [],
    assignmentHistory: [],
    afflictionHistory: [],
    rewardHistory: [],
    afflictionState: { kind: "none" },
    equippedItems: {},
    downedUntilCycle: null,
    lastClearCycle: {},
    revealedHiddenAttrs: 0,
    revealedTraits: 1,
  };
}
