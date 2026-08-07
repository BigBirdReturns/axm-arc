import { evaluateCandidateAgency } from "./agency.js";
import { assertValidNarrativeHandoffPacket } from "./source-validation.js";
import { compareCodepoints, fingerprint, hashSeed, shuffled, uniqueOrdered } from "./determinism.js";
import {
  NARRATIVE_COLD_WALK_FORMAT,
  type ActorMoveAgencyClaim,
  type BeatFunction,
  type CandidateAgencyReceipt,
  type ColdRoomProposal,
  type ColdWalkBeat,
  type ColdWalkFinding,
  type ColdWalkReceipt,
  type ColdWalkScoreBreakdown,
  type HandoffActor,
  type HandoffFactSeed,
  type NarrativeHandoffPacket,
  type NarrativeProposition,
} from "./model.js";

const CANONICAL_FUNCTION_ORDER: BeatFunction[] = ["establish", "pressure", "reveal", "escalate", "choose", "consequence"];

interface OpenObligation {
  id: string;
  kind: string;
  actorIds: string[];
  pressure: number;
  openedByBeatId: string;
}

interface PreparedProposal {
  proposal: ColdRoomProposal;
  agency: CandidateAgencyReceipt;
  staticFailures: ColdWalkFinding[];
  matchedAnchors: string[];
  sourceSeverity: number;
}

interface ProposalEvaluation {
  proposal: ColdRoomProposal;
  agency: CandidateAgencyReceipt;
  failures: ColdWalkFinding[];
  scoreBreakdown: ColdWalkScoreBreakdown;
  score: number;
}

export interface PreparedColdRoom {
  packet: NarrativeHandoffPacket;
  options: ColdRoomGenerationOptions;
  handoffFingerprint: string;
  proposalSetFingerprint: string;
  proposals: PreparedProposal[];
}

export interface ColdRoomGenerationOptions {
  includeAgencyClaims: boolean;
  includeStatePayments: boolean;
  closeObligations: boolean;
  includeIdentityTags: boolean;
  includeAdversarialDecoys: boolean;
}

export interface ColdWalkInitialContext {
  actorUse?: Record<string, number>;
  /** Bounded plurality among already-qualified proposals. Zero preserves canonical top-score selection. */
  selectionBand?: number;
  selectionSalt?: string;
}

export const COMPLETE_COLD_ROOM_OPTIONS: ColdRoomGenerationOptions = {
  includeAgencyClaims: true,
  includeStatePayments: true,
  closeObligations: true,
  includeIdentityTags: true,
  includeAdversarialDecoys: true,
};

function actorAccessesProposition(packet: NarrativeHandoffPacket, actorId: string, propositionId: string): boolean {
  return (
    packet.agency.commonKnowledgePropositionIds.includes(propositionId) ||
    packet.agency.beliefs.some(
      (belief) =>
        belief.actorId === actorId &&
        belief.propositionId === propositionId &&
        belief.stance !== "disbelieves" &&
        belief.confidence >= packet.agencyPolicy.minimumBeliefConfidence,
    )
  );
}

function availableProposition(
  packet: NarrativeHandoffPacket,
  actor: HandoffActor,
  seed: HandoffFactSeed,
): NarrativeProposition | undefined {
  const propositions = new Map(packet.agency.propositions.map((entry) => [entry.id, entry] as const));
  for (const propositionId of seed.propositionIds) {
    if (actorAccessesProposition(packet, actor.id, propositionId)) return propositions.get(propositionId);
  }
  const actorBelief = packet.agency.beliefs
    .filter((belief) => belief.actorId === actor.id && belief.stance !== "disbelieves")
    .sort(
      (left, right) =>
        right.confidence - left.confidence || compareCodepoints(left.propositionId, right.propositionId),
    )[0];
  return actorBelief ? propositions.get(actorBelief.propositionId) : undefined;
}

function actorScore(actor: HandoffActor, seed: HandoffFactSeed): number {
  const preference = seed.preferredResponsibilities.indexOf(actor.responsibility);
  if (preference < 0) return -1;
  const actorPreference = seed.preferredActorIds.indexOf(actor.id);
  return 1000 - preference * 100 + (actorPreference < 0 ? 0 : 500 - actorPreference * 50);
}

function rankedActors(packet: NarrativeHandoffPacket, seed: HandoffFactSeed): HandoffActor[] {
  return [...packet.actors]
    .map((actor) => ({ actor, score: actorScore(actor, seed) }))
    .filter((entry) => entry.score >= 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.actor.goalIds.length - right.actor.goalIds.length ||
        compareCodepoints(left.actor.id, right.actor.id),
    )
    .map((entry) => entry.actor);
}

function bindActors(packet: NarrativeHandoffPacket, seed: HandoffFactSeed, offset = 0): HandoffActor[] {
  return rankedActors(packet, seed).slice(offset, offset + seed.requiredActorCount);
}

function selectGoalId(packet: NarrativeHandoffPacket, actor: HandoffActor): string | undefined {
  return packet.agency.goals
    .filter((goal) => actor.goalIds.includes(goal.id) && (goal.status === "open" || goal.status === "inherited"))
    .sort((left, right) => right.priority - left.priority || compareCodepoints(left.id, right.id))[0]?.id;
}

function moveForGroup(actor: HandoffActor, group: BeatFunction): string {
  return actor.movePreferences[group] ?? actor.baselineMoves[0] ?? `act-as-${actor.responsibility}`;
}

function riskForGroup(group: BeatFunction): number {
  return {
    establish: 100,
    pressure: 220,
    reveal: 330,
    escalate: 500,
    choose: 720,
    consequence: 600,
    inherit: 300,
  }[group];
}

function buildAgencyClaim(
  packet: NarrativeHandoffPacket,
  actor: HandoffActor,
  seed: HandoffFactSeed,
  options: ColdRoomGenerationOptions,
): ActorMoveAgencyClaim {
  const goalId = selectGoalId(packet, actor);
  const proposition = availableProposition(packet, actor, seed);
  return {
    actorId: actor.id,
    moveTag: moveForGroup(actor, seed.group),
    intentionGoalIds: options.includeAgencyClaims && goalId ? [goalId] : [],
    knowledgePropositionIds: options.includeAgencyClaims && proposition ? [proposition.id] : [],
    expectedGoalEffects: options.includeAgencyClaims && goalId ? [{ goalId, delta: 200 + CANONICAL_FUNCTION_ORDER.indexOf(seed.group) * 50 }] : [],
    risk: options.includeAgencyClaims ? riskForGroup(seed.group) : null,
  };
}

function goodProposal(
  packet: NarrativeHandoffPacket,
  seed: HandoffFactSeed,
  options: ColdRoomGenerationOptions,
  variant: "primary" | "alternate" = "primary",
): ColdRoomProposal {
  const actors = bindActors(packet, seed, variant === "primary" ? 0 : 1);
  const target =
    seed.group === "consequence"
      ? packet.consequences[packet.consequences.length - 1]?.id ?? packet.source.id
      : seed.sourcePressureIds[0] ?? packet.source.id;
  const tags = options.includeIdentityTags
    ? uniqueOrdered([
        ...seed.tags,
        ...(seed.group === "consequence" ? packet.storyPhysicsTags : []),
        ...(seed.group === "consequence" ? packet.consequences.map((entry) => `consequence:${entry.kind}`) : []),
      ])
    : [`beat:${seed.group}`];
  return {
    id: `proposal:${packet.source.id}:${seed.group}:qualified-${variant}`,
    factSeedId: seed.id,
    beatFunction: seed.group,
    actorMoves: actors.map((actor) => buildAgencyClaim(packet, actor, seed, options)),
    tags,
    requiresStatePaymentKinds: [...seed.requiresStatePaymentKinds],
    statePayments: options.includeStatePayments
      ? [
          {
            kind: seed.statePaymentKind,
            target,
            tags: uniqueOrdered([...seed.tags, ...(seed.group === "consequence" ? ["payment:persistent-map-change"] : [])]),
          },
        ]
      : [],
    opensObligations: seed.opensObligationKind
      ? [
          {
            id: `obligation:${packet.source.id}:${seed.opensObligationKind}`,
            kind: seed.opensObligationKind,
            actorIds: actors.map((actor) => actor.id),
            pressure: seed.severity,
          },
        ]
      : [],
    resolvesObligationKinds: options.closeObligations ? [...seed.resolvesObligationKinds] : [],
    authoredPriority: 100,
  };
}

function adversarialProposals(packet: NarrativeHandoffPacket, seed: HandoffFactSeed): ColdRoomProposal[] {
  const firstActor = packet.actors[0];
  const wrongActor = packet.actors.find((actor) => !seed.preferredResponsibilities.includes(actor.responsibility)) ?? firstActor;
  if (!firstActor || !wrongActor) return [];
  const wrongMove = packet.prohibitedMoves[0] ?? "clean-reset";
  return [
    {
      id: `proposal:${packet.source.id}:${seed.group}:surface-clone`,
      factSeedId: seed.id,
      beatFunction: seed.group,
      actorMoves: [
        {
          actorId: firstActor.id,
          moveTag: firstActor.baselineMoves[0] ?? "react",
          intentionGoalIds: [],
          knowledgePropositionIds: [],
          expectedGoalEffects: [],
          risk: null,
        },
      ],
      tags: ["generic:dramatic", "tone:intense"],
      requiresStatePaymentKinds: [...seed.requiresStatePaymentKinds],
      statePayments: [],
      opensObligations: [],
      resolvesObligationKinds: [],
      authoredPriority: 10_000,
    },
    {
      id: `proposal:${packet.source.id}:${seed.group}:plot-puppet`,
      factSeedId: seed.id,
      beatFunction: seed.group,
      actorMoves: [
        {
          actorId: wrongActor.id,
          moveTag: wrongMove,
          intentionGoalIds: wrongActor.goalIds.slice(0, 1),
          knowledgePropositionIds: seed.propositionIds.slice(0, 1),
          expectedGoalEffects: wrongActor.goalIds[0] ? [{ goalId: wrongActor.goalIds[0], delta: 500 }] : [],
          risk: 0,
        },
      ],
      tags: uniqueOrdered([...seed.tags, "generic:surprise-twist"]),
      requiresStatePaymentKinds: [...seed.requiresStatePaymentKinds],
      statePayments: [
        { kind: seed.statePaymentKind, target: seed.sourcePressureIds[0] ?? packet.source.id, tags: [...seed.tags] },
      ],
      opensObligations: [],
      resolvesObligationKinds: [],
      authoredPriority: 9_000,
    },
  ];
}

function qualifiedProposals(
  packet: NarrativeHandoffPacket,
  seed: HandoffFactSeed,
  options: ColdRoomGenerationOptions,
): ColdRoomProposal[] {
  const primary = goodProposal(packet, seed, options, "primary");
  const ranked = rankedActors(packet, seed);
  if (ranked.length < seed.requiredActorCount + 1) return [primary];
  const alternate = goodProposal(packet, seed, options, "alternate");
  if (
    alternate.actorMoves.length !== seed.requiredActorCount ||
    alternate.actorMoves.map((move) => move.actorId).join("\u001f") ===
      primary.actorMoves.map((move) => move.actorId).join("\u001f")
  ) {
    return [primary];
  }
  return [primary, alternate];
}

export function generateBlindRoomProposals(
  packet: NarrativeHandoffPacket,
  options: ColdRoomGenerationOptions = COMPLETE_COLD_ROOM_OPTIONS,
): ColdRoomProposal[] {
  return packet.factSeeds.flatMap((seed) => [
    ...qualifiedProposals(packet, seed, options),
    ...(options.includeAdversarialDecoys ? adversarialProposals(packet, seed) : []),
  ]);
}

function identityMatches(packet: NarrativeHandoffPacket, proposal: ColdRoomProposal): string[] {
  const tags = new Set([
    ...proposal.tags,
    ...proposal.statePayments.flatMap((payment) => [`payment:${payment.kind}`, ...payment.tags]),
    ...proposal.actorMoves.map((move) => `move:${move.moveTag}`),
  ]);
  return packet.identityAnchors
    .filter((anchor) => anchor.anyOfTags.some((tag) => tags.has(tag)))
    .map((anchor) => anchor.id);
}

function prepareProposal(packet: NarrativeHandoffPacket, proposal: ColdRoomProposal): PreparedProposal {
  const failures: ColdWalkFinding[] = [];
  if (!packet.factSeeds.some((entry) => entry.id === proposal.factSeedId)) {
    failures.push({
      code: "missing-fact-seed",
      severity: "error",
      subjectId: proposal.id,
      detail: `proposal cites unknown fact seed ${proposal.factSeedId}`,
    });
  }
  const agency = evaluateCandidateAgency(proposal.id, proposal.actorMoves, packet.agency, packet.agencyPolicy);
  if (!agency.passed) {
    for (const entry of agency.failures) {
      failures.push({
        code: `agency:${entry.code}`,
        severity: "error",
        subjectId: proposal.id,
        detail: entry.detail,
      });
    }
  }

  const matchedAnchors = identityMatches(packet, proposal);
  for (const anchor of packet.identityAnchors.filter((entry) => entry.required)) {
    if (!matchedAnchors.includes(anchor.id)) {
      failures.push({
        code: "missing-required-identity-anchor",
        severity: "error",
        subjectId: proposal.id,
        detail: `proposal misses required identity anchor ${anchor.id}`,
      });
    }
  }
  if (matchedAnchors.length < packet.minimumIdentityAnchorMatches) {
    failures.push({
      code: "insufficient-identity-coverage",
      severity: "error",
      subjectId: proposal.id,
      detail: `proposal matches ${matchedAnchors.length} identity anchors; requires ${packet.minimumIdentityAnchorMatches}`,
    });
  }

  for (const move of proposal.actorMoves) {
    if (packet.prohibitedMoves.includes(move.moveTag)) {
      failures.push({
        code: "prohibited-move",
        severity: "error",
        subjectId: proposal.id,
        detail: `${move.actorId} uses prohibited move ${move.moveTag}`,
      });
    }
    const actor = packet.actors.find((entry) => entry.id === move.actorId);
    if (!actor) {
      failures.push({ code: "missing-actor", severity: "error", subjectId: proposal.id, detail: `missing actor ${move.actorId}` });
    } else if (!actor.baselineMoves.includes(move.moveTag)) {
      failures.push({
        code: "character-method-drift",
        severity: "error",
        subjectId: proposal.id,
        detail: `${actor.id} has no baseline path to ${move.moveTag}`,
      });
    }
  }

  if (proposal.statePayments.length === 0) {
    failures.push({
      code: "missing-state-payment",
      severity: "error",
      subjectId: proposal.id,
      detail: "authoritative proposal changes no persistent state",
    });
  }

  return {
    proposal,
    agency,
    staticFailures: failures,
    matchedAnchors,
    sourceSeverity: packet.factSeeds.find((entry) => entry.id === proposal.factSeedId)?.severity ?? 0,
  };
}

export function prepareNarrativeSubmissionRoom(
  packet: NarrativeHandoffPacket,
  submittedProposals: readonly ColdRoomProposal[],
  options: ColdRoomGenerationOptions = COMPLETE_COLD_ROOM_OPTIONS,
): PreparedColdRoom {
  assertValidNarrativeHandoffPacket(packet);
  const counts = new Map<string, number>();
  for (const proposal of submittedProposals) counts.set(proposal.id, (counts.get(proposal.id) ?? 0) + 1);
  const duplicates = new Set([...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id));
  const proposals = submittedProposals
    .map((proposal) => {
      const prepared = prepareProposal(packet, proposal);
      if (duplicates.has(proposal.id)) {
        prepared.staticFailures.push({
          code: "duplicate-proposal-id",
          severity: "error",
          subjectId: proposal.id,
          detail: `proposal id ${proposal.id} appears more than once`,
        });
      }
      return prepared;
    })
    .sort((left, right) => compareCodepoints(left.proposal.id, right.proposal.id));
  return {
    packet,
    options: { ...options },
    handoffFingerprint: packet.handoffFingerprint,
    proposalSetFingerprint: fingerprint(submittedProposals),
    proposals,
  };
}

export function prepareNarrativeColdRoom(
  packet: NarrativeHandoffPacket,
  options: ColdRoomGenerationOptions = COMPLETE_COLD_ROOM_OPTIONS,
): PreparedColdRoom {
  return prepareNarrativeSubmissionRoom(packet, generateBlindRoomProposals(packet, options), options);
}

function evaluateProposal(
  packet: NarrativeHandoffPacket,
  prepared: PreparedProposal,
  currentFunction: BeatFunction | null,
  usedFunctions: ReadonlySet<BeatFunction>,
  paymentProviders: ReadonlyMap<string, string>,
  openObligations: readonly OpenObligation[],
  actorUse: ReadonlyMap<string, number>,
): ProposalEvaluation {
  const { proposal, agency, matchedAnchors } = prepared;
  const failures: ColdWalkFinding[] = [...prepared.staticFailures];

  const allowed = packet.rail.transitions[currentFunction ?? "start"] ?? [];
  if (!allowed.includes(proposal.beatFunction)) {
    failures.push({
      code: "rail-transition",
      severity: "error",
      subjectId: proposal.id,
      detail: `${currentFunction ?? "start"} cannot advance to ${proposal.beatFunction}`,
    });
  }
  const missingPrerequisites = (packet.rail.prerequisites[proposal.beatFunction] ?? []).filter(
    (entry) => !usedFunctions.has(entry),
  );
  if (missingPrerequisites.length > 0) {
    failures.push({
      code: "missing-prerequisite-beat",
      severity: "error",
      subjectId: proposal.id,
      detail: `${proposal.beatFunction} is missing ${missingPrerequisites.join(", ")}`,
    });
  }

  const missingPayments = proposal.requiresStatePaymentKinds.filter((kind) => !paymentProviders.has(kind));
  if (missingPayments.length > 0) {
    failures.push({
      code: "missing-semantic-precondition",
      severity: "error",
      subjectId: proposal.id,
      detail: `${proposal.beatFunction} requires state payments ${missingPayments.join(", ")}`,
    });
  }

  const resolvableKinds = new Set(openObligations.map((entry) => entry.kind));
  for (const kind of proposal.resolvesObligationKinds) {
    if (!resolvableKinds.has(kind)) {
      failures.push({
        code: "missing-obligation",
        severity: "error",
        subjectId: proposal.id,
        detail: `proposal attempts to resolve absent ${kind} obligation`,
      });
    }
  }

  const actorDiversity = proposal.actorMoves.reduce((sum, move) => sum + Math.max(0, 4 - (actorUse.get(move.actorId) ?? 0)), 0);
  const openPressure = openObligations
    .filter((entry) => proposal.resolvesObligationKinds.includes(entry.kind))
    .reduce((sum, entry) => sum + entry.pressure, 0);
  const seedDefinition = packet.factSeeds.find((entry) => entry.id === proposal.factSeedId);
  const responsibilityFitRaw = proposal.actorMoves.reduce((sum, move) => {
    const actor = packet.actors.find((entry) => entry.id === move.actorId);
    if (!actor || !seedDefinition) return sum;
    const index = seedDefinition.preferredResponsibilities.indexOf(actor.responsibility);
    return sum + (index < 0 ? 0 : Math.max(0, 300 - index * 100));
  }, 0);
  const localCastFitRaw = proposal.actorMoves.reduce(
    (sum, move) => sum + (seedDefinition?.preferredActorIds.includes(move.actorId) ? 250 : 0),
    0,
  );
  const intentionStrengthRaw = proposal.actorMoves.reduce(
    (sum, move) =>
      sum +
      move.intentionGoalIds.reduce(
        (goalSum, goalId) => goalSum + (packet.agency.goals.find((goal) => goal.id === goalId)?.priority ?? 0),
        0,
      ),
    0,
  );
  const scoreBreakdown: ColdWalkScoreBreakdown = {
    authoredPriority: proposal.authoredPriority,
    sourceSeverity: prepared.sourceSeverity * 10,
    identityCoverage: matchedAnchors.length * 500,
    obligationPressure: openPressure * 20,
    actorDiversity: actorDiversity * 40,
    responsibilityFit: responsibilityFitRaw,
    localCastFit: localCastFitRaw,
    intentionStrength: Math.floor(intentionStrengthRaw / 5),
    total: 0,
  };
  scoreBreakdown.total =
    scoreBreakdown.authoredPriority +
    scoreBreakdown.sourceSeverity +
    scoreBreakdown.identityCoverage +
    scoreBreakdown.obligationPressure +
    scoreBreakdown.actorDiversity +
    scoreBreakdown.responsibilityFit +
    scoreBreakdown.localCastFit +
    scoreBreakdown.intentionStrength;

  return { proposal, agency, failures, scoreBreakdown, score: scoreBreakdown.total };
}

function auditWalk(packet: NarrativeHandoffPacket, beats: readonly ColdWalkBeat[], openObligations: readonly OpenObligation[]): ColdWalkFinding[] {
  const findings: ColdWalkFinding[] = [];
  const children = new Map<string, number>();
  for (const beat of beats) {
    for (const parentId of beat.causalParentBeatIds) children.set(parentId, (children.get(parentId) ?? 0) + 1);
  }
  for (const beat of beats.slice(0, -1)) {
    if ((children.get(beat.id) ?? 0) === 0 && beat.openedObligationIds.length === 0) {
      findings.push({ code: "loose-beat", severity: "error", subjectId: beat.id, detail: "beat has no child or open obligation" });
    }
  }
  for (const obligation of openObligations) {
    findings.push({
      code: "open-obligation",
      severity: "error",
      subjectId: obligation.id,
      detail: `${obligation.kind} remains open after terminal consequence`,
    });
  }
  const functions = new Set(beats.map((beat) => beat.beatFunction));
  for (const required of packet.rail.functionOrder) {
    if (!functions.has(required)) {
      findings.push({ code: "missing-beat-function", severity: "error", subjectId: required, detail: `${required} was not committed` });
    }
  }
  const physics = new Set(beats.flatMap((beat) => beat.tags).filter((tag) => tag.startsWith("physics:")));
  for (const tag of packet.storyPhysicsTags) {
    if (!physics.has(tag)) {
      findings.push({ code: "missing-story-physics", severity: "error", subjectId: tag, detail: `${tag} was not represented` });
    }
  }
  const choose = beats.find((beat) => beat.beatFunction === "choose");
  if (!choose || choose.actorIds.length < 2) {
    findings.push({
      code: "choice-lacks-incompatible-actors",
      severity: "error",
      subjectId: choose?.id ?? "choose",
      detail: "control decision does not bind at least two actors",
    });
  }
  return findings;
}

function counterfactuallyLooseBeats(beats: readonly ColdWalkBeat[]): string[] {
  const loose: string[] = [];
  for (let removedIndex = 0; removedIndex < beats.length - 1; removedIndex++) {
    const removed = beats[removedIndex]!;
    const providers = new Map<string, string>();
    let downstreamBroken = false;
    for (let index = 0; index < beats.length; index++) {
      if (index === removedIndex) continue;
      const beat = beats[index]!;
      if (beat.requiredStatePaymentKinds.some((kind) => !providers.has(kind))) {
        if (index > removedIndex) downstreamBroken = true;
        break;
      }
      for (const payment of beat.statePayments) providers.set(payment.kind, beat.id);
    }
    const obligationUsed = beats
      .slice(removedIndex + 1)
      .some((beat) => beat.resolvedObligationIds.some((id) => removed.openedObligationIds.includes(id)));
    if (!downstreamBroken && !obligationUsed) loose.push(removed.id);
  }
  return loose;
}

export function runNarrativeColdWalk(
  packet: NarrativeHandoffPacket,
  seed: number,
  options: ColdRoomGenerationOptions = COMPLETE_COLD_ROOM_OPTIONS,
): ColdWalkReceipt {
  return runPreparedNarrativeColdWalk(prepareNarrativeColdRoom(packet, options), seed);
}

export function runPreparedNarrativeColdWalk(
  preparedRoom: PreparedColdRoom,
  seed: number,
  initialContext: ColdWalkInitialContext = {},
): ColdWalkReceipt {
  const { packet, proposals, handoffFingerprint, proposalSetFingerprint } = preparedRoom;
  const arrivalOrder = shuffled(packet.factSeeds.map((entry) => entry.id), seed);
  const arrived = new Set<string>();
  const committedProposalIds = new Set<string>();
  const rejectedProposalIds = new Set<string>();
  const rejectionCodes = new Map<string, Set<string>>();
  const usedFunctions = new Set<BeatFunction>();
  const openObligations: OpenObligation[] = [];
  const paymentProviders = new Map<string, string>();
  const actorUse = new Map<string, number>(
    Object.entries(initialContext.actorUse ?? {}).filter(([, value]) => Number.isInteger(value) && value >= 0),
  );
  const beats: ColdWalkBeat[] = [];
  const transientFindings: ColdWalkFinding[] = [];
  let currentFunction: BeatFunction | null = null;
  let cycle = 0;
  const maximumCycles = packet.factSeeds.length * 4 + 8;

  while (beats.length < packet.factSeeds.length && cycle < maximumCycles) {
    if (cycle < arrivalOrder.length) arrived.add(arrivalOrder[cycle]!);
    const evaluations = proposals
      .filter((entry) => arrived.has(entry.proposal.factSeedId) && !committedProposalIds.has(entry.proposal.id))
      .filter((entry) => !usedFunctions.has(entry.proposal.beatFunction))
      .map((entry) =>
        evaluateProposal(packet, entry, currentFunction, usedFunctions, paymentProviders, openObligations, actorUse),
      );

    for (const evaluation of evaluations) {
      if (evaluation.failures.length === 0) continue;
      rejectedProposalIds.add(evaluation.proposal.id);
      const codes = rejectionCodes.get(evaluation.proposal.id) ?? new Set<string>();
      for (const finding of evaluation.failures) codes.add(finding.code);
      rejectionCodes.set(evaluation.proposal.id, codes);
    }
    const eligible = evaluations
      .filter((evaluation) => evaluation.failures.length === 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          packet.rail.functionOrder.indexOf(left.proposal.beatFunction) -
            packet.rail.functionOrder.indexOf(right.proposal.beatFunction) ||
          compareCodepoints(left.proposal.id, right.proposal.id),
      );

    const topScore = eligible[0]?.score;
    const requestedBand = initialContext.selectionBand ?? 0;
    const selectionBand = Number.isInteger(requestedBand) && requestedBand > 0 ? requestedBand : 0;
    const selectionPool = topScore === undefined
      ? []
      : eligible.filter((entry) => entry.score >= topScore - selectionBand);
    const keyedSelectionPool = selectionPool
      .map((entry) => ({
        entry,
        key: hashSeed(
          "cold-room-qualified-plurality",
          seed,
          cycle,
          currentFunction ?? "start",
          initialContext.selectionSalt ?? "",
          entry.proposal.id,
        ),
      }))
      .sort((left, right) => left.key - right.key || compareCodepoints(left.entry.proposal.id, right.entry.proposal.id));
    const selectedRecord = keyedSelectionPool[0];
    const selected = selectedRecord?.entry;
    if (!selected || !selectedRecord) {
      cycle++;
      continue;
    }

    const proposal = selected.proposal;
    const beatId = `beat:${beats.length}:${proposal.id}`;
    const resolved: string[] = [];
    const resolvedOpeningBeatIds: string[] = [];
    for (let index = openObligations.length - 1; index >= 0; index--) {
      const obligation = openObligations[index]!;
      if (proposal.resolvesObligationKinds.includes(obligation.kind)) {
        resolved.push(obligation.id);
        resolvedOpeningBeatIds.push(obligation.openedByBeatId);
        openObligations.splice(index, 1);
      }
    }
    const opened = proposal.opensObligations.map((entry) => ({
      ...entry,
      openedByBeatId: beatId,
    }));
    openObligations.push(...opened);
    const actorIds = uniqueOrdered(proposal.actorMoves.map((move) => move.actorId));
    for (const actorId of actorIds) actorUse.set(actorId, (actorUse.get(actorId) ?? 0) + 1);
    const causalParentBeatIds = uniqueOrdered([
      ...proposal.requiresStatePaymentKinds
        .map((kind) => paymentProviders.get(kind))
        .filter((value): value is string => value !== undefined),
      ...resolvedOpeningBeatIds,
    ]);
    beats.push({
      id: beatId,
      cycle,
      proposalId: proposal.id,
      factSeedId: proposal.factSeedId,
      beatFunction: proposal.beatFunction,
      actorIds,
      moveTags: uniqueOrdered(proposal.actorMoves.map((move) => move.moveTag)),
      tags: uniqueOrdered(proposal.tags),
      requiredStatePaymentKinds: uniqueOrdered(proposal.requiresStatePaymentKinds),
      statePayments: proposal.statePayments.map((payment) => ({ ...payment, tags: uniqueOrdered(payment.tags) })),
      causalParentBeatIds,
      openedObligationIds: opened.map((entry) => entry.id),
      resolvedObligationIds: uniqueOrdered(resolved),
      agencyReceipt: selected.agency,
      eligibleProposalIds: eligible.map((entry) => entry.proposal.id),
      selectionPoolProposalIds: keyedSelectionPool.map((entry) => entry.entry.proposal.id),
      selectionKey: selectedRecord.key,
      selectionRegret: Math.max(0, (eligible[0]?.score ?? selected.score) - selected.score),
      scoreBreakdown: { ...selected.scoreBreakdown },
      score: selected.score,
    });
    for (const payment of proposal.statePayments) paymentProviders.set(payment.kind, beatId);
    currentFunction = proposal.beatFunction;
    usedFunctions.add(proposal.beatFunction);
    committedProposalIds.add(proposal.id);
    cycle++;
  }

  const auditFindings = auditWalk(packet, beats, openObligations);
  const counterfactuallyLooseBeatIds = counterfactuallyLooseBeats(beats);
  const counterfactualFindings: ColdWalkFinding[] = counterfactuallyLooseBeatIds.map((beatId) => ({
    code: "counterfactually-loose-beat",
    severity: "error",
    subjectId: beatId,
    detail: "removing this beat leaves all later semantic preconditions and obligation closures executable",
  }));
  const findings = [...transientFindings, ...auditFindings, ...counterfactualFindings].sort(
    (left, right) =>
      compareCodepoints(left.severity, right.severity) ||
      compareCodepoints(left.code, right.code) ||
      compareCodepoints(left.subjectId, right.subjectId),
  );
  const actorCounts = new Map<string, number>();
  for (const beat of beats) for (const actorId of beat.actorIds) actorCounts.set(actorId, (actorCounts.get(actorId) ?? 0) + 1);
  const maximumActorSharePermille = beats.length === 0
    ? 0
    : Math.max(0, ...actorCounts.values()) * 1000 / beats.length;
  const identityAnchorsCovered = new Set(beats.flatMap((beat) => identityMatches(packet, {
    id: beat.proposalId,
    factSeedId: beat.factSeedId,
    beatFunction: beat.beatFunction,
    actorMoves: beat.agencyReceipt.moves,
    tags: beat.tags,
    requiresStatePaymentKinds: beat.requiredStatePaymentKinds,
    statePayments: beat.statePayments,
    opensObligations: [],
    resolvesObligationKinds: [],
    authoredPriority: 0,
  })));
  const physicsCovered = new Set(beats.flatMap((beat) => beat.tags).filter((tag) => packet.storyPhysicsTags.includes(tag)));
  const structuralCausalWidth = beats.slice(0, -1).filter((beat) => !beats.some((child) => child.causalParentBeatIds.includes(beat.id))).length;
  const maximumSelectionRegret = Math.max(0, ...beats.map((beat) => beat.selectionRegret));
  if (maximumSelectionRegret > 500) {
    findings.push({
      code: "selection-regret-exceeded",
      severity: "error",
      subjectId: packet.source.id,
      detail: `qualified plurality accepted ${maximumSelectionRegret} points of score regret`,
    });
  }

  return {
    format: NARRATIVE_COLD_WALK_FORMAT,
    sourceId: packet.source.id,
    seed,
    handoffFingerprint,
    proposalSetFingerprint,
    activeIncidentId: packet.activeIncident?.id,
    activePitchId: packet.activeIncident?.pitchId,
    arrivalOrder,
    beats,
    proposalRejections: [...rejectionCodes.entries()]
      .map(([proposalId, codes]) => ({ proposalId, codes: [...codes].sort(compareCodepoints) }))
      .sort((left, right) => compareCodepoints(left.proposalId, right.proposalId)),
    openObligationIds: openObligations.map((entry) => entry.id).sort(compareCodepoints),
    identityCoveragePermille: Math.round(identityAnchorsCovered.size * 1000 / packet.identityAnchors.length),
    distinctActorCount: actorCounts.size,
    maximumActorSharePermille: Math.round(maximumActorSharePermille),
    structuralCausalWidth,
    counterfactualCausalWidth: counterfactuallyLooseBeatIds.length,
    counterfactuallyLooseBeatIds,
    maximumSelectionRegret,
    storyPhysicsCoveragePermille: Math.round(physicsCovered.size * 1000 / Math.max(1, packet.storyPhysicsTags.length)),
    findings,
    passed: findings.every((entry) => entry.severity !== "error") && beats.length === packet.factSeeds.length,
  };
}
