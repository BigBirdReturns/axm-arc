import { sha256Hex } from "../engine/cartridge-digest.js";
import { orderedKeys } from "../engine/determinism.js";
import type { ContinuityJson } from "./types.js";

export function canonicalContinuityJson(value: ContinuityJson): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Continuity JSON forbids non-finite numbers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((entry) => canonicalContinuityJson(entry)).join(",") + "]";
  }
  const parts: string[] = [];
  for (const key of orderedKeys(value)) {
    parts.push(JSON.stringify(key) + ":" + canonicalContinuityJson(value[key]!));
  }
  return "{" + parts.join(",") + "}";
}

export function continuityDigest(prefix: string, value: ContinuityJson): string {
  if (!/^[a-z][a-z0-9-]*1_$/.test(prefix)) throw new Error(`Invalid continuity digest prefix "${prefix}".`);
  return prefix + sha256Hex(canonicalContinuityJson(value));
}
