import { compareCodepoints } from "../engine/determinism.js";
import type { NarrativeSituationRecipe } from "./recipes.js";

export interface NarrativeRecipeIssue {
  path: string;
  message: string;
}

function duplicateValues(values: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort(compareCodepoints);
}

function validNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

export function validateNarrativeRecipe(recipe: NarrativeSituationRecipe): NarrativeRecipeIssue[] {
  const issues: NarrativeRecipeIssue[] = [];
  if (recipe.id.trim().length === 0) issues.push({ path: "id", message: "recipe id must not be empty" });
  if (recipe.version.trim().length === 0) issues.push({ path: "version", message: "recipe version must not be empty" });
  if (recipe.presentationKey.trim().length === 0) {
    issues.push({ path: "presentationKey", message: "presentation key must not be empty" });
  }

  for (const duplicate of duplicateValues(recipe.roleQueries.map((query) => query.id))) {
    issues.push({ path: "roleQueries", message: `duplicate role query ${duplicate}` });
  }
  const roleIds = new Set(recipe.roleQueries.map((query) => query.id));
  recipe.roleQueries.forEach((query, index) => {
    if (query.pool === "fact-role" && !query.factRole) {
      issues.push({ path: `roleQueries[${index}].factRole`, message: "fact-role pool requires factRole" });
    }
    for (const term of query.scoreTerms ?? []) {
      if (!Number.isInteger(term.weight)) {
        issues.push({ path: `roleQueries[${index}].scoreTerms`, message: "role score weights must be integers" });
      }
    }
    for (const bonus of query.tagBonuses ?? []) {
      if (!Number.isInteger(bonus.value)) {
        issues.push({ path: `roleQueries[${index}].tagBonuses`, message: "role tag bonuses must be integers" });
      }
    }
    for (const [metric, minimum] of Object.entries(query.minimumMetrics ?? {})) {
      if (!Number.isFinite(minimum)) {
        issues.push({ path: `roleQueries[${index}].minimumMetrics.${metric}`, message: "minimum metric must be finite" });
      }
    }
  });

  recipe.actorMoves.forEach((move, index) => {
    if (!roleIds.has(move.roleId)) {
      issues.push({ path: `actorMoves[${index}].roleId`, message: `unknown role ${move.roleId}` });
    }
  });
  recipe.track.actorRoleIds.forEach((roleId, index) => {
    if (!roleIds.has(roleId)) {
      issues.push({ path: `track.actorRoleIds[${index}]`, message: `unknown role ${roleId}` });
    }
  });
  recipe.statePayments.forEach((payment, index) => {
    if (payment.target.kind === "role" && !roleIds.has(payment.target.roleId)) {
      issues.push({ path: `statePayments[${index}].target.roleId`, message: `unknown role ${payment.target.roleId}` });
    }
    if (payment.tags.length === 0) {
      issues.push({ path: `statePayments[${index}].tags`, message: "state payment must expose at least one semantic tag" });
    }
  });
  recipe.opensObligations.forEach((obligation, index) => {
    for (const roleId of obligation.actorRoleIds) {
      if (!roleIds.has(roleId)) {
        issues.push({ path: `opensObligations[${index}].actorRoleIds`, message: `unknown role ${roleId}` });
      }
    }
    if (!validNonNegativeInteger(obligation.pressure)) {
      issues.push({ path: `opensObligations[${index}].pressure`, message: "obligation pressure must be a non-negative integer" });
    }
    if (obligation.dueCycleOffset !== undefined && !validNonNegativeInteger(obligation.dueCycleOffset)) {
      issues.push({ path: `opensObligations[${index}].dueCycleOffset`, message: "due-cycle offset must be a non-negative integer" });
    }
  });

  if (recipe.resolvesObligations.policy === "none" && recipe.resolvesObligations.required) {
    issues.push({ path: "resolvesObligations", message: "a none resolution policy cannot require an obligation" });
  }
  if (recipe.resolvesObligations.policy !== "none" && recipe.resolvesObligations.kinds.length === 0) {
    issues.push({ path: "resolvesObligations.kinds", message: "resolving recipes must name at least one obligation kind" });
  }

  if (!validNonNegativeInteger(recipe.authoredPriority)) {
    issues.push({ path: "authoredPriority", message: "authored priority must be a non-negative integer" });
  }
  if (recipe.conditionComplexity !== undefined && !validNonNegativeInteger(recipe.conditionComplexity)) {
    issues.push({ path: "conditionComplexity", message: "condition complexity must be a non-negative integer" });
  }
  if (!validNonNegativeInteger(recipe.cooldownCycles)) {
    issues.push({ path: "cooldownCycles", message: "cooldown must be a non-negative integer" });
  }
  if (recipe.factPattern.minimumSeverity !== undefined && !Number.isFinite(recipe.factPattern.minimumSeverity)) {
    issues.push({ path: "factPattern.minimumSeverity", message: "minimum severity must be finite" });
  }
  if (recipe.factPattern.maximumSeverity !== undefined && !Number.isFinite(recipe.factPattern.maximumSeverity)) {
    issues.push({ path: "factPattern.maximumSeverity", message: "maximum severity must be finite" });
  }
  if (
    recipe.factPattern.minimumSeverity !== undefined &&
    recipe.factPattern.maximumSeverity !== undefined &&
    recipe.factPattern.minimumSeverity > recipe.factPattern.maximumSeverity
  ) {
    issues.push({ path: "factPattern", message: "minimum severity cannot exceed maximum severity" });
  }

  return issues.sort(
    (left, right) => compareCodepoints(left.path, right.path) || compareCodepoints(left.message, right.message),
  );
}

export function validateNarrativeRecipes(
  recipes: readonly NarrativeSituationRecipe[],
): NarrativeRecipeIssue[] {
  const issues: NarrativeRecipeIssue[] = [];
  for (const duplicate of duplicateValues(recipes.map((recipe) => recipe.id))) {
    issues.push({ path: "recipes", message: `duplicate recipe id ${duplicate}` });
  }
  recipes.forEach((recipe, index) => {
    for (const issue of validateNarrativeRecipe(recipe)) {
      issues.push({ path: `recipes[${index}].${issue.path}`, message: issue.message });
    }
  });
  return issues.sort(
    (left, right) => compareCodepoints(left.path, right.path) || compareCodepoints(left.message, right.message),
  );
}
