// Arc library: versioned localStorage store of arcs available to the engine.
//
// This is the storage layer that turns axm-arc from a one-arc game into a
// runtime that can load arcs other people supply. It is intentionally
// arc-agnostic — nothing in here references first-charter or any specific
// content. The bundled arc is just whatever the caller hands to
// ensureBundledArc().
//
// Trust is provenance of *how* the arc was loaded into this library, not
// content of the arc itself. A JSON file does not know whether it is
// "verified" — the loading system does. So TrustLabel lives on
// ArcLibraryEntry, never on ArcMeta.

import type { Arc, TrustLabel } from "../../engine/types.js";
import { validateArc } from "../../engine/schema.js";

export type { TrustLabel };

export interface ArcLibraryEntry {
  arc: Arc;
  trust: TrustLabel;
  importedAt: number;
  source: "bundled" | "imported";
}

interface LibraryFile {
  version: 1;
  entries: ArcLibraryEntry[];
}

const LIBRARY_KEY = "axm-arc:library:v1";
const ACTIVE_ARC_KEY = "axm-arc:active-arc:v1";

export function loadArcLibrary(): ArcLibraryEntry[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LibraryFile;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) return [];
    return parsed.entries;
  } catch (e) {
    console.warn("loadArcLibrary failed", e);
    return [];
  }
}

export function saveArcLibrary(entries: ArcLibraryEntry[]): void {
  try {
    const file: LibraryFile = { version: 1, entries };
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(file));
  } catch (e) {
    console.warn("saveArcLibrary failed", e);
  }
}

// Idempotently ensure the bundled arc is in the library. The bundled arc is
// always trust="bundled" and source="bundled". If an entry with the same id
// already exists with source="bundled", we refresh the arc payload (so
// engine/content updates ship to returning users) but preserve importedAt.
export function ensureBundledArc(arc: Arc): ArcLibraryEntry[] {
  const entries = loadArcLibrary();
  const existingIdx = entries.findIndex(
    (e) => e.arc.meta.id === arc.meta.id && e.source === "bundled",
  );
  if (existingIdx >= 0) {
    const existing = entries[existingIdx]!;
    entries[existingIdx] = { ...existing, arc, trust: "bundled" };
  } else {
    entries.push({
      arc,
      trust: "bundled",
      importedAt: Date.now(),
      source: "bundled",
    });
  }
  saveArcLibrary(entries);
  return entries;
}

// Validate a JSON string and (on success) add it to the library as an
// imported, unsigned arc. Never throws — validation errors come back as
// strings so callers can render them cleanly.
export function importArcFromJson(
  json: string,
): { ok: true; entry: ArcLibraryEntry } | { ok: false; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { ok: false, errors: [`JSON parse error: ${(e as Error).message}`] };
  }
  let arc: Arc;
  try {
    arc = validateArc(parsed);
  } catch (e) {
    const msg = (e as Error).message;
    // validateArc throws "Invalid arc:\n[path] msg\n[path] msg" — split it.
    const lines = msg.split("\n").slice(1).filter((s) => s.length > 0);
    return { ok: false, errors: lines.length > 0 ? lines : [msg] };
  }
  const entries = loadArcLibrary();
  // Replace any existing imported entry with the same id (re-import updates).
  // Never overwrite a bundled entry.
  const filtered = entries.filter(
    (e) => !(e.arc.meta.id === arc.meta.id && e.source === "imported"),
  );
  const entry: ArcLibraryEntry = {
    arc,
    trust: "imported-unsigned",
    importedAt: Date.now(),
    source: "imported",
  };
  filtered.push(entry);
  saveArcLibrary(filtered);
  return { ok: true, entry };
}

// Only removes imported entries. Bundled entries are permanent (the user
// always has the shipped arc as a floor).
export function removeArc(arcId: string): void {
  const entries = loadArcLibrary();
  const next = entries.filter(
    (e) => !(e.arc.meta.id === arcId && e.source === "imported"),
  );
  saveArcLibrary(next);
}

export function loadActiveArcId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ARC_KEY);
  } catch {
    return null;
  }
}

export function saveActiveArcId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_ARC_KEY, id);
  } catch {
    /* noop */
  }
}
