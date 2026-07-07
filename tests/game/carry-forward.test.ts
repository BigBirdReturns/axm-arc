// PR 019 — the guild carries the PERSON forward: identity, role, traits, and the
// morale/stress they ended the night with — not a reset slate. Attributes carry
// with the same vocabulary and stay within the lifetime growth cap. Guards that
// the projection preserves who a raider is without letting them inflate. No new
// mechanics.
import { describe, it, expect } from "vitest";
import {
  newRaidNight, pull, applyFix, commitNightVictory, RAID_ARC_T2, type RaidNightState,
} from "../../src/game/lib/raid-night.js";
import { project, commitVictory } from "../../src/game/lib/ledger.js";

const GROWTH_CAP = 6; // ledger.ts per-attribute lifetime ceiling

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

describe("agent carry-forward: the person, not a reset", () => {
  it("carries morale and stress the raider ended the night with", () => {
    const s = playToClear(3);
    const id = Object.keys(s.org.agents)[0]!;
    const before = s.org.agents[id]!;
    const morale = before.morale;
    const stress = before.stress;

    const ledger = commitNightVictory(s);
    const projected = project(ledger, RAID_ARC_T2, 1).org!.agents[id]!;

    expect(projected.morale).toBe(morale); // carried, not reset to a default
    expect(projected.stress).toBe(stress);
  });

  it("carries identity — id, role, name, traits", () => {
    const s = playToClear(3);
    const id = Object.keys(s.org.agents)[0]!;
    const before = s.org.agents[id]!;

    const ledger = commitNightVictory(s);
    const projected = project(ledger, RAID_ARC_T2, 1).org!.agents[id]!;

    expect(projected.id).toBe(before.id);
    expect(projected.role).toBe(before.role);
    expect(projected.name).toBe(before.name);
    expect(projected.traits).toEqual(before.traits);
  });

  it("carries attributes with the same vocabulary, capped at base + GROWTH_CAP", () => {
    // Grow the guild across many nights; every carried attribute stays bounded.
    let l = commitNightVictory(playToClear(3));
    for (let i = 0; i < 6; i++) l = commitVictory(l, nightOf(playToClear(3)));

    for (const m of l.roster) {
      const attrs = Object.keys(m.agent.attributes);
      expect(attrs.length).toBeGreaterThan(0); // same attribute vocabulary, not empty
      for (const k of attrs) {
        expect(m.agent.attributes[k]!).toBeLessThanOrEqual((m.growthBase[k] ?? m.agent.attributes[k]!) + GROWTH_CAP);
      }
    }
  });
});
