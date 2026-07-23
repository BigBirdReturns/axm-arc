import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePortableRun } from "../../src/engine/portable-run.js";
import { connectedOperationFromRun } from "../../src/engine/connected-operation.js";

describe("Relief Circuit connected run fixture", () => {
  it("preserves changed ship and Tomb state in one exact portable record", () => {
    const json = readFileSync(new URL("../../cartridges/relief-circuit-lamp-district.run.json", import.meta.url), "utf8");
    const source = parsePortableRun(json);
    const connected = connectedOperationFromRun(source);
    expect(source.arc.meta.id).toBe("relief-circuit");
    expect(connected?.operation.status).toBe("returned");
    expect(connected?.destination.arc.meta.id).toBe("lamp-district");
    expect(source.org.cartridgeState).toMatchObject({
      "consequence:continuity:connected-relief-ledger": true,
      "consequence:jurisdiction:returning-commonship-charter": true,
    });
    expect(connected?.destination.org.cartridgeState).toMatchObject({
      "alarm-phase": "wake",
      "signature-status": "breached",
      "visibility-status": "exposed",
      "consequence:doctrine:public-depth-map": true,
    });
    expect(connected?.operation.transfer.people).toContain("Sel Aro");
    expect(connected?.operation.returnLedger.inheritedFacts).toHaveLength(4);
  });
});
