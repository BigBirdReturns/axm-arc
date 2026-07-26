import { compareCodepoints, orderedStrings } from "../engine/determinism.js";
import { validateNarrativeConstitution } from "./validate.js";
import {
  narrativeCandidateSetFingerprint,
  narrativeConstitutionFingerprint,
  narrativeStateFingerprint,
} from "./fingerprint.js";
import type {
  NarrativeActorMove,
  NarrativeActorPolicy,
  NarrativeCandidate,
  NarrativeCandidateRejection,
  NarrativeCandidateScore,
  NarrativeConstitution,
  NarrativeFact,
  NarrativeObligation,
  NarrativeRailDefinition,
  NarrativeRailFailure,
  NarrativeRuntimeState,
  NarrativeScoreBreakdown,
  NarrativeSelectionReceipt,
  NarrativeTrackState,
} from "./types.js";

interface CandidateEvaluation {
  candidate: NarrativeCandidate;
  failures: NarrativeRailFailure[];
  score: NarrativeCandidateScore | null;
}

function uniqueOrdered(values: readonly string[]): string[] {
  return orderedStrings([...new Set(values)]);
}

function orderedRecord(input: Readonly<Record<string, string>>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const key of orderedStrings(Object.keys(input))) output[key] = input[key]!;
  return output;
}

function intersects(left: ReadonlySet<string>, right: readonly string[]): boolean {
  return right.some((value) => left.has(value));
}

function relevantFacts(candidate: NarrativeCandidate, factById: ReadonlyMap<string, NarrativeFact>): NarrativeFact[] {
  return uniqueOrdered(candidate.sourceFactIds)
    .map((factId) => factById.get(factId))
    .filter((fact): fact is NarrativeFact => fact !== undefined);
}

function candidateTagSet(
  candidate: NarrativeCandidate,
  facts: readonly NarrativeFact[],
  state: NarrativeRuntimeState,
): Set<string> {
  const tags = new Set<string>();
  for (const tag of candidate.tags) tags.add(tag);
  for (const tag of candidate.pressureTags) tags.add(tag);
  for (const fact of facts) {
    tags.add(`fact:${fact.type}`);
    for (const tag of fact.tags) tags.add(tag);
  }
  for (const move of candidate.actorMoves) {
    tags.add(move.moveTag);
    tags.add(`move:${move.moveTag}`);
  }
  for (const payment of candidate.statePayments) {
    tags.add(`payment:${payment.kind}`);
    for (const tag of payment.tags) tags.add(tag);
  }
  const actorById = new Map(state.actors.map((actor) => [actor.id, actor] as const));
  const actorIds = new Set<string>([
    ...Object.values(candidate.roleBindings),
    ...candidate.actorMoves.map((move) => move.actorId),
  ]);
  for (const actorId of actorIds) {
    for (const tag of actorById.get(actorId)?.tags ?? []) tags.add(tag);
  }
  return tags;
}

function failure(code: NarrativeRailFailure["code"], detail: string): NarrativeRailFailure {
  return { code, detail };
}

function findRail(constitution: NarrativeConstitution, railId: string): NarrativeRailDefinition | undefined {
  return constitution.rails.find((rail) => rail.id === railId);
}

function findTrack(state: NarrativeRuntimeState, trackId: string): NarrativeTrackState | undefined {
  return state.tracks.find((track) => track.id === trackId);
}

function validateTrack(
  constitution: NarrativeConstitution,
  state: NarrativeRuntimeState,
  candidate: NarrativeCandidate,
): NarrativeRailFailure[] {
  const failures: NarrativeRailFailure[] = [];
  let rail: NarrativeRailDefinition | undefined;

  if (candidate.track.kind === "open") {
    if (findTrack(state, candidate.track.trackId)) {
      failures.push(failure("duplicate-track-id", `track ${candidate.track.trackId} already exists`));
    }
    rail = findRail(constitution, candidate.track.railId);
    if (!rail) {
      failures.push(failure("unknown-rail", `rail ${candidate.track.railId} is not declared`));
    } else if (!rail.openingFunctions.includes(candidate.beatFunction)) {
      failures.push(
        failure(
          "rail-transition",
          `${candidate.beatFunction} cannot open rail ${rail.id}; expected one of ${rail.openingFunctions.join(", ")}`,
        ),
      );
    }
  } else {
    const track = findTrack(state, candidate.track.trackId);
    if (!track) {
      failures.push(failure("missing-track", `track ${candidate.track.trackId} does not exist`));
      return failures;
    }
    if (track.status !== "open") {
      failures.push(failure("track-not-open", `track ${track.id} is ${track.status}`));
    }
    rail = findRail(constitution, track.railId);
    if (!rail) {
      failures.push(failure("unknown-rail", `rail ${track.railId} is not declared`));
    } else {
      const allowed = rail.transitions[track.currentFunction] ?? [];
      if (!allowed.includes(candidate.beatFunction)) {
        failures.push(
          failure(
            "rail-transition",
            `${track.currentFunction} cannot advance to ${candidate.beatFunction} on rail ${rail.id}`,
          ),
        );
      }
    }
  }

  const disposition = candidate.trackDisposition ?? "continue";
  if ((disposition === "resolve" || disposition === "inherit") && rail) {
    if (!rail.terminalFunctions.includes(candidate.beatFunction)) {
      failures.push(
        failure(
          "invalid-track-disposition",
          `${disposition} requires a terminal beat, but ${candidate.beatFunction} is not terminal on ${rail.id}`,
        ),
      );
    }
  }

  return failures;
}

function validateActorMove(
  move: NarrativeActorMove,
  policy: NarrativeActorPolicy | undefined,
  constitution: NarrativeConstitution,
  candidateTags: ReadonlySet<string>,
  factById: ReadonlyMap<string, NarrativeFact>,
): { failures: NarrativeRailFailure[]; fit: number } {
  const failures: NarrativeRailFailure[] = [];

  if (constitution.prohibitedMoveTags.includes(move.moveTag)) {
    failures.push(failure("prohibited-move", `${move.actorId} uses constitutionally prohibited move ${move.moveTag}`));
    return { failures, fit: 0 };
  }

  if (!policy) return { failures, fit: 0 };

  if (policy.forbiddenMoves.includes(move.moveTag)) {
    failures.push(failure("forbidden-character-move", `${move.actorId} cannot use ${move.moveTag}`));
    return { failures, fit: 0 };
  }

  if (policy.baselineMoves.includes(move.moveTag)) return { failures, fit: 2 };

  const conditional = policy.conditionalMoves.find((entry) => entry.moveTag === move.moveTag);
  if (conditional) {
    if (!intersects(candidateTags, conditional.requiresAnyTags)) {
      failures.push(
        failure(
          "conditional-character-move",
          `${move.actorId} may use ${move.moveTag} only under one of ${conditional.requiresAnyTags.join(", ")}`,
        ),
      );
      return { failures, fit: 0 };
    }
    return { failures, fit: 2 };
  }

  if (policy.deviationPolicy === "allow") return { failures, fit: 0 };
  if (policy.deviationPolicy === "reject") {
    failures.push(failure("unjustified-character-deviation", `${move.actorId} has no authored path to ${move.moveTag}`));
    return { failures, fit: 0 };
  }

  const justificationIds = uniqueOrdered(move.justificationFactIds ?? []);
  const justificationFacts = justificationIds
    .map((factId) => factById.get(factId))
    .filter((fact): fact is NarrativeFact => fact !== undefined);

  if (justificationIds.length === 0 || justificationFacts.length !== justificationIds.length) {
    failures.push(
      failure(
        "unjustified-character-deviation",
        `${move.actorId} must cite existing facts to deviate with ${move.moveTag}`,
      ),
    );
    return { failures, fit: 0 };
  }

  const requiredTags = policy.deviationRequiresAnyTags ?? [];
  if (requiredTags.length > 0) {
    const justificationTags = new Set(justificationFacts.flatMap((fact) => fact.tags));
    if (!intersects(justificationTags, requiredTags)) {
      failures.push(
        failure(
          "unjustified-character-deviation",
          `${move.actorId}'s deviation lacks one of ${requiredTags.join(", ")}`,
        ),
      );
      return { failures, fit: 0 };
    }
  }

  return { failures, fit: 1 };
}

function lastRecipeUseCycle(state: NarrativeRuntimeState, recipeId: string): number | null {
  let latest: number | null = null;
  for (const beat of state.ledger.beats) {
    if (beat.recipeId !== recipeId) continue;
    if (latest === null || beat.cycle > latest) latest = beat.cycle;
  }
  return latest;
}

function candidateActorIds(candidate: NarrativeCandidate): Set<string> {
  return new Set([
    ...Object.values(candidate.roleBindings),
    ...candidate.actorMoves.map((move) => move.actorId),
  ]);
}

function obligationIsRelevant(
  obligation: NarrativeObligation,
  actors: ReadonlySet<string>,
  tags: ReadonlySet<string>,
): boolean {
  return obligation.actorIds.some((actorId) => actors.has(actorId)) || obligation.tags.some((tag) => tags.has(tag));
}

function scoreCandidate(
  constitution: NarrativeConstitution,
  state: NarrativeRuntimeState,
  candidate: NarrativeCandidate,
  facts: readonly NarrativeFact[],
  tags: ReadonlySet<string>,
  matchedIdentityAnchors: readonly string[],
  actorFitRaw: number,
): NarrativeCandidateScore {
  const weights = constitution.weights;
  const obligations = state.ledger.obligations.filter((obligation) => obligation.status === "open");
  const obligationById = new Map(obligations.map((obligation) => [obligation.id, obligation] as const));
  const resolvedPressure = candidate.resolvesObligationIds.reduce(
    (sum, obligationId) => sum + (obligationById.get(obligationId)?.pressure ?? 0),
    0,
  );
  const actors = candidateActorIds(candidate);
  const relevantOpenPressure = obligations
    .filter(
      (obligation) =>
        !candidate.resolvesObligationIds.includes(obligation.id) && obligationIsRelevant(obligation, actors, tags),
    )
    .reduce((sum, obligation) => sum + obligation.pressure, 0);
  const obligationPressureRaw = resolvedPressure * 2 + relevantOpenPressure;

  const sourceSeverityRaw = Math.min(100, facts.reduce((sum, fact) => sum + fact.severity, 0));
  const lastUse = lastRecipeUseCycle(state, candidate.recipeId);
  const cyclesSinceUse = lastUse === null ? constitution.freshnessCap : Math.max(0, state.cycle - lastUse);
  const freshnessRaw = Math.min(constitution.freshnessCap, cyclesSinceUse);
  const repetitionRaw = state.ledger.beats.filter((beat) => beat.recipeId === candidate.recipeId).length;

  let trackUrgencyRaw = 0;
  if (candidate.track.kind === "advance") {
    const track = findTrack(state, candidate.track.trackId);
    if (track) {
      trackUrgencyRaw = track.openObligationIds.reduce(
        (sum, obligationId) => sum + (obligationById.get(obligationId)?.pressure ?? 0),
        0,
      );
    }
  }

  const breakdown: NarrativeScoreBreakdown = {
    authoredPriority: candidate.authoredPriority * weights.authoredPriority,
    sourceSeverity: sourceSeverityRaw * weights.sourceSeverity,
    conditionComplexity: candidate.conditionComplexity * weights.conditionComplexity,
    obligationPressure: obligationPressureRaw * weights.obligationPressure,
    identityRelevance: matchedIdentityAnchors.length * weights.identityRelevance,
    closure: candidate.resolvesObligationIds.length * weights.closure,
    freshness: freshnessRaw * weights.freshness,
    actorFit: actorFitRaw * weights.actorFit,
    repetition: -repetitionRaw * weights.repetition,
    trackUrgency: trackUrgencyRaw * weights.trackUrgency,
  };

  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return {
    candidateId: candidate.id,
    total,
    breakdown,
    matchedIdentityAnchors: orderedStrings(matchedIdentityAnchors),
    roleBindings: orderedRecord(candidate.roleBindings),
  };
}

function evaluateOne(
  constitution: NarrativeConstitution,
  state: NarrativeRuntimeState,
  candidate: NarrativeCandidate,
  duplicateCandidateIds: ReadonlySet<string>,
): CandidateEvaluation {
  const failures: NarrativeRailFailure[] = [];
  const factById = new Map(state.facts.map((fact) => [fact.id, fact] as const));
  const actorById = new Map(state.actors.map((actor) => [actor.id, actor] as const));
  const beatById = new Map(state.ledger.beats.map((beat) => [beat.id, beat] as const));
  const obligationById = new Map(state.ledger.obligations.map((obligation) => [obligation.id, obligation] as const));

  if (duplicateCandidateIds.has(candidate.id)) {
    failures.push(failure("duplicate-candidate-id", `candidate id ${candidate.id} appears more than once`));
  }

  for (const factId of uniqueOrdered(candidate.sourceFactIds)) {
    if (!factById.has(factId)) failures.push(failure("missing-source-fact", `fact ${factId} does not exist`));
  }
  for (const [roleId, actorId] of Object.entries(candidate.roleBindings)) {
    if (!actorById.has(actorId)) failures.push(failure("missing-actor", `role ${roleId} binds missing actor ${actorId}`));
  }
  for (const move of candidate.actorMoves) {
    if (!actorById.has(move.actorId)) failures.push(failure("missing-actor", `move ${move.moveTag} uses missing actor ${move.actorId}`));
  }
  for (const beatId of uniqueOrdered(candidate.causalParentBeatIds)) {
    if (!beatById.has(beatId)) failures.push(failure("missing-causal-parent", `beat ${beatId} does not exist`));
  }
  if (candidate.sourceFactIds.length === 0 && candidate.causalParentBeatIds.length === 0) {
    const implicitTrackParent = candidate.track.kind === "advance"
      ? (findTrack(state, candidate.track.trackId)?.beatIds.length ?? 0) > 0
      : false;
    if (!implicitTrackParent) {
      failures.push(
        failure(
          "missing-causal-parent",
          `candidate ${candidate.id} has neither a source fact nor an existing track parent`,
        ),
      );
    }
  }

  failures.push(...validateTrack(constitution, state, candidate));

  if (candidate.authority === "authoritative" && candidate.statePayments.length === 0) {
    failures.push(failure("missing-state-payment", `authoritative candidate ${candidate.id} changes no persistent state`));
  }
  if (
    candidate.authority === "presentation" &&
    (candidate.statePayments.length > 0 ||
      candidate.opensObligations.length > 0 ||
      candidate.resolvesObligationIds.length > 0 ||
      (candidate.trackDisposition ?? "continue") !== "continue")
  ) {
    failures.push(failure("presentation-mutates-state", `presentation candidate ${candidate.id} carries authoritative effects`));
  }

  for (const obligationId of uniqueOrdered(candidate.resolvesObligationIds)) {
    const obligation = obligationById.get(obligationId);
    if (!obligation) failures.push(failure("missing-obligation", `obligation ${obligationId} does not exist`));
    else if (obligation.status !== "open") {
      failures.push(failure("closed-obligation", `obligation ${obligationId} is ${obligation.status}`));
    }
  }

  const seenObligationIds = new Set(state.ledger.obligations.map((obligation) => obligation.id));
  const draftIds = new Set<string>();
  for (const obligation of candidate.opensObligations) {
    if (seenObligationIds.has(obligation.id) || draftIds.has(obligation.id)) {
      failures.push(failure("duplicate-obligation-id", `obligation id ${obligation.id} is already in use`));
    }
    draftIds.add(obligation.id);
  }

  const lastUse = lastRecipeUseCycle(state, candidate.recipeId);
  if (lastUse !== null && state.cycle - lastUse <= candidate.cooldownCycles) {
    failures.push(
      failure(
        "cooldown",
        `recipe ${candidate.recipeId} last ran in cycle ${lastUse}; cooldown is ${candidate.cooldownCycles}`,
      ),
    );
  }

  const facts = relevantFacts(candidate, factById);
  const tags = candidateTagSet(candidate, facts, state);
  const matchedIdentityAnchors: string[] = [];
  for (const anchor of constitution.identityAnchors) {
    if (intersects(tags, anchor.anyOfTags)) matchedIdentityAnchors.push(anchor.id);
    else {
      failures.push(
        failure(
          "missing-identity-anchor",
          `candidate ${candidate.id} misses ${anchor.id}; expected one of ${anchor.anyOfTags.join(", ")}`,
        ),
      );
    }
  }

  const policyByActor = new Map(constitution.actorPolicies.map((policy) => [policy.actorId, policy] as const));
  let actorFitRaw = 0;
  for (const move of candidate.actorMoves) {
    const result = validateActorMove(move, policyByActor.get(move.actorId), constitution, tags, factById);
    failures.push(...result.failures);
    actorFitRaw += result.fit;
  }

  if (failures.length > 0) return { candidate, failures, score: null };
  return {
    candidate,
    failures: [],
    score: scoreCandidate(
      constitution,
      state,
      candidate,
      facts,
      tags,
      matchedIdentityAnchors,
      actorFitRaw,
    ),
  };
}

export function sortNarrativeCandidates(
  constitution: NarrativeConstitution,
  state: NarrativeRuntimeState,
  candidates: readonly NarrativeCandidate[],
): NarrativeSelectionReceipt {
  const constitutionIssues = validateNarrativeConstitution(constitution);
  if (constitutionIssues.length > 0) {
    const summary = constitutionIssues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    throw new Error(`Invalid narrative constitution: ${summary}`);
  }
  const candidateCounts = new Map<string, number>();
  for (const candidate of candidates) {
    candidateCounts.set(candidate.id, (candidateCounts.get(candidate.id) ?? 0) + 1);
  }
  const duplicates = new Set(
    [...candidateCounts.entries()].filter(([, count]) => count > 1).map(([candidateId]) => candidateId),
  );

  const evaluations = [...candidates]
    .sort((left, right) => compareCodepoints(left.id, right.id))
    .map((candidate) => evaluateOne(constitution, state, candidate, duplicates));

  const eligible = evaluations
    .filter((evaluation): evaluation is CandidateEvaluation & { score: NarrativeCandidateScore } => evaluation.score !== null)
    .map((evaluation) => evaluation.score)
    .sort(
      (left, right) =>
        right.total - left.total ||
        right.breakdown.conditionComplexity - left.breakdown.conditionComplexity ||
        right.breakdown.sourceSeverity - left.breakdown.sourceSeverity ||
        compareCodepoints(left.candidateId, right.candidateId),
    );

  const rejected: NarrativeCandidateRejection[] = evaluations
    .filter((evaluation) => evaluation.failures.length > 0)
    .map((evaluation) => ({
      candidateId: evaluation.candidate.id,
      failures: [...evaluation.failures].sort(
        (left, right) => compareCodepoints(left.code, right.code) || compareCodepoints(left.detail, right.detail),
      ),
    }));

  return {
    format: "axm-narrative-selection/1",
    constitutionId: constitution.id,
    constitutionVersion: constitution.version,
    constitutionFingerprint: narrativeConstitutionFingerprint(constitution),
    stateFingerprint: narrativeStateFingerprint(state),
    candidateSetFingerprint: narrativeCandidateSetFingerprint(candidates),
    cycle: state.cycle,
    eligible,
    rejected,
    selectedCandidateId: eligible[0]?.candidateId ?? null,
  };
}
