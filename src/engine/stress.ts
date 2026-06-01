import type { Organization, Agent, Affliction } from "./types.js";
import { STRESS_THRESHOLD, AFFLICTION_CHANCE } from "./constants.js";
import type { Rng } from "./prng.js";

// ── Local Event Types ─────────────────────────────────────────────────────────

export interface AfflictionEvent {
  kind: "affliction";
  agentId: string;
  affliction: Affliction;
  cycle: number;
}

export interface ResolveEvent {
  kind: "resolve";
  agentId: string;
  witnesses: string[];
  cycle: number;
}

export interface BarkEvent {
  kind: "bark";
  sourceAgentId: string;
  targetAgentId: string;
  stressAmount: number;
  cycle: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasTrait(agent: Agent, traitId: string): boolean {
  return agent.traits.includes(traitId);
}

function clampStress(v: number): number {
  return Math.max(0, Math.min(STRESS_THRESHOLD, v));
}

function clampMorale(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function orderedAgentIds(org: Organization): string[] {
  return Object.keys(org.agents).sort((a, b) => a.localeCompare(b));
}

function deterministicShuffle<T>(items: readonly T[], rng: Rng): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

function updateAgent(org: Organization, agentId: string, patch: Partial<Agent>): Organization {
  const agent = org.agents[agentId];
  if (!agent) return org;
  return {
    ...org,
    agents: {
      ...org.agents,
      [agentId]: { ...agent, ...patch },
    },
  };
}

function isOfficer(agent: Agent): boolean {
  // Officers are flagged by a lastClearCycle entry with key "officer" or no external flag;
  // we use a conventions: if agent.tier starts with "officer" or a trait marks it.
  // Per design: role-based check – use tier prefix or custom field.
  // We treat tier === "officer" or any tier id containing "officer" as officer status.
  return agent.tier.toLowerCase().includes("officer");
}

// ── applyStressGains ──────────────────────────────────────────────────────────

export function applyStressGains(
  org: Organization,
  gains: Map<string, number>,
  _cycle: number,
): Organization {
  let result = org;
  for (const [agentId, delta] of gains) {
    const agent = result.agents[agentId];
    if (!agent) continue;

    // Stoic reduces accumulation by 30%; stressAccumulationMultiplier
    let multiplier = 1.0;
    if (hasTrait(agent, "stoic")) multiplier *= 0.7;
    if (hasTrait(agent, "methodical")) multiplier *= 0.8;
    // Loner: immune to hostile stress — caller handles filtering; just apply multiplier here.

    const finalDelta = delta * multiplier;
    const newStress = clampStress(agent.stress + finalDelta);
    result = updateAgent(result, agentId, { stress: newStress });
  }
  return result;
}

// ── processAfflictionThreshold ────────────────────────────────────────────────

function pickAffliction(agent: Agent, rng: Rng): Affliction {
  // Base weights
  const weights: { item: Affliction; weight: number }[] = [
    { item: "Resentful", weight: 1 },
    { item: "Fearful", weight: 1 },
    { item: "Defiant", weight: 1 },
    { item: "Reckless", weight: 1 },
    { item: "Withdrawn", weight: 1 },
  ];

  // Trait biases
  if (hasTrait(agent, "hothead")) {
    const defiant = weights.find((w) => w.item === "Defiant");
    const reckless = weights.find((w) => w.item === "Reckless");
    if (defiant) defiant.weight += 2;
    if (reckless) reckless.weight += 2;
  }
  if (hasTrait(agent, "stoic")) {
    const withdrawn = weights.find((w) => w.item === "Withdrawn");
    if (withdrawn) withdrawn.weight += 2;
  }

  // Affliction history bias: past afflictions weighted higher
  for (const past of agent.afflictionHistory) {
    const entry = weights.find((w) => w.item === past);
    if (entry) entry.weight += 1;
  }

  return rng.weightedPick(weights);
}

export function processAfflictionThreshold(
  org: Organization,
  agentId: string,
  rng: Rng,
  cycle: number,
): { org: Organization; event: AfflictionEvent | ResolveEvent | null } {
  const agent = org.agents[agentId];
  if (!agent || agent.stress < STRESS_THRESHOLD) {
    return { org, event: null };
  }

  const roll = rng.next();

  if (roll < AFFLICTION_CHANCE) {
    // Affliction
    const affliction = pickAffliction(agent, rng);
    const updatedAgent: Agent = {
      ...agent,
      afflictionState: { kind: affliction, sinceCycle: cycle },
      afflictionHistory: [...agent.afflictionHistory, affliction],
    };
    let result: Organization = {
      ...org,
      agents: { ...org.agents, [agentId]: updatedAgent },
    };
    const event: AfflictionEvent = { kind: "affliction", agentId, affliction, cycle };
    return { org: result, event };
  } else {
    // Resolve: reset stress, flag bonus for 2 cycles
    const updatedAgent: Agent = {
      ...agent,
      stress: 0,
      lastClearCycle: {
        ...agent.lastClearCycle,
        resolve_bonus_until: cycle + 2,
      },
    };

    // Find witnesses (all other agents in org — caller can filter by challenge)
    const witnesses = Object.keys(org.agents).filter((id) => id !== agentId);

    let result: Organization = {
      ...org,
      agents: { ...org.agents, [agentId]: updatedAgent },
    };

    // Morale boost to witnesses (+5 morale)
    for (const wId of witnesses) {
      const w = result.agents[wId];
      if (!w) continue;
      result = updateAgent(result, wId, { morale: clampMorale(w.morale + 5) });
    }

    const event: ResolveEvent = { kind: "resolve", agentId, witnesses, cycle };
    return { org: result, event };
  }
}

// ── driftMorale ───────────────────────────────────────────────────────────────

function computeMoraleTarget(agent: Agent, org: Organization): number {
  // 1. Reward satisfaction: last 5 rewards
  const recentRewards = agent.rewardHistory.slice(-5);
  const rewardTarget = recentRewards.length > 0 ? 70 : 40;

  // 2. Win/loss streak from assignment history
  const recent = agent.assignmentHistory.slice(-5);
  let streak = 0;
  for (const rec of recent) {
    if (rec.outcome === "success") streak++;
    else if (rec.outcome === "failure") streak--;
  }
  const streakBonus = streak * 4; // ±4 per win/loss in last 5

  // 3. Relationship quality (avg affinity of agent's relationships)
  const myRels = org.relationships.filter(
    (r) => r.agentIds[0] === agent.id || r.agentIds[1] === agent.id,
  );
  const avgAffinity =
    myRels.length > 0
      ? myRels.reduce((sum, r) => sum + r.affinity, 0) / myRels.length
      : 0;
  const relBonus = avgAffinity * 0.2; // scale affinity (-100 to 100) → (-20 to 20)

  // 4. Infrastructure quality: recreation level
  const rec = org.infrastructure["Recreation"];
  const recBonus = rec ? rec.level * 2 : 0;

  // 5. Officer floor
  const officerFloor = isOfficer(agent) ? 45 : 0;

  const target = Math.max(officerFloor, rewardTarget + streakBonus + relBonus + recBonus);
  return clampMorale(target);
}

export function driftMorale(org: Organization, cycle: number): Organization {
  let result = org;
  for (const agentId of Object.keys(org.agents)) {
    const agent = result.agents[agentId];
    if (!agent) continue;
    const target = computeMoraleTarget(agent, result);
    const diff = target - agent.morale;
    const step = Math.sign(diff) * Math.min(5, Math.abs(diff));
    if (step !== 0) {
      result = updateAgent(result, agentId, {
        morale: clampMorale(agent.morale + step),
      });
    }
  }
  void cycle; // used implicitly via computeMoraleTarget
  return result;
}

// ── applyHostileProximityStress ───────────────────────────────────────────────

export function applyHostileProximityStress(
  org: Organization,
  assignmentsByChallenge: Map<string, string[]>,
  _cycle: number,
): Map<string, number> {
  const deltas = new Map<string, number>();

  for (const [, agentIds] of assignmentsByChallenge) {
    for (let i = 0; i < agentIds.length; i++) {
      for (let j = i + 1; j < agentIds.length; j++) {
        const aId = agentIds[i]!;
        const bId = agentIds[j]!;

        // Check if hostile relationship
        const rel = org.relationships.find(
          (r) =>
            (r.agentIds[0] === aId && r.agentIds[1] === bId) ||
            (r.agentIds[0] === bId && r.agentIds[1] === aId),
        );
        if (!rel || rel.state !== "Hostile") continue;

        // Loner trait grants immunity
        const agentA = org.agents[aId];
        const agentB = org.agents[bId];
        if (!agentA || !agentB) continue;

        if (!hasTrait(agentA, "loner")) {
          deltas.set(aId, (deltas.get(aId) ?? 0) + 1);
        }
        if (!hasTrait(agentB, "loner")) {
          deltas.set(bId, (deltas.get(bId) ?? 0) + 1);
        }
      }
    }
  }

  return deltas;
}

// ── applyAfflictionBarks ──────────────────────────────────────────────────────

export function applyAfflictionBarks(
  org: Organization,
  rng: Rng,
  _cycle: number,
): { stressGains: Map<string, number>; barks: BarkEvent[] } {
  const stressGains = new Map<string, number>();
  const barks: BarkEvent[] = [];

  // Build a map: agentId → challenge ids they're assigned to this cycle
  // We infer current assignments from lastClearCycle conventions or use relationships.
  // Since we don't have a "currentChallengeAssignment" on agents, we use all agents
  // grouped by their challenge if that info is passed. Here we derive from assignmentHistory
  // (last record) as a proxy for "currently assigned together."
  // The caller is expected to pass org with up-to-date assignment context.
  // We iterate all agents to find Afflicted ones and compute barks.

  const allAgentIds = orderedAgentIds(org);

  for (const agentId of allAgentIds) {
    const agent = org.agents[agentId];
    if (!agent || agent.afflictionState.kind === "none") continue;

    const affliction = agent.afflictionState.kind;
    if (affliction === "Withdrawn") continue; // No barks

    // Find "nearby" agents: those who share the same last challenge
    const lastAssignment = agent.assignmentHistory[agent.assignmentHistory.length - 1];
    let nearby: string[];
    if (lastAssignment) {
      nearby = allAgentIds.filter((id) => {
        if (id === agentId) return false;
        const other = org.agents[id];
        if (!other) return false;
        const otherLast = other.assignmentHistory[other.assignmentHistory.length - 1];
        return otherLast && otherLast.challengeId === lastAssignment.challengeId;
      });
    } else {
      nearby = allAgentIds.filter((id) => id !== agentId);
    }

    if (nearby.length === 0) continue;

    if (affliction === "Resentful") {
      // Target highest performer among nearby
      let highest = nearby[0]!;
      let highestCount = 0;
      for (const id of nearby) {
        const other = org.agents[id];
        if (!other) continue;
        const successCount = other.assignmentHistory.filter(
          (r) => r.outcome === "success",
        ).length;
        if (successCount > highestCount) {
          highestCount = successCount;
          highest = id;
        }
      }
      stressGains.set(highest, (stressGains.get(highest) ?? 0) + 1);
      barks.push({ kind: "bark", sourceAgentId: agentId, targetAgentId: highest, stressAmount: 1, cycle: _cycle });
    } else if (affliction === "Defiant") {
      // +2 stress to ALL others on same challenge
      for (const targetId of nearby) {
        stressGains.set(targetId, (stressGains.get(targetId) ?? 0) + 2);
        barks.push({ kind: "bark", sourceAgentId: agentId, targetAgentId: targetId, stressAmount: 2, cycle: _cycle });
      }
    } else if (affliction === "Fearful") {
      // Propagate anxiety: +1 to nearest neighbors (first 2 in nearby list, shuffled)
      const shuffled = deterministicShuffle(nearby, rng);
      const targets = shuffled.slice(0, Math.min(2, shuffled.length));
      for (const targetId of targets) {
        stressGains.set(targetId, (stressGains.get(targetId) ?? 0) + 1);
        barks.push({ kind: "bark", sourceAgentId: agentId, targetAgentId: targetId, stressAmount: 1, cycle: _cycle });
      }
    } else if (affliction === "Reckless") {
      // No explicit barks for Reckless
    }
  }

  return { stressGains, barks };
}
