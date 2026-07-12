import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  writeStorageTransaction,
  type StorageWriter,
} from "../../src/game/lib/persistence.js";
import {
  exportSaveRecovery,
  saveSave,
} from "../../src/game/lib/storage.js";
import {
  exportLedger,
  saveLedger,
  commitFailedLockout,
  type CampaignLedger,
  type NightResult,
} from "../../src/game/lib/ledger.js";
import {
  commitNightFailed,
  commitNightFailedWithResult,
  newRaidNight,
} from "../../src/game/lib/raid-night.js";
import { deserializeGame } from "../../src/engine/save.js";
import { CYCLE_ARC, makeCycleAgent, makeCycleOrg } from "../fixtures/cycle-arc.js";

class MemoryStorage implements StorageWriter {
  protected readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  entries(): [string, string][] {
    return [...this.values.entries()];
  }
}

class QuotaStorage extends MemoryStorage {
  override setItem(): void {
    const error = new Error("quota exhausted");
    Object.defineProperty(error, "name", { value: "QuotaExceededError" });
    throw error;
  }
}

class CorruptOnceStorage extends MemoryStorage {
  private corrupted = false;

  override setItem(key: string, value: string): void {
    if (key === "canonical" && value === "new" && !this.corrupted) {
      this.corrupted = true;
      super.setItem(key, "corrupt");
      return;
    }
    super.setItem(key, value);
  }
}

class MutateThenThrowStorage extends MemoryStorage {
  override setItem(key: string, value: string): void {
    super.setItem(key, value);
    if (key === "canonical" && value === "new") {
      throw new Error("adapter failed after mutation");
    }
  }
}

function testOrg() {
  return makeCycleOrg([makeCycleAgent({ id: "persistence-agent" })]);
}

function failedNight(): { state: ReturnType<typeof newRaidNight>; night: NightResult } {
  const state = newRaidNight(1);
  return {
    state,
    night: {
      arc: state.arc,
      org: state.org,
      cleared: false,
      pulls: 0,
      wipes: 0,
      bestPull: null,
    },
  };
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage() as unknown as Storage;
});

describe("transactional persistence result", () => {
  it("verifies a temporary write, promotes it, and removes the temporary value", () => {
    const storage = new MemoryStorage();
    storage.setItem("canonical", "old");

    const result = writeStorageTransaction("canonical", "new", storage);

    expect(result.ok).toBe(true);
    expect(result.ok && result.bytes).toBe(3);
    expect(storage.getItem("canonical")).toBe("new");
    expect(storage.getItem("canonical:tmp")).toBeNull();
  });

  it("rolls a failed canonical verification back to the previous value", () => {
    const storage = new CorruptOnceStorage();
    storage.setItem("canonical", "old");

    const result = writeStorageTransaction("canonical", "new", storage);

    expect(result).toMatchObject({ ok: false, reason: "unknown", recoverable: true });
    expect(storage.getItem("canonical")).toBe("old");
    expect(storage.getItem("canonical:tmp")).toBeNull();
  });

  it("rolls back an adapter that mutates the canonical value and then throws", () => {
    const storage = new MutateThenThrowStorage();
    storage.setItem("canonical", "old");

    const result = writeStorageTransaction("canonical", "new", storage);

    expect(result).toMatchObject({ ok: false, reason: "unknown", recoverable: true });
    expect(storage.getItem("canonical")).toBe("old");
    expect(storage.getItem("canonical:tmp")).toBeNull();
  });

  it("classifies forced quota errors and retains the byte count for recovery", () => {
    const result = writeStorageTransaction("canonical", "recover me", new QuotaStorage());
    expect(result).toEqual({
      ok: false,
      reason: "quota",
      bytes: 10,
      recoverable: true,
    });
  });

  it("is headless-safe when no storage adapter exists", () => {
    expect(writeStorageTransaction("canonical", "recover me", null)).toEqual({
      ok: false,
      reason: "unavailable",
      bytes: 10,
      recoverable: true,
    });
  });
});

describe("load-bearing game and ledger writes", () => {
  it("returns explicit success and writes a deserializable organization save", () => {
    const storage = new MemoryStorage();
    const org = testOrg();
    const result = saveSave(org, CYCLE_ARC, storage);

    expect(result.ok).toBe(true);
    const canonical = storage.entries().find(([key]) => !key.endsWith(":tmp"));
    expect(canonical).toBeDefined();
    expect(deserializeGame(canonical![1], CYCLE_ARC).org).toEqual(org);
  });

  it("returns serialization failure without claiming recovery when no payload exists", () => {
    const org = testOrg() as ReturnType<typeof testOrg> & { self?: unknown };
    org.self = org;

    expect(saveSave(org, CYCLE_ARC, new MemoryStorage())).toEqual({
      ok: false,
      reason: "serialization",
      recoverable: false,
    });
  });

  it("returns a forced ledger-write failure while preserving the in-memory commit", () => {
    const { state } = failedNight();
    const result = commitNightFailedWithResult(state, new QuotaStorage());

    expect(result.save).toMatchObject({ ok: false, reason: "quota", recoverable: true });
    expect(result.ledger.commits).toHaveLength(1);
    expect(result.ledger.commits[0]!.type).toBe("failed-lockout");
  });

  it("keeps the legacy headless commit adapter pure instead of hiding a failed write", () => {
    globalThis.localStorage = new QuotaStorage() as unknown as Storage;
    const { state } = failedNight();

    const ledger = commitNightFailed(state);

    expect(ledger.commits).toHaveLength(1);
    expect(ledger.commits[0]!.type).toBe("failed-lockout");
  });

  it("distinguishes ledger serialization failure from storage failure", () => {
    const { night } = failedNight();
    const ledger = commitFailedLockout(null, night) as CampaignLedger & { self?: unknown };
    ledger.self = ledger;

    expect(saveLedger(ledger, new MemoryStorage())).toEqual({
      ok: false,
      reason: "serialization",
      recoverable: false,
    });
  });

  it("exports both in-memory artifacts without depending on browser storage", () => {
    const org = testOrg();
    const saveArtifact = exportSaveRecovery(org, CYCLE_ARC);
    expect(saveArtifact.filename).toContain("cycle-test-arc-cycle-");
    expect(deserializeGame(saveArtifact.json, CYCLE_ARC).org).toEqual(org);

    const { night } = failedNight();
    const ledger = commitFailedLockout(null, night);
    const ledgerArtifact = exportLedger(ledger);
    expect(JSON.parse(ledgerArtifact.json)).toEqual(ledger);
  });
});

describe("interactive custody wiring", () => {
  const app = fs.readFileSync(new URL("../../src/game/App.tsx", import.meta.url), "utf8");
  const raid = fs.readFileSync(new URL("../../src/game/components/RaidNightScreen.tsx", import.meta.url), "utf8");

  it("keeps a persistent organization-save alert with retry and recovery export", () => {
    expect(app).toContain('data-testid="save-failure"');
    expect(app).toContain("recordSaveResult(saveSave(org, arc))");
    expect(app).toContain("downloadJsonArtifact(exportSaveRecovery(org, arc))");
    expect(app).toContain('t("persistence.retry")');
  });

  it("uses the result-bearing ledger commit path and never labels a failed write committed", () => {
    expect(raid).toContain('data-testid="ledger-save-failure"');
    expect(raid).toContain("commitNightVictoryWithResult(state)");
    expect(raid).toContain("commitNightFailedWithResult(state)");
    expect(raid).toContain("commitAttempt?.save.ok ? commitAttempt.ledger : null");
    expect(raid).toContain("downloadJsonArtifact(exportLedger(commitAttempt.ledger))");
  });
});
