import { describe, expect, it } from "vitest";
import { compileCommonShipPocket, readCommonShipPocketExtension } from "../../src/common-ship/compiler.js";
import { validateCommonShipPocket } from "../../src/common-ship/schema.js";
import { COMMON_SHIP_STARTER } from "../../src/common-ship/templates.js";
import { COMMON_SHIP_EXTENSION_KEY, COMMON_SHIP_POCKET_FORMAT } from "../../src/common-ship/types.js";

const PRESSURES = [
  "vessel-form",
  "mission",
  "host-baseline",
  "temporal-conflict",
  "ordinary-good",
  "excluded-actor",
  "approaching-trigger",
  "cost-of-adaptation",
  "scale-revelation",
];

const SYSTEMS = [
  "transit-body",
  "habitat-bands",
  "common-thresholds",
  "translation-mesh",
  "watch-lattice",
  "continuity-commons",
  "sovereign-core",
];

const TEMPORAL = [
  "external-interval",
  "subjective-resolution",
  "developmental-tempo",
  "recovery-cycle",
  "continuity-span",
  "life-fraction-cost",
];

const TRANSLATION = ["meaning", "tempo", "sensorium", "interface", "environment", "authority", "memory-and-handoff"];
const WATCH_TESTS = [
  "role-coverage",
  "temporal-overlap",
  "habitat-compatibility",
  "translation-resilience",
  "handoff-continuity",
  "life-fraction-fairness",
];
const SHIP_STATE = [
  "habitat-integrity",
  "temporal-coherence",
  "translation-trust",
  "roster-resilience",
  "stores-and-care",
  "continuity",
  "visibility",
  "compatibility-debt",
];
const RESPONSIBILITIES = [
  "depends-on-host-baseline",
  "bears-adaptation-tax",
  "understands-maintenance-reality",
  "translates-excluded-actor",
  "benefits-from-delay",
  "sovereign-exception",
];

function errorsFor(input: unknown): string[] {
  const result = validateCommonShipPocket(input);
  return result.ok ? [] : result.errors;
}

describe("The Godscar Codex Book III source contract", () => {
  it("encodes the exact Watch Engine, anatomy, temporal, translation, watch-test, ship-state, and cast vocabularies", () => {
    expect(COMMON_SHIP_POCKET_FORMAT).toBe("common-ship-pocket/1");
    expect(COMMON_SHIP_EXTENSION_KEY).toBe("godscar.common-ship@1");
    expect(COMMON_SHIP_STARTER.pressures.map((pressure) => pressure.kind)).toEqual(PRESSURES);
    expect(COMMON_SHIP_STARTER.anatomy.map((system) => system.kind)).toEqual(SYSTEMS);
    expect(COMMON_SHIP_STARTER.temporalProfile.map((dimension) => dimension.kind)).toEqual(TEMPORAL);
    expect(COMMON_SHIP_STARTER.translationStack.map((layer) => layer.kind)).toEqual(TRANSLATION);
    expect(COMMON_SHIP_STARTER.watchTests.map((test) => test.kind)).toEqual(WATCH_TESTS);
    expect(COMMON_SHIP_STARTER.shipState.map((track) => track.kind)).toEqual(SHIP_STATE);
    expect(COMMON_SHIP_STARTER.cast.map((member) => member.responsibility).sort()).toEqual([...RESPONSIBILITIES].sort());
  });

  it("accepts the complete private-branch authoring seed", () => {
    const result = validateCommonShipPocket(COMMON_SHIP_STARTER);
    expect(result).toEqual({ ok: true, source: COMMON_SHIP_STARTER });
  });

  it("compiles into an ordinary Arc while preserving the exact creator source", () => {
    const source = structuredClone(COMMON_SHIP_STARTER);
    const arc = compileCommonShipPocket(source);

    expect(arc.meta.domain).toBe("godscar-common-ship");
    expect(arc.meta.engineVersion).toBe("1.3.0");
    expect(arc.attributes.map((attribute) => attribute.id)).toEqual([
      "care",
      "systems",
      "translation",
      "continuity",
      "judgment",
      "resolve",
    ]);
    expect(arc.roles.map((role) => role.id)).toEqual([
      "response",
      "mediation",
      "analysis",
      "maintenance",
      "care",
      "continuity",
    ]);
    expect(arc.progressionTiers.map((tier) => tier.id)).toEqual(["ordinary-life", "compose-watch", "resolve-pressure", "handoff"]);
    expect(arc.challenges.map((challenge) => challenge.id)).toEqual(source.watches.map((watch) => watch.id));
    expect(arc.opening?.options.map((option) => option.id)).toEqual(["mark-the-baseline", "accept-the-emergency-baseline"]);
    expect(arc.extensions?.[COMMON_SHIP_EXTENSION_KEY]).toEqual(source);
    expect(readCommonShipPocketExtension(arc)).toEqual(source);
    expect(arc.narrativeEvents?.find((event) => event.trigger.type === "arc_complete")?.rewards).toEqual(
      source.consequences.map((consequence) => consequence.label),
    );
  });

  it("rejects a Watch Engine whose nine pressures are out of order", () => {
    const source = structuredClone(COMMON_SHIP_STARTER);
    source.pressures[0]!.kind = "mission";
    source.pressures[1]!.kind = "vessel-form";
    expect(errorsFor(source)).toEqual(expect.arrayContaining([
      expect.stringContaining("Pressure 1 must be vessel-form"),
      expect.stringContaining("Pressure 2 must be mission"),
    ]));
  });

  it("rejects a source that collapses the seven political ship systems", () => {
    const source = structuredClone(COMMON_SHIP_STARTER);
    source.anatomy[3]!.kind = "watch-lattice";
    source.anatomy[4]!.kind = "translation-mesh";
    expect(errorsFor(source)).toEqual(expect.arrayContaining([
      expect.stringContaining("System 4 must be translation-mesh"),
      expect.stringContaining("System 5 must be watch-lattice"),
    ]));
  });

  it("rejects a timestamp that erases the six-dimensional temporal profile", () => {
    const source = structuredClone(COMMON_SHIP_STARTER);
    source.temporalProfile[1]!.kind = "external-interval";
    expect(errorsFor(source)).toEqual(expect.arrayContaining([
      expect.stringContaining("Temporal dimension 2 must be subjective-resolution"),
    ]));
  });

  it("rejects a translator that omits authority or handoff from the seven-layer stack", () => {
    const source = structuredClone(COMMON_SHIP_STARTER);
    source.translationStack[5]!.kind = "memory-and-handoff";
    expect(errorsFor(source)).toEqual(expect.arrayContaining([
      expect.stringContaining("Translation layer 6 must be authority"),
    ]));
  });

  it("rejects a qualified roster that omits one of the six Common Watch viability tests", () => {
    const source = structuredClone(COMMON_SHIP_STARTER);
    source.watchTests[5]!.kind = "role-coverage";
    expect(errorsFor(source)).toEqual(expect.arrayContaining([
      expect.stringContaining("Watch test 6 must be life-fraction-fairness"),
    ]));
  });

  it("protects all eight ship-state tracks and the Book III starting posture", () => {
    expect(COMMON_SHIP_STARTER.shipState.slice(0, 7).map((track) => track.value)).toEqual([2, 2, 2, 2, 2, 2, 2]);
    expect(COMMON_SHIP_STARTER.shipState[7]).toMatchObject({ kind: "compatibility-debt", value: 1 });
    const source = structuredClone(COMMON_SHIP_STARTER);
    source.shipState[4]!.kind = "continuity";
    expect(errorsFor(source)).toEqual(expect.arrayContaining([
      expect.stringContaining("Ship-state track 5 must be stores-and-care"),
    ]));
  });

  it("requires every incompatible Book III cast responsibility", () => {
    const source = structuredClone(COMMON_SHIP_STARTER);
    source.cast = source.cast.filter((member) => member.responsibility !== "bears-adaptation-tax");
    expect(errorsFor(source)).toEqual(expect.arrayContaining([
      expect.stringContaining("Cast must include responsibility bears-adaptation-tax"),
    ]));
  });

  it("requires all ten Mission Physics invariants to remain true", () => {
    const source = structuredClone(COMMON_SHIP_STARTER);
    source.storyPhysics.noNeutralEnvironment = false;
    expect(errorsFor(source)).toEqual(expect.arrayContaining([
      expect.stringContaining("storyPhysics.noNeutralEnvironment"),
    ]));
  });

  it("rejects non-normalized checks, zero ship-state effects, and missing operational movements", () => {
    const source = structuredClone(COMMON_SHIP_STARTER);
    source.watches[0]!.checks[0]!.weights = { care: 0.5, systems: 0.4 };
    source.watches[0]!.shipStateEffects[0]!.delta = 0;
    source.watches = source.watches.filter((watch) => watch.tierId !== "handoff");
    expect(errorsFor(source)).toEqual(expect.arrayContaining([
      expect.stringContaining("Weights must sum to 1.0"),
      expect.stringContaining("Ship-state effects must change the track"),
      expect.stringContaining("Watches must include tier handoff"),
    ]));
  });

  it("requires every watch to carry the full operational ledger and a persistent precedent", () => {
    for (const watch of COMMON_SHIP_STARTER.watches) {
      expect(Object.keys(watch.horizon)).toEqual([
        "closesWhen",
        "physicalUrgency",
        "informationalUrgency",
        "institutionalUrgency",
        "manufacturedUrgency",
      ]);
      expect(Object.keys(watch.profiles)).toEqual([
        "requiredBodies",
        "requiredHabitats",
        "requiredClocks",
        "requiredTranslators",
        "requiredReserves",
        "lifeFractionCosts",
        "requiredProfileIds",
      ]);
      expect(Object.keys(watch.composition)).toEqual(["absentActor", "excludedBody", "dependency"]);
      expect(Object.keys(watch.allocation)).toEqual([
        "habitatBands",
        "translationPaths",
        "directInterfaces",
        "standby",
        "stores",
        "emergencyAuthority",
      ]);
      expect(Object.keys(watch.handoff)).toEqual([
        "dissent",
        "injury",
        "readinessDebt",
        "promises",
        "missingPersons",
        "uncertainty",
      ]);
      expect(Object.keys(watch.precedent)).toEqual([
        "newlyPossible",
        "newlyImpossible",
        "newlyGovernable",
        "inheritedAsInfrastructure",
      ]);
      expect(watch.consequenceId).not.toBe("");
      expect(watch.shipStateEffects.length).toBeGreaterThan(0);
    }
  });
});
