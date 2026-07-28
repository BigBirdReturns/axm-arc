import { describe, expect, it } from "vitest";
import { validateArc } from "../../src/engine/schema.js";
import { compileActionEncounter } from "../../src/engine/action/compile.js";
import {
  ACTION_BUTTON,
  ACTION_OBJECTIVE_EXTENSION_KEY,
  ACTION_OBJECTIVE_PROFILE_FORMAT,
  ACTION_RUNTIME_VERSION,
  ACTION_SEMANTIC_RUNTIME_VERSION,
  type ActionInputRun,
  type ActionObjectiveProfile,
} from "../../src/engine/action/types.js";
import { initialActionState, stepActionSimulation } from "../../src/engine/action/simulation.js";
import { buildActionReceipt, verifyActionReceipt } from "../../src/engine/action/receipt.js";
import { MINI_ARC } from "../fixtures/mini-arc.js";

function semanticArc(authoring: ActionObjectiveProfile["encounters"][string]) {
  const raw = structuredClone(MINI_ARC);
  raw.meta = { ...raw.meta, engineVersion: "1.4.0" };
  raw.challenges = raw.challenges.map((challenge) => challenge.id === "mini-challenge"
    ? {
        ...challenge,
        difficultyRating: 1,
        mechanicChecks: [{
          ...challenge.mechanicChecks[0]!,
          difficultyThreshold: 1,
        }],
        timePressure: null,
      }
    : challenge);
  raw.extensions = {
    ...(raw.extensions ?? {}),
    [ACTION_OBJECTIVE_EXTENSION_KEY]: {
      format: ACTION_OBJECTIVE_PROFILE_FORMAT,
      encounters: { "mini-challenge": authoring },
    },
  };
  return validateArc(raw);
}

const IDLE = { moveX: 0 as const, moveY: 0 as const, aimX: 0 as const, aimY: 0 as const, buttons: 0 };

describe("axm-action-objectives/1", () => {
  it("preserves runtime-1.0 law and exact legacy objective shape when no semantic profile exists", () => {
    const spec = compileActionEncounter(MINI_ARC, MINI_ARC.challenges[0]!);
    expect(spec.runtimeVersion).toBe(ACTION_RUNTIME_VERSION);
    expect(spec.objectives.every((objective) => objective.semanticCompletion === undefined)).toBe(true);
    expect(spec.objectives.map((objective) => Object.keys(objective).sort())).toEqual(
      spec.objectives.map(() => [
        "brief",
        "enemyCount",
        "enemyKit",
        "failureKind",
        "id",
        "label",
        "severity",
        "targetDefeats",
      ]),
    );
  });

  it("allows a safe first-minute mechanism objective without inventing a hidden combatant", () => {
    const arc = semanticArc({
      "check-power": {
        kind: "interact_count",
        targetCount: 1,
        radius: 3000,
        pressureEnemyCount: 0,
      },
    });
    const spec = compileActionEncounter(arc, arc.challenges[0]!);
    const objective = spec.objectives[0]!;
    expect(spec.runtimeVersion).toBe(ACTION_SEMANTIC_RUNTIME_VERSION);
    expect(objective.enemyCount).toBe(0);
    expect(objective.targetDefeats).toBe(0);
    let state = initialActionState(spec, 13);
    expect(state.enemies).toEqual([]);
    expect(state.completedObjectiveIds).toEqual([]);
    expect(state.result).toBeNull();

    const target = objective.semanticCompletion?.kind === "interact_count"
      ? objective.semanticCompletion.targets[0]!
      : null;
    expect(target).not.toBeNull();
    state = { ...state, player: { ...state.player, x: target!.x, y: target!.y } };
    state = stepActionSimulation(spec, state, { ...IDLE, buttons: ACTION_BUTTON.interact });
    expect(state.result?.outcome).toBe("success");
    expect(state.stats.enemiesDefeated).toBe(0);
    expect(state.stats.objectiveInteractions).toBe(1);
  });

  it("completes an interact objective only through its authored mechanism, not by clearing pressure enemies", () => {
    const arc = semanticArc({
      "check-power": { kind: "interact_count", targetCount: 1, radius: 3000 },
    });
    const challenge = arc.challenges[0]!;
    const spec = compileActionEncounter(arc, challenge);
    expect(spec.runtimeVersion).toBe(ACTION_SEMANTIC_RUNTIME_VERSION);
    const objective = spec.objectives[0]!;
    expect(objective.semanticCompletion?.kind).toBe("interact_count");

    let state = initialActionState(spec, 17);
    state = {
      ...state,
      enemies: state.enemies.map((enemy) => ({ ...enemy, health: 0, mode: "defeated" as const })),
    };
    state = stepActionSimulation(spec, state, IDLE);
    expect(state.completedObjectiveIds).toEqual([]);
    expect(state.result).toBeNull();

    const target = objective.semanticCompletion!.kind === "interact_count"
      ? objective.semanticCompletion!.targets[0]!
      : null;
    expect(target).not.toBeNull();
    state = {
      ...state,
      player: { ...state.player, x: target!.x, y: target!.y },
    };
    state = stepActionSimulation(spec, state, { ...IDLE, buttons: ACTION_BUTTON.interact });
    expect(state.completedObjectiveIds).toEqual(["check-power"]);
    expect(state.result?.outcome).toBe("success");
    expect(state.stats.objectiveInteractions).toBe(1);
    expect(state.result?.objectives[0]).toMatchObject({
      id: "check-power",
      kind: "interact_count",
      progress: 1,
      target: 1,
      completed: true,
    });
  });

  it("replays and verifies an interaction trace as an accepted runtime-1.1 receipt", () => {
    const arc = semanticArc({
      "check-power": { kind: "interact_count", targetCount: 1, radius: 3000 },
    });
    const challenge = arc.challenges[0]!;
    const trace: ActionInputRun[] = [
      { ticks: 6, input: { ...IDLE, moveY: -1 } },
      { ticks: 1, input: { ...IDLE, buttons: ACTION_BUTTON.interact } },
    ];
    const receipt = buildActionReceipt({
      arc,
      challenge,
      cycle: 0,
      orgSeed: 0x1234,
      controlledAgentId: "founder:operator",
      partyAgentIds: ["founder:operator"],
      trace,
    });
    expect(receipt.runtimeVersion).toBe(ACTION_SEMANTIC_RUNTIME_VERSION);
    expect(receipt.result.outcome).toBe("success");
    expect(receipt.result.objectives[0]).toMatchObject({ kind: "interact_count", progress: 1, completed: true });
    expect(verifyActionReceipt({
      arc,
      challenge,
      cycle: 0,
      orgSeed: 0x1234,
      partyAgentIds: ["founder:operator"],
      receipt,
    }).receipt).toEqual(receipt);
  });

  it("requires continuous authored hold input while pressure enemies remain active", () => {
    const arc = semanticArc({
      "check-power": { kind: "hold_ticks", targetTicks: 3, radius: 3000 },
    });
    const spec = compileActionEncounter(arc, arc.challenges[0]!);
    const objective = spec.objectives[0]!;
    expect(objective.semanticCompletion?.kind).toBe("hold_ticks");
    const target = objective.semanticCompletion!.kind === "hold_ticks"
      ? objective.semanticCompletion!.target
      : null;
    expect(target).not.toBeNull();

    let state = initialActionState(spec, 29);
    state = { ...state, player: { ...state.player, x: target!.x, y: target!.y } };
    state = stepActionSimulation(spec, state, { ...IDLE, buttons: ACTION_BUTTON.interact });
    expect(state.objectiveProgress?.["check-power"]).toBe(1);
    state = stepActionSimulation(spec, state, IDLE);
    expect(state.objectiveProgress?.["check-power"]).toBe(1);
    state = stepActionSimulation(spec, state, { ...IDLE, buttons: ACTION_BUTTON.interact });
    state = stepActionSimulation(spec, state, { ...IDLE, buttons: ACTION_BUTTON.interact });
    expect(state.result?.outcome).toBe("success");
    expect(state.stats.objectiveHoldTicks).toBe(3);
    expect(state.stats.enemiesDefeated).toBe(0);
  });

  it("refuses unknown objective references, invalid pressure populations, and an old engine floor", () => {
    const unknown = structuredClone(MINI_ARC);
    unknown.meta = { ...unknown.meta, engineVersion: "1.4.0" };
    unknown.extensions = {
      ...(unknown.extensions ?? {}),
      [ACTION_OBJECTIVE_EXTENSION_KEY]: {
        format: ACTION_OBJECTIVE_PROFILE_FORMAT,
        encounters: {
          "mini-challenge": { ghost: { kind: "interact_count", targetCount: 1 } },
        },
      },
    };
    expect(() => validateArc(unknown)).toThrow(/Unknown objective id/);

    const excessive = structuredClone(MINI_ARC);
    excessive.meta = { ...excessive.meta, engineVersion: "1.4.0" };
    excessive.extensions = {
      ...(excessive.extensions ?? {}),
      [ACTION_OBJECTIVE_EXTENSION_KEY]: {
        format: ACTION_OBJECTIVE_PROFILE_FORMAT,
        encounters: {
          "mini-challenge": {
            "check-power": { kind: "interact_count", targetCount: 1, pressureEnemyCount: 13 },
          },
        },
      },
    };
    expect(() => validateArc(excessive)).toThrow(/less than or equal to 12/i);

    const old = structuredClone(MINI_ARC);
    old.meta = { ...old.meta, engineVersion: "1.3.0" };
    old.extensions = {
      ...(old.extensions ?? {}),
      [ACTION_OBJECTIVE_EXTENSION_KEY]: {
        format: ACTION_OBJECTIVE_PROFILE_FORMAT,
        encounters: {
          "mini-challenge": { "check-power": { kind: "interact_count", targetCount: 1 } },
        },
      },
    };
    expect(() => validateArc(old)).toThrow(/requires engineVersion 1\.4\.0 or newer/);
  });
});
