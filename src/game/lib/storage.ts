import type { Arc, Organization } from "../../engine/types.js";
import { serializeGame, deserializeGame } from "../../engine/save.js";

const KEY = "axm-arc:save:v1";

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
