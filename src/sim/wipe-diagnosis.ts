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
 *  names the actual agent/item for display; the id fields let a UI APPLY the fix
 *  unambiguously. `attrId` is the attribute a gear/train fix moves. */
export interface Fix {
  lever: "bench_swap" | "gear" | "rest" | "rally" | "train" | "tradeoff";
  description: string;
  target: string;
  cost: string;
  impact: number;
  /** The agent the fix acts on (equip/train/rest/rally target, or the one benched
   *  in a swap). Absent for the no-op re-pull tradeoff. */
  agentId?: string;
  /** The benched agent a swap/composition fix fields. */
  swapAgentId?: string;
  /** The item a gear fix equips. */
  itemId?: string;
  /** The attribute a gear/train fix raises. */
  attrId?: string;
  /** The failed check this fix is aimed at — lets the loop tell, on the next
   *  pull, whether the fixed thing actually mattered. */
  checkId?: string;
  /** The grounded expected consequence, shown BEFORE applying: what this fix is
   *  projected to do to the shortfall it targets. Resolver-derived, not advice. */
  projectedEffect: string;
}

/** The one-line answer to "what KIND of problem was this" — build, role-fit,
 *  stress/morale, gear, or mostly variance. Derived from the deciding factors,
 *  not asserted. */
export interface PrimaryCause {
  kind: "build" | "role-fit" | "stress-morale" | "gear" | "variance";
  note: string;
}

export interface WipeDiagnosis {
  challengeId: string;
  challengeName: string;
  outcome: "success" | "partial" | "failure";
  cleared: boolean;
  primaryCause: PrimaryCause;
  failedChecks: FailedCheckReport[];
  bottlenecks: Bottleneck[];
  fixes: Fix[];
}

// ── capability proxy (roll-free, for ranking candidates only) ─────────────────

function dominantAttr(check: MechanicCheck): string | undefined {
  return [...check.attributeWeights].sort((a, b) => b.weight - a.weight)[0]?.attributeId;
}

/** The role a check is built to lean on — the role whose own dominant attribute
 *  matches the check's. A damage wall's intended role is the striker; blaming
 *  the tank for low damage on it is true but useless. Undefined if no role owns
 *  the check's attribute. */
function intendedRoleId(check: MechanicCheck, arc: Arc): string | undefined {
  const attr = dominantAttr(check);
  if (!attr) return undefined;
  for (const role of arc.roles) {
    const roleAttr = Object.entries(role.attributeWeights).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (roleAttr === attr) return role.id;
  }
  return undefined;
}

function gearBonusFor(agent: Agent, attrId: string | undefined, arc: Arc): number {
  if (!attrId) return 0;
  let g = 0;
  for (const itemId of Object.values(agent.equippedItems)) {
    const item = arc.items.find((it) => it.id === itemId);
    if (item) g += item.statBonuses[attrId] ?? 0;
  }
  // Keep projections on the resolver's scale: getGearBonus applies half of
  // the summed primary-attribute item bonus.
  return g * 0.5;
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
  const checkId = primary.mechanicId;
  const S = round(primary.shortfall);
  // Projected remaining shortfall after a gain of `g` closes part of S.
  const closes = (g: number) => `≈ +${round(g)} on "${primary.mechanicName}" — short ${S} → ~${round(Math.max(0, S - g))}`;

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
      agentId: culprit.id,
      swapAgentId: swapCandidate.a.id,
      checkId,
      projectedEffect: closes(swapCandidate.gain),
    });
  }

  // 2. Gear — an item boosting this check's attribute the culprit could equip.
  if (attr) {
    const tierIdx = arc.tiers.findIndex((t) => t.id === culprit.tier);
    const equipped = new Set(Object.values(culprit.equippedItems));
    const gearCandidate = arc.items
      .filter((it) => !equipped.has(it.id) && (it.statBonuses[attr] ?? 0) > 0)
      .filter((it) => arc.tiers.findIndex((t) => t.id === it.tierRequirement) <= tierIdx)
      .map((item) => {
        const displacedId = culprit.equippedItems[item.slot];
        const displaced = displacedId
          ? arc.items.find((candidate) => candidate.id === displacedId)
          : undefined;
        const candidateBonus = item.statBonuses[attr] ?? 0;
        const displacedBonus = displaced?.statBonuses[attr] ?? 0;
        return {
          item,
          displaced,
          candidateBonus,
          displacedBonus,
          scoreImpact: 0.5 * (candidateBonus - displacedBonus),
        };
      })
      .filter((candidate) => candidate.scoreImpact > 0)
      .sort((a, b) =>
        b.scoreImpact - a.scoreImpact ||
        (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0),
      )[0];
    if (gearCandidate) {
      const replacement = gearCandidate.displaced
        ? `, replacing +${gearCandidate.displacedBonus}`
        : "";
      fixes.push({
        lever: "gear",
        description: `Equip ${gearCandidate.item.name} on ${culprit.name} (+${gearCandidate.candidateBonus}${replacement} ${attr})`,
        target: gearCandidate.item.name,
        cost: "spend a drop / bank stock; someone else waits on that item",
        impact: gearCandidate.scoreImpact,
        agentId: culprit.id,
        itemId: gearCandidate.item.id,
        attrId: attr,
        checkId,
        projectedEffect: closes(gearCandidate.scoreImpact),
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
      agentId: culprit.id,
      checkId,
      projectedEffect: `clears ${culprit.name}'s stress${culprit.afflictionState.kind !== "none" ? ` and the ${culprit.afflictionState.kind} state` : ""} — steadier roll, no raw-power gain`,
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
      agentId: culprit.id,
      checkId,
      projectedEffect: closes(Math.max(0, (60 - culprit.morale) / 10)),
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
      agentId: culprit.id,
      attrId: attr,
      checkId,
      projectedEffect: closes(3 * (check.attributeWeights.find((w) => w.attributeId === attr)?.weight ?? 1)),
    });
  }

  // 6. Tradeoff — shift composition toward the role the check is built to lean
  //    on, naming the cost. Constructible whenever the bench has such a body.
  const intended = intendedRoleId(check, arc);
  const benchIntended = intended
    ? bench
        .filter((a) => a.role === intended)
        .sort((a, b) => expectedContribution(b, check, arc) - expectedContribution(a, check, arc))[0]
    : undefined;
  if (intended && benchIntended) {
    fixes.push({
      lever: "tradeoff",
      description: `Field ${benchIntended.name} (${intended}) and sit a defensive body — more ${attr ?? intended}, thinner safety net`,
      target: benchIntended.name,
      cost: "trade a defensive slot for offense; the sat starter remembers it",
      impact: 1,
      swapAgentId: benchIntended.id,
      attrId: attr,
      checkId,
      projectedEffect: closes(Math.max(1, expectedContribution(benchIntended, check, arc) - culpritExpected)),
    });
  }

  // Guaranteed floor: if fewer than three distinct levers surfaced, add an
  // honest fallback so the readout always offers three moves — never a shrug.
  if (new Set(fixes.map((f) => f.lever)).size < 3 && !fixes.some((f) => f.lever === "tradeoff")) {
    fixes.push({
      lever: "tradeoff",
      description: `Re-pull as composed and accept the wipe risk — bank the attempt, read the next roll`,
      target: culprit.name,
      cost: "a lockout attempt spent; sometimes the honest read is 'the build is close, the dice weren't'",
      impact: 0,
      checkId,
      projectedEffect: "no roster change — a fresh roll on the same party",
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

    // Culprits: for a team check, the weakest of the agents the check is BUILT
    // to lean on (the strikers on a damage wall) — not the tank who was never
    // going to carry it; for per-agent/role, the agents who fell under the line.
    const contributions = [...cd.contributions].sort(
      (a, b) => a.score - b.score || (a.agentId < b.agentId ? -1 : a.agentId > b.agentId ? 1 : 0),
    );
    let failing: typeof contributions;
    if (cd.scope === "team_aggregate") {
      const intended = intendedRoleId(check, arc);
      const onRole = intended
        ? contributions.filter((c) => org.agents[c.agentId]?.role === intended)
        : [];
      failing = (onRole.length > 0 ? onRole : contributions).slice(0, 2);
    } else {
      failing = contributions.filter((c) => c.score < cd.threshold);
    }
    const shortfall =
      cd.scope === "team_aggregate"
        ? cd.threshold - (cd.teamScore ?? 0)
        : Math.max(...failing.map((c) => cd.threshold - c.score), 0);

    const representedShortfall = round(shortfall);
    const teamShares = check.scope === "team_aggregate"
      ? reconcileShortfall(representedShortfall, failing.length)
      : [];
    const culprits: Culprit[] = failing.map((c, index) => {
      const agent = org.agents[c.agentId];
      return {
        agentId: c.agentId,
        name: agent?.name ?? c.agentId,
        role: agent?.role ?? null,
        score: round(c.score),
        threshold: round(cd.threshold),
        // Team culprits partition the represented team gap exactly. An
        // individual row is only an addend, so comparing it with the whole
        // threshold exaggerates the miss; duplicating the team gap across all
        // rows also corrupts bottleneck totals.
        shortfall: check.scope === "team_aggregate"
          ? teamShares[index]!
          : round(cd.threshold - c.score),
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
      shortfall: representedShortfall,
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
    primaryCause: computePrimaryCause(primary, fixes),
    failedChecks,
    bottlenecks,
    fixes,
  };
}

/** The one-line "what KIND of problem is this" answer, derived from the deciding
 *  factors of the worst failed check — never asserted, always from the numbers. */
function computePrimaryCause(primary: FailedCheckReport | undefined, fixes: Fix[]): PrimaryCause {
  if (!primary) return { kind: "build", note: "The party fell short across the board." };
  const S = Math.max(primary.shortfall, 0.001);
  let rollMag = 0, smMag = 0, roleFit = 0, gearMissing = 0;
  for (const c of primary.culprits) {
    for (const f of c.factors) {
      if (f.label === "roll") rollMag += Math.abs(f.value);
      else if (f.label === "morale" || f.label === "affliction") smMag += Math.abs(f.value);
      else if (f.label === "role-fit") roleFit += 1;
      else if (f.label === "gear") gearMissing += 1;
    }
  }
  if (rollMag >= 0.6 * S) {
    return { kind: "variance", note: `The build is close — variance sank it (short ${round(S)}, ~${round(rollMag)} of that was the roll).` };
  }
  if (roleFit > 0) {
    return { kind: "role-fit", note: "Off-role bodies are carrying a check they aren't built for." };
  }
  if (smMag >= 2) {
    return { kind: "stress-morale", note: `Morale/stress dragged about ${round(smMag)} off the line.` };
  }
  const gearFix = fixes.find((f) => f.lever === "gear");
  if (gearMissing > 0 && gearFix) {
    return { kind: "gear", note: `No one's geared for this check — ${gearFix.target} is available.` };
  }
  return { kind: "build", note: `Raw output is short — the party isn't strong enough for this wall yet (short ${round(S)}).` };
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

/** Partition a represented one-decimal total without duplicating it per row.
 * Integer tenths are the source of truth: the returned shares' tenths sum
 * exactly to the represented check shortfall's tenths. Any indivisible
 * remainder goes to the already-deterministically-ordered earliest culprits. */
function reconcileShortfall(total: number, count: number): number[] {
  if (count <= 0) return [];
  const totalTenths = Math.max(0, Math.round(total * 10));
  const baseTenths = Math.floor(totalTenths / count);
  const remainder = totalTenths % count;
  return Array.from(
    { length: count },
    (_, index) => (baseTenths + (index < remainder ? 1 : 0)) / 10,
  );
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
      const scoreLine = fc.scope === "team_aggregate"
        ? `contributed ${c.score}; attributed gap ${c.shortfall}`
        : `${c.score} vs ${c.threshold}`;
      L.push(`      ${c.name} (${c.role ?? "—"}): ${scoreLine}  [stress ${c.stress}, morale ${c.morale}]`);
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
