import { describe, expect, it } from "vitest";
import { compileCommonShipPocket, readCommonShipPocketExtension } from "../../src/common-ship/compiler.js";
import { RELIEF_CIRCUIT_CANDIDATE } from "../../src/common-ship/relief-circuit.js";
import { validateCommonShipPocket } from "../../src/common-ship/schema.js";

const WATCH_CATEGORIES = [
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

describe("The Relief Circuit Gate 5 preparation source", () => {
  it("promotes the complete Book III starter into a named canon-compatible candidate", () => {
    expect(validateCommonShipPocket(RELIEF_CIRCUIT_CANDIDATE)).toEqual({
      ok: true,
      source: RELIEF_CIRCUIT_CANDIDATE,
    });
    expect(RELIEF_CIRCUIT_CANDIDATE.identity).toMatchObject({
      id: "relief-circuit",
      title: "The Relief Circuit",
      author: "BigBirdReturns",
      version: "0.5.0",
      canonRelation: "compatible",
    });
    expect(RELIEF_CIRCUIT_CANDIDATE.pressures[1]).toMatchObject({
      kind: "mission",
      id: "lamp-district-relief",
    });
  });

  it("carries a materially plural founding ecology without assigning bodies to roles", () => {
    const profiles = RELIEF_CIRCUIT_CANDIDATE.embodimentProfiles;
    expect(profiles.length).toBeGreaterThanOrEqual(6);
    expect([...new Set(profiles.map((profile) => profile.scale.class))]).toEqual(
      expect.arrayContaining(["small", "human-scale", "large", "distributed"]),
    );
    expect([...new Set(profiles.map((profile) => profile.environment.medium))]).toEqual(
      expect.arrayContaining(["gas", "liquid", "mixed", "solid-substrate"]),
    );

    const profileIds = new Set(profiles.map((profile) => profile.id));
    for (const member of RELIEF_CIRCUIT_CANDIDATE.cast) {
      expect(profileIds.has(member.profileId), `${member.id} must reference a declared embodiment profile`).toBe(true);
      expect(member.roleId).not.toBe(member.profileId);
    }
  });

  it("compiles through engine 1.3 with exact source recovery, state, and Common Watch law", () => {
    const arc = compileCommonShipPocket(RELIEF_CIRCUIT_CANDIDATE);
    expect(arc.meta).toMatchObject({
      id: "relief-circuit",
      name: "The Relief Circuit",
      domain: "godscar-common-ship",
      engineVersion: "1.3.0",
    });
    expect(readCommonShipPocketExtension(arc)).toEqual(RELIEF_CIRCUIT_CANDIDATE);
    expect(arc.stateDefinitions?.map((track) => track.id)).toEqual(SHIP_STATE);
    expect(arc.founding?.roster.every((slot) => typeof slot.compositionProfileId === "string")).toBe(true);

    for (const challenge of arc.challenges) {
      expect(challenge.compositionConstraints?.map((constraint) => constraint.category)).toEqual(WATCH_CATEGORIES);
      expect(challenge.outcomes.success.stateEffects?.length).toBeGreaterThan(0);
    }
  });

  it("records the Lamp District connection as an explicit deferred Gate 5 obligation", () => {
    expect(RELIEF_CIRCUIT_CANDIDATE.notes).toMatchObject({
      status: "gate-5-preparation",
      destinationCartridgeId: "lamp-district",
    });
  });
});
