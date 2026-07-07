// The First Lockout — cartridge conformance for the wipe-diagnosis slice.
// A single raid-night cartridge (three bosses, one lockout); the diagnosis
// behaviour itself is exercised in tests/sim/wipe-diagnosis.test.ts. This file
// proves the cartridge is a valid, digest-pinned, honestly-reachable arc
// through the real seams, like every other cartridge in cartridges/.

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importArcFromJson } from "../../src/game/lib/arc-library.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";
import type { Arc } from "../../src/engine/types.js";
import { simulateArcRun } from "../../src/sim/cartridge-conformance.js";

const LONG = 120_000;
const PINNED_DIGEST = "cart1_3cc60c051cc5a6834cbdaa60756563669850a0e7b8f4d22f947a71dd645f95c5";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(k: string): string | null { return this.store.has(k) ? (this.store.get(k) as string) : null; }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null; }
  removeItem(k: string): void { this.store.delete(k); }
  setItem(k: string, v: string): void { this.store.set(k, v); }
}
beforeEach(() => { globalThis.localStorage = new MemoryStorage(); });

const CARTRIDGE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../cartridges/first-lockout.arc.json",
);
const json = (): string => fs.readFileSync(CARTRIDGE_PATH, "utf8");
function loadArc(): Arc {
  const r = importArcFromJson(json());
  if (!r.ok) throw new Error(`first-lockout import failed: ${r.errors.join("; ")}`);
  return r.entry.arc;
}

describe("first-lockout cartridge", () => {
  it("imports through the real seam without errors", () => {
    const r = importArcFromJson(json());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry.arc.meta.id).toBe("first-lockout");
    expect(r.entry.trust).toBe("imported-unsigned");
  });

  it("cartridgeDigest pins the content identity", () => {
    expect(cartridgeDigest(loadArc())).toBe(PINNED_DIGEST);
  });

  it("same seed → identical run, twice", { timeout: LONG }, () => {
    const arc = loadArc();
    expect(simulateArcRun(arc, { seed: 7, maxCycles: 40 }))
      .toEqual(simulateArcRun(arc, { seed: 7, maxCycles: 40 }));
  });

  it("the full raid night is honestly reachable across seeds", { timeout: LONG }, () => {
    const arc = loadArc();
    let cleared = 0;
    let gateViolations = 0;
    for (let seed = 1; seed <= 15; seed++) {
      const run = simulateArcRun(arc, { seed, maxCycles: 40 });
      if (run.outcome === "cleared") cleared++;
      gateViolations += run.gateViolations;
    }
    expect(gateViolations).toBe(0);
    expect(cleared).toBe(15); // the wall is tight-but-fair: reachable every seed
  });
});
