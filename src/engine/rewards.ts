import type { Organization, Agent, Item, Arc, Precedent } from "./types.js";
import type { DramaTriggerInput } from "./drama.js";
import type { Rng } from "./prng.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function sumStatBonuses(bonuses: Record<string, number>): number {
  return Object.values(bonuses).reduce((a, b) => a + b, 0);
}

function tierRank(tierId: string, arc: Arc): number {
  const idx = arc.tiers.findIndex((t) => t.id === tierId);
  return idx >= 0 ? idx : 0;
}

function meetsItemTier(item: Item, agent: Agent, arc: Arc): boolean {
  const reqIdx = arc.tiers.findIndex((t) => t.id === item.tierRequirement);
  const agentIdx = arc.tiers.findIndex((t) => t.id === agent.tier);
  return agentIdx >= reqIdx;
}

// ── evaluateLootEligibility ───────────────────────────────────────────────────

export function evaluateLootEligibility(item: Item, agent: Agent, arc: Arc): boolean {
  // Tier requirement
  if (!meetsItemTier(item, agent, arc)) return false;
  // Slot must be usable (agent can only equip one item per slot)
  // We assume all agents can equip any slot; single-slot replacement always valid
  return true;
}

// ── awardItem ─────────────────────────────────────────────────────────────────

export function awardItem(
  org: Organization,
  agentId: string,
  item: Item,
  cycle: number,
  sourceChallenge: string,
): Organization {
  const agent = org.agents[agentId];
  if (!agent) return org;

  const updatedAgent: Agent = {
    ...agent,
    equippedItems: { ...agent.equippedItems, [item.slot]: item.id },
    rewardHistory: [
      ...agent.rewardHistory,
      { itemId: item.id, cycle, challengeId: sourceChallenge },
    ],
  };

  return {
    ...org,
    agents: { ...org.agents, [agentId]: updatedAgent },
  };
}

// ── computeRewardDisappointment ───────────────────────────────────────────────

export function computeRewardDisappointment(
  org: Organization,
  eligibleAgents: Agent[],
  winner: string,
  item: Item,
  cycle: number,
): Map<string, number> {
  const affinityDeltas = new Map<string, number>();
  const itemValue = sumStatBonuses(item.statBonuses);

  for (const agent of eligibleAgents) {
    if (agent.id === winner) continue;

    // Upgrade size: how much better is the item than current?
    const currentItemId = agent.equippedItems[item.slot];
    // We don't have the full item registry here; use stat bonus sum as proxy (assume 0 if no current)
    const currentValue = currentItemId ? itemValue * 0.5 : 0; // approximation
    const upgradeSize = Math.max(0, itemValue - currentValue);

    // Wait time: cycles since last comparable reward
    const lastReward = agent.rewardHistory[agent.rewardHistory.length - 1];
    const waitCycles = lastReward ? cycle - lastReward.cycle : cycle;

    // Loyalty modifier: high loyalty → smaller hit
    const loyalty = agent.hiddenAttributes.loyalty; // 0-20 range typical
    const loyaltyMod = 1 - loyalty / 20; // 1.0 at loyalty 0, 0.5 at loyalty 10, 0 at loyalty 20

    // Base hit: -1 per 10 upgrade value, modified by wait and loyalty
    const upgradeHit = (upgradeSize / 10) * loyaltyMod;
    const waitHit = (waitCycles / 5) * loyaltyMod;
    const totalHit = -(upgradeHit + waitHit + 1); // minimum -1

    // Toward winner: negative affinity delta
    affinityDeltas.set(agent.id + "_toward_" + winner, totalHit);
    // Toward org: loyalty loss (stored as synthetic "_org_" key)
    affinityDeltas.set(agent.id + "_toward__org_", totalHit * 0.5);
  }

  return affinityDeltas;
}

// ── inferDecisionBasis ────────────────────────────────────────────────────────

function inferDecisionBasis(
  winner: string,
  eligibleAgents: Agent[],
  org: Organization,
  performanceByAgent?: Map<string, number>,
): Precedent["decisionBasis"] {
  const winnerAgent = org.agents[winner];
  if (!winnerAgent) return "merit";

  // Check if winner is highest performer (merit)
  if (performanceByAgent && performanceByAgent.size > 0) {
    const winnerPerf = performanceByAgent.get(winner) ?? 0;
    const allPerfs = [...performanceByAgent.values()];
    const maxPerf = Math.max(...allPerfs);
    if (winnerPerf >= maxPerf * 0.9) return "merit";
  }

  // Check seniority: most assignment history
  const sortedBySeniority = [...eligibleAgents].sort(
    (a, b) => b.assignmentHistory.length - a.assignmentHistory.length,
  );
  if (sortedBySeniority[0]?.id === winner) return "seniority";

  // Check need: longest wait since last reward
  const sortedByNeed = [...eligibleAgents].sort((a, b) => {
    const aLast = a.rewardHistory[a.rewardHistory.length - 1]?.cycle ?? 0;
    const bLast = b.rewardHistory[b.rewardHistory.length - 1]?.cycle ?? 0;
    return aLast - bLast; // earlier last reward = more need
  });
  if (sortedByNeed[0]?.id === winner) return "need";

  // Check rotation: if previous winner was different, could be rotation
  const recentPrecedents = org.precedents.filter((p) => p.type === "reward").slice(-3);
  const recentWinners = recentPrecedents.map((p) => p.winner);
  if (recentWinners.length > 0 && !recentWinners.includes(winner)) return "rotation";

  return "favoritism";
}

// ── applyRewardDecision ───────────────────────────────────────────────────────

export function applyRewardDecision(
  org: Organization,
  decision: {
    item: Item;
    eligible: string[];
    winner: string;
    sourceChallenge: string;
  },
  rng: Rng,
  cycle: number,
): { org: Organization; precedent: Precedent; dramaTriggers: DramaTriggerInput[] } {
  void rng; // used by caller for narrative; determinism preserved

  const { item, eligible, winner, sourceChallenge } = decision;
  const eligibleAgents = eligible
    .map((id) => org.agents[id])
    .filter((a): a is Agent => a !== undefined);

  // Award item
  let result = awardItem(org, winner, item, cycle, sourceChallenge);

  // Compute disappointment
  const disappointmentDeltas = computeRewardDisappointment(
    result,
    eligibleAgents,
    winner,
    item,
    cycle,
  );

  // Apply morale hits to non-recipients (approximation: morale drop scaled by affinity hit)
  for (const agent of eligibleAgents) {
    if (agent.id === winner) continue;
    const affinityHit = disappointmentDeltas.get(agent.id + "_toward_" + winner) ?? 0;
    const moraleDrop = Math.round(affinityHit * 2); // 2x morale from affinity hit

    // Greedy trait doubles the penalty
    const hasGreedy = agent.traits.includes("greedy");
    const finalDrop = hasGreedy ? moraleDrop * 2 : moraleDrop;

    const currentAgent = result.agents[agent.id];
    if (!currentAgent) continue;
    result = {
      ...result,
      agents: {
        ...result.agents,
        [agent.id]: {
          ...currentAgent,
          morale: Math.max(0, Math.min(100, currentAgent.morale + finalDrop)),
        },
      },
    };
  }

  // Infer decision basis
  const basis = inferDecisionBasis(winner, eligibleAgents, result);

  // Build precedent
  const precedent: Precedent = {
    cycle,
    type: "reward",
    decisionBasis: basis,
    agentsInvolved: eligible,
    winner,
    context: { itemId: item.id, challengeId: sourceChallenge },
  };

  result = { ...result, precedents: [...result.precedents, precedent] };

  // Generate drama triggers
  const dramaTriggers: DramaTriggerInput[] = [];

  if (eligible.length >= 2) {
    dramaTriggers.push({
      type: "reward_dispute",
      itemId: item.id,
      eligible,
      winner,
    });
  }

  return { org: result, precedent, dramaTriggers };
}
