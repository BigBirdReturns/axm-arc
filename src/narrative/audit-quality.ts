import { compareCodepoints, orderedStrings } from "../engine/determinism.js";
import type { NarrativeRuntimeState } from "./types.js";
import type {
  NarrativeBeatCausalReceipt,
  NarrativeCausalAuditFinding,
  NarrativeCausalAuditPolicy,
} from "./audit-types.js";
import {
  causalFinding,
  maximumConsecutiveRecipeRun,
  narrativeActorConcentration,
} from "./audit-shared.js";

export interface NarrativeQualityAuditResult {
  looseBeatIds: string[];
  stalledTrackIds: string[];
  overdueObligationIds: string[];
  highPressureObligationIds: string[];
  maximumRecipeRunObserved: number;
  maximumActorSharePermilleObserved: number;
  findings: NarrativeCausalAuditFinding[];
}

export function auditNarrativeQuality(
  state: NarrativeRuntimeState,
  beats: readonly NarrativeBeatCausalReceipt[],
  policy: NarrativeCausalAuditPolicy,
): NarrativeQualityAuditResult {
  const findings: NarrativeCausalAuditFinding[] = [];
  const beatById = new Map(state.ledger.beats.map((beat) => [beat.id, beat] as const));
  const looseBeatIds = beats
    .filter((beat) => !beat.structurallyUsed && state.cycle - beat.cycle > policy.looseBeatGraceCycles)
    .map((beat) => beat.beatId);
  for (const beatId of looseBeatIds) {
    findings.push(
      causalFinding(
        "loose-beat",
        "warning",
        beatId,
        `beat ${beatId} has no child, closed obligation, terminal role, or active-frontier role`,
      ),
    );
  }

  const stalledTrackIds: string[] = [];
  for (const track of [...state.tracks].sort((left, right) => compareCodepoints(left.id, right.id))) {
    if (track.status !== "open") {
      if (track.openObligationIds.length > 0) {
        findings.push(
          causalFinding(
            "terminal-track-open-obligation",
            "error",
            track.id,
            `terminal track ${track.id} retains ${track.openObligationIds.length} open obligation(s)`,
            track.openObligationIds,
          ),
        );
      }
      continue;
    }
    const lastBeat = beatById.get(track.beatIds[track.beatIds.length - 1] ?? "");
    if (lastBeat && state.cycle - lastBeat.cycle > policy.stalledTrackCycles) {
      stalledTrackIds.push(track.id);
      findings.push(
        causalFinding(
          "stalled-track",
          "warning",
          track.id,
          `track ${track.id} has not advanced for ${state.cycle - lastBeat.cycle} cycles`,
          [lastBeat.id],
        ),
      );
    }
  }

  const overdueObligationIds: string[] = [];
  const highPressureObligationIds: string[] = [];
  for (const obligation of [...state.ledger.obligations].sort(
    (left, right) => compareCodepoints(left.id, right.id),
  )) {
    if (obligation.status !== "open") continue;
    if (obligation.dueCycle !== undefined && obligation.dueCycle < state.cycle) {
      overdueObligationIds.push(obligation.id);
      findings.push(
        causalFinding(
          "overdue-obligation",
          "warning",
          obligation.id,
          `obligation ${obligation.id} was due in cycle ${obligation.dueCycle} and remains open in cycle ${state.cycle}`,
          [obligation.openedByBeatId],
        ),
      );
    }
    if (obligation.pressure >= policy.highPressureThreshold) {
      highPressureObligationIds.push(obligation.id);
      findings.push(
        causalFinding(
          "high-pressure-obligation",
          "notice",
          obligation.id,
          `obligation ${obligation.id} carries pressure ${obligation.pressure}`,
          [obligation.openedByBeatId],
        ),
      );
    }
  }

  const recipeRun = maximumConsecutiveRecipeRun(state.ledger.beats);
  if (recipeRun.length > policy.maximumRecipeRun && recipeRun.recipeId) {
    findings.push(
      causalFinding(
        "recipe-run",
        "warning",
        recipeRun.recipeId,
        `recipe ${recipeRun.recipeId} appears in ${recipeRun.length} consecutive beats`,
        recipeRun.beatIds,
      ),
    );
  }

  const concentration = narrativeActorConcentration(state.ledger.beats);
  if (
    concentration.actorId &&
    concentration.maximumPermille > policy.maximumActorSharePermille
  ) {
    findings.push(
      causalFinding(
        "actor-concentration",
        "warning",
        concentration.actorId,
        `actor ${concentration.actorId} appears in ${concentration.maximumPermille} permille of committed beats`,
        concentration.beatIds,
      ),
    );
  }

  return {
    looseBeatIds: orderedStrings(looseBeatIds),
    stalledTrackIds: orderedStrings(stalledTrackIds),
    overdueObligationIds: orderedStrings(overdueObligationIds),
    highPressureObligationIds: orderedStrings(highPressureObligationIds),
    maximumRecipeRunObserved: recipeRun.length,
    maximumActorSharePermilleObserved: concentration.maximumPermille,
    findings,
  };
}
