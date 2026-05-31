# Arc Designer — Roster Workshop · handoff

**File:** `prototype/AXM Arc Designer.html` (+ `bench-app.jsx`, `workshop.css`).
**Status:** design settled, loads clean, roster loop works end-to-end.

## What it is
Multi-agent authoring tool. Left **rail** of authored agents (select / roll / duplicate /
delete, upkeep tally, export-roster-JSON); center **editor** (identity + portrait,
standing, attributes, disposition, traits, equipment); right **engine record** (live
Agent JSON). Top **section nav**: Roster · Items · Challenges · Arc.

## Port into the repo (not a deploy — real work)
The repo today is the **single-agent** Bench (`src/game/components/DesignerScreen.tsx`).
This is the **multi-agent** upgrade.

1. **Reuse the engine** — `prototype/bench-engine.js` is reference only. In TSX, import the
   real modules exactly as `DesignerScreen.tsx` already does (`engine/character`, `prng`,
   `constants`, `lib/ui-helpers`, the `arc` prop). Don't hardcode the arc.
2. **Port `bench-app.jsx` → TSX** — maps ~1:1 (same hooks, same `patch` pattern, same class
   names). New layer is just roster state: `Agent[]` + `selectedId` + section, persisted to
   `localStorage`. Helpers `addAgent` / `duplicateAgent` / `deleteAgent` / `patchAgent` /
   `exportRoster` are documented inline in the JSX.
3. **Build a real `<Portrait>` component** — the prototype's `<image-slot>` persists via the
   preview host, which doesn't exist in the deployed game. Replace with a React drop-zone
   that reads the image to a data URL, falls back to the initials badge, and persists per
   `agent.id`. Keep the `workshop.css` class names so layout is unchanged.
4. **CSS** — append `workshop.css` (rail / grid / section nav / item+arc sections) to the
   existing `designer.css`. Build/deploy unchanged: `npm run build` → `docs/` → Pages.

Two calls for the owner: portrait as rail thumbnail too? · portrait store localStorage vs IndexedDB.

---

## Light / dark mode + theming
**Both modes are built and working in the prototype.** Toggle is in the top bar (☾/☀),
persisted to `localStorage["axm-arc-designer:theme:v1"]`, and **first load respects
`prefers-color-scheme`**. It's cheap because the whole tool is token-driven — a theme is
just a flat map of CSS custom properties; **no component hardcodes a color.**

Light is the `:root` default; dark is a `:root[data-theme="dark"]` override of the same
keys (in `AXM Arc Designer.html`'s `<style>`):

```css
:root{
  --accent:#b0623a; --ink:#211e1a; --muted:#6b6457; --dim:#9a9588;
  --rule:#e1dacb; --paper:#f6f2e9; --paper-alt:#ece5d6; --positive:#4a7a52;
  --bar-bg:#211e1a; --bar-fg:#f6f2e9;        /* bar stays dark in BOTH modes */
  color-scheme: light;
}
:root[data-theme="dark"]{
  --accent:#cd8358; --ink:#ece4d4; --muted:#a59c8b; --dim:#6e675a;
  --rule:#352f27; --paper:#17150f; --paper-alt:#211d16; --positive:#74ad77;
  --bar-bg:#100e0b; --bar-fg:#ece4d4;
  color-scheme: dark;
}
```

Two implementation notes for the port:
1. **The top bar uses dedicated `--bar-bg`/`--bar-fg` tokens** (not `--ink`/`--paper`), so it
   keeps its white-on-ink treatment in both themes. `designer.css` currently sets the bar to
   `var(--d-ink)`; `workshop.css` overrides it to `var(--bar-bg)`. In the repo, fold those bar
   tokens into `designer.css` directly so the shipped `DesignerScreen` bar (which has hardcoded
   `rgba(255,255,255,…)` text/controls) stays valid under dark mode.
2. **The `<image-slot>` web component hardcodes its accent (`#c96442`) and a dark dashed ring in
   its shadow DOM** — those won't follow the tokens. The outer portrait border is token-driven
   (`workshop.css: .d-identity image-slot{border:1px dashed var(--d-dim)}`) so visibility is
   fine, but if you want the slot's internal accent to recolor, pipe 2–3 vars into the new
   React `<Portrait>` component you build anyway.

**Wiring in React:** one `theme` state, init from `localStorage` then `prefers-color-scheme`,
and `useEffect(() => document.documentElement.setAttribute("data-theme", theme), [theme])`.
That's the whole thing — see `bench-app.jsx`. A multi-skin switcher (the old `applySkin`
pattern) is the same mechanism with more than two maps; reintroduce it the same way if wanted.

## Responsive / mobile
The workshop is responsive (`workshop.css`): 3-col ≥1100px → 2-col (rail + editor, record full
width) 760–1100px → **single column ≤760px**. On mobile the rail becomes a **wrapping card
grid** (`repeat(auto-fill, minmax(180px, 1fr))` — ~2 cards/row on a phone, more on a tablet),
`position: sticky` is dropped from the rail/record (it was the source of the editor-over-rail
overlap on phones), per-card actions stay visible (no hover on touch), and the section nav
scrolls horizontally on its own row under the title. Carry these breakpoints
into the TSX port. **Cascade gotcha:** the mobile `@media` rules live at the *end* of
`workshop.css` on purpose — media queries don't add specificity, so they must come after the
base `.rail`/`.rail-list` rules to win. The wrapping card grid also needs `min-width:0` on the
rail + list (else it blows out page width). Preserve both when porting.

## What happened to the old skins.js switcher
Short version: **the live skin-switcher was retired; theming is now plain CSS token defaults.**

- The **earlier single-agent** Bench (`arc-designer/Arc Designer.html`) shipped a top-bar
  **skin switcher** backed by `skins.js` — two full token sets, "AXM Editorial" (cream
  broadsheet) and "Expedition", swapped at runtime by `applySkin()` rewriting `:root` CSS
  custom properties. It was there to *prove the tool was fully themeable* — every color/font
  is a token, no component hardcodes a color.
- The **current Roster Workshop** (`AXM Arc Designer.html` / `bench-app.jsx`) **drops the
  multi-skin switcher** but keeps full token-driven theming — and now ships a **light/dark
  toggle** (see the section above). There's no `applySkin`/`skins.js`; instead the two themes
  are plain `:root` / `:root[data-theme="dark"]` token maps. The tool still inherits whatever
  the game's global tokens set.

**Why the old switcher went:** the multi-skin runtime switcher (Editorial/Expedition) was a
demo affordance to *prove* themeability, not a product feature. Dark mode is the one theme
variant that's an actual user need, so it stayed; the rest collapsed back into the game's
global tokens where they belong.

**If Code wants the full multi-skin switcher back:** trivial — same mechanism as the dark
toggle, just more than two maps. Re-add a `skins.js`-style map and an `applySkin()` that sets
the `:root` vars (the old one is still in `arc-designer/skins.js` as reference). No component
changes needed.
