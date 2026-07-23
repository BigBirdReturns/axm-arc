import { describe, expect, it } from "vitest";
import { RELIEF_CIRCUIT } from "../../src/arcs/relief-circuit.js";
import { RELIEF_CIRCUIT_SOURCE } from "../../src/common-ship/relief-circuit.js";
import { foundOrganization } from "../../src/engine/founding.js";
import { runCycle } from "../../src/engine/cycle.js";
import type { Organization } from "../../src/engine/types.js";
import { bestParty, simulateArcRun } from "../../src/sim/cartridge-conformance.js";

const SEEDS = Array.from({ length: 16 }, (_, index) => 12100 + index * 41);
function authoredFounding(seed: number): Organization {
  return foundOrganization(RELIEF_CIRCUIT, { format: "axm-founding-input/1", seed });
}
function boostedFounding(): Organization {
  const org = authoredFounding(321);
  return {
    ...org,
    resources: { ...org.resources, currency: 1000, tokens: 6 },
    agents: Object.fromEntries(Object.entries(org.agents).map(([id, agent]) => [id, {
      ...agent,
      attributes: Object.fromEntries(RELIEF_CIRCUIT.attributes.map((attribute) => [attribute.id, 60])),
      morale: 90,
      stress: 0,
    }])),
  };
}
function completeDeterministically(): Organization {
  let org = boostedFounding();
  for (const challenge of RELIEF_CIRCUIT.challenges) {
    const plan = bestParty(challenge, org, RELIEF_CIRCUIT);
    if (!plan) throw new Error(`No legal party for ${challenge.id}`);
    const result = runCycle({ org, arc: RELIEF_CIRCUIT, assignments: [{ challengeId: challenge.id, agentIds: plan.agentIds, tokensSpent: 0 }] });
    const report = result.reports.find((candidate) => candidate.challengeId === challenge.id);
    if (!report || report.outcome !== "success") throw new Error(`${challenge.id}: ${report?.outcome ?? result.warnings.join("; ")}`);
    org = result.org;
  }
  return org;
}

describe("Relief Circuit full campaign", () => {
  it("clears from its exact named founding population across deterministic seeds", () => {
    for (const seed of SEEDS) {
      const result = simulateArcRun(RELIEF_CIRCUIT, { seed, maxCycles: 120, initialOrganization: authoredFounding(seed) });
      expect(result.outcome, `seed ${seed}: ${result.stallReason ?? result.warnings.join("; ")}`).toBe("cleared");
      expect(result.gateViolations).toBe(0);
      expect(result.warnings).toEqual([]);
      expect(Object.keys(result.clearCycles)).toHaveLength(RELIEF_CIRCUIT.challenges.length);
    }
  });

  it("preserves the six exact founding identities and embodiment bindings", () => {
    const org = authoredFounding(20260723);
    expect(Object.values(org.agents).map((agent) => agent.name)).toEqual([
      "Ilya Venn", "Nima Quell", "Orun Sable", "Tessara One", "Arden Pell", "Cinder Continuing",
    ]);
    expect(Object.values(org.agents).map((agent) => agent.compositionProfileId)).toEqual(
      RELIEF_CIRCUIT_SOURCE.cast.map((member) => member.profileId),
    );
  });

  it("leaves every precedent inherited and the ship mechanically changed", () => {
    const org = completeDeterministically();
    for (const consequence of RELIEF_CIRCUIT_SOURCE.consequences) {
      expect(org.cartridgeState?.[`consequence:${consequence.kind}:${consequence.id}`]).toBe(true);
    }
    expect(org.cartridgeState).toMatchObject({
      "habitat-integrity": 4,
      "temporal-coherence": 4,
      "roster-resilience": 4,
      "stores-and-care": 4,
      "continuity": 4,
    });
  });
});
