import "./abi13.js";
import type {
  CompositionConstraint,
  CompositionConstraintResult,
  CompositionEvaluation,
  CompositionProfile,
} from "./abi13.js";
import { compareCodepoints } from "./determinism.js";
import type { Agent, Arc, Challenge } from "./types.js";

function sorted(values: Iterable<string>): string[] {
  return [...values].sort(compareCodepoints);
}

function compare(value: number, comparison: "gte" | "lte" | "eq", threshold: number): boolean {
  if (comparison === "gte") return value >= threshold;
  if (comparison === "lte") return value <= threshold;
  return value === threshold;
}

function overlaps(left: { min: number; max: number }, right: { min: number; max: number }): boolean {
  return left.min <= right.max && right.min <= left.max;
}

interface EvaluationContext {
  agents: Agent[];
  profilesById: Map<string, CompositionProfile>;
}

function profileFor(agent: Agent, ctx: EvaluationContext): CompositionProfile | null {
  if (!agent.compositionProfileId) return null;
  return ctx.profilesById.get(agent.compositionProfileId) ?? null;
}

function leafResult(
  constraint: CompositionConstraint,
  passed: boolean,
  reason: string,
  matchedAgentIds: string[],
): CompositionConstraintResult {
  return {
    id: constraint.id,
    label: constraint.label,
    kind: constraint.kind,
    ...(constraint.category ? { category: constraint.category } : {}),
    passed,
    reason,
    matchedAgentIds: sorted(matchedAgentIds),
  };
}

function evaluateConstraint(constraint: CompositionConstraint, ctx: EvaluationContext): CompositionConstraintResult {
  if (constraint.kind === "all" || constraint.kind === "any") {
    const children = constraint.constraints.map((child) => evaluateConstraint(child, ctx));
    const passed = constraint.kind === "all"
      ? children.every((child) => child.passed)
      : children.some((child) => child.passed);
    const matched = new Set(children.flatMap((child) => child.matchedAgentIds));
    return {
      id: constraint.id,
      label: constraint.label,
      kind: constraint.kind,
      ...(constraint.category ? { category: constraint.category } : {}),
      passed,
      reason: passed
        ? `${constraint.kind === "all" ? "All" : "At least one"} nested composition condition passed.`
        : `${constraint.kind === "all" ? "One or more" : "Every"} nested composition condition failed.`,
      matchedAgentIds: sorted(matched),
      children,
    };
  }

  if (constraint.kind === "role-count") {
    const matched = ctx.agents.filter((agent) => agent.role === constraint.roleId).map((agent) => agent.id);
    const passed = matched.length >= constraint.min && (constraint.max === undefined || matched.length <= constraint.max);
    return leafResult(
      constraint,
      passed,
      `Role ${constraint.roleId}: ${matched.length}; required ${constraint.min}${constraint.max === undefined ? "+" : `..${constraint.max}`}.`,
      matched,
    );
  }

  if (constraint.kind === "profile-count") {
    const accepted = new Set(constraint.profileIds);
    const matched = ctx.agents
      .filter((agent) => agent.compositionProfileId !== undefined && accepted.has(agent.compositionProfileId))
      .map((agent) => agent.id);
    const passed = matched.length >= constraint.min && (constraint.max === undefined || matched.length <= constraint.max);
    return leafResult(
      constraint,
      passed,
      `Profiles [${constraint.profileIds.join(", ")}]: ${matched.length}; required ${constraint.min}${constraint.max === undefined ? "+" : `..${constraint.max}`}.`,
      matched,
    );
  }

  if (constraint.kind === "tag-count") {
    const matched = ctx.agents
      .filter((agent) => profileFor(agent, ctx)?.tags.includes(constraint.tag) ?? false)
      .map((agent) => agent.id);
    const passed = matched.length >= constraint.min && (constraint.max === undefined || matched.length <= constraint.max);
    return leafResult(
      constraint,
      passed,
      `Tag ${constraint.tag}: ${matched.length}; required ${constraint.min}${constraint.max === undefined ? "+" : `..${constraint.max}`}.`,
      matched,
    );
  }

  if (constraint.kind === "metric-sum") {
    const matched: string[] = [];
    let value = 0;
    for (const agent of ctx.agents) {
      const metric = profileFor(agent, ctx)?.metrics[constraint.metric];
      if (metric === undefined) continue;
      matched.push(agent.id);
      value += metric;
    }
    const passed = compare(value, constraint.comparison, constraint.threshold);
    return leafResult(
      constraint,
      passed,
      `Metric ${constraint.metric} sum ${value} ${constraint.comparison} ${constraint.threshold}.`,
      matched,
    );
  }

  if (constraint.kind === "range-overlap") {
    const matched = ctx.agents
      .filter((agent) => {
        const range = profileFor(agent, ctx)?.ranges[constraint.range];
        return range ? overlaps(range, constraint.required) : false;
      })
      .map((agent) => agent.id);
    const passed = matched.length >= constraint.minProfiles;
    return leafResult(
      constraint,
      passed,
      `Range ${constraint.range} overlaps [${constraint.required.min}, ${constraint.required.max}] for ${matched.length}; required ${constraint.minProfiles}.`,
      matched,
    );
  }

  if (constraint.kind === "fraction") {
    const matched = ctx.agents
      .filter((agent) => profileFor(agent, ctx)?.tags.includes(constraint.tag) ?? false)
      .map((agent) => agent.id);
    const fraction = ctx.agents.length === 0 ? 0 : matched.length / ctx.agents.length;
    return leafResult(
      constraint,
      fraction >= constraint.minFraction,
      `Tag ${constraint.tag} fraction ${fraction.toFixed(3)}; required ${constraint.minFraction.toFixed(3)}.`,
      matched,
    );
  }

  if (constraint.kind !== "redundancy") throw new Error(`Unsupported composition constraint ${constraint.kind}.`);
  const matching = ctx.agents.filter((agent) => profileFor(agent, ctx)?.tags.includes(constraint.tag) ?? false);
  const profileIds = new Set(matching.flatMap((agent) => agent.compositionProfileId ? [agent.compositionProfileId] : []));
  return leafResult(
    constraint,
    profileIds.size >= constraint.minDistinctProfiles,
    `Tag ${constraint.tag} has ${profileIds.size} distinct profiles; required ${constraint.minDistinctProfiles}.`,
    matching.map((agent) => agent.id),
  );
}

function collectLeafResults(results: CompositionConstraintResult[]): CompositionConstraintResult[] {
  const out: CompositionConstraintResult[] = [];
  const visit = (result: CompositionConstraintResult) => {
    if (result.children?.length) result.children.forEach(visit);
    else out.push(result);
  };
  results.forEach(visit);
  return out;
}

/** A failed child inside a passing `any` is an explored alternative, not a
 * rejection of the composed watch. Rejection receipts descend only through a
 * top-level condition that itself failed. */
function collectRejectionReasons(result: CompositionConstraintResult): string[] {
  if (result.passed) return [];
  if (!result.children?.length) return [`${result.label}: ${result.reason}`];
  return result.children.flatMap(collectRejectionReasons);
}

export function evaluateComposition(opts: {
  challenge: Challenge;
  agents: Agent[];
  arc: Arc;
}): CompositionEvaluation {
  const constraints = opts.challenge.compositionConstraints ?? [];
  if (constraints.length === 0) {
    return { feasible: true, results: [], rejectionReasons: [], dependencies: [], singlePointsOfFailure: [] };
  }

  const profilesById = new Map((opts.arc.compositionProfiles ?? []).map((profile) => [profile.id, profile]));
  const agents = [...opts.agents].sort((left, right) => compareCodepoints(left.id, right.id));
  const missing = agents.filter((agent) => !agent.compositionProfileId || !profilesById.has(agent.compositionProfileId));
  if (missing.length > 0) {
    const reasons = missing.map((agent) => `Agent ${agent.id} has no declared composition profile.`);
    return {
      feasible: false,
      results: [],
      rejectionReasons: reasons,
      dependencies: [],
      singlePointsOfFailure: missing.map((agent) => `agent:${agent.id}`),
    };
  }

  const ctx: EvaluationContext = { agents, profilesById };
  const results = constraints.map((constraint) => evaluateConstraint(constraint, ctx));
  const leaves = collectLeafResults(results);
  const rejectionReasons = results.flatMap(collectRejectionReasons);

  const dependencyCounts = new Map<string, number>();
  for (const agent of agents) {
    const profile = profileFor(agent, ctx)!;
    for (const dependency of profile.dependencies) {
      dependencyCounts.set(dependency, (dependencyCounts.get(dependency) ?? 0) + 1);
    }
  }
  const dependencies = sorted(dependencyCounts.keys());
  const singlePoints = new Set<string>();
  for (const [dependency, count] of dependencyCounts) {
    if (count === 1) singlePoints.add(`dependency:${dependency}`);
  }
  for (const result of leaves) {
    if (result.passed && result.matchedAgentIds.length === 1) {
      singlePoints.add(`agent:${result.matchedAgentIds[0]}`);
    }
  }

  return {
    feasible: results.every((result) => result.passed),
    results,
    rejectionReasons,
    dependencies,
    singlePointsOfFailure: sorted(singlePoints),
  };
}

export function compositionClearsGates(challenge: Challenge, agents: Agent[], arc: Arc): boolean {
  return evaluateComposition({ challenge, agents, arc }).feasible;
}
