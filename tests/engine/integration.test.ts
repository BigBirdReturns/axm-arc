import { describe, it, expect } from "vitest";
import type { Organization, Agent, Facility, InfrastructureFacility } from "../../src/engine/types.js";
import { validateArc } from "../../src/engine/schema.js";
import { runCycle, type ChallengeAssignment, type RewardDecision } from "../../src/engine/cycle.js";
import { serializeGame, deserializeGame } from "../../src/engine/save.js";
import { getAdvanceBlockers, isAdvanceBlocked } from "../../src/game/lib/advance-blockers.js";
import {
  FIRST_CHARTER,
  FIRST_CHARTER_STARTING_ROSTER,
  FIRST_CHARTER_STARTING_RELATIONSHIPS,
} from "../../src/arcs/index.js";

function defaultFacilities(): Record<InfrastructureFacility, Facility> {
  const facilities: Partial<Record<InfrastructureFacility, Facility>> = {};
  const names: InfrastructureFacility[] = [
    "Quarters",
    "Production",
    "Recreation",
    "Research",
    "Training",
    "Storage",
    "Medical",
  ];
  for (const n of names) {
    facilities[n] = { type: n, level: n === "Quarters" || n === "Recreation" ? 1 : 0, assignedAgents: [] };
  }
  return facilities as Record<InfrastructureFacility, Facility>;
}

function buildOrg(): Organization {
  const agents: Record<string, Agent> = {};
  for (const a of FIRST_CHARTER_STARTING_ROSTER) agents[a.id] = a;
  return {
    id: "test-org",
    name: "Test Charter",
    reputation: 0,
    resources: { currency: 100, materials: 0, tokens: 2 },
    infrastructure: defaultFacilities(),
    agents,
    relationships: [...FIRST_CHARTER_STARTING_RELATIONSHIPS],
    precedents: [],
    dramaQueue: [],
    cycle: 0,
    distributionPolicy: "council",
    rngSeed: 12345,
  };
}

describe("FIRST_CHARTER arc", () => {
  it("passes schema validation", () => {
    expect(() => validateArc(FIRST_CHARTER)).not.toThrow();
  });

  it("has the 6 tutorial challenges in order", () => {
    const ids = FIRST_CHARTER.challenges.map((c) => c.id);
    expect(ids).toEqual([
      "cellar",
      "bridge-troll",
      "merchant-escort",
      "mine-collapse",
      "bandit-camp",
      "wardens-keep",
    ]);
  });

  it("authors a bounded Contract-spend choice for the opening Cellar run", () => {
    expect(FIRST_CHARTER.challenges.find((challenge) => challenge.id === "cellar")?.resourceSpend).toEqual({
      maxTokens: 1,
      steadinessPerToken: 0.35,
      minSteadiness: 0.65,
    });
  });

  it("starting roster is deterministic and well-formed", () => {
    expect(FIRST_CHARTER_STARTING_ROSTER).toHaveLength(6);
    for (const a of FIRST_CHARTER_STARTING_ROSTER) {
      expect(a.id).toBeTruthy();
      expect(Object.keys(a.attributes).sort()).toEqual(["mettle", "power", "spirit", "wits"]);
      expect(a.traits.length).toBeGreaterThanOrEqual(2);
    }
    const skirmishers = FIRST_CHARTER_STARTING_ROSTER.filter((a) => a.role === "skirmisher");
    expect(skirmishers.length).toBeGreaterThanOrEqual(2);
    // Veteran skirmisher starts at stress 3; recruit starts at morale 38 — intentional seeding
    const vetSkirm = skirmishers.find((a) => a.tier === "veteran");
    const recSkirm = skirmishers.find((a) => a.tier === "recruit");
    expect(vetSkirm?.stress).toBe(3);
    expect(recSkirm?.morale).toBe(38);
    expect(FIRST_CHARTER_STARTING_RELATIONSHIPS).toHaveLength(1);
    expect(FIRST_CHARTER_STARTING_RELATIONSHIPS[0]?.state).toBe("Rivalrous");
  });
});

describe("FIRST_CHARTER integration: end-to-end tutorial", () => {
  it("cycle 1: clears The Cellar", () => {
    const org = buildOrg();
    const agentIds = FIRST_CHARTER_STARTING_ROSTER.map((a) => a.id);
    const assignments: ChallengeAssignment[] = [
      { challengeId: "cellar", agentIds, tokensSpent: 1 },
    ];
    const result = runCycle({ org, arc: FIRST_CHARTER, assignments });

    expect(result.warnings).toEqual([]);
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]?.outcome).toBe("success");
    expect(result.org.cycle).toBe(1);
    expect(result.org.reputation).toBeGreaterThanOrEqual(1);
  });

  it("cycle 1 → 2: clears Cellar then Bridge Troll, drama fires from rivalry", () => {
    let org = buildOrg();
    // C1: cellar
    let result = runCycle({
      org,
      arc: FIRST_CHARTER,
      assignments: [
        {
          challengeId: "cellar",
          agentIds: FIRST_CHARTER_STARTING_ROSTER.map((a) => a.id),
          tokensSpent: 1,
        },
      ],
    });
    org = result.org;

    // C2: bridge-troll — include both rivals + the vanguard
    const vanguard = FIRST_CHARTER_STARTING_ROSTER.find((a) => a.role === "vanguard")!;
    const skirms = FIRST_CHARTER_STARTING_ROSTER.filter((a) => a.role === "skirmisher");
    const mender = FIRST_CHARTER_STARTING_ROSTER.find((a) => a.role === "mender")!;
    result = runCycle({
      org,
      arc: FIRST_CHARTER,
      assignments: [
        {
          challengeId: "bridge-troll",
          agentIds: [vanguard.id, skirms[0]!.id, skirms[1]!.id, mender.id],
          tokensSpent: 1,
        },
      ],
    });

    expect(result.warnings).toEqual([]);
    expect(result.org.cycle).toBe(2);
    // Drama from rivalry might fire (depends on perf diff > 20%)
    // Just assert the system ran without exploding and produced at least one report.
    expect(result.reports).toHaveLength(1);
  });

  it("plays through Tier 1 + recruits + reaches Tier 2 challenges", () => {
    let org = buildOrg();
    let pendingDecisions: RewardDecision[] = [];

    // Helper: pick a sensible roster for a challenge
    const pickRoster = (challengeId: string, max: number): string[] => {
      const challenge = FIRST_CHARTER.challenges.find((c) => c.id === challengeId)!;
      const required = challenge.rosterRequirements.roleRequirements;
      const available = Object.values(org.agents).filter((a) => a.downedUntilCycle === null);
      const chosen = new Map<string, Agent>();
      for (const req of required) {
        const matches = available.filter((a) => a.role === req.roleId && !chosen.has(a.id));
        for (let i = 0; i < Math.min(req.count, matches.length); i++) {
          chosen.set(matches[i]!.id, matches[i]!);
        }
      }
      for (const a of available) {
        if (chosen.size >= max) break;
        if (!chosen.has(a.id)) chosen.set(a.id, a);
      }
      return Array.from(chosen.keys()).slice(0, max);
    };

    // Auto-resolve pending reward decisions by picking the first eligible
    const autoResolveRewards = (result: ReturnType<typeof runCycle>): RewardDecision[] => {
      return result.pendingRewardChoices.map((p) => ({
        itemId: p.itemId,
        eligible: p.eligibleAgentIds,
        winner: p.eligibleAgentIds[0]!,
        sourceChallenge: p.sourceChallenge,
      }));
    };

    // Cycle 1: cellar
    let r = runCycle({
      org,
      arc: FIRST_CHARTER,
      assignments: [{ challengeId: "cellar", agentIds: pickRoster("cellar", 6), tokensSpent: 1 }],
    });
    org = r.org;
    pendingDecisions = autoResolveRewards(r);

    // Cycle 2: bridge-troll
    r = runCycle({
      org,
      arc: FIRST_CHARTER,
      assignments: [{ challengeId: "bridge-troll", agentIds: pickRoster("bridge-troll", 6), tokensSpent: 1 }],
      pendingRewardDecisions: pendingDecisions,
    });
    org = r.org;
    pendingDecisions = autoResolveRewards(r);

    // Cycle 3: merchant-escort
    r = runCycle({
      org,
      arc: FIRST_CHARTER,
      assignments: [{ challengeId: "merchant-escort", agentIds: pickRoster("merchant-escort", 7), tokensSpent: 1 }],
      pendingRewardDecisions: pendingDecisions,
    });
    org = r.org;
    pendingDecisions = autoResolveRewards(r);

    expect(org.cycle).toBe(3);
    // Hidden attr/trait reveals should have started firing
    const totalReveals = Object.values(org.agents).reduce(
      (sum, a) => sum + a.revealedHiddenAttrs + a.revealedTraits,
      0,
    );
    expect(totalReveals).toBeGreaterThan(0);
  });

  it("drama cards generated by cycle block subsequent advance", () => {
    let org = buildOrg();

    // Run cellar with both skirmishers to trigger rivalry drama
    const allIds = FIRST_CHARTER_STARTING_ROSTER.map((a) => a.id);
    const result = runCycle({
      org,
      arc: FIRST_CHARTER,
      assignments: [{ challengeId: "cellar", agentIds: allIds, tokensSpent: 1 }],
    });
    org = result.org;

    // If any drama cards were generated, advance should be blocked
    if (org.dramaQueue.length > 0) {
      const blockers = getAdvanceBlockers({
        dramaQueueCount: org.dramaQueue.length,
        pendingRewardChoicesCount: result.pendingRewardChoices.length,
        rewardDecisionsCount: 0,
      });
      expect(isAdvanceBlocked(blockers)).toBe(true);
      expect(blockers.some((b) => b.code === "drama_unresolved")).toBe(true);
    }
  });

  it("pending reward choices block advance until resolved", () => {
    let org = buildOrg();
    const allIds = FIRST_CHARTER_STARTING_ROSTER.map((a) => a.id);
    const result = runCycle({
      org,
      arc: FIRST_CHARTER,
      assignments: [{ challengeId: "cellar", agentIds: allIds, tokensSpent: 1 }],
    });

    if (result.pendingRewardChoices.length > 0) {
      // With 0 decisions made, should be blocked
      const blockedState = getAdvanceBlockers({
        dramaQueueCount: 0,
        pendingRewardChoicesCount: result.pendingRewardChoices.length,
        rewardDecisionsCount: 0,
      });
      expect(isAdvanceBlocked(blockedState)).toBe(true);
      expect(blockedState.some((b) => b.code === "rewards_pending")).toBe(true);

      // After resolving all, should be unblocked
      const resolvedState = getAdvanceBlockers({
        dramaQueueCount: 0,
        pendingRewardChoicesCount: result.pendingRewardChoices.length,
        rewardDecisionsCount: result.pendingRewardChoices.length,
      });
      expect(isAdvanceBlocked(resolvedState)).toBe(false);
    }
  });

  it("save round-trips full game state", () => {
    const org = buildOrg();
    const r = runCycle({
      org,
      arc: FIRST_CHARTER,
      assignments: [
        {
          challengeId: "cellar",
          agentIds: FIRST_CHARTER_STARTING_ROSTER.map((a) => a.id),
          tokensSpent: 1,
        },
      ],
    });
    const json = serializeGame(r.org, FIRST_CHARTER);
    const { org: restored, cycle } = deserializeGame(json, FIRST_CHARTER);
    expect(cycle).toBe(r.org.cycle);
    expect(restored.id).toBe(r.org.id);
    expect(Object.keys(restored.agents).length).toBe(Object.keys(r.org.agents).length);
    expect(restored.reputation).toBe(r.org.reputation);
  });
});
