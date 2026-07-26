import { describe, expect, it } from "vitest";
import {
  NARRATIVE_LEDGER_FORMAT,
  auditNarrativeCausality,
  type NarrativeBeat,
  type NarrativeRuntimeState,
} from "../../src/narrative/index.js";

function beat(overrides: Partial<NarrativeBeat> = {}): NarrativeBeat {
  return {
    id: "beat-0",
    sequence: 0,
    cycle: 1,
    candidateId: "candidate-0",
    recipeId: "allocation",
    authority: "authoritative",
    trackId: "track-0",
    beatFunction: "establish",
    sourceFactIds: ["fact-0"],
    causalParentBeatIds: [],
    roleBindings: { claimant: "a" },
    actorMoves: [{ actorId: "a", moveTag: "formalize" }],
    tags: ["situation:allocation"],
    pressureTags: ["pressure:scarcity"],
    statePayments: [{ kind: "precedent", target: "allocation", tags: ["payment:precedent"] }],
    openedObligationIds: ["obligation-0"],
    resolvedObligationIds: [],
    presentationKey: "allocation.establish",
    score: {
      candidateId: "candidate-0",
      total: 1,
      breakdown: {
        authoredPriority: 1,
        sourceSeverity: 0,
        conditionComplexity: 0,
        obligationPressure: 0,
        identityRelevance: 0,
        closure: 0,
        freshness: 0,
        actorFit: 0,
        repetition: 0,
        trackUrgency: 0,
      },
      matchedIdentityAnchors: [],
      roleBindings: { claimant: "a" },
    },
    ...overrides,
  };
}

function state(): NarrativeRuntimeState {
  const first = beat();
  const second = beat({
    id: "beat-1",
    sequence: 1,
    cycle: 2,
    candidateId: "candidate-1",
    recipeId: "promise-called-due",
    beatFunction: "consequence",
    causalParentBeatIds: ["beat-0"],
    openedObligationIds: [],
    resolvedObligationIds: ["obligation-0"],
    presentationKey: "allocation.consequence",
  });
  return {
    cycle: 2,
    facts: [],
    actors: [
      { id: "a", tags: [], metrics: {} },
      { id: "b", tags: [], metrics: {} },
    ],
    tracks: [
      {
        id: "track-0",
        railId: "episode",
        controllingQuestion: "Who receives the scarce resource?",
        actorIds: ["a"],
        pressureTags: ["pressure:scarcity"],
        currentFunction: "consequence",
        beatIds: ["beat-0", "beat-1"],
        openObligationIds: [],
        status: "resolved",
      },
    ],
    ledger: {
      format: NARRATIVE_LEDGER_FORMAT,
      beats: [first, second],
      obligations: [
        {
          id: "obligation-0",
          kind: "promise",
          actorIds: ["a"],
          tags: ["pressure:scarcity"],
          pressure: 6,
          dueCycle: 2,
          openedByBeatId: "beat-0",
          status: "resolved",
          closedByBeatId: "beat-1",
        },
      ],
    },
  };
}

describe("narrative causal audit", () => {
  it("recognizes a closed causal chain without structural width", () => {
    const receipt = auditNarrativeCausality(state());

    expect(receipt.structuralCausalWidth).toBe(0);
    expect(receipt.looseBeatIds).toEqual([]);
    expect(receipt.beats[0]).toEqual(
      expect.objectContaining({
        beatId: "beat-0",
        childBeatIds: ["beat-1"],
        structurallyUsed: true,
      }),
    );
    expect(receipt.beats[1]).toEqual(
      expect.objectContaining({
        beatId: "beat-1",
        obligationClosedIds: ["obligation-0"],
        terminal: true,
      }),
    );
    expect(receipt.passed).toBe(true);
  });

  it("reports a detachable old beat as structural causal width", () => {
    const current = state();
    const loose = beat({
      id: "beat-loose",
      sequence: 2,
      cycle: 1,
      candidateId: "candidate-loose",
      recipeId: "spectacle",
      trackId: "track-loose",
      openedObligationIds: [],
      roleBindings: { witness: "b" },
      actorMoves: [{ actorId: "b", moveTag: "observe" }],
    });
    current.cycle = 5;
    current.ledger.beats.push(loose);
    current.tracks.push({
      id: "track-loose",
      railId: "episode",
      controllingQuestion: "Does the spectacle matter?",
      actorIds: ["b"],
      pressureTags: ["pressure:spectacle"],
      currentFunction: "establish",
      beatIds: ["beat-loose"],
      openObligationIds: [],
      status: "resolved",
    });

    const receipt = auditNarrativeCausality(current, {
      looseBeatGraceCycles: 1,
      stalledTrackCycles: 3,
      highPressureThreshold: 10,
      maximumRecipeRun: 3,
      maximumActorSharePermille: 1000,
    });

    expect(receipt.structuralCausalWidth).toBe(1);
    expect(receipt.looseBeatIds).toEqual(["beat-loose"]);
    expect(receipt.findings).toContainEqual(
      expect.objectContaining({ code: "loose-beat", subjectId: "beat-loose" }),
    );
  });

  it("keeps the last beat of an open track as an active frontier instead of calling it loose", () => {
    const current = state();
    current.cycle = 5;
    current.tracks[0]!.status = "open";
    current.tracks[0]!.currentFunction = "consequence";
    current.ledger.beats[1]!.beatFunction = "choose";

    const receipt = auditNarrativeCausality(current, {
      looseBeatGraceCycles: 0,
      stalledTrackCycles: 10,
      highPressureThreshold: 10,
      maximumRecipeRun: 3,
      maximumActorSharePermille: 1000,
    });

    expect(receipt.beats[1]).toEqual(
      expect.objectContaining({ activeFrontier: true, structurallyUsed: true }),
    );
    expect(receipt.looseBeatIds).toEqual([]);
  });

  it("reports overdue obligations, stalled tracks, unresolved terminal debt, repetition, and cast concentration", () => {
    const current = state();
    current.cycle = 10;
    current.tracks[0]!.status = "resolved";
    current.tracks[0]!.openObligationIds = ["obligation-open"];
    current.ledger.obligations.push({
      id: "obligation-open",
      kind: "grievance",
      actorIds: ["a"],
      tags: ["pressure:legitimacy"],
      pressure: 12,
      dueCycle: 4,
      openedByBeatId: "beat-0",
      status: "open",
    });
    current.ledger.beats.push(
      beat({ id: "beat-2", sequence: 2, cycle: 3, candidateId: "candidate-2", causalParentBeatIds: ["beat-1"], openedObligationIds: [] }),
      beat({ id: "beat-3", sequence: 3, cycle: 4, candidateId: "candidate-3", causalParentBeatIds: ["beat-2"], openedObligationIds: [] }),
    );

    const receipt = auditNarrativeCausality(current, {
      looseBeatGraceCycles: 1,
      stalledTrackCycles: 3,
      highPressureThreshold: 10,
      maximumRecipeRun: 2,
      maximumActorSharePermille: 700,
    });

    expect(receipt.overdueObligationIds).toEqual(["obligation-open"]);
    expect(receipt.highPressureObligationIds).toEqual(["obligation-open"]);
    expect(receipt.maximumRecipeRunObserved).toBe(2);
    expect(receipt.maximumActorSharePermilleObserved).toBe(1000);
    expect(receipt.findings).toContainEqual(expect.objectContaining({ code: "terminal-track-open-obligation" }));
    expect(receipt.findings).toContainEqual(expect.objectContaining({ code: "overdue-obligation" }));
    expect(receipt.findings).toContainEqual(expect.objectContaining({ code: "high-pressure-obligation" }));
    expect(receipt.findings).toContainEqual(expect.objectContaining({ code: "actor-concentration" }));
    expect(receipt.passed).toBe(false);
  });

  it("fails on missing and non-prior causal references", () => {
    const current = state();
    current.ledger.beats[0]!.causalParentBeatIds = ["beat-1", "beat-missing"];

    const receipt = auditNarrativeCausality(current);

    expect(receipt.findings).toContainEqual(expect.objectContaining({ code: "missing-causal-parent" }));
    expect(receipt.findings).toContainEqual(expect.objectContaining({ code: "non-prior-causal-parent" }));
    expect(receipt.passed).toBe(false);
  });

  it("rejects non-integer audit policy instead of producing unstable thresholds", () => {
    expect(() => auditNarrativeCausality(state(), {
      looseBeatGraceCycles: 1.5,
      stalledTrackCycles: 3,
      highPressureThreshold: 10,
      maximumRecipeRun: 3,
      maximumActorSharePermille: 750,
    })).toThrow("looseBeatGraceCycles must be a non-negative integer");
  });
});
