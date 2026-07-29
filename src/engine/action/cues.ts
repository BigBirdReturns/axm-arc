import { sha256Hex } from "../cartridge-digest.js";
import { compareCodepoints, orderRecordKeysDeep } from "../determinism.js";
import { initialActionState, stepActionSimulation } from "./simulation.js";
import type {
  ActionEncounterSpec,
  ActionInput,
  ActionObjectiveSpec,
  ActionPlayerMode,
  ActionSimulationState,
} from "./types.js";
import type { ActionSemanticCueId } from "./player-profile.js";

export const ACTION_SEMANTIC_CUE_FORMAT = "axm-action-cue/1" as const;
export const ACTION_CUE_TRACE_FORMAT = "axm-action-cue-trace/1" as const;

export type ActionCueSource = "parry_stagger" | "enemy_recovery";

export interface ActionSemanticCueCore {
  format: typeof ACTION_SEMANTIC_CUE_FORMAT;
  cueId: ActionSemanticCueId;
  tick: number;
  sequence: number;
  subjectId: string;
  objectiveId?: string;
  targetId?: string;
  action?: "light" | "heavy" | "dodge" | "parry";
  durationTicks?: number;
  progress?: number;
  target?: number;
  outcome?: "success" | "partial" | "failure";
  source?: ActionCueSource;
}

export interface ActionSemanticCue extends ActionSemanticCueCore {
  cueDigest: string;
}

export interface ActionCueTraceCore {
  format: typeof ACTION_CUE_TRACE_FORMAT;
  actionSpecDigest: string;
  seed: number;
  totalTicks: number;
  cues: ActionSemanticCue[];
}

export interface ActionCueTrace extends ActionCueTraceCore {
  cueTraceDigest: string;
}

type CueCandidate = Omit<ActionSemanticCueCore, "format" | "sequence">;

const CUE_ORDER: Record<ActionSemanticCueId, number> = {
  "cue.mechanism-available": 10,
  "cue.player-action-started": 20,
  "cue.defense-window-opened": 21,
  "cue.dodge-invulnerability": 22,
  "cue.enemy-attack-anticipated": 30,
  "cue.player-action-active": 40,
  "cue.enemy-attack-active": 50,
  "cue.parry-succeeded": 60,
  "cue.enemy-stagger-started": 61,
  "cue.work-window-opened": 62,
  "cue.enemy-attack-recovery": 63,
  "cue.mechanism-progress": 70,
  "cue.objective-completed": 80,
  "cue.work-window-closed": 81,
  "cue.player-action-recovery": 90,
  "cue.defense-window-closed": 91,
  "cue.encounter-completed": 100,
};

function canonical(value: unknown): string {
  return JSON.stringify(orderRecordKeysDeep(value));
}

function cueDigest(core: ActionSemanticCueCore): string {
  return "actcue1_" + sha256Hex(canonical(core));
}

function cueTraceDigest(core: ActionCueTraceCore): string {
  return "actcuetrace1_" + sha256Hex(canonical(core));
}

function compareOptional(left: string | undefined, right: string | undefined): number {
  return compareCodepoints(left ?? "", right ?? "");
}

function finalize(candidates: CueCandidate[]): ActionSemanticCue[] {
  return [...candidates]
    .sort((left, right) => (
      CUE_ORDER[left.cueId] - CUE_ORDER[right.cueId]
      || compareCodepoints(left.subjectId, right.subjectId)
      || compareOptional(left.objectiveId, right.objectiveId)
      || compareOptional(left.targetId, right.targetId)
      || compareOptional(left.action, right.action)
      || compareOptional(left.source, right.source)
    ))
    .map((candidate, sequence) => {
      const core: ActionSemanticCueCore = {
        format: ACTION_SEMANTIC_CUE_FORMAT,
        ...candidate,
        sequence,
      };
      return orderRecordKeysDeep({ ...core, cueDigest: cueDigest(core) }) as ActionSemanticCue;
    });
}

function activeObjective(spec: ActionEncounterSpec, state: ActionSimulationState): ActionObjectiveSpec | null {
  return spec.objectives[state.activeObjectiveIndex] ?? null;
}

function objectiveTargets(objective: ActionObjectiveSpec | null): Array<{ id: string }> {
  const completion = objective?.semanticCompletion;
  if (!completion) return [];
  return completion.kind === "interact_count"
    ? [...completion.targets].sort((left, right) => compareCodepoints(left.id, right.id))
    : [completion.target];
}

function mechanismAvailableCandidates(
  spec: ActionEncounterSpec,
  state: ActionSimulationState,
): CueCandidate[] {
  const objective = activeObjective(spec, state);
  if (!objective?.semanticCompletion) return [];
  const completed = new Set(state.completedInteractionTargetIds ?? []);
  return objectiveTargets(objective)
    .filter((target) => !completed.has(target.id))
    .map((target) => ({
      cueId: "cue.mechanism-available" as const,
      tick: state.tick,
      subjectId: target.id,
      objectiveId: objective.id,
      targetId: target.id,
    }));
}

function playerActionTotalTicks(spec: ActionEncounterSpec, mode: ActionPlayerMode): number | undefined {
  if (mode === "dodge") return spec.player.dodgeTicks;
  if (mode === "parry") return spec.player.parryTicks + spec.player.parryRecoveryTicks;
  if (mode === "light" || mode === "heavy") {
    const attack = spec.player.attacks[mode === "light" ? 0 : 1];
    return attack.startupTicks + attack.activeTicks + attack.recoveryTicks;
  }
  return undefined;
}

function playerCandidates(
  spec: ActionEncounterSpec,
  prior: ActionSimulationState,
  next: ActionSimulationState,
): CueCandidate[] {
  const cues: CueCandidate[] = [];
  const priorPlayer = prior.player;
  const nextPlayer = next.player;
  const actionModes: ActionPlayerMode[] = ["light", "heavy", "dodge", "parry"];

  if (actionModes.includes(nextPlayer.mode) && priorPlayer.mode !== nextPlayer.mode) {
    const action = nextPlayer.mode as "light" | "heavy" | "dodge" | "parry";
    cues.push({
      cueId: "cue.player-action-started",
      tick: next.tick,
      subjectId: "player",
      action,
      durationTicks: playerActionTotalTicks(spec, nextPlayer.mode),
    });
    if (action === "parry") {
      cues.push({
        cueId: "cue.defense-window-opened",
        tick: next.tick,
        subjectId: "player",
        action,
        durationTicks: spec.player.parryActiveTicks,
      });
    }
    if (action === "dodge") {
      cues.push({
        cueId: "cue.dodge-invulnerability",
        tick: next.tick,
        subjectId: "player",
        action,
        durationTicks: spec.player.dodgeInvulnerableTicks,
      });
    }
  }

  for (const mode of ["light", "heavy"] as const) {
    if (priorPlayer.mode !== mode || nextPlayer.mode !== mode) continue;
    const attack = spec.player.attacks[mode === "light" ? 0 : 1];
    const activeStart = attack.startupTicks;
    const recoveryStart = activeStart + attack.activeTicks;
    if (priorPlayer.modeTick < activeStart && nextPlayer.modeTick >= activeStart) {
      cues.push({
        cueId: "cue.player-action-active",
        tick: next.tick,
        subjectId: "player",
        action: mode,
        durationTicks: attack.activeTicks,
      });
    }
    if (priorPlayer.modeTick < recoveryStart && nextPlayer.modeTick >= recoveryStart) {
      cues.push({
        cueId: "cue.player-action-recovery",
        tick: next.tick,
        subjectId: "player",
        action: mode,
        durationTicks: attack.recoveryTicks,
      });
    }
  }

  if (priorPlayer.mode === "parry") {
    const priorOpen = priorPlayer.modeTick < spec.player.parryActiveTicks;
    const nextOpen = nextPlayer.mode === "parry" && nextPlayer.modeTick < spec.player.parryActiveTicks;
    if (priorOpen && !nextOpen) {
      cues.push({
        cueId: "cue.defense-window-closed",
        tick: next.tick,
        subjectId: "player",
        action: "parry",
      });
    }
    const recoveryStart = spec.player.parryTicks;
    if (nextPlayer.mode === "parry" && priorPlayer.modeTick < recoveryStart && nextPlayer.modeTick >= recoveryStart) {
      cues.push({
        cueId: "cue.player-action-recovery",
        tick: next.tick,
        subjectId: "player",
        action: "parry",
        durationTicks: spec.player.parryRecoveryTicks,
      });
    }
  }
  return cues;
}

function enemyCandidates(
  spec: ActionEncounterSpec,
  prior: ActionSimulationState,
  next: ActionSimulationState,
): CueCandidate[] {
  const cues: CueCandidate[] = [];
  const priorById = new Map(prior.enemies.map((enemy) => [enemy.id, enemy]));
  const objectiveId = activeObjective(spec, next)?.id ?? activeObjective(spec, prior)?.id;

  for (const enemy of [...next.enemies].sort((left, right) => compareCodepoints(left.id, right.id))) {
    const before = priorById.get(enemy.id);
    if (!before || before.mode === enemy.mode) continue;
    const law = spec.enemyLaws[enemy.kit];
    if (before.mode === "approach" && enemy.mode === "telegraph") {
      cues.push({
        cueId: "cue.enemy-attack-anticipated",
        tick: next.tick,
        subjectId: enemy.id,
        objectiveId,
        durationTicks: law.telegraphTicks,
      });
    }
    if (before.mode === "telegraph" && enemy.mode === "active") {
      cues.push({
        cueId: "cue.enemy-attack-active",
        tick: next.tick,
        subjectId: enemy.id,
        objectiveId,
        durationTicks: law.activeTicks,
      });
    }
    if (before.mode === "active" && enemy.mode === "recover") {
      cues.push({
        cueId: "cue.enemy-attack-recovery",
        tick: next.tick,
        subjectId: enemy.id,
        objectiveId,
        durationTicks: law.recoveryTicks,
      });
      cues.push({
        cueId: "cue.work-window-opened",
        tick: next.tick,
        subjectId: enemy.id,
        objectiveId,
        durationTicks: law.recoveryTicks,
        source: "enemy_recovery",
      });
    }
    if (enemy.mode === "stagger" && before.mode !== "stagger") {
      cues.push({
        cueId: "cue.enemy-stagger-started",
        tick: next.tick,
        subjectId: enemy.id,
        objectiveId,
        durationTicks: law.staggerTicks,
      });
      cues.push({
        cueId: "cue.work-window-opened",
        tick: next.tick,
        subjectId: enemy.id,
        objectiveId,
        durationTicks: law.staggerTicks,
        source: "parry_stagger",
      });
    }
    if (before.mode === "recover" && enemy.mode === "approach") {
      cues.push({
        cueId: "cue.work-window-closed",
        tick: next.tick,
        subjectId: enemy.id,
        objectiveId,
        source: "enemy_recovery",
      });
    }
    if (before.mode === "stagger" && enemy.mode === "approach") {
      cues.push({
        cueId: "cue.work-window-closed",
        tick: next.tick,
        subjectId: enemy.id,
        objectiveId,
        source: "parry_stagger",
      });
    }
  }
  return cues;
}

function eventCandidates(
  spec: ActionEncounterSpec,
  next: ActionSimulationState,
): CueCandidate[] {
  const cues: CueCandidate[] = [];
  for (const event of next.events) {
    if (event.type === "parry") {
      cues.push({
        cueId: "cue.parry-succeeded",
        tick: next.tick,
        subjectId: event.enemyId,
        objectiveId: activeObjective(spec, next)?.id,
      });
    } else if (event.type === "objective_progress") {
      cues.push({
        cueId: "cue.mechanism-progress",
        tick: next.tick,
        subjectId: event.targetId ?? event.objectiveId,
        objectiveId: event.objectiveId,
        targetId: event.targetId ?? undefined,
        progress: event.progress,
        target: event.target,
      });
    } else if (event.type === "objective_completed") {
      cues.push({
        cueId: "cue.objective-completed",
        tick: next.tick,
        subjectId: event.objectiveId,
        objectiveId: event.objectiveId,
      });
    } else if (event.type === "encounter_completed") {
      cues.push({
        cueId: "cue.encounter-completed",
        tick: next.tick,
        subjectId: spec.challengeId,
        outcome: event.outcome,
      });
    }
  }
  return cues;
}

export function projectInitialActionCues(
  spec: ActionEncounterSpec,
  state: ActionSimulationState,
): ActionSemanticCue[] {
  return finalize(mechanismAvailableCandidates(spec, state));
}

export function projectActionSemanticCues(
  spec: ActionEncounterSpec,
  prior: ActionSimulationState,
  next: ActionSimulationState,
): ActionSemanticCue[] {
  const candidates: CueCandidate[] = [
    ...playerCandidates(spec, prior, next),
    ...enemyCandidates(spec, prior, next),
    ...eventCandidates(spec, next),
  ];
  if (prior.activeObjectiveIndex !== next.activeObjectiveIndex && !next.result) {
    candidates.push(...mechanismAvailableCandidates(spec, next));
  }
  return finalize(candidates);
}

export function buildActionCueTrace(
  spec: ActionEncounterSpec,
  seed: number,
  inputs: readonly ActionInput[],
): ActionCueTrace {
  let state = initialActionState(spec, seed);
  const cues = [...projectInitialActionCues(spec, state)];
  for (const input of inputs) {
    const next = stepActionSimulation(spec, state, input);
    cues.push(...projectActionSemanticCues(spec, state, next));
    state = next;
    if (state.result) break;
  }
  const core: ActionCueTraceCore = {
    format: ACTION_CUE_TRACE_FORMAT,
    actionSpecDigest: spec.specDigest,
    seed: seed >>> 0,
    totalTicks: state.tick,
    cues,
  };
  return orderRecordKeysDeep({ ...core, cueTraceDigest: cueTraceDigest(core) }) as ActionCueTrace;
}
