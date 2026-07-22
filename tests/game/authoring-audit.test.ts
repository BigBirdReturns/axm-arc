import { describe, expect, it } from "vitest";
import { FIRST_CHARTER, KIND_GODS_OF_ILYON } from "../../src/arcs/index.js";
import { auditArcAuthoring, attributeCoverage } from "../../src/game/lib/authoring-audit.js";

describe("authoring coverage audit", () => {
  it("makes First Charter's Wits specialist status explicit instead of invisible", () => {
    const wits = attributeCoverage(FIRST_CHARTER).find((entry) => entry.attributeId === "wits");
    expect(wits?.status).toBe("specialist");
    expect(wits?.roleIds).toEqual([]);
    expect(wits?.checkIds.length).toBeGreaterThan(0);
    expect(auditArcAuthoring(FIRST_CHARTER).passes).toBe(true);
  });
  it("reports complete role/check coverage for the Godscar reference grammar", () => {
    const audit = auditArcAuthoring(KIND_GODS_OF_ILYON);
    expect(audit.attributes.every((entry) => entry.status === "covered" || entry.status === "specialist")).toBe(true);
    expect(audit.attributes.find((entry) => entry.attributeId === "systems")?.status).toBe("specialist");
    expect(audit.passes).toBe(true);
  });
  it("detects dead attributes without changing Arc validation", () => {
    const dead = { ...FIRST_CHARTER, attributes: [...FIRST_CHARTER.attributes, { id: "unused", name: "Unused", description: "No role or check uses this." }] };
    expect(auditArcAuthoring(dead).attributes.find((entry) => entry.attributeId === "unused")?.status).toBe("dead");
    expect(auditArcAuthoring(dead).passes).toBe(false);
  });
});
