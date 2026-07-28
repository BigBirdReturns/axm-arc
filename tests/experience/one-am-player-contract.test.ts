import { describe, expect, it } from "vitest";
import {
  ONE_AM_PLAYER_CONTRACT_FORMAT,
  validateOneAmPlayerContract,
  type OneAmPlayerContract,
} from "../../src/experience/one-am-player-contract.js";

function validContract(): OneAmPlayerContract {
  return {
    format: ONE_AM_PLAYER_CONTRACT_FORMAT,
    id: "underdrain-pilot",
    title: "The Underdrain Draft",
    coldOpen: {
      playerIdentity: "Ren Vane, a civilian plumber",
      immediateGoal: "Restore Mrs. Kett's water and diagnose the living blockage",
      stakes: "The town is losing water and the city is preparing to treat a repair as a war",
      firstActionPromptSeconds: 8,
      firstMeaningfulSuccessSeconds: 45,
    },
    objectives: [
      {
        id: "spore-valves",
        playerVerb: "Inspect and reroute the living pressure valves",
        storyPurpose: "Discover that the fungus is defending nursery-bound pipes",
        interactionKinds: ["inspect", "repair", "combat"],
        mechanic: "Inspect a valve, select cut/patch/reroute, hold the wrench while defenders interfere",
        observableStateChange: "Pressure returns to the household line and the nursery branch becomes visible",
        npcMethodCollision: "Ren diagnoses, Mara records, Gasket orders extermination, and Elow reclassifies the clog",
        criticalRevealIds: ["nursery-defense"],
      },
    ],
    choices: [
      {
        id: "evidence-first",
        prompt: "Preserve Mara's sample before entering the station",
        routeDeltas: [
          { kind: "knowledge", description: "Elow can identify defensive tissue during the valve scene" },
          { kind: "available-interaction", description: "The player can present evidence before the purge order" },
        ],
      },
    ],
    reveals: [
      {
        id: "nursery-defense",
        fact: "The blockages are defensive border works around a nursery threatened by antifungal discharge",
        timing: "during-objective",
        objectiveId: "spore-valves",
        observableThrough: "Caplings shield the nursery branch while Elow identifies pressure-regulating growth",
      },
    ],
    consequence: {
      visibleWorldChanges: ["Bellwether water pressure is restored", "Pump Seven visibly changes hands"],
      relationshipChanges: ["The Crown moves from rumor to parley", "Ren becomes a civilian liaison"],
      playableSuccessorId: "root-gate-parley",
      nextGoal: "Separate water-flow rights from political sovereignty at the Root Gate",
    },
    recovery: {
      retrySeconds: 2,
      preservesCompletedObjectives: true,
      repeatsExposition: false,
      firstFailureIsRecoverable: true,
    },
    comprehension: {
      whoAmI: "Ren Vane, a plumber drafted into a conflict he still treats as a repair problem",
      whatAmIDoing: "Restoring water by diagnosing and operating living infrastructure under pressure",
      whyDoesItMatter: "A bad repair becomes an extermination campaign and destroys a hidden nursery",
      whatChanged: "Water, evidence, Crown relations, and Ren's civic role changed visibly",
      whatCanIDoNext: "Play the Root Gate parley and investigate the discharge order",
    },
  };
}

describe("axm-one-am-player-contract/1", () => {
  it("accepts a continuous authored experience", () => {
    expect(validateOneAmPlayerContract(validContract())).toEqual({ ok: true, errors: [] });
  });

  it("refuses the shipped Underdrain receiver shape", () => {
    const receiver = validContract();
    receiver.coldOpen.playerIdentity = "";
    receiver.coldOpen.stakes = "";
    receiver.objectives[0] = {
      ...receiver.objectives[0]!,
      playerVerb: "Clear the Spore Valves",
      interactionKinds: ["combat"],
      mechanic: "Defeat three enemies",
      observableStateChange: "",
      npcMethodCollision: "",
    };
    receiver.choices[0] = { ...receiver.choices[0]!, routeDeltas: [] };
    receiver.reveals[0] = { ...receiver.reveals[0]!, timing: "result-only" };
    receiver.consequence.visibleWorldChanges = [];
    receiver.consequence.relationshipChanges = [];
    receiver.consequence.playableSuccessorId = "";
    receiver.consequence.nextGoal = "";
    receiver.comprehension.whatChanged = "";
    receiver.comprehension.whatCanIDoNext = "";

    const validation = validateOneAmPlayerContract(receiver);
    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual(expect.arrayContaining([
      "The cold open does not tell the player who they are.",
      "The cold open does not establish why the goal matters.",
      expect.stringContaining("reduces its authored verb to combat only"),
      expect.stringContaining("changes only remembered copy"),
      expect.stringContaining("deferred until after play"),
      "Success produces no visible world change.",
      "The experience does not unlock a playable successor scene.",
      "The contract cannot answer: What changed?",
      "The contract cannot answer: What can I do next?",
    ]));
  });

  it("treats recovery as part of authored continuity", () => {
    const contract = validContract();
    contract.recovery = {
      retrySeconds: 12,
      preservesCompletedObjectives: false,
      repeatsExposition: true,
      firstFailureIsRecoverable: false,
    };
    expect(validateOneAmPlayerContract(contract).errors).toEqual(expect.arrayContaining([
      "Retry must return the tired player to control within five seconds.",
      "Retry discards completed authored progress.",
      "Retry repeats exposition instead of returning to the current problem.",
      "The first failure is treated as an ending before the player has learned the experience.",
    ]));
  });
});
