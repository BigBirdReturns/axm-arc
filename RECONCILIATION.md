# Reconciliation contract: axm-arc ⇄ axm-world

axm-arc is the **hub**: it owns the deterministic engine, the arc format, and
the tutorial arc. axm-world is a **spoke**: a renderer/player that vendors the
hub's shared surface so its build stays self-contained. This document is the
contract that keeps the two from drifting. The canonical copy lives here, in
axm-arc; axm-world's `RECONCILIATION.md` is a short operational pointer back
to this file.

## The shared surface

These paths must be **byte-identical** in both repos at all times:

| Path | What |
|---|---|
| `src/engine/` | The deterministic rules engine (excluding world's `VENDORED_FROM` provenance file) |
| `src/arcs/` | The bundled tutorial arc content |
| `tests/engine/` | Engine subsystem + resolver tests |
| `tests/fixtures/` | Shared test fixtures (`mini-arc`, `cycle-arc`) |

Everything else is repo-local and *supposed* to diverge: axm-arc's `src/game/`
(the hub player UI) and axm-world's `src/world/` + `src/spoke/` (the spoke
renderer and bootstrap) are independent presentations over the same engine.
The engine's public API — pure functions plus the Zod arc schema — is the only
contract between them.

## The rule

**Changes to the shared surface land in axm-arc first.** Then axm-world
re-vendors:

```bash
# in axm-world
npm run engine:sync   # re-vendor from axm-arc, update the VENDORED_FROM pin
npm run check         # typecheck + tests
git commit
```

If a shared-surface change is *prototyped* in axm-world (sometimes the spoke is
where the need shows up — that's fine), it must be upstreamed to axm-arc in the
same sitting, **with tests**, and world's pin moved to the resulting axm-arc
commit. A world PR that touches the shared surface without a matching arc
commit is drift by definition; world's `engine-drift` CI job fails on it.

Never edit vendored files directly in axm-world and leave them. The
`VENDORED_FROM` pin plus `scripts/check-engine-drift.sh` exist to make that
state loud.

## Adding to the shared surface

New engine features follow the repo invariant: the engine has zero imports
from `src/arcs/`, and arcs assume nothing about engine internals beyond the
published schema. A feature that needs content changes (like `thresholdMode`
annotations in the tutorial arc) ships the engine change and the content
change in the same axm-arc commit, so any vendored snapshot is
self-consistent.

## History

**2026-07 — the thresholdMode reconciliation.** axm-world prototyped
`MechanicCheck.thresholdMode` (`"fixed" | "perAssignedAgent"`) in its vendored
engine copy and re-tuned `first-charter.ts` (explicit threshold modes on all
six `team_aggregate` checks, explicit `roleIds` on `role_specific` checks)
without upstreaming. This reconciliation upstreamed both, added the missing
test coverage, and hardened the feature:

- `validateArc()` now rejects `thresholdMode` on non-`team_aggregate` checks
  (fails loudly, per the schema philosophy).
- The resolver ignores `thresholdMode` on non-team scopes as defense in depth
  for hand-built challenges.

**Compatibility note:** this changed the default semantics of
`team_aggregate`. Previously the threshold implicitly scaled with party size
(`difficultyThreshold × assignedAgents`); now an unannotated check uses the
threshold as a fixed absolute total, and scaling is opt-in via
`thresholdMode: "perAssignedAgent"`. Any third-party arc that relied on the
implicit scaling must annotate its team checks. The bundled tutorial arc is
fully annotated.
