import { describe, expect, it } from "vitest";
import { validateArc } from "../../src/engine/schema.js";
import { compileActionEncounter, actionSpecDigest } from "../../src/engine/action/compile.js";
import { ACTION_EXTENSION_KEY, ACTION_PROFILE_FORMAT } from "../../src/engine/action/types.js";
import { KARAZHAN } from "../../src/arcs/karazhan.js";
import { MINI_ARC } from "../fixtures/mini-arc.js";

function actionArc(profile: unknown) {
  return validateArc({
    ...structuredClone(MINI_ARC),
    meta: { ...MINI_ARC.meta, engineVersion: "1.4.0" },
    extensions: { ...(MINI_ARC.extensions ?? {}), [ACTION_EXTENSION_KEY]: profile },
  });
}

describe("axm-action-profile/1", () => {
  it("compiles every ordinary challenge into deterministic action law without challenge-id branches", () => {
    const challenge = MINI_ARC.challenges[0]!;
    const first = compileActionEncounter(MINI_ARC, challenge);
    const second = compileActionEncounter(MINI_ARC, challenge);
    expect(first).toEqual(second);
    expect(first.specDigest).toBe(actionSpecDigest(first));
    expect(first.objectives.map((objective) => objective.id)).toEqual(challenge.mechanicChecks.map((check) => check.id));
    expect(first.objectives.every((objective) => objective.enemyKit === "skirmisher")).toBe(true);

    const materiallyDifferent = {
      ...challenge,
      id: "materially-different",
      name: "Materially Different",
      difficultyRating: 85,
      mechanicChecks: [{
        ...challenge.mechanicChecks[0]!,
        id: "breach",
        failureConsequence: { type: "cascade" as const, severity: 0.9 },
      }],
    };
    const other = compileActionEncounter(MINI_ARC, materiallyDifferent);
    expect(other.objectives[0]?.enemyKit).toBe("breaker");
    expect(other.player.kit).not.toBe(first.player.kit);
    expect(other.specDigest).not.toBe(first.specDigest);
  });

  it("owns difficulty-mode composition instead of requiring the player to pre-transform law", () => {
    const challenge = KARAZHAN.challenges[0]!;
    const base = compileActionEncounter(KARAZHAN, challenge);
    const heroic = compileActionEncounter(KARAZHAN, challenge, "heroic");
    expect(heroic.difficultyModeId).toBe("heroic");
    expect(heroic.objectives).toHaveLength(base.objectives.length + 1);
    expect(heroic.objectives.at(-1)?.id).toBe("heroic-unraveling");
    expect(heroic.specDigest).not.toBe(base.specDigest);
    expect(() => compileActionEncounter(KARAZHAN, challenge, "missing")).toThrow(/Difficulty mode not found/);
  });

  it("accepts bounded authored kit selection and exact objective order", () => {
    const challenge = MINI_ARC.challenges[0]!;
    const profile = {
      format: ACTION_PROFILE_FORMAT,
      encounters: {
        [challenge.id]: {
          arenaKit: "lane",
          playerKit: "hammer",
          durationSeconds: 75,
          arenaScale: 0.8,
          enemyScale: 1.5,
          objectiveOrder: [...challenge.mechanicChecks.map((check) => check.id)].reverse(),
          objectiveKits: { [challenge.mechanicChecks[0]!.id]: "duelist" },
        },
      },
    };
    const arc = actionArc(profile);
    const spec = compileActionEncounter(arc, arc.challenges[0]!);
    expect(spec.arena.kit).toBe("lane");
    expect(spec.player.kit).toBe("hammer");
    expect(spec.maxTicks).toBe(75 * 30);
    expect(spec.objectives.map((objective) => objective.id)).toEqual(profile.encounters[challenge.id]!.objectiveOrder);
    expect(spec.objectives.find((objective) => objective.id === challenge.mechanicChecks[0]!.id)?.enemyKit).toBe("duelist");
  });

  it("refuses malformed profiles, unknown references, incomplete order, and an old engine floor", () => {
    const challenge = MINI_ARC.challenges[0]!;
    expect(() => actionArc({ format: "wrong", encounters: {} })).toThrow(/Invalid axm-action-profile\/1/);
    expect(() => actionArc({
      format: ACTION_PROFILE_FORMAT,
      encounters: { ghost: { arenaKit: "ring" } },
    })).toThrow(/Unknown challenge id/);
    expect(() => actionArc({
      format: ACTION_PROFILE_FORMAT,
      encounters: { [challenge.id]: { objectiveOrder: [challenge.mechanicChecks[0]!.id] } },
    })).toThrow(/every challenge objective exactly once/);
    expect(() => validateArc({
      ...structuredClone(MINI_ARC),
      meta: { ...MINI_ARC.meta, engineVersion: "1.3.0" },
      extensions: { [ACTION_EXTENSION_KEY]: { format: ACTION_PROFILE_FORMAT, encounters: {} } },
    })).toThrow(/requires engineVersion 1\.4\.0/);
  });
});
