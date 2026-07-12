import { describe, expect, it } from "vitest";
import { generateBoundaryAudit } from "../../src/audit/boundary-audit.js";

describe("enterprise bare-metal boundary inventory", () => {
  const audit = generateBoundaryAudit();

  it("classifies every engine module and every canonical cycle stage", () => {
    expect(audit.completeness.unclassifiedModules).toEqual([]);
    expect(audit.completeness.unclassifiedCycleStages).toEqual([]);
  });

  it("measures the current game-shaped public and schema surface", () => {
    expect(audit.publicSurface.total).toBeGreaterThan(100);
    expect(audit.publicSurface.symbols).toHaveLength(audit.publicSurface.total);
    expect(audit.publicSurface.gameOnly).toBeGreaterThan(0);
    expect(audit.schema.enterprisePlaceholderCount).toBeGreaterThan(0);
    expect(audit.schema.enterprisePlaceholderPaths).toContain("items");
    expect(audit.schema.enterprisePlaceholderPaths).toContain("attunementChains");
    expect(audit.schema.fields).toHaveLength(audit.schema.mandatoryPaths.length);
  });

  it("proves the fixed lifecycle still mandates game-only policy", () => {
    expect(audit.cycle.totalStages).toBe(14);
    expect(audit.cycle.mandatoryGameStages).toBeGreaterThan(0);
    expect(audit.cycle.stages.find((stage) => stage.step === "9")?.category).toBe("game_only_policy");
    expect(audit.cycle.stages.every((stage) => !stage.removable)).toBe(true);
  });

  it("makes proposed-kernel dependency leakage executable", () => {
    expect(audit.dependencies.kernelViolations).toContainEqual(
      expect.objectContaining({ from: "scoring.ts", to: "types.ts", fromCategory: "decision_kernel", toCategory: "game_only_policy" }),
    );
    expect(audit.dependencies.edges).toHaveLength(audit.dependencies.totalEdges);
    expect(audit.headlessKernelViolations).toEqual([]);
  });

  it("disqualifies Keep on the implemented boundary", () => {
    expect(audit.minimumCoreFilesToEdit).toBeGreaterThan(0);
    expect(audit.disposition).toBe("modularize-or-split");
  });

  it("recognizes the extracted headless target without game, browser, or presentation dependencies", () => {
    expect(audit.headlessTarget.modules).toEqual(["decision.ts", "types.ts"]);
    expect(audit.headlessTarget.loc).toBeGreaterThan(0);
    expect(audit.headlessTarget.forbiddenDependencies).toEqual([]);
    expect(audit.headlessTarget.forbiddenGlobals).toEqual([]);
  });
});
