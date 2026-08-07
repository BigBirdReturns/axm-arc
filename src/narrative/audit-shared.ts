import { compareCodepoints, orderedStrings } from "../engine/determinism.js";
import type { NarrativeBeat, NarrativeObligation, NarrativeTrackState } from "./types.js";
import type {
  NarrativeCausalAuditFinding,
  NarrativeCausalAuditFindingCode,
  NarrativeCausalAuditPolicy,
  NarrativeCausalAuditSeverity,
} from "./audit-types.js";

export function validateNarrativeCausalAuditPolicy(policy: NarrativeCausalAuditPolicy): void {
  for (const [name, value] of Object.entries(policy)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Narrative causal audit policy ${name} must be a non-negative integer`);
    }
  }
  if (policy.maximumActorSharePermille > 1000) {
    throw new Error("Narrative causal audit policy maximumActorSharePermille must be at most 1000");
  }
}

export function causalFinding(
  code: NarrativeCausalAuditFindingCode,
  severity: NarrativeCausalAuditSeverity,
  subjectId: string,
  detail: string,
  relatedIds: readonly string[] = [],
): NarrativeCausalAuditFinding {
  return { code, severity, subjectId, detail, relatedIds: orderedStrings([...new Set(relatedIds)]) };
}

export function isTerminalNarrativeBeat(beat: NarrativeBeat): boolean {
  // Terminality belongs to the beat's declared causal function. A corrupted or
  // manually assembled track must not be allowed to relabel an establishing beat
  // as an ending merely by setting the track status to resolved.
  return beat.beatFunction === "consequence" || beat.beatFunction === "inherit";
}

export function isActiveNarrativeFrontier(
  beat: NarrativeBeat,
  track: NarrativeTrackState | undefined,
): boolean {
  return Boolean(
    track &&
      track.status === "open" &&
      track.beatIds[track.beatIds.length - 1] === beat.id,
  );
}

export function maximumConsecutiveRecipeRun(
  beats: readonly NarrativeBeat[],
): { length: number; recipeId: string | null; beatIds: string[] } {
  let bestLength = 0;
  let bestRecipeId: string | null = null;
  let bestBeatIds: string[] = [];
  let currentRecipeId: string | null = null;
  let currentBeatIds: string[] = [];

  for (const beat of [...beats].sort(
    (left, right) => left.sequence - right.sequence || compareCodepoints(left.id, right.id),
  )) {
    if (beat.recipeId === currentRecipeId) currentBeatIds.push(beat.id);
    else {
      currentRecipeId = beat.recipeId;
      currentBeatIds = [beat.id];
    }
    if (currentBeatIds.length > bestLength) {
      bestLength = currentBeatIds.length;
      bestRecipeId = currentRecipeId;
      bestBeatIds = [...currentBeatIds];
    }
  }

  return { length: bestLength, recipeId: bestRecipeId, beatIds: bestBeatIds };
}

export function narrativeActorConcentration(beats: readonly NarrativeBeat[]): {
  maximumPermille: number;
  actorId: string | null;
  beatIds: string[];
} {
  if (beats.length === 0) return { maximumPermille: 0, actorId: null, beatIds: [] };
  const beatIdsByActor = new Map<string, string[]>();
  for (const beat of beats) {
    const actors = new Set([
      ...Object.values(beat.roleBindings),
      ...beat.actorMoves.map((move) => move.actorId),
    ]);
    for (const actorId of actors) {
      const ids = beatIdsByActor.get(actorId) ?? [];
      ids.push(beat.id);
      beatIdsByActor.set(actorId, ids);
    }
  }

  let maximumPermille = 0;
  let actorId: string | null = null;
  let beatIds: string[] = [];
  for (const [candidateActorId, candidateBeatIds] of [...beatIdsByActor.entries()].sort(
    ([left], [right]) => compareCodepoints(left, right),
  )) {
    const permille = Math.floor((candidateBeatIds.length * 1000) / beats.length);
    if (permille > maximumPermille) {
      maximumPermille = permille;
      actorId = candidateActorId;
      beatIds = [...candidateBeatIds];
    }
  }
  return { maximumPermille, actorId, beatIds };
}

export function closedObligationsByBeat(
  obligations: readonly NarrativeObligation[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const obligation of obligations) {
    if (!obligation.closedByBeatId) continue;
    const ids = result.get(obligation.closedByBeatId) ?? [];
    ids.push(obligation.id);
    result.set(obligation.closedByBeatId, ids);
  }
  return result;
}
