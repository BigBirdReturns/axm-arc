import type { Arc, Organization } from "../../engine/types.js";
import type { PendingRewardChoice } from "../../engine/cycle.js";
import { serializeGame, deserializeGame } from "../../engine/save.js";
import { cartridgeDigest } from "../../engine/cartridge-digest.js";

const KEY_PREFIX = "axm-arc:save:v2:";

function keyFor(arc: Arc): string {
  return `${KEY_PREFIX}${cartridgeDigest(arc)}`;
}

export function loadSave(arc: Arc): { org: Organization; cycle: number; pendingRewardChoices: PendingRewardChoice[] } | null {
  try {
    const raw = localStorage.getItem(keyFor(arc));
    if (!raw) return null;
    return deserializeGame(raw, arc);
  } catch (e) {
    console.warn("loadSave failed", e);
    return null;
  }
}

export function saveSave(org: Organization, arc: Arc, pendingRewardChoices: PendingRewardChoice[] = []): void {
  try {
    localStorage.setItem(keyFor(arc), serializeGame(org, arc, pendingRewardChoices));
  } catch (e) {
    console.warn("saveSave failed", e);
  }
}

export function clearSave(arc: Arc): void {
  try {
    localStorage.removeItem(keyFor(arc));
  } catch {
    /* noop */
  }
}
