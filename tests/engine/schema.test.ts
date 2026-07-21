import { describe, it, expect } from "vitest";
import { validateArc } from "../../src/engine/schema";

function minimalArc(overrides: Record<string, unknown> = {}): unknown {
  return {
    meta: {
      id: "test-arc",
      name: "Test Arc",
      description: "A test arc.",
      author: "Tester",
      version: "1.0.0",
      engineVersion: "0.1.0",
      domain: "fantasy",
      estimatedCycles: 30,
    },
    attributes: [
      { id: "power", name: "Power", description: "Raw strength." },
      { id: "focus", name: "Focus", description: "Mental acuity." },
      { id: "resilience", name: "Resilience", description: "Endurance." },
    ],
    roles: [],
    tiers: [
      {
        id: "common",
        name: "Common",
        statBudgetMin: 20,
        statBudgetMax: 40,
        upkeepCost: 10,
        baseEfficiencyModifier: 1.2,
      },
    ],
    currencyName: "Gold",
    materialName: "Materials",
    tokenName: "Lockouts",
    reputationName: "Renown",
    tokensPerCycle: 3,
    maxTokens: 9,
    infrastructureTokenBonus: 0.5,
    namePool: { firstNames: ["Aric", "Lira"], lastNames: ["Ashveil"] },
    customTraits: [],
    progressionTiers: [],
    attunementChains: [],
    challenges: [],
    difficultyModes: [],
    items: [],
    narrativeEvents: [],
    scaling: null,
    ...overrides,
  };
}

describe("validateArc", () => {
  it("accepts a minimal valid arc", () => {
    expect(() => validateArc(minimalArc())).not.toThrow();
    const arc = validateArc(minimalArc());
    expect(arc.meta.id).toBe("test-arc");
    expect(arc.attributes).toHaveLength(3);
  });

  it("accepts and preserves authored opening law", () => {
    const opening = {
      triggerType: "founding-oath",
      narrativeText: "Choose the hall's founding posture.",
      options: [
        {
          id: "stand-open",
          label: "Stand open",
          description: "The roster answers together.",
          effects: [{ scope: "all", type: "morale", value: 2 }],
        },
        {
          id: "stand-back",
          label: "Stand back",
          description: "The roster waits.",
          effects: [{ scope: "all", type: "stress", value: 1 }],
        },
      ],
    };
    const meta = {
      ...(minimalArc() as { meta: Record<string, unknown> }).meta,
      engineVersion: "1.1.0",
    };
    expect(validateArc(minimalArc({ meta, opening })).opening).toEqual(opening);
    expect(() => validateArc(minimalArc({ opening }))).toThrow(
      /opening\/founding law requires engineVersion 1\.1\.0/,
    );
  });

  it("rejects duplicate authored opening option ids", () => {
    const option = {
      id: "same",
      label: "A choice",
      description: "A consequence.",
      effects: [{ scope: "all", type: "loyalty", value: 1 }],
    };
    expect(() => validateArc(minimalArc({
      meta: {
        ...(minimalArc() as { meta: Record<string, unknown> }).meta,
        engineVersion: "1.1.0",
      },
      opening: {
        triggerType: "oath",
        narrativeText: "Choose.",
        options: [option, { ...option, label: "Another choice" }],
      },
    }))).toThrow(/duplicate option id "same"/);
  });

  it("validates founding references instead of accepting client-only boot law", () => {
    const facilities = ["Quarters", "Production", "Recreation", "Research", "Training", "Storage", "Medical"]
      .map((type) => ({ type, level: 0 }));
    const founding = {
      organization: { id: "org", name: "The Org" },
      resources: { currency: 10, materials: 0, tokens: 1 },
      facilities,
      distributionPolicy: "council",
      roster: [{ id: "founder", tierId: "common" }],
      relationships: [],
    };
    const meta = {
      ...(minimalArc() as { meta: Record<string, unknown> }).meta,
      engineVersion: "1.1.0",
    };
    expect(validateArc(minimalArc({ meta, founding })).founding).toEqual(founding);
    expect(() => validateArc(minimalArc({
      meta,
      founding: {
        ...founding,
        roster: [{ id: "founder", tierId: "missing" }],
      },
    }))).toThrow(/unknown tierId "missing"/);
    expect(() => validateArc(minimalArc({
      meta,
      maxTokens: 1,
      founding: {
        ...founding,
        resources: { ...founding.resources, tokens: 2 },
      },
    }))).toThrow(/Founding tokens \(2\) exceed maxTokens \(1\)/);
    expect(() => validateArc(minimalArc({
      meta,
      founding: {
        ...founding,
        roster: [
          { id: "founder", tierId: "common" },
          { id: "second", tierId: "common" },
        ],
        relationships: [
          { rosterSlotIds: ["founder", "second"], state: "Neutral", affinity: 0 },
          { rosterSlotIds: ["second", "founder"], state: "Allied", affinity: 10 },
        ],
      },
    }))).toThrow(/duplicate relationship/);
  });

  it("accepts JSON-only namespaced extensions and authored founder names at engine 1.2", () => {
    const base = minimalArc() as Record<string, unknown>;
    const facilities = ["Quarters", "Production", "Recreation", "Research", "Training", "Storage", "Medical"]
      .map((type) => ({ type, level: 0 }));
    const arc = validateArc(minimalArc({
      meta: { ...(base.meta as Record<string, unknown>), engineVersion: "1.2.0" },
      founding: {
        organization: { id: "org", name: "Org" },
        resources: { currency: 0, materials: 0, tokens: 0 },
        facilities, distributionPolicy: "council",
        roster: [{ id: "named", name: "Named Founder", tierId: "common" }],
        relationships: [],
      },
      extensions: { "godscar.pocket@1": { format: "godscar-pocket/1", values: [1, true, null] } },
    }));
    expect(arc.founding?.roster[0]?.name).toBe("Named Founder");
    expect(arc.extensions?.["godscar.pocket@1"]).toEqual({ format: "godscar-pocket/1", values: [1, true, null] });
    expect(() => validateArc(minimalArc({
      meta: { ...(base.meta as Record<string, unknown>), engineVersion: "1.2.0" },
      extensions: { "Not Namespaced": {} },
    }))).toThrow(/Extension keys/);
    expect(() => validateArc(minimalArc({ extensions: { "godscar.pocket@1": {} } }))).toThrow(/require engineVersion 1\.2\.0/);
  });

  it("throws when a required top-level field is missing", () => {
    const bad = minimalArc();
    delete (bad as Record<string, unknown>)["meta"];
    expect(() => validateArc(bad)).toThrow(/Invalid arc/);
  });

  it("enforces meta.engineVersion as a real runtime floor", () => {
    expect(() => validateArc(minimalArc({
      meta: {
        ...(minimalArc() as { meta: Record<string, unknown> }).meta,
        engineVersion: "1.3.0",
      },
    }))).toThrow(/requires engine 1\.3\.0.*provides 1\.2\.0/);
    expect(() => validateArc(minimalArc({
      meta: {
        ...(minimalArc() as { meta: Record<string, unknown> }).meta,
        engineVersion: "future",
      },
    }))).toThrow(/Invalid engine version/);
  });

  it("throws when attributes array has fewer than 3 entries", () => {
    const bad = minimalArc({
      attributes: [{ id: "power", name: "Power", description: "x" }],
    });
    expect(() => validateArc(bad)).toThrow(/Invalid arc/);
  });

  it("throws when mechanic check attribute weights do not sum to 1.0", () => {
    const arc = minimalArc({
      challenges: [
        {
          id: "ch1",
          name: "Challenge 1",
          description: "A challenge.",
          rosterRequirements: { minAgents: 1, maxAgents: 5, roleRequirements: [] },
          accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
          difficultyRating: 50,
          mechanicChecks: [
            {
              id: "mc1",
              name: "Check 1",
              description: "A check.",
              attributeWeights: [
                { attributeId: "power", weight: 0.3 },
                { attributeId: "focus", weight: 0.3 },
                // total = 0.6, not 1.0
              ],
              difficultyThreshold: 15,
              scope: "per_agent",
              failureConsequence: { type: "stress", severity: 0.5 },
            },
          ],
          completionCriteria: { type: "all_mechanics_passed", parameters: {} },
          timePressure: null,
          outcomes: {
            success: { rewardTable: [], narrative: "Win." },
            partial: { rewardTable: [], narrative: "Partial." },
            failure: { rewardTable: [], narrative: "Fail." },
          },
        },
      ],
    });
    expect(() => validateArc(arc)).toThrow(/weights must sum to 1\.0/);
  });

  it("throws when a mechanic check references an unknown attribute id", () => {
    const arc = minimalArc({
      challenges: [
        {
          id: "ch1",
          name: "Challenge 1",
          description: "desc",
          rosterRequirements: { minAgents: 1, maxAgents: 5, roleRequirements: [] },
          accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
          difficultyRating: 40,
          mechanicChecks: [
            {
              id: "mc1",
              name: "Check 1",
              description: "desc",
              attributeWeights: [{ attributeId: "nonexistent_attr", weight: 1.0 }],
              difficultyThreshold: 10,
              scope: "per_agent",
              failureConsequence: { type: "stress", severity: 0.3 },
            },
          ],
          completionCriteria: { type: "all_mechanics_passed", parameters: {} },
          timePressure: null,
          outcomes: {
            success: { rewardTable: [], narrative: "Win." },
            partial: { rewardTable: [], narrative: "Partial." },
            failure: { rewardTable: [], narrative: "Fail." },
          },
        },
      ],
    });
    expect(() => validateArc(arc)).toThrow(/unknown attributeId/);
  });

  it("accepts a Karazhan-shaped arc with 5 attributes, 4 roles, and 1 challenge", () => {
    const arc = minimalArc({
      attributes: [
        { id: "power", name: "Power", description: "Melee damage." },
        { id: "resilience", name: "Resilience", description: "Survival." },
        { id: "precision", name: "Precision", description: "Ranged accuracy." },
        { id: "adaptability", name: "Adaptability", description: "Utility." },
        { id: "focus", name: "Focus", description: "Spellcasting." },
      ],
      roles: [
        { id: "tank", name: "Tank", attributeWeights: { resilience: 0.7, power: 0.3 } },
        { id: "healer", name: "Healer", attributeWeights: { focus: 0.8, adaptability: 0.2 } },
        { id: "melee", name: "Melee DPS", attributeWeights: { power: 0.6, precision: 0.4 } },
        { id: "ranged", name: "Ranged DPS", attributeWeights: { precision: 0.7, focus: 0.3 } },
      ],
      challenges: [
        {
          id: "attumen",
          name: "Attumen the Huntsman",
          description: "First boss.",
          rosterRequirements: {
            minAgents: 5,
            maxAgents: 10,
            roleRequirements: [
              { roleId: "tank", count: 1 },
              { roleId: "healer", count: 2 },
            ],
          },
          accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
          difficultyRating: 30,
          mechanicChecks: [
            {
              id: "charge",
              name: "Charge",
              description: "Tank must absorb charge.",
              attributeWeights: [
                { attributeId: "resilience", weight: 0.7 },
                { attributeId: "power", weight: 0.3 },
              ],
              difficultyThreshold: 12,
              scope: "role_specific",
              failureConsequence: { type: "agent_damage", severity: 0.6 },
            },
          ],
          completionCriteria: { type: "all_mechanics_passed", parameters: {} },
          timePressure: null,
          outcomes: {
            success: { rewardTable: [{ itemId: "item_stalkers_helm", dropRate: 1.0 }], narrative: "Attumen falls.", reputationGain: 5, milestoneFlag: "attumen_cleared" },
            partial: { rewardTable: [], narrative: "Partial clear.", agentDowntimeCycles: 1 },
            failure: { rewardTable: [], narrative: "Wipe.", stressPenalty: 2, tokenRefund: 0.5 },
          },
        },
      ],
    });
    expect(() => validateArc(arc)).not.toThrow();
    const parsed = validateArc(arc);
    expect(parsed.attributes).toHaveLength(5);
    expect(parsed.roles).toHaveLength(4);
    expect(parsed.challenges).toHaveLength(1);
    expect(parsed.challenges[0]!.id).toBe("attumen");
  });

  it("normalizes legacy string reward entries to dropRate 1.0", () => {
    const arc = minimalArc({
      challenges: [
        {
          id: "c",
          name: "C",
          description: "",
          rosterRequirements: { minAgents: 1, maxAgents: 1, roleRequirements: [] },
          accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
          difficultyRating: 1,
          mechanicChecks: [{
            id: "m", name: "M", description: "",
            attributeWeights: [{ attributeId: "power", weight: 1 }],
            difficultyThreshold: 1, scope: "per_agent",
            failureConsequence: { type: "stress", severity: 0.1 },
          }],
          completionCriteria: { type: "all_mechanics_passed", parameters: {} },
          timePressure: null,
          outcomes: {
            success: { rewardTable: ["legacy-item"], narrative: "" },
            partial: { rewardTable: [], narrative: "" },
            failure: { rewardTable: [], narrative: "" },
          },
        },
      ],
    });
    const parsed = validateArc(arc);
    expect(parsed.challenges[0]!.outcomes.success.rewardTable).toEqual([
      { itemId: "legacy-item", dropRate: 1.0 },
    ]);
  });

  it("rejects dropRate outside [0, 1]", () => {
    const make = (dropRate: number) => minimalArc({
      challenges: [
        {
          id: "c",
          name: "C",
          description: "",
          rosterRequirements: { minAgents: 1, maxAgents: 1, roleRequirements: [] },
          accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
          difficultyRating: 1,
          mechanicChecks: [{
            id: "m", name: "M", description: "",
            attributeWeights: [{ attributeId: "power", weight: 1 }],
            difficultyThreshold: 1, scope: "per_agent",
            failureConsequence: { type: "stress", severity: 0.1 },
          }],
          completionCriteria: { type: "all_mechanics_passed", parameters: {} },
          timePressure: null,
          outcomes: {
            success: { rewardTable: [{ itemId: "x", dropRate }], narrative: "" },
            partial: { rewardTable: [], narrative: "" },
            failure: { rewardTable: [], narrative: "" },
          },
        },
      ],
    });
    expect(() => validateArc(make(1.5))).toThrow();
    expect(() => validateArc(make(-0.1))).toThrow();
  });
});

describe("thresholdMode validation", () => {
  function arcWithCheck(check: Record<string, unknown>): unknown {
    return minimalArc({
      challenges: [
        {
          id: "ch1",
          name: "Challenge 1",
          description: "A challenge.",
          rosterRequirements: { minAgents: 1, maxAgents: 5, roleRequirements: [] },
          accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
          difficultyRating: 50,
          mechanicChecks: [
            {
              id: "mc1",
              name: "Check 1",
              description: "A check.",
              attributeWeights: [{ attributeId: "power", weight: 1.0 }],
              difficultyThreshold: 15,
              failureConsequence: { type: "stress", severity: 0.5 },
              ...check,
            },
          ],
          completionCriteria: { type: "all_mechanics_passed", parameters: {} },
          timePressure: null,
          outcomes: {
            success: { rewardTable: [], narrative: "Win." },
            partial: { rewardTable: [], narrative: "Partial." },
            failure: { rewardTable: [], narrative: "Fail." },
          },
        },
      ],
    });
  }

  it("accepts thresholdMode on a team_aggregate check", () => {
    expect(() =>
      validateArc(arcWithCheck({ scope: "team_aggregate", thresholdMode: "perAssignedAgent" })),
    ).not.toThrow();
    expect(() =>
      validateArc(arcWithCheck({ scope: "team_aggregate", thresholdMode: "fixed" })),
    ).not.toThrow();
  });

  it("accepts checks that omit thresholdMode entirely", () => {
    expect(() => validateArc(arcWithCheck({ scope: "per_agent" }))).not.toThrow();
    expect(() => validateArc(arcWithCheck({ scope: "team_aggregate" }))).not.toThrow();
  });

  it("rejects thresholdMode on non-team_aggregate checks", () => {
    expect(() =>
      validateArc(arcWithCheck({ scope: "per_agent", thresholdMode: "perAssignedAgent" })),
    ).toThrow(/thresholdMode only applies to team_aggregate/);
    expect(() =>
      validateArc(arcWithCheck({ scope: "role_specific", thresholdMode: "fixed" })),
    ).toThrow(/thresholdMode only applies to team_aggregate/);
  });

  it("rejects unknown thresholdMode values", () => {
    expect(() =>
      validateArc(arcWithCheck({ scope: "team_aggregate", thresholdMode: "scaled" })),
    ).toThrow(/Invalid arc/);
  });
});

describe("role_specific roleIds validation", () => {
  function arcWithRoleIds(roleIds: string[] | undefined): unknown {
    const check: Record<string, unknown> = {
      id: "hold-line",
      name: "Hold the Line",
      description: "The tank must hold.",
      attributeWeights: [{ attributeId: "resilience", weight: 1 }],
      difficultyThreshold: 10,
      scope: "role_specific",
      failureConsequence: { type: "stress", severity: 0.3 },
    };
    if (roleIds !== undefined) check.roleIds = roleIds;

    return minimalArc({
      roles: [
        { id: "tank", name: "Tank", attributeWeights: { resilience: 1 } },
        { id: "healer", name: "Healer", attributeWeights: { focus: 1 } },
      ],
      challenges: [
        {
          id: "ch1",
          name: "Challenge 1",
          description: "A challenge.",
          rosterRequirements: {
            minAgents: 2,
            maxAgents: 4,
            roleRequirements: [{ roleId: "tank", count: 1 }],
          },
          accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
          difficultyRating: 40,
          mechanicChecks: [check],
          completionCriteria: { type: "all_mechanics_passed", parameters: {} },
          timePressure: null,
          outcomes: {
            success: { rewardTable: [], narrative: "Win." },
            partial: { rewardTable: [], narrative: "Partial." },
            failure: { rewardTable: [], narrative: "Fail." },
          },
        },
      ],
    });
  }

  it("preserves omitted and empty roleIds as the legacy challenge-role fallback", () => {
    const omitted = validateArc(arcWithRoleIds(undefined));
    const empty = validateArc(arcWithRoleIds([]));
    expect(omitted.challenges[0]!.mechanicChecks[0]!.roleIds).toBeUndefined();
    expect(empty.challenges[0]!.mechanicChecks[0]!.roleIds).toEqual([]);
  });

  it("accepts explicit roleIds that reference declared Arc roles", () => {
    expect(() => validateArc(arcWithRoleIds(["tank"]))).not.toThrow();
  });

  it("rejects every explicit roleId that is not declared by the Arc", () => {
    expect(() => validateArc(arcWithRoleIds(["ghost"]))).toThrow(
      /\[challenges\.0\.mechanicChecks\.0\.roleIds\.0\].*unknown roleId "ghost"/,
    );
    expect(() => validateArc(arcWithRoleIds(["tank", "ghost"]))).toThrow(
      /\[challenges\.0\.mechanicChecks\.0\.roleIds\.1\].*unknown roleId "ghost"/,
    );
  });
});

describe("roster requirements validation", () => {
  const TWO_ROLES = [
    { id: "tank", name: "Tank", attributeWeights: { power: 1 } },
    { id: "healer", name: "Healer", attributeWeights: { focus: 1 } },
  ];

  function arcWithRoster(rosterRequirements: unknown, roles: unknown[] = TWO_ROLES): unknown {
    return minimalArc({
      roles,
      challenges: [
        {
          id: "ch1",
          name: "Challenge 1",
          description: "A challenge.",
          rosterRequirements,
          accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
          difficultyRating: 40,
          mechanicChecks: [
            {
              id: "mc1",
              name: "Check 1",
              description: "A check.",
              attributeWeights: [{ attributeId: "power", weight: 1.0 }],
              difficultyThreshold: 10,
              scope: "per_agent",
              failureConsequence: { type: "stress", severity: 0.3 },
            },
          ],
          completionCriteria: { type: "all_mechanics_passed", parameters: {} },
          timePressure: null,
          outcomes: {
            success: { rewardTable: [], narrative: "Win." },
            partial: { rewardTable: [], narrative: "Partial." },
            failure: { rewardTable: [], narrative: "Fail." },
          },
        },
      ],
    });
  }

  it("accepts a fieldable composition (sum of role counts within maxAgents, valid unique roles)", () => {
    expect(() =>
      validateArc(
        arcWithRoster({
          minAgents: 4,
          maxAgents: 8,
          roleRequirements: [
            { roleId: "tank", count: 2 },
            { roleId: "healer", count: 2 },
          ],
        }),
      ),
    ).not.toThrow();
  });

  it("rejects minAgents greater than maxAgents", () => {
    expect(() =>
      validateArc(arcWithRoster({ minAgents: 6, maxAgents: 4, roleRequirements: [] })),
    ).toThrow(/minAgents \(6\) exceeds maxAgents \(4\)/);
  });

  it("rejects a roleRequirements entry referencing an unknown roleId", () => {
    expect(() =>
      validateArc(arcWithRoster({ minAgents: 1, maxAgents: 5, roleRequirements: [{ roleId: "ghost", count: 1 }] })),
    ).toThrow(/unknown roleId "ghost"/);
  });

  it("rejects duplicate role entries within one challenge", () => {
    expect(() =>
      validateArc(
        arcWithRoster({
          minAgents: 1,
          maxAgents: 5,
          roleRequirements: [
            { roleId: "tank", count: 1 },
            { roleId: "tank", count: 2 },
          ],
        }),
      ),
    ).toThrow(/duplicate rosterRequirements entry for roleId "tank"/);
  });

  it("rejects role demands whose sum exceeds maxAgents (an unfieldable composition)", () => {
    expect(() =>
      validateArc(
        arcWithRoster({
          minAgents: 1,
          maxAgents: 3,
          roleRequirements: [
            { roleId: "tank", count: 2 },
            { roleId: "healer", count: 2 },
          ],
        }),
      ),
    ).toThrow(/demand 4 agents across roles but maxAgents is 3/);
  });
});
