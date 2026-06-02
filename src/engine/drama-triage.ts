import type { DramaCard } from "./types.js";

export type DramaLane = "blocking" | "inbox" | "ambient";

export interface AmbientGroup {
  triggerType: string;
  count: number;
  sample: DramaCard; // a representative card (deterministically chosen: first in stable order)
  cardIds: string[]; // ids of all coalesced cards, stable order
}

export interface TriagedDrama {
  blocking: DramaCard[];
  inbox: DramaCard[];
  ambient: AmbientGroup[];
}

export interface TriageOptions {
  /** Coalesce a non-blocking triggerType into an ambient group when its count
   *  in the queue reaches this threshold. Default 3. */
  coalesceThreshold?: number;
}

/**
 * Classification of each known triggerType into a drama lane.
 *
 * - reward_dispute: a genuine allocation fork — a human must resolve it in
 *   place. blocking.
 * - affliction_threshold / morale_extreme: notable state changes worth
 *   surfacing but not gating. inbox.
 * - prolonged_benching / rivalrous_perf_gap: low-priority, repeat at scale —
 *   coalesce past a threshold. ambient.
 *
 * Exported and tunable. Unknown / unmapped triggerTypes default to "inbox"
 * (safe: visible, non-blocking — never silently hidden, never silently blocking).
 */
export const LANE_BY_TRIGGER: Record<string, DramaLane> = {
  reward_dispute: "blocking",
  affliction_threshold: "inbox",
  morale_extreme: "inbox",
  prolonged_benching: "ambient",
  rivalrous_perf_gap: "ambient",
};

const DEFAULT_LANE: DramaLane = "inbox";
const DEFAULT_COALESCE_THRESHOLD = 3;

function laneFor(card: DramaCard): DramaLane {
  return LANE_BY_TRIGGER[card.triggerType] ?? DEFAULT_LANE;
}

/**
 * Splits a drama queue into three lanes: blocking (gates Advance), inbox
 * (visible, non-blocking) and ambient (coalesced summaries).
 *
 * Deterministic per SCALE law 3: blocking and inbox preserve the given queue
 * order; ambient groups are emitted sorted by triggerType. No RNG, no
 * Object.keys-iteration dependence in the output ordering.
 */
export function triageDrama(queue: DramaCard[], opts?: TriageOptions): TriagedDrama {
  const coalesceThreshold = opts?.coalesceThreshold ?? DEFAULT_COALESCE_THRESHOLD;

  // First pass: count occurrences of each ambient-lane triggerType so we can
  // decide which ones meet the coalesce threshold.
  const ambientTypeCounts = new Map<string, number>();
  for (const card of queue) {
    if (laneFor(card) === "ambient") {
      ambientTypeCounts.set(card.triggerType, (ambientTypeCounts.get(card.triggerType) ?? 0) + 1);
    }
  }

  const blocking: DramaCard[] = [];
  const inbox: DramaCard[] = [];
  // triggerType -> cards, built in stable (queue) order. Group EMISSION order is
  // made deterministic below by sorting triggerType keys.
  const ambientGroups = new Map<string, DramaCard[]>();

  for (const card of queue) {
    const lane = laneFor(card);
    if (lane === "blocking") {
      blocking.push(card);
    } else if (lane === "inbox") {
      inbox.push(card);
    } else {
      // ambient lane: coalesce only if this triggerType meets the threshold;
      // otherwise it isn't worth a summary — surface it in the inbox.
      const typeCount = ambientTypeCounts.get(card.triggerType) ?? 0;
      if (typeCount >= coalesceThreshold) {
        const existing = ambientGroups.get(card.triggerType);
        if (existing) existing.push(card);
        else ambientGroups.set(card.triggerType, [card]);
      } else {
        inbox.push(card);
      }
    }
  }

  // Emit ambient groups in a deterministic order: sorted by triggerType string.
  const ambient: AmbientGroup[] = [...ambientGroups.keys()]
    .sort()
    .map((triggerType) => {
      const cards = ambientGroups.get(triggerType)!;
      return {
        triggerType,
        count: cards.length,
        sample: cards[0]!,
        cardIds: cards.map((c) => c.id),
      };
    });

  return { blocking, inbox, ambient };
}
