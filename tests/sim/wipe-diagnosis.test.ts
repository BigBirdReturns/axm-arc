// Wipe-diagnosis acceptance — the flagship's control question made testable:
// after a wipe, does the readout name the failed check, the responsible
// bottleneck, the deciding modifiers, and three real tradeoffs? If it only says
// "you failed," it fails. Everything here runs on ONE cartridge
// (cartridges/first-lockout.arc.json) — no cross-cartridge persistence.
//
// Resolution goes through the real engine (resolveChallenge with
// collectDiagnostics), assigned via the harness's bestParty, so the numbers the
// diagnosis reads are the exact numbers a run produced.

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importArcFromJson } from "../../src/game/lib/arc-library.js";
import { resolveChallenge } from "../../src/engine/resolver.js";
import { Rng } from "../../src/engine/prng.js";
import { buildStartingOrg } from "../../src/sim/cartridge-conformance.js";
import {
  diagnoseWipe,
  distributeGap,
  netGearGain,
  renderDiagnosis,
} from "../../src/sim/wipe-diagnosis.js";
import type { Agent, Arc, Challenge, Organization, RunReport } from "../../src/engine/types.js";

const CHOIR = "the-hollow-choir"; // the wall (survival_check; wipes ~47%)

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(k: string): string | null { return this.store.has(k) ? (this.store.get(k) as string) : null; }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null; }
  removeItem(k: string): void { this.store.delete(k); }
  setItem(k: string, v: string): void { this.store.set(k, v); }
}
beforeEach(() => { globalThis.localStorage = new MemoryStorage(); });

const CARTRIDGE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../cartridges/first-lockout.arc.json",
);
function loadArc(): Arc {
  const r = importArcFromJson(fs.readFileSync(CARTRIDGE_PATH, "utf8"));
  if (!r.ok) throw new Error(`first-lockout import failed: ${r.errors.join("; ")}`);
  return r.entry.arc;
}
function boss(arc: Arc, id: string): Challenge {
  return arc.challenges.find((c) => c.id === id)!;
}

/** A legal-by-roster party (role requirements + size), assigned directly — the
 *  guild is already at the wall, so we skip progression gating (that's what
 *  bestParty enforces, and it's the reachability suite's concern, not the
 *  diagnosis's). Deterministic: agents sorted by id. */
function legalParty(challenge: Challenge, org: Organization): Agent[] {
  const agents = Object.values(org.agents).sort((a, b) => (a.id < b.id ? -1 : 1));
  const size = Math.min(challenge.rosterRequirements.maxAgents, 10);
  const chosen: Agent[] = [];
  for (const req of challenge.rosterRequirements.roleRequirements) {
    for (const a of agents.filter((x) => x.role === req.roleId && !chosen.includes(x)).slice(0, req.count)) {
      chosen.push(a);
    }
  }
  for (const a of agents) {
    if (chosen.length >= size) break;
    if (!chosen.includes(a)) chosen.push(a);
  }
  return chosen.slice(0, size);
}

/** One attempt through the real engine. Returns the org used and the report
 *  (with diagnostics). Optional `mutate` seasons the roster before the pull. */
function attempt(
  arc: Arc,
  seed: number,
  challengeId: string,
  mutate?: (org: Organization) => void,
): { org: Organization; challenge: Challenge; report: RunReport } {
  const org = buildStartingOrg(arc, seed, { rosterSize: 12 });
  if (mutate) mutate(org);
  const challenge = boss(arc, challengeId);
  const assignedAgents = legalParty(challenge, org);
  const report = resolveChallenge({
    challenge, assignedAgents, org, arc, rng: new Rng(0), cycle: 0, collectDiagnostics: true,
  });
  return { org, challenge, report };
}

/** First seed in [1,40] whose best party wipes the given challenge. */
function firstWipeSeed(arc: Arc, challengeId: string): number {
  for (let s = 1; s <= 40; s++) {
    if (attempt(arc, s, challengeId).report.outcome === "failure") return s;
  }
  throw new Error("no wipe seed found in 1..40 for " + challengeId);
}

describe("wipe diagnosis", () => {
  // ── determinism ─────────────────────────────────────────────────────────────
  it("same seed → same wipe diagnosis, twice", () => {
    const arc = loadArc();
    const seed = firstWipeSeed(arc, CHOIR);
    const a = attempt(arc, seed, CHOIR);
    const b = attempt(arc, seed, CHOIR);
    const da = diagnoseWipe(a.report, a.challenge, a.org, arc);
    const db = diagnoseWipe(b.report, b.challenge, b.org, arc);
    expect(da).toEqual(db);
    expect(da.cleared).toBe(false);
  });

  it("changing the seed can produce a different diagnosis", () => {
    const arc = loadArc();
    const diags = new Set<string>();
    let wipes = 0;
    for (let s = 1; s <= 20 && diags.size < 2; s++) {
      const at = attempt(arc, s, CHOIR);
      if (at.report.outcome !== "failure") continue;
      wipes++;
      diags.add(JSON.stringify(diagnoseWipe(at.report, at.challenge, at.org, arc).failedChecks));
    }
    expect(wipes).toBeGreaterThan(1);
    expect(diags.size).toBeGreaterThan(1); // different seeds → not all wipes identical
  });

  // ── failure attribution ─────────────────────────────────────────────────────
  it("a failed role_specific check names the relevant role and agents", () => {
    const arc = loadArc();
    const seed = firstWipeSeed(arc, CHOIR);
    const at = attempt(arc, seed, CHOIR);
    const d = diagnoseWipe(at.report, at.challenge, at.org, arc);
    const chord = d.failedChecks.find((f) => f.mechanicId === "cleanse-the-chord");
    expect(chord).toBeDefined();
    expect(chord!.scope).toBe("role_specific");
    // every culprit named is actually a mender (the check's required role)
    expect(chord!.culprits.length).toBeGreaterThan(0);
    for (const c of chord!.culprits) expect(c.role).toBe("mender");
  });

  it("a team-level failure names aggregate readiness and the weakest contributors", () => {
    const arc = loadArc();
    const seed = firstWipeSeed(arc, CHOIR);
    const at = attempt(arc, seed, CHOIR);
    const d = diagnoseWipe(at.report, at.challenge, at.org, arc);
    const dirge = d.failedChecks.find((f) => f.mechanicId === "break-the-dirge");
    expect(dirge).toBeDefined();
    expect(dirge!.scope).toBe("team_aggregate");
    expect(dirge!.teamScore).toBeDefined();
    expect(dirge!.teamScore!).toBeLessThan(dirge!.threshold); // aggregate fell short
    // culprits are the weakest addends — sorted ascending by score
    const scores = dirge!.culprits.map((c) => c.score);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
  });

  it("a team_aggregate culprit is attributed a share of the real team gap, not measured against an invented bar (issue #110)", () => {
    const arc = loadArc();
    let checked = 0;
    for (let s = 1; s <= 40 && checked < 1; s++) {
      const at = attempt(arc, s, CHOIR);
      if (at.report.outcome !== "failure") continue;
      const d = diagnoseWipe(at.report, at.challenge, at.org, arc);
      const team = d.failedChecks.find((f) => f.scope === "team_aggregate" && f.culprits.length > 0);
      if (!team) continue;

      // The check keeps the authored team threshold and the REAL gap.
      expect(team.teamScore).toBeDefined();
      const teamGap = Math.round((team.threshold - (team.teamScore as number)) * 10) / 10;
      expect(Math.abs(team.shortfall - teamGap)).toBeLessThanOrEqual(0.1);

      for (const c of team.culprits) {
        // No invented per-agent bar: the culprit carries the authored team
        // threshold, not `threshold / partySize` and not a score-relative line.
        expect(c.threshold).toBe(team.threshold);
        // The magnitude is an attributed share of the gap — bounded by it, and
        // NOT the old defect (threshold - score against the whole-team bar).
        expect(c.shortfall).toBeGreaterThanOrEqual(0);
        expect(c.shortfall).toBeLessThanOrEqual(teamGap + 0.1);
        expect(c.shortfall).toBeLessThan(team.threshold - c.score);
      }
      // Attributed shares reconcile EXACTLY with the stored check-level gap at
      // 0.1 precision — not merely within a culprit-count-scaled tolerance.
      const summed = team.culprits.reduce((s, c) => s + c.shortfall, 0);
      expect(Math.round(summed * 10)).toBe(Math.round(team.shortfall * 10));

      checked++;
    }
    expect(checked).toBeGreaterThan(0); // non-vacuous: a real team-check wipe was exercised
  });

  // ── modifiers surface when they matter ──────────────────────────────────────
  it("gear/morale modifiers appear in the diagnosis when they affect the result", () => {
    const arc = loadArc();
    const seed = firstWipeSeed(arc, CHOIR);
    // Fresh roster carries no gear → the "no gear bonus" factor is honest and present.
    const fresh = attempt(arc, seed, CHOIR);
    const dFresh = diagnoseWipe(fresh.report, fresh.challenge, fresh.org, arc);
    const allFactorsFresh = dFresh.failedChecks.flatMap((f) => f.culprits).flatMap((c) => c.factors.map((x) => x.label));
    expect(allFactorsFresh).toContain("gear");

    // Season the menders with low morale → a boss-3 wipe requires a failing
    // mender, so at least one morale-25 mender must surface as a culprit with
    // the morale factor named.
    const seasoned = attempt(arc, seed, CHOIR, (org) => {
      for (const a of Object.values(org.agents)) if (a.role === "mender") a.morale = 25;
    });
    const dSeasoned = diagnoseWipe(seasoned.report, seasoned.challenge, seasoned.org, arc);
    const menderCulprit = dSeasoned.failedChecks
      .flatMap((f) => f.culprits)
      .find((c) => c.role === "mender" && c.morale === 25);
    expect(menderCulprit).toBeDefined();
    expect(menderCulprit!.factors.some((f) => f.label === "morale")).toBe(true);
  });

  // ── fixes are real ──────────────────────────────────────────────────────────
  it("suggested fixes correspond to available actions and current state", () => {
    const arc = loadArc();
    const seed = firstWipeSeed(arc, CHOIR);
    const at = attempt(arc, seed, CHOIR);
    const d = diagnoseWipe(at.report, at.challenge, at.org, arc);
    expect(d.fixes.length).toBeGreaterThanOrEqual(1);
    expect(d.fixes.length).toBeLessThanOrEqual(3);
    const validLevers = new Set(["bench_swap", "gear", "rest", "rally", "train", "tradeoff"]);
    const agentNames = new Set(Object.values(at.org.agents).map((a) => a.name));
    const itemNames = new Set(arc.items.map((i) => i.name));
    for (const f of d.fixes) {
      expect(validLevers.has(f.lever)).toBe(true);
      expect(f.description.length).toBeGreaterThan(0);
      expect(f.cost.length).toBeGreaterThan(0);
      // the target is a real agent or a real item — never invented
      if (f.lever === "gear") expect(itemNames.has(f.target)).toBe(true);
      else expect(agentNames.has(f.target)).toBe(true);
    }
    // distinct levers — not three identical "train" cop-outs
    expect(new Set(d.fixes.map((f) => f.lever)).size).toBe(d.fixes.length);
  });

  it("a gear fix projects the resolver's HALVED gear effect, not the raw stat bonus — empty-slot case (issue #109)", () => {
    const arc = loadArc();
    // Strip everyone's equipped gear so the gear lever always has an
    // equippable, attribute-boosting item to recommend — this guarantees gear
    // fixes surface across the wipe seeds rather than depending on loot RNG.
    // NOTE: with slots empty, net gain equals gross bonus; the occupied-slot
    // (displacement) case is covered by the netGearGain suite below (issue #112).
    const strip = (org: Organization) => {
      for (const a of Object.values(org.agents)) a.equippedItems = {};
    };
    const itemBonus = (itemId: string, attrId: string) =>
      arc.items.find((it) => it.id === itemId)!.statBonuses[attrId] ?? 0;

    let asserted = 0;
    for (let s = 1; s <= 40; s++) {
      const at = attempt(arc, s, CHOIR, strip);
      if (at.report.outcome !== "failure") continue;
      const d = diagnoseWipe(at.report, at.challenge, at.org, arc);
      for (const f of d.fixes) {
        if (f.lever !== "gear" || !f.itemId || !f.attrId) continue;
        const raw = itemBonus(f.itemId, f.attrId);
        // The resolver halves gear in a check contribution; the projected
        // impact must be that halved value, never the raw stat sheet number.
        expect(f.impact).toBeCloseTo(raw * 0.5, 10);
        expect(f.impact).not.toBe(raw); // the exact defect: raw would be double
        // the readout names the halved check effect, not the raw bonus alone
        expect(f.projectedEffect).toContain(`+${Math.round(raw * 0.5 * 10) / 10}`);
        asserted++;
      }
    }
    // Non-vacuous: the sweep must actually exercise at least one gear fix.
    expect(asserted).toBeGreaterThan(0);
  });

  it("the render is a real readout, not 'you failed'", () => {
    const arc = loadArc();
    const seed = firstWipeSeed(arc, CHOIR);
    const at = attempt(arc, seed, CHOIR);
    const text = renderDiagnosis(diagnoseWipe(at.report, at.challenge, at.org, arc));
    expect(text).toContain("WHY WE WIPED");
    expect(text).toContain("BOTTLENECK");
    expect(text).toContain("THREE THINGS YOU CAN CHANGE BEFORE RESET");
    expect(text).not.toMatch(/^you failed\.?$/i);
  });

  // ── the slice needs no persistence ──────────────────────────────────────────
  it("diagnosis is a pure function of one attempt — no cross-cartridge state", () => {
    const arc = loadArc();
    const seed = firstWipeSeed(arc, CHOIR);
    // Two independently built orgs (no shared/persistent state) diagnose the
    // same seed identically: the diagnosis depends only on (report, challenge,
    // org, arc) of a single attempt.
    const a = attempt(arc, seed, CHOIR);
    const b = attempt(arc, seed, CHOIR);
    expect(diagnoseWipe(a.report, a.challenge, a.org, arc))
      .toEqual(diagnoseWipe(b.report, b.challenge, b.org, arc));
  });
});

describe("distributeGap — exact team-gap attribution (issue #110)", () => {
  const sumTenths = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 10);

  it("splits a 0.1 gap over two culprits WITHOUT inflating the ledger", () => {
    // The regression this repair targets: a single rounded quotient gave
    // [0.1, 0.1] (sum 0.2) against a 0.1 gap. Exact attribution gives [0.1, 0].
    const shares = distributeGap(0.1, 2);
    expect(shares).toEqual([0.1, 0]);
    expect(sumTenths(shares)).toBe(1); // sums to EXACTLY the 0.1 gap
  });

  it("shares always sum to exactly round(gap) at 0.1 precision", () => {
    const cases: Array<[number, number]> = [
      [0.1, 2], [0.3, 2], [0.5, 2], [0.7, 3], [1.0, 3], [2.0, 4], [3.7, 2],
    ];
    for (const [gap, parts] of cases) {
      expect(sumTenths(distributeGap(gap, parts))).toBe(Math.round(gap * 10));
    }
  });

  it("is deterministic and hands the residual tenth(s) to the earliest parts", () => {
    expect(distributeGap(0.3, 2)).toEqual([0.2, 0.1]);
    expect(distributeGap(0.7, 3)).toEqual([0.3, 0.2, 0.2]);
  });

  it("handles the degenerate zero / no-parts cases", () => {
    expect(distributeGap(5, 0)).toEqual([]);
    expect(distributeGap(0, 2)).toEqual([0, 0]);
  });
});

describe("netGearGain — a gear fix accounts for slot displacement (issue #112)", () => {
  // Two first-lockout items that share the "trinket" slot with different
  // restoration bonuses, so equipping one displaces the other.
  const OCCUPANT = "menders-steady-hand"; // trinket, restoration 1
  const CANDIDATE = "hollow-chorus-signet"; // trinket, restoration 2

  it("subtracts the displaced item's bonus, not just the candidate's", () => {
    const arc = loadArc();
    const item = (id: string) => arc.items.find((i) => i.id === id)!;
    expect(item(OCCUPANT).slot).toBe(item(CANDIDATE).slot); // a real displacement

    // Occupied slot: net = candidate(2) − displaced(1) = 1, NOT the gross 2.
    const occupied = netGearGain({ [item(CANDIDATE).slot]: OCCUPANT }, item(CANDIDATE), "restoration", arc);
    expect(occupied).toBe(1);
    // The realized check delta is the halved net (resolver applies gear * 0.5).
    expect(occupied * 0.5).toBe(0.5);

    // Empty slot: net equals the gross candidate bonus (the case the sweep test covers).
    expect(netGearGain({}, item(CANDIDATE), "restoration", arc)).toBe(2);
  });

  it("is negative for a downgrade — the lever must not recommend it", () => {
    const arc = loadArc();
    const item = (id: string) => arc.items.find((i) => i.id === id)!;
    // Occupant is the better item; equipping the weaker one is a net loss.
    const net = netGearGain({ [item(OCCUPANT).slot]: CANDIDATE }, item(OCCUPANT), "restoration", arc);
    expect(net).toBe(-1);
  });
});
