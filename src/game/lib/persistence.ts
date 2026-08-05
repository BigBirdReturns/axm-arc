// Shared persistence contract for load-bearing browser writes. The storage
// adapter is deliberately tiny so the same result model works in browsers,
// headless tests, and future holder-owned storage implementations.

export type SaveFailureReason =
  | "quota"
  | "unavailable"
  | "serialization"
  | "verification"
  | "rollback"
  | "unknown";

export type SaveResult =
  | { ok: true; bytes: number }
  | {
      ok: false;
      reason: SaveFailureReason;
      message: string;
      bytes?: number;
      recoverable: boolean;
      rollbackVerified?: boolean;
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

export function serializationFailure(operation: string): SaveResult {
  return {
    ok: false,
    reason: "serialization",
    message: `${operation} could not be serialized.`,
    recoverable: false,
  };
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function failureReason(error: unknown): Exclude<SaveFailureReason, "serialization" | "verification" | "rollback"> {
  const candidate = error as { name?: unknown; code?: unknown } | null;
  const name = typeof candidate?.name === "string" ? candidate.name : "";
  const code = typeof candidate?.code === "number" ? candidate.code : null;

  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || code === 22 || code === 1014) {
    return "quota";
  }
  if (name === "SecurityError" || name === "InvalidStateError" || name === "NotSupportedError" || name === "NotAllowedError") {
    return "unavailable";
  }
  return "unknown";
}

function messageFor(reason: SaveFailureReason, operation: string, error?: unknown): string {
  const detail = error instanceof Error && error.message ? ` ${error.message}` : "";
  switch (reason) {
    case "quota": return `${operation} failed because local storage is full.${detail}`;
    case "unavailable": return `${operation} failed because local storage is unavailable or denied.${detail}`;
    case "serialization": return `${operation} could not be serialized.${detail}`;
    case "verification": return `${operation} could not be read back exactly after writing.${detail}`;
    case "rollback": return `${operation} failed and the previous value could not be verified after rollback.${detail}`;
    default: return `${operation} failed.${detail}`;
  }
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
 * read back byte-for-byte. A failed promotion attempts to restore and verify the
 * exact previous value. The caller retains the prepared payload for recovery
 * export regardless of browser storage health.
 */
export function writeStorageTransaction(
  key: string,
  payload: string,
  storage?: StorageWriter | null,
  operation = "Saving state",
): SaveResult {
  const bytes = utf8Bytes(payload);
  const target = storage === undefined ? ambientStorage() : storage;
  if (!target) {
    return {
      ok: false,
      reason: "unavailable",
      message: messageFor("unavailable", operation),
      bytes,
      recoverable: true,
    };
  }

  const temporaryKey = `${key}:tmp`;
  let previousValue: string | null = null;
  let capturedPreviousValue = false;
  let promotionAttempted = false;
  try {
    target.setItem(temporaryKey, payload);
    if (target.getItem(temporaryKey) !== payload) {
      const error = new Error("Temporary persistence verification failed.");
      Object.defineProperty(error, "name", { value: "VerificationError" });
      throw error;
    }

    previousValue = target.getItem(key);
    capturedPreviousValue = true;
    promotionAttempted = true;
    target.setItem(key, payload);
    if (target.getItem(key) !== payload) {
      const error = new Error("Canonical persistence verification failed.");
      Object.defineProperty(error, "name", { value: "VerificationError" });
      throw error;
    }

    try {
      target.removeItem(temporaryKey);
    } catch {
      // The canonical value has been verified. A stale temporary value is
      // harmless and will be replaced during the next transaction.
    }
    return { ok: true, bytes };
  } catch (error) {
    let rollbackVerified = !promotionAttempted;
    if (promotionAttempted && capturedPreviousValue) {
      try {
        if (previousValue === null) target.removeItem(key);
        else target.setItem(key, previousValue);
        rollbackVerified = target.getItem(key) === previousValue;
      } catch {
        rollbackVerified = false;
      }
    }
    try {
      target.removeItem(temporaryKey);
    } catch {
      // Cleanup failure must not replace the load-bearing write result.
    }

    const verificationFailure = error instanceof Error && error.name === "VerificationError";
    const baseReason = verificationFailure ? "verification" : failureReason(error);
    const reason: SaveFailureReason = rollbackVerified ? baseReason : "rollback";
    return {
      ok: false,
      reason,
      message: messageFor(reason, operation, error),
      bytes,
      recoverable: true,
      rollbackVerified,
    };
  }
}

/** Remove one load-bearing record and verify that it is gone. */
export function removeStorageTransaction(
  key: string,
  storage?: StorageWriter | null,
  operation = "Clearing state",
): SaveResult {
  const target = storage === undefined ? ambientStorage() : storage;
  if (!target) {
    return {
      ok: false,
      reason: "unavailable",
      message: messageFor("unavailable", operation),
      recoverable: false,
    };
  }
  const previous = target.getItem(key);
  try {
    target.removeItem(key);
    if (target.getItem(key) !== null) {
      return {
        ok: false,
        reason: "verification",
        message: messageFor("verification", operation),
        recoverable: previous !== null,
        rollbackVerified: false,
      };
    }
    return { ok: true, bytes: 0 };
  } catch (error) {
    return {
      ok: false,
      reason: failureReason(error),
      message: messageFor(failureReason(error), operation, error),
      recoverable: previous !== null,
    };
  }
}
