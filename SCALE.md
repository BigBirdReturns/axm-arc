# Scale — what breaks as the roster grows, and what to bake in now

**Source:** three read-only audits (engine/cycle complexity, save/storage,
UI/arc-format) against roster sizes N=6 (today), N=80 (large raid), N=500
(enterprise org). **Status:** findings + substrate recommendations. Fixes not
committed — but unlike `BALANCE.md`, this asks for *architecture* decisions,
so the recommendations are more prescriptive.

> **Thesis (see `ROADMAP.md`):** an 80-person raid and a 500-person enterprise
> department are the *same scaling problem*. The landing page already promises
> Karazhan's 10→25; the roadmap's enterprise arc is org-scale by definition.
> Solving roster-scale management once IS the platform. Content-free is not
> enough — the substrate must be **content-free AND scale-free.**

## The organizing principle: reversibility, not severity

Rank work by *how expensive it is to change later*, not how bad it is now:

- **Substrate (Tier 0)** — data model, determinism, storage. Changing these
  *after* arcs are authored and saves exist in the wild is brutal (save
  migrations over O(N²) data, every consumer rewritten). **Decide these now,
  while there's one arc and no real saves.** This is the whole point of the
  exercise.
- **Algorithm (Tier 1)** — self-contained, swappable behind a stable
  signature. Cheap to change anytime. One guard needed now to prevent a freeze.
- **Surface (Tier 2)** — UI. Fully reversible. Build when N demands it.
- **Format (Tier 3)** — the arc schema's scale vocabulary. Additive if designed
  now, a breaking change if retrofitted. Design the *shape* now even if unbuilt.

---

## Tier 0 — Substrate (decide now)

### 0.1 Relationships are a flat array with O(N²) materialization AND O(N²) lookup
`Organization.relationships: Relationship[]` (`types.ts:193`). Two compounding
problems:
- **Dense materialization** — every pair exists. Edges = N(N−1)/2: **15** at
  N=6, **3,160** at N=80, **124,750** at N=500.
- **Linear lookup** — every access is `.find()`/`.findIndex()` over the whole
  array (`relationships.ts:28`, `stress.ts:250`, `resolver.ts:43`,
  `cycle.ts:410`). So lookups *inside* per-agent loops compound:
  - Morale drift: **O(N³)** (`stress.ts:181` — each agent filters all rels).
    125M comparisons/cycle at N=500.
  - Hostile proximity: **O(A²·N²)/cycle** (`stress.ts:236`).
  - Resolver rel-mod: **O(A·N²)/challenge** (`resolver.ts:41`).

Practical wall: noticeable drag ~N=80, multi-second cycles ~N=200, unusable
~N=500.

**Recommended substrate:** (a) **sparse** representation — only non-neutral
relationships exist; a missing pair *is* the neutral default. (b) **indexed
access** — `Map<agentId, Map<agentId, Relationship>>` or an adjacency map, so
lookup is O(1) not O(N²). Together these turn the O(N³) hotspots into O(N·k)
where k = an agent's actual meaningful relationships (small, bounded).
**This is the single most important decision in this document.** It touches
`types.ts` + every engine consumer + the save shape — which is exactly why it
must happen before more arcs and real saves exist.

### 0.2 Determinism depends on unguarded object-key iteration order
The cycle iterates `Object.entries(org.agents)` / `Object.keys()`
(`cycle.ts:116,285,349,392,437`). JS preserves insertion order for string keys
*in practice*, but it's not guaranteed by spec, and it gets fragile when agents
are recruited/removed mid-run at scale. RNG is consumed inside these loops, so
**iteration order is part of the deterministic contract** — the product's core
promise. Save→load round-trips `JSON.stringify(org)` (`save.ts:49`) with no key
sorting, so a resumed run could diverge from an uninterrupted one.

**Recommended substrate:** make ordering explicit and stable — either keep an
ordered `agentIds: string[]` alongside the map and always iterate that, or sort
keys deterministically wherever RNG is consumed. Cheap now; a nightmare to
debug as an intermittent replay-divergence at N=500 later.

### 0.3 Unbounded stores leak forever
`dramaQueue` (`drama.ts:407`) and `precedents` (`precedents.ts:6`) only ever
append. No eviction. O(cycles·N): ~160K precedent entries by cycle 1000 at
N=80; ~1M at N=500. Memory bloat + every violation-check is a linear scan over
the whole history + save size grows without bound.

**Recommended substrate:** bound them — cap + evict resolved drama; window or
summarize precedents (keep a rolling window + aggregate counts, not every raw
event). Precedent *memory* is a design highlight per `HANDOFF.md` — preserve
the behavior, bound the storage.

### 0.4 Storage ceiling + silent save loss
Full `Organization` serialized to localStorage (~5MB ceiling). Projected save:
~31KB at N=6, ~2.8MB at N=80 (OK), **~32MB at N=500 (6× over ceiling)** —
dominated by the O(N²) relationship web (0.1) and unbounded stores (0.3), so
fixing those shrinks this too. Worse: `QuotaExceededError` is caught but **not
surfaced** (`storage.ts:20`) — the game keeps running and silently resumes from
a stale save. That's a data-integrity bug at *any* scale, just lethal at large N.
Migration deep-copies the whole save (`save.ts:96`) → OOM risk on big saves.
Arc-library stores full `Arc` objects (`arc-library.ts:50`); the planned
portrait data-URLs would bloat each entry 10–100×.

**Recommended substrate:** (a) **surface quota failure to the UI** — never lose
a save silently (do this regardless of scale, it's a correctness bug). (b) Move
large/binary data (portraits, and eventually big saves) to **IndexedDB**, keep
localStorage for small state — exactly the split `DESIGNER_PORT.md` already
anticipated for portraits. (c) Fixing 0.1 and 0.3 keeps the core save small.

---

## Tier 1 — Algorithm (one guard needed now)

### 1.1 The roster planner is an O(2ⁿ) bomb
`findBestRosterPlan` → `combinations(available, size)` (`AssignScreen.tsx:62,89`)
enumerates every subset, no cap, and re-runs on every selection tap. C(40,10) ≈
8.5B; freezes the tab past ~15–18 agents. It's the *first* thing that breaks,
and it freezes desktop too, not just mobile.

**Recommended:** behind the same `findBestRosterPlan` signature, swap the
exhaustive search for a **greedy/role-bucketed heuristic** (sort eligible agents
per role by fit, fill slots, local-swap to improve) — O(N log N). Add a hard N
cap as an immediate guardrail so it degrades to "no recommendation" instead of
freezing. Reversible; can ship independently anytime. **A cheap cap is worth
committing now even before the real heuristic** — it removes a live freeze.

---

## Tier 2 — Surface / UI (reversible; build when N demands)

Every roster-rendering screen is a flat `.map()` with no virtualization,
search, filter, or grouping: `RosterScreen.tsx:80`, `AssignScreen.tsx:681`
(picker), the desktop rail (`App.tsx:587`), `ReportsScreen.tsx:125`. DOM nodes
scale ~8–12/agent: fine at N=6, scrollable-but-heavy at N=80 (≈640–960 nodes),
janky and *unusable to navigate* at N=500 (4–6K nodes). Mobile has a 480px hard
floor (`styles.css:49`) — a flat 500-row list on a phone is the worst case.
(Good news: the relationship web is **not** rendered as an N×N matrix anywhere —
only as counted alerts in `SituationSidebar.tsx:175` — so no O(N²) *view* exists
yet. Keep it that way; never build a literal who-likes-whom grid.)

**Recommended (when N>~30):** search + filter (role/tier/stress) + role/group
sections; windowing only if needed past a few hundred. Standard, boring,
deferrable. No substrate risk.

---

## Tier 3 — Arc format (design the shape now, build later)

The format assumes **one challenge at a time, small teams**: `RosterRequirements`
is just `{minAgents, maxAgents, roleRequirements[]}` (`types.ts:223`); no
concurrent encounters, no sub-teams/raid-groups, no scale metadata. Notably
there's an **unused `ArcScaling` type at `types.ts:419`** — scale was
anticipated and never wired. `ArcMeta` has only `estimatedCycles`, no
`expectedRosterSize` / `scaleMode`.

**Recommended (design now, additive):**
- Add an `arc.meta.scaleHint` (e.g. `small | raid | org`) so the UI picks
  flat-list vs. grouped/raid mode **from arc data** — content-free, dual-use.
- Decide the raid/org structural vocabulary: **agent groups/sub-teams** and
  **concurrent encounters** (a "challenge" that is several simultaneous checks
  across groups — the Karazhan 10→25 moment needs this). Wire the dormant
  `ArcScaling`. Designing the *shape* now keeps it additive; retrofitting after
  community arcs exist is a breaking change.

---

## Decisions I need from you

1. **Relationship substrate (0.1)** — adopt sparse + indexed now? This is the
   big one and the rest partly falls out of it. (Strong recommend: yes.)
2. **Determinism ordering (0.2)** — explicit `agentIds` order, or sort-at-use?
3. **Bound the stores (0.3)** — OK to cap/window drama + precedents (behavior
   preserved, storage bounded)?
4. **Surface quota failure + IndexedDB split (0.4)** — green to fix the silent-
   save-loss bug now (scale-independent correctness) and plan the IndexedDB
   move with portraits?
5. **Planner (1.1)** — ship a cap now as a guardrail, real heuristic as a
   follow-up?
6. **Format vocabulary (Tier 3)** — want me to draft the `scaleHint` +
   groups/concurrent-encounters schema shape (design only) as a follow-up doc,
   building on the dormant `ArcScaling`?

Tier 0 + 1.1-cap is the "bake the substrate in now" set. Tier 2 and the Tier 3
*build* are deferrable. Tier 3 *design* is cheap and worth doing before arc #2.
