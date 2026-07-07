// PR 017 — gear is MEMORY, never stats (RFC_TIER2_LEDGER_SCHEMA Q1). A drop worn
// on a clear is remembered as an attributed, bounded legacy nudge; it never
// carries into the next tier as raw equipped gear that would inflate a stat.
// Guards that boundary. No new mechanics.
import { describe, it, expect } from "vitest";
import {
  newRaidNight, pull, applyFix, commitNightVictory, RAID_ARC_T2, type RaidNightState,
} from "../../src/game/lib/raid-night.js";
import { project, commitVictory } from "../../src/game/lib/ledger.js";

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

/** A cleared night where one raider wore an authored drop. */
function clearedNightWithGear(seed: number) {
  const s = playToClear(seed);
  const agentId = Object.keys(s.org.agents)[0]!;
  s.org.agents[agentId]!.equippedItems = { chest: "gate-warden-plating" };
  return { s, agentId };
}

describe("gear memory: bounded, attributed, never raw stats", () => {
  it("a worn drop is remembered as attributed gear memory on a clear", () => {
    const { s, agentId } = clearedNightWithGear(3);
    const ledger = commitNightVictory(s);

    const gm = ledger.gear.find((g) => g.itemRef.itemId === "gate-warden-plating");
    expect(gm).toBeDefined();
    expect(gm!.itemRef.cartridgeDigest).toMatch(/^cart1_/); // labelled, never a bare id
    expect(gm!.acquiredByAgentId).toBe(agentId);
    expect(gm!.contributedToClear).toBe(true);
  });

  it("its projection is a bounded legacy nudge — memory, not a stat block", () => {
    const { s } = clearedNightWithGear(3);
    const gm = commitNightVictory(s).gear.find((g) => g.itemRef.itemId === "gate-warden-plating")!;
    if (gm.projection.kind === "legacy-readiness-modifier") {
      // A small readiness nudge, never a stat that could inflate a raider.
      expect(Math.abs(gm.projection.modifier)).toBeLessThanOrEqual(3);
    } else {
      expect(["none", "role-identity-signal"]).toContain(gm.projection.kind);
    }
  });

  it("projecting into the next tier strips raw equipped gear — no inflation", () => {
    const { s, agentId } = clearedNightWithGear(3);
    const ledger = commitNightVictory(s);
    const next = project(ledger, RAID_ARC_T2, 1);
    expect(next.ok).toBe(true);
    // The person carries; the raw prior-tier gear does not.
    expect(next.org!.agents[agentId]!.equippedItems).toEqual({});
  });

  it("re-recording the same item on the same agent does not duplicate the memory", () => {
    const { s } = clearedNightWithGear(3);
    const l1 = commitNightVictory(s);
    const l2 = commitVictory(l1, nightOf(s));
    const forItem = l2.gear.filter((g) => g.itemRef.itemId === "gate-warden-plating");
    expect(forItem.length).toBe(1);
  });
});
