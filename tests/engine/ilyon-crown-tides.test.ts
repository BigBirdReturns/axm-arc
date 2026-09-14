import { describe, expect, it } from "vitest";
import { KIND_GODS_OF_ILYON } from "../../src/arcs/kind-gods-of-ilyon.js";
import {
  ILYON_CROWN_TIDES,
  ILYON_CROWN_TIDES_DRIVER,
  ILYON_CROWN_TIDES_PROGRAM,
} from "../../src/arcs/ilyon-crown-tides.js";
import { GODSCAR_EXTENSION_KEY } from "../../src/godscar/types.js";
import { readRuntimeFamilyContract } from "../../src/engine/runtime-family.js";
import {
  advanceStrategyPhase,
  applyLegalStrategyAction,
  initialStrategyExecutionState,
  listExecutableStrategyActions,
  type StrategyExecutionState,
  type StrategyInput,
} from "../../src/engine/strategy-board/index.js";
import { nextStrategyBoardDriverInput, readStrategyBoardDriver } from "../../src/engine/strategy-board/driver.js";
import { readStrategyBoardProgram } from "../../src/engine/strategy-board/program.js";

const program = ILYON_CROWN_TIDES_PROGRAM;
const driver = ILYON_CROWN_TIDES_DRIVER;
const AUTOMATIC_PHASES = new Set(["quarterStart", "milestoneAttempt", "receiptLedger"]);

function apply(state: StrategyExecutionState, input: StrategyInput): StrategyExecutionState {
  return input.type === "advance"
    ? advanceStrategyPhase(program.definition, state, input.destinationSpaceId)
    : applyLegalStrategyAction(program.definition, state, input);
}

function actingSeatId(state: StrategyExecutionState): string {
  return state.phase === "reactionInterference"
    ? state.seats[(state.activeSeatIndex + 1 + state.execution.reactionIndex) % state.seats.length]!.seatId
    : state.seats[state.activeSeatIndex]!.seatId;
}

function settle(state: StrategyExecutionState): StrategyExecutionState {
  let next = state;
  let guard = 0;
  while (!next.execution.terminal) {
    if (++guard > 80) throw new Error("Crown Tides automatic circulation exceeded its test bound.");
    if (AUTOMATIC_PHASES.has(next.phase)) {
      next = apply(next, { type: "advance" });
      continue;
    }
    const automatic = nextStrategyBoardDriverInput(program.definition, next, driver);
    if (!automatic) break;
    next = apply(next, automatic);
  }
  return next;
}

function initial(): StrategyExecutionState {
  return settle(initialStrategyExecutionState(
    program.definition,
    ["you", "benefactors"],
    program.executionRules,
  ));
}

function human(state: StrategyExecutionState, input: StrategyInput): StrategyExecutionState {
  expect(actingSeatId(state)).toBe("you");
  return settle(apply(state, input));
}

describe("Ilyon: Crown Tides", () => {
  it("keeps the exact Godscar story source while selecting the strategy runtime", () => {
    expect(ILYON_CROWN_TIDES.extensions?.[GODSCAR_EXTENSION_KEY]).toEqual(
      KIND_GODS_OF_ILYON.extensions?.[GODSCAR_EXTENSION_KEY],
    );
    expect(readRuntimeFamilyContract(ILYON_CROWN_TIDES)?.family).toBe("strategy-board");
    expect(readStrategyBoardProgram(ILYON_CROWN_TIDES)).toEqual(program);
    expect(readStrategyBoardDriver(ILYON_CROWN_TIDES)).toEqual(driver);
  });

  it("lets a deliberate player build an Uncrowned Federation before closure", () => {
    let state = initial();
    state = human(state, { type: "advance", destinationSpaceId: "free-observatory" });
    state = human(state, { type: "action", seatId: "you", kind: "purchase", refId: "archive-array" });
    state = human(state, { type: "action", seatId: "you", kind: "programAction", refId: "publish-dependency" });
    state = human(state, { type: "action", seatId: "you", kind: "pass", refId: null });

    state = human(state, { type: "advance", destinationSpaceId: "deep-tide" });
    state = human(state, { type: "action", seatId: "you", kind: "purchase", refId: "reef-listener" });
    state = human(state, { type: "action", seatId: "you", kind: "programAction", refId: "fork-the-cure" });
    state = human(state, { type: "action", seatId: "you", kind: "pass", refId: null });

    state = human(state, { type: "advance", destinationSpaceId: "free-observatory" });
    state = human(state, { type: "action", seatId: "you", kind: "pass", refId: null });
    state = human(state, { type: "action", seatId: "you", kind: "programAction", refId: "convene-ocean" });

    expect(state.execution.terminal).toEqual({ endingId: "uncrowned-federation", seatId: "you", quarter: 3 });
    expect(state.execution.milestones.you).toEqual(expect.arrayContaining([
      "care-without-command",
      "public-proof",
      "uncrowned-ready",
    ]));
  });

  it("does not reward meaningless clicking: a passive player is Crowned", () => {
    let state = initial();
    let guard = 0;
    while (!state.execution.terminal && ++guard < 40) {
      expect(actingSeatId(state)).toBe("you");
      if (state.phase === "movementResolution") {
        const seat = state.seats[state.activeSeatIndex]!;
        const current = program.definition.spaces.find((space) => space.id === state.execution.positions[seat.seatId])!;
        state = human(state, { type: "advance", destinationSpaceId: current.adjacentSpaceIds[0]! });
      } else if (state.phase === "buyAuctionPass") {
        state = human(state, { type: "action", seatId: "you", kind: "pass", refId: null });
      } else if (state.phase === "programAction") {
        expect(listExecutableStrategyActions(program.definition, state).some((action) => action.refId === "stabilize-locally")).toBe(true);
        state = human(state, { type: "action", seatId: "you", kind: "programAction", refId: "stabilize-locally" });
      } else if (state.phase === "reactionInterference") {
        state = human(state, { type: "action", seatId: "you", kind: "pass", refId: null });
      } else {
        throw new Error(`Unexpected human phase ${state.phase}`);
      }
    }

    expect(guard).toBeLessThan(40);
    expect(state.execution.terminal?.endingId).toBe("planetary-crown");
    expect(state.execution.terminal?.seatId).toBe("benefactors");
  });
});
