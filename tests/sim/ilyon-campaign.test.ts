import { describe, expect, it } from "vitest";
import { KIND_GODS_OF_ILYON } from "../../src/arcs/kind-gods-of-ilyon.js";
import { foundOrganization } from "../../src/engine/founding.js";
import { simulateArcRun } from "../../src/sim/cartridge-conformance.js";

describe("The Kind Gods of Ilyon campaign", () => {
  it("finishes all six beats from its own authored founding state", () => {
    const run = simulateArcRun(KIND_GODS_OF_ILYON, {
      seed: 19,
      maxCycles: 40,
      initialOrganization: foundOrganization(KIND_GODS_OF_ILYON, { format: "axm-founding-input/1", seed: 19 }),
    });
    expect(run.outcome).toBe("cleared");
    expect(Object.keys(run.clearCycles).sort()).toEqual(KIND_GODS_OF_ILYON.challenges.map((challenge) => challenge.id).sort());
    expect(run.gateViolations).toBe(0);
    expect(run.warnings).toEqual([]);
  });

  it("has no structural stall across representative explicit founding seeds", () => {
    for (const seed of [1, 2, 7, 19, 42, 101]) {
      const run = simulateArcRun(KIND_GODS_OF_ILYON, {
        seed,
        maxCycles: 50,
        initialOrganization: foundOrganization(KIND_GODS_OF_ILYON, { format: "axm-founding-input/1", seed }),
      });
      expect(run.outcome, `seed ${seed}: ${run.stallReason}`).toBe("cleared");
      expect(run.gateViolations).toBe(0);
    }
  });
});
