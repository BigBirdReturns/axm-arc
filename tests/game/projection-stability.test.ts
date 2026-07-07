// PR 015 — tier-two projection stabilization. The projection that carries a
// guild into the next tier must be deterministic and always yield a legal org,
// so the tier-2 walk (and its browser drill) can never flake on projection
// variance. Also pins the founding invariant: a null-ledger projection is
// byte-identical to a fresh start. No new mechanics.
import { describe, it, expect } from "vitest";
import {
  newRaidNight, pull, applyFix, commitNightVictory, RAID_ARC, RAID_ARC_T2, type RaidNightState,
} from "../../src/game/lib/raid-night.js";
import { project } from "../../src/game/lib/ledger.js";
import { buildStartingOrg } from "../../src/sim/cartridge-conformance.js";

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

describe("tier-two projection stability", () => {
  it("is deterministic — same guild, cartridge, and seed yield an identical org", () => {
    const a = project(guild, RAID_ARC_T2, 7);
    const b = project(guild, RAID_ARC_T2, 7);
    expect(a.ok).toBe(true);
    expect(JSON.stringify(a.org)).toBe(JSON.stringify(b.org));
  });

  it("always yields a legal org that carries every guild member", () => {
    const res = project(guild, RAID_ARC_T2, 7);
    expect(res.ok).toBe(true);
    expect(res.org).not.toBeNull();
    expect(Object.keys(res.org!.agents).length).toBeGreaterThan(0);
    expect(res.carried.agents).toBe(guild.roster.length);
    for (const m of guild.roster) {
      expect(res.org!.agents[m.agentId], `carried member ${m.agentId}`).toBeDefined();
    }
  });

  it("stays legal across seeds — the walk cannot flake on the seed", () => {
    for (const seed of [1, 2, 3, 42, 99]) {
      const res = project(guild, RAID_ARC_T2, seed);
      expect(res.ok, `seed ${seed}`).toBe(true);
      expect(Object.keys(res.org!.agents).length).toBeGreaterThan(0);
    }
  });

  it("a null-ledger projection is byte-identical to a fresh founding start", () => {
    const projected = project(null, RAID_ARC, 5);
    const fresh = buildStartingOrg(RAID_ARC, 5, { rosterSize: 12 });
    expect(projected.ok).toBe(true);
    expect(JSON.stringify(projected.org)).toBe(JSON.stringify(fresh));
  });
});
