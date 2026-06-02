import { describe, expect, it } from "vitest";
import type { DramaCard } from "../../src/engine/types.js";
import { laneForDramaCard, triageDrama } from "../../src/game/lib/drama-triage.js";

function card(id: string, triggerType: string): DramaCard {
  return {
    id,
    triggerType,
    cycleGenerated: 1,
    agentsInvolved: [],
    narrativeText: "Test card.",
    options: [],
  };
}

describe("drama triage", () => {
  it("routes decision-critical cards into the blocking lane", () => {
    expect(laneForDramaCard(card("reward", "reward_dispute"))).toBe("blocking");
    expect(laneForDramaCard(card("affliction", "affliction_threshold"))).toBe("blocking");
    expect(laneForDramaCard(card("rivalry", "rivalrous_perf_gap"))).toBe("blocking");
  });

  it("splits blocking, inbox, and ambient lanes", () => {
    const result = triageDrama([
      card("a", "reward_dispute"),
      card("b", "relationship_transition"),
      card("c", "prolonged_benching"),
    ]);

    expect(result.blocking.map((c) => c.id)).toEqual(["a"]);
    expect(result.inbox.map((c) => c.id)).toEqual(["b"]);
    expect(result.ambient.map((c) => c.id)).toEqual(["c"]);
  });
});
