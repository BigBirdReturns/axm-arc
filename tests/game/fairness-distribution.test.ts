import { describe, it, expect } from "vitest";
import { newRaidNight, pull, applyFix, type RaidNightState } from "../../src/game/lib/raid-night.js";
import { commitVictory } from "../../src/game/lib/ledger.js";

function playToClear(seed: number): RaidNightState {
  let s = newRaidNight(seed);
  for (let i = 0; i < 20 && !s.cleared; i++) {
    s = pull(s);
    if (s.cleared) break;
    if (s.diagnosis) s = applyFix(s, s.diagnosis.fixes[0]!);
  }
  return s;
}

function nightOf(s: RaidNightState) {
  return { arc: s.arc, org: s.org, cleared: s.cleared, pulls: s.pull, wipes: s.wipes, bestPull: s.bestShortfall };
}

describe("fairness distributionScore is derived from the real loot distribution", () => {
  it("a skewed distribution scores lower than an even one", () => {
    // Even: every raider receives exactly one authored drop.
    const even = playToClear(3);
    const evenIds = Object.keys(even.org.agents);
    for (const id of evenIds) {
      even.org.agents[id]!.rewardHistory = [
        { itemId: "gate-warden-plating", cycle: 1, challengeId: "the-gate-warden" },
      ];
    }
    const evenLedger = commitVictory(null, nightOf(even));

    // Skewed: one raider hoards every drop, everyone else receives nothing.
    const skewed = playToClear(3);
    const skewedIds = Object.keys(skewed.org.agents);
    const hoarder = skewedIds[0]!;
    for (const id of skewedIds) skewed.org.agents[id]!.rewardHistory = [];
    skewed.org.agents[hoarder]!.rewardHistory = skewedIds.map((_, i) => ({
      itemId: "gate-warden-plating", cycle: i + 1, challengeId: "the-gate-warden",
    }));
    const skewedLedger = commitVictory(null, nightOf(skewed));

    // Both are honest numbers in range.
    expect(evenLedger.fairness.distributionScore).toBeLessThanOrEqual(100);
    expect(skewedLedger.fairness.distributionScore).toBeGreaterThanOrEqual(0);
    // The core claim: concentration is scored as less fair than an even spread.
    expect(skewedLedger.fairness.distributionScore).toBeLessThan(evenLedger.fairness.distributionScore);
  });
});
