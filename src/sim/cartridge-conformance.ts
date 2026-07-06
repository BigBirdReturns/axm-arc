// Cartridge conformance harness — a reusable, cartridge-agnostic completion
// simulator built directly on the engine's public API (runCycle, access.ts's
// gate derivations, projections.ts's feasibility math, drama.ts's resolution).
//
// This is a generalization of src/sim/karazhan-autoplay.ts: same autoplay
// policy, same "never fake, never bypass a gate" contract, but with every
// karazhan-specific name (KARAZHAN, "magtheridon", the-masters-key tracking,
// ...) replaced by a derivation from the Arc object handed in. Any arc that
// conforms to the engine schema — present cartridges or future ones — can run
// through this unchanged; it takes an already-parsed Arc and never imports
// from a specific cartridge or from a test file.
//
// Autoplay policy v0 (same shape as karazhan-autoplay's, restated generically):
//   1. Resolve every pending drama card by its first option.
//   2. Resolve pending loot: prefer an eligible agent who would complete an
//      attunement chain by acquiring the item (so gate items reach a
//      chain-completer, the way a competent player hands off a key item);
//      otherwise the eligible agent whose role weights the item's biggest
//      bonus attribute most (deterministic tie-break by id).
//   3. Target the lowest-tier uncleared challenge that is accessible.
//   4. Prefer a party with zero projected-fail checks; otherwise attempt the
//      closest risky party if its worst margin is within RISKY_MARGIN_FLOOR,
//      or after TRAINING_PATIENCE consecutive training cycles.
//   5. Idle (non-party, non-downed) agents train every cycle.
//   6. No recruitment, no facility upgrades, no re-clear farming.
//
// Gate honesty is structural, not incidental: every assignment this harness
// proposes is checked against challengeAccess() for the actual chosen party
// before it is submitted, and any engine "locked" warning is counted as a
// violation. Expected count across a conforming arc: zero.

import type {
  Agent,
  Arc,
  ArcTier,
  Challenge,
  Facility,
  InfrastructureFacility,
  Organization,
} from "../engine/types.js";
import { runCycle, type ChallengeAssignment, type PendingRewardChoice, type RewardDecision } from "../engine/cycle.js";
import { challengeAccess, completedAttunementChains, unlockedProgressionTierIds } from "../engine/access.js";
import { projectMechanics } from "../engine/projections.js";
import { resolveDramaCard } from "../engine/drama.js";
import { generateAgent } from "../engine/character.js";
import { Rng, hashSeed } from "../engine/prng.js";

const RISKY_MARGIN_FLOOR = -6;
const TRAINING_PATIENCE = 4;
const STALL_TRAINING_LIMIT = 10;

// ── Starting roster / org construction ───────────────────────────────────────

export interface RosterBuildOptions {
  /** Agents generated per authored role, spread across the arc's tiers from
   *  highest capability to lowest (index 0 gets the top tier, index 1 the
   *  next, ...; extra duplicates repeat the lowest tier). Default 2 — enough
   *  for every present cartridge's largest role requirement to be double-
   *  covered without recruitment. */
  perRole?: number;
  /** Force the total roster size. Default: derived from perRole * roles.length,
   *  topped up (cycling roles, top tier) so the roster is never smaller than
   *  the arc's largest single challenge's maxAgents plus a 2-agent bench —
   *  otherwise even a "clear every requirement" challenge could be
   *  structurally unfilled regardless of tuning. */
  rosterSize?: number;
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

function tiersByCapabilityDesc(arc: Arc): ArcTier[] {
  return [...arc.tiers].sort(
    (a, b) => (b.statBudgetMin + b.statBudgetMax) - (a.statBudgetMin + a.statBudgetMax),
  );
}

function largestRosterRequirement(arc: Arc): number {
  let max = 0;
  for (const c of arc.challenges) max = Math.max(max, c.rosterRequirements.maxAgents);
  return max;
}

/** Deterministic starting roster for an arbitrary arc: `perRole` agents per
 *  authored role (spread top-tier-first across the arc's tiers so at least
 *  one agent per role is capable of the hardest content), topped up with
 *  generic role-cycled agents if the arc's largest single challenge would
 *  otherwise be structurally unfillable. Same construction shape as
 *  karazhan-sim's buildKarazhanOrg / KARAZHAN_STARTING_ROSTER, generalized to
 *  read roles/tiers from the arc instead of a hand-authored spec list. */
export function buildStartingRoster(arc: Arc, seed: number, opts: RosterBuildOptions = {}): Agent[] {
  const perRole = opts.perRole ?? 2;
  const tiersDesc = tiersByCapabilityDesc(arc);
  if (tiersDesc.length === 0) return [];

  const specs: Array<{ tier: ArcTier; roleId: string | null }> = [];
  if (arc.roles.length > 0) {
    for (const role of arc.roles) {
      for (let i = 0; i < perRole; i++) {
        const tier = tiersDesc[Math.min(i, tiersDesc.length - 1)]!;
        specs.push({ tier, roleId: role.id });
      }
    }
  } else {
    for (let i = 0; i < perRole; i++) {
      specs.push({ tier: tiersDesc[Math.min(i, tiersDesc.length - 1)]!, roleId: null });
    }
  }

  const minSize = opts.rosterSize ?? Math.max(specs.length, largestRosterRequirement(arc) + 2);
  let cursor = 0;
  while (specs.length < minSize) {
    const role = arc.roles.length > 0 ? arc.roles[cursor % arc.roles.length]! : undefined;
    specs.push({ tier: tiersDesc[0]!, roleId: role?.id ?? null });
    cursor++;
  }

  const seen = new Set<string>();
  return specs.map((spec, i) => {
    let nonce = 0;
    let agent: Agent;
    do {
      const rng = new Rng(hashSeed(arc.meta.id, "conformance-roster", seed, i, nonce));
      agent = generateAgent({ rng, tier: spec.tier, arc, cycle: 0, preferredRoleId: spec.roleId ?? undefined });
      nonce++;
    } while (seen.has(agent.id));
    seen.add(agent.id);
    return agent;
  });
}

export interface StartingResources {
  currency?: number;
  materials?: number;
  tokens?: number;
}

/** Fresh Organization for `arc`, seeded deterministically — same shape as the
 *  hub's New Game builder (see karazhan-autoplay's buildKarazhanOrg). */
export function buildStartingOrg(
  arc: Arc,
  seed: number,
  rosterOptions?: RosterBuildOptions,
  startingResources?: StartingResources,
): Organization {
  const roster = buildStartingRoster(arc, seed, rosterOptions);
  const agents: Record<string, Agent> = {};
  for (const a of roster) agents[a.id] = a;
  return {
    id: `sim-${arc.meta.id}-${seed}`,
    name: "Sim Organization",
    reputation: 0,
    resources: {
      currency: startingResources?.currency ?? 150,
      materials: startingResources?.materials ?? 0,
      tokens: startingResources?.tokens ?? 2,
    },
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

// ── Party selection (feasibility-driven, deterministic) ──────────────────────

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
 *  challenge's attunement gate for the actual party composition. Returns null
 *  when no legal combination exists. Deterministic (agents pre-sorted by id).
 *  Identical algorithm to karazhan-sim's bestParty, arc-generic already. */
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
 *  agent already completes the chain's OTHER steps (so acquiring the item
 *  would complete it and open whatever it gates). Arc-generic: reads only
 *  arc.attunementChains, never a specific chain/item id. */
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

  const chainCompleters = eligible.filter((a) => completesChainOnAcquire(item.id, a, org, arc));
  if (chainCompleters.length > 0) return chainCompleters[0]!.id;

  let bestAttr = "";
  let bestBonus = -1;
  for (const [attr, bonus] of Object.entries(item.statBonuses)) {
    if (bonus > bestBonus) { bestAttr = attr; bestBonus = bonus; }
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

// ── Run simulation ────────────────────────────────────────────────────────────

export interface ConformanceOptions {
  seed: number;
  maxCycles: number;
  /** Resolve every assignment against this arc-authored difficulty mode id
   *  (generalizes karazhan-sim's `heroic` flag to any arc's difficultyModes). */
  difficultyModeId?: string;
  rosterOptions?: RosterBuildOptions;
  startingResources?: StartingResources;
}

export interface AttemptTally {
  success: number;
  partial: number;
  failure: number;
}

export interface CycleLogEntry {
  cycle: number;
  assignedChallengeId: string | null;
  outcome: "success" | "partial" | "failure" | null;
}

export interface ConformanceRunResult {
  seed: number;
  difficultyModeId: string | null;
  outcome: "cleared" | "stalled" | "max-cycles";
  cyclesPlayed: number;
  stallReason: string | null;
  stallChallenge: string | null;
  /** challengeId -> first-success cycle. */
  clearCycles: Record<string, number>;
  /** progressionTier id -> cycle its unlockConditions first held. */
  tierUnlockCycles: Record<string, number | null>;
  /** progressionTier id -> cycle its requiredChallenges were all cleared. */
  tierClearCycles: Record<string, number | null>;
  /** attunementChain id -> cycle any agent first held it. */
  attunementCycles: Record<string, number | null>;
  attempts: Record<string, AttemptTally>;
  trainingCycles: number;
  riskyAttempts: number;
  dramaResolved: number;
  finalReputation: number;
  finalCurrency: number;
  /** Count of proposed assignments this harness itself refused to submit
   *  because challengeAccess() rejected the chosen party, PLUS any engine
   *  "locked" warning runCycle emitted. Expected: 0 for a conforming arc —
   *  any nonzero value means a gate was bypassed somewhere. */
  gateViolations: number;
  /** Raw engine warnings collected across the whole run (for diagnosing any
   *  non-gate warning, e.g. a malformed reward/difficulty-mode reference). */
  warnings: string[];
  /** Per-cycle record of what was attempted and how it resolved. */
  cycleLog: CycleLogEntry[];
}

function arcCleared(arc: Arc, cleared: Set<string>): boolean {
  return arc.progressionTiers.every((tier) => tier.requiredChallenges.every((id) => cleared.has(id)));
}

/** Deterministic completion-simulation run for an arbitrary arc, seeded and
 *  bounded by maxCycles. Uses the REAL engine end to end (runCycle for
 *  resolution/enforcement, challengeAccess for gates, real attunement
 *  stamping, real loot, real drama) — nothing is faked and no gate is
 *  bypassed by construction (see gateViolations). This is the cartridge-
 *  agnostic generalization of karazhan-sim's simulateKarazhanRun. */
export function simulateArcRun(arc: Arc, opts: ConformanceOptions): ConformanceRunResult {
  let org = buildStartingOrg(arc, opts.seed, opts.rosterOptions, opts.startingResources);
  let pendingChoices: PendingRewardChoice[] = [];

  const attempts: Record<string, AttemptTally> = {};
  const clearCycles: Record<string, number> = {};
  const warnings: string[] = [];
  const cycleLog: CycleLogEntry[] = [];
  const result: ConformanceRunResult = {
    seed: opts.seed,
    difficultyModeId: opts.difficultyModeId ?? null,
    outcome: "max-cycles",
    cyclesPlayed: 0,
    stallReason: null,
    stallChallenge: null,
    clearCycles,
    tierUnlockCycles: Object.fromEntries(arc.progressionTiers.map((t) => [t.id, null])),
    tierClearCycles: Object.fromEntries(arc.progressionTiers.map((t) => [t.id, null])),
    attunementCycles: Object.fromEntries(arc.attunementChains.map((c) => [c.id, null])),
    attempts,
    trainingCycles: 0,
    riskyAttempts: 0,
    dramaResolved: 0,
    finalReputation: 0,
    finalCurrency: 0,
    gateViolations: 0,
    warnings,
    cycleLog,
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

    // 3. Tier-unlock bookkeeping (state entering this cycle).
    const unlockedTiers = unlockedProgressionTierIds(org, arc);
    for (const tierId of unlockedTiers) {
      if (result.tierUnlockCycles[tierId] === null) result.tierUnlockCycles[tierId] = org.cycle;
    }

    // 4. Candidate targets: lowest tier first, uncleared, unlocked, accessible.
    const cleared = clearedChallengeIds(org);
    const candidates: Array<{ challenge: Challenge; tierIndex: number }> = [];
    arc.progressionTiers.forEach((tier, tierIndex) => {
      if (!unlockedTiers.has(tier.id)) return;
      for (const id of tier.challenges) {
        if (cleared.has(id)) continue;
        const challenge = arc.challenges.find((c) => c.id === id);
        if (!challenge) continue;
        if (!challengeAccess(challenge, org, arc).accessible) continue;
        candidates.push({ challenge, tierIndex });
      }
    });
    candidates.sort((a, b) => a.tierIndex - b.tierIndex || a.challenge.difficultyRating - b.challenge.difficultyRating);

    // 5. Choose attempt vs train.
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

    let assignedChallengeId: string | null = null;
    if (pick) {
      assignment = {
        challengeId: pick.challenge.id,
        agentIds: pick.plan.agentIds,
        tokensSpent: org.resources.tokens > 0 ? 1 : 0,
        ...(opts.difficultyModeId ? { difficultyModeId: opts.difficultyModeId } : {}),
      };
      assignedChallengeId = pick.challenge.id;
      trainingStreak = 0;
      if (attemptedRisky) result.riskyAttempts++;
    } else {
      trainingStreak++;
      result.trainingCycles++;
    }

    // 6. Idle agents train.
    const partyIds = new Set(assignment?.agentIds ?? []);
    org = withTrainingAssignments(org, partyIds);

    // 7. Run the cycle through the real engine.
    const cycleResult = runCycle({
      org,
      arc,
      assignments: assignment ? [assignment] : [],
      pendingRewardDecisions: decisions,
    });
    const lockedWarnings = cycleResult.warnings.filter((w) => w.includes("locked"));
    result.gateViolations += lockedWarnings.length;
    warnings.push(...cycleResult.warnings);
    org = cycleResult.org;
    pendingChoices = cycleResult.pendingRewardChoices;

    // 8. Bookkeeping.
    let cycleOutcome: CycleLogEntry["outcome"] = null;
    for (const report of cycleResult.reports) {
      const tally = (attempts[report.challengeId] ??= { success: 0, partial: 0, failure: 0 });
      tally[report.outcome]++;
      if (report.outcome === "success" && clearCycles[report.challengeId] === undefined) {
        clearCycles[report.challengeId] = report.cycle;
      }
      if (report.challengeId === assignedChallengeId) cycleOutcome = report.outcome;
    }
    cycleLog.push({ cycle: org.cycle - 1, assignedChallengeId, outcome: cycleOutcome });

    const clearedNow = clearedChallengeIds(org);
    arc.progressionTiers.forEach((tier) => {
      if (result.tierClearCycles[tier.id] === null && tier.requiredChallenges.every((id) => clearedNow.has(id))) {
        result.tierClearCycles[tier.id] = org.cycle - 1;
      }
    });
    for (const chain of arc.attunementChains) {
      if (result.attunementCycles[chain.id] === null) {
        const anyAttuned = Object.values(org.agents).some((a) => a.attunements.includes(chain.id));
        if (anyAttuned) result.attunementCycles[chain.id] = org.cycle - 1;
      }
    }

    if (arcCleared(arc, clearedNow)) {
      result.outcome = "cleared";
      break;
    }

    // 9. Stall detection.
    if (candidates.length === 0) {
      const unclearedAnywhere = arc.challenges.filter((c) => !clearedNow.has(c.id));
      result.outcome = "stalled";
      result.stallChallenge = unclearedAnywhere[0]?.id ?? null;
      result.stallReason = unclearedAnywhere.length === 0
        ? "all challenges cleared but tier completion condition unmet"
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

export interface ArcAggregate {
  runs: ConformanceRunResult[];
  seeds: number;
  maxCycles: number;
  difficultyModeId: string | null;
  clearRate: number;
  stallRate: number;
  maxCycleRate: number;
  medianTierClear: Record<string, number | null>;
  firstStalls: Record<string, number>;
  stallReasons: Record<string, number>;
  attemptTotals: Record<string, AttemptTally>;
  totalGateViolations: number;
  medianFinalCurrency: number;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

export function aggregateRuns(arc: Arc, runs: ConformanceRunResult[], maxCycles: number): ArcAggregate {
  const agg: ArcAggregate = {
    runs,
    seeds: runs.length,
    maxCycles,
    difficultyModeId: runs[0]?.difficultyModeId ?? null,
    clearRate: runs.filter((r) => r.outcome === "cleared").length / Math.max(1, runs.length),
    stallRate: runs.filter((r) => r.outcome === "stalled").length / Math.max(1, runs.length),
    maxCycleRate: runs.filter((r) => r.outcome === "max-cycles").length / Math.max(1, runs.length),
    medianTierClear: {},
    firstStalls: {},
    stallReasons: {},
    attemptTotals: {},
    totalGateViolations: runs.reduce((s, r) => s + r.gateViolations, 0),
    medianFinalCurrency: median(runs.map((r) => r.finalCurrency)) ?? 0,
  };
  for (const tier of arc.progressionTiers) {
    agg.medianTierClear[tier.id] = median(
      runs.map((r) => r.tierClearCycles[tier.id]).filter((v): v is number => v !== null && v !== undefined),
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

export function runSweep(arc: Arc, opts: { seeds: number; maxCycles: number; difficultyModeId?: string; rosterOptions?: RosterBuildOptions }): ArcAggregate {
  const runs: ConformanceRunResult[] = [];
  for (let seed = 1; seed <= opts.seeds; seed++) {
    runs.push(simulateArcRun(arc, { seed, maxCycles: opts.maxCycles, difficultyModeId: opts.difficultyModeId, rosterOptions: opts.rosterOptions }));
  }
  return aggregateRuns(arc, runs, opts.maxCycles);
}
