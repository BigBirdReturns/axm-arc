import { describe, expect, it } from "vitest";
import { RELIEF_CIRCUIT } from "../../src/arcs/relief-circuit.js";
import { LAMP_DISTRICT } from "../../src/arcs/lamp-district.js";
import {
  buildConnectedOperation,
  connectedOperationFromRun,
  CONNECTED_OPERATION_EXTENSION_KEY,
  parseConnectedOperation,
} from "../../src/engine/connected-operation.js";
import { foundOrganization } from "../../src/engine/founding.js";
import { parsePortableRun } from "../../src/engine/portable-run.js";

function statefulFounding(arc: typeof RELIEF_CIRCUIT, seed: number, patch: Record<string, string | number | boolean>) {
  const org = foundOrganization(arc, { format: "axm-founding-input/1", seed });
  return { ...org, cartridgeState: { ...(org.cartridgeState ?? {}), ...patch } };
}

describe("versioned connected cartridge operation", () => {
  it("binds a Relief Circuit run to an exact Lamp District run without merging either state set", () => {
    const sourceOrg = statefulFounding(RELIEF_CIRCUIT, 17, {
      "continuity": 4,
      "consequence:continuity:connected-relief-ledger": true,
    });
    const destinationOrg = statefulFounding(LAMP_DISTRICT as typeof RELIEF_CIRCUIT, 19, {
      "alarm-phase": "wake",
      "visibility-status": "exposed",
      "consequence:doctrine:public-depth-map": true,
    });
    const { sourceRun, operation } = buildConnectedOperation({
      sourceArc: RELIEF_CIRCUIT,
      sourceOrg,
      destinationArc: LAMP_DISTRICT,
      destinationOrg,
      transfer: {
        id: "relief-circuit-lamp-district",
        title: "The Lamp District connected relief descent",
        selectedWatchId: "conduct-the-lamp-relief-descent",
        excludedActor: "Residents who cannot appear at the threshold without invalidating the exterior lie.",
        dependency: "The silent civic lock and two separately sovereign machine memories.",
        precedentId: "connected-relief-ledger",
        people: ["Nima Quell", "Orun Sable", "Tessara One", "Arden Pell", "Cinder Continuing", "Sel Aro"],
        stores: ["medicine", "heat-transfer capacity", "living cultures"],
        evidence: ["surface-house ledgers", "Meridian response fragment"],
        translationPaths: ["raw relay evidence", "surface testimony", "ship handoff memory"],
        environmentalLoads: ["pressure cell", "thermal mask", "mixed-carrier route"],
        exposureConsequences: ["surface-house radiation", "spent visibility", "new route dependency"],
        provenance: ["ship watch receipt", "Tomb expedition ledger"],
        decisions: ["authorize bounded relief"],
        dissent: ["Some residents classify the operation as exposure."],
        uncertainty: ["The lattice response is not a motive record."],
        obligations: ["return the route and preserve local review"],
        unknownMemory: { "test.opaque@1": { preserved: true } },
      },
      returnLedger: {
        sourceStateBefore: { "continuity": 3 },
        sourceStateAfter: { "continuity": 4, "compatibility-debt": 2 },
        destinationStateBefore: { "alarm-phase": "hush", "visibility-status": "hidden" },
        destinationStateAfter: { "alarm-phase": "wake", "visibility-status": "exposed" },
        inheritedFacts: ["Two source planes remain separate.", "The connected relief ledger is retained by both polities."],
        dissent: ["The same contact carries incompatible classifications."],
        uncertainty: ["Intent remains contested."],
        obligations: ["Preserve both review forums."],
        unknownMemory: { "test.return-opaque@1": ["raw", "uninterpreted"] },
      },
      status: "returned",
    });
    const restoredSource = parsePortableRun(sourceRun);
    expect(restoredSource.extensions[CONNECTED_OPERATION_EXTENSION_KEY]).toBeDefined();
    const connected = connectedOperationFromRun(restoredSource);
    expect(connected?.operation).toEqual(operation);
    expect(connected?.operation.status).toBe("returned");
    expect(connected?.operation.transfer.dissent).toEqual(["Some residents classify the operation as exposure."]);
    expect(connected?.operation.transfer.unknownMemory).toEqual({ "test.opaque@1": { preserved: true } });
    expect(connected?.operation.returnLedger.obligations).toEqual(["Preserve both review forums."]);
    expect(connected?.destination.arc.meta.id).toBe("lamp-district");
    expect(connected?.destination.org.cartridgeState).toMatchObject({
      "alarm-phase": "wake",
      "visibility-status": "exposed",
    });
    expect(restoredSource.org.cartridgeState).toMatchObject({ "continuity": 4 });
  });

  it("refuses a destination digest that does not match the nested portable run", () => {
    const sourceOrg = foundOrganization(RELIEF_CIRCUIT, { format: "axm-founding-input/1", seed: 3 });
    const destinationOrg = foundOrganization(LAMP_DISTRICT, { format: "axm-founding-input/1", seed: 5 });
    const { operation } = buildConnectedOperation({
      sourceArc: RELIEF_CIRCUIT,
      sourceOrg,
      destinationArc: LAMP_DISTRICT,
      destinationOrg,
      transfer: {
        id: "test-transfer", title: "Test transfer", selectedWatchId: "conduct-the-lamp-relief-descent",
        excludedActor: "Absent residents", dependency: "Silent lock", precedentId: "connected-relief-ledger",
        people: ["Nima Quell"], stores: ["medicine"], evidence: ["receipt"],
        translationPaths: ["raw evidence"], environmentalLoads: ["pressure"], exposureConsequences: ["visibility"],
      },
    });
    expect(operation.transfer.dissent).toBeUndefined();
    expect(operation.returnLedger.uncertainty).toBeUndefined();
    expect(() => parseConnectedOperation({ ...operation, destinationCartridgeDigest: "cart1_" + "0".repeat(64) }, RELIEF_CIRCUIT)).toThrow(/destination digest/i);
  });
});
