import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { inspectFeasibleOptions, reloadDecisionLedger } from "../../src/kernel/decision.js";
import { DELIVERY_CONTRACT, DELIVERY_ORGANIZATION, NEXT_DELIVERY_CONTRACT, runObservedDeliveryReference } from "../../src/enterprise/delivery-reference.js";

describe("neutral enterprise decision reference", () => {
  it("completes the externally observed decision and receipt loop", () => {
    const result = runObservedDeliveryReference();
    expect(result.options.some((option) => option.feasible)).toBe(true);
    expect(result.selection.actorId).toBe("director-lee");
    expect(result.outcome.kind).toBe("observed");
    expect(result.outcome.evidenceRef).toMatch(/^genesis:\/\//);
    expect(result.ledger.receipts).toHaveLength(1);
    expect(result.ledger.receipts[0]!.variance.every((entry) => entry.attribution.length > 0)).toBe(true);
    expect(result.nextFeasibleOptions).toEqual(
      inspectFeasibleOptions(NEXT_DELIVERY_CONTRACT, result.nextOrganization).filter((option) => option.feasible),
    );
    expect(result.nextFeasibleOptions.length).toBeGreaterThan(0);
  });

  it("persists, reloads, and reproduces the immutable receipt", () => {
    const result = runObservedDeliveryReference();
    expect(reloadDecisionLedger(result.serialized)).toEqual(result.ledger);
    expect(Object.isFrozen(result.ledger)).toBe(true);
    expect(Object.isFrozen(result.ledger.receipts[0])).toBe(true);
    const tampered = JSON.parse(result.serialized);
    tampered.receipts[0].outcome.measures.cost += 1;
    expect(() => reloadDecisionLedger(JSON.stringify(tampered))).toThrow(/chain verification failed/);
  });

  it("uses authentic delivery vocabulary with no mandatory game placeholders", () => {
    const files = ["src/kernel/types.ts", "src/kernel/decision.ts", "src/enterprise/delivery-reference.ts"];
    const source = files.map((file) => fs.readFileSync(path.resolve(file), "utf8")).join("\n");
    expect(source).not.toMatch(/\b(loot|raid|affliction|attunement|drama card|heroic|morale)\b/i);
    expect(source).not.toMatch(/from\s+["']react(?:-dom)?["']|\blocalStorage\b|\bdocument\.|\bwindow\./);
    expect(source).not.toMatch(/src\/engine|\.\.\/engine/);
  });

  it("rejects unauthorized selection rather than inventing authority", async () => {
    const { authorizeSelection } = await import("../../src/kernel/decision.js");
    const option = inspectFeasibleOptions(DELIVERY_CONTRACT, DELIVERY_ORGANIZATION).find((candidate) => candidate.feasible)!;
    expect(() => authorizeSelection(DELIVERY_CONTRACT, option, { id: "observer", roles: ["analyst"] }, [], "2026-07-12T00:00:00Z"))
      .toThrow(/lacks an authorized role/);
  });
});
