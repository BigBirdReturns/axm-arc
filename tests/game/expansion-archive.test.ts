// PR 042 — the Expansion Archive's roster derivation: a pure join of the arc
// library and the campaign ledger (RFC_EXPANSION_ARCHIVE). Guards: an empty
// library/ledger is an honest empty archive; the bundled library with no
// ledger is all-unattempted; a committed victory ledger surfaces at least one
// non-unattempted row; ordering and purity hold.
import { describe, it, expect, beforeEach } from "vitest";
import { expansionRoster, expansionRecord, journeyTimeline, carryVerdict } from "../../src/game/lib/expansion-archive.js";
import { loadArcLibrary, ensureBundledArc, type ArcLibraryEntry } from "../../src/game/lib/arc-library.js";
import { FIRST_CHARTER, KARAZHAN } from "../../src/arcs/index.js";
import { newRaidNight, pull, applyFix, commitNightVictory, commitNightFailed, RAID_ARC, type RaidNightState } from "../../src/game/lib/raid-night.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";
import { checkCompatibility } from "../../src/game/lib/ledger.js";

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

describe("expansion archive union model (PR 044)", () => {
  beforeEach(() => {
    globalThis.localStorage = new MemoryStorage();
  });

  it("library-only rows (no ledger history) render Unattempted, inLibrary, not artifactMissing", () => {
    ensureBundledArc(FIRST_CHARTER);
    ensureBundledArc(KARAZHAN);
    const library = loadArcLibrary(); // RAID_ARC deliberately NOT in the library
    const ledger = commitNightVictory(playToClear(3)); // committed on RAID_ARC
    const rows = expansionRoster(library, ledger, null);

    const firstCharterRow = rows.find((r) => r.arcId === FIRST_CHARTER.meta.id);
    const karazhanRow = rows.find((r) => r.arcId === KARAZHAN.meta.id);
    expect(firstCharterRow).toBeTruthy();
    expect(karazhanRow).toBeTruthy();
    for (const row of [firstCharterRow!, karazhanRow!]) {
      expect(row.status).toBe("unattempted");
      expect(row.inLibrary).toBe(true);
      expect(row.artifactMissing).toBe(false);
    }
  });

  it("ledger-only rows (played but unlibraried) render as artifact-missing", () => {
    ensureBundledArc(FIRST_CHARTER);
    ensureBundledArc(KARAZHAN);
    const library = loadArcLibrary(); // RAID_ARC not in the library
    const ledger = commitNightVictory(playToClear(3));
    const digest = cartridgeDigest(RAID_ARC);
    const rows = expansionRoster(library, ledger, null);

    const matches = rows.filter((r) => r.digest === digest);
    expect(matches.length).toBe(1);
    const row = matches[0]!;
    expect(row.artifactMissing).toBe(true);
    expect(row.inLibrary).toBe(false);
    expect(row.status).not.toBe("unattempted");
    const expectedCartridgeId = ledger.progress.tiers.find((t) => t.cartridgeDigest === digest)?.cartridgeId;
    expect(expectedCartridgeId).toBeTruthy();
    expect(row.name).toBe(expectedCartridgeId);
    expect(row.tiersCleared).toBeGreaterThanOrEqual(1);
  });

  it("importing the cartridge merges the artifact-missing row into the library row — no duplicate", () => {
    ensureBundledArc(FIRST_CHARTER);
    ensureBundledArc(KARAZHAN);
    ensureBundledArc(RAID_ARC); // now in the library too
    const library = loadArcLibrary();
    const ledger = commitNightVictory(playToClear(3));
    const digest = cartridgeDigest(RAID_ARC);
    const rows = expansionRoster(library, ledger, null);

    const matches = rows.filter((r) => r.digest === digest);
    expect(matches.length).toBe(1);
    expect(matches[0]!.inLibrary).toBe(true);
    expect(matches[0]!.artifactMissing).toBe(false);
  });

  it("lastCommitSeq is the max commitSeq among the digest's commits", () => {
    const ledger = commitNightVictory(playToClear(3));
    const digest = cartridgeDigest(RAID_ARC);
    const rec = expansionRecord(digest, ledger);
    const expected = Math.max(...ledger.commits.filter((c) => c.cartridgeDigest === digest).map((c) => c.commitSeq));
    expect(rec.lastCommitSeq).toBe(expected);
  });

  it("is pure — reading does not mutate the ledger or the library", () => {
    ensureBundledArc(FIRST_CHARTER);
    ensureBundledArc(KARAZHAN);
    const library = loadArcLibrary();
    const ledger = commitNightVictory(playToClear(3));
    const ledgerSnapshot = JSON.stringify(ledger);
    const librarySnapshot = JSON.stringify(library);
    expansionRoster(library, ledger, null);
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
      lastCommitSeq: null,
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

describe("journey timeline (PR 045 — cross-expansion chronology)", () => {
  beforeEach(() => {
    globalThis.localStorage = new MemoryStorage();
  });

  it("null ledger is an honest empty journey", () => {
    expect(journeyTimeline(null)).toEqual([]);
  });

  it("a committed victory ledger: one entry per commit, in ascending commitSeq order", () => {
    const ledger = commitNightVictory(playToClear(3));
    const timeline = journeyTimeline(ledger);
    expect(timeline.length).toBe(ledger.commits.length);
    expect(timeline.length).toBeGreaterThan(0);
    for (let i = 0; i < timeline.length - 1; i++) {
      expect(timeline[i]!.commitSeq).toBeLessThanOrEqual(timeline[i + 1]!.commitSeq);
    }
    const victoryEntry = timeline.find((e) => e.type === "victory");
    expect(victoryEntry).toBeTruthy();
    expect(victoryEntry!.grade).not.toBeNull();
    for (let i = 0; i < timeline.length; i++) {
      const commit = ledger.commits[i]!;
      expect(timeline[i]!.digest).toBe(commit.cartridgeDigest);
      expect(timeline[i]!.cartridgeId).toBe(commit.cartridgeId);
    }
  });

  it("a failed-lockout ledger: that entry has type failed-lockout, null grade, not cleared", () => {
    const state = newRaidNight(3);
    const ledger = commitNightFailed(state);
    const timeline = journeyTimeline(ledger);
    expect(timeline.length).toBe(ledger.commits.length);
    const failedEntry = timeline.find((e) => e.type === "failed-lockout");
    expect(failedEntry).toBeTruthy();
    expect(failedEntry!.grade).toBeNull();
    expect(failedEntry!.cleared).toBe(false);
  });

  it("is pure — reading does not mutate the ledger", () => {
    const ledger = commitNightVictory(playToClear(3));
    const snapshot = JSON.stringify(ledger);
    journeyTimeline(ledger);
    expect(JSON.stringify(ledger)).toBe(snapshot);
  });
});

describe("carry-forward compatibility signal (PR 047)", () => {
  beforeEach(() => {
    globalThis.localStorage = new MemoryStorage();
  });

  it("null ledger is always null-ledger — no guild to check", () => {
    expect(carryVerdict(FIRST_CHARTER, null)).toBe("null-ledger");
  });

  it("a ledger built by playing RAID_ARC is compatible with RAID_ARC itself, and matches checkCompatibility verbatim", () => {
    const ledger = commitNightVictory(playToClear(3));
    const verdict = carryVerdict(RAID_ARC, ledger);
    expect(verdict).toBe(checkCompatibility(ledger, RAID_ARC).verdict);
    expect(verdict).toBe("compatible");
  });

  it("a different bundled cartridge's verdict is a faithful, non-null passthrough of checkCompatibility", () => {
    const ledger = commitNightVictory(playToClear(3));
    for (const other of [FIRST_CHARTER, KARAZHAN]) {
      const verdict = carryVerdict(other, ledger);
      expect(verdict).toBe(checkCompatibility(ledger, other).verdict);
      expect(verdict).not.toBe("null-ledger");
    }
  });

  it("is pure — reading does not mutate the ledger", () => {
    const ledger = commitNightVictory(playToClear(3));
    const snapshot = JSON.stringify(ledger);
    carryVerdict(RAID_ARC, ledger);
    carryVerdict(FIRST_CHARTER, ledger);
    carryVerdict(KARAZHAN, ledger);
    expect(JSON.stringify(ledger)).toBe(snapshot);
  });
});
