import type { CommonShipPocketSourceV2 } from "./embodiment.js";
import { COMMON_SHIP_STARTER } from "./templates.js";

/**
 * Gate 5 preparation authority for the first canonical Book III reference.
 *
 * The existing Common Ship starter already carries the intended mixed crew,
 * embodiment profiles, Watch Engine, ship-state tracks, and operational ledgers.
 * This candidate promotes that authored shape into a named, canon-compatible
 * campaign while leaving exact artifact publication, final campaign tuning,
 * authoring UI, and Lamp District cross-run execution to the Gate 5 train.
 */
const candidate = structuredClone(COMMON_SHIP_STARTER) as CommonShipPocketSourceV2;

candidate.identity = {
  id: "relief-circuit",
  title: "The Relief Circuit",
  description:
    "A mixed Common Ship carries medicine, specialists, continuity stores, and incompatible forms of life toward the Lamp District while a failing translation mesh turns every roster, habitat allocation, and delay into constitutional law.",
  author: "BigBirdReturns",
  version: "0.5.0",
  estimatedCycles: 20,
  parentCanons: [
    "The Godscar Codex, Book I: The Open Universe · first recension",
    "The Godscar Codex, Book II: The Dark Tomb · first recension",
    "The Godscar Codex, Book III: The Common Ship · first recension",
  ],
  canonRelation: "compatible",
};

candidate.controlQuestion =
  "Can the Relief Circuit reach the Lamp District without making one body, clock, interface, or emergency doctrine the native form through which every passenger must survive?";

candidate.pressures[1] = {
  kind: "mission",
  id: "lamp-district-relief",
  label: "The Lamp District relief circuit",
  description:
    "The ship must deliver medicine, heat-transfer capacity, witnesses, and continuity stores to the Lamp District without exposing the Tomb or consuming the short-lived crew in transit and standby.",
};

candidate.pressures[6] = {
  kind: "approaching-trigger",
  id: "scarway-collapse-and-mesh-outage",
  label: "Scarway collapse and translation outage",
  description:
    "The route to the Lamp District is closing while the central translation mesh spreads a disease pattern and the rescue watch cannot satisfy every body, clock, and habitat requirement at once.",
};

candidate.notes = {
  status: "gate-5-preparation",
  destinationCartridgeId: "lamp-district",
  requiredCrossRunFacts: [
    "ship state before docking",
    "named watch and excluded actor",
    "habitat and translation allocations",
    "handoff dissent, injury, debt, promises, missing persons, and uncertainty",
    "precedent established aboard the ship",
    "Lamp District Alarm, visibility, map, habitat, and constituency changes",
    "return-state effects inherited by the ship",
  ],
  deferredUntilGate5: [
    "final watch sequence and calibration",
    "exact .ship.json and .arc.json artifacts",
    "complete deterministic campaign sweep",
    "Common Ship Forge",
    "portable connected-run fixture with The Lamp District",
  ],
};

export const RELIEF_CIRCUIT_CANDIDATE: CommonShipPocketSourceV2 = candidate;
