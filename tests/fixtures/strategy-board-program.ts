import {
  STRATEGY_BOARD_PROGRAM_EXTENSION_KEY,
  STRATEGY_BOARD_PROGRAM_FORMAT,
  type StrategyBoardDefinition,
  type StrategyBoardProgram,
  type StrategyExecutionRules,
} from "../../src/engine/strategy-board/index.js";

export const STRATEGY_BOARD_TEST_DEFINITION: StrategyBoardDefinition = {
  id: "circulation-board",
  name: "Circulation Board",
  description: "Generic strategy-board authority fixture.",
  seatCountRange: { min: 2, max: 3 },
  resources: [
    { id: "coin", name: "Coin", description: "Spendable units." },
    { id: "standing", name: "Standing", description: "Structural position." },
  ],
  doctrines: [{
    id: "operator", name: "Operator", description: "Generic doctrine.",
    startingResources: [
      { resourceId: "coin", amount: 10 },
      { resourceId: "standing", amount: 0 },
    ],
    permittedActionIds: ["invest"],
  }],
  spaces: [
    { id: "home", name: "Home", type: "start", region: "r", adjacentSpaceIds: ["market"] },
    { id: "market", name: "Market", type: "asset", region: "r", adjacentSpaceIds: ["home"], assetId: "lease" },
  ],
  controlAssets: [{
    id: "lease", name: "Lease", description: "Generic buyable asset.",
    sitedOnSpaceId: "market", ownershipModel: "buyable", effectScope: "owner",
    acquisitionCost: { resourceId: "coin", amount: 2 },
    income: { resourceId: "coin", amountPerQuarter: 1 },
    toll: { resourceId: "coin", amount: 1, chargedWhen: "nonOwnerOccupant", eventKind: "tollPayment" },
  }],
  auctions: [],
  programActions: [{
    id: "invest", name: "Invest", description: "Convert coin into standing.",
    target: "self", honoredBy: "programAction",
    cost: [{ resourceId: "coin", delta: -1, eventKind: "programActionCost" }],
    effect: {
      summary: "Gain standing.",
      mutations: [{ resourceId: "standing", delta: 1, eventKind: "programActionYield" }],
    },
  }],
  interferences: [],
  obligations: [],
  milestones: [],
  endings: [{
    id: "timeout", name: "Timeout", description: "Bounded terminal condition.",
    condition: { type: "timeout", note: "Quarter threshold is execution law." },
    scoringNote: "No inferred score.",
  }],
};

export const STRATEGY_BOARD_TEST_RULES: StrategyExecutionRules = {
  version: 1,
  startSpaceId: "home",
  movement: "adjacentInput",
  reactionLimitPerSeat: 1,
  interferenceEffect: "activeSeatMutations",
  obligationDoctrineIds: {},
  endings: [{ endingId: "timeout", milestoneIds: [], quarterAtLeast: 2 }],
};

export const STRATEGY_BOARD_TEST_PROGRAM: StrategyBoardProgram = {
  format: STRATEGY_BOARD_PROGRAM_FORMAT,
  definition: STRATEGY_BOARD_TEST_DEFINITION,
  executionRules: STRATEGY_BOARD_TEST_RULES,
};
export function strategyBoardProgramExtension(): Record<string, unknown> {
  return {
    [STRATEGY_BOARD_PROGRAM_EXTENSION_KEY]: structuredClone(STRATEGY_BOARD_TEST_PROGRAM),
  };
}
