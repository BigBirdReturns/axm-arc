import { z } from "zod";
import type { Arc, JsonValue } from "../types.js";
import { compareEngineVersions } from "../version.js";
import {
  AUTHORED_EXPERIENCE_EXTENSION_KEY,
  AUTHORED_EXPERIENCE_FORMAT,
  type AuthoredExperienceDefinition,
  type AuthoredExperienceProfile,
  type AuthoredObjectiveCompletion,
  type AuthoredObjectiveVerb,
} from "./types.js";

const Id = z.string().min(1);
const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(JsonValueSchema),
  z.record(JsonValueSchema),
]));

const CompletionSchema: z.ZodType<AuthoredObjectiveCompletion> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("defeat_count"), targetCount: z.number().int().positive().max(10_000) }).strict(),
  z.object({ kind: z.literal("interact_count"), targetCount: z.number().int().positive().max(10_000) }).strict(),
  z.object({ kind: z.literal("hold_ticks"), targetTicks: z.number().int().positive().max(1_000_000) }).strict(),
  z.object({ kind: z.literal("authored_choice"), choiceIds: z.array(Id).min(2).max(64) }).strict(),
]);

const ObjectiveBindingSchema = z.object({
  verb: z.enum(["diagnose", "inspect", "operate", "repair", "reroute", "defend", "escort", "subdue", "negotiate"]),
  targetKind: z.enum(["actor", "mechanism", "area", "item"]),
  targetId: Id,
  playerFacingLabel: Id,
  completion: CompletionSchema,
  storyPaymentId: Id,
}).strict();

const RuntimeSignalSchema = z.object({
  kind: z.enum(["information", "actor", "route", "presentation", "affordance"]),
  id: Id,
}).strict();

const CommitmentSchema = z.object({
  id: Id,
  label: Id,
  description: z.string(),
  runtimeSignals: z.array(RuntimeSignalSchema).min(1).max(64),
}).strict();

const RevealSchema = z.object({
  id: Id,
  objectiveId: Id,
  trigger: z.enum(["objective_started", "objective_completed"]),
  actorId: Id,
  factId: Id,
}).strict();

const OutcomeSchema = z.object({
  factIds: z.array(Id).max(256),
  openedObligationIds: z.array(Id).max(256),
  resolvedObligationIds: z.array(Id).max(256),
  nextExperienceIds: z.array(Id).max(64),
  terminal: z.boolean().optional(),
}).strict();

const EntrySchema = z.object({
  beatId: Id,
  title: Id,
  playerRoleId: Id,
  playerRoleLabel: Id,
  ordinaryStake: Id,
  primaryActionLabel: Id,
}).strict();

const ExperienceSchema: z.ZodType<AuthoredExperienceDefinition> = z.object({
  challengeId: Id,
  entry: EntrySchema,
  commitments: z.array(CommitmentSchema).min(2).max(64),
  objectiveBindings: z.record(ObjectiveBindingSchema),
  reveals: z.array(RevealSchema).min(1).max(256),
  outcomes: z.object({
    success: OutcomeSchema,
    partial: OutcomeSchema,
    failure: OutcomeSchema,
  }).strict(),
  checkpointKey: Id,
  extensions: z.record(JsonValueSchema).optional(),
}).strict();

const ProfileSchema: z.ZodType<AuthoredExperienceProfile> = z.object({
  format: z.literal(AUTHORED_EXPERIENCE_FORMAT),
  experiences: z.record(ExperienceSchema),
  extensions: z.record(JsonValueSchema).optional(),
}).strict();

const COMPLETION_BY_VERB: Record<AuthoredObjectiveVerb, ReadonlySet<AuthoredObjectiveCompletion["kind"]>> = {
  diagnose: new Set(["interact_count", "hold_ticks"]),
  inspect: new Set(["interact_count", "hold_ticks"]),
  operate: new Set(["interact_count", "hold_ticks"]),
  repair: new Set(["interact_count", "hold_ticks"]),
  reroute: new Set(["interact_count", "hold_ticks", "authored_choice"]),
  defend: new Set(["defeat_count", "hold_ticks"]),
  escort: new Set(["interact_count", "hold_ticks"]),
  subdue: new Set(["defeat_count"]),
  negotiate: new Set(["authored_choice"]),
};

function uniqueErrors(values: readonly string[], path: string): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) errors.push(`[${path}] Duplicate identity "${value}".`);
    seen.add(value);
  }
  return errors;
}

export function parseAuthoredExperienceProfile(input: unknown): AuthoredExperienceProfile {
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    });
    throw new Error(`Invalid ${AUTHORED_EXPERIENCE_FORMAT}:\n${errors.join("\n")}`);
  }
  return structuredClone(parsed.data);
}

export function readAuthoredExperienceProfile(arc: Arc): AuthoredExperienceProfile | null {
  const raw = arc.extensions?.[AUTHORED_EXPERIENCE_EXTENSION_KEY];
  return raw === undefined ? null : parseAuthoredExperienceProfile(raw);
}

export function authoredExperienceForChallenge(
  arc: Arc,
  challengeId: string,
): Array<{ experienceId: string; experience: AuthoredExperienceDefinition }> {
  const profile = readAuthoredExperienceProfile(arc);
  if (!profile) return [];
  return Object.entries(profile.experiences)
    .filter(([, experience]) => experience.challengeId === challengeId)
    .map(([experienceId, experience]) => ({ experienceId, experience: structuredClone(experience) }));
}

export function authoredExperienceErrors(arc: Arc): string[] {
  const raw = arc.extensions?.[AUTHORED_EXPERIENCE_EXTENSION_KEY];
  if (raw === undefined) return [];

  let profile: AuthoredExperienceProfile;
  try {
    profile = parseAuthoredExperienceProfile(raw);
  } catch (error) {
    return [(error as Error).message];
  }

  const root = `extensions.${AUTHORED_EXPERIENCE_EXTENSION_KEY}`;
  const errors: string[] = [];
  if (compareEngineVersions(arc.meta.engineVersion, "1.4.0") < 0) {
    errors.push(`[meta.engineVersion] ${AUTHORED_EXPERIENCE_FORMAT} requires engineVersion 1.4.0 or newer.`);
  }

  const experienceIds = Object.keys(profile.experiences);
  if (experienceIds.length === 0) errors.push(`[${root}.experiences] At least one authored experience is required.`);
  const experienceIdSet = new Set(experienceIds);
  const challengeById = new Map(arc.challenges.map((challenge) => [challenge.id, challenge]));
  const checkpointKeys = new Set<string>();

  for (const [experienceId, experience] of Object.entries(profile.experiences)) {
    const path = `${root}.experiences.${experienceId}`;
    const challenge = challengeById.get(experience.challengeId);
    if (!challenge) {
      errors.push(`[${path}.challengeId] Unknown challenge id "${experience.challengeId}".`);
    }

    if (checkpointKeys.has(experience.checkpointKey)) {
      errors.push(`[${path}.checkpointKey] Duplicate checkpoint key "${experience.checkpointKey}".`);
    }
    checkpointKeys.add(experience.checkpointKey);

    errors.push(...uniqueErrors(experience.commitments.map((commitment) => commitment.id), `${path}.commitments`));
    for (const [index, commitment] of experience.commitments.entries()) {
      const signalKeys = commitment.runtimeSignals.map((signal) => `${signal.kind}:${signal.id}`);
      errors.push(...uniqueErrors(signalKeys, `${path}.commitments.${index}.runtimeSignals`));
    }

    const authoredObjectiveIds = Object.keys(experience.objectiveBindings);
    errors.push(...uniqueErrors(authoredObjectiveIds, `${path}.objectiveBindings`));
    if (challenge) {
      const requiredObjectiveIds = new Set(challenge.mechanicChecks.map((check) => check.id));
      for (const objectiveId of authoredObjectiveIds) {
        if (!requiredObjectiveIds.has(objectiveId)) {
          errors.push(`[${path}.objectiveBindings.${objectiveId}] Unknown challenge objective.`);
        }
      }
      for (const objectiveId of requiredObjectiveIds) {
        if (!(objectiveId in experience.objectiveBindings)) {
          errors.push(`[${path}.objectiveBindings] Missing semantic binding for challenge objective "${objectiveId}".`);
        }
      }
    }

    const storyPayments = new Set<string>();
    for (const [objectiveId, binding] of Object.entries(experience.objectiveBindings)) {
      if (!COMPLETION_BY_VERB[binding.verb].has(binding.completion.kind)) {
        errors.push(
          `[${path}.objectiveBindings.${objectiveId}.completion] `
          + `Verb "${binding.verb}" cannot be completed by "${binding.completion.kind}".`,
        );
      }
      if (storyPayments.has(binding.storyPaymentId)) {
        errors.push(`[${path}.objectiveBindings.${objectiveId}.storyPaymentId] Duplicate story payment "${binding.storyPaymentId}".`);
      }
      storyPayments.add(binding.storyPaymentId);
      if (binding.completion.kind === "authored_choice") {
        errors.push(...uniqueErrors(binding.completion.choiceIds, `${path}.objectiveBindings.${objectiveId}.completion.choiceIds`));
      }
    }

    errors.push(...uniqueErrors(experience.reveals.map((reveal) => reveal.id), `${path}.reveals`));
    for (const [index, reveal] of experience.reveals.entries()) {
      if (!(reveal.objectiveId in experience.objectiveBindings)) {
        errors.push(`[${path}.reveals.${index}.objectiveId] Reveal references an unbound objective "${reveal.objectiveId}".`);
      }
    }

    for (const outcome of ["success", "partial", "failure"] as const) {
      const mapping = experience.outcomes[outcome];
      const outcomePath = `${path}.outcomes.${outcome}`;
      errors.push(...uniqueErrors(mapping.factIds, `${outcomePath}.factIds`));
      errors.push(...uniqueErrors(mapping.openedObligationIds, `${outcomePath}.openedObligationIds`));
      errors.push(...uniqueErrors(mapping.resolvedObligationIds, `${outcomePath}.resolvedObligationIds`));
      errors.push(...uniqueErrors(mapping.nextExperienceIds, `${outcomePath}.nextExperienceIds`));

      const opened = new Set(mapping.openedObligationIds);
      for (const obligationId of mapping.resolvedObligationIds) {
        if (opened.has(obligationId)) {
          errors.push(`[${outcomePath}] Obligation "${obligationId}" cannot be opened and resolved by the same outcome.`);
        }
      }

      if (mapping.terminal === true) {
        if (mapping.nextExperienceIds.length > 0) {
          errors.push(`[${outcomePath}] A terminal outcome cannot name a next experience.`);
        }
      } else if (mapping.nextExperienceIds.length === 0) {
        errors.push(`[${outcomePath}.nextExperienceIds] Nonterminal outcome must name at least one implemented next experience.`);
      }
      for (const nextExperienceId of mapping.nextExperienceIds) {
        if (!experienceIdSet.has(nextExperienceId)) {
          errors.push(`[${outcomePath}.nextExperienceIds] Unknown next experience "${nextExperienceId}".`);
        }
      }
    }
  }

  return errors;
}
