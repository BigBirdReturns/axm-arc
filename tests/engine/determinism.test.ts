import { describe, expect, it } from "vitest";
import {
  compareCodepoints,
  orderedEntries,
  orderedKeys,
  orderedStrings,
  orderedValues,
  orderRecordKeysDeep,
} from "../../src/engine/determinism.js";

describe("deterministic record traversal", () => {
  it("uses one locale-independent order for keys, entries, values, and strings", () => {
    const record = { z: 3, a: 1, e: 2 };
    expect(orderedKeys(record)).toEqual(["a", "e", "z"]);
    expect(orderedEntries(record)).toEqual([["a", 1], ["e", 2], ["z", 3]]);
    expect(orderedValues(record)).toEqual([1, 2, 3]);
    expect(orderedStrings(["z", "a", "e"])).toEqual(["a", "e", "z"]);
    expect(["z", "a", "e"].sort(compareCodepoints)).toEqual(["a", "e", "z"]);
  });

  it("does not mutate the caller's array", () => {
    const input = ["z", "a"];
    expect(orderedStrings(input)).toEqual(["a", "z"]);
    expect(input).toEqual(["z", "a"]);
  });

  it("orders Unicode scalar values rather than UTF-16 surrogate units", () => {
    const bmp = "\uE000";
    const supplementary = "\u{10000}";
    expect(orderedStrings([supplementary, bmp])).toEqual([bmp, supplementary]);
  });

  it("normalizes nested Record keys while preserving array order", () => {
    const normalized = orderRecordKeysDeep({ z: { y: 2, a: 1 }, a: [{ z: 3, a: 4 }] });
    expect(JSON.stringify(normalized)).toBe('{"a":[{"a":4,"z":3}],"z":{"a":1,"y":2}}');
  });
});
