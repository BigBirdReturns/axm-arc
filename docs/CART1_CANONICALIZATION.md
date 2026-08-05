# `cart1_` Canonicalization Contract

## Status

This document freezes the content-identity algorithm already used by AXM Arc and Rodoh. It is a specification of existing `cart1_` behavior. It does not change any cartridge identity.

```text
cart1_<lowercase SHA-256 hex>
```

A `cart1_` identifier detects a change in authored law. It does not prove authorship, publisher identity, trust, ownership, or certification.

## Input

The input is one validated Arc-compatible JSON object. A file may arrive inside a larger custody envelope, but the digest is always derived from the Arc's authored content rather than from transport metadata.

## Reserved root custody fields

The following keys are removed only when they occur at the Arc root:

```text
digest
cartridgeDigest
signature
signatures
trust
trustLabel
provenance
importedAt
source
sourcePath
verifiedAt
verification
publisher
publisherKey
genesis
attestation
attestations
```

A key with the same spelling nested inside authored content remains authored law and affects the digest.

Root stripping exists so signatures, loader-assigned trust, and provenance can travel beside an Arc without changing the Arc's identity. A file cannot declare its own content digest or trust level.

## Canonical JSON

After reserved root fields are removed:

1. Object keys are ordered by Unicode scalar value using `compareCodepoints()`.
2. Arrays retain authored order.
3. String values are encoded through ordinary JSON string escaping.
4. Finite numbers use JavaScript `JSON.stringify()` number serialization.
5. Booleans and null use their JSON literals.
6. Object members whose value is `undefined` are omitted, matching JSON serialization.
7. Array holes or undefined array members canonicalize as null, matching JSON serialization.
8. Non-finite numbers and non-JSON values are refused.
9. The resulting canonical JSON string is encoded as UTF-8.
10. SHA-256 is computed over those bytes and rendered as lowercase hexadecimal.

The prefix `cart1_` is prepended to that hexadecimal digest.

## Parser boundary

Text imports pass through the bounded, duplicate-aware JSON parser before schema validation or digesting. Therefore:

- duplicate object keys are refused rather than collapsed;
- unpaired Unicode surrogates are refused;
- excessive byte size, depth, node count, member count, array length, string size, and number length are refused;
- `__proto__` remains an ordinary data key and cannot mutate an object prototype.

The parser boundary does not reorder arrays, repair schema fields, infer trust, or normalize authored vocabulary.

## Relationship to RFC 8785

`cart1_` predates a decision to adopt JSON Canonicalization Scheme as the project identity algorithm. Its contract is similar in purpose but is not declared to be RFC 8785 JCS. In particular, existing JavaScript number serialization and the established root custody-field rule are part of deployed identity.

Changing the algorithm under the same prefix would relabel every cartridge and invalidate historical references. Any future incompatible canonicalization regime must use a new identity prefix, such as `cart2_`, and an explicit migration event. Historical `cart1_` values remain evidence locators rather than aliases.

## Conformance

`docs/conformance/cart1-v1-vectors.json` fixes the current first-party and clean-room identities. The permanent test additionally proves:

- root custody metadata does not change identity;
- nested fields with reserved names do change identity;
- object insertion order does not change identity;
- array order does change identity;
- one authored scalar change changes identity;
- Arc and World compute the same values from the same bytes.

## Control question

Can two compatible clients receive the same authored Arc, disagree about object insertion order or custody metadata, and still compute the same `cart1_` identity while any change to authored law produces a different identity? If not, the implementation violates this contract.
