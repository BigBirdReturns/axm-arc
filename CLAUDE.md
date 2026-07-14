# axm-arc — notes for Claude sessions

## Product ontology and execution priority

- **Arc** — an authored organizational model and playable grammar: vocabulary,
  actors, constraints, challenges, progression, and consequences.
- **Cartridge** — a validated, content-addressed Arc artifact under custody,
  portable between compatible runtimes.
- **Run record** — deterministic evidence of inputs, decisions, and outcomes.
  Replayability proves what the model did; it is not automatically empirical
  truth, certification, or proof that the model describes a real institution.
- **Ledger** — append-only institutional memory that carries people, precedent,
  fairness, and consequence across compatible engagements.
- **Clients** — axm-arc authors, holds, and plays artifacts; axm-world/Rodoh
  spatially interprets them. Presentation never redefines authored law.

The current shipping mandate is to finish and harden the game and its reference
cartridges. This is not a retreat to “just games”: the game is the executable
proof, conformance corpus, UX laboratory, and pressure test for every layer
above. Prefer game work that strengthens arc-agnostic seams; never build
speculative enterprise chrome instead of closing the reference game loop.
When product experience and platform proof compete for sequence, close the
player loop first. The exception is an irreversible schema, custody,
determinism, save, or ledger defect that would become expensive or dishonest if
allowed to harden.

Start with `README.md`, `ROADMAP.md`, and `STATUS.md`, then the documents that
govern the artifact and record boundaries: `docs/RFC_WORKSHOP.md`,
`docs/RFC_CARTRIDGE_LIBRARY.md`, `docs/RFC_TIER2_LEDGER_SCHEMA.md`,
`docs/COMPATIBILITY_ATLAS.md`, and `docs/CLONE_PORTING.md`. Also read
**axm-genesis `docs/CONTINUITY.md`** (the family's laws, operating doctrine, and
roadmap) before changing family contracts.

## Ground rules

- **`src/engine/schema.ts` is law.** Cartridges emit only fields it
  defines. A game loop the engine can't express is an RFC, never an
  engine hack — see the atlas's tier ladder and rule #1: a clone may
  never change the engine.
- **The vendored surface** (`src/engine`, `src/arcs`, `tests/engine`,
  `tests/fixtures`) is shared with axm-world, which pins it in its
  `src/engine/VENDORED_FROM` and syncs via its `scripts/sync-engine.sh`.
  Changes here ripple; changes THERE are forbidden (world's
  `engine-drift` CI enforces). Engine changes land in this repo first,
  always.
- **Cartridges are data** (`cartridges/*.arc.json`), imported through
  `validateArcJson`/`importArcFromJson` — never add a second validator.
  Every cartridge ships a conformance test (`tests/cartridges/`) against
  `src/sim/cartridge-conformance.ts`. Original vocabulary only; no
  franchise names/text/assets, no ROMs, ever.
- **The grammar rule:** chrome is translated via `src/i18n/` (typed
  catalog, en + zh-Hant, coverage-guard test); arc/cartridge data flows
  verbatim and is never catalogued.
- **Determinism:** seeded PRNG, codepoint compare (never
  `localeCompare`), no locale-sensitive behavior in engine paths.

## Testing (the gotcha that will waste your day)

`tsc -b` emits `.js` files beside sources that silently shadow `.ts`
under vitest — "green" runs can be testing stale code. Purge before
EVERY vitest or tsc run:

```bash
find src tests \( -name "*.js" -o -name "*.js.map" -o -name "*.d.ts" \) -delete
rm -f tsconfig.tsbuildinfo
```

Then: `npx tsc --noEmit` and `npx vitest run`. The build
(`npx vite build`) emits to `docs/game` (gitignored here).

## Verification bar

Tests passing is not shipping. UI changes and new cartridges get headless
drills through the real player paths — see `docs/drills/README.md` for
the scripts and the solved browser-automation gotchas. New cartridges
must load in BOTH clients (arc Library paste-import and axm-world's boot
file-import) with matching digests.
