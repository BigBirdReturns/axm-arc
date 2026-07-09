// PR 074 — vocabulary profile inspection. No new derivation exists here: the
// Library panel renders straight from `compatibilityProfile` (ledger.ts), the
// same helper `checkCompatibility` compares. This test guards the reuse
// assumption the panel depends on: a stable "prof1_" digest prefix and
// codepoint-sorted arrays (RFC_CARTRIDGE_LIBRARY PR 074).

import { describe, it, expect } from "vitest";
import { compatibilityProfile } from "../../src/game/lib/ledger.js";
import { FIRST_CHARTER } from "../../src/arcs/index.js";

function isCodepointSorted(xs: string[]): boolean {
  const sorted = [...xs].sort();
  return xs.every((v, i) => v === sorted[i]);
}

describe("compatibilityProfile (reused by LibraryScreen's profile panel)", () => {
  it("profileDigest starts with 'prof1_' and every dimension is codepoint-sorted", () => {
    const p = compatibilityProfile(FIRST_CHARTER);
    expect(p.profileDigest.startsWith("prof1_")).toBe(true);
    expect(isCodepointSorted(p.roleIds)).toBe(true);
    expect(isCodepointSorted(p.attributeIds)).toBe(true);
    expect(isCodepointSorted(p.tierIds)).toBe(true);
    expect(isCodepointSorted(p.itemSlots)).toBe(true);
    expect(isCodepointSorted(p.checkVocab)).toBe(true);
  });
});
