import type { ActionEncounterSpec, ActionInput, ActionInputRun, ActionSimulationState } from "../../src/engine/action/types.js";
import { ACTION_BUTTON } from "../../src/engine/action/types.js";
import { compareCodepoints } from "../../src/engine/determinism.js";
import { compressActionInputs, initialActionState, stepActionSimulation } from "../../src/engine/action/simulation.js";

function axis(value: number): -1 | 0 | 1 {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

/** A deterministic, intentionally simple competence oracle for regression
 * tests. It reads only the public action state, closes distance, faces the
 * nearest threat, parries imminent attacks, and pulses the light attack. */
export function buildCompetentTrace(spec: ActionEncounterSpec, seed: number): { trace: ActionInputRun[]; state: ActionSimulationState } {
  let state = initialActionState(spec, seed);
  const inputs: ActionInput[] = [];
  while (!state.result && inputs.length < spec.maxTicks) {
    const live = state.enemies
      .filter((enemy) => enemy.mode !== "defeated")
      .sort((left, right) => {
        const ld = (left.x - state.player.x) ** 2 + (left.y - state.player.y) ** 2;
        const rd = (right.x - state.player.x) ** 2 + (right.y - state.player.y) ** 2;
        return ld - rd || compareCodepoints(left.id, right.id);
      })[0];
    let input: ActionInput = { moveX: 0, moveY: 0, aimX: state.player.facingX, aimY: state.player.facingY, buttons: 0 };
    if (live) {
      const dx = live.x - state.player.x;
      const dy = live.y - state.player.y;
      const aimX = axis(dx);
      const aimY = axis(dy);
      const distanceSquared = dx * dx + dy * dy;
      const light = spec.player.attacks[0];
      const danger = live.mode === "active" || (live.mode === "telegraph" && live.modeTick >= spec.enemyLaws[live.kit].telegraphTicks - 2);
      if (state.player.mode === "idle" && danger) {
        input = { moveX: 0, moveY: 0, aimX, aimY, buttons: ACTION_BUTTON.parry };
      } else if (state.player.mode === "idle" && distanceSquared <= Math.trunc(light.range * 0.86) ** 2) {
        input = { moveX: 0, moveY: 0, aimX, aimY, buttons: ACTION_BUTTON.light };
      } else {
        input = { moveX: aimX, moveY: aimY, aimX, aimY, buttons: 0 };
      }
    }
    inputs.push(input);
    state = stepActionSimulation(spec, state, input);
  }
  if (!state.result) throw new Error("Competence oracle did not reach a terminal action result.");
  return { trace: compressActionInputs(inputs), state };
}

export function buildIdleTrace(spec: ActionEncounterSpec, seed: number): { trace: ActionInputRun[]; state: ActionSimulationState } {
  let state = initialActionState(spec, seed);
  const inputs: ActionInput[] = [];
  const idle: ActionInput = { moveX: 0, moveY: 0, aimX: 1, aimY: 0, buttons: 0 };
  while (!state.result && inputs.length < spec.maxTicks) {
    inputs.push(idle);
    state = stepActionSimulation(spec, state, idle);
  }
  if (!state.result) throw new Error("Idle trace did not reach a terminal action result.");
  return { trace: compressActionInputs(inputs), state };
}
