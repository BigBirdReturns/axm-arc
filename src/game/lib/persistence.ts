// Shared persistence contract for load-bearing browser writes. The storage
// adapter is deliberately tiny so the same result model works in browsers,
// headless tests, and a future enterprise-backed implementation.

export type SaveFailureReason =
  | "quota"
  | "unavailable"
  | "serialization"
  | "unknown";

export type SaveResult =
  | { ok: true; bytes: number }
  | {
      ok: false;
      reason: SaveFailureReason;
      bytes?: number;
      recoverable: boolean;
    };

export interface StorageWriter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A prepared JSON artifact that remains usable when browser storage is not. */
export interface RecoveryArtifact {
  filename: string;
  json: string;
}

export const serializationFailure = (): SaveResult => ({
  ok: false,
  reason: "serialization",
  recoverable: false,
});

function utf8Bytes(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i += 1;
      } else {
        bytes += 3;
      }
    } else bytes += 3;
  }
  return bytes;
}

function failureReason(error: unknown): Exclude<SaveFailureReason, "serialization"> {
  const candidate = error as { name?: unknown; code?: unknown } | null;
  const name = typeof candidate?.name === "string" ? candidate.name : "";
  const code = typeof candidate?.code === "number" ? candidate.code : null;

  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || code === 22 || code === 1014) {
    return "quota";
  }
  if (name === "SecurityError" || name === "InvalidStateError" || name === "NotSupportedError") {
    return "unavailable";
  }
  return "unknown";
}

function ambientStorage(): StorageWriter | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Write a prepared payload through a verify-before-promote transaction.
 *
 * The previous canonical value is untouched unless the temporary write can be
 * read back byte-for-byte. A failed promotion reports the failure and leaves
 * the prepared payload available to the caller for recovery export.
 */
export function writeStorageTransaction(
  key: string,
  payload: string,
  storage?: StorageWriter | null,
): SaveResult {
  const bytes = utf8Bytes(payload);
  const target = storage === undefined ? ambientStorage() : storage;
  if (!target) {
    return { ok: false, reason: "unavailable", bytes, recoverable: true };
  }

  const temporaryKey = `${key}:tmp`;
  let previousValue: string | null = null;
  let capturedPreviousValue = false;
  let promotionAttempted = false;
  try {
    target.setItem(temporaryKey, payload);
    if (target.getItem(temporaryKey) !== payload) {
      throw new Error("Temporary persistence verification failed");
    }

    previousValue = target.getItem(key);
    capturedPreviousValue = true;
    // Mark the promotion before invoking the adapter. Browser localStorage
    // writes are atomic, but the injectable contract may be backed by another
    // synchronous store that mutates and then throws. In either case, any
    // failure after promotion starts must attempt to restore the captured
    // canonical value.
    promotionAttempted = true;
    target.setItem(key, payload);
    if (target.getItem(key) !== payload) {
      throw new Error("Canonical persistence verification failed");
    }

    try {
      target.removeItem(temporaryKey);
    } catch {
      // The canonical value was verified. A stale temporary value is harmless.
    }
    return { ok: true, bytes };
  } catch (error) {
    if (promotionAttempted && capturedPreviousValue) {
      try {
        if (previousValue === null) target.removeItem(key);
        else target.setItem(key, previousValue);
      } catch {
        // The caller still receives a failure and retains the recovery payload.
      }
    }
    try {
      target.removeItem(temporaryKey);
    } catch {
      // Cleanup failure must not replace the load-bearing write result.
    }
    return { ok: false, reason: failureReason(error), bytes, recoverable: true };
  }
}
