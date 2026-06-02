import { describe, it, expect } from "vitest";
import type { DramaCard } from "../../src/engine/types.js";
import { triageDrama, LANE_BY_TRIGGER } from "../../src/engine/drama-triage.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeCard(id: string, triggerType: string, cycleGenerated = 1): DramaCard {
  return {
    id,
    cycleGenerated,
    triggerType,
    agentsInvolved: [],
    narrativeText: "",
    options: [],
  };
}

// ── triageDrama ────────────────────────────────────────────────────────────────

describe("triageDrama", () => {
  it("LANE_BY_TRIGGER maps the five engine trigger types", () => {
    expect(LANE_BY_TRIGGER.reward_dispute).toBe("blocking");
    expect(LANE_BY_TRIGGER.affliction_threshold).toBe("inbox");
    expect(LANE_BY_TRIGGER.morale_extreme).toBe("inbox");
    expect(LANE_BY_TRIGGER.prolonged_benching).toBe("ambient");
    expect(LANE_BY_TRIGGER.rivalrous_perf_gap).toBe("ambient");
  });

  it("1. mixed queue → dispute blocks, the rest are inbox, ambient empty", () => {
    const queue = [
      makeCard("d1", "reward_dispute"),
      makeCard("a1", "affliction_threshold"),
      makeCard("a2", "affliction_threshold"),
      makeCard("m1", "morale_extreme"),
    ];
    const { blocking, inbox, ambient } = triageDrama(queue);

    expect(blocking.map((c) => c.id)).toEqual(["d1"]);
    expect(inbox.map((c) => c.id)).toEqual(["a1", "a2", "m1"]);
    expect(ambient).toEqual([]);
  });

  it("2. coalesces an ambient type past the threshold into one group", () => {
    const queue = [
      makeCard("b1", "prolonged_benching"),
      makeCard("b2", "prolonged_benching"),
      makeCard("b3", "prolonged_benching"),
      makeCard("b4", "prolonged_benching"),
      makeCard("b5", "prolonged_benching"),
    ];
    const { blocking, inbox, ambient } = triageDrama(queue);

    expect(blocking).toEqual([]);
    expect(inbox).toEqual([]);
    expect(ambient).toHaveLength(1);
    expect(ambient[0]!.triggerType).toBe("prolonged_benching");
    expect(ambient[0]!.count).toBe(5);
    expect(ambient[0]!.cardIds).toEqual(["b1", "b2", "b3", "b4", "b5"]);
    expect(ambient[0]!.sample.id).toBe("b1");
  });

  it("3. below-threshold ambient type stays in the inbox (not coalesced)", () => {
    const queue = [
      makeCard("b1", "prolonged_benching"),
      makeCard("b2", "prolonged_benching"),
    ];
    const { blocking, inbox, ambient } = triageDrama(queue); // default threshold 3

    expect(blocking).toEqual([]);
    expect(inbox.map((c) => c.id)).toEqual(["b1", "b2"]);
    expect(ambient).toEqual([]);
  });

  it("4. unknown triggerType defaults to inbox (not blocking, not dropped)", () => {
    const queue = [makeCard("u1", "some_future_trigger")];
    const { blocking, inbox, ambient } = triageDrama(queue);

    expect(blocking).toEqual([]);
    expect(inbox.map((c) => c.id)).toEqual(["u1"]);
    expect(ambient).toEqual([]);
  });

  it("5. is order-invariant: reversed array order yields equivalent lanes", () => {
    const queue = [
      makeCard("d1", "reward_dispute"),
      makeCard("d2", "reward_dispute"),
      makeCard("a1", "affliction_threshold"),
      makeCard("m1", "morale_extreme"),
      makeCard("b1", "prolonged_benching"),
      makeCard("b2", "prolonged_benching"),
      makeCard("b3", "prolonged_benching"),
      makeCard("r1", "rivalrous_perf_gap"),
      makeCard("r2", "rivalrous_perf_gap"),
      makeCard("r3", "rivalrous_perf_gap"),
    ];
    const forward = triageDrama(queue);
    const reversed = triageDrama([...queue].reverse());

    // Same membership (sets) in blocking / inbox regardless of input order.
    const ids = (cards: DramaCard[]) => new Set(cards.map((c) => c.id));
    expect(ids(reversed.blocking)).toEqual(ids(forward.blocking));
    expect(ids(reversed.inbox)).toEqual(ids(forward.inbox));

    // Ambient groups identical: same triggerTypes (in same order), counts, and id sets.
    expect(reversed.ambient.map((g) => g.triggerType)).toEqual(
      forward.ambient.map((g) => g.triggerType),
    );
    for (let i = 0; i < forward.ambient.length; i++) {
      expect(reversed.ambient[i]!.count).toBe(forward.ambient[i]!.count);
      expect(new Set(reversed.ambient[i]!.cardIds)).toEqual(
        new Set(forward.ambient[i]!.cardIds),
      );
    }

    // Ambient group emission order is deterministic: sorted by triggerType.
    expect(forward.ambient.map((g) => g.triggerType)).toEqual([
      "prolonged_benching",
      "rivalrous_perf_gap",
    ]);
  });

  it("6. empty queue → all three lanes empty", () => {
    const { blocking, inbox, ambient } = triageDrama([]);
    expect(blocking).toEqual([]);
    expect(inbox).toEqual([]);
    expect(ambient).toEqual([]);
  });
});
