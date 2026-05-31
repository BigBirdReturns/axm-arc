import { describe, expect, it } from "vitest";
import type {
  Agent,
  Facility,
  InfrastructureFacility,
  Organization,
} from "../../src/engine/types.js";
import { projectMechanics } from "../../src/engine/projections.js";
import { MINI_ARC, makeAgent } from "../fixtures/mini-arc.js";

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
    facilities[n] = {
      type: n,
      level: n === "Quarters" || n === "Recreation" ? 1 : 0,
      assignedAgents: [],
    };
  }
  return facilities as Record<InfrastructureFacility, Facility>;
}

function makeOrg(agents: Agent[]): Organization {
  return {
    id: "projection-org",
    name: "Projection Org",
    reputation: 0,
    resources: { currency: 100, materials: 0, tokens: 3 },
    infrastructure: defaultFacilities(),
    agents: Object.fromEntries(agents.map((a) => [a.id, a])),
    relationships: [],
    precedents: [],
    dramaQueue: [],
    cycle: 1,
    distributionPolicy: "council",
    rngSeed: 123,
  };
}

describe("projectMechanics UX metadata", () => {
  it("explains which attributes a check reads", () => {
    const agents = [makeAgent(1, { preferredRoleId: "striker" })];
    const challenge = MINI_ARC.challenges[0]!;
    const projections = projectMechanics({
      challenge,
      assignedAgents: agents,
      org: makeOrg(agents),
      arc: MINI_ARC,
    });

    expect(projections[0]?.attributeSummary).toBe("Power 70% · Reflex 30%");
    expect(projections[0]?.primaryAttributeName).toBe("Power");
    expect(projections[0]?.primaryAttributeDescription).toBe("Raw strength.");
    expect(projections[0]?.scopeHint).toContain("Every-agent check");
  });

  it("explains team aggregate checks as average-quality gates", () => {
    const agents = [
      makeAgent(1, { preferredRoleId: "striker" }),
      makeAgent(2, { preferredRoleId: "guardian" }),
    ];
    const challenge = MINI_ARC.challenges[0]!;
    const projections = projectMechanics({
      challenge,
      assignedAgents: agents,
      org: makeOrg(agents),
      arc: MINI_ARC,
    });
    const aggregate = projections.find((p) => p.scope === "team_aggregate")!;

    expect(aggregate.targetSummary).toContain("Team average");
    expect(aggregate.targetSummary).toContain("required 12 each");
    expect(aggregate.improvementHint).toMatch(/average Focus|low-score agents/);
  });
});
