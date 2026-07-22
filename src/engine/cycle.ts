import "./abi13.js";
import { evaluateComposition } from "./composition.js";
import {
  runCycle as runCycleBase,
  type ChallengeAssignment,
  type CycleEvent,
  type CycleResult,
  type PendingRewardChoice,
  type RewardDecision,
} from "./cycle-base.js";
import { compareCodepoints, orderRecordKeysDeep } from "./determinism.js";
import { applyCartridgeStateEffects, initializeCartridgeState } from "./state.js";
import type { Agent, Arc, Organization, RunReport } from "./types.js";

export type {
  ChallengeAssignment,
  CycleEvent,
  CycleResult,
  PendingRewardChoice,
  RewardDecision,
};

function eligibleAgents(org: Organization, assignment: ChallengeAssignment): Agent[] | null {
  const out: Agent[] = [];
  for (const agentId of assignment.agentIds) {
    const agent = org.agents[agentId];
    if (!agent || agent.downedUntilCycle !== null) return null;
    out.push(agent);
  }
  return out;
}

function reportStateOrderKey(report: RunReport): string {
  const agents = report.assignedAgents.map((agent) => agent.agentId).sort(compareCodepoints).join(",");
  return `${report.challengeId}\u0000${agents}\u0000${report.outcome}`;
}

/** Engine-1.3 cycle wrapper. Composition is refused before token debit. State
 * effects are applied atomically after the cycle's simultaneously resolved
 * reports, in canonical challenge-and-party order, and are carried on the exact
 * originating report. */
export function runCycle(opts: {
  org: Organization;
  arc: Arc;
  assignments: ChallengeAssignment[];
  pendingRewardDecisions?: RewardDecision[];
}): CycleResult {
  const startingOrg = initializeCartridgeState(opts.org, opts.arc);
  const accepted: ChallengeAssignment[] = [];
  const compositionWarnings: string[] = [];

  for (const assignment of opts.assignments) {
    const challenge = opts.arc.challenges.find((candidate) => candidate.id === assignment.challengeId);
    if (!challenge || !(challenge.compositionConstraints?.length)) {
      accepted.push(assignment);
      continue;
    }
    const agents = eligibleAgents(startingOrg, assignment);
    if (!agents) {
      accepted.push(assignment);
      continue;
    }
    const evaluation = evaluateComposition({ challenge, agents, arc: opts.arc });
    if (!evaluation.feasible) {
      compositionWarnings.push(
        `Party composition is not eligible for challenge ${assignment.challengeId}: ${evaluation.rejectionReasons.join("; ")}`,
      );
      continue;
    }
    accepted.push(assignment);
  }

  const base = runCycleBase({
    ...opts,
    org: startingOrg,
    assignments: accepted,
  });

  let org = base.org;
  const events: CycleEvent[] = [...base.events];
  const enriched = new Map<RunReport, RunReport>();
  const stateOrder = [...base.reports].sort((left, right) =>
    compareCodepoints(reportStateOrderKey(left), reportStateOrderKey(right))
  );

  for (const report of stateOrder) {
    const challenge = opts.arc.challenges.find((candidate) => candidate.id === report.challengeId);
    const effects = challenge?.outcomes[report.outcome].stateEffects ?? [];
    if (effects.length === 0) {
      enriched.set(report, report);
      continue;
    }
    const applied = applyCartridgeStateEffects({
      org,
      arc: opts.arc,
      effects,
      source: { challengeId: report.challengeId, outcome: report.outcome, cycle: report.cycle },
    });
    org = applied.org;
    enriched.set(report, { ...report, stateChanges: applied.changes });
    for (const change of applied.changes) {
      events.push({ type: "cartridge_state_change", data: change });
    }
  }

  return orderRecordKeysDeep({
    ...base,
    org,
    reports: base.reports.map((report) => enriched.get(report) ?? report),
    events,
    warnings: [...compositionWarnings, ...base.warnings],
  });
}
