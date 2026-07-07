// PR 013 — "Call It a Night": committing a failed lockout must be an honest,
// non-punishing record. It banks the night's effort, keeps the guild for a
// retry, and does NOT advance the tier gate — a failed night is remembered,
// not erased, and never mistaken for progress. No new mechanics.
import { describe, it, expect } from "vitest";
import {
  newRaidNight, newRaidNightFrom, pull, applyFix,
  commitNightFailed, commitNightVictory, RAID_ARC, type RaidNightState,
} from "../../src/game/lib/raid-night.js";
import type { CampaignLedger } from "../../src/game/lib/ledger.js";

/** A single pull on seed 1 wipes early — a night that did not clear. */
function playToWipe(): RaidNightState {
  return pull(newRaidNight(1));
}

function playToClearFrom(ledger: CampaignLedger | null, seed: number): RaidNightState {
  let s = ledger ? newRaidNightFrom(RAID_ARC, ledger, seed) : newRaidNight(seed);
  for (let i = 0; i < 20 && !s.cleared; i++) {
    s = pull(s);
    if (s.cleared) break;
    if (s.diagnosis) s = applyFix(s, s.diagnosis.fixes[0]!);
  }
  return s;
}

describe("failed-lockout 'Call It a Night' flow", () => {
  it("banks a failed-lockout commit that does not advance the tier", () => {
    const led = commitNightFailed(playToWipe());
    const last = led.commits.at(-1)!;
    expect(last.type).toBe("failed-lockout");
    expect(last.tierAdvanced).toBe(false);
    expect(led.progress.currentTierIndex).toBe(0);
  });

  it("records the night's effort — pulls, wipes, and how close it came", () => {
    const s = playToWipe();
    const led = commitNightFailed(s);
    const last = led.commits.at(-1)!;
    expect(last.pulls).toBe(s.pull);
    expect(last.wipes).toBe(s.wipes);
    expect(last.wipes).toBeGreaterThan(0);
    expect(last.bestPull).toBe(s.bestShortfall);
  });

  it("keeps the guild for a retry — roster carried, no reset", () => {
    const led = commitNightFailed(playToWipe());
    expect(led.roster.length).toBeGreaterThan(0);
  });

  it("a failed night then a clear on the same tier still advances", () => {
    const failed = commitNightFailed(playToWipe());
    expect(failed.progress.currentTierIndex).toBe(0);

    const retry = playToClearFrom(failed, 3);
    expect(retry.cleared).toBe(true);
    const advanced = commitNightVictory(retry);
    // The clear after the failed night is what advances — the failure did not.
    expect(advanced.commits.at(-1)!.tierAdvanced).toBe(true);
    expect(advanced.progress.currentTierIndex).toBeGreaterThan(failed.progress.currentTierIndex);
  });
});
