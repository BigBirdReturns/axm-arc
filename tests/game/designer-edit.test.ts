import { describe, it, expect } from "vitest";
import {
  clampAttribute,
  statBudgetStatus,
  tierRank,
  isItemLocked,
  computeItemBonuses,
  toggleTrait,
  toggleEquip,
  nextCopyId,
} from "../../src/game/lib/designer-edit.js";
import { computeBaseEfficiency, generateAgent } from "../../src/engine/character.js";
import { Rng } from "../../src/engine/prng.js";
import { DEFAULT_TRAIT_POOL } from "../../src/engine/constants.js";
import { MINI_ARC, MINI_TANK, MINI_ELITE_TIER, makeAgent } from "../fixtures/mini-arc.js";

describe("clampAttribute", () => {
  it("passes through legal values unchanged", () => {
    expect(clampAttribute(10)).toBe(10);
    expect(clampAttribute(1)).toBe(1);
    expect(clampAttribute(20)).toBe(20);
  });

  it("clamps below the floor", () => {
    expect(clampAttribute(0)).toBe(1);
    expect(clampAttribute(-5)).toBe(1);
  });

  it("clamps above the ceiling", () => {
    expect(clampAttribute(21)).toBe(20);
    expect(clampAttribute(999)).toBe(20);
  });

  it("rounds fractional input", () => {
    expect(clampAttribute(10.6)).toBe(11);
    expect(clampAttribute(10.4)).toBe(10);
  });

  it("never throws or NaNs on non-finite input", () => {
    expect(clampAttribute(NaN)).toBe(1);
    expect(clampAttribute(Infinity)).toBe(20);
    expect(clampAttribute(-Infinity)).toBe(1);
  });
});

describe("statBudgetStatus", () => {
  it("classifies under, within, and over without throwing", () => {
    expect(statBudgetStatus(MINI_TANK.statBudgetMin - 1, MINI_TANK)).toBe("under");
    expect(statBudgetStatus(MINI_TANK.statBudgetMin, MINI_TANK)).toBe("within");
    expect(statBudgetStatus(MINI_TANK.statBudgetMax, MINI_TANK)).toBe("within");
    expect(statBudgetStatus(MINI_TANK.statBudgetMax + 1, MINI_TANK)).toBe("over");
  });

  it("never throws when tier is missing — degrades to within", () => {
    expect(() => statBudgetStatus(999, undefined)).not.toThrow();
    expect(statBudgetStatus(999, undefined)).toBe("within");
  });
});

describe("tierRank / isItemLocked", () => {
  const item = MINI_ARC.items.find((i) => i.id === "sword-of-dawn")!;

  it("ranks tiers by index in arc.tiers", () => {
    expect(tierRank(MINI_ARC, "common")).toBe(0);
    expect(tierRank(MINI_ARC, "elite")).toBe(1);
  });

  it("unknown tier ids rank to +Infinity instead of throwing", () => {
    expect(() => tierRank(MINI_ARC, "nonexistent")).not.toThrow();
    expect(tierRank(MINI_ARC, "nonexistent")).toBe(Number.POSITIVE_INFINITY);
  });

  it("item is unlocked when agent tier is at or above the requirement", () => {
    expect(isItemLocked(MINI_ARC, item, "common")).toBe(false); // equal
    expect(isItemLocked(MINI_ARC, item, "elite")).toBe(false); // above
  });

  it("item is locked when agent tier ranks below the requirement", () => {
    const eliteOnlyItem = { ...item, tierRequirement: "elite" };
    expect(isItemLocked(MINI_ARC, eliteOnlyItem, "common")).toBe(true);
  });

  it("unknown agent tier doesn't crash isItemLocked", () => {
    expect(() => isItemLocked(MINI_ARC, item, "nonexistent")).not.toThrow();
    // Unknown agent tier ranks to +Infinity, so it can never look locked.
    expect(isItemLocked(MINI_ARC, item, "nonexistent")).toBe(false);
  });
});

describe("computeItemBonuses", () => {
  it("sums stat bonuses from equipped items", () => {
    const bonuses = computeItemBonuses(MINI_ARC, { weapon: "sword-of-dawn", offhand: "shield-shard" });
    expect(bonuses).toEqual({ power: 3, reflex: 1 + 2 });
  });

  it("ignores unknown/stale item ids without throwing", () => {
    expect(() => computeItemBonuses(MINI_ARC, { weapon: "does-not-exist" })).not.toThrow();
    expect(computeItemBonuses(MINI_ARC, { weapon: "does-not-exist" })).toEqual({});
  });

  it("returns empty object for no equipped items", () => {
    expect(computeItemBonuses(MINI_ARC, {})).toEqual({});
  });
});

describe("toggleTrait", () => {
  it("adds a trait not present", () => {
    expect(toggleTrait(["a"], "b")).toEqual(["a", "b"]);
  });

  it("removes a trait already present", () => {
    expect(toggleTrait(["a", "b"], "a")).toEqual(["b"]);
  });

  it("has no min/max count — can toggle down to zero and up past three", () => {
    expect(toggleTrait([], "a")).toEqual(["a"]);
    expect(toggleTrait(["a", "b"], "a")).toEqual(["b"]);
    expect(toggleTrait(["a", "b", "c"], "d")).toEqual(["a", "b", "c", "d"]);
  });
});

describe("toggleEquip", () => {
  it("equips into an empty slot", () => {
    expect(toggleEquip({}, "weapon", "sword-of-dawn")).toEqual({ weapon: "sword-of-dawn" });
  });

  it("unequips when clicking the already-equipped item", () => {
    expect(toggleEquip({ weapon: "sword-of-dawn" }, "weapon", "sword-of-dawn")).toEqual({});
  });

  it("swaps in a different item for the same slot", () => {
    expect(toggleEquip({ weapon: "sword-of-dawn" }, "weapon", "axe")).toEqual({ weapon: "axe" });
  });

  it("does not mutate the input object", () => {
    const original = { weapon: "sword-of-dawn" };
    toggleEquip(original, "weapon", "axe");
    expect(original).toEqual({ weapon: "sword-of-dawn" });
  });
});

describe("computeBaseEfficiency parity with generateAgent", () => {
  it("matches the baseEfficiency generateAgent produces for the same tier/traits", () => {
    for (const seed of [1, 2, 3, 42, 100]) {
      const agent = makeAgent(seed);
      const tier = agent.tier === "elite" ? MINI_ELITE_TIER : MINI_TANK;
      expect(computeBaseEfficiency(MINI_ARC, tier, agent.traits)).toBe(agent.baseEfficiency);
    }
  });

  it("industrious multiplies base efficiency by 1.3x, matching generateAgent's rule", () => {
    const withoutIndustrious = computeBaseEfficiency(MINI_ARC, MINI_TANK, []);
    const withIndustrious = computeBaseEfficiency(MINI_ARC, MINI_TANK, ["industrious"]);
    expect(withIndustrious).toBeCloseTo(withoutIndustrious * 1.3, 10);
  });

  it("is independent of the actual attribute distribution (matches generateAgent's dead-code-confirmed formula)", () => {
    const rng = new Rng(7);
    const rolled = generateAgent({ rng, tier: MINI_TANK, arc: MINI_ARC, cycle: 1 });
    const recomputed = computeBaseEfficiency(MINI_ARC, MINI_TANK, rolled.traits);
    expect(recomputed).toBe(rolled.baseEfficiency);
  });

  it("common tier yields higher base efficiency than elite tier (higher budget = lower efficiency)", () => {
    const common = computeBaseEfficiency(MINI_ARC, MINI_TANK, []);
    const elite = computeBaseEfficiency(MINI_ARC, MINI_ELITE_TIER, []);
    expect(common).toBeGreaterThan(elite);
  });
});

describe("engine legality after a sequence of editor patches", () => {
  // Mirrors DesignerScreen's patchAgent: merge a partial edit, then reconcile
  // upkeep/baseEfficiency through the same helper generateAgent uses. No
  // component/React involved — this only exercises the pure pieces the
  // editor is built from, proving their guarantees hold under composition.
  function reconcile(agent: ReturnType<typeof makeAgent>, patch: Partial<ReturnType<typeof makeAgent>>) {
    const merged = { ...agent, ...patch };
    const tier = merged.tier === "elite" ? MINI_ELITE_TIER : MINI_TANK;
    return { ...merged, upkeep: tier.upkeepCost, baseEfficiency: computeBaseEfficiency(MINI_ARC, tier, merged.traits) };
  }

  it("keeps attribute keys, role, and traits legal through tier change → role change → trait toggles", () => {
    let agent = makeAgent(21, { tierId: "common", preferredRoleId: "striker" });

    agent = reconcile(agent, { tier: "elite" });
    agent = reconcile(agent, { role: "guardian" });
    agent = reconcile(agent, { role: null }); // Flex
    agent = reconcile(agent, { traits: toggleTrait(agent.traits, "industrious") });
    agent = reconcile(agent, { traits: toggleTrait(agent.traits, "greedy") });
    agent = reconcile(agent, { attributes: { ...agent.attributes, power: clampAttribute(25) } });

    const attrIds = new Set(MINI_ARC.attributes.map((a) => a.id));
    // Attribute keys still exactly match arc.attributes ids — no drift, no
    // stray/missing keys after a tier change (which never re-rolls stats).
    expect(new Set(Object.keys(agent.attributes))).toEqual(attrIds);

    // Role is either null (Flex) or one of the arc's real roles.
    const roleIds = new Set(MINI_ARC.roles.map((r) => r.id));
    expect(agent.role === null || roleIds.has(agent.role)).toBe(true);

    // Traits are a subset of the full pool (custom + default), deduplicated.
    const poolIds = new Set([...MINI_ARC.customTraits, ...DEFAULT_TRAIT_POOL].map((t) => t.id));
    for (const t of agent.traits) expect(poolIds.has(t)).toBe(true);
    expect(new Set(agent.traits).size).toBe(agent.traits.length);

    // Derived fields reconciled to the new (elite) tier, not stale from common.
    expect(agent.upkeep).toBe(MINI_ELITE_TIER.upkeepCost);
    expect(agent.tier).toBe("elite");

    // Attribute value clamped in range even after a deliberately out-of-range input.
    expect(agent.attributes.power).toBeGreaterThanOrEqual(1);
    expect(agent.attributes.power).toBeLessThanOrEqual(20);
  });
});

describe("nextCopyId", () => {
  it("mints distinct ids across a duplicate/delete/duplicate sequence", () => {
    // Reproduce DesignerScreen's roster mutation at the id level.
    let ids = ["A"];
    const c1 = nextCopyId(ids, "A"); ids = [...ids, c1];   // A-copy-1
    const c2 = nextCopyId(ids, "A"); ids = [...ids, c2];   // A-copy-2
    ids = ids.filter((id) => id !== c1);                   // delete first copy → [A, A-copy-2]
    const c3 = nextCopyId(ids, "A"); ids = [...ids, c3];   // must NOT collide with A-copy-2
    expect(new Set(ids).size).toBe(ids.length);
    expect(c3).not.toBe(c2);
  });

  it("returns the first copy suffix for a fresh source", () => {
    expect(nextCopyId(["A"], "A")).toBe("A-copy-1");
  });

  it("preserves additive-path ids (no regression when nothing is deleted)", () => {
    expect(nextCopyId(["A"], "A")).toBe("A-copy-1");
    expect(nextCopyId(["A", "A-copy-1"], "A")).toBe("A-copy-2");
  });

  it("ignores non-matching and non-integer suffixes", () => {
    expect(nextCopyId(["A", "A-copy-x", "B-copy-9"], "A")).toBe("A-copy-1");
  });
});
