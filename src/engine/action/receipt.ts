import { z } from "zod";
import type { Arc, Challenge } from "../types.js";
import { cartridgeDigest, sha256Hex } from "../cartridge-digest.js";
import { compareCodepoints, orderRecordKeysDeep } from "../determinism.js";
import { hashSeed } from "../prng.js";
import { compileActionEncounter } from "./compile.js";
import { compressActionInputs, normalizeActionInput, replayActionTrace } from "./simulation.js";
import {
  ACTION_BUTTON_MASK,
  ACTION_RECEIPT_FORMAT,
  ACTION_RUNTIME_VERSION,
  ACTION_SEMANTIC_RUNTIME_VERSION,
  type ActionInputRun,
  type ActionReceipt,
  type ActionReceiptCore,
  type ActionSimulationState,
  type VerifiedActionReceipt,
} from "./types.js";

const Id = z.string().min(1).max(256);
const Digest = z.string().min(8).max(160);
const InputSchema = z.object({
  moveX: z.number().int().min(-1).max(1),
  moveY: z.number().int().min(-1).max(1),
  aimX: z.number().int().min(-1).max(1),
  aimY: z.number().int().min(-1).max(1),
  buttons: z.number().int().min(0).max(ACTION_BUTTON_MASK),
}).strict();
const InputRunSchema = z.object({ ticks: z.number().int().positive().max(18_000), input: InputSchema }).strict();
const StatsSchema = z.object({
  hitsLanded: z.number().int().nonnegative(),
  heavyHits: z.number().int().nonnegative(),
  damageTaken: z.number().int().nonnegative(),
  parries: z.number().int().nonnegative(),
  dodgedAttacks: z.number().int().nonnegative(),
  enemiesDefeated: z.number().int().nonnegative(),
  objectiveInteractions: z.number().int().nonnegative().optional(),
  objectiveHoldTicks: z.number().int().nonnegative().optional(),
}).strict();
const ProgressSchema = z.object({
  id: Id,
  defeated: z.number().int().nonnegative(),
  target: z.number().int().positive(),
  completed: z.boolean(),
  kind: z.enum(["interact_count", "hold_ticks"]).optional(),
  progress: z.number().int().nonnegative().optional(),
}).strict();
const ResultSchema = z.object({
  outcome: z.enum(["success", "partial", "failure"]),
  completedObjectiveIds: z.array(Id).max(128),
  objectives: z.array(ProgressSchema).max(128),
  playerHealth: z.number().int().nonnegative(),
  playerDefeated: z.boolean(),
  totalTicks: z.number().int().positive().max(18_000),
  stats: StatsSchema,
}).strict();
const ReceiptSchema = z.object({
  format: z.literal(ACTION_RECEIPT_FORMAT),
  runtimeVersion: z.union([
    z.literal(ACTION_RUNTIME_VERSION),
    z.literal(ACTION_SEMANTIC_RUNTIME_VERSION),
  ]),
  arcDigest: Digest,
  challengeId: Id,
  difficultyModeId: Id.nullable(),
  actionSpecDigest: Digest,
  cycle: z.number().int().nonnegative(),
  seed: z.number().int().min(0).max(0xffff_ffff),
  controlledAgentId: Id,
  partyAgentIds: z.array(Id).min(1).max(128),
  trace: z.array(InputRunSchema).min(1).max(18_000),
  totalTicks: z.number().int().positive().max(18_000),
  result: ResultSchema,
  traceDigest: Digest,
  stateDigest: Digest,
  receiptDigest: Digest,
}).strict();

function canonical(value: unknown): string {
  return JSON.stringify(orderRecordKeysDeep(value));
}

export function parseActionReceipt(input: unknown): ActionReceipt {
  const parsed = ReceiptSchema.safeParse(input);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => `${issue.path.join(".") || "receipt"}: ${issue.message}`);
    throw new Error(`Invalid ${ACTION_RECEIPT_FORMAT}:\n${messages.join("\n")}`);
  }
  return structuredClone(parsed.data) as ActionReceipt;
}

export function actionSeed(orgSeed: number, cycle: number, challengeId: string, difficultyModeId: string | null): number {
  return hashSeed(orgSeed, cycle, challengeId, difficultyModeId ?? "base", "axm-action/1");
}

function canonicalTrace(trace: readonly ActionInputRun[]): ActionInputRun[] {
  const inputs = [] as ReturnType<typeof normalizeActionInput>[];
  let totalTicks = 0;
  for (const run of trace) {
    if (!Number.isSafeInteger(run.ticks) || run.ticks <= 0 || run.ticks > 18_000) {
      throw new Error(`Action trace run length ${String(run.ticks)} is invalid.`);
    }
    totalTicks += run.ticks;
    if (totalTicks > 18_000) throw new Error("Action trace exceeds the maximum receipt tick budget.");
    const input = normalizeActionInput(run.input);
    for (let tick = 0; tick < run.ticks; tick++) inputs.push(input);
  }
  return compressActionInputs(inputs);
}

export function actionTraceDigest(trace: readonly ActionInputRun[]): string {
  return "acttrace1_" + sha256Hex(canonical(trace));
}

export function actionStateDigest(state: ActionSimulationState): string {
  return "actstate1_" + sha256Hex(canonical(state));
}

export function actionReceiptDigest(core: ActionReceiptCore): string {
  return "actrun1_" + sha256Hex(canonical(core));
}

export function buildActionReceipt(params: {
  arc: Arc;
  challenge: Challenge;
  difficultyModeId?: string | null;
  cycle: number;
  orgSeed: number;
  controlledAgentId: string;
  partyAgentIds: string[];
  trace: readonly ActionInputRun[];
}): ActionReceipt {
  const difficultyModeId = params.difficultyModeId ?? null;
  const spec = compileActionEncounter(params.arc, params.challenge, difficultyModeId);
  const seed = actionSeed(params.orgSeed, params.cycle, params.challenge.id, difficultyModeId);
  const partyAgentIds = [...new Set(params.partyAgentIds)].sort(compareCodepoints);
  if (partyAgentIds.length !== params.partyAgentIds.length) throw new Error("Action receipt party contains duplicate agent ids.");
  if (!partyAgentIds.includes(params.controlledAgentId)) {
    throw new Error("Action receipt controlled agent must belong to the committed party.");
  }
  const trace = canonicalTrace(params.trace);
  const terminal = replayActionTrace(spec, seed, trace);
  if (!terminal.result) throw new Error("Action receipt trace did not reach a terminal result.");
  const traceTicks = trace.reduce((sum, run) => sum + run.ticks, 0);
  if (traceTicks !== terminal.result.totalTicks) throw new Error("Action receipt trace length does not match the terminal tick.");
  const core: ActionReceiptCore = {
    format: ACTION_RECEIPT_FORMAT,
    runtimeVersion: spec.runtimeVersion,
    arcDigest: cartridgeDigest(params.arc),
    challengeId: params.challenge.id,
    difficultyModeId,
    actionSpecDigest: spec.specDigest,
    cycle: params.cycle,
    seed,
    controlledAgentId: params.controlledAgentId,
    partyAgentIds,
    trace,
    totalTicks: terminal.result.totalTicks,
    result: structuredClone(terminal.result),
    traceDigest: actionTraceDigest(trace),
    stateDigest: actionStateDigest(terminal),
  };
  return orderRecordKeysDeep({ ...core, receiptDigest: actionReceiptDigest(core) });
}

export function verifyActionReceipt(params: {
  arc: Arc;
  challenge: Challenge;
  difficultyModeId?: string | null;
  cycle: number;
  orgSeed: number;
  partyAgentIds: string[];
  receipt: unknown;
}): VerifiedActionReceipt {
  const difficultyModeId = params.difficultyModeId ?? null;
  const receipt = parseActionReceipt(params.receipt);
  const expectedSeed = actionSeed(params.orgSeed, params.cycle, params.challenge.id, difficultyModeId);
  if (receipt.arcDigest !== cartridgeDigest(params.arc)) throw new Error("Action receipt cartridge digest mismatch.");
  if (receipt.challengeId !== params.challenge.id) throw new Error("Action receipt challenge mismatch.");
  if (receipt.difficultyModeId !== difficultyModeId) throw new Error("Action receipt difficulty-mode mismatch.");
  if (receipt.cycle !== params.cycle) throw new Error("Action receipt cycle mismatch.");
  if (receipt.seed !== expectedSeed) throw new Error("Action receipt seed mismatch.");
  const expectedParty = [...new Set(params.partyAgentIds)].sort(compareCodepoints);
  if (expectedParty.length !== params.partyAgentIds.length) throw new Error("Committed action party contains duplicate agent ids.");
  if (canonical(receipt.partyAgentIds) !== canonical(expectedParty)) throw new Error("Action receipt party mismatch.");
  if (!expectedParty.includes(receipt.controlledAgentId)) throw new Error("Action receipt controlled agent is not in the committed party.");

  const spec = compileActionEncounter(params.arc, params.challenge, difficultyModeId);
  if (receipt.runtimeVersion !== spec.runtimeVersion) throw new Error("Action receipt runtime-version mismatch.");
  if (receipt.actionSpecDigest !== spec.specDigest) throw new Error("Action receipt encounter-law digest mismatch.");
  const rebuilt = buildActionReceipt({
    arc: params.arc,
    challenge: params.challenge,
    difficultyModeId,
    cycle: params.cycle,
    orgSeed: params.orgSeed,
    controlledAgentId: receipt.controlledAgentId,
    partyAgentIds: expectedParty,
    trace: receipt.trace,
  });
  if (canonical(rebuilt) !== canonical(receipt)) throw new Error("Action receipt replay mismatch.");
  const terminalState = replayActionTrace(spec, expectedSeed, receipt.trace);
  return { spec, receipt: rebuilt, terminalState };
}
