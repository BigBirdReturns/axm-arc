// PR 042 — the Expansion Archive's roster derivation: a pure join of the arc
// library and the campaign ledger (RFC_EXPANSION_ARCHIVE). Guards: an empty
// library/ledger is an honest empty archive; the bundled library with no
// ledger is all-unattempted; a committed victory ledger surfaces at least one
// non-unattempted row; ordering and purity hold.
import { describe, it, expect, beforeEach } from "vitest";
import { expansionRoster, expansionRecord } from "../../src/game/lib/expansion-archive.js";
import { loadArcLibrary, ensureBundledArc, type ArcLibraryEntry } from "../../src/game/lib/arc-library.js";
import { FIRST_CHARTER, KARAZHAN } from "../../src/arcs/index.js";
import { newRaidNight, pull, applyFix, commitNightVictory, RAID_ARC, type RaidNightState } from "../../src/game/lib/raid-night.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";

// arc-library.ts reads/writes the ambient `localStorage` global directly.
// Vitest's node environment doesn't provide one, so install a minimal
// in-memory shim (same pattern as arc-export.test.ts / designer-storage.test.ts).
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.has(key) ? (this.store.get(key) as string) : null; }
  key(index: number): string | null { return [...this.store.keys()][index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, value); }
}

function playToClear(seed: number): RaidNightState {
  let s = newRaidNight(seed);
  for (let i = 0; i < 20 && !s.cleared; i++) {
    s = pull(s);
    if (s.cleared) break;
    if (s.diagnosis) s = applyFix(s, s.diagnosis.fixes[0]!);
  }
  return s;
}

// Mirrors App.tsx's resolveActiveArc() bootstrap (ensureBundledArc for each
// bundled arc) so the library is populated the same way the real app
// populates it, rather than relying on loadArcLibrary() to conjure entries.
// Also seats RAID_ARC (the cartridge playToClear/commitNightVictory actually
// play) so a committed ledger has a real library counterpart to join against —
// otherwise the ledger's tiers reference a cartridge no test library carries.
function bundledLibrary(): ArcLibraryEntry[] {
  ensureBundledArc(FIRST_CHARTER);
  ensureBundledArc(KARAZHAN);
  ensureBundledArc(RAID_ARC);
  return loadArcLibrary();
}

describe("expansion archive roster (read-only)", () => {
  beforeEach(() => {
    globalThis.localStorage = new MemoryStorage();
  });

  it("empty library + null ledger is an honest empty archive", () => {
    expect(expansionRoster([], null, null)).toEqual([]);
  });

  it("bundled library + null ledger: every row is unattempted", () => {
    const library = bundledLibrary();
    const rows = expansionRoster(library, null, null);
    expect(rows.length).toBe(library.length);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.status).toBe("unattempted");
      expect(row.tiersPlayed).toBe(0);
    }
  });

  it("bundled library + a committed victory ledger: at least one row is not unattempted", () => {
    const library = bundledLibrary();
    const ledger = commitNightVictory(playToClear(3));
    const rows = expansionRoster(library, ledger, null);
    expect(rows.some((r) => r.status !== "unattempted")).toBe(true);
    for (const row of rows) {
      expect(row.tiersCleared).toBeLessThanOrEqual(row.tiersPlayed);
    }
    const clearedDigests = new Set(ledger.progress.tiers.filter((t) => t.cleared).map((t) => t.cartridgeDigest));
    for (const row of rows) {
      if (clearedDigests.has(row.digest)) {
        expect(["cleared", "in-progress"]).toContain(row.status);
      }
    }
  });

  it("isActive is true exactly for the row matching activeArcId", () => {
    const library = bundledLibrary();
    const activeArcId = library[0]!.arc.meta.id;
    const rows = expansionRoster(library, null, activeArcId);
    for (const row of rows) {
      expect(row.isActive).toBe(row.arcId === activeArcId);
    }
    expect(rows.some((r) => r.isActive)).toBe(true);
  });

  it("orders unattempted rows after non-unattempted rows", () => {
    const library = bundledLibrary();
    const ledger = commitNightVictory(playToClear(3));
    const rows = expansionRoster(library, ledger, null);
    const firstUnattempted = rows.findIndex((r) => r.status === "unattempted");
    if (firstUnattempted === -1) return; // nothing unattempted — vacuously ordered
    for (let i = firstUnattempted; i < rows.length; i++) {
      expect(rows[i]!.status).toBe("unattempted");
    }
  });

  it("is pure — reading does not mutate the ledger or the library", () => {
    const library = bundledLibrary();
    const ledger = commitNightVictory(playToClear(3));
    const ledgerSnapshot = JSON.stringify(ledger);
    const librarySnapshot = JSON.stringify(library);
    expansionRoster(library, ledger, library[0]!.arc.meta.id);
    expect(JSON.stringify(ledger)).toBe(ledgerSnapshot);
    expect(JSON.stringify(library)).toBe(librarySnapshot);
  });
});

describe("expansion campaign record (read-only)", () => {
  beforeEach(() => {
    globalThis.localStorage = new MemoryStorage();
  });

  it("null ledger is an honest empty record", () => {
    const rec = expansionRecord("anything", null);
    expect(rec).toEqual({
      digest: "anything", tiers: [], totalPulls: 0, totalWipes: 0,
      victories: 0, failedLockouts: 0, scars: [], legends: [], precedents: [],
    });
  });

  it("a committed victory ledger on RAID_ARC surfaces its record by digest", () => {
    const ledger = commitNightVictory(playToClear(3));
    const digest = cartridgeDigest(RAID_ARC);
    const rec = expansionRecord(digest, ledger);

    const expectedTiers = ledger.progress.tiers.filter((t) => t.cartridgeDigest === digest);
    expect(rec.tiers.length).toBe(expectedTiers.length);
    expect(rec.tiers.length).toBeGreaterThan(0);
    expect(rec.victories).toBeGreaterThanOrEqual(1);

    const expectedTotalPulls = ledger.commits
      .filter((c) => c.cartridgeDigest === digest)
      .reduce((s, c) => s + c.pulls, 0);
    expect(rec.totalPulls).toBe(expectedTotalPulls);

    const expectedScars = ledger.scars.filter((s) => s.sourceBossRef.cartridgeDigest === digest);
    expect(rec.scars.length).toBe(expectedScars.length);
  });

  it("a digest with no match is an honest empty record", () => {
    const ledger = commitNightVictory(playToClear(3));
    const rec = expansionRecord("digest-nobody-played", ledger);
    expect(rec.tiers).toEqual([]);
    expect(rec.totalPulls).toBe(0);
    expect(rec.totalWipes).toBe(0);
    expect(rec.victories).toBe(0);
    expect(rec.failedLockouts).toBe(0);
    expect(rec.scars).toEqual([]);
    expect(rec.legends).toEqual([]);
    expect(rec.precedents).toEqual([]);
  });

  it("is pure — reading does not mutate the ledger", () => {
    const ledger = commitNightVictory(playToClear(3));
    const snapshot = JSON.stringify(ledger);
    expansionRecord(cartridgeDigest(RAID_ARC), ledger);
    expect(JSON.stringify(ledger)).toBe(snapshot);
  });
});
