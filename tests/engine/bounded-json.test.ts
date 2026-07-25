import { describe, expect, it } from "vitest";
import {
  BoundedJsonError,
  parseBoundedJson,
  validateBoundedJsonValue,
} from "../../src/engine/bounded-json.js";

describe("bounded JSON input", () => {
  it("matches ordinary JSON semantics for valid portable values", () => {
    const source = '{"z":[1,true,null,"x\\n𐀀"],"a":{"__proto__":{"safe":true}}}';
    const parsed = parseBoundedJson(source) as Record<string, unknown>;
    expect(parsed).toEqual(JSON.parse(source));
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(parsed.a as object, "__proto__")).toBe(true);
    expect(({} as Record<string, unknown>)["safe"]).toBeUndefined();
  });

  it("refuses duplicate keys before schema validation can lose evidence", () => {
    expect(() => parseBoundedJson('{"id":"first","id":"second"}')).toThrow(/Duplicate object key "id"/);
    expect(() => parseBoundedJson('{"outer":{"x":1,"x":2}}')).toThrow(/Duplicate object key "x"/);
  });

  it("reports a stable line and column for malformed input", () => {
    try {
      parseBoundedJson('{\n  "a": 1,\n  "b": [true,]\n}');
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(BoundedJsonError);
      expect((error as Error).message).toMatch(/line 3, column/);
    }
  });

  it("enforces byte, depth, node, member, array, string, and number bounds", () => {
    expect(() => parseBoundedJson('"abcd"', { maxBytes: 3 })).toThrow(/maximum is 3/);
    expect(() => parseBoundedJson('[[[0]]]', { maxDepth: 2 })).toThrow(/nesting exceeds 2/);
    expect(() => parseBoundedJson('[0,1,2]', { maxNodes: 3 })).toThrow(/value count exceeds 3/);
    expect(() => parseBoundedJson('{"a":1,"b":2}', { maxObjectMembers: 1 })).toThrow(/member count exceeds 1/);
    expect(() => parseBoundedJson('[1,2]', { maxArrayItems: 1 })).toThrow(/item count exceeds 1/);
    expect(() => parseBoundedJson('"four"', { maxStringBytes: 3 })).toThrow(/maximum is 3/);
    expect(() => parseBoundedJson('1234', { maxNumberCharacters: 3 })).toThrow(/exceeds 3 characters/);
  });

  it("refuses JSON edge cases that do not have one portable meaning", () => {
    expect(() => parseBoundedJson('{"a":01}')).toThrow(/leading zero/);
    expect(() => parseBoundedJson('{"a":1e9999}')).toThrow(/not finite/);
    expect(() => parseBoundedJson('"\\ud800"')).toThrow(/unpaired high surrogate/);
    expect(() => parseBoundedJson('"\\udc00"')).toThrow(/unpaired low surrogate/);
  });

  it("validates already parsed API values against the same complexity law", () => {
    const value = { a: [1, "two", false], b: { c: null } };
    expect(() => validateBoundedJsonValue(value)).not.toThrow();
    expect(() => validateBoundedJsonValue({ value: Number.NaN })).toThrow(/finite/);
    expect(() => validateBoundedJsonValue([, 1])).toThrow(/Sparse arrays/);
    expect(() => validateBoundedJsonValue(new Date())).toThrow(/plain or null prototype/);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => validateBoundedJsonValue(cyclic)).toThrow(/cycle/);
  });
});
