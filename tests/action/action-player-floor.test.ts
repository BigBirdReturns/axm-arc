import { describe, expect, it } from "vitest";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";
import { hashSeed } from "../../src/engine/prng.js";
import { validateArc } from "../../src/engine/schema.js";
import { compileActionEncounter } from "../../src/engine/action/compile.js";
import {
  buildActionCueTrace,
  projectActionSemanticCues,
  projectInitialActionCues,
} from "../../src/engine/action/cues.js";
import {
  ACTION_PLAYER_EXTENSION_KEY,
  defaultActionTimingProfileId,
  parseActionPlayerProfile,
  readActionPlayerProfile,
} from "../../src/engine/action/player-profile.js";
import {
  actionSeed,
  buildActionReceipt,
  verifyActionReceipt,
} from "../../src/engine/action/receipt.js";
import {
  compressActionInputs,
  initialActionState,
  stepActionSimulation,
} from "../../src/engine/action/simulation.js";
import {
  ACTION_BUTTON,
  type ActionEncounterSpec,
  type ActionInput,
  type ActionSimulationState,
} from "../../src/engine/action/types.js";
import {
  UNDERDRAIN_ACTION_PLAYER_PROFILE,
  UNDERDRAIN_CHALLENGE,
  UNDERDRAIN_DRAFT_ARC,
  UNDERDRAIN_PLAYER_ARC,
  UNDERDRAIN_PLAYER_PUMP_CHALLENGE,
  UNDERDRAIN_PLAYER_SERVICE_CHALLENGE,
  UNDERDRAIN_SERVICE_CHALLENGE,
} from "../../src/demos/underdrain/index.js";

function axis(value: number): -1 | 0 | 1 {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

function buildSafeMechanismInputs(spec: ActionEncounterSpec, seed: number): ActionInput[] {
  let state = initialActionState(spec, seed);
  const inputs: ActionInput[] = [];
  while (!state.result && inputs.length < spec.maxTicks) {
    const objective = spec.objectives[state.activeObjectiveIndex];
    const completion = objective?.semanticCompletion;
    if (!objective || !completion) throw new Error("Expected a semantic mechanism objective.");
    const completed = new Set(state.completedInteractionTargetIds ?? []);
    const target = completion.kind === "interact_count"
      ? completion.targets.find((candidate) => !completed.has(candidate.id))
      : completion.target;
    if (!target) throw new Error("Expected an available mechanism target.");
    const dx = target.x - state.player.x;
    const dy = target.y - state.player.y;
    const within = dx * dx + dy * dy <= Math.trunc(target.radius * 0.8) ** 2;
    const input: ActionInput = within
      ? {
          moveX: 0,
          moveY: 0,
          aimX: axis(dx) || state.player.facingX,
          aimY: axis(dy) || state.player.facingY,
          buttons: ACTION_BUTTON.interact,
        }
      : {
          moveX: axis(dx),
          moveY: axis(dy),
          aimX: axis(dx),
          aimY: axis(dy),
          buttons: 0,
        };
    inputs.push(input);
    state = stepActionSimulation(spec, state, input);
  }
  if (!state.result) throw new Error("Safe mechanism trace did not terminate.");
  return inputs;
}

function cueIds(cues: ReturnType<typeof projectActionSemanticCues>): string[] {
  return cues.map((cue) => cue.cueId);
}

describe("Action Player Floor", () => {
  it("keeps the player profile inside Arc authority and validates teach, practice, and mastery", () => {
    const validated = validateArc(UNDERDRAIN_PLAYER_ARC);
    const profile = readActionPlayerProfile(validated);
    expect(profile).toEqual(UNDERDRAIN_ACTION_PLAYER_PROFILE);
    expect(profile?.learning.parry.map((stage) => stage.stage)).toEqual(["teach", "practice", "master"]);
    expect(profile?.learning.parry[0]).toMatchObject({ mandatory: false, safeOrLowDamage: true });
    expect(profile?.learning.parry[1]).toMatchObject({ mandatory: false });
    expect(profile?.learning.parry[2]).toMatchObject({ mandatory: true, alternate: { kind: "enemy_recovery" } });
    expect(defaultActionTimingProfileId(validated, UNDERDRAIN_CHALLENGE.id)).toBe("forgiving");
    expect(cartridgeDigest(validated)).not.toBe(cartridgeDigest(UNDERDRAIN_DRAFT_ARC));

    expect(() => parseActionPlayerProfile({
      ...structuredClone(UNDERDRAIN_ACTION_PLAYER_PROFILE),
      provider: "forbidden-renderer",
    })).toThrow(/Unrecognized key|unrecognized/i);

    const broken = structuredClone(UNDERDRAIN_ACTION_PLAYER_PROFILE);
    delete broken.learning.parry[2]!.alternate;
    expect(() => validateArc({
      ...structuredClone(UNDERDRAIN_DRAFT_ARC),
      extensions: {
        ...structuredClone(UNDERDRAIN_DRAFT_ARC.extensions ?? {}),
        [ACTION_PLAYER_EXTENSION_KEY]: broken,
      },
    })).toThrow(/Mandatory mastery requires an authored alternate completion route/);
  });

  it("preserves the legacy compile and seed path while making timing profiles receipt-owned", () => {
    const legacy = compileActionEncounter(UNDERDRAIN_DRAFT_ARC, UNDERDRAIN_CHALLENGE);
    expect(legacy).not.toHaveProperty("timingProfileId");
    expect(actionSeed(11, 2, UNDERDRAIN_CHALLENGE.id, null)).toBe(
      hashSeed(11, 2, UNDERDRAIN_CHALLENGE.id, "base", "axm-action/1"),
    );

    const base = compileActionEncounter(UNDERDRAIN_PLAYER_ARC, UNDERDRAIN_PLAYER_PUMP_CHALLENGE);
    const forgiving = compileActionEncounter(UNDERDRAIN_PLAYER_ARC, UNDERDRAIN_PLAYER_PUMP_CHALLENGE, null, "forgiving");
    const standard = compileActionEncounter(UNDERDRAIN_PLAYER_ARC, UNDERDRAIN_PLAYER_PUMP_CHALLENGE, null, "standard");
    const precision = compileActionEncounter(UNDERDRAIN_PLAYER_ARC, UNDERDRAIN_PLAYER_PUMP_CHALLENGE, null, "precision");
    expect(base).not.toHaveProperty("timingProfileId");
    expect(forgiving.timingProfileId).toBe("forgiving");
    expect(forgiving.player.parryActiveTicks).toBeGreaterThan(standard.player.parryActiveTicks);
    expect(standard.player.parryActiveTicks).toBeGreaterThan(precision.player.parryActiveTicks);
    expect(forgiving.enemyLaws.breaker.telegraphTicks).toBeGreaterThan(precision.enemyLaws.breaker.telegraphTicks);
    expect(new Set([base.specDigest, forgiving.specDigest, standard.specDigest, precision.specDigest]).size).toBe(4);
    expect(() => compileActionEncounter(
      UNDERDRAIN_PLAYER_ARC,
      UNDERDRAIN_PLAYER_PUMP_CHALLENGE,
      null,
      "not-authored",
    )).toThrow(/not allowed|not found/);
  });

  it("replays and verifies a selected timing profile through the accepted receipt", () => {
    const timingProfileId = "forgiving";
    const spec = compileActionEncounter(
      UNDERDRAIN_PLAYER_ARC,
      UNDERDRAIN_PLAYER_SERVICE_CHALLENGE,
      null,
      timingProfileId,
    );
    const orgSeed = 0x1981;
    const cycle = 1;
    const seed = actionSeed(orgSeed, cycle, UNDERDRAIN_PLAYER_SERVICE_CHALLENGE.id, null, timingProfileId);
    const inputs = buildSafeMechanismInputs(spec, seed);
    const receipt = buildActionReceipt({
      arc: UNDERDRAIN_PLAYER_ARC,
      challenge: UNDERDRAIN_PLAYER_SERVICE_CHALLENGE,
      timingProfileId,
      cycle,
      orgSeed,
      controlledAgentId: "rhea-venn",
      partyAgentIds: ["rhea-venn"],
      trace: compressActionInputs(inputs),
    });
    expect(receipt).toMatchObject({
      timingProfileId,
      actionSpecDigest: spec.specDigest,
      result: { outcome: "success" },
    });
    expect(verifyActionReceipt({
      arc: UNDERDRAIN_PLAYER_ARC,
      challenge: UNDERDRAIN_PLAYER_SERVICE_CHALLENGE,
      timingProfileId,
      cycle,
      orgSeed,
      partyAgentIds: ["rhea-venn"],
      receipt,
    }).receipt).toEqual(receipt);
    expect(() => verifyActionReceipt({
      arc: UNDERDRAIN_PLAYER_ARC,
      challenge: UNDERDRAIN_PLAYER_SERVICE_CHALLENGE,
      timingProfileId: null,
      cycle,
      orgSeed,
      partyAgentIds: ["rhea-venn"],
      receipt,
    })).toThrow(/timing-profile mismatch/);
  });

  it("projects every required combat phase without granting the cue plane gameplay authority", () => {
    const spec = compileActionEncounter(
      UNDERDRAIN_PLAYER_ARC,
      UNDERDRAIN_PLAYER_PUMP_CHALLENGE,
      null,
      "forgiving",
    );
    let state = initialActionState(spec, 33);
    expect(projectInitialActionCues(spec, state).map((cue) => cue.cueId))
      .toContain("cue.mechanism-available");

    let next = stepActionSimulation(spec, state, {
      moveX: 0, moveY: 0, aimX: 1, aimY: 0, buttons: ACTION_BUTTON.light,
    });
    expect(cueIds(projectActionSemanticCues(spec, state, next))).toContain("cue.player-action-started");
    state = next;
    const attackCues: string[] = [];
    while (state.player.mode === "light") {
      next = stepActionSimulation(spec, state, { moveX: 0, moveY: 0, aimX: 1, aimY: 0, buttons: 0 });
      attackCues.push(...cueIds(projectActionSemanticCues(spec, state, next)));
      state = next;
    }
    expect(attackCues).toContain("cue.player-action-active");
    expect(attackCues).toContain("cue.player-action-recovery");

    const enemy = state.enemies[0]!;
    const law = spec.enemyLaws[enemy.kit];
    state = {
      ...state,
      player: { ...state.player, mode: "idle", modeTick: 0, x: 0, y: 0 },
      enemies: [{ ...enemy, x: 0, y: 0, mode: "telegraph", modeTick: law.telegraphTicks - 1, attackResolved: false }],
      previousButtons: 0,
      events: [],
    };
    next = stepActionSimulation(spec, state, {
      moveX: 0, moveY: 0, aimX: 1, aimY: 0, buttons: ACTION_BUTTON.parry,
    });
    const openCues = cueIds(projectActionSemanticCues(spec, state, next));
    expect(openCues).toEqual(expect.arrayContaining([
      "cue.player-action-started",
      "cue.defense-window-opened",
      "cue.enemy-attack-active",
    ]));
    state = next;
    next = stepActionSimulation(spec, state, {
      moveX: 0, moveY: 0, aimX: 1, aimY: 0, buttons: 0,
    });
    const parryCues = projectActionSemanticCues(spec, state, next);
    expect(cueIds(parryCues)).toEqual(expect.arrayContaining([
      "cue.parry-succeeded",
      "cue.enemy-stagger-started",
      "cue.work-window-opened",
    ]));
    expect(parryCues.find((cue) => cue.cueId === "cue.work-window-opened")).toMatchObject({
      source: "parry_stagger",
      durationTicks: law.staggerTicks,
    });
    expect(next.player.health).toBe(state.player.health);
  });

  it("projects mechanism progress, objective succession, alternate recovery windows, and deterministic cue identities", () => {
    const spec = compileActionEncounter(
      UNDERDRAIN_PLAYER_ARC,
      UNDERDRAIN_PLAYER_SERVICE_CHALLENGE,
      null,
      "forgiving",
    );
    let state = initialActionState(spec, 44);
    const target = spec.objectives[0]!.semanticCompletion!;
    if (target.kind !== "interact_count") throw new Error("Expected interact_count.");
    const mechanism = target.targets[0]!;
    state = {
      ...state,
      player: { ...state.player, x: mechanism.x, y: mechanism.y },
      events: [],
      previousButtons: 0,
    };
    const next = stepActionSimulation(spec, state, {
      moveX: 0, moveY: 0, aimX: 1, aimY: 0, buttons: ACTION_BUTTON.interact,
    });
    const cues = projectActionSemanticCues(spec, state, next);
    expect(cueIds(cues)).toEqual(expect.arrayContaining([
      "cue.mechanism-progress",
      "cue.objective-completed",
      "cue.mechanism-available",
    ]));
    expect(cues.every((cue) => /^actcue1_[0-9a-f]{64}$/.test(cue.cueDigest))).toBe(true);

    const pump = compileActionEncounter(
      UNDERDRAIN_PLAYER_ARC,
      UNDERDRAIN_PLAYER_PUMP_CHALLENGE,
      null,
      "standard",
    );
    const pumpState = initialActionState(pump, 55);
    const pumpEnemy = pumpState.enemies[0]!;
    const pumpLaw = pump.enemyLaws[pumpEnemy.kit];
    const recoveringPrior: ActionSimulationState = {
      ...pumpState,
      enemies: [{
        ...pumpEnemy,
        x: 0,
        y: 0,
        mode: "active",
        modeTick: pumpLaw.activeTicks - 1,
        attackResolved: true,
      }],
      events: [],
    };
    const recoveringNext = stepActionSimulation(pump, recoveringPrior, {
      moveX: 0, moveY: 0, aimX: 1, aimY: 0, buttons: 0,
    });
    expect(projectActionSemanticCues(pump, recoveringPrior, recoveringNext)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cueId: "cue.enemy-attack-recovery", durationTicks: pumpLaw.recoveryTicks }),
        expect.objectContaining({ cueId: "cue.work-window-opened", source: "enemy_recovery", durationTicks: pumpLaw.recoveryTicks }),
      ]),
    );

    const traceInputs: ActionInput[] = [
      { moveX: 0, moveY: 0, aimX: 1, aimY: 0, buttons: ACTION_BUTTON.light },
      ...Array.from({ length: 20 }, () => ({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, buttons: 0 as number } as ActionInput)),
    ];
    const first = buildActionCueTrace(pump, 55, traceInputs);
    const second = buildActionCueTrace(pump, 55, traceInputs);
    expect(second).toEqual(first);
    expect(first.cueTraceDigest).toMatch(/^actcuetrace1_[0-9a-f]{64}$/);
  });
});
