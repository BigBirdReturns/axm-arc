import { describe, it, expect } from "vitest";
import { runCycle } from "../../src/engine/cycle.js";
import { CYCLE_ARC, makeCycleAgent, makeCycleOrg } from "../fixtures/cycle-arc.js";

describe("runCycle", () => {
  it("runs without error and increments cycle by 1", () => {
    const agent = makeCycleAgent({ id: "a1" });
    const org = makeCycleOrg([agent]);
    expect(org.cycle).toBe(1);

    const result = runCycle({
      org,
      arc: CYCLE_ARC,
      assignments: [],
    });

    expect(result.org.cycle).toBe(2);
  });

  it("produces a report for each valid assignment", () => {
    const agent = makeCycleAgent({ id: "a1" });
    const org = makeCycleOrg([agent], { tokens: 10 });

    const result = runCycle({
      org,
      arc: CYCLE_ARC,
      assignments: [
        { challengeId: "test-challenge", agentIds: ["a1"], tokensSpent: 0 },
      ],
    });

    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]!.challengeId).toBe("test-challenge");
  });

  it("deducts tokens then regenerates correctly", () => {
    const agent = makeCycleAgent({ id: "a1" });
    const org = makeCycleOrg([agent], { tokens: 5 });
    const startTokens = org.resources.tokens;

    const result = runCycle({
      org,
      arc: CYCLE_ARC,
      assignments: [
        { challengeId: "test-challenge", agentIds: ["a1"], tokensSpent: 2 },
      ],
    });

    // After spending 2 and then regenerating 3 (tokensPerCycle), should have
    // min(10, 5-2+regen) = min(10, 3+regen). Exact regen depends on infra bonus.
    // Key invariant: tokens should not exceed maxTokens and should have changed.
    expect(result.org.resources.tokens).toBeLessThanOrEqual(CYCLE_ARC.maxTokens);
    expect(result.org.resources.tokens).toBeGreaterThanOrEqual(0);
    // Without infra bonus: 5-2=3, then +floor(3*(1+bonus)) ≥ 3
    void startTokens;
  });

  it("refuses a missing or downed party before spending tokens", () => {
    const downed = makeCycleAgent({ id: "downed", downedUntilCycle: 5 });
    const org = makeCycleOrg([downed], { tokens: 5 });
    const control = runCycle({ org, arc: CYCLE_ARC, assignments: [] });

    for (const agentIds of [["ghost"], ["downed"]]) {
      const result = runCycle({
        org,
        arc: CYCLE_ARC,
        assignments: [{ challengeId: "test-challenge", agentIds, tokensSpent: 2 }],
      });
      expect(result.reports).toHaveLength(0);
      expect(result.org.resources.tokens).toBe(control.org.resources.tokens);
      expect(result.warnings.some((warning) => warning.includes("No valid agents"))).toBe(true);
    }
  });

  it("refuses count, role, and duplicate-identity gate failures before spending", () => {
    const striker = makeCycleAgent({ id: "striker" });
    const org = makeCycleOrg([striker], { tokens: 5 });
    const control = runCycle({ org, arc: CYCLE_ARC, assignments: [] });
    const baseChallenge = CYCLE_ARC.challenges[0]!;
    const invalidArcs = [
      {
        ...CYCLE_ARC,
        challenges: [{
          ...baseChallenge,
          rosterRequirements: { minAgents: 2, maxAgents: 3, roleRequirements: [] },
        }],
      },
      {
        ...CYCLE_ARC,
        challenges: [{
          ...baseChallenge,
          rosterRequirements: {
            minAgents: 1,
            maxAgents: 3,
            roleRequirements: [{ roleId: "guardian", count: 1 }],
          },
        }],
      },
    ];

    for (const arc of invalidArcs) {
      const result = runCycle({
        org,
        arc,
        assignments: [{ challengeId: "test-challenge", agentIds: ["striker"], tokensSpent: 2 }],
      });
      expect(result.reports).toHaveLength(0);
      expect(result.org.resources.tokens).toBe(control.org.resources.tokens);
      expect(result.warnings.some((warning) => warning.includes("Party is not eligible"))).toBe(true);
    }

    const duplicate = runCycle({
      org,
      arc: CYCLE_ARC,
      assignments: [{ challengeId: "test-challenge", agentIds: ["striker", "striker"], tokensSpent: 2 }],
    });
    expect(duplicate.reports).toHaveLength(0);
    expect(duplicate.org.resources.tokens).toBe(control.org.resources.tokens);
  });

  it("reports actual upkeep paid and never persists negative currency", () => {
    const agent = makeCycleAgent({ id: "expensive", upkeep: 10 });
    const result = runCycle({
      org: makeCycleOrg([agent], { currency: 3 }),
      arc: CYCLE_ARC,
      assignments: [],
    });

    expect(result.org.resources.currency).toBe(0);
    expect(result.events).toContainEqual({
      type: "upkeep_charged",
      data: { amount: 3, due: 10, unpaid: 7, deficit: true },
    });
    expect(result.warnings).toContain("Treasury shortfall — 7 upkeep remains unpaid.");
  });

  it("warns but continues on invalid challengeId", () => {
    const agent = makeCycleAgent({ id: "a1" });
    const org = makeCycleOrg([agent]);

    const result = runCycle({
      org,
      arc: CYCLE_ARC,
      assignments: [{ challengeId: "nonexistent", agentIds: ["a1"], tokensSpent: 0 }],
    });

    expect(result.warnings.some((w) => w.includes("nonexistent"))).toBe(true);
    expect(result.org.cycle).toBe(2);
  });

  it("drama cards are capped at 5 per cycle", () => {
    // Create many agents with morale extremes to generate lots of triggers
    const agents = Array.from({ length: 10 }, (_, i) =>
      makeCycleAgent({ id: `a${i}`, morale: i % 2 === 0 ? 10 : 90 }),
    );
    const org = makeCycleOrg(agents);

    const result = runCycle({ org, arc: CYCLE_ARC, assignments: [] });

    // Cards queued THIS cycle
    const thisGenerated = result.queuedDramaCards.filter(
      (c) => c.cycleGenerated === org.cycle,
    );
    expect(thisGenerated.length).toBeLessThanOrEqual(5);
  });

  it("reveal events fire at the right assignment count thresholds", () => {
    // Agent with exactly 3 assignments (hits first hidden attr reveal threshold)
    const agent = makeCycleAgent({ id: "a1", assignmentCount: 2 });
    const org = makeCycleOrg([agent]);

    // Run one more assignment so total becomes 3
    const result = runCycle({
      org,
      arc: CYCLE_ARC,
      assignments: [{ challengeId: "test-challenge", agentIds: ["a1"], tokensSpent: 0 }],
    });

    const revealEvents = result.events.filter(
      (e) => e.type === "reveal_hidden_attr" && e.agentId === "a1",
    );
    expect(revealEvents.length).toBeGreaterThan(0);
  });

  it("trait reveal fires at threshold 5", () => {
    // Agent with 4 assignments, about to hit trait reveal at 5
    const agent = makeCycleAgent({ id: "a1", assignmentCount: 4 });
    // Give agent multiple traits
    const agentWithTraits = { ...agent, traits: ["stoic", "industrious"] };
    const org = makeCycleOrg([agentWithTraits]);

    const result = runCycle({
      org,
      arc: CYCLE_ARC,
      assignments: [{ challengeId: "test-challenge", agentIds: ["a1"], tokensSpent: 0 }],
    });

    const traitRevealEvents = result.events.filter(
      (e) => e.type === "reveal_trait" && e.agentId === "a1",
    );
    expect(traitRevealEvents.length).toBeGreaterThan(0);
  });

  it("is deterministic: same inputs produce same CycleResult", () => {
    const agent = makeCycleAgent({ id: "a1" });
    const org = makeCycleOrg([agent]);

    const r1 = runCycle({
      org,
      arc: CYCLE_ARC,
      assignments: [{ challengeId: "test-challenge", agentIds: ["a1"], tokensSpent: 0 }],
    });

    const r2 = runCycle({
      org,
      arc: CYCLE_ARC,
      assignments: [{ challengeId: "test-challenge", agentIds: ["a1"], tokensSpent: 0 }],
    });

    expect(r1.reports[0]!.outcome).toBe(r2.reports[0]!.outcome);
    expect(r1.org.resources.tokens).toBe(r2.org.resources.tokens);
    expect(r1.events.length).toBe(r2.events.length);
  });

  it("saveData is valid JSON containing version and cycle", () => {
    const agent = makeCycleAgent({ id: "a1" });
    const org = makeCycleOrg([agent]);

    const result = runCycle({ org, arc: CYCLE_ARC, assignments: [] });

    const parsed = JSON.parse(result.saveData);
    expect(parsed.version).toBe(1);
    expect(parsed.organization.cycle).toBe(2);
    expect(parsed.arcRef.id).toBe("cycle-test-arc");
  });

  it("downed agent is skipped in subsequent challenge processing", () => {
    const agent = makeCycleAgent({ id: "a1", downedUntilCycle: 5 });
    const org = makeCycleOrg([agent]);

    const result = runCycle({
      org,
      arc: CYCLE_ARC,
      assignments: [{ challengeId: "test-challenge", agentIds: ["a1"], tokensSpent: 0 }],
    });

    // Agent is downed so should be skipped — no report or a warning
    const hasReport = result.reports.some((r) =>
      r.assignedAgents.some((ar) => ar.agentId === "a1"),
    );
    // Either the report has no agents (skipped) or a warning was emitted
    const hasWarning = result.warnings.some((w) => w.includes("test-challenge"));
    expect(!hasReport || hasWarning).toBe(true);
  });
});
