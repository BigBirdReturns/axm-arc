import { compareCodepoints, orderRecordKeysDeep } from "../../engine/determinism.js";
import { hashSeed } from "../../engine/prng.js";

export { compareCodepoints, hashSeed };

export function uniqueOrdered(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareCodepoints);
}

export function fingerprint(value: unknown): string {
  const canonical = JSON.stringify(orderRecordKeysDeep(value));
  return `fnv1a32:${hashSeed(canonical).toString(16).padStart(8, "0")}`;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  };
}

export function shuffled<T>(values: readonly T[], seed: number): T[] {
  const output = [...values];
  const random = mulberry32(seed);
  for (let index = output.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex]!, output[index]!];
  }
  return output;
}
