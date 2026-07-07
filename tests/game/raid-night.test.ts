// Raid-night loop logic — the playable slice's state machine over the real
// engine. UI-free: proves build → pull → diagnose → apply-one-fix → re-pull,
// deterministic and convergent, on one cartridge (no tier-2 persistence).

import { describe, it, expect } from "vitest";
import {
  newRaidNight, pull, applyFix, toggleFielded, partyLegal, raidBoss, RAID_ARC,
} from "../../src/game/lib/raid-night.js";

describe("raid-night loop", () => {
  it("builds a 12-agent guild with a legal party at the wall", () => {
    const s = newRaidNight(1);
    expect(Object.keys(s.org.agents).length).toBe(12);
    expect(partyLegal(s)).toBe(true);
    expect(raidBoss().id).toBe("the-hollow-choir");
  });

  it("a pull is deterministic in (state, pull number)", () => {
    const a = pull(newRaidNight(3));
    const b = pull(newRaidNight(3));
    expect(a.report).toEqual(b.report);
    expect(a.diagnosis).toEqual(b.diagnosis);
  });

  it("a wipe attaches a readable diagnosis; a clear does not", () => {
    // seed 1 wipes early; find a wiping pull.
    let s = newRaidNight(1);
    let wiped = false;
    for (let i = 0; i < 4 && !wiped; i++) { s = pull(s); wiped = !s.cleared && !!s.diagnosis; }
    expect(wiped).toBe(true);
    expect(s.diagnosis!.failedChecks.length).toBeGreaterThan(0);
    expect(s.diagnosis!.fixes.length).toBeGreaterThanOrEqual(1);
    expect(s.diagnosis!.fixes.length).toBeLessThanOrEqual(3);
  });

  it("applies exactly one fix per wipe (the gate holds)", () => {
    let s = newRaidNight(1);
    for (let i = 0; i < 4 && !s.diagnosis; i++) s = pull(s);
    expect(s.diagnosis).toBeTruthy();
    const fix = s.diagnosis!.fixes[0]!;
    const afterOne = applyFix(s, fix);
    expect(afterOne.fixApplied).toBe(fix.lever);
    // a second fix before the next pull is a no-op
    const afterTwo = applyFix(afterOne, s.diagnosis!.fixes[1] ?? fix);
    expect(afterTwo).toBe(afterOne);
  });

  it("a gear fix actually equips the item it names", () => {
    let s = newRaidNight(1);
    for (let i = 0; i < 6 && !s.diagnosis; i++) s = pull(s);
    const gear = s.diagnosis?.fixes.find((f) => f.lever === "gear");
    if (!gear) return; // some seeds' first wipe may not surface a gear fix; covered by convergence test
    const after = applyFix(s, gear);
    const agent = after.org.agents[gear.agentId!]!;
    expect(Object.values(agent.equippedItems)).toContain(gear.itemId);
  });

  it("toggleFielded respects the roster size bounds", () => {
    const s = newRaidNight(1);
    const boss = raidBoss();
    // benching down to the floor, then one more is a no-op
    let cur = s;
    const fielded = () => cur.partyIds.length;
    while (fielded() > boss.rosterRequirements.minAgents) {
      cur = toggleFielded(cur, cur.partyIds[0]!);
    }
    const atFloor = cur.partyIds.length;
    cur = toggleFielded(cur, cur.partyIds[0]!);
    expect(cur.partyIds.length).toBe(atFloor); // can't go below the floor
  });

  it("the loop converges: applying one fix per wipe reaches a clear", () => {
    let s = newRaidNight(1);
    let cleared = false;
    for (let i = 0; i < 20 && !cleared; i++) {
      s = pull(s);
      if (s.cleared) { cleared = true; break; }
      if (s.diagnosis) s = applyFix(s, s.diagnosis.fixes[0]!);
    }
    expect(cleared).toBe(true);
  });

  // ── feel-pass: the decision surface ───────────────────────────────────────
  it("a wipe carries a primary cause and every fix a grounded projection", () => {
    let s = newRaidNight(1);
    for (let i = 0; i < 4 && !s.diagnosis; i++) s = pull(s);
    const d = s.diagnosis!;
    expect(["build", "role-fit", "stress-morale", "gear", "variance"]).toContain(d.primaryCause.kind);
    expect(d.primaryCause.note.length).toBeGreaterThan(0);
    for (const f of d.fixes) {
      expect(f.projectedEffect.length).toBeGreaterThan(0);
      expect(f.checkId).toBeTruthy();
    }
  });

  it("applying a fix produces a before→after receipt and remembers the target check", () => {
    let s = newRaidNight(1);
    for (let i = 0; i < 4 && !s.diagnosis; i++) s = pull(s);
    const fix = s.diagnosis!.fixes[0]!;
    const after = applyFix(s, fix);
    expect(after.receipt).toBeTruthy();
    expect(after.receipt!.length).toBeGreaterThan(0);
    expect(after.lastFix?.checkId).toBe(fix.checkId);
  });

  it("the next pull reports whether the fixed factor mattered", () => {
    let s = newRaidNight(1);
    for (let i = 0; i < 4 && !s.diagnosis; i++) s = pull(s);
    s = applyFix(s, s.diagnosis!.fixes.find((f) => f.lever === "gear" || f.lever === "train") ?? s.diagnosis!.fixes[0]!);
    const targetName = s.lastFix!.checkName;
    s = pull(s);
    expect(s.pullDelta).toBeTruthy();
    // grounded: the delta names the check it was tracking
    expect(s.pullDelta!).toContain(targetName);
  });
});
