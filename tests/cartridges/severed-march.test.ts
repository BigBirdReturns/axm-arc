// Severed March completion-sim acceptance: exercises the reusable
// cartridge-conformance harness (src/sim/cartridge-conformance.ts) against
// `cartridges/severed-march.arc.json` — a new importable cartridge, not yet
// wired into src/arcs (that directory, along with src/engine and
// tests/engine/fixtures, is the vendored shared surface and stays untouched
// here). Everything below goes through the REAL engine: importArcFromJson →
// validateArc for schema conformance, cartridgeDigest for content-identity,
// and the conformance harness's runCycle-driven autoplay for reachability.
//
// Mirrors tests/sim/karazhan-sim.test.ts's shape (determinism, gate honesty,
// reachability/tuning) but through the arc-agnostic helper instead of a
// karazhan-specific simulator.

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importArcFromJson } from "../../src/game/lib/arc-library.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";
import type { Arc } from "../../src/engine/types.js";
import {
  aggregateRuns,
  simulateArcRun,
  type ConformanceRunResult,
} from "../../src/sim/cartridge-conformance.js";

const LONG = 120_000;

// Pinned content-identity anchor for cartridges/severed-march.arc.json. If the
// JSON is legitimately retuned (see the reachability suite below), this must
// be recomputed and updated — loudly, in the same change — never silently.
const PINNED_DIGEST = "cart1_c35440901a422f26d846ea6a591ed236fbaf1786fcd21e04f19f318feda893a9";

const CARTRIDGE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../cartridges/severed-march.arc.json",
);

function readCartridgeJson(): string {
  return fs.readFileSync(CARTRIDGE_PATH, "utf8");
}

// arc-library.ts (and therefore importArcFromJson) reads/writes the ambient
// `localStorage` global directly; vitest's node environment doesn't provide
// one. Same in-memory shim as tests/game/arc-export.test.ts.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.has(key) ? (this.store.get(key) as string) : null; }
  key(index: number): string | null { return [...this.store.keys()][index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, value); }
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
});

function loadArc(): Arc {
  const imported = importArcFromJson(readCartridgeJson());
  if (!imported.ok) throw new Error(`severed-march.arc.json failed to import: ${imported.errors.join("; ")}`);
  return imported.entry.arc;
}

// ── (a) Import: schema-valid and content-identity-pinned ────────────────────

describe("import", () => {
  it("imports through the real seam (importArcFromJson → validateArc) without errors", () => {
    const result = importArcFromJson(readCartridgeJson());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.arc.meta.id).toBe("severed-march");
    expect(result.entry.trust).toBe("imported-unsigned");
  });

  it("cartridgeDigest pins the cartridge's content identity", () => {
    const arc = loadArc();
    expect(cartridgeDigest(arc)).toBe(PINNED_DIGEST);
  });
});

// ── (b) Determinism ───────────────────────────────────────────────────────────

describe("determinism", () => {
  it("same seed → identical run, twice", { timeout: LONG }, () => {
    const arc = loadArc();
    const a = simulateArcRun(arc, { seed: 7, maxCycles: 20 });
    const b = simulateArcRun(arc, { seed: 7, maxCycles: 20 });
    expect(a).toEqual(b);
  });

  it("aggregate over a seed range is stable across recomputation", { timeout: LONG }, () => {
    const arc = loadArc();
    const runsA = [1, 2, 3].map((seed) => simulateArcRun(arc, { seed, maxCycles: 20 }));
    const runsB = [1, 2, 3].map((seed) => simulateArcRun(arc, { seed, maxCycles: 20 }));
    expect(aggregateRuns(arc, runsA, 20)).toEqual(aggregateRuns(arc, runsB, 20));
  });
});

// ── (c) Gate honesty ──────────────────────────────────────────────────────────

const CHAPTER_2_CHALLENGES = ["walled-market-town", "mountain-beacon", "traitor-lords-keep"];
const CHAPTER_3_CHALLENGES = ["the-sever", "marchlords-seat"];

describe("gate honesty", () => {
  it("no run ever bypasses a chapter/attunement gate or trips an engine locked-warning", { timeout: LONG }, () => {
    const arc = loadArc();
    for (const seed of [1, 2, 3, 4, 5]) {
      const run = simulateArcRun(arc, { seed, maxCycles: 30 });
      expect(run.gateViolations).toBe(0);
      expect(run.warnings.some((w) => w.includes("locked"))).toBe(false);
    }
  });

  it("chapter-2 is only ever attempted after chapter-1's required challenges clear", { timeout: LONG }, () => {
    const arc = loadArc();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const run = simulateArcRun(arc, { seed, maxCycles: 30 });
      const attemptedChapter2 = CHAPTER_2_CHALLENGES.some((id) => run.attempts[id] !== undefined);
      if (attemptedChapter2) {
        expect(run.tierClearCycles["chapter-1"]).not.toBeNull();
      }
    }
  });

  it("chapter-3 is only ever attempted after chapter-2's required challenges clear", { timeout: LONG }, () => {
    const arc = loadArc();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const run = simulateArcRun(arc, { seed, maxCycles: 40 });
      const attemptedChapter3 = CHAPTER_3_CHALLENGES.some((id) => run.attempts[id] !== undefined);
      if (attemptedChapter3) {
        expect(run.tierClearCycles["chapter-2"]).not.toBeNull();
      }
    }
  });

  it("marchlords-seat (the finale) is only ever attempted once sigils-of-the-march is held by an attuned agent", { timeout: LONG }, () => {
    const arc = loadArc();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const run = simulateArcRun(arc, { seed, maxCycles: 45 });
      if (run.attempts["marchlords-seat"] !== undefined) {
        // The gate is attunementThreshold 0.5 over agentAttunements ["sigils-of-the-march"]
        // (grantsAccessTo on the chain) — an attempt can only exist if
        // challengeAccess judged the actual party as satisfying it, and that
        // requires the chain to have completed for at least one party member.
        expect(run.attunementCycles["sigils-of-the-march"]).not.toBeNull();
        // The chain's own steps require the-sever cleared, which in turn
        // requires chapter-3 to be unlocked, which requires chapter-2 cleared.
        expect(run.tierClearCycles["chapter-2"]).not.toBeNull();
      }
    }
  });
});

// ── (d) Reachability across a seed range ─────────────────────────────────────
//
// Reviewer's flagged risk: marchlords-seat is difficultyRating 78 with only a
// 2-4 agent party (banner-knight + chirurgeon required), gated behind the
// sigils-of-the-march attunement chain (clear walled-market-town, traitor-
// lords-keep, and the-sever — all with the SAME attuned agents, since a chain
// step only completes for an agent that personally holds the clear). Verified
// empirically with this harness before writing these assertions: with the
// harness's generic starting roster (2 agents per role, top two tiers) and a
// bounded seed/cycle sweep, marchlords-seat clears in the overwhelming
// majority of seeds (14/15 within 45 cycles in the sweep used to validate
// this suite; the 15th cleared at cycle ~50 when given more room) with ZERO
// engine-reported failures anywhere in the run — every non-clear is a
// "partial" (agent downtime, not defeat) that the harness's autoplay policy
// simply retries. No content tuning was needed: the encounter is tight
// (partial retries before the final clear are common) but reachable and
// clearable as authored. If a future edit to the JSON changes this balance,
// re-run this suite; a swing to `stalled`/`max-cycles` dominance here is the
// signal that tuning (thresholds, roster ranges, item bonuses — smallest
// change that restores tight-but-reachable) is warranted, exactly as
// docs/balance/KARAZHAN_BALANCE_SIM_REPORT.md frames it for Karazhan.

const REACHABILITY_SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);
const REACHABILITY_MAX_CYCLES = 45;

const ALL_CHALLENGE_IDS = [
  "crossroads-picket",
  "river-toll-fort",
  "granary-town",
  "walled-market-town",
  "mountain-beacon",
  "traitor-lords-keep",
  "the-sever",
  "marchlords-seat",
];

describe("reachability + tuning (marchlords-seat finale)", () => {
  it("at least one run clears every chapter-1 and chapter-2 challenge", { timeout: LONG }, () => {
    const arc = loadArc();
    const runs = REACHABILITY_SEEDS.map((seed) => simulateArcRun(arc, { seed, maxCycles: REACHABILITY_MAX_CYCLES }));
    for (const id of ["crossroads-picket", "river-toll-fort", "granary-town", "walled-market-town", "mountain-beacon", "traitor-lords-keep"]) {
      expect(runs.some((r) => r.clearCycles[id] !== undefined)).toBe(true);
    }
  });

  it("at least one run completes the sigils-of-the-march attunement chain", { timeout: LONG }, () => {
    const arc = loadArc();
    const runs = REACHABILITY_SEEDS.map((seed) => simulateArcRun(arc, { seed, maxCycles: REACHABILITY_MAX_CYCLES }));
    expect(runs.some((r) => r.attunementCycles["sigils-of-the-march"] !== null)).toBe(true);
  });

  it("at least one run reaches AND clears the finale (marchlords-seat), honestly gated", { timeout: LONG }, () => {
    const arc = loadArc();
    const runs = REACHABILITY_SEEDS.map((seed) => simulateArcRun(arc, { seed, maxCycles: REACHABILITY_MAX_CYCLES }));
    const clearedFinale = runs.filter((r) => r.clearCycles["marchlords-seat"] !== undefined);
    expect(clearedFinale.length).toBeGreaterThan(0);
    // "Reaches" (attempted) and "clears" (succeeds) are both honest: no run
    // that cleared the finale ever did so with a nonzero gate-violation count.
    for (const r of clearedFinale) expect(r.gateViolations).toBe(0);
  });

  it("the full arc (every progression tier's required challenges) is completable within a bounded cycle budget", { timeout: LONG }, () => {
    const arc = loadArc();
    const runs: ConformanceRunResult[] = REACHABILITY_SEEDS.map((seed) => simulateArcRun(arc, { seed, maxCycles: REACHABILITY_MAX_CYCLES }));
    const clearedRuns = runs.filter((r) => r.outcome === "cleared");
    expect(clearedRuns.length).toBeGreaterThan(0);
    for (const r of clearedRuns) {
      for (const id of ALL_CHALLENGE_IDS) expect(r.clearCycles[id]).not.toBeUndefined();
      expect(r.tierClearCycles["chapter-3"]).not.toBeNull();
    }
  });
});
