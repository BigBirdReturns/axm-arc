import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileActionEncounter } from "../../src/engine/action/compile.js";
import { actionSeed, buildActionReceipt } from "../../src/engine/action/receipt.js";
import { compressActionInputs, initialActionState, stepActionSimulation } from "../../src/engine/action/simulation.js";
import {
  ACTION_BUTTON,
  ACTION_SEMANTIC_RUNTIME_VERSION,
  type ActionEncounterSpec,
  type ActionInput,
  type ActionInputRun,
  type ActionSimulationState,
} from "../../src/engine/action/types.js";
import { compareCodepoints } from "../../src/engine/determinism.js";
import {
  commitNarrativeSelection,
  ingestAcceptedActionReceipt,
  sortNarrativeCandidates,
} from "../../src/narrative/index.js";
import {
  UNDERDRAIN_ACTION_NARRATIVE_BINDING,
  UNDERDRAIN_ACTION_OBJECTIVE_PROFILE,
  UNDERDRAIN_ACTION_PROFILE,
  UNDERDRAIN_AUTHORED_EXPERIENCE_PROFILE,
  UNDERDRAIN_CHALLENGE,
  UNDERDRAIN_CONSTITUTION,
  UNDERDRAIN_DRAFT_ARC,
  UNDERDRAIN_ROOT_GATE_CHALLENGE,
  UNDERDRAIN_SERVICE_CHALLENGE,
  UNDERDRAIN_STANDALONE_MANIFEST,
  UNDERDRAIN_STRATEGY_IDS,
  buildUnderdrainPreActionState,
  initialUnderdrainNarrativeState,
} from "../../src/demos/underdrain/index.js";
import { buildIdleTrace } from "../action/helpers.js";

function axis(value: number): -1 | 0 | 1 {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

function nearestLiveEnemy(spec: ActionEncounterSpec, state: ActionSimulationState) {
  return state.enemies
    .filter((enemy) => enemy.mode !== "defeated")
    .sort((left, right) => {
      const leftDistance = (left.x - state.player.x) ** 2 + (left.y - state.player.y) ** 2;
      const rightDistance = (right.x - state.player.x) ** 2 + (right.y - state.player.y) ** 2;
      return leftDistance - rightDistance || compareCodepoints(left.id, right.id);
    })[0];
}

/** Deterministic integration policy for semantic objectives. It first removes
 * authored combat pressure, then travels to and operates the declared mechanism.
 * Defeating pressure actors never advances the objective on its own. */
function buildSemanticTrace(
  spec: ActionEncounterSpec,
  seed: number,
): { trace: ActionInputRun[]; state: ActionSimulationState } {
  let state = initialActionState(spec, seed);
  const inputs: ActionInput[] = [];
  while (!state.result && inputs.length < spec.maxTicks) {
    const objective = spec.objectives[state.activeObjectiveIndex];
    const live = nearestLiveEnemy(spec, state);
    let input: ActionInput = {
      moveX: 0,
      moveY: 0,
      aimX: state.player.facingX,
      aimY: state.player.facingY,
      buttons: 0,
    };

    if (live) {
      const dx = live.x - state.player.x;
      const dy = live.y - state.player.y;
      const aimX = axis(dx);
      const aimY = axis(dy);
      const distanceSquared = dx * dx + dy * dy;
      const light = spec.player.attacks[0];
      const law = spec.enemyLaws[live.kit];
      const danger = live.mode === "active"
        || (live.mode === "telegraph" && live.modeTick >= law.telegraphTicks - 2);
      if (state.player.mode === "idle" && danger) {
        input = { moveX: 0, moveY: 0, aimX, aimY, buttons: ACTION_BUTTON.parry };
      } else if (state.player.mode === "idle" && distanceSquared <= Math.trunc(light.range * 0.86) ** 2) {
        input = { moveX: 0, moveY: 0, aimX, aimY, buttons: ACTION_BUTTON.light };
      } else {
        input = { moveX: aimX, moveY: aimY, aimX, aimY, buttons: 0 };
      }
    } else if (objective?.semanticCompletion) {
      const completion = objective.semanticCompletion;
      const completedTargetIds = new Set(state.completedInteractionTargetIds ?? []);
      const target = completion.kind === "interact_count"
        ? completion.targets.find((candidate) => !completedTargetIds.has(candidate.id))
        : completion.target;
      if (target) {
        const dx = target.x - state.player.x;
        const dy = target.y - state.player.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared <= Math.trunc(target.radius * 0.8) ** 2) {
          input = {
            moveX: 0,
            moveY: 0,
            aimX: axis(dx) || state.player.facingX,
            aimY: axis(dy) || state.player.facingY,
            buttons: ACTION_BUTTON.interact,
          };
        } else {
          input = {
            moveX: axis(dx),
            moveY: axis(dy),
            aimX: axis(dx),
            aimY: axis(dy),
            buttons: 0,
          };
        }
      }
    }

    inputs.push(input);
    state = stepActionSimulation(spec, state, input);
  }
  if (!state.result) throw new Error("Underdrain semantic policy did not reach a terminal result.");
  return { trace: compressActionInputs(inputs), state };
}

describe("UNDERDRAIN continuous authored-pilot estate", () => {
  it("compiles a safe service success and mechanism-driven Pump Seven action law", () => {
    const serviceSpec = compileActionEncounter(UNDERDRAIN_DRAFT_ARC, UNDERDRAIN_SERVICE_CHALLENGE);
    expect(serviceSpec).toMatchObject({
      format: "axm-action-spec/1",
      runtimeVersion: ACTION_SEMANTIC_RUNTIME_VERSION,
      tickRate: 30,
      maxTicks: 35 * 30,
      arena: { kit: "ring" },
      player: { kit: "hammer" },
    });
    expect(serviceSpec.objectives.map((objective) => ({
      id: objective.id,
      enemyCount: objective.enemyCount,
      kind: objective.semanticCompletion?.kind,
    }))).toEqual([
      { id: "inspect-living-trap", enemyCount: 0, kind: "interact_count" },
      { id: "restore-kett-water", enemyCount: 0, kind: "hold_ticks" },
    ]);

    const pumpSpec = compileActionEncounter(UNDERDRAIN_DRAFT_ARC, UNDERDRAIN_CHALLENGE);
    expect(pumpSpec).toMatchObject({
      format: "axm-action-spec/1",
      runtimeVersion: ACTION_SEMANTIC_RUNTIME_VERSION,
      tickRate: 30,
      maxTicks: 120 * 30,
      arena: { kit: "lane" },
      player: { kit: "hammer" },
    });
    expect(pumpSpec.objectives.map((objective) => objective.id)).toEqual(
      UNDERDRAIN_ACTION_PROFILE.encounters[UNDERDRAIN_CHALLENGE.id]?.objectiveOrder,
    );
    expect(pumpSpec.objectives.map((objective) => ({
      enemyKit: objective.enemyKit,
      enemyCount: objective.enemyCount,
      kind: objective.semanticCompletion?.kind,
    }))).toEqual([
      { enemyKit: "skirmisher", enemyCount: 2, kind: "interact_count" },
      { enemyKit: "swarm", enemyCount: 2, kind: "hold_ticks" },
      { enemyKit: "breaker", enemyCount: 2, kind: "hold_ticks" },
    ]);
    expect(UNDERDRAIN_ACTION_OBJECTIVE_PROFILE.encounters[UNDERDRAIN_SERVICE_CHALLENGE.id])
      .toBeDefined();
    expect(compileActionEncounter(UNDERDRAIN_DRAFT_ARC, UNDERDRAIN_CHALLENGE, "service-tunnel").specDigest)
      .not.toBe(pumpSpec.specDigest);
    expect(compileActionEncounter(UNDERDRAIN_DRAFT_ARC, UNDERDRAIN_CHALLENGE, "truce-offer").specDigest)
      .not.toBe(pumpSpec.specDigest);
  });

  it("keeps the hidden cause out of pre-action prose while preserving three character-owned methods", () => {
    expect(initialUnderdrainNarrativeState().facts.map((fact) => fact.id)).not.toContain("fact-aquifer-poisoning");
    for (const strategy of UNDERDRAIN_STRATEGY_IDS) {
      const state = buildUnderdrainPreActionState(strategy);
      expect(state.ledger.beats.map((beat) => beat.beatFunction)).toEqual([
        "establish",
        "pressure",
        "escalate",
        "choose",
      ]);
      expect(state.ledger.beats.some((beat) => beat.beatFunction === "reveal")).toBe(false);
      expect(state.tracks).toEqual([
        expect.objectContaining({
          id: "underdrain-war",
          railId: "municipal-episode",
          currentFunction: "choose",
          status: "open",
        }),
      ]);
      expect(state.ledger.obligations.filter((entry) => entry.status === "open").map((entry) => entry.id))
        .toEqual(expect.arrayContaining([
          "keep-water-running",
          "identify-hidden-drain-cause",
          "refund-drain-caps",
        ]));
      expect(state.ledger.beats.at(-1)?.candidateId).toContain(strategy);
    }
  });

  it("delivers the first meaningful success through plumbing with no hidden combatant", () => {
    const spec = compileActionEncounter(UNDERDRAIN_DRAFT_ARC, UNDERDRAIN_SERVICE_CHALLENGE);
    const orgSeed = 0x1a_0001;
    const seed = actionSeed(orgSeed, 1, UNDERDRAIN_SERVICE_CHALLENGE.id, null);
    const { trace, state } = buildSemanticTrace(spec, seed);
    expect(state.result).toMatchObject({
      outcome: "success",
      completedObjectiveIds: ["inspect-living-trap", "restore-kett-water"],
      stats: {
        enemiesDefeated: 0,
        objectiveInteractions: 1,
        objectiveHoldTicks: 45,
      },
    });
    const receipt = buildActionReceipt({
      arc: UNDERDRAIN_DRAFT_ARC,
      challenge: UNDERDRAIN_SERVICE_CHALLENGE,
      cycle: 1,
      orgSeed,
      controlledAgentId: "rhea-venn",
      partyAgentIds: ["rhea-venn"],
      trace,
    });
    expect(receipt.runtimeVersion).toBe(ACTION_SEMANTIC_RUNTIME_VERSION);
    expect(receipt.result.objectives).toEqual([
      expect.objectContaining({ id: "inspect-living-trap", kind: "interact_count", progress: 1, completed: true }),
      expect.objectContaining({ id: "restore-kett-water", kind: "hold_ticks", progress: 45, completed: true }),
    ]);
    expect(UNDERDRAIN_AUTHORED_EXPERIENCE_PROFILE.experiences["mrs-kett-service-call"]?.outcomes.success.nextExperienceIds)
      .toEqual(["pump-seven-operation"]);
  });

  it("returns a real mechanism-driven Pump Seven receipt into narrative consequence authority", () => {
    const narrativeState = buildUnderdrainPreActionState("emergency-plan");
    const spec = compileActionEncounter(UNDERDRAIN_DRAFT_ARC, UNDERDRAIN_CHALLENGE);
    const orgSeed = 0x5eed_2026;
    const seed = actionSeed(orgSeed, narrativeState.cycle, UNDERDRAIN_CHALLENGE.id, null);
    const { trace, state: terminal } = buildSemanticTrace(spec, seed);
    expect(terminal.result?.outcome).toBe("success");
    expect(terminal.result?.objectives).toEqual([
      expect.objectContaining({ id: "diagnose-spore-valves", kind: "interact_count", progress: 3, completed: true }),
      expect.objectContaining({ id: "operate-purge-wheel", kind: "hold_ticks", progress: 90, completed: true }),
      expect.objectContaining({ id: "open-crown-sluice", kind: "hold_ticks", progress: 75, completed: true }),
    ]);

    const accepted = buildActionReceipt({
      arc: UNDERDRAIN_DRAFT_ARC,
      challenge: UNDERDRAIN_CHALLENGE,
      cycle: narrativeState.cycle,
      orgSeed,
      controlledAgentId: "rhea-venn",
      partyAgentIds: ["rhea-venn"],
      trace,
    });
    const ingestion = ingestAcceptedActionReceipt({
      arc: UNDERDRAIN_DRAFT_ARC,
      challenge: UNDERDRAIN_CHALLENGE,
      cycle: narrativeState.cycle,
      orgSeed,
      partyAgentIds: ["rhea-venn"],
      narrativeState,
      binding: UNDERDRAIN_ACTION_NARRATIVE_BINDING,
      receipt: accepted,
    });
    expect(ingestion.fact).toMatchObject({
      type: "accepted-action-result",
      receiptRef: accepted.receiptDigest,
      data: { outcome: "success" },
    });
    const selection = sortNarrativeCandidates(UNDERDRAIN_CONSTITUTION, ingestion.state, [ingestion.candidate]);
    expect(selection.selectedCandidateId).toBe(ingestion.candidate.id);
    const committed = commitNarrativeSelection(
      UNDERDRAIN_CONSTITUTION,
      ingestion.state,
      [ingestion.candidate],
      selection,
    );
    expect(committed.state.ledger.beats.at(-1)).toMatchObject({
      beatFunction: "consequence",
      presentationKey: "underdrain.consequence.success",
      roleBindings: { controlled: "rhea-venn" },
    });
    expect(committed.state.ledger.obligations.find((entry) => entry.id === "keep-water-running")?.status)
      .toBe("resolved");
    expect(committed.state.ledger.obligations.find((entry) => entry.id === "identify-hidden-drain-cause")?.status)
      .toBe("resolved");
    expect(committed.state.ledger.obligations.find((entry) => entry.id === "honor-fungal-embassy")?.status)
      .toBe("open");
  });

  it("implements Root Gate as the actual successor instead of result-screen copy", () => {
    const pump = UNDERDRAIN_AUTHORED_EXPERIENCE_PROFILE.experiences["pump-seven-operation"]!;
    expect(pump.reveals).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "nursery-defense", trigger: "objective_completed" }),
      expect.objectContaining({ id: "municipal-discharge-cause", trigger: "objective_started" }),
    ]));
    for (const outcome of ["success", "partial", "failure"] as const) {
      expect(pump.outcomes[outcome].nextExperienceIds).toEqual(["root-gate-parley"]);
    }

    const rootGate = UNDERDRAIN_AUTHORED_EXPERIENCE_PROFILE.experiences["root-gate-parley"]!;
    expect(rootGate.challengeId).toBe(UNDERDRAIN_ROOT_GATE_CHALLENGE.id);
    expect(rootGate.objectiveBindings["negotiate-water-compact"]).toMatchObject({
      verb: "negotiate",
      completion: {
        kind: "authored_choice",
        choiceIds: ["town-first-flow", "nursery-first-flow", "balanced-flow-compact"],
      },
    });
    expect(Object.values(rootGate.outcomes).every((entry) => entry.terminal === true)).toBe(true);
    expect(UNDERDRAIN_DRAFT_ARC.stateDefinitions?.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      "town-water-pressure",
      "fungus-contact",
      "crown-grievance",
      "rhea-status",
      "root-gate-open",
    ]));
  });

  it("keeps failure as failure and pins the generated authoring estate", () => {
    const narrativeState = buildUnderdrainPreActionState("service-tunnel");
    const spec = compileActionEncounter(UNDERDRAIN_DRAFT_ARC, UNDERDRAIN_CHALLENGE, "service-tunnel");
    const orgSeed = 0x0bad_f00d;
    const seed = actionSeed(orgSeed, narrativeState.cycle, UNDERDRAIN_CHALLENGE.id, "service-tunnel");
    const { trace, state: terminal } = buildIdleTrace(spec, seed);
    expect(terminal.result?.outcome).toBe("failure");
    const accepted = buildActionReceipt({
      arc: UNDERDRAIN_DRAFT_ARC,
      challenge: UNDERDRAIN_CHALLENGE,
      difficultyModeId: "service-tunnel",
      cycle: narrativeState.cycle,
      orgSeed,
      controlledAgentId: "rhea-venn",
      partyAgentIds: ["rhea-venn"],
      trace,
    });
    const ingestion = ingestAcceptedActionReceipt({
      arc: UNDERDRAIN_DRAFT_ARC,
      challenge: UNDERDRAIN_CHALLENGE,
      difficultyModeId: "service-tunnel",
      cycle: narrativeState.cycle,
      orgSeed,
      partyAgentIds: ["rhea-venn"],
      narrativeState,
      binding: UNDERDRAIN_ACTION_NARRATIVE_BINDING,
      receipt: accepted,
    });
    expect(ingestion.receipt.actionOutcome).toBe("failure");
    expect(ingestion.candidate.presentationKey).toBe("underdrain.consequence.failure");
    expect(ingestion.candidate.opensObligations.map((entry) => entry.id)).toEqual([
      "restore-crown-pump",
      "pay-substrate-invoice",
    ]);

    const bytes = readFileSync(new URL("../../examples/underdrain-draft/authoring.json", import.meta.url));
    const sums = readFileSync(new URL("../../examples/underdrain-draft/SHA256SUMS", import.meta.url), "utf8").trim();
    expect(JSON.parse(bytes.toString("utf8"))).toEqual(UNDERDRAIN_STANDALONE_MANIFEST);
    expect(sums).toBe(`${createHash("sha256").update(bytes).digest("hex")}  authoring.json`);
    expect(UNDERDRAIN_STANDALONE_MANIFEST).toMatchObject({
      format: "rodoh-underdrain-standalone/2",
      classification: "authored-pilot-candidate",
      oneAmBoundary: {
        independentPlayerReceiptRequired: true,
        rootGateSuccessorIsAuthored: true,
      },
    });
  });
});
