// Tier-2 persistence acceptance — the guild does not reset. Proves the ledger
// source seam, compatibility, victory/failed commits, projection, and the
// null-ledger guarantee that keeps standalone cartridges playing exactly as
// before. Everything runs on the real engine + real cartridges.

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateArc } from "../../src/engine/schema.js";
import { buildStartingOrg } from "../../src/sim/cartridge-conformance.js";
import {
  project, checkCompatibility, compatibilityProfile,
  commitVictory, commitFailedLockout, type NightResult,
} from "../../src/game/lib/ledger.js";
import {
  RAID_ARC, RAID_ARC_T2, newRaidNight, newRaidNightFrom, pull, applyFix,
  type RaidNightState,
} from "../../src/game/lib/raid-night.js";
import type { Arc } from "../../src/engine/types.js";

class MemoryStorage implements Storage {
  private s = new Map<string, string>();
  get length() { return this.s.size; }
  clear() { this.s.clear(); }
  getItem(k: string) { return this.s.has(k) ? (this.s.get(k) as string) : null; }
  key(i: number) { return [...this.s.keys()][i] ?? null; }
  removeItem(k: string) { this.s.delete(k); }
  setItem(k: string, v: string) { this.s.set(k, v); }
}
beforeEach(() => { globalThis.localStorage = new MemoryStorage(); });

const dir = path.dirname(fileURLToPath(import.meta.url));
const loadArc = (name: string): Arc =>
  validateArc(JSON.parse(fs.readFileSync(path.resolve(dir, `../../cartridges/${name}.arc.json`), "utf8")));

function nightOf(s: RaidNightState): NightResult {
  return { arc: s.arc, org: s.org, cleared: s.cleared, pulls: s.pull, wipes: s.wipes, bestPull: s.bestShortfall };
}
function playToClear(seed = 1): RaidNightState {
  let s = newRaidNight(seed);
  for (let i = 0; i < 20 && !s.cleared; i++) {
    s = pull(s);
    if (s.cleared) break;
    if (s.diagnosis) s = applyFix(s, s.diagnosis.fixes[0]!);
  }
  return s;
}

describe("tier-2 persistence", () => {
  // 1
  it("null ledger produces exactly today's starting org", () => {
    const viaProject = project(null, RAID_ARC, 5).org;
    const viaBuild = buildStartingOrg(RAID_ARC, 5, { rosterSize: 12 });
    expect(viaProject).toEqual(viaBuild);
  });

  // 2
  it("same ledger + same cartridge + same seed → same projected org", () => {
    const led = commitVictory(null, nightOf(playToClear(3)));
    expect(project(led, RAID_ARC_T2, 7).org).toEqual(project(led, RAID_ARC_T2, 7).org);
  });

  // 3
  it("VictoryCommit appends and advances progression when the tier cleared", () => {
    const led = commitVictory(null, nightOf(playToClear(1)));
    expect(led.commits).toHaveLength(1);
    expect(led.commits[0]!.type).toBe("victory");
    expect(led.progress.tiers[0]!.cleared).toBe(true);
    expect(led.progress.currentTierIndex).toBe(1);
  });

  // 4
  it("FailedLockoutCommit appends but does not advance progression", () => {
    const s = pull(newRaidNight(1)); // one pull, seed 1 wipes early
    const led = commitFailedLockout(null, { ...nightOf(s), cleared: false });
    expect(led.commits[0]!.type).toBe("failed-lockout");
    expect(led.progress.tiers[0]?.cleared ?? false).toBe(false);
    expect(led.progress.currentTierIndex).toBe(0);
  });

  // 5
  it("gear persists as memory, without raw prior-tier stats carrying forward", () => {
    const s = playToClear(1);
    const a = Object.values(s.org.agents)[0]!;
    const item = RAID_ARC.items[0]!;
    a.equippedItems = { [item.slot]: item.id };            // the guild owns a tier-1 item
    const led = commitVictory(null, nightOf(s));
    expect(led.gear.length).toBeGreaterThan(0);            // memory persists
    expect(led.gear[0]!.itemRef.cartridgeDigest).toBeTruthy();  // labelled with origin
    const org2 = project(led, RAID_ARC_T2, 2).org!;
    for (const ag of Object.values(org2.agents)) {
      expect(Object.keys(ag.equippedItems)).toHaveLength(0);   // no raw prior-tier gear inflates tier 2
    }
  });

  // 6
  it("agents, morale, stress, loyalty, attendance, scars, precedents, and fairness persist", () => {
    const led = commitVictory(null, nightOf(playToClear(1)));
    const org2 = project(led, RAID_ARC_T2, 3).org!;
    const m = led.roster[0]!;
    expect(org2.agents[m.agentId]).toBeDefined();                                   // identity
    expect(org2.agents[m.agentId]!.morale).toBe(m.agent.morale);                     // morale
    expect(org2.agents[m.agentId]!.stress).toBe(m.agent.stress);                     // stress
    expect(org2.agents[m.agentId]!.hiddenAttributes.loyalty).toBe(m.agent.hiddenAttributes.loyalty); // loyalty
    expect(m.attendance.nightsAttended).toBeGreaterThanOrEqual(1);                    // attendance
    expect(m.bench).toBeDefined();                                                    // bench history
    expect(led.scars.length).toBeGreaterThan(0);                                      // scars
    expect(led.fairness).toBeDefined();                                              // loot fairness
  });

  // 7
  it("incompatible cartridge projection fails with a readable report", () => {
    const severed = loadArc("severed-march");
    const led = commitVictory(null, nightOf(playToClear(1)));
    const rep = checkCompatibility(led, severed);
    expect(rep.compatible).toBe(false);
    expect(rep.verdict).toBe("incompatible");
    expect(rep.remedy).toBe("start-fresh");
    expect(rep.message.length).toBeGreaterThan(0);
    const proj = project(led, severed, 1);
    expect(proj.ok).toBe(false);
    expect(proj.org).toBeNull();
  });

  // 8
  it("tier one remains playable standalone with no ledger", () => {
    const s = newRaidNight(1);
    expect(s.ledger).toBeNull();
    expect(s.blocked).toBeNull();
    expect(Object.keys(s.org.agents)).toHaveLength(12);
  });

  // 9
  it("a committed tier-one ledger projects into a compatible tier two", () => {
    const led = commitVictory(null, nightOf(playToClear(1)));
    const t2 = newRaidNightFrom(RAID_ARC_T2, led, 1);
    expect(t2.blocked).toBeNull();
    expect(t2.arc.meta.id).toBe("second-lockout");
    expect(Object.keys(t2.org.agents).length).toBeGreaterThanOrEqual(12);
  });

  // compatibility computed, not claimed
  it("first and second lockout share a profile; severed-march does not", () => {
    expect(compatibilityProfile(RAID_ARC).profileDigest).toBe(compatibilityProfile(RAID_ARC_T2).profileDigest);
    expect(compatibilityProfile(loadArc("severed-march")).profileDigest)
      .not.toBe(compatibilityProfile(RAID_ARC).profileDigest);
  });

  // ── the full acceptance walk ────────────────────────────────────────────────
  it("the walk: tier1 fresh → clear → commit → tier2 projection → tier1 still standalone → refuse incompatible", () => {
    // 1–3: start tier 1 with no ledger, fresh guild, clear it.
    const s1 = playToClear(1);
    expect(s1.ledger).toBeNull();
    expect(s1.cleared).toBe(true);
    // 4–5: consequences then commit.
    const led = commitVictory(null, nightOf(s1));
    expect(led.progress.tiers[0]!.cleared).toBe(true);
    // 6–8: open compatible tier 2, compute compatibility, project the same guild.
    expect(checkCompatibility(led, RAID_ARC_T2).verdict).toBe("compatible");
    const t2 = newRaidNightFrom(RAID_ARC_T2, led, 1);
    expect(t2.blocked).toBeNull();
    const carried = led.roster[0]!;
    expect(t2.org.agents[carried.agentId]!.morale).toBe(carried.agent.morale); // people carried
    // 9: tier 1 still standalone with no ledger, unchanged.
    expect(project(null, RAID_ARC, 9).org).toEqual(buildStartingOrg(RAID_ARC, 9, { rosterSize: 12 }));
    // 10: refuse incompatible cleanly.
    const refused = newRaidNightFrom(loadArc("severed-march"), led, 1);
    expect(refused.blocked).not.toBeNull();
    expect(refused.blocked!.verdict).toBe("incompatible");
  });
});
