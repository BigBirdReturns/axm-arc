// Property tests for the canonical cartridge digest — Stage 1 of the Genesis
// conformance ladder (docs/AXM_FAMILY.md). The digest is a deterministic
// content-identity anchor over an arc's authored bytes: it detects tampering,
// it does not prove authorship. These tests pin three things:
//
//   (1) the SHA-256 primitive is correct — asserted against the standard NIST
//       known-answer vectors, so a future refactor can't silently break it;
//   (2) canonicalization has the right invariances — key order and object
//       identity do not change the digest, but any authored byte does;
//   (3) reserved envelope/custody keys are excluded — signatures, prior digests,
//       trust labels, and provenance cannot change authored identity.
//
// This is the payload a Genesis signature (Stage 2) will sign over, so its
// stability is a platform guarantee, not a convenience.

import { describe, it, expect } from "vitest";
import { sha256Hex, canonicalizeArc, cartridgeDigest, RESERVED_ENVELOPE_KEYS } from "../../src/engine/cartridge-digest";
import { MINI_ARC } from "../fixtures/mini-arc";
import type { Arc } from "../../src/engine/types";

describe("sha256Hex — standard known-answer vectors", () => {
  it("matches the NIST/RFC test vectors", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("The quick brown fox jumps over the lazy dog")).toBe(
      "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
    );
    expect(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
    // Crosses multiple 64-byte blocks.
    expect(sha256Hex("a".repeat(1_000_000))).toBe(
      "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0",
    );
  });
});

describe("canonicalizeArc — deterministic, order-insensitive on keys", () => {
  it("sorts object keys recursively and preserves array order", () => {
    const a = { b: 1, a: 2, nested: { y: [3, 2, 1], x: "s" } } as unknown as Arc;
    const b = { nested: { x: "s", y: [3, 2, 1] }, a: 2, b: 1 } as unknown as Arc;
    expect(canonicalizeArc(a)).toBe('{"a":2,"b":1,"nested":{"x":"s","y":[3,2,1]}}');
    expect(canonicalizeArc(a)).toBe(canonicalizeArc(b));
  });

  it("drops undefined members and preserves null", () => {
    expect(canonicalizeArc({ a: 1, b: undefined } as unknown as Arc)).toBe('{"a":1}');
    expect(canonicalizeArc({ scaling: null } as unknown as Arc)).toBe('{"scaling":null}');
  });
});

describe("cartridgeDigest — content-identity anchor over a real arc", () => {
  it("has the cart1_<64 hex> shape", () => {
    expect(cartridgeDigest(MINI_ARC)).toMatch(/^cart1_[0-9a-f]{64}$/);
  });

  it("is stable across re-serialization / cloning of the same content", () => {
    expect(cartridgeDigest(MINI_ARC)).toBe(cartridgeDigest(structuredClone(MINI_ARC)));
  });

  it("does not depend on top-level key insertion order", () => {
    const reordered = Object.fromEntries(
      Object.entries(MINI_ARC as unknown as Record<string, unknown>).reverse(),
    ) as unknown as Arc;
    expect(cartridgeDigest(reordered)).toBe(cartridgeDigest(MINI_ARC));
  });

  it("changes when a single authored byte changes (tamper-evident)", () => {
    const tampered = { ...MINI_ARC, meta: { ...MINI_ARC.meta, name: MINI_ARC.meta.name + "​" } };
    expect(cartridgeDigest(tampered)).not.toBe(cartridgeDigest(MINI_ARC));
  });

  it("changes when an authored array is reordered", () => {
    const forward = { challenges: [{ id: "a" }, { id: "b" }] } as unknown as Arc;
    const reversed = { challenges: [{ id: "b" }, { id: "a" }] } as unknown as Arc;
    expect(cartridgeDigest(forward)).not.toBe(cartridgeDigest(reversed));
  });
});

describe("cartridgeDigest — reserved envelope/custody keys are excluded", () => {
  // The digest identifies authored law. Signatures, prior digests, trust labels,
  // and load-time provenance ride in the envelope and must not change identity.
  const RESERVED: ReadonlyArray<readonly [string, unknown]> = [
    ["digest", "cart1_x"],
    ["cartridgeDigest", "cart1_x"],
    ["signature", "sig"],
    ["signatures", ["sig"]],
    ["trust", "verified"],
    ["trustLabel", "verified"],
    ["provenance", { a: 1 }],
    ["importedAt", "2026-07-03"],
    ["source", "https://example.test/mini.json"],
    ["sourcePath", "/p"],
    ["verifiedAt", "2026-07-03"],
    ["verification", { ok: true }],
    ["publisher", { id: "p" }],
    ["publisherKey", "k"],
    ["genesis", { v: 1 }],
    ["attestation", { t: 1 }],
    ["attestations", [{ t: 1 }]],
  ];

  it("ignores each reserved key added at the top level", () => {
    const base = cartridgeDigest(MINI_ARC);
    for (const [key, val] of RESERVED) {
      const withKey = { ...MINI_ARC, [key]: val } as unknown as Arc;
      expect(cartridgeDigest(withKey)).toBe(base);
    }
  });

  it("ignores an envelope carrying all reserved keys at once", () => {
    const base = cartridgeDigest(MINI_ARC);
    const envelope = { ...MINI_ARC, ...Object.fromEntries(RESERVED) } as unknown as Arc;
    expect(cartridgeDigest(envelope)).toBe(base);
  });

  it("still changes the digest when authored law changes (guard is not over-broad)", () => {
    const tampered = { ...MINI_ARC, meta: { ...MINI_ARC.meta, name: MINI_ARC.meta.name + "!" } };
    expect(cartridgeDigest(tampered)).not.toBe(cartridgeDigest(MINI_ARC));
  });

  it("strips reserved keys only at the top level (nested authored data is preserved)", () => {
    // `source` here is nested authored content, not a top-level envelope key, so
    // it is part of identity — changing it must change the digest.
    const a = { x: { source: "one" } } as unknown as Arc;
    const b = { x: { source: "two" } } as unknown as Arc;
    expect(cartridgeDigest(a)).not.toBe(cartridgeDigest(b));
  });

  it("the test's reserved list matches the module's exported single source", () => {
    // Guards against the enumerated list here drifting from the module's set.
    expect(new Set(RESERVED.map(([k]) => k))).toEqual(RESERVED_ENVELOPE_KEYS);
  });
});
