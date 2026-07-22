import type {
  GodscarBeatBlueprint,
  GodscarCastMember,
  GodscarConsequence,
  GodscarFactionReceipt,
  GodscarCheckBlueprint,
  GodscarPocketSource,
  GodscarProvenanceReceipt,
} from "../../godscar/types.js";

export type EditableGodscarResult =
  | { ok: true; source: GodscarPocketSource }
  | { ok: false; message: string };

export type EditableGodscarUpdateResult =
  | { ok: true; source: GodscarPocketSource; text: string }
  | { ok: false; message: string };

/** The guided editor intentionally accepts temporarily-invalid field values,
 * but requires the source's major collections to remain present. Validation and
 * compilation still happen through the canonical Godscar schema/compiler. */
export function parseEditableGodscarSource(text: string): EditableGodscarResult {
  try {
    const value = JSON.parse(text) as Partial<GodscarPocketSource>;
    if (!value || typeof value !== "object") return { ok: false, message: "The source must be a JSON object." };
    if (!value.identity || !Array.isArray(value.pressures) || !value.evidence
      || !Array.isArray(value.factionReceipts) || !Array.isArray(value.cast)
      || !Array.isArray(value.consequences) || !value.storyPhysics || !Array.isArray(value.beats)) {
      return { ok: false, message: "The source is missing a required Godscar section. Use Source mode to repair it or load a complete pocket." };
    }
    return { ok: true, source: value as GodscarPocketSource };
  } catch (error) {
    return { ok: false, message: `JSON parse error: ${(error as Error).message}` };
  }
}

export function serializeEditableGodscarSource(source: GodscarPocketSource): string {
  return JSON.stringify(source, null, 2);
}

export function updateEditableGodscarSource(
  text: string,
  mutate: (source: GodscarPocketSource) => void,
): EditableGodscarUpdateResult {
  const parsed = parseEditableGodscarSource(text);
  if (!parsed.ok) return parsed;
  const source = structuredClone(parsed.source);
  mutate(source);
  return { ok: true, source, text: serializeEditableGodscarSource(source) };
}

export function uniqueGodscarId(base: string, held: Iterable<string>): string {
  const normalized = base.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "new-entry";
  const taken = new Set(held);
  if (!taken.has(normalized)) return normalized;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${normalized}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${normalized}-overflow`;
}

export function newEvidenceReceipt(source: GodscarPocketSource): GodscarProvenanceReceipt {
  return {
    id: uniqueGodscarId("new-receipt", source.evidence.receipts.map((entry) => entry.id)),
    label: "New provenance receipt",
    source: "Name the source or witness.",
    intervention: "State what changed or enabled the observation.",
    limits: "State what this receipt cannot establish.",
  };
}

export function newFactionReceipt(source: GodscarPocketSource): GodscarFactionReceipt {
  return {
    factionId: uniqueGodscarId("new-faction", source.factionReceipts.map((entry) => entry.factionId)),
    factionName: "New faction",
    variableControlled: "Name the variable this faction controls.",
    publicGood: "Name the suffering this method prevents.",
    characteristicFailure: "Name the characteristic harm this method creates.",
  };
}

export function newCastMember(source: GodscarPocketSource): GodscarCastMember {
  return {
    id: uniqueGodscarId("new-person", source.cast.map((entry) => entry.id)),
    name: "New person",
    roleId: "auditor",
    responsibility: "holds-evidence",
    description: "Describe the incompatible obligation this person carries.",
  };
}

export function newConsequence(source: GodscarPocketSource): GodscarConsequence {
  return {
    id: uniqueGodscarId("new-consequence", source.consequences.map((entry) => entry.id)),
    label: "New persistent consequence",
    kind: "doctrine",
    description: "Describe the durable change left on the map.",
    inheritedBy: "Name who inherits the cost and capacity.",
  };
}

export function newBeat(source: GodscarPocketSource): GodscarBeatBlueprint {
  const previous = source.beats[source.beats.length - 1];
  return {
    id: uniqueGodscarId("new-beat", source.beats.map((entry) => entry.id)),
    name: "New beat",
    description: "Describe the immediate decision and concrete stakes.",
    tierId: "refusal",
    ...(previous ? { accessAfter: previous.id } : {}),
    difficulty: previous ? Math.min(100, previous.difficulty + 5) : 10,
    minAgents: 3,
    maxAgents: 5,
    checks: [{
      id: "new-check",
      name: "New check",
      description: "Describe what the assigned people must actually do.",
      scope: "team",
      weights: { care: 0.5, systems: 0.5 },
      threshold: 5,
    }],
    success: "Name what succeeds and what remains costly.",
    partial: "Name the incomplete continuation.",
    failure: "Name the valid failure continuation.",
    reputationGain: 1,
    currencyReward: 20,
    consequenceId: source.consequences[0]?.id ?? "new-consequence",
  };
}


export function newGodscarCheck(beat: GodscarBeatBlueprint): GodscarCheckBlueprint {
  return {
    id: uniqueGodscarId("new-check", beat.checks.map((entry) => entry.id)),
    name: "New check",
    description: "Describe what the assigned people must actually do.",
    scope: "team",
    weights: { care: 0.5, systems: 0.5 },
    threshold: 5,
    failureType: "stress",
    severity: 0.2,
  };
}
