import { describe, expect, it } from "vitest";
import type {
  Agent,
  Organization,
  Relationship,
} from "../../src/engine/types.js";
import {
  deterministicScoreBreakdown,
  effectiveCheckThreshold,
} from "../../src/engine/scoring.js";
import { projectMechanics } from "../../src/engine/projections.js";
import { resolveChallenge } from "../../src/engine/resolver.js";
import { Rng } from "../../src/engine/prng.js";
import { diagnoseWipe } from "../../src/sim/wipe-diagnosis.js";
import { MINI_ARC, makeAgent } from "../fixtures/mini-arc.js";

function makeOrg(
  agents: Agent[],
  relationships: Relationship[] = [],
): Organization {
  return {
    id: "scoring-parity-org",
    name: "Scoring Parity Org",
    reputation: 0,
    resources: { currency: 100, materials: 0, tokens: 3 },
    infrastructure: {} as Organization["infrastructure"],
    agents: Object.fromEntries(agents.map((agent) => [agent.id, agent])),
    relationships,
    precedents: [],
    dramaQueue: [],
    cycle: 1,
    distributionPolicy: "council",
    rngSeed: 271828,
  };
}

function stableAgent(
  seed: number,
  overrides: Partial<Agent> & Pick<Agent, "id" | "name">,
): Agent {
  const base = makeAgent(seed, { preferredRoleId: "striker" });
  return {
    ...base,
    traits: [],
    equippedItems: {},
    morale: 50,
    afflictionState: { kind: "none" },
    hiddenAttributes: { ...base.hiddenAttributes, volatility: 0 },
    ...overrides,
  };
}

describe("deterministic scoring contract", () => {
  it("matches every non-random resolver diagnostic term", () => {
    const arc = structuredClone(MINI_ARC);
    arc.customTraits.push({
      id: "parity-trait",
      name: "Parity Trait",
      description: "Exercises both resolver trait paths.",
      effects: [
        { kind: "attributeCheckBonus", attributeId: "power", bonus: 2 },
        {
          kind: "attributeBonusWhenMoraleHigh",
          attributeId: "__highest__",
          threshold: 55,
          bonus: 1,
        },
      ],
    });

    const scored = stableAgent(1, {
      id: "scored-agent",
      name: "Scored Agent",
      attributes: { power: 14, focus: 8, reflex: 10 },
      equippedItems: { weapon: "sword-of-dawn" },
      morale: 60,
      afflictionState: { kind: "Fearful", sinceCycle: 1 },
      traits: ["parity-trait"],
    });
    const partner = stableAgent(2, {
      id: "partner-agent",
      name: "Partner Agent",
      attributes: { power: 10, focus: 10, reflex: 10 },
    });
    const relationships: Relationship[] = [
      {
        agentIds: [scored.id, partner.id],
        state: "Hostile",
        affinity: -10,
      },
    ];
    const org = makeOrg([scored, partner], relationships);
    const challenge = arc.challenges[0]!;
    const check = challenge.mechanicChecks.find(
      (candidate) => candidate.id === "check-power",
    )!;

    const report = resolveChallenge({
      challenge,
      assignedAgents: [scored, partner],
      org,
      arc,
      rng: new Rng(0),
      cycle: 1,
      collectDiagnostics: true,
    });
    const contribution = report.diagnostics!.checks
      .find((diagnostic) => diagnostic.mechanicId === check.id)!
      .contributions.find((candidate) => candidate.agentId === scored.id)!;
    const expected = deterministicScoreBreakdown(
      scored,
      check,
      [scored, partner],
      org,
      arc,
    );

    expect(contribution.breakdown.rawScore).toBeCloseTo(expected.rawScore, 10);
    expect(contribution.breakdown.gearBonus).toBeCloseTo(expected.gearBonus, 10);
    expect(contribution.breakdown.relMod).toBeCloseTo(expected.relMod, 10);
    expect(contribution.breakdown.moraleMod).toBeCloseTo(expected.moraleMod, 10);
    expect(contribution.breakdown.afflictionMod).toBeCloseTo(expected.afflictionMod, 10);
    expect(contribution.breakdown.traitBonus).toBeCloseTo(expected.traitBonus, 10);
    expect(
      contribution.breakdown.total -
        contribution.breakdown.variance -
        contribution.breakdown.volatilitySwing,
    ).toBeCloseTo(expected.total, 10);

    // Non-vacuous receipts for the terms that previously drifted independently.
    expect(expected.gearBonus).toBe(1.5);
    expect(expected.relMod).toBeLessThan(0);
    expect(expected.afflictionMod).toBeLessThan(0);
    expect(expected.traitBonus).toBe(3);
  });

  const thresholdCases: Array<[
    "fixed" | "perAssignedAgent" | undefined,
    number,
  ]> = [
    [undefined, 12],
    ["fixed", 12],
    ["perAssignedAgent", 24],
  ];

  it.each(thresholdCases)(
    "keeps resolver and projections on the same %s team threshold mode",
    (thresholdMode, expectedThreshold) => {
      const arc = structuredClone(MINI_ARC);
      const challenge = arc.challenges[0]!;
      const check = challenge.mechanicChecks.find(
        (candidate) => candidate.id === "check-focus",
      )!;
      if (thresholdMode === undefined) delete check.thresholdMode;
      else check.thresholdMode = thresholdMode;

      const agents = [
        stableAgent(3, {
          id: "threshold-a",
          name: "Threshold A",
          attributes: { power: 10, focus: 10, reflex: 10 },
        }),
        stableAgent(4, {
          id: "threshold-b",
          name: "Threshold B",
          attributes: { power: 10, focus: 10, reflex: 10 },
        }),
      ];
      const org = makeOrg(agents);
      const report = resolveChallenge({
        challenge,
        assignedAgents: agents,
        org,
        arc,
        rng: new Rng(0),
        cycle: 1,
        collectDiagnostics: true,
      });
      const diagnostic = report.diagnostics!.checks.find(
        (candidate) => candidate.mechanicId === check.id,
      )!;
      const projection = projectMechanics({
        challenge,
        assignedAgents: agents,
        org,
        arc,
      }).find((candidate) => candidate.mechanicId === check.id)!;

      expect(effectiveCheckThreshold(check, agents.length)).toBe(expectedThreshold);
      expect(diagnostic.threshold).toBe(expectedThreshold);
      expect(projection.threshold).toBe(expectedThreshold);
    },
  );
});

describe("wipe diagnosis candidate ranking", () => {
  it("chooses the higher resolver-realized contribution when raw gear would reverse the ranking (#113)", () => {
    const arc = structuredClone(MINI_ARC);
    const challenge = arc.challenges[0]!;
    challenge.mechanicChecks = [
      {
        ...challenge.mechanicChecks.find((check) => check.id === "check-power")!,
        difficultyThreshold: 8,
      },
    ];
    challenge.timePressure = null;

    const culprit = stableAgent(10, {
      id: "culprit",
      name: "Culprit",
      attributes: { power: 1, focus: 20, reflex: 1 },
    });
    const strongerReal = stableAgent(11, {
      id: "stronger-real",
      name: "Stronger Real",
      attributes: { power: 12, focus: 12, reflex: 12 },
    });
    const rawGearWinner = stableAgent(12, {
      id: "raw-gear-winner",
      name: "Raw Gear Winner",
      attributes: { power: 10, focus: 10, reflex: 10 },
      equippedItems: { weapon: "sword-of-dawn" },
    });
    const org = makeOrg([culprit, strongerReal, rawGearWinner]);

    // The old diagnosis ranked the geared candidate as 10 + raw 3 = 13.
    expect(10 + 3).toBeGreaterThan(12);
    // The resolver-visible values reverse that order: 11.5 < 12.
    const check = challenge.mechanicChecks[0]!;
    expect(
      deterministicScoreBreakdown(
        rawGearWinner,
        check,
        [rawGearWinner],
        org,
        arc,
      ).total,
    ).toBe(11.5);

    const report = resolveChallenge({
      challenge,
      assignedAgents: [culprit],
      org,
      arc,
      rng: new Rng(0),
      cycle: 1,
      collectDiagnostics: true,
    });
    const diagnosis = diagnoseWipe(report, challenge, org, arc);
    const swap = diagnosis.fixes.find((fix) => fix.lever === "bench_swap");

    expect(swap).toBeDefined();
    expect(swap!.swapAgentId).toBe(strongerReal.id);
    expect(swap!.target).toBe(strongerReal.name);
  });

  it("prices candidates in the post-swap relationship context", () => {
    const arc = structuredClone(MINI_ARC);
    const challenge = arc.challenges[0]!;
    challenge.mechanicChecks = [
      {
        ...challenge.mechanicChecks.find((check) => check.id === "check-power")!,
        difficultyThreshold: 8,
      },
    ];
    challenge.timePressure = null;

    const culprit = stableAgent(20, {
      id: "relationship-culprit",
      name: "Relationship Culprit",
      attributes: { power: 1, focus: 20, reflex: 1 },
    });
    const ally = stableAgent(21, {
      id: "remaining-ally",
      name: "Remaining Ally",
      attributes: { power: 20, focus: 20, reflex: 20 },
    });
    const hostileRawWinner = stableAgent(22, {
      id: "hostile-raw-winner",
      name: "Hostile Raw Winner",
      attributes: { power: 12, focus: 12, reflex: 12 },
    });
    const neutralRealWinner = stableAgent(23, {
      id: "neutral-real-winner",
      name: "Neutral Real Winner",
      attributes: { power: 10, focus: 10, reflex: 10 },
    });
    const relationships: Relationship[] = [
      {
        agentIds: [hostileRawWinner.id, ally.id],
        state: "Hostile",
        affinity: -10,
      },
    ];
    const org = makeOrg(
      [culprit, ally, hostileRawWinner, neutralRealWinner],
      relationships,
    );

    // Raw attributes favor the hostile candidate, but the party that would
    // actually be fielded makes the neutral candidate the stronger swap.
    expect(hostileRawWinner.attributes.power).toBeGreaterThan(
      neutralRealWinner.attributes.power,
    );

    const report = resolveChallenge({
      challenge,
      assignedAgents: [culprit, ally],
      org,
      arc,
      rng: new Rng(0),
      cycle: 1,
      collectDiagnostics: true,
    });
    const diagnosis = diagnoseWipe(report, challenge, org, arc);
    const swap = diagnosis.fixes.find((fix) => fix.lever === "bench_swap");

    expect(swap).toBeDefined();
    expect(swap!.swapAgentId).toBe(neutralRealWinner.id);
  });

  it("does not manufacture a positive composition tradeoff for a worse role candidate", () => {
    const arc = structuredClone(MINI_ARC);
    const challenge = arc.challenges[0]!;
    challenge.mechanicChecks = [
      {
        ...challenge.mechanicChecks.find((check) => check.id === "check-power")!,
        difficultyThreshold: 20,
      },
    ];
    challenge.timePressure = null;

    const culprit = stableAgent(30, {
      id: "strong-guardian",
      name: "Strong Guardian",
      role: "guardian",
      attributes: { power: 10, focus: 10, reflex: 10 },
    });
    const worseStriker = stableAgent(31, {
      id: "worse-striker",
      name: "Worse Striker",
      role: "striker",
      attributes: { power: 1, focus: 1, reflex: 1 },
    });
    const org = makeOrg([culprit, worseStriker]);
    const report = resolveChallenge({
      challenge,
      assignedAgents: [culprit],
      org,
      arc,
      rng: new Rng(0),
      cycle: 1,
      collectDiagnostics: true,
    });
    const diagnosis = diagnoseWipe(report, challenge, org, arc);

    expect(
      diagnosis.fixes.some(
        (fix) =>
          fix.lever === "tradeoff" && fix.swapAgentId === worseStriker.id,
      ),
    ).toBe(false);
  });
});
