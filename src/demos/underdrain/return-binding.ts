import type { ActionNarrativeBinding } from "../../narrative/action-receipt-seam.js";
import { UNDERDRAIN_CHALLENGE_ID } from "./arc.js";

export const UNDERDRAIN_ACTION_NARRATIVE_BINDING: ActionNarrativeBinding = {
  format: "axm-action-narrative-binding/1",
  id: "underdrain-crown-pump-return",
  version: "1.0.0",
  challengeId: UNDERDRAIN_CHALLENGE_ID,
  track: { kind: "advance", trackId: "underdrain-war" },
  outcomes: {
    success: {
      beatFunction: "consequence",
      severity: 8,
      tags: ["institution:municipal", "ordinary:plumbing", "agreement:drain-concord"],
      pressureTags: ["pressure:recurrence"],
      controlledMoveTag: "ratify-drain-concord",
      statePayments: [
        { kind: "precedent", target: "fungal-embassy", tags: ["payment:precedent"] },
        { kind: "relationship", target: "rhea-morrowcap-truce", tags: ["payment:relationship"] },
      ],
      opensObligations: [
        {
          id: "deliver-municipal-compost",
          kind: "treaty-duty",
          actorScope: "controlled",
          tags: ["pressure:recurrence"],
          pressure: 7,
          dueCycleOffset: 2,
        },
        {
          id: "honor-fungal-embassy",
          kind: "institutional-precedent",
          actorScope: "party",
          tags: ["institution:municipal"],
          pressure: 6,
        },
      ],
      resolvesObligationIds: [
        "keep-water-running",
        "refund-drain-caps",
        "expose-enzyme-poisoning",
      ],
      authoredPriority: 8,
      conditionComplexity: 7,
      cooldownCycles: 0,
      presentationKey: "underdrain.consequence.success",
    },
    partial: {
      beatFunction: "consequence",
      severity: 7,
      tags: ["institution:municipal", "ordinary:plumbing", "agreement:pump-ceasefire"],
      pressureTags: ["pressure:recurrence"],
      controlledMoveTag: "declare-pump-ceasefire",
      statePayments: [
        { kind: "precedent", target: "pump-annex-ceasefire", tags: ["payment:precedent"] },
      ],
      opensObligations: [
        {
          id: "audit-lower-aquifer",
          kind: "evidence-duty",
          actorScope: "party",
          tags: ["pressure:ecology"],
          pressure: 8,
          dueCycleOffset: 1,
        },
        {
          id: "negotiate-fungal-labor-status",
          kind: "institutional-debt",
          actorScope: "party",
          tags: ["institution:municipal"],
          pressure: 5,
        },
      ],
      resolvesObligationIds: ["keep-water-running"],
      authoredPriority: 7,
      conditionComplexity: 7,
      cooldownCycles: 0,
      presentationKey: "underdrain.consequence.partial",
    },
    failure: {
      beatFunction: "consequence",
      severity: 9,
      tags: ["institution:municipal", "ordinary:plumbing", "crisis:toilet-rationing"],
      pressureTags: ["pressure:public-safety"],
      controlledMoveTag: "request-toilet-rationing",
      statePayments: [
        { kind: "resource", target: "emergency-water-ration", tags: ["payment:resource"] },
      ],
      opensObligations: [
        {
          id: "restore-crown-pump",
          kind: "public-duty",
          actorScope: "controlled",
          tags: ["pressure:public-safety"],
          pressure: 10,
          dueCycleOffset: 1,
        },
        {
          id: "pay-substrate-invoice",
          kind: "fungal-debt",
          actorScope: "party",
          tags: ["pressure:recurrence"],
          pressure: 4,
        },
      ],
      resolvesObligationIds: [],
      authoredPriority: 9,
      conditionComplexity: 6,
      cooldownCycles: 0,
      presentationKey: "underdrain.consequence.failure",
    },
  },
};
