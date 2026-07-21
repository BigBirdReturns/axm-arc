import type { Arc, Organization } from "../../engine/types.js";
import type { PendingRewardChoice } from "../../engine/cycle.js";
import { serializeGame, deserializeGame } from "../../engine/save.js";
import { cartridgeDigest } from "../../engine/cartridge-digest.js";
import {
  normalizePortableRunExtensions,
  type PortableRunExtensions,
} from "../../engine/portable-run.js";

const KEY_PREFIX = "axm-arc:save:v2:";
const LOCAL_RUN_VERSION = 1;

interface LocalRunEnvelopeV1 {
  localRunVersion: typeof LOCAL_RUN_VERSION;
  game: string;
  /** Unknown runtime namespaces are holder-owned memory. Keep them atomically
   * beside the exact engine save even when this client does not render them. */
  extensions: PortableRunExtensions;
}

export type StorageFailureReason = "quota" | "denied" | "unknown";
export type StorageWriteResult =
  | { ok: true }
  | { ok: false; reason: StorageFailureReason; message: string };

export interface LoadedSave {
  org: Organization;
  cycle: number;
  pendingRewardChoices: PendingRewardChoice[];
  extensions: PortableRunExtensions;
}

function keyFor(arc: Arc): string {
  return `${KEY_PREFIX}${cartridgeDigest(arc)}`;
}

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

export function loadSave(arc: Arc): LoadedSave | null {
  try {
    const raw = localStorage.getItem(keyFor(arc));
    if (!raw) return null;

    // New local envelope: exact engine save + losslessly preserved runtime
    // extensions in one atomic localStorage write.
    const parsed = JSON.parse(raw) as unknown;
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
  } catch (e) {
    console.warn("loadSave failed", e);
    return null;
  }
}

export function saveSave(
  org: Organization,
  arc: Arc,
  pendingRewardChoices: PendingRewardChoice[] = [],
  extensions: PortableRunExtensions = {},
): StorageWriteResult {
  try {
    const envelope: LocalRunEnvelopeV1 = {
      localRunVersion: LOCAL_RUN_VERSION,
      game: serializeGame(org, arc, pendingRewardChoices),
      extensions: normalizePortableRunExtensions(extensions),
    };
    localStorage.setItem(keyFor(arc), JSON.stringify(envelope));
    return { ok: true };
  } catch (e) {
    const failure = storageWriteFailure(e, "Saving the run");
    console.warn("saveSave failed", e);
    return failure;
  }
}

export function clearSave(arc: Arc): StorageWriteResult {
  try {
    localStorage.removeItem(keyFor(arc));
    return { ok: true };
  } catch (e) {
    const failure = storageWriteFailure(e, "Clearing the run");
    console.warn("clearSave failed", e);
    return failure;
  }
}
