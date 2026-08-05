import { describe, expect, it } from "vitest";
import { parseBoundedJson } from "../../src/engine/bounded-json.js";

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function generatedValue(random: () => number, depth = 0): unknown {
  const leaf = depth >= 5 || random() < 0.45;
  if (leaf) {
    const kind = Math.floor(random() * 5);
    if (kind === 0) return null;
    if (kind === 1) return random() < 0.5;
    if (kind === 2) return Math.round((random() * 2 - 1) * 1_000_000) / 100;
    if (kind === 3) return `s-${Math.floor(random() * 1_000_000)}-𐀀`;
    return "";
  }
  if (random() < 0.5) {
    return Array.from({ length: Math.floor(random() * 8) }, () => generatedValue(random, depth + 1));
  }
  const object: Record<string, unknown> = {};
  const count = Math.floor(random() * 8);
  for (let index = 0; index < count; index += 1) {
    object[`k-${depth}-${index}-${Math.floor(random() * 10_000)}`] = generatedValue(random, depth + 1);
  }
  return object;
}

describe("bounded JSON differential fuzzing", () => {
  it("matches JSON.parse on 512 deterministic portable values", () => {
    const random = rng(0x524f444f);
    for (let caseId = 0; caseId < 512; caseId += 1) {
      const value = generatedValue(random);
      const source = JSON.stringify(value);
      expect(parseBoundedJson(source), `case ${caseId}: ${source.slice(0, 120)}`).toEqual(JSON.parse(source));
    }
  });

  it("refuses duplicate-key mutations regardless of the final value", () => {
    for (let index = 0; index < 128; index += 1) {
      const source = `{"stable":${index},"nested":{"x":${index}},"stable":${index + 1}}`;
      expect(() => parseBoundedJson(source), source).toThrow(/Duplicate object key "stable"/);
    }
  });

  it("refuses depth and node amplification at the exact configured boundary", () => {
    const deep = `${"[".repeat(12)}0${"]".repeat(12)}`;
    expect(() => parseBoundedJson(deep, { maxDepth: 11 })).toThrow(/nesting exceeds 11/);
    expect(() => parseBoundedJson(deep, { maxDepth: 12 })).not.toThrow();

    const nodes = JSON.stringify(Array.from({ length: 31 }, (_, index) => index));
    expect(() => parseBoundedJson(nodes, { maxNodes: 31 })).toThrow(/value count exceeds 31/);
    expect(() => parseBoundedJson(nodes, { maxNodes: 32 })).not.toThrow();
  });
});
