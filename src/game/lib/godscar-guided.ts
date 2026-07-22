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

type JsonRecord = Record<string, unknown>;

function structuralError(path: string, expected: string): never {
  throw new Error(`${path} must be ${expected}.`);
}

function record(value: unknown, path: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) structuralError(path, "a JSON object");
  return value as JsonRecord;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) structuralError(path, "an array");
  return value;
}

function stringField(source: JsonRecord, key: string, path: string, optional = false): void {
  const value = source[key];
  if (optional && value === undefined) return;
  if (typeof value !== "string") structuralError(`${path}.${key}`, "a string");
}

function numberField(source: JsonRecord, key: string, path: string, optional = false): void {
  const value = source[key];
  if (optional && value === undefined) return;
  if (typeof value !== "number" || !Number.isFinite(value)) structuralError(`${path}.${key}`, "a finite number");
}

function booleanField(source: JsonRecord, key: string, path: string): void {
  if (typeof source[key] !== "boolean") structuralError(`${path}.${key}`, "a boolean");
}

function stringArray(value: unknown, path: string): void {
  for (const [index, entry] of array(value, path).entries()) {
    if (typeof entry !== "string") structuralError(`${path}[${index}]`, "a string");
  }
}

function strings(source: JsonRecord, keys: readonly string[], path: string): void {
  for (const key of keys) stringField(source, key, path);
}

function validateEditableGodscarStructure(value: unknown): void {
  const source = record(value, "source");
  stringField(source, "format", "source");
  stringField(source, "controlQuestion", "source");

  const identity = record(source.identity, "identity");
  strings(identity, ["id", "title", "description", "author", "version", "canonRelation"], "identity");
  numberField(identity, "estimatedCycles", "identity");
  stringArray(identity.parentCanons, "identity.parentCanons");

  for (const [index, entry] of array(source.pressures, "pressures").entries()) {
    const pressure = record(entry, `pressures[${index}]`);
    strings(pressure, ["kind", "id", "label", "description"], `pressures[${index}]`);
  }

  const evidence = record(source.evidence, "evidence");
  strings(evidence, [
    "tier", "claim", "venue", "legitimacyTarget", "upsideIfAccepted",
    "downsideIfAccepted", "failureIfFalse",
  ], "evidence");
  for (const [index, entry] of array(evidence.receipts, "evidence.receipts").entries()) {
    const receipt = record(entry, `evidence.receipts[${index}]`);
    strings(receipt, ["id", "label", "source", "intervention", "limits"], `evidence.receipts[${index}]`);
  }

  for (const [index, entry] of array(source.factionReceipts, "factionReceipts").entries()) {
    const faction = record(entry, `factionReceipts[${index}]`);
    strings(faction, [
      "factionId", "factionName", "variableControlled", "publicGood", "characteristicFailure",
    ], `factionReceipts[${index}]`);
  }

  for (const [index, entry] of array(source.cast, "cast").entries()) {
    const member = record(entry, `cast[${index}]`);
    strings(member, ["id", "name", "roleId", "responsibility", "description"], `cast[${index}]`);
    stringField(member, "factionId", `cast[${index}]`, true);
  }

  for (const [index, entry] of array(source.consequences, "consequences").entries()) {
    const consequence = record(entry, `consequences[${index}]`);
    strings(consequence, ["id", "label", "kind", "description", "inheritedBy"], `consequences[${index}]`);
  }

  const physics = record(source.storyPhysics, "storyPhysics");
  for (const key of [
    "noCleanReset", "crowningIsConcentration", "answerReflectsExclusion",
    "counterformInheritsClaim", "scaleIsDistributed", "distanceRemainsPolitical",
    "factionReceiptsRequired", "everyVictoryChangesMap",
  ]) booleanField(physics, key, "storyPhysics");

  for (const [beatIndex, entry] of array(source.beats, "beats").entries()) {
    const beatPath = `beats[${beatIndex}]`;
    const beat = record(entry, beatPath);
    strings(beat, [
      "id", "name", "description", "tierId", "success", "partial", "failure", "consequenceId",
    ], beatPath);
    stringField(beat, "accessAfter", beatPath, true);
    for (const key of ["difficulty", "minAgents", "maxAgents", "reputationGain", "currencyReward"]) {
      numberField(beat, key, beatPath);
    }

    if (beat.requiredRoles !== undefined) {
      for (const [roleIndex, roleEntry] of array(beat.requiredRoles, `${beatPath}.requiredRoles`).entries()) {
        const rolePath = `${beatPath}.requiredRoles[${roleIndex}]`;
        const requiredRole = record(roleEntry, rolePath);
        stringField(requiredRole, "roleId", rolePath);
        numberField(requiredRole, "count", rolePath);
      }
    }

    for (const [checkIndex, checkEntry] of array(beat.checks, `${beatPath}.checks`).entries()) {
      const checkPath = `${beatPath}.checks[${checkIndex}]`;
      const check = record(checkEntry, checkPath);
      strings(check, ["id", "name", "description", "scope"], checkPath);
      stringField(check, "failureType", checkPath, true);
      numberField(check, "threshold", checkPath);
      numberField(check, "severity", checkPath, true);
      if (check.roleIds !== undefined) stringArray(check.roleIds, `${checkPath}.roleIds`);
      const weights = record(check.weights, `${checkPath}.weights`);
      for (const [attribute, weight] of Object.entries(weights)) {
        if (typeof weight !== "number" || !Number.isFinite(weight)) {
          structuralError(`${checkPath}.weights.${attribute}`, "a finite number");
        }
      }
    }
  }
}

/** Guided editing permits semantically unfinished values, such as empty ids,
 * unknown enum labels, incomplete pressure counts, and out-of-range numbers.
 * It still refuses every malformed nested container or scalar type that the
 * renderer dereferences, so Source mode remains the safe repair surface. */
export function parseEditableGodscarSource(text: string): EditableGodscarResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { ok: false, message: `JSON parse error: ${(error as Error).message}` };
  }

  try {
    validateEditableGodscarStructure(value);
    return { ok: true, source: value as GodscarPocketSource };
  } catch (error) {
    return {
      ok: false,
      message: `Guided mode structural error: ${(error as Error).message} Use Source mode to repair the exact draft.`,
    };
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
