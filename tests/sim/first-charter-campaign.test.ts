import { describe, expect, it } from "vitest";
import { FIRST_CHARTER } from "../../src/arcs/first-charter.js";
import { foundOrganization } from "../../src/engine/founding.js";
import {
  aggregateRuns,
  simulateArcRun,
  type ConformanceRunResult,
} from "../../src/sim/cartridge-conformance.js";

const REQUIRED_CHALLENGES = FIRST_CHARTER.progressionTiers.flatMap((tier) => tier.requiredChallenges);

function authoredRun(seed: number, maxCycles: number): ConformanceRunResult {
  const org = foundOrganization(FIRST_CHARTER, {
    format: "axm-founding-input/1",
    seed,
  });
  return simulateArcRun(FIRST_CHARTER, {
    seed,
    maxCycles,
    initialOrganization: org,
  });
}

describe("The First Charter complete campaign", () => {
  it("the exact default cartridge founding reaches its authored ending near the stated duration", () => {
    const org = foundOrganization(FIRST_CHARTER);
    const run = simulateArcRun(FIRST_CHARTER, {
      seed: org.rngSeed,
      maxCycles: 20,
      initialOrganization: org,
    });

    expect(run.outcome).toBe("cleared");
    expect(run.gateViolations).toBe(0);
    expect(Object.keys(run.clearCycles).sort()).toEqual([...REQUIRED_CHALLENGES].sort());
    expect(run.cyclesPlayed).toBeLessThanOrEqual(FIRST_CHARTER.meta.estimatedCycles);
    expect(run.clearCycles["wardens-keep"]).toBeDefined();
  });

  it("every sampled authored founding seed can field and finish all six challenges without a gate bypass", () => {
    const runs = Array.from({ length: 24 }, (_, index) => authoredRun(index + 1, 40));
    const aggregate = aggregateRuns(FIRST_CHARTER, runs, 40);

    expect(aggregate.clearRate).toBe(1);
    expect(aggregate.stallRate).toBe(0);
    expect(aggregate.maxCycleRate).toBe(0);
    expect(aggregate.totalGateViolations).toBe(0);
    expect(runs.every((run) => REQUIRED_CHALLENGES.every((id) => run.clearCycles[id] !== undefined))).toBe(true);
  });

  it("the authored founding law always supplies the final role floor", () => {
    const final = FIRST_CHARTER.challenges.find((challenge) => challenge.id === "wardens-keep")!;
    for (let seed = 1; seed <= 24; seed++) {
      const org = foundOrganization(FIRST_CHARTER, {
        format: "axm-founding-input/1",
        seed,
      });
      const roleCounts = new Map<string, number>();
      for (const agent of Object.values(org.agents)) {
        if (agent.role) roleCounts.set(agent.role, (roleCounts.get(agent.role) ?? 0) + 1);
      }
      for (const requirement of final.rosterRequirements.roleRequirements) {
        expect(roleCounts.get(requirement.roleId) ?? 0, `seed ${seed}: ${requirement.roleId}`)
          .toBeGreaterThanOrEqual(requirement.count);
      }
    }
  });
});
