import type { Arc } from "../../engine/types.js";
import { foundOrganization } from "../../engine/founding.js";
import type { CommonShipPocketSourceV2 } from "../../common-ship/embodiment.js";
import { COMMON_SHIP_STARTER } from "../../common-ship/templates.js";
import { RELIEF_CIRCUIT_SOURCE } from "../../common-ship/relief-circuit.js";
import {
  compileRegisteredSourcePlane,
  sourcePlaneById,
  validateRegisteredSourcePlane,
} from "../../source-planes/index.js";
import { simulateArcRun } from "../../sim/cartridge-conformance.js";
import { storageWriteFailure, type StorageWriteResult } from "./storage.js";

const DRAFT_KEY = "axm-arc:common-ship-forge-draft:v1";

export type CommonShipCompileResult =
  | { ok: true; source: CommonShipPocketSourceV2; arc: Arc }
  | { ok: false; errors: string[] };

export interface CommonShipPlaytestResult {
  seeds: number[];
  cleared: number;
  failed: number;
  worstCycles: number;
  gateViolations: number;
  warnings: string[];
}

function pretty(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }
function parseJson(text: string): { ok: true; value: unknown } | { ok: false; errors: string[] } {
  try { return { ok: true, value: JSON.parse(text) as unknown }; }
  catch (error) { return { ok: false, errors: [`JSON parse error: ${(error as Error).message}`] }; }
}

export function commonShipStarterJson(): string { return pretty(structuredClone(COMMON_SHIP_STARTER)); }
export function reliefCircuitJson(): string { return pretty(structuredClone(RELIEF_CIRCUIT_SOURCE)); }

export function loadCommonShipDraft(storage: Storage = localStorage): string | null {
  try { return storage.getItem(DRAFT_KEY); } catch { return null; }
}
export function saveCommonShipDraft(text: string, storage: Storage = localStorage): StorageWriteResult {
  try { storage.setItem(DRAFT_KEY, text); return { ok: true }; }
  catch (error) { return storageWriteFailure(error, "Saving the Common Ship source"); }
}
export function clearCommonShipDraft(storage: Storage = localStorage): StorageWriteResult {
  try { storage.removeItem(DRAFT_KEY); return { ok: true }; }
  catch (error) { return storageWriteFailure(error, "Clearing the Common Ship source"); }
}

export function compileCommonShipJson(text: string): CommonShipCompileResult {
  const parsed = parseJson(text);
  if (!parsed.ok) return parsed;
  const validated = validateRegisteredSourcePlane(parsed.value);
  if (!validated.ok) return validated;
  const definition = sourcePlaneById("common-ship-pocket");
  if (!definition || definition.format !== (parsed.value as { format?: unknown }).format) {
    return { ok: false, errors: ["The current source is not a registered Common Ship pocket."] };
  }
  const compiled = compileRegisteredSourcePlane(parsed.value);
  if (!compiled.ok) return compiled;
  return { ok: true, source: compiled.source as CommonShipPocketSourceV2, arc: compiled.arc };
}

export function playtestCommonShipArc(
  arc: Arc,
  seeds: number[] = [101, 211, 307, 419, 523, 631, 743, 857],
  maxCycles = 120,
): CommonShipPlaytestResult {
  let cleared = 0;
  let failed = 0;
  let worstCycles = 0;
  let gateViolations = 0;
  const warnings = new Set<string>();
  for (const seed of seeds) {
    const initialOrganization = foundOrganization(arc, { format: "axm-founding-input/1", seed });
    const result = simulateArcRun(arc, { seed, maxCycles, initialOrganization });
    if (result.outcome === "cleared") cleared++; else failed++;
    worstCycles = Math.max(worstCycles, result.cyclesPlayed);
    gateViolations += result.gateViolations;
    result.warnings.forEach((warning) => warnings.add(warning));
    if (result.stallReason) warnings.add(`seed ${seed}: ${result.stallReason}`);
  }
  return { seeds: [...seeds], cleared, failed, worstCycles, gateViolations, warnings: [...warnings] };
}
