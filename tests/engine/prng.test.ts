import { describe, it, expect } from "vitest";
import { Rng, hashSeed } from "../../src/engine/prng";

describe("Rng determinism", () => {
  it("produces the same sequence from the same seed", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences from different seeds", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("next() returns values in [0, 1)", () => {
    const rng = new Rng(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int(min, max) returns integers within [min, max]", () => {
    const rng = new Rng(7);
    for (let i = 0; i < 500; i++) {
      const v = rng.int(3, 10);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("uniform(min, max) returns floats within [min, max)", () => {
    const rng = new Rng(13);
    for (let i = 0; i < 500; i++) {
      const v = rng.uniform(2.5, 7.5);
      expect(v).toBeGreaterThanOrEqual(2.5);
      expect(v).toBeLessThan(7.5);
    }
  });
});

describe("Rng.fork()", () => {
  it("fork() produces a deterministic but different sequence than parent", () => {
    const parent = new Rng(100);
    // Advance parent some calls
    for (let i = 0; i < 5; i++) parent.next();
    const child = parent.fork();

    const parentSeq = Array.from({ length: 10 }, () => parent.next());
    const childSeq = Array.from({ length: 10 }, () => child.next());

    expect(parentSeq).not.toEqual(childSeq);
  });

  it("fork() is reproducible — forking at the same state yields same child sequence", () => {
    const rngA = new Rng(200);
    for (let i = 0; i < 7; i++) rngA.next();
    const forkA = rngA.fork();

    const rngB = new Rng(200);
    for (let i = 0; i < 7; i++) rngB.next();
    const forkB = rngB.fork();

    const seqA = Array.from({ length: 10 }, () => forkA.next());
    const seqB = Array.from({ length: 10 }, () => forkB.next());
    expect(seqA).toEqual(seqB);
  });
});

describe("hashSeed", () => {
  it("is stable — same inputs always produce same output", () => {
    expect(hashSeed("arc-one", 3, "challenge-1")).toBe(hashSeed("arc-one", 3, "challenge-1"));
  });

  it("differs for different inputs", () => {
    const h1 = hashSeed("a", 1, "b");
    const h2 = hashSeed("a", 2, "b");
    expect(h1).not.toBe(h2);
  });

  it("avoids trivial collisions between swapped args", () => {
    expect(hashSeed(1, 23)).not.toBe(hashSeed(12, 3));
  });

  it("returns a 32-bit unsigned integer", () => {
    const h = hashSeed("test", 42);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(h)).toBe(true);
  });
});

describe("Rng.weightedPick()", () => {
  it("distributes within ±5% of expected weights over 10000 samples", () => {
    const rng = new Rng(555);
    const items = [
      { item: "A", weight: 0.5 },
      { item: "B", weight: 0.3 },
      { item: "C", weight: 0.2 },
    ] as const;

    const counts: Record<string, number> = { A: 0, B: 0, C: 0 };
    const N = 10000;
    for (let i = 0; i < N; i++) {
      counts[rng.weightedPick(items)]!++;
    }

    expect(counts["A"]! / N).toBeGreaterThan(0.45);
    expect(counts["A"]! / N).toBeLessThan(0.55);
    expect(counts["B"]! / N).toBeGreaterThan(0.25);
    expect(counts["B"]! / N).toBeLessThan(0.35);
    expect(counts["C"]! / N).toBeGreaterThan(0.15);
    expect(counts["C"]! / N).toBeLessThan(0.25);
  });

  it("throws on empty items", () => {
    const rng = new Rng(1);
    expect(() => rng.weightedPick([])).toThrow(RangeError);
  });
});
