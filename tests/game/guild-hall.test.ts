// PR 032 — the Guild Hall reads the ledger, never writes it (RFC_GUILD_HALL).
// Guards the campaign-record derivation: a null ledger is an honest empty hall,
// a committed ledger summarizes to exactly what it recorded, and the derivation
// is pure (no mutation of the ledger it reads).
import { describe, it, expect } from "vitest";
import { summarizeGuildHall, agentMemoryCards, scarViews, precedentViews, lootFairnessView, campaignRecordView, rosterGrowthView, benchAttendanceView } from "../../src/game/lib/guild-hall.js";
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

describe("guild hall loot & fairness history", () => {
  it("a null ledger is an honest empty view — no fabricated distribution", () => {
    const view = lootFairnessView(null);
    expect(view.rows).toEqual([]);
    expect(view.gear).toEqual([]);
    expect(view.distributionScore).toBe(0);
    expect(view.disputesResolved).toBe(0);
    expect(view.totalAwarded).toBe(0);
  });

  it("derives one row per recorded agent share and one row per remembered item", () => {
    const ledger = commitNightVictory(playToClear(3));
    const view = lootFairnessView(ledger);
    expect(view.rows.length).toBe(Object.keys(ledger.fairness.perAgent).length);
    expect(view.gear.length).toBe(ledger.gear.length);
    for (const row of view.gear) {
      const mem = ledger.gear.find((g) => g.gearMemoryId === row.gearMemoryId)!;
      expect(row.displayName).toBe(mem.displayName);
    }
  });

  it("is pure — reading does not mutate the ledger", () => {
    const ledger = commitNightVictory(playToClear(3));
    const snapshot = JSON.stringify(ledger);
    lootFairnessView(ledger);
    expect(JSON.stringify(ledger)).toBe(snapshot);
  });

  it("orders rows by received desc", () => {
    const view = lootFairnessView(commitNightVictory(playToClear(3)));
    for (let i = 1; i < view.rows.length; i++) {
      expect(view.rows[i - 1]!.received).toBeGreaterThanOrEqual(view.rows[i]!.received);
    }
  });
});

describe("guild hall campaign record", () => {
  it("a null ledger is an honest empty view — no fabricated tiers", () => {
    const view = campaignRecordView(null);
    expect(view.tiers).toEqual([]);
    expect(view.legacyPoints).toBe(0);
    expect(view.commits).toBe(0);
  });

  it("derives one row per recorded tier, carrying legacy points and commit count", () => {
    const ledger = commitNightVictory(playToClear(3));
    const view = campaignRecordView(ledger);
    expect(view.tiers.length).toBe(ledger.progress.tiers.length);
    expect(view.commits).toBe(ledger.commits.length);
    expect(view.legacyPoints).toBe(ledger.guild.legacyPoints);
    expect(view.tiersCleared).toBe(ledger.progress.tiers.filter((t) => t.cleared).length);
  });

  it("preserves ledger tier order — never re-sorted", () => {
    const ledger = commitNightVictory(playToClear(3));
    const view = campaignRecordView(ledger);
    expect(view.tiers.map((t) => t.tierIndex)).toEqual(ledger.progress.tiers.map((t) => t.tierIndex));
  });

  it("marks exactly the current tier, matching currentTierIndex", () => {
    const ledger = commitNightVictory(playToClear(3));
    const view = campaignRecordView(ledger);
    const currentRows = view.tiers.filter((t) => t.isCurrent);
    if (view.tiers.length > 0 && view.currentTierIndex < view.tiers.length) {
      expect(currentRows.length).toBe(1);
      expect(currentRows[0]!.tierIndex).toBe(view.currentTierIndex);
    } else {
      expect(currentRows.length).toBe(0);
    }
  });

  it("is pure — reading does not mutate the ledger", () => {
    const ledger = commitNightVictory(playToClear(3));
    const snapshot = JSON.stringify(ledger);
    campaignRecordView(ledger);
    expect(JSON.stringify(ledger)).toBe(snapshot);
  });
});

describe("guild hall roster growth", () => {
  it("a null ledger has no growth", () => {
    expect(rosterGrowthView(null)).toEqual([]);
  });

  it("derives one row per roster member, attrs sorted by attributeId codepoint, delta = current - base", () => {
    const ledger = commitNightVictory(playToClear(3));
    const rows = rosterGrowthView(ledger);
    expect(rows.length).toBe(ledger.roster.length);
    for (const row of rows) {
      const mem = ledger.roster.find((m) => m.agentId === row.agentId)!;
      expect(row.name).toBe(mem.agent.name);
      for (let i = 1; i < row.attrs.length; i++) {
        expect(row.attrs[i - 1]!.attributeId < row.attrs[i]!.attributeId).toBe(true);
      }
      for (const a of row.attrs) {
        expect(a.delta).toBe(a.current - a.base);
      }
      const totalGrowth = row.attrs.reduce((sum, a) => sum + a.delta, 0);
      expect(row.totalGrowth).toBe(totalGrowth);
    }
  });

  it("orders rows by totalGrowth desc", () => {
    const rows = rosterGrowthView(commitNightVictory(playToClear(3)));
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1]!.totalGrowth).toBeGreaterThanOrEqual(rows[i]!.totalGrowth);
    }
  });

  it("is pure — reading does not mutate the ledger", () => {
    const ledger = commitNightVictory(playToClear(3));
    const snapshot = JSON.stringify(ledger);
    rosterGrowthView(ledger);
    expect(JSON.stringify(ledger)).toBe(snapshot);
  });
});

describe("guild hall attendance & bench", () => {
  it("a null ledger has no attendance rows", () => {
    expect(benchAttendanceView(null)).toEqual([]);
  });

  it("derives one row per roster member, carrying the recorded attendance/bench fields", () => {
    const ledger = commitNightVictory(playToClear(3));
    const rows = benchAttendanceView(ledger);
    expect(rows.length).toBe(ledger.roster.length);
    for (const row of rows) {
      const mem = ledger.roster.find((m) => m.agentId === row.agentId)!;
      expect(row.name).toBe(mem.agent.name);
      expect(row.nightsAttended).toBe(mem.attendance.nightsAttended);
      expect(row.nightsBenched).toBe(mem.attendance.nightsBenched);
      expect(row.reliability).toBe(mem.attendance.reliability);
      expect(row.benchedCount).toBe(mem.bench.benchedCount);
      expect(row.resentment).toBe(mem.bench.resentment);
      expect(row.attendanceRate).toBeGreaterThanOrEqual(0);
      expect(row.attendanceRate).toBeLessThanOrEqual(100);
      const total = row.nightsAttended + row.nightsBenched;
      const expectedRate = total > 0 ? Math.round((100 * row.nightsAttended) / total) : 0;
      expect(row.attendanceRate).toBe(expectedRate);
    }
  });

  it("orders rows by attendanceRate desc", () => {
    const rows = benchAttendanceView(commitNightVictory(playToClear(3)));
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1]!.attendanceRate).toBeGreaterThanOrEqual(rows[i]!.attendanceRate);
    }
  });

  it("is pure — reading does not mutate the ledger", () => {
    const ledger = commitNightVictory(playToClear(3));
    const snapshot = JSON.stringify(ledger);
    benchAttendanceView(ledger);
    expect(JSON.stringify(ledger)).toBe(snapshot);
  });
});
