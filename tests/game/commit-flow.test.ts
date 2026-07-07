// PR 012 — the commit-to-guild-record flow must fold cleanly and never inflate.
// Committing a night into the campaign ledger is the one write that grows the
// guild's memory; this guards its integrity (no new mechanics): the fold is
// immutable, commit sequence is strictly monotonic, attendance accumulates
// across nights, and per-attribute growth is capped (anti-inflation).
import { describe, it, expect } from "vitest";
import { commitVictory } from "../../src/game/lib/ledger.js";
import { newRaidNight, pull, applyFix, type RaidNightState } from "../../src/game/lib/raid-night.js";

// GROWTH_CAP in ledger.ts (module-private): per-attribute lifetime growth ceiling.
const GROWTH_CAP = 6;

function nightOf(s: RaidNightState) {
  return { arc: s.arc, org: s.org, cleared: s.cleared, pulls: s.pull, wipes: s.wipes, bestPull: s.bestShortfall };
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

describe("commit-to-guild-record flow", () => {
  it("the fold is immutable — a prior ledger is never mutated by a later commit", () => {
    const night = nightOf(playToClear(3));
    const l1 = commitVictory(null, night);
    const commitsBefore = l1.commits.length;
    const rosterBefore = l1.roster.length;

    const l2 = commitVictory(l1, night);

    expect(l2).not.toBe(l1);
    // l1 is untouched by the second commit.
    expect(l1.commits.length).toBe(commitsBefore);
    expect(l1.roster.length).toBe(rosterBefore);
    expect(l2.commits.length).toBe(commitsBefore + 1);
  });

  it("commit sequence is strictly monotonic and contiguous", () => {
    const night = nightOf(playToClear(3));
    const l1 = commitVictory(null, night);
    const l2 = commitVictory(l1, night);
    const l3 = commitVictory(l2, night);

    expect(l1.nextCommitSeq).toBe(1);
    expect(l2.nextCommitSeq).toBe(2);
    expect(l3.nextCommitSeq).toBe(3);
    expect(l3.commits.map((c) => c.commitSeq)).toEqual([0, 1, 2]);
  });

  it("attendance accumulates for agents present across nights", () => {
    const night = nightOf(playToClear(3));
    const l1 = commitVictory(null, night);
    const l2 = commitVictory(l1, night);

    const present = l2.roster.filter((m) => night.org.agents[m.agentId]);
    expect(present.length).toBeGreaterThan(0);
    for (const m of present) {
      expect(m.attendance.nightsAttended).toBeGreaterThanOrEqual(2);
      expect(m.attendance.reliability).toBe("reliable");
    }
  });

  it("per-attribute growth is capped — no memory inflates a stat past base + GROWTH_CAP", () => {
    let l = commitVictory(null, nightOf(playToClear(3)));
    for (let i = 0; i < 6; i++) l = commitVictory(l, nightOf(playToClear(3)));

    for (const m of l.roster) {
      for (const [k, v] of Object.entries(m.agent.attributes)) {
        expect(v).toBeLessThanOrEqual((m.growthBase[k] ?? v) + GROWTH_CAP);
      }
    }
  });
});
