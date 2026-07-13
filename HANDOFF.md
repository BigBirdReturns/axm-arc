# AXM Arc — Session Handoff

> **HISTORICAL HANDOFF.** Do not use this file as current product authority or
> as the next-work queue. Read `AGENTS.md`, `CLAUDE.md`, `ROADMAP.md`, and
> `STATUS.md`. This file remains only as the record of an early game-loop session.

## What this is

Organizational simulation engine + browser game. Deterministic, offline-first, schema-validated. The engine is content-free — arcs are portable JSON. The first arc is a guild management game; the first raid is Karazhan.

**Live:** https://bigbirdreturns.github.io/axm-arc/game/
**Repo:** https://github.com/BigBirdReturns/axm-arc
**Branch:** `main` (all work merges here; working branch was `claude/cool-johnson-CILZb`, now merged)

## How to run

```bash
npm ci
npm run dev        # localhost:5173
npm test           # 147 tests, 14 files — all passing
npm run typecheck  # tsc --noEmit
npm run build      # output → docs/game/ (GitHub Pages)
```

## Architecture

```
src/engine/   — deterministic simulation (zero imports from src/arcs/)
src/arcs/     — portable JSON scenario definitions (zero engine internals)
src/game/     — React PWA, AXM House Style
tests/engine/ — 147 tests across 14 files (tests/engine/ + tests/game/)
docs/game/    — built PWA (committed, served by GitHub Pages)
docs/index.html — landing page
```

**Invariant:** engine never imports arcs; arcs never import engine internals. This is what makes the engine portable across domains.

## What was built in this session (all merged to main)

### Cold start fix
- `src/arcs/first-charter.starting-roster.ts` — veteran skirmisher starts at stress 3, recruit at morale 38 (visible tension before any assignment). Exports `FIRST_CHARTER_STARTING_SKIRMISHERS`.
- `src/game/App.tsx` — `buildNewOrg()` pre-seeds a `rivalrous_perf_gap` drama card between the two skirmishers. New game opens on Drama tab.

### Tutorial system (replaced modal coach entirely)
- `src/game/components/TutorialGuide.tsx` — state-driven nudge bar. Step derived from game state (`dramaQueue.length`, `assignments.length`, `org.cycle`). No stored step — state is authoritative. Auto-navigates tab on step change. Pulses tab button (step 2) and advance button (step 3).
  - Step 1 (Drama): "A rivalry is already brewing. Resolve the drama card."
  - Step 2 (Assign): "Go to Assign — pick a contract and slot agents." [Assign tab pulses]
  - Step 3 (Assign): "Agents slotted. Hit Advance Cycle." [Advance button pulses]
  - Step 4 (Reports): "Your first Field Report — this is the game."
- `?` button in header replays tutorial. New Game and Reset activate it.
- `CoachOverlay.tsx` deleted — the modal card deck is gone.

### Mobile tabbar fix
- `position: fixed` instead of `position: sticky` — anchors to viewport, unaffected by browser address bar show/hide.
- `env(safe-area-inset-bottom)` for iOS home indicator.
- `viewport-fit=cover` in `index.html`.
- `.mobile-only { padding-bottom: calc(60px + env(safe-area-inset-bottom)) }` for content clearance.

### Tutorial nudge styling
- Dark (`var(--ink)`) background, cream text, Barlow Condensed — reads as a situation room directive, not a form error.

## Open PR

**PR #6** (`codex/review-the-code` → `main`): Arc Library + Settings screens (Codex-generated).
- **Do not merge yet.** Will conflict with recent App.tsx changes.
- **Storage layer is worth keeping**: `ArcLibraryEntry` type, `importArcFromJson` (runs `validateArc`), `UserSettings`, trust taxonomy fields in data model. Pull this across manually rather than merging.
- **UI needs a pass**: Library screen lists arcs but has no "play this arc" action. Settings checkbox/select are unstyled natives.

## Sprint backlog (from product owner)

### Sprint 1 — P0 Core Loop (highest priority)

**1. Cycle Readiness Checklist UI**
Near Advance button, always visible:
- Drama resolved ✓/✗
- Rewards resolved ✓/✗
- Assignments queued ✓/✗

Current state: `readbackMessage` in App.tsx handles this as a single string. Replace with structured checklist component. No behavior change — display only.

**2. Intent Outcome Recap**
After cycle advance, compare `intent` text against run outcomes. Show "Intent: Achieved / Partial / Missed" in report or transition.
Heuristic: if intent mentions a challenge name (e.g., "Cellar") and that challenge succeeded, it's "Achieved."

**3. First-Session Pacing Pass**
New user reaches first cycle resolve in <5 minutes. One obvious "good" assignment path in The Cellar. No optional complexity until cycle 2+.

**4. Reports "So What" Layer**
Each report gets a 2–3 sentence summary block at top: what changed, why, what to do next. Existing forensic detail stays below fold.

### Sprint 2 — P1 Admin Drag Reduction

**5. Optional Low-Impact Auto-Resolve Policy**
Toggle: auto-resolve low-impact drama / auto-award low-tier rewards by default rule. Manual council mode stays default. Auto-resolved actions logged.

**6. Assign Screen Readability**
Quick filters (first-clear vs farm). Collapse/expand projection rows. Role names everywhere (no raw IDs).

**7. Drama Decision Feedback**
After choosing option: "Immediate effect" + "Possible downstream." Provenance tags (policy consistency, loyalty risk, etc.).

### Sprint 3 — Platform Bridge

**8. Arc Library MVP**
Core flow: import JSON → validate → store → load. Trust field in model. Invalid arc errors explicit and recoverable. (Base the implementation on PR #6's storage layer, not its UI.)

**9. Trust Label Plumbing**
All arcs show trust state: bundled / imported-unsigned / verified / quarantined. Display + metadata only — no runtime behavior difference yet.

**10. Deployment Variant Flag**
Build-time config: `game-first` / `enterprise-first` / `research-first`. Switches title lobby entry points without code fork.

### Sprint 4 — Metrics + Enterprise

**11. Local UX Telemetry** — time-to-first-cycle, cycles/session, blocked-advance frequency, drama resolution latency. Local/offline, exportable JSON.

**12. Enterprise Arc Prototype** — one non-fantasy arc (challenges = deliverables, resources = budget/capacity, drama = staffing/recognition conflicts). Same engine, same UI shell.

**13. Policy Presets** — "Simulation Deep" / "Flow Priority" / "Enterprise Review" presets adjusting policy toggles.

## Key files

| File | Role |
|---|---|
| `src/engine/cycle.ts` | 11-step cycle orchestration |
| `src/engine/resolver.ts` | Challenge resolution, loot, performance rating |
| `src/engine/drama.ts` | Drama card generation + resolution, name resolution |
| `src/engine/types.ts` | All types (`Agent`, `Organization`, `DramaCard`, `Arc`, etc.) |
| `src/engine/schema.ts` | Zod arc schema + `validateArc()` |
| `src/arcs/first-charter.ts` | Tutorial arc definition |
| `src/arcs/first-charter.starting-roster.ts` | Starting 6 agents + skirmisher pair export |
| `src/game/App.tsx` | Top-level state, `buildNewOrg()`, cycle advance, tab routing |
| `src/game/components/TutorialGuide.tsx` | State-driven tutorial nudge |
| `src/game/components/DramaScreen.tsx` | Drama card UI, council voting |
| `src/game/components/ReportsScreen.tsx` | Field reports, loot award |
| `src/game/components/AssignScreen.tsx` | Challenge assignment |
| `src/game/lib/storage.ts` | localStorage save/load |
| `src/game/styles.css` | All CSS (~1500 lines) |

## Known engine debts (documented in README)

1. **Resolve detection is heuristic** — `headline.ts` detects Resolve events by finding agents with zero stress and perfect performance on an otherwise stressed roster. Engine should emit an explicit `resolveEvent` field on `RunReport`.
2. **Reward-dispute item threading** — drama trigger uses `item: string` (name) instead of `itemId`. Inconsistent with rest of schema.

## localStorage keys

- `axm-arc:save:v1` — game state (org, cycle)
- `axm-arc:intent:v1` — player intent note for current cycle
- `axm-arc:tutorial:v1` — tutorial state (`"active"` | `"done"`)

## External review notes (from product owner)

- **RNG variance concern**: `variance = rng.uniform(-8, 8)` is large relative to morale modifier (-5 to +5). Consider tightening to [-4, 4] so good roster management is more reliably rewarded.
- **Intent friction**: `<textarea>` on mobile disrupts flow. Recommend predefined tap-to-fill tags as primary input, textarea optional.
- **Advance button location**: Currently only on Assign and Reports tabs on mobile. Consider FAB above tabbar so cycle can advance from any tab.
- **`wasDowned` heuristic**: Agent downed only if `performanceRating === 0 && assignedAgents.length > 1`. Solo agents can never be downed. May need tuning.
- **Precedent memory and VISIBLE/HIDDEN drama effects** are called out as design highlights — don't simplify these.

## What to do first in a new session

Check `npm test` and `npm run typecheck` pass (they should — working tree is clean).

Then pick from Sprint 1: the Cycle Readiness Checklist is the highest-leverage lowest-risk item — it's display-only, no behavior change, directly reduces the #1 player frustration (not knowing why advance is blocked).
