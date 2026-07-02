// Difficulty modes as a pure challenge transform. The resolver stays
// mode-blind: callers compose resolveChallenge(applyDifficultyMode(c, mode))
// so a mode can never leak into history — the transformed challenge keeps its
// id, and assignment records / milestones stay keyed to the base challenge.

import type { Challenge, DifficultyMode, MechanicCheck, Outcome } from "./types";

function scaleOutcome(outcome: Outcome, multiplier: number): Outcome {
  return {
    ...outcome,
    currencyReward:
      outcome.currencyReward === undefined
        ? undefined
        : Math.round(outcome.currencyReward * multiplier),
    reputationGain:
      outcome.reputationGain === undefined
        ? undefined
        : Math.round(outcome.reputationGain * multiplier),
  };
}

/** Apply a difficulty mode to a challenge, returning a new challenge (the
 * input is never mutated).
 *
 * - Every base mechanic check's difficultyThreshold scales by
 *   difficultyMultiplier (rounded — thresholds are integers by schema).
 * - timePressure.aggregateThreshold scales the same way.
 * - mechanicAdditions append as authored, unscaled: they are written for the
 *   mode, not multiplied by it.
 * - Outcome currencyReward / reputationGain scale by rewardMultiplier.
 *   Drop rates and reward tables do not — loot lists are the mode designer's
 *   call via mechanicAdditions-gated challenges, not a blanket multiplier.
 * - difficultyRating scales and clamps to the schema's 1..100. */
export function applyDifficultyMode(challenge: Challenge, mode: DifficultyMode): Challenge {
  const { difficultyMultiplier, rewardMultiplier, mechanicAdditions } = mode.globalModifiers;

  const scaledChecks: MechanicCheck[] = challenge.mechanicChecks.map((check) => ({
    ...check,
    difficultyThreshold: Math.round(check.difficultyThreshold * difficultyMultiplier),
  }));

  return {
    ...challenge,
    difficultyRating: Math.min(
      100,
      Math.max(1, Math.round(challenge.difficultyRating * difficultyMultiplier)),
    ),
    mechanicChecks: [...scaledChecks, ...mechanicAdditions.map((check) => ({ ...check }))],
    timePressure:
      challenge.timePressure === null
        ? null
        : {
            ...challenge.timePressure,
            aggregateThreshold: Math.round(
              challenge.timePressure.aggregateThreshold * difficultyMultiplier,
            ),
          },
    outcomes: {
      success: scaleOutcome(challenge.outcomes.success, rewardMultiplier),
      partial: scaleOutcome(challenge.outcomes.partial, rewardMultiplier),
      failure: scaleOutcome(challenge.outcomes.failure, rewardMultiplier),
    },
  };
}
