// PR 032 — the Guild Hall reads the ledger, never writes it (RFC_GUILD_HALL).
// Guards the campaign-record derivation: a null ledger is an honest empty hall,
// a committed ledger summarizes to exactly what it recorded, and the derivation
// is pure (no mutation of the ledger it reads).
import { describe, it, expect } from "vitest";
import { summarizeGuildHall } from "../../src/game/lib/guild-hall.js";
import {
  newRaidNight, pull, applyFix, commitNightVictory, commitNightFailed, type RaidNightState,
} from "../../src/game/lib/raid-night.js";

function playToClear(seed: number): RaidNightState {
  let s = newRaidNight(seed);
  for (let i = 0; i < 20 && !s.cleared; i++) {
    s = pull(s);
    if (s.cleared) break;
    if (s.diagnosis) s = applyFix(s, s.diagnosis.fixes[0]!);
  }
  return s;
}

describe("guild hall summary (read-only)", () => {
  it("a null ledger is an honest empty hall — no fabricated guild", () => {
    const summary = summarizeGuildHall(null);
    expect(summary.hasGuild).toBe(false);
    expect(summary.commits).toBe(0);
    expect(summary.rosterSize).toBe(0);
  });

  it("summarizes a committed guild to exactly what it recorded", () => {
    const ledger = commitNightVictory(playToClear(3));
    const summary = summarizeGuildHall(ledger);
    expect(summary.hasGuild).toBe(true);
    expect(summary.guildName).toBe(ledger.guild.name);
    expect(summary.commits).toBe(ledger.commits.length);
    expect(summary.victories).toBe(ledger.commits.filter((c) => c.type === "victory").length);
    expect(summary.rosterSize).toBe(ledger.roster.length);
    expect(summary.tiersCleared).toBe(ledger.progress.tiers.filter((t) => t.cleared).length);
  });

  it("counts victories and failed lockouts distinctly", () => {
    const failed = commitNightFailed(pull(newRaidNight(1)));
    const summary = summarizeGuildHall(failed);
    expect(summary.failedLockouts).toBe(1);
    expect(summary.victories).toBe(0);
  });

  it("is pure — reading does not mutate the ledger", () => {
    const ledger = commitNightVictory(playToClear(3));
    const snapshot = JSON.stringify(ledger);
    summarizeGuildHall(ledger);
    expect(JSON.stringify(ledger)).toBe(snapshot);
  });
});
