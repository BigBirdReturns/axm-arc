# Reconciliation contract: axm-arc ⇄ axm-world

axm-arc is the **source and execution authority**: it owns the deterministic
engine, the Arc format, creator source planes, reference cartridges, and their
conformance tests. axm-world is a **spoke**: a renderer/player that vendors the
shared surface so its build stays self-contained. This document is the contract
that keeps the two from drifting. The canonical copy lives here, in axm-arc;
axm-world's `RECONCILIATION.md` is an operational pointer back to this file.

## The shared surface

These paths must be **byte-identical** in both repos at the commit recorded by
World's `src/engine/VENDORED_FROM`:

| Path | What |
|---|---|
| `src/engine/` | Deterministic execution, state, composition, custody, and save law, excluding World's receiver-owned `VENDORED_FROM` file |
| `src/arcs/` | Bundled reference Arc content |
| `src/godscar/` | Book I Pocket source grammar, compiler, and reference source |
| `src/dark-tomb/` | Book II Dark Tomb source grammar, compiler, and starter |
| `src/common-ship/` | Book III Common Ship source grammar, compiler, embodiment profiles, and starter |
| `src/source-planes/` | Canonical registry joining source formats, extension keys, validators, compilers, starters, and recovery functions |
| `tests/engine/` | Engine subsystem, resolver, state, composition, and migration tests |
| `tests/fixtures/` | Shared deterministic fixtures |
| `tests/godscar/` | Book I source-plane and reference-artifact contracts |
| `tests/dark-tomb/` | Book II source-plane contracts |
| `tests/common-ship/` | Book III source-plane contracts |
| `tests/source-planes/` | Cross-plane registry, discovery, and exact round-trip contracts |
| `cartridges/` | Published creator sources and compiled portable reference artifacts |

Everything else is repo-local and is supposed to diverge. axm-arc's `src/game/`
owns authoring and its local reference player. axm-world's `src/world/` and
`src/spoke/` own Rodoh presentation, custody UI, and spatial representations.
Neither presentation may reproduce engine or source-plane decision law.

## The rule

**Changes to the shared surface land in axm-arc first.** Then axm-world
re-vendors one exact reviewed Arc commit:

```bash
# in axm-world
npm run engine:sync -- <axm-arc ref>
npm run check
git commit
```

If a shared-surface change is prototyped in axm-world, it must be upstreamed to
axm-arc in the same sitting with tests, and World's pin must move to the
resulting Arc commit. A World PR that directly edits a shared path without a
matching Arc commit is drift by definition; `engine-drift` CI fails it.

Never edit vendored files directly in axm-world and leave them. The
`VENDORED_FROM` pin plus `scripts/check-engine-drift.sh` make that state loud.

## Source-plane registry law

`src/source-planes/registry.ts` is the one catalog of creator source formats
accepted by the current Codex line. A registered source plane names:

- a stable registry id;
- its exact source `format` and Arc extension key;
- display and file metadata;
- a starter source;
- one validator;
- one compiler into an ordinary Arc;
- one exact recovery function from the compiled Arc.

A source-plane addition is incomplete until its own schema/compiler tests, the
cross-plane registry tests, and this reconciliation surface are updated. World
may inspect the registry and render known source facts. It may not add a second
compiler, validator, or resolver.

Unknown namespaced Arc or run extensions remain holder-owned data. Failing to
recognize an extension is not authority to discard it.

## Adding to the shared surface

New engine features preserve the repository invariant: the engine has zero
imports from `src/arcs/` or any creator source plane, and source planes assume
nothing about engine internals beyond the published Arc schema. A feature that
needs engine and content changes ships both in the same Arc commit so any
vendored snapshot remains self-consistent.

## History

**2026-07 — source-plane registry and Book II/III reconciliation.** The shared
surface expanded from the base engine, tutorial arcs, and Book I Godscar source
to the complete Books I through III creator source plane. The registry makes
format discovery explicit and lets Arc authoring and World projection share one
catalog without sharing presentation code.

**2026-07 — the thresholdMode reconciliation.** axm-world prototyped
`MechanicCheck.thresholdMode` (`"fixed" | "perAssignedAgent"`) in its vendored
engine copy and re-tuned `first-charter.ts` without upstreaming. Reconciliation
upstreamed both, added missing tests, and hardened validation. Unannotated
`team_aggregate` checks now use a fixed absolute threshold; party-size scaling
is opt-in through `thresholdMode: "perAssignedAgent"`.
