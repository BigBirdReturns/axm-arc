import { describe, expect, it } from "vitest";
import { tickInfrastructure } from "../../src/engine/infrastructure.js";
import { Rng } from "../../src/engine/prng.js";
import { CYCLE_ARC, makeCycleAgent, makeCycleOrg } from "../fixtures/cycle-arc.js";

describe("production economy", () => {
  it("does not apply Industrious twice when baseEfficiency already includes it", () => {
    const plain = { ...makeCycleAgent({ id: "plain" }), baseEfficiency: 8 };
    const industrious = {
      ...makeCycleAgent({ id: "industrious", traits: ["industrious"] }),
      baseEfficiency: 10.4,
    };
    const org = makeCycleOrg([plain, industrious]);
    org.infrastructure.Production = {
      type: "Production",
      level: 2,
      assignedAgents: [plain.id, industrious.id],
    };

    const result = tickInfrastructure(org, CYCLE_ARC, new Rng(1), org.cycle).org;

    expect(result.resources.materials - org.resources.materials).toBe(
      Math.floor((plain.baseEfficiency + industrious.baseEfficiency) * 2),
    );
  });
});
