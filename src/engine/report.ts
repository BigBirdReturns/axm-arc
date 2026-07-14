import type { Agent, Arc, Challenge, NarrativeTemplate, RunReport, AgentRunResult, MechanicResult } from "./types";
import { Rng } from "./prng";
import { compareCodepoints } from "./determinism.js";

export const DEFAULT_TEMPLATES: NarrativeTemplate[] = [
  {
    trigger: "challenge_complete",
    tone: "neutral",
    conditions: {},
    text: "{challenge.name} concluded. Outcome: {outcome}.",
  },
  {
    trigger: "challenge_complete",
    tone: "triumphant",
    conditions: { outcome: "success" },
    text: "{challenge.name} cleared. Every objective met.",
  },
  {
    trigger: "challenge_complete",
    tone: "grim",
    conditions: { outcome: "failure" },
    text: "{challenge.name} ended in failure. The team fell short.",
  },
  {
    trigger: "mechanic_check_passed",
    tone: "tense",
    conditions: { marginMin: 1, marginMax: 5 },
    text: "{agent.name} barely handled {mechanic.name}, scraping through with nothing to spare.",
  },
  {
    trigger: "mechanic_check_passed",
    tone: "neutral",
    conditions: { marginMin: 6, marginMax: 9 },
    text: "{agent.name} passed {mechanic.name} with a comfortable margin.",
  },
  {
    trigger: "mechanic_check_passed",
    tone: "neutral",
    conditions: { marginMin: 10, marginMax: 9999 },
    text: "{agent.name} breezed through {mechanic.name}. No drama.",
  },
  {
    trigger: "mechanic_check_passed",
    tone: "triumphant",
    conditions: { volatilityMin: 15, marginMin: 8, marginMax: 9999 },
    text: "{agent.name} pulled something out of nowhere on {mechanic.name}. Nobody expected that.",
  },
  {
    trigger: "mechanic_check_failed",
    tone: "grim",
    conditions: {},
    text: "{agent.name} failed {mechanic.name}. Score {score} vs threshold {threshold}.",
  },
  {
    trigger: "mechanic_check_failed",
    tone: "tense",
    conditions: { marginMin: -5, marginMax: -1 },
    text: "{agent.name} just missed {mechanic.name} — {score} against {threshold}. So close.",
  },
  {
    trigger: "loot_drop",
    tone: "neutral",
    conditions: {},
    text: "Reward secured: {item.name}.",
  },
];

interface RenderContext {
  agentMap: Map<string, Agent>;
  challenge: Challenge;
  arc: Arc;
  report: RunReport;
}

function substitute(
  text: string,
  vars: Record<string, string | number>,
): string {
  return text.replace(/\{([^}]+)\}/g, (match, key: string) => {
    const val = vars[key];
    return val !== undefined ? String(val) : match;
  });
}

function matchesConditions(
  template: NarrativeTemplate,
  ctx: {
    margin?: number;
    volatility?: number;
    outcome?: string;
  },
): boolean {
  const c = template.conditions as Record<string, unknown>;
  if (Object.keys(c).length === 0) return true;

  if (c["outcome"] !== undefined && c["outcome"] !== ctx.outcome) return false;

  const marginMin = c["marginMin"] as number | undefined;
  const marginMax = c["marginMax"] as number | undefined;
  if (marginMin !== undefined && ctx.margin !== undefined && ctx.margin < marginMin) return false;
  if (marginMax !== undefined && ctx.margin !== undefined && ctx.margin > marginMax) return false;

  const volMin = c["volatilityMin"] as number | undefined;
  if (volMin !== undefined && (ctx.volatility ?? 0) < volMin) return false;

  return true;
}

function pickTemplate(
  templates: NarrativeTemplate[],
  trigger: string,
  ctx: { margin?: number; volatility?: number; outcome?: string },
  seedRng: Rng,
): NarrativeTemplate | null {
  const candidates = templates.filter(
    (t) => t.trigger === trigger && matchesConditions(t, ctx),
  );
  // More specific templates (more conditions) win; among equals pick by seed rng
  candidates.sort((a, b) => Object.keys(b.conditions).length - Object.keys(a.conditions).length);
  if (candidates.length === 0) return null;
  const best = candidates[0]!;
  const topScore = Object.keys(best.conditions).length;
  const tied = candidates.filter((c) => Object.keys(c.conditions).length === topScore);
  return tied.length === 1 ? tied[0]! : seedRng.pick(tied);
}

function renderMechanicLine(
  ar: AgentRunResult,
  mr: MechanicResult,
  ctx: RenderContext,
  allTemplates: NarrativeTemplate[],
  seedRng: Rng,
): string {
  const agent = ctx.agentMap.get(ar.agentId);
  const mechanic = ctx.challenge.mechanicChecks.find((m) => m.id === mr.mechanicId);
  if (!agent || !mechanic) return "";

  const margin = mr.score - mr.threshold;
  const trigger = mr.passed ? "mechanic_check_passed" : "mechanic_check_failed";
  const tmpl = pickTemplate(allTemplates, trigger, {
    margin,
    volatility: agent.hiddenAttributes.volatility,
  }, seedRng);

  if (!tmpl) return "";

  const role = ctx.arc.roles.find((r) => r.id === agent.role);
  const vars: Record<string, string | number> = {
    "agent.name": agent.name,
    "agent.role": role?.name ?? agent.role ?? "Unknown",
    "challenge.name": ctx.challenge.name,
    "mechanic.name": mechanic.name,
    score: Math.round(mr.score),
    threshold: mr.threshold,
    margin: Math.round(margin),
    outcome: ctx.report.outcome,
  };

  return substitute(tmpl.text, vars);
}

function findMostNotableMechanic(ar: AgentRunResult): MechanicResult | null {
  if (ar.mechanicResults.length === 0) return null;
  // Prefer failures, then closest margins
  const failed = ar.mechanicResults.filter((mr) => !mr.passed);
  if (failed.length > 0) {
    return failed.sort((a, b) =>
      (b.score - b.threshold) - (a.score - a.threshold) || compareCodepoints(a.mechanicId, b.mechanicId)
    )[0]!;
  }
  // All passed: pick the closest (smallest positive margin)
  return [...ar.mechanicResults].sort((a, b) =>
    (a.score - a.threshold) - (b.score - b.threshold) || compareCodepoints(a.mechanicId, b.mechanicId)
  )[0]!;
}

export function renderReport(
  report: RunReport,
  templates: NarrativeTemplate[],
  opts: { agents: Map<string, Agent>; challenge: Challenge; arc: Arc },
): string {
  const allTemplates = [...templates, ...DEFAULT_TEMPLATES];
  const seedRng = new Rng(report.narrativeSeed);

  const ctx: RenderContext = {
    agentMap: opts.agents,
    challenge: opts.challenge,
    arc: opts.arc,
    report,
  };

  const lines: string[] = [];

  // Opener
  const openerTmpl = pickTemplate(allTemplates, "challenge_complete", { outcome: report.outcome }, seedRng);
  if (openerTmpl) {
    const vars: Record<string, string | number> = {
      "challenge.name": opts.challenge.name,
      outcome: report.outcome,
    };
    lines.push(substitute(openerTmpl.text, vars));
  }

  // Per-agent most notable mechanic
  for (const ar of report.assignedAgents) {
    const mr = findMostNotableMechanic(ar);
    if (mr) {
      const line = renderMechanicLine(ar, mr, ctx, allTemplates, seedRng);
      if (line) lines.push(line);
    }
  }

  // Loot lines
  for (const drop of report.lootDrops) {
    const item = opts.arc.items.find((it) => it.id === drop.itemId);
    const tmpl = pickTemplate(allTemplates, "loot_drop", {}, seedRng);
    if (item && tmpl) {
      lines.push(substitute(tmpl.text, { "item.name": item.name }));
    }
  }

  return lines.join("\n");
}
