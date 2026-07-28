import { z } from "zod";
import type { Arc } from "../types.js";
import { compareEngineVersions } from "../version.js";
import {
  ACTION_OBJECTIVE_EXTENSION_KEY,
  ACTION_OBJECTIVE_PROFILE_FORMAT,
  ACTION_BUTTON,
  type ActionEncounterSpec,
  type ActionInput,
  type ActionObjectiveAuthoring,
  type ActionObjectiveProfile,
  type ActionObjectiveProgress,
  type ActionObjectiveSemanticCompletion,
  type ActionObjectiveSpec,
  type ActionObjectiveTarget,
  type ActionSimulationState,
} from "./types.js";

const Id = z.string().min(1);
const PressureEnemyCount = z.number().int().min(0).max(12).optional();
const AuthoringSchema: z.ZodType<ActionObjectiveAuthoring> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("interact_count"),
    targetCount: z.number().int().positive().max(16),
    radius: z.number().int().min(300).max(3000).optional(),
    pressureEnemyCount: PressureEnemyCount,
  }).strict(),
  z.object({
    kind: z.literal("hold_ticks"),
    targetTicks: z.number().int().positive().max(18_000),
    radius: z.number().int().min(300).max(3000).optional(),
    pressureEnemyCount: PressureEnemyCount,
  }).strict(),
]);
const ProfileSchema: z.ZodType<ActionObjectiveProfile> = z.object({
  format: z.literal(ACTION_OBJECTIVE_PROFILE_FORMAT),
  encounters: z.record(z.record(AuthoringSchema)),
}).strict();

const TARGET_DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, -1000], [707, -707], [1000, 0], [707, 707],
  [0, 1000], [-707, 707], [-1000, 0], [-707, -707],
];

interface SemanticState {
  objectiveProgress?: Record<string, number>;
  completedInteractionTargetIds?: string[];
}

export function parseActionObjectiveProfile(input: unknown): ActionObjectiveProfile {
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    });
    throw new Error(`Invalid ${ACTION_OBJECTIVE_PROFILE_FORMAT}:\n${errors.join("\n")}`);
  }
  return structuredClone(parsed.data);
}

export function readActionObjectiveProfile(arc: Arc): ActionObjectiveProfile | null {
  const raw = arc.extensions?.[ACTION_OBJECTIVE_EXTENSION_KEY];
  return raw === undefined ? null : parseActionObjectiveProfile(raw);
}

export function actionObjectiveProfileErrors(arc: Arc): string[] {
  const raw = arc.extensions?.[ACTION_OBJECTIVE_EXTENSION_KEY];
  if (raw === undefined) return [];

  let profile: ActionObjectiveProfile;
  try {
    profile = parseActionObjectiveProfile(raw);
  } catch (error) {
    return [(error as Error).message];
  }

  const root = `extensions.${ACTION_OBJECTIVE_EXTENSION_KEY}`;
  const errors: string[] = [];
  if (compareEngineVersions(arc.meta.engineVersion, "1.4.0") < 0) {
    errors.push(`[meta.engineVersion] ${ACTION_OBJECTIVE_PROFILE_FORMAT} requires engineVersion 1.4.0 or newer.`);
  }
  const challengeById = new Map(arc.challenges.map((challenge) => [challenge.id, challenge]));
  for (const [challengeId, authored] of Object.entries(profile.encounters)) {
    const challenge = challengeById.get(challengeId);
    if (!challenge) {
      errors.push(`[${root}.encounters.${challengeId}] Unknown challenge id.`);
      continue;
    }
    const objectiveIds = new Set(challenge.mechanicChecks.map((check) => check.id));
    for (const objectiveId of Object.keys(authored)) {
      if (!objectiveIds.has(objectiveId)) {
        errors.push(`[${root}.encounters.${challengeId}.${objectiveId}] Unknown objective id.`);
      }
    }
  }
  return errors;
}

function objectiveTarget(
  objectiveId: string,
  objectiveIndex: number,
  targetIndex: number,
  arenaRadius: number,
  radius: number,
): ActionObjectiveTarget {
  const direction = TARGET_DIRECTIONS[(objectiveIndex * 3 + targetIndex * 2) % TARGET_DIRECTIONS.length]!;
  const distance = Math.max(1200, Math.trunc(arenaRadius * 52 / 100));
  return {
    id: `${objectiveId}:target:${String(targetIndex + 1).padStart(2, "0")}`,
    x: Math.trunc(direction[0] * distance / 1000),
    y: Math.trunc(direction[1] * distance / 1000),
    radius,
  };
}

export function compileActionObjectiveCompletion(params: {
  profile: ActionObjectiveProfile | null;
  challengeId: string;
  objectiveId: string;
  objectiveIndex: number;
  arenaRadius: number;
}): ActionObjectiveSemanticCompletion | null {
  const authored = params.profile?.encounters[params.challengeId]?.[params.objectiveId];
  if (!authored) return null;
  const radius = authored.radius ?? 900;
  if (authored.kind === "interact_count") {
    return {
      kind: "interact_count",
      targetCount: authored.targetCount,
      targets: Array.from({ length: authored.targetCount }, (_, index) => objectiveTarget(
        params.objectiveId,
        params.objectiveIndex,
        index,
        params.arenaRadius,
        radius,
      )),
    };
  }
  return {
    kind: "hold_ticks",
    targetTicks: authored.targetTicks,
    target: objectiveTarget(params.objectiveId, params.objectiveIndex, 0, params.arenaRadius, radius),
  };
}

function semanticState(state: ActionSimulationState): SemanticState {
  return state as ActionSimulationState & SemanticState;
}

export function initializeSemanticObjectiveState(
  spec: ActionEncounterSpec,
  state: ActionSimulationState,
): ActionSimulationState {
  if (!spec.objectives.some((objective) => objective.semanticCompletion !== undefined)) return state;
  return {
    ...state,
    objectiveProgress: {},
    completedInteractionTargetIds: [],
  };
}

function distanceSquared(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

function withinTarget(state: ActionSimulationState, target: ActionObjectiveTarget): boolean {
  return distanceSquared(state.player.x, state.player.y, target.x, target.y) <= target.radius * target.radius;
}

export function stepSemanticObjective(
  spec: ActionEncounterSpec,
  state: ActionSimulationState,
  input: ActionInput,
): ActionSimulationState {
  const objective = spec.objectives[state.activeObjectiveIndex];
  const completion = objective?.semanticCompletion;
  if (!objective || !completion) return state;

  const current = semanticState(state);
  const progress = { ...(current.objectiveProgress ?? {}) };
  const completedTargets = new Set(current.completedInteractionTargetIds ?? []);
  let amount = progress[objective.id] ?? 0;
  let targetId: string | null = null;
  const events = [...state.events];

  if (completion.kind === "interact_count") {
    const risingInteract = (input.buttons & ACTION_BUTTON.interact) !== 0
      && (state.previousButtons & ACTION_BUTTON.interact) === 0;
    if (!risingInteract) return state;
    const target = completion.targets.find((candidate) => !completedTargets.has(candidate.id) && withinTarget(state, candidate));
    if (!target) return state;
    completedTargets.add(target.id);
    amount = completion.targets.filter((candidate) => completedTargets.has(candidate.id)).length;
    targetId = target.id;
  } else {
    if ((input.buttons & ACTION_BUTTON.interact) === 0 || !withinTarget(state, completion.target)) return state;
    amount = Math.min(completion.targetTicks, amount + 1);
    targetId = completion.target.id;
  }

  progress[objective.id] = amount;
  events.push({
    type: "objective_progress",
    objectiveId: objective.id,
    targetId,
    progress: amount,
    target: completion.kind === "interact_count" ? completion.targetCount : completion.targetTicks,
  });
  return {
    ...state,
    objectiveProgress: progress,
    completedInteractionTargetIds: [...completedTargets].sort(),
    stats: {
      ...state.stats,
      objectiveInteractions: (state.stats.objectiveInteractions ?? 0) + (completion.kind === "interact_count" ? 1 : 0),
      objectiveHoldTicks: (state.stats.objectiveHoldTicks ?? 0) + (completion.kind === "hold_ticks" ? 1 : 0),
    },
    events,
  };
}

export function actionObjectiveComplete(
  state: ActionSimulationState,
  objective: ActionObjectiveSpec,
): boolean {
  const completion = objective.semanticCompletion;
  if (!completion) return !state.enemies.some((enemy) => enemy.objectiveId === objective.id && enemy.mode !== "defeated");
  const progress = semanticState(state).objectiveProgress?.[objective.id] ?? 0;
  return completion.kind === "interact_count"
    ? progress >= completion.targetCount
    : progress >= completion.targetTicks;
}

export function semanticObjectiveProgress(
  state: ActionSimulationState,
  objective: ActionObjectiveSpec,
  completed: boolean,
): ActionObjectiveProgress | null {
  const completion = objective.semanticCompletion;
  if (!completion) return null;
  const target = completion.kind === "interact_count" ? completion.targetCount : completion.targetTicks;
  const progress = completed ? target : (semanticState(state).objectiveProgress?.[objective.id] ?? 0);
  return {
    id: objective.id,
    defeated: progress,
    target,
    completed,
    kind: completion.kind,
    progress,
  };
}
