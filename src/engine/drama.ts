import type { Organization, DramaCard, DramaCardEffect, DramaCardOption, Precedent } from "./types.js";
import { MAX_DRAMA_CARDS_PER_CYCLE } from "./constants.js";
import type { Rng } from "./prng.js";
import { hashSeed } from "./prng.js";

// ── DramaTriggerInput ─────────────────────────────────────────────────────────

export type DramaTriggerInput =
  | { type: "relationship_transition"; agentA: string; agentB: string; from: string; to: string }
  | { type: "reward_dispute"; itemId: string; eligible: string[]; winner: string }
  | { type: "precedent_violation"; affectedAgents: string[]; basis: string; dominant: string }
  | { type: "morale_extreme"; agentId: string; morale: number }
  | { type: "affliction_threshold"; agentId: string; affliction: string }
  | { type: "prolonged_benching"; agentId: string; cyclesBenched: number }
  | { type: "rivalrous_perf_gap"; agentA: string; agentB: string; gap: number }
  | { type: "bonded_partner_lost"; agentId: string; partnerId: string };

// ── Narrative Templates ───────────────────────────────────────────────────────

const TEMPLATES: Record<string, string[]> = {
  relationship_transition: [
    "A shift in the dynamic between {agentA} and {agentB} has not gone unnoticed.",
    "Tension between {agentA} and {agentB} has reached a breaking point.",
    "The bond between {agentA} and {agentB} has changed — for better or worse.",
    "Word travels fast: {agentA} and {agentB} are no longer on the same page.",
    "Something happened between {agentA} and {agentB}. The org feels it.",
  ],
  reward_dispute: [
    "Both {agentA} and {agentB} earned that reward. You have to choose.",
    "The item is on the table. {agentA} and {agentB} are both watching.",
    "A dispute has emerged over who deserves the reward — {agentA} or {agentB}.",
    "Allocation time. {agentA} has been waiting. So has {agentB}.",
    "{agentA} and {agentB} each have a case. What's your call?",
  ],
  precedent_violation: [
    "You're about to make a decision that contradicts past patterns. Agents are watching.",
    "Some members remember how you handled this before — and this looks different.",
    "A policy inconsistency has been noted by the observant members of the org.",
    "Breaking from established precedent rarely goes unnoticed in a tight-knit team.",
    "The decision sits uncomfortably against the history of how things have worked here.",
  ],
  morale_extreme: [
    "{agent} is either burning bright or burning out — their state is critical.",
    "Something has pushed {agent} to an emotional extreme. Address it or watch it escalate.",
    "{agent}'s morale has hit a tipping point. The org can feel the shift.",
    "The rest of the team is watching how you handle {agent} right now.",
    "{agent} is not okay. Or is extremely okay. Either way, it matters.",
  ],
  affliction_threshold: [
    "{agent} has cracked under the pressure. An affliction has set in.",
    "Stress finally broke {agent}. They need intervention — or they'll break others.",
    "{agent} is no longer stable. The rest of the team is noticing.",
    "What happened to {agent} is a symptom. Ignore it and you'll get more.",
    "{agent} pushed past their limit. Now you deal with the fallout.",
  ],
  prolonged_benching: [
    "{agent} has been sidelined for too long. They're feeling it.",
    "{agent} hasn't been assigned in {cycles} cycles. That's not going unnoticed.",
    "Being benched for this long is a message — and {agent} is reading it.",
    "{agent} expected to be called up. Three cycles later, still waiting.",
    "{agent}'s patience has limits. Those limits are being tested.",
  ],
  rivalrous_perf_gap: [
    "{agentA} outperformed {agentB} by a significant margin. The rivalry is escalating.",
    "A performance gap this wide between rivals doesn't stay quiet for long.",
    "{agentB} is watching {agentA}'s numbers with increasing frustration.",
    "The competition between {agentA} and {agentB} has become lopsided. That has consequences.",
    "{agentA} proved a point. {agentB} is going to respond somehow.",
  ],
  bonded_partner_lost: [
    "{agent}'s closest partner is gone. That kind of loss doesn't resolve quietly.",
    "When you lose someone you're bonded with, it changes you. Ask {agent}.",
    "{agent} is processing a loss that has no clean resolution.",
    "The bond {agent} had was rare. Losing it will leave a mark.",
    "{agent} and their partner built something. Now half of it is gone.",
  ],
};

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

function pickTemplate(rng: Rng, triggerType: string): string {
  const pool = TEMPLATES[triggerType] ?? ["A significant event has occurred."];
  return rng.pick(pool);
}

// ── Option Generation ─────────────────────────────────────────────────────────

function makeEffect(target: string, type: string, value: number): DramaCardEffect {
  return { target, type, value };
}

function makeOption(
  id: string,
  label: string,
  description: string,
  effects: DramaCardEffect[],
  hiddenEffects: DramaCardEffect[],
): DramaCardOption {
  return { id, label, description, effects, hiddenEffects };
}

function optionsForTrigger(trigger: DramaTriggerInput, _rng: Rng, org: Organization): DramaCardOption[] {
  const n = (id: string) => org.agents[id]?.name ?? id;
  switch (trigger.type) {
    case "reward_dispute": {
      const [first, second] = trigger.eligible;
      const a = first ?? trigger.winner;
      const b = second ?? a;
      return [
        makeOption(
          "award_a",
          `Award to ${n(a)}`,
          `Give the item to ${n(a)}. Other eligible agents may be disappointed.`,
          [makeEffect(a, "equip_item", 1), makeEffect(trigger.winner, "morale", 5)],
          [makeEffect(b, "affinity_toward_winner", -5), makeEffect("_org_", "loyalty_loss", -2)],
        ),
        makeOption(
          "award_b",
          `Award to ${n(b)}`,
          `Give the item to ${n(b)}. Changes the power distribution in the org.`,
          [makeEffect(b, "equip_item", 1), makeEffect(b, "morale", 5)],
          [makeEffect(a, "affinity_toward_winner", -5), makeEffect("_org_", "loyalty_loss", -2)],
        ),
        makeOption(
          "disenchant",
          "Disenchant",
          "No one gets the item. Convert it to resources. Avoids conflict but wastes potential.",
          [makeEffect("_org_", "resources", 10)],
          [makeEffect(a, "morale", -3), makeEffect(b, "morale", -3)],
        ),
      ];
    }
    case "relationship_transition": {
      const { agentA, agentB, to } = trigger;
      return [
        makeOption(
          "intervene",
          "Intervene directly",
          "Sit down with both agents. Takes time but may prevent escalation.",
          [makeEffect(agentA, "affinity", 5), makeEffect(agentB, "affinity", 5)],
          [makeEffect("_org_", "reputation", -1)],
        ),
        makeOption(
          "separate",
          "Separate them",
          `Reassign ${n(agentA)} or ${n(agentB)} to different challenges.`,
          [makeEffect(agentA, "stress", -1), makeEffect(agentB, "stress", -1)],
          [makeEffect(agentA, "morale", -5)],
        ),
        makeOption(
          "let_it_play",
          "Let it play out",
          `The transition to ${to} may stabilize on its own. Or worsen.`,
          [],
          [makeEffect(agentA, "affinity", -3)],
        ),
      ];
    }
    case "prolonged_benching": {
      const { agentId } = trigger;
      return [
        makeOption(
          "promise_rotation",
          "Promise rotation",
          `Commit to reassigning ${n(agentId)} next cycle. High morale upside, high expectation risk.`,
          [makeEffect(agentId, "morale", 10)],
          [makeEffect(agentId, "loyalty", 3)],
        ),
        makeOption(
          "stay_course",
          "Stay the course",
          "No change to current assignments. The bench continues.",
          [makeEffect(agentId, "stress", 1)],
          [makeEffect(agentId, "loyalty", -3)],
        ),
        makeOption(
          "promote_officer",
          "Promote to officer",
          `Elevate ${n(agentId)}'s role. Addresses grievance through status rather than action.`,
          [makeEffect(agentId, "morale", 15), makeEffect(agentId, "stress", -2)],
          [makeEffect("_org_", "precedent_favoritism", 1)],
        ),
      ];
    }
    case "morale_extreme": {
      const { agentId } = trigger;
      return [
        makeOption(
          "acknowledge",
          "Acknowledge publicly",
          `Recognize ${n(agentId)}'s state in front of the team. Builds culture.`,
          [makeEffect(agentId, "morale", 8), makeEffect("_org_", "morale_all", 3)],
          [],
        ),
        makeOption(
          "private_talk",
          "Private conversation",
          `Talk to ${n(agentId)} one-on-one. Lower visibility but more personal.`,
          [makeEffect(agentId, "morale", 5), makeEffect(agentId, "loyalty", 2)],
          [],
        ),
        makeOption(
          "ignore",
          "Ignore it",
          "Don't engage. The situation may resolve or spiral.",
          [],
          [makeEffect(agentId, "morale", -5)],
        ),
      ];
    }
    case "affliction_threshold": {
      const { agentId } = trigger;
      return [
        makeOption(
          "rest_treatment",
          "Send to rest",
          `Assign ${n(agentId)} to Recreation this cycle. Reduces stress, delays affliction impact.`,
          [makeEffect(agentId, "stress", -2), makeEffect(agentId, "morale", 5)],
          [],
        ),
        makeOption(
          "push_through",
          "Push through",
          "Keep the agent on assignment despite the affliction. Risk morale cascade.",
          [makeEffect(agentId, "stress", 2)],
          [makeEffect("_org_", "morale_all", -3)],
        ),
        makeOption(
          "bench_indefinitely",
          "Bench indefinitely",
          "Remove the agent from rotations until they recover. Roster strain.",
          [makeEffect(agentId, "stress", -3)],
          [makeEffect("_org_", "roster_strain", 1)],
        ),
      ];
    }
    case "precedent_violation": {
      return [
        makeOption(
          "explain",
          "Explain your reasoning",
          "Address the inconsistency publicly. Transparency costs political capital.",
          [makeEffect("_org_", "loyalty_loss", 1)],
          [makeEffect("_org_", "reputation", 2)],
        ),
        makeOption(
          "double_down",
          "Proceed without comment",
          "Make the call. Let your decisions speak for themselves.",
          [],
          [makeEffect("_org_", "loyalty_loss", -3)],
        ),
        makeOption(
          "revert",
          "Revert to precedent",
          "Change the decision to match historical pattern. Consistency over optimization.",
          [makeEffect("_org_", "loyalty_loss", 3)],
          [makeEffect("_org_", "precedent_consistency", 1)],
        ),
      ];
    }
    case "rivalrous_perf_gap": {
      const { agentA, agentB } = trigger;
      return [
        makeOption(
          "acknowledge_winner",
          `Highlight ${n(agentA)}'s performance`,
          "Acknowledge the gap. Motivates the winner; stings the loser.",
          [makeEffect(agentA, "morale", 5)],
          [makeEffect(agentB, "stress", 2)],
        ),
        makeOption(
          "mentor_pair",
          "Set up coaching",
          `Pair ${n(agentA)} and ${n(agentB)} in Training. May reduce rivalry, may increase tension.`,
          [makeEffect(agentB, "attributes", 1)],
          [makeEffect(agentA, "morale", -3)],
        ),
        makeOption(
          "ignore_gap",
          "Let the numbers speak",
          "No intervention. The rivalry continues.",
          [],
          [makeEffect(agentB, "stress", 1)],
        ),
      ];
    }
    case "bonded_partner_lost": {
      const { agentId } = trigger;
      return [
        makeOption(
          "memorial",
          "Commemorate the loss",
          `Honor the partner publicly. ${n(agentId)} needs to feel it acknowledged.`,
          [makeEffect(agentId, "morale", 5), makeEffect("_org_", "morale_all", 2)],
          [makeEffect(agentId, "stress", -1)],
        ),
        makeOption(
          "new_assignment",
          "Keep them busy",
          `Assign ${n(agentId)} immediately. Work as coping mechanism.`,
          [],
          [makeEffect(agentId, "stress", 2)],
        ),
        makeOption(
          "leave_of_absence",
          "Offer time off",
          `Bench ${agentId} voluntarily. Builds loyalty; costs roster capacity.`,
          [makeEffect(agentId, "loyalty", 5), makeEffect(agentId, "stress", -3)],
          [],
        ),
      ];
    }
  }
}

// ── Card severity for prioritization ─────────────────────────────────────────

function triggerSeverity(t: DramaTriggerInput): number {
  switch (t.type) {
    case "relationship_transition": return 5;
    case "morale_extreme": return 4;
    case "bonded_partner_lost": return 4;
    case "affliction_threshold": return 3;
    case "precedent_violation": return 3;
    case "rivalrous_perf_gap": return 2;
    case "prolonged_benching": return 1;
    case "reward_dispute": return 2;
  }
}

function agentsInTrigger(t: DramaTriggerInput): string[] {
  switch (t.type) {
    case "relationship_transition": return [t.agentA, t.agentB];
    case "reward_dispute": return t.eligible;
    case "precedent_violation": return t.affectedAgents;
    case "morale_extreme": return [t.agentId];
    case "affliction_threshold": return [t.agentId];
    case "prolonged_benching": return [t.agentId];
    case "rivalrous_perf_gap": return [t.agentA, t.agentB];
    case "bonded_partner_lost": return [t.agentId, t.partnerId];
  }
}

function agentMaxTier(agentIds: string[], org: Organization): number {
  let max = 0;
  for (const id of agentIds) {
    const agent = org.agents[id];
    if (!agent) continue;
    const m = agent.tier.match(/\d+/);
    const t = m ? parseInt(m[0]!, 10) : 1;
    if (t > max) max = t;
  }
  return max;
}

// ── generateDramaCards ────────────────────────────────────────────────────────

export function generateDramaCards(
  triggers: DramaTriggerInput[],
  org: Organization,
  rng: Rng,
  cycle: number,
): DramaCard[] {
  const cards: DramaCard[] = [];

  for (const trigger of triggers) {
    const id = `drama_${cycle}_${hashSeed(trigger.type, cycle, cards.length)}`;
    const agents = agentsInTrigger(trigger);

    // Build narrative text variables
    const vars: Record<string, string> = {};
    if ("agentA" in trigger) vars["agentA"] = org.agents[trigger.agentA]?.name ?? trigger.agentA;
    if ("agentB" in trigger) vars["agentB"] = org.agents[trigger.agentB]?.name ?? trigger.agentB;
    if (trigger.type === "reward_dispute") {
      const [first, second] = trigger.eligible;
      const agentA = first ?? trigger.winner;
      const agentB = second ?? agentA;
      vars["agentA"] = org.agents[agentA]?.name ?? agentA;
      vars["agentB"] = org.agents[agentB]?.name ?? agentB;
    }
    if ("agentId" in trigger) vars["agent"] = org.agents[trigger.agentId]?.name ?? trigger.agentId;
    if ("cyclesBenched" in trigger) vars["cycles"] = String(trigger.cyclesBenched);

    const template = pickTemplate(rng, trigger.type);
    const narrativeText = fillTemplate(template, vars);

    const options = optionsForTrigger(trigger, rng, org);

    cards.push({
      id,
      cycleGenerated: cycle,
      triggerType: trigger.type,
      agentsInvolved: agents,
      narrativeText,
      options,
    });
  }

  return cards;
}

// ── enqueueDramaCards ─────────────────────────────────────────────────────────

export function enqueueDramaCards(
  org: Organization,
  cards: DramaCard[],
  _cycle: number,
): Organization {
  // Count cards already generated this cycle
  const thisCardCount = org.dramaQueue.filter(
    (c) => c.cycleGenerated === _cycle,
  ).length;

  let toAdd = cards;
  const available = MAX_DRAMA_CARDS_PER_CYCLE - thisCardCount;

  if (toAdd.length > available) {
    // We need to find the original trigger input for sorting, but we only have DramaCards.
    // Sort by severity heuristic from triggerType + agentTier.
    toAdd = [...toAdd].sort((a, b) => {
      const sevA = TRIGGER_TYPE_SEVERITY[a.triggerType] ?? 0;
      const sevB = TRIGGER_TYPE_SEVERITY[b.triggerType] ?? 0;
      if (sevB !== sevA) return sevB - sevA;
      // Tiebreak by max tier of involved agents
      const tierA = agentMaxTier(a.agentsInvolved, org);
      const tierB = agentMaxTier(b.agentsInvolved, org);
      return tierB - tierA;
    });
    toAdd = toAdd.slice(0, Math.max(0, available));
  }

  return { ...org, dramaQueue: [...org.dramaQueue, ...toAdd] };
}

const TRIGGER_TYPE_SEVERITY: Record<string, number> = {
  relationship_transition: 5,
  morale_extreme: 4,
  bonded_partner_lost: 4,
  affliction_threshold: 3,
  precedent_violation: 3,
  rivalrous_perf_gap: 2,
  reward_dispute: 2,
  prolonged_benching: 1,
};

// ── resolveDramaCard ──────────────────────────────────────────────────────────

export function resolveDramaCard(
  org: Organization,
  cardId: string,
  optionId: string,
  _cycle: number,
): { org: Organization; revealedHidden: DramaCardEffect[] } {
  const cardIdx = org.dramaQueue.findIndex((c) => c.id === cardId);
  if (cardIdx < 0) return { org, revealedHidden: [] };

  const card = org.dramaQueue[cardIdx]!;
  const option = card.options.find((o) => o.id === optionId);
  if (!option) return { org, revealedHidden: [] };

  // Apply visible effects (in this pure engine we just remove the card from queue;
  // callers apply the effects to agents — drama engine outputs the effect list)
  // We apply morale/stress effects to agents if targets are agent ids
  let result: Organization = {
    ...org,
    dramaQueue: org.dramaQueue.filter((_, i) => i !== cardIdx),
  };

  // Apply immediate visible effects to org state where possible
  for (const fx of option.effects) {
    result = applyEffect(result, fx);
  }

  // Hidden effects are returned for the caller to handle / surface later
  const revealedHidden = option.hiddenEffects;

  return { org: result, revealedHidden };
}

function applyEffect(org: Organization, fx: DramaCardEffect): Organization {
  const { target, type, value } = fx;

  if (target === "_org_") return org; // org-level effects are out of scope here

  const agent = org.agents[target];
  if (!agent) return org;

  switch (type) {
    case "morale": {
      const newMorale = Math.max(0, Math.min(100, agent.morale + value));
      return { ...org, agents: { ...org.agents, [target]: { ...agent, morale: newMorale } } };
    }
    case "stress": {
      const newStress = Math.max(0, Math.min(10, agent.stress + value));
      return { ...org, agents: { ...org.agents, [target]: { ...agent, stress: newStress } } };
    }
    case "loyalty": {
      const newLoyalty = Math.max(0, Math.min(20, agent.hiddenAttributes.loyalty + value));
      return {
        ...org,
        agents: {
          ...org.agents,
          [target]: { ...agent, hiddenAttributes: { ...agent.hiddenAttributes, loyalty: newLoyalty } },
        },
      };
    }
    default:
      return org;
  }
}

// ── Re-export for use by rewards.ts ──────────────────────────────────────────
export type { Precedent };
