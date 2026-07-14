// Single deterministic scoring source (scoring.ts): the resolver, projections,
// and wipe-diagnosis all consume one definition of an agent's non-random check
// contribution, so read models carry the resolver's COMPLETE relationship,
// affliction, and trait semantics — not a partial reimplementation.
import { describe, expect, it } from "vitest";
import type { Agent, Organization } from "../../src/engine/types.js";
import { deterministicContribution } from "../../src/engine/scoring.js";
import { projectMechanics } from "../../src/engine/projections.js";
import { MINI_ARC, makeAgent } from "../fixtures/mini-arc.js";

function orgWith(agents: Agent[]): Organization {
  return {
    id: "scoring-org",
    name: "Scoring Org",
    reputation: 0,
    resources: { currency: 100, materials: 0, tokens: 3 },
    infrastructure: {} as Organization["infrastructure"],
    agents: Object.fromEntries(agents.map((a) => [a.id, a])),
    relationships: [],
    precedents: [],
    dramaQueue: [],
    cycle: 1,
    distributionPolicy: "council",
    rngSeed: 123,
  };
}

// A hothead at morale > 80 gains +10 to its highest attribute — the
// `attributeBonusWhenMoraleHigh` / `__highest__` term the read models used to drop.
function hothead(seed: number): Agent {
  const a = makeAgent(seed, { preferredRoleId: "striker" });
  a.attributes = { power: 90, focus: 20, reflex: 20 }; // highest = power, in check-power's weights
  a.morale = 90;
  a.traits = ["hothead"];
  return a;
}

describe("single deterministic scoring source", () => {
  const checkPower = MINI_ARC.challenges[0]!.mechanicChecks.find((c) => c.id === "check-power")!;

  it("carries the resolver's morale-high trait term", () => {
    const agent = hothead(1);
    const d = deterministicContribution(agent, checkPower, [], orgWith([agent]), MINI_ARC);
    expect(d.traitBonus).toBe(10);
    expect(d.total).toBeCloseTo(
      d.rawScore + d.gearBonus + d.relMod + d.moraleMod + d.afflictionMod + d.traitBonus,
      9,
    );
  });

  it("projection equals the resolver's deterministic score, trait included (fail-before)", () => {
    const agent = hothead(2);
    const org = orgWith([agent]);
    const d = deterministicContribution(agent, checkPower, [], org, MINI_ARC);
    const projection = projectMechanics({
      challenge: MINI_ARC.challenges[0]!,
      assignedAgents: [agent],
      org,
      arc: MINI_ARC,
    });
    const row = projection.find((p) => p.mechanicId === "check-power" && p.agentId === agent.id);
    expect(row).toBeDefined();
    // Before the single-source extraction, projections omitted
    // attributeBonusWhenMoraleHigh, so this projected score would be 10 lower.
    expect(row!.projectedScore).toBe(Math.round(d.total));
    expect(d.traitBonus).toBe(10);
  });
});
