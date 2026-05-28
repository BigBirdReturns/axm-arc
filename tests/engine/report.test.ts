import { describe, it, expect } from "vitest";
import type { RunReport, AgentRunResult, NarrativeTemplate } from "../../src/engine/types.js";
import { renderReport, DEFAULT_TEMPLATES } from "../../src/engine/report.js";
import { makeTestAgent, makeTestOrg, STATE_ARC } from "../fixtures/state-arc.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAgentRunResult(agentId: string, score: number, threshold: number, passed: boolean): AgentRunResult {
  return {
    agentId,
    mechanicResults: [
      { mechanicId: "check-power", score, threshold, passed },
    ],
    performanceRating: passed ? 1.0 : 0.0,
    stressGained: passed ? 0 : 1,
    wasDowned: false,
    isHeroic: false,
  };
}

function makeReport(
  outcome: RunReport["outcome"],
  agentResults: AgentRunResult[],
  lootDrops: RunReport["lootDrops"] = [],
): RunReport {
  return {
    challengeId: "test-challenge",
    outcome,
    cycle: 1,
    assignedAgents: agentResults,
    lootDrops,
    dramaTriggers: [],
    narrativeSeed: 12345,
  };
}

// Use the first challenge from STATE_ARC (no challenges), so build a minimal one inline
const MINI_CHALLENGE = {
  id: "test-challenge",
  name: "Iron Trial",
  description: "A test challenge.",
  rosterRequirements: { minAgents: 1, maxAgents: 3, roleRequirements: [] },
  accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
  difficultyRating: 20,
  mechanicChecks: [
    {
      id: "check-power",
      name: "Power Check",
      description: "Strength test.",
      attributeWeights: [{ attributeId: "power", weight: 1.0 }],
      difficultyThreshold: 8,
      scope: "per_agent" as const,
      failureConsequence: { type: "stress" as const, severity: 0.2 },
    },
  ],
  completionCriteria: { type: "all_mechanics_passed" as const, parameters: {} },
  timePressure: null,
  outcomes: {
    success: { rewardTable: [], narrative: "Victory!", reputationGain: 3 },
    partial: { rewardTable: [], narrative: "Partial." },
    failure: { rewardTable: [], narrative: "Defeat.", stressPenalty: 1 },
  },
};

// ── DEFAULT_TEMPLATES ─────────────────────────────────────────────────────────

describe("DEFAULT_TEMPLATES", () => {
  it("is a non-empty array of narrative templates", () => {
    expect(Array.isArray(DEFAULT_TEMPLATES)).toBe(true);
    expect(DEFAULT_TEMPLATES.length).toBeGreaterThan(0);
  });

  it("includes templates for challenge_complete, mechanic_check_passed, and mechanic_check_failed", () => {
    const triggers = DEFAULT_TEMPLATES.map((t) => t.trigger);
    expect(triggers).toContain("challenge_complete");
    expect(triggers).toContain("mechanic_check_passed");
    expect(triggers).toContain("mechanic_check_failed");
  });
});

// ── renderReport ──────────────────────────────────────────────────────────────

describe("renderReport", () => {
  it("returns a non-empty string for a successful outcome", () => {
    const agent = makeTestAgent({ id: "a1" });
    const agentMap = new Map([["a1", agent]]);
    const report = makeReport("success", [makeAgentRunResult("a1", 15, 8, true)]);
    const text = renderReport(report, [], { agents: agentMap, challenge: MINI_CHALLENGE, arc: STATE_ARC });
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });

  it("includes the challenge name in the opener line", () => {
    const agent = makeTestAgent({ id: "a1" });
    const agentMap = new Map([["a1", agent]]);
    const report = makeReport("success", [makeAgentRunResult("a1", 15, 8, true)]);
    const text = renderReport(report, [], { agents: agentMap, challenge: MINI_CHALLENGE, arc: STATE_ARC });
    expect(text).toContain("Iron Trial");
  });

  it("uses a success-tone template when outcome is success", () => {
    const agent = makeTestAgent({ id: "a1" });
    const agentMap = new Map([["a1", agent]]);
    const report = makeReport("success", [makeAgentRunResult("a1", 15, 8, true)]);
    const text = renderReport(report, [], { agents: agentMap, challenge: MINI_CHALLENGE, arc: STATE_ARC });
    // DEFAULT_TEMPLATES has "Every objective met." for success outcome
    expect(text).toMatch(/Every objective met\.|concluded\.|cleared\./);
  });

  it("uses a failure-tone template when outcome is failure", () => {
    const agent = makeTestAgent({ id: "a1" });
    const agentMap = new Map([["a1", agent]]);
    const report = makeReport("failure", [makeAgentRunResult("a1", 2, 8, false)]);
    const text = renderReport(report, [], { agents: agentMap, challenge: MINI_CHALLENGE, arc: STATE_ARC });
    expect(text).toMatch(/failure|fell short/i);
  });

  it("includes the agent name in per-mechanic narrative lines", () => {
    const agent = makeTestAgent({ id: "a1" });
    const agentMap = new Map([["a1", agent]]);
    const report = makeReport("success", [makeAgentRunResult("a1", 15, 8, true)]);
    const text = renderReport(report, [], { agents: agentMap, challenge: MINI_CHALLENGE, arc: STATE_ARC });
    // Agent name is "Agent a1"
    expect(text).toContain("Agent a1");
  });

  it("includes a loot line when a loot drop is present", () => {
    const agent = makeTestAgent({ id: "a1" });
    const agentMap = new Map([["a1", agent]]);
    const lootDrops: RunReport["lootDrops"] = [{ itemId: "basic-sword", eligibleAgents: ["a1"] }];
    const report = makeReport("success", [makeAgentRunResult("a1", 15, 8, true)], lootDrops);
    const text = renderReport(report, [], { agents: agentMap, challenge: MINI_CHALLENGE, arc: STATE_ARC });
    // STATE_ARC has "basic-sword" → "Basic Sword"
    expect(text).toContain("Basic Sword");
  });

  it("more-specific custom templates win over less-specific defaults", () => {
    const agent = makeTestAgent({ id: "a1" });
    const agentMap = new Map([["a1", agent]]);
    // Adding a second condition makes this template more specific than any default
    // (defaults for challenge_complete have at most 1 condition)
    const customTemplate: NarrativeTemplate = {
      trigger: "challenge_complete",
      tone: "triumphant",
      conditions: { outcome: "success", marginMin: 0 },
      text: "CUSTOM_SUCCESS_TEXT",
    };
    const report = makeReport("success", []);
    const text = renderReport(report, [customTemplate], { agents: agentMap, challenge: MINI_CHALLENGE, arc: STATE_ARC });
    expect(text).toContain("CUSTOM_SUCCESS_TEXT");
  });
});
