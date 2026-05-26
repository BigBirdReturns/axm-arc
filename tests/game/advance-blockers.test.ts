import { describe, it, expect } from "vitest";
import { getAdvanceBlockers, isAdvanceBlocked, type AdvanceBlocker } from "../../src/game/lib/advance-blockers.js";

describe("getAdvanceBlockers", () => {
  it("returns empty when no drama and no pending rewards", () => {
    const blockers = getAdvanceBlockers({
      dramaQueueCount: 0,
      pendingRewardChoicesCount: 0,
      rewardDecisionsCount: 0,
    });
    expect(blockers).toEqual([]);
    expect(isAdvanceBlocked(blockers)).toBe(false);
  });

  it("returns drama_unresolved when drama queue is non-empty", () => {
    const blockers = getAdvanceBlockers({
      dramaQueueCount: 2,
      pendingRewardChoicesCount: 0,
      rewardDecisionsCount: 0,
    });
    expect(blockers).toHaveLength(1);
    expect(blockers[0]!.code).toBe("drama_unresolved");
    expect(isAdvanceBlocked(blockers)).toBe(true);
  });

  it("returns rewards_pending when decisions are incomplete", () => {
    const blockers = getAdvanceBlockers({
      dramaQueueCount: 0,
      pendingRewardChoicesCount: 3,
      rewardDecisionsCount: 1,
    });
    expect(blockers).toHaveLength(1);
    expect(blockers[0]!.code).toBe("rewards_pending");
    expect(isAdvanceBlocked(blockers)).toBe(true);
  });

  it("returns no reward blocker when all rewards are resolved", () => {
    const blockers = getAdvanceBlockers({
      dramaQueueCount: 0,
      pendingRewardChoicesCount: 2,
      rewardDecisionsCount: 2,
    });
    expect(blockers).toEqual([]);
    expect(isAdvanceBlocked(blockers)).toBe(false);
  });

  it("returns both blockers when drama and rewards are unresolved", () => {
    const blockers = getAdvanceBlockers({
      dramaQueueCount: 1,
      pendingRewardChoicesCount: 2,
      rewardDecisionsCount: 0,
    });
    expect(blockers).toHaveLength(2);
    const codes = blockers.map((b: AdvanceBlocker) => b.code);
    expect(codes).toContain("drama_unresolved");
    expect(codes).toContain("rewards_pending");
    expect(isAdvanceBlocked(blockers)).toBe(true);
  });

  it("drama blocker message includes count", () => {
    const blockers = getAdvanceBlockers({
      dramaQueueCount: 3,
      pendingRewardChoicesCount: 0,
      rewardDecisionsCount: 0,
    });
    expect(blockers[0]!.message).toContain("3");
  });

  it("reward blocker message reflects remaining count", () => {
    const blockers = getAdvanceBlockers({
      dramaQueueCount: 0,
      pendingRewardChoicesCount: 5,
      rewardDecisionsCount: 2,
    });
    expect(blockers[0]!.message).toContain("3");
  });

  it("singular form for single drama card", () => {
    const blockers = getAdvanceBlockers({
      dramaQueueCount: 1,
      pendingRewardChoicesCount: 0,
      rewardDecisionsCount: 0,
    });
    expect(blockers[0]!.message).toMatch(/1 drama card before/);
  });

  it("singular form for single pending reward", () => {
    const blockers = getAdvanceBlockers({
      dramaQueueCount: 0,
      pendingRewardChoicesCount: 1,
      rewardDecisionsCount: 0,
    });
    expect(blockers[0]!.message).toMatch(/1 pending reward decision /);
  });
});
