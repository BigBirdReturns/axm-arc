import type {
  Agent,
  AgentContribution,
  AgentRunResult,
  Arc,
  Challenge,
  CheckDiagnostic,
  LootDrop,
  MechanicCheck,
  MechanicResult,
  Organization,
  RunReport,
  ScoreBreakdown,
} from "./types";
import { AFFLICTION_PENALTIES, RELATIONSHIP_MODS, DEFAULT_TRAIT_POOL } from "./constants";
import { Rng, hashSeed } from "./prng";

export interface ResolveChallengeOpts {
  challenge: Challenge;
  assignedAgents: Agent[];
  org: Organization;
  arc: Arc;
  rng: Rng;
  cycle: number;
  /** Tokens the assignment committed toward the authored resource-spend lever.
   *  Defaults to 0. Honored only when the party clears the same count+role gates
   *  the shell used to offer the option; a no-op otherwise (see steadinessFor). */
  tokensSpent?: number;
  /** When true, the returned RunReport carries a `diagnostics` block capturing
   *  the per-check, per-agent term breakdown behind every score. Off by default
   *  and purely additive — a run with it set is byte-identical to one without,
   *  because it captures values already computed rather than drawing anew. */
  collectDiagnostics?: boolean;
}

function effectiveThreshold(check: MechanicCheck, partySize: number): number {
  return check.scope === "team_aggregate" && check.thresholdMode === "perAssignedAgent"
    ? check.difficultyThreshold * Math.max(1, partySize)
    : check.difficultyThreshold;
}

function getPrimaryAttrId(check: MechanicCheck): string {
  let best = check.attributeWeights[0]!;
  for (const aw of check.attributeWeights) {
    if (aw.weight > best.weight) best = aw;
  }
  return best.attributeId;
}

function getGearBonus(agent: Agent, primaryAttrId: string, arc: Arc): number {
  let bonus = 0;
  for (const [_slot, itemId] of Object.entries(agent.equippedItems)) {
    const item = arc.items.find((it) => it.id === itemId);
    if (item) bonus += item.statBonuses[primaryAttrId] ?? 0;
  }
  return bonus * 0.5;
}

function getRelMod(agent: Agent, others: Agent[], org: Organization): number {
  if (others.length === 0) return 0;
  let total = 0;
  for (const other of others) {
    const rel = org.relationships.find(
      (r) =>
        (r.agentIds[0] === agent.id && r.agentIds[1] === other.id) ||
        (r.agentIds[0] === other.id && r.agentIds[1] === agent.id),
    );
    const state = rel?.state ?? "Neutral";
    total += RELATIONSHIP_MODS[state];
  }
  return total / Math.max(1, others.length);
}

function getAfflictionMod(agent: Agent): number {
  if (agent.afflictionState.kind === "none") return 0;
  const p = AFFLICTION_PENALTIES[agent.afflictionState.kind];
  return p.scoreMod;
}

function getVolatilitySwing(volatility: number, rng: Rng): number {
  if (volatility > 14) return rng.uniform(-5, 10);
  if (volatility > 10) return rng.uniform(-3, 5);
  return 0;
}

/** True when the assigned party clears the contract's hard gates — count within
 *  [minAgents, maxAgents] and every required role covered. Resource-spend is a
 *  strict no-op unless this holds, so a below-gate party resolves identically
 *  with or without spend (gate independence). Mirrors readiness.evaluateParty's
 *  countOk/rolesOk on the world side. */
export function partyClearsGates(challenge: Challenge, assignedAgents: Agent[]): boolean {
  const rr = challenge.rosterRequirements;
  if (new Set(assignedAgents.map((agent) => agent.id)).size !== assignedAgents.length) return false;
  if (assignedAgents.length < rr.minAgents || assignedAgents.length > rr.maxAgents) return false;
  for (const req of rr.roleRequirements) {
    const have = assignedAgents.filter((a) => a.role === req.roleId).length;
    if (have < req.count) return false;
  }
  return true;
}

/** The steadiness factor k ∈ [minSteadiness, 1] applied to a check's SYMMETRIC
 *  mean-zero variance. k = 1 (no effect) when: no lever is authored for the
 *  check, the party fails the gates, or no tokens were spent. Because it only
 *  ever scales mean-zero terms, k leaves the expected score unchanged and can
 *  only narrow the spread — never lift the mean past entitlement. */
function steadinessFor(
  check: MechanicCheck,
  challenge: Challenge,
  gatesOk: boolean,
  tokensSpent: number,
): number {
  const lever = check.resourceSpend ?? challenge.resourceSpend;
  if (!lever || !gatesOk || tokensSpent <= 0) return 1;
  const honored = Math.min(tokensSpent, lever.maxTokens);
  return Math.max(lever.minSteadiness, 1 - lever.steadinessPerToken * honored);
}

function getAllTraits(agent: Agent, arc: Arc) {
  return agent.traits.map((tid) => {
    const t = arc.customTraits.find((c) => c.id === tid) ?? DEFAULT_TRAIT_POOL.find((d) => d.id === tid);
    return t ?? null;
  }).filter(Boolean);
}

function applyTraitBonuses(agent: Agent, check: MechanicCheck, arc: Arc): number {
  let bonus = 0;
  const traits = getAllTraits(agent, arc);
  for (const trait of traits) {
    if (!trait) continue;
    for (const fx of trait.effects) {
      if (fx.kind === "attributeCheckBonus") {
        // apply if attribute is in check weights
        const matchById = check.attributeWeights.some((aw) => aw.attributeId === fx.attributeId);
        const matchByPrecision =
          fx.attributeId === "__precision__" &&
          check.attributeWeights.some((aw) => aw.attributeId.toLowerCase().includes("precision"));
        if (matchById || matchByPrecision) bonus += fx.bonus;
      }
      if (
        fx.kind === "attributeBonusWhenMoraleHigh" &&
        agent.morale > fx.threshold
      ) {
        let attrId = fx.attributeId;
        if (attrId === "__highest__") {
          // find agent's highest attribute
          attrId = Object.entries(agent.attributes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
        }
        if (check.attributeWeights.some((aw) => aw.attributeId === attrId)) {
          bonus += fx.bonus;
        }
      }
    }
  }
  return bonus;
}

function scoreAgent(
  agent: Agent,
  check: MechanicCheck,
  others: Agent[],
  org: Organization,
  arc: Arc,
  rng: Rng,
  steadiness = 1,
  out?: { breakdown?: ScoreBreakdown },
): number {
  const rawScore = check.attributeWeights.reduce((s, aw) => {
    return s + (agent.attributes[aw.attributeId] ?? 0) * aw.weight;
  }, 0);

  const primaryAttrId = getPrimaryAttrId(check);
  const gearBonus = getGearBonus(agent, primaryAttrId, arc);
  const relMod = getRelMod(agent, others, org);
  const moraleMod = (agent.morale - 50) / 10;
  const afflictionMod = getAfflictionMod(agent);
  // Symmetric, mean-zero luck-of-the-roll. The resource-spend lever scales this
  // (and macroVariance) by `steadiness` — never the deterministic terms and
  // never volatilitySwing — so the mean is invariant and only the spread moves.
  // The rng draw is unchanged, so steadiness === 1 is byte-identical to before.
  const variance = rng.uniform(-4, 4) * steadiness;

  // Reckless forces max volatility
  const effectiveVolatility =
    agent.afflictionState.kind === "Reckless" ? 20 : agent.hiddenAttributes.volatility;
  const volatilitySwing = getVolatilitySwing(effectiveVolatility, rng);

  const traitBonus = applyTraitBonuses(agent, check, arc);

  const total =
    rawScore + gearBonus + relMod + moraleMod + afflictionMod + variance + volatilitySwing + traitBonus;

  // Diagnostics capture: only fills the out-param when the caller asked for it.
  // These are the exact terms just summed — no extra rng, no recomputation — so
  // a run with `out` set is byte-identical to one without.
  if (out) {
    out.breakdown = {
      rawScore, gearBonus, relMod, moraleMod, afflictionMod, variance, volatilitySwing, traitBonus, total,
    };
  }

  return total;
}

function timePressureCheck(challenge: Challenge, agents: Agent[], org: Organization, arc: Arc): boolean {
  if (!challenge.timePressure) return true;
  const tp = challenge.timePressure;
  const total = agents.reduce((s, agent) => {
    const attrVal = agent.attributes[tp.attributeId] ?? 0;
    const moraleMod = (agent.morale - 50) / 10;
    // gear bonus for time pressure attr
    let gear = 0;
    for (const [_slot, itemId] of Object.entries(agent.equippedItems)) {
      const item = arc.items.find((it) => it.id === itemId);
      if (item) gear += item.statBonuses[tp.attributeId] ?? 0;
    }
    return s + attrVal + gear * 0.5 + moraleMod;
  }, 0);
  return total * tp.rounds >= tp.aggregateThreshold;
}

function determineOutcome(
  challenge: Challenge,
  agentResults: AgentRunResult[],
  timePassed: boolean,
): "success" | "partial" | "failure" {
  if (!timePassed) return "failure";

  const ct = challenge.completionCriteria.type;
  const params = challenge.completionCriteria.parameters;

  const totalMechanics = challenge.mechanicChecks.length;
  const allPassed = agentResults.every((ar) => ar.mechanicResults.every((mr) => mr.passed));
  const passedCount = agentResults[0]?.mechanicResults.filter((mr) => mr.passed).length ?? 0;

  if (ct === "all_mechanics_passed") {
    return allPassed ? "success" : "partial";
  }
  if (ct === "threshold_passed") {
    const threshold = (params["threshold"] as number) ?? Math.ceil(totalMechanics * 0.5);
    if (allPassed) return "success";
    if (passedCount >= threshold) return "partial";
    return "failure";
  }
  if (ct === "dps_check") {
    return timePassed ? (allPassed ? "success" : "partial") : "failure";
  }
  if (ct === "survival_check") {
    const anyDowned = agentResults.some((ar) => ar.wasDowned);
    if (!anyDowned && allPassed) return "success";
    if (!anyDowned) return "partial";
    return "failure";
  }
  // composite: basic majority rule
  if (allPassed) return "success";
  const majorityPassed = passedCount >= Math.ceil(totalMechanics / 2);
  return majorityPassed ? "partial" : "failure";
}

function rollLoot(
  challenge: Challenge,
  outcome: "success" | "partial" | "failure",
  agents: Agent[],
  arc: Arc,
  rng: Rng,
): LootDrop[] {
  if (outcome === "failure") return [];
  const rewardTable = outcome === "success"
    ? challenge.outcomes.success.rewardTable
    : challenge.outcomes.partial.rewardTable;

  const drops: LootDrop[] = [];
  for (const rewardEntry of rewardTable) {
    const item = arc.items.find((it) => it.id === rewardEntry.itemId);
    if (!item) continue;

    // rng.next() returns [0, 1); strict < ensures dropRate: 0 is a true gate.
    const roll = rng.next();
    if (roll < rewardEntry.dropRate) {
      const eligible = agents.filter((a) => {
        const tierIdx = arc.tiers.findIndex((t) => t.id === a.tier);
        const itemTierIdx = arc.tiers.findIndex((t) => t.id === item.tierRequirement);
        return tierIdx >= itemTierIdx;
      });
      drops.push({ itemId: item.id, eligibleAgents: eligible.map((a) => a.id) });
    }
  }
  return drops;
}

function stressForDifficulty(difficultyRating: number): number {
  if (difficultyRating < 30) return 1;
  if (difficultyRating <= 60) return 2;
  return 3;
}

export function resolveChallenge(opts: ResolveChallengeOpts): RunReport {
  const { challenge, assignedAgents, org, arc, cycle } = opts;

  // Resource-spend: honored only for a party that clears the hard gates (count +
  // roles). Computed once; per-check steadiness is derived from it below.
  const tokensSpent = opts.tokensSpent ?? 0;
  const gatesOk = partyClearsGates(challenge, assignedAgents);

  // Deterministic per-challenge seed
  const seed = hashSeed(org.rngSeed, cycle, challenge.id);
  const rng = new Rng(seed);

  const agentResults: AgentRunResult[] = [];

  // Diagnostics: off by default. When on, we capture each score's term
  // breakdown into per-check entries as the existing loops run — no extra rng,
  // no second pass, so the run stays byte-identical.
  const collectDiag = opts.collectDiagnostics ?? false;
  const checkDiag = new Map<string, CheckDiagnostic>();
  const diagFor = (check: MechanicCheck, threshold: number): CheckDiagnostic => {
    let d = checkDiag.get(check.id);
    if (!d) {
      d = { mechanicId: check.id, scope: check.scope, threshold, passed: true, contributions: [] };
      checkDiag.set(check.id, d);
    }
    return d;
  };

  for (const agent of assignedAgents) {
    const mechanicResults: MechanicResult[] = [];
    const others = assignedAgents.filter((a) => a.id !== agent.id);

    for (const check of challenge.mechanicChecks) {
      let score: number;
      let threshold = effectiveThreshold(check, assignedAgents.length);
      let passed = false;
      // Steadiness for this check: 1 (no effect) unless a lever is authored, the
      // gates hold, and tokens were spent. Scales only the symmetric variance.
      const steadiness = steadinessFor(check, challenge, gatesOk, tokensSpent);

      if (check.scope === "per_agent" || check.scope === "role_specific") {
        if (check.scope === "role_specific") {
          const roleReqs = check.roleIds && check.roleIds.length > 0
            ? check.roleIds
            : challenge.rosterRequirements.roleRequirements.map((r) => r.roleId);
          if (!roleReqs.includes(agent.role ?? "")) {
            // agent not in scope — record as neutral pass
            mechanicResults.push({ mechanicId: check.id, score: threshold, threshold, passed: true });
            continue;
          }
        }
        const cap: { breakdown?: ScoreBreakdown } = {};
        score = scoreAgent(agent, check, others, org, arc, rng, steadiness, collectDiag ? cap : undefined);
        passed = score >= threshold;
        if (collectDiag && cap.breakdown) {
          const d = diagFor(check, threshold);
          d.contributions.push({ agentId: agent.id, score, breakdown: cap.breakdown });
          if (!passed) d.passed = false;
        }
      } else {
        // team_aggregate — compute on first agent, share result
        const existingResult = mechanicResults.find((mr) => mr.mechanicId === check.id);
        if (existingResult) {
          mechanicResults.push({ ...existingResult });
          continue;
        }
        // Sum all agents' individual scores. Note this branch runs once PER
        // assigned agent (mechanicResults is per-agent), so every agent rolls
        // their own version of the aggregate — a down happens when a specific
        // agent catches a failing roll, not on one shared team number.
        const localContribs: AgentContribution[] = [];
        const teamScore = assignedAgents.reduce((s, a) => {
          const cap: { breakdown?: ScoreBreakdown } = {};
          const contribution = scoreAgent(
            a, check, assignedAgents.filter((o) => o.id !== a.id), org, arc, rng, steadiness,
            collectDiag ? cap : undefined,
          );
          if (collectDiag && cap.breakdown) {
            localContribs.push({ agentId: a.id, score: contribution, breakdown: cap.breakdown });
          }
          return s + contribution;
        }, 0);
        // Macro variance prevents large teams from flatlining via law of large
        // numbers. Symmetric and mean-zero, so the lever scales it too.
        const macroVariance = rng.uniform(-3, 3) * (assignedAgents.length / 2) * steadiness;
        score = teamScore + macroVariance;
        threshold = effectiveThreshold(check, assignedAgents.length);
        passed = score >= threshold;
        if (collectDiag) {
          // Keep the WORST of the per-agent rolls (the one that could drop
          // someone) and fail the check if ANY agent's roll failed — so the
          // diagnosis explains the roll that actually mattered, not the last.
          const prior = checkDiag.get(check.id);
          if (!prior) {
            checkDiag.set(check.id, {
              mechanicId: check.id, scope: check.scope, threshold,
              passed, teamScore: score, contributions: localContribs,
            });
          } else {
            if (score < (prior.teamScore ?? Infinity)) {
              prior.teamScore = score;
              prior.threshold = threshold;
              prior.contributions = localContribs;
            }
            if (!passed) prior.passed = false;
          }
        }
      }

      mechanicResults.push({ mechanicId: check.id, score, threshold, passed });
    }

    const passedCount = mechanicResults.filter((mr) => mr.passed).length;
    const performanceRating = mechanicResults.length > 0 ? passedCount / mechanicResults.length : 0;

    const wasDowned = performanceRating === 0 && assignedAgents.length > 1;

    const baseStress = stressForDifficulty(challenge.difficultyRating);
    const stressGained = passedCount < mechanicResults.length ? baseStress : 0;

    agentResults.push({
      agentId: agent.id,
      mechanicResults,
      performanceRating,
      stressGained,
      wasDowned,
      isHeroic: false,
    });
  }

  // Extra stress when any agent is downed
  const anyDowned = agentResults.some((ar) => ar.wasDowned);
  if (anyDowned) {
    for (const ar of agentResults) {
      if (!ar.wasDowned) {
        (ar as { stressGained: number }).stressGained += 2;
      }
    }
  }

  // Deterministic heroic moment: perfect run, zero stress, while team took a beating
  const totalStress = agentResults.reduce((s, ar) => s + ar.stressGained, 0);
  for (const ar of agentResults) {
    if (ar.performanceRating === 1.0 && ar.stressGained === 0 && totalStress >= 5) {
      (ar as { isHeroic: boolean }).isHeroic = true;
    }
  }

  const timePassed = timePressureCheck(challenge, assignedAgents, org, arc);
  const outcome = determineOutcome(challenge, agentResults, timePassed);

  const lootDrops = rollLoot(challenge, outcome, assignedAgents, arc, rng);
  const narrativeSeed = hashSeed(seed, outcome);

  return {
    challengeId: challenge.id,
    outcome,
    cycle,
    assignedAgents: agentResults,
    lootDrops,
    dramaTriggers: [],
    narrativeSeed,
    ...(collectDiag
      ? { diagnostics: { challengeId: challenge.id, checks: [...checkDiag.values()] } }
      : {}),
  };
}
