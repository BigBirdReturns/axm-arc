// Wipe diagnosis — turn a failed raid attempt into "I know what I am changing
// before next reset."
//
// This module reads the RunReport.diagnostics the resolver captures (see
// resolveChallenge's `collectDiagnostics`). It never re-scores the attempt: the
// numbers here are the exact terms the resolver summed, so a diagnosis can
// never disagree with the run it explains. The only recomputed quantity is a
// roll-free EXPECTED contribution used to rank candidate swaps — it is labelled
// "expected" everywhere it appears, because a bench agent who never took the
// pull has no actual roll to report.
//
// The output answers the acceptance question the flagship is tuned against:
// after a wipe, does the player blame the sim, or know their next move? It names
// (1) which check failed, (2) its scope, (3) who materially contributed, (4) the
// one/two bottlenecks, (5) the threshold/roll/gear/morale/trait/role factors
// that decided it, and (6) three concrete fixes drawn from real game state.

import type {
  Agent,
  Arc,
  Challenge,
  CheckDiagnostic,
  MechanicCheck,
  Organization,
  RunReport,
  ScoreBreakdown,
} from "../engine/types";

export interface FactorNote {
  label: string;
  value: number;
  note: string;
}

export interface Culprit {
  agentId: string;
  name: string;
  role: string | null;
  score: number;
  threshold: number;
  shortfall: number;
  stress: number;
  morale: number;
  factors: FactorNote[];
}

export interface FailedCheckReport {
  mechanicId: string;
  mechanicName: string;
  scope: "per_agent" | "role_specific" | "team_aggregate";
  threshold: number;
  teamScore?: number;
  shortfall: number;
  culprits: Culprit[];
}

export interface Bottleneck {
  kind: "agent" | "role";
  label: string;
  reason: string;
  magnitude: number;
}

/** A concrete, state-derived move available before the next pull. `lever` is the
 *  real action class (bench swap, gear, rest, rally, train, tradeoff); `target`
 *  names the actual agent/item; `cost` states the honest price. */
export interface Fix {
  lever: "bench_swap" | "gear" | "rest" | "rally" | "train" | "tradeoff";
  description: string;
  target: string;
  cost: string;
  impact: number;
}

export interface WipeDiagnosis {
  challengeId: string;
  challengeName: string;
  outcome: "success" | "partial" | "failure";
  cleared: boolean;
  failedChecks: FailedCheckReport[];
  bottlenecks: Bottleneck[];
  fixes: Fix[];
}

// ── capability proxy (roll-free, for ranking candidates only) ─────────────────

function dominantAttr(check: MechanicCheck): string | undefined {
  return [...check.attributeWeights].sort((a, b) => b.weight - a.weight)[0]?.attributeId;
}

function gearBonusFor(agent: Agent, attrId: string | undefined, arc: Arc): number {
  if (!attrId) return 0;
  let g = 0;
  for (const itemId of Object.values(agent.equippedItems)) {
    const item = arc.items.find((it) => it.id === itemId);
    if (item) g += item.statBonuses[attrId] ?? 0;
  }
  return g;
}

/** The deterministic mean of an agent's score on a check — raw attribute pull +
 *  equipped gear + morale offset, with no roll. Used ONLY to rank candidate
 *  swaps/reassigns; the actual attempt's numbers come from the resolver. */
function expectedContribution(agent: Agent, check: MechanicCheck, arc: Arc): number {
  const raw = check.attributeWeights.reduce(
    (s, aw) => s + (agent.attributes[aw.attributeId] ?? 0) * aw.weight,
    0,
  );
  const gear = gearBonusFor(agent, dominantAttr(check), arc);
  const morale = (agent.morale - 50) / 10;
  return raw + gear + morale;
}

function inScope(agent: Agent, check: MechanicCheck, challenge: Challenge): boolean {
  if (check.scope !== "role_specific") return true;
  const roleReqs =
    check.roleIds && check.roleIds.length > 0
      ? check.roleIds
      : challenge.rosterRequirements.roleRequirements.map((r) => r.roleId);
  return roleReqs.includes(agent.role ?? "");
}

// ── factor analysis ───────────────────────────────────────────────────────────

/** Surface the terms that actually pushed a culprit under the line, worst
 *  first. Includes the honest "it was mostly the roll" case — variance and
 *  volatility are real factors, and hiding them is how a readout starts lying. */
function factorsFor(
  agent: Agent,
  b: ScoreBreakdown,
  check: MechanicCheck,
  challenge: Challenge,
  arc: Arc,
): FactorNote[] {
  const notes: FactorNote[] = [];
  const roll = b.variance + b.volatilitySwing;

  if (b.moraleMod <= -0.5) {
    notes.push({ label: "morale", value: b.moraleMod, note: `low morale (${agent.morale}/100) cost ${b.moraleMod.toFixed(1)}` });
  }
  if (b.gearBonus <= 0) {
    notes.push({ label: "gear", value: 0, note: "no gear bonus for this check" });
  }
  if (b.afflictionMod < 0) {
    notes.push({ label: "affliction", value: b.afflictionMod, note: `stressed/afflicted (${agent.afflictionState.kind}), ${b.afflictionMod.toFixed(1)}` });
  }
  if (b.traitBonus < 0) {
    notes.push({ label: "trait", value: b.traitBonus, note: `a trait worked against this check (${b.traitBonus.toFixed(1)})` });
  }
  // role / attribute mismatch: the agent's role is built around a different
  // attribute than the one this check leans on.
  const checkAttr = dominantAttr(check);
  const role = arc.roles.find((r) => r.id === agent.role);
  const roleAttr = role
    ? Object.entries(role.attributeWeights).sort((a, b2) => b2[1] - a[1])[0]?.[0]
    : undefined;
  if (checkAttr && roleAttr && checkAttr !== roleAttr && inScope(agent, check, challenge)) {
    notes.push({ label: "role-fit", value: 0, note: `role ${agent.role} is built for ${roleAttr}, this check leans on ${checkAttr}` });
  }
  if (roll <= -3) {
    notes.push({ label: "roll", value: roll, note: `a bad roll (${roll.toFixed(1)}) — variance, not build` });
  }

  return notes.sort((a, b2) => a.value - b2.value).slice(0, 3);
}

// ── fix generation (grounded in real org state) ───────────────────────────────

function generateFixes(
  primary: FailedCheckReport,
  check: MechanicCheck,
  challenge: Challenge,
  org: Organization,
  arc: Arc,
  assignedIds: Set<string>,
): Fix[] {
  const fixes: Fix[] = [];
  const topCulprit = primary.culprits[0];
  if (!topCulprit) return fixes;
  const culprit = org.agents[topCulprit.agentId];
  if (!culprit) return fixes;
  const attr = dominantAttr(check);
  const culpritExpected = expectedContribution(culprit, check, arc);
  const bench = Object.values(org.agents).filter((a) => !assignedIds.has(a.id));

  // 1. Bench swap — a benched, in-scope agent with a higher expected contribution.
  const swapCandidate = bench
    .filter((a) => inScope(a, check, challenge))
    .map((a) => ({ a, gain: expectedContribution(a, check, arc) - culpritExpected }))
    .filter((c) => c.gain > 1)
    .sort((x, y) => y.gain - x.gain)[0];
  if (swapCandidate) {
    fixes.push({
      lever: "bench_swap",
      description: `Bench ${culprit.name} and start ${swapCandidate.a.name} for "${primary.mechanicName}"`,
      target: swapCandidate.a.name,
      cost: `${culprit.name} takes a morale hit for being sat on progression`,
      impact: swapCandidate.gain,
    });
  }

  // 2. Gear — an item boosting this check's attribute the culprit could equip.
  if (attr) {
    const tierIdx = arc.tiers.findIndex((t) => t.id === culprit.tier);
    const equipped = new Set(Object.values(culprit.equippedItems));
    const gearCandidate = arc.items
      .filter((it) => !equipped.has(it.id) && (it.statBonuses[attr] ?? 0) > 0)
      .filter((it) => arc.tiers.findIndex((t) => t.id === it.tierRequirement) <= tierIdx)
      .sort((a, b) => (b.statBonuses[attr] ?? 0) - (a.statBonuses[attr] ?? 0))[0];
    if (gearCandidate) {
      const bonus = gearCandidate.statBonuses[attr] ?? 0;
      fixes.push({
        lever: "gear",
        description: `Equip ${gearCandidate.name} on ${culprit.name} (+${bonus} ${attr})`,
        target: gearCandidate.name,
        cost: "spend a drop / bank stock; someone else waits on that item",
        impact: bonus,
      });
    }
  }

  // 3. Rest — the culprit is carrying stress into the pull.
  if (culprit.stress >= 3 || culprit.afflictionState.kind !== "none") {
    fixes.push({
      lever: "rest",
      description: `Rest ${culprit.name} (stress ${culprit.stress}${culprit.afflictionState.kind !== "none" ? `, ${culprit.afflictionState.kind}` : ""}) before re-pulling`,
      target: culprit.name,
      cost: "they sit the next pull; you run a person short or bench-swap anyway",
      impact: culprit.stress,
    });
  }

  // 4. Rally — the culprit's morale is dragging the score.
  if (culprit.morale < 45) {
    fixes.push({
      lever: "rally",
      description: `Rally ${culprit.name} (morale ${culprit.morale}) to recover the morale penalty`,
      target: culprit.name,
      cost: "costs a cycle / a currency; doesn't fix an underlying gear or fit gap",
      impact: (50 - culprit.morale) / 10,
    });
  }

  // 5. Train — always available; grind the weak attribute for this check.
  if (attr) {
    fixes.push({
      lever: "train",
      description: `Train ${culprit.name}'s ${attr} for "${primary.mechanicName}"`,
      target: culprit.name,
      cost: "a training cycle before the raid; slower than a swap but permanent",
      impact: 2,
    });
  }

  // 6. Tradeoff — field a stronger rookie over a veteran, naming the retention cost.
  const veteran = primary.culprits.find((c) => (org.agents[c.agentId]?.morale ?? 0) >= 60 && (org.agents[c.agentId]?.assignmentHistory.length ?? 0) > 0);
  if (veteran && swapCandidate) {
    fixes.push({
      lever: "tradeoff",
      description: `Field ${swapCandidate.a.name} over veteran ${org.agents[veteran.agentId]?.name} — more readiness, real retention risk`,
      target: org.agents[veteran.agentId]?.name ?? "",
      cost: "the veteran remembers being benched on progression; fairness vs. readiness",
      impact: 0.5,
    });
  }

  // Rank by impact, keep the three sharpest, guarantee variety isn't collapsed
  // to three trains by preferring distinct levers.
  const ranked = fixes.sort((a, b) => b.impact - a.impact);
  const chosen: Fix[] = [];
  const seenLevers = new Set<string>();
  for (const f of ranked) {
    if (seenLevers.has(f.lever)) continue;
    chosen.push(f);
    seenLevers.add(f.lever);
    if (chosen.length === 3) break;
  }
  // Top up from remaining if fewer than three distinct levers existed.
  if (chosen.length < 3) {
    for (const f of ranked) {
      if (chosen.includes(f)) continue;
      chosen.push(f);
      if (chosen.length === 3) break;
    }
  }
  return chosen;
}

// ── the diagnosis ─────────────────────────────────────────────────────────────

export function diagnoseWipe(
  report: RunReport,
  challenge: Challenge,
  org: Organization,
  arc: Arc,
): WipeDiagnosis {
  if (!report.diagnostics) {
    throw new Error(
      "diagnoseWipe requires a RunReport produced with collectDiagnostics: true",
    );
  }
  const assignedIds = new Set(report.assignedAgents.map((ar) => ar.agentId));
  const checkById = new Map(challenge.mechanicChecks.map((c) => [c.id, c]));

  const failedChecks: FailedCheckReport[] = [];
  for (const cd of report.diagnostics.checks) {
    if (cd.passed) continue;
    const check = checkById.get(cd.mechanicId);
    if (!check) continue;

    // Culprits: for a team check, the weakest addends; for per-agent/role, the
    // agents who actually fell under the line.
    const contributions = [...cd.contributions].sort((a, b) => a.score - b.score);
    const failing =
      cd.scope === "team_aggregate"
        ? contributions.slice(0, Math.min(3, contributions.length))
        : contributions.filter((c) => c.score < cd.threshold);
    const shortfall =
      cd.scope === "team_aggregate"
        ? cd.threshold - (cd.teamScore ?? 0)
        : Math.max(...failing.map((c) => cd.threshold - c.score), 0);

    const culprits: Culprit[] = failing.map((c) => {
      const agent = org.agents[c.agentId];
      return {
        agentId: c.agentId,
        name: agent?.name ?? c.agentId,
        role: agent?.role ?? null,
        score: round(c.score),
        threshold: round(cd.threshold),
        shortfall: round(cd.threshold - c.score),
        stress: agent?.stress ?? 0,
        morale: agent?.morale ?? 0,
        factors: agent ? factorsFor(agent, c.breakdown, check, challenge, arc) : [],
      };
    });

    failedChecks.push({
      mechanicId: cd.mechanicId,
      mechanicName: check.name,
      scope: cd.scope,
      threshold: round(cd.threshold),
      teamScore: cd.teamScore !== undefined ? round(cd.teamScore) : undefined,
      shortfall: round(shortfall),
      culprits,
    });
  }

  // Bottlenecks: the agent(s) or role appearing across the most failed checks /
  // with the largest cumulative shortfall.
  const bottlenecks = computeBottlenecks(failedChecks);

  // Fixes: draw from the single worst failed check (the wall within the wall).
  failedChecks.sort((a, b) => b.shortfall - a.shortfall);
  const primary = failedChecks[0];
  const fixes = primary
    ? generateFixes(primary, checkById.get(primary.mechanicId)!, challenge, org, arc, assignedIds)
    : [];

  return {
    challengeId: challenge.id,
    challengeName: challenge.name,
    outcome: report.outcome,
    cleared: report.outcome === "success",
    failedChecks,
    bottlenecks,
    fixes,
  };
}

function computeBottlenecks(failed: FailedCheckReport[]): Bottleneck[] {
  const byAgent = new Map<string, { name: string; role: string | null; count: number; total: number }>();
  const byRole = new Map<string, { count: number; total: number }>();
  for (const fc of failed) {
    for (const c of fc.culprits) {
      const a = byAgent.get(c.agentId) ?? { name: c.name, role: c.role, count: 0, total: 0 };
      a.count += 1;
      a.total += c.shortfall;
      byAgent.set(c.agentId, a);
      if (c.role) {
        const r = byRole.get(c.role) ?? { count: 0, total: 0 };
        r.count += 1;
        r.total += c.shortfall;
        byRole.set(c.role, r);
      }
    }
  }
  const out: Bottleneck[] = [];
  const topAgents = [...byAgent.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 2);
  for (const [, a] of topAgents) {
    out.push({
      kind: "agent",
      label: a.name,
      reason: `under on ${a.count} failed check${a.count > 1 ? "s" : ""}, ${round(a.total)} total shortfall`,
      magnitude: round(a.total),
    });
  }
  const topRole = [...byRole.entries()].sort((a, b) => b[1].total - a[1].total)[0];
  if (topRole && topRole[1].count >= 2) {
    out.push({
      kind: "role",
      label: topRole[0],
      reason: `the ${topRole[0]} line is short across ${topRole[1].count} checks`,
      magnitude: round(topRole[1].total),
    });
  }
  return out.sort((a, b) => b.magnitude - a.magnitude).slice(0, 2);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

// ── readable console render (the "not pretty yet" first pass) ──────────────────

export function renderDiagnosis(d: WipeDiagnosis): string {
  const L: string[] = [];
  if (d.cleared) {
    L.push(`✓ CLEARED — ${d.challengeName}. No wipe to diagnose.`);
    return L.join("\n");
  }
  L.push(`✗ WIPE — ${d.challengeName} (${d.outcome})`);
  L.push("");
  L.push("WHY WE WIPED");
  for (const fc of d.failedChecks) {
    const head =
      fc.scope === "team_aggregate"
        ? `  • "${fc.mechanicName}" [team] — raid put up ${fc.teamScore}, needed ${fc.threshold} (short ${fc.shortfall})`
        : `  • "${fc.mechanicName}" [${fc.scope === "role_specific" ? "role" : "each"}] — needed ${fc.threshold}, ${fc.culprits.length} fell short (worst by ${fc.shortfall})`;
    L.push(head);
    for (const c of fc.culprits.slice(0, 3)) {
      L.push(`      ${c.name} (${c.role ?? "—"}): ${c.score} vs ${c.threshold}  [stress ${c.stress}, morale ${c.morale}]`);
      for (const f of c.factors) L.push(`        └ ${f.note}`);
    }
  }
  L.push("");
  L.push("BOTTLENECK");
  for (const b of d.bottlenecks) L.push(`  ▸ ${b.label} (${b.kind}) — ${b.reason}`);
  L.push("");
  L.push("THREE THINGS YOU CAN CHANGE BEFORE RESET");
  d.fixes.forEach((f, i) => {
    L.push(`  ${i + 1}. [${f.lever}] ${f.description}`);
    L.push(`       cost: ${f.cost}`);
  });
  return L.join("\n");
}

// ── tier-2 persistence note (NOT implemented in this slice) ────────────────────
//
// This slice is one lockout on one cartridge. When tier 2 arrives, the data
// that must PERSIST across raid cartridges (and which this diagnosis already
// reads from live org state) is: each agent's identity, attributes, tier,
// traits, equippedItems, morale, stress, afflictionState, assignmentHistory,
// rewardHistory, and lastClearCycle — plus org.precedents and relationships
// (the grudges/legends). The wipe diagnosis is per-attempt and stateless; it
// needs no persistence of its own. See docs/GUILD_CAMPAIGN.md — cross-cartridge
// guild persistence is the owner-gated RFC, deliberately not built here.
