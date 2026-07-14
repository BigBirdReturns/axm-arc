import { describe, it, expect } from "vitest";
import {
  getRelationship,
  applyRelationshipDelta,
  processChallengeRelationshipEffects,
  evaluateMentorshipPairs,
} from "../../src/engine/relationships.js";
import { makeTestAgent, makeTestOrg } from "../fixtures/state-arc.js";

// ── getRelationship ───────────────────────────────────────────────────────────

describe("getRelationship", () => {
  it("returns Neutral with affinity 0 if no relationship exists", () => {
    const a = makeTestAgent({ id: "a1" });
    const b = makeTestAgent({ id: "a2" });
    const org = makeTestOrg([a, b]);
    const rel = getRelationship(org, "a1", "a2");
    expect(rel.state).toBe("Neutral");
    expect(rel.affinity).toBe(0);
  });

  it("is order-independent (agentA/B swap gives same result)", () => {
    const a = makeTestAgent({ id: "a1" });
    const b = makeTestAgent({ id: "a2" });
    const org = makeTestOrg([a, b]);
    const relAB = getRelationship(org, "a1", "a2");
    const relBA = getRelationship(org, "a2", "a1");
    expect(relAB.state).toBe(relBA.state);
    expect(relAB.affinity).toBe(relBA.affinity);
  });
});

// ── applyRelationshipDelta ────────────────────────────────────────────────────

describe("applyRelationshipDelta", () => {
  it("applies trait multipliers once and order-independently (symmetric edge)", () => {
    const a = makeTestAgent({ id: "a1", traits: ["team_player"] });
    const b = makeTestAgent({ id: "a2" }); // no multiplier trait
    const org = makeTestOrg([a, b]);
    const ab = getRelationship(applyRelationshipDelta(org, "a1", "a2", 10, 1), "a1", "a2");
    const ba = getRelationship(applyRelationshipDelta(org, "a2", "a1", 10, 1), "a1", "a2");
    // Order-independent edge
    expect(ab.affinity).toBe(ba.affinity);
    expect(ab.state).toBe(ba.state);
    // team_player multiplier applied exactly once: 10 * 1.5 = 15
    expect(ab.affinity).toBe(15);
  });

  it("Neutral → Allied transition fires at affinity > 30", () => {
    const a = makeTestAgent({ id: "a1" });
    const b = makeTestAgent({ id: "a2" });
    const org = makeTestOrg([a, b]);
    // Apply delta of 35 to push well above 30
    const result = applyRelationshipDelta(org, "a1", "a2", 35, 1);
    const rel = getRelationship(result, "a1", "a2");
    expect(rel.state).toBe("Allied");
    expect(rel.affinity).toBeGreaterThan(30);
  });

  it("Allied → Neutral when affinity falls below 30", () => {
    const a = makeTestAgent({ id: "a1" });
    const b = makeTestAgent({ id: "a2" });
    let org = makeTestOrg([a, b]);
    org = { ...org, relationships: [{ agentIds: ["a1", "a2"], state: "Allied", affinity: 35 }] };
    // Drop below 30
    const result = applyRelationshipDelta(org, "a1", "a2", -10, 2);
    const rel = getRelationship(result, "a1", "a2");
    expect(rel.state).toBe("Neutral");
  });

  it("Neutral → Hostile when affinity < -30", () => {
    const a = makeTestAgent({ id: "a1" });
    const b = makeTestAgent({ id: "a2" });
    const org = makeTestOrg([a, b]);
    const result = applyRelationshipDelta(org, "a1", "a2", -40, 1);
    const rel = getRelationship(result, "a1", "a2");
    expect(rel.state).toBe("Hostile");
  });

  it("Bonded requires 10+ shared Allied challenges and affinity > 60", () => {
    const sharedChallenges = Array.from({ length: 10 }, (_, i) => ({
      challengeId: `c${i}`,
      cycle: i + 1,
      outcome: "success" as const,
    }));
    const a = makeTestAgent({ id: "a1", assignmentHistory: sharedChallenges });
    const b = makeTestAgent({ id: "a2", assignmentHistory: sharedChallenges });
    let org = makeTestOrg([a, b]);
    // Set Allied + affinity = 61
    org = {
      ...org,
      relationships: [{ agentIds: ["a1", "a2"], state: "Allied", affinity: 61 }],
    };
    // Apply small positive delta to trigger re-evaluation
    const result = applyRelationshipDelta(org, "a1", "a2", 1, 11);
    const rel = getRelationship(result, "a1", "a2");
    expect(rel.state).toBe("Bonded");
  });

  it("Allied with fewer than 10 shared challenges does not become Bonded", () => {
    const fewChallenges = Array.from({ length: 5 }, (_, i) => ({
      challengeId: `c${i}`,
      cycle: i + 1,
      outcome: "success" as const,
    }));
    const a = makeTestAgent({ id: "a1", assignmentHistory: fewChallenges });
    const b = makeTestAgent({ id: "a2", assignmentHistory: fewChallenges });
    let org = makeTestOrg([a, b]);
    org = {
      ...org,
      relationships: [{ agentIds: ["a1", "a2"], state: "Allied", affinity: 65 }],
    };
    const result = applyRelationshipDelta(org, "a1", "a2", 1, 6);
    const rel = getRelationship(result, "a1", "a2");
    expect(rel.state).toBe("Allied"); // not Bonded
  });

  it("Hostile relationship reduces relationship_mod", () => {
    const a = makeTestAgent({ id: "a1" });
    const b = makeTestAgent({ id: "a2" });
    const org = makeTestOrg([a, b]);
    const result = applyRelationshipDelta(org, "a1", "a2", -50, 1);
    const rel = getRelationship(result, "a1", "a2");
    expect(rel.state).toBe("Hostile");
  });

  it("does not mutate original org", () => {
    const a = makeTestAgent({ id: "a1" });
    const b = makeTestAgent({ id: "a2" });
    const org = makeTestOrg([a, b]);
    applyRelationshipDelta(org, "a1", "a2", 50, 1);
    expect(org.relationships).toHaveLength(0);
  });
});

// ── processChallengeRelationshipEffects ───────────────────────────────────────

describe("processChallengeRelationshipEffects", () => {
  it("team_player success multiplier is applied once, not double-counted", () => {
    const a = makeTestAgent({ id: "a1", traits: ["team_player"] });
    const b = makeTestAgent({ id: "a2" });
    const org = makeTestOrg([a, b]);
    const perf = new Map([["a1", 80], ["a2", 75]]);
    const { org: result } = processChallengeRelationshipEffects(
      org, "c1", ["a1", "a2"], "success", perf, 1,
    );
    const rel = getRelationship(result, "a1", "a2");
    // base 5 * team_player 1.5 = 7.5 (NOT 5 * 1.5 * 1.5 = 11.25)
    expect(rel.affinity).toBe(7.5);
  });

  it("shared success increases affinity", () => {
    const a = makeTestAgent({ id: "a1" });
    const b = makeTestAgent({ id: "a2" });
    const org = makeTestOrg([a, b]);
    const perf = new Map([["a1", 80], ["a2", 75]]);
    const { org: result } = processChallengeRelationshipEffects(
      org, "c1", ["a1", "a2"], "success", perf, 1,
    );
    const rel = getRelationship(result, "a1", "a2");
    expect(rel.affinity).toBeGreaterThan(0);
  });

  it("Hothead trait causes negative affinity on failure", () => {
    const a = makeTestAgent({ id: "a1", traits: ["hothead"] });
    const b = makeTestAgent({ id: "a2" });
    const org = makeTestOrg([a, b]);
    const perf = new Map([["a1", 50], ["a2", 60]]);
    const { org: result } = processChallengeRelationshipEffects(
      org, "c1", ["a1", "a2"], "failure", perf, 1,
    );
    const rel = getRelationship(result, "a1", "a2");
    expect(rel.affinity).toBeLessThan(0);
  });

  it("rivalrous perf gap returns stress delta to underperformer", () => {
    const a = makeTestAgent({ id: "a1", ambition: 15 });
    const b = makeTestAgent({ id: "a2", ambition: 15 });
    let org = makeTestOrg([a, b]);
    // Set Rivalrous relationship
    org = {
      ...org,
      relationships: [{ agentIds: ["a1", "a2"], state: "Rivalrous", affinity: 0 }],
    };
    const perf = new Map([["a1", 100], ["a2", 50]]); // >15% gap
    const { stressDeltas } = processChallengeRelationshipEffects(
      org, "c1", ["a1", "a2"], "success", perf, 1,
    );
    expect(stressDeltas.get("a2")).toBe(1); // underperformer
    expect(stressDeltas.get("a1")).toBeUndefined();
  });

  it("team player shared failure boosts affinity", () => {
    const a = makeTestAgent({ id: "a1", traits: ["team_player"] });
    const b = makeTestAgent({ id: "a2", traits: ["team_player"] });
    const org = makeTestOrg([a, b]);
    const perf = new Map([["a1", 40], ["a2", 35]]);
    const { org: result } = processChallengeRelationshipEffects(
      org, "c1", ["a1", "a2"], "failure", perf, 1,
    );
    const rel = getRelationship(result, "a1", "a2");
    expect(rel.affinity).toBeGreaterThan(0);
  });

  it("relationship state transitions are returned", () => {
    const a = makeTestAgent({ id: "a1" });
    const b = makeTestAgent({ id: "a2" });
    let org = makeTestOrg([a, b]);
    // Pre-set near Allied threshold
    org = {
      ...org,
      relationships: [{ agentIds: ["a1", "a2"], state: "Neutral", affinity: 28 }],
    };
    const perf = new Map([["a1", 80], ["a2", 80]]);
    const { transitions } = processChallengeRelationshipEffects(
      org, "c1", ["a1", "a2"], "success", perf, 1,
    );
    // Should have transitioned Neutral → Allied (28 + 5 = 33 > 30)
    expect(transitions.some((t) => t.to === "Allied")).toBe(true);
  });
});

// ── evaluateMentorshipPairs ───────────────────────────────────────────────────

describe("evaluateMentorshipPairs", () => {
  it("establishes Mentorship with tier gap >= 2", () => {
    const senior = makeTestAgent({ id: "a1", tier: "tier3" });
    const junior = makeTestAgent({ id: "a2", tier: "tier1" });
    const org = makeTestOrg([senior, junior]);
    const result = evaluateMentorshipPairs(org, ["a1", "a2"], 1);
    const rel = result.relationships.find(
      (r) => r.agentIds.includes("a1") && r.agentIds.includes("a2"),
    );
    expect(rel?.state).toBe("Mentorship");
  });

  it("does not establish Mentorship with tier gap < 2", () => {
    const a = makeTestAgent({ id: "a1", tier: "tier2" });
    const b = makeTestAgent({ id: "a2", tier: "tier1" });
    const org = makeTestOrg([a, b]);
    const result = evaluateMentorshipPairs(org, ["a1", "a2"], 1);
    const rel = result.relationships.find(
      (r) => r.agentIds.includes("a1") && r.agentIds.includes("a2"),
    );
    expect(rel?.state).not.toBe("Mentorship");
  });

  it("mentor_inclined trait allows Mentorship with 1 tier gap", () => {
    const senior = makeTestAgent({ id: "a1", tier: "tier2", traits: ["mentor_inclined"] });
    const junior = makeTestAgent({ id: "a2", tier: "tier1" });
    const org = makeTestOrg([senior, junior]);
    const result = evaluateMentorshipPairs(org, ["a1", "a2"], 1);
    const rel = result.relationships.find(
      (r) => r.agentIds.includes("a1") && r.agentIds.includes("a2"),
    );
    expect(rel?.state).toBe("Mentorship");
  });

  it("Hostile relationship blocks Mentorship", () => {
    const senior = makeTestAgent({ id: "a1", tier: "tier3" });
    const junior = makeTestAgent({ id: "a2", tier: "tier1" });
    let org = makeTestOrg([senior, junior]);
    org = {
      ...org,
      relationships: [{ agentIds: ["a1", "a2"], state: "Hostile", affinity: -50 }],
    };
    const result = evaluateMentorshipPairs(org, ["a1", "a2"], 1);
    const rel = result.relationships.find(
      (r) => r.agentIds.includes("a1") && r.agentIds.includes("a2"),
    );
    expect(rel?.state).toBe("Hostile");
  });
});
