import { describe, it, expect } from "vitest";
import {
  serializeGame,
  deserializeGame,
  SAVE_VERSION,
  MIGRATIONS,
  mapToArray,
  arrayToMap,
} from "../../src/engine/save.js";
import { CYCLE_ARC, makeCycleAgent, makeCycleOrg } from "../fixtures/cycle-arc.js";

function makeTestState() {
  const agent = makeCycleAgent({ id: "save-agent-1" });
  const org = makeCycleOrg([agent]);
  return { org, arc: CYCLE_ARC };
}

describe("serializeGame / deserializeGame", () => {
  it("round-trips org state including all fields", () => {
    const { org, arc } = makeTestState();
    org.unlockedProgressionTiers = ["earned-tier"];
    const json = serializeGame(org, arc);
    const { org: loaded, cycle } = deserializeGame(json, arc);

    expect(cycle).toBe(org.cycle);
    expect(loaded.id).toBe(org.id);
    expect(loaded.reputation).toBe(org.reputation);
    expect(loaded.resources).toEqual(org.resources);
    expect(loaded.unlockedProgressionTiers).toEqual(["earned-tier"]);
    expect(Object.keys(loaded.agents)).toEqual(Object.keys(org.agents));
    expect(loaded.agents["save-agent-1"]!.upkeep).toBe(1);
    expect(loaded.infrastructure.Quarters.level).toBe(2);
    expect(loaded.rngSeed).toBe(org.rngSeed);
  });

  it("throws on version newer than SAVE_VERSION", () => {
    const { org, arc } = makeTestState();
    const json = serializeGame(org, arc);
    const raw = JSON.parse(json);
    raw.version = SAVE_VERSION + 1;

    expect(() => deserializeGame(JSON.stringify(raw), arc)).toThrow(/newer than engine/);
  });

  it("throws on arc ID mismatch", () => {
    const { org, arc } = makeTestState();
    const json = serializeGame(org, arc);
    const raw = JSON.parse(json);
    raw.arcRef.id = "completely-different-arc";

    expect(() => deserializeGame(JSON.stringify(raw), arc)).toThrow(/Arc ID mismatch/);
  });

  it("throws on missing required fields", () => {
    expect(() => deserializeGame("{}", CYCLE_ARC)).toThrow(/version/);

    expect(() =>
      deserializeGame(JSON.stringify({ version: 1, arcRef: null, organization: {} }), CYCLE_ARC),
    ).toThrow();

    expect(() =>
      deserializeGame(JSON.stringify({ version: 1 }), CYCLE_ARC),
    ).toThrow();
  });

  it("MIGRATIONS dictionary is defined and callable", () => {
    // v1 has no migrations defined (nothing to migrate to yet)
    expect(typeof MIGRATIONS).toBe("object");
    // Future migrations can be added; for now verify the structure is correct
    for (const [key, fn] of Object.entries(MIGRATIONS)) {
      expect(typeof key).toBe("string");
      expect(typeof fn).toBe("function");
    }
  });
});

describe("mapToArray / arrayToMap helpers", () => {
  it("round-trips a Map through array serialization", () => {
    const original = new Map<string, number>([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
    const arr = mapToArray(original);
    const reconstructed = arrayToMap(arr);

    expect(reconstructed.get("a")).toBe(1);
    expect(reconstructed.get("b")).toBe(2);
    expect(reconstructed.get("c")).toBe(3);
    expect(reconstructed.size).toBe(3);
  });
});
