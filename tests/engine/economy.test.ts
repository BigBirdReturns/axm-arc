import { describe, it, expect } from "vitest";
import { accrueChallengeRewards, REPEAT_CLEAR_REWARD_FACTOR } from "../../src/engine/economy.js";
import { FIRST_CHARTER } from "../../src/arcs/index.js";
import { makeCycleOrg, makeCycleAgent } from "../fixtures/cycle-arc.js";
import type { RunReport } from "../../src/engine/types.js";

function report(challengeId: string, outcome: RunReport["outcome"], cycle = 1): RunReport {
  return {
    challengeId,
    outcome,
    cycle,
    assignedAgents: [],
    lootDrops: [],
    dramaTriggers: [],
    narrativeSeed: 0,
  };
}

describe("accrueChallengeRewards currency", () => {
  it("awards currency and reputation on a first successful clear", () => {
    const org = makeCycleOrg([], { currency: 100, reputation: 0 });
    const next = accrueChallengeRewards(org, report("cellar", "success"), FIRST_CHARTER);
    expect(next.currencyGranted).toBe(30);
    expect(next.reputationGranted).toBe(1);
    expect(next.org.resources.currency).toBe(130);
    expect(next.org.reputation).toBe(1);
  });

  it("awards no currency on failure", () => {
    const org = makeCycleOrg([], { currency: 100 });
    const next = accrueChallengeRewards(org, report("cellar", "failure"), FIRST_CHARTER);
    expect(next.currencyGranted).toBe(0);
    expect(next.org.resources.currency).toBe(100);
  });

  it("scales the first-clear currency reward with challenge difficulty", () => {
    const org = makeCycleOrg([], { currency: 0 });
    const next = accrueChallengeRewards(org, report("wardens-keep", "success"), FIRST_CHARTER);
    expect(next.currencyGranted).toBe(180);
  });

  it("pays a reduced currency reward and no reputation when re-clearing (farm guard)", () => {
    const veteran = {
      ...makeCycleAgent({ id: "vet" }),
      assignmentHistory: [{ challengeId: "cellar", cycle: 1, outcome: "success" as const }],
    };
    const org = makeCycleOrg([veteran], { currency: 0, reputation: 0 });
    const next = accrueChallengeRewards(org, report("cellar", "success", 3), FIRST_CHARTER);
    expect(next.currencyGranted).toBe(Math.floor(30 * REPEAT_CLEAR_REWARD_FACTOR));
    expect(next.reputationGranted).toBe(0);
    expect(next.org.resources.currency).toBe(Math.floor(30 * REPEAT_CLEAR_REWARD_FACTOR));
    expect(next.org.reputation).toBe(0);
  });
});
