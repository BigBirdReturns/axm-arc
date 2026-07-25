import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SOURCE_PLANE_REGISTRY } from "../../src/source-planes/registry.js";

const ROOT = resolve(import.meta.dirname, "../..");
const staging = JSON.parse(readFileSync(resolve(ROOT, "docs/post-v1/POST_V1_ARCHITECTURE_STAGING.json"), "utf8"));

describe("post-v1 decision kernel and causality staging", () => {
  it("records the Split decision and one shared package authority", () => {
    expect(staging).toMatchObject({
      format: "axm-post-v1-architecture-staging/1",
      releaseBoundary: { requiresRodohV1: true, changesV1Protocols: false },
      decisionKernel: {
        package: "@axm/decision-kernel",
        version: "0.1.0-candidate",
      },
    });
    expect(staging.decisionKernel.invariants.length).toBeGreaterThanOrEqual(8);
    expect(staging.decisionKernel.excludedPolicies).toEqual(expect.arrayContaining([
      "stress",
      "morale",
      "items and loot",
      "mandatory randomness",
      "React or presentation",
    ]));
    expect(staging.decisionKernel.conformance).toContain("Arc and World byte-equivalent canonical decision facts");
  });

  it("stages at-least-once transport with idempotent causal application", () => {
    expect(staging.connectedOperations).toMatchObject({
      format: "axm-connected-operation/v2-candidate",
      deliveryModel: "at-least-once-transport-idempotent-application",
      phases: ["prepared", "accepted", "committed", "returned", "compensated", "aborted"],
    });
    expect(staging.connectedOperations.invariants).toEqual(expect.arrayContaining([
      "transport may repeat but application is idempotent by operation identity",
      "partial commit is represented explicitly and never rewritten as atomic success",
      "compensation is a new consequence-bearing operation rather than history deletion",
    ]));
    expect(staging.connectedOperations.failureStates).toEqual(expect.arrayContaining([
      "replayed-operation",
      "causally-stale-parent",
      "partial-commit",
    ]));
  });

  it("does not implement the post-v1 package or mutate the v1 protocols", () => {
    expect(existsSync(resolve(ROOT, "packages/decision-kernel"))).toBe(false);
    expect(SOURCE_PLANE_REGISTRY.map((definition) => definition.format)).toEqual([
      "godscar-pocket/1",
      "dark-tomb-pocket/1",
      "common-ship-pocket/1",
    ]);
    const connected = readFileSync(resolve(ROOT, "src/engine/connected-operation.ts"), "utf8");
    expect(connected).toContain("axm-connected-operation/v1");
    expect(connected).not.toContain("axm-connected-operation/v2");
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
    expect(pkg.version).not.toBe("1.0.0");
  });
});
