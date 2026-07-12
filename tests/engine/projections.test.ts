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
  for (const name of names) {
    facilities[name] = {
      type: name,
      level: name === "Quarters" || name === "Recreation" ? 1 : 0,
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
    agents: Object.fromEntries(agents.map((agent) => [agent.id, agent])),
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

  it("treats an omitted team thresholdMode as a fixed authored total", () => {
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
    const aggregate = projections.find((projection) => projection.scope === "team_aggregate")!;

    expect(aggregate.threshold).toBe(12);
    expect(aggregate.targetSummary).toContain("fixed required 12");
    expect(aggregate.targetSummary).not.toContain("required 12 each");
    expect(aggregate.scopeHint).toContain("Fixed team-total check");
    expect(aggregate.improvementHint).toContain("positive contributors");
  });

  it("scales only a team check that explicitly declares perAssignedAgent", () => {
    const arc = structuredClone(MINI_ARC);
    const challenge = arc.challenges[0]!;
    const aggregateCheck = challenge.mechanicChecks.find(
      (check) => check.scope === "team_aggregate",
    )!;
    aggregateCheck.thresholdMode = "perAssignedAgent";
    const agents = [
      makeAgent(1, { preferredRoleId: "striker" }),
      makeAgent(2, { preferredRoleId: "guardian" }),
    ];
    const projections = projectMechanics({
      challenge,
      assignedAgents: agents,
      org: makeOrg(agents),
      arc,
    });
    const aggregate = projections.find((projection) => projection.scope === "team_aggregate")!;

    expect(aggregate.threshold).toBe(24);
    expect(aggregate.targetSummary).toContain("required 12 each");
    expect(aggregate.scopeHint).toContain("Team average check");
    expect(aggregate.improvementHint).toMatch(/average Focus|low-score agents/);
  });
});
