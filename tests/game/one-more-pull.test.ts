// PR 021 — the "one-more-pull" playtest harness, as a replayable regression.
// The operator playtest verdict was: the loop earns one more pull because after
// every wipe there is a legible reason to try again (a fix with a projected
// effect), and applying those fixes converges to a clear. This harness replays
// saved sessions (by seed) and holds that property, deterministically. No new
// mechanics — it exercises the existing loop.
import { describe, it, expect } from "vitest";
import { newRaidNight, pull, applyFix, type RaidNightState } from "../../src/game/lib/raid-night.js";

interface Trajectory {
  seed: number;
  pulls: number;
  wipes: number;
  /** Every wipe offered at least one fix carrying a projected effect. */
  everyWipeGaveAReason: boolean;
  cleared: boolean;
}

/** Replay a saved session: pull, and after each wipe apply the top fix, until a
 *  clear or a hard bound. Records whether every wipe gave a reason to pull again. */
function replay(seed: number, maxPulls = 40): Trajectory {
  let s: RaidNightState = newRaidNight(seed);
  let everyWipeGaveAReason = true;
  let pulls = 0;
  let wipes = 0;
  for (let i = 0; i < maxPulls && !s.cleared; i++) {
    s = pull(s);
    pulls = s.pull;
    if (s.cleared) break;
    if (s.diagnosis) {
      wipes++;
      const fixes = s.diagnosis.fixes;
      // A reason to pull again = at least one fix, and it says what it will change.
      const hasReason = fixes.length >= 1 && fixes.every((f) => f.projectedEffect !== undefined);
      if (!hasReason) everyWipeGaveAReason = false;
      s = applyFix(s, fixes[0]!);
    }
  }
  return { seed, pulls, wipes, everyWipeGaveAReason, cleared: s.cleared };
}

const SEEDS = [1, 2, 3, 5, 7, 11, 42];

describe("one-more-pull playtest harness", () => {
  it("every wipe gives a legible reason to pull again (a fix with a projected effect)", () => {
    for (const seed of SEEDS) {
      const t = replay(seed);
      expect(t.everyWipeGaveAReason, `seed ${seed}`).toBe(true);
    }
  });

  it("applying the offered fixes converges to a clear — the hook pays off", () => {
    for (const seed of SEEDS) {
      const t = replay(seed);
      expect(t.cleared, `seed ${seed} converged in ${t.pulls} pulls`).toBe(true);
    }
  });

  it("replay is deterministic — a saved session re-runs identically", () => {
    for (const seed of SEEDS) {
      expect(replay(seed)).toEqual(replay(seed));
    }
  });

  it("at least one session actually wipes before clearing — the loop is real, not a walkover", () => {
    // If nothing ever wiped, 'one more pull' would be meaningless.
    const anyWiped = SEEDS.some((seed) => replay(seed).wipes > 0);
    expect(anyWiped).toBe(true);
  });
});
