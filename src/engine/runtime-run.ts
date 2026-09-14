import { cartridgeDigest, sha256Hex } from "./cartridge-digest.js";
import { orderedKeys } from "./determinism.js";
import type { PortableRunExtensions } from "./portable-run.js";
import { selectRuntimeFamily } from "./runtime-family.js";
import { validateArc } from "./schema.js";
import type { Arc } from "./types.js";
import {
  replayStrategyInputs,
  type LegalActionKind,
  type StrategyExecutionState,
  type StrategyInput,
} from "./strategy-board/index.js";
import { requireSelectedStrategyBoardProgram, STRATEGY_BOARD_PROGRAM_EXTENSION_KEY } from "./strategy-board/program.js";

export const RUNTIME_RUN_FORMAT = "axm-runtime-run/v1" as const;
export const RUNTIME_RUN_INTEGRITY_ALGORITHM = "sha256" as const;
export const RUNTIME_RUN_DIGEST_PREFIX = "rr1_" as const;
export const STRATEGY_STATE_DIGEST_PREFIX = "sstate1_" as const;

export interface StrategyBoardRuntimeTraceV1 {
  family: "strategy-board";
  version: 1;
  seatIds: string[];
  inputs: StrategyInput[];
  stateDigest: string;
}

export interface RuntimeRunV1 {
  format: typeof RUNTIME_RUN_FORMAT;
  authoredArcDigest: string;
  arc: Arc;
  runtime: StrategyBoardRuntimeTraceV1;
  extensions: PortableRunExtensions;
  integrity: {
    algorithm: typeof RUNTIME_RUN_INTEGRITY_ALGORITHM;
    digest: string;
  };
}

export interface RestoredRuntimeRunV1 {
  run: RuntimeRunV1;
  arc: Arc;
  authoredArcDigest: string;
  state: StrategyExecutionState;
  extensions: PortableRunExtensions;
}

export interface BuildStrategyBoardRuntimeRunParams {
  arc: Arc;
  seatIds: string[];
  inputs: readonly StrategyInput[];
  extensions?: PortableRunExtensions;
}

interface RuntimeRunCore {
  format: typeof RUNTIME_RUN_FORMAT;
  authoredArcDigest: string;
  arc: Arc;
  runtime: StrategyBoardRuntimeTraceV1;
  extensions: PortableRunExtensions;
}

const LEGAL_ACTION_KINDS = new Set<LegalActionKind>([
  "programAction", "purchase", "auction", "interference", "pass",
]);

/** Transport limits apply to the entire envelope, including opaque memory. */
export const RUNTIME_RUN_MAX_JSON_DEPTH = 64;
export const RUNTIME_RUN_MAX_JSON_NODES = 100_000;
export const RUNTIME_RUN_MAX_JSON_LENGTH = 16 * 1024 * 1024;

/** Build from authored law and exact decisions, never from a supplied snapshot. */
export function buildStrategyBoardRuntimeRun(params: BuildStrategyBoardRuntimeRunParams): RuntimeRunV1 {
  const arc = validateArc(params.arc);
  const program = selectedProgram(arc);
  const seatIds = parseSeats(params.seatIds);
  const inputs = parseInputs(jsonClone(params.inputs));
  const extensions = normalizeExtensions(params.extensions ?? {});
  const state = replayStrategyInputs(program.definition, seatIds, program.executionRules, inputs);
  const core: RuntimeRunCore = {
    format: RUNTIME_RUN_FORMAT,
    authoredArcDigest: cartridgeDigest(arc),
    arc,
    runtime: { family: "strategy-board", version: 1, seatIds, inputs, stateDigest: strategyStateDigest(state) },
    extensions,
  };
  return { ...core, integrity: {
    algorithm: RUNTIME_RUN_INTEGRITY_ALGORITHM,
    digest: runtimeRunPayloadDigest(core),
  } };
}

/** Verify raw JSON integrity before any schema normalization or execution.
 * The returned state is computed exclusively by Arc's authoritative executor. */
export function parseRuntimeRun(input: unknown): RestoredRuntimeRunV1 {
  let value = input;
  if (typeof input === "string") {
    if (input.length > RUNTIME_RUN_MAX_JSON_LENGTH) throw new Error("Runtime run JSON length limit exceeded.");
    try { value = JSON.parse(input) as unknown; }
    catch { throw new Error("Runtime run is not valid JSON."); }
  }
  // Snapshot JSON semantics without interpreting or dropping any fields.
  const raw = plainObject(jsonClone(value), "Runtime run");
  assertKeys(raw, ["format", "authoredArcDigest", "arc", "runtime", "extensions", "integrity"], [], "Runtime run");
  const integrity = plainObject(raw.integrity, "Runtime run integrity");
  assertKeys(integrity, ["algorithm", "digest"], [], "Runtime run integrity");
  if (integrity.algorithm !== RUNTIME_RUN_INTEGRITY_ALGORITHM) throw new Error("Unsupported runtime run integrity algorithm.");
  if (typeof integrity.digest !== "string" || !/^rr1_[0-9a-f]{64}$/.test(integrity.digest)) {
    throw new Error("Runtime run integrity.digest is not an rr1 SHA-256 digest.");
  }
  const { integrity: _integrity, ...core } = raw;
  const digest = runtimeRunPayloadDigest(core);
  if (digest !== integrity.digest) throw new Error("Runtime run integrity mismatch.");

  if (raw.format !== RUNTIME_RUN_FORMAT) throw new Error(`Unsupported runtime run format "${String(raw.format)}".`);
  const arc = validateArc(raw.arc);
  if (canonicalJson(raw.arc) !== canonicalJson(arc)) {
    throw new Error("Runtime run arc is valid but not in canonical validated form.");
  }
  const authoredArcDigest = cartridgeDigest(arc);
  if (raw.authoredArcDigest !== authoredArcDigest) throw new Error("Runtime run cartridge digest mismatch.");
  const program = selectedProgram(arc);
  const runtime = plainObject(raw.runtime, "Runtime run runtime");
  assertKeys(runtime, ["family", "version", "seatIds", "inputs", "stateDigest"], [], "Runtime run runtime");
  if (runtime.family !== "strategy-board" || runtime.version !== 1) {
    throw new Error("Unsupported runtime run payload: only strategy-board version 1 is implemented.");
  }
  if (typeof runtime.stateDigest !== "string" || !/^sstate1_[0-9a-f]{64}$/.test(runtime.stateDigest)) {
    throw new Error("Runtime run runtime.stateDigest is not an sstate1 SHA-256 digest.");
  }
  const seatIds = parseSeats(runtime.seatIds);
  const inputs = parseInputs(runtime.inputs);
  const extensions = normalizeExtensions(raw.extensions);
  const state = replayStrategyInputs(program.definition, seatIds, program.executionRules, inputs);
  if (strategyStateDigest(state) !== runtime.stateDigest) throw new Error("Runtime run replay state digest mismatch.");
  const run: RuntimeRunV1 = {
    format: RUNTIME_RUN_FORMAT, authoredArcDigest, arc,
    runtime: { family: "strategy-board", version: 1, seatIds, inputs, stateDigest: runtime.stateDigest },
    extensions, integrity: { algorithm: RUNTIME_RUN_INTEGRITY_ALGORITHM, digest },
  };
  return { run, arc, authoredArcDigest, state, extensions };
}

/** Hash every core field; callers exclude the integrity block. No trust claim. */
export function runtimeRunPayloadDigest(core: unknown): string {
  return RUNTIME_RUN_DIGEST_PREFIX + sha256Hex(canonicalJson(core));
}

/** A replay checkpoint, never an alternative source of execution authority. */
export function strategyStateDigest(state: StrategyExecutionState): string {
  return STRATEGY_STATE_DIGEST_PREFIX + sha256Hex(canonicalJson(state));
}

/** Discriminator only. Always parseRuntimeRun before using any claimed state. */
export function isRuntimeRunV1(input: unknown): boolean {
  try {
    const raw = typeof input === "string" ? JSON.parse(input) as unknown : input;
    return plainObject(raw, "Runtime run").format === RUNTIME_RUN_FORMAT;
  } catch { return false; }
}

function selectedProgram(arc: Arc) {
  const selection = selectRuntimeFamily(arc, ["strategy-board"]);
  if (selection.kind !== "selected") throw new Error("Runtime run requires authored strategy-board runtime family version 1.");
  const program = requireSelectedStrategyBoardProgram(arc);
  // Arc extensions preserve opaque JSON; program parsing must not ignore extras.
  if (canonicalJson(arc.extensions![STRATEGY_BOARD_PROGRAM_EXTENSION_KEY]) !== canonicalJson(program)) {
    throw new Error("Runtime run strategy-board program is not in canonical validated form (extra or normalized fields).");
  }
  return program;
}

function parseSeats(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every(isId) || new Set(value).size !== value.length) {
    throw new Error("Runtime run seatIds must be an array of unique nonempty strings.");
  }
  return [...value]; // Authored seat-count constraints are enforced by the executor.
}

function isId(value: unknown): value is string { return typeof value === "string" && value.length > 0; }

function parseInputs(value: unknown): StrategyInput[] {
  if (!Array.isArray(value)) throw new Error("Runtime run inputs must be an array.");
  return value.map((entry, index): StrategyInput => {
    const label = `Runtime run inputs[${index}]`;
    const input = plainObject(entry, label);
    if (input.type === "advance") {
      assertKeys(input, ["type"], ["destinationSpaceId"], label);
      if ("destinationSpaceId" in input && !isId(input.destinationSpaceId)) throw new Error(`${label}: invalid movement destination.`);
      return { type: "advance", ...("destinationSpaceId" in input ? { destinationSpaceId: input.destinationSpaceId as string } : {}) };
    }
    if (input.type !== "action") throw new Error(`${label}: unsupported input type.`);
    assertKeys(input, ["type", "seatId", "kind", "refId"], input.kind === "auction" ? ["bids"] : [], label);
    if (!isId(input.seatId) || !LEGAL_ACTION_KINDS.has(input.kind as LegalActionKind)) throw new Error(`${label}: invalid actor/action kind.`);
    if (input.kind === "pass" ? input.refId !== null : !isId(input.refId)) throw new Error(`${label}: invalid action refId.`);
    let bids: { seatId: string; amount: number }[] | undefined;
    if (input.kind === "auction") {
      if (!Array.isArray(input.bids)) throw new Error(`${label}: auction requires explicit bids array.`);
      bids = input.bids.map((entry, bidIndex) => {
        const bidLabel = `${label}.bids[${bidIndex}]`;
        const bid = plainObject(entry, bidLabel);
        assertKeys(bid, ["seatId", "amount"], [], bidLabel);
        if (!isId(bid.seatId) || !Number.isSafeInteger(bid.amount) || (bid.amount as number) < 0) throw new Error(`${bidLabel}: invalid bid.`);
        return { seatId: bid.seatId, amount: bid.amount as number };
      });
    }
    return { type: "action", seatId: input.seatId, kind: input.kind as LegalActionKind,
      refId: input.refId as string | null, ...(bids === undefined ? {} : { bids }) };
  });
}

function plainObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new Error(`${label} must be a plain JSON object.`);
  }
  return value as Record<string, unknown>;
}

function assertKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[], label: string): void {
  if (required.some(key => !Object.hasOwn(value, key)) || orderedKeys(value).some(key => !required.includes(key) && !optional.includes(key))) {
    throw new Error(`${label} fields must be exactly: ${required.join(", ")}${optional.length ? `; optional: ${optional.join(", ")}` : ""}.`);
  }
}

function normalizeExtensions(value: unknown): PortableRunExtensions {
  const extensions = plainObject(value, "Runtime run extensions");
  // Same namespace bounds as portable-run v3, without interpreting future keys.
  for (const key of orderedKeys(extensions)) {
    if (!key || key.length > 160 || key.includes("\u0000")) throw new Error(`Runtime run extension key "${key}" is invalid.`);
  }
  // JSON.parse retains even __proto__ as an own data property at every depth.
  return jsonClone(extensions) as PortableRunExtensions;
}

function jsonClone(value: unknown): unknown { return JSON.parse(canonicalJson(value)) as unknown; }

/** V3's canonical JSON law (sorted keys, ordered arrays, finite numbers), with
 * explicit bounds and rejection of non-JSON object properties and sparse arrays.
 * Kept local so the established v3 APIs and bytes remain untouched. */
function canonicalJson(value: unknown): string {
  let nodes = 0;
  let length = 0;
  const count = (text: string) => {
    length += text.length;
    if (length > RUNTIME_RUN_MAX_JSON_LENGTH) throw new Error("Runtime run JSON length limit exceeded.");
    return text;
  };
  const visit = (item: unknown, depth: number): string => {
    if (++nodes > RUNTIME_RUN_MAX_JSON_NODES || depth > RUNTIME_RUN_MAX_JSON_DEPTH) throw new Error("Runtime run JSON depth/node limit exceeded.");
    if (item === null || typeof item === "string" || typeof item === "boolean") return count(JSON.stringify(item));
    if (typeof item === "number" && Number.isFinite(item)) return count(JSON.stringify(item));
    if (!item || typeof item !== "object") throw new Error("Runtime run contains a value that is not JSON-compatible.");
    const array = Array.isArray(item);
    const object = array ? item : plainObject(item, "Runtime run JSON value");
    const keys = Object.keys(object);
    if (Reflect.ownKeys(object).length !== keys.length + (array ? 1 : 0) ||
      keys.some(key => {
        const property = Object.getOwnPropertyDescriptor(object, key)!;
        return !("value" in property);
      })) throw new Error("Runtime run contains non-JSON properties.");
    if (array) {
      if (keys.length !== item.length || keys.some((key, index) => key !== String(index))) throw new Error("Runtime run requires dense JSON arrays without extra fields.");
      count("[]" + ",".repeat(Math.max(0, keys.length - 1)));
      return `[${item.map(entry => visit(entry, depth + 1)).join(",")}]`;
    }
    count("{}" + ",".repeat(Math.max(0, keys.length - 1)));
    const record = object as Record<string, unknown>;
    return `{${orderedKeys(record).map(key => `${count(JSON.stringify(key) + ":")}${visit(record[key], depth + 1)}`).join(",")}}`;
  };
  return visit(value, 0);
}
