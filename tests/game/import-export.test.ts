// PR 020 — the campaign ledger's local-file custody loop. A guild exports to a
// portable file and re-imports from it, byte-for-byte (Constitution Article 3:
// memory belongs to the run; the ledger exports with it). Import never throws:
// garbage is refused with legible errors, never a half-loaded guild.
import { describe, it, expect } from "vitest";
import { exportLedger, importLedger } from "../../src/game/lib/ledger.js";
import {
  newRaidNight, pull, applyFix, commitNightVictory, type RaidNightState,
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

const guild = commitNightVictory(playToClear(3));

describe("campaign ledger import/export (local file custody)", () => {
  it("round-trips a guild through export → import unchanged", () => {
    const { json } = exportLedger(guild);
    const res = importLedger(json);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.ledger).toEqual(guild);
  });

  it("exports to a portable, safe filename", () => {
    const { filename } = exportLedger(guild);
    expect(filename).toMatch(/\.guild\.json$/);
    expect(filename).not.toMatch(/\s/);
  });

  it("refuses malformed JSON with a legible error, never a half-loaded guild", () => {
    const res = importLedger("{ not json");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatch(/JSON parse error/);
  });

  it("refuses a well-formed non-ledger object, naming what is missing", () => {
    const res = importLedger(JSON.stringify({ hello: "world" }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.errors.join(" ")).toMatch(/schemaVersion/);
  });

  it("refuses a cartridge file — a guild is not a game", () => {
    // An arc cartridge is a valid JSON object but not a ledger; it must not import.
    const res = importLedger(JSON.stringify({ meta: { id: "first-lockout" }, challenges: [] }));
    expect(res.ok).toBe(false);
  });
});
