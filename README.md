# axm-arc
Organizational simulation engine. Portable scenario format for any group of agents facing structured challenges under constraint. The first arc is a guild management game. The first raid is Karazhan.

See `DESIGN.md` for the full v1.0 design.

## Running

```
npm ci
npm run dev       # local dev server (Vite)
npm test          # run the engine test suite
npm run build     # production bundle into dist/
npm run typecheck # tsc --noEmit
npm run check     # typecheck + tests
```

The tutorial arc ("The First Charter") loads by default. Save state persists to `localStorage` under `axm-arc:save:v1`. The UI is mobile-first, portrait-optimized.

## Layout

- `src/engine/` — generic organizational simulation engine (deterministic, content-free)
- `src/arcs/` — loadable scenario definitions; tutorial arc included
- `src/game/` — React PWA presentation layer
- `tests/engine/` — engine + integration test suite
