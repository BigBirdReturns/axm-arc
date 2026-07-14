import { orderedKeys } from "./determinism.js";
import type {
  Arc,
  AuthoredOpening,
  DramaCard,
  DramaCardEffect,
  Organization,
} from "./types.js";

function expandEffects(
  opening: AuthoredOpening,
  agentIds: readonly string[],
): DramaCard["options"] {
  return opening.options.map((option) => {
    const effects: DramaCardEffect[] = [];
    const hiddenEffects: DramaCardEffect[] = [];
    for (const effect of option.effects) {
      const destination = effect.type === "loyalty" ? hiddenEffects : effects;
      for (const target of agentIds) {
        destination.push({ target, type: effect.type, value: effect.value });
      }
    }
    return {
      id: option.id,
      label: option.label,
      description: option.description,
      effects,
      hiddenEffects,
    };
  });
}

/** Project Arc-authored opening law into the ordinary drama-card transition.
 * Agent record insertion order is irrelevant: scope expansion uses the engine's
 * canonical Unicode-scalar key order. */
export function buildOpeningCard(
  opening: AuthoredOpening,
  org: Organization,
): DramaCard {
  const agentIds = orderedKeys(org.agents);
  return {
    id: `opening:${opening.triggerType}`,
    cycleGenerated: 0,
    triggerType: opening.triggerType,
    agentsInvolved: agentIds,
    narrativeText: opening.narrativeText,
    options: expandEffects(opening, agentIds),
  };
}

/** Prepend exactly one authored opening to a fresh organization. Omitted opening
 * law is a valid legacy/imported Arc and produces no synthetic client behavior. */
export function enqueueAuthoredOpening(org: Organization, arc: Pick<Arc, "opening">): Organization {
  if (!arc.opening) return org;
  const card = buildOpeningCard(arc.opening, org);
  if (org.dramaQueue.some((queued) => queued.id === card.id)) return org;
  return { ...org, dramaQueue: [card, ...org.dramaQueue] };
}
