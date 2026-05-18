import { describe, it, expect } from "vitest";
import { Rng } from "../../src/engine/prng";
import { generateAgent } from "../../src/engine/character";
import { MINI_ARC, MINI_TANK, MINI_ELITE_TIER, makeAgent } from "../fixtures/mini-arc";

describe("generateAgent", () => {
  it("is deterministic: same seed → identical agent", () => {
    const a1 = makeAgent(42);
    const a2 = makeAgent(42);
    expect(a1).toEqual(a2);
  });

  it("different seeds → different agents", () => {
    const a1 = makeAgent(1);
    const a2 = makeAgent(2);
    expect(a1.id).not.toBe(a2.id);
  });

  it("stat sum is within tier budget range", () => {
    for (const seed of [10, 20, 30, 40, 50]) {
      const agent = makeAgent(seed);
      const sum = Object.values(agent.attributes).reduce((s, v) => s + v, 0);
      expect(sum).toBeGreaterThanOrEqual(MINI_TANK.statBudgetMin - 2);
      expect(sum).toBeLessThanOrEqual(MINI_TANK.statBudgetMax + 2);
    }
  });

  it("traits count is 2 or 3", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const agent = makeAgent(seed);
      expect(agent.traits.length).toBeGreaterThanOrEqual(2);
      expect(agent.traits.length).toBeLessThanOrEqual(3);
    }
  });

  it("traits are deduplicated", () => {
    for (const seed of [1, 2, 3, 100, 200]) {
      const agent = makeAgent(seed);
      const unique = new Set(agent.traits);
      expect(unique.size).toBe(agent.traits.length);
    }
  });

  it("first trait is visible at recruit (revealedTraits = 1)", () => {
    const agent = makeAgent(99);
    expect(agent.revealedTraits).toBe(1);
    expect(agent.traits.length).toBeGreaterThanOrEqual(1);
  });

  it("common tier has higher base efficiency than elite tier", () => {
    const common = makeAgent(77, { tierId: "common" });
    const elite = makeAgent(77, { tierId: "elite" });
    expect(common.baseEfficiency).toBeGreaterThan(elite.baseEfficiency);
  });

  it("morale=50, stress=0, empty histories on fresh agent", () => {
    const agent = makeAgent(55);
    expect(agent.morale).toBe(50);
    expect(agent.stress).toBe(0);
    expect(agent.assignmentHistory).toHaveLength(0);
    expect(agent.afflictionHistory).toHaveLength(0);
    expect(agent.rewardHistory).toHaveLength(0);
    expect(agent.afflictionState).toEqual({ kind: "none" });
  });

  it("upkeep matches tier upkeep cost", () => {
    const common = makeAgent(10, { tierId: "common" });
    expect(common.upkeep).toBe(MINI_TANK.upkeepCost);
    const elite = makeAgent(10, { tierId: "elite" });
    expect(elite.upkeep).toBe(MINI_ELITE_TIER.upkeepCost);
  });

  it("all arc attribute IDs are present in agent attributes", () => {
    const agent = makeAgent(33);
    for (const attr of MINI_ARC.attributes) {
      expect(agent.attributes[attr.id]).toBeDefined();
    }
  });
});
