# Runtime family contract v1

`extensions["axm.runtime-family@1"]` is authored Arc law:

```json
{ "format": "axm-runtime-family/1", "family": "encounter-simulation" }
```

The closed v1 family vocabulary is `fixed-canonical-sequence`,
`encounter-simulation`, and `strategy-board`. Both the namespace and payload are
versioned, following source-plane extension conventions. `validateArc` and
`ArcSchema` validate the known payload strictly. Unknown namespaced extensions
remain unchanged. No cartridge identity, source-plane identity, UI, camera,
layout, or presentation semantics participate in selection.

Authority: selection affects which execution law applies, so it is covered by
the cartridge digest, never selected from portable-run memory. The existing
source-plane registry describes source compilation/recovery, not execution
capability. Canonical-story already owns a fixed graph; strategy-board has its
own definition and turn vocabulary; neither is an encounter reskin. This small
contract selects a family, not a second source schema or a universal game loop.

Receivers call `selectRuntimeFamily` on a validated Arc before founding or
restoring execution. They explicitly supply supported families. Recognition is
not execution support: an executor must also validate its own required law and
state. Unsupported family/version means refuse execution, retain custody, never
fall back to the encounter shell. Future versions of this reserved namespace
are preserved but produce `unsupported`, including when accompanied by v1.

Terminal conditions remain family-owned. Fixed canonical sequence follows the
canonical-story links and `extent-complete` boundary (which may name a future
continuation, not a whole-story victory). Encounter/simulation resolution,
progression, and campaign completion remain governed by existing authored
challenge/progression law; there is no new universal victory predicate.
Strategy-board selection reserves a distinct dispatch identity; its executor
must supply validated turn and terminal law before claiming playable support.
The selector itself advances no state and declares no win, loss, or completion.

Compatibility: absent declaration returns `legacy`, not an inferred family.
Existing canonical-story capability dispatch and existing simulation adapters
remain the responsibility of legacy receivers. This change does not retrofit
those clients or claim that older receivers will enforce the new declaration.
Admit explicitly declared cartridges only to receivers that honor the contract.
Portable run v3 still carries engine-save state; this does not invent a portable
canonical cursor or strategy save adapter. All unknown run memory stays intact.

Migration is an explicit authored revision: add the declaration, retain logical
ids/source data, publish a new version and digest, and keep old held artifacts
and exact-digest saves intact. Do not inject defaults on import, rewrite bundled
artifacts, or silently rebind old saves. Existing compilers are unchanged here
so their established bytes and identities remain stable. Compiler adoption and
receiver dispatch are subsequent coordinated changes.

Tests exercise a declared Burn canonical fixture and an unrelated Dispatch
Training simulation fixture, family capability acceptance/refusal, malformed payloads,
future-version refusal, digest sensitivity, nonmutation, canonical termination,
and exact portable-run preservation. No axm-world changes are included.

Verification (2026-09-13): `tsc --noEmit` passed. Standard Vitest startup was
blocked by esbuild subprocess `EPERM`. A temporary Vitest API runner using
TypeScript transpilation, worker threads, and preserved symlinks ran the same
test discovery: focused 50/50 passed; full 924/931 passed (117/119 files).
Seven subprocess-dependent release/CLI tests failed at child-process startup.
This is not a claim of a fully green standard test run.
