// PR 018 — fairness memory and loot history must credit only real recipients and
// accumulate honestly. Who got what is remembered per agent; an agent who
// received nothing is never credited; and the consequence loot list is backed by
// real reward records. Guards distribution honesty. No new mechanics.
import { describe, it, expect } from "vitest";
import {
  newRaidNight, pull, applyFix, commitNightVictory, nightConsequences, type RaidNightState,
} from "../../src/game/lib/raid-night.js";
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

/** A cleared night where exactly one raider received an authored drop. */
function clearedNightWithDrop(seed: number) {
  const s = playToClear(seed);
  const ids = Object.keys(s.org.agents);
  const winner = ids[0]!;
  s.org.agents[winner]!.rewardHistory = [{ itemId: "gate-warden-plating", cycle: 1, challengeId: "the-gate-warden" }];
  return { s, winner, other: ids[1]! };
}

describe("fairness memory + loot history honesty", () => {
  it("credits the real recipient and no one else", () => {
    const { s, winner, other } = clearedNightWithDrop(3);
    const ledger = commitNightVictory(s);

    expect(ledger.fairness.perAgent[winner]?.received).toBe(1);
    // A raider who received nothing is never credited.
    expect(ledger.fairness.perAgent[other]?.received ?? 0).toBe(0);
    // The fairness record carries its distribution fields.
    expect(typeof ledger.fairness.distributionScore).toBe("number");
    expect(typeof ledger.fairness.disputesResolved).toBe("number");
  });

  it("the consequence loot list is backed by a real reward on a real agent", () => {
    const { s, winner } = clearedNightWithDrop(3);
    const cons = nightConsequences(s);
    const line = cons.loot.find((l) => l.itemId === "gate-warden-plating");
    expect(line).toBeDefined();
    expect(line!.toAgentId).toBe(winner);
    expect(s.org.agents[winner]!.rewardHistory.some((r) => r.itemId === "gate-warden-plating")).toBe(true);
  });

  it("fairness accumulates across nights — receipts sum, never reset", () => {
    const { s, winner } = clearedNightWithDrop(3);
    const l1 = commitNightVictory(s);
    const l2 = commitVictory(l1, nightOf(s));
    expect(l1.fairness.perAgent[winner]!.received).toBe(1);
    expect(l2.fairness.perAgent[winner]!.received).toBe(2);
  });
});
