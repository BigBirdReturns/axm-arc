import type { Arc } from "../../engine/types.js";
import { cartridgeDigest } from "../../engine/cartridge-digest.js";
import { foundOrganization } from "../../engine/founding.js";
import { aggregateRuns, simulateArcRun, type ArcAggregate } from "../../sim/cartridge-conformance.js";
import {
  compileGodscarPocket,
  newGodscarPocketSkeleton,
  validateGodscarPocket,
  type GodscarPocketSource,
} from "../../godscar/index.js";
import { storageWriteFailure, type StorageWriteResult } from "./storage.js";

const GODSCAR_DRAFT_KEY = "axm-arc:godscar-forge-draft:v1";

export interface GodscarForgeSummary {
  title: string;
  canonTier: string;
  canonRelation: string;
  controlQuestion: string;
  pressures: Array<{ kind: string; label: string }>;
  castCount: number;
  factionCount: number;
  consequenceCount: number;
  beatCount: number;
}

export type GodscarCompileResult =
  | { ok: true; source: GodscarPocketSource; arc: Arc; digest: string; summary: GodscarForgeSummary }
  | { ok: false; errors: string[] };

function storageOrDefault(storage?: Storage): Storage {
  if (storage) return storage;
  return localStorage;
}

export function loadGodscarDraft(storage?: Storage): string | null {
  try { return storageOrDefault(storage).getItem(GODSCAR_DRAFT_KEY); }
  catch { return null; }
}

export function saveGodscarDraft(text: string, storage?: Storage): StorageWriteResult {
  try {
    storageOrDefault(storage).setItem(GODSCAR_DRAFT_KEY, text);
    return { ok: true };
  } catch (error) {
    return storageWriteFailure(error, "Saving the Godscar pocket draft");
  }
}

export function godscarSkeletonJson(): string {
  return JSON.stringify(newGodscarPocketSkeleton(), null, 2);
}

export function summarizeGodscarPocket(source: GodscarPocketSource): GodscarForgeSummary {
  return {
    title: source.identity.title,
    canonTier: source.evidence.tier,
    canonRelation: source.identity.canonRelation,
    controlQuestion: source.controlQuestion,
    pressures: source.pressures.map(({ kind, label }) => ({ kind, label })),
    castCount: source.cast.length,
    factionCount: source.factionReceipts.length,
    consequenceCount: source.consequences.length,
    beatCount: source.beats.length,
  };
}

export function compileGodscarJson(text: string): GodscarCompileResult {
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch (error) { return { ok: false, errors: [`JSON parse error: ${(error as Error).message}`] }; }
  const validated = validateGodscarPocket(parsed);
  if (!validated.ok) return validated;
  try {
    const arc = compileGodscarPocket(validated.source);
    return {
      ok: true,
      source: validated.source,
      arc,
      digest: cartridgeDigest(arc),
      summary: summarizeGodscarPocket(validated.source),
    };
  } catch (error) {
    return { ok: false, errors: [(error as Error).message] };
  }
}

export function playtestGodscarArc(arc: Arc, seeds = 8, maxCycles = 50): ArcAggregate {
  const runs = Array.from({ length: seeds }, (_, index) => {
    const seed = index + 1;
    return simulateArcRun(arc, {
      seed,
      maxCycles,
      initialOrganization: foundOrganization(arc, { format: "axm-founding-input/1", seed }),
    });
  });
  return aggregateRuns(arc, runs, maxCycles);
}
