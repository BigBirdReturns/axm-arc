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
