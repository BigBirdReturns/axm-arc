import { describe, expect, it } from "vitest";
import {
  NARRATIVE_LEDGER_FORMAT,
  NARRATIVE_RAILS_FORMAT,
  NARRATIVE_RECIPE_FORMAT,
  commitNarrativeSelection,
  dramaTriggerToNarrativeFact,
  generateNarrativeCandidates,
  organizationToNarrativeActors,
  runNarrativeQualificationSuite,
  sortNarrativeCandidates,
  type NarrativeCandidate,
  type NarrativeConstitution,
  type NarrativeRuntimeState,
  type NarrativeSituationRecipe,
} from "../../src/narrative/index.js";
import type { Agent, Organization } from "../../src/engine/types.js";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "a",
    name: "A",
    attributes: {},
    hiddenAttributes: { loyalty: 10, ambition: 16, volatility: 8, leadership: 12 },
    traits: ["Hothead"],
    role: "protector",
    secondaryRole: null,
    baseEfficiency: 10,
    tier: "tier2",
    upkeep: 2,
    morale: 45,
    stress: 4,
    attunements: [],
    assignmentHistory: [],
    afflictionHistory: [],
    rewardHistory: [],
    afflictionState: { kind: "none" },
    equippedItems: {},
    downedUntilCycle: null,
    lastClearCycle: {},
    revealedHiddenAttrs: 0,
    revealedTraits: 1,
    ...overrides,
  };
}

function constitution(): NarrativeConstitution {
  return {
    format: NARRATIVE_RAILS_FORMAT,
    id: "recipe-house",
    version: "1.0.0",
    identityAnchors: [
      { id: "pressure", anyOfTags: ["pressure:exclusion"] },
      { id: "method", anyOfTags: ["move:formalize"] },
      { id: "payment", anyOfTags: ["payment:precedent"] },
    ],
    prohibitedMoveTags: ["cutaway-reset"],
    actorPolicies: [
      {
        actorId: "a",
        baselineMoves: ["formalize"],
        conditionalMoves: [],
        forbiddenMoves: ["withdraw"],
        deviationPolicy: "reject",
      },
    ],
    rails: [
      {
        id: "relational",
        openingFunctions: ["establish"],
        transitions: {
          establish: ["pressure"],
          pressure: ["choose"],
          choose: ["consequence"],
          consequence: ["inherit"],
          inherit: [],
        },
        terminalFunctions: ["consequence", "inherit"],
      },
    ],
    weights: {
      authoredPriority: 10,
      sourceSeverity: 2,
      conditionComplexity: 5,
      obligationPressure: 3,
      identityRelevance: 7,
      closure: 30,
      freshness: 1,
      actorFit: 4,
      repetition: 3,
      trackUrgency: 2,
    },
    freshnessCap: 10,
  };
}

function state(): NarrativeRuntimeState {
  const organization: Pick<Organization, "agents"> = { agents: { a: makeAgent() } };
  return {
    cycle: 1,
    facts: [
      dramaTriggerToNarrativeFact(
        { type: "prolonged_benching", agentId: "a", cyclesBenched: 4 },
        1,
        0,
      ),
    ],
    actors: organizationToNarrativeActors(organization),
    tracks: [],
    ledger: { format: NARRATIVE_LEDGER_FORMAT, beats: [], obligations: [] },
  };
}

function recipe(): NarrativeSituationRecipe {
  return {
    format: NARRATIVE_RECIPE_FORMAT,
    id: "prolonged-exclusion",
    version: "1.0.0",
    authority: "authoritative",
    factPattern: {
      types: ["prolonged_benching"],
      requiredTags: ["pressure:exclusion"],
      minimumSeverity: 3,
    },
    roleQueries: [
      {
        id: "claimant",
        required: true,
        pool: "fact-role",
        factRole: "claimant",
        minimumMetrics: { ambition: 10 },
        scoreTerms: [{ metric: "ambition", weight: 1 }],
      },
    ],
    track: {
      kind: "open",
      railId: "relational",
      controllingQuestion: "Will status substitute for participation for {actor:claimant}?",
      actorRoleIds: ["claimant"],
      pressureTags: ["pressure:exclusion"],
    },
    beatFunction: "establish",
    actorMoves: [{ roleId: "claimant", moveTag: "formalize" }],
    tags: ["situation:exclusion"],
    pressureTags: ["pressure:exclusion"],
    statePayments: [
      {
        kind: "precedent",
        target: { kind: "track-id" },
        tags: ["payment:precedent"],
      },
    ],
    opensObligations: [
      {
        idPrefix: "participation",
        kind: "promise",
        actorRoleIds: ["claimant"],
        tags: ["pressure:exclusion"],
        pressure: 6,
        dueCycleOffset: 1,
      },
    ],
    resolvesObligations: { kinds: [], policy: "none" },
    authoredPriority: 2,
    cooldownCycles: 2,
    presentationKey: "exclusion.establish",
  };
}

describe("current engine adapter", () => {
  it("projects engine actors and drama triggers without losing trigger roles", () => {
    const current = state();
    expect(current.actors[0]).toEqual(
      expect.objectContaining({
        id: "a",
        metrics: expect.objectContaining({ ambition: 16, leadership: 12 }),
      }),
    );
    expect(current.actors[0]?.tags).toContain("trait:Hothead");
    expect(current.facts[0]).toEqual(
      expect.objectContaining({
        type: "prolonged_benching",
        actorRoles: { claimant: "a" },
        severity: 4,
      }),
    );
    expect(current.facts[0]?.tags).toContain("pressure:exclusion");
  });
});

describe("declarative situation recipes", () => {
  it("materializes a complete candidate from a fact, role query, rail plan, and state payment", () => {
    const current = state();
    const generation = generateNarrativeCandidates([recipe()], current);

    expect(generation.failures).toEqual([]);
    expect(generation.candidates).toHaveLength(1);
    expect(generation.candidates[0]).toEqual(
      expect.objectContaining({
        recipeId: "prolonged-exclusion",
        beatFunction: "establish",
        roleBindings: { claimant: "a" },
        actorMoves: [{ actorId: "a", moveTag: "formalize" }],
      }),
    );
    expect(generation.candidates[0]?.opensObligations[0]).toEqual(
      expect.objectContaining({ kind: "promise", actorIds: ["a"], dueCycle: 2 }),
    );

    const selection = sortNarrativeCandidates(constitution(), current, generation.candidates);
    expect(selection.selectedCandidateId).toBe(generation.candidates[0]?.id);
    const committed = commitNarrativeSelection(
      constitution(),
      current,
      generation.candidates,
      selection,
    );
    expect(committed.state.ledger.beats[0]).toEqual(
      expect.objectContaining({ beatFunction: "establish", recipeId: "prolonged-exclusion" }),
    );
    expect(committed.state.ledger.obligations[0]).toEqual(
      expect.objectContaining({ kind: "promise", status: "open" }),
    );
  });

  it("fails loudly when a recipe references an undeclared role", () => {
    const invalid = recipe();
    invalid.actorMoves = [{ roleId: "missing", moveTag: "formalize" }];

    expect(() => generateNarrativeCandidates([invalid], state())).toThrow(
      "unknown role missing",
    );
  });

  it("generates the same receipt regardless of recipe and state collection order", () => {
    const current = state();
    const irrelevant: NarrativeSituationRecipe = {
      ...recipe(),
      id: "irrelevant",
      factPattern: { types: ["reward_dispute"] },
    };
    const forward = generateNarrativeCandidates([recipe(), irrelevant], current);
    const reversed = generateNarrativeCandidates(
      [irrelevant, recipe()],
      { ...current, facts: [...current.facts].reverse(), actors: [...current.actors].reverse() },
    );
    expect(reversed).toEqual(forward);
  });
});

describe("cold-room qualification", () => {
  it("encodes positive selection, negative drift, and committed inheritance as executable expectations", () => {
    const current = state();
    const candidate = generateNarrativeCandidates([recipe()], current).candidates[0]!;
    const drift: NarrativeCandidate = {
      ...candidate,
      id: "candidate-drift",
      actorMoves: [{ actorId: "a", moveTag: "withdraw" }],
      authoredPriority: 100,
      opensObligations: [{ ...candidate.opensObligations[0]!, id: "obligation-drift" }],
    };

    const receipt = runNarrativeQualificationSuite([
      {
        id: "new-room-preserves-house",
        constitution: constitution(),
        state: current,
        candidates: [drift, candidate],
        expected: {
          selectedRecipeId: "prolonged-exclusion",
          minimumEligible: 1,
          maximumEligible: 1,
          rejections: [{ candidateId: "candidate-drift", codes: ["forbidden-character-move"] }],
          commit: {
            beatFunction: "establish",
            trackStatus: "open",
            openedObligationKinds: ["promise"],
          },
        },
      },
    ]);

    expect(receipt.passed).toBe(true);
    expect(receipt.cases[0]?.failures).toEqual([]);
  });
});

describe("candidate integrity", () => {
  it("rejects a manually authored binding to an actor absent from the state", () => {
    const current = state();
    const candidate = generateNarrativeCandidates([recipe()], current).candidates[0]!;
    const missingActor = {
      ...candidate,
      id: "candidate-missing-actor",
      roleBindings: { claimant: "ghost" },
      actorMoves: [{ actorId: "ghost", moveTag: "formalize" }],
      opensObligations: [{ ...candidate.opensObligations[0]!, id: "obligation-ghost" }],
    };
    const selection = sortNarrativeCandidates(constitution(), current, [missingActor]);

    expect(selection.selectedCandidateId).toBeNull();
    expect(selection.rejected[0]?.failures).toContainEqual(
      expect.objectContaining({ code: "missing-actor" }),
    );
  });
});

describe("selection custody", () => {
  it("refuses a selection receipt after state changes", () => {
    const current = state();
    const candidate = generateNarrativeCandidates([recipe()], current).candidates[0]!;
    const selection = sortNarrativeCandidates(constitution(), current, [candidate]);
    const changed = { ...current, cycle: 2 };

    expect(() => commitNarrativeSelection(constitution(), changed, [candidate], selection)).toThrow(
      "Narrative selection state fingerprint is stale",
    );
  });

  it("refuses a receipt when the candidate set is changed after selection", () => {
    const current = state();
    const candidate = generateNarrativeCandidates([recipe()], current).candidates[0]!;
    const tangent = {
      ...candidate,
      id: "candidate-tangent",
      recipeId: "tangent",
      opensObligations: [{ ...candidate.opensObligations[0]!, id: "obligation-tangent" }],
      conditionComplexity: 0,
    };
    const selection = sortNarrativeCandidates(constitution(), current, [candidate, tangent]);

    expect(() => commitNarrativeSelection(constitution(), current, [candidate], selection)).toThrow(
      "Narrative selection receipt does not match the current candidate set",
    );
  });
});
