import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RELIEF_CIRCUIT } from "../../src/arcs/relief-circuit.js";
import { RELIEF_CIRCUIT_SOURCE } from "../../src/common-ship/relief-circuit.js";
import { compileCommonShipPocket, readCommonShipPocketExtension } from "../../src/common-ship/compiler.js";
import { validateCommonShipPocket } from "../../src/common-ship/schema.js";
import { evaluateComposition } from "../../src/engine/composition.js";
import { foundOrganization } from "../../src/engine/founding.js";

const SHIP_STATE = [
  "habitat-integrity", "temporal-coherence", "translation-trust", "roster-resilience",
  "stores-and-care", "continuity", "visibility", "compatibility-debt",
];
const WATCH_CATEGORIES = [
  "role-coverage", "temporal-overlap", "habitat-compatibility",
  "translation-resilience", "handoff-continuity", "life-fraction-fairness",
];

describe("The Relief Circuit canonical Common Ship source", () => {
  it("is a canon-compatible 1.0 source with a complete Lamp District circuit", () => {
    expect(validateCommonShipPocket(RELIEF_CIRCUIT_SOURCE)).toEqual({ ok: true, source: RELIEF_CIRCUIT_SOURCE });
    expect(RELIEF_CIRCUIT_SOURCE.identity).toMatchObject({
      id: "relief-circuit", title: "The Relief Circuit", author: "BigBirdReturns", version: "1.0.0", canonRelation: "compatible",
    });
    expect(RELIEF_CIRCUIT_SOURCE.watches.map((watch) => watch.id)).toEqual([
      "recognize-the-school-loop",
      "audit-the-relief-stores",
      "compose-the-three-clock-watch",
      "declare-the-lamp-approach-watch",
      "cross-the-infected-mesh",
      "dock-without-declaring-the-tomb",
      "conduct-the-lamp-relief-descent",
      "conduct-the-commonship-inquiry",
      "carry-the-returning-constitution",
    ]);
    expect(RELIEF_CIRCUIT_SOURCE.notes).toMatchObject({
      status: "canonical-reference",
      destinationCartridgeId: "lamp-district",
      connectedOperationFormat: "axm-connected-operation/v1",
    });
  });

  it("compiles through engine 1.3 with exact source, state, consequence, and composition law", () => {
    const arc = compileCommonShipPocket(RELIEF_CIRCUIT_SOURCE);
    expect(arc).toEqual(RELIEF_CIRCUIT);
    expect(arc.meta).toMatchObject({ id: "relief-circuit", domain: "godscar-common-ship", engineVersion: "1.3.0" });
    expect(readCommonShipPocketExtension(arc)).toEqual(RELIEF_CIRCUIT_SOURCE);
    expect(arc.stateDefinitions?.filter((track) => track.kind === "number").map((track) => track.id).sort()).toEqual([...SHIP_STATE].sort());
    expect(arc.stateDefinitions?.filter((track) => track.kind === "boolean")).toHaveLength(RELIEF_CIRCUIT_SOURCE.consequences.length);
    expect(arc.founding?.roster.every((slot) => typeof slot.compositionProfileId === "string")).toBe(true);
    for (const challenge of arc.challenges) {
      expect(challenge.compositionConstraints?.map((constraint) => constraint.category)).toEqual(WATCH_CATEGORIES);
      expect(challenge.outcomes.success.stateEffects?.length).toBeGreaterThan(1);
      expect(challenge.outcomes.partial.stateEffects?.length).toBeGreaterThan(0);
      expect(challenge.outcomes.failure.stateEffects?.length).toBeGreaterThan(0);
    }
  });

  it("proves a lawful and unlawful watch from the same named founding population", () => {
    const org = foundOrganization(RELIEF_CIRCUIT, { format: "axm-founding-input/1", seed: 2207 });
    const challenge = RELIEF_CIRCUIT.challenges.find((candidate) => candidate.id === "compose-the-three-clock-watch")!;
    const allAgents = Object.values(org.agents);
    const lawful = evaluateComposition({ arc: RELIEF_CIRCUIT, challenge, agents: allAgents });
    expect(lawful.feasible).toBe(true);
    expect(lawful.results.map((result) => result.category)).toEqual(WATCH_CATEGORIES);

    const withoutCare = allAgents.filter((agent) => agent.role !== "care");
    const unlawful = evaluateComposition({ arc: RELIEF_CIRCUIT, challenge, agents: withoutCare });
    expect(unlawful.feasible).toBe(false);
    expect(unlawful.rejectionReasons.join(" ")).toMatch(/care|aquatic-care-lineage/i);
  });

  it("publishes deterministic portable source and Arc artifacts", () => {
    const sourceFile = JSON.parse(readFileSync(new URL("../../cartridges/relief-circuit.ship.json", import.meta.url), "utf8"));
    const arcFile = JSON.parse(readFileSync(new URL("../../cartridges/relief-circuit.arc.json", import.meta.url), "utf8"));
    expect(sourceFile).toEqual(RELIEF_CIRCUIT_SOURCE);
    expect(arcFile).toEqual(RELIEF_CIRCUIT);
  });
});
