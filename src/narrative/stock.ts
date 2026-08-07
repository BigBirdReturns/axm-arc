import type { NarrativeRailDefinition, NarrativeRailScoreWeights } from "./types.js";

/** A compact causal rail for character-led episodic stories. It permits a reveal
 * or reversal without permitting an event to skip directly from setup to an
 * unearned ending. */
export const RELATIONAL_CAUSAL_RAIL: NarrativeRailDefinition = {
  id: "relational-causal",
  openingFunctions: ["establish"],
  transitions: {
    establish: ["pressure", "reveal"],
    pressure: ["escalate", "reveal", "choose"],
    escalate: ["reveal", "choose", "reverse"],
    reveal: ["escalate", "choose", "reverse"],
    choose: ["reverse", "consequence"],
    reverse: ["choose", "consequence"],
    consequence: ["inherit"],
    inherit: [],
  },
  terminalFunctions: ["consequence", "inherit"],
};

/** Integer-only defaults. A cartridge may tune them, but the sign convention is
 * fixed: every field is a non-negative magnitude and repetition is subtracted. */
export const DEFAULT_NARRATIVE_RAIL_WEIGHTS: NarrativeRailScoreWeights = {
  authoredPriority: 10,
  sourceSeverity: 2,
  conditionComplexity: 5,
  obligationPressure: 3,
  identityRelevance: 12,
  closure: 30,
  freshness: 1,
  actorFit: 6,
  repetition: 4,
  trackUrgency: 2,
};
