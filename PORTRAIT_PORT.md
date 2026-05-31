# Portrait Port Plan

This branch starts the portrait port by creating the production seam first. The spike contributes decisions, not dependencies: keep the roster/portrait interaction decisions, discard fake engine wiring, discard shadow DOM, and keep persistence outside the engine save until the UI contract is stable.

## Current inventory

### Render sites now using `<Portrait>`

- `src/game/components/RosterScreen.tsx` — main personnel cards, including stress/affliction/resolve glyphs.
- `src/game/App.tsx` — desktop Situation Room roster rail thumbnails.
- `src/game/components/AssignScreen.tsx` — queued assignment thumbnails and selectable roster rows.
- `src/game/components/DramaScreen.tsx` — drama option agent thumbnail.

### Portrait styling

- Base portrait sizing and initials treatment live in `src/game/styles.css` under the `PORTRAIT` section.
- State styling lives in the later `PORTRAIT STATE + BARKS` section so it can override the base rules without changing component markup.
- Portrait colors now go through semantic CSS tokens:
  - `--portrait-bg`
  - `--portrait-border`
  - `--portrait-ink`
  - `--portrait-warn-ring`
  - `--portrait-danger-bg`
  - `--portrait-danger-border`
  - `--portrait-danger-ink`
  - `--portrait-afflicted-bg`
  - `--portrait-afflicted-border`
  - `--portrait-afflicted-ink`
  - `--portrait-afflicted-ring`

### Related bar styling

- Bar fills now go through semantic CSS tokens:
  - `--bar-track`
  - `--bar-morale`
  - `--bar-stress`
  - `--bar-mechanic`
  - `--bar-mechanic-fail`

### Save keys currently in use

- `axm-arc:save:v1` — serialized engine/game state, managed by `src/game/lib/storage.ts`.
- `axm-arc:intent:v1` — player-authored cycle intent, kept parallel to the engine save in `src/game/App.tsx`.

## Next implementation steps

1. Add a parallel portrait storage module, not an `Organization` schema change.
   - Proposed key: `axm-arc:portraits:v1`.
   - Proposed lookup: `arcId + agentId`.
   - Initial backend: localStorage with compressed data URLs and strict size caps.
2. Add portrait image support to `<Portrait>`.
   - Keep initials as the fallback.
   - Keep stress/affliction glyphs independent from whether an image exists.
3. Add the editor inside roster detail first.
   - Upload/change/remove.
   - Unsupported MIME error.
   - Oversize image error.
   - Quota failure error.
4. Verify the documented breakpoints on every visible portrait PR.
   - Mobile density: `max-width: 380px`, `480px`, and `600px`.
   - Desktop Situation Room: `min-width: 960px`.
5. Defer IndexedDB until portraits outgrow localStorage.
   - Use it for a creator tool, image history, or multi-image assets.
   - Do not introduce it for the initial six-agent roster loop.
