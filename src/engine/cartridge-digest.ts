// Canonical cartridge digest — a deterministic content-identity anchor over an
// arc's authored bytes.
//
// This is the honest first rung of the Genesis conformance ladder
// (docs/AXM_FAMILY.md, Stage 1): a digest *detects tampering; it does not prove
// authorship*. When the hub signs a cartridge (Stage 2), the payload it signs
// over is exactly `canonicalizeArc(arc)` — so introducing the digest now keeps
// that adoption additive rather than a rewrite.
//
// The digest identifies *authored law*. Custody metadata — signatures, trust
// labels, prior digests, load-time provenance — rides in the envelope and must
// never change a cartridge's content identity. So a fixed set of reserved
// top-level keys is stripped before hashing (see RESERVED_ENVELOPE_KEYS): the
// digest is safe even if a caller passes an envelope-shaped or imported object.
//
// Pure and dependency-free: canonical JSON (object keys sorted recursively,
// array order preserved) hashed with a self-contained SHA-256. It takes no new
// dependency and does not rely on an ambient Web Crypto global, so it computes
// byte-identically in the browser player and in Node tests — which is the whole
// point of a content-identity anchor.

import type { Arc } from "./types";

/** Envelope / custody / provenance keys that may ride alongside an arc at the
 *  top level — in a cartridge envelope, an imported object, or a signed record —
 *  but are NOT authored law. They are stripped from the root before hashing so
 *  custody metadata can never perturb content identity:
 *
 *    the digest identifies authored law;
 *    the envelope carries custody metadata;
 *    custody metadata must not change authored identity.
 *
 *  Stripping is TOP-LEVEL ONLY. Authored content nested anywhere below the root
 *  (including freeform maps like a challenge's completionCriteria.parameters)
 *  keeps every key it declares, so tamper sensitivity on authored law is fully
 *  preserved even if an author legitimately uses one of these names deep inside. */
const RESERVED_ENVELOPE_KEYS: ReadonlySet<string> = new Set([
  "digest",
  "cartridgeDigest",
  "signature",
  "signatures",
  "trust",
  "trustLabel",
  "provenance",
  "importedAt",
  "source",
  "sourcePath",
  "verifiedAt",
  "verification",
  "publisher",
  "publisherKey",
  "genesis",
  "attestation",
  "attestations",
]);

/** Deterministic canonical JSON for an arc: reserved top-level envelope/custody
 *  keys removed, then object keys sorted recursively, array order preserved,
 *  `undefined` members dropped (as `JSON` does). Two arcs that differ only in
 *  key insertion order — or in top-level custody metadata — canonicalize
 *  identically; reordering an authored array, or changing any authored byte,
 *  does not. */
export function canonicalizeArc(arc: Arc): string {
  return canonicalize(stripReservedTopLevel(arc));
}

/** The content-identity anchor for a cartridge: `cart1_<sha256 hex>` over the
 *  canonical bytes. The `cart1_` prefix mirrors Genesis's derived-id convention
 *  (`sh1_<hash>`), marking this as version-1 cartridge content identity. The id
 *  is derived, never stored on the arc — a file can no more declare its own
 *  digest than it can declare its own trust level. */
export function cartridgeDigest(arc: Arc): string {
  return "cart1_" + sha256Hex(canonicalizeArc(arc));
}

/** SHA-256 of a UTF-8 string as lowercase hex. Self-contained; matches the
 *  standard NIST test vectors (asserted in the test suite). */
export function sha256Hex(input: string): string {
  return bytesToHex(sha256(utf8Bytes(input)));
}

// ── reserved-key strip ──────────────────────────────────────────────────────

/** Remove reserved envelope/custody keys from the ROOT object only. Non-object
 *  inputs pass through unchanged; nested objects/arrays are left untouched (they
 *  are canonicalized recursively, but not stripped). */
function stripReservedTopLevel(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (RESERVED_ENVELOPE_KEYS.has(key)) continue;
    out[key] = obj[key];
  }
  return out;
}

// ── canonical JSON ───────────────────────────────────────────────────────────

function canonicalize(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "string") return JSON.stringify(value);
  if (t === "number") {
    if (!Number.isFinite(value as number)) {
      throw new Error("cannot canonicalize a non-finite number");
    }
    return JSON.stringify(value);
  }
  if (t === "boolean") return (value as boolean) ? "true" : "false";
  if (Array.isArray(value)) {
    // Array order is content: preserve it. A hole/undefined serializes as null,
    // matching JSON.stringify.
    return "[" + value.map((v) => canonicalize(v === undefined ? null : v)).join(",") + "]";
  }
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of Object.keys(obj).sort()) {
      const v = obj[key];
      if (v === undefined) continue; // JSON drops undefined members
      parts.push(JSON.stringify(key) + ":" + canonicalize(v));
    }
    return "{" + parts.join(",") + "}";
  }
  throw new Error("cannot canonicalize a value of type " + t);
}

// ── SHA-256 (self-contained, deterministic) ──────────────────────────────────

const K: readonly number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function utf8Bytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function sha256(bytes: Uint8Array): Uint8Array {
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const bitLen = bytes.length * 8;
  // Pad: append 0x80, then zeros until length ≡ 56 (mod 64), then the 64-bit
  // big-endian bit length.
  const withOne = bytes.length + 1;
  const padZeros = (56 - (withOne % 64) + 64) % 64;
  const total = withOne + padZeros + 8;
  const msg = new Uint8Array(total);
  msg.set(bytes, 0);
  msg[bytes.length] = 0x80;
  const view = new DataView(msg.buffer);
  view.setUint32(total - 8, Math.floor(bitLen / 0x100000000));
  view.setUint32(total - 4, bitLen >>> 0);

  const w = new Array<number>(64).fill(0);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15]!;
      const w2 = w[i - 2]!;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let a = h[0]!, b = h[1]!, c = h[2]!, d = h[3]!;
    let e = h[4]!, f = h[5]!, g = h[6]!, hh = h[7]!;
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + ch + K[i]! + w[i]!) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a) >>> 0; h[1] = (h[1]! + b) >>> 0;
    h[2] = (h[2]! + c) >>> 0; h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0; h[5] = (h[5]! + f) >>> 0;
    h[6] = (h[6]! + g) >>> 0; h[7] = (h[7]! + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i]!);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}
