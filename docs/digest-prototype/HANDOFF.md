# Cycle Digest — design artifact + integration brief

**Source:** design prototype (`AXM Situation Room — Digest.html` + `situation-room.css` + `situation-room.jsx`), built in the design tool.
**Status:** plan + working prototype. No repo code yet.
**Read with:** `SCALE.md` (§1.3), `HOOK.md` (layers A & C), `ROADMAP.md` (Thread 1), `DESIGN.md` (cycle loop / Reports).

> **Thesis (see `ROADMAP.md`):** one engine, two audiences, no fork. This is
> Thread 1 (loop legibility & feel) and it is dual-use by construction — the
> digest is deterministic-team-management UX for *any* arc, not guild-specific.

---

## What this is

The **post-Advance experience as a single page**, not a tab tour. When a cycle
resolves, the player lands on one **Field Report digest** where:

1. **Every outcome is already applied and merely *reported*** — gold, renown,
   morale, stress, afflictions, drops. There is **no "collect" step**. The
   `RunReport` already mutated org state; the digest renders the deltas. The
   prototype states this on-screen ("All outcomes applied — nothing to collect").
2. **Only real decisions ask for the player.** A single **blocking docket**
   (the council/reward-allocation decision) is pinned at the top and resolved
   **in place** — no navigating to a Drama tab. Resolving it stamps `ATTENDED`,
   clears the blocker, and unlocks Advance for the next cycle.
3. **Persistent ambient state never moves.** The roster rail (left) and the
   Imminent rail (right) stay fixed so the player keeps peripheral awareness
   (e.g. an agent's stress climbing to 10) without summoning it.

This is the **"liquid center, solid frame"** model: the center surface morphs
per cycle phase (plan → press-run interstitial → newspaper headline → digest),
but the ambient frame is solid.

## What this is **not**

- **Not a liquid / polymorphic / LLM-routed UI.** The control layer stays
  deterministic. This surface is a *pure render of a deterministic `RunReport`
  plus the `dramaQueue`* — no JIT UI generation. That is a hard requirement,
  not a stylistic one: determinism is the product promise (`SCALE.md` laws 3 &
  8). Anything that instantiates UI from model output at runtime violates it.
- **Not a new tab.** It does not add to Roster/Assign/Drama/Base/Reports. It is
  the **reframed cycle-resolution + Reports surface** and a **triage model for
  the drama queue**. Think "what Reports becomes after Advance," plus lanes.
- **Not a replacement for the Drama tab's authoring/inspection** — the Drama
  *tab* can remain as the full archive/inspector. The digest only surfaces the
  **blocking** lane inline; non-blocking drama is summarized.

## The decision it encodes (and where it comes from)

The "running to N tabs to collect things" pain has a real answer already written
in your own docs. This prototype renders it:

| Doc | What it specifies | How the digest renders it |
|---|---|---|
| `SCALE.md` §1.3 "Drama as denial-of-advance" | Split drama into **blocking / inbox / ambient** lanes; **coalesce** repeated low-priority triggers ("12 benching complaints") | Blocking docket pinned at top; inbox + ambient lanes summarized below (see tickets 4) |
| `SCALE.md` Law 2 "no unbounded histories" | Bounded recent + aggregates, never the full ledger | Digest shows the cycle's deltas + coalesced summaries, never an infinite log |
| `HOOK.md` layer A "liveness primitives" | Count-up, state-change pulse, loop-completion beats | Count-up on counters, threshold pulse on stress bars, press-run interstitial, `ATTENDED` rubber-stamp |
| `HOOK.md` layer C "skin layer" | Same primitives express per-arc; engine picks no idiom | Digest renders entirely from CSS custom properties → swappable skin (ticket 6) |

**The polymorphism lives in the skin, not in a morphing runtime.** That is the
disciplined version of the "liquid" instinct, and it is the version that keeps
the enterprise/audit arc shippable.

## Hard rules

1. **Deterministic render only.** Input is a `RunReport` + `Organization.dramaQueue`.
   No LLM in the path, no nondeterministic ordering. Use the engine's ordered
   primitives (`orderedAgentIds`, etc.) for any iteration.
2. **Outcomes are applied by the engine, displayed by the digest.** The digest
   never mutates org state except by resolving a blocking `DramaCard` through
   the existing resolution path (which records a `Precedent`).
3. **Token-driven.** Every color/space via CSS custom property. No component
   owns an accent. This is what makes the skin layer (HOOK C) free.
4. **Arc-agnostic.** Read agents, mechanics, drops, drama from the `arc` /
   `RunReport`. Nothing guild-specific hardcoded in the surface.
5. **Bounded.** Render the cycle's recent deltas + coalesced summaries. Never
   render a full history ledger (SCALE Law 2).

## Integration shape

The prototype is built in React+CSS for communication only. In-repo it slots
against the existing engine types (`src/engine/types.ts`):

- Reads `RunReport` (headline/narrative are `narrativeSeed`-driven today; the
  digest wants a resolved headline + deck + per-contract `MechanicResult` rows +
  `LootDrop`s).
- Reads `Organization.dramaQueue: DramaCard[]` and triages it into lanes.
- Resolving a blocking `DramaCard` uses the existing option-commit path and
  appends a `Precedent` (basis: merit/seniority/need/...).
- Drop status: a `LootDrop` whose allocation is automatic renders `applied`; one
  that needs a council decision renders into the **blocking docket**.

### Core new selector (the SCALE §1.3 primitive)

```ts
type DramaLane = "blocking" | "inbox" | "ambient";

interface TriagedDrama {
  blocking: DramaCard[];                 // gate Advance, render inline in digest
  inbox: DramaCard[];                    // visible, non-blocking
  ambient: Array<{ kind: string; count: number; sample: string }>; // coalesced
}

function triageDrama(queue: DramaCard[]): TriagedDrama;
```

`triageDrama` is the real unit of work. The digest is its presentation. Advance
gating already exists for drama; this just narrows "blocks Advance" to the
**blocking** lane instead of the whole queue.

## Sequenced tickets (each a self-contained PR; don't bundle)

1. **`triageDrama` selector + lane types.** The SCALE §1.3 core. Unit-tested
   against a queue with mixed priorities and repeated low-priority triggers
   (assert coalescing). No UI.
2. **Digest render of a `RunReport`.** Masthead, resolved headline + deck,
   "outcomes applied" affordance, cycle tally (per-agent deltas), contract
   audits (`MechanicResult` rows with carry + gloss), drops with `applied` /
   `docket` status. Augments/replaces `ReportsScreen` for the post-Advance view.
3. **Blocking docket inline.** Render `blocking` `DramaCard`s in the digest,
   resolve in place via the existing commit path, record `Precedent`, stamp
   `ATTENDED`, gate Advance on `blocking.length === 0`.
4. **Inbox + ambient lanes.** Non-blocking list + coalesced summary lines
   ("12 prolonged benching complaints"). Proves the model holds at large N —
   the scale case SCALE actually cares about.
5. **Liveness primitives pass (HOOK A).** Standardize count-up, threshold pulse,
   press-run interstitial, `ATTENDED` stamp as reusable, reduced-motion-aware
   primitives. Inventory what already exists (cycle transition, drama toast) first.
6. **Skin hook (HOOK C).** Digest reads `arc.skin` tokens. Ship the guild
   (broadsheet) skin as default; stub an enterprise (sober dashboard) skin that
   renders the *same* `RunReport` — the on-screen proof of "two audiences, no fork."
7. **Land on the digest after Advance** (not always Assign). The "bring it to
   the player" decision — sequence the loop by where it puts you.

## Open decisions, defaults if nobody answers

1. **Where does the resolved headline/deck come from?** Default: a deterministic
   narrative template keyed off `RunReport` outcome + `narrativeSeed`, same
   pattern as existing `NarrativeTemplate`. Not LLM-generated.
2. **Does the Drama *tab* survive?** Default: yes, as the full archive/inspector;
   the digest only inlines the blocking lane. Revisit once the inbox lane proves
   it can carry non-blocking drama.
3. **Coalescing thresholds?** Default: coalesce when ≥3 triggers share a
   `triggerType`/cohort within a cycle. Tunable in `triageDrama`.
4. **Skin granularity?** Default: a token map per arc (`arc.skin`), not a
   component fork. Enterprise overrides tokens + a few layout flags, not markup.

## Files in this package

- `AXM Situation Room — Digest.html` — open this. Hit **Advance Cycle** to walk
  the full beat: plan → press-run → newspaper → digest → resolve the one decision.
- `situation-room.css` — all tokens + components. The token discipline here is
  what makes the skin layer (ticket 6) cheap.
- `situation-room.jsx` — the React prototype. **Read for behavior, not for code
  to copy verbatim** — reimplement against `src/engine/` types, same way
  `DESIGNER_PORT.md` treats its spike.

## Reference

- `SCALE.md` §1.3 (drama lanes), Law 2 (bounded histories), Laws 3 & 8 (determinism).
- `HOOK.md` layers A (liveness primitives) and C (skin layer); the dual-use trap.
- `ROADMAP.md` Thread 1 (loop legibility, dual-use).
- `src/engine/types.ts` — `RunReport`, `DramaCard`, `DramaCardOption`,
  `Precedent`, `LootDrop`, `Organization.dramaQueue`.
