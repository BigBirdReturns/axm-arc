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
import { buildStartingOrg } from "../../src/sim/cartridge-conformance.js";
import { diagnoseWipe, renderDiagnosis, netGearGain, distributeGap } from "../../src/sim/wipe-diagnosis.js";
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
    challenge, assignedAgents, org, arc, cycle: 0, collectDiagnostics: true,
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
    // #114: no individual is measured against the whole-team bar. Each culprit's
    // shortfall is an attributed SHARE of the actual team gap, so the shares
    // reconcile to the check-level gap and none exceeds it — the old
    // `threshold - individualScore` inflated both (sum far above the team gap).
    const shareSum = dirge!.culprits.reduce((s, c) => s + c.shortfall, 0);
    expect(shareSum).toBeLessThanOrEqual(dirge!.shortfall + 0.1);
    for (const c of dirge!.culprits) expect(c.shortfall).toBeLessThanOrEqual(dirge!.shortfall + 0.1);
  });

  it("distributeGap splits a team gap into exact 0.1 tenths that sum back (issue #114)", () => {
    // the adversarial rounding case: 0.1 across 2 must NOT become [0.1, 0.1]
    expect(distributeGap(0.1, 2)).toEqual([0.1, 0]);
    const shares = distributeGap(2.5, 3);
    expect(shares.reduce((s, x) => s + x, 0)).toBeCloseTo(2.5, 9);
    expect(shares.every((x, i, a) => i === 0 || a[i - 1]! >= x)).toBe(true); // residual to earliest
    expect(distributeGap(0, 3)).toEqual([0, 0, 0]);
    expect(distributeGap(1, 0)).toEqual([]);
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

  it("bench_swap projects the resolver's HALVED gear effect, not the raw stat bonus (issue #109, mirrors the gear lever)", () => {
    const arc = loadArc();
    const strip = (org: Organization) => {
      for (const a of Object.values(org.agents)) a.equippedItems = {};
    };
    // faithful mirror of the module's private inScope()
    const inScopeT = (agent: Agent, check: Challenge["mechanicChecks"][number], challenge: Challenge): boolean => {
      if (check.scope !== "role_specific") return true;
      const reqs = check.roleIds && check.roleIds.length > 0
        ? check.roleIds
        : challenge.rosterRequirements.roleRequirements.map((r) => r.roleId);
      return reqs.includes(agent.role ?? "");
    };

    let asserted = 0;
    for (let s = 1; s <= 40 && asserted === 0; s++) {
      const base = attempt(arc, s, CHOIR, strip);
      if (base.report.outcome !== "failure") continue;
      const d0 = diagnoseWipe(base.report, base.challenge, base.org, arc);
      const primary = d0.failedChecks[0];
      if (!primary) continue;
      const check = base.challenge.mechanicChecks.find((c) => c.id === primary.mechanicId)!;
      // Gear feeds ONLY the dominant attribute (both here and in the resolver),
      // so the item we add must boost exactly it.
      const attr = [...check.attributeWeights].sort((a, b) => b.weight - a.weight)[0]!.attributeId;
      const assigned = new Set(base.report.assignedAgents.map((ar) => ar.agentId));
      const candidate = Object.values(base.org.agents)
        .filter((a) => !assigned.has(a.id) && inScopeT(a, check, base.challenge))
        .sort((a, b) => (a.id < b.id ? -1 : 1))[0];
      if (!candidate) continue;
      const gearItem = arc.items
        .filter((it) => (it.statBonuses[attr] ?? 0) > 0)
        .sort((a, b) => (b.statBonuses[attr] ?? 0) - (a.statBonuses[attr] ?? 0))[0];
      if (!gearItem) continue;
      const B = gearItem.statBonuses[attr]!;

      // Baseline: boost the benched candidate's dominant attr so a bench_swap for
      // it is guaranteed to surface and rank; NO gear yet. Candidate stays benched
      // (legalParty is attribute-independent), so the report is unchanged.
      const baseRun = attempt(arc, s, CHOIR, (org) => {
        strip(org);
        const c = org.agents[candidate.id]!;
        c.attributes[attr] = (c.attributes[attr] ?? 0) + 10;
      });
      const dBase = diagnoseWipe(baseRun.report, baseRun.challenge, baseRun.org, arc);
      const swapBase = dBase.fixes.find((f) => f.lever === "bench_swap" && f.swapAgentId === candidate.id);
      if (!swapBase) continue;

      // Geared: identical, plus ONE dominant-attr item on the same candidate — the
      // only difference between the two runs.
      const gearRun = attempt(arc, s, CHOIR, (org) => {
        strip(org);
        const c = org.agents[candidate.id]!;
        c.attributes[attr] = (c.attributes[attr] ?? 0) + 10;
        c.equippedItems = { [gearItem.slot]: gearItem.id };
      });
      const dGear = diagnoseWipe(gearRun.report, gearRun.challenge, gearRun.org, arc);
      const swapGear = dGear.fixes.find((f) => f.lever === "bench_swap" && f.swapAgentId === candidate.id);
      expect(swapGear).toBeDefined();

      // Adding a +B dominant-attr item raises the candidate's realized check
      // contribution by only B*0.5 (resolver applies gear at half), so the
      // bench_swap's projected gain must rise by B/2 — never the raw B (the exact
      // pre-fix defect this pins).
      const delta = swapGear!.impact - swapBase.impact;
      expect(delta).toBeCloseTo(B * 0.5, 10);
      expect(delta).not.toBeCloseTo(B, 10);
      asserted++;
    }
    // Non-vacuous: the sweep must actually exercise one geared bench_swap.
    expect(asserted).toBeGreaterThan(0);
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
