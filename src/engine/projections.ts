import type {
  Agent,
  Arc,
  Challenge,
  MechanicCheck,
  Organization,
} from "./types.js";
import {
  AFFLICTION_PENALTIES,
  RELATIONSHIP_MODS,
  DEFAULT_TRAIT_POOL,
} from "./constants.js";
import { effectiveThreshold } from "./resolver.js";

export interface MechanicProjection {
  mechanicId: string;
  mechanicName: string;
  agentId: string | null;
  agentName: string | null;
  scope: string;
  projectedScore: number;
  threshold: number;
  margin: number;
  assessment: "comfortable" | "tight" | "fail";
  attributeSummary: string;
  primaryAttributeName: string;
  primaryAttributeDescription: string;
  scopeHint: string;
  targetSummary: string;
  improvementHint: string;
}

export function projectMechanics(opts: {
  challenge: Challenge;
  assignedAgents: Agent[];
  org: Organization;
  arc: Arc;
}): MechanicProjection[] {
  const { challenge, assignedAgents, org, arc } = opts;
  const results: MechanicProjection[] = [];

  for (const check of challenge.mechanicChecks) {
    if (check.scope === "team_aggregate") {
      const teamScore = assignedAgents.reduce(
        (s, a) => s + estimateScore(a, check, assignedAgents, org, arc),
        0,
      );
      // Match the resolver exactly: only a perAssignedAgent team check scales the
      // bar by party size; a fixed or omitted threshold is the authored total.
      // Reusing the resolver's function keeps projection and resolution from
      // drifting on the bar the player is judged against.
      const threshold = effectiveThreshold(check, assignedAgents.length);
      const margin = teamScore - threshold;
      const averageScore =
        assignedAgents.length > 0 ? teamScore / assignedAgents.length : 0;
      results.push({
        mechanicId: check.id,
        mechanicName: check.name,
        agentId: null,
        agentName: "Team aggregate",
        scope: check.scope,
        projectedScore: Math.round(teamScore),
        threshold,
        margin: Math.round(margin),
        assessment:
          margin >= 10 ? "comfortable" : margin >= 0 ? "tight" : "fail",
        attributeSummary: describeAttributeWeights(check, arc),
        primaryAttributeName: primaryAttributeName(check, arc),
        primaryAttributeDescription: primaryAttributeDescription(check, arc),
        scopeHint: describeScope(check.scope),
        targetSummary: `Team average ${Math.round(averageScore)} vs required ${check.difficultyThreshold} each (${Math.round(teamScore)} / ${threshold} total).`,
        improvementHint:
          margin < 0
            ? `Raise average ${primaryAttributeName(check, arc)}: train, gear, or recruit stronger agents. More bodies only help if they beat the required average.`
            : `Keep average ${primaryAttributeName(check, arc)} above ${check.difficultyThreshold}; extra low-score agents can drag this check down.`,
      });
    } else if (check.scope === "role_specific") {
      const roleIds = check.roleIds && check.roleIds.length > 0
        ? check.roleIds
        : challenge.rosterRequirements.roleRequirements.map((r) => r.roleId);
      const roleAgents = assignedAgents.filter((a) => roleIds.includes(a.role ?? ""));
      const target = roleAgents[0] ?? assignedAgents[0];
      if (!target) continue;
      const score = estimateScore(target, check, assignedAgents, org, arc);
      const margin = score - check.difficultyThreshold;
      results.push({
        mechanicId: check.id,
        mechanicName: check.name,
        agentId: target.id,
        agentName: target.name,
        scope: check.scope,
        projectedScore: Math.round(score),
        threshold: check.difficultyThreshold,
        margin: Math.round(margin),
        assessment:
          margin >= 10 ? "comfortable" : margin >= 0 ? "tight" : "fail",
        attributeSummary: describeAttributeWeights(check, arc),
        primaryAttributeName: primaryAttributeName(check, arc),
        primaryAttributeDescription: primaryAttributeDescription(check, arc),
        scopeHint: describeScope(check.scope),
        targetSummary: `${target.name} is the checked role agent for this mechanic (${Math.round(score)} / ${check.difficultyThreshold}).`,
        improvementHint:
          margin < 0
            ? `Pick or improve a ${arc.roles.find((r) => r.id === target.role)?.name ?? "required-role"} with stronger ${primaryAttributeName(check, arc)}.`
            : `${target.name.split(" ")[0]} has enough ${primaryAttributeName(check, arc)} for this role check.`,
      });
    } else {
      // per_agent: show the weakest agent as representative
      let worstMargin = Infinity;
      let worstAgent = assignedAgents[0]!;
      for (const a of assignedAgents) {
        const score = estimateScore(a, check, assignedAgents, org, arc);
        const m = score - check.difficultyThreshold;
        if (m < worstMargin) {
          worstMargin = m;
          worstAgent = a;
        }
      }
      const score = estimateScore(worstAgent, check, assignedAgents, org, arc);
      results.push({
        mechanicId: check.id,
        mechanicName: check.name,
        agentId: worstAgent.id,
        agentName: `${worstAgent.name} · ${arc.roles.find((r) => r.id === worstAgent.role)?.name ?? "Flex"}`,
        scope: check.scope,
        projectedScore: Math.round(score),
        threshold: check.difficultyThreshold,
        margin: Math.round(score - check.difficultyThreshold),
        assessment:
          worstMargin >= 10
            ? "comfortable"
            : worstMargin >= 0
              ? "tight"
              : "fail",
        attributeSummary: describeAttributeWeights(check, arc),
        primaryAttributeName: primaryAttributeName(check, arc),
        primaryAttributeDescription: primaryAttributeDescription(check, arc),
        scopeHint: describeScope(check.scope),
        targetSummary: `Weakest projected agent: ${worstAgent.name} (${Math.round(score)} / ${check.difficultyThreshold}).`,
        improvementHint:
          worstMargin < 0
            ? `This checks every assigned agent. Swap, train, gear, or rest the weakest ${primaryAttributeName(check, arc)} performer.`
            : `Everyone clears the ${primaryAttributeName(check, arc)} bar; watch stress and morale before rerunning.`,
      });
    }
  }
  return results;
}

function describeAttributeWeights(check: MechanicCheck, arc: Arc): string {
  return check.attributeWeights
    .map((aw) => {
      const attr = arc.attributes.find((a) => a.id === aw.attributeId);
      return `${attr?.name ?? aw.attributeId} ${Math.round(aw.weight * 100)}%`;
    })
    .join(" · ");
}

function primaryAttributeName(check: MechanicCheck, arc: Arc): string {
  const primary = check.attributeWeights.reduce(
    (best, aw) => (aw.weight > best.weight ? aw : best),
    check.attributeWeights[0]!,
  );
  return (
    arc.attributes.find((a) => a.id === primary.attributeId)?.name ??
    primary.attributeId
  );
}

function primaryAttributeDescription(check: MechanicCheck, arc: Arc): string {
  const primary = check.attributeWeights.reduce(
    (best, aw) => (aw.weight > best.weight ? aw : best),
    check.attributeWeights[0]!,
  );
  return (
    arc.attributes.find((a) => a.id === primary.attributeId)?.description ??
    "Primary check attribute."
  );
}

function describeScope(scope: MechanicCheck["scope"]): string {
  if (scope === "team_aggregate")
    return "Team average check — adding a weak agent can lower the projection.";
  if (scope === "role_specific")
    return "Role check — the required role carrier is the make-or-break agent.";
  return "Every-agent check — one weak member can fail the whole mechanic.";
}

function estimateScore(
  agent: Agent,
  check: MechanicCheck,
  allAgents: Agent[],
  org: Organization,
  arc: Arc,
): number {
  const rawScore = check.attributeWeights.reduce(
    (s, aw) => s + (agent.attributes[aw.attributeId] ?? 0) * aw.weight,
    0,
  );

  let gearBonus = 0;
  let best = check.attributeWeights[0]!;
  for (const aw of check.attributeWeights) {
    if (aw.weight > best.weight) best = aw;
  }
  for (const [, itemId] of Object.entries(agent.equippedItems)) {
    const item = arc.items.find((it) => it.id === itemId);
    if (item) gearBonus += item.statBonuses[best.attributeId] ?? 0;
  }
  gearBonus *= 0.5;

  const others = allAgents.filter((a) => a.id !== agent.id);
  let relMod = 0;
  if (others.length > 0) {
    for (const other of others) {
      const rel = org.relationships.find(
        (r) =>
          (r.agentIds[0] === agent.id && r.agentIds[1] === other.id) ||
          (r.agentIds[0] === other.id && r.agentIds[1] === agent.id),
      );
      relMod += RELATIONSHIP_MODS[rel?.state ?? "Neutral"];
    }
    relMod /= others.length;
  }

  const moraleMod = (agent.morale - 50) / 10;
  const afflictionMod =
    agent.afflictionState.kind !== "none"
      ? AFFLICTION_PENALTIES[agent.afflictionState.kind].scoreMod
      : 0;

  let traitBonus = 0;
  for (const tid of agent.traits) {
    const t =
      arc.customTraits.find((c) => c.id === tid) ??
      DEFAULT_TRAIT_POOL.find((d) => d.id === tid);
    if (!t) continue;
    for (const fx of t.effects) {
      if (
        fx.kind === "attributeCheckBonus" &&
        check.attributeWeights.some((aw) => aw.attributeId === fx.attributeId)
      ) {
        traitBonus += fx.bonus;
      }
    }
  }

  // No rng variance — this is the expected score, not the actual roll
  return rawScore + gearBonus + relMod + moraleMod + afflictionMod + traitBonus;
}

export function predictImminentEvents(org: Organization, arc: Arc): string[] {
  const events: string[] = [];
  for (const [, agent] of Object.entries(org.agents)) {
    if (agent.stress >= 8 && agent.afflictionState.kind === "none") {
      events.push(
        `${agent.name} affliction in ~${10 - agent.stress} cycle${10 - agent.stress === 1 ? "" : "s"}`,
      );
    }
    const assignments = agent.assignmentHistory.length;
    const traitThresholds = [5, 12];
    for (const t of traitThresholds) {
      if (assignments < t && assignments >= t - 3) {
        events.push(
          `${agent.name} trait reveal in ${t - assignments} job${t - assignments === 1 ? "" : "s"}`,
        );
        break;
      }
    }
  }
  const recLevel = org.infrastructure["Recreation"]?.level ?? 0;
  if (recLevel < 3) {
    events.push(`Recreation L${recLevel + 1} → +1 token/cycle`);
  }
  return events;
}
