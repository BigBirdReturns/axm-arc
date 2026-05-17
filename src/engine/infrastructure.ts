import type { Organization, Arc, Agent, InfrastructureFacility } from "./types.js";
import type { Rng } from "./prng.js";
import type { CycleEvent } from "./economy.js";
import { evaluateMentorshipPairs } from "./relationships.js";

// ── tickInfrastructure ────────────────────────────────────────────────────────

export function tickInfrastructure(
  org: Organization,
  arc: Arc,
  rng: Rng,
  cycle: number,
): { org: Organization; events: CycleEvent[] } {
  let result = org;
  const events: CycleEvent[] = [];

  result = tickProduction(result, arc);
  result = tickTraining(result, arc, rng, cycle, events);
  result = tickRecreation(result);
  result = tickResearch(result, arc, cycle, events);
  result = tickMedical(result, cycle);

  return { org: result, events };
}

// ── Production ────────────────────────────────────────────────────────────────

function tickProduction(org: Organization, _arc: Arc): Organization {
  const facility = org.infrastructure["Production"];
  if (!facility || facility.assignedAgents.length === 0) return org;

  let materialsGained = 0;
  for (const agentId of facility.assignedAgents) {
    const agent = org.agents[agentId];
    if (!agent) continue;
    // Check for Industrious trait
    const hasIndustrious = agent.traits.includes("industrious");
    const multiplier = hasIndustrious ? 1.3 : 1.0;
    const output = agent.baseEfficiency * facility.level * multiplier;
    materialsGained += output;
  }

  return {
    ...org,
    resources: {
      ...org.resources,
      materials: org.resources.materials + Math.floor(materialsGained),
    },
  };
}

// ── Training ──────────────────────────────────────────────────────────────────

function tickTraining(
  org: Organization,
  arc: Arc,
  rng: Rng,
  cycle: number,
  events: CycleEvent[],
): Organization {
  const facility = org.infrastructure["Training"];
  if (!facility || facility.assignedAgents.length === 0) return org;

  // Find highest-leadership assigned agent as "trainer"
  let trainerLeadership = 0;
  for (const agentId of facility.assignedAgents) {
    const agent = org.agents[agentId];
    if (!agent) continue;
    if (agent.hiddenAttributes.leadership > trainerLeadership) {
      trainerLeadership = agent.hiddenAttributes.leadership;
    }
  }

  // Evaluate mentorship pairs first (may set Mentorship state)
  let result = evaluateMentorshipPairs(org, facility.assignedAgents, cycle);

  const attrIds = arc.attributes.map((a) => a.id);
  if (attrIds.length === 0) return result;

  for (const agentId of facility.assignedAgents) {
    const agent = result.agents[agentId];
    if (!agent) continue;

    const baseGrowth = 1 + trainerLeadership * 0.1;

    // Check for mentorship pair bonus (+25%)
    const hasMentorPair = result.relationships.some(
      (r) =>
        (r.agentIds[0] === agentId || r.agentIds[1] === agentId) &&
        r.state === "Mentorship",
    );
    const finalGrowth = hasMentorPair ? baseGrowth * 1.25 : baseGrowth;

    const growthAmount = Math.floor(finalGrowth);
    if (growthAmount <= 0) continue;

    // Pick a random attribute that isn't already at cap (20)
    const eligibleAttrs = attrIds.filter((id) => (agent.attributes[id] ?? 0) < 20);
    if (eligibleAttrs.length === 0) continue;

    const chosenAttr = eligibleAttrs[rng.int(0, eligibleAttrs.length - 1)]!;
    const currentVal = agent.attributes[chosenAttr] ?? 0;
    const newVal = Math.min(20, currentVal + growthAmount);

    if (newVal !== currentVal) {
      result = {
        ...result,
        agents: {
          ...result.agents,
          [agentId]: {
            ...agent,
            attributes: { ...agent.attributes, [chosenAttr]: newVal },
          },
        },
      };
      events.push({
        type: "training_stat_growth",
        agentId,
        data: { attribute: chosenAttr, delta: newVal - currentVal, cycle },
      });
    }
  }

  return result;
}

// ── Recreation ────────────────────────────────────────────────────────────────

function tickRecreation(org: Organization): Organization {
  const facility = org.infrastructure["Recreation"];
  if (!facility) return org;

  if (facility.assignedAgents.length === 0) return org;

  let result = org;
  const moraleFloor = facility.level * 10;

  for (const agentId of facility.assignedAgents) {
    const agent = result.agents[agentId];
    if (!agent) continue;

    const newStress = Math.max(0, agent.stress - 2);
    const newMorale = Math.max(moraleFloor, agent.morale);

    result = {
      ...result,
      agents: {
        ...result.agents,
        [agentId]: { ...agent, stress: newStress, morale: newMorale },
      },
    };
  }

  return result;
}

// ── Research ──────────────────────────────────────────────────────────────────

function tickResearch(
  org: Organization,
  arc: Arc,
  cycle: number,
  events: CycleEvent[],
): Organization {
  const facility = org.infrastructure["Research"];
  if (!facility || facility.assignedAgents.length === 0) return org;

  // Accumulate intel: count of assigned agents as proxy for research output
  const researchOutput = facility.assignedAgents.length * facility.level;

  // Check if any narrative events can be unlocked (threshold-based)
  for (const narEv of arc.narrativeEvents) {
    if (
      narEv.trigger.type === "reputation_threshold" &&
      org.reputation >= Number(narEv.trigger.target)
    ) {
      events.push({
        type: "narrative_event",
        data: { narrativeEvent: narEv, cycle, researchOutput },
      });
    }
  }

  // The intelQueue counter is conceptual — just emit a research_tick event
  events.push({
    type: "research_tick",
    data: { output: researchOutput, cycle },
  });

  return org;
}

// ── Medical ───────────────────────────────────────────────────────────────────

function tickMedical(org: Organization, cycle: number): Organization {
  const facility = org.infrastructure["Medical"];
  if (!facility) return org;

  // Average resilience of assigned agents (use power/focus as proxy if no explicit resilience attr)
  let avgResilience = 0;
  if (facility.assignedAgents.length > 0) {
    let total = 0;
    for (const agentId of facility.assignedAgents) {
      const agent = org.agents[agentId];
      if (!agent) continue;
      // Use average of all attributes as resilience proxy
      const attrVals = Object.values(agent.attributes);
      total += attrVals.length > 0 ? attrVals.reduce((s, v) => s + v, 0) / attrVals.length : 5;
    }
    avgResilience = total / facility.assignedAgents.length;
  }

  // Extra recovery rate from facility level + avg resilience
  const extraRecovery = Math.floor(facility.level + avgResilience / 10);
  if (extraRecovery <= 0) return org;

  let result = org;
  for (const [agentId, agent] of Object.entries(org.agents)) {
    if (agent.downedUntilCycle === null) continue;
    // Reduce recovery time
    const newDownedUntil = Math.max(cycle, agent.downedUntilCycle - extraRecovery);
    result = {
      ...result,
      agents: {
        ...result.agents,
        [agentId]: { ...agent, downedUntilCycle: newDownedUntil === cycle ? null : newDownedUntil },
      },
    };
  }

  return result;
}
