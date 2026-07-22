import type { Arc } from "../../engine/types.js";

export type AttributeCoverageStatus = "covered" | "specialist" | "cosmetic" | "dead";

export interface AttributeCoverage {
  attributeId: string;
  attributeName: string;
  roleIds: string[];
  checkIds: string[];
  status: AttributeCoverageStatus;
}

function leadingKeys(weights: Record<string, number> | Array<{ attributeId: string; weight: number }>): string[] {
  const entries = Array.isArray(weights)
    ? weights.map((entry) => [entry.attributeId, entry.weight] as const)
    : Object.entries(weights);
  const max = Math.max(...entries.map(([, weight]) => weight), Number.NEGATIVE_INFINITY);
  return entries.filter(([, weight]) => weight === max && weight > 0).map(([id]) => id);
}

/** Reports what the Arc already authors. Specialist attributes are supported;
 * dead/cosmetic attributes are structural warnings, never silent resolver edits. */
export function attributeCoverage(arc: Arc): AttributeCoverage[] {
  const roleLeads = new Map<string, Set<string>>();
  for (const role of arc.roles) {
    for (const attributeId of leadingKeys(role.attributeWeights)) {
      const ids = roleLeads.get(attributeId) ?? new Set<string>();
      ids.add(role.id);
      roleLeads.set(attributeId, ids);
    }
  }

  const checkLeads = new Map<string, Set<string>>();
  for (const challenge of arc.challenges) {
    for (const check of challenge.mechanicChecks) {
      for (const attributeId of leadingKeys(check.attributeWeights)) {
        const ids = checkLeads.get(attributeId) ?? new Set<string>();
        ids.add(`${challenge.id}/${check.id}`);
        checkLeads.set(attributeId, ids);
      }
    }
  }

  return arc.attributes.map((attribute) => {
    const roleIds = [...(roleLeads.get(attribute.id) ?? [])];
    const checkIds = [...(checkLeads.get(attribute.id) ?? [])];
    const status: AttributeCoverageStatus = roleIds.length > 0
      ? (checkIds.length > 0 ? "covered" : "cosmetic")
      : (checkIds.length > 0 ? "specialist" : "dead");
    return { attributeId: attribute.id, attributeName: attribute.name, roleIds, checkIds, status };
  });
}

export interface AuthoringAudit {
  attributes: AttributeCoverage[];
  warnings: AttributeCoverage[];
  passes: boolean;
}

export function auditArcAuthoring(arc: Arc): AuthoringAudit {
  const attributes = attributeCoverage(arc);
  const warnings = attributes.filter((entry) => entry.status !== "covered");
  return {
    attributes,
    warnings,
    passes: !attributes.some((entry) => entry.status === "dead" || entry.status === "cosmetic"),
  };
}
