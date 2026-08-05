import { describe, expect, it } from "vitest";
import vectors from "../../docs/conformance/cart1-v1-vectors.json";
import orchard from "../../cartridges/clean-room/orchard-at-low-tide.arc.json";
import { FIRST_CHARTER, KARAZHAN, KIND_GODS_OF_ILYON, LAMP_DISTRICT, RELIEF_CIRCUIT } from "../../src/arcs/index.js";
import { canonicalizeArc, cartridgeDigest } from "../../src/engine/cartridge-digest.js";
import { parseBoundedJson } from "../../src/engine/bounded-json.js";
import type { Arc } from "../../src/engine/types.js";

const ARCS: Record<string, Arc> = {
  "first-charter": FIRST_CHARTER,
  karazhan: KARAZHAN,
  "kind-gods-of-ilyon": KIND_GODS_OF_ILYON,
  "lamp-district": LAMP_DISTRICT,
  "relief-circuit": RELIEF_CIRCUIT,
  // JSON module inference widens fixed-length relationship tuples to string[].
  // The same artifact is validated as an Arc by the clean-room contract; this
  // test consumes those exact accepted bytes solely as a canonicalization vector.
  "orchard-at-low-tide": orchard as unknown as Arc,
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("cart1 canonicalization contract", () => {
  it("matches every published first-party and clean-room vector", () => {
    expect(vectors.format).toBe("axm-cart1-conformance-vectors/1");
    for (const vector of vectors.vectors) {
      const arc = ARCS[vector.id];
      expect(arc, `missing Arc fixture for ${vector.id}`).toBeDefined();
      expect(cartridgeDigest(arc!)).toBe(vector.digest);
    }
  });

  it("excludes only root custody metadata", () => {
    const withCustody = {
      ...FIRST_CHARTER,
      signature: "holder-supplied",
      trust: "verified",
      provenance: { source: "outside authored law" },
    } as Arc;
    expect(cartridgeDigest(withCustody)).toBe(cartridgeDigest(FIRST_CHARTER));

    const nested = clone(FIRST_CHARTER);
    const parameters = nested.challenges[0]!.completionCriteria.parameters as Record<string, unknown>;
    parameters.publisher = "authored nested claim";
    expect(cartridgeDigest(nested)).not.toBe(cartridgeDigest(FIRST_CHARTER));
  });

  it("ignores object insertion order while preserving authored array order", () => {
    const reverseRoot = Object.fromEntries(Object.entries(FIRST_CHARTER).reverse()) as unknown as Arc;
    expect(canonicalizeArc(reverseRoot)).toBe(canonicalizeArc(FIRST_CHARTER));
    expect(cartridgeDigest(reverseRoot)).toBe(cartridgeDigest(FIRST_CHARTER));

    const reordered = clone(FIRST_CHARTER);
    reordered.attributes.reverse();
    expect(cartridgeDigest(reordered)).not.toBe(cartridgeDigest(FIRST_CHARTER));
  });

  it("changes identity for one authored scalar change", () => {
    const changed = clone(FIRST_CHARTER);
    changed.meta.description += " Changed authored law.";
    expect(cartridgeDigest(changed)).not.toBe(cartridgeDigest(FIRST_CHARTER));
  });

  it("refuses duplicate text keys before canonicalization", () => {
    expect(() => parseBoundedJson('{"meta":{"id":"a","id":"b"}}')).toThrow(/Duplicate object key/);
  });
});
