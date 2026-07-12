import type { Arc, Organization } from "../../engine/types.js";
import { serializeGame, deserializeGame } from "../../engine/save.js";
import {
  serializationFailure,
  writeStorageTransaction,
  type RecoveryArtifact,
  type SaveResult,
  type StorageWriter,
} from "./persistence.js";

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

export function exportSaveRecovery(org: Organization, arc: Arc): RecoveryArtifact {
  const safeArcId = arc.meta.id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "arc";
  return {
    filename: `${safeArcId}-cycle-${org.cycle}.save.json`,
    json: serializeGame(org, arc),
  };
}

export function saveSave(
  org: Organization,
  arc: Arc,
  storage?: StorageWriter | null,
): SaveResult {
  let artifact: RecoveryArtifact;
  try {
    artifact = exportSaveRecovery(org, arc);
  } catch {
    return serializationFailure();
  }
  return writeStorageTransaction(KEY, artifact.json, storage);
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
