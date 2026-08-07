import { compareCodepoints, orderRecordKeysDeep, orderedStrings } from "../engine/determinism.js";
import { hashSeed } from "../engine/prng.js";
import type {
  NarrativeCandidate,
  NarrativeConstitution,
  NarrativeRuntimeState,
  NarrativeSelectionReceipt,
} from "./types.js";

function orderedRecord<T>(record: Readonly<Record<string, T>>): Record<string, T> {
  const output: Record<string, T> = {};
  for (const key of Object.keys(record).sort(compareCodepoints)) output[key] = record[key]!;
  return output;
}

export function narrativeFingerprint(value: unknown): string {
  const canonical = JSON.stringify(orderRecordKeysDeep(value));
  return `fnv1a32:${hashSeed(canonical).toString(16).padStart(8, "0")}`;
}

export function narrativeConstitutionFingerprint(constitution: NarrativeConstitution): string {
  return narrativeFingerprint(constitution);
}

export function narrativeCandidateSetFingerprint(candidates: readonly NarrativeCandidate[]): string {
  return narrativeFingerprint([...candidates].sort((left, right) => compareCodepoints(left.id, right.id)));
}

export function canonicalNarrativeRuntimeState(state: NarrativeRuntimeState): NarrativeRuntimeState {
  return {
    ...state,
    facts: [...state.facts]
      .sort((left, right) => compareCodepoints(left.id, right.id))
      .map((fact) => ({
        ...fact,
        actorIds: orderedStrings(fact.actorIds),
        actorRoles: fact.actorRoles ? orderedRecord(fact.actorRoles) : undefined,
        tags: orderedStrings(fact.tags),
        data: fact.data ? orderedRecord(fact.data) : undefined,
      })),
    actors: [...state.actors]
      .sort((left, right) => compareCodepoints(left.id, right.id))
      .map((actor) => ({ ...actor, tags: orderedStrings(actor.tags), metrics: orderedRecord(actor.metrics) })),
    tracks: [...state.tracks]
      .sort((left, right) => compareCodepoints(left.id, right.id))
      .map((track) => ({
        ...track,
        actorIds: orderedStrings(track.actorIds),
        pressureTags: orderedStrings(track.pressureTags),
        openObligationIds: orderedStrings(track.openObligationIds),
      })),
    ledger: {
      ...state.ledger,
      beats: [...state.ledger.beats]
        .sort((left, right) => left.sequence - right.sequence || compareCodepoints(left.id, right.id))
        .map((beat) => ({
          ...beat,
          sourceFactIds: orderedStrings(beat.sourceFactIds),
          causalParentBeatIds: orderedStrings(beat.causalParentBeatIds),
          roleBindings: orderedRecord(beat.roleBindings),
          tags: orderedStrings(beat.tags),
          pressureTags: orderedStrings(beat.pressureTags),
          openedObligationIds: orderedStrings(beat.openedObligationIds),
          resolvedObligationIds: orderedStrings(beat.resolvedObligationIds),
        })),
      obligations: [...state.ledger.obligations]
        .sort((left, right) => compareCodepoints(left.id, right.id))
        .map((obligation) => ({
          ...obligation,
          actorIds: orderedStrings(obligation.actorIds),
          tags: orderedStrings(obligation.tags),
        })),
    },
  };
}

export function narrativeStateFingerprint(state: NarrativeRuntimeState): string {
  return narrativeFingerprint(canonicalNarrativeRuntimeState(state));
}

export function narrativeSelectionFingerprint(selection: NarrativeSelectionReceipt): string {
  return narrativeFingerprint(selection);
}
