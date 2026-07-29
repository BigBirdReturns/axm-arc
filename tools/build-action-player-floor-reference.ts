import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { compileActionEncounter } from "../src/engine/action/compile.js";
import { buildActionCueTrace } from "../src/engine/action/cues.js";
import { actionSeed, buildActionReceipt, verifyActionReceipt } from "../src/engine/action/receipt.js";
import { compressActionInputs, initialActionState, stepActionSimulation } from "../src/engine/action/simulation.js";
import {
  ACTION_BUTTON,
  type ActionEncounterSpec,
  type ActionInput,
  type ActionSimulationState,
} from "../src/engine/action/types.js";
import { cartridgeDigest } from "../src/engine/cartridge-digest.js";
import { compareCodepoints, orderRecordKeysDeep } from "../src/engine/determinism.js";
import {
  UNDERDRAIN_ACTION_PLAYER_PROFILE,
  UNDERDRAIN_PLAYER_ARC,
  UNDERDRAIN_PLAYER_PUMP_CHALLENGE,
} from "../src/demos/underdrain/index.js";

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1] ?? null;
}

function axis(value: number): -1 | 0 | 1 {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

function nearestLiveEnemy(state: ActionSimulationState) {
  return state.enemies
    .filter((enemy) => enemy.mode !== "defeated")
    .sort((left, right) => {
      const leftDistance = (left.x - state.player.x) ** 2 + (left.y - state.player.y) ** 2;
      const rightDistance = (right.x - state.player.x) ** 2 + (right.y - state.player.y) ** 2;
      return leftDistance - rightDistance || compareCodepoints(left.id, right.id);
    })[0];
}

function buildCompetentInputs(spec: ActionEncounterSpec, seed: number): ActionInput[] {
  let state = initialActionState(spec, seed);
  const inputs: ActionInput[] = [];
  while (!state.result && inputs.length < spec.maxTicks) {
    const objective = spec.objectives[state.activeObjectiveIndex];
    const completion = objective?.semanticCompletion;
    const live = nearestLiveEnemy(state);
    let input: ActionInput = {
      moveX: 0,
      moveY: 0,
      aimX: state.player.facingX,
      aimY: state.player.facingY,
      buttons: 0,
    };

    if (completion) {
      const completed = new Set(state.completedInteractionTargetIds ?? []);
      const target = completion.kind === "interact_count"
        ? completion.targets.find((candidate) => !completed.has(candidate.id))
        : completion.target;
      if (target) {
        const dx = target.x - state.player.x;
        const dy = target.y - state.player.y;
        const aimX = axis(dx);
        const aimY = axis(dy);
        const distanceSquared = dx * dx + dy * dy;
        if (live && state.player.mode === "idle") {
          const law = spec.enemyLaws[live.kit];
          const danger = live.mode === "active"
            || (live.mode === "telegraph" && live.modeTick >= Math.max(0, law.telegraphTicks - 3));
          if (danger) {
            input = {
              moveX: 0,
              moveY: 0,
              aimX: axis(live.x - state.player.x) || state.player.facingX,
              aimY: axis(live.y - state.player.y),
              buttons: ACTION_BUTTON.parry,
            };
          } else if (distanceSquared <= Math.trunc(target.radius * 0.8) ** 2) {
            input = {
              moveX: 0,
              moveY: 0,
              aimX: aimX || state.player.facingX,
              aimY: aimY || state.player.facingY,
              buttons: ACTION_BUTTON.interact,
            };
          } else {
            input = { moveX: aimX, moveY: aimY, aimX, aimY, buttons: 0 };
          }
        } else if (distanceSquared <= Math.trunc(target.radius * 0.8) ** 2) {
          input = {
            moveX: 0,
            moveY: 0,
            aimX: aimX || state.player.facingX,
            aimY: aimY || state.player.facingY,
            buttons: ACTION_BUTTON.interact,
          };
        } else {
          input = { moveX: aimX, moveY: aimY, aimX, aimY, buttons: 0 };
        }
      }
    } else if (live) {
      const dx = live.x - state.player.x;
      const dy = live.y - state.player.y;
      const aimX = axis(dx);
      const aimY = axis(dy);
      const distanceSquared = dx * dx + dy * dy;
      const light = spec.player.attacks[0];
      const law = spec.enemyLaws[live.kit];
      const danger = live.mode === "active"
        || (live.mode === "telegraph" && live.modeTick >= Math.max(0, law.telegraphTicks - 3));
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
  if (!state.result) throw new Error("UNDERDRAIN player-floor reference did not reach a terminal result.");
  return inputs;
}

const output = resolve(argument("--output") ?? "local/action-player-floor/reference.json");
const timingProfileId = argument("--timing-profile") ?? "forgiving";
const cycle = 2;
const orgSeed = 0x5eed_2026;
const spec = compileActionEncounter(
  UNDERDRAIN_PLAYER_ARC,
  UNDERDRAIN_PLAYER_PUMP_CHALLENGE,
  null,
  timingProfileId,
);
const seed = actionSeed(orgSeed, cycle, UNDERDRAIN_PLAYER_PUMP_CHALLENGE.id, null, timingProfileId);
const inputs = buildCompetentInputs(spec, seed);
const trace = compressActionInputs(inputs);
const receipt = buildActionReceipt({
  arc: UNDERDRAIN_PLAYER_ARC,
  challenge: UNDERDRAIN_PLAYER_PUMP_CHALLENGE,
  timingProfileId,
  cycle,
  orgSeed,
  controlledAgentId: "rhea-venn",
  partyAgentIds: ["rhea-venn"],
  trace,
});
verifyActionReceipt({
  arc: UNDERDRAIN_PLAYER_ARC,
  challenge: UNDERDRAIN_PLAYER_PUMP_CHALLENGE,
  timingProfileId,
  cycle,
  orgSeed,
  partyAgentIds: ["rhea-venn"],
  receipt,
});
const cueTrace = buildActionCueTrace(spec, seed, inputs);
const cueIds = [...new Set(cueTrace.cues.map((cue) => cue.cueId))].sort(compareCodepoints);
const record = orderRecordKeysDeep({
  format: "axm-action-player-reference/1",
  arcDigest: cartridgeDigest(UNDERDRAIN_PLAYER_ARC),
  actionSpecDigest: spec.specDigest,
  timingProfileId,
  profile: UNDERDRAIN_ACTION_PLAYER_PROFILE,
  inputFrames: inputs.length,
  compressedInputRuns: trace.length,
  acceptedReceipt: receipt,
  cueTrace,
  cueIds,
  boundary: {
    cueAuthority: "presentation-only",
    outcomeAuthority: "Arc replay",
    providerSelected: false,
    playerAcceptanceClaimed: false,
  },
});
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(record, null, 2) + "\n");
console.log(JSON.stringify({
  status: "pass",
  output,
  actionSpecDigest: spec.specDigest,
  receiptDigest: receipt.receiptDigest,
  cueTraceDigest: cueTrace.cueTraceDigest,
  cueCount: cueTrace.cues.length,
  cueIds,
}, null, 2));
