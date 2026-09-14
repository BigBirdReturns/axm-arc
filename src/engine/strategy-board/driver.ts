import { z } from "zod";
import type { Arc } from "../types.js";
import { readRuntimeFamilyContract } from "../runtime-family.js";
import {
  listExecutableStrategyActions,
  listExecutableStrategyMoves,
  type StrategyExecutionState,
  type StrategyInput,
} from "./executor.js";
import type { StrategyBoardDefinition } from "./types.js";
import { readStrategyBoardProgram } from "./program.js";

export const STRATEGY_BOARD_DRIVER_EXTENSION_KEY = "axm.strategy-board-driver@1" as const;
export const STRATEGY_BOARD_DRIVER_FORMAT = "axm-strategy-board-driver/1" as const;

export type StrategyDoctrineDriver =
  | { doctrineId: string; control: "human" }
  | {
      doctrineId: string;
      control: "automatic";
      movementPriority: string[];
      buyPriority: Array<"purchase" | "pass">;
      programActionPriority: string[];
      interferencePriority: string[];
    };
export interface StrategyBoardDriverContract {
  format: typeof STRATEGY_BOARD_DRIVER_FORMAT;
  doctrines: StrategyDoctrineDriver[];
}

const HumanDriverSchema = z.object({
  doctrineId: z.string().min(1),
  control: z.literal("human"),
}).strict();

const AutomaticDriverSchema = z.object({
  doctrineId: z.string().min(1),
  control: z.literal("automatic"),
  movementPriority: z.array(z.string().min(1)),
  buyPriority: z.array(z.enum(["purchase", "pass"])).min(1),
  programActionPriority: z.array(z.string().min(1)).min(1),
  interferencePriority: z.array(z.string().min(1)),
}).strict();

export const StrategyBoardDriverContractSchema: z.ZodType<StrategyBoardDriverContract> = z.object({
  format: z.literal(STRATEGY_BOARD_DRIVER_FORMAT),
  doctrines: z.array(z.union([HumanDriverSchema, AutomaticDriverSchema])).min(1),
}).strict();
export type StrategyBoardDriverValidation =
  | { ok: true; driver: StrategyBoardDriverContract }
  | { ok: false; errors: string[] };

export function validateStrategyBoardDriver(
  input: unknown,
  definition: StrategyBoardDefinition,
): StrategyBoardDriverValidation {
  const parsed = StrategyBoardDriverContractSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) =>
        `[${issue.path.join(".") || "root"}] ${issue.message}`),
    };
  }

  const errors: string[] = [];
  const doctrines = new Map(definition.doctrines.map((entry) => [entry.id, entry]));
  const spaces = new Set(definition.spaces.map((entry) => entry.id));
  const actions = new Set(definition.programActions.map((entry) => entry.id));
  const interferences = new Set(definition.interferences.map((entry) => entry.id));
  const seen = new Set<string>();
  for (const driver of parsed.data.doctrines) {
    if (seen.has(driver.doctrineId)) errors.push(`duplicate doctrine driver "${driver.doctrineId}"`);
    seen.add(driver.doctrineId);
    const doctrine = doctrines.get(driver.doctrineId);
    if (!doctrine) {
      errors.push(`unknown doctrine driver "${driver.doctrineId}"`);
      continue;
    }
    if (driver.control === "automatic") {
      for (const spaceId of driver.movementPriority) {
        if (!spaces.has(spaceId)) errors.push(`driver "${driver.doctrineId}" names unknown movement space "${spaceId}"`);
      }
      for (const actionId of driver.programActionPriority) {
        if (!actions.has(actionId)) errors.push(`driver "${driver.doctrineId}" names unknown program action "${actionId}"`);
        else if (!doctrine.permittedActionIds.includes(actionId)) {
          errors.push(`driver "${driver.doctrineId}" prioritizes action "${actionId}" not permitted by its doctrine`);
        }
      }
      for (const interferenceId of driver.interferencePriority) {
        if (!interferences.has(interferenceId)) errors.push(`driver "${driver.doctrineId}" names unknown interference "${interferenceId}"`);
      }
      if (new Set(driver.buyPriority).size !== driver.buyPriority.length) {
        errors.push(`driver "${driver.doctrineId}" repeats a buy priority`);
      }
    }
  }
  for (const doctrineId of doctrines.keys()) {
    if (!seen.has(doctrineId)) errors.push(`missing doctrine driver "${doctrineId}"`);
  }
  if (!parsed.data.doctrines.some((entry) => entry.control === "human")) {
    errors.push("strategy-board driver requires at least one human doctrine");
  }
  return errors.length
    ? { ok: false, errors }
    : { ok: true, driver: structuredClone(parsed.data) };
}

export function parseStrategyBoardDriver(
  input: unknown,
  definition: StrategyBoardDefinition,
): StrategyBoardDriverContract {
  const result = validateStrategyBoardDriver(input, definition);
  if (!result.ok) {
    throw new Error(`Invalid ${STRATEGY_BOARD_DRIVER_FORMAT}:\n${result.errors.join("\n")}`);
  }
  return result.driver;
}

export function readStrategyBoardDriver(arc: Arc): StrategyBoardDriverContract | null {
  const raw = arc.extensions?.[STRATEGY_BOARD_DRIVER_EXTENSION_KEY];
  if (raw === undefined) return null;
  const family = readRuntimeFamilyContract(arc);
  const program = readStrategyBoardProgram(arc);
  if (family?.family !== "strategy-board" || !program) {
    throw new Error(`${STRATEGY_BOARD_DRIVER_EXTENSION_KEY} requires selected strategy-board program authority.`);
  }
  return parseStrategyBoardDriver(raw, program.definition);
}

function actingSeat(state: StrategyExecutionState) {
  return state.phase === "reactionInterference"
    ? state.seats[(state.activeSeatIndex + 1 + state.execution.reactionIndex) % state.seats.length]!
    : state.seats[state.activeSeatIndex]!;
}

function automaticDriver(
  state: StrategyExecutionState,
  contract: StrategyBoardDriverContract,
): Extract<StrategyDoctrineDriver, { control: "automatic" }> | null {
  const seat = actingSeat(state);
  const driver = contract.doctrines.find((entry) => entry.doctrineId === seat.doctrineId);
  return driver?.control === "automatic" ? driver : null;
}

/** Pure authored opponent policy. It returns an ordinary StrategyInput; the
 * executor remains the only state-changing authority. */
export function nextStrategyBoardDriverInput(
  definition: StrategyBoardDefinition,
  state: StrategyExecutionState,
  contract: StrategyBoardDriverContract,
): StrategyInput | null {
  const driver = automaticDriver(state, contract);
  if (!driver || state.execution.terminal) return null;

  if (state.phase === "movementResolution") {
    const seat = state.seats[state.activeSeatIndex]!;
    const legalMoves = listExecutableStrategyMoves(definition, state);
    const destination = driver.movementPriority.find((id) => legalMoves.includes(id))
      ?? legalMoves[0];
    return destination ? { type: "advance", destinationSpaceId: destination } : { type: "advance" };
  }

  const legal = listExecutableStrategyActions(definition, state);
  const seatId = actingSeat(state).seatId;
  if (state.phase === "buyAuctionPass") {
    for (const kind of driver.buyPriority) {
      const action = legal.find((entry) => entry.kind === kind);
      if (action) return { type: "action", seatId, kind: action.kind, refId: action.refId };
    }
    const pass = legal.find((entry) => entry.kind === "pass");
    if (pass) return { type: "action", seatId, kind: "pass", refId: null };
    throw new Error(`Automatic doctrine "${driver.doctrineId}" has no supported buy/pass action.`);
  }
  if (state.phase === "programAction") {
    for (const actionId of driver.programActionPriority) {
      const action = legal.find((entry) => entry.kind === "programAction" && entry.refId === actionId);
      if (action) return { type: "action", seatId, kind: "programAction", refId: action.refId };
    }
    const fallback = legal.find((entry) => entry.kind === "programAction");
    if (fallback) return { type: "action", seatId, kind: "programAction", refId: fallback.refId };
    const pass = legal.find((entry) => entry.kind === "pass");
    if (pass) return { type: "action", seatId, kind: "pass", refId: null };
    throw new Error(`Automatic doctrine "${driver.doctrineId}" has no legal program action or pass.`);
  }

  if (state.phase === "reactionInterference") {
    for (const interferenceId of driver.interferencePriority) {
      const action = legal.find((entry) => entry.kind === "interference" && entry.refId === interferenceId);
      if (action) return { type: "action", seatId, kind: "interference", refId: action.refId };
    }
    const pass = legal.find((entry) => entry.kind === "pass");
    if (pass) return { type: "action", seatId, kind: "pass", refId: null };
    throw new Error(`Automatic doctrine "${driver.doctrineId}" has no legal reaction.`);
  }

  return null;
}
