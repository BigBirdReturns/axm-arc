// PR 016 — the durability promise (Constitution Article 3: memory belongs to the
// run; the ledger exports with it; old records migrate). Guards the custody
// surface: new ledgers are versioned, save/load and export round-trip a guild
// unchanged, a record from another additive schema version loads without
// crashing, and corrupt/empty storage never throws. No new mechanics.
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadLedger, saveLedger, clearLedger, exportLedger, importLedger,
} from "../../src/game/lib/ledger.js";
import {
  newRaidNight, pull, applyFix, commitNightVictory, type RaidNightState,
} from "../../src/game/lib/raid-night.js";

// Versioned storage key (ledger.ts LEDGER_KEY): "bump, don't mutate".
const LEDGER_KEY = "axm-arc:campaign-ledger:v1";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null; }
  key(i: number): string | null { return Array.from(this.store.keys())[i] ?? null; }
  removeItem(k: string): void { this.store.delete(k); }
  setItem(k: string, v: string): void { this.store.set(k, v); }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage();
});

function playToClear(seed: number): RaidNightState {
  let s = newRaidNight(seed);
  for (let i = 0; i < 20 && !s.cleared; i++) {
    s = pull(s);
    if (s.cleared) break;
    if (s.diagnosis) s = applyFix(s, s.diagnosis.fixes[0]!);
  }
  return s;
}

const guild = commitNightVictory(playToClear(3));

describe("ledger migration + schema versioning", () => {
  it("stamps new ledgers with the current schema version", () => {
    expect(guild.schemaVersion).toBe("ledger/1.0");
  });

  it("round-trips through save/load unchanged", () => {
    saveLedger(guild);
    expect(loadLedger()).toEqual(guild);
  });

  it("exports with the run and re-imports to an equal ledger (Article 3)", () => {
    const { filename, json } = exportLedger(guild);
    expect(filename).toMatch(/\.guild\.json$/);
    expect(filename).not.toMatch(/\s/); // a safe, portable filename
    expect(JSON.parse(json)).toEqual(guild);
  });

  it("loads a record from another additive schema version without crashing", () => {
    // A guild saved by a different additive version still loads (migrate is a
    // forward hook; additive versions load as-is — old records migrate, never lost).
    const otherVersion = { ...guild, schemaVersion: "ledger/0.9" };
    localStorage.setItem(LEDGER_KEY, JSON.stringify(otherVersion));
    const loaded = loadLedger();
    expect(loaded).not.toBeNull();
    expect(loaded!.roster.length).toBe(guild.roster.length);
    expect(loaded!.commits.length).toBe(guild.commits.length);
  });

  it("REFUSES a record written by a NEWER schema than this build (no silent field loss)", () => {
    const newer = { ...guild, schemaVersion: "ledger/2.0" };
    localStorage.setItem(LEDGER_KEY, JSON.stringify(newer));
    expect(loadLedger()).toBeNull(); // FAILS before fix: no-op migrate returns the newer record
  });

  it("import refuses a newer-schema guild with a legible error", () => {
    const { json } = exportLedger({ ...guild, schemaVersion: "ledger/2.0" });
    const res = importLedger(json);
    expect(res.ok).toBe(false); // FAILS before fix: migrate no-op → ok:true
    if (res.ok) return;
    expect(res.errors.join(" ")).toMatch(/schema version/i);
  });

  it("stamps the current schema version when it upgrades an OLDER record", () => {
    const older = { ...guild, schemaVersion: "ledger/0.9" };
    localStorage.setItem(LEDGER_KEY, JSON.stringify(older));
    const loaded = loadLedger();
    expect(loaded).not.toBeNull();
    expect(loaded!.schemaVersion).toBe("ledger/1.0"); // FAILS before fix: stays "ledger/0.9"
  });

  it("returns null on structurally-invalid-but-parseable storage (shape-checked like import)", () => {
    localStorage.setItem(LEDGER_KEY, JSON.stringify({ schemaVersion: "ledger/1.0", hello: "world" }));
    expect(loadLedger()).toBeNull(); // FAILS before fix: no shape check → returns the bogus object
  });

  it("returns null on empty or corrupt storage — never throws", () => {
    expect(loadLedger()).toBeNull();
    localStorage.setItem(LEDGER_KEY, "{ not valid json");
    expect(loadLedger()).toBeNull();
    clearLedger();
    expect(loadLedger()).toBeNull();
  });
});
