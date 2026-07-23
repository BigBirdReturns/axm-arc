import { describe, expect, it } from "vitest";
import { LAMP_DISTRICT_SOURCE } from "../../src/dark-tomb/lamp-district.js";

// This guard protects the source-authority calibration consumed by World's
// direct-play browser journey. Receiver code must not compensate for it.
describe("Lamp District Gate 4 breach calibration", () => {
  it("keeps the surface-sacrifice breach inside a bounded direct-player recovery band", () => {
    const delve = LAMP_DISTRICT_SOURCE.delves.find((entry) => entry.id === "interrupt-the-surface-sacrifice");
    expect(delve?.checks.map((check) => [check.id, check.threshold])).toEqual([
      ["stop-the-cut-order", 6],
      ["rewrite-the-grave-skin", 5],
    ]);
  });
});
