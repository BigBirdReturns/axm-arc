import type { DramaCard } from "../../engine/types.js";

export type DramaLane = "blocking" | "inbox" | "ambient";

export interface DramaTriage {
  blocking: DramaCard[];
  inbox: DramaCard[];
  ambient: DramaCard[];
}

const BLOCKING_TRIGGER_TYPES = new Set([
  "reward_dispute",
  "precedent_violation",
  "affliction_threshold",
  "bonded_partner_lost",
  "rivalrous_perf_gap",
]);

const AMBIENT_TRIGGER_TYPES = new Set([
  "prolonged_benching",
]);

export function laneForDramaCard(card: DramaCard): DramaLane {
  if (BLOCKING_TRIGGER_TYPES.has(card.triggerType)) return "blocking";
  if (AMBIENT_TRIGGER_TYPES.has(card.triggerType)) return "ambient";
  return "inbox";
}

export function triageDrama(cards: readonly DramaCard[]): DramaTriage {
  const triage: DramaTriage = { blocking: [], inbox: [], ambient: [] };
  for (const card of cards) {
    triage[laneForDramaCard(card)].push(card);
  }
  return triage;
}
