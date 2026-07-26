import { compareCodepoints, fingerprint, uniqueOrdered } from "./determinism.js";
import type {
  ActorMoveAgencyClaim,
  ActorMoveAgencyReceipt,
  AgencyFailure,
  AgencyFailureCode,
  CandidateAgencyReceipt,
  NarrativeAgencyEstate,
  NarrativeAgencyPolicy,
  NarrativeActorBelief,
} from "./model.js";

function failure(
  code: AgencyFailureCode,
  subjectId: string,
  detail: string,
  actorId?: string,
): AgencyFailure {
  return { code, subjectId, detail, ...(actorId ? { actorId } : {}) };
}

function duplicateIds(values: readonly string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value));
}

function usableBelief(
  beliefs: readonly NarrativeActorBelief[],
  actorId: string,
  propositionId: string,
): NarrativeActorBelief | undefined {
  return beliefs
    .filter((belief) => belief.actorId === actorId && belief.propositionId === propositionId)
    .sort(
      (left, right) =>
        right.confidence - left.confidence ||
        compareCodepoints(left.stance, right.stance) ||
        compareCodepoints(left.sourceReceiptRef, right.sourceReceiptRef),
    )[0];
}

function validateEstate(estate: NarrativeAgencyEstate): AgencyFailure[] {
  const failures: AgencyFailure[] = [];
  for (const id of duplicateIds(estate.goals.map((entry) => entry.id))) {
    failures.push(failure("duplicate-goal-id", id, `goal id ${id} appears more than once`));
  }
  for (const id of duplicateIds(estate.propositions.map((entry) => entry.id))) {
    failures.push(failure("duplicate-proposition-id", id, `proposition id ${id} appears more than once`));
  }
  const beliefKeys = estate.beliefs.map((entry) => `${entry.actorId}\u001f${entry.propositionId}`);
  for (const key of duplicateIds(beliefKeys)) {
    failures.push(failure("duplicate-belief", key, `belief ${key} appears more than once`));
  }
  for (const goal of estate.goals) {
    if (!Number.isInteger(goal.priority) || goal.priority < 0 || goal.priority > 1000) {
      failures.push(failure("invalid-goal-priority", goal.id, `goal ${goal.id} has invalid priority ${goal.priority}`, goal.actorId));
    }
  }
  for (const belief of estate.beliefs) {
    if (!belief.sourceReceiptRef.trim()) {
      failures.push(
        failure(
          "missing-belief-provenance",
          `${belief.actorId}/${belief.propositionId}`,
          `${belief.actorId} belief in ${belief.propositionId} has no receipt`,
          belief.actorId,
        ),
      );
    }
    if (!Number.isInteger(belief.confidence) || belief.confidence < 0 || belief.confidence > 1000) {
      failures.push(
        failure(
          "invalid-belief-confidence",
          `${belief.actorId}/${belief.propositionId}`,
          `${belief.actorId} belief in ${belief.propositionId} has invalid confidence ${belief.confidence}`,
          belief.actorId,
        ),
      );
    }
  }
  return failures;
}

function evaluateMove(
  move: ActorMoveAgencyClaim,
  estate: NarrativeAgencyEstate,
  policy: NarrativeAgencyPolicy,
): ActorMoveAgencyReceipt {
  const failures: AgencyFailure[] = [];
  const goalById = new Map(estate.goals.map((entry) => [entry.id, entry] as const));
  const propositionById = new Map(estate.propositions.map((entry) => [entry.id, entry] as const));
  const effectsByGoal = new Map(move.expectedGoalEffects.map((entry) => [entry.goalId, entry] as const));

  if (policy.requireIntentionReceipts && move.intentionGoalIds.length === 0) {
    failures.push(failure("missing-intention", move.actorId, `${move.actorId}/${move.moveTag} cites no intention`, move.actorId));
  }

  for (const goalId of uniqueOrdered(move.intentionGoalIds)) {
    const goal = goalById.get(goalId);
    if (!goal) {
      failures.push(failure("missing-goal", goalId, `goal ${goalId} does not exist`, move.actorId));
      continue;
    }
    if (goal.actorId !== move.actorId) {
      failures.push(failure("foreign-goal", goalId, `${move.actorId} cannot act on ${goal.actorId}'s goal ${goalId}`, move.actorId));
    }
    if (goal.status !== "open" && goal.status !== "inherited") {
      failures.push(failure("inactive-goal", goalId, `goal ${goalId} is ${goal.status}`, move.actorId));
    }
    const effect = effectsByGoal.get(goalId);
    if (!effect) {
      failures.push(failure("missing-goal-effect", goalId, `${move.actorId}/${move.moveTag} gives no expected effect for ${goalId}`, move.actorId));
    } else if (!Number.isInteger(effect.delta) || effect.delta < -1000 || effect.delta > 1000) {
      failures.push(failure("invalid-goal-effect", goalId, `goal effect ${effect.delta} is outside -1000..1000`, move.actorId));
    } else if (policy.requirePositiveGoalEffect && effect.delta <= 0) {
      failures.push(failure("unserved-intention", goalId, `${move.actorId}/${move.moveTag} does not advance ${goalId}`, move.actorId));
    }
  }

  for (const effect of move.expectedGoalEffects) {
    if (!move.intentionGoalIds.includes(effect.goalId)) {
      failures.push(
        failure(
          "invalid-goal-effect",
          effect.goalId,
          `${move.actorId}/${move.moveTag} supplies an effect for uncited goal ${effect.goalId}`,
          move.actorId,
        ),
      );
    }
  }

  if (policy.requireKnowledgeReceipts && move.knowledgePropositionIds.length === 0) {
    failures.push(
      failure(
        "missing-knowledge-receipt",
        move.actorId,
        `${move.actorId}/${move.moveTag} cites no available proposition`,
        move.actorId,
      ),
    );
  }

  const falseBeliefs: string[] = [];
  for (const propositionId of uniqueOrdered(move.knowledgePropositionIds)) {
    const proposition = propositionById.get(propositionId);
    if (!proposition) {
      failures.push(failure("missing-proposition", propositionId, `proposition ${propositionId} does not exist`, move.actorId));
      continue;
    }
    if (proposition.sourceReceiptRefs.length === 0) {
      failures.push(
        failure(
          "invalid-knowledge-claim",
          propositionId,
          `proposition ${propositionId} has no provenance receipts`,
          move.actorId,
        ),
      );
    }
    if (estate.commonKnowledgePropositionIds.includes(propositionId)) {
      if (proposition.truth === "false") falseBeliefs.push(propositionId);
      continue;
    }
    const belief = usableBelief(estate.beliefs, move.actorId, propositionId);
    if (!belief) {
      failures.push(
        failure(
          "actor-lacks-proposition",
          propositionId,
          `${move.actorId} cannot use proposition ${propositionId}`,
          move.actorId,
        ),
      );
      continue;
    }
    if (belief.stance === "disbelieves") {
      failures.push(
        failure(
          "disbelieved-proposition",
          propositionId,
          `${move.actorId} explicitly disbelieves ${propositionId}`,
          move.actorId,
        ),
      );
    }
    if (belief.stance === "suspects" && !policy.allowSuspectedBeliefs) {
      failures.push(
        failure(
          "suspected-proposition-not-authorized",
          propositionId,
          `${move.actorId} only suspects ${propositionId}`,
          move.actorId,
        ),
      );
    }
    if (belief.confidence < policy.minimumBeliefConfidence) {
      failures.push(
        failure(
          "low-confidence-belief",
          propositionId,
          `${move.actorId} confidence ${belief.confidence} is below ${policy.minimumBeliefConfidence}`,
          move.actorId,
        ),
      );
    }
    if (!belief.sourceReceiptRef.trim()) {
      failures.push(
        failure(
          "missing-belief-provenance",
          propositionId,
          `${move.actorId} belief in ${propositionId} has no source receipt`,
          move.actorId,
        ),
      );
    }
    if (proposition.truth === "false" && belief.stance !== "disbelieves") falseBeliefs.push(propositionId);
  }

  if (policy.requireRiskReceipt && move.risk === null) {
    failures.push(failure("missing-risk-receipt", move.actorId, `${move.actorId}/${move.moveTag} cites no risk`, move.actorId));
  } else if (move.risk !== null && (!Number.isInteger(move.risk) || move.risk < 0 || move.risk > 1000)) {
    failures.push(failure("invalid-actor-risk", move.actorId, `${move.actorId}/${move.moveTag} has invalid risk ${move.risk}`, move.actorId));
  }

  failures.sort(
    (left, right) =>
      compareCodepoints(left.code, right.code) ||
      compareCodepoints(left.subjectId, right.subjectId) ||
      compareCodepoints(left.detail, right.detail),
  );
  return {
    ...move,
    intentionGoalIds: uniqueOrdered(move.intentionGoalIds),
    knowledgePropositionIds: uniqueOrdered(move.knowledgePropositionIds),
    falseBeliefPropositionIds: uniqueOrdered(falseBeliefs),
    expectedGoalEffects: [...move.expectedGoalEffects].sort(
      (left, right) => compareCodepoints(left.goalId, right.goalId) || left.delta - right.delta,
    ),
    failures,
    passed: failures.length === 0,
  };
}

export function evaluateCandidateAgency(
  candidateId: string,
  moves: readonly ActorMoveAgencyClaim[],
  estate: NarrativeAgencyEstate,
  policy: NarrativeAgencyPolicy,
): CandidateAgencyReceipt {
  const estateFailures = validateEstate(estate);
  const moveReceipts = [...moves]
    .sort((left, right) => compareCodepoints(left.actorId, right.actorId) || compareCodepoints(left.moveTag, right.moveTag))
    .map((move) => evaluateMove(move, estate, policy));
  const failures = [...estateFailures, ...moveReceipts.flatMap((entry) => entry.failures)].sort(
    (left, right) =>
      compareCodepoints(left.code, right.code) ||
      compareCodepoints(left.subjectId, right.subjectId) ||
      compareCodepoints(left.detail, right.detail),
  );
  return {
    format: "axm-narrative-agency-receipt/1",
    candidateId,
    estateFingerprint: estate ? fingerprint(estate) : null,
    policy: { ...policy },
    moves: moveReceipts,
    failures,
    passed: failures.length === 0,
  };
}
