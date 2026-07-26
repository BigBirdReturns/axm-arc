import { compareCodepoints, orderedStrings } from "../engine/determinism.js";
import { hashSeed } from "../engine/prng.js";
import { bindNarrativeRoles } from "./bindings.js";
import { validateNarrativeRecipes } from "./recipe-validate.js";
import type {
  NarrativeActorMove,
  NarrativeActorSnapshot,
  NarrativeAuthority,
  NarrativeBeatFunction,
  NarrativeBindingReceipt,
  NarrativeCandidate,
  NarrativeFact,
  NarrativeObligation,
  NarrativeObligationDraft,
  NarrativeRoleQuery,
  NarrativeRuntimeState,
  NarrativeStatePayment,
  NarrativeTrackDisposition,
  NarrativeTrackState,
} from "./types.js";

export const NARRATIVE_RECIPE_FORMAT = "axm-narrative-recipe/1" as const;
export const NARRATIVE_GENERATION_FORMAT = "axm-narrative-generation/1" as const;

export interface NarrativeFactPattern {
  types?: string[];
  requiredTags?: string[];
  forbiddenTags?: string[];
  minimumSeverity?: number;
  maximumSeverity?: number;
}

export interface NarrativeRecipeRoleQuery extends Omit<NarrativeRoleQuery, "fromActorIds"> {
  pool: "fact-actors" | "fact-role" | "all-actors";
  factRole?: string;
}

export type NarrativeValueReference =
  | { kind: "literal"; value: string }
  | { kind: "fact-id" }
  | { kind: "track-id" }
  | { kind: "role"; roleId: string };

export interface NarrativeActorMoveTemplate {
  roleId: string;
  moveTag: string;
}

export interface NarrativeStatePaymentTemplate {
  kind: string;
  target: NarrativeValueReference;
  tags: string[];
}

export interface NarrativeObligationTemplate {
  idPrefix: string;
  kind: string;
  actorRoleIds: string[];
  tags: string[];
  pressure: number;
  dueCycleOffset?: number;
}

export type NarrativeRecipeTrackPlan =
  | {
      kind: "open";
      railId: string;
      controllingQuestion: string;
      actorRoleIds: string[];
      pressureTags: string[];
      trackIdPrefix?: string;
    }
  | {
      kind: "advance";
      railId?: string;
      actorRoleIds: string[];
      requireSharedActor?: boolean;
      requireSharedPressureTag?: boolean;
    };

export interface NarrativeResolutionPlan {
  kinds: string[];
  policy: "none" | "highest-relevant" | "all-relevant";
  required?: boolean;
}

export interface NarrativeSituationRecipe {
  format: typeof NARRATIVE_RECIPE_FORMAT;
  id: string;
  version: string;
  authority: NarrativeAuthority;
  factPattern: NarrativeFactPattern;
  roleQueries: NarrativeRecipeRoleQuery[];
  track: NarrativeRecipeTrackPlan;
  trackDisposition?: NarrativeTrackDisposition;
  beatFunction: NarrativeBeatFunction;
  actorMoves: NarrativeActorMoveTemplate[];
  tags: string[];
  pressureTags: string[];
  statePayments: NarrativeStatePaymentTemplate[];
  opensObligations: NarrativeObligationTemplate[];
  resolvesObligations: NarrativeResolutionPlan;
  authoredPriority: number;
  conditionComplexity?: number;
  cooldownCycles: number;
  presentationKey: string;
}

export interface NarrativeGenerationFailure {
  recipeId: string;
  factId: string;
  trackId?: string;
  reasons: string[];
  binding?: NarrativeBindingReceipt;
}

export interface NarrativeGenerationReceipt {
  format: typeof NARRATIVE_GENERATION_FORMAT;
  cycle: number;
  candidates: NarrativeCandidate[];
  failures: NarrativeGenerationFailure[];
}

function uniqueOrdered(values: readonly string[]): string[] {
  return orderedStrings([...new Set(values)]);
}

function factMatches(pattern: NarrativeFactPattern, fact: NarrativeFact): boolean {
  const tags = new Set(fact.tags);
  if ((pattern.types?.length ?? 0) > 0 && !pattern.types!.includes(fact.type)) return false;
  if ((pattern.requiredTags ?? []).some((tag) => !tags.has(tag))) return false;
  if ((pattern.forbiddenTags ?? []).some((tag) => tags.has(tag))) return false;
  if (fact.severity < (pattern.minimumSeverity ?? Number.NEGATIVE_INFINITY)) return false;
  if (fact.severity > (pattern.maximumSeverity ?? Number.POSITIVE_INFINITY)) return false;
  return true;
}

function roleQueryForFact(query: NarrativeRecipeRoleQuery, fact: NarrativeFact): NarrativeRoleQuery {
  const { pool, factRole, ...base } = query;
  if (pool === "fact-actors") return { ...base, fromActorIds: fact.actorIds };
  if (pool === "fact-role") {
    const actorId = factRole ? fact.actorRoles?.[factRole] : undefined;
    return { ...base, fromActorIds: actorId ? [actorId] : [] };
  }
  return base;
}

function actorIdsForRoles(roleIds: readonly string[], bindings: Readonly<Record<string, string>>): string[] {
  return uniqueOrdered(roleIds.map((roleId) => bindings[roleId]).filter((value): value is string => value !== undefined));
}

function shares(left: readonly string[], right: readonly string[]): boolean {
  const set = new Set(left);
  return right.some((value) => set.has(value));
}

function matchingTracks(
  recipe: NarrativeSituationRecipe,
  state: NarrativeRuntimeState,
  bindings: Readonly<Record<string, string>>,
  fact: NarrativeFact,
): NarrativeTrackState[] {
  if (recipe.track.kind === "open") return [];
  const actorIds = actorIdsForRoles(recipe.track.actorRoleIds, bindings);
  const requireActor = recipe.track.requireSharedActor ?? true;
  const requirePressure = recipe.track.requireSharedPressureTag ?? false;
  const pressureTags = uniqueOrdered([...recipe.pressureTags, ...fact.tags]);

  return state.tracks
    .filter((track) => track.status === "open")
    .filter((track) => recipe.track.kind !== "advance" || !recipe.track.railId || track.railId === recipe.track.railId)
    .filter((track) => !requireActor || shares(track.actorIds, actorIds))
    .filter((track) => !requirePressure || shares(track.pressureTags, pressureTags))
    .sort((left, right) => compareCodepoints(left.id, right.id));
}

function resolveReference(
  reference: NarrativeValueReference,
  fact: NarrativeFact,
  trackId: string,
  bindings: Readonly<Record<string, string>>,
): string | null {
  switch (reference.kind) {
    case "literal":
      return reference.value;
    case "fact-id":
      return fact.id;
    case "track-id":
      return trackId;
    case "role":
      return bindings[reference.roleId] ?? null;
  }
}

function fillQuestion(template: string, bindings: Readonly<Record<string, string>>, fact: NarrativeFact): string {
  return template
    .replace(/\{fact\}/g, fact.id)
    .replace(/\{actor:([^}]+)\}/g, (_, roleId: string) => bindings[roleId] ?? `{actor:${roleId}}`);
}

function relevantObligations(
  recipe: NarrativeSituationRecipe,
  state: NarrativeRuntimeState,
  track: NarrativeTrackState | null,
  bindings: Readonly<Record<string, string>>,
  fact: NarrativeFact,
): NarrativeObligation[] {
  if (recipe.resolvesObligations.policy === "none") return [];
  const allowedKinds = new Set(recipe.resolvesObligations.kinds);
  const actorIds = new Set(Object.values(bindings));
  const tags = new Set([...recipe.tags, ...recipe.pressureTags, ...fact.tags]);
  const trackObligations = new Set(track?.openObligationIds ?? []);

  const eligible = state.ledger.obligations
    .filter((obligation) => obligation.status === "open")
    .filter((obligation) => allowedKinds.size === 0 || allowedKinds.has(obligation.kind))
    .filter((obligation) => track === null || trackObligations.has(obligation.id))
    .filter(
      (obligation) =>
        obligation.actorIds.some((actorId) => actorIds.has(actorId)) || obligation.tags.some((tag) => tags.has(tag)),
    )
    .sort((left, right) => right.pressure - left.pressure || compareCodepoints(left.id, right.id));

  return recipe.resolvesObligations.policy === "highest-relevant" ? eligible.slice(0, 1) : eligible;
}

function conditionComplexity(recipe: NarrativeSituationRecipe): number {
  if (recipe.conditionComplexity !== undefined) return recipe.conditionComplexity;
  return (
    (recipe.factPattern.types?.length ?? 0) +
    (recipe.factPattern.requiredTags?.length ?? 0) +
    (recipe.factPattern.forbiddenTags?.length ?? 0) +
    (recipe.factPattern.minimumSeverity === undefined ? 0 : 1) +
    (recipe.factPattern.maximumSeverity === undefined ? 0 : 1) +
    recipe.roleQueries.reduce(
      (sum, query) =>
        sum +
        (query.requiredTags?.length ?? 0) +
        (query.forbiddenTags?.length ?? 0) +
        Object.keys(query.minimumMetrics ?? {}).length,
      0,
    )
  );
}

function candidateId(
  recipe: NarrativeSituationRecipe,
  fact: NarrativeFact,
  trackId: string,
  bindings: Readonly<Record<string, string>>,
  resolvedObligationIds: readonly string[],
): string {
  const bindingParts = Object.entries(bindings)
    .sort(([left], [right]) => compareCodepoints(left, right))
    .flatMap(([roleId, actorId]) => [roleId, actorId]);
  const digest = hashSeed(recipe.id, recipe.version, fact.id, trackId, ...bindingParts, ...resolvedObligationIds);
  return `candidate_${recipe.id}_${digest}`;
}

function openTrackId(
  recipe: NarrativeSituationRecipe,
  fact: NarrativeFact,
  bindings: Readonly<Record<string, string>>,
): string {
  if (recipe.track.kind !== "open") throw new Error(`Recipe ${recipe.id} does not open tracks`);
  const actorIds = actorIdsForRoles(recipe.track.actorRoleIds, bindings);
  const prefix = recipe.track.trackIdPrefix ?? recipe.id;
  return `track_${prefix}_${hashSeed(fact.id, ...actorIds)}`;
}

function buildCandidate(
  recipe: NarrativeSituationRecipe,
  state: NarrativeRuntimeState,
  fact: NarrativeFact,
  bindings: Readonly<Record<string, string>>,
  track: NarrativeTrackState | null,
): { candidate: NarrativeCandidate | null; failure: NarrativeGenerationFailure | null } {
  const trackId = track?.id ?? openTrackId(recipe, fact, bindings);
  const resolutions = relevantObligations(recipe, state, track, bindings, fact);
  if (recipe.resolvesObligations.required && resolutions.length === 0) {
    return {
      candidate: null,
      failure: {
        recipeId: recipe.id,
        factId: fact.id,
        trackId,
        reasons: ["required-obligation-not-found"],
      },
    };
  }

  const actorMoves: NarrativeActorMove[] = [];
  for (const template of recipe.actorMoves) {
    const actorId = bindings[template.roleId];
    if (!actorId) {
      return {
        candidate: null,
        failure: {
          recipeId: recipe.id,
          factId: fact.id,
          trackId,
          reasons: [`missing-role-for-move:${template.roleId}`],
        },
      };
    }
    actorMoves.push({ actorId, moveTag: template.moveTag });
  }

  const statePayments: NarrativeStatePayment[] = [];
  for (const template of recipe.statePayments) {
    const target = resolveReference(template.target, fact, trackId, bindings);
    if (!target) {
      return {
        candidate: null,
        failure: {
          recipeId: recipe.id,
          factId: fact.id,
          trackId,
          reasons: ["unresolved-state-payment-target"],
        },
      };
    }
    statePayments.push({ kind: template.kind, target, tags: uniqueOrdered(template.tags) });
  }

  const opensObligations: NarrativeObligationDraft[] = recipe.opensObligations.map((template, index) => {
    const actorIds = actorIdsForRoles(template.actorRoleIds, bindings);
    const id = `obligation_${template.idPrefix}_${hashSeed(recipe.id, fact.id, trackId, index, ...actorIds)}`;
    return {
      id,
      kind: template.kind,
      actorIds,
      tags: uniqueOrdered(template.tags),
      pressure: template.pressure,
      dueCycle: template.dueCycleOffset === undefined ? undefined : state.cycle + template.dueCycleOffset,
    };
  });

  const trackDirective = recipe.track.kind === "open"
    ? {
        kind: "open" as const,
        trackId,
        railId: recipe.track.railId,
        controllingQuestion: fillQuestion(recipe.track.controllingQuestion, bindings, fact),
        actorIds: actorIdsForRoles(recipe.track.actorRoleIds, bindings),
        pressureTags: uniqueOrdered([...recipe.track.pressureTags, ...recipe.pressureTags]),
      }
    : { kind: "advance" as const, trackId };

  const resolvedObligationIds = resolutions.map((obligation) => obligation.id);
  return {
    candidate: {
      id: candidateId(recipe, fact, trackId, bindings, resolvedObligationIds),
      recipeId: recipe.id,
      authority: recipe.authority,
      track: trackDirective,
      trackDisposition: recipe.trackDisposition,
      beatFunction: recipe.beatFunction,
      sourceFactIds: [fact.id],
      causalParentBeatIds: [],
      roleBindings: { ...bindings },
      actorMoves,
      tags: uniqueOrdered(recipe.tags),
      pressureTags: uniqueOrdered([...recipe.pressureTags, ...fact.tags]),
      statePayments,
      opensObligations,
      resolvesObligationIds: resolvedObligationIds,
      authoredPriority: recipe.authoredPriority,
      conditionComplexity: conditionComplexity(recipe),
      cooldownCycles: recipe.cooldownCycles,
      presentationKey: recipe.presentationKey,
    },
    failure: null,
  };
}

export function generateNarrativeCandidates(
  recipes: readonly NarrativeSituationRecipe[],
  state: NarrativeRuntimeState,
): NarrativeGenerationReceipt {
  const recipeIssues = validateNarrativeRecipes(recipes);
  if (recipeIssues.length > 0) {
    const summary = recipeIssues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    throw new Error(`Invalid narrative recipes: ${summary}`);
  }
  const candidates: NarrativeCandidate[] = [];
  const failures: NarrativeGenerationFailure[] = [];
  const actors: readonly NarrativeActorSnapshot[] = [...state.actors].sort((left, right) => compareCodepoints(left.id, right.id));
  const facts = [...state.facts].sort((left, right) => compareCodepoints(left.id, right.id));

  for (const recipe of [...recipes].sort((left, right) => compareCodepoints(left.id, right.id))) {
    for (const fact of facts) {
      if (!factMatches(recipe.factPattern, fact)) continue;

      const binding = bindNarrativeRoles(
        recipe.roleQueries.map((query) => roleQueryForFact(query, fact)),
        actors,
      );
      if (binding.failures.length > 0) {
        failures.push({
          recipeId: recipe.id,
          factId: fact.id,
          reasons: ["role-binding-failed"],
          binding,
        });
        continue;
      }

      const tracks = recipe.track.kind === "open" ? [null] : matchingTracks(recipe, state, binding.bindings, fact);
      if (recipe.track.kind === "advance" && tracks.length === 0) {
        failures.push({
          recipeId: recipe.id,
          factId: fact.id,
          reasons: ["no-matching-open-track"],
          binding,
        });
        continue;
      }

      for (const track of tracks) {
        const built = buildCandidate(recipe, state, fact, binding.bindings, track);
        if (built.candidate) candidates.push(built.candidate);
        if (built.failure) failures.push({ ...built.failure, binding });
      }
    }
  }

  candidates.sort((left, right) => compareCodepoints(left.id, right.id));
  failures.sort(
    (left, right) =>
      compareCodepoints(left.recipeId, right.recipeId) ||
      compareCodepoints(left.factId, right.factId) ||
      compareCodepoints(left.trackId ?? "", right.trackId ?? ""),
  );

  return {
    format: NARRATIVE_GENERATION_FORMAT,
    cycle: state.cycle,
    candidates,
    failures,
  };
}
