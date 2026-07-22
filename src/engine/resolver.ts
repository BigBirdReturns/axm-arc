import "./abi13.js";
import { evaluateComposition } from "./composition.js";
import {
  effectiveThreshold,
  partyClearsGates,
  resolveChallenge as resolveChallengeBase,
  type ResolveChallengeOpts,
} from "./resolver-base.js";
import type { RunReport } from "./types.js";

export { effectiveThreshold, partyClearsGates };
export type { ResolveChallengeOpts };

/** Direct resolver calls obey the same authored composition law as runCycle.
 * The UI may preview this evaluation, but it cannot bypass or reimplement it. */
export function resolveChallenge(opts: ResolveChallengeOpts): RunReport {
  const composition = evaluateComposition({
    challenge: opts.challenge,
    agents: opts.assignedAgents,
    arc: opts.arc,
  });
  if (!composition.feasible) {
    throw new Error(
      `Party composition is not eligible for challenge ${opts.challenge.id}: ${composition.rejectionReasons.join("; ")}`,
    );
  }
  const report = resolveChallengeBase(opts);
  return (opts.challenge.compositionConstraints?.length ?? 0) > 0
    ? { ...report, composition }
    : report;
}
