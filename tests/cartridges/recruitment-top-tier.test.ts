import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { refreshOpenPool } from "../../src/engine/recruitment.js";
import { Rng } from "../../src/engine/prng.js";
import { validateArc } from "../../src/engine/schema.js";
import { makeCycleOrg } from "../fixtures/cycle-arc.js";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SHIPPED_CARTRIDGES = [
  "deepway-rescue",
  "first-lockout",
  "palisade-war",
  "second-lockout",
  "severed-march",
  "wandering-court",
] as const;

function loadCartridge(name: string) {
  const raw = fs.readFileSync(path.resolve(TEST_DIR, `../../cartridges/${name}.arc.json`), "utf8");
  return validateArc(JSON.parse(raw));
}

describe("shipped cartridge recruitment", () => {
  it.each(SHIPPED_CARTRIDGES)("keeps %s's top tier milestone-only", (name) => {
    const arc = loadCartridge(name);
    const topTierId = arc.tiers.at(-1)!.id;
    const org = makeCycleOrg([], { reputation: 100 });

    for (let seed = 0; seed < 30; seed++) {
      const { pool } = refreshOpenPool(org, arc, new Rng(seed), 1);
      expect(pool.length).toBeGreaterThan(0);
      expect(pool.every((agent) => agent.tier !== topTierId)).toBe(true);
    }
  });
});
