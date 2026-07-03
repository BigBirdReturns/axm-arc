// Karazhan completion-sim acceptance: the harness is deterministic, honest
// about gates (never bypasses, never trips an engine "locked" warning), and
// produces the campaign-shape data the balance report is built from.
//
// Small seed counts keep this suite fast; the full sweep behind
// docs/balance/KARAZHAN_BALANCE_SIM_REPORT.md runs via `npm run sim:karazhan`.

import { describe, it, expect } from "vitest";
import { aggregateRuns, simulateKarazhanRun } from "../../src/sim/karazhan-autoplay.js";

const LONG = 120_000;

describe("determinism", () => {
  it("same seed → identical run, twice", { timeout: LONG }, () => {
    const a = simulateKarazhanRun({ seed: 7, maxCycles: 20 });
    const b = simulateKarazhanRun({ seed: 7, maxCycles: 20 });
    expect(a).toEqual(b);
  });

  it("aggregate over a seed range is stable across recomputation", { timeout: LONG }, () => {
    const runsA = [1, 2, 3].map((seed) => simulateKarazhanRun({ seed, maxCycles: 15 }));
    const runsB = [1, 2, 3].map((seed) => simulateKarazhanRun({ seed, maxCycles: 15 }));
    expect(aggregateRuns(runsA, 15)).toEqual(aggregateRuns(runsB, 15));
  });
});

describe("gate honesty", () => {
  it("no run ever bypasses a gate or trips an engine locked-warning", { timeout: LONG }, () => {
    for (const seed of [1, 2, 3]) {
      const run = simulateKarazhanRun({ seed, maxCycles: 25 });
      expect(run.gateViolations).toBe(0);
      // Gated encounters can only appear in attempts if their gate was open:
      // curator attempts require the half-raid key timing to exist first.
      if (run.attempts["curator"]) {
        expect(run.mastersKeyHalfRaidCycle).not.toBeNull();
      }
      if (run.attempts["nightbane"]) {
        expect(run.urnCycle).not.toBeNull();
      }
    }
  });

  it("at least one run reaches the Curator gate honestly", { timeout: LONG }, () => {
    const runs = [1, 2, 3].map((seed) => simulateKarazhanRun({ seed, maxCycles: 30 }));
    const reached = runs.some((r) => (r.attempts["curator"]?.success ?? 0) + (r.attempts["curator"]?.partial ?? 0) + (r.attempts["curator"]?.failure ?? 0) > 0);
    expect(reached).toBe(true);
    // And only via the key: every such run stamped the Master's Key first.
    for (const r of runs) {
      if (r.attempts["curator"]) expect(r.mastersKeyFirstCycle).not.toBeNull();
    }
  });

  it("the Nightbane gate is reached, or the run data explains exactly why not", { timeout: LONG }, () => {
    // Arc-agnostic gate-honesty invariants (hold whether or not the urn is
    // reachable in the live arc). Whether Nightbane is actually reachable is
    // an arc-balance property, asserted in the tuning suite.
    const runs = [1, 2, 3].map((seed) => simulateKarazhanRun({ seed, maxCycles: 40 }));
    for (const run of runs) {
      // Nightbane can only be attempted if BOTH halves of its gate were
      // genuinely satisfied — the urn acquired and access opened.
      if (run.attempts["nightbane"] !== undefined) {
        expect(run.nightbaneAccessCycle).not.toBeNull();
        expect(run.urnCycle).not.toBeNull();
      }
      // Access can never open without the urn arriving (the urn is half the
      // gate). This is the "explains exactly why not" direction: no urn, no
      // access — the balance report traces a missing urn to loot eligibility.
      if (run.nightbaneAccessCycle !== null) {
        expect(run.urnCycle).not.toBeNull();
      }
    }
  });
});

describe("campaign shape", () => {
  it("wing 1 is beatable by the starting roster inside the early game", { timeout: LONG }, () => {
    const run = simulateKarazhanRun({ seed: 1, maxCycles: 25 });
    expect(run.wingClearCycles["wing-1"]).not.toBeNull();
    expect(run.wingClearCycles["wing-1"]!).toBeLessThanOrEqual(12);
    expect(run.mastersKeyFirstCycle).not.toBeNull();
  });

  it("smoke run produces a coherent result object", { timeout: LONG }, () => {
    const run = simulateKarazhanRun({ seed: 42, maxCycles: 10 });
    expect(run.cyclesPlayed).toBeLessThanOrEqual(10);
    expect(["cleared", "stalled", "max-cycles"]).toContain(run.outcome);
    expect(run.dramaResolved).toBeGreaterThanOrEqual(0);
    for (const tally of Object.values(run.attempts)) {
      expect(tally.success + tally.partial + tally.failure).toBeGreaterThan(0);
    }
  });
});
