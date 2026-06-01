# Designer port — multi-agent roster workshop

**Source:** `docs/designer-prototype/` (the working spike) and its `HANDOFF.md`.
**Live prototype:** `bigbirdreturns.github.io/axm-arc/designer-prototype/`
**Status:** plan only, no code yet.

> **Thesis (see `ROADMAP.md`):** one engine, two audiences, no fork. The
> engine is content-free, so polishing the loop *is* enterprise work — every
> UX win accrues to whoever loads an arc. Authoring (this doc) is Thread 3: it
> makes people *want* to build arcs, and the codex doubles as its QA surface.
> Don't re-derive a "game vs. platform" split — there isn't one.

## What this is

A new **authoring mode** for building a roster against an arc. Lives next to
the game, not inside it. The prototype is a working demo of the loop —
rail of authored agents, center editor (identity, attributes, traits,
equipment), right-side live engine record JSON. The port turns that demo into
a real screen in this repo without dragging the prototype's seams in with it.

## What this is **not**

- Not an upgrade to an existing designer — there is none. The README in the
  prototype zip mentions a `src/game/components/DesignerScreen.tsx`; that file
  does not exist. Treat that line as wishful and ignore it.
- Not a replacement for `RosterScreen.tsx`. RosterScreen is the in-game
  roster view (read-only during play). The workshop is an authoring tool.
  Different mode, different state, different persistence.
- Not a dependency on PR #11. PR #11's `<Portrait>` extraction was an
  inference from chat, not from this handoff. If it lands, fold it in.
  If it doesn't, introduce `<Portrait>` here where it has real consumers.

## Hard rules

1. **Prototype contributes decisions, not dependencies.** Keep the theme,
   the interaction flow, the visual rhythm, the breakpoints. Discard
   `bench-engine.js` (fake), `<image-slot>` (shadow-DOM web component),
   and component-owned persistence. Reimplement through the app's existing
   seams.
2. **Real engine only.** Import from `src/engine/` directly:
   `engine/character` for generation, `prng` for determinism, `constants`
   for trait pools, schema-validated arc data. No reimplementations.
3. **Arc-agnostic.** No arc id, attribute, role, or trait hardcoded in the
   screen. Read everything from the `arc` prop, same pattern the existing
   game screens use.
4. **Token-driven.** Every color via CSS custom property. The prototype is
   already disciplined here — preserve it. No component owns its own
   accent.

## Integration shape

### Mode, not tab

The game tabs (Roster/Assign/Drama/Base/Reports) are for playing a
configured arc. The designer is a separate mode. Follow the precedent
PR #6 set in `App.tsx`: there's already a `library` and `settings` mode
sitting next to the game mode, reached from `TitleScreen`. Add `designer`
as a third sibling.

```
type AppMode = "title" | "game" | "library" | "settings" | "designer";
```

Entry: a "Designer" action on `TitleScreen`. Exit: a back-to-title control
in the designer's top bar.

### File layout

```
src/game/components/
  DesignerScreen.tsx          // the screen (port of bench-app.jsx)
  designer/
    Rail.tsx                  // left-rail roster list + actions
    Editor.tsx                // center editor (identity / stats / traits / equipment)
    EngineRecord.tsx          // right-pane live JSON
    Portrait.tsx              // production portrait component (see below)
src/game/lib/
  designer-storage.ts         // load/save roster draft, separate from org save
src/game/styles/
  designer.css                // existing prototype styles, folded in
  workshop.css                // ditto, appended
```

The two CSS files come straight from the prototype. Fold the bar tokens
the prototype's HANDOFF.md calls out (`--bar-bg`/`--bar-fg`) into
`designer.css` so the top bar stays valid in dark mode without a separate
override.

### State

```
type RosterDraft = {
  version: 1;
  arcId: string;
  agents: Agent[];           // real engine Agent type
  selectedId: string | null;
  section: "roster" | "items" | "challenges" | "arc";
};
```

Persistence key: `axm-arc:roster-draft:v1`. **Parallel to** the org save,
not nested inside it. Same pattern as `axm-arc:intent:v1`. If parsing
fails, start empty — never block boot on a corrupt draft.

### Theme

One `theme` state, init from `localStorage["axm-arc-designer:theme:v1"]`
then `prefers-color-scheme`, `useEffect` sets `data-theme` on
`documentElement`. Exactly what the prototype's HANDOFF.md spells out.
Don't reintroduce a multi-skin switcher; the game's global tokens are the
default skin.

### Portrait

Build a real React `<Portrait>` component. **No shadow DOM**, no web
component, no internal hardcoded accent. Reads CSS custom properties for
everything. States: `normal | warn | danger | afflicted | resolve`,
optional glyph overlay, sizes `small | medium | large`. Used in:
- the rail (small thumbnail)
- the editor identity slot (large)
- and, when the prototype's `<Portrait>` lands in the game UI too,
  shared with `RosterScreen` and friends so there's one source of truth.

Image persistence is **out of scope** for the first port. Render initials.
Add a separate `axm-arc:portraits:v1` store and a file picker in a
follow-up ticket once the screen is real.

### Breakpoints

Preserve the prototype's three-tier responsive layout:
- ≥1100px: 3-col (rail / editor / record).
- 760–1100px: 2-col (rail + editor, record full width below).
- ≤760px: single column; rail becomes a wrapping card grid
  (`repeat(auto-fill, minmax(180px, 1fr))`), `position: sticky` dropped,
  section nav scrolls horizontally.

The prototype's HANDOFF.md flags two cascade gotchas worth restating:
the mobile `@media` rules must live **after** the base `.rail` rules
(media queries add no specificity), and the rail + list need `min-width:0`
or they blow out page width on phones.

## Open decisions, defaults if nobody answers

1. **Portrait as rail thumbnail too?** Default: yes. Recognition pays.
2. **Portrait storage backend?** Default: `localStorage` with aggressive
   client-side resize (≤256px, ≤50KB). Migrate to IndexedDB only when
   image count or size warrants it.
3. **Export format?** Default: the engine's `Agent[]` JSON, identical to
   what `serializeGame` already emits for the roster slice. Same shape
   the game already understands — no new format.
4. **Designer-built roster → playable game?** Default: yes, via an
   "Open in game" action that hands the draft to the existing
   org-creation path and writes a new `axm-arc:save:v1`. Out of scope for
   the first port; design the storage shape so this is trivial later.

## Sequencing

1. Stand up `DesignerScreen` as a new mode reachable from `TitleScreen`.
   Render a static layout from the prototype's CSS. No state yet.
2. Wire roster state + localStorage draft. Add/duplicate/delete/select.
   Engine record pane shows live JSON.
3. Port the editor sections (identity, attributes, traits, equipment)
   one at a time, each one using the real engine helpers.
4. Build `<Portrait>` with initials fallback, drop into rail + identity.
5. Theme toggle + persisted theme state.
6. Mobile breakpoint pass. Verify each cascade gotcha.
7. (Follow-up ticket) Portrait image upload + storage.
8. (Follow-up ticket) "Open in game" to launch the drafted roster.

Each step is a self-contained PR. Don't bundle.

## Reference

- `docs/designer-prototype/HANDOFF.md` — the design author's notes
  (theming, breakpoints, gotchas, what got retired and why).
- `docs/designer-prototype/index.html` and the `.jsx`/`.css` files —
  the working spike. Read for behavior, not for code to copy verbatim.
- `src/game/App.tsx` — existing mode/screen orchestration, the precedent
  for adding `designer`.
- PR #6 — added `library` and `settings` modes; same shape applies here.
