import type { Organization, Agent, Relationship, RelationshipState } from "./types.js";
import { compareCodepoints } from "./determinism.js";

// ── Local Types ───────────────────────────────────────────────────────────────

export interface RelationshipTransition {
  agentA: string;
  agentB: string;
  from: RelationshipState;
  to: RelationshipState;
  reason: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasTrait(agent: Agent, traitId: string): boolean {
  return agent.traits.includes(traitId);
}

function clampAffinity(v: number): number {
  return Math.max(-100, Math.min(100, v));
}

function pairKey(a: string, b: string): [string, string] {
  return compareCodepoints(a, b) <= 0 ? [a, b] : [b, a];
}

function findRelIdx(org: Organization, aId: string, bId: string): number {
  const [lo, hi] = pairKey(aId, bId);
  return org.relationships.findIndex(
    (r) => r.agentIds[0] === lo && r.agentIds[1] === hi,
  );
}

function tierIndex(tierId: string): number {
  // Numeric prefix or fallback alphabetical
  const m = tierId.match(/\d+/);
  return m ? parseInt(m[0]!, 10) : tierId.charCodeAt(0);
}

// ── getRelationship ───────────────────────────────────────────────────────────

export function getRelationship(
  org: Organization,
  agentA: string,
  agentB: string,
): Relationship {
  const [lo, hi] = pairKey(agentA, agentB);
  const rel = org.relationships.find((r) => r.agentIds[0] === lo && r.agentIds[1] === hi);
  if (rel) return rel;
  return { agentIds: [lo, hi], state: "Neutral", affinity: 0 };
}

// ── evaluateState ─────────────────────────────────────────────────────────────

function evaluateState(
  rel: Relationship,
  org: Organization,
): RelationshipState {
  const current = rel.state;
  const aff = rel.affinity;
  const [aId, bId] = rel.agentIds;
  const agentA = org.agents[aId];
  const agentB = org.agents[bId];

  // Mentorship is set explicitly; don't auto-transition away
  if (current === "Mentorship") return "Mentorship";

  // Bonded: requires 10+ shared challenges while Allied + affinity > 60
  if (current === "Allied" && aff > 60) {
    const sharedAllied = countSharedChallenges(aId, bId, org);
    if (sharedAllied >= 10) return "Bonded";
  }

  // Keep Bonded unless affinity drops drastically
  if (current === "Bonded") {
    if (aff < -30) return "Hostile";
    if (aff < 0) return "Allied"; // degraded but not hostile
    return "Bonded";
  }

  // Allied transitions
  if (aff > 30) {
    if (current === "Hostile" || current === "Rivalrous") return "Neutral"; // step back first
    return "Allied";
  }
  if (aff < -30) return "Hostile";

  // Neutral zone: check Rivalrous conditions
  if (current === "Rivalrous") {
    if (aff < -30) return "Hostile";
    if (aff > 30) return "Allied";
    return "Rivalrous";
  }

  // Check if should become Rivalrous from Neutral
  if (current === "Neutral" || current === "Allied") {
    if (agentA && agentB && shouldBeRivalrous(agentA, agentB)) {
      return "Rivalrous";
    }
  }

  if (current === "Allied" && aff <= 30) return "Neutral";
  if (current === "Hostile" && aff >= -30) return "Neutral";

  return current;
}

function shouldBeRivalrous(a: Agent, b: Agent): boolean {
  return (
    a.role !== null &&
    a.role === b.role &&
    a.tier === b.tier &&
    a.hiddenAttributes.ambition > 12 &&
    b.hiddenAttributes.ambition > 12
  );
}

function countSharedChallenges(aId: string, bId: string, org: Organization): number {
  const agentA = org.agents[aId];
  const agentB = org.agents[bId];
  if (!agentA || !agentB) return 0;
  const aChallenges = new Set(agentA.assignmentHistory.map((r) => r.challengeId));
  return agentB.assignmentHistory.filter((r) => aChallenges.has(r.challengeId)).length;
}

// ── applyRelationshipDelta ────────────────────────────────────────────────────

export function applyRelationshipDelta(
  org: Organization,
  agentA: string,
  agentB: string,
  affinityDelta: number,
  _cycle: number,
): Organization {
  const [lo, hi] = pairKey(agentA, agentB);
  const existingIdx = findRelIdx(org, lo, hi);

  const existing: Relationship =
    existingIdx >= 0
      ? org.relationships[existingIdx]!
      : { agentIds: [lo, hi], state: "Neutral", affinity: 0 };

  const agentAObj = org.agents[agentA];
  const agentBObj = org.agents[agentB];
  // Relationship trait multipliers are edge properties: apply each once,
  // symmetrically, so (agentA, agentB) and (agentB, agentA) yield the same edge.
  const pairHasTrait = (traitId: string): boolean =>
    (agentAObj !== undefined && hasTrait(agentAObj, traitId)) ||
    (agentBObj !== undefined && hasTrait(agentBObj, traitId));
  let delta = affinityDelta;
  if (pairHasTrait("team_player")) delta *= 1.5;
  if (pairHasTrait("charismatic")) delta *= 1.3;

  const newAffinity = clampAffinity(existing.affinity + delta);
  const updated: Relationship = { ...existing, affinity: newAffinity };
  const newState = evaluateState(updated, org);
  const finalRel: Relationship = { ...updated, state: newState };

  const newRelationships =
    existingIdx >= 0
      ? org.relationships.map((r, i) => (i === existingIdx ? finalRel : r))
      : [...org.relationships, finalRel];

  return { ...org, relationships: newRelationships };
}

// ── processChallengeRelationshipEffects ───────────────────────────────────────

export function processChallengeRelationshipEffects(
  org: Organization,
  _challengeId: string,
  assignedAgentIds: string[],
  outcome: "success" | "partial" | "failure",
  performanceByAgent: Map<string, number>,
  cycle: number,
): { org: Organization; transitions: RelationshipTransition[]; stressDeltas: Map<string, number> } {
  let result = org;
  const transitions: RelationshipTransition[] = [];
  const stressDeltas = new Map<string, number>();

  for (let i = 0; i < assignedAgentIds.length; i++) {
    for (let j = i + 1; j < assignedAgentIds.length; j++) {
      const aId = assignedAgentIds[i]!;
      const bId = assignedAgentIds[j]!;
      const agentA = result.agents[aId];
      const agentB = result.agents[bId];
      if (!agentA || !agentB) continue;

      const oldRel = getRelationship(result, aId, bId);
      let delta = 0;

      if (outcome === "success") {
        delta = 5;
        // team_player multiplier is owned by applyRelationshipDelta (applied once, symmetrically).
      } else if (outcome === "failure") {
        if (hasTrait(agentA, "team_player") && hasTrait(agentB, "team_player")) {
          delta = 3; // shared adversity
        } else if (
          hasTrait(agentA, "hothead") || hasTrait(agentB, "hothead")
        ) {
          delta = -5; // blame
        }
      }

      if (delta !== 0) {
        const beforeState = getRelationship(result, aId, bId).state;
        result = applyRelationshipDelta(result, aId, bId, delta, cycle);
        const afterState = getRelationship(result, aId, bId).state;
        if (beforeState !== afterState) {
          transitions.push({ agentA: aId, agentB: bId, from: beforeState, to: afterState, reason: `challenge_${outcome}` });
        }
      }

      // Rivalrous: performance gap > 15% → stress to underperformer
      const rel = getRelationship(result, aId, bId);
      if (rel.state === "Rivalrous") {
        const perfA = performanceByAgent.get(aId) ?? 0;
        const perfB = performanceByAgent.get(bId) ?? 0;
        if (perfA > 0 || perfB > 0) {
          const maxPerf = Math.max(perfA, perfB);
          const gap = maxPerf > 0 ? Math.abs(perfA - perfB) / maxPerf : 0;
          if (gap > 0.15) {
            const underperformer = perfA < perfB ? aId : bId;
            stressDeltas.set(underperformer, (stressDeltas.get(underperformer) ?? 0) + 1);
          }
        }
      }

      // Bonded partner downed detection (check downedUntilCycle)
      if (rel.state === "Bonded") {
        const aAgent = result.agents[aId];
        const bAgent = result.agents[bId];
        if (aAgent?.downedUntilCycle !== null && aAgent?.downedUntilCycle !== undefined) {
          stressDeltas.set(bId, (stressDeltas.get(bId) ?? 0) + 2);
        }
        if (bAgent?.downedUntilCycle !== null && bAgent?.downedUntilCycle !== undefined) {
          stressDeltas.set(aId, (stressDeltas.get(aId) ?? 0) + 2);
        }
      }
    }
  }

  return { org: result, transitions, stressDeltas };
}

// ── evaluateMentorshipPairs ───────────────────────────────────────────────────

export function evaluateMentorshipPairs(
  org: Organization,
  trainingFacilityAgents: string[],
  cycle: number,
): Organization {
  let result = org;

  for (let i = 0; i < trainingFacilityAgents.length; i++) {
    for (let j = i + 1; j < trainingFacilityAgents.length; j++) {
      const aId = trainingFacilityAgents[i]!;
      const bId = trainingFacilityAgents[j]!;
      const agentA = result.agents[aId];
      const agentB = result.agents[bId];
      if (!agentA || !agentB) continue;

      const tierA = tierIndex(agentA.tier);
      const tierB = tierIndex(agentB.tier);
      const gap = Math.abs(tierA - tierB);

      // Required tier gap: 2, or 1 if mentor has mentor_inclined trait
      const mentor = tierA > tierB ? agentA : agentB;
      const requiredGap = hasTrait(mentor, "mentor_inclined") ? 1 : 2;

      if (gap < requiredGap) continue;

      const rel = getRelationship(result, aId, bId);
      if (rel.state === "Hostile") continue; // incompatible

      if (rel.state !== "Mentorship") {
        result = applyRelationshipDelta(result, aId, bId, 0, cycle);
        // Force Mentorship state
        const [lo, hi] = pairKey(aId, bId);
        const idx = result.relationships.findIndex(
          (r) => r.agentIds[0] === lo && r.agentIds[1] === hi,
        );
        if (idx >= 0) {
          result = {
            ...result,
            relationships: result.relationships.map((r, i) =>
              i === idx ? { ...r, state: "Mentorship" as RelationshipState } : r,
            ),
          };
        } else {
          result = {
            ...result,
            relationships: [
              ...result.relationships,
              { agentIds: [lo, hi] as [string, string], state: "Mentorship" as RelationshipState, affinity: 0 },
            ],
          };
        }
      }
    }
  }

  return result;
}
