import { describe, it, expect } from "vitest";
import type { Precedent } from "../../src/engine/types.js";
import {
  logPrecedent,
  scanPrecedents,
  consistencyScore,
  detectPrecedentViolation,
} from "../../src/engine/precedents.js";
import { makeTestAgent, makeTestOrg } from "../fixtures/state-arc.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePrecedent(
  cycle: number,
  decisionBasis: Precedent["decisionBasis"],
  type: Precedent["type"] = "reward",
): Precedent {
  return {
    cycle,
    type,
    decisionBasis,
    agentsInvolved: ["a1", "a2"],
    winner: "a1",
    context: {},
  };
}

// ── logPrecedent ──────────────────────────────────────────────────────────────

describe("logPrecedent", () => {
  it("appends the precedent to the org's precedents list", () => {
    const org = makeTestOrg([]);
    const p = makePrecedent(1, "merit");
    const result = logPrecedent(org, p);
    expect(result.precedents).toHaveLength(1);
    expect(result.precedents[0]).toEqual(p);
  });

  it("does not mutate the original org", () => {
    const org = makeTestOrg([]);
    const p = makePrecedent(1, "merit");
    logPrecedent(org, p);
    expect(org.precedents).toHaveLength(0);
  });
});

// ── scanPrecedents ────────────────────────────────────────────────────────────

describe("scanPrecedents", () => {
  it("returns only precedents of the requested type", () => {
    const org = makeTestOrg([]);
    const orgWithP = [
      logPrecedent(org, makePrecedent(1, "merit", "reward")),
      logPrecedent(org, makePrecedent(2, "merit", "promotion")),
    ].reduce((acc, cur) => ({
      ...acc,
      precedents: [...acc.precedents, ...cur.precedents],
    }), org);

    const results = scanPrecedents(orgWithP, "reward", 10);
    expect(results.every((p) => p.type === "reward")).toBe(true);
  });

  it("respects the lookback limit", () => {
    let org = makeTestOrg([]);
    for (let i = 1; i <= 8; i++) {
      org = logPrecedent(org, makePrecedent(i, "merit", "reward"));
    }
    const results = scanPrecedents(org, "reward", 5);
    expect(results).toHaveLength(5);
    // Should return the most recent 5
    expect(results[results.length - 1]!.cycle).toBe(8);
  });

  it("returns empty array when no matching type exists", () => {
    const org = makeTestOrg([]);
    const results = scanPrecedents(org, "promotion", 10);
    expect(results).toHaveLength(0);
  });
});

// ── consistencyScore ──────────────────────────────────────────────────────────

describe("consistencyScore", () => {
  it("returns 0 for an empty precedents list", () => {
    expect(consistencyScore([], "merit")).toBe(0);
  });

  it("returns 1.0 when all precedents share the same basis", () => {
    const precedents = [
      makePrecedent(1, "merit"),
      makePrecedent(2, "merit"),
      makePrecedent(3, "merit"),
    ];
    expect(consistencyScore(precedents, "merit")).toBe(1.0);
  });

  it("returns 0.5 when half the precedents match the basis", () => {
    const precedents = [
      makePrecedent(1, "merit"),
      makePrecedent(2, "merit"),
      makePrecedent(3, "seniority"),
      makePrecedent(4, "seniority"),
    ];
    expect(consistencyScore(precedents, "merit")).toBe(0.5);
  });

  it("returns 0 when no precedents match the basis", () => {
    const precedents = [
      makePrecedent(1, "favoritism"),
      makePrecedent(2, "favoritism"),
    ];
    expect(consistencyScore(precedents, "merit")).toBe(0);
  });
});

// ── detectPrecedentViolation ──────────────────────────────────────────────────

describe("detectPrecedentViolation", () => {
  it("does not flag a violation when history is shorter than 3 precedents", () => {
    const agent = makeTestAgent({ id: "a1", ambition: 15 });
    let org = makeTestOrg([agent]);
    org = logPrecedent(org, makePrecedent(1, "merit"));
    org = logPrecedent(org, makePrecedent(2, "merit"));

    const newP = makePrecedent(3, "favoritism");
    const { violated } = detectPrecedentViolation(org, newP, [agent]);
    expect(violated).toBe(false);
  });

  it("detects a violation when dominant basis >= 70% and new decision breaks the pattern", () => {
    const agent = makeTestAgent({ id: "a1", ambition: 15 });
    let org = makeTestOrg([agent]);
    // Establish a merit precedent pattern (4 out of 4 = 100%)
    for (let i = 1; i <= 4; i++) {
      org = logPrecedent(org, makePrecedent(i, "merit"));
    }

    const newP = makePrecedent(5, "favoritism");
    const { violated, affectedAgents } = detectPrecedentViolation(org, newP, [agent]);
    expect(violated).toBe(true);
    expect(affectedAgents).toContain("a1");
  });

  it("does not affect low-ambition agents (ambition <= 12)", () => {
    const lowAmbition = makeTestAgent({ id: "a1", ambition: 8 });
    let org = makeTestOrg([lowAmbition]);
    for (let i = 1; i <= 4; i++) {
      org = logPrecedent(org, makePrecedent(i, "merit"));
    }

    const newP = makePrecedent(5, "favoritism");
    const { affectedAgents } = detectPrecedentViolation(org, newP, [lowAmbition]);
    expect(affectedAgents).not.toContain("a1");
  });

  it("no violation when new decision matches the established pattern", () => {
    const agent = makeTestAgent({ id: "a1", ambition: 15 });
    let org = makeTestOrg([agent]);
    for (let i = 1; i <= 4; i++) {
      org = logPrecedent(org, makePrecedent(i, "merit"));
    }

    const newP = makePrecedent(5, "merit");
    const { violated } = detectPrecedentViolation(org, newP, [agent]);
    expect(violated).toBe(false);
  });

  it("loyalty delta is negative when violation is detected", () => {
    const agent = makeTestAgent({ id: "a1", ambition: 18 });
    let org = makeTestOrg([agent]);
    for (let i = 1; i <= 4; i++) {
      org = logPrecedent(org, makePrecedent(i, "merit"));
    }

    const newP = makePrecedent(5, "favoritism");
    const { loyaltyDeltas } = detectPrecedentViolation(org, newP, [agent]);
    expect(loyaltyDeltas.get("a1")).toBeLessThan(0);
  });
});
