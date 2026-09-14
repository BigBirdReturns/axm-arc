import { describe, expect, it } from "vitest";
import { validateArc } from "../../src/engine/schema.js";
import {
  RUNTIME_FAMILY_EXTENSION_KEY,
  RUNTIME_FAMILY_FORMAT,
} from "../../src/engine/runtime-family.js";
import {
  STRATEGY_BOARD_PROGRAM_EXTENSION_KEY,
  STRATEGY_BOARD_PROGRAM_FORMAT,
  readStrategyBoardProgram,
  requireSelectedStrategyBoardProgram,
  validateStrategyBoardProgram,
  type StrategyBoardDefinition,
  type StrategyBoardProgram,
  type StrategyExecutionRules,
} from "../../src/engine/strategy-board/index.js";
import { MINI_ARC } from "../fixtures/mini-arc.js";

const definition: StrategyBoardDefinition = {
  id: "circulation-board",
  name: "Circulation Board",
  description: "Generic strategy-board program authority fixture.",
  seatCountRange: { min: 2, max: 3 },
  resources: [
    { id: "coin", name: "Coin", description: "Spendable units." },
    { id: "standing", name: "Standing", description: "Structural position." },
  ],
  doctrines: [{
    id: "operator",
    name: "Operator",
    description: "Generic doctrine.",
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
    id: "timeout",
    name: "Timeout",
    description: "Bounded terminal condition.",
    condition: { type: "timeout", note: "Quarter threshold is execution law." },
    scoringNote: "No inferred score.",
  }],
};

const executionRules: StrategyExecutionRules = {
  version: 1,
  startSpaceId: "home",
  movement: "adjacentInput",
  reactionLimitPerSeat: 1,
  interferenceEffect: "activeSeatMutations",
  obligationDoctrineIds: {},
  endings: [{ endingId: "timeout", milestoneIds: [], quarterAtLeast: 2 }],
};
const program: StrategyBoardProgram = {
  format: STRATEGY_BOARD_PROGRAM_FORMAT,
  definition,
  executionRules,
};

function strategyArc() {
  return {
    ...structuredClone(MINI_ARC),
    meta: {
      ...MINI_ARC.meta,
      id: "strategy-program-contract",
      name: "Strategy Program Contract",
      domain: "strategy",
      engineVersion: "1.2.0",
    },
    extensions: {
      [RUNTIME_FAMILY_EXTENSION_KEY]: {
        format: RUNTIME_FAMILY_FORMAT,
        family: "strategy-board",
      },
      [STRATEGY_BOARD_PROGRAM_EXTENSION_KEY]: structuredClone(program),
    },
  };
}

describe("strategy-board authored program authority", () => {
  it("validates and round-trips without mutating authored bytes", () => {
    const before = JSON.stringify(program);
    const result = validateStrategyBoardProgram(program);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.program).toEqual(program);
    expect(JSON.stringify(program)).toBe(before);
    expect(result.program).not.toBe(program);
  });

  it("is required by explicit strategy-board runtime selection", () => {
    const arc = validateArc(strategyArc());
    expect(readStrategyBoardProgram(arc)).toEqual(program);
    expect(requireSelectedStrategyBoardProgram(arc)).toEqual(program);

    const missing: any = strategyArc();
    delete missing.extensions[STRATEGY_BOARD_PROGRAM_EXTENSION_KEY];
    expect(() => validateArc(missing)).toThrow(/requires axm\.strategy-board@1 authored authority/);
  });

  it("refuses strategy authority under another runtime family", () => {
    const mismatch = strategyArc();
    mismatch.extensions[RUNTIME_FAMILY_EXTENSION_KEY] = {
      format: RUNTIME_FAMILY_FORMAT,
      family: "encounter-simulation",
    };
    expect(() => validateArc(mismatch)).toThrow(/requires axm\.runtime-family@1 family "strategy-board"/);
  });

  it("refuses malformed definition and incompatible execution law", () => {
    const badDefinition = structuredClone(program);
    badDefinition.definition.spaces[0]!.adjacentSpaceIds = ["missing"];
    expect(validateStrategyBoardProgram(badDefinition).ok).toBe(false);
    const badRules = structuredClone(program);
    badRules.executionRules.startSpaceId = "missing";
    const result = validateStrategyBoardProgram(badRules);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toMatch(/unknown start space/);
  });

  it("keeps unrelated runtime families valid and future strategy authority opaque unless selected", () => {
    const unrelated = {
      ...structuredClone(MINI_ARC),
      meta: { ...MINI_ARC.meta, engineVersion: "1.2.0" },
      extensions: {
        [RUNTIME_FAMILY_EXTENSION_KEY]: {
          format: RUNTIME_FAMILY_FORMAT,
          family: "encounter-simulation",
        },
        "axm.strategy-board@2": { future: true },
      },
    };
    expect(() => validateArc(unrelated)).not.toThrow();

    const selectedFuture = structuredClone(unrelated);
    selectedFuture.extensions[RUNTIME_FAMILY_EXTENSION_KEY] = {
      format: RUNTIME_FAMILY_FORMAT,
      family: "strategy-board",
    };
    expect(() => validateArc(selectedFuture)).toThrow(/requires axm\.strategy-board@1 authored authority/);
  });
});
