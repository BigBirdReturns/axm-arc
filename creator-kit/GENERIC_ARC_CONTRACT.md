# Generic Arc creator contract

A generic Arc is a versioned JSON object validated by the shared AXM Arc schema and executed by the deterministic engine. It is the lowest common creator format. The three registered Godscar source planes compile into this same object.

The executable contract is the validator bundled in `bin/rodoh-cartridge.mjs`. The TypeScript schema and public types are included under `contracts/reference-source/` for inspection. A copied type declaration is not authority when it disagrees with the bundled validator and the exact engine version named by the kit manifest.

## Root object

A valid Arc carries:

- engine-version compatibility;
- stable metadata and authored identity;
- at least three attributes;
- one or more capability tiers;
- optional roles with attribute weights;
- items and bounded bonuses where the campaign uses them;
- progression tiers;
- challenges with roster, mechanic, access, state, reward, and consequence law;
- optional declarative founding, state, composition, event, narrative, and extension records.

Every identifier is an opaque compatibility key. Player-facing names and descriptions are authored content. Do not encode mechanics in localized display strings.

## Deterministic execution

The engine derives random streams from stable identifiers, the organization seed, the cycle, and the challenge. The same validated Arc, founding input, decisions, and engine version produce the same canonical result facts.

Array order is authored law. Object key insertion order is not. Non-finite numbers, executable code, functions, cyclic values, exotic objects, duplicate JSON keys, and values outside the published bounded-JSON limits are refused.

## Attributes and roles

Attributes are the capacities mechanics actually inspect. Mechanic weights for one check must sum to 1 within the schema tolerance. Every referenced attribute must exist.

Roles are authored organizational meanings expressed through attribute weights and identifiers. A runtime may display a neutral icon or a cartridge-owned presentation record. It may not infer engine law from role names.

## Challenges

Every challenge declares:

- stable ID, title, description, and progression tier;
- minimum and maximum party size;
- role or composition requirements when needed;
- one or more checks with thresholds and weighted attributes;
- access requirements;
- bounded resource spending when offered;
- rewards and persistent consequences;
- state effects or milestones required by later work.

A challenge is not complete merely because it validates. The complete campaign must be reachable from the exact founding law through engine-honored actions.

## State and composition

Engine 1.3 supports creator-declared number, enum, and boolean state with bounded effects and exact before-and-after receipts. It also supports declarative composition profiles and role, tag, metric, range, fraction, redundancy, `all`, and `any` constraints.

The same Arc-owned authority governs authoring preview, direct resolution, full-cycle admission, and compatible runtime projection. A receiver may display the result. It may not create a second evaluator.

## Extensions

Extensions are recursive JSON stored under namespaced, versioned keys such as:

```text
example.author-memory@1
```

Unknown extensions survive import, play, export, and resume unless a versioned contract explicitly declares otherwise. An extension may carry authored source, provenance, evidence, or future memory. It may not carry executable code.

## Identity and custody

`cart1_…` is the SHA-256 identity of canonical authored law under the frozen `cart1` contract. Top-level custody fields are excluded from that identity; nested authored content is not.

A portable changed run uses `axm-cartridge-run/v3`. The run binds its embedded Arc, authored digest, engine save, mutable organization, integrity record, and holder-owned extensions. A run cannot be silently reattached to a different cartridge digest.

## Minimum creator proof

Before distribution, preserve:

1. a passing validation receipt;
2. a passing bounded multi-seed simulation receipt;
3. the exact `cart1_` digest;
4. a malformed refusal fixture;
5. one representative changed run;
6. a file manifest with SHA-256 and byte counts;
7. a neutral Rodoh import, complete play, export, clear-context import, and resume receipt.
