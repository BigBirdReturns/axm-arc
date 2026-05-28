import { describe, it, expect } from "vitest";
import { accrueChallengeRewards } from "../../src/engine/economy.js";
import { FIRST_CHARTER } from "../../src/arcs/index.js";
import { makeCycleOrg } from "../fixtures/cycle-arc.js";
import type { RunReport } from "../../src/engine/types.js";

function report(challengeId: string, outcome: RunReport["outcome"]): RunReport {
  return {
    challengeId,
    outcome,
    cycle: 1,
    assignedAgents: [],
    lootDrops: [],
    dramaTriggers: [],
    narrativeSeed: 0,
  };
}

describe("accrueChallengeRewards currency", () => {
  it("awards currency and reputation on a successful challenge", () => {
    const org = makeCycleOrg([], { currency: 100, reputation: 0 });
    const next = accrueChallengeRewards(org, report("cellar", "success"), FIRST_CHARTER);
    expect(next.resources.currency).toBe(130);
    expect(next.reputation).toBe(1);
  });

  it("awards no currency on failure", () => {
    const org = makeCycleOrg([], { currency: 100 });
    const next = accrueChallengeRewards(org, report("cellar", "failure"), FIRST_CHARTER);
    expect(next.resources.currency).toBe(100);
  });

  it("scales the currency reward with challenge difficulty", () => {
    const org = makeCycleOrg([], { currency: 0 });
    const next = accrueChallengeRewards(org, report("wardens-keep", "success"), FIRST_CHARTER);
    expect(next.resources.currency).toBe(180);
  });
});
