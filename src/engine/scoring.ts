// The single source of a check's DETERMINISTIC (non-random) contribution terms.
//
// Every surface that needs "how much does this agent contribute to this check,
// before the roll" — the resolver, pre-run projections, and wipe-diagnosis
// candidate ranking — computes it here, so they can never drift on attributes,
// gear (at the resolver's half weight), relationships, morale, afflictions, or
// traits. The resolver adds only the random terms (variance, volatility) on top.
//
// This module MUST reproduce the resolver's deterministic terms exactly; the
// engine determinism/conformance suite is the guard.

import type { Agent, Arc, MechanicCheck, Organization } from "./types.js";
import { AFFLICTION_PENALTIES, RELATIONSHIP_MODS, DEFAULT_TRAIT_POOL } from "./constants.js";
import { compareCodepoints, orderedEntries } from "./determinism.js";

export interface DeterministicContribution {
  rawScore: number;
  gearBonus: number;
  relMod: number;
  moraleMod: number;
  afflictionMod: number;
  traitBonus: number;
  /** Sum of the six deterministic terms. The resolver does NOT use this — it
   *  re-sums the fields with the rng terms interleaved to stay byte-identical to
   *  its historical order. Read models (projections, expectedContribution) use it. */
  total: number;
}

/** The single highest-weighted attribute of a check (gear leans on it). */
export function primaryAttrId(check: MechanicCheck): string {
  let best = check.attributeWeights[0]!;
  for (const aw of check.attributeWeights) {
    if (aw.weight > best.weight) best = aw;
  }
  return best.attributeId;
}

/** Equipped gear's bonus to the check's primary attribute, at the resolver's
 *  half weight. */
export function gearContribution(agent: Agent, primary: string, arc: Arc): number {
  let bonus = 0;
  for (const [, itemId] of orderedEntries(agent.equippedItems)) {
    const item = arc.items.find((it) => it.id === itemId);
    if (item) bonus += item.statBonuses[primary] ?? 0;
  }
  return bonus * 0.5;
}

/** Mean relationship modifier of `agent` toward the rest of its party. */
export function relationshipContribution(agent: Agent, others: Agent[], org: Organization): number {
  if (others.length === 0) return 0;
  let total = 0;
  for (const other of others) {
    const rel = org.relationships.find(
      (r) =>
        (r.agentIds[0] === agent.id && r.agentIds[1] === other.id) ||
        (r.agentIds[0] === other.id && r.agentIds[1] === agent.id),
    );
    total += RELATIONSHIP_MODS[rel?.state ?? "Neutral"];
  }
  return total / Math.max(1, others.length);
}

/** Affliction score penalty (0 when healthy). */
export function afflictionContribution(agent: Agent): number {
  if (agent.afflictionState.kind === "none") return 0;
  return AFFLICTION_PENALTIES[agent.afflictionState.kind].scoreMod;
}

function resolveTraits(agent: Agent, arc: Arc) {
  return agent.traits
    .map((tid) => arc.customTraits.find((c) => c.id === tid) ?? DEFAULT_TRAIT_POOL.find((d) => d.id === tid) ?? null)
    .filter((t): t is NonNullable<typeof t> => t !== null);
}

/** Trait check bonuses, including the resolver's `attributeBonusWhenMoraleHigh`
 *  effect and the `__precision__` / `__highest__` aliases. */
export function traitContribution(agent: Agent, check: MechanicCheck, arc: Arc): number {
  let bonus = 0;
  for (const trait of resolveTraits(agent, arc)) {
    for (const fx of trait.effects) {
      if (fx.kind === "attributeCheckBonus") {
        const matchById = check.attributeWeights.some((aw) => aw.attributeId === fx.attributeId);
        const matchByPrecision =
          fx.attributeId === "__precision__" &&
          check.attributeWeights.some((aw) => aw.attributeId.toLowerCase().includes("precision"));
        if (matchById || matchByPrecision) bonus += fx.bonus;
      }
      if (fx.kind === "attributeBonusWhenMoraleHigh" && agent.morale > fx.threshold) {
        let attrId = fx.attributeId;
        if (attrId === "__highest__") {
          attrId = orderedEntries(agent.attributes)
            .sort((a, b) => b[1] - a[1] || compareCodepoints(a[0], b[0]))[0]?.[0] ?? "";
        }
        if (check.attributeWeights.some((aw) => aw.attributeId === attrId)) bonus += fx.bonus;
      }
    }
  }
  return bonus;
}

/** The full deterministic contribution breakdown for `agent` on `check`, within
 *  the party `others` (used for relationships). Reproduces the resolver's
 *  non-random terms exactly. */
export function deterministicContribution(
  agent: Agent,
  check: MechanicCheck,
  others: Agent[],
  org: Organization,
  arc: Arc,
): DeterministicContribution {
  const rawScore = check.attributeWeights.reduce(
    (s, aw) => s + (agent.attributes[aw.attributeId] ?? 0) * aw.weight,
    0,
  );
  const gearBonus = gearContribution(agent, primaryAttrId(check), arc);
  const relMod = relationshipContribution(agent, others, org);
  const moraleMod = (agent.morale - 50) / 10;
  const afflictionMod = afflictionContribution(agent);
  const traitBonus = traitContribution(agent, check, arc);
  return {
    rawScore,
    gearBonus,
    relMod,
    moraleMod,
    afflictionMod,
    traitBonus,
    total: rawScore + gearBonus + relMod + moraleMod + afflictionMod + traitBonus,
  };
}
