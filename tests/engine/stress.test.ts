import { describe, it, expect } from "vitest";
import type { Agent } from "../../src/engine/types.js";
import { Rng } from "../../src/engine/prng.js";
import {
  applyStressGains,
  processAfflictionThreshold,
  driftMorale,
  applyHostileProximityStress,
  applyAfflictionBarks,
} from "../../src/engine/stress.js";
import { makeTestAgent, makeTestOrg } from "../fixtures/state-arc.js";

// ── applyStressGains ──────────────────────────────────────────────────────────

describe("applyStressGains", () => {
  it("adds stress up to cap of 10", () => {
    const a = makeTestAgent({ id: "a1", stress: 8 });
    const org = makeTestOrg([a]);
    const gains = new Map([["a1", 5]]);
    const result = applyStressGains(org, gains, 1);
    expect(result.agents["a1"]!.stress).toBe(10);
  });

  it("does not go below 0", () => {
    const a = makeTestAgent({ id: "a1", stress: 0 });
    const org = makeTestOrg([a]);
    const gains = new Map([["a1", -999]]);
    const result = applyStressGains(org, gains, 1);
    expect(result.agents["a1"]!.stress).toBe(0);
  });

  it("stoic trait reduces stress by 30%", () => {
    const a = makeTestAgent({ id: "a1", stress: 0, traits: ["stoic"] });
    const org = makeTestOrg([a]);
    const gains = new Map([["a1", 10]]);
    const result = applyStressGains(org, gains, 1);
    // 10 * 0.7 = 7, capped at 10
    expect(result.agents["a1"]!.stress).toBe(7);
  });

  it("does not mutate original org", () => {
    const a = makeTestAgent({ id: "a1", stress: 5 });
    const org = makeTestOrg([a]);
    const gains = new Map([["a1", 3]]);
    applyStressGains(org, gains, 1);
    expect(org.agents["a1"]!.stress).toBe(5);
  });

  it("applies gains to multiple agents independently", () => {
    const a = makeTestAgent({ id: "a1", stress: 2 });
    const b = makeTestAgent({ id: "a2", stress: 5 });
    const org = makeTestOrg([a, b]);
    const gains = new Map([["a1", 3], ["a2", 2]]);
    const result = applyStressGains(org, gains, 1);
    expect(result.agents["a1"]!.stress).toBe(5);
    expect(result.agents["a2"]!.stress).toBe(7);
  });
});

// ── processAfflictionThreshold ────────────────────────────────────────────────

describe("processAfflictionThreshold", () => {
  it("no event if stress < 10", () => {
    const a = makeTestAgent({ id: "a1", stress: 9 });
    const org = makeTestOrg([a]);
    const rng = new Rng(42);
    const { event } = processAfflictionThreshold(org, "a1", rng, 1);
    expect(event).toBeNull();
  });

  it("deterministic affliction roll given seed (seed 1 → affliction)", () => {
    // seed 1: first next() = ~0.166, < 0.75 → affliction
    const a = makeTestAgent({ id: "a1", stress: 10 });
    const org = makeTestOrg([a]);
    const rng = new Rng(1);
    const { event, org: result } = processAfflictionThreshold(org, "a1", rng, 1);
    expect(event).not.toBeNull();
    expect(event!.kind).toBe("affliction");
    expect(result.agents["a1"]!.afflictionState.kind).not.toBe("none");
    expect(result.agents["a1"]!.afflictionHistory.length).toBe(1);
  });

  it("hothead trait biases toward Defiant or Reckless", () => {
    // Run many seeds and verify hothead biases the affliction distribution
    const counts: Record<string, number> = {};
    for (let seed = 100; seed < 200; seed++) {
      const a = makeTestAgent({ id: "a1", stress: 10, traits: ["hothead"] });
      const org = makeTestOrg([a]);
      const rng = new Rng(seed);
      const first = rng.next(); // < 0.75 → affliction
      if (first >= 0.75) continue; // resolve — skip
      // Re-run to get affliction event
      const a2 = makeTestAgent({ id: "a1", stress: 10, traits: ["hothead"] });
      const org2 = makeTestOrg([a2]);
      const rng2 = new Rng(seed);
      const { event } = processAfflictionThreshold(org2, "a1", rng2, 1);
      if (event && event.kind === "affliction") {
        counts[event.affliction] = (counts[event.affliction] ?? 0) + 1;
      }
    }
    const defiantOrReckless = (counts["Defiant"] ?? 0) + (counts["Reckless"] ?? 0);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    // With hothead: Defiant+Reckless should be majority
    expect(defiantOrReckless / total).toBeGreaterThan(0.5);
  });

  it("resolve event resets stress to 0 and boosts witness morale", () => {
    // Find a seed that produces resolve (roll >= 0.75)
    const a = makeTestAgent({ id: "a1", stress: 10, morale: 50 });
    const w = makeTestAgent({ id: "w1", morale: 50 });
    const org = makeTestOrg([a, w]);

    // Seed 999: first next() to check for resolve
    // Find a seed that gives resolve
    let resolveSeed = 0;
    for (let s = 0; s < 10000; s++) {
      const rng = new Rng(s);
      if (rng.next() >= 0.75) { resolveSeed = s; break; }
    }

    const rng = new Rng(resolveSeed);
    const { event, org: result } = processAfflictionThreshold(org, "a1", rng, 1);
    expect(event!.kind).toBe("resolve");
    expect(result.agents["a1"]!.stress).toBe(0);
    // Witness morale boosted
    expect(result.agents["w1"]!.morale).toBeGreaterThan(50);
  });

  it("affliction history accumulates across calls", () => {
    const a = makeTestAgent({ id: "a1", stress: 10 });
    const org = makeTestOrg([a]);
    // Find an affliction seed
    let afflSeed = 0;
    for (let s = 0; s < 10000; s++) {
      const rng = new Rng(s);
      if (rng.next() < 0.75) { afflSeed = s; break; }
    }
    const { org: result } = processAfflictionThreshold(org, "a1", new Rng(afflSeed), 1);
    expect(result.agents["a1"]!.afflictionHistory).toHaveLength(1);
  });
});

// ── driftMorale ───────────────────────────────────────────────────────────────

describe("driftMorale", () => {
  it("morale drifts toward target by max 5 per cycle", () => {
    // Agent with no rewards, no streak → target ~40, current is 70 → should drop by 5
    const a = makeTestAgent({ id: "a1", morale: 70 });
    const org = makeTestOrg([a]);
    const result = driftMorale(org, 1);
    expect(result.agents["a1"]!.morale).toBeLessThan(70);
    expect(Math.abs(result.agents["a1"]!.morale - 70)).toBeLessThanOrEqual(5);
  });

  it("morale rises toward target when current is below", () => {
    // Add successful assignments to push target up
    const history: Agent["assignmentHistory"] = [
      { challengeId: "c1", cycle: 1, outcome: "success" },
      { challengeId: "c2", cycle: 2, outcome: "success" },
    ];
    const a = makeTestAgent({ id: "a1", morale: 20, assignmentHistory: history });
    const org = makeTestOrg([a]);
    const result = driftMorale(org, 3);
    expect(result.agents["a1"]!.morale).toBeGreaterThan(20);
  });

  it("does not mutate original org", () => {
    const a = makeTestAgent({ id: "a1", morale: 60 });
    const org = makeTestOrg([a]);
    driftMorale(org, 1);
    expect(org.agents["a1"]!.morale).toBe(60);
  });

  it("morale stays clamped 0-100", () => {
    const a = makeTestAgent({ id: "a1", morale: 99 });
    // lots of successes → target > 100
    const history: Agent["assignmentHistory"] = Array.from({ length: 5 }, (_, i) => ({
      challengeId: `c${i}`,
      cycle: i + 1,
      outcome: "success" as const,
    }));
    a.assignmentHistory.push(...history);
    const org = makeTestOrg([a]);
    const result = driftMorale(org, 6);
    expect(result.agents["a1"]!.morale).toBeLessThanOrEqual(100);
  });

  it("recreation level boosts morale target", () => {
    const a1 = makeTestAgent({ id: "a1", morale: 40 });
    const org = makeTestOrg([a1]);
    const orgHighRec = {
      ...org,
      infrastructure: {
        ...org.infrastructure,
        Recreation: { type: "Recreation" as const, level: 5, assignedAgents: [] },
      },
    };
    const result = driftMorale(orgHighRec, 1);
    // Higher recreation → higher target → morale should rise more
    expect(result.agents["a1"]!.morale).toBeGreaterThanOrEqual(40);
  });
});

// ── applyHostileProximityStress ───────────────────────────────────────────────

describe("applyHostileProximityStress", () => {
  it("returns +1 stress for each agent in a hostile pair on same challenge", () => {
    const a = makeTestAgent({ id: "a1" });
    const b = makeTestAgent({ id: "a2" });
    const org = makeTestOrg([a, b]);
    const orgWithRel = {
      ...org,
      relationships: [
        { agentIds: ["a1", "a2"] as [string, string], state: "Hostile" as const, affinity: -50 },
      ],
    };
    const assignments = new Map([["challenge1", ["a1", "a2"]]]);
    const deltas = applyHostileProximityStress(orgWithRel, assignments, 1);
    expect(deltas.get("a1")).toBe(1);
    expect(deltas.get("a2")).toBe(1);
  });

  it("loner trait grants immunity to hostile proximity stress", () => {
    const a = makeTestAgent({ id: "a1", traits: ["loner"] });
    const b = makeTestAgent({ id: "a2" });
    const org = makeTestOrg([a, b]);
    const orgWithRel = {
      ...org,
      relationships: [
        { agentIds: ["a1", "a2"] as [string, string], state: "Hostile" as const, affinity: -50 },
      ],
    };
    const assignments = new Map([["challenge1", ["a1", "a2"]]]);
    const deltas = applyHostileProximityStress(orgWithRel, assignments, 1);
    expect(deltas.get("a1")).toBeUndefined();
    expect(deltas.get("a2")).toBe(1);
  });

  it("no stress for non-hostile pairs", () => {
    const a = makeTestAgent({ id: "a1" });
    const b = makeTestAgent({ id: "a2" });
    const org = makeTestOrg([a, b]);
    const orgWithRel = {
      ...org,
      relationships: [
        { agentIds: ["a1", "a2"] as [string, string], state: "Allied" as const, affinity: 40 },
      ],
    };
    const assignments = new Map([["challenge1", ["a1", "a2"]]]);
    const deltas = applyHostileProximityStress(orgWithRel, assignments, 1);
    expect(deltas.size).toBe(0);
  });
});

// ── applyAfflictionBarks ──────────────────────────────────────────────────────

describe("applyAfflictionBarks", () => {
  it("Defiant agent adds +2 stress to all others on same challenge", () => {
    const history = [{ challengeId: "c1", cycle: 1, outcome: "success" as const }];
    const afflicted = makeTestAgent({
      id: "a1",
      affliction: { kind: "Defiant", sinceCycle: 1 },
      assignmentHistory: history,
    });
    const teammate = makeTestAgent({ id: "a2", assignmentHistory: history });
    const org = makeTestOrg([afflicted, teammate]);
    const rng = new Rng(42);
    const { stressGains, barks } = applyAfflictionBarks(org, rng, 1);
    expect(stressGains.get("a2")).toBe(2);
    expect(barks.some((b) => b.targetAgentId === "a2" && b.stressAmount === 2)).toBe(true);
  });

  it("Withdrawn agent produces no barks", () => {
    const history = [{ challengeId: "c1", cycle: 1, outcome: "success" as const }];
    const afflicted = makeTestAgent({
      id: "a1",
      affliction: { kind: "Withdrawn", sinceCycle: 1 },
      assignmentHistory: history,
    });
    const teammate = makeTestAgent({ id: "a2", assignmentHistory: history });
    const org = makeTestOrg([afflicted, teammate]);
    const rng = new Rng(42);
    const { barks } = applyAfflictionBarks(org, rng, 1);
    expect(barks).toHaveLength(0);
  });

  it("Resentful agent targets highest performer", () => {
    const history = [{ challengeId: "c1", cycle: 1, outcome: "success" as const }];
    const historySuccess = Array.from({ length: 5 }, (_, i) => ({
      challengeId: "c1",
      cycle: i + 1,
      outcome: "success" as const,
    }));
    const afflicted = makeTestAgent({
      id: "a1",
      affliction: { kind: "Resentful", sinceCycle: 1 },
      assignmentHistory: history,
    });
    const lowPerf = makeTestAgent({ id: "a2", assignmentHistory: history });
    const highPerf = makeTestAgent({ id: "a3", assignmentHistory: historySuccess });
    // a3 is on same challenge as a1
    highPerf.assignmentHistory[0]!.challengeId = "c1";
    const org = makeTestOrg([afflicted, lowPerf, highPerf]);
    // Set all on same challenge
    const rng = new Rng(42);
    const { barks } = applyAfflictionBarks(org, rng, 1);
    // Resentful should target highest performer (a3)
    expect(barks.some((b) => b.sourceAgentId === "a1" && b.targetAgentId === "a3")).toBe(true);
  });

  it("Fearful agent propagates to at most 2 nearby agents", () => {
    const history = [{ challengeId: "c1", cycle: 1, outcome: "success" as const }];
    const afflicted = makeTestAgent({
      id: "a1",
      affliction: { kind: "Fearful", sinceCycle: 1 },
      assignmentHistory: history,
    });
    const t1 = makeTestAgent({ id: "a2", assignmentHistory: history });
    const t2 = makeTestAgent({ id: "a3", assignmentHistory: history });
    const t3 = makeTestAgent({ id: "a4", assignmentHistory: history });
    const org = makeTestOrg([afflicted, t1, t2, t3]);
    const rng = new Rng(42);
    const { barks } = applyAfflictionBarks(org, rng, 1);
    const fromA1 = barks.filter((b) => b.sourceAgentId === "a1");
    expect(fromA1.length).toBeLessThanOrEqual(2);
  });

  it("Fearful bark targets are stable across agent insertion order", () => {
    const history = [{ challengeId: "c1", cycle: 1, outcome: "success" as const }];
    const afflicted = makeTestAgent({
      id: "a1",
      affliction: { kind: "Fearful", sinceCycle: 1 },
      assignmentHistory: history,
    });
    const teammates = ["a2", "a3", "a4", "a5", "a6"].map((id) =>
      makeTestAgent({ id, assignmentHistory: history }),
    );

    const canonicalOrg = makeTestOrg([afflicted, ...teammates]);
    const permutedOrg = makeTestOrg([...teammates].reverse().concat(afflicted));

    const canonical = applyAfflictionBarks(canonicalOrg, new Rng(42), 1);
    const permuted = applyAfflictionBarks(permutedOrg, new Rng(42), 1);

    expect(canonical.barks).toEqual(permuted.barks);
    expect([...canonical.stressGains.entries()].sort()).toEqual(
      [...permuted.stressGains.entries()].sort(),
    );
  });

  it("unafflicted agents produce no barks", () => {
    const a = makeTestAgent({ id: "a1" }); // no affliction
    const b = makeTestAgent({ id: "a2" });
    const org = makeTestOrg([a, b]);
    const rng = new Rng(42);
    const { barks } = applyAfflictionBarks(org, rng, 1);
    expect(barks).toHaveLength(0);
  });
});
