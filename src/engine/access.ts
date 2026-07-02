// Gate derivations: the one place challenge access, progression-tier unlock,
// and attunement completion are computed.
//
// Before this module, gating was implemented three half-ways: world's compile
// pipeline honored challenge-level orgMilestones, the hub's AssignScreen had
// its own inline progression-tier unlock, and attunement chains /
// agentAttunements / attunementThreshold were valid to author but silently
// ignored everywhere. Karazhan-class arcs are built on exactly those three
// (attunements, gates, tiered progression), so all of them derive here, from
// the same records that drive everything else — assignment history,
// reputation, reward history. Nothing in this file mutates during play except
// stampNewAttunements, whose stamp exists to make attunement monotonic.
//
// Milestone normalization contract (RECONCILIATION.md — shared with world's
// play-pipeline/compile.ts statusForChallenge): a milestone string is
// satisfied when the challenge it names has any success record, accepting
// both "<challenge-id>-cleared" and bare "<challenge-id>" forms.

import type {
  Agent,
  Arc,
  AttunementStep,
  Challenge,
  Organization,
} from "./types";

/** Challenge ids any agent has a success record for. */
export function clearedChallenges(org: Organization): Set<string> {
  const out = new Set<string>();
  for (const agent of Object.values(org.agents)) {
    for (const record of agent.assignmentHistory) {
      if (record.outcome === "success") out.add(record.challengeId);
    }
  }
  return out;
}

export function milestoneSatisfied(milestone: string, cleared: Set<string>): boolean {
  return cleared.has(milestone.replace(/-cleared$/, "")) || cleared.has(milestone);
}

export function missingOrgMilestones(challenge: Challenge, org: Organization): string[] {
  const cleared = clearedChallenges(org);
  return challenge.accessRequirements.orgMilestones.filter((m) => !milestoneSatisfied(m, cleared));
}

/** Progression tiers whose unlock conditions the org currently meets. */
export function unlockedProgressionTierIds(org: Organization, arc: Arc): Set<string> {
  const cleared = clearedChallenges(org);
  const out = new Set<string>();
  for (const tier of arc.progressionTiers) {
    const milestonesMet = tier.unlockConditions.orgMilestones.every((m) =>
      milestoneSatisfied(m, cleared),
    );
    const repMet = (tier.unlockConditions.reputationMinimum ?? 0) <= org.reputation;
    if (milestonesMet && repMet) out.add(tier.id);
  }
  return out;
}

function stepComplete(
  step: AttunementStep,
  agent: Agent,
  org: Organization,
  done: Set<string>,
): boolean {
  switch (step.type) {
    case "challenge_clear":
      return agent.assignmentHistory.some(
        (r) => r.challengeId === step.target && r.outcome === "success",
      );
    case "reputation_threshold":
      return org.reputation >= Number(step.target);
    case "item_acquire":
      // Ever-acquired (rewardHistory) or holding it now (authored rosters may
      // start with items equipped and no reward record).
      return (
        agent.rewardHistory.some((r) => r.itemId === step.target) ||
        Object.values(agent.equippedItems).includes(step.target)
      );
    case "chain_complete":
      return done.has(step.target);
  }
}

/** Every attunement chain this agent has completed. Seeds from the stamped
 * agent.attunements so attunement is monotonic: a chain earned via a
 * reputation threshold stays earned if reputation later drops. chain_complete
 * dependencies resolve by fixed point, so chains may reference each other in
 * any authoring order (a dependency cycle simply never completes). */
export function completedAttunementChains(agent: Agent, org: Organization, arc: Arc): Set<string> {
  const done = new Set(agent.attunements);
  let grew = true;
  while (grew) {
    grew = false;
    for (const chain of arc.attunementChains) {
      if (done.has(chain.id)) continue;
      if (chain.steps.every((step) => stepComplete(step, agent, org, done))) {
        done.add(chain.id);
        grew = true;
      }
    }
  }
  return done;
}

/** Stamp newly completed chains onto each agent's attunements. Pure with
 * respect to its input: returns a patched org, never mutates. Grants are
 * sorted (agent id, chain id) so event order is deterministic. */
export function stampNewAttunements(
  org: Organization,
  arc: Arc,
): { org: Organization; newlyAttuned: Array<{ agentId: string; chainId: string }> } {
  if (arc.attunementChains.length === 0) return { org, newlyAttuned: [] };
  const newlyAttuned: Array<{ agentId: string; chainId: string }> = [];
  let next = org;
  for (const agentId of Object.keys(org.agents).sort()) {
    const agent = org.agents[agentId]!;
    const completed = completedAttunementChains(agent, org, arc);
    const fresh = [...completed].filter((id) => !agent.attunements.includes(id)).sort();
    if (fresh.length === 0) continue;
    next = {
      ...next,
      agents: {
        ...next.agents,
        [agentId]: { ...next.agents[agentId]!, attunements: [...agent.attunements, ...fresh] },
      },
    };
    for (const chainId of fresh) newlyAttuned.push({ agentId, chainId });
  }
  return { org: next, newlyAttuned };
}

/** Chains that gate a challenge: the challenge's own agentAttunements list,
 * plus any chain whose grantsAccessTo names the challenge. Both are authoring
 * spellings of the same gate. */
export function requiredAttunementChains(challenge: Challenge, arc: Arc): string[] {
  const ids = new Set(challenge.accessRequirements.agentAttunements);
  for (const chain of arc.attunementChains) {
    if (chain.grantsAccessTo.includes(challenge.id)) ids.add(chain.id);
  }
  return [...ids].sort();
}

export interface AttunementGate {
  requiredChains: string[];
  /** Fraction of the party that must hold every required chain.
   * accessRequirements.attunementThreshold, with null meaning 1.0 (everyone). */
  threshold: number;
  attunedAgentIds: string[];
  requiredCount: number;
  satisfied: boolean;
}

export interface ChallengeAccess {
  accessible: boolean;
  missingMilestones: string[];
  /** null when the challenge has no attunement gate. */
  attunement: AttunementGate | null;
}

/** Full gate report for a challenge.
 *
 * With partyAgentIds: the gate is judged against that party (this is what
 * runCycle enforces). Without: feasibility mode — the whole roster is the
 * pool and the required count is judged against rosterRequirements.minAgents,
 * i.e. "could any legal party exist right now" (this is what pickers should
 * show). A threshold of 0 makes a listed gate advisory by construction. */
export function challengeAccess(
  challenge: Challenge,
  org: Organization,
  arc: Arc,
  partyAgentIds?: string[],
): ChallengeAccess {
  const missingMilestones = missingOrgMilestones(challenge, org);

  const requiredChains = requiredAttunementChains(challenge, arc);
  let attunement: AttunementGate | null = null;
  if (requiredChains.length > 0) {
    const threshold = challenge.accessRequirements.attunementThreshold ?? 1;
    const pool = partyAgentIds
      ? partyAgentIds.map((id) => org.agents[id]).filter((a): a is Agent => a !== undefined)
      : Object.values(org.agents);
    const attunedAgentIds = pool
      .filter((agent) => {
        const done = completedAttunementChains(agent, org, arc);
        return requiredChains.every((chainId) => done.has(chainId));
      })
      .map((agent) => agent.id);
    const baseCount = partyAgentIds ? pool.length : challenge.rosterRequirements.minAgents;
    const requiredCount = Math.ceil(threshold * baseCount);
    attunement = {
      requiredChains,
      threshold,
      attunedAgentIds,
      requiredCount,
      satisfied: attunedAgentIds.length >= requiredCount,
    };
  }

  return {
    accessible: missingMilestones.length === 0 && (attunement?.satisfied ?? true),
    missingMilestones,
    attunement,
  };
}
