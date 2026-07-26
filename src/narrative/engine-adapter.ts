import { compareCodepoints, orderedStrings } from "../engine/determinism.js";
import { hashSeed } from "../engine/prng.js";
import type { DramaTriggerInput } from "../engine/drama.js";
import type { Agent, Organization } from "../engine/types.js";
import type { NarrativeActorSnapshot, NarrativeFact } from "./types.js";

function uniqueOrdered(values: readonly string[]): string[] {
  return orderedStrings([...new Set(values)]);
}

function actorTags(agent: Agent): string[] {
  const tags = ["actor:agent", `tier:${agent.tier}`];
  if (agent.role) tags.push(`role:${agent.role}`);
  if (agent.secondaryRole) tags.push(`secondary-role:${agent.secondaryRole}`);
  for (const trait of agent.traits) tags.push(`trait:${trait}`);
  for (const attunement of agent.attunements) tags.push(`attunement:${attunement}`);
  if (agent.afflictionState.kind !== "none") tags.push(`affliction:${agent.afflictionState.kind}`);
  if (agent.morale <= 25) tags.push("state:morale-critical");
  else if (agent.morale <= 40) tags.push("state:morale-low");
  else if (agent.morale >= 80) tags.push("state:morale-high");
  if (agent.stress >= 8) tags.push("state:stress-critical");
  else if (agent.stress >= 5) tags.push("state:stress-high");
  if (agent.downedUntilCycle !== null) tags.push("state:downed");
  return uniqueOrdered(tags);
}

export function agentToNarrativeSnapshot(agent: Agent): NarrativeActorSnapshot {
  return {
    id: agent.id,
    tags: actorTags(agent),
    metrics: {
      loyalty: agent.hiddenAttributes.loyalty,
      ambition: agent.hiddenAttributes.ambition,
      volatility: agent.hiddenAttributes.volatility,
      leadership: agent.hiddenAttributes.leadership,
      morale: agent.morale,
      stress: agent.stress,
      baseEfficiency: agent.baseEfficiency,
      upkeep: agent.upkeep,
      assignments: agent.assignmentHistory.length,
      rewards: agent.rewardHistory.length,
      afflictions: agent.afflictionHistory.length,
    },
  };
}

export function organizationToNarrativeActors(
  organization: Pick<Organization, "agents">,
): NarrativeActorSnapshot[] {
  return Object.values(organization.agents)
    .sort((left, right) => compareCodepoints(left.id, right.id))
    .map(agentToNarrativeSnapshot);
}

interface TriggerProjection {
  actorIds: string[];
  actorRoles: Record<string, string>;
  tags: string[];
  severity: number;
  data: Record<string, string | number | boolean | null>;
  identityParts: Array<string | number>;
}

function projectTrigger(trigger: DramaTriggerInput): TriggerProjection {
  switch (trigger.type) {
    case "relationship_transition":
      return {
        actorIds: uniqueOrdered([trigger.agentA, trigger.agentB]),
        actorRoles: { agentA: trigger.agentA, agentB: trigger.agentB },
        tags: ["pressure:relationship", `relationship-from:${trigger.from}`, `relationship-to:${trigger.to}`],
        severity: trigger.to === "Hostile" || trigger.to === "Bonded" ? 8 : 5,
        data: { from: trigger.from, to: trigger.to },
        identityParts: [trigger.agentA, trigger.agentB, trigger.from, trigger.to],
      };
    case "reward_dispute": {
      const actorRoles: Record<string, string> = { winner: trigger.winner };
      trigger.eligible.forEach((agentId, index) => { actorRoles[`eligible${index}`] = agentId; });
      return {
        actorIds: uniqueOrdered(trigger.eligible),
        actorRoles,
        tags: ["pressure:scarcity", "pressure:recognition", `item:${trigger.itemId}`],
        severity: Math.min(10, 4 + trigger.eligible.length),
        data: { itemId: trigger.itemId, eligibleCount: trigger.eligible.length },
        identityParts: [trigger.itemId, trigger.winner, ...trigger.eligible],
      };
    }
    case "precedent_violation": {
      const actorRoles: Record<string, string> = {};
      trigger.affectedAgents.forEach((agentId, index) => { actorRoles[`affected${index}`] = agentId; });
      return {
        actorIds: uniqueOrdered(trigger.affectedAgents),
        actorRoles,
        tags: ["pressure:legitimacy", `precedent-basis:${trigger.basis}`, `precedent-dominant:${trigger.dominant}`],
        severity: Math.min(10, 5 + trigger.affectedAgents.length),
        data: { basis: trigger.basis, dominant: trigger.dominant, affectedCount: trigger.affectedAgents.length },
        identityParts: [trigger.basis, trigger.dominant, ...trigger.affectedAgents],
      };
    }
    case "morale_extreme":
      return {
        actorIds: [trigger.agentId],
        actorRoles: { subject: trigger.agentId },
        tags: ["pressure:morale", trigger.morale < 50 ? "morale:low" : "morale:high"],
        severity: Math.min(10, Math.max(1, Math.ceil(Math.abs(trigger.morale - 50) / 5))),
        data: { morale: trigger.morale },
        identityParts: [trigger.agentId, trigger.morale],
      };
    case "affliction_threshold":
      return {
        actorIds: [trigger.agentId],
        actorRoles: { subject: trigger.agentId },
        tags: ["pressure:stress", `affliction:${trigger.affliction}`],
        severity: 8,
        data: { affliction: trigger.affliction },
        identityParts: [trigger.agentId, trigger.affliction],
      };
    case "prolonged_benching":
      return {
        actorIds: [trigger.agentId],
        actorRoles: { claimant: trigger.agentId },
        tags: ["pressure:exclusion", "pressure:recognition", `benching:${trigger.cyclesBenched}`],
        severity: Math.min(10, Math.max(1, trigger.cyclesBenched)),
        data: { cyclesBenched: trigger.cyclesBenched },
        identityParts: [trigger.agentId, trigger.cyclesBenched],
      };
    case "rivalrous_perf_gap":
      return {
        actorIds: uniqueOrdered([trigger.agentA, trigger.agentB]),
        actorRoles: { outperformer: trigger.agentA, underperformer: trigger.agentB },
        tags: ["pressure:rivalry", "pressure:status"],
        severity: Math.min(10, Math.max(1, Math.ceil(trigger.gap / 5))),
        data: { gap: trigger.gap },
        identityParts: [trigger.agentA, trigger.agentB, trigger.gap],
      };
    case "bonded_partner_lost":
      return {
        actorIds: uniqueOrdered([trigger.agentId, trigger.partnerId]),
        actorRoles: { survivor: trigger.agentId, partner: trigger.partnerId },
        tags: ["pressure:loss", "relationship:bonded", "consequence:irreversible"],
        severity: 10,
        data: {},
        identityParts: [trigger.agentId, trigger.partnerId],
      };
  }
}

export function dramaTriggerToNarrativeFact(
  trigger: DramaTriggerInput,
  cycle: number,
  sequence: number,
  receiptRef = `engine:drama:${cycle}:${sequence}`,
): NarrativeFact {
  const projection = projectTrigger(trigger);
  return {
    id: `fact_${cycle}_${sequence}_${hashSeed(trigger.type, cycle, sequence, ...projection.identityParts)}`,
    type: trigger.type,
    cycle,
    actorIds: projection.actorIds,
    actorRoles: projection.actorRoles,
    tags: uniqueOrdered([`trigger:${trigger.type}`, ...projection.tags]),
    severity: projection.severity,
    receiptRef,
    data: projection.data,
  };
}

export function dramaTriggersToNarrativeFacts(
  triggers: readonly DramaTriggerInput[],
  cycle: number,
  receiptPrefix = "engine:drama",
): NarrativeFact[] {
  return triggers.map((trigger, sequence) =>
    dramaTriggerToNarrativeFact(trigger, cycle, sequence, `${receiptPrefix}:${cycle}:${sequence}`),
  );
}
