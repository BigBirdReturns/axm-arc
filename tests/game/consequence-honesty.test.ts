// PR 011 — the post-clear consequence screen must never lie. The screen shows a
// ConsequenceSet BEFORE anything persists; this guards that what the player sees
// is EXACTLY what commits, that no reward appears that the outcome didn't earn,
// and that every shown loot line is backed by a real reward record. No new
// mechanics — a honesty harness over the existing consequence surface.
import { describe, it, expect } from "vitest";
import {
  newRaidNight, pull, applyFix, nightConsequences, commitNightVictory, commitNightFailed,
  type RaidNightState,
} from "../../src/game/lib/raid-night.js";

/** Play a seed to a clear, applying the first offered fix after each wipe.
 *  Mirrors the proven helper in ledger.test.ts (pull → fix → repeat). */
function playToClear(seed: number): RaidNightState {
  let s = newRaidNight(seed);
  for (let i = 0; i < 20 && !s.cleared; i++) {
    s = pull(s);
    if (s.cleared) break;
    if (s.diagnosis) s = applyFix(s, s.diagnosis.fixes[0]!);
  }
  return s;
}

/** A single pull on seed 1 wipes early — a night that did not clear. */
function playToWipe(): RaidNightState {
  return pull(newRaidNight(1));
}

describe("consequence screen honesty", () => {
  it("what the screen shows is EXACTLY what the commit persists", () => {
    const s = playToClear(3);
    expect(s.cleared).toBe(true);

    const shown = nightConsequences(s);
    const ledger = commitNightVictory(s);
    const committed = ledger.commits.at(-1)!.consequences;

    // Nothing persists that the player did not see, and nothing seen is dropped.
    expect(committed).toEqual(shown);
  });

  it("is deterministic — the same night derives the identical consequence set", () => {
    const s = playToClear(3);
    expect(nightConsequences(s)).toEqual(nightConsequences(s));
  });

  it("earns scars and legends ONLY on a clear — never invented on a wipe", () => {
    const cleared = nightConsequences(playToClear(3));
    expect(cleared.clearedTier).toBe(true);
    expect(cleared.scarsEarned.length).toBeGreaterThan(0);
    expect(cleared.legends.length).toBeGreaterThan(0);

    const wiped = playToWipe();
    expect(wiped.cleared).toBe(false);
    const failedShown = nightConsequences(wiped);
    // A night that did not clear earns no scar and crowns no legend.
    expect(failedShown.clearedTier).toBe(false);
    expect(failedShown.scarsEarned).toEqual([]);
    expect(failedShown.legends).toEqual([]);
    // And the failed commit persists exactly that — no reward smuggled in.
    const failedLedger = commitNightFailed(wiped);
    expect(failedLedger.commits.at(-1)!.consequences.scarsEarned).toEqual([]);
    expect(failedLedger.commits.at(-1)!.consequences.legends).toEqual([]);
  });

  it("every loot line is backed by a real reward record on a real agent", () => {
    const s = playToClear(3);
    const cons = nightConsequences(s);
    for (const line of cons.loot) {
      const agent = line.toAgentId ? s.org.agents[line.toAgentId] : null;
      expect(agent, `loot points at a real agent`).toBeTruthy();
      // The item shown must actually be in that agent's reward history — never invented.
      expect(agent!.rewardHistory.some((r) => r.itemId === line.itemId)).toBe(true);
    }
  });

  it("failed lockout does not advance the tier gate; a victory does", () => {
    const win = commitNightVictory(playToClear(3));
    const lose = commitNightFailed(playToWipe());
    expect(win.commits.at(-1)!.tierAdvanced).toBe(true);
    expect(lose.commits.at(-1)!.tierAdvanced).toBe(false);
  });
});
