import { z } from "zod";
import "./abi13.js";
import type {
  CartridgeStateDefinition,
  CartridgeStateEffect,
  CartridgeStateValue,
  CompositionConstraint,
  CompositionProfile,
} from "./abi13.js";
import { compareCodepoints } from "./determinism.js";
import { validateArc as validateBaseArc } from "./schema-base.js";
import type { Arc } from "./types.js";
import { assertEngineCompatible, compareEngineVersions } from "./version.js";

const Id = z.string().min(1);
const StateVisibilitySchema = z.enum(["public", "operator", "private"]);
const NumberStateDefinitionSchema = z.object({
  id: Id,
  label: Id,
  description: z.string(),
  visibility: StateVisibilitySchema,
  kind: z.literal("number"),
  initial: z.number().finite(),
  min: z.number().finite(),
  max: z.number().finite(),
}).strict();
const EnumStateDefinitionSchema = z.object({
  id: Id,
  label: Id,
  description: z.string(),
  visibility: StateVisibilitySchema,
  kind: z.literal("enum"),
  initial: Id,
  values: z.array(Id).min(1),
}).strict();
const BooleanStateDefinitionSchema = z.object({
  id: Id,
  label: Id,
  description: z.string(),
  visibility: StateVisibilitySchema,
  kind: z.literal("boolean"),
  initial: z.boolean(),
}).strict();
const StateDefinitionSchema: z.ZodType<CartridgeStateDefinition> = z.discriminatedUnion("kind", [
  NumberStateDefinitionSchema,
  EnumStateDefinitionSchema,
  BooleanStateDefinitionSchema,
]);

const StateValueSchema: z.ZodType<CartridgeStateValue> = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
const StateEffectSchema: z.ZodType<CartridgeStateEffect> = z.discriminatedUnion("operation", [
  z.object({ stateId: Id, reason: Id, operation: z.literal("set"), value: StateValueSchema }).strict(),
  z.object({
    stateId: Id,
    reason: Id,
    operation: z.enum(["increment", "decrement"]),
    value: z.number().finite().nonnegative(),
    overflow: z.enum(["reject", "clamp"]).optional(),
  }).strict(),
  z.object({
    stateId: Id,
    reason: Id,
    operation: z.literal("transition"),
    from: Id.optional(),
    to: Id,
  }).strict(),
]);

const RangeSchema = z.object({ min: z.number().finite(), max: z.number().finite() }).strict();
const CompositionProfileSchema: z.ZodType<CompositionProfile> = z.object({
  id: Id,
  name: Id,
  description: z.string(),
  tags: z.array(Id),
  metrics: z.record(z.number().finite()),
  ranges: z.record(RangeSchema),
  dependencies: z.array(Id),
}).strict();

const ConstraintSchema: z.ZodType<CompositionConstraint> = z.lazy(() => z.discriminatedUnion("kind", [
  z.object({ id: Id, label: Id, category: Id.optional(), kind: z.literal("role-count"), roleId: Id, min: z.number().int().nonnegative(), max: z.number().int().nonnegative().optional() }).strict(),
  z.object({ id: Id, label: Id, category: Id.optional(), kind: z.literal("profile-count"), profileIds: z.array(Id).min(1), min: z.number().int().nonnegative(), max: z.number().int().nonnegative().optional() }).strict(),
  z.object({ id: Id, label: Id, category: Id.optional(), kind: z.literal("tag-count"), tag: Id, min: z.number().int().nonnegative(), max: z.number().int().nonnegative().optional() }).strict(),
  z.object({ id: Id, label: Id, category: Id.optional(), kind: z.literal("metric-sum"), metric: Id, comparison: z.enum(["gte", "lte", "eq"]), threshold: z.number().finite() }).strict(),
  z.object({ id: Id, label: Id, category: Id.optional(), kind: z.literal("range-overlap"), range: Id, required: RangeSchema, minProfiles: z.number().int().positive() }).strict(),
  z.object({ id: Id, label: Id, category: Id.optional(), kind: z.literal("fraction"), tag: Id, minFraction: z.number().min(0).max(1) }).strict(),
  z.object({ id: Id, label: Id, category: Id.optional(), kind: z.literal("redundancy"), tag: Id, minDistinctProfiles: z.number().int().positive() }).strict(),
  z.object({ id: Id, label: Id, category: Id.optional(), kind: z.enum(["all", "any"]), constraints: z.array(ConstraintSchema).min(1) }).strict(),
]));

interface ParsedExtras {
  stateDefinitions?: CartridgeStateDefinition[];
  compositionProfiles?: CompositionProfile[];
  foundingProfileIds: Array<string | undefined>;
  challengeConstraints: Array<CompositionConstraint[] | undefined>;
  outcomeEffects: Array<{
    success?: CartridgeStateEffect[];
    partial?: CartridgeStateEffect[];
    failure?: CartridgeStateEffect[];
  }>;
}

function cloneRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : null;
}

function stripAbi13(input: unknown): unknown {
  const root = cloneRecord(input);
  if (!root) return input;
  delete root["stateDefinitions"];
  delete root["compositionProfiles"];

  const founding = cloneRecord(root["founding"]);
  if (founding && Array.isArray(founding["roster"])) {
    founding["roster"] = founding["roster"].map((value) => {
      const slot = cloneRecord(value);
      if (!slot) return value;
      delete slot["compositionProfileId"];
      return slot;
    });
    root["founding"] = founding;
  }

  if (Array.isArray(root["challenges"])) {
    root["challenges"] = root["challenges"].map((value) => {
      const challenge = cloneRecord(value);
      if (!challenge) return value;
      delete challenge["compositionConstraints"];
      const outcomes = cloneRecord(challenge["outcomes"]);
      if (outcomes) {
        for (const key of ["success", "partial", "failure"] as const) {
          const outcome = cloneRecord(outcomes[key]);
          if (outcome) {
            delete outcome["stateEffects"];
            outcomes[key] = outcome;
          }
        }
        challenge["outcomes"] = outcomes;
      }
      return challenge;
    });
  }
  return root;
}

function issuesFor<T>(schema: z.ZodType<T>, value: unknown, path: string, errors: string[]): T | undefined {
  if (value === undefined) return undefined;
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    const suffix = issue.path.length ? `.${issue.path.join(".")}` : "";
    errors.push(`[${path}${suffix}] ${issue.message}`);
  }
  return undefined;
}

function extrasFor(input: unknown, errors: string[]): ParsedExtras {
  const root = cloneRecord(input) ?? {};
  const stateDefinitions = issuesFor(z.array(StateDefinitionSchema), root["stateDefinitions"], "stateDefinitions", errors);
  const compositionProfiles = issuesFor(z.array(CompositionProfileSchema), root["compositionProfiles"], "compositionProfiles", errors);

  const foundingProfileIds: Array<string | undefined> = [];
  const founding = cloneRecord(root["founding"]);
  const roster = founding && Array.isArray(founding["roster"]) ? founding["roster"] : [];
  roster.forEach((value, index) => {
    const slot = cloneRecord(value);
    const parsed = issuesFor(Id, slot?.["compositionProfileId"], `founding.roster.${index}.compositionProfileId`, errors);
    foundingProfileIds.push(parsed);
  });

  const challengeConstraints: Array<CompositionConstraint[] | undefined> = [];
  const outcomeEffects: ParsedExtras["outcomeEffects"] = [];
  const challenges = Array.isArray(root["challenges"]) ? root["challenges"] : [];
  challenges.forEach((value, index) => {
    const challenge = cloneRecord(value);
    challengeConstraints.push(issuesFor(
      z.array(ConstraintSchema),
      challenge?.["compositionConstraints"],
      `challenges.${index}.compositionConstraints`,
      errors,
    ));
    const outcomes = cloneRecord(challenge?.["outcomes"]);
    const parsed: ParsedExtras["outcomeEffects"][number] = {};
    for (const key of ["success", "partial", "failure"] as const) {
      const outcome = cloneRecord(outcomes?.[key]);
      parsed[key] = issuesFor(
        z.array(StateEffectSchema),
        outcome?.["stateEffects"],
        `challenges.${index}.outcomes.${key}.stateEffects`,
        errors,
      );
    }
    outcomeEffects.push(parsed);
  });
  return { stateDefinitions, compositionProfiles, foundingProfileIds, challengeConstraints, outcomeEffects };
}

function stateValueValid(definition: CartridgeStateDefinition, value: CartridgeStateValue): boolean {
  if (definition.kind === "number") return typeof value === "number" && value >= definition.min && value <= definition.max;
  if (definition.kind === "enum") return typeof value === "string" && definition.values.includes(value);
  return typeof value === "boolean";
}

function visitConstraints(
  constraints: CompositionConstraint[],
  callback: (constraint: CompositionConstraint) => void,
): void {
  for (const constraint of constraints) {
    callback(constraint);
    if (constraint.kind === "all" || constraint.kind === "any") visitConstraints(constraint.constraints, callback);
  }
}

function crossValidate(arc: Arc, extras: ParsedExtras, errors: string[]): void {
  const hasAbi13 = Boolean(
    extras.stateDefinitions?.length
      || extras.compositionProfiles?.length
      || extras.foundingProfileIds.some(Boolean)
      || extras.challengeConstraints.some((value) => value?.length)
      || extras.outcomeEffects.some((value) => value.success?.length || value.partial?.length || value.failure?.length),
  );
  if (hasAbi13 && compareEngineVersions(arc.meta.engineVersion, "1.3.0") < 0) {
    errors.push(`[meta.engineVersion] Cartridge state and composition law require engineVersion 1.3.0 or newer.`);
  }

  const stateIds = new Set<string>();
  const definitions = new Map<string, CartridgeStateDefinition>();
  for (const [index, definition] of (extras.stateDefinitions ?? []).entries()) {
    if (stateIds.has(definition.id)) errors.push(`[stateDefinitions.${index}.id] Duplicate state id "${definition.id}".`);
    stateIds.add(definition.id);
    definitions.set(definition.id, definition);
    if (definition.kind === "number") {
      if (definition.min > definition.max) errors.push(`[stateDefinitions.${index}] Number-state minimum exceeds maximum.`);
      if (!stateValueValid(definition, definition.initial)) errors.push(`[stateDefinitions.${index}.initial] Initial value is outside the declared numeric range.`);
    } else if (definition.kind === "enum") {
      const values = new Set(definition.values);
      if (values.size !== definition.values.length) errors.push(`[stateDefinitions.${index}.values] Enum values must be unique.`);
      if (!values.has(definition.initial)) errors.push(`[stateDefinitions.${index}.initial] Enum initial value is not declared.`);
    }
  }

  for (const [challengeIndex, perOutcome] of extras.outcomeEffects.entries()) {
    for (const outcome of ["success", "partial", "failure"] as const) {
      for (const [effectIndex, effect] of (perOutcome[outcome] ?? []).entries()) {
        const path = `challenges.${challengeIndex}.outcomes.${outcome}.stateEffects.${effectIndex}`;
        const definition = definitions.get(effect.stateId);
        if (!definition) {
          errors.push(`[${path}.stateId] State effect references undeclared state "${effect.stateId}".`);
          continue;
        }
        if (effect.operation === "increment" || effect.operation === "decrement") {
          if (definition.kind !== "number") errors.push(`[${path}.operation] ${effect.operation} requires a number state.`);
        } else if (effect.operation === "transition") {
          if (definition.kind !== "enum") errors.push(`[${path}.operation] transition requires an enum state.`);
          else {
            if (effect.from !== undefined && !definition.values.includes(effect.from)) errors.push(`[${path}.from] Transition source is not a declared enum value.`);
            if (!definition.values.includes(effect.to)) errors.push(`[${path}.to] Transition target is not a declared enum value.`);
          }
        } else if (!stateValueValid(definition, effect.value)) {
          errors.push(`[${path}.value] Set value does not satisfy state "${effect.stateId}".`);
        }
      }
    }
  }

  const roleIds = new Set(arc.roles.map((role) => role.id));
  const profileIds = new Set<string>();
  for (const [index, profile] of (extras.compositionProfiles ?? []).entries()) {
    if (profileIds.has(profile.id)) errors.push(`[compositionProfiles.${index}.id] Duplicate composition profile id "${profile.id}".`);
    profileIds.add(profile.id);
    if (new Set(profile.tags).size !== profile.tags.length) errors.push(`[compositionProfiles.${index}.tags] Tags must be unique.`);
    if (new Set(profile.dependencies).size !== profile.dependencies.length) errors.push(`[compositionProfiles.${index}.dependencies] Dependencies must be unique.`);
    for (const [rangeId, range] of Object.entries(profile.ranges)) {
      if (range.min > range.max) errors.push(`[compositionProfiles.${index}.ranges.${rangeId}] Range minimum exceeds maximum.`);
    }
  }

  extras.foundingProfileIds.forEach((profileId, index) => {
    if (profileId && !profileIds.has(profileId)) errors.push(`[founding.roster.${index}.compositionProfileId] Unknown composition profile "${profileId}".`);
  });
  extras.challengeConstraints.forEach((constraints, challengeIndex) => {
    if (!constraints) return;
    const constraintIds = new Set<string>();
    visitConstraints(constraints, (constraint) => {
      if (constraintIds.has(constraint.id)) errors.push(`[challenges.${challengeIndex}.compositionConstraints] Duplicate constraint id "${constraint.id}".`);
      constraintIds.add(constraint.id);
      if ((constraint.kind === "role-count") && !roleIds.has(constraint.roleId)) {
        errors.push(`[challenges.${challengeIndex}.compositionConstraints] Constraint references unknown role "${constraint.roleId}".`);
      }
      if (constraint.kind === "profile-count") {
        for (const profileId of constraint.profileIds) {
          if (!profileIds.has(profileId)) errors.push(`[challenges.${challengeIndex}.compositionConstraints] Constraint references unknown profile "${profileId}".`);
        }
      }
      if ("min" in constraint && "max" in constraint && constraint.max !== undefined && constraint.min > constraint.max) {
        errors.push(`[challenges.${challengeIndex}.compositionConstraints] Constraint "${constraint.id}" minimum exceeds maximum.`);
      }
      if (constraint.kind === "range-overlap" && constraint.required.min > constraint.required.max) {
        errors.push(`[challenges.${challengeIndex}.compositionConstraints] Constraint "${constraint.id}" range minimum exceeds maximum.`);
      }
    });
  });
}

function baseErrors(error: unknown): string[] {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Invalid arc:\n?/, "").split("\n").filter(Boolean);
}

function buildArc(input: unknown): { arc?: Arc; errors: string[] } {
  const errors: string[] = [];
  let base: Arc | undefined;
  try {
    base = validateBaseArc(stripAbi13(input));
  } catch (error) {
    errors.push(...baseErrors(error));
  }
  const extras = extrasFor(input, errors);
  if (!base) return { errors };
  crossValidate(base, extras, errors);
  if (errors.length > 0) return { errors };

  const founding = base.founding
    ? {
        ...base.founding,
        roster: base.founding.roster.map((slot, index) => ({
          ...slot,
          ...(extras.foundingProfileIds[index]
            ? { compositionProfileId: extras.foundingProfileIds[index] }
            : {}),
        })),
      }
    : undefined;

  const challenges = base.challenges.map((challenge, index) => {
    const effects = extras.outcomeEffects[index] ?? {};
    return {
      ...challenge,
      ...(extras.challengeConstraints[index]?.length
        ? { compositionConstraints: extras.challengeConstraints[index] }
        : {}),
      outcomes: {
        success: { ...challenge.outcomes.success, ...(effects.success?.length ? { stateEffects: effects.success } : {}) },
        partial: { ...challenge.outcomes.partial, ...(effects.partial?.length ? { stateEffects: effects.partial } : {}) },
        failure: { ...challenge.outcomes.failure, ...(effects.failure?.length ? { stateEffects: effects.failure } : {}) },
      },
    };
  });

  const arc: Arc = {
    ...base,
    ...(extras.stateDefinitions?.length ? { stateDefinitions: [...extras.stateDefinitions].sort((a, b) => compareCodepoints(a.id, b.id)) } : {}),
    ...(extras.compositionProfiles?.length ? { compositionProfiles: [...extras.compositionProfiles].sort((a, b) => compareCodepoints(a.id, b.id)) } : {}),
    ...(founding ? { founding } : {}),
    challenges,
  };
  return { arc, errors: [] };
}

export const ArcSchema: z.ZodType<Arc, z.ZodTypeDef, unknown> = z.unknown().superRefine((input, ctx) => {
  const result = buildArc(input);
  for (const message of result.errors) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
}).transform((input) => buildArc(input).arc!);

export function validateArc(input: unknown): Arc {
  const requiredEngine = input && typeof input === "object"
    && "meta" in input && input.meta && typeof input.meta === "object"
    && "engineVersion" in input.meta && typeof input.meta.engineVersion === "string"
    ? input.meta.engineVersion
    : null;
  if (requiredEngine !== null) assertEngineCompatible(requiredEngine);
  const result = buildArc(input);
  if (!result.arc) throw new Error(`Invalid arc:\n${result.errors.join("\n")}`);
  return result.arc;
}
