# Deploy

AXM Arc ships its built game to GitHub Pages on every merge to `main`.

## How the pipeline works

`.github/workflows/deploy.yml` runs on `push` to `main`:

1. **Checkout** with full history (`fetch-depth: 0`) so the Vite build can stamp
   the short commit SHA into `__BUILD_SHA__`.
2. **Setup Node 20** with npm caching.
3. **`npm ci`** — clean install.
4. **`npm run check`** — typecheck + tests. This is a hard gate: a broken build
   is never deployed.
5. **`npm run build`** — Vite writes the game into `docs/game/`.
6. **Commit back** — if `docs/game/` changed, the workflow commits it to `main`
   as `github-actions[bot]` and pushes. The commit is a no-op when there's no
   diff.

Pages is configured to serve from `main:/docs`, so committing the built assets
back is what publishes them.

## Loop guard

The commit-back step only ever touches `docs/game/**`. The workflow's
`paths-ignore: ['docs/game/**']` filter means that bot commit does **not**
retrigger the workflow — no infinite rebuild loop. The `[skip ci]` tag on the
commit message is a second, belt-and-braces guard.

## Changelog discipline

A build ships with a `CHANGELOG.md` entry. `CHANGELOG.md` (repo root) is the
human-facing source of truth; `src/release-notes/notes.ts` is the compiled-in
copy the in-game "What's new" overlay reads. Keep the two consistent — this is
the one acceptable duplication, and `notes.ts` documents it. When you cut a
release, move items out of `[Unreleased]` and add a matching `RELEASE_NOTES`
entry so returning players see the changes (the overlay auto-opens when the
build SHA changes).

## Migration option: Actions-based Pages

The current approach commits built assets back to `main` so it works with the
existing Pages config and **zero settings changes**. A cleaner long-term option
is GitHub's Actions-based Pages deploy:

- Add `actions/upload-pages-artifact` + `actions/deploy-pages` steps.
- Drop the commit-back step (and with it the loop guard, since nothing is
  pushed back to `main`).
- Switch the repo's Pages source to **"GitHub Actions"** in repository settings.

This keeps `docs/game/` out of git history entirely. It's left as a follow-up
because it requires a repo-settings change.
