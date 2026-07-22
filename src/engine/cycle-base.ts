import type { Organization, Arc, Agent, RunReport, DramaCard } from "./types.js";
import { partyClearsGates, resolveChallenge } from "./resolver.js";
import {
  applyStressGains,
  processAfflictionThreshold,
  driftMorale,
  applyHostileProximityStress,
  applyAfflictionBarks,
} from "./stress.js";
import {
  processChallengeRelationshipEffects,
} from "./relationships.js";
import {
  generateDramaCards,
  enqueueDramaCards,
  type DramaTriggerInput,
} from "./drama.js";
import { applyRewardDecision, evaluateLootEligibility } from "./rewards.js";
import { tickInfrastructure } from "./infrastructure.js";
import { refreshOpenPool } from "./recruitment.js";
import { regenerateTokens, spendTokens, accrueChallengeRewards, chargeUpkeep } from "./economy.js";
import {
  challengeAccess,
  stampNewAttunements,
  stampUnlockedProgressionTiers,
} from "./access.js";
import { applyDifficultyMode } from "./difficulty.js";
import { Rng, hashSeed } from "./prng.js";
import {
  compareCodepoints,
  orderedEntries,
  orderedKeys,
  orderedStrings,
  orderRecordKeysDeep,
} from "./determinism.js";
import {
  HIDDEN_ATTR_REVEAL_THRESHOLDS,
  TRAIT_REVEAL_THRESHOLDS,
} from "./constants.js";

// ── Public types ──────────────────────────────────────────────────────────────

export interface ChallengeAssignment {
  challengeId: string;
  agentIds: string[];
  tokensSpent: number;
  /** Resolve against arc.difficultyModes entry with this id (see
   * applyDifficultyMode). Omitted = base difficulty. */
  difficultyModeId?: string;
}

export interface RewardDecision {
  itemId: string;
  eligible: string[];
  winner: string;
  sourceChallenge: string;
}

export interface PendingRewardChoice {
  itemId: string;
  eligibleAgentIds: string[];
  sourceChallenge: string;
  cycle: number;
}

export interface CycleEvent {
  type:
    | "reveal_hidden_attr"
    | "reveal_trait"
    | "morale_extreme"
    | "downed"
    | "affliction"
    | "resolve"
    | "relationship_transition"
    | "narrative_event"
    | "training_stat_growth"
    | "research_tick"
    | string;
  agentId?: string;
  data: unknown;
}

export interface CycleResult {
  org: Organization;
  reports: RunReport[];
  events: CycleEvent[];
  queuedDramaCards: DramaCard[];
  pendingRewardChoices: PendingRewardChoice[];
  warnings: string[];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function patchAgent(org: Organization, agentId: string, patch: Partial<Agent>): Organization {
  const agent = org.agents[agentId];
  if (!agent) return org;
  return {
    ...org,
    agents: { ...org.agents, [agentId]: { ...agent, ...patch } },
  };
}

function mergeStressDeltas(a: Map<string, number>, b: Map<string, number>): Map<string, number> {
  const merged = new Map(a);
  for (const [id, val] of b) {
    merged.set(id, (merged.get(id) ?? 0) + val);
  }
  return merged;
}

/** Normalize Record-backed collections and set-like assignment arrays before
 * any transition work. Insertion and click order are not authored game law and
 * must not survive into output bytes or RNG traversal order. */
function normalizeOrganizationOrder(org: Organization): Organization {
  return orderRecordKeysDeep({
    ...org,
    agents: Object.fromEntries(orderedEntries(org.agents)),
    infrastructure: Object.fromEntries(
      orderedEntries(org.infrastructure).map(([id, facility]) => [
        id,
        { ...facility, assignedAgents: orderedStrings(facility.assignedAgents) },
      ]),
    ) as Organization["infrastructure"],
  });
}

// ── runCycle ──────────────────────────────────────────────────────────────────

export function runCycle(opts: {
  org: Organization;
  arc: Arc;
  assignments: ChallengeAssignment[];
  pendingRewardDecisions?: RewardDecision[];
}): CycleResult {
  const { arc, assignments, pendingRewardDecisions = [] } = opts;
  const cycle = opts.org.cycle;
  let org = normalizeOrganizationOrder(opts.org);

  const events: CycleEvent[] = [];
  const allDramaTriggers: DramaTriggerInput[] = [];
  const warnings: string[] = [];

  // Persist every tier open at cycle start before any authored outcome can
  // reduce reputation. Old saves omit this additive field and are backfilled
  // here without a version break.
  org = stampUnlockedProgressionTiers(org, arc);

  // ── STEP 0: Downed-agent recovery ─────────────────────────────────────────
  // Agents return to duty once their downtime has elapsed, regardless of a
  // Medical facility (Medical only accelerates recovery during STEP 6).
  for (const [agentId, agent] of orderedEntries(org.agents)) {
    if (agent.downedUntilCycle !== null && cycle >= agent.downedUntilCycle) {
      org = patchAgent(org, agentId, { downedUntilCycle: null });
      events.push({ type: "recovered", agentId, data: { cycle } });
    }
  }

  // ── STEP 1: Challenge Resolution ──────────────────────────────────────────

  const reports: RunReport[] = [];
  // Map: challengeId → agentIds assigned
  const assignmentsByChallenge = new Map<string, string[]>();

  for (const assignment of assignments) {
    const challenge = arc.challenges.find((c) => c.id === assignment.challengeId);
    if (!challenge) {
      warnings.push(`Challenge not found: ${assignment.challengeId}`);
      continue;
    }

    // Gate enforcement: a locked challenge never resolves and never spends
    // tokens. Judged against the declared party (access.ts).
    const canonicalAgentIds = [...assignment.agentIds].sort(compareCodepoints);
    const access = challengeAccess(challenge, org, arc, canonicalAgentIds);
    if (!access.accessible) {
      const reasons: string[] = [];
      if (access.missingMilestones.length > 0) {
        reasons.push(`missing milestones: ${access.missingMilestones.join(", ")}`);
      }
      if (access.attunement !== null && !access.attunement.satisfied) {
        reasons.push(
          `attuned agents ${access.attunement.attunedAgentIds.length}/${access.attunement.requiredCount} (chains: ${access.attunement.requiredChains.join(", ")})`,
        );
      }
      warnings.push(`Challenge ${assignment.challengeId} is locked — ${reasons.join("; ")}`);
      continue;
    }

    // Difficulty mode: resolve against the transformed challenge. Its id is
    // preserved, so history and milestones stay keyed to the base challenge.
    let effectiveChallenge = challenge;
    if (assignment.difficultyModeId !== undefined) {
      const mode = arc.difficultyModes.find((m) => m.id === assignment.difficultyModeId);
      if (!mode) {
        warnings.push(
          `Difficulty mode not found: ${assignment.difficultyModeId} (challenge ${assignment.challengeId})`,
        );
        continue;
      }
      effectiveChallenge = applyDifficultyMode(challenge, mode);
    }

    const agentList = canonicalAgentIds
      .map((id) => org.agents[id])
      .filter((a): a is Agent => a !== undefined && a.downedUntilCycle === null);

    if (agentList.length === 0 || agentList.length !== canonicalAgentIds.length) {
      warnings.push(`No valid agents for challenge ${assignment.challengeId}`);
      continue;
    }

    // Count, role, and identity gates are admission rules, not costly failed
    // attempts. Refuse the assignment before debiting its capacity tokens.
    if (!partyClearsGates(effectiveChallenge, agentList)) {
      warnings.push(`Party is not eligible for challenge ${assignment.challengeId}`);
      continue;
    }

    // Capacity tokens are the authored per-attempt cost. Debit only after every
    // access and party gate has passed, so a refused assignment cannot consume
    // capacity it never used.
    if (assignment.tokensSpent > 0) {
      try {
        org = spendTokens(org, assignment.tokensSpent);
      } catch (e) {
        warnings.push(`Token spend failed for ${assignment.challengeId}: ${String(e)}`);
        continue;
      }
    }

    const report = resolveChallenge({
      challenge: effectiveChallenge,
      assignedAgents: agentList,
      org,
      arc,
      cycle,
      // Already debited above by spendTokens; this only informs the roll of what
      // was spent. A no-op unless the challenge authors a resource-spend lever.
      tokensSpent: assignment.tokensSpent,
    });
    reports.push(report);
    assignmentsByChallenge.set(assignment.challengeId, canonicalAgentIds);

    // Apply downed status and update assignment history
    for (const ar of report.assignedAgents) {
      const agent = org.agents[ar.agentId];
      if (!agent) continue;

      const newHistory = [
        ...agent.assignmentHistory,
        { challengeId: assignment.challengeId, cycle, outcome: report.outcome },
      ];

      let patch: Partial<Agent> = { assignmentHistory: newHistory };

      if (ar.wasDowned) {
        const downedUntil = cycle + (effectiveChallenge.outcomes[report.outcome].agentDowntimeCycles ?? 1);
        patch = { ...patch, downedUntilCycle: downedUntil };
        events.push({ type: "downed", agentId: ar.agentId, data: { until: downedUntil } });
      }

      org = patchAgent(org, ar.agentId, patch);
    }

    // Accrue currency + reputation from the outcome. First clear pays full;
    // re-clears pay a reduced share (see accrueChallengeRewards).
    const accrued = accrueChallengeRewards(org, report, arc, effectiveChallenge);
    org = accrued.org;
    report.rewardsGranted = { currency: accrued.currencyGranted, reputation: accrued.reputationGranted };

    // Collect drama triggers from report (resolver may populate in future)
    // report.dramaTriggers is typed as DramaTrigger[] (generic {type,agentsInvolved})
    // which doesn't overlap DramaTriggerInput — skip for now (resolver returns [] anyway)
  }

  // ── STEP 2: Reward Resolution ─────────────────────────────────────────────

  const pendingRewardChoices: PendingRewardChoice[] = [];
  const step2Rng = new Rng(hashSeed(org.rngSeed, cycle, "step2"));

  // Apply decisions from previous cycle (passed in as pendingRewardDecisions)
  for (const decision of pendingRewardDecisions) {
    const item = arc.items.find((it) => it.id === decision.itemId);
    if (!item) {
      warnings.push(`Item not found for reward decision: ${decision.itemId}`);
      continue;
    }

    const { org: newOrg, dramaTriggers } = applyRewardDecision(
      org,
      { item, eligible: decision.eligible, winner: decision.winner, sourceChallenge: decision.sourceChallenge },
      step2Rng,
      cycle,
    );
    org = newOrg;
    for (const dt of dramaTriggers) allDramaTriggers.push(dt);
  }

  // Queue new pending choices from THIS cycle's loot drops (player resolves next cycle)
  for (const report of reports) {
    for (const drop of report.lootDrops) {
      const item = arc.items.find((it) => it.id === drop.itemId);
      if (!item) continue;

      const eligible = drop.eligibleAgents.filter((id) => {
        const agent = org.agents[id];
        return agent && evaluateLootEligibility(item, agent, arc);
      });

      if (eligible.length === 0) continue;

      pendingRewardChoices.push({
        itemId: drop.itemId,
        eligibleAgentIds: eligible,
        sourceChallenge: report.challengeId,
        cycle,
      });
    }
  }

  // ── STEP 3: Stress Processing ─────────────────────────────────────────────

  const stressGains = new Map<string, number>();

  // Per-challenge stress from reports
  for (const report of reports) {
    for (const ar of report.assignedAgents) {
      if (ar.stressGained > 0) {
        stressGains.set(ar.agentId, (stressGains.get(ar.agentId) ?? 0) + ar.stressGained);
      }
    }
  }

  // Benching stress: agents not assigned this cycle but assigned in last 2 cycles
  const assignedThisCycle = new Set(
    assignments.flatMap((a) => a.agentIds),
  );
  for (const [agentId, agent] of orderedEntries(org.agents)) {
    if (assignedThisCycle.has(agentId)) continue;
    const recentAssignments = agent.assignmentHistory.filter(
      (r) => r.cycle >= cycle - 2 && r.cycle < cycle,
    );
    if (recentAssignments.length > 0) {
      stressGains.set(agentId, (stressGains.get(agentId) ?? 0) + 1);
    }
  }

  // Hostile proximity stress
  const proximityStress = applyHostileProximityStress(org, assignmentsByChallenge, cycle);
  const mergedStress = mergeStressDeltas(stressGains, proximityStress);

  // Affliction bark stress
  const step3Rng = new Rng(hashSeed(org.rngSeed, cycle, "step3"));
  const { stressGains: barkStress } = applyAfflictionBarks(org, step3Rng, cycle);
  const finalStress = mergeStressDeltas(mergedStress, barkStress);

  org = applyStressGains(org, finalStress, cycle);

  // Affliction threshold processing for each agent at stress >= 10
  const step3bRng = new Rng(hashSeed(org.rngSeed, cycle, "step3b"));
  for (const agentId of orderedKeys(org.agents)) {
    const agent = org.agents[agentId];
    if (!agent || agent.stress < 10) continue;

    const { org: newOrg, event } = processAfflictionThreshold(org, agentId, step3bRng, cycle);
    org = newOrg;

    if (event) {
      if (event.kind === "affliction") {
        events.push({ type: "affliction", agentId, data: { affliction: event.affliction, cycle } });
        allDramaTriggers.push({ type: "affliction_threshold", agentId, affliction: event.affliction });
      } else if (event.kind === "resolve") {
        events.push({ type: "resolve", agentId, data: { witnesses: event.witnesses, cycle } });
      }
    }
  }

  // ── STEP 4: Relationship Updates ──────────────────────────────────────────

  const step4Rng = new Rng(hashSeed(org.rngSeed, cycle, "step4"));
  void step4Rng;

  for (const report of reports) {
    const agentIds = assignmentsByChallenge.get(report.challengeId) ?? [];
    const perfMap = new Map<string, number>();
    for (const ar of report.assignedAgents) {
      perfMap.set(ar.agentId, ar.performanceRating);
    }

    const { org: newOrg, transitions, stressDeltas } = processChallengeRelationshipEffects(
      org,
      report.challengeId,
      agentIds,
      report.outcome,
      perfMap,
      cycle,
    );
    org = newOrg;

    for (const t of transitions) {
      events.push({
        type: "relationship_transition",
        data: { from: t.from, to: t.to, agentA: t.agentA, agentB: t.agentB, reason: t.reason },
      });
      allDramaTriggers.push({
        type: "relationship_transition",
        agentA: t.agentA,
        agentB: t.agentB,
        from: t.from,
        to: t.to,
      });
    }

    // Apply relationship stress deltas
    if (stressDeltas.size > 0) {
      org = applyStressGains(org, stressDeltas, cycle);
    }
  }

  // ── STEP 5: Morale Drift ──────────────────────────────────────────────────

  org = driftMorale(org, cycle);

  // Check for morale extremes and emit events/triggers
  for (const [agentId, agent] of orderedEntries(org.agents)) {
    if (agent.morale < 25 || agent.morale > 85) {
      events.push({ type: "morale_extreme", agentId, data: { morale: agent.morale } });
      allDramaTriggers.push({ type: "morale_extreme", agentId, morale: agent.morale });
    }
  }

  // ── STEP 6: Infrastructure Tick ───────────────────────────────────────────

  const step6Rng = new Rng(hashSeed(org.rngSeed, cycle, "step6"));
  const { org: infraOrg, events: infraEvents } = tickInfrastructure(org, arc, step6Rng, cycle);
  org = infraOrg;
  for (const e of infraEvents) {
    events.push(e as CycleEvent);
  }

  // ── STEP 7: Recruitment Pool Refresh ─────────────────────────────────────

  const step7Rng = new Rng(hashSeed(org.rngSeed, cycle, "step7"));
  const { org: orgWithPool } = refreshOpenPool(org, arc, step7Rng, cycle);
  org = orgWithPool;

  // ── STEP 8: Token Regeneration ────────────────────────────────────────────

  org = regenerateTokens(org, arc);

  // ── STEP 8b: Upkeep ───────────────────────────────────────────────────────

  const afterUpkeep = chargeUpkeep(org, cycle);
  if (afterUpkeep.upkeepDue > 0) {
    events.push({
      type: "upkeep_charged",
      data: {
        amount: afterUpkeep.upkeepPaid,
        due: afterUpkeep.upkeepDue,
        unpaid: afterUpkeep.unpaidUpkeep,
        deficit: afterUpkeep.negativeBalance ?? false,
      },
    });
  }
  if (afterUpkeep.negativeBalance) {
    warnings.push(`Treasury shortfall — ${afterUpkeep.unpaidUpkeep} upkeep remains unpaid.`);
  }
  org = { ...org, resources: afterUpkeep.resources };

  // ── STEP 9: Drama Card Queue Finalization ─────────────────────────────────

  const step9Rng = new Rng(hashSeed(org.rngSeed, cycle, "step9"));

  // Check prolonged benching triggers (3+ consecutive cycles benched)
  for (const [agentId, agent] of orderedEntries(org.agents)) {
    if (assignedThisCycle.has(agentId)) continue;
    const recentHistory = agent.assignmentHistory;
    if (recentHistory.length === 0) continue;
    const lastAssigned = recentHistory[recentHistory.length - 1]?.cycle ?? 0;
    const cyclesBenched = cycle - lastAssigned;
    if (cyclesBenched >= 3) {
      allDramaTriggers.push({ type: "prolonged_benching", agentId, cyclesBenched });
    }
  }

  // Rivalrous performance gap (>20% differential from same challenge)
  for (const report of reports) {
    const agentIds = assignmentsByChallenge.get(report.challengeId) ?? [];
    for (let i = 0; i < agentIds.length; i++) {
      for (let j = i + 1; j < agentIds.length; j++) {
        const aId = agentIds[i]!;
        const bId = agentIds[j]!;
        const rel = org.relationships.find(
          (r) =>
            (r.agentIds[0] === aId && r.agentIds[1] === bId) ||
            (r.agentIds[0] === bId && r.agentIds[1] === aId),
        );
        if (!rel || rel.state !== "Rivalrous") continue;

        const arA = report.assignedAgents.find((ar) => ar.agentId === aId);
        const arB = report.assignedAgents.find((ar) => ar.agentId === bId);
        if (!arA || !arB) continue;

        const maxPerf = Math.max(arA.performanceRating, arB.performanceRating);
        if (maxPerf > 0) {
          const gap = Math.abs(arA.performanceRating - arB.performanceRating) / maxPerf;
          if (gap > 0.2) {
            allDramaTriggers.push({ type: "rivalrous_perf_gap", agentA: aId, agentB: bId, gap });
          }
        }
      }
    }
  }

  const newDramaCards = generateDramaCards(allDramaTriggers, org, step9Rng, cycle);
  org = enqueueDramaCards(org, newDramaCards, cycle);

  // ── STEP 10: Hidden Attribute / Trait Reveals ─────────────────────────────

  for (const [agentId, agent] of orderedEntries(org.agents)) {
    const totalAssignments = agent.assignmentHistory.length;

    // Hidden attr reveals: [3, 8] thresholds
    const [oneAttrThreshold, allAttrThreshold] = HIDDEN_ATTR_REVEAL_THRESHOLDS;

    let newRevealedAttrs = agent.revealedHiddenAttrs;
    const hiddenAttrCount = 4; // loyalty, ambition, volatility, leadership

    if (totalAssignments >= allAttrThreshold && newRevealedAttrs < hiddenAttrCount) {
      const revealed = hiddenAttrCount - newRevealedAttrs;
      newRevealedAttrs = hiddenAttrCount;
      events.push({
        type: "reveal_hidden_attr",
        agentId,
        data: { count: revealed, totalRevealed: newRevealedAttrs, allRevealed: true },
      });
    } else if (totalAssignments >= oneAttrThreshold && newRevealedAttrs < 1) {
      newRevealedAttrs = 1;
      events.push({
        type: "reveal_hidden_attr",
        agentId,
        data: { count: 1, totalRevealed: 1, allRevealed: false },
      });
    }

    // Trait reveals: [0, 5, 12] thresholds — trait 1 visible at 0 (default), 2 at 5, 3 at 12
    const [, trait2Threshold, trait3Threshold] = TRAIT_REVEAL_THRESHOLDS;

    let newRevealedTraits = agent.revealedTraits;

    if (totalAssignments >= trait3Threshold && newRevealedTraits < 3) {
      const wasRevealedBefore = newRevealedTraits;
      newRevealedTraits = Math.min(3, agent.traits.length);
      if (newRevealedTraits > wasRevealedBefore) {
        events.push({
          type: "reveal_trait",
          agentId,
          data: { traitIndex: newRevealedTraits - 1, totalRevealed: newRevealedTraits },
        });
      }
    } else if (totalAssignments >= trait2Threshold && newRevealedTraits < 2) {
      newRevealedTraits = Math.min(2, agent.traits.length);
      if (newRevealedTraits > agent.revealedTraits) {
        events.push({
          type: "reveal_trait",
          agentId,
          data: { traitIndex: 1, totalRevealed: newRevealedTraits },
        });
      }
    }

    if (newRevealedAttrs !== agent.revealedHiddenAttrs || newRevealedTraits !== agent.revealedTraits) {
      org = patchAgent(org, agentId, {
        revealedHiddenAttrs: newRevealedAttrs,
        revealedTraits: newRevealedTraits,
      });
    }
  }

  // ── STEP 10b: Attunement stamping ─────────────────────────────────────────
  // Chains completed by this cycle's final state stamp onto agents now, so
  // attunement is monotonic from here on (see access.ts).
  const stamped = stampNewAttunements(org, arc);
  org = stamped.org;
  for (const grant of stamped.newlyAttuned) {
    events.push({ type: "attuned", agentId: grant.agentId, data: { chainId: grant.chainId } });
  }

  // Capture tiers first earned through this cycle's milestones or reputation
  // before returning the transition, so a caller's save preserves the unlock.
  org = stampUnlockedProgressionTiers(org, arc);

  // ── Increment cycle ───────────────────────────────────────────────────────

  org = { ...org, cycle: cycle + 1 };

  return orderRecordKeysDeep({
    org,
    reports,
    events,
    queuedDramaCards: newDramaCards,
    pendingRewardChoices,
    warnings,
  });
}
