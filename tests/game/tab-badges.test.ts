import { describe, it, expect } from "vitest";
import type { DramaCard } from "../../src/engine/types.js";
import type { TriagedDrama, AmbientGroup } from "../../src/engine/drama-triage.js";
import { dramaTabBadge, reportsTabBadge } from "../../src/game/lib/tab-badges.js";

function card(id: string): DramaCard {
  return { id } as unknown as DramaCard;
}

function ambient(triggerType: string, count: number): AmbientGroup {
  return { triggerType, count, sample: card(`${triggerType}-0`), cardIds: [] };
}

function triaged(partial: Partial<TriagedDrama>): TriagedDrama {
  return { blocking: [], inbox: [], ambient: [], ...partial };
}

describe("dramaTabBadge", () => {
  it("badges blocking count with blocking tone when blocking > 0", () => {
    const t = triaged({ blocking: [card("a"), card("b")], inbox: [card("c")] });
    expect(dramaTabBadge(t)).toEqual({ label: "2", tone: "blocking" });
  });

  it("badges inbox count with inbox tone when only inbox present", () => {
    const t = triaged({ inbox: [card("a"), card("b"), card("c")] });
    expect(dramaTabBadge(t)).toEqual({ label: "3", tone: "inbox" });
  });

  it("never badges ambient — ambient-only returns null", () => {
    const t = triaged({ ambient: [ambient("prolonged_benching", 5)] });
    expect(dramaTabBadge(t)).toBeNull();
  });

  it("returns null when everything is empty", () => {
    expect(dramaTabBadge(triaged({}))).toBeNull();
  });
});

describe("reportsTabBadge", () => {
  it("badges unresolved reward dockets with blocking tone", () => {
    expect(
      reportsTabBadge({ reportCount: 4, pendingRewardChoices: 3, resolvedRewardDecisions: 1 }),
    ).toEqual({ label: "2", tone: "blocking" });
  });

  it("shows NEW when reports exist and all rewards resolved", () => {
    expect(
      reportsTabBadge({ reportCount: 4, pendingRewardChoices: 2, resolvedRewardDecisions: 2 }),
    ).toEqual({ label: "NEW", tone: "new" });
  });

  it("returns null when nothing is pending", () => {
    expect(
      reportsTabBadge({ reportCount: 0, pendingRewardChoices: 0, resolvedRewardDecisions: 0 }),
    ).toBeNull();
  });
});
