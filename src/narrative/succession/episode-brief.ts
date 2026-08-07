import { compareCodepoints, fingerprint, uniqueOrdered } from "./determinism.js";
import type { ColdWalkBeat, NarrativeHandoffPacket } from "./model.js";
import type { NarrativeSeriesReceipt, SeriesEpisodeReceipt } from "./series.js";

export const NARRATIVE_EPISODE_BRIEF_FORMAT = "axm-narrative-episode-brief/1" as const;
export const NARRATIVE_WRITER_ROOM_PACKET_FORMAT = "axm-narrative-writer-room-packet/1" as const;

export interface EpisodeBriefActorMove {
  actorId: string;
  actorName: string;
  responsibility: string;
  moveTag: string;
  intentionGoalIds: string[];
  knowledgePropositionIds: string[];
  falseBeliefPropositionIds: string[];
  expectedGoalEffects: Array<{ goalId: string; delta: number }>;
  risk: number | null;
}

export interface EpisodeBeatBrief {
  beatId: string;
  function: ColdWalkBeat["beatFunction"];
  causalParentBeatIds: string[];
  actorMoves: EpisodeBriefActorMove[];
  statePayments: Array<{ kind: string; target: string; tags: string[] }>;
  openedObligationIds: string[];
  resolvedObligationIds: string[];
  sourceTags: string[];
}

export interface NarrativeEpisodeBrief {
  format: typeof NARRATIVE_EPISODE_BRIEF_FORMAT;
  sourceId: string;
  sourceTitle: string;
  sourceVersion: string;
  episodeIndex: number;
  incidentId: string;
  incidentTitle: string;
  family: string;
  controllingQuestion: string;
  mechanism: SeriesEpisodeReceipt["incident"]["mechanism"] | null;
  continuity: {
    mode: SeriesEpisodeReceipt["continuityMode"];
    addressedObligationIds: string[];
    openedObligationId: string;
    openObligationCountBefore: number;
    openObligationCountAfter: number;
  };
  presentation: {
    form: SeriesEpisodeReceipt["presentationForm"];
    openingMode: SeriesEpisodeReceipt["presentationOpeningMode"];
    semanticBeatOrder: string[];
    presentationBeatOrder: string[];
  };
  beats: EpisodeBeatBrief[];
  persistentChanges: Array<{ kind: string; target: string }>;
  roomQuestions: string[];
  fingerprint: string;
}

export interface NarrativeWriterRoomPacket {
  format: typeof NARRATIVE_WRITER_ROOM_PACKET_FORMAT;
  sourceId: string;
  sourceTitle: string;
  sourceVersion: string;
  seasonSeed: number;
  episodeCount: number;
  seriesPassed: boolean;
  exceptionQueue: Array<{ code: string; detail: string }>;
  episodes: NarrativeEpisodeBrief[];
  fingerprint: string;
}

function actorMoveBrief(packet: NarrativeHandoffPacket, beat: ColdWalkBeat): EpisodeBriefActorMove[] {
  const actorById = new Map(packet.actors.map((actor) => [actor.id, actor] as const));
  const receiptByActor = new Map(beat.agencyReceipt.moves.map((move) => [move.actorId, move] as const));
  return beat.actorIds
    .map((actorId) => {
      const actor = actorById.get(actorId);
      const receipt = receiptByActor.get(actorId);
      const moveTag = beat.moveTags[beat.actorIds.indexOf(actorId)] ?? receipt?.moveTag ?? "unrecorded-move";
      return {
        actorId,
        actorName: actor?.name ?? actorId,
        responsibility: actor?.responsibility ?? "unknown",
        moveTag,
        intentionGoalIds: uniqueOrdered(receipt?.intentionGoalIds ?? []),
        knowledgePropositionIds: uniqueOrdered(receipt?.knowledgePropositionIds ?? []),
        falseBeliefPropositionIds: uniqueOrdered(receipt?.falseBeliefPropositionIds ?? []),
        expectedGoalEffects: [...(receipt?.expectedGoalEffects ?? [])]
          .sort((left, right) => compareCodepoints(left.goalId, right.goalId) || left.delta - right.delta),
        risk: receipt?.risk ?? null,
      };
    })
    .sort((left, right) => compareCodepoints(left.actorId, right.actorId));
}

function roomQuestions(packet: NarrativeHandoffPacket, episode: SeriesEpisodeReceipt): string[] {
  const mechanism = episode.incident.mechanism;
  const questions = [
    mechanism?.controlQuestion ?? packet.source.controlQuestion,
    `Which actor's characteristic method makes ${episode.incident.title} worse before it becomes solvable?`,
    `What evidence is available in this episode, and what does that evidence still fail to establish?`,
    `Which concrete cost prevents the room from solving ${episode.incident.id} through a clean reset?`,
    `Which relationship, rule, dependency, route, constituency, or claim must remain changed after the consequence beat?`,
  ];
  if (episode.addressedObligationIds.length > 0) {
    questions.push(`How does this episode visibly answer ${episode.addressedObligationIds.join(", ")} rather than merely mentioning prior continuity?`);
  }
  return questions;
}

export function compileNarrativeEpisodeBrief(
  packet: NarrativeHandoffPacket,
  episode: SeriesEpisodeReceipt,
): NarrativeEpisodeBrief {
  const semanticOrder = episode.coldWalk.beats.map((beat) => beat.id);
  const beatBriefs: EpisodeBeatBrief[] = episode.coldWalk.beats.map((beat) => ({
    beatId: beat.id,
    function: beat.beatFunction,
    causalParentBeatIds: uniqueOrdered(beat.causalParentBeatIds),
    actorMoves: actorMoveBrief(packet, beat),
    statePayments: beat.statePayments.map((payment) => ({
      kind: payment.kind,
      target: payment.target,
      tags: uniqueOrdered(payment.tags),
    })),
    openedObligationIds: uniqueOrdered(beat.openedObligationIds),
    resolvedObligationIds: uniqueOrdered(beat.resolvedObligationIds),
    sourceTags: uniqueOrdered(beat.tags.filter((tag) =>
      tag.startsWith("pressure:") ||
      tag.startsWith("pressure-id:") ||
      tag.startsWith("evidence:") ||
      tag.startsWith("faction:") ||
      tag.startsWith("consequence:") ||
      tag.startsWith("physics:") ||
      tag.startsWith("pitch:")
    )),
  }));
  const authority = {
    format: NARRATIVE_EPISODE_BRIEF_FORMAT,
    sourceId: packet.source.id,
    sourceTitle: packet.source.title,
    sourceVersion: packet.source.version,
    episodeIndex: episode.index,
    incidentId: episode.incident.id,
    incidentTitle: episode.incident.title,
    family: episode.incident.family,
    controllingQuestion: episode.incident.mechanism?.controlQuestion ?? packet.source.controlQuestion,
    mechanism: episode.incident.mechanism ? { ...episode.incident.mechanism } : null,
    continuity: {
      mode: episode.continuityMode,
      addressedObligationIds: uniqueOrdered(episode.addressedObligationIds),
      openedObligationId: episode.openedObligationId,
      openObligationCountBefore: episode.openObligationCountBefore,
      openObligationCountAfter: episode.openObligationCountAfter,
    },
    presentation: {
      form: episode.presentationForm,
      openingMode: episode.presentationOpeningMode,
      semanticBeatOrder: semanticOrder,
      presentationBeatOrder: [...episode.presentationBeatIds],
    },
    beats: beatBriefs,
    persistentChanges: beatBriefs.flatMap((beat) => beat.statePayments.map((payment) => ({ kind: payment.kind, target: payment.target }))),
    roomQuestions: roomQuestions(packet, episode),
  };
  return { ...authority, fingerprint: fingerprint(authority) };
}

export function compileNarrativeWriterRoomPacket(
  packet: NarrativeHandoffPacket,
  series: NarrativeSeriesReceipt,
): NarrativeWriterRoomPacket {
  if (series.sourceId !== packet.source.id) {
    throw new Error(`series ${series.sourceId} does not belong to ${packet.source.id}`);
  }
  const episodes = series.episodes.map((episode) => compileNarrativeEpisodeBrief(packet, episode));
  const exceptionQueue = series.findings.map((detail) => ({ code: "series-finding", detail }));
  const authority = {
    format: NARRATIVE_WRITER_ROOM_PACKET_FORMAT,
    sourceId: packet.source.id,
    sourceTitle: packet.source.title,
    sourceVersion: packet.source.version,
    seasonSeed: series.seed,
    episodeCount: series.episodeCount,
    seriesPassed: series.passed,
    exceptionQueue,
    episodes,
  };
  return { ...authority, fingerprint: fingerprint(authority) };
}
