# Hook — the first-glimpse problem

**Source:** playtest feedback, cycle 8.
**Status:** unaddressed. No commit, no PR.

> **Thesis (see `ROADMAP.md`):** one engine, two audiences, no fork. The
> engine is content-free, so polishing the loop *is* enterprise work — every
> UX win accrues to whoever loads an arc. The hook is not a game-only concern;
> a first-glimpse that lands is what makes any arc (guild or enterprise)
> adopt-able. Don't re-derive a "game vs. platform" split — there isn't one.

> "I think you just have to find a way to hook the players from the first
> glimpse, make something more appealing, or some promising mechanics in
> the demo/tutorial." — niece, after playing through cycle 8

## What's actually broken

The editorial / broadsheet visual identity (House Style v1.0) is sharp and
honest. It tells the player this is a serious organizational simulator,
not a toy. That positioning is correct for the long game (enterprise,
audit, defensibility). It is *not* enough to seduce a first-time player
into the loop in the first 60 seconds.

The niece reference (Kairosoft) is informative but mis-applied: it's
specific to a particular visual idiom (pixel sprites, snappy animations,
constant micro-feedback). The real principle underneath is *liveness*:
the game state animates, reacts, and rewards attention from the first
glimpse.

## The dual-use trap

There are two products being built on the same engine, and they pull in
opposite directions on this question.

The **first-charter guild game** is a sell-to-the-curious product. It
lives or dies on whether a stranger on a phone clicks through the title
screen, makes it past the first cycle, and feels something. For that
audience, sober dashboards are an obstacle, not a virtue. Kairosoft-style
liveness — sprites that bob, dice that tumble, counters that count up
audibly — is exactly the vocabulary that converts.

The **enterprise / audit arcs** are the opposite product. They have to
read as serious to a buyer who is suspicious of "gamification" and
allergic to anything that resembles a toy. Bouncing sprites in that
context are not just off-tone, they actively undermine the sale.

So the trap is: any visual identity choice we make at the engine level
either over-serves one product and starves the other, or hits a bland
middle that helps neither. A "Kairosoft skin" applied universally is the
wrong answer because it forecloses the enterprise track. A universal
broadsheet skin is also the wrong answer because it's what got us this
feedback in the first place.

The way out is structural: the engine's job is to provide *liveness
primitives* — the hooks (animation triggers, state-change events,
satisfaction beats) that any arc can light up. Each arc's *skin* then
decides whether those primitives express as pixel sprites, data
visualizations, or sober dashboards. The engine doesn't pick the idiom;
the arc does.

This costs us nothing at the engine layer (the primitives are useful
either way) and it lets the guild game go fully expressive without
asking the enterprise arc to.

## Three layers of the hook problem

### A. Liveness primitives (engine-level, arc-agnostic)
- State-change pulse animations
- Agent-state micro-feedback (stress shake, morale glow, etc.)
- Loop-completion satisfaction beats (already partially done by cycle
  transition interstitials)
- Score/stat counters that *count up* rather than snap

✅ Keyframes lifted from `docs/digest-prototype/situation-room.css`:
wordSet, stampIn, pressSweep, barPulse, numFlash, tickIn, digestIn,
readyPulse, hintPulse. Wired: wordSet on the digest masthead, digestIn
on the digest root, `.bar-track.pulse` / `.bar.pulse` on threshold
crossings (stress ≥ 7, morale ≤ 30), `.press-sweep` on cycle-transition
beat 1. `<AttendedStamp>` available at `src/codex/AttendedStamp.tsx`;
drama-resolution wire-up is a future ticket.

### B. Onboarding-flow design (game-level)
- "60 seconds to first win" — the player should feel an outcome inside
  the first minute, not after reading help
- A guaranteed-success first challenge that teaches the loop
- Drama event in the first 2 cycles that has an obvious choice — builds
  confidence before complexity

### C. Skin layer (arc-level, optional)
- Per-arc visual idiom: portraits, color, motion language
- For first-charter (guild game): could be illustrated portraits, parchment
  flourishes, dice-roll animations
- For an enterprise arc: same primitives, expressed as dashboards, KPI
  pulses, organization-chart morphs

## Sequenced tickets (no commitment)

1. **Liveness primitives audit** — inventory what already exists
   (cycle transition, drama toast). Identify the cheapest 2-3 additions
   that would land widely (e.g. counter count-up animation, stress
   pulse, portrait reaction on state change).
2. **60-second-to-first-win pass** — re-design first cycle to guarantee a
   small win regardless of choice. Probably reduces difficulty of the
   first challenge, adds a guaranteed-positive drama beat.
3. **First-charter visual skin** — illustrated portraits or sprite-like
   agent representations. This is the Kairosoft-flavored piece, but
   ONLY for the guild arc.
4. **Skin layer hook in engine** — design the `arc.skin` shape so future
   arcs can express their visual idiom without engine changes.

## Why this is its own doc

This problem is bigger than legibility (DESIGNER_PORT.md covers a
parallel track), bigger than economy fixes (done), bigger than the
codex (now shipping). The hook is what gets a new player from "what is
this" to "I want to keep clicking." It deserves its own design pass and
its own sprint.

## Reference

- Niece playtest feedback (cycles 1-8)
- DESIGN.md sec 2.2 — "Mobile-first portrait layout. Everything reachable
  with one thumb." — the hook constraint that already exists.
- DESIGN.md sec 2.4 — what the player doesn't see.
- PROJECT_REVIEW.md — for what's already on the tactical roadmap.
