import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const CLI = resolve(ROOT, "tools/creator-kit-cli.ts");
const ORCHARD = resolve(ROOT, "cartridges/clean-room/orchard-at-low-tide.arc.json");
const MALFORMED = resolve(ROOT, "cartridges/clean-room/orchard-at-low-tide.invalid.arc.json");
const CHANGED_RUN = resolve(ROOT, "cartridges/clean-room/orchard-at-low-tide.changed.run.json");
const MANIFEST = JSON.parse(readFileSync(resolve(ROOT, "cartridges/clean-room/manifest.json"), "utf8")) as {
  cartridgeDigest: string;
  runIntegrityDigest: string;
};

function run(args: string[]) {
  const viteNode = resolve(ROOT, "node_modules/vite-node/vite-node.mjs");
  return spawnSync(process.execPath, [viteNode, CLI, ...args], { cwd: ROOT, encoding: "utf8" });
}
function receipt(result: ReturnType<typeof run>) {
  expect(result.status, result.stderr || result.stdout).toBe(0);
  return JSON.parse(result.stdout);
}

describe("standalone creator custody surface", () => {
  it("validates, identifies, inspects, and simulates the unaffiliated reference", () => {
    expect(receipt(run(["validate", "--file", ORCHARD]))).toMatchObject({
      format: "rodoh-creator-validation-receipt/1",
      cartridgeDigest: MANIFEST.cartridgeDigest,
      status: "pass",
    });
    expect(receipt(run(["digest", "--file", ORCHARD]))).toEqual({
      format: "rodoh-cartridge-digest-receipt/1",
      file: "orchard-at-low-tide.arc.json",
      cartridgeDigest: MANIFEST.cartridgeDigest,
    });
    expect(receipt(run(["inspect", "--file", ORCHARD]))).toMatchObject({
      format: "rodoh-creator-inspection-receipt/1",
      cartridgeDigest: MANIFEST.cartridgeDigest,
      sourcePlanes: [],
      unknownExtensions: ["cleanroom.orchard@1", "unfamiliar.garden-memory@7"],
    });
    expect(receipt(run(["simulate", "--file", ORCHARD, "--seeds", "4", "--max-cycles", "80"]))).toMatchObject({
      format: "rodoh-creator-simulation-receipt/1",
      cartridgeDigest: MANIFEST.cartridgeDigest,
      clearRate: 1,
      stallRate: 0,
      maxCycleRate: 0,
      totalGateViolations: 0,
      status: "pass",
    });
  });

  it("verifies the changed run and refuses malformed authored law", () => {
    expect(receipt(run(["verify-run", "--file", CHANGED_RUN]))).toMatchObject({
      format: "rodoh-run-verification-receipt/1",
      cartridgeDigest: MANIFEST.cartridgeDigest,
      runIntegrityDigest: MANIFEST.runIntegrityDigest,
      status: "pass",
    });
    const invalid = run(["validate", "--file", MALFORMED]);
    expect(invalid.status).not.toBe(0);
    const error = JSON.parse(invalid.stderr);
    expect(error.format).toBe("rodoh-creator-cli-error/1");
    expect(error.error).toMatch(/minAgents|maxAgents|roster/i);
  });

  it("keeps the public kit manifest honest and content-addressable", () => {
    const manifestText = readFileSync(resolve(ROOT, "creator-kit/manifest.json"), "utf8");
    const manifest = JSON.parse(manifestText);
    expect(manifest).toMatchObject({
      format: "rodoh-creator-recovery-kit/1",
      engine: "1.3.0",
      portableRun: "axm-cartridge-run/v3",
      runtime: { nodeMinimumMajor: 22, requiresNetwork: false, requiresRepositoryCheckout: false },
      bookIV: { registered: false },
    });
    expect(manifest.registeredSourcePlanes).toEqual([
      "godscar-pocket/1",
      "dark-tomb-pocket/1",
      "common-ship-pocket/1",
    ]);
    expect(createHash("sha256").update(manifestText).digest("hex")).toMatch(/^[0-9a-f]{64}$/);
  });
});
