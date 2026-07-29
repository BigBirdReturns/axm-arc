import { describe, expect, it } from "vitest";
import { validateArc } from "../../src/engine/schema.js";
import type { Arc } from "../../src/engine/types.js";
import {
  authoredExperienceErrors,
  authoredExperienceForChallenge,
  parseAuthoredExperienceProfile,
  readAuthoredExperienceProfile,
} from "../../src/engine/experience/profile.js";
import {
  AUTHORED_EXPERIENCE_EXTENSION_KEY,
  AUTHORED_EXPERIENCE_FORMAT,
  type AuthoredExperienceProfile,
} from "../../src/engine/experience/types.js";
import { MINI_ARC } from "../fixtures/mini-arc.js";

function outcome(nextExperienceIds: string[], terminal = false) {
  return {
    factIds: [terminal ? "fact-aftermath-held" : "fact-first-trial-understood"],
    openedObligationIds: terminal ? [] : ["obligation-return-to-hall"],
    resolvedObligationIds: [terminal ? "obligation-return-to-hall" : "obligation-enter-first-trial"],
    nextExperienceIds,
    ...(terminal ? { terminal: true } : {}),
  };
}

function experience(prefix: string, nextExperienceIds: string[], terminal = false) {
  return {
    challengeId: "mini-challenge",
    entry: {
      beatId: `${prefix}-entry`,
      title: prefix === "trial" ? "The First Trial" : "The Hall Remembers",
      playerRoleId: "charter-operator",
      playerRoleLabel: "Charter operator",
      ordinaryStake: "Keep the new charter intact through its first public test.",
      primaryActionLabel: prefix === "trial" ? "Enter the first trial" : "Inspect what the hall recorded",
    },
    commitments: [
      {
        id: `${prefix}-trust-strength`,
        label: "Trust strength",
        description: "Let the strongest founder take visible responsibility.",
        runtimeSignals: [{ kind: "actor" as const, id: "lead-founder-visible" }],
      },
      {
        id: `${prefix}-preserve-proof`,
        label: "Preserve proof",
        description: "Keep the trial legible to the hall after the action.",
        runtimeSignals: [{ kind: "information" as const, id: "trial-ledger-visible" }],
      },
    ],
    objectiveBindings: {
      "check-power": {
        verb: "subdue" as const,
        targetKind: "actor" as const,
        targetId: "trial-guard",
        playerFacingLabel: "Subdue the trial guard",
        completion: { kind: "defeat_count" as const, targetCount: 1 },
        storyPaymentId: `${prefix}-power-pressure-cleared`,
      },
      "check-focus": {
        verb: "operate" as const,
        targetKind: "mechanism" as const,
        targetId: "focus-dial",
        playerFacingLabel: "Hold the focus dial steady",
        completion: { kind: "hold_ticks" as const, targetTicks: 90 },
        storyPaymentId: `${prefix}-focus-dial-set`,
      },
    },
    reveals: [
      {
        id: `${prefix}-guard-reveal`,
        objectiveId: "check-power",
        trigger: "objective_started" as const,
        actorId: "trial-guard",
        factId: "fact-guard-tests-restraint",
      },
      {
        id: `${prefix}-dial-reveal`,
        objectiveId: "check-focus",
        trigger: "objective_completed" as const,
        actorId: "charter-keeper",
        factId: "fact-hall-records-focus",
      },
    ],
    outcomes: {
      success: outcome(nextExperienceIds, terminal),
      partial: outcome(nextExperienceIds, terminal),
      failure: outcome(nextExperienceIds, terminal),
    },
    checkpointKey: `${prefix}-checkpoint`,
    extensions: { "creator.note@1": { retained: true, prefix } },
  };
}

function profile(): AuthoredExperienceProfile {
  return {
    format: AUTHORED_EXPERIENCE_FORMAT,
    experiences: {
      "first-trial": experience("trial", ["hall-aftermath"]),
      "hall-aftermath": experience("aftermath", [], true),
    },
    extensions: { "unfamiliar.authoring@7": { opaque: ["keep", 17] } },
  };
}

function rawArcWithProfile(value: unknown, engineVersion = "1.4.0"): Arc {
  return {
    ...structuredClone(MINI_ARC),
    meta: { ...MINI_ARC.meta, engineVersion },
    extensions: {
      ...(MINI_ARC.extensions ?? {}),
      [AUTHORED_EXPERIENCE_EXTENSION_KEY]: value,
    },
  } as Arc;
}

function validatedArcWithProfile(value: unknown, engineVersion = "1.4.0"): Arc {
  return validateArc(rawArcWithProfile(value, engineVersion));
}

describe("axm-authored-experience/1", () => {
  it("parses and preserves bounded unknown creator extensions", () => {
    const parsed = parseAuthoredExperienceProfile(profile());
    expect(parsed).toEqual(profile());
    expect(parsed).not.toBe(profile());
    expect(parsed.extensions?.["unfamiliar.authoring@7"]).toEqual({ opaque: ["keep", 17] });
    expect(parsed.experiences["first-trial"]?.extensions?.["creator.note@1"]).toEqual({ retained: true, prefix: "trial" });
  });

  it("binds every challenge mechanic to a truthful player verb, reveal, consequence, and implemented next experience", () => {
    const arc = validatedArcWithProfile(profile());
    expect(authoredExperienceErrors(arc)).toEqual([]);
    expect(readAuthoredExperienceProfile(arc)).toEqual(profile());
    expect(authoredExperienceForChallenge(arc, "mini-challenge").map((entry) => entry.experienceId)).toEqual([
      "first-trial",
      "hall-aftermath",
    ]);
  });

  it("refuses a repair or operation label whose actual completion predicate is only an enemy defeat count", () => {
    const invalid = profile();
    invalid.experiences["first-trial"]!.objectiveBindings["check-focus"] = {
      ...invalid.experiences["first-trial"]!.objectiveBindings["check-focus"]!,
      verb: "repair",
      playerFacingLabel: "Repair the focus dial",
      completion: { kind: "defeat_count", targetCount: 3 },
    };
    const raw = rawArcWithProfile(invalid);
    const errors = authoredExperienceErrors(raw);
    const expected = `[extensions.${AUTHORED_EXPERIENCE_EXTENSION_KEY}.experiences.first-trial.objectiveBindings.check-focus.completion] `
      + `Verb "repair" cannot be completed by "defeat_count".`;
    expect(errors).toContain(expected);
    expect(() => validateArc(raw)).toThrow(/Verb "repair" cannot be completed by "defeat_count"/);
  });

  it("refuses missing and invented objective bindings", () => {
    const invalid = profile();
    delete invalid.experiences["first-trial"]!.objectiveBindings["check-focus"];
    invalid.experiences["first-trial"]!.objectiveBindings["invented-valve"] = {
      verb: "operate",
      targetKind: "mechanism",
      targetId: "invented-valve",
      playerFacingLabel: "Operate the invented valve",
      completion: { kind: "interact_count", targetCount: 1 },
      storyPaymentId: "invented-payment",
    };
    const raw = rawArcWithProfile(invalid);
    const errors = authoredExperienceErrors(raw);
    expect(errors).toEqual(expect.arrayContaining([
      `[extensions.${AUTHORED_EXPERIENCE_EXTENSION_KEY}.experiences.first-trial.objectiveBindings.invented-valve] Unknown challenge objective.`,
      `[extensions.${AUTHORED_EXPERIENCE_EXTENSION_KEY}.experiences.first-trial.objectiveBindings] Missing semantic binding for challenge objective "check-focus".`,
    ]));
    expect(() => validateArc(raw)).toThrow(/Missing semantic binding for challenge objective "check-focus"/);
  });

  it("refuses teaser-only continuations and unknown next beats", () => {
    const noNext = profile();
    noNext.experiences["first-trial"]!.outcomes.success.nextExperienceIds = [];
    const noNextRaw = rawArcWithProfile(noNext);
    const noNextErrors = authoredExperienceErrors(noNextRaw);
    expect(noNextErrors).toContain(
      `[extensions.${AUTHORED_EXPERIENCE_EXTENSION_KEY}.experiences.first-trial.outcomes.success.nextExperienceIds] `
      + "Nonterminal outcome must name at least one implemented next experience.",
    );
    expect(() => validateArc(noNextRaw)).toThrow(/Nonterminal outcome must name at least one implemented next experience/);

    const unknown = profile();
    unknown.experiences["first-trial"]!.outcomes.partial.nextExperienceIds = ["episode-two-teaser"];
    const unknownRaw = rawArcWithProfile(unknown);
    const unknownErrors = authoredExperienceErrors(unknownRaw);
    expect(unknownErrors).toContain(
      `[extensions.${AUTHORED_EXPERIENCE_EXTENSION_KEY}.experiences.first-trial.outcomes.partial.nextExperienceIds] `
      + `Unknown next experience "episode-two-teaser".`,
    );
    expect(() => validateArc(unknownRaw)).toThrow(/Unknown next experience "episode-two-teaser"/);
  });

  it("refuses choices that cannot change any runtime information or affordance", () => {
    const invalid = profile() as unknown as Record<string, unknown>;
    const experiences = invalid["experiences"] as Record<string, Record<string, unknown>>;
    const commitments = experiences["first-trial"]!["commitments"] as Array<Record<string, unknown>>;
    commitments[0]!["runtimeSignals"] = [];
    expect(() => parseAuthoredExperienceProfile(invalid)).toThrow(/runtimeSignals.*at least 1/i);
    expect(() => validateArc(rawArcWithProfile(invalid))).toThrow(/runtimeSignals.*at least 1/i);
  });

  it("refuses duplicate checkpoint custody and an old engine floor", () => {
    const duplicate = profile();
    duplicate.experiences["hall-aftermath"]!.checkpointKey = "trial-checkpoint";
    const duplicateRaw = rawArcWithProfile(duplicate);
    expect(authoredExperienceErrors(duplicateRaw)).toContain(
      `[extensions.${AUTHORED_EXPERIENCE_EXTENSION_KEY}.experiences.hall-aftermath.checkpointKey] `
      + `Duplicate checkpoint key "trial-checkpoint".`,
    );
    expect(() => validateArc(duplicateRaw)).toThrow(/Duplicate checkpoint key "trial-checkpoint"/);

    const oldRaw = rawArcWithProfile(profile(), "1.3.0");
    expect(authoredExperienceErrors(oldRaw)).toContain(
      `[meta.engineVersion] ${AUTHORED_EXPERIENCE_FORMAT} requires engineVersion 1.4.0 or newer.`,
    );
    expect(() => validateArc(oldRaw)).toThrow(/requires engineVersion 1\.4\.0 or newer/);
  });
});
