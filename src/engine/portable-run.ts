// Portable run envelope — exact, content-bound custody for a changed cartridge.
//
// A raw Arc proves authored-content portability. A localStorage save proves that
// one client can resume. This envelope joins the two without making either
// client the authority: the Arc travels with the engine's exact serialized game,
// every byte is bound to the Arc's computed identity, and clients may carry
// namespaced JSON extensions without the engine knowing their presentation
// vocabulary.
//
// The engine owns only the common custody contract. Rodoh, the hub, and future
// compatible players own their extension payloads (ledger, current view,
// checkpoints, accessibility preferences, and so on). Unknown extensions are
// deliberately preserved by parsePortableRun so a player never has to destroy
// another runtime's memory merely to continue the shared run.

import type { PendingRewardChoice } from "./cycle.js";
import {
  cartridgeDigest,
  sha256Hex,
} from "./cartridge-digest.js";
import { orderedKeys } from "./determinism.js";
import { deserializeGame, SAVE_VERSION, serializeGame } from "./save.js";
import { validateArc } from "./schema.js";
import type { Arc, Organization } from "./types.js";

export const PORTABLE_RUN_FORMAT = "axm-cartridge-run/v3" as const;
export const PORTABLE_RUN_INTEGRITY_ALGORITHM = "sha256" as const;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type PortableRunExtensions = Record<string, JsonValue>;

export interface PortableRunV3 {
  format: typeof PORTABLE_RUN_FORMAT;
  /** Computed identity of `arc`; never trusted as a file-authored claim. */
  authoredArcDigest: string;
  /** Canonical, validated authored law required to execute the save. */
  arc: Arc;
  engine: {
    /** Declared for fast compatibility diagnostics; must equal game.version. */
    saveVersion: number;
    /** Exact output of serializeGame, including pending engine-owned choices. */
    game: string;
  };
  /** Namespaced, JSON-only, losslessly preserved client memory. */
  extensions: PortableRunExtensions;
  integrity: {
    algorithm: typeof PORTABLE_RUN_INTEGRITY_ALGORITHM;
    /** SHA-256 over the canonical envelope excluding this integrity block. */
    digest: string;
  };
}

export interface RestoredPortableRunV3 {
  run: PortableRunV3;
  arc: Arc;
  authoredArcDigest: string;
  org: Organization;
  cycle: number;
  pendingRewardChoices: PendingRewardChoice[];
  extensions: PortableRunExtensions;
}

export interface BuildPortableRunParams {
  arc: Arc;
  org: Organization;
  pendingRewardChoices?: PendingRewardChoice[];
  extensions?: PortableRunExtensions;
}

interface PortableRunCore {
  format: typeof PORTABLE_RUN_FORMAT;
  authoredArcDigest: string;
  arc: Arc;
  engine: PortableRunV3["engine"];
  extensions: PortableRunExtensions;
}

/** Build one exact, self-contained run envelope. The returned value contains no
 * trust label or publisher claim: a receiving runtime assigns provenance after
 * validating the included Arc and save. */
export function buildPortableRun(params: BuildPortableRunParams): PortableRunV3 {
  const arc = validateArc(params.arc);
  const authoredArcDigest = cartridgeDigest(arc);
  const extensions = normalizeExtensions(params.extensions ?? {});
  const game = serializeGame(params.org, arc, params.pendingRewardChoices ?? []);
  const core: PortableRunCore = {
    format: PORTABLE_RUN_FORMAT,
    authoredArcDigest,
    arc,
    engine: { saveVersion: SAVE_VERSION, game },
    extensions,
  };
  return {
    ...core,
    integrity: {
      algorithm: PORTABLE_RUN_INTEGRITY_ALGORITHM,
      digest: portableRunPayloadDigest(core),
    },
  };
}

/** Parse, authenticate, validate, and restore a portable run. Throws with a
 * precise boundary error and never returns partially trusted state. */
export function parsePortableRun(input: unknown): RestoredPortableRunV3 {
  const raw = parseInput(input);
  assertExactKeys(raw, ["format", "authoredArcDigest", "arc", "engine", "extensions", "integrity"], "portable run");

  if (raw["format"] !== PORTABLE_RUN_FORMAT) {
    throw new Error(`Unsupported portable run format "${String(raw["format"])}".`);
  }
  if (typeof raw["authoredArcDigest"] !== "string") {
    throw new Error("Portable run is missing authoredArcDigest.");
  }

  const rawEngine = plainObject(raw["engine"], "Portable run engine");
  assertExactKeys(rawEngine, ["saveVersion", "game"], "portable run engine");
  if (!Number.isSafeInteger(rawEngine["saveVersion"]) || (rawEngine["saveVersion"] as number) < 1) {
    throw new Error("Portable run engine.saveVersion must be a positive integer.");
  }
  if (typeof rawEngine["game"] !== "string") {
    throw new Error("Portable run engine.game must be a serialized game string.");
  }

  const rawExtensions = plainObject(raw["extensions"], "Portable run extensions");
  const extensions = normalizeExtensions(rawExtensions);

  const rawIntegrity = plainObject(raw["integrity"], "Portable run integrity");
  assertExactKeys(rawIntegrity, ["algorithm", "digest"], "portable run integrity");
  if (rawIntegrity["algorithm"] !== PORTABLE_RUN_INTEGRITY_ALGORITHM) {
    throw new Error(`Unsupported portable run integrity algorithm "${String(rawIntegrity["algorithm"])}".`);
  }
  if (typeof rawIntegrity["digest"] !== "string" || !/^run3_[0-9a-f]{64}$/.test(rawIntegrity["digest"])) {
    throw new Error("Portable run integrity.digest is not a run3 SHA-256 digest.");
  }

  // Verify the exact file payload before schema transforms or execution.
  const rawCore = {
    format: PORTABLE_RUN_FORMAT,
    authoredArcDigest: raw["authoredArcDigest"],
    arc: raw["arc"],
    engine: {
      saveVersion: rawEngine["saveVersion"],
      game: rawEngine["game"],
    },
    extensions,
  };
  const actualIntegrity = portableRunPayloadDigest(rawCore);
  if (rawIntegrity["digest"] !== actualIntegrity) {
    throw new Error(
      `Portable run integrity mismatch: file has "${rawIntegrity["digest"]}", computed "${actualIntegrity}".`,
    );
  }

  const arc = validateArc(raw["arc"]);
  // V3 carries the canonical validated Arc shape. Refusing schema shorthand or
  // stripped/extra fields here keeps re-export lossless and prevents validation
  // from silently changing the object whose integrity was just checked.
  if (canonicalizeJson(raw["arc"]) !== canonicalizeJson(arc)) {
    throw new Error("Portable run arc is valid but not in canonical validated form.");
  }
  const actualArcDigest = cartridgeDigest(arc);
  if (raw["authoredArcDigest"] !== actualArcDigest) {
    throw new Error(
      `Portable run cartridge digest mismatch: file has "${raw["authoredArcDigest"]}", computed "${actualArcDigest}".`,
    );
  }

  const gameVersion = serializedGameVersion(rawEngine["game"] as string);
  if (rawEngine["saveVersion"] !== gameVersion) {
    throw new Error(
      `Portable run save-version mismatch: envelope says ${String(rawEngine["saveVersion"])}, game says ${gameVersion}.`,
    );
  }

  const restored = deserializeGame(rawEngine["game"] as string, arc);
  const run: PortableRunV3 = {
    format: PORTABLE_RUN_FORMAT,
    authoredArcDigest: actualArcDigest,
    arc,
    engine: {
      saveVersion: rawEngine["saveVersion"] as number,
      game: rawEngine["game"] as string,
    },
    extensions,
    integrity: {
      algorithm: PORTABLE_RUN_INTEGRITY_ALGORITHM,
      digest: actualIntegrity,
    },
  };
  return {
    run,
    arc,
    authoredArcDigest: actualArcDigest,
    org: restored.org,
    cycle: restored.cycle,
    pendingRewardChoices: restored.pendingRewardChoices,
    extensions,
  };
}

/** Content digest for the portable envelope excluding its integrity block.
 * Exported so independent compatible players can run the same conformance
 * vectors without importing UI or storage code. */
export function portableRunPayloadDigest(core: unknown): string {
  return "run3_" + sha256Hex(canonicalizeJson(core));
}

/** Lightweight discriminator for an import door that also accepts raw Arcs. It
 * deliberately does not imply validity; callers must still call parsePortableRun. */

/** Validate and defensively clone a JSON extension bag. Runtime players use
 * this for local sidecars so unknown namespaces survive load/save/export even
 * when the player does not understand them. */
export function normalizePortableRunExtensions(input: unknown): PortableRunExtensions {
  return normalizeExtensions(plainObject(input, "Portable run extensions"));
}

export function isPortableRunV3(input: unknown): boolean {
  try {
    const value = typeof input === "string" ? JSON.parse(input) as unknown : input;
    return !!value && typeof value === "object" && !Array.isArray(value)
      && (value as Record<string, unknown>)["format"] === PORTABLE_RUN_FORMAT;
  } catch {
    return false;
  }
}

function parseInput(input: unknown): Record<string, unknown> {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      throw new Error("Portable run is not valid JSON.");
    }
  }
  return plainObject(value, "Portable run");
}

function serializedGameVersion(game: string): number {
  let raw: unknown;
  try {
    raw = JSON.parse(game) as unknown;
  } catch {
    throw new Error("Portable run engine.game is not valid JSON.");
  }
  const object = plainObject(raw, "Portable run serialized game");
  if (!Number.isSafeInteger(object["version"])) {
    throw new Error("Portable run serialized game is missing a numeric version.");
  }
  return object["version"] as number;
}

function plainObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must be a plain JSON object.`);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = orderedKeys(value);
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} fields must be exactly: ${wanted.join(", ")}.`);
  }
}

function normalizeExtensions(value: Record<string, unknown>): PortableRunExtensions {
  const out: PortableRunExtensions = {};
  for (const key of orderedKeys(value)) {
    if (!key || key.length > 160 || key.includes("\u0000")) {
      throw new Error(`Portable run extension key "${key}" is invalid.`);
    }
    out[key] = cloneJsonValue(value[key], `extensions.${key}`);
  }
  return out;
}

function cloneJsonValue(value: unknown, path: string): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Portable run ${path} contains a non-finite number.`);
    return value;
  }
  if (Array.isArray(value)) return value.map((entry, index) => cloneJsonValue(entry, `${path}[${index}]`));
  if (value && typeof value === "object") {
    const object = plainObject(value, `Portable run ${path}`);
    const out: Record<string, JsonValue> = {};
    for (const key of orderedKeys(object)) out[key] = cloneJsonValue(object[key], `${path}.${key}`);
    return out;
  }
  throw new Error(`Portable run ${path} is not JSON-compatible.`);
}

function canonicalizeJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot canonicalize a non-finite number.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalizeJson(entry)).join(",")}]`;
  if (value && typeof value === "object") {
    const object = plainObject(value, "Canonical JSON value");
    return `{${orderedKeys(object)
      .map((key) => `${JSON.stringify(key)}:${canonicalizeJson(object[key])}`)
      .join(",")}}`;
  }
  throw new Error(`Cannot canonicalize a value of type ${typeof value}.`);
}
