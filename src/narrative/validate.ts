import { compareCodepoints } from "../engine/determinism.js";
import type { NarrativeConstitution, NarrativeRailDefinition } from "./types.js";

export interface NarrativeConstitutionIssue {
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

function validateRail(rail: NarrativeRailDefinition, index: number): NarrativeConstitutionIssue[] {
  const issues: NarrativeConstitutionIssue[] = [];
  const path = `rails[${index}]`;
  if (rail.openingFunctions.length === 0) {
    issues.push({ path: `${path}.openingFunctions`, message: "rail must declare at least one opening function" });
  }
  if (rail.terminalFunctions.length === 0) {
    issues.push({ path: `${path}.terminalFunctions`, message: "rail must declare at least one terminal function" });
  }
  for (const duplicate of duplicateValues(rail.openingFunctions)) {
    issues.push({ path: `${path}.openingFunctions`, message: `duplicate opening function ${duplicate}` });
  }
  for (const duplicate of duplicateValues(rail.terminalFunctions)) {
    issues.push({ path: `${path}.terminalFunctions`, message: `duplicate terminal function ${duplicate}` });
  }
  for (const [from, targets] of Object.entries(rail.transitions)) {
    for (const duplicate of duplicateValues(targets ?? [])) {
      issues.push({ path: `${path}.transitions.${from}`, message: `duplicate transition to ${duplicate}` });
    }
  }
  return issues;
}

export function validateNarrativeConstitution(
  constitution: NarrativeConstitution,
): NarrativeConstitutionIssue[] {
  const issues: NarrativeConstitutionIssue[] = [];

  for (const duplicate of duplicateValues(constitution.rails.map((rail) => rail.id))) {
    issues.push({ path: "rails", message: `duplicate rail id ${duplicate}` });
  }
  constitution.rails.forEach((rail, index) => issues.push(...validateRail(rail, index)));

  for (const duplicate of duplicateValues(constitution.identityAnchors.map((anchor) => anchor.id))) {
    issues.push({ path: "identityAnchors", message: `duplicate identity anchor id ${duplicate}` });
  }
  constitution.identityAnchors.forEach((anchor, index) => {
    if (anchor.anyOfTags.length === 0) {
      issues.push({
        path: `identityAnchors[${index}].anyOfTags`,
        message: "identity anchor must declare at least one accepted tag",
      });
    }
  });

  for (const duplicate of duplicateValues(constitution.actorPolicies.map((policy) => policy.actorId))) {
    issues.push({ path: "actorPolicies", message: `duplicate actor policy for ${duplicate}` });
  }
  constitution.actorPolicies.forEach((policy, index) => {
    const baseline = new Set(policy.baselineMoves);
    const forbidden = new Set(policy.forbiddenMoves);
    for (const move of baseline) {
      if (forbidden.has(move)) {
        issues.push({
          path: `actorPolicies[${index}]`,
          message: `${move} cannot be both baseline and forbidden`,
        });
      }
    }
    policy.conditionalMoves.forEach((conditional, conditionalIndex) => {
      if (conditional.requiresAnyTags.length === 0) {
        issues.push({
          path: `actorPolicies[${index}].conditionalMoves[${conditionalIndex}].requiresAnyTags`,
          message: "conditional move must name at least one enabling tag",
        });
      }
    });
  });

  if (!Number.isInteger(constitution.freshnessCap) || constitution.freshnessCap < 0) {
    issues.push({ path: "freshnessCap", message: "freshnessCap must be a non-negative integer" });
  }
  for (const [name, value] of Object.entries(constitution.weights)) {
    if (!Number.isInteger(value) || value < 0) {
      issues.push({ path: `weights.${name}`, message: "score weight must be a non-negative integer" });
    }
  }

  return issues.sort((left, right) => compareCodepoints(left.path, right.path) || compareCodepoints(left.message, right.message));
}
