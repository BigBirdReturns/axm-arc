import { describe, it, expect } from "vitest";
import {
  accrueChallengeRewards,
  chargeUpkeep,
  REPEAT_CLEAR_REWARD_FACTOR,
  spendTokens,
} from "../../src/engine/economy.js";
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

describe("token debit law", () => {
  it("accepts only non-negative safe integers", () => {
    const org = makeCycleOrg([], { tokens: 5 });
    for (const invalid of [-1, 0.5, Number.NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => spendTokens(org, invalid)).toThrow(/Invalid token spend/);
      expect(org.resources.tokens).toBe(5);
    }
  });

  it("is all-or-nothing and never returns a negative balance", () => {
    const org = makeCycleOrg([], { tokens: 5 });
    expect(spendTokens(org, 0)).toEqual(org);
    expect(spendTokens(org, 5).resources.tokens).toBe(0);
    expect(() => spendTokens(org, 6)).toThrow(/Insufficient tokens/);
    expect(org.resources.tokens).toBe(5);
  });
});

describe("upkeep settlement", () => {
  it("records an explicit shortfall instead of creating negative currency", () => {
    const agents = [
      makeCycleAgent({ id: "a", upkeep: 4 }),
      makeCycleAgent({ id: "b", upkeep: 5 }),
    ];
    const result = chargeUpkeep(makeCycleOrg(agents, { currency: 3 }), 1);

    expect(result.resources.currency).toBe(0);
    expect(result.upkeepDue).toBe(9);
    expect(result.upkeepPaid).toBe(3);
    expect(result.unpaidUpkeep).toBe(6);
    expect(result.negativeBalance).toBe(true);
  });

  it("settles exact funds without a shortfall", () => {
    const result = chargeUpkeep(
      makeCycleOrg([makeCycleAgent({ id: "a", upkeep: 4 })], { currency: 4 }),
      1,
    );

    expect(result.resources.currency).toBe(0);
    expect(result.upkeepPaid).toBe(4);
    expect(result.unpaidUpkeep).toBe(0);
    expect(result.negativeBalance).toBeUndefined();
  });

  it("repairs a legacy negative treasury without reporting a negative payment", () => {
    const result = chargeUpkeep(
      makeCycleOrg([makeCycleAgent({ id: "a", upkeep: 4 })], { currency: -3 }),
      1,
    );

    expect(result.resources.currency).toBe(0);
    expect(result.upkeepPaid).toBe(0);
    expect(result.unpaidUpkeep).toBe(4);
    expect(result.negativeBalance).toBe(true);
  });
});
