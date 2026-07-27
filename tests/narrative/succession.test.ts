import { describe, expect, it } from "vitest";
import {
  compileIncidentHandoff,
  compileNarrativeHandoff,
  compileNarrativePitch,
  compileNarrativeWriterRoomPacket,
  evaluateCandidateAgency,
  prepareNarrativeColdRoom,
  prepareNarrativeSeries,
  runPreparedNarrativeColdWalk,
  runPreparedNarrativeSeries,
  validateContinuingUniverseSource,
  validateNarrativeHandoffPacket,
  type ContinuingUniverseSource,
  type NarrativeHandoffPacket,
  type NarrativeMechanismPitch,
} from "../../src/narrative/succession/index.js";
import { ILYON_SOURCE, LAMP_DISTRICT_SOURCE } from "./succession/fixtures.js";
import qualification from "./succession/qualification-receipts.json" with { type: "json" };

const sources: ContinuingUniverseSource[] = [ILYON_SOURCE, LAMP_DISTRICT_SOURCE];
function compilePackets(): Map<string, NarrativeHandoffPacket> {
  return new Map(sources.map((source) => [source.identity.id, compileNarrativeHandoff(source)] as const));
}

describe("deterministic narrative succession authority", () => {
  it("compiles exact plot-excluded handoff packets from finite constitutional sources", () => {
    for (const source of sources) {
      expect(validateContinuingUniverseSource(source)).toEqual([]);
      const packet = compileNarrativeHandoff(source);
      expect(packet.referencePlotExcluded).toBe(true);
      expect(validateNarrativeHandoffPacket(packet)).toEqual([]);
      const build = qualification.handoffBuild.packets.find((entry) => entry.sourceId === source.identity.id);
      expect(build?.handoffFingerprint).toBe(packet.handoffFingerprint);
      expect(build?.forbiddenPlotTokenHits).toEqual([]);
    }
  });

  it("rejects surface imitation, stale custody, and broken semantic references before ranking", () => {
    const packet = compileNarrativeHandoff(ILYON_SOURCE);
    const walk = runPreparedNarrativeColdWalk(prepareNarrativeColdRoom(packet), 17);
    const surfaceClone = walk.proposalRejections.find((entry) => entry.proposalId.includes("surface-clone"));
    expect(walk.passed).toBe(true);
    expect(walk.counterfactualCausalWidth).toBe(0);
    expect(surfaceClone?.codes).toContain("missing-required-identity-anchor");
    expect(surfaceClone?.codes).toContain("agency:missing-intention");
    expect(surfaceClone?.codes).toContain("missing-state-payment");

    const fingerprintTamper = structuredClone(packet);
    fingerprintTamper.handoffFingerprint = "fnv1a32:00000000";
    expect(validateNarrativeHandoffPacket(fingerprintTamper).map((entry) => entry.code)).toContain("handoff-fingerprint-mismatch");

    const sourceTamper = structuredClone(packet);
    sourceTamper.factSeeds[0]!.sourcePressureIds = ["pressure:missing"];
    sourceTamper.handoffFingerprint = packet.handoffFingerprint;
    expect(validateNarrativeHandoffPacket(sourceTamper).map((entry) => entry.code)).toContain("missing-source-pressure-reference");

    expect(qualification.mutationMatrix.caseCount).toBe(31);
    expect(qualification.mutationMatrix.detectedCount).toBe(31);
    expect(qualification.mutationMatrix.results.every((entry) => entry.rejected && entry.expectedDetected)).toBe(true);
  });

  it("uses incident-family micro-rails and produces deterministic plurality without causal width", () => {
    for (const packet of compilePackets().values()) {
      const representative = runPreparedNarrativeSeries(prepareNarrativeSeries(packet), 4421, 12);
      expect(representative.passed).toBe(true);
      expect(representative.semanticRailShapes).toEqual([
        "establish->pressure->choose->consequence",
        "establish->pressure->escalate->choose->consequence",
        "establish->reveal->pressure->choose->consequence",
      ]);
      expect(representative.familyCoveragePermille).toBe(1000);
      expect(representative.counterfactualCausalWidth).toBe(0);
      expect(representative.inheritedObligationCount >= 1).toBe(true);
      expect(representative.inheritedObligationCount <= 2).toBe(true);

      const incidentSequences = new Set<string>();
      const skeletonSequences = new Set<string>();
      for (let seed = 0; seed < 128; seed++) {
        const season = runPreparedNarrativeSeries(prepareNarrativeSeries(packet), seed, 12);
        expect(season.passed).toBe(true);
        incidentSequences.add(season.episodes.map((episode) => episode.incident.id).join("|"));
        skeletonSequences.add(
          season.episodes
            .map((episode) =>
              episode.coldWalk.beats
                .map((beat) => `${beat.beatFunction}:${beat.actorIds.join("+")}:${beat.moveTags.join("+")}`)
                .join("|"),
            )
            .join("||"),
        );
      }
      expect(incidentSequences.size).toBe(128);
      expect(skeletonSequences.size).toBe(128);
    }
  });

  it("qualifies six unseen successor mechanisms and refuses cross-universe transplantation", () => {
    const packets = compilePackets();
    const compiledIncidents = new Map<string, ReturnType<typeof compileNarrativePitch>["incident"][]>();
    for (const entry of qualification.successorPitchSet.pitches) {
      const packet = packets.get(entry.sourceId)!;
      const pitch = entry.pitch as NarrativeMechanismPitch;
      const compiled = compileNarrativePitch(packet, pitch);
      expect(compiled.passed).toBe(true);
      expect(compiled.incident === null).toBe(false);
      const incident = compiled.incident!;
      const episode = runPreparedNarrativeColdWalk(
        prepareNarrativeColdRoom(compileIncidentHandoff(packet, incident)),
        7100 + compiledIncidents.size,
        { selectionBand: 350, selectionSalt: pitch.id },
      );
      expect(episode.passed).toBe(true);
      expect(episode.counterfactualCausalWidth).toBe(0);
      expect(episode.beats.every((beat) => beat.tags.includes(`pitch:${pitch.id}`))).toBe(true);
      const list = compiledIncidents.get(entry.sourceId) ?? [];
      list.push(incident);
      compiledIncidents.set(entry.sourceId, list);
    }

    expect(qualification.successorTrial.format).toBe("axm-narrative-successor-room-trial/2");
    expect(qualification.successorTrial.pitchCount).toBe(6);
    expect(qualification.successorTrial.seasonRuns.every((run) => run.seeds === 1000)).toBe(true);
    expect(qualification.successorTrial.seasonRuns.every((run) => run.failed === 0)).toBe(true);
    expect(qualification.successorTrial.seasonRuns.every((run) => run.distinctIncidentSequences === 1000)).toBe(true);
    expect(qualification.successorTrial.seasonRuns.every((run) => run.everySuccessorPitchSelected)).toBe(true);
    expect(qualification.successorTrial.seasonRuns.every((run) => run.minimumFamilyCoveragePermille === 1000)).toBe(true);
    expect(qualification.successorTrial.seasonRuns.every((run) => run.maximumCounterfactualCausalWidth === 0)).toBe(true);

    const ilyonPitch = qualification.successorPitchSet.pitches.find((entry) => entry.sourceId === "kind-gods-of-ilyon")!.pitch as NarrativeMechanismPitch;
    const transplanted = compileNarrativePitch(packets.get("lamp-district")!, { ...ilyonPitch, id: `${ilyonPitch.id}-transplant` });
    expect(transplanted.passed).toBe(false);
    expect(transplanted.issues.some((entry) => entry.code === "unknown-source-reference")).toBe(true);
  });

  it("lets a sincere false belief motivate action while refusing unavailable author knowledge", () => {
    const packet = compileNarrativeHandoff(ILYON_SOURCE);
    const actor = packet.actors[0]!;
    const goal = packet.agency.goals.find((entry) => entry.actorId === actor.id)!;
    const proposition = packet.agency.propositions[0]!;
    const estate = structuredClone(packet.agency);
    estate.propositions = estate.propositions.map((entry) => entry.id === proposition.id ? { ...entry, truth: "false" as const } : entry);
    estate.commonKnowledgePropositionIds = estate.commonKnowledgePropositionIds.filter((id) => id !== proposition.id);
    estate.beliefs = estate.beliefs.filter((entry) => !(entry.actorId === actor.id && entry.propositionId === proposition.id));
    estate.beliefs.push({
      actorId: actor.id,
      propositionId: proposition.id,
      stance: "believes",
      confidence: 800,
      acquiredCycle: 1,
      sourceReceiptRef: "receipt:false-but-sincere",
    });
    const valid = evaluateCandidateAgency("candidate:false-belief", [{
      actorId: actor.id,
      moveTag: actor.baselineMoves[0]!,
      intentionGoalIds: [goal.id],
      knowledgePropositionIds: [proposition.id],
      expectedGoalEffects: [{ goalId: goal.id, delta: 200 }],
      risk: 200,
    }], estate, packet.agencyPolicy);
    expect(valid.passed).toBe(true);
    expect(valid.moves[0]?.falseBeliefPropositionIds).toEqual([proposition.id]);

    const unavailableEstate = structuredClone(estate);
    unavailableEstate.propositions.push({
      id: "proposition:author-only",
      tags: ["author-only"],
      truth: "true",
      sourceReceiptRefs: ["receipt:author-only"],
    });
    unavailableEstate.commonKnowledgePropositionIds = unavailableEstate.commonKnowledgePropositionIds.filter(
      (id) => id !== "proposition:author-only",
    );
    unavailableEstate.beliefs = unavailableEstate.beliefs.filter(
      (entry) => !(entry.actorId === actor.id && entry.propositionId === "proposition:author-only"),
    );
    const unavailable = evaluateCandidateAgency("candidate:omniscient", [{
      actorId: actor.id,
      moveTag: actor.baselineMoves[0]!,
      intentionGoalIds: [goal.id],
      knowledgePropositionIds: ["proposition:author-only"],
      expectedGoalEffects: [{ goalId: goal.id, delta: 200 }],
      risk: 200,
    }], unavailableEstate, packet.agencyPolicy);
    expect(unavailable.passed).toBe(false);
    expect(unavailable.failures.map((entry) => entry.code)).toContain("actor-lacks-proposition");
  });

  it("compiles qualified seasons into usable writer-room briefs without reopening authority", () => {
    const packets = compilePackets();
    for (const [sourceId, packet] of packets) {
      const extraIncidents = qualification.successorPitchSet.pitches
        .filter((entry) => entry.sourceId === sourceId)
        .map((entry) => compileNarrativePitch(packet, entry.pitch as NarrativeMechanismPitch).incident!)
        .filter(Boolean);
      const season = runPreparedNarrativeSeries(prepareNarrativeSeries(packet, extraIncidents), 4421, 12);
      const room = compileNarrativeWriterRoomPacket(packet, season);
      expect(room.episodeCount).toBe(12);
      expect(room.exceptionQueue).toEqual([]);
      expect(room.episodes.every((episode) => episode.beats.at(-1)?.function === "consequence")).toBe(true);
      expect(room.episodes.every((episode) => episode.persistentChanges.length > 0)).toBe(true);
      expect(room.episodes.every((episode) => episode.beats.every((beat) => beat.actorMoves.every((move) => move.intentionGoalIds.length > 0)))).toBe(true);
    }
    expect(qualification.writerRoomBuild.rooms.every((room) => room.episodeCount === 12 && room.exceptionQueueCount === 0)).toBe(true);
    expect(qualification.writerRoomBuild.rooms.every((room) => room.distinctFamilies.length === 3)).toBe(true);
    expect(qualification.writerRoomBuild.rooms.every((room) => room.distinctPresentationForms.length === 4)).toBe(true);
  });

  it("records a physical six-module cold room with no source or fixture leakage", () => {
    const isolated = qualification.isolatedBlindRoom;
    expect(isolated.format).toBe("axm-narrative-isolated-blind-room-report/2");
    expect(isolated.sourceOrFixtureFilesPresent).toBe(false);
    expect(isolated.sourceSpecificTokenHits).toEqual([]);
    expect(isolated.runtimeFiles).toEqual([
      "agency.js",
      "cold-room.js",
      "determinism.js",
      "model.js",
      "series.js",
      "source-validation.js",
    ]);
    expect(isolated.matrixSeedsPerSource).toBe(1000);
    expect(isolated.longHorizonSeedsPerSource).toBe(256);
    expect(isolated.longHorizonEpisodes).toBe(50);
    expect(isolated.runs.every((run) => run.founding.passed && run.representativeSeries.passed)).toBe(true);
    expect(isolated.runs.every((run) => run.matrix.failed === 0 && run.matrix.distinctIncidentSequences === 1000 && run.matrix.distinctSkeletonSequences === 1000)).toBe(true);
    expect(isolated.runs.every((run) => run.longHorizon.failed === 0 && run.longHorizon.distinctIncidentSequences === 256)).toBe(true);
    expect(isolated.passed).toBe(true);
  });

  it("separates the human review surface from its evaluator key and does not overclaim audience quality", () => {
    const packet = qualification.humanReviewPacket;
    const key = qualification.humanReviewAnswerKey;
    expect(packet.format).toBe("axm-narrative-human-review-packet/1");
    expect(key.format).toBe("axm-narrative-human-review-answer-key/1");
    expect(packet.stories).toHaveLength(6);
    expect(key.entries).toHaveLength(6);
    const reviewerText = JSON.stringify(packet);
    expect(key.entries.every((entry) => !reviewerText.includes(entry.pitchId))).toBe(true);
    expect(key.entries.every((entry) => !reviewerText.includes(entry.pitchTitle))).toBe(true);
    expect(reviewerText.includes("sourceRefs")).toBe(false);
    expect(reviewerText.includes("compilationPassed")).toBe(false);
    expect(reviewerText.includes("counterfactualCausalWidth")).toBe(false);
    expect(packet.stories.every((story) => story.semanticOutline.at(-1)?.function === "consequence")).toBe(true);
    expect(qualification.humanReviewBuild.passed).toBe(true);
  });
});
