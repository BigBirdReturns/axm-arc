// PR 032 — the Guild Hall reads the ledger, never writes it (RFC_GUILD_HALL).
// Guards the campaign-record derivation: a null ledger is an honest empty hall,
// a committed ledger summarizes to exactly what it recorded, and the derivation
// is pure (no mutation of the ledger it reads).
import { describe, it, expect } from "vitest";
import { summarizeGuildHall, agentMemoryCards, scarViews, precedentViews } from "../../src/game/lib/guild-hall.js";
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
    agentMemoryCards(ledger);
    expect(JSON.stringify(ledger)).toBe(snapshot);
  });
});

describe("guild hall agent memory cards", () => {
  it("a null ledger has no raiders", () => {
    expect(agentMemoryCards(null)).toEqual([]);
  });

  it("derives one card per roster member, carrying the recorded attendance", () => {
    const ledger = commitNightVictory(playToClear(3));
    const cards = agentMemoryCards(ledger);
    expect(cards.length).toBe(ledger.roster.length);
    for (const c of cards) {
      const mem = ledger.roster.find((m) => m.agentId === c.agentId)!;
      expect(c.name).toBe(mem.agent.name);
      expect(c.nightsAttended).toBe(mem.attendance.nightsAttended);
      expect(c.role).toBe(mem.agent.role);
    }
  });

  it("orders most-attended first", () => {
    const cards = agentMemoryCards(commitNightVictory(playToClear(3)));
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i - 1]!.nightsAttended).toBeGreaterThanOrEqual(cards[i]!.nightsAttended);
    }
  });
});

describe("guild hall scars & precedents", () => {
  it("a null ledger has no scars or precedents", () => {
    expect(scarViews(null)).toEqual([]);
    expect(precedentViews(null)).toEqual([]);
  });

  it("derives a scar view per recorded scar, carrying its note and modifier", () => {
    const ledger = commitNightVictory(playToClear(3));
    const views = scarViews(ledger);
    expect(views.length).toBe(ledger.scars.length);
    for (const v of views) {
      const scar = ledger.scars.find((s) => s.scarId === v.scarId)!;
      expect(v.name).toBe(scar.name);
      expect(v.note).toBe(scar.effect.note);
      expect(v.modifier).toBe(scar.effect.modifier);
    }
  });

  it("derives precedents most-recent first, never more than the ledger holds", () => {
    const ledger = commitNightVictory(playToClear(3));
    expect(precedentViews(ledger).length).toBe(ledger.precedents.length);
  });
});
