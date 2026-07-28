import { compareCodepoints } from "../determinism.js";
import {
  actionObjectiveComplete,
  initializeSemanticObjectiveState,
  semanticObjectiveProgress,
  stepSemanticObjective,
} from "./objectives.js";
import {
  ACTION_BUTTON,
  ACTION_BUTTON_MASK,
  type ActionAttackLaw,
  type ActionEncounterSpec,
  type ActionEnemyState,
  type ActionEvent,
  type ActionInput,
  type ActionInputRun,
  type ActionObjectiveProgress,
  type ActionOutcome,
  type ActionPlayerState,
  type ActionSimulationResult,
  type ActionSimulationState,
} from "./types.js";

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1000, 0], [924, 383], [707, 707], [383, 924], [0, 1000], [-383, 924], [-707, 707], [-924, 383],
  [-1000, 0], [-924, -383], [-707, -707], [-383, -924], [0, -1000], [383, -924], [707, -707], [924, -383],
];
const IDLE_INPUT: ActionInput = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 };

function signAxis(value: number): -1 | 0 | 1 {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

export function normalizeActionInput(input: Partial<ActionInput> | null | undefined): ActionInput {
  return {
    moveX: signAxis(input?.moveX ?? 0),
    moveY: signAxis(input?.moveY ?? 0),
    aimX: signAxis(input?.aimX ?? 0),
    aimY: signAxis(input?.aimY ?? 0),
    buttons: Math.max(0, Math.trunc(input?.buttons ?? 0)) & ACTION_BUTTON_MASK,
  };
}

function sameInput(left: ActionInput, right: ActionInput): boolean {
  return left.moveX === right.moveX
    && left.moveY === right.moveY
    && left.aimX === right.aimX
    && left.aimY === right.aimY
    && left.buttons === right.buttons;
}

function moveVector(x: number, y: number, amount: number): [number, number] {
  if (x === 0 && y === 0) return [0, 0];
  if (x !== 0 && y !== 0) return [Math.trunc(x * amount * 707 / 1000), Math.trunc(y * amount * 707 / 1000)];
  return [x * amount, y * amount];
}

function distanceSquared(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

function clampToArena(x: number, y: number, radius: number): [number, number] {
  const max = Math.max(Math.abs(x), Math.abs(y));
  if (max <= radius) return [x, y];
  return [Math.trunc(x * radius / max), Math.trunc(y * radius / max)];
}

function moveToward(ax: number, ay: number, bx: number, by: number, amount: number): [number, number] {
  const dx = bx - ax;
  const dy = by - ay;
  const scale = Math.max(Math.abs(dx), Math.abs(dy));
  if (scale === 0) return [ax, ay];
  const step = Math.min(amount, scale);
  return [ax + Math.trunc(dx * step / scale), ay + Math.trunc(dy * step / scale)];
}

function awayVector(ax: number, ay: number, bx: number, by: number, amount: number): [number, number] {
  const dx = ax - bx;
  const dy = ay - by;
  const scale = Math.max(1, Math.abs(dx), Math.abs(dy));
  return [Math.trunc(dx * amount / scale), Math.trunc(dy * amount / scale)];
}

function inAttackCone(player: ActionPlayerState, enemy: ActionEnemyState, attack: ActionAttackLaw): boolean {
  const dx = enemy.x - player.x;
  const dy = enemy.y - player.y;
  const dist2 = dx * dx + dy * dy;
  if (dist2 > attack.range * attack.range) return false;
  const dot = dx * player.facingX + dy * player.facingY;
  if (dot <= 0) return false;
  if (attack.coneNumerator <= 0) return true;
  return dot * dot * attack.coneDenominator >= dist2 * attack.coneNumerator;
}

function spawnWave(spec: ActionEncounterSpec, state: ActionSimulationState, objectiveIndex: number): ActionEnemyState[] {
  const objective = spec.objectives[objectiveIndex];
  if (!objective) return [];
  const law = spec.enemyLaws[objective.enemyKit];
  const base = (state.seed + objectiveIndex * 5) & 15;
  const spawnRadius = Math.max(1800, spec.arena.radius - law.radius - 500);
  const enemies: ActionEnemyState[] = [];
  for (let index = 0; index < objective.enemyCount; index++) {
    const direction = DIRECTIONS[(base + Math.trunc(index * 16 / objective.enemyCount)) & 15]!;
    enemies.push({
      id: `${objective.id}:${String(index + 1).padStart(2, "0")}`,
      objectiveId: objective.id,
      kit: objective.enemyKit,
      x: Math.trunc(direction[0] * spawnRadius / 1000),
      y: Math.trunc(direction[1] * spawnRadius / 1000),
      health: law.maxHealth,
      mode: "approach",
      modeTick: 0,
      attackResolved: false,
    });
  }
  return enemies.sort((a, b) => compareCodepoints(a.id, b.id));
}

export function initialActionState(spec: ActionEncounterSpec, seed: number): ActionSimulationState {
  if (spec.objectives.length === 0) throw new Error("Action encounters require at least one objective.");
  const state: ActionSimulationState = {
    format: "axm-action-state/1",
    seed: seed >>> 0,
    tick: 0,
    activeObjectiveIndex: 0,
    player: { x: 0, y: 0, facingX: 1, facingY: 0, health: spec.player.maxHealth, mode: "idle", modeTick: 0, hitEnemyIds: [] },
    enemies: [],
    completedObjectiveIds: [],
    stats: { hitsLanded: 0, heavyHits: 0, damageTaken: 0, parries: 0, dodgedAttacks: 0, enemiesDefeated: 0 },
    previousButtons: 0,
    events: [{ type: "wave_started", objectiveId: spec.objectives[0]!.id }],
    result: null,
  };
  const initialized = { ...state, enemies: spawnWave(spec, state, 0) };
  return initializeSemanticObjectiveState(spec, initialized);
}

function playerInvulnerable(spec: ActionEncounterSpec, player: ActionPlayerState): boolean {
  return player.mode === "dodge" && player.modeTick < spec.player.dodgeInvulnerableTicks;
}

function playerParrying(spec: ActionEncounterSpec, player: ActionPlayerState): boolean {
  return player.mode === "parry" && player.modeTick < spec.player.parryActiveTicks;
}

function beginPlayerAction(spec: ActionEncounterSpec, state: ActionSimulationState, input: ActionInput): ActionSimulationState {
  void spec;
  const player = state.player;
  if (player.mode !== "idle") return state;
  const rising = input.buttons & ~state.previousButtons;
  const begin = (action: "light" | "heavy" | "dodge" | "parry"): ActionSimulationState => ({
    ...state,
    events: [...state.events, { type: "player_action", action }],
    player: { ...player, mode: action, modeTick: 0, hitEnemyIds: [] },
  });
  if (rising & ACTION_BUTTON.dodge) return begin("dodge");
  if (rising & ACTION_BUTTON.parry) return begin("parry");
  if (rising & ACTION_BUTTON.heavy) return begin("heavy");
  if (rising & ACTION_BUTTON.light) return begin("light");
  return state;
}

function stepPlayer(spec: ActionEncounterSpec, prior: ActionSimulationState, input: ActionInput): ActionSimulationState {
  let state = beginPlayerAction(spec, prior, input);
  let player = state.player;
  const aimX = input.aimX || input.moveX;
  const aimY = input.aimY || input.moveY;
  if (aimX !== 0 || aimY !== 0) player = { ...player, facingX: aimX, facingY: aimY };

  if (player.mode === "idle") {
    const [dx, dy] = moveVector(input.moveX, input.moveY, spec.player.movePerTick);
    const [x, y] = clampToArena(player.x + dx, player.y + dy, spec.arena.radius - spec.player.radius);
    player = { ...player, x, y };
  } else if (player.mode === "dodge") {
    const dirX = input.moveX || player.facingX;
    const dirY = input.moveY || player.facingY;
    const [dx, dy] = moveVector(dirX, dirY, spec.player.dodgePerTick);
    const [x, y] = clampToArena(player.x + dx, player.y + dy, spec.arena.radius - spec.player.radius);
    const nextTick = player.modeTick + 1;
    player = nextTick >= spec.player.dodgeTicks
      ? { ...player, x, y, mode: "idle", modeTick: 0 }
      : { ...player, x, y, modeTick: nextTick };
  } else if (player.mode === "parry") {
    const nextTick = player.modeTick + 1;
    const total = spec.player.parryTicks + spec.player.parryRecoveryTicks;
    player = nextTick >= total ? { ...player, mode: "idle", modeTick: 0 } : { ...player, modeTick: nextTick };
  } else if (player.mode === "stagger") {
    const nextTick = player.modeTick + 1;
    player = nextTick >= spec.player.staggerTicks ? { ...player, mode: "idle", modeTick: 0 } : { ...player, modeTick: nextTick };
  } else if (player.mode === "light" || player.mode === "heavy") {
    const attack = spec.player.attacks[player.mode === "light" ? 0 : 1];
    const activeStart = attack.startupTicks;
    const activeEnd = activeStart + attack.activeTicks;
    const hit = new Set(player.hitEnemyIds);
    let enemies = state.enemies;
    let stats = state.stats;
    let events = state.events;
    if (player.modeTick >= activeStart && player.modeTick < activeEnd) {
      enemies = enemies.map((enemy) => {
        if (enemy.mode === "defeated" || hit.has(enemy.id) || !inAttackCone(player, enemy, attack)) return enemy;
        hit.add(enemy.id);
        const health = Math.max(0, enemy.health - attack.damage);
        const [kx, ky] = awayVector(enemy.x, enemy.y, player.x, player.y, attack.knockback);
        const [x, y] = clampToArena(enemy.x + kx, enemy.y + ky, spec.arena.radius - spec.enemyLaws[enemy.kit].radius);
        const defeated = health === 0;
        stats = {
          ...stats,
          hitsLanded: stats.hitsLanded + 1,
          heavyHits: stats.heavyHits + (attack.id === "heavy" ? 1 : 0),
          enemiesDefeated: stats.enemiesDefeated + (defeated ? 1 : 0),
        };
        events = [...events, { type: "enemy_hit", enemyId: enemy.id, attack: attack.id, damage: Math.min(enemy.health, attack.damage), defeated }];
        return { ...enemy, x, y, health, mode: defeated ? "defeated" : "stagger", modeTick: 0, attackResolved: false };
      });
    }
    const nextTick = player.modeTick + 1;
    const total = attack.startupTicks + attack.activeTicks + attack.recoveryTicks;
    player = nextTick >= total
      ? { ...player, mode: "idle", modeTick: 0, hitEnemyIds: [] }
      : { ...player, modeTick: nextTick, hitEnemyIds: [...hit].sort(compareCodepoints) };
    state = { ...state, enemies, stats, events };
  }
  return { ...state, player };
}

function stepEnemy(
  spec: ActionEncounterSpec,
  state: ActionSimulationState,
  enemy: ActionEnemyState,
): { enemy: ActionEnemyState; player: ActionPlayerState; stats: ActionSimulationState["stats"]; events: ActionEvent[] } {
  const law = spec.enemyLaws[enemy.kit];
  let next = enemy;
  let player = state.player;
  let stats = state.stats;
  let events = state.events;
  if (enemy.mode === "defeated") return { enemy, player, stats, events };
  if (enemy.mode === "stagger") {
    const tick = enemy.modeTick + 1;
    next = tick >= law.staggerTicks ? { ...enemy, mode: "approach", modeTick: 0 } : { ...enemy, modeTick: tick };
    return { enemy: next, player, stats, events };
  }
  if (enemy.mode === "approach") {
    const dist2 = distanceSquared(enemy.x, enemy.y, player.x, player.y);
    if (dist2 <= law.attackRange * law.attackRange) {
      next = { ...enemy, mode: "telegraph", modeTick: 0, attackResolved: false };
    } else {
      const [x, y] = moveToward(enemy.x, enemy.y, player.x, player.y, law.movePerTick);
      next = { ...enemy, x, y };
    }
    return { enemy: next, player, stats, events };
  }
  if (enemy.mode === "telegraph") {
    const tick = enemy.modeTick + 1;
    next = tick >= law.telegraphTicks
      ? { ...enemy, mode: "active", modeTick: 0, attackResolved: false }
      : { ...enemy, modeTick: tick };
    return { enemy: next, player, stats, events };
  }
  if (enemy.mode === "active") {
    if (!enemy.attackResolved) {
      const inRange = distanceSquared(enemy.x, enemy.y, player.x, player.y) <= law.attackRange * law.attackRange;
      if (inRange && playerParrying(spec, player)) {
        stats = { ...stats, parries: stats.parries + 1 };
        events = [...events, { type: "parry", enemyId: enemy.id }];
        next = { ...enemy, mode: "stagger", modeTick: 0, attackResolved: true };
        return { enemy: next, player, stats, events };
      }
      if (inRange && playerInvulnerable(spec, player)) {
        stats = { ...stats, dodgedAttacks: stats.dodgedAttacks + 1 };
        events = [...events, { type: "dodge", enemyId: enemy.id }];
      } else if (inRange && player.mode !== "defeated") {
        const health = Math.max(0, player.health - law.attackDamage);
        const damage = player.health - health;
        stats = { ...stats, damageTaken: stats.damageTaken + damage };
        events = [...events, { type: "player_hit", enemyId: enemy.id, damage, health }];
        player = { ...player, health, mode: health === 0 ? "defeated" : "stagger", modeTick: 0, hitEnemyIds: [] };
      }
      next = { ...enemy, attackResolved: true };
    }
    const tick = next.modeTick + 1;
    next = tick >= law.activeTicks ? { ...next, mode: "recover", modeTick: 0 } : { ...next, modeTick: tick };
    return { enemy: next, player, stats, events };
  }
  if (enemy.mode === "recover") {
    const tick = enemy.modeTick + 1;
    next = tick >= law.recoveryTicks ? { ...enemy, mode: "approach", modeTick: 0, attackResolved: false } : { ...enemy, modeTick: tick };
  }
  return { enemy: next, player, stats, events };
}

function objectiveProgress(spec: ActionEncounterSpec, state: ActionSimulationState): ActionObjectiveProgress[] {
  const completed = new Set(state.completedObjectiveIds);
  return spec.objectives.map((objective, index) => {
    const isCompleted = completed.has(objective.id);
    const semantic = semanticObjectiveProgress(state, objective, isCompleted);
    if (semantic) return semantic;
    if (isCompleted) {
      return { id: objective.id, defeated: objective.targetDefeats, target: objective.targetDefeats, completed: true };
    }
    if (index !== state.activeObjectiveIndex) {
      return { id: objective.id, defeated: 0, target: objective.targetDefeats, completed: false };
    }
    const living = state.enemies.filter((enemy) => enemy.objectiveId === objective.id && enemy.mode !== "defeated").length;
    return {
      id: objective.id,
      defeated: Math.max(0, objective.enemyCount - living),
      target: objective.targetDefeats,
      completed: false,
    };
  });
}

function terminalResult(spec: ActionEncounterSpec, state: ActionSimulationState): ActionSimulationResult | null {
  const completed = state.completedObjectiveIds.length;
  const playerDefeated = state.player.health <= 0 || state.player.mode === "defeated";
  const timedOut = state.tick >= spec.maxTicks;
  let terminal = false;
  let outcome: ActionOutcome = "failure";

  if (spec.completion.kind === "survive") {
    terminal = playerDefeated || timedOut;
    if (timedOut && !playerDefeated) outcome = "success";
    else if (completed >= spec.completion.partialObjectiveCount) outcome = "partial";
  } else {
    const allComplete = completed >= spec.completion.successObjectiveCount;
    terminal = allComplete || playerDefeated || timedOut;
    if (allComplete) outcome = "success";
    else if (completed >= spec.completion.partialObjectiveCount) outcome = "partial";
  }
  if (!terminal) return null;
  return {
    outcome,
    completedObjectiveIds: [...state.completedObjectiveIds].sort(compareCodepoints),
    objectives: objectiveProgress(spec, state),
    playerHealth: state.player.health,
    playerDefeated,
    totalTicks: state.tick,
    stats: { ...state.stats },
  };
}

function advanceWave(spec: ActionEncounterSpec, state: ActionSimulationState): ActionSimulationState {
  const objective = spec.objectives[state.activeObjectiveIndex];
  if (!objective || !actionObjectiveComplete(state, objective)) return state;
  const completedObjectiveIds = [...new Set([...state.completedObjectiveIds, objective.id])].sort(compareCodepoints);
  const nextIndex = state.activeObjectiveIndex + 1;
  const events: ActionEvent[] = [...state.events, { type: "objective_completed", objectiveId: objective.id }];
  const nextObjective = spec.objectives[nextIndex];
  if (nextObjective) events.push({ type: "wave_started", objectiveId: nextObjective.id });
  const base = { ...state, completedObjectiveIds, activeObjectiveIndex: nextIndex, events };
  const successThresholdReached = spec.completion.kind === "clear"
    && completedObjectiveIds.length >= spec.completion.successObjectiveCount;
  return { ...base, enemies: successThresholdReached ? [] : spawnWave(spec, base, nextIndex) };
}

export function stepActionSimulation(
  spec: ActionEncounterSpec,
  prior: ActionSimulationState,
  rawInput: Partial<ActionInput> = IDLE_INPUT,
): ActionSimulationState {
  if (prior.result) return prior;
  const input = normalizeActionInput(rawInput);
  let state = stepPlayer(spec, { ...prior, events: [] }, input);
  let player = state.player;
  let stats = state.stats;
  let events = state.events;
  const enemies = state.enemies.map((enemy) => {
    const stepped = stepEnemy(spec, { ...state, player, stats, events }, enemy);
    player = stepped.player;
    stats = stepped.stats;
    events = stepped.events;
    return stepped.enemy;
  });
  state = { ...state, tick: state.tick + 1, player, enemies, stats, events };
  state = stepSemanticObjective(spec, state, input);
  state = { ...state, previousButtons: input.buttons };
  state = advanceWave(spec, state);
  const result = terminalResult(spec, state);
  if (result) {
    state = { ...state, events: [...state.events, { type: "encounter_completed", outcome: result.outcome }], result };
  }
  return state;
}

export function runActionInputs(spec: ActionEncounterSpec, seed: number, inputs: readonly ActionInput[]): ActionSimulationState {
  let state = initialActionState(spec, seed);
  for (const input of inputs) {
    state = stepActionSimulation(spec, state, input);
    if (state.result) break;
  }
  return state;
}

export function replayActionTrace(spec: ActionEncounterSpec, seed: number, trace: readonly ActionInputRun[]): ActionSimulationState {
  let state = initialActionState(spec, seed);
  let totalTicks = 0;
  for (const run of trace) {
    if (!Number.isSafeInteger(run.ticks) || run.ticks <= 0 || run.ticks > spec.maxTicks) {
      throw new Error(`Action trace run length ${String(run.ticks)} is invalid.`);
    }
    totalTicks += run.ticks;
    if (totalTicks > spec.maxTicks) throw new Error("Action trace exceeds the encounter tick budget.");
    const input = normalizeActionInput(run.input);
    for (let tick = 0; tick < run.ticks; tick++) {
      state = stepActionSimulation(spec, state, input);
      if (state.result && tick !== run.ticks - 1) {
        throw new Error("Action trace contains input after its terminal result.");
      }
    }
    if (state.result && totalTicks !== state.result.totalTicks) {
      throw new Error("Action trace terminal tick does not match its encoded length.");
    }
  }
  return state;
}

export function compressActionInputs(inputs: readonly ActionInput[]): ActionInputRun[] {
  const runs: ActionInputRun[] = [];
  for (const raw of inputs) {
    const input = normalizeActionInput(raw);
    const last = runs[runs.length - 1];
    if (last && sameInput(last.input, input)) last.ticks += 1;
    else runs.push({ ticks: 1, input });
  }
  return runs;
}
