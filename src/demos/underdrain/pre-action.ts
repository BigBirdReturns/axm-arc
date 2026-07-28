import {
  commitNarrativeSelection,
  sortNarrativeCandidates,
  type NarrativeCandidate,
  type NarrativeRuntimeState,
} from "../../narrative/index.js";
import {
  UNDERDRAIN_STRATEGY_IDS,
  type UnderdrainStrategyId,
} from "./arc.js";
import {
  initialUnderdrainNarrativeState,
  UNDERDRAIN_CONSTITUTION,
} from "./constitution.js";

function candidate(
  value: Omit<NarrativeCandidate, "authority" | "trackDisposition" | "cooldownCycles"> &
    Partial<Pick<NarrativeCandidate, "trackDisposition" | "cooldownCycles">>,
): NarrativeCandidate {
  return {
    ...value,
    authority: "authoritative",
    trackDisposition: value.trackDisposition ?? "continue",
    cooldownCycles: value.cooldownCycles ?? 0,
  };
}

const PRE_ACTION_CANDIDATES: NarrativeCandidate[] = [
  candidate({
    id: "underdrain-backflow-at-breakfast",
    recipeId: "ordinary-problem-reveals-method",
    track: {
      kind: "open",
      trackId: "underdrain-war",
      railId: "municipal-episode",
      controllingQuestion: "Can Rhea keep Bellwether running without becoming the city's permanent hidden-war department?",
      actorIds: ["rhea-venn"],
      pressureTags: ["pressure:infrastructure"],
    },
    beatFunction: "establish",
    sourceFactIds: ["fact-drain-plague"],
    causalParentBeatIds: [],
    roleBindings: { plumber: "rhea-venn" },
    actorMoves: [{ actorId: "rhea-venn", moveTag: "improvise" }],
    tags: ["ordinary:plumbing", "institution:municipal"],
    pressureTags: ["pressure:infrastructure"],
    statePayments: [{ kind: "resource", target: "kitchen-burst-seal", tags: ["payment:resource"] }],
    opensObligations: [],
    resolvesObligationIds: [],
    authoredPriority: 3,
    conditionComplexity: 2,
    presentationKey: "underdrain.backflow-at-breakfast",
  }),
  candidate({
    id: "underdrain-sanitation-draft",
    recipeId: "institution-formalizes-absurdity",
    track: { kind: "advance", trackId: "underdrain-war" },
    beatFunction: "pressure",
    sourceFactIds: ["fact-draft-order"],
    causalParentBeatIds: [],
    roleBindings: { director: "marta-sump", plumber: "rhea-venn" },
    actorMoves: [{ actorId: "marta-sump", moveTag: "formalize" }],
    tags: ["institution:municipal", "ordinary:plumbing"],
    pressureTags: ["pressure:public-safety"],
    statePayments: [{ kind: "precedent", target: "sanitary-defense-draft", tags: ["payment:precedent"] }],
    opensObligations: [
      {
        id: "keep-water-running",
        kind: "public-duty",
        actorIds: ["rhea-venn"],
        tags: ["pressure:public-safety"],
        pressure: 9,
        dueCycle: 1,
      },
      {
        id: "identify-hidden-drain-cause",
        kind: "diagnostic-duty",
        actorIds: ["rhea-venn", "tess-loam"],
        tags: ["pressure:infrastructure"],
        pressure: 8,
        dueCycle: 1,
      },
    ],
    resolvesObligationIds: [],
    authoredPriority: 4,
    conditionComplexity: 3,
    presentationKey: "underdrain.sanitation-draft",
  }),
  candidate({
    id: "underdrain-drain-cap-side-hustle",
    recipeId: "b-plot-monetizes-a-plot",
    track: { kind: "advance", trackId: "underdrain-war" },
    beatFunction: "escalate",
    sourceFactIds: ["fact-drain-cap-side-hustle"],
    causalParentBeatIds: [],
    roleBindings: { housemate: "dax-venn" },
    actorMoves: [{ actorId: "dax-venn", moveTag: "monetize" }],
    tags: ["institution:municipal", "ordinary:plumbing"],
    pressureTags: ["pressure:family"],
    statePayments: [{ kind: "relationship", target: "rhea-dax-trust", tags: ["payment:relationship"] }],
    opensObligations: [{
      id: "refund-drain-caps",
      kind: "family-debt",
      actorIds: ["dax-venn", "rhea-venn"],
      tags: ["pressure:family"],
      pressure: 6,
      dueCycle: 2,
    }],
    resolvesObligationIds: [],
    authoredPriority: 4,
    conditionComplexity: 4,
    presentationKey: "underdrain.drain-cap-side-hustle",
  }),
];

const STRATEGY_CANDIDATES: Record<UnderdrainStrategyId, NarrativeCandidate> = {
  "emergency-plan": candidate({
    id: "underdrain-choose-emergency-plan",
    recipeId: "method-choice",
    track: { kind: "advance", trackId: "underdrain-war" },
    beatFunction: "choose",
    sourceFactIds: ["fact-draft-order"],
    causalParentBeatIds: [],
    roleBindings: { plumber: "rhea-venn" },
    actorMoves: [{ actorId: "rhea-venn", moveTag: "formalize" }],
    tags: ["institution:municipal", "ordinary:plumbing", "pressure:public-safety"],
    pressureTags: ["pressure:public-safety"],
    statePayments: [{ kind: "precedent", target: "emergency-plan", tags: ["payment:precedent"] }],
    opensObligations: [],
    resolvesObligationIds: [],
    authoredPriority: 3,
    conditionComplexity: 3,
    presentationKey: "underdrain.choose-emergency-plan",
  }),
  "service-tunnel": candidate({
    id: "underdrain-choose-service-tunnel",
    recipeId: "method-choice",
    track: { kind: "advance", trackId: "underdrain-war" },
    beatFunction: "choose",
    sourceFactIds: ["fact-drain-plague", "fact-drain-cap-side-hustle"],
    causalParentBeatIds: [],
    roleBindings: { plumber: "rhea-venn" },
    actorMoves: [{ actorId: "rhea-venn", moveTag: "improvise" }],
    tags: ["institution:municipal", "ordinary:plumbing"],
    pressureTags: ["pressure:infrastructure"],
    statePayments: [{ kind: "resource", target: "burst-seal-stock", tags: ["payment:resource"] }],
    opensObligations: [],
    resolvesObligationIds: [],
    authoredPriority: 3,
    conditionComplexity: 4,
    presentationKey: "underdrain.choose-service-tunnel",
  }),
  "truce-offer": candidate({
    id: "underdrain-choose-truce-offer",
    recipeId: "method-choice",
    track: { kind: "advance", trackId: "underdrain-war" },
    beatFunction: "choose",
    sourceFactIds: ["fact-morrowcap-truce-offer"],
    causalParentBeatIds: [],
    roleBindings: { plumber: "rhea-venn", envoy: "morrowcap" },
    actorMoves: [{ actorId: "rhea-venn", moveTag: "negotiate" }],
    tags: ["institution:municipal", "ordinary:plumbing", "contact:fungal"],
    pressureTags: ["pressure:ecology"],
    statePayments: [{ kind: "relationship", target: "fungal-truce", tags: ["payment:relationship"] }],
    opensObligations: [],
    resolvesObligationIds: [],
    authoredPriority: 3,
    conditionComplexity: 5,
    presentationKey: "underdrain.choose-truce-offer",
  }),
};

export function buildUnderdrainPreActionState(
  strategy: UnderdrainStrategyId = "emergency-plan",
): NarrativeRuntimeState {
  let state = initialUnderdrainNarrativeState();
  for (const authored of [...PRE_ACTION_CANDIDATES, STRATEGY_CANDIDATES[strategy]]) {
    const selection = sortNarrativeCandidates(UNDERDRAIN_CONSTITUTION, state, [authored]);
    if (selection.selectedCandidateId !== authored.id) {
      throw new Error(`Underdrain candidate ${authored.id} was rejected by its own constitution.`);
    }
    state = commitNarrativeSelection(UNDERDRAIN_CONSTITUTION, state, [authored], selection).state;
  }
  return state;
}
