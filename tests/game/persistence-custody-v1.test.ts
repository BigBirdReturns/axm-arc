import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  removeStorageTransaction,
  writeStorageTransaction,
  type StorageWriter,
} from "../../src/game/lib/persistence.js";
import {
  exportSaveRecovery,
  loadSave,
  saveSave,
} from "../../src/game/lib/storage.js";
import {
  exportLedger,
  loadLedger,
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

class RefuseRemoveStorage extends MemoryStorage {
  override removeItem(key: string): void {
    if (key === "canonical") return;
    super.removeItem(key);
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
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: new MemoryStorage(),
  });
});

describe("transactional persistence law", () => {
  it("verifies temporary and canonical writes and removes the temporary value", () => {
    const storage = new MemoryStorage();
    storage.setItem("canonical", "old");

    const result = writeStorageTransaction("canonical", "new", storage, "Test write");

    expect(result).toEqual({ ok: true, bytes: 3 });
    expect(storage.getItem("canonical")).toBe("new");
    expect(storage.getItem("canonical:tmp")).toBeNull();
  });

  it("restores and verifies the previous canonical value after a failed promotion", () => {
    const storage = new CorruptOnceStorage();
    storage.setItem("canonical", "old");

    const result = writeStorageTransaction("canonical", "new", storage, "Test write");

    expect(result).toMatchObject({ ok: false, reason: "verification", recoverable: true, rollbackVerified: true });
    expect(storage.getItem("canonical")).toBe("old");
    expect(storage.getItem("canonical:tmp")).toBeNull();
  });

  it("rolls back an adapter that mutates and then throws", () => {
    const storage = new MutateThenThrowStorage();
    storage.setItem("canonical", "old");

    const result = writeStorageTransaction("canonical", "new", storage, "Test write");

    expect(result).toMatchObject({ ok: false, reason: "unknown", recoverable: true, rollbackVerified: true });
    expect(storage.getItem("canonical")).toBe("old");
  });

  it("classifies quota and unavailable stores without discarding the prepared payload", () => {
    expect(writeStorageTransaction("canonical", "recover me", new QuotaStorage(), "Test write")).toMatchObject({
      ok: false,
      reason: "quota",
      bytes: 10,
      recoverable: true,
    });
    expect(writeStorageTransaction("canonical", "recover me", null, "Test write")).toMatchObject({
      ok: false,
      reason: "unavailable",
      bytes: 10,
      recoverable: true,
    });
  });

  it("verifies removals instead of assuming the store complied", () => {
    const storage = new RefuseRemoveStorage();
    storage.setItem("canonical", "old");
    expect(removeStorageTransaction("canonical", storage, "Test clear")).toMatchObject({
      ok: false,
      reason: "verification",
      recoverable: true,
    });
  });
});

describe("run and ledger custody", () => {
  it("writes and restores the exact local envelope with unknown extensions", () => {
    const storage = new MemoryStorage();
    const org = testOrg();
    const extensions = { "holder.example@1": { opaque: [true, 7, "memory"] } };
    const result = saveSave(org, CYCLE_ARC, [], extensions, storage);

    expect(result.ok).toBe(true);
    const restored = loadSave(CYCLE_ARC, storage);
    expect(restored?.org).toEqual(org);
    expect(restored?.extensions).toEqual(extensions);
    expect(storage.entries().every(([key]) => !key.endsWith(":tmp"))).toBe(true);
  });

  it("returns serialization failure before claiming a recoverable payload", () => {
    const org = testOrg() as ReturnType<typeof testOrg> & { self?: unknown };
    org.self = org;
    expect(saveSave(org, CYCLE_ARC, [], {}, new MemoryStorage())).toMatchObject({
      ok: false,
      reason: "serialization",
      recoverable: false,
    });
  });

  it("prepares an exact local recovery envelope without browser storage", () => {
    const org = testOrg();
    const artifact = exportSaveRecovery(org, CYCLE_ARC, [], { "holder.example@1": { exact: true } });
    expect(artifact.filename).toContain("cycle-test-arc-cycle-");
    const storage = new MemoryStorage();
    const key = "axm-arc:save:v2:";
    storage.setItem(`${key}${readFileSync(new URL("../../cartridges/clean-room/manifest.json", import.meta.url), "utf8").length}`, artifact.json);
    expect(JSON.parse(artifact.json)).toMatchObject({ localRunVersion: 1, extensions: { "holder.example@1": { exact: true } } });
  });

  it("returns a failed ledger write while retaining the complete in-memory commit", () => {
    const { state } = failedNight();
    const result = commitNightFailedWithResult(state, new QuotaStorage());

    expect(result.save).toMatchObject({ ok: false, reason: "quota", recoverable: true });
    expect(result.ledger.commits).toHaveLength(1);
    expect(result.ledger.commits[0]!.type).toBe("failed-lockout");
  });

  it("keeps headless commit adapters pure rather than hiding a browser write", () => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new QuotaStorage() });
    const { state } = failedNight();
    const ledger = commitNightFailed(state);
    expect(ledger.commits).toHaveLength(1);
  });

  it("writes and reloads a ledger through the result-bearing transaction", () => {
    const storage = new MemoryStorage();
    const { night } = failedNight();
    const ledger = commitFailedLockout(null, night);
    expect(saveLedger(ledger, storage).ok).toBe(true);
    expect(loadLedger(storage)).toEqual(ledger);
    expect(JSON.parse(exportLedger(ledger).json)).toEqual(ledger);
  });

  it("distinguishes ledger serialization failure from a storage refusal", () => {
    const { night } = failedNight();
    const ledger = commitFailedLockout(null, night) as CampaignLedger & { self?: unknown };
    ledger.self = ledger;
    expect(saveLedger(ledger, new MemoryStorage())).toMatchObject({
      ok: false,
      reason: "serialization",
      recoverable: false,
    });
  });
});

describe("interactive custody wiring", () => {
  const app = readFileSync(new URL("../../src/game/App.tsx", import.meta.url), "utf8");
  const raid = readFileSync(new URL("../../src/game/components/RaidNightScreen.tsx", import.meta.url), "utf8");

  it("keeps the ordinary run visibly unsaved and exportable", () => {
    expect(app).toContain("setSaveFailure(result.ok ? null : result.message)");
    expect(app).toContain('role="alert"');
    expect(app).toContain("exportCurrentRun");
  });

  it("uses result-bearing ledger commits and never labels a rejected write committed", () => {
    expect(raid).toContain('data-testid="ledger-save-failure"');
    expect(raid).toContain("commitNightVictoryWithResult(state)");
    expect(raid).toContain("commitNightFailedWithResult(state)");
    expect(raid).toContain("commitAttempt?.save.ok ? commitAttempt.ledger : null");
    expect(raid).toContain("downloadJsonArtifact(exportLedger(commitAttempt.ledger))");
  });
});
