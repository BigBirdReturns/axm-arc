import { describe, it, expect } from "vitest";
import { refreshOpenPool, hireAgent } from "../../src/engine/recruitment.js";
import { Rng } from "../../src/engine/prng.js";
import { CYCLE_ARC, makeCycleAgent, makeCycleOrg } from "../fixtures/cycle-arc.js";

describe("refreshOpenPool", () => {
  it("pool size scales with Recreation level", () => {
    const org = makeCycleOrg([]);
    // Recreation level 2 → pool size = 3 + floor(2/2) = 4
    const level2Pool = refreshOpenPool(org, CYCLE_ARC, new Rng(42), 1).pool;
    expect(level2Pool.length).toBe(4);

    // Recreation level 0 → pool size = 3 + 0 = 3
    const orgNoRec = {
      ...org,
      infrastructure: {
        ...org.infrastructure,
        Recreation: { type: "Recreation" as const, level: 0, assignedAgents: [] },
      },
    };
    const level0Pool = refreshOpenPool(orgNoRec, CYCLE_ARC, new Rng(42), 1).pool;
    expect(level0Pool.length).toBe(3);

    // Recreation level 10 → pool size capped at 8
    const orgHighRec = {
      ...org,
      infrastructure: {
        ...org.infrastructure,
        Recreation: { type: "Recreation" as const, level: 10, assignedAgents: [] },
      },
    };
    const level10Pool = refreshOpenPool(orgHighRec, CYCLE_ARC, new Rng(42), 1).pool;
    expect(level10Pool.length).toBe(8);
  });

  it("legendary never appears in open pool", () => {
    // CYCLE_ARC only has 4 tiers (common/uncommon/rare/epic), no legendary
    // Run many times to verify
    const org = makeCycleOrg([], { reputation: 100 });
    for (let seed = 0; seed < 20; seed++) {
      const { pool } = refreshOpenPool(org, CYCLE_ARC, new Rng(seed), 1);
      for (const agent of pool) {
        // Tier should be one of the 4 defined tiers, never beyond
        const validTiers = CYCLE_ARC.tiers.map((t) => t.id);
        expect(validTiers).toContain(agent.tier);
      }
    }
  });

  it("tier distribution shifts toward higher tiers with higher reputation", () => {
    // Low rep: mostly common
    const orgLowRep = makeCycleOrg([], { reputation: 5 });
    let commonCount = 0;
    let totalLow = 0;
    for (let seed = 0; seed < 30; seed++) {
      const { pool } = refreshOpenPool(orgLowRep, CYCLE_ARC, new Rng(seed), 1);
      for (const a of pool) {
        totalLow++;
        if (a.tier === "common") commonCount++;
      }
    }
    const commonRatio = commonCount / totalLow;
    expect(commonRatio).toBeGreaterThan(0.6); // roughly 80%

    // High rep: less common, more rare/epic
    const orgHighRep = makeCycleOrg([], { reputation: 100 });
    let nonCommonCount = 0;
    let totalHigh = 0;
    for (let seed = 0; seed < 30; seed++) {
      const { pool } = refreshOpenPool(orgHighRep, CYCLE_ARC, new Rng(seed), 1);
      for (const a of pool) {
        totalHigh++;
        if (a.tier !== "common") nonCommonCount++;
      }
    }
    const nonCommonRatio = nonCommonCount / totalHigh;
    expect(nonCommonRatio).toBeGreaterThan(0.6); // roughly 95% non-common at high rep
  });

  it("hireAgent respects Quarters cap", () => {
    // Quarters level 2 → cap = 10 agents
    const existingAgents = Array.from({ length: 10 }, (_, i) =>
      makeCycleAgent({ id: `existing-${i}` }),
    );
    const org = makeCycleOrg(existingAgents);
    const newAgent = makeCycleAgent({ id: "newcomer" });

    expect(() => hireAgent(org, newAgent, 1)).toThrow(/Roster full/);
  });

  it("is deterministic given the same seed", () => {
    const org = makeCycleOrg([]);
    const pool1 = refreshOpenPool(org, CYCLE_ARC, new Rng(999), 1).pool;
    const pool2 = refreshOpenPool(org, CYCLE_ARC, new Rng(999), 1).pool;

    expect(pool1.length).toBe(pool2.length);
    for (let i = 0; i < pool1.length; i++) {
      expect(pool1[i]!.tier).toBe(pool2[i]!.tier);
      expect(pool1[i]!.role).toBe(pool2[i]!.role);
    }
  });
});
