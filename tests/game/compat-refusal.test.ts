// PR 014 — the compatibility refusal must be honest and legible, never a crash
// and never a guess. Projecting a guild into an INCOMPATIBLE cartridge is
// refused with a report that names exactly which vocabulary dimensions differ
// and offers an honest way out — no partial guild, no invented vocabulary. A
// compatible cartridge (same profile) still projects. No new mechanics.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  newRaidNight, pull, applyFix, commitNightVictory, RAID_ARC_T2, type RaidNightState,
} from "../../src/game/lib/raid-night.js";
import { project, checkCompatibility } from "../../src/game/lib/ledger.js";
import { validateArc } from "../../src/engine/schema.js";

// A real, different cartridge — its own roles/attributes/vocabulary, so its
// compatibility profile differs from first-lockout's.
const severedMarch = validateArc(
  JSON.parse(fs.readFileSync(fileURLToPath(new URL("../../cartridges/severed-march.arc.json", import.meta.url)), "utf8")),
);

function playToClear(seed: number): RaidNightState {
  let s = newRaidNight(seed);
  for (let i = 0; i < 20 && !s.cleared; i++) {
    s = pull(s);
    if (s.cleared) break;
    if (s.diagnosis) s = applyFix(s, s.diagnosis.fixes[0]!);
  }
  return s;
}

// A committed first-lockout guild — its ledger carries first-lockout's profile.
const firstLockoutGuild = commitNightVictory(playToClear(3));

describe("compatibility refusal UX", () => {
  it("refuses an incompatible cartridge — no partial guild, nothing carried", () => {
    const res = project(firstLockoutGuild, severedMarch, 1);
    expect(res.ok).toBe(false);
    expect(res.org).toBeNull();
    expect(res.carried).toEqual({ agents: 0, scars: 0, precedents: 0, gearMemory: 0 });
  });

  it("names exactly which dimensions differ and offers an honest remedy, never a guess", () => {
    const rep = checkCompatibility(firstLockoutGuild, severedMarch);
    expect(rep.compatible).toBe(false);
    expect(rep.verdict).toBe("incompatible");

    const differing = rep.dimensions.filter((d) => !d.match).map((d) => d.dimension);
    expect(differing.length).toBeGreaterThan(0);
    // The player-facing message lists every dimension that differs.
    for (const d of differing) expect(rep.message).toContain(d);
    // A way out is offered — the vocabulary is never guessed or adapted silently.
    expect(rep.remedy).toBe("start-fresh");
    expect(rep.message).toMatch(/no vocabulary is guessed/i);
  });

  it("a compatible cartridge (same profile) still projects the guild in", () => {
    const res = project(firstLockoutGuild, RAID_ARC_T2, 1);
    expect(res.ok).toBe(true);
    expect(res.org).not.toBeNull();
    expect(res.compatibility.verdict).toBe("compatible");
    expect(res.carried.agents).toBeGreaterThan(0);
  });

  it("a null ledger is not a refusal — a fresh guild is generated", () => {
    const rep = checkCompatibility(null, severedMarch);
    expect(rep.verdict).toBe("null-ledger");
    expect(rep.compatible).toBe(true);
    const res = project(null, severedMarch, 1);
    expect(res.ok).toBe(true);
    expect(res.org).not.toBeNull();
  });
});
