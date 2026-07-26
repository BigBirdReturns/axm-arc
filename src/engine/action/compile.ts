import type { Arc, Challenge, FailureConsequence, MechanicCheck } from "../types.js";
import { cartridgeDigest, sha256Hex } from "../cartridge-digest.js";
import { orderRecordKeysDeep } from "../determinism.js";
import { applyDifficultyMode } from "../difficulty.js";
import { readActionProfile } from "./profile.js";
import {
  ACTION_RUNTIME_VERSION,
  ACTION_SPEC_FORMAT,
  ACTION_TICK_RATE,
  type ActionArenaKit,
  type ActionEncounterAuthoring,
  type ActionEncounterSpec,
  type ActionEncounterSpecCore,
  type ActionEnemyKit,
  type ActionEnemyLaw,
  type ActionPlayerKit,
  type ActionPlayerLaw,
} from "./types.js";

const ENEMY_BY_FAILURE: Record<FailureConsequence["type"], ActionEnemyKit> = {
  stress: "skirmisher",
  agent_damage: "duelist",
  team_damage: "swarm",
  debuff: "hexer",
  cascade: "breaker",
};

const PLAYER_LAWS: Record<ActionPlayerKit, ActionPlayerLaw> = {
  staff: {
    kit: "staff", maxHealth: 12, radius: 360, movePerTick: 180,
    dodgePerTick: 480, dodgeTicks: 10, dodgeInvulnerableTicks: 6,
    parryTicks: 5, parryActiveTicks: 3, parryRecoveryTicks: 7, staggerTicks: 12,
    attacks: [
      { id: "light", startupTicks: 4, activeTicks: 3, recoveryTicks: 7, damage: 2, range: 1550, coneNumerator: 0, coneDenominator: 1, knockback: 320 },
      { id: "heavy", startupTicks: 10, activeTicks: 4, recoveryTicks: 15, damage: 4, range: 1900, coneNumerator: 1, coneDenominator: 2, knockback: 760 },
    ],
  },
  blade: {
    kit: "blade", maxHealth: 10, radius: 340, movePerTick: 210,
    dodgePerTick: 540, dodgeTicks: 9, dodgeInvulnerableTicks: 6,
    parryTicks: 5, parryActiveTicks: 3, parryRecoveryTicks: 6, staggerTicks: 10,
    attacks: [
      { id: "light", startupTicks: 3, activeTicks: 2, recoveryTicks: 6, damage: 2, range: 1250, coneNumerator: 1, coneDenominator: 4, knockback: 260 },
      { id: "heavy", startupTicks: 8, activeTicks: 3, recoveryTicks: 13, damage: 4, range: 1550, coneNumerator: 1, coneDenominator: 2, knockback: 620 },
    ],
  },
  hammer: {
    kit: "hammer", maxHealth: 15, radius: 390, movePerTick: 145,
    dodgePerTick: 410, dodgeTicks: 11, dodgeInvulnerableTicks: 6,
    parryTicks: 4, parryActiveTicks: 2, parryRecoveryTicks: 9, staggerTicks: 15,
    attacks: [
      { id: "light", startupTicks: 6, activeTicks: 3, recoveryTicks: 10, damage: 3, range: 1450, coneNumerator: 0, coneDenominator: 1, knockback: 500 },
      { id: "heavy", startupTicks: 14, activeTicks: 5, recoveryTicks: 19, damage: 6, range: 1800, coneNumerator: 1, coneDenominator: 3, knockback: 1000 },
    ],
  },
};

const ENEMY_LAWS: Record<ActionEnemyKit, ActionEnemyLaw> = {
  skirmisher: { kit: "skirmisher", maxHealth: 3, radius: 300, movePerTick: 115, attackRange: 900, attackDamage: 1, telegraphTicks: 18, activeTicks: 2, recoveryTicks: 16, staggerTicks: 20 },
  duelist: { kit: "duelist", maxHealth: 5, radius: 320, movePerTick: 125, attackRange: 980, attackDamage: 2, telegraphTicks: 14, activeTicks: 2, recoveryTicks: 18, staggerTicks: 24 },
  swarm: { kit: "swarm", maxHealth: 2, radius: 270, movePerTick: 145, attackRange: 760, attackDamage: 1, telegraphTicks: 20, activeTicks: 2, recoveryTicks: 20, staggerTicks: 16 },
  hexer: { kit: "hexer", maxHealth: 4, radius: 300, movePerTick: 85, attackRange: 2600, attackDamage: 1, telegraphTicks: 28, activeTicks: 2, recoveryTicks: 24, staggerTicks: 22 },
  breaker: { kit: "breaker", maxHealth: 9, radius: 430, movePerTick: 80, attackRange: 1150, attackDamage: 3, telegraphTicks: 32, activeTicks: 3, recoveryTicks: 28, staggerTicks: 30 },
};

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function defaultPlayerKit(challenge: Challenge): ActionPlayerKit {
  if (challenge.difficultyRating >= 70) return "hammer";
  if (challenge.rosterRequirements.maxAgents <= 3) return "blade";
  return "staff";
}

function defaultArenaKit(challenge: Challenge): ActionArenaKit {
  if (challenge.mechanicChecks.length >= 3) return "islands";
  if (challenge.timePressure) return "lane";
  return "ring";
}

function defaultDurationTicks(challenge: Challenge): number {
  if (challenge.timePressure) {
    return clampInt(challenge.timePressure.rounds * ACTION_TICK_RATE * 10, 20 * ACTION_TICK_RATE, 180 * ACTION_TICK_RATE);
  }
  return clampInt((45 + challenge.difficultyRating * 0.75 + challenge.mechanicChecks.length * 15) * ACTION_TICK_RATE, 30 * ACTION_TICK_RATE, 180 * ACTION_TICK_RATE);
}

function enemyCount(check: MechanicCheck, scale: number): number {
  const divisor = check.scope === "team_aggregate" ? 7 : check.scope === "role_specific" ? 11 : 10;
  const raw = Math.max(1, Math.round(check.difficultyThreshold / divisor));
  const swarmBonus = check.failureConsequence.type === "team_damage" ? 1 : 0;
  return clampInt((raw + swarmBonus) * scale, 1, 12);
}

function objectiveOrder(challenge: Challenge, authored: ActionEncounterAuthoring | undefined): MechanicCheck[] {
  if (!authored?.objectiveOrder) return [...challenge.mechanicChecks];
  const byId = new Map(challenge.mechanicChecks.map((check) => [check.id, check]));
  const ordered = authored.objectiveOrder.map((id) => byId.get(id)).filter((check): check is MechanicCheck => !!check);
  const named = new Set(ordered.map((check) => check.id));
  // Difficulty modes may add mechanics after the base profile was authored.
  // Append those additions in authored mode order rather than silently dropping
  // them or requiring the base cartridge to predict every future mode.
  return [...ordered, ...challenge.mechanicChecks.filter((check) => !named.has(check.id))];
}

function specDigest(core: ActionEncounterSpecCore): string {
  return "actspec1_" + sha256Hex(JSON.stringify(orderRecordKeysDeep(core)));
}

export function compileActionEncounter(
  arc: Arc,
  challenge: Challenge,
  difficultyModeId: string | null = null,
): ActionEncounterSpec {
  const mode = difficultyModeId === null
    ? null
    : arc.difficultyModes.find((candidate) => candidate.id === difficultyModeId);
  if (difficultyModeId !== null && !mode) {
    throw new Error(`Difficulty mode not found: ${difficultyModeId} (challenge ${challenge.id}).`);
  }
  const effectiveChallenge = mode ? applyDifficultyMode(challenge, mode) : challenge;
  const profile = readActionProfile(arc);
  const authored = profile?.encounters[challenge.id];
  const playerKit = authored?.playerKit ?? defaultPlayerKit(effectiveChallenge);
  const arenaScale = authored?.arenaScale ?? 1;
  const enemyScale = authored?.enemyScale ?? 1;
  const checks = objectiveOrder(effectiveChallenge, authored);
  const objectives = checks.map((check) => {
    const count = enemyCount(check, enemyScale);
    return {
      id: check.id,
      label: check.name,
      brief: check.description,
      enemyKit: authored?.objectiveKits?.[check.id] ?? ENEMY_BY_FAILURE[check.failureConsequence.type] ?? "skirmisher",
      enemyCount: count,
      targetDefeats: count,
      failureKind: check.failureConsequence.type,
      severity: check.failureConsequence.severity,
    };
  });
  const authoredThreshold = effectiveChallenge.completionCriteria.parameters["threshold"];
  const threshold = typeof authoredThreshold === "number" && Number.isFinite(authoredThreshold)
    ? clampInt(authoredThreshold, 1, Math.max(1, objectives.length))
    : objectives.length;
  const completion = effectiveChallenge.completionCriteria.type === "survival_check"
    ? { kind: "survive" as const, partialObjectiveCount: Math.max(1, Math.ceil(objectives.length / 2)) }
    : {
        kind: "clear" as const,
        successObjectiveCount: effectiveChallenge.completionCriteria.type === "threshold_passed" ? threshold : objectives.length,
        partialObjectiveCount: Math.max(1, Math.min(objectives.length, Math.ceil(threshold / 2))),
      };
  const core: ActionEncounterSpecCore = {
    format: ACTION_SPEC_FORMAT,
    runtimeVersion: ACTION_RUNTIME_VERSION,
    arcDigest: cartridgeDigest(arc),
    challengeId: challenge.id,
    title: effectiveChallenge.name,
    difficultyModeId,
    tickRate: ACTION_TICK_RATE,
    maxTicks: authored?.durationSeconds
      ? clampInt(authored.durationSeconds * ACTION_TICK_RATE, 20 * ACTION_TICK_RATE, 600 * ACTION_TICK_RATE)
      : defaultDurationTicks(effectiveChallenge),
    arena: {
      kit: authored?.arenaKit ?? defaultArenaKit(effectiveChallenge),
      radius: clampInt((6200 + effectiveChallenge.difficultyRating * 32 + objectives.length * 550) * arenaScale, 4800, 16000),
    },
    player: structuredClone(PLAYER_LAWS[playerKit]),
    enemyLaws: structuredClone(ENEMY_LAWS),
    objectives,
    completion,
  };
  return { ...core, specDigest: specDigest(core) };
}

export function actionSpecDigest(spec: ActionEncounterSpec): string {
  const { specDigest: _ignored, ...core } = spec;
  return specDigest(core);
}
