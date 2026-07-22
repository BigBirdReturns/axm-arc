import { describe, expect, it } from "vitest";
import { compileDarkTombPocket, readDarkTombPocketExtension } from "../../src/dark-tomb/compiler.js";
import { validateDarkTombPocket } from "../../src/dark-tomb/schema.js";
import { DARK_TOMB_STARTER } from "../../src/dark-tomb/templates.js";
import { DARK_TOMB_EXTENSION_KEY, DARK_TOMB_POCKET_FORMAT } from "../../src/dark-tomb/types.js";

const PRESSURES = [
  "tomb-form",
  "exterior-lie",
  "custodian",
  "ordinary-good",
  "excluded-actor",
  "approaching-breach",
  "cost-of-opening-or-closing",
  "scale-revelation",
];

const LAYERS = [
  "grave-skin",
  "shroud",
  "quiet-works",
  "common-depths",
  "custodial-ring",
  "war-layer",
  "black-core",
];

const DEPTHS = ["material", "signal", "administrative", "historical", "interpretive"];
const ALARM = ["shadow", "hush", "fold", "black", "cut", "wake"];
const RESPONSIBILITIES = [
  "depends-on-alarm",
  "bears-cost-of-concealment",
  "understands-quiet-works",
  "translates-excluded-actor",
  "holds-map-changing-evidence",
  "benefits-from-delay",
  "sovereign-exception",
];

function errorsFor(input: unknown): string[] {
  const result = validateDarkTombPocket(input);
  return result.ok ? [] : result.errors;
}

describe("The Godscar Codex Book II source contract", () => {
  it("encodes the exact Tomb Engine, anatomy, depth, Alarm, and cast vocabularies", () => {
    expect(DARK_TOMB_POCKET_FORMAT).toBe("dark-tomb-pocket/1");
    expect(DARK_TOMB_EXTENSION_KEY).toBe("godscar.dark-tomb@1");
    expect(DARK_TOMB_STARTER.pressures.map((pressure) => pressure.kind)).toEqual(PRESSURES);
    expect(DARK_TOMB_STARTER.anatomy.map((layer) => layer.kind)).toEqual(LAYERS);
    expect(DARK_TOMB_STARTER.depths.map((depth) => depth.kind)).toEqual(DEPTHS);
    expect(DARK_TOMB_STARTER.alarm.phases.map((phase) => phase.phase)).toEqual(ALARM);
    expect(DARK_TOMB_STARTER.cast.map((member) => member.responsibility).sort()).toEqual([...RESPONSIBILITIES].sort());
  });

  it("accepts the complete private-branch authoring seed", () => {
    const result = validateDarkTombPocket(DARK_TOMB_STARTER);
    expect(result).toEqual({ ok: true, source: DARK_TOMB_STARTER });
  });

  it("compiles into an ordinary Arc while preserving the exact creator source", () => {
    const source = structuredClone(DARK_TOMB_STARTER);
    const arc = compileDarkTombPocket(source);

    expect(arc.meta.domain).toBe("godscar-dark-tomb");
    expect(arc.meta.engineVersion).toBe("1.3.0");
    expect(arc.attributes.map((attribute) => attribute.id)).toEqual([
      "care",
      "evidence",
      "systems",
      "jurisdiction",
      "opacity",
      "resolve",
    ]);
    expect(arc.roles.map((role) => role.id)).toEqual([
      "wakekeeper",
      "surface-bearer",
      "maintainer",
      "interlocutor",
      "witness",
      "deliberator",
      "exception",
    ]);
    expect(arc.progressionTiers.map((tier) => tier.id)).toEqual(["ordinary-life", "descent", "breach", "return"]);
    expect(arc.challenges.map((challenge) => challenge.id)).toEqual(source.delves.map((delve) => delve.id));
    expect(arc.opening?.options.map((option) => option.id)).toEqual(["preserve-the-alarm", "authorize-the-breach"]);
    expect(arc.extensions?.[DARK_TOMB_EXTENSION_KEY]).toEqual(source);
    expect(readDarkTombPocketExtension(arc)).toEqual(source);
    expect(arc.narrativeEvents?.find((event) => event.trigger.type === "arc_complete")?.rewards).toEqual(
      source.consequences.map((consequence) => consequence.label),
    );
  });

  it("rejects a Tomb Engine whose eight pressures are out of order", () => {
    const source = structuredClone(DARK_TOMB_STARTER);
    source.pressures[0]!.kind = "exterior-lie";
    source.pressures[1]!.kind = "tomb-form";
    expect(errorsFor(source)).toEqual(expect.arrayContaining([
      expect.stringContaining("Pressure 1 must be tomb-form"),
      expect.stringContaining("Pressure 2 must be exterior-lie"),
    ]));
  });

  it("rejects a map that collapses the seven political layers", () => {
    const source = structuredClone(DARK_TOMB_STARTER);
    source.anatomy[2]!.kind = "common-depths";
    source.anatomy[3]!.kind = "quiet-works";
    expect(errorsFor(source)).toEqual(expect.arrayContaining([
      expect.stringContaining("Layer 3 must be quiet-works"),
      expect.stringContaining("Layer 4 must be common-depths"),
    ]));
  });

  it("rejects a source that replaces the five-dimensional depth vector with distance alone", () => {
    const source = structuredClone(DARK_TOMB_STARTER);
    source.depths[1]!.kind = "material";
    expect(errorsFor(source)).toEqual(expect.arrayContaining([
      expect.stringContaining("Depth 2 must be signal"),
    ]));
  });

  it("rejects a Long Alarm that erases one of its common phases", () => {
    const source = structuredClone(DARK_TOMB_STARTER);
    source.alarm.phases[3]!.phase = "wake";
    expect(errorsFor(source)).toEqual(expect.arrayContaining([
      expect.stringContaining("Alarm phase 4 must be black"),
    ]));
  });

  it("requires every incompatible Book II responsibility", () => {
    const source = structuredClone(DARK_TOMB_STARTER);
    source.cast = source.cast.filter((member) => member.responsibility !== "bears-cost-of-concealment");
    expect(errorsFor(source)).toEqual(expect.arrayContaining([
      expect.stringContaining("Cast must include responsibility bears-cost-of-concealment"),
    ]));
  });

  it("requires all ten Story Physics invariants to remain true", () => {
    const source = structuredClone(DARK_TOMB_STARTER);
    source.storyPhysics.hubIsStory = false;
    expect(errorsFor(source)).toEqual(expect.arrayContaining([
      expect.stringContaining("storyPhysics.hubIsStory"),
    ]));
  });

  it("rejects duplicated signature operations and non-normalized check weights", () => {
    const source = structuredClone(DARK_TOMB_STARTER);
    source.signatureBudget.operations[1]!.kind = source.signatureBudget.operations[0]!.kind;
    source.delves[0]!.checks[0]!.weights = { care: 0.5, systems: 0.4 };
    expect(errorsFor(source)).toEqual(expect.arrayContaining([
      expect.stringContaining("Duplicate signature operation"),
      expect.stringContaining("Weights must sum to 1.0"),
    ]));
  });

  it("requires every delve to carry the six-part expedition ledger and a persistent inheritance", () => {
    for (const delve of DARK_TOMB_STARTER.delves) {
      expect(Object.keys(delve.expedition)).toEqual([
        "objective",
        "authorizedRoute",
        "signatureBudget",
        "authority",
        "claimToProve",
        "inheritance",
      ]);
      expect(delve.consequenceId).not.toBe("");
      expect(Object.keys(delve.depth).length).toBeGreaterThan(0);
    }
  });
});
