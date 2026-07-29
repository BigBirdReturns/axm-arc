import type { JsonValue } from "../types.js";

export const ACTION_PROFILE_FORMAT = "axm-action-profile/1" as const;
export const ACTION_EXTENSION_KEY = "axm.action@1" as const;
export const ACTION_OBJECTIVE_PROFILE_FORMAT = "axm-action-objectives/1" as const;
export const ACTION_OBJECTIVE_EXTENSION_KEY = "axm.action-objectives@1" as const;
export const ACTION_SPEC_FORMAT = "axm-action-spec/1" as const;
export const ACTION_RECEIPT_FORMAT = "axm-action-receipt/1" as const;
export const ACTION_RUNTIME_VERSION = "1.0.0" as const;
export const ACTION_SEMANTIC_RUNTIME_VERSION = "1.1.0" as const;
export type ActionRuntimeVersion = typeof ACTION_RUNTIME_VERSION | typeof ACTION_SEMANTIC_RUNTIME_VERSION;
export const ACTION_TICK_RATE = 30 as const;

export type ActionArenaKit = "ring" | "lane" | "islands";
export type ActionPlayerKit = "staff" | "blade" | "hammer";
export type ActionEnemyKit = "skirmisher" | "duelist" | "swarm" | "hexer" | "breaker";
export type ActionOutcome = "success" | "partial" | "failure";

export interface ActionEncounterAuthoring {
  arenaKit?: ActionArenaKit;
  playerKit?: ActionPlayerKit;
  durationSeconds?: number;
  arenaScale?: number;
  enemyScale?: number;
  objectiveOrder?: string[];
  objectiveKits?: Record<string, ActionEnemyKit>;
}

export interface ActionProfile {
  format: typeof ACTION_PROFILE_FORMAT;
  encounters: Record<string, ActionEncounterAuthoring>;
}

export type ActionObjectiveAuthoring =
  | {
      kind: "interact_count";
      targetCount: number;
      radius?: number;
      /** Optional authored pressure population. Zero creates a safe mechanism
       * objective. Absent preserves the ordinary derived enemy population. */
      pressureEnemyCount?: number;
    }
  | {
      kind: "hold_ticks";
      targetTicks: number;
      radius?: number;
      /** Optional authored pressure population. Zero creates a safe mechanism
       * objective. Absent preserves the ordinary derived enemy population. */
      pressureEnemyCount?: number;
    };

export interface ActionObjectiveProfile {
  format: typeof ACTION_OBJECTIVE_PROFILE_FORMAT;
  encounters: Record<string, Record<string, ActionObjectiveAuthoring>>;
}

export interface ActionAttackLaw {
  id: "light" | "heavy";
  startupTicks: number;
  activeTicks: number;
  recoveryTicks: number;
  damage: number;
  range: number;
  /** Squared cosine threshold encoded as numerator / denominator. Zero means
   * the whole forward half-plane. Integer math keeps replay independent of
   * JavaScript floating-point trigonometry. */
  coneNumerator: number;
  coneDenominator: number;
  knockback: number;
}

export interface ActionPlayerLaw {
  kit: ActionPlayerKit;
  maxHealth: number;
  radius: number;
  movePerTick: number;
  dodgePerTick: number;
  dodgeTicks: number;
  dodgeInvulnerableTicks: number;
  parryTicks: number;
  parryActiveTicks: number;
  parryRecoveryTicks: number;
  staggerTicks: number;
  attacks: [ActionAttackLaw, ActionAttackLaw];
}

export interface ActionEnemyLaw {
  kit: ActionEnemyKit;
  maxHealth: number;
  radius: number;
  movePerTick: number;
  attackRange: number;
  attackDamage: number;
  telegraphTicks: number;
  activeTicks: number;
  recoveryTicks: number;
  staggerTicks: number;
}

export interface ActionObjectiveTarget {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export type ActionObjectiveSemanticCompletion =
  | {
      kind: "interact_count";
      targetCount: number;
      targets: ActionObjectiveTarget[];
    }
  | {
      kind: "hold_ticks";
      targetTicks: number;
      target: ActionObjectiveTarget;
    };

export interface ActionObjectiveSpec {
  id: string;
  label: string;
  brief: string;
  enemyKit: ActionEnemyKit;
  enemyCount: number;
  targetDefeats: number;
  failureKind: string;
  severity: number;
  /** Absent for all runtime-1.0 cartridges, preserving their exact spec bytes.
   * When present, pressure enemies are not the completion predicate. */
  semanticCompletion?: ActionObjectiveSemanticCompletion;
}

export type ActionCompletionLaw =
  | {
      kind: "clear";
      successObjectiveCount: number;
      partialObjectiveCount: number;
    }
  | {
      kind: "survive";
      /** Surviving until maxTicks is success. Objective clears remain useful
       * evidence and determine whether an early defeat earns a partial result. */
      partialObjectiveCount: number;
    };

export interface ActionEncounterSpecCore {
  format: typeof ACTION_SPEC_FORMAT;
  runtimeVersion: ActionRuntimeVersion;
  arcDigest: string;
  challengeId: string;
  title: string;
  difficultyModeId: string | null;
  /** Present only when a player product explicitly selects an Arc-owned timing
   * profile. Its absence preserves every legacy spec and receipt byte. */
  timingProfileId?: string;
  tickRate: typeof ACTION_TICK_RATE;
  maxTicks: number;
  arena: {
    kit: ActionArenaKit;
    radius: number;
  };
  player: ActionPlayerLaw;
  enemyLaws: Record<ActionEnemyKit, ActionEnemyLaw>;
  objectives: ActionObjectiveSpec[];
  completion: ActionCompletionLaw;
}

export interface ActionEncounterSpec extends ActionEncounterSpecCore {
  specDigest: string;
}

export const ACTION_BUTTON = Object.freeze({
  light: 1,
  heavy: 2,
  dodge: 4,
  parry: 8,
  interact: 16,
});
export const ACTION_BUTTON_MASK = 31;

export interface ActionInput {
  moveX: -1 | 0 | 1;
  moveY: -1 | 0 | 1;
  aimX: -1 | 0 | 1;
  aimY: -1 | 0 | 1;
  buttons: number;
}

export interface ActionInputRun {
  ticks: number;
  input: ActionInput;
}

export type ActionPlayerMode = "idle" | "light" | "heavy" | "dodge" | "parry" | "stagger" | "defeated";
export type ActionEnemyMode = "approach" | "telegraph" | "active" | "recover" | "stagger" | "defeated";

export interface ActionPlayerState {
  x: number;
  y: number;
  facingX: -1 | 0 | 1;
  facingY: -1 | 0 | 1;
  health: number;
  mode: ActionPlayerMode;
  modeTick: number;
  hitEnemyIds: string[];
}

export interface ActionEnemyState {
  id: string;
  objectiveId: string;
  kit: ActionEnemyKit;
  x: number;
  y: number;
  health: number;
  mode: ActionEnemyMode;
  modeTick: number;
  attackResolved: boolean;
}

export interface ActionObjectiveProgress {
  id: string;
  defeated: number;
  target: number;
  completed: boolean;
  kind?: ActionObjectiveSemanticCompletion["kind"];
  progress?: number;
}

export interface ActionStats {
  hitsLanded: number;
  heavyHits: number;
  damageTaken: number;
  parries: number;
  dodgedAttacks: number;
  enemiesDefeated: number;
  objectiveInteractions?: number;
  objectiveHoldTicks?: number;
}

export type ActionEvent =
  | { type: "wave_started"; objectiveId: string }
  | { type: "player_action"; action: "light" | "heavy" | "dodge" | "parry" }
  | { type: "enemy_hit"; enemyId: string; attack: "light" | "heavy"; damage: number; defeated: boolean }
  | { type: "player_hit"; enemyId: string; damage: number; health: number }
  | { type: "parry"; enemyId: string }
  | { type: "dodge"; enemyId: string }
  | { type: "objective_progress"; objectiveId: string; targetId: string | null; progress: number; target: number }
  | { type: "objective_completed"; objectiveId: string }
  | { type: "encounter_completed"; outcome: ActionOutcome };

export interface ActionSimulationResult {
  outcome: ActionOutcome;
  completedObjectiveIds: string[];
  objectives: ActionObjectiveProgress[];
  playerHealth: number;
  playerDefeated: boolean;
  totalTicks: number;
  stats: ActionStats;
}

export interface ActionSimulationState {
  format: "axm-action-state/1";
  seed: number;
  tick: number;
  activeObjectiveIndex: number;
  player: ActionPlayerState;
  enemies: ActionEnemyState[];
  completedObjectiveIds: string[];
  /** Present only for runtime-1.1 semantic objectives. */
  objectiveProgress?: Record<string, number>;
  completedInteractionTargetIds?: string[];
  stats: ActionStats;
  previousButtons: number;
  /** Ephemeral deterministic events produced by the most recent tick. They are
   * presentation cues, never a second source of game law. */
  events: ActionEvent[];
  result: ActionSimulationResult | null;
}

export interface ActionReceiptCore {
  format: typeof ACTION_RECEIPT_FORMAT;
  runtimeVersion: ActionRuntimeVersion;
  arcDigest: string;
  challengeId: string;
  difficultyModeId: string | null;
  /** Optional and omitted for every legacy action receipt. */
  timingProfileId?: string;
  actionSpecDigest: string;
  cycle: number;
  seed: number;
  controlledAgentId: string;
  partyAgentIds: string[];
  trace: ActionInputRun[];
  totalTicks: number;
  result: ActionSimulationResult;
  traceDigest: string;
  stateDigest: string;
}

export interface ActionReceipt extends ActionReceiptCore {
  receiptDigest: string;
}

export interface ActionAdjudicationSummary {
  kind: "action";
  format: typeof ACTION_RECEIPT_FORMAT;
  runtimeVersion: ActionRuntimeVersion;
  receiptDigest: string;
  actionSpecDigest: string;
  traceDigest: string;
  stateDigest: string;
  controlledAgentId: string;
  totalTicks: number;
  stats: ActionStats;
}

export interface VerifiedActionReceipt {
  spec: ActionEncounterSpec;
  receipt: ActionReceipt;
  terminalState: ActionSimulationState;
}

export type ActionJson = JsonValue;
