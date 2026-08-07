import { describe, expect, it } from "vitest";
import { compileActionEncounter } from "../../src/engine/action/compile.js";
import { actionSeed, buildActionReceipt, verifyActionReceipt } from "../../src/engine/action/receipt.js";
import { replayActionTrace } from "../../src/engine/action/simulation.js";
import { MINI_ARC } from "../fixtures/mini-arc.js";
import { buildCompetentTrace, buildIdleTrace } from "./helpers.js";

describe("deterministic fixed-step action runtime", () => {
  it("turns skill inputs into a replayable success while idle play fails", () => {
    const challenge = MINI_ARC.challenges[0]!;
    const spec = compileActionEncounter(MINI_ARC, challenge);
    const seed = actionSeed(91234, 3, challenge.id, null);
    const competent = buildCompetentTrace(spec, seed);
    const idle = buildIdleTrace(spec, seed);

    expect(competent.state.result?.outcome).toBe("success");
    expect(competent.state.result?.stats.enemiesDefeated).toBeGreaterThan(0);
    expect(idle.state.result?.outcome).not.toBe("success");
    expect(replayActionTrace(spec, seed, competent.trace)).toEqual(competent.state);
  });

  it("does not credit untouched future objectives when the player fails early", () => {
    const first = MINI_ARC.challenges[0]!;
    const challenge = {
      ...structuredClone(first),
      id: "two-wave-failure",
      mechanicChecks: [
        structuredClone(first.mechanicChecks[0]!),
        { ...structuredClone(first.mechanicChecks[0]!), id: "future-wave", name: "Future Wave" },
      ],
    };
    const spec = compileActionEncounter(MINI_ARC, challenge);
    const seed = actionSeed(1337, 0, challenge.id, null);
    const idle = buildIdleTrace(spec, seed);
    expect(idle.state.result?.outcome).not.toBe("success");
    expect(idle.state.result?.objectives.find((objective) => objective.id === "future-wave")).toMatchObject({
      defeated: 0,
      completed: false,
    });
  });

  it("builds and verifies an exact receipt, and refuses altered law, party, result, or trailing input", () => {
    const challenge = MINI_ARC.challenges[0]!;
    const spec = compileActionEncounter(MINI_ARC, challenge);
    const orgSeed = 91234;
    const seed = actionSeed(orgSeed, 3, challenge.id, null);
    const { trace } = buildCompetentTrace(spec, seed);
    const receipt = buildActionReceipt({
      arc: MINI_ARC,
      challenge,
      cycle: 3,
      orgSeed,
      controlledAgentId: "a",
      partyAgentIds: ["b", "a"],
      trace,
    });
    const verified = verifyActionReceipt({
      arc: MINI_ARC,
      challenge,
      cycle: 3,
      orgSeed,
      partyAgentIds: ["a", "b"],
      receipt,
    });
    expect(verified.receipt).toEqual(receipt);
    expect(verified.terminalState.result).toEqual(receipt.result);

    expect(() => verifyActionReceipt({
      arc: MINI_ARC,
      challenge,
      cycle: 3,
      orgSeed,
      partyAgentIds: ["a", "c"],
      receipt,
    })).toThrow(/party mismatch/);
    expect(() => verifyActionReceipt({
      arc: MINI_ARC,
      challenge,
      cycle: 3,
      orgSeed,
      partyAgentIds: ["a", "b"],
      receipt: { ...receipt, result: { ...receipt.result, playerHealth: receipt.result.playerHealth + 1 } },
    })).toThrow(/replay mismatch/);
    const last = trace[trace.length - 1]!;
    expect(() => buildActionReceipt({
      arc: MINI_ARC,
      challenge,
      cycle: 3,
      orgSeed,
      controlledAgentId: "a",
      partyAgentIds: ["a", "b"],
      trace: [...trace.slice(0, -1), { ...last, ticks: last.ticks + 1 }],
    })).toThrow(/input after its terminal result|terminal tick/);
  });

  it("preserves deterministic evidence across repeated construction", () => {
    const challenge = MINI_ARC.challenges[0]!;
    const spec = compileActionEncounter(MINI_ARC, challenge);
    const orgSeed = 77;
    const seed = actionSeed(orgSeed, 1, challenge.id, null);
    const { trace } = buildCompetentTrace(spec, seed);
    const make = () => buildActionReceipt({
      arc: MINI_ARC,
      challenge,
      cycle: 1,
      orgSeed,
      controlledAgentId: "a",
      partyAgentIds: ["a"],
      trace,
    });
    expect(make()).toEqual(make());
  });
});
