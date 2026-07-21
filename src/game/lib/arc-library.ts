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
import { cartridgeDigest } from "../../engine/cartridge-digest.js";
import { storageWriteFailure, type StorageWriteResult } from "./storage.js";

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

export interface ActiveArcSelection {
  version: 2;
  id: string;
  digest: string;
}

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

export function saveArcLibrary(entries: ArcLibraryEntry[]): StorageWriteResult {
  try {
    const file: LibraryFile = { version: 1, entries };
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(file));
    return { ok: true };
  } catch (e) {
    console.warn("saveArcLibrary failed", e);
    return storageWriteFailure(e, "Saving the cartridge library");
  }
}

// Idempotently install this exact bundled revision. A new application build
// never mutates a holder's previously installed cartridge bytes in place: a
// changed digest is another revision that can coexist with the old one. This is
// the library half of exact save identity — updates are additions, not relabels.
export function ensureBundledArc(arc: Arc): ArcLibraryEntry[] {
  const entries = loadArcLibrary();
  const digest = cartridgeDigest(arc);
  const alreadyInstalled = entries.some(
    (entry) => entry.source === "bundled" && cartridgeDigest(entry.arc) === digest,
  );
  if (!alreadyInstalled) {
    entries.push({
      arc,
      trust: "bundled",
      importedAt: Date.now(),
      source: "bundled",
    });
    saveArcLibrary(entries);
  }
  return entries;
}

// validateArc throws "Invalid arc:\n[path] msg\n[path] msg" — split into
// renderable per-path lines.
function schemaErrorLines(e: unknown): string[] {
  const msg = (e as Error).message;
  const lines = msg.split("\n").slice(1).filter((s) => s.length > 0);
  return lines.length > 0 ? lines : [msg];
}

// Parse + validate a JSON string against the arc schema, without touching the
// library. This is the validate-only half of importArcFromJson, factored out
// so the workshop's "Validate" button (no save) and the library's
// "Validate & Save" button share one validation path instead of two.
export function validateArcJson(
  json: string,
): { ok: true; arc: Arc } | { ok: false; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { ok: false, errors: [`JSON parse error: ${(e as Error).message}`] };
  }
  try {
    return { ok: true, arc: validateArc(parsed) };
  } catch (e) {
    return { ok: false, errors: schemaErrorLines(e) };
  }
}

// Validate a JSON string and (on success) add it to the library as an
// imported, unsigned arc. Never throws — validation errors come back as
// strings so callers can render them cleanly.
export function importArcFromJson(
  json: string,
): { ok: true; entry: ArcLibraryEntry } | { ok: false; errors: string[] } {
  const validated = validateArcJson(json);
  if (!validated.ok) return validated;
  const arc = validated.arc;
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
  const write = saveArcLibrary(filtered);
  if (!write.ok) return { ok: false, errors: [write.message] };
  return { ok: true, entry };
}

// Import preflight: an honest custody report computed BEFORE anything
// persists. It reuses validateArcJson verbatim — no second validator — and
// never mutates the library entries it reads. It reports what the write WILL
// do (importArcFromJson's replace-imported-same-id behavior), never a
// different fact (RFC_CARTRIDGE_LIBRARY PR 073, ruling 2: additive report;
// the one-click Validate & Save flow itself is unchanged).
export type ImportPreflight =
  | { ok: false; errors: string[] }
  | {
      ok: true;
      digest: string; // cartridgeDigest of the incoming arc
      action: "new" | "update" | "duplicate";
      existing: { digest: string; version: string; source: "bundled" | "imported" } | null;
      sameIdBundled: { digest: string; version: string } | null;
    };

export function importPreflight(json: string, entries: ArcLibraryEntry[]): ImportPreflight {
  const v = validateArcJson(json);
  if (!v.ok) return v;
  const arc = v.arc;
  const digest = cartridgeDigest(arc);

  // Independent of action: a bundled entry sharing this id is never
  // overwritten by import — surface that honestly whenever it's true.
  const sameIdBundledEntry = entries.find(
    (e) => e.arc.meta.id === arc.meta.id && e.source === "bundled",
  );
  const sameIdBundled = sameIdBundledEntry
    ? { digest: cartridgeDigest(sameIdBundledEntry.arc), version: sameIdBundledEntry.arc.meta.version }
    : null;

  // Exact duplicate: any held entry (bundled or imported) with the same
  // content digest — the write would be a byte-identical no-op re-import.
  const sameDigestEntry = entries.find((e) => cartridgeDigest(e.arc) === digest);
  if (sameDigestEntry) {
    return {
      ok: true,
      digest,
      action: "duplicate",
      existing: {
        digest: cartridgeDigest(sameDigestEntry.arc),
        version: sameDigestEntry.arc.meta.version,
        source: sameDigestEntry.source,
      },
      sameIdBundled,
    };
  }

  // Update: an IMPORTED entry shares this id with a different digest — this
  // mirrors importArcFromJson's replace-imported-same-id behavior exactly.
  const sameIdImported = entries.find(
    (e) => e.arc.meta.id === arc.meta.id && e.source === "imported",
  );
  if (sameIdImported) {
    return {
      ok: true,
      digest,
      action: "update",
      existing: {
        digest: cartridgeDigest(sameIdImported.arc),
        version: sameIdImported.arc.meta.version,
        source: sameIdImported.source,
      },
      sameIdBundled,
    };
  }

  return { ok: true, digest, action: "new", existing: null, sameIdBundled };
}

export interface ArcExportPayload {
  filename: string;
  json: string;
}

/** Deterministic export filename: `<arc-id>.arc.json`. Arc ids are already
 * slug-shaped per the schema, but slugify defensively so the name is always
 * filesystem-safe. */
export function exportFilename(arcId: string): string {
  const slug = arcId.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug.length > 0 ? slug : "arc"}.arc.json`;
}

// Serialize an arc for export. Runs the same validateArc() every importer
// (this library and world's cartridge bay) runs, so a file this produces is
// accepted downstream by construction; an arc that fails comes back as
// errors and nothing is produced. The payload is the raw Arc object only —
// trust/importedAt/source are loader-side provenance, not arc content, and
// exporting them would let a file claim its own trust level.
export function exportArcToJson(
  arc: Arc,
): { ok: true; payload: ArcExportPayload } | { ok: false; errors: string[] } {
  let validated: Arc;
  try {
    validated = validateArc(arc);
  } catch (e) {
    return { ok: false, errors: schemaErrorLines(e) };
  }
  return {
    ok: true,
    payload: {
      filename: exportFilename(validated.meta.id),
      json: JSON.stringify(validated, null, 2),
    },
  };
}

// Only removes imported entries. Bundled entries are permanent (the user
// always has the shipped arc as a floor).
export function removeArc(arcId: string): StorageWriteResult {
  const entries = loadArcLibrary();
  const next = entries.filter(
    (e) => !(e.arc.meta.id === arcId && e.source === "imported"),
  );
  return saveArcLibrary(next);
}

export function loadActiveArcSelection(): ActiveArcSelection | null {
  try {
    const raw = localStorage.getItem(ACTIVE_ARC_KEY);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as Partial<ActiveArcSelection>;
      if (value.version === 2 && typeof value.id === "string" && typeof value.digest === "string") {
        return value as ActiveArcSelection;
      }
    } catch {
      // v1 stored only an Arc id. Resolve it against the current library without
      // inventing an exact historical digest.
    }
    const entry = loadArcLibrary().find((candidate) => candidate.arc.meta.id === raw);
    return entry ? { version: 2, id: raw, digest: cartridgeDigest(entry.arc) } : null;
  } catch {
    return null;
  }
}

export function loadActiveArcId(): string | null {
  return loadActiveArcSelection()?.id ?? null;
}

export function saveActiveArc(arc: Arc): StorageWriteResult {
  try {
    const selection: ActiveArcSelection = {
      version: 2,
      id: arc.meta.id,
      digest: cartridgeDigest(arc),
    };
    localStorage.setItem(ACTIVE_ARC_KEY, JSON.stringify(selection));
    return { ok: true };
  } catch (e) {
    return storageWriteFailure(e, "Saving the active cartridge");
  }
}

/** Legacy id-only setter retained for older callers. New code should persist
 * `saveActiveArc(arc)` so same-id revisions remain exactly addressable. */
export function saveActiveArcId(id: string): StorageWriteResult {
  const entry = loadArcLibrary().find((candidate) => candidate.arc.meta.id === id);
  return entry ? saveActiveArc(entry.arc) : storageWriteFailure(new Error(`Unknown cartridge ${id}.`), "Saving the active cartridge");
}
