import type { Arc, JsonValue } from "../../engine/types.js";
import { compileActionEncounter } from "../../engine/action/compile.js";
import { readActionProfile } from "../../engine/action/profile.js";
import {
  ACTION_EXTENSION_KEY,
  ACTION_PROFILE_FORMAT,
  type ActionEncounterAuthoring,
  type ActionProfile,
} from "../../engine/action/types.js";
import { compareEngineVersions } from "../../engine/version.js";
import { validateArc } from "../../engine/schema.js";

export interface ActionChallengeAuthoringSummary {
  challengeId: string;
  title: string;
  explicit: boolean;
  arenaKit: string;
  playerKit: string;
  durationSeconds: number;
  maxWaveEnemies: number;
  objectiveCount: number;
  objectiveKits: string[];
  specDigest: string;
}

export interface ActionAuthoringSummary {
  format: typeof ACTION_PROFILE_FORMAT;
  explicitEncounterCount: number;
  challengeCount: number;
  challenges: ActionChallengeAuthoringSummary[];
}

function derivedAuthoring(arc: Arc, challengeId: string): ActionEncounterAuthoring {
  const challenge = arc.challenges.find((candidate) => candidate.id === challengeId);
  if (!challenge) throw new Error(`Unknown action challenge ${challengeId}.`);
  const spec = compileActionEncounter(arc, challenge);
  return {
    arenaKit: spec.arena.kit,
    playerKit: spec.player.kit,
    durationSeconds: Math.max(20, Math.round(spec.maxTicks / spec.tickRate)),
    arenaScale: 1,
    enemyScale: 1,
    objectiveOrder: spec.objectives.map((objective) => objective.id),
    objectiveKits: Object.fromEntries(spec.objectives.map((objective) => [objective.id, objective.enemyKit])),
  };
}

function withProfile(arc: Arc, profile: ActionProfile): Arc {
  const candidate: Arc = {
    ...structuredClone(arc),
    meta: {
      ...arc.meta,
      engineVersion: compareEngineVersions(arc.meta.engineVersion, "1.4.0") < 0 ? "1.4.0" : arc.meta.engineVersion,
    },
    extensions: {
      ...(structuredClone(arc.extensions ?? {})),
      [ACTION_EXTENSION_KEY]: structuredClone(profile) as unknown as JsonValue,
    },
  };
  return validateArc(candidate);
}

export function summarizeActionAuthoring(arc: Arc): ActionAuthoringSummary {
  const profile = readActionProfile(arc);
  const explicitIds = new Set(Object.keys(profile?.encounters ?? {}));
  return {
    format: ACTION_PROFILE_FORMAT,
    explicitEncounterCount: explicitIds.size,
    challengeCount: arc.challenges.length,
    challenges: arc.challenges.map((challenge) => {
      const spec = compileActionEncounter(arc, challenge);
      return {
        challengeId: challenge.id,
        title: challenge.name,
        explicit: explicitIds.has(challenge.id),
        arenaKit: spec.arena.kit,
        playerKit: spec.player.kit,
        durationSeconds: Math.round(spec.maxTicks / spec.tickRate),
        maxWaveEnemies: Math.max(...spec.objectives.map((objective) => objective.enemyCount)),
        objectiveCount: spec.objectives.length,
        objectiveKits: [...new Set(spec.objectives.map((objective) => objective.enemyKit))].sort(),
        specDigest: spec.specDigest,
      };
    }),
  };
}

export function materializeActionProfile(arc: Arc): Arc {
  const current = readActionProfile(arc);
  const encounters = Object.fromEntries(arc.challenges.map((challenge) => [
    challenge.id,
    current?.encounters[challenge.id] ?? derivedAuthoring(arc, challenge.id),
  ]));
  return withProfile(arc, { format: ACTION_PROFILE_FORMAT, encounters });
}

export function updateActionEncounterAuthoring(
  arc: Arc,
  challengeId: string,
  patch: Partial<ActionEncounterAuthoring>,
): Arc {
  const current = readActionProfile(arc);
  const base = current?.encounters[challengeId] ?? derivedAuthoring(arc, challengeId);
  return withProfile(arc, {
    format: ACTION_PROFILE_FORMAT,
    encounters: {
      ...(current?.encounters ?? {}),
      [challengeId]: { ...base, ...patch },
    },
  });
}

export function removeActionEncounterAuthoring(arc: Arc, challengeId: string): Arc {
  const current = readActionProfile(arc);
  if (!current?.encounters[challengeId]) return arc;
  const encounters = { ...current.encounters };
  delete encounters[challengeId];
  const extensions = { ...(structuredClone(arc.extensions ?? {})) };
  if (Object.keys(encounters).length === 0) delete extensions[ACTION_EXTENSION_KEY];
  else extensions[ACTION_EXTENSION_KEY] = { format: ACTION_PROFILE_FORMAT, encounters } as unknown as JsonValue;
  return validateArc({ ...structuredClone(arc), extensions });
}
