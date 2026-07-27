import { prepareNarrativeColdRoom, runPreparedNarrativeColdWalk, type PreparedColdRoom } from "./cold-room.js";
import { compareCodepoints, fingerprint, hashSeed, uniqueOrdered } from "./determinism.js";
import type { BeatFunction, ColdWalkReceipt, NarrativeHandoffPacket } from "./model.js";
import { computeNarrativeHandoffFingerprint } from "./source-validation.js";

export const NARRATIVE_SERIES_FORMAT = "axm-narrative-series/1" as const;

export type SeriesIncidentFamily = "faction-overreach" | "evidence-limit" | "consequence-claim";
export type SeriesPresentationForm = "linear" | "pressure-cold-open" | "evidence-teaser" | "choice-teaser";
export type SeriesContinuityMode = "advance" | "open-secondary" | "collision";

const INCIDENT_RAILS: Record<SeriesIncidentFamily, Array<"establish" | "pressure" | "reveal" | "escalate" | "choose" | "consequence">> = {
  "faction-overreach": ["establish", "pressure", "escalate", "choose", "consequence"],
  "evidence-limit": ["establish", "reveal", "pressure", "choose", "consequence"],
  "consequence-claim": ["establish", "pressure", "choose", "consequence"],
};

export interface SeriesIncident {
  id: string;
  family: SeriesIncidentFamily;
  title: string;
  summary: string;
  sourceObjectId: string;
  tags: string[];
  severity: number;
  addressesObligationKinds: string[];
  opensObligationKind: string;
  pitchId?: string;
  mechanism?: {
    ordinaryGood: string;
    actorMethod: string;
    pressure: string;
    affectedActor: string;
    evidenceLimit: string;
    concreteCost: string;
    persistentChange: string;
    controlQuestion: string;
  };
}

export interface SeriesObligation {
  id: string;
  kind: string;
  sourceIncidentId: string;
  openedEpisode: number;
  pressure: number;
  status: "open" | "resolved" | "inherited";
  resolvedEpisode?: number;
}

export interface SeriesEpisodeReceipt {
  index: number;
  incident: SeriesIncident;
  incidentScore: number;
  incidentSelectionRegret: number;
  addressedObligationIds: string[];
  openedObligationId: string;
  continuityMode: SeriesContinuityMode;
  openObligationCountBefore: number;
  openObligationCountAfter: number;
  selectionPoolIncidentIds: string[];
  selectionKey: number;
  walkVariant: number;
  presentationForm: SeriesPresentationForm;
  presentationOpeningMode: "full" | "teaser";
  presentationBeatIds: string[];
  coldWalk: ColdWalkReceipt;
}

export interface NarrativeSeriesReceipt {
  format: typeof NARRATIVE_SERIES_FORMAT;
  sourceId: string;
  seed: number;
  episodeCount: number;
  incidentPoolFingerprint: string;
  episodes: SeriesEpisodeReceipt[];
  obligations: SeriesObligation[];
  openObligationIds: string[];
  uniqueIncidentCount: number;
  uniqueSkeletonCount: number;
  skeletonDiversityPermille: number;
  semanticRailShapes: string[];
  uniqueSemanticRailShapeCount: number;
  maximumIdenticalSkeletonRun: number;
  uniquePresentationFormCount: number;
  presentationFormCoveragePermille: number;
  maximumIdenticalPresentationFormRun: number;
  presentationValidationFailureCount: number;
  incidentCoveragePermille: number;
  familyCoveragePermille: number;
  maximumConsecutiveFamily: number;
  maximumActorSharePermille: number;
  repeatedAdjacentIncidentCount: number;
  episodeFailureCount: number;
  counterfactualCausalWidth: number;
  maximumOpenObligationCount: number;
  inheritedObligationCount: number;
  deferredEpisodeCount: number;
  collisionEpisodeCount: number;
  maximumObligationAge: number;
  maximumIncidentSelectionRegret: number;
  maximumBeatSelectionRegret: number;
  findings: string[];
  passed: boolean;
}

export interface PreparedSeriesIncidentRuntime {
  incident: SeriesIncident;
  prepared: PreparedColdRoom;
}

export interface PreparedNarrativeSeries {
  packet: NarrativeHandoffPacket;
  incidents: SeriesIncident[];
  runtimes: ReadonlyMap<string, PreparedSeriesIncidentRuntime>;
  incidentPoolFingerprint: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function compileSeriesIncidents(
  packet: NarrativeHandoffPacket,
  submittedIncidents: readonly SeriesIncident[] = [],
): SeriesIncident[] {
  const factionIncidents: SeriesIncident[] = packet.factions.map((faction) => ({
    id: `incident:faction-overreach:${faction.factionId}`,
    family: "faction-overreach",
    title: `${faction.factionName}: ${faction.variableControlled}`,
    summary: `${faction.publicGood} The same method now produces its characteristic failure: ${faction.characteristicFailure}`,
    sourceObjectId: faction.factionId,
    tags: uniqueOrdered([
      `source:${packet.source.id}`,
      `incident:faction-overreach`,
      `faction:${faction.factionId}`,
      "claim:public-good",
      "claim:characteristic-failure",
    ]),
    severity: 50,
    addressesObligationKinds: ["constituency-debt", "knowledge-debt"],
    opensObligationKind: "legitimacy-debt",
  }));

  const evidenceIncidents: SeriesIncident[] = packet.evidence.receipts.map((receipt) => ({
    id: `incident:evidence-limit:${receipt.id}`,
    family: "evidence-limit",
    title: `${receipt.label}: the limit becomes operative`,
    summary: `${receipt.intervention} Its declared limit now changes what the institution may honestly decide: ${receipt.limits}`,
    sourceObjectId: receipt.id,
    tags: uniqueOrdered([
      `source:${packet.source.id}`,
      "incident:evidence-limit",
      `evidence:${receipt.id}`,
      `evidence-tier:${packet.evidence.tier}`,
      "claim:contested",
    ]),
    severity: 55,
    addressesObligationKinds: ["legitimacy-debt", "constituency-debt"],
    opensObligationKind: "knowledge-debt",
  }));

  const consequenceIncidents: SeriesIncident[] = packet.consequences.map((consequence) => ({
    id: `incident:consequence-claim:${consequence.id}`,
    family: "consequence-claim",
    title: `${consequence.label}: inheritance acquires a claimant`,
    summary: `${consequence.description} The actors inheriting it now demand standing: ${consequence.inheritedBy}`,
    sourceObjectId: consequence.id,
    tags: uniqueOrdered([
      `source:${packet.source.id}`,
      "incident:consequence-claim",
      `consequence:${consequence.kind}`,
      `consequence-id:${consequence.id}`,
      "payment:persistent-map-change",
    ]),
    severity: 60,
    addressesObligationKinds: ["knowledge-debt", "legitimacy-debt"],
    opensObligationKind: "constituency-debt",
  }));

  const combined = [...factionIncidents, ...evidenceIncidents, ...consequenceIncidents, ...submittedIncidents.map((entry) => clone(entry))];
  const counts = new Map<string, number>();
  for (const incident of combined) counts.set(incident.id, (counts.get(incident.id) ?? 0) + 1);
  const duplicate = [...counts.entries()].find(([, count]) => count > 1)?.[0];
  if (duplicate) throw new Error(`Duplicate series incident id ${duplicate}`);
  return combined.sort((left, right) => compareCodepoints(left.id, right.id));
}

function preferredActorsForIncident(
  packet: NarrativeHandoffPacket,
  incident: SeriesIncident,
  preferredResponsibilities: readonly string[],
  group: string,
): string[] {
  const eligible = packet.actors.filter((actor) => preferredResponsibilities.includes(actor.responsibility));
  if (eligible.length === 0) return [];
  const factionLocal =
    incident.family === "faction-overreach"
      ? eligible.filter((actor) => actor.factionId === incident.sourceObjectId)
      : [];
  const evidenceLocal =
    incident.family === "evidence-limit" && (group === "reveal" || group === "escalate")
      ? eligible.filter((actor) => actor.responsibility.includes("evidence"))
      : [];
  const pool = factionLocal.length > 0 ? factionLocal : evidenceLocal.length > 0 ? evidenceLocal : eligible;
  const index = hashSeed(packet.source.id, incident.id, group) % pool.length;
  return [pool[index]!.id];
}

export function compileIncidentHandoff(packet: NarrativeHandoffPacket, incident: SeriesIncident): NarrativeHandoffPacket {
  const result = clone(packet);
  result.activeIncident = {
    id: incident.id,
    title: incident.title,
    summary: incident.summary,
    family: incident.family,
    pitchId: incident.pitchId,
    mechanism: incident.mechanism ? { ...incident.mechanism } : undefined,
  };
  const grammar = INCIDENT_RAILS[incident.family];
  const baseSeeds = new Map(packet.factSeeds.map((seed) => [seed.group, seed] as const));
  const openKinds: string[] = [];
  result.factSeeds = grammar.map((group, index) => {
    const seed = baseSeeds.get(group);
    if (!seed) throw new Error(`Incident grammar ${incident.family} cannot find ${group} source seed`);
    const priorGroup = index === 0 ? undefined : grammar[index - 1];
    const priorSeed = priorGroup ? baseSeeds.get(priorGroup) : undefined;
    const opensObligationKind = group === "consequence" ? undefined : seed.opensObligationKind ?? `series-${group}-debt`;
    let resolvesObligationKinds: string[] = [];
    if (group === "choose" || group === "consequence") {
      resolvesObligationKinds = [...openKinds];
      openKinds.splice(0, openKinds.length);
    }
    if (opensObligationKind) openKinds.push(opensObligationKind);
    return {
      ...seed,
      id: `${seed.id}:${incident.id}:rail-${grammar.join("-")}`,
      tags: uniqueOrdered([
        ...seed.tags,
        ...incident.tags,
        `series-incident:${incident.id}`,
        `series-family:${incident.family}`,
        `episode-rail:${grammar.join("-")}`,
      ]),
      sourcePressureIds: uniqueOrdered(seed.sourcePressureIds),
      preferredResponsibilities: [...new Set([
        ...seed.preferredResponsibilities,
        ...packet.actors.map((actor) => actor.responsibility),
      ])],
      preferredActorIds: preferredActorsForIncident(
        packet,
        incident,
        [...new Set([...seed.preferredResponsibilities, ...packet.actors.map((actor) => actor.responsibility)])],
        seed.group,
      ),
      requiresStatePaymentKinds: priorSeed ? [priorSeed.statePaymentKind] : [],
      opensObligationKind,
      resolvesObligationKinds,
      severity: Math.min(100, seed.severity + Math.floor(incident.severity / 10)),
    };
  });
  result.rail = {
    id: `series-incident-rail/1:${incident.family}`,
    functionOrder: [...grammar],
    prerequisites: Object.fromEntries(grammar.map((group, index) => [group, grammar.slice(0, index)])),
    transitions: Object.fromEntries([
      ["start", [grammar[0]]],
      ...grammar.map((group, index) => [group, index + 1 < grammar.length ? [grammar[index + 1]] : []]),
    ]),
    terminalFunctions: ["consequence"],
  };
  result.handoffFingerprint = computeNarrativeHandoffFingerprint(result);
  return result;
}

function incidentScore(
  incident: SeriesIncident,
  episodeIndex: number,
  obligations: readonly SeriesObligation[],
  seenCount: ReadonlyMap<string, number>,
  lastUsed: ReadonlyMap<string, number>,
  seenFamilies: ReadonlySet<SeriesIncidentFamily>,
): number {
  const active = obligations.filter((obligation) => obligation.status === "open");
  const addressedPressure = active
    .filter((obligation) => incident.addressesObligationKinds.includes(obligation.kind))
    .reduce((sum, obligation) => sum + obligation.pressure, 0);
  const count = seenCount.get(incident.id) ?? 0;
  const last = lastUsed.get(incident.id);
  const recencyDistance = last === undefined ? 99 : episodeIndex - last;
  return (
    incident.severity * 10 +
    addressedPressure * 20 +
    (seenFamilies.has(incident.family) ? 0 : 400) +
    (count === 0 ? 500 : -count * 180) +
    (recencyDistance <= 1 ? -2000 : recencyDistance === 2 ? -700 : 0)
  );
}

function continuityModeForEpisode(
  obligations: readonly SeriesObligation[],
  seriesSeed: number,
  episodeIndex: number,
  episodes: readonly SeriesEpisodeReceipt[],
): SeriesContinuityMode {
  const active = obligations.filter((obligation) => obligation.status === "open");
  if (active.length === 0) return "advance";
  const lastDeferred = [...episodes].reverse().find((episode) => episode.continuityMode === "open-secondary")?.index;
  const lastCollision = [...episodes].reverse().find((episode) => episode.continuityMode === "collision")?.index;
  if (active.length === 1) {
    const sinceDeferred = lastDeferred === undefined ? Number.POSITIVE_INFINITY : episodeIndex - lastDeferred;
    const forced = episodeIndex >= 2 && sinceDeferred >= 4;
    const invited = hashSeed("series-open-secondary", seriesSeed, episodeIndex) % 4 === 0;
    return forced || invited ? "open-secondary" : "advance";
  }
  const sinceCollision = lastCollision === undefined ? Number.POSITIVE_INFINITY : episodeIndex - lastCollision;
  const sinceDeferred = lastDeferred === undefined ? Number.POSITIVE_INFINITY : episodeIndex - lastDeferred;
  const forced = active.length >= 3 || (sinceDeferred >= 1 && sinceCollision >= 4);
  const invited = sinceDeferred >= 1 && hashSeed("series-collision", seriesSeed, episodeIndex) % 3 === 0;
  return forced || invited ? "collision" : "advance";
}

function activeIncidentPool(
  incidents: readonly SeriesIncident[],
  obligations: readonly SeriesObligation[],
  mode: SeriesContinuityMode,
): SeriesIncident[] {
  const active = obligations
    .filter((obligation) => obligation.status === "open")
    .sort((left, right) => left.openedEpisode - right.openedEpisode || compareCodepoints(left.id, right.id));
  const oldest = active[0];
  if (!oldest) return [...incidents];
  if (mode === "open-secondary") {
    const deferred = incidents.filter((incident) => !incident.addressesObligationKinds.includes(oldest.kind));
    return deferred.length > 0 ? deferred : [...incidents];
  }
  if (mode === "collision") {
    const collision = incidents.filter((incident) => {
      const matches = active.filter((obligation) => incident.addressesObligationKinds.includes(obligation.kind)).length;
      return matches >= Math.min(2, active.length);
    });
    return collision.length > 0 ? collision : incidents.filter((incident) => incident.addressesObligationKinds.includes(oldest.kind));
  }
  return incidents.filter((incident) => incident.addressesObligationKinds.includes(oldest.kind));
}

function walkSkeletonSignature(walk: ColdWalkReceipt): string {
  return walk.beats
    .map((beat) => `${beat.beatFunction}:${beat.actorIds.join("+")}:${beat.moveTags.join("+")}`)
    .join("|");
}

function chooseIncidentWithPreview(
  incidents: readonly SeriesIncident[],
  runtimes: ReadonlyMap<string, PreparedSeriesIncidentRuntime>,
  seriesSeed: number,
  episodeIndex: number,
  episodes: readonly SeriesEpisodeReceipt[],
  obligations: readonly SeriesObligation[],
  seenCount: ReadonlyMap<string, number>,
  lastUsed: ReadonlyMap<string, number>,
  seenFamilies: ReadonlySet<SeriesIncidentFamily>,
  continuityMode: SeriesContinuityMode,
  remainingEpisodes: number,
): { incident: SeriesIncident; score: number; walk: ColdWalkReceipt; walkVariant: number; incidentSelectionRegret: number; selectionPoolIncidentIds: string[]; selectionKey: number } {
  const priorSkeletons = episodes.slice(-3).map((episode) => walkSkeletonSignature(episode.coldWalk));
  const priorFamily = episodes[episodes.length - 1]?.incident.family;
  const actorUse = recentActorUse(episodes);
  const activePool = activeIncidentPool(incidents, obligations, continuityMode);
  const priorIncidentId = episodes[episodes.length - 1]?.incident.id;
  const nonRepeatingPool = priorIncidentId ? activePool.filter((incident) => incident.id !== priorIncidentId) : activePool;
  let candidatePool = nonRepeatingPool.length > 0 ? nonRepeatingPool : activePool;
  const allFamilies = new Set(incidents.map((incident) => incident.family));
  const unseenFamilies = new Set([...allFamilies].filter((family) => !seenFamilies.has(family)));
  if (unseenFamilies.size > 0 && remainingEpisodes <= unseenFamilies.size) {
    const coveragePool = candidatePool.filter((incident) => unseenFamilies.has(incident.family));
    const globalCoveragePool = incidents.filter(
      (incident) => unseenFamilies.has(incident.family) && incident.id !== priorIncidentId,
    );
    candidatePool = coveragePool.length > 0 ? coveragePool : globalCoveragePool;
  }
  const qualifiedCandidates = candidatePool
    .map((incident) => {
      const runtime = runtimes.get(incident.id)!;
      const previewVariant = (walkVariant: number) => {
        const walk = runPreparedNarrativeColdWalk(
          runtime.prepared,
          hashSeed(seriesSeed, episodeIndex, incident.id, walkVariant),
          {
            actorUse,
            selectionBand: 500,
            selectionSalt: `series:${episodeIndex}:${incident.id}:variant:${walkVariant}`,
          },
        );
        const skeleton = walkSkeletonSignature(walk);
        const recentSkeletonCount = priorSkeletons.filter((entry) => entry === skeleton).length;
        const immediateRepeat = priorSkeletons[priorSkeletons.length - 1] === skeleton;
        return { walkVariant, walk, skeleton, recentSkeletonCount, immediateRepeat };
      };
      const primaryPreview = previewVariant(0);
      const previews = [
        primaryPreview,
        ...(primaryPreview.immediateRepeat || primaryPreview.recentSkeletonCount >= 2
          ? [previewVariant(1), previewVariant(2), previewVariant(3)]
          : []),
      ].filter((entry) => entry.walk.passed);
      const nonRepeatingPreviews = previews.filter((entry) => !entry.immediateRepeat);
      const previewPool = nonRepeatingPreviews.length > 0 ? nonRepeatingPreviews : previews;
      const preview = previewPool.sort(
        (left, right) =>
          left.recentSkeletonCount - right.recentSkeletonCount ||
          hashSeed("episode-preview", seriesSeed, episodeIndex, incident.id, left.walkVariant) -
            hashSeed("episode-preview", seriesSeed, episodeIndex, incident.id, right.walkVariant) ||
          left.walkVariant - right.walkVariant,
      )[0];
      if (!preview) return null;
      const base = incidentScore(incident, episodeIndex, obligations, seenCount, lastUsed, seenFamilies);
      const skeletonPenalty = (preview.immediateRepeat ? 2500 : 0) + preview.recentSkeletonCount * 700;
      const familyPenalty = priorFamily === incident.family ? 350 : 0;
      return {
        incident,
        walk: preview.walk,
        walkVariant: preview.walkVariant,
        skeleton: preview.skeleton,
        score: base - skeletonPenalty - familyPenalty,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  const immediateSkeleton = priorSkeletons[priorSkeletons.length - 1];
  const nonRepeatingSkeletonCandidates = immediateSkeleton
    ? qualifiedCandidates.filter((entry) => entry.skeleton !== immediateSkeleton)
    : qualifiedCandidates;
  const candidates = (nonRepeatingSkeletonCandidates.length > 0
    ? nonRepeatingSkeletonCandidates
    : qualifiedCandidates
  ).sort((left, right) => right.score - left.score || compareCodepoints(left.incident.id, right.incident.id));
  const topScore = candidates[0]?.score;
  const selectionPool = topScore === undefined ? [] : candidates.filter((entry) => entry.score >= topScore - 450);
  const keyedSelectionPool = selectionPool
    .map((entry) => ({
      entry,
      key: hashSeed("series-qualified-plurality", seriesSeed, episodeIndex, entry.incident.id),
    }))
    .sort((left, right) => left.key - right.key || compareCodepoints(left.entry.incident.id, right.entry.incident.id));
  const selectedRecord = keyedSelectionPool[0];
  if (!selectedRecord) throw new Error("No incident produced a qualified executable episode");
  return {
    ...selectedRecord.entry,
    incidentSelectionRegret: Math.max(0, (candidates[0]?.score ?? selectedRecord.entry.score) - selectedRecord.entry.score),
    selectionPoolIncidentIds: keyedSelectionPool.map((entry) => `${entry.entry.incident.id}#walk-${entry.entry.walkVariant}`),
    selectionKey: selectedRecord.key,
  };
}

function choosePresentationForm(
  incident: SeriesIncident,
  walk: ColdWalkReceipt,
  seriesSeed: number,
  episodeIndex: number,
  episodes: readonly SeriesEpisodeReceipt[],
): SeriesPresentationForm {
  const functions = new Set(walk.beats.map((beat) => beat.beatFunction));
  const all: SeriesPresentationForm[] = [
    "linear",
    ...(functions.has("pressure") ? ["pressure-cold-open" as const] : []),
    ...(functions.has("reveal") ? ["evidence-teaser" as const] : []),
    ...(functions.has("choose") ? ["choice-teaser" as const] : []),
  ];
  const familyPreference: Record<SeriesIncidentFamily, SeriesPresentationForm[]> = {
    "faction-overreach": ["pressure-cold-open", "choice-teaser", "linear", "evidence-teaser"],
    "evidence-limit": ["evidence-teaser", "linear", "pressure-cold-open", "choice-teaser"],
    "consequence-claim": ["choice-teaser", "linear", "evidence-teaser", "pressure-cold-open"],
  };
  const counts = new Map<SeriesPresentationForm, number>();
  for (const episode of episodes) counts.set(episode.presentationForm, (counts.get(episode.presentationForm) ?? 0) + 1);
  const immediate = episodes[episodes.length - 1]?.presentationForm;
  return all
    .map((form) => {
      const preference = familyPreference[incident.family].indexOf(form);
      const score =
        (counts.has(form) ? 0 : 600) +
        Math.max(0, 300 - (counts.get(form) ?? 0) * 80) +
        Math.max(0, 200 - preference * 60) +
        (form === immediate ? -900 : 0);
      return { form, score, key: hashSeed("presentation-form", seriesSeed, episodeIndex, incident.id, form) };
    })
    .sort((left, right) => right.score - left.score || left.key - right.key || compareCodepoints(left.form, right.form))[0]!.form;
}

function presentationBeatIds(walk: ColdWalkReceipt, form: SeriesPresentationForm): string[] {
  const semanticFunctions = walk.beats.map((beat) => beat.beatFunction);
  const opener: BeatFunction | null = form === "pressure-cold-open" ? "pressure" : form === "evidence-teaser" ? "reveal" : form === "choice-teaser" ? "choose" : null;
  const orderedFunctions: BeatFunction[] = opener && semanticFunctions.includes(opener)
    ? [opener, ...semanticFunctions.filter((entry) => entry !== opener && entry !== "consequence"), "consequence"]
    : [...semanticFunctions];
  const byFunction = new Map(walk.beats.map((beat) => [beat.beatFunction, beat.id] as const));
  return orderedFunctions.map((beatFunction) => {
    const beatId = byFunction.get(beatFunction);
    if (!beatId) throw new Error(`Presentation form ${form} cannot find ${beatFunction} beat`);
    return beatId;
  });
}

function validateEpisodePresentation(episode: SeriesEpisodeReceipt): string[] {
  const findings: string[] = [];
  const semanticIds = episode.coldWalk.beats.map((beat) => beat.id).sort(compareCodepoints);
  const presentedIds = [...episode.presentationBeatIds].sort(compareCodepoints);
  if (JSON.stringify(semanticIds) !== JSON.stringify(presentedIds)) findings.push("presentation does not contain every semantic beat exactly once");
  const finalId = episode.presentationBeatIds[episode.presentationBeatIds.length - 1];
  const finalBeat = episode.coldWalk.beats.find((beat) => beat.id === finalId);
  if (finalBeat?.beatFunction !== "consequence") findings.push("presentation does not end on consequence");
  if (episode.presentationForm === "linear" && episode.presentationOpeningMode !== "full") findings.push("linear presentation must open in full mode");
  if (episode.presentationForm !== "linear" && episode.presentationOpeningMode !== "teaser") findings.push("nonlinear presentation must declare teaser opening");
  return findings;
}

function maximumIdenticalPresentationFormRun(episodes: readonly SeriesEpisodeReceipt[]): number {
  let maximum = 0;
  let current = 0;
  let prior: SeriesPresentationForm | null = null;
  for (const episode of episodes) {
    if (episode.presentationForm === prior) current++;
    else current = 1;
    prior = episode.presentationForm;
    maximum = Math.max(maximum, current);
  }
  return maximum;
}

function recentActorUse(episodes: readonly SeriesEpisodeReceipt[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const episode of episodes.slice(-3)) {
    for (const beat of episode.coldWalk.beats) {
      for (const actorId of beat.actorIds) counts[actorId] = (counts[actorId] ?? 0) + 1;
    }
  }
  return counts;
}

function episodeSkeletonSignature(episode: SeriesEpisodeReceipt): string {
  return walkSkeletonSignature(episode.coldWalk);
}

function maximumIdenticalSkeletonRun(episodes: readonly SeriesEpisodeReceipt[]): number {
  let maximum = 0;
  let current = 0;
  let prior: string | null = null;
  for (const episode of episodes) {
    const signature = episodeSkeletonSignature(episode);
    if (signature === prior) current++;
    else current = 1;
    prior = signature;
    maximum = Math.max(maximum, current);
  }
  return maximum;
}

function maximumConsecutiveFamily(episodes: readonly SeriesEpisodeReceipt[]): number {
  let maximum = 0;
  let current = 0;
  let prior: SeriesIncidentFamily | null = null;
  for (const episode of episodes) {
    if (episode.incident.family === prior) current++;
    else current = 1;
    prior = episode.incident.family;
    maximum = Math.max(maximum, current);
  }
  return maximum;
}

export function prepareNarrativeSeries(
  packet: NarrativeHandoffPacket,
  submittedIncidents: readonly SeriesIncident[] = [],
): PreparedNarrativeSeries {
  const preparedPacket = clone(packet);
  const incidents = compileSeriesIncidents(preparedPacket, submittedIncidents);
  if (incidents.length < 3) throw new Error("Series qualification requires at least three incident recipes");
  const runtimes = new Map<string, PreparedSeriesIncidentRuntime>(
    incidents.map((incident) => {
      const incidentPacket = compileIncidentHandoff(preparedPacket, incident);
      return [incident.id, { incident, prepared: prepareNarrativeColdRoom(incidentPacket) }];
    }),
  );
  return {
    packet: preparedPacket,
    incidents,
    runtimes,
    incidentPoolFingerprint: fingerprint(incidents),
  };
}

export function runNarrativeSeries(
  packet: NarrativeHandoffPacket,
  seed: number,
  episodeCount = 12,
): NarrativeSeriesReceipt {
  return runPreparedNarrativeSeries(prepareNarrativeSeries(packet), seed, episodeCount);
}

export function runPreparedNarrativeSeries(
  prepared: PreparedNarrativeSeries,
  seed: number,
  episodeCount = 12,
): NarrativeSeriesReceipt {
  if (!Number.isInteger(episodeCount) || episodeCount < 3) throw new Error("Series qualification requires at least three episodes");
  const { packet, incidents, runtimes, incidentPoolFingerprint } = prepared;
  const episodes: SeriesEpisodeReceipt[] = [];
  const obligations: SeriesObligation[] = [];
  const seenCount = new Map<string, number>();
  const lastUsed = new Map<string, number>();
  const seenFamilies = new Set<SeriesIncidentFamily>();
  let maximumOpenObligationCount = 0;

  for (let index = 0; index < episodeCount; index++) {
    const continuityMode = continuityModeForEpisode(obligations, seed, index, episodes);
    const openObligationCountBefore = obligations.filter((obligation) => obligation.status === "open").length;
    const selected = chooseIncidentWithPreview(
      incidents,
      runtimes,
      seed,
      index,
      episodes,
      obligations,
      seenCount,
      lastUsed,
      seenFamilies,
      continuityMode,
      episodeCount - index,
    );
    const walk = selected.walk;

    const addressed: string[] = [];
    const resolutionLimit = continuityMode === "collision" ? 2 : continuityMode === "advance" ? 1 : 0;
    const resolvable = obligations
      .filter(
        (obligation) =>
          obligation.status === "open" && selected.incident.addressesObligationKinds.includes(obligation.kind),
      )
      .sort((left, right) => left.openedEpisode - right.openedEpisode || compareCodepoints(left.id, right.id))
      .slice(0, resolutionLimit);
    for (const obligation of resolvable) {
      obligation.status = "resolved";
      obligation.resolvedEpisode = index;
      addressed.push(obligation.id);
    }
    const opened: SeriesObligation = {
      id: `series-obligation:${index}:${selected.incident.opensObligationKind}:${selected.incident.sourceObjectId}`,
      kind: selected.incident.opensObligationKind,
      sourceIncidentId: selected.incident.id,
      openedEpisode: index,
      pressure: selected.incident.severity + index,
      status: "open",
    };
    obligations.push(opened);
    const openObligationCountAfter = obligations.filter((obligation) => obligation.status === "open").length;
    maximumOpenObligationCount = Math.max(maximumOpenObligationCount, openObligationCountAfter);
    const presentationForm = choosePresentationForm(selected.incident, walk, seed, index, episodes);
    episodes.push({
      index,
      incident: { ...selected.incident, tags: [...selected.incident.tags] },
      incidentScore: selected.score,
      incidentSelectionRegret: selected.incidentSelectionRegret,
      addressedObligationIds: addressed.sort(compareCodepoints),
      openedObligationId: opened.id,
      continuityMode,
      openObligationCountBefore,
      openObligationCountAfter,
      selectionPoolIncidentIds: [...selected.selectionPoolIncidentIds],
      selectionKey: selected.selectionKey,
      walkVariant: selected.walkVariant,
      presentationForm,
      presentationOpeningMode: presentationForm === "linear" ? "full" : "teaser",
      presentationBeatIds: presentationBeatIds(walk, presentationForm),
      coldWalk: walk,
    });
    seenCount.set(selected.incident.id, (seenCount.get(selected.incident.id) ?? 0) + 1);
    lastUsed.set(selected.incident.id, index);
    seenFamilies.add(selected.incident.family);
  }

  const open = obligations.filter((obligation) => obligation.status === "open");
  const maximumObligationAge = Math.max(
    0,
    ...obligations.map((obligation) => (obligation.resolvedEpisode ?? episodeCount) - obligation.openedEpisode),
  );
  for (const obligation of open) obligation.status = "inherited";
  const actorCounts = new Map<string, number>();
  let actorAppearances = 0;
  for (const episode of episodes) {
    for (const beat of episode.coldWalk.beats) {
      for (const actorId of beat.actorIds) {
        actorCounts.set(actorId, (actorCounts.get(actorId) ?? 0) + 1);
        actorAppearances++;
      }
    }
  }
  const maximumActorSharePermille =
    actorAppearances === 0 ? 0 : Math.round((Math.max(0, ...actorCounts.values()) * 1000) / actorAppearances);
  const uniqueIncidentCount = new Set(episodes.map((episode) => episode.incident.id)).size;
  const uniqueSkeletonCount = new Set(episodes.map(episodeSkeletonSignature)).size;
  const semanticRailShapes = [...new Set(
    episodes.map((episode) => episode.coldWalk.beats.map((beat) => beat.beatFunction).join("->")),
  )].sort(compareCodepoints);
  const uniqueSemanticRailShapeCount = semanticRailShapes.length;
  const skeletonRun = maximumIdenticalSkeletonRun(episodes);
  const presentationFormCount = new Set(episodes.map((episode) => episode.presentationForm)).size;
  const presentationFormRun = maximumIdenticalPresentationFormRun(episodes);
  const presentationValidationFailureCount = episodes.filter((episode) => validateEpisodePresentation(episode).length > 0).length;
  const familyCount = new Set(episodes.map((episode) => episode.incident.family)).size;
  const repeatedAdjacentIncidentCount = episodes.filter(
    (episode, index) => index > 0 && episode.incident.id === episodes[index - 1]!.incident.id,
  ).length;
  const episodeFailureCount = episodes.filter((episode) => !episode.coldWalk.passed).length;
  const counterfactualCausalWidth = episodes.reduce(
    (sum, episode) => sum + episode.coldWalk.counterfactualCausalWidth,
    0,
  );
  const maximumFamilyRun = maximumConsecutiveFamily(episodes);
  const maximumIncidentSelectionRegret = Math.max(0, ...episodes.map((episode) => episode.incidentSelectionRegret));
  const maximumBeatSelectionRegret = Math.max(
    0,
    ...episodes.flatMap((episode) => episode.coldWalk.beats.map((beat) => beat.selectionRegret)),
  );
  const findings: string[] = [];
  if (episodeFailureCount > 0) findings.push(`${episodeFailureCount} episodes failed their cold-room rail`);
  if (repeatedAdjacentIncidentCount > 0) findings.push("an incident repeated in adjacent episodes");
  if (familyCount < 3) findings.push("the season did not exercise all incident families");
  if (uniqueSkeletonCount < Math.min(3, episodeCount)) findings.push(`season produced only ${uniqueSkeletonCount} cast-and-method skeletons`);
  if (uniqueSemanticRailShapeCount < Math.min(3, episodeCount)) findings.push(`season used only ${uniqueSemanticRailShapeCount} semantic rail shapes`);
  if (skeletonRun > 2) findings.push(`one cast-and-method skeleton repeated ${skeletonRun} episodes consecutively`);
  if (presentationFormCount < Math.min(3, episodeCount)) findings.push(`season used only ${presentationFormCount} presentation forms`);
  if (presentationFormRun > 2) findings.push(`one presentation form repeated ${presentationFormRun} episodes consecutively`);
  if (presentationValidationFailureCount > 0) findings.push(`${presentationValidationFailureCount} episode presentations lost or misordered semantic beats`);
  if (maximumFamilyRun > 2) findings.push(`one incident family ran ${maximumFamilyRun} episodes consecutively`);
  if (maximumActorSharePermille > 400) findings.push(`one actor owns ${maximumActorSharePermille} permille of appearances`);
  if (counterfactualCausalWidth > 0) findings.push(`${counterfactualCausalWidth} episode beats remain counterfactually loose`);
  if (maximumIncidentSelectionRegret > 450) findings.push(`incident plurality accepted ${maximumIncidentSelectionRegret} points of regret`);
  if (maximumBeatSelectionRegret > 500) findings.push(`beat plurality accepted ${maximumBeatSelectionRegret} points of regret`);
  const deferredEpisodeCount = episodes.filter((episode) => episode.continuityMode === "open-secondary").length;
  const collisionEpisodeCount = episodes.filter((episode) => episode.continuityMode === "collision").length;
  if (episodeCount >= 6 && deferredEpisodeCount === 0) findings.push("season never opened a secondary continuity thread");
  if (episodeCount >= 6 && collisionEpisodeCount === 0) findings.push("season never collided continuity threads");
  if (maximumOpenObligationCount < 2) findings.push("season never sustained overlapping obligations");
  if (maximumOpenObligationCount > 3) findings.push(`season accumulated ${maximumOpenObligationCount} simultaneous obligations`);
  if (open.length < 1 || open.length > 2) findings.push(`season leaves ${open.length} inherited obligations; expected one or two`);
  const staleOpen = open.filter((obligation) => episodeCount - obligation.openedEpisode > 4);
  if (staleOpen.length > 0) findings.push(`${staleOpen.length} inherited obligations remained stale`);
  if (maximumObligationAge > 6) findings.push(`an obligation remained unresolved for ${maximumObligationAge} episodes`);

  return {
    format: NARRATIVE_SERIES_FORMAT,
    sourceId: packet.source.id,
    seed,
    episodeCount,
    incidentPoolFingerprint,
    episodes,
    obligations,
    openObligationIds: obligations.filter((obligation) => obligation.status === "inherited").map((obligation) => obligation.id),
    uniqueIncidentCount,
    uniqueSkeletonCount,
    skeletonDiversityPermille: Math.round(
      (uniqueSkeletonCount * 1000) / Math.min(episodeCount, incidents.length),
    ),
    semanticRailShapes,
    uniqueSemanticRailShapeCount,
    maximumIdenticalSkeletonRun: skeletonRun,
    uniquePresentationFormCount: presentationFormCount,
    presentationFormCoveragePermille: Math.round((presentationFormCount * 1000) / 4),
    maximumIdenticalPresentationFormRun: presentationFormRun,
    presentationValidationFailureCount,
    incidentCoveragePermille: Math.round((uniqueIncidentCount * 1000) / Math.min(episodeCount, incidents.length)),
    familyCoveragePermille: Math.round((familyCount * 1000) / 3),
    maximumConsecutiveFamily: maximumFamilyRun,
    maximumActorSharePermille,
    repeatedAdjacentIncidentCount,
    episodeFailureCount,
    counterfactualCausalWidth,
    maximumOpenObligationCount,
    inheritedObligationCount: open.length,
    deferredEpisodeCount,
    collisionEpisodeCount,
    maximumObligationAge,
    maximumIncidentSelectionRegret,
    maximumBeatSelectionRegret,
    findings,
    passed: findings.length === 0,
  };
}
