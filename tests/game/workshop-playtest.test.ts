// Workshop playtest preview (RFC_WORKSHOP PR 062). playtestPreview runs a
// fixed, small seed set through the same simulateArcRun/aggregateRuns
// conformance harness every shipped cartridge's test runs — reused
// read-only. Covers: determinism, run count, rate bounds, gate honesty for
// a shipped cartridge, and purity (the arc object is never mutated).

import { describe, it, expect } from "vitest";
import { FIRST_CHARTER } from "../../src/arcs/index.js";
import { PLAYTEST_SEEDS, playtestPreview } from "../../src/game/lib/workshop.js";

describe("playtestPreview", () => {
  it("is deterministic — the same arc produces an identical report on repeat calls", () => {
    const a = JSON.stringify(playtestPreview(FIRST_CHARTER));
    const b = JSON.stringify(playtestPreview(FIRST_CHARTER));
    expect(a).toBe(b);
  });

  it("runs exactly PLAYTEST_SEEDS.length seeded runs", () => {
    const report = playtestPreview(FIRST_CHARTER);
    expect(report.aggregate.runs.length).toBe(PLAYTEST_SEEDS.length);
    expect(report.seeds).toBe(PLAYTEST_SEEDS.length);
  });

  it("keeps clearRate/stallRate/maxCycleRate within [0, 1]", () => {
    const { aggregate } = playtestPreview(FIRST_CHARTER);
    for (const rate of [aggregate.clearRate, aggregate.stallRate, aggregate.maxCycleRate]) {
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    }
  });

  it("reports zero gate violations for FIRST_CHARTER under the shared conformance harness", () => {
    const { aggregate } = playtestPreview(FIRST_CHARTER);
    // A shipped cartridge must be gate-honest under the same harness its own
    // tests run through. If this ever fails, that is a real regression to
    // investigate — do not loosen this assertion to make it pass.
    expect(aggregate.totalGateViolations).toBe(0);
  });

  it("is pure — the arc object passed in is never mutated", () => {
    const before = JSON.stringify(FIRST_CHARTER);
    playtestPreview(FIRST_CHARTER);
    const after = JSON.stringify(FIRST_CHARTER);
    expect(after).toBe(before);
  });
});
