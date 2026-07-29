import { z } from "zod";
import type { Arc, Challenge } from "../types.js";
import { compareEngineVersions } from "../version.js";

export const ACTION_PLAYER_PROFILE_FORMAT = "axm-action-player-profile/1" as const;
export const ACTION_PLAYER_EXTENSION_KEY = "axm.action-player@1" as const;

export const ACTION_SEMANTIC_CUE_IDS = [
  "cue.player-action-started",
  "cue.player-action-active",
  "cue.player-action-recovery",
  "cue.enemy-attack-anticipated",
  "cue.enemy-attack-active",
  "cue.enemy-attack-recovery",
  "cue.defense-window-opened",
  "cue.defense-window-closed",
  "cue.parry-succeeded",
  "cue.dodge-invulnerability",
  "cue.enemy-stagger-started",
  "cue.mechanism-available",
  "cue.mechanism-progress",
  "cue.work-window-opened",
  "cue.work-window-closed",
  "cue.objective-completed",
  "cue.encounter-completed",
] as const;

export type ActionSemanticCueId = typeof ACTION_SEMANTIC_CUE_IDS[number];
export type ActionLearningStageKind = "teach" | "practice" | "master";
export type ActionTimingProfileId = string;

export interface ActionTimingProfile {
  id: ActionTimingProfileId;
  label: string;
  parryCommitTicks: number;
  parryActiveTicks: number;
  parryRecoveryTicks: number;
  dodgeInvulnerableTicks: number;
  enemyTelegraphScalePermille: number;
}

export interface ActionPlayerEncounterProfile {
  defaultTimingProfileId: ActionTimingProfileId;
  allowedTimingProfileIds: ActionTimingProfileId[];
}

export interface ActionLearningAdvantage {
  kind: "work_window";
  source: "parry_stagger";
  minimumTicks: number;
}

export interface ActionLearningAlternate {
  kind: "enemy_recovery";
  minimumTicks: number;
}

export interface ActionLearningStage {
  id: string;
  mechanic: "parry";
  stage: ActionLearningStageKind;
  challengeId: string;
  objectiveId: string;
  timingProfileId: ActionTimingProfileId;
  mandatory: boolean;
  safeOrLowDamage: boolean;
  requiredCueIds: ActionSemanticCueId[];
  advantage?: ActionLearningAdvantage;
  alternate?: ActionLearningAlternate;
}

export interface ActionPlayerProfile {
  format: typeof ACTION_PLAYER_PROFILE_FORMAT;
  timingProfiles: Record<ActionTimingProfileId, ActionTimingProfile>;
  encounters: Record<string, ActionPlayerEncounterProfile>;
  learning: Record<string, ActionLearningStage[]>;
}

const Id = z.string().min(1).max(256);
const CueId = z.enum(ACTION_SEMANTIC_CUE_IDS);
const TimingProfileSchema: z.ZodType<ActionTimingProfile> = z.object({
  id: Id,
  label: z.string().min(1).max(256),
  parryCommitTicks: z.number().int().min(1).max(120),
  parryActiveTicks: z.number().int().min(1).max(120),
  parryRecoveryTicks: z.number().int().min(0).max(240),
  dodgeInvulnerableTicks: z.number().int().min(0).max(120),
  enemyTelegraphScalePermille: z.number().int().min(500).max(3000),
}).strict();
const EncounterSchema: z.ZodType<ActionPlayerEncounterProfile> = z.object({
  defaultTimingProfileId: Id,
  allowedTimingProfileIds: z.array(Id).min(1).max(32),
}).strict();
const AdvantageSchema: z.ZodType<ActionLearningAdvantage> = z.object({
  kind: z.literal("work_window"),
  source: z.literal("parry_stagger"),
  minimumTicks: z.number().int().positive().max(18_000),
}).strict();
const AlternateSchema: z.ZodType<ActionLearningAlternate> = z.object({
  kind: z.literal("enemy_recovery"),
  minimumTicks: z.number().int().positive().max(18_000),
}).strict();
const LearningStageSchema: z.ZodType<ActionLearningStage> = z.object({
  id: Id,
  mechanic: z.literal("parry"),
  stage: z.enum(["teach", "practice", "master"]),
  challengeId: Id,
  objectiveId: Id,
  timingProfileId: Id,
  mandatory: z.boolean(),
  safeOrLowDamage: z.boolean(),
  requiredCueIds: z.array(CueId).min(1).max(ACTION_SEMANTIC_CUE_IDS.length),
  advantage: AdvantageSchema.optional(),
  alternate: AlternateSchema.optional(),
}).strict();
const ProfileSchema: z.ZodType<ActionPlayerProfile> = z.object({
  format: z.literal(ACTION_PLAYER_PROFILE_FORMAT),
  timingProfiles: z.record(TimingProfileSchema),
  encounters: z.record(EncounterSchema),
  learning: z.record(z.array(LearningStageSchema).min(1).max(32)),
}).strict();

export function parseActionPlayerProfile(input: unknown): ActionPlayerProfile {
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    });
    throw new Error(`Invalid ${ACTION_PLAYER_PROFILE_FORMAT}:\n${errors.join("\n")}`);
  }
  return structuredClone(parsed.data);
}

export function readActionPlayerProfile(arc: Arc): ActionPlayerProfile | null {
  const raw = arc.extensions?.[ACTION_PLAYER_EXTENSION_KEY];
  return raw === undefined ? null : parseActionPlayerProfile(raw);
}

function challengeMap(arc: Arc): Map<string, Challenge> {
  return new Map(arc.challenges.map((challenge) => [challenge.id, challenge]));
}

export function actionPlayerProfileErrors(arc: Arc): string[] {
  const raw = arc.extensions?.[ACTION_PLAYER_EXTENSION_KEY];
  if (raw === undefined) return [];

  let profile: ActionPlayerProfile;
  try {
    profile = parseActionPlayerProfile(raw);
  } catch (error) {
    return [(error as Error).message];
  }

  const root = `extensions.${ACTION_PLAYER_EXTENSION_KEY}`;
  const errors: string[] = [];
  if (compareEngineVersions(arc.meta.engineVersion, "1.4.0") < 0) {
    errors.push(`[meta.engineVersion] ${ACTION_PLAYER_PROFILE_FORMAT} requires engineVersion 1.4.0 or newer.`);
  }

  const timingIds = new Set(Object.keys(profile.timingProfiles));
  for (const [timingId, timing] of Object.entries(profile.timingProfiles)) {
    if (timing.id !== timingId) {
      errors.push(`[${root}.timingProfiles.${timingId}.id] Timing-profile id must match its record key.`);
    }
    if (timing.parryActiveTicks > timing.parryCommitTicks) {
      errors.push(`[${root}.timingProfiles.${timingId}] parryActiveTicks may not exceed parryCommitTicks.`);
    }
  }

  const challenges = challengeMap(arc);
  for (const [challengeId, encounter] of Object.entries(profile.encounters)) {
    if (!challenges.has(challengeId)) {
      errors.push(`[${root}.encounters.${challengeId}] Unknown challenge id.`);
      continue;
    }
    const allowed = new Set(encounter.allowedTimingProfileIds);
    if (allowed.size !== encounter.allowedTimingProfileIds.length) {
      errors.push(`[${root}.encounters.${challengeId}.allowedTimingProfileIds] Timing-profile ids must be unique.`);
    }
    for (const timingId of allowed) {
      if (!timingIds.has(timingId)) {
        errors.push(`[${root}.encounters.${challengeId}.allowedTimingProfileIds] Unknown timing profile "${timingId}".`);
      }
    }
    if (!allowed.has(encounter.defaultTimingProfileId)) {
      errors.push(`[${root}.encounters.${challengeId}.defaultTimingProfileId] Default timing profile must be allowed.`);
    }
  }

  const globalStageIds = new Set<string>();
  for (const [mechanicId, stages] of Object.entries(profile.learning)) {
    const expected: ActionLearningStageKind[] = ["teach", "practice", "master"];
    if (stages.length !== expected.length) {
      errors.push(`[${root}.learning.${mechanicId}] A mandatory mechanic requires exactly teach, practice, and master stages.`);
    }
    stages.forEach((stage, index) => {
      if (globalStageIds.has(stage.id)) {
        errors.push(`[${root}.learning.${mechanicId}.${index}.id] Learning-stage ids must be globally unique.`);
      }
      globalStageIds.add(stage.id);
      if (stage.stage !== expected[index]) {
        errors.push(`[${root}.learning.${mechanicId}.${index}.stage] Expected ${expected[index] ?? "no additional"} stage.`);
      }
      const challenge = challenges.get(stage.challengeId);
      if (!challenge) {
        errors.push(`[${root}.learning.${mechanicId}.${index}.challengeId] Unknown challenge id.`);
      } else if (!challenge.mechanicChecks.some((check) => check.id === stage.objectiveId)) {
        errors.push(`[${root}.learning.${mechanicId}.${index}.objectiveId] Unknown objective id for challenge ${stage.challengeId}.`);
      }
      const encounter = profile.encounters[stage.challengeId];
      if (!encounter) {
        errors.push(`[${root}.learning.${mechanicId}.${index}] Learning challenge lacks an action-player encounter profile.`);
      } else if (!encounter.allowedTimingProfileIds.includes(stage.timingProfileId)) {
        errors.push(`[${root}.learning.${mechanicId}.${index}.timingProfileId] Timing profile is not allowed for this challenge.`);
      }
      if (new Set(stage.requiredCueIds).size !== stage.requiredCueIds.length) {
        errors.push(`[${root}.learning.${mechanicId}.${index}.requiredCueIds] Cue ids must be unique.`);
      }
    });

    const teach = stages.find((stage) => stage.stage === "teach");
    const practice = stages.find((stage) => stage.stage === "practice");
    const master = stages.find((stage) => stage.stage === "master");
    if (teach && (teach.mandatory || !teach.safeOrLowDamage)) {
      errors.push(`[${root}.learning.${mechanicId}] Teach must be nonmandatory and safe or low damage.`);
    }
    if (practice && practice.mandatory) {
      errors.push(`[${root}.learning.${mechanicId}] Practice must remain an optional advantage.`);
    }
    if (master?.mandatory && !master.alternate) {
      errors.push(`[${root}.learning.${mechanicId}] Mandatory mastery requires an authored alternate completion route.`);
    }
  }
  return errors;
}

export function defaultActionTimingProfileId(arc: Arc, challengeId: string): string | null {
  return readActionPlayerProfile(arc)?.encounters[challengeId]?.defaultTimingProfileId ?? null;
}

export function resolveActionTimingProfile(
  arc: Arc,
  challengeId: string,
  timingProfileId: string | null,
): ActionTimingProfile | null {
  if (timingProfileId === null) return null;
  const profile = readActionPlayerProfile(arc);
  if (!profile) throw new Error(`Action timing profile "${timingProfileId}" was requested, but ${ACTION_PLAYER_PROFILE_FORMAT} is absent.`);
  const encounter = profile.encounters[challengeId];
  if (!encounter) throw new Error(`Challenge ${challengeId} has no action-player encounter profile.`);
  if (!encounter.allowedTimingProfileIds.includes(timingProfileId)) {
    throw new Error(`Action timing profile "${timingProfileId}" is not allowed for challenge ${challengeId}.`);
  }
  const timing = profile.timingProfiles[timingProfileId];
  if (!timing) throw new Error(`Action timing profile not found: ${timingProfileId}.`);
  return structuredClone(timing);
}
