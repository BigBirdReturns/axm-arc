import type { Arc } from "../../engine/types.js";
import type { DarkTombPocketSource } from "../../dark-tomb/types.js";
import { DARK_TOMB_STARTER } from "../../dark-tomb/templates.js";
import { LAMP_DISTRICT_SOURCE } from "../../dark-tomb/lamp-district.js";
import {
  compileRegisteredSourcePlane,
  sourcePlaneById,
  validateRegisteredSourcePlane,
} from "../../source-planes/index.js";
import { simulateArcRun } from "../../sim/cartridge-conformance.js";
import { storageWriteFailure, type StorageWriteResult } from "./storage-result.js";

const DRAFT_KEY = "axm-arc:dark-tomb-forge-draft:v1";

export type DarkTombCompileResult =
  | { ok: true; source: DarkTombPocketSource; arc: Arc }
  | { ok: false; errors: string[] };

export type EditableDarkTombResult =
  | { ok: true; source: DarkTombPocketSource }
  | { ok: false; message: string };

export interface DarkTombPlaytestResult {
  seeds: number[];
  cleared: number;
  failed: number;
  maxCycles: number;
  worstCycles: number;
  gateViolations: number;
  warnings: string[];
}

function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false; errors: string[] } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    return { ok: false, errors: [`JSON parse error: ${(error as Error).message}`] };
  }
}

export function darkTombStarterJson(): string {
  return pretty(structuredClone(DARK_TOMB_STARTER));
}

export function lampDistrictJson(): string {
  return pretty(structuredClone(LAMP_DISTRICT_SOURCE));
}

export function loadDarkTombDraft(storage: Storage = localStorage): string | null {
  try {
    return storage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
}

export function saveDarkTombDraft(text: string, storage: Storage = localStorage): StorageWriteResult {
  try {
    storage.setItem(DRAFT_KEY, text);
    return { ok: true };
  } catch (error) {
    return storageWriteFailure(error, "Saving the Dark Tomb source");
  }
}

export function clearDarkTombDraft(storage: Storage = localStorage): StorageWriteResult {
  try {
    storage.removeItem(DRAFT_KEY);
    return { ok: true };
  } catch (error) {
    return storageWriteFailure(error, "Clearing the Dark Tomb source");
  }
}

export function parseEditableDarkTombSource(text: string): EditableDarkTombResult {
  const parsed = parseJson(text);
  if (!parsed.ok) return { ok: false, message: parsed.errors.join("\n") };
  const validated = validateRegisteredSourcePlane(parsed.value);
  if (!validated.ok) return { ok: false, message: validated.errors.join("\n") };
  const definition = sourcePlaneById("dark-tomb-pocket");
  if (!definition || definition.format !== (parsed.value as { format?: unknown }).format) {
    return { ok: false, message: "The current source is not a registered Dark Tomb pocket." };
  }
  return { ok: true, source: validated.source as DarkTombPocketSource };
}

export function updateEditableDarkTombSource(
  text: string,
  mutate: (source: DarkTombPocketSource) => void,
): { ok: true; text: string; source: DarkTombPocketSource } | { ok: false; message: string } {
  const current = parseEditableDarkTombSource(text);
  if (!current.ok) return current;
  const source = structuredClone(current.source);
  mutate(source);
  return { ok: true, source, text: pretty(source) };
}

export function compileDarkTombJson(text: string): DarkTombCompileResult {
  const parsed = parseJson(text);
  if (!parsed.ok) return parsed;
  const compiled = compileRegisteredSourcePlane(parsed.value);
  if (!compiled.ok) return compiled;
  if (compiled.definition.id !== "dark-tomb-pocket") {
    return { ok: false, errors: [`Expected dark-tomb-pocket, received ${compiled.definition.id}.`] };
  }
  return {
    ok: true,
    source: compiled.source as DarkTombPocketSource,
    arc: compiled.arc,
  };
}

export function playtestDarkTombArc(
  arc: Arc,
  seeds: number[] = [101, 211, 307, 419, 523, 631, 743, 857],
  maxCycles = 100,
): DarkTombPlaytestResult {
  const warnings = new Set<string>();
  let cleared = 0;
  let failed = 0;
  let worstCycles = 0;
  let gateViolations = 0;
  for (const seed of seeds) {
    const result = simulateArcRun(arc, { seed, maxCycles });
    if (result.outcome === "cleared") cleared++;
    else failed++;
    worstCycles = Math.max(worstCycles, result.cyclesPlayed);
    gateViolations += result.gateViolations;
    result.warnings.forEach((warning) => warnings.add(warning));
    if (result.stallReason) warnings.add(`seed ${seed}: ${result.stallReason}`);
  }
  return {
    seeds: [...seeds],
    cleared,
    failed,
    maxCycles,
    worstCycles,
    gateViolations,
    warnings: [...warnings],
  };
}
