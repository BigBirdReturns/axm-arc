import { orderedStrings } from "../engine/determinism.js";
import { sortNarrativeCandidates } from "./rails.js";
import {
  narrativeConstitutionFingerprint,
  narrativeSelectionFingerprint,
  narrativeStateFingerprint,
} from "./fingerprint.js";
import type {
  NarrativeBeat,
  NarrativeCandidate,
  NarrativeCommitResult,
  NarrativeConstitution,
  NarrativeObligation,
  NarrativeRuntimeState,
  NarrativeSelectionReceipt,
  NarrativeTrackState,
  NarrativeTrackStatus,
} from "./types.js";

function uniqueOrdered(values: readonly string[]): string[] {
  return orderedStrings([...new Set(values)]);
}

function nextTrackStatus(candidate: NarrativeCandidate): NarrativeTrackStatus {
  switch (candidate.trackDisposition ?? "continue") {
    case "resolve":
      return "resolved";
    case "inherit":
      return "inherited";
    default:
      return "open";
  }
}

function causalParents(state: NarrativeRuntimeState, candidate: NarrativeCandidate): string[] {
  const parents = new Set(candidate.causalParentBeatIds);
  if (candidate.track.kind === "advance") {
    const track = state.tracks.find((entry) => entry.id === candidate.track.trackId);
    const lastBeatId = track?.beatIds[track.beatIds.length - 1];
    if (lastBeatId) parents.add(lastBeatId);
  }
  for (const obligationId of candidate.resolvesObligationIds) {
    const obligation = state.ledger.obligations.find((entry) => entry.id === obligationId);
    if (obligation) parents.add(obligation.openedByBeatId);
  }
  return uniqueOrdered([...parents]);
}

function updateObligations(
  state: NarrativeRuntimeState,
  candidate: NarrativeCandidate,
  beatId: string,
): NarrativeObligation[] {
  const resolved = new Set(candidate.resolvesObligationIds);
  const existing = state.ledger.obligations.map((obligation) =>
    resolved.has(obligation.id)
      ? { ...obligation, status: "resolved" as const, closedByBeatId: beatId }
      : obligation,
  );
  const opened = candidate.opensObligations.map((draft) => ({
    ...draft,
    actorIds: uniqueOrdered(draft.actorIds),
    tags: uniqueOrdered(draft.tags),
    openedByBeatId: beatId,
    status: "open" as const,
  }));
  return [...existing, ...opened];
}

function updateTrack(
  state: NarrativeRuntimeState,
  candidate: NarrativeCandidate,
  beatId: string,
): NarrativeTrackState {
  const resolved = new Set(candidate.resolvesObligationIds);
  const openedIds = candidate.opensObligations.map((obligation) => obligation.id);
  const status = nextTrackStatus(candidate);

  if (candidate.track.kind === "open") {
    return {
      id: candidate.track.trackId,
      railId: candidate.track.railId,
      controllingQuestion: candidate.track.controllingQuestion,
      actorIds: uniqueOrdered(candidate.track.actorIds),
      pressureTags: uniqueOrdered(candidate.track.pressureTags),
      currentFunction: candidate.beatFunction,
      beatIds: [beatId],
      openObligationIds: uniqueOrdered(openedIds),
      status,
    };
  }

  const current = state.tracks.find((track) => track.id === candidate.track.trackId);
  if (!current) throw new Error(`Narrative track ${candidate.track.trackId} disappeared before commit`);
  return {
    ...current,
    currentFunction: candidate.beatFunction,
    beatIds: [...current.beatIds, beatId],
    openObligationIds: uniqueOrdered([
      ...current.openObligationIds.filter((obligationId) => !resolved.has(obligationId)),
      ...openedIds,
    ]),
    status,
  };
}

export function commitNarrativeSelection(
  constitution: NarrativeConstitution,
  state: NarrativeRuntimeState,
  candidates: readonly NarrativeCandidate[],
  selection: NarrativeSelectionReceipt,
): NarrativeCommitResult {
  if (selection.constitutionId !== constitution.id || selection.constitutionVersion !== constitution.version) {
    throw new Error(`Narrative selection constitution does not match ${constitution.id}@${constitution.version}`);
  }
  if (selection.constitutionFingerprint !== narrativeConstitutionFingerprint(constitution)) {
    throw new Error("Narrative selection constitution fingerprint is stale");
  }
  if (selection.stateFingerprint !== narrativeStateFingerprint(state)) {
    throw new Error("Narrative selection state fingerprint is stale");
  }
  if (selection.cycle !== state.cycle) {
    throw new Error(`Narrative selection cycle ${selection.cycle} does not match state cycle ${state.cycle}`);
  }
  if (selection.selectedCandidateId === null) {
    throw new Error("Narrative selection contains no candidate to commit");
  }

  const currentSelection = sortNarrativeCandidates(constitution, state, candidates);
  if (narrativeSelectionFingerprint(currentSelection) !== narrativeSelectionFingerprint(selection)) {
    throw new Error("Narrative selection receipt does not match the current candidate set");
  }

  const candidate = candidates.find((entry) => entry.id === selection.selectedCandidateId);
  if (!candidate) {
    throw new Error(`Selected narrative candidate ${selection.selectedCandidateId} is absent`);
  }
  if (candidate.authority !== "authoritative") {
    throw new Error("Presentation candidates cannot enter the authoritative narrative ledger");
  }
  const score = currentSelection.eligible.find((entry) => entry.candidateId === candidate.id);
  if (!score) {
    throw new Error(`Candidate ${candidate.id} is no longer eligible in the current state`);
  }

  const sequence = state.ledger.beats.length;
  const beatId = `beat_${sequence}_${candidate.id}`;
  if (state.ledger.beats.some((beat) => beat.id === beatId)) {
    throw new Error(`Narrative beat id ${beatId} already exists`);
  }

  const track = updateTrack(state, candidate, beatId);
  const beat: NarrativeBeat = {
    id: beatId,
    sequence,
    cycle: state.cycle,
    candidateId: candidate.id,
    recipeId: candidate.recipeId,
    authority: candidate.authority,
    trackId: track.id,
    beatFunction: candidate.beatFunction,
    sourceFactIds: uniqueOrdered(candidate.sourceFactIds),
    causalParentBeatIds: causalParents(state, candidate),
    roleBindings: { ...candidate.roleBindings },
    actorMoves: candidate.actorMoves.map((move) => ({
      ...move,
      justificationFactIds: move.justificationFactIds
        ? uniqueOrdered(move.justificationFactIds)
        : undefined,
    })),
    tags: uniqueOrdered(candidate.tags),
    pressureTags: uniqueOrdered(candidate.pressureTags),
    statePayments: candidate.statePayments.map((payment) => ({
      ...payment,
      tags: uniqueOrdered(payment.tags),
    })),
    openedObligationIds: uniqueOrdered(candidate.opensObligations.map((obligation) => obligation.id)),
    resolvedObligationIds: uniqueOrdered(candidate.resolvesObligationIds),
    presentationKey: candidate.presentationKey,
    score,
  };

  const nextTracks = candidate.track.kind === "open"
    ? [...state.tracks, track]
    : state.tracks.map((entry) => (entry.id === track.id ? track : entry));

  const nextState: NarrativeRuntimeState = {
    ...state,
    tracks: nextTracks,
    ledger: {
      ...state.ledger,
      beats: [...state.ledger.beats, beat],
      obligations: updateObligations(state, candidate, beatId),
    },
  };

  return {
    state: nextState,
    receipt: {
      format: "axm-narrative-commit/1",
      beatId,
      sequence,
      selectionFingerprint: narrativeSelectionFingerprint(selection),
      stateBeforeFingerprint: narrativeStateFingerprint(state),
      stateAfterFingerprint: narrativeStateFingerprint(nextState),
      trackId: track.id,
      openedObligationIds: beat.openedObligationIds,
      resolvedObligationIds: beat.resolvedObligationIds,
      trackStatus: track.status,
    },
  };
}
