// Karazhan completion simulation harness.
//
// Proves (or disproves) that the Karazhan cartridge is finishable, using the
// REAL engine end to end: runCycle for resolution and enforcement,
// challengeAccess for gates, real attunement stamping, real loot, real drama,
// real reputation and progression-tier unlocks. Nothing is faked and no gate
// is bypassed — the harness asserts before every assignment that the chosen
// party legally passes challengeAccess, and counts any engine "locked"
// warning as a violation (expected count: zero, enforced by tests).
//
// This file deliberately lives OUTSIDE the shared surface (src/engine,
// src/arcs) — it is hub-side balance tooling, not engine.
//
// Autoplay policy v0 (documented in docs/balance/KARAZHAN_BALANCE_SIM_REPORT.md):
//   1. Resolve every pending drama card by its first option.
//   2. Resolve pending loot by giving the item to the eligible agent whose
//      role weights the item's biggest bonus most (deterministic tie-break).
//   3. Target the lowest-wing uncleared challenge that is accessible.
//   4. Prefer a party with zero projected-fail checks; otherwise attempt the
//      closest risky party if its worst margin is within RISKY_MARGIN_FLOOR,
//      or after TRAINING_PATIENCE consecutive training cycles.
//   5. Idle (non-party, non-downed) agents train every cycle.
//   6. No recruitment, no facility upgrades, no re-clear farming: gold piles
//      up unspent — reported as an unused lever, not simulated away.

import type { Agent, Arc, Challenge, Facility, InfrastructureFacility, Organization } from "../engine/types.js";
import { runCycle, type ChallengeAssignment, type PendingRewardChoice, type RewardDecision } from "../engine/cycle.js";
import { challengeAccess, completedAttunementChains, unlockedProgressionTierIds } from "../engine/access.js";
import { projectMechanics } from "../engine/projections.js";
import { resolveDramaCard } from "../engine/drama.js";
import { KARAZHAN, KARAZHAN_STARTING_ROSTER } from "../arcs/index.js";

const RISKY_MARGIN_FLOOR = -6;
const TRAINING_PATIENCE = 4;
const STALL_TRAINING_LIMIT = 10;

export interface SimOptions {
  seed: number;
  maxCycles: number;
  /** Run every assignment on the authored heroic mode. */
  heroic?: boolean;
}

export interface AttemptTally {
  success: number;
  partial: number;
  failure: number;
}

export interface RunSimResult {
  seed: number;
  heroic: boolean;
  outcome: "cleared" | "stalled" | "max-cycles";
  cyclesPlayed: number;
  stallReason: string | null;
  stallChallenge: string | null;
  /** challengeId -> first-success cycle. */
  clearCycles: Record<string, number>;
  /** progression tier id -> cycle its requiredChallenges were all cleared. */
  wingClearCycles: Record<string, number | null>;
  attempts: Record<string, AttemptTally>;
  trainingCycles: number;
  riskyAttempts: number;
  dramaResolved: number;
  mastersKeyFirstCycle: number | null;
  mastersKeyHalfRaidCycle: number | null;
  urnCycle: number | null;
  nightbaneAccessCycle: number | null;
  finalReputation: number;
  finalCurrency: number;
  gateViolations: number;
}

function defaultFacilities(): Record<InfrastructureFacility, Facility> {
  const names: InfrastructureFacility[] = [
    "Quarters", "Production", "Recreation", "Research", "Training", "Storage", "Medical",
  ];
  const out: Partial<Record<InfrastructureFacility, Facility>> = {};
  for (const n of names) {
    out[n] = { type: n, level: n === "Quarters" || n === "Recreation" ? 1 : 0, assignedAgents: [] };
  }
  return out as Record<InfrastructureFacility, Facility>;
}

/** Same start the hub's New Game builds for Karazhan, with a per-run seed. */
export function buildKarazhanOrg(seed: number): Organization {
  const agents: Record<string, Agent> = {};
  for (const a of KARAZHAN_STARTING_ROSTER) {
    agents[a.id] = {
      ...a,
      assignmentHistory: [...a.assignmentHistory],
      rewardHistory: [...a.rewardHistory],
      attunements: [...a.attunements],
      equippedItems: { ...a.equippedItems },
      attributes: { ...a.attributes },
      traits: [...a.traits],
    };
  }
  return {
    id: `sim-karazhan-${seed}`,
    name: "Sim Expedition",
    reputation: 0,
    resources: { currency: 150, materials: 0, tokens: 2 },
    infrastructure: defaultFacilities(),
    agents,
    relationships: [],
    precedents: [],
    dramaQueue: [],
    cycle: 0,
    distributionPolicy: "council",
    rngSeed: seed,
  };
}

function clearedChallengeIds(org: Organization): Set<string> {
  const out = new Set<string>();
  for (const agent of Object.values(org.agents)) {
    for (const r of agent.assignmentHistory) {
      if (r.outcome === "success") out.add(r.challengeId);
    }
  }
  return out;
}

function combinations(ids: string[], size: number): string[][] {
  if (size === 0) return [[]];
  if (ids.length < size) return [];
  const [head, ...tail] = ids;
  return [
    ...combinations(tail, size - 1).map((c) => [head!, ...c]),
    ...combinations(tail, size),
  ];
}

interface PartyPlan {
  agentIds: string[];
  failCount: number;
  tightCount: number;
  totalMargin: number;
  worstMargin: number;
}

function evaluateParty(challenge: Challenge, party: Agent[], org: Organization, arc: Arc): PartyPlan {
  const projections = projectMechanics({ challenge, assignedAgents: party, org, arc });
  let failCount = 0;
  let tightCount = 0;
  let totalMargin = 0;
  let worstMargin = Number.POSITIVE_INFINITY;
  for (const p of projections) {
    if (p.assessment === "fail") failCount++;
    if (p.assessment === "tight") tightCount++;
    totalMargin += p.margin;
    if (p.margin < worstMargin) worstMargin = p.margin;
  }
  return { agentIds: party.map((a) => a.id), failCount, tightCount, totalMargin, worstMargin };
}

function betterPlan(a: PartyPlan, b: PartyPlan): boolean {
  if (a.failCount !== b.failCount) return a.failCount < b.failCount;
  if (a.tightCount !== b.tightCount) return a.tightCount < b.tightCount;
  if (a.totalMargin !== b.totalMargin) return a.totalMargin > b.totalMargin;
  return a.agentIds.join() < b.agentIds.join();
}

/** Best legal party for a challenge: satisfies roster roles AND the
 * challenge's attunement gate for the actual party composition. Returns null
 * when no legal combination exists. Deterministic (agents pre-sorted by id). */
export function bestParty(challenge: Challenge, org: Organization, arc: Arc): PartyPlan | null {
  const available = Object.values(org.agents)
    .filter((a) => a.downedUntilCycle === null)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const ids = available.map((a) => a.id);
  const byId = new Map(available.map((a) => [a.id, a]));
  const min = challenge.rosterRequirements.minAgents;
  const max = Math.min(challenge.rosterRequirements.maxAgents, ids.length);
  let best: PartyPlan | null = null;

  for (let size = min; size <= max; size++) {
    for (const combo of combinations(ids, size)) {
      const party = combo.map((id) => byId.get(id)!);
      const rolesOk = challenge.rosterRequirements.roleRequirements.every(
        (req) => party.filter((a) => a.role === req.roleId).length >= req.count,
      );
      if (!rolesOk) continue;
      if (!challengeAccess(challenge, org, arc, combo).accessible) continue;
      const plan = evaluateParty(challenge, party, org, arc);
      if (best === null || betterPlan(plan, best)) best = plan;
    }
  }
  return best;
}

/** Chains this item is the `item_acquire` target of, paired with whether an
 * agent already completes the chain's OTHER steps (so acquiring the item
 * would complete it and open whatever it gates). */
function completesChainOnAcquire(itemId: string, agent: Agent, org: Organization, arc: Arc): boolean {
  for (const chain of arc.attunementChains) {
    const isItemStep = chain.steps.some((s) => s.type === "item_acquire" && s.target === itemId);
    if (!isItemStep) continue;
    const done = completedAttunementChains(agent, org, arc);
    const othersDone = chain.steps.every(
      (s) => (s.type === "item_acquire" && s.target === itemId) || stepAlreadyMet(s, agent, org, done),
    );
    if (othersDone) return true;
  }
  return false;
}

function stepAlreadyMet(
  step: { type: string; target: string },
  agent: Agent,
  org: Organization,
  done: Set<string>,
): boolean {
  switch (step.type) {
    case "challenge_clear":
      return agent.assignmentHistory.some((r) => r.challengeId === step.target && r.outcome === "success");
    case "reputation_threshold":
      return org.reputation >= Number(step.target);
    case "item_acquire":
      return agent.rewardHistory.some((r) => r.itemId === step.target) || Object.values(agent.equippedItems).includes(step.target);
    case "chain_complete":
      return done.has(step.target);
    default:
      return false;
  }
}

function pickLootWinner(choice: PendingRewardChoice, org: Organization, arc: Arc): string {
  const item = arc.items.find((i) => i.id === choice.itemId);
  const eligible = choice.eligibleAgentIds
    .map((id) => org.agents[id])
    .filter((a): a is Agent => a !== undefined)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (eligible.length === 0) return choice.eligibleAgentIds[0] ?? "";
  if (!item) return eligible[0]!.id;

  // First priority — the spec's "loot to unblock the next challenge" rule for
  // gate items: if this item is an attunement-chain step, route it to an
  // eligible agent who already satisfies the chain's OTHER steps, so
  // acquiring it completes the chain and opens what it gates. This is what a
  // competent player does with the Blackened Urn (hand it to a key-attuned
  // raider); role-weight alone would scatter it and never open Nightbane.
  const chainCompleters = eligible.filter((a) => completesChainOnAcquire(item.id, a, org, arc));
  if (chainCompleters.length > 0) return chainCompleters[0]!.id;

  // Otherwise — biggest bonus attribute of the item; winner = eligible agent
  // whose role weights that attribute the most (ties break by id).
  let bestAttr = "";
  let bestBonus = -1;
  for (const [attr, bonus] of Object.entries(item.statBonuses)) {
    if (bonus > bestBonus) { bestBonus = bonus; bestAttr = attr; }
  }
  let winner = eligible[0]!;
  let winnerWeight = -1;
  for (const agent of eligible) {
    const role = arc.roles.find((r) => r.id === agent.role);
    const weight = role?.attributeWeights[bestAttr] ?? 0;
    if (weight > winnerWeight) { winnerWeight = weight; winner = agent; }
  }
  return winner.id;
}

function withTrainingAssignments(org: Organization, partyIds: Set<string>): Organization {
  const idle = Object.values(org.agents)
    .filter((a) => a.downedUntilCycle === null && !partyIds.has(a.id))
    .map((a) => a.id)
    .sort();
  return {
    ...org,
    infrastructure: {
      ...org.infrastructure,
      Training: { ...org.infrastructure.Training, assignedAgents: idle },
    },
  };
}

const CURATOR = KARAZHAN.challenges.find((c) => c.id === "curator")!;
const NIGHTBANE = KARAZHAN.challenges.find((c) => c.id === "nightbane")!;
const FINAL_ID = "magtheridon";

export function simulateKarazhanRun(opts: SimOptions): RunSimResult {
  const arc = KARAZHAN;
  let org = buildKarazhanOrg(opts.seed);
  let pendingChoices: PendingRewardChoice[] = [];

  const attempts: Record<string, AttemptTally> = {};
  const clearCycles: Record<string, number> = {};
  const result: RunSimResult = {
    seed: opts.seed,
    heroic: opts.heroic ?? false,
    outcome: "max-cycles",
    cyclesPlayed: 0,
    stallReason: null,
    stallChallenge: null,
    clearCycles,
    wingClearCycles: Object.fromEntries(arc.progressionTiers.map((t) => [t.id, null])),
    attempts,
    trainingCycles: 0,
    riskyAttempts: 0,
    dramaResolved: 0,
    mastersKeyFirstCycle: null,
    mastersKeyHalfRaidCycle: null,
    urnCycle: null,
    nightbaneAccessCycle: null,
    finalReputation: 0,
    finalCurrency: 0,
    gateViolations: 0,
  };

  let trainingStreak = 0;

  for (let step = 0; step < opts.maxCycles; step++) {
    result.cyclesPlayed = step + 1;

    // 1. Drama: resolve everything, first option, bounded defensively.
    let dramaGuard = 0;
    while (org.dramaQueue.length > 0 && dramaGuard < 25) {
      const card = org.dramaQueue[0]!;
      const option = card.options[0];
      if (!option) break;
      org = resolveDramaCard(org, card.id, option.id, org.cycle).org;
      result.dramaResolved++;
      dramaGuard++;
    }

    // 2. Loot decisions from last cycle's drops.
    const decisions: RewardDecision[] = pendingChoices.map((choice) => ({
      itemId: choice.itemId,
      eligible: choice.eligibleAgentIds,
      winner: pickLootWinner(choice, org, arc),
      sourceChallenge: choice.sourceChallenge,
    }));

    // 3. Candidate targets: lowest wing first, uncleared, tier unlocked,
    //    feasibility-accessible.
    const cleared = clearedChallengeIds(org);
    const unlockedTiers = unlockedProgressionTierIds(org, arc);
    const candidates: Array<{ challenge: Challenge; wing: number }> = [];
    arc.progressionTiers.forEach((tier, wing) => {
      if (!unlockedTiers.has(tier.id)) return;
      for (const id of tier.challenges) {
        if (cleared.has(id)) continue;
        const challenge = arc.challenges.find((c) => c.id === id);
        if (!challenge) continue;
        if (!challengeAccess(challenge, org, arc).accessible) continue;
        candidates.push({ challenge, wing });
      }
    });
    candidates.sort((a, b) => a.wing - b.wing || a.challenge.difficultyRating - b.challenge.difficultyRating);

    // 4. Choose attempt vs train.
    let assignment: ChallengeAssignment | null = null;
    let attemptedRisky = false;
    let reliablePick: { challenge: Challenge; plan: PartyPlan } | null = null;
    let riskyPick: { challenge: Challenge; plan: PartyPlan } | null = null;

    for (const { challenge } of candidates) {
      const plan = bestParty(challenge, org, arc);
      if (!plan) continue;
      if (plan.failCount === 0) { reliablePick = { challenge, plan }; break; }
      if (riskyPick === null || plan.worstMargin > riskyPick.plan.worstMargin) {
        riskyPick = { challenge, plan };
      }
    }

    let pick = reliablePick;
    if (!pick && riskyPick) {
      if (riskyPick.plan.worstMargin >= RISKY_MARGIN_FLOOR || trainingStreak >= TRAINING_PATIENCE) {
        pick = riskyPick;
        attemptedRisky = true;
      }
    }

    if (pick) {
      // Gate honesty assertion: the party we chose must be legal.
      const access = challengeAccess(pick.challenge, org, arc, pick.plan.agentIds);
      if (!access.accessible) {
        result.gateViolations++;
        pick = null;
      }
    }

    if (pick) {
      assignment = {
        challengeId: pick.challenge.id,
        agentIds: pick.plan.agentIds,
        tokensSpent: org.resources.tokens > 0 ? 1 : 0,
        ...(opts.heroic ? { difficultyModeId: "heroic" } : {}),
      };
      trainingStreak = 0;
      if (attemptedRisky) result.riskyAttempts++;
    } else {
      trainingStreak++;
      result.trainingCycles++;
    }

    // 5. Idle agents train.
    const partyIds = new Set(assignment?.agentIds ?? []);
    org = withTrainingAssignments(org, partyIds);

    // 6. Run the cycle through the real engine.
    const cycleResult = runCycle({
      org,
      arc,
      assignments: assignment ? [assignment] : [],
      pendingRewardDecisions: decisions,
    });
    if (cycleResult.warnings.some((w) => w.includes("locked"))) result.gateViolations++;
    org = cycleResult.org;
    pendingChoices = cycleResult.pendingRewardChoices;

    // 7. Bookkeeping.
    for (const report of cycleResult.reports) {
      const tally = (attempts[report.challengeId] ??= { success: 0, partial: 0, failure: 0 });
      tally[report.outcome]++;
      if (report.outcome === "success" && clearCycles[report.challengeId] === undefined) {
        clearCycles[report.challengeId] = report.cycle;
      }
    }
    const clearedNow = clearedChallengeIds(org);
    arc.progressionTiers.forEach((tier) => {
      if (result.wingClearCycles[tier.id] === null && tier.requiredChallenges.every((id) => clearedNow.has(id))) {
        result.wingClearCycles[tier.id] = org.cycle - 1;
      }
    });
    const keyed = Object.values(org.agents).filter((a) => a.attunements.includes("the-masters-key"));
    if (result.mastersKeyFirstCycle === null && keyed.length > 0) result.mastersKeyFirstCycle = org.cycle - 1;
    if (result.mastersKeyHalfRaidCycle === null && keyed.length >= Math.ceil(0.5 * CURATOR.rosterRequirements.minAgents)) {
      result.mastersKeyHalfRaidCycle = org.cycle - 1;
    }
    if (result.urnCycle === null && Object.values(org.agents).some((a) => a.rewardHistory.some((r) => r.itemId === "blackened-urn"))) {
      result.urnCycle = org.cycle - 1;
    }
    if (result.nightbaneAccessCycle === null && challengeAccess(NIGHTBANE, org, arc).accessible) {
      result.nightbaneAccessCycle = org.cycle - 1;
    }

    if (clearedNow.has(FINAL_ID)) {
      result.outcome = "cleared";
      break;
    }

    // 8. Stall detection.
    if (candidates.length === 0) {
      const unclearedAnywhere = arc.challenges.filter((c) => !clearedNow.has(c.id));
      result.outcome = "stalled";
      result.stallChallenge = unclearedAnywhere[0]?.id ?? null;
      result.stallReason = unclearedAnywhere.length === 0
        ? "all challenges cleared but final flag missing"
        : "no uncleared challenge is accessible (tier/milestone/attunement gate unreachable)";
      break;
    }
    if (trainingStreak >= STALL_TRAINING_LIMIT) {
      result.outcome = "stalled";
      result.stallChallenge = candidates[0]?.challenge.id ?? null;
      result.stallReason = `no viable party after ${STALL_TRAINING_LIMIT} consecutive training cycles`;
      break;
    }
  }

  result.finalReputation = org.reputation;
  result.finalCurrency = org.resources.currency;
  return result;
}

// ── Aggregation ───────────────────────────────────────────────────────────────

export interface SimAggregate {
  runs: RunSimResult[];
  seeds: number;
  maxCycles: number;
  heroic: boolean;
  clearRate: number;
  stallRate: number;
  maxCycleRate: number;
  medianWingClear: Record<string, number | null>;
  firstStalls: Record<string, number>;
  stallReasons: Record<string, number>;
  medianMastersKey: number | null;
  medianHalfRaidKey: number | null;
  medianUrn: number | null;
  medianNightbaneAccess: number | null;
  attemptTotals: Record<string, AttemptTally>;
  totalGateViolations: number;
  medianFinalCurrency: number;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

export function aggregateRuns(runs: RunSimResult[], maxCycles: number): SimAggregate {
  const agg: SimAggregate = {
    runs,
    seeds: runs.length,
    maxCycles,
    heroic: runs[0]?.heroic ?? false,
    clearRate: runs.filter((r) => r.outcome === "cleared").length / Math.max(1, runs.length),
    stallRate: runs.filter((r) => r.outcome === "stalled").length / Math.max(1, runs.length),
    maxCycleRate: runs.filter((r) => r.outcome === "max-cycles").length / Math.max(1, runs.length),
    medianWingClear: {},
    firstStalls: {},
    stallReasons: {},
    medianMastersKey: median(runs.map((r) => r.mastersKeyFirstCycle).filter((v): v is number => v !== null)),
    medianHalfRaidKey: median(runs.map((r) => r.mastersKeyHalfRaidCycle).filter((v): v is number => v !== null)),
    medianUrn: median(runs.map((r) => r.urnCycle).filter((v): v is number => v !== null)),
    medianNightbaneAccess: median(runs.map((r) => r.nightbaneAccessCycle).filter((v): v is number => v !== null)),
    attemptTotals: {},
    totalGateViolations: runs.reduce((s, r) => s + r.gateViolations, 0),
    medianFinalCurrency: median(runs.map((r) => r.finalCurrency)) ?? 0,
  };
  for (const tier of KARAZHAN.progressionTiers) {
    agg.medianWingClear[tier.id] = median(
      runs.map((r) => r.wingClearCycles[tier.id]).filter((v): v is number => v !== null && v !== undefined),
    );
  }
  for (const run of runs) {
    if (run.outcome === "stalled") {
      const key = run.stallChallenge ?? "(none)";
      agg.firstStalls[key] = (agg.firstStalls[key] ?? 0) + 1;
      const reason = run.stallReason ?? "(unknown)";
      agg.stallReasons[reason] = (agg.stallReasons[reason] ?? 0) + 1;
    }
    for (const [id, tally] of Object.entries(run.attempts)) {
      const total = (agg.attemptTotals[id] ??= { success: 0, partial: 0, failure: 0 });
      total.success += tally.success;
      total.partial += tally.partial;
      total.failure += tally.failure;
    }
  }
  return agg;
}

export function runSweep(opts: { seeds: number; maxCycles: number; heroic?: boolean }): SimAggregate {
  const runs: RunSimResult[] = [];
  for (let seed = 1; seed <= opts.seeds; seed++) {
    runs.push(simulateKarazhanRun({ seed, maxCycles: opts.maxCycles, heroic: opts.heroic }));
  }
  return aggregateRuns(runs, opts.maxCycles);
}
