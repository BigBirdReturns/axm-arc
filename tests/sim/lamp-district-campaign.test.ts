import { describe, expect, it } from "vitest";
import { LAMP_DISTRICT } from "../../src/arcs/lamp-district.js";
import { LAMP_DISTRICT_SOURCE } from "../../src/dark-tomb/lamp-district.js";
import { runCycle } from "../../src/engine/cycle.js";
import { foundOrganization } from "../../src/engine/founding.js";
import type { Organization } from "../../src/engine/types.js";
import {
  bestParty,
  simulateArcRun,
} from "../../src/sim/cartridge-conformance.js";

const SEEDS = Array.from({ length: 16 }, (_, index) => 9100 + index * 37);

function boostedFounding(): Organization {
  const org = foundOrganization(LAMP_DISTRICT, { format: "axm-founding-input/1", seed: 321 });
  return {
    ...org,
    agents: Object.fromEntries(Object.entries(org.agents).map(([id, agent]) => [
      id,
      {
        ...agent,
        attributes: Object.fromEntries(LAMP_DISTRICT.attributes.map((attribute) => [attribute.id, 60])),
        morale: 90,
        stress: 0,
      },
    ])),
  };
}

function completeDeterministically(): Organization {
  let org = boostedFounding();
  for (const challenge of LAMP_DISTRICT.challenges) {
    const plan = bestParty(challenge, org, LAMP_DISTRICT);
    if (!plan) throw new Error(`No legal party for ${challenge.id}`);
    const result = runCycle({
      org,
      arc: LAMP_DISTRICT,
      assignments: [{ challengeId: challenge.id, agentIds: plan.agentIds, tokensSpent: 0 }],
    });
    const report = result.reports.find((candidate) => candidate.challengeId === challenge.id);
    if (!report) throw new Error(`No report for ${challenge.id}: ${result.warnings.join("; ")}`);
    if (report.outcome !== "success") throw new Error(`${challenge.id} resolved ${report.outcome}`);
    org = result.org;
  }
  return org;
}

function consequenceState(): Record<string, true> {
  return Object.fromEntries(LAMP_DISTRICT_SOURCE.consequences.map((consequence) => [
    `consequence:${consequence.kind}:${consequence.id}`,
    true,
  ]));
}

describe("Lamp District full campaign", () => {
  it("is reachable across a deterministic seed sweep without bypassing a gate", () => {
    for (const seed of SEEDS) {
      const result = simulateArcRun(LAMP_DISTRICT, { seed, maxCycles: 80 });
      expect(result.outcome, `seed ${seed}: ${result.stallReason ?? result.warnings.join("; ")}`).toBe("cleared");
      expect(result.gateViolations).toBe(0);
      expect(result.warnings).toEqual([]);
      expect(Object.keys(result.clearCycles).sort()).toEqual(
        LAMP_DISTRICT.challenges.map((challenge) => challenge.id).sort(),
      );
      expect(result.cyclesPlayed).toBeLessThanOrEqual(80);
    }
  });

  it("can be completed by the exact named founding cast rather than only a synthetic roster", () => {
    const initialOrganization = foundOrganization(
      LAMP_DISTRICT,
      { format: "axm-founding-input/1", seed: 20260722 },
    );
    expect(Object.values(initialOrganization.agents).map((agent) => agent.name)).toEqual([
      "Iven Marr",
      "Sel Aro",
      "Toma Rill",
      "Anja Vei",
      "Kesh Orin",
      "Halen Quill",
      "Black Lamp Nine",
    ]);
    const result = simulateArcRun(LAMP_DISTRICT, {
      seed: 20260722,
      maxCycles: 100,
      initialOrganization,
    });
    expect(result.outcome, result.stallReason ?? result.warnings.join("; ")).toBe("cleared");
    expect(result.gateViolations).toBe(0);
    expect(result.warnings).toEqual([]);
  });

  it("leaves the Alarm, visibility, map, habitats, and constituencies changed after return", () => {
    const org = completeDeterministically();
    expect(org.cartridgeState).toMatchObject({
      "alarm-phase": "wake",
      "signature-status": "breached",
      "visibility-status": "exposed",
      ...consequenceState(),
    });
  });
});
