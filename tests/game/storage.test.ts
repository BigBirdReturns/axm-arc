import { beforeEach, describe, expect, it } from "vitest";
import { FIRST_CHARTER } from "../../src/arcs/first-charter.js";
import { foundOrganization } from "../../src/engine/founding.js";
import { serializeGame } from "../../src/engine/save.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";
import { clearSave, loadSave, saveSave } from "../../src/game/lib/storage.js";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  throwOnWrite: Error | null = null;
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void {
    if (this.throwOnWrite) throw this.throwOnWrite;
    this.values.set(key, value);
  }
}

const storage = new MemoryStorage();
const saveKey = () => `axm-arc:save:v2:${cartridgeDigest(FIRST_CHARTER)}`;

beforeEach(() => {
  storage.clear();
  storage.throwOnWrite = null;
  (globalThis as unknown as { localStorage: Storage }).localStorage = storage;
});

describe("hub run storage", () => {
  it("atomically preserves exact engine state and unknown portable extensions", () => {
    const org = foundOrganization(FIRST_CHARTER);
    const extensions = {
      "rodoh.ledger@2": { version: 2, entries: [{ seq: 0 }] },
      "future-player@9": ["opaque", true, 3],
    };

    expect(saveSave(org, FIRST_CHARTER, [], extensions)).toMatchObject({
      ok: true,
      bytes: expect.any(Number),
    });
    expect(loadSave(FIRST_CHARTER)).toMatchObject({ org, extensions });
  });

  it("reads the previous direct engine-save slot and upgrades on the next write", () => {
    const org = foundOrganization(FIRST_CHARTER);
    storage.setItem(saveKey(), serializeGame(org, FIRST_CHARTER));

    const legacy = loadSave(FIRST_CHARTER);
    expect(legacy?.org).toEqual(org);
    expect(legacy?.extensions).toEqual({});

    expect(saveSave(legacy!.org, FIRST_CHARTER, legacy!.pendingRewardChoices, legacy!.extensions)).toMatchObject({
      ok: true,
      bytes: expect.any(Number),
    });
    expect(JSON.parse(storage.getItem(saveKey())!)).toMatchObject({ localRunVersion: 1, extensions: {} });
  });

  it("returns an explicit failure instead of pretending a rejected write succeeded", () => {
    const org = foundOrganization(FIRST_CHARTER);
    const error = new Error("storage is full");
    error.name = "QuotaExceededError";
    storage.throwOnWrite = error;

    expect(saveSave(org, FIRST_CHARTER)).toMatchObject({
      ok: false,
      reason: "quota",
      message: "Saving the run failed because local storage is full. storage is full",
      bytes: expect.any(Number),
      recoverable: true,
      rollbackVerified: true,
    });
  });

  it("returns a result when clearing custody", () => {
    const org = foundOrganization(FIRST_CHARTER);
    expect(saveSave(org, FIRST_CHARTER)).toMatchObject({ ok: true, bytes: expect.any(Number) });
    expect(clearSave(FIRST_CHARTER)).toEqual({ ok: true, bytes: 0 });
    expect(loadSave(FIRST_CHARTER)).toBeNull();
  });
});
