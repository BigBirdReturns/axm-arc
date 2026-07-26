import { compareCodepoints, orderedStrings } from "../engine/determinism.js";
import type { NarrativeRuntimeState } from "./types.js";
import type { NarrativeBeatCausalReceipt, NarrativeCausalAuditFinding } from "./audit-types.js";
import {
  causalFinding,
  closedObligationsByBeat,
  isActiveNarrativeFrontier,
  isTerminalNarrativeBeat,
} from "./audit-shared.js";

export interface NarrativeCausalGraphResult {
  beats: NarrativeBeatCausalReceipt[];
  findings: NarrativeCausalAuditFinding[];
}

export function buildNarrativeCausalGraph(state: NarrativeRuntimeState): NarrativeCausalGraphResult {
  const findings: NarrativeCausalAuditFinding[] = [];
  const beatById = new Map(state.ledger.beats.map((beat) => [beat.id, beat] as const));
  const trackById = new Map(state.tracks.map((track) => [track.id, track] as const));
  const childIdsByParent = new Map<string, string[]>();
  const obligationClosedIdsByBeat = closedObligationsByBeat(state.ledger.obligations);

  for (const beat of state.ledger.beats) {
    for (const parentId of beat.causalParentBeatIds) {
      const parent = beatById.get(parentId);
      if (!parent) {
        findings.push(
          causalFinding("missing-causal-parent", "error", beat.id, `beat ${beat.id} cites absent parent ${parentId}`, [parentId]),
        );
        continue;
      }
      if (parent.sequence >= beat.sequence) {
        findings.push(
          causalFinding(
            "non-prior-causal-parent",
            "error",
            beat.id,
            `beat ${beat.id} cites ${parentId} at sequence ${parent.sequence}, which is not prior to ${beat.sequence}`,
            [parentId],
          ),
        );
      }
      const childIds = childIdsByParent.get(parentId) ?? [];
      childIds.push(beat.id);
      childIdsByParent.set(parentId, childIds);
    }
  }

  for (const obligation of state.ledger.obligations) {
    if (!beatById.has(obligation.openedByBeatId)) {
      findings.push(
        causalFinding(
          "missing-obligation-opening-beat",
          "error",
          obligation.id,
          `obligation ${obligation.id} cites absent opening beat ${obligation.openedByBeatId}`,
          [obligation.openedByBeatId],
        ),
      );
    }
    if (obligation.closedByBeatId && !beatById.has(obligation.closedByBeatId)) {
      findings.push(
        causalFinding(
          "missing-obligation-closing-beat",
          "error",
          obligation.id,
          `obligation ${obligation.id} cites absent closing beat ${obligation.closedByBeatId}`,
          [obligation.closedByBeatId],
        ),
      );
    }
  }

  const beats = [...state.ledger.beats]
    .sort((left, right) => left.sequence - right.sequence || compareCodepoints(left.id, right.id))
    .map((beat): NarrativeBeatCausalReceipt => {
      const track = trackById.get(beat.trackId);
      const childBeatIds = orderedStrings(childIdsByParent.get(beat.id) ?? []);
      const obligationClosedIds = orderedStrings(obligationClosedIdsByBeat.get(beat.id) ?? []);
      const terminal = isTerminalNarrativeBeat(beat);
      const frontier = isActiveNarrativeFrontier(beat, track);
      return {
        beatId: beat.id,
        cycle: beat.cycle,
        trackId: beat.trackId,
        parentBeatIds: orderedStrings(beat.causalParentBeatIds),
        childBeatIds,
        obligationOpenedIds: orderedStrings(beat.openedObligationIds),
        obligationClosedIds,
        terminal,
        activeFrontier: frontier,
        structurallyUsed: childBeatIds.length > 0 || obligationClosedIds.length > 0 || terminal || frontier,
      };
    });

  return { beats, findings };
}
