# Import Resource Limits

## Purpose

Schema validity is not a resource budget. A cartridge, portable run, holder estate, or future receipt can be syntactically valid while attempting to consume unreasonable memory, parser time, storage, rendering work, or diagnostic output.

The v1 import boundary therefore applies explicit JSON limits before domain validation.

## Default bounded JSON limits

| Dimension | Limit |
|---|---:|
| UTF-8 input bytes | 16 MiB |
| Nesting depth | 96 |
| Total JSON value nodes | 250,000 |
| Items in one array | 50,000 |
| Members in one object | 50,000 |
| UTF-8 bytes in one string or key | 4 MiB |
| Characters in one number token | 128 |

Engine save strings embedded in portable runs use a 12 MiB byte ceiling. A higher-level format may declare a lower limit. It may not bypass duplicate-key refusal or the shared complexity law.

## Refused representations

The text parser refuses:

- duplicate object keys;
- leading-zero numbers;
- non-finite number results;
- malformed escapes;
- unescaped control characters;
- unpaired Unicode surrogates;
- trailing non-whitespace content;
- any resource limit violation.

Object API inputs are checked against the same complexity model and additionally refuse:

- cycles;
- sparse arrays;
- undefined, function, symbol, or bigint values;
- exotic object prototypes;
- non-finite numbers.

## Ordering of authority

The import sequence is:

```text
byte limit
→ bounded duplicate-aware JSON parse
→ root-format identification
→ integrity verification where the format provides it
→ domain schema validation
→ identity verification
→ compatibility and migration checks
→ transaction preflight
→ durable write
```

No domain schema, digest, migration, renderer, or storage transaction receives unbounded text.

## Why duplicate keys fail

Ordinary `JSON.parse()` keeps only the final value for a duplicate key. That destroys evidence about what the file actually declared and can create disagreement with parsers that keep the first value or refuse duplicates.

A file such as:

```json
{"authoredArcDigest":"cart1_good","authoredArcDigest":"cart1_other"}
```

is therefore rejected before any digest or schema operation.

## Format-specific limits

The shared JSON limits constrain syntax and structure. Each format may add semantic limits, including:

- maximum actors, challenges, checks, and progression entries;
- maximum extension namespaces and extension bytes;
- maximum held cartridge revisions;
- maximum holder-estate records;
- maximum rendered labels or diagram nodes;
- maximum migration and validation time.

Those semantic limits must be published beside the format and tested with boundary fixtures. They may be raised in a compatible release when operational evidence supports it. Lowering a limit below an already accepted artifact requires a compatibility decision.

## Diagnostics

Every bounded parser error identifies the line and column at which the boundary was crossed. Error text may name counts and limits but must not echo an entire hostile value into logs or UI.

## Browser and Node equivalence

The parser is dependency-free and uses the same TypeScript implementation in Arc, World, Node tests, and browser builds. Conformance tests cover valid JSON, duplicate keys, prototype-bearing keys, malformed strings, every limit dimension, and already-parsed object inputs.

## Failure mode

A format that applies its schema only after ordinary unbounded parsing can still be forced to allocate or traverse more data than the product promises to handle. A format that accepts duplicate keys can produce client disagreement before authored law is even identified.

The control question is: can the importer refuse a hostile artifact before losing information, allocating unbounded state, computing identity, or changing holder storage?
