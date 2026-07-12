import type { Agent, Arc, MechanicCheck, Organization } from "./types.js";
import {
  AFFLICTION_PENALTIES,
  DEFAULT_TRAIT_POOL,
  RELATIONSHIP_MODS,
} from "./constants.js";

/** The non-random terms the resolver adds before variance and volatility.
 *
 * Pre-run projections and diagnosis candidate ranking are allowed to omit the
 * random terms because their expectation is zero. They are not allowed to
 * invent a second formula for the deterministic terms. This structure is the
 * executable contract those read-only surfaces share with resolver diagnostics.
 */
export interface DeterministicScoreBreakdown {
  rawScore: number;
  gearBonus: number;
  relMod: number;
  moraleMod: number;
  afflictionMod: number;
  traitBonus: number;
  total: number;
}

/** The attribute whose equipped-item bonuses the resolver reads for a check. */
export function primaryAttributeId(check: MechanicCheck): string {
  let best = check.attributeWeights[0]!;
  for (const weight of check.attributeWeights) {
    if (weight.weight > best.weight) best = weight;
  }
  return best.attributeId;
}

/** The authored threshold after applying the check's declared party-size mode. */
export function effectiveCheckThreshold(
  check: MechanicCheck,
  partySize: number,
): number {
  return check.scope === "team_aggregate" &&
    check.thresholdMode === "perAssignedAgent"
    ? check.difficultyThreshold * Math.max(1, partySize)
    : check.difficultyThreshold;
}

function effectiveGearBonus(agent: Agent, check: MechanicCheck, arc: Arc): number {
  const attrId = primaryAttributeId(check);
  let rawBonus = 0;
  for (const itemId of Object.values(agent.equippedItems)) {
    const item = arc.items.find((candidate) => candidate.id === itemId);
    if (item) rawBonus += item.statBonuses[attrId] ?? 0;
  }
  return rawBonus * 0.5;
}

function relationshipModifier(
  agent: Agent,
  party: Agent[],
  org: Organization,
): number {
  const others = party.filter((candidate) => candidate.id !== agent.id);
  if (others.length === 0) return 0;

  let total = 0;
  for (const other of others) {
    const relationship = org.relationships.find(
      (entry) =>
        (entry.agentIds[0] === agent.id && entry.agentIds[1] === other.id) ||
        (entry.agentIds[0] === other.id && entry.agentIds[1] === agent.id),
    );
    total += RELATIONSHIP_MODS[relationship?.state ?? "Neutral"];
  }
  return total / others.length;
}

function afflictionModifier(agent: Agent): number {
  if (agent.afflictionState.kind === "none") return 0;
  return AFFLICTION_PENALTIES[agent.afflictionState.kind].scoreMod;
}

function traitCheckBonus(agent: Agent, check: MechanicCheck, arc: Arc): number {
  let bonus = 0;

  for (const traitId of agent.traits) {
    const trait =
      arc.customTraits.find((candidate) => candidate.id === traitId) ??
      DEFAULT_TRAIT_POOL.find((candidate) => candidate.id === traitId);
    if (!trait) continue;

    for (const effect of trait.effects) {
      if (effect.kind === "attributeCheckBonus") {
        const matchesId = check.attributeWeights.some(
          (weight) => weight.attributeId === effect.attributeId,
        );
        const matchesPrecisionAlias =
          effect.attributeId === "__precision__" &&
          check.attributeWeights.some((weight) =>
            weight.attributeId.toLowerCase().includes("precision"),
          );
        if (matchesId || matchesPrecisionAlias) bonus += effect.bonus;
      }

      if (
        effect.kind === "attributeBonusWhenMoraleHigh" &&
        agent.morale > effect.threshold
      ) {
        let attrId = effect.attributeId;
        if (attrId === "__highest__") {
          attrId =
            Object.entries(agent.attributes).sort((a, b) => b[1] - a[1])[0]?.[0] ??
            "";
        }
        if (check.attributeWeights.some((weight) => weight.attributeId === attrId)) {
          bonus += effect.bonus;
        }
      }
    }
  }

  return bonus;
}

/** Resolver-parity expected contribution for one agent on one check.
 *
 * The party must represent the composition being evaluated. For a proposed
 * bench swap, callers pass the post-swap party so relationship terms are priced
 * in the state the recommendation would actually create.
 */
export function deterministicScoreBreakdown(
  agent: Agent,
  check: MechanicCheck,
  party: Agent[],
  org: Organization,
  arc: Arc,
): DeterministicScoreBreakdown {
  const rawScore = check.attributeWeights.reduce(
    (sum, weight) =>
      sum + (agent.attributes[weight.attributeId] ?? 0) * weight.weight,
    0,
  );
  const gearBonus = effectiveGearBonus(agent, check, arc);
  const relMod = relationshipModifier(agent, party, org);
  const moraleMod = (agent.morale - 50) / 10;
  const afflictionMod = afflictionModifier(agent);
  const traitBonus = traitCheckBonus(agent, check, arc);
  const total =
    rawScore + gearBonus + relMod + moraleMod + afflictionMod + traitBonus;

  return {
    rawScore,
    gearBonus,
    relMod,
    moraleMod,
    afflictionMod,
    traitBonus,
    total,
  };
}

export function deterministicAgentScore(
  agent: Agent,
  check: MechanicCheck,
  party: Agent[],
  org: Organization,
  arc: Arc,
): number {
  return deterministicScoreBreakdown(agent, check, party, org, arc).total;
}
