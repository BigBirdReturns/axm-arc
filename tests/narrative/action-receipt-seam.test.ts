import { beforeAll, describe, expect, it } from "vitest";
import { FIRST_CHARTER } from "../../src/arcs/index.js";
import { compileActionEncounter } from "../../src/engine/action/compile.js";
import { actionSeed, buildActionReceipt } from "../../src/engine/action/receipt.js";
import type { ActionOutcome, ActionReceipt } from "../../src/engine/action/types.js";
import {
  ACTION_NARRATIVE_BINDING_FORMAT,
  NARRATIVE_LEDGER_FORMAT,
  NARRATIVE_RAILS_FORMAT,
  commitNarrativeSelection,
  ingestAcceptedActionReceipt,
  sortNarrativeCandidates,
  type ActionNarrativeBinding,
  type NarrativeConstitution,
  type NarrativeRuntimeState,
} from "../../src/narrative/index.js";
import { buildCompetentTrace } from "../action/helpers.js";

const CHALLENGE = FIRST_CHARTER.challenges[0]!;
const CYCLE = 2;
const ORG_SEED = 0x5eed_1234;
const PARTY = ["operator"];
let ACCEPTED_RECEIPT: ActionReceipt;

function outcomeRule(outcome: ActionOutcome) {
  return {
    beatFunction: "consequence" as const,
    trackDisposition: "resolve" as const,
    severity: outcome === "success" ? 8 : outcome === "partial" ? 6 : 10,
    tags: [`action:${outcome}`, "situation:accepted-action"],
    pressureTags: ["pressure:action-aftermath"],
    controlledMoveTag: "formalize",
    statePayments: [],
    opensObligations: [],
    resolvesObligationIds: [],
    authoredPriority: 3,
    conditionComplexity: 4,
    cooldownCycles: 0,
    presentationKey: `action.${outcome}.consequence`,
  };
}

function binding(): ActionNarrativeBinding {
  return {
    format: ACTION_NARRATIVE_BINDING_FORMAT,
    id: "first-charter-action-aftermath",
    version: "1.0.0",
    challengeId: CHALLENGE.id,
    track: {
      kind: "open",
      trackId: `action-${CHALLENGE.id}-${CYCLE}`,
      railId: "accepted-action-consequence",
      controllingQuestion: "What must remain true because this encounter was accepted?",
      pressureTags: ["pressure:action-aftermath"],
    },
    outcomes: {
      success: outcomeRule("success"),
      partial: outcomeRule("partial"),
      failure: outcomeRule("failure"),
    },
  };
}

function narrativeState(): NarrativeRuntimeState {
  return {
    cycle: CYCLE,
    facts: [],
    actors: [{ id: "operator", tags: ["cast:action-party"], metrics: {} }],
    tracks: [],
    ledger: { format: NARRATIVE_LEDGER_FORMAT, beats: [], obligations: [] },
  };
}

function constitution(): NarrativeConstitution {
  return {
    format: NARRATIVE_RAILS_FORMAT,
    id: "continuous-authority-test",
    version: "1.0.0",
    identityAnchors: [
      { id: "accepted-result", anyOfTags: ["action:success", "action:partial", "action:failure"] },
      { id: "actor-method", anyOfTags: ["move:formalize"] },
      { id: "persistent-payment", anyOfTags: ["payment:action-result"] },
    ],
    prohibitedMoveTags: [],
    actorPolicies: [{
      actorId: "operator",
      baselineMoves: ["formalize"],
      conditionalMoves: [],
      forbiddenMoves: [],
      deviationPolicy: "reject",
    }],
    rails: [{
      id: "accepted-action-consequence",
      openingFunctions: ["consequence"],
      transitions: { consequence: [] },
      terminalFunctions: ["consequence"],
    }],
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

function ingest(state = narrativeState(), receipt: unknown = ACCEPTED_RECEIPT, authoredBinding: unknown = binding()) {
  return ingestAcceptedActionReceipt({
    arc: FIRST_CHARTER,
    challenge: CHALLENGE,
    cycle: CYCLE,
    orgSeed: ORG_SEED,
    partyAgentIds: PARTY,
    narrativeState: state,
    binding: authoredBinding,
    receipt,
  });
}

beforeAll(() => {
  const spec = compileActionEncounter(FIRST_CHARTER, CHALLENGE);
  const seed = actionSeed(ORG_SEED, CYCLE, CHALLENGE.id, null);
  const { trace } = buildCompetentTrace(spec, seed);
  ACCEPTED_RECEIPT = buildActionReceipt({
    arc: FIRST_CHARTER,
    challenge: CHALLENGE,
    cycle: CYCLE,
    orgSeed: ORG_SEED,
    controlledAgentId: "operator",
    partyAgentIds: PARTY,
    trace,
  });
});

describe("accepted action to narrative authority seam", () => {
  it("turns an exact Arc receipt into a fact, selected consequence, and committed narrative beat", () => {
    const ingestion = ingest();
    expect(ingestion.receipt).toMatchObject({
      format: "axm-action-narrative-ingestion/1",
      actionReceiptDigest: ACCEPTED_RECEIPT.receiptDigest,
      actionOutcome: ACCEPTED_RECEIPT.result.outcome,
      inserted: true,
    });
    expect(ingestion.fact).toMatchObject({
      type: "accepted-action-result",
      cycle: CYCLE,
      receiptRef: ACCEPTED_RECEIPT.receiptDigest,
      actorIds: ["operator"],
      data: {
        outcome: ACCEPTED_RECEIPT.result.outcome,
        actionSpecDigest: ACCEPTED_RECEIPT.actionSpecDigest,
        traceDigest: ACCEPTED_RECEIPT.traceDigest,
        stateDigest: ACCEPTED_RECEIPT.stateDigest,
      },
    });

    const selection = sortNarrativeCandidates(constitution(), ingestion.state, [ingestion.candidate]);
    expect(selection.selectedCandidateId).toBe(ingestion.candidate.id);
    const committed = commitNarrativeSelection(
      constitution(),
      ingestion.state,
      [ingestion.candidate],
      selection,
    );
    const beat = committed.state.ledger.beats[0]!;
    expect(beat.sourceFactIds).toEqual([ingestion.fact.id]);
    expect(beat.statePayments).toContainEqual({
      kind: "action-result",
      target: CHALLENGE.id,
      tags: [`action:${ACCEPTED_RECEIPT.result.outcome}`, "payment:action-result"],
      receiptRef: ACCEPTED_RECEIPT.receiptDigest,
    });
    expect(committed.state.tracks[0]).toMatchObject({
      id: `action-${CHALLENGE.id}-${CYCLE}`,
      currentFunction: "consequence",
      status: "resolved",
    });
  });

  it("is idempotent for the same accepted receipt and refuses a conflicting fact", () => {
    const first = ingest();
    const second = ingest(first.state);
    expect(second.receipt.inserted).toBe(false);
    expect(second.state).toEqual(first.state);
    expect(second.fact).toEqual(first.fact);
    expect(second.candidate).toEqual(first.candidate);

    const corruptedState: NarrativeRuntimeState = {
      ...first.state,
      facts: [{ ...first.fact, severity: first.fact.severity + 1 }],
    };
    expect(() => ingest(corruptedState)).toThrow(/fact collision/i);
  });

  it("refuses tampering, provisional candidates, wrong bindings, and absent narrative actors", () => {
    const tampered = structuredClone(ACCEPTED_RECEIPT);
    tampered.result.playerHealth += 1;
    expect(() => ingest(narrativeState(), tampered)).toThrow(/replay mismatch/i);

    expect(() => ingest(narrativeState(), {
      format: "rodoh-action-execution-candidate/1",
      authority: "Arc replay required",
    })).toThrow(/Invalid axm-action-receipt\/1/i);

    expect(() => ingest(narrativeState(), ACCEPTED_RECEIPT, {
      ...binding(),
      challengeId: "another-challenge",
    })).toThrow(/targets another-challenge/i);

    const missingActorState = narrativeState();
    missingActorState.actors = [];
    expect(() => ingest(missingActorState)).toThrow(/absent from narrative state: operator/i);
  });

  it("preserves the accepted Arc outcome as immutable fact data", () => {
    const ingestion = ingest();
    expect(ingestion.fact.data?.outcome).toBe(ACCEPTED_RECEIPT.result.outcome);
    expect(ingestion.candidate.tags).toContain(`action:${ACCEPTED_RECEIPT.result.outcome}`);
    expect(ingestion.candidate.statePayments[0]?.receiptRef).toBe(ACCEPTED_RECEIPT.receiptDigest);
    expect(ingestion.candidate.statePayments[0]?.target).toBe(CHALLENGE.id);
  });
});
