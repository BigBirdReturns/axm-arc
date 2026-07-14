import type { Agent, Arc, ArcTier, Item } from "../../engine/types.js";

// Pure, branchy logic for the designer editor. The component (DesignerScreen)
// stays wiring-only: it calls these helpers and renders their result. Nothing
// here is arc-specific — every id/threshold comes from the arc/tier/item args.

export type BudgetStatus = "under" | "within" | "over";

/** Clamp a raw attribute input to the legal 1-20 integer range. Never throws,
 * never NaNs — non-finite input falls back to the floor. */
export function clampAttribute(value: number): number {
  if (Number.isNaN(value)) return 1;
  return Math.max(1, Math.min(20, Math.round(value)));
}

/** Classify a stat-sum against a tier's budget window. A soft classification
 * only — "over" is a warning ("legal, but richer than a rolled agent"), never
 * a block. Missing tier degrades to "within" rather than throwing. */
export function statBudgetStatus(sum: number, tier: ArcTier | undefined): BudgetStatus {
  if (!tier) return "within";
  if (sum < tier.statBudgetMin) return "under";
  if (sum > tier.statBudgetMax) return "over";
  return "within";
}

/** Tier rank = index in arc.tiers. Unknown tier ids rank to +Infinity so
 * comparisons against them degrade safely (nothing looks locked-below an
 * unrecognized tier; nothing looks unlocked-above one either — see
 * isItemLocked) instead of throwing. */
export function tierRank(arc: Arc, tierId: string): number {
  const idx = arc.tiers.findIndex((t) => t.id === tierId);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}

/** An item is tier-locked when its required tier ranks above the agent's
 * current tier. Informational + enforced in the editor UI (mirrors the
 * prototype's disabled-button treatment), never a hard data-model block —
 * an agent record with a "locked" item already equipped (e.g. authored by
 * hand, or after a tier downgrade) is still a legal Agent. */
export function isItemLocked(arc: Arc, item: Item, agentTierId: string): boolean {
  return tierRank(arc, item.tierRequirement) > tierRank(arc, agentTierId);
}

/** Sum of stat bonuses granted by an agent's equipped items, keyed by
 * attribute id. Unknown item ids (stale references) are ignored. */
export function computeItemBonuses(arc: Arc, equippedItems: Agent["equippedItems"]): Record<string, number> {
  const bonuses: Record<string, number> = {};
  for (const itemId of Object.values(equippedItems)) {
    const item = arc.items.find((i) => i.id === itemId);
    if (!item) continue;
    for (const [attrId, v] of Object.entries(item.statBonuses)) {
      bonuses[attrId] = (bonuses[attrId] ?? 0) + v;
    }
  }
  return bonuses;
}

/** Toggle a trait id in/out of an agent's trait list. No min/max count —
 * the pool is click-to-toggle with no floor or ceiling (DESIGNER_PORT.md /
 * prototype decision). */
export function toggleTrait(traits: string[], traitId: string): string[] {
  return traits.includes(traitId) ? traits.filter((t) => t !== traitId) : [...traits, traitId];
}

/** Equip/unequip toggle for a single slot: clicking the already-equipped
 * item unequips it, clicking a different item swaps it in. */
export function toggleEquip(equippedItems: Agent["equippedItems"], slot: string, itemId: string): Agent["equippedItems"] {
  const next = { ...equippedItems };
  if (next[slot] === itemId) {
    delete next[slot];
  } else {
    next[slot] = itemId;
  }
  return next;
}

/** Mint a collision-free id for a duplicated agent. The numeric suffix is one
 * past the highest `${srcId}-copy-N` suffix already present in the roster, so
 * it stays unique across delete+duplicate cycles (where the roster length can
 * shrink and re-collide). Non-matching or non-integer suffixes are ignored. */
export function nextCopyId(existingIds: Iterable<string>, srcId: string): string {
  const prefix = `${srcId}-copy-`;
  let max = 0;
  for (const id of existingIds) {
    if (!id.startsWith(prefix)) continue;
    const suffix = Number(id.slice(prefix.length));
    if (Number.isInteger(suffix) && suffix > max) max = suffix;
  }
  return `${prefix}${max + 1}`;
}
