import type { Agent, Arc } from "../../engine/types.js";
import { HIDDEN_ATTR_REVEAL_THRESHOLDS, TRAIT_REVEAL_THRESHOLDS } from "../../engine/constants.js";

export function formatMorale(n: number): string {
  if (n >= 80) return "Inspired";
  if (n >= 60) return "Content";
  if (n >= 40) return "Steady";
  if (n >= 20) return "Discontent";
  return "Despondent";
}

export function formatStress(n: number): string {
  if (n >= 9) return "Breaking";
  if (n >= 7) return "Strained";
  if (n >= 4) return "Tense";
  if (n >= 1) return "Aware";
  return "Calm";
}

export function agentInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function visibleAttrs(agent: Agent, arc: Arc): Array<{ name: string; value: number }> {
  return arc.attributes.map((a) => ({ name: a.name, value: agent.attributes[a.id] ?? 0 }));
}

export function isTraitVisible(agent: Agent, traitIndex: number): boolean {
  if (traitIndex < 0 || traitIndex >= agent.traits.length) return false;
  // traitIndex 0 always visible; 1+ revealed by agent.revealedTraits count
  return traitIndex === 0 || traitIndex < agent.revealedTraits;
}

export function hiddenAttrVisibleCount(agent: Agent): number {
  return Math.min(agent.revealedHiddenAttrs, 4);
}

export function nextRevealHint(agent: Agent): string {
  const assignments = agent.assignmentHistory.length;
  for (const t of TRAIT_REVEAL_THRESHOLDS) {
    if (assignments < t) return `Trait reveal in ${t - assignments} assignments`;
  }
  for (const t of HIDDEN_ATTR_REVEAL_THRESHOLDS) {
    if (assignments < t) return `Hidden attribute reveal in ${t - assignments} assignments`;
  }
  return "All info revealed";
}

export function tierBadgeColor(tierId: string): string {
  switch (tierId) {
    case "recruit": return "#7a7065";
    case "veteran": return "#5b8aa3";
    case "champion": return "#b08d57";
    default: return "#888";
  }
}
