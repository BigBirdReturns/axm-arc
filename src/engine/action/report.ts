import "../abi14.js";
import type { Agent, Arc, Challenge, AgentRunResult, MechanicResult, Organization, RunReport } from "../types.js";
import { hashSeed, Rng } from "../prng.js";
import { rollLoot } from "../resolver-base.js";
import type { ActionReceipt } from "./types.js";

function stressForDifficulty(difficultyRating: number): number {
  if (difficultyRating < 30) return 1;
  if (difficultyRating <= 60) return 2;
  return 3;
}

/** Convert an already verified action receipt into the ordinary engine report
 * consumed by rewards, stress, relationships, progression, state effects, and
 * custody. This function never rerolls the encounter outcome. */
export function actionReportFromReceipt(params: {
  receipt: ActionReceipt;
  challenge: Challenge;
  assignedAgents: Agent[];
  org: Organization;
  arc: Arc;
  cycle: number;
}): RunReport {
  const progressById = new Map(params.receipt.result.objectives.map((objective) => [objective.id, objective]));
  const mechanicResults: MechanicResult[] = params.challenge.mechanicChecks.map((check) => {
    const objective = progressById.get(check.id);
    if (!objective) throw new Error(`Action receipt is missing objective ${check.id}.`);
    return { mechanicId: check.id, score: objective.defeated, threshold: objective.target, passed: objective.completed };
  });
  const performanceRating = mechanicResults.length > 0
    ? mechanicResults.filter((result) => result.passed).length / mechanicResults.length
    : 0;
  const baseStress = stressForDifficulty(params.challenge.difficultyRating);
  const controlledDowned = params.receipt.result.playerDefeated;
  const perfect = performanceRating === 1;
  const skillMoment = params.receipt.result.stats.parries + params.receipt.result.stats.dodgedAttacks > 0;
  const agentResults: AgentRunResult[] = params.assignedAgents.map((agent) => {
    const controlled = agent.id === params.receipt.controlledAgentId;
    const wasDowned = controlledDowned && controlled;
    const stressGained = perfect ? (wasDowned ? baseStress : 0) : baseStress + (controlledDowned && !controlled ? 2 : 0);
    return {
      agentId: agent.id,
      mechanicResults: mechanicResults.map((result) => ({ ...result })),
      performanceRating,
      stressGained,
      wasDowned,
      isHeroic: controlled
        && params.receipt.result.outcome === "success"
        && params.receipt.result.stats.damageTaken === 0
        && skillMoment,
    };
  });
  const lootSeed = hashSeed(params.org.rngSeed, params.cycle, params.challenge.id, params.receipt.receiptDigest, "action-loot");
  const lootDrops = rollLoot(params.challenge, params.receipt.result.outcome, params.assignedAgents, params.arc, new Rng(lootSeed));
  return {
    challengeId: params.challenge.id,
    outcome: params.receipt.result.outcome,
    cycle: params.cycle,
    assignedAgents: agentResults,
    lootDrops,
    dramaTriggers: [],
    narrativeSeed: hashSeed(params.receipt.seed, params.receipt.result.outcome, params.receipt.stateDigest),
    action: {
      kind: "action",
      format: params.receipt.format,
      runtimeVersion: params.receipt.runtimeVersion,
      receiptDigest: params.receipt.receiptDigest,
      actionSpecDigest: params.receipt.actionSpecDigest,
      traceDigest: params.receipt.traceDigest,
      stateDigest: params.receipt.stateDigest,
      controlledAgentId: params.receipt.controlledAgentId,
      totalTicks: params.receipt.totalTicks,
      stats: { ...params.receipt.result.stats },
    },
  };
}
