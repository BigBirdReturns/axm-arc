import type { Arc, Organization } from "../../engine/types.js";
import { serializeGame, deserializeGame } from "../../engine/save.js";
import { validateArc } from "../../engine/schema.js";

const KEY = "axm-arc:save:v1";
const ARC_LIBRARY_KEY = "axm-arc:library:v1";
const SETTINGS_KEY = "axm-arc:settings:v1";

export interface ArcLibraryEntry {
  arcId: string;
  name: string;
  version: string;
  domain: string;
  challengeCount: number;
  itemCount: number;
  sourceType: "bundled" | "imported";
  trustLevel: "bundled" | "imported_unsigned";
  installedAt: string;
  payload?: string;
}

export interface UserSettings {
  reducedMotion: boolean;
  textScale: "sm" | "md" | "lg";
}

export function loadSave(arc: Arc): { org: Organization; cycle: number } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return deserializeGame(raw, arc);
  } catch (e) {
    console.warn("loadSave failed", e);
    return null;
  }
}

export function saveSave(org: Organization, arc: Arc): void {
  try {
    localStorage.setItem(KEY, serializeGame(org, arc));
  } catch (e) {
    console.warn("saveSave failed", e);
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

export function loadArcLibrary(): ArcLibraryEntry[] {
  try {
    const raw = localStorage.getItem(ARC_LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveArcLibrary(entries: ArcLibraryEntry[]): void {
  try {
    localStorage.setItem(ARC_LIBRARY_KEY, JSON.stringify(entries));
  } catch {
    /* noop */
  }
}

export function upsertBundledArc(arc: Arc): ArcLibraryEntry[] {
  const current = loadArcLibrary();
  const keep = current.filter((e) => !(e.sourceType === "bundled" && e.arcId === arc.meta.id));
  const entry: ArcLibraryEntry = {
    arcId: arc.meta.id,
    name: arc.meta.name,
    version: arc.meta.version,
    domain: arc.meta.domain,
    challengeCount: arc.challenges.length,
    itemCount: arc.items.length,
    sourceType: "bundled",
    trustLevel: "bundled",
    installedAt: new Date().toISOString(),
  };
  const next = [entry, ...keep];
  saveArcLibrary(next);
  return next;
}

export function importArcFromJson(rawJson: string): ArcLibraryEntry {
  const parsed = JSON.parse(rawJson) as unknown;
  const arc = validateArc(parsed);
  const entry: ArcLibraryEntry = {
    arcId: arc.meta.id,
    name: arc.meta.name,
    version: arc.meta.version,
    domain: arc.meta.domain,
    challengeCount: arc.challenges.length,
    itemCount: arc.items.length,
    sourceType: "imported",
    trustLevel: "imported_unsigned",
    installedAt: new Date().toISOString(),
    payload: JSON.stringify(arc),
  };
  const current = loadArcLibrary();
  const deduped = current.filter((e) => !(e.arcId === entry.arcId && e.version === entry.version));
  saveArcLibrary([entry, ...deduped]);
  return entry;
}

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { reducedMotion: false, textScale: "md" };
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      reducedMotion: parsed.reducedMotion ?? false,
      textScale: parsed.textScale ?? "md",
    };
  } catch {
    return { reducedMotion: false, textScale: "md" };
  }
}

export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* noop */
  }
}
