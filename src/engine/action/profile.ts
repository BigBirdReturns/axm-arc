import { z } from "zod";
import type { Arc } from "../types.js";
import { compareEngineVersions } from "../version.js";
import { actionObjectiveProfileErrors } from "./objectives.js";
import {
  ACTION_EXTENSION_KEY,
  ACTION_PROFILE_FORMAT,
  type ActionEncounterAuthoring,
  type ActionProfile,
} from "./types.js";

const Id = z.string().min(1);
const EncounterAuthoringSchema: z.ZodType<ActionEncounterAuthoring> = z.object({
  arenaKit: z.enum(["ring", "lane", "islands"]).optional(),
  playerKit: z.enum(["staff", "blade", "hammer"]).optional(),
  durationSeconds: z.number().int().min(20).max(600).optional(),
  arenaScale: z.number().min(0.5).max(2).optional(),
  enemyScale: z.number().min(0.5).max(2).optional(),
  objectiveOrder: z.array(Id).min(1).optional(),
  objectiveKits: z.record(z.enum(["skirmisher", "duelist", "swarm", "hexer", "breaker"])).optional(),
}).strict();

const ProfileSchema: z.ZodType<ActionProfile> = z.object({
  format: z.literal(ACTION_PROFILE_FORMAT),
  encounters: z.record(EncounterAuthoringSchema),
}).strict();

export function parseActionProfile(input: unknown): ActionProfile {
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    });
    throw new Error(`Invalid ${ACTION_PROFILE_FORMAT}:\n${errors.join("\n")}`);
  }
  return structuredClone(parsed.data);
}

export function readActionProfile(arc: Arc): ActionProfile | null {
  const raw = arc.extensions?.[ACTION_EXTENSION_KEY];
  return raw === undefined ? null : parseActionProfile(raw);
}

/** Canonical action-extension validation. The action-profile and semantic
 * objective extensions are independent and optional, so this entrypoint must
 * validate both even when only one is present. */
export function actionProfileErrors(arc: Arc): string[] {
  const errors = actionObjectiveProfileErrors(arc);
  const raw = arc.extensions?.[ACTION_EXTENSION_KEY];
  if (raw === undefined) return errors;
  let profile: ActionProfile;
  try {
    profile = parseActionProfile(raw);
  } catch (error) {
    return [...errors, (error as Error).message];
  }

  if (compareEngineVersions(arc.meta.engineVersion, "1.4.0") < 0) {
    errors.push(`[meta.engineVersion] ${ACTION_PROFILE_FORMAT} requires engineVersion 1.4.0 or newer.`);
  }

  const challengeById = new Map(arc.challenges.map((challenge) => [challenge.id, challenge]));
  for (const [challengeId, authored] of Object.entries(profile.encounters)) {
    const challenge = challengeById.get(challengeId);
    if (!challenge) {
      errors.push(`[extensions.${ACTION_EXTENSION_KEY}.encounters.${challengeId}] Unknown challenge id.`);
      continue;
    }
    const objectiveIds = new Set(challenge.mechanicChecks.map((check) => check.id));
    if (authored.objectiveOrder) {
      const seen = new Set<string>();
      for (const objectiveId of authored.objectiveOrder) {
        if (seen.has(objectiveId)) {
          errors.push(`[extensions.${ACTION_EXTENSION_KEY}.encounters.${challengeId}.objectiveOrder] Duplicate objective id "${objectiveId}".`);
        }
        seen.add(objectiveId);
        if (!objectiveIds.has(objectiveId)) {
          errors.push(`[extensions.${ACTION_EXTENSION_KEY}.encounters.${challengeId}.objectiveOrder] Unknown objective id "${objectiveId}".`);
        }
      }
      if (seen.size !== objectiveIds.size) {
        errors.push(`[extensions.${ACTION_EXTENSION_KEY}.encounters.${challengeId}.objectiveOrder] Must name every challenge objective exactly once.`);
      }
    }
    for (const objectiveId of Object.keys(authored.objectiveKits ?? {})) {
      if (!objectiveIds.has(objectiveId)) {
        errors.push(`[extensions.${ACTION_EXTENSION_KEY}.encounters.${challengeId}.objectiveKits.${objectiveId}] Unknown objective id.`);
      }
    }
  }
  return errors;
}
