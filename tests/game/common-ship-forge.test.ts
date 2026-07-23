import { describe, expect, it } from "vitest";
import {
  commonShipStarterJson,
  compileCommonShipJson,
  playtestCommonShipArc,
  reliefCircuitJson,
} from "../../src/game/lib/common-ship-forge.js";

describe("Common Ship Forge", () => {
  it("compiles the starter and canonical Relief Circuit through the registered source plane", () => {
    const starter = compileCommonShipJson(commonShipStarterJson());
    const relief = compileCommonShipJson(reliefCircuitJson());
    expect(starter.ok).toBe(true);
    expect(relief.ok).toBe(true);
    if (relief.ok) {
      expect(relief.source.identity.id).toBe("relief-circuit");
      expect(relief.arc.meta.engineVersion).toBe("1.3.0");
    }
  });

  it("runs deterministic authored-founding campaign sweeps", () => {
    const compiled = compileCommonShipJson(reliefCircuitJson());
    if (!compiled.ok) throw new Error(compiled.errors.join("\n"));
    const result = playtestCommonShipArc(compiled.arc, [101, 211, 307, 419], 120);
    expect(result).toMatchObject({ cleared: 4, failed: 0, gateViolations: 0, warnings: [] });
  });

  it("refuses malformed or non-Common-Ship source", () => {
    expect(compileCommonShipJson("{}")).toMatchObject({ ok: false });
  });
});
