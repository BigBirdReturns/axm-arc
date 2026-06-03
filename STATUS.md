# STATUS — axm-arc, 2026-06-02

**The "where exactly are we right now + what's next" artifact.** Re-readable
in any new session or by any agent picking up cold. Updated as state changes.

> Read alongside: `ROADMAP.md` (strategic frame), `HOOK.md` / `BALANCE.md` /
> `SCALE.md` / `DESIGNER_PORT.md` (design docs), `docs/DEPLOY.md` (pipeline).

## A. What is live on `main`

**Engine.** 11-step deterministic cycle, content-free, **193 tests**,
Mulberry32 PRNG with `hashSeed` substreams, Zod arc schema. Determinism bug
fixed: the Fearful-bark RNG-in-sort-comparator replaced with Fisher-Yates +
a golden insertion-order invariance test (SCALE law 3 enforced).

**Game loop (all five tabs).** Roster · Assign · Drama · Base · Reports.
House Style visual identity. Cycle transition interstitial, intent recap,
readiness checklist, "so what" report summaries. Assign decision support
(recommended roster, projection legibility, base upgrade recommendations).
Economy correct (gold from challenges, upkeep charged, farm guard, downed
recovery, real reputation gate).

**Codex / Manual.** In-game `?`/Manual overlay: every attribute, role, trait,
facility + "How challenges resolve." Arc-driven, zero hardcoded strings.
Doubles as arc-author QA (it's how the Wits role-orphan surfaced).

**Arc-as-artifact (Thread 2, done).** Import arbitrary JSON arcs →
`validateArc()` → store → load. Trust labels (bundled / imported-unsigned /
verified / quarantined) surfaced in library, codex header, title screen.
Build-time deploy variant (`game-first` / `enterprise-first` /
`research-first`).

**Polish.** Count-up on resource bar. Liveness keyframes lifted from the
digest prototype: `wordSet` on digest masthead, `digestIn` on digest root,
`barPulse` on stress/morale threshold crossings, `pressSweep` in cycle
transition. `<AttendedStamp>` available, drama-resolution wire-up future.
**Light/dark toggle** (☾/☀, persisted, prefers-color-scheme). Cycle digest
header on Reports. **Tab status badges** (Drama: blocking/inbox; Reports:
NEW/docket; ambient never nags).

**Char creator (Thread 3, steps 1+2 done).** **Designer** mode reachable
from title. Add/duplicate/delete/select wired through real
`engine/character` with deterministic substream per add. localStorage draft
(`axm-arc:roster-draft:v1`) parallel to org save. Live engine-record JSON.
Editor fields display selected agent (read-only — step 3 makes them
writable).

**Ops.** Actions-based Pages deploy (no more stale builds, no more
`docs/game` merge conflicts). In-game "What's new" release notes overlay.
`CHANGELOG.md` discipline.

## B. Where we stopped — the exact frontier

- **Thread 1 (loop feel):** mostly shipped. Open: 60-sec-to-first-win,
  digest ticket 3 (inline blocking docket + narrow advance-gating), Sprint-2
  leftovers (Auto-Resolve Policy #5, full Drama Decision Feedback w/
  provenance #7), engine debt (explicit `resolveEvent` on `RunReport`).
- **Thread 2 (platform):** done.
- **Thread 3 (authoring):** designer steps 1-2 done. **Stopped before
  step 3** (writable editor fields).
- **SCALE Tier 0:** only law 3 (determinism) enforced. **0.4 silent-save-
  loss** is a present-day correctness bug, scale-independent — cheapest
  next substrate win. **0.2 relationship sparse+indexed** is the big
  decision (depends on cohorts/squads call). **0.5 bounded histories**,
  **0.6 imported-arc budgets**, **0.7 cohorts/squads** all 🔜.

## C. The feedback ledger — what drove what

**Niece (cycle-8 playtest):**
- "What does Wits do?" → codex manual ✅, *revealed* the Wits role-orphan
  balance bug → `BALANCE.md` 📋 *decision pending*.
- "Who do I pick? all combos fail" → decision support (PR #13) ✅.
- "What does upgrading base do?" → base recommendations ✅.
- "Hook me from the first glimpse" → `HOOK.md` + liveness keyframes
  (partial) 🔜.

**Niece (designer-as-manual confusion):** "is this a manual?" → drove the
whole codex build ✅.

**Niece / owner (loop-tour fatigue):** "8 screens to collect stuff = I
quit" → digest model + tab badges. *The sharpest product insight of the
session* — reframed the cycle from "places to tour" to "outcomes
reported, decisions surfaced." Partial: tab badges ✅, digest header ✅,
**inline blocking docket + advance-gating change still 🔜** (digest 3).

**Owner gut-check ("what about an 80-person raid on mobile?"):** →
`SCALE.md`, the substrate audit. Determinism fix ✅; the rest 🔜.

## D. Lessons learned (keep these — process-level)

1. **Prototypes are CSS/keyframe source, not fridge art.** We re-derived
   craft by hand for two rounds before lifting it directly. Structure /
   data / fake-engine = discard; visual craft = lift verbatim.
2. **Deploy cadence was the bug.** Niece played a 3-day-old build because
   `docs/game/` was committed manually. Actions-Pages fixed it
   structurally so it can't recur.
3. **One engine, two audiences, no fork.** Every UX win is dual-use.
   This is the governing law.
4. **Codex PRs are cheap option-generation.** Harvest the signal (tab
   badging came from #19), close the rest.
5. **Determinism is a present-tense promise, not a scale concern.** The
   comparator bug was broken *today*, invisible until cross-browser.
   Laws need *enforcing tests* or they erode.
6. **Substrate decisions rank by reversibility, not severity.** Things
   that get expensive after saves/arcs harden are the ones to decide now.

## E. The queue — ranked by leverage

### Tier A — finish what's in flight
1. **Designer Step 3** — writable editor fields (name, tier, role,
   attribute ±, trait toggles). Turns the workbench into a creator.
   *Dispatch-ready spec in §G below.*
2. **Close stale branches** (Codex #19 duplicate; `claude/admiring-
   lovelace-BEWjR`). 30 seconds.

### Tier B — design bets you parked (need owner gut, not just code)
3. **Digest ticket 3** — inline blocking docket + narrow advance-gating
   from `dramaQueue.length` to `triageDrama(queue).blocking.length`.
   The "decisions come to you, with context, no trap" loop change.
   Wait until you've *used* the tab badges and have a feel for the lane
   model.
4. **Wits decision** (`BALANCE.md`) — 4th role / re-home a role /
   declare specialist stat / defer to Karazhan. Cheap once decided.

### Tier C — substrate correctness
5. **SCALE 0.4 silent-save-loss** — present-day correctness bug,
   scale-independent, no design decision needed. Cheapest substrate win.
6. **SCALE 0.2 relationship sparse+indexed** — the big one. Needs the
   cohorts/squads (0.7) call first.

### Tier D — hook (player pull)
7. **60-sec-to-first-win pass.** Wire `<AttendedStamp>` into drama
   resolution. Light up unused keyframes (`numFlash`, `hintPulse`,
   `tickIn`, `readyPulse`).

## F. Branch hygiene

- `main` is `76e859c`. PR #20-23 all merged. 193 tests green.
- Stale branches to close/delete:
  - `codex/audit-substrate-for-scaling-assumptions` (Codex PR #19 — a
    re-derivation of substrate work already merged; would regress the
    deploy fix if merged)
  - `claude/admiring-lovelace-BEWjR` (old Sprint-2 work, superseded)

## G. Designer Step 3 — dispatch-ready spec

**Goal:** make the Designer editor fields writable. Identity (name), tier
segment, role segment, attribute ±/drag with budget validation, trait
chip toggle. Equipment stays read-only (its own later ticket).

**Branch:** `claude/designer-step3` off main.

**Hard rules:**
- All mutations route through `setDraft`. The localStorage layer already
  persists on every change via the existing `useEffect`.
- Real engine types only. Don't shape-shift `Agent`.
- Arc-agnostic — labels from `arc.attributes`, `arc.roles`, `arc.tiers`.
- Token-driven CSS; everything stays scoped under `.designer-screen`.
- Deterministic. No RNG inside React state updates.

**What writes what:**
- **Name** — controlled `<input>`. Patches `agent.name`. Empty allowed
  but a placeholder shows in the rail.
- **Tier** — segment buttons enable. On click: patch `agent.tier` and
  `agent.upkeep` (look up `tier.upkeepCost`); recompute `baseEfficiency`
  via the existing `engine/character` helper if exposed, otherwise leave
  baseEfficiency as-is and document.
- **Role** — segment buttons enable. On click: patch `agent.role`
  (`null` for Flex). No regeneration; role is selection, not derivation.
- **Attributes** — each row gets `-` / `+` buttons (or +/-1 stepper).
  Clamp to [1, 20]. Show running budget (sum of attributes) vs tier's
  `statBudgetMin/Max`. **Over-budget shows an accent warning** but does
  NOT block the edit — authoring tool, not validator. Future hardening
  can refuse export when over budget.
- **Traits** — chip toggle. Click a chip to add/remove from
  `agent.traits`. Show selected vs available distinction (use the
  `.d-chip-on` modifier that already exists).

**State helper:** add a `patchAgent(id, partial)` helper inside
`DesignerScreen.tsx` that maps over `draft.agents` and applies a
shallow merge. Used by all the writers above.

**Determinism:** none of these mutations consume RNG. Adding/regenerating
agents uses the existing `generateForDraft` substream. If tier changes
should regenerate stats deterministically, that's a step 3.5 question —
default for step 3 is *don't* regenerate on tier change; let the user
re-roll explicitly via a (future) "reroll stats" button.

**Plan:**
1. Branch off main.
2. Add `patchAgent` helper.
3. Wire the five field types per spec.
4. CSS additions: stepper buttons, over-budget indicator. Keep all
   under `.designer-screen`.
5. `npm run check` — 193 tests must still pass; consider adding a tiny
   `tests/game/designer-storage.test.ts` round-trip (save → load →
   equality) if cheap.
6. `npm run build`. Push to `claude/designer-step3`. Don't PR.

**Done when:** you can add an agent, rename them, click through tier
and role options, see attribute sums update against tier budget, toggle
traits on/off, and have all of it persist across reload.

**Sized:** ~150 lines of new TSX + ~30 lines of CSS. Sonnet-sized.

## H. Status snapshot

- Build: green. Tests: 193/193. Deploy: Actions-based Pages, live at
  `bigbirdreturns.github.io/axm-arc/`.
- Threads: 1 mostly done, 2 done, 3 33% (steps 1-2 of 8).
- Substrate (SCALE): 1 of 9 laws enforced in code.
- Niece feedback: 3 of 4 resolved; "hook" partial.
