import { describe, expect, it } from "vitest";
import type {
  CompositionConstraint,
  CompositionConstraintResult,
  CompositionProfile,
} from "../../src/engine/abi13.js";
import { evaluateComposition } from "../../src/engine/composition.js";
import { runCycle } from "../../src/engine/cycle.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";
import { resolveChallenge } from "../../src/engine/resolver.js";
import { deserializeGame, SAVE_VERSION, serializeGame } from "../../src/engine/save.js";
import { validateArc } from "../../src/engine/schema.js";
import {
  applyCartridgeStateEffects,
  CartridgeStateError,
  initializeCartridgeState,
} from "../../src/engine/state.js";
import type { Agent, Arc, Challenge, Organization } from "../../src/engine/types.js";
import { compileCommonShipPocket } from "../../src/common-ship/compiler.js";
import { COMMON_SHIP_STARTER } from "../../src/common-ship/templates.js";
import { compileDarkTombPocket } from "../../src/dark-tomb/compiler.js";
import { DARK_TOMB_STARTER } from "../../src/dark-tomb/templates.js";
import { MINI_ARC } from "../fixtures/mini-arc.js";
import { makeCycleAgent, makeCycleOrg } from "../fixtures/cycle-arc.js";

function stateArc(): Arc {
  const raw = structuredClone(MINI_ARC);
  raw.meta.engineVersion = "1.3.0";
  raw.stateDefinitions = [
    {
      id: "pressure",
      label: "Pressure",
      description: "A bounded test track.",
      visibility: "public",
      kind: "number",
      initial: 1,
      min: 0,
      max: 3,
    },
    {
      id: "phase",
      label: "Phase",
      description: "A test transition.",
      visibility: "operator",
      kind: "enum",
      initial: "closed",
      values: ["closed", "open"],
    },
  ];
  const challenge = raw.challenges[0]!;
  challenge.mechanicChecks = [{
    id: "certain",
    name: "Certain",
    description: "A deterministic low threshold.",
    attributeWeights: [{ attributeId: "power", weight: 1 }],
    difficultyThreshold: 0,
    scope: "per_agent",
    failureConsequence: { type: "stress", severity: 0 },
  }];
  challenge.timePressure = null;
  challenge.outcomes = {
    success: {
      rewardTable: [],
      narrative: "The pressure changes.",
      milestoneFlag: "state-cleared",
      stateEffects: [
        { stateId: "pressure", operation: "increment", value: 1, reason: "The system absorbs one unit." },
        { stateId: "phase", operation: "transition", from: "closed", to: "open", reason: "The route opens." },
      ],
    },
    partial: { rewardTable: [], narrative: "Partial." },
    failure: { rewardTable: [], narrative: "Failure." },
  };
  return validateArc(raw);
}

const PROFILES: CompositionProfile[] = [
  {
    id: "profile-a",
    name: "Profile A",
    description: "First profile.",
    tags: ["translator", "accounted", "reserve"],
    metrics: { capacity: 2 },
    ranges: { temperature: { min: 10, max: 20 } },
    dependencies: ["shared-medium", "a-only"],
  },
  {
    id: "profile-b",
    name: "Profile B",
    description: "Second profile.",
    tags: ["translator", "accounted"],
    metrics: { capacity: 3 },
    ranges: { temperature: { min: 15, max: 25 } },
    dependencies: ["shared-medium"],
  },
];

function compositionConstraints(roleId: string): CompositionConstraint[] {
  return [
    {
      id: "all-required",
      label: "All required",
      kind: "all",
      constraints: [
        { id: "role", label: "Role", kind: "role-count", roleId, min: 1 },
        { id: "profiles", label: "Profiles", kind: "profile-count", profileIds: ["profile-a", "profile-b"], min: 2 },
        { id: "tags", label: "Tag count", kind: "tag-count", tag: "translator", min: 2 },
        { id: "metric", label: "Metric sum", kind: "metric-sum", metric: "capacity", comparison: "gte", threshold: 5 },
        { id: "range", label: "Range overlap", kind: "range-overlap", range: "temperature", required: { min: 16, max: 18 }, minProfiles: 2 },
        { id: "fraction", label: "Fraction", kind: "fraction", tag: "accounted", minFraction: 1 },
        { id: "redundancy", label: "Redundancy", kind: "redundancy", tag: "translator", minDistinctProfiles: 2 },
      ],
    },
    {
      id: "any-path",
      label: "Any lawful path",
      kind: "any",
      constraints: [
        { id: "absent-tag", label: "Absent tag", kind: "tag-count", tag: "absent", min: 1 },
        { id: "translator-path", label: "Translator path", kind: "tag-count", tag: "translator", min: 2 },
      ],
    },
  ];
}

function compositionArc(): Arc {
  const raw = structuredClone(MINI_ARC);
  raw.meta.engineVersion = "1.3.0";
  raw.compositionProfiles = structuredClone(PROFILES);
  const challenge = raw.challenges[0]!;
  challenge.compositionConstraints = compositionConstraints("striker");
  return validateArc(raw);
}

function profiledAgents(): Agent[] {
  return [
    { ...makeCycleAgent({ id: "a" }), compositionProfileId: "profile-a" },
    { ...makeCycleAgent({ id: "b" }), compositionProfileId: "profile-b" },
  ];
}

function flatten(results: CompositionConstraintResult[]): CompositionConstraintResult[] {
  return results.flatMap((result) => [result, ...(result.children ? flatten(result.children) : [])]);
}

describe("engine 1.3 cartridge state", () => {
  it("initializes declared state deterministically and records exact state changes through runCycle", () => {
    const arc = stateArc();
    const agent = makeCycleAgent({ id: "operator" });
    const org = makeCycleOrg([agent], { tokens: 5 });
    const initialized = initializeCartridgeState(org, arc);
    expect(initialized.cartridgeState).toEqual({ phase: "closed", pressure: 1 });

    const result = runCycle({
      org,
      arc,
      assignments: [{ challengeId: arc.challenges[0]!.id, agentIds: [agent.id], tokensSpent: 0 }],
    });

    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]!.outcome).toBe("success");
    expect(result.org.cartridgeState).toEqual({ phase: "open", pressure: 2 });
    expect(result.reports[0]!.stateChanges).toEqual([
      {
        stateId: "pressure",
        before: 1,
        after: 2,
        operation: "increment",
        reason: "The system absorbs one unit.",
        source: { challengeId: arc.challenges[0]!.id, outcome: "success", cycle: 1 },
      },
      {
        stateId: "phase",
        before: "closed",
        after: "open",
        operation: "transition",
        reason: "The route opens.",
        source: { challengeId: arc.challenges[0]!.id, outcome: "success", cycle: 1 },
      },
    ]);
    expect(result.events.filter((event) => event.type === "cartridge_state_change")).toHaveLength(2);
  });

  it("supports explicit clamping, rejects implicit overflow, and leaves the supplied organization unchanged on failure", () => {
    const arc = stateArc();
    const original = initializeCartridgeState(makeCycleOrg([]), arc);
    const clamped = applyCartridgeStateEffects({
      org: original,
      arc,
      effects: [{ stateId: "pressure", operation: "increment", value: 99, overflow: "clamp", reason: "Bounded emergency load." }],
      source: { challengeId: "manual", outcome: "success", cycle: 1 },
    });
    expect(clamped.org.cartridgeState?.pressure).toBe(3);
    expect(clamped.changes[0]).toMatchObject({ before: 1, after: 3 });

    expect(() => applyCartridgeStateEffects({
      org: original,
      arc,
      effects: [
        { stateId: "pressure", operation: "increment", value: 1, reason: "Would be valid." },
        { stateId: "missing", operation: "set", value: true, reason: "Must fail." },
      ],
      source: { challengeId: "manual", outcome: "success", cycle: 1 },
    })).toThrow(CartridgeStateError);
    expect(original.cartridgeState).toEqual({ phase: "closed", pressure: 1 });

    expect(() => applyCartridgeStateEffects({
      org: original,
      arc,
      effects: [{ stateId: "pressure", operation: "increment", value: 99, reason: "Unbounded load is refused." }],
      source: { challengeId: "manual", outcome: "success", cycle: 1 },
    })).toThrow(/outside \[0, 3\]/);
  });

  it("migrates exact-digest v2 saves to v3 and backfills state from the bound Arc", () => {
    const arc = stateArc();
    const org = makeCycleOrg([makeCycleAgent({ id: "saved" })]);
    const legacyOrg = structuredClone(org) as Organization & { cartridgeState?: unknown };
    delete legacyOrg.cartridgeState;
    const v2 = JSON.stringify({
      version: 2,
      savedAt: "2026-07-22T00:00:00.000Z",
      arcRef: { id: arc.meta.id, version: arc.meta.version, digest: cartridgeDigest(arc) },
      organization: legacyOrg,
      pendingRewardChoices: [],
    });

    const restored = deserializeGame(v2, arc);
    expect(SAVE_VERSION).toBe(3);
    expect(restored.org.cartridgeState).toEqual({ phase: "closed", pressure: 1 });
    const serialized = JSON.parse(serializeGame(restored.org, arc)) as { version: number; arcRef: { digest: string } };
    expect(serialized.version).toBe(3);
    expect(serialized.arcRef.digest).toBe(cartridgeDigest(arc));
  });

  it("keeps engine-1.2 cartridges valid without manufacturing undeclared state", () => {
    const legacy = validateArc(structuredClone(MINI_ARC));
    const org = makeCycleOrg([]);
    expect(legacy.stateDefinitions).toBeUndefined();
    expect(initializeCartridgeState(org, legacy)).toBe(org);
  });

  it("refuses invalid state law at validation time", () => {
    const unknownEffect = structuredClone(stateArc());
    unknownEffect.challenges[0]!.outcomes.success.stateEffects![0]!.stateId = "unknown";
    expect(() => validateArc(unknownEffect)).toThrow(/undeclared state "unknown"/);

    const wrongType = structuredClone(stateArc());
    wrongType.challenges[0]!.outcomes.success.stateEffects![0] = {
      stateId: "phase",
      operation: "set",
      value: 2,
      reason: "Wrong type.",
    };
    expect(() => validateArc(wrongType)).toThrow(/does not satisfy state "phase"/);

    const oldEngine = structuredClone(stateArc());
    oldEngine.meta.engineVersion = "1.2.0";
    expect(() => validateArc(oldEngine)).toThrow(/require engineVersion 1\.3\.0/);
  });
});

describe("engine 1.3 composition law", () => {
  it("evaluates every bounded operator deterministically", () => {
    const arc = compositionArc();
    const challenge = arc.challenges[0]!;
    const first = evaluateComposition({ arc, challenge, agents: profiledAgents() });
    const second = evaluateComposition({ arc, challenge, agents: profiledAgents().reverse() });

    expect(first).toEqual(second);
    expect(first.feasible).toBe(true);
    expect(first.rejectionReasons).toEqual([]);
    expect(first.dependencies).toEqual(["a-only", "shared-medium"]);
    expect(first.singlePointsOfFailure).toContain("dependency:a-only");
    expect(new Set(flatten(first.results).map((result) => result.kind))).toEqual(new Set([
      "all",
      "any",
      "role-count",
      "profile-count",
      "tag-count",
      "metric-sum",
      "range-overlap",
      "fraction",
      "redundancy",
    ]));
  });

  it("returns exact rejection reasons and blocks direct resolution", () => {
    const arc = compositionArc();
    const challenge = arc.challenges[0]!;
    const agents = profiledAgents().slice(0, 1);
    const evaluation = evaluateComposition({ arc, challenge, agents });
    expect(evaluation.feasible).toBe(false);
    expect(evaluation.rejectionReasons).toEqual(expect.arrayContaining([
      expect.stringContaining("Profiles"),
      expect.stringContaining("Redundancy"),
    ]));
    const org = makeCycleOrg(agents);
    expect(() => resolveChallenge({ challenge, assignedAgents: agents, org, arc, cycle: 1 })).toThrow(
      /Party composition is not eligible/,
    );
  });

  it("refuses an infeasible assignment before spending capacity", () => {
    const arc = compositionArc();
    const agents = profiledAgents();
    const org = makeCycleOrg(agents, { tokens: 5 });
    const control = runCycle({ org, arc, assignments: [] });
    const rejected = runCycle({
      org,
      arc,
      assignments: [{ challengeId: arc.challenges[0]!.id, agentIds: [agents[0]!.id], tokensSpent: 2 }],
    });
    expect(rejected.reports).toHaveLength(0);
    expect(rejected.org.resources.tokens).toBe(control.org.resources.tokens);
    expect(rejected.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("Party composition is not eligible"),
    ]));
  });

  it("refuses unknown profiles and incompatible engine floors in authored composition law", () => {
    const unknown = structuredClone(compositionArc());
    unknown.challenges[0]!.compositionConstraints = [{
      id: "unknown",
      label: "Unknown profile",
      kind: "profile-count",
      profileIds: ["missing"],
      min: 1,
    }];
    expect(() => validateArc(unknown)).toThrow(/unknown profile "missing"/i);

    const oldEngine = structuredClone(compositionArc());
    oldEngine.meta.engineVersion = "1.2.0";
    expect(() => validateArc(oldEngine)).toThrow(/require engineVersion 1\.3\.0/);
  });
});

describe("Book II and Book III compiler projections", () => {
  it("turns Common Ship profiles, viability tests, and ship tracks into executable Arc law", () => {
    const arc = compileCommonShipPocket(COMMON_SHIP_STARTER);
    expect(arc.meta.engineVersion).toBe("1.3.0");
    expect(arc.stateDefinitions?.map((definition) => definition.id)).toEqual([
      "compatibility-debt",
      "continuity",
      "habitat-integrity",
      "roster-resilience",
      "stores-and-care",
      "temporal-coherence",
      "translation-trust",
      "visibility",
    ]);
    expect(arc.compositionProfiles).toHaveLength(COMMON_SHIP_STARTER.embodimentProfiles.length);
    expect(arc.founding?.roster.every((slot) => Boolean(slot.compositionProfileId))).toBe(true);
    for (const challenge of arc.challenges) {
      expect(challenge.compositionConstraints?.map((constraint) => constraint.category)).toEqual([
        "role-coverage",
        "temporal-overlap",
        "habitat-compatibility",
        "translation-resilience",
        "handoff-continuity",
        "life-fraction-fairness",
      ]);
      expect(challenge.outcomes.success.stateEffects?.length).toBeGreaterThan(0);
    }
  });

  it("turns Dark Tomb Alarm, signature, visibility, and inherited consequences into executable state", () => {
    const arc = compileDarkTombPocket(DARK_TOMB_STARTER);
    expect(arc.meta.engineVersion).toBe("1.3.0");
    expect(arc.stateDefinitions?.map((definition) => definition.id)).toEqual(expect.arrayContaining([
      "alarm-phase",
      "signature-status",
      "visibility-status",
    ]));
    expect(arc.stateDefinitions?.some((definition) => definition.id.startsWith("consequence:"))).toBe(true);
    expect(arc.challenges.every((challenge) => (challenge.outcomes.success.stateEffects?.length ?? 0) > 0)).toBe(true);
  });
});
