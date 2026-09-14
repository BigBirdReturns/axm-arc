import { describe, expect, it } from "vitest";
import { validateArc } from "../../src/engine/schema.js";
import {
  RUNTIME_FAMILY_EXTENSION_KEY,
  RUNTIME_FAMILY_FORMAT,
} from "../../src/engine/runtime-family.js";
import {
  STRATEGY_BOARD_DRIVER_EXTENSION_KEY,
  STRATEGY_BOARD_DRIVER_FORMAT,
  STRATEGY_BOARD_PROGRAM_EXTENSION_KEY,
  initialStrategyExecutionState,
  nextStrategyBoardDriverInput,
  readStrategyBoardDriver,
  type StrategyBoardDriverContract,
  type StrategyBoardProgram,
} from "../../src/engine/strategy-board/index.js";
import { MINI_ARC } from "../fixtures/mini-arc.js";
import { STRATEGY_BOARD_TEST_PROGRAM } from "../fixtures/strategy-board-program.js";

const program: StrategyBoardProgram = structuredClone(STRATEGY_BOARD_TEST_PROGRAM);
program.definition.doctrines = [
  { ...program.definition.doctrines[0]!, id: "human", name: "Human" },
  { ...program.definition.doctrines[0]!, id: "machine", name: "Machine" },
];
const driver: StrategyBoardDriverContract = {
  format: STRATEGY_BOARD_DRIVER_FORMAT,
  doctrines: [
    { doctrineId: "human", control: "human" },
    {
      doctrineId: "machine",
      control: "automatic",
      movementPriority: ["market", "home"],
      buyPriority: ["purchase", "pass"],
      programActionPriority: ["invest"],
      interferencePriority: [],
    },
  ],
};

function strategyArc() {
  return {
    ...structuredClone(MINI_ARC),
    meta: {
      ...MINI_ARC.meta,
      id: "strategy-driver-contract",
      name: "Strategy Driver Contract",
      domain: "strategy",
      engineVersion: "1.2.0",
    },
    extensions: {
      [RUNTIME_FAMILY_EXTENSION_KEY]: {
        format: RUNTIME_FAMILY_FORMAT,
        family: "strategy-board",
      },
      [STRATEGY_BOARD_PROGRAM_EXTENSION_KEY]: structuredClone(program),
      [STRATEGY_BOARD_DRIVER_EXTENSION_KEY]: structuredClone(driver),
    },
  };
}

function automaticSeatState() {
  let state = initialStrategyExecutionState(
    program.definition,
    ["seat-1", "seat-2"],
    program.executionRules,
  );
  state.activeSeatIndex = 1;
  state.phase = "movementResolution";
  return state;
}

describe("authored Strategy Board driver", () => {
  it("round-trips as Arc law and remains optional", () => {
    const arc = validateArc(strategyArc());
    expect(readStrategyBoardDriver(arc)).toEqual(driver);
    const without: any = strategyArc();
    delete without.extensions[STRATEGY_BOARD_DRIVER_EXTENSION_KEY];
    expect(() => validateArc(without)).not.toThrow();
    expect(readStrategyBoardDriver(validateArc(without))).toBeNull();
  });

  it("returns no input for the human doctrine", () => {
    const state = initialStrategyExecutionState(
      program.definition,
      ["seat-1", "seat-2"],
      program.executionRules,
    );
    state.phase = "movementResolution";
    expect(nextStrategyBoardDriverInput(program.definition, state, driver)).toBeNull();
  });

  it("drives automatic movement, purchase, program action, and reaction deterministically", () => {
    let state = automaticSeatState();
    expect(nextStrategyBoardDriverInput(program.definition, state, driver)).toEqual({
      type: "advance",
      destinationSpaceId: "market",
    });

    state.execution.positions["seat-2"] = "market";
    state.phase = "buyAuctionPass";
    expect(nextStrategyBoardDriverInput(program.definition, state, driver)).toEqual({
      type: "action", seatId: "seat-2", kind: "purchase", refId: "lease",
    });
    state.phase = "programAction";
    expect(nextStrategyBoardDriverInput(program.definition, state, driver)).toEqual({
      type: "action", seatId: "seat-2", kind: "programAction", refId: "invest",
    });

    state.activeSeatIndex = 0;
    state.phase = "reactionInterference";
    state.execution.reactionIndex = 0;
    state.execution.programActionId = "invest";
    expect(nextStrategyBoardDriverInput(program.definition, state, driver)).toEqual({
      type: "action", seatId: "seat-2", kind: "pass", refId: null,
    });
  });

  it("refuses unknown priorities, missing doctrines, and all-automatic games", () => {
    const bad = structuredClone(driver);
    const automatic = bad.doctrines[1]!;
    if (automatic.control !== "automatic") throw new Error("fixture mismatch");
    automatic.programActionPriority = ["missing"];
    const arc = strategyArc();
    arc.extensions[STRATEGY_BOARD_DRIVER_EXTENSION_KEY] = bad;
    expect(() => validateArc(arc)).toThrow(/unknown program action/i);

    const allAutomatic = structuredClone(driver);
    allAutomatic.doctrines[0] = { ...allAutomatic.doctrines[1]!, doctrineId: "human" };
    const autoArc = strategyArc();
    autoArc.extensions[STRATEGY_BOARD_DRIVER_EXTENSION_KEY] = allAutomatic;
    expect(() => validateArc(autoArc)).toThrow(/at least one human doctrine/i);

    const missing = structuredClone(driver);
    missing.doctrines = missing.doctrines.filter((entry) => entry.doctrineId !== "machine");
    const missingArc = strategyArc();
    missingArc.extensions[STRATEGY_BOARD_DRIVER_EXTENSION_KEY] = missing;
    expect(() => validateArc(missingArc)).toThrow(/missing doctrine driver "machine"/i);
  });

  it("refuses the driver outside strategy-board authority", () => {
    const arc = strategyArc();
    arc.extensions[RUNTIME_FAMILY_EXTENSION_KEY] = {
      format: RUNTIME_FAMILY_FORMAT,
      family: "encounter-simulation",
    };
    expect(() => validateArc(arc)).toThrow(/strategy-board driver requires .*strategy-board/i);
  });
});
