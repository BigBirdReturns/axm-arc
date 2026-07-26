import { describe, expect, it } from "vitest";
import { ACTION_EXTENSION_KEY, ACTION_PROFILE_FORMAT } from "../../src/engine/action/types.js";
import { readActionProfile } from "../../src/engine/action/profile.js";
import { compileActionEncounter } from "../../src/engine/action/compile.js";
import {
  materializeActionProfile,
  removeActionEncounterAuthoring,
  summarizeActionAuthoring,
  updateActionEncounterAuthoring,
} from "../../src/game/lib/action-authoring.js";
import { workshopSkeleton } from "../../src/game/lib/workshop.js";
import { validateArcJson } from "../../src/game/lib/arc-library.js";
import { MINI_ARC } from "../fixtures/mini-arc.js";

describe("guided action authoring", () => {
  it("shows every ordinary challenge as implicitly action-ready", () => {
    const summary = summarizeActionAuthoring(MINI_ARC);
    expect(summary.format).toBe(ACTION_PROFILE_FORMAT);
    expect(summary.challengeCount).toBe(MINI_ARC.challenges.length);
    expect(summary.explicitEncounterCount).toBe(0);
    expect(summary.challenges.every((challenge) => !challenge.explicit)).toBe(true);
    expect(summary.challenges.every((challenge) => challenge.maxWaveEnemies <= 12)).toBe(true);
  });

  it("materializes, edits, and removes bounded action law through the real schema", () => {
    const challenge = MINI_ARC.challenges[0]!;
    const materialized = materializeActionProfile(MINI_ARC);
    expect(materialized.meta.engineVersion).toBe("1.4.0");
    expect(readActionProfile(materialized)?.encounters[challenge.id]).toBeDefined();
    const original = compileActionEncounter(materialized, materialized.challenges[0]!);

    const edited = updateActionEncounterAuthoring(materialized, challenge.id, {
      arenaKit: "islands",
      playerKit: "hammer",
      enemyScale: 1.4,
      durationSeconds: 90,
    });
    const changed = compileActionEncounter(edited, edited.challenges[0]!);
    expect(changed.arena.kit).toBe("islands");
    expect(changed.player.kit).toBe("hammer");
    expect(changed.maxTicks).toBe(90 * 30);
    expect(changed.specDigest).not.toBe(original.specDigest);

    const generic = removeActionEncounterAuthoring(edited, challenge.id);
    expect(readActionProfile(generic)?.encounters[challenge.id]).toBeUndefined();
    expect(generic.extensions?.[ACTION_EXTENSION_KEY]).toBeUndefined();
  });

  it("ships a valid action-ready Workshop skeleton", () => {
    const parsed = validateArcJson(workshopSkeleton());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const profile = readActionProfile(parsed.arc);
    expect(profile?.format).toBe(ACTION_PROFILE_FORMAT);
    expect(Object.keys(profile?.encounters ?? {})).toEqual(["first-job", "second-job"]);
    for (const challenge of parsed.arc.challenges) {
      expect(compileActionEncounter(parsed.arc, challenge).objectives.length).toBeGreaterThan(0);
    }
  });
});
