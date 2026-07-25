import type { Arc, Organization } from "../../engine/types.js";
import type { PendingRewardChoice } from "../../engine/cycle.js";
import { serializeGame, deserializeGame } from "../../engine/save.js";
import { cartridgeDigest } from "../../engine/cartridge-digest.js";
import { parseBoundedJson } from "../../engine/bounded-json.js";
import {
  normalizePortableRunExtensions,
  type PortableRunExtensions,
} from "../../engine/portable-run.js";
import {
  removeStorageTransaction,
  serializationFailure,
  writeStorageTransaction,
  type RecoveryArtifact,
  type SaveResult,
  type StorageWriter,
} from "./persistence.js";

const KEY_PREFIX = "axm-arc:save:v2:";
const LOCAL_RUN_VERSION = 1;

interface LocalRunEnvelopeV1 {
  localRunVersion: typeof LOCAL_RUN_VERSION;
  game: string;
  /** Unknown runtime namespaces are holder-owned memory. Keep them atomically
   * beside the exact engine save even when this client does not render them. */
  extensions: PortableRunExtensions;
}

// Compatibility surface for lower-stakes records such as creator drafts,
// cartridge-library metadata, locale, and presentation preferences. These
// callers predate the verified transaction contract and must not be confused
// with the byte-counted SaveResult returned by run and ledger custody.
export type StorageFailureReason = "quota" | "denied" | "unknown";
export type StorageWriteResult =
  | { ok: true }
  | { ok: false; reason: StorageFailureReason; message: string };
export type { StorageWriter };

export function storageWriteFailure(error: unknown, operation: string): StorageWriteResult {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : "";
  const reason: StorageFailureReason = name === "QuotaExceededError"
    ? "quota"
    : name === "SecurityError" || name === "NotAllowedError"
      ? "denied"
      : "unknown";
  const detail = error instanceof Error && error.message ? ` ${error.message}` : "";
  return { ok: false, reason, message: `${operation} failed.${detail}` };
}

export interface LoadedSave {
  org: Organization;
  cycle: number;
  pendingRewardChoices: PendingRewardChoice[];
  extensions: PortableRunExtensions;
}

function keyFor(arc: Arc): string {
  return `${KEY_PREFIX}${cartridgeDigest(arc)}`;
}

function localEnvelope(
  org: Organization,
  arc: Arc,
  pendingRewardChoices: PendingRewardChoice[],
  extensions: PortableRunExtensions,
): LocalRunEnvelopeV1 {
  return {
    localRunVersion: LOCAL_RUN_VERSION,
    game: serializeGame(org, arc, pendingRewardChoices),
    extensions: normalizePortableRunExtensions(extensions),
  };
}

function serializeLocalEnvelope(
  org: Organization,
  arc: Arc,
  pendingRewardChoices: PendingRewardChoice[],
  extensions: PortableRunExtensions,
): string {
  return JSON.stringify(localEnvelope(org, arc, pendingRewardChoices, extensions));
}

export function exportSaveRecovery(
  org: Organization,
  arc: Arc,
  pendingRewardChoices: PendingRewardChoice[] = [],
  extensions: PortableRunExtensions = {},
): RecoveryArtifact {
  const safeArcId = arc.meta.id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "arc";
  return {
    filename: `${safeArcId}-cycle-${org.cycle}.local-save.json`,
    json: serializeLocalEnvelope(org, arc, pendingRewardChoices, extensions),
  };
}

export function loadSave(arc: Arc, storage: StorageWriter = localStorage): LoadedSave | null {
  try {
    const raw = storage.getItem(keyFor(arc));
    if (!raw) return null;

    // New local envelope: exact engine save + losslessly preserved runtime
    // extensions in one atomic localStorage write. The outer envelope is bounded
    // before the embedded engine save reaches its own bounded parser.
    const parsed = parseBoundedJson(raw, { maxBytes: 16 * 1024 * 1024 });
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)
      && (parsed as Record<string, unknown>)["localRunVersion"] === LOCAL_RUN_VERSION) {
      const envelope = parsed as Partial<LocalRunEnvelopeV1>;
      if (typeof envelope.game !== "string") return null;
      const restored = deserializeGame(envelope.game, arc);
      const extensions = normalizePortableRunExtensions(envelope.extensions ?? {});
      return { ...restored, extensions };
    }

    // Backward-compatible read of the previous v2 slot, which stored the
    // engine's serialized game directly. The next successful autosave upgrades
    // it into the local envelope without changing the key or engine state.
    return { ...deserializeGame(raw, arc), extensions: {} };
  } catch (error) {
    console.warn("loadSave failed", error);
    return null;
  }
}

export function saveSave(
  org: Organization,
  arc: Arc,
  pendingRewardChoices: PendingRewardChoice[] = [],
  extensions: PortableRunExtensions = {},
  storage?: StorageWriter | null,
): SaveResult {
  let artifact: RecoveryArtifact;
  try {
    artifact = exportSaveRecovery(org, arc, pendingRewardChoices, extensions);
  } catch {
    return serializationFailure("Saving the run");
  }
  const result = writeStorageTransaction(keyFor(arc), artifact.json, storage, "Saving the run");
  if (!result.ok) console.warn("saveSave failed", result);
  return result;
}

export function clearSave(
  arc: Arc,
  storage?: StorageWriter | null,
): SaveResult {
  const result = removeStorageTransaction(keyFor(arc), storage, "Clearing the run");
  if (!result.ok) console.warn("clearSave failed", result);
  return result;
}
