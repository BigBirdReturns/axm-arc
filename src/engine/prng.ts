// Mulberry32 — fast, deterministic, good enough for simulation use.

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    z = (z ^ (z >>> 14)) >>> 0;
    return z / 0x100000000;
  };
}

export class Rng {
  private _raw: () => number;
  private _seed: number;
  private _calls = 0;

  constructor(seed: number) {
    this._seed = seed >>> 0;
    this._raw = mulberry32(this._seed);
  }

  next(): number {
    this._calls++;
    return this._raw();
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  uniform(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new RangeError("pick: empty array");
    return arr[this.int(0, arr.length - 1)] as T;
  }

  weightedPick<T>(items: readonly { item: T; weight: number }[]): T {
    if (items.length === 0) throw new RangeError("weightedPick: empty items");
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = this.next() * total;
    for (const entry of items) {
      r -= entry.weight;
      if (r <= 0) return entry.item;
    }
    return items[items.length - 1]!.item;
  }

  fork(): Rng {
    // Derive a child seed deterministically from current state.
    const childSeed = hashSeed(this._seed, this._calls);
    return new Rng(childSeed);
  }
}

export function hashSeed(...parts: (string | number)[]): number {
  // FNV-1a 32-bit over the concatenated parts.
  let h = 0x811c9dc5;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    // Separator between parts to avoid collision ("1","23") vs ("12","3")
    h ^= 0x1f;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
