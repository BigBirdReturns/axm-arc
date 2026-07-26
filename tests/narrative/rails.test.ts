import { describe, expect, it } from "vitest";
import {
  NARRATIVE_LEDGER_FORMAT,
  NARRATIVE_RAILS_FORMAT,
  bindNarrativeRoles,
  commitNarrativeSelection,
  sortNarrativeCandidates,
  validateNarrativeConstitution,
  type NarrativeCandidate,
  type NarrativeConstitution,
  type NarrativeRuntimeState,
} from "../../src/narrative/index.js";

function makeConstitution(): NarrativeConstitution {
  return {
    format: NARRATIVE_RAILS_FORMAT,
    id: "test-house",
    version: "1.0.0",
    identityAnchors: [
      { id: "pressure", anyOfTags: ["pressure:exclusion", "pressure:scarcity"] },
      { id: "method", anyOfTags: ["move:formalize", "move:command", "move:coerce"] },
      { id: "payment", anyOfTags: ["payment:precedent", "payment:relationship", "payment:resource"] },
    ],
    prohibitedMoveTags: ["cutaway-reset"],
    actorPolicies: [
      {
        actorId: "a",
        baselineMoves: ["formalize"],
        conditionalMoves: [{ moveTag: "coerce", requiresAnyTags: ["threat:immediate"] }],
        forbiddenMoves: ["withdraw"],
        deviationPolicy: "justify",
        deviationRequiresAnyTags: ["identity-shock"],
      },
    ],
    rails: [
      {
        id: "episode",
        openingFunctions: ["establish"],
        transitions: {
          establish: ["pressure"],
          pressure: ["escalate", "choose"],
          escalate: ["choose", "reverse"],
          choose: ["consequence", "reverse"],
          reverse: ["consequence"],
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

function makeState(): NarrativeRuntimeState {
  return {
    cycle: 1,
    facts: [
      {
        id: "fact-bench",
        type: "prolonged-benching",
        cycle: 1,
        actorIds: ["a"],
        tags: ["pressure:exclusion"],
        severity: 8,
        receiptRef: "engine:bench:1",
      },
    ],
    actors: [
      { id: "a", tags: ["cast:founding"], metrics: { ambition: 12, leadership: 8 } },
      { id: "b", tags: ["cast:founding", "trait:hothead"], metrics: { ambition: 16, leadership: 14 } },
    ],
    tracks: [],
    ledger: { format: NARRATIVE_LEDGER_FORMAT, beats: [], obligations: [] },
  };
}

function openingCandidate(overrides: Partial<NarrativeCandidate> = {}): NarrativeCandidate {
  return {
    id: "candidate-open",
    recipeId: "prolonged-exclusion",
    authority: "authoritative",
    track: {
      kind: "open",
      trackId: "track-a",
      railId: "episode",
      controllingQuestion: "Will status substitute for participation?",
      actorIds: ["a"],
      pressureTags: ["pressure:exclusion"],
    },
    beatFunction: "establish",
    sourceFactIds: ["fact-bench"],
    causalParentBeatIds: [],
    roleBindings: { claimant: "a" },
    actorMoves: [{ actorId: "a", moveTag: "formalize" }],
    tags: ["situation:exclusion"],
    pressureTags: ["pressure:exclusion"],
    statePayments: [{ kind: "precedent", target: "rotation-policy", tags: ["payment:precedent"] }],
    opensObligations: [
      {
        id: "promise-a",
        kind: "promise",
        actorIds: ["a"],
        tags: ["pressure:exclusion"],
        pressure: 6,
        dueCycle: 2,
      },
    ],
    resolvesObligationIds: [],
    authoredPriority: 2,
    conditionComplexity: 3,
    cooldownCycles: 1,
    presentationKey: "exclusion.establish",
    ...overrides,
  };
}

describe("narrative role binding", () => {
  it("binds required roles by score and declared exclusion", () => {
    const state = makeState();
    const receipt = bindNarrativeRoles(
      [
        { id: "leader", required: true, scoreTerms: [{ metric: "leadership", weight: 1 }] },
        {
          id: "claimant",
          required: true,
          notAlreadyBound: ["leader"],
          scoreTerms: [{ metric: "ambition", weight: 1 }],
        },
      ],
      state.actors,
    );

    expect(receipt.bindings).toEqual({ leader: "b", claimant: "a" });
    expect(receipt.failures).toEqual([]);
  });
});

describe("deterministic narrative sorting", () => {
  it("rejects identity and character drift before ranking valid candidates", () => {
    const constitution = makeConstitution();
    const state = makeState();
    const good = openingCandidate();
    const generic = openingCandidate({
      id: "candidate-generic",
      recipeId: "generic-exclusion",
      conditionComplexity: 1,
      opensObligations: [{ ...good.opensObligations[0]!, id: "promise-generic" }],
    });
    const forbidden = openingCandidate({
      id: "candidate-forbidden",
      recipeId: "bad-character-break",
      actorMoves: [{ actorId: "a", moveTag: "withdraw" }],
      authoredPriority: 100,
      opensObligations: [{ ...good.opensObligations[0]!, id: "promise-forbidden" }],
    });
    const missingAnchor = openingCandidate({
      id: "candidate-no-payment-anchor",
      recipeId: "no-payment-anchor",
      statePayments: [{ kind: "cosmetic", target: "nothing", tags: [] }],
      authoredPriority: 100,
      opensObligations: [{ ...good.opensObligations[0]!, id: "promise-no-anchor" }],
    });

    const receipt = sortNarrativeCandidates(
      constitution,
      state,
      [missingAnchor, generic, forbidden, good],
    );

    expect(receipt.selectedCandidateId).toBe("candidate-open");
    expect(receipt.rejected.find((entry) => entry.candidateId === "candidate-forbidden")?.failures)
      .toContainEqual(expect.objectContaining({ code: "forbidden-character-move" }));
    expect(receipt.rejected.find((entry) => entry.candidateId === "candidate-no-payment-anchor")?.failures)
      .toContainEqual(expect.objectContaining({ code: "missing-identity-anchor" }));
  });

  it("is independent of candidate input order and does not mutate state", () => {
    const constitution = makeConstitution();
    const state = makeState();
    const candidates = [
      openingCandidate(),
      openingCandidate({
        id: "candidate-generic",
        recipeId: "generic-exclusion",
        conditionComplexity: 1,
        opensObligations: [{ ...openingCandidate().opensObligations[0]!, id: "promise-generic" }],
      }),
    ];
    const before = JSON.stringify(state);

    const forward = sortNarrativeCandidates(constitution, state, candidates);
    const backward = sortNarrativeCandidates(constitution, state, [...candidates].reverse());

    expect(backward).toEqual(forward);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("refuses unsupported rail jumps", () => {
    const constitution = makeConstitution();
    const state = makeState();
    const opening = openingCandidate();
    const openingReceipt = sortNarrativeCandidates(constitution, state, [opening]);
    const committed = commitNarrativeSelection(constitution, state, [opening], openingReceipt);
    const cycle2: NarrativeRuntimeState = {
      ...committed.state,
      cycle: 2,
      facts: [
        ...committed.state.facts,
        {
          id: "fact-repeat-bench",
          type: "promise-called-due",
          cycle: 2,
          actorIds: ["a"],
          tags: ["pressure:exclusion"],
          severity: 10,
          receiptRef: "engine:bench:2",
        },
      ],
    };
    const illegal = openingCandidate({
      id: "candidate-illegal-jump",
      recipeId: "illegal-jump",
      track: { kind: "advance", trackId: "track-a" },
      beatFunction: "consequence",
      sourceFactIds: ["fact-repeat-bench"],
      opensObligations: [],
    });

    const receipt = sortNarrativeCandidates(constitution, cycle2, [illegal]);

    expect(receipt.selectedCandidateId).toBeNull();
    expect(receipt.rejected[0]?.failures).toContainEqual(expect.objectContaining({ code: "rail-transition" }));
  });
});

describe("beat and obligation ledger", () => {
  it("keeps presentation candidates outside the authoritative beat ledger", () => {
    const constitution = makeConstitution();
    const state = makeState();
    const candidate = openingCandidate({
      authority: "presentation",
      statePayments: [],
      opensObligations: [],
      trackDisposition: undefined,
    });
    const selection = sortNarrativeCandidates(constitution, state, [candidate]);

    expect(selection.selectedCandidateId).toBeNull();
    expect(selection.rejected[0]?.failures).toContainEqual(
      expect.objectContaining({ code: "missing-identity-anchor" }),
    );
    expect(() => commitNarrativeSelection(constitution, state, [candidate], selection)).toThrow(
      "Narrative selection contains no candidate to commit",
    );
  });

  it("commits the selected beat and carries its open obligation forward", () => {
    const constitution = makeConstitution();
    const state = makeState();
    const candidate = openingCandidate();
    const selection = sortNarrativeCandidates(constitution, state, [candidate]);

    const result = commitNarrativeSelection(constitution, state, [candidate], selection);

    expect(result.state.ledger.beats).toHaveLength(1);
    expect(result.state.ledger.obligations).toContainEqual(
      expect.objectContaining({ id: "promise-a", status: "open", openedByBeatId: "beat_0_candidate-open" }),
    );
    expect(result.state.tracks).toContainEqual(
      expect.objectContaining({ id: "track-a", currentFunction: "establish", status: "open" }),
    );
  });

  it("ranks a due callback above an equally authored tangent and records causal closure", () => {
    const constitution = makeConstitution();
    const initial = makeState();
    const opening = openingCandidate();
    const opened = commitNarrativeSelection(
      constitution,
      initial,
      [opening],
      sortNarrativeCandidates(constitution, initial, [opening]),
    );
    const cycle2: NarrativeRuntimeState = {
      ...opened.state,
      cycle: 2,
      facts: [
        ...opened.state.facts,
        {
          id: "fact-pressure",
          type: "promise-pressure",
          cycle: 2,
          actorIds: ["a"],
          tags: ["pressure:exclusion"],
          severity: 8,
          receiptRef: "engine:pressure:2",
        },
      ],
    };
    const pressure = openingCandidate({
      id: "candidate-pressure",
      recipeId: "promise-pressure",
      track: { kind: "advance", trackId: "track-a" },
      beatFunction: "pressure",
      sourceFactIds: ["fact-pressure"],
      opensObligations: [],
      presentationKey: "exclusion.pressure",
    });
    const pressured = commitNarrativeSelection(
      constitution,
      cycle2,
      [pressure],
      sortNarrativeCandidates(constitution, cycle2, [pressure]),
    );
    const cycle3: NarrativeRuntimeState = {
      ...pressured.state,
      cycle: 3,
      facts: [
        ...pressured.state.facts,
        {
          id: "fact-choice",
          type: "choice-due",
          cycle: 3,
          actorIds: ["a"],
          tags: ["pressure:exclusion"],
          severity: 5,
          receiptRef: "engine:choice:3",
        },
      ],
    };
    const callback = openingCandidate({
      id: "candidate-callback",
      recipeId: "promise-called-due",
      track: { kind: "advance", trackId: "track-a" },
      beatFunction: "choose",
      sourceFactIds: ["fact-choice"],
      opensObligations: [],
      resolvesObligationIds: ["promise-a"],
      authoredPriority: 1,
      conditionComplexity: 2,
      presentationKey: "exclusion.choice",
    });
    const tangent = openingCandidate({
      ...callback,
      id: "candidate-tangent",
      recipeId: "fresh-tangent",
      resolvesObligationIds: [],
    });

    const selection = sortNarrativeCandidates(constitution, cycle3, [tangent, callback]);
    expect(selection.selectedCandidateId).toBe("candidate-callback");

    const result = commitNarrativeSelection(constitution, cycle3, [tangent, callback], selection);
    expect(result.state.ledger.obligations[0]).toEqual(
      expect.objectContaining({ id: "promise-a", status: "resolved", closedByBeatId: "beat_2_candidate-callback" }),
    );
    expect(result.state.ledger.beats[2]?.causalParentBeatIds).toContain("beat_0_candidate-open");
  });
});

describe("constitution validation", () => {
  it("reports contradictory actor policy instead of letting the runtime guess", () => {
    const constitution = makeConstitution();
    constitution.actorPolicies[0]!.forbiddenMoves.push("formalize");

    expect(validateNarrativeConstitution(constitution)).toContainEqual(
      expect.objectContaining({ message: "formalize cannot be both baseline and forbidden" }),
    );
    expect(() => sortNarrativeCandidates(constitution, makeState(), [openingCandidate()])).toThrow(
      /Invalid narrative constitution/,
    );
  });
});
