# Deploy

AXM Arc publishes its built game to GitHub Pages on every merge to `main`,
using GitHub's **Actions-based Pages deployment**. The built bundle
(`docs/game/`) is generated at deploy time and uploaded as a Pages artifact —
it is **never committed to the repo**.

## One-time setup (required)

Repository **Settings → Pages → Build and deployment → Source = "GitHub
Actions"**. Until this is set, the workflow runs green but the site is not
served from it.

## How the pipeline works

`.github/workflows/deploy.yml` runs on `push` to `main` (and `workflow_dispatch`):

1. **Checkout** with full history (`fetch-depth: 0`) so the Vite build can stamp
   the short commit SHA into `__BUILD_SHA__`.
2. **Setup Node 20** with npm caching.
3. **`npm ci`** — clean install.
4. **`npm run check`** — typecheck + tests. Hard gate: a broken build never ships.
5. **`npm run build`** — Vite writes the game into `docs/game/`.
6. **Upload artifact** — the whole `docs/` tree (hand-authored landing page +
   designer prototype + the freshly built game) is uploaded via
   `actions/upload-pages-artifact`.
7. **Deploy** — `actions/deploy-pages` publishes the artifact.

## Why `docs/game/` is gitignored

The bundle is generated, not source. Committing it (the old commit-back model)
caused a recurring merge-conflict class: a feature branch's bundle and the
deploy bot's rebuilt bundle had different Vite content-hashes and collided in
`docs/game/` on every PR. Publishing directly to Pages removes the bundle from
git history entirely, so that conflict is **impossible** rather than merely
avoided.

Consequence: do **not** run `npm run build` and commit the output on a feature
branch. The bundle is `.gitignore`d; the workflow is the sole producer. To
preview locally, `npm run dev` or `npm run build` then open `docs/game/` — just
don't commit it.

## Changelog discipline

A build ships with a `CHANGELOG.md` entry. `CHANGELOG.md` (repo root) is the
human-facing source of truth; `src/release-notes/notes.ts` is the compiled-in
copy the in-game "What's new" overlay reads. Keep the two consistent — this is
the one acceptable duplication, and `notes.ts` documents it. When you cut a
release, move items out of `[Unreleased]` and add a matching `RELEASE_NOTES`
entry so returning players see the changes (the overlay auto-opens when the
build SHA changes).

## Deploy variant flag

axm-arc can be shipped under one of three positioning variants without forking
code. The variant is a build-time flag that flips entry-point copy on the
title screen (kicker line, primary CTA labels) — the engine, arc format, and
all gameplay are identical. It's positioning, not capability.

Valid values for `VITE_VARIANT` (or `VARIANT`):

- `game-first` (default) — "Begin your tenure" / "New Game" / "Arc Library"
- `enterprise-first` — "Model your organization" / "Load Model" / "Model Library"
- `research-first` — "Run a scenario" / "Start Scenario" / "Scenario Library"

Build a variant:

```bash
VITE_VARIANT=enterprise-first npm run build
VITE_VARIANT=research-first   npm run build
npm run build                              # → game-first
```

The variant is validated at Vite config load; an unknown value fails the
build with a clear error. Underlying behavior is identical across variants —
if a feature should differ between audiences, that belongs in arc data, not
in the variant flag.

To deploy a non-default variant from CI, set `VITE_VARIANT` as an environment
variable on the **Build** step in `.github/workflows/deploy.yml`.
