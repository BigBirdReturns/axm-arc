# cartridges/

Importable arc cartridges — JSON files that pass `src/engine/schema.ts`'s
`ArcSchema` and can be loaded through the game's import seam
(`importArcFromJson` in `src/game/lib/arc-library.ts`). This is the
counterpart to the arcs bundled directly into the build under `src/arcs/`
(e.g. `first-charter.ts`, `karazhan.ts`): same schema, same engine, just
delivered as a standalone file instead of compiled into the app.

## Loading a cartridge

In the running game: **Library → Import Arc**, then paste or upload the
`.arc.json` file. Import validates against the schema and never throws —
failures come back as a list of per-field errors. A successful import is
added to the arc library as `trust: "imported-unsigned"`; bundled arcs are
never overwritten by an import with the same id.

## Conformance

Every cartridge in this directory must pass the same validation the game
runs at import time (`validateArc` / `ArcSchema.safeParse`), i.e. it must be
a real, importable arc — not just well-formed JSON. Before adding or editing
a cartridge here, validate it (e.g. by running `importArcFromJson` against
the file text via `vite-node`, with a `localStorage` shim if running outside
a browser) and confirm it returns `ok: true` with zero errors.

## Godscar reference pocket

`kind-gods-of-ilyon.pocket.json` is the creator-owned six-pressure source. `kind-gods-of-ilyon.arc.json` is the exact compiled cartridge accepted by Arc and Rodoh. Rebuild both with `npm run build:godscar-reference`.

## Dark Tomb source plane

Book II is encoded under `src/dark-tomb/` as `dark-tomb-pocket/1`. It reuses Book I's canon tiers, evidence ledger, provenance, and faction receipts, then adds the eight-pressure Tomb Engine, seven-layer anatomy, five-dimensional depth vector, signature budget, Long Alarm, expedition ledger, Book II cast responsibilities, and ten Story Physics invariants. The private-branch `DARK_TOMB_STARTER` is a compiler fixture and authoring seed, not a canonical cartridge. See `docs/DARK_TOMB_POCKET_FORMAT.md`.

## Common Ship source plane

Book III is encoded under `src/common-ship/` as `common-ship-pocket/1`. It preserves the prior canon and evidence law, then adds the nine-pressure Watch Engine, seven-system vessel anatomy, six-dimensional temporal profile, seven-layer translation stack, six Common Watch viability tests, eight ship-state tracks, full operational and handoff ledgers, Book III cast responsibilities, and ten Mission Physics invariants. The private-branch `COMMON_SHIP_STARTER` is a compiler fixture and authoring seed, not a canonical cartridge or a bundled World release. See `docs/COMMON_SHIP_POCKET_FORMAT.md`.
