import { compareCodepoints, orderedStrings } from "../engine/determinism.js";
import type {
  NarrativeActorSnapshot,
  NarrativeBindingReceipt,
  NarrativeRoleBindingReceipt,
  NarrativeRoleCandidateReceipt,
  NarrativeRoleQuery,
} from "./types.js";

function uniqueOrdered(values: readonly string[]): string[] {
  return orderedStrings([...new Set(values)]);
}

function candidateReceipt(
  actor: NarrativeActorSnapshot,
  query: NarrativeRoleQuery,
  bindings: Readonly<Record<string, string>>,
): NarrativeRoleCandidateReceipt {
  const failures: string[] = [];
  const tags = new Set(actor.tags);

  for (const roleId of query.notAlreadyBound ?? []) {
    if (bindings[roleId] === actor.id) failures.push(`already-bound:${roleId}`);
  }

  for (const tag of query.requiredTags ?? []) {
    if (!tags.has(tag)) failures.push(`missing-tag:${tag}`);
  }

  for (const tag of query.forbiddenTags ?? []) {
    if (tags.has(tag)) failures.push(`forbidden-tag:${tag}`);
  }

  for (const [metric, minimum] of Object.entries(query.minimumMetrics ?? {})) {
    const actual = actor.metrics[metric] ?? 0;
    if (actual < minimum) failures.push(`metric:${metric}:${actual}<${minimum}`);
  }

  let score = 0;
  for (const term of query.scoreTerms ?? []) {
    score += (actor.metrics[term.metric] ?? 0) * term.weight;
  }
  for (const bonus of query.tagBonuses ?? []) {
    if (tags.has(bonus.tag)) score += bonus.value;
  }

  return {
    actorId: actor.id,
    eligible: failures.length === 0,
    score,
    failures: orderedStrings(failures),
  };
}

export function bindNarrativeRoles(
  queries: readonly NarrativeRoleQuery[],
  actors: readonly NarrativeActorSnapshot[],
): NarrativeBindingReceipt {
  const actorById = new Map(actors.map((actor) => [actor.id, actor] as const));
  const allActorIds = uniqueOrdered(actors.map((actor) => actor.id));
  const bindings: Record<string, string> = {};
  const roles: NarrativeRoleBindingReceipt[] = [];
  const failures: string[] = [];
  const seenRoleIds = new Set<string>();

  for (const query of queries) {
    if (seenRoleIds.has(query.id)) {
      failures.push(`duplicate-role:${query.id}`);
      roles.push({ roleId: query.id, selectedActorId: null, candidates: [] });
      continue;
    }
    seenRoleIds.add(query.id);

    const poolIds = uniqueOrdered(query.fromActorIds ?? allActorIds);
    const candidates = poolIds
      .map((actorId) => actorById.get(actorId))
      .filter((actor): actor is NarrativeActorSnapshot => actor !== undefined)
      .map((actor) => candidateReceipt(actor, query, bindings));

    const eligible = candidates
      .filter((candidate) => candidate.eligible)
      .sort((left, right) => right.score - left.score || compareCodepoints(left.actorId, right.actorId));

    const selectedActorId = eligible[0]?.actorId ?? null;
    if (selectedActorId !== null) bindings[query.id] = selectedActorId;
    if (query.required && selectedActorId === null) failures.push(`unbound-required-role:${query.id}`);

    roles.push({
      roleId: query.id,
      selectedActorId,
      candidates: [...candidates].sort((left, right) => compareCodepoints(left.actorId, right.actorId)),
    });
  }

  return {
    bindings,
    roles,
    failures: orderedStrings(failures),
  };
}
