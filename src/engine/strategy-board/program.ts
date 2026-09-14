import { z } from "zod";
import type { Arc } from "../types.js";
import { readRuntimeFamilyContract } from "../runtime-family.js";
import { StrategyBoardSchema } from "./schema.js";
import {
  initialStrategyExecutionState,
  type StrategyExecutionRules,
} from "./executor.js";
import type { StrategyBoardDefinition } from "./types.js";

export const STRATEGY_BOARD_PROGRAM_EXTENSION_KEY = "axm.strategy-board@1" as const;
export const STRATEGY_BOARD_PROGRAM_FORMAT = "axm-strategy-board/1" as const;

export const StrategyExecutionRulesSchema: z.ZodType<StrategyExecutionRules> = z.object({
  version: z.literal(1),
  startSpaceId: z.string().min(1),
  movement: z.literal("adjacentInput"),
  reactionLimitPerSeat: z.literal(1),
  interferenceEffect: z.literal("activeSeatMutations"),
  obligationDoctrineIds: z.record(z.array(z.string().min(1))),
  endings: z.array(z.object({
    endingId: z.string().min(1),
    milestoneIds: z.array(z.string().min(1)),
    quarterAtLeast: z.number().int().safe().positive().optional(),
    doctrineIds: z.array(z.string().min(1)).min(1).optional(),
  }).strict()),
}).strict();

export interface StrategyBoardProgram {
  format: typeof STRATEGY_BOARD_PROGRAM_FORMAT;
  definition: StrategyBoardDefinition;
  executionRules: StrategyExecutionRules;
}

export const StrategyBoardProgramSchema: z.ZodType<StrategyBoardProgram> = z.object({
  format: z.literal(STRATEGY_BOARD_PROGRAM_FORMAT),
  definition: StrategyBoardSchema,
  executionRules: StrategyExecutionRulesSchema,
}).strict();

export type StrategyBoardProgramValidation =
  | { ok: true; program: StrategyBoardProgram }
  | { ok: false; errors: string[] };

function validationSeats(definition: StrategyBoardDefinition): string[] {
  return Array.from(
    { length: definition.seatCountRange.min },
    (_, index) => `validation-seat-${index + 1}`,
  );
}

export function validateStrategyBoardProgram(input: unknown): StrategyBoardProgramValidation {
  const parsed = StrategyBoardProgramSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) =>
        `[${issue.path.join(".") || "root"}] ${issue.message}`),
    };
  }
  try {
    initialStrategyExecutionState(
      parsed.data.definition,
      validationSeats(parsed.data.definition),
      parsed.data.executionRules,
    );
    return { ok: true, program: structuredClone(parsed.data) };
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] };
  }
}

export function parseStrategyBoardProgram(input: unknown): StrategyBoardProgram {
  const result = validateStrategyBoardProgram(input);
  if (!result.ok) throw new Error(`Invalid ${STRATEGY_BOARD_PROGRAM_FORMAT}:\n${result.errors.join("\n")}`);
  return result.program;
}

export function readStrategyBoardProgram(arc: Arc): StrategyBoardProgram | null {
  const raw = arc.extensions?.[STRATEGY_BOARD_PROGRAM_EXTENSION_KEY];
  return raw === undefined ? null : parseStrategyBoardProgram(raw);
}

export function requireSelectedStrategyBoardProgram(arc: Arc): StrategyBoardProgram {
  const family = readRuntimeFamilyContract(arc);
  if (family?.family !== "strategy-board") {
    throw new Error(`Strategy-board authority requires axm.runtime-family@1 family "strategy-board".`);
  }
  const program = readStrategyBoardProgram(arc);
  if (!program) {
    throw new Error(`Strategy-board runtime selection requires ${STRATEGY_BOARD_PROGRAM_EXTENSION_KEY} authored authority.`);
  }
  return program;
}
