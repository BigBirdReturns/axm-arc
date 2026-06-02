# SCALE.md — substrate scale audit

This document is the scale-free substrate brief for `axm-arc`: the assumptions
that are cheap to change before arcs, saves, and community content exist in the
wild, and expensive to change after they do.

The organizing axis is **reversibility cost**, not visible severity. A frozen
screen is obvious and often local. A bad save shape, relationship substrate, or
determinism contract becomes archaeology.

## Executive summary

The current runtime treats the organization as a small, fully memory-resident,
fully reactive, fully serializable object graph. That is elegant at six agents.
It is not a substrate for 500 agents.

The product needs to be both **content-free** and **scale-free**:

- content-free: no domain-specific assumptions baked into the engine;
- scale-free: no hidden assumption that an org is a tiny, fully connected roster.

The highest-risk futures are not just slow loops. They are structural promises
made by the data model:

1. Dense all-pairs relationships.
2. Environment-dependent deterministic execution.
3. Unbounded canonical histories and queues.
4. Silent persistence failure.
5. Unbudgeted imported content.
6. Exact combinatorial planning over user-scale rosters.
7. A one-roster fiction for enterprise-sized orgs.

## Substrate laws

These are code-review laws, not preferences. Substrate-side changes that violate
one should be treated as no-go.

1. **No dense all-pairs relationships.** Missing relationship means neutral.
2. **No unbounded histories in canonical org state.** Keep recent buffers and
   aggregates; move long ledgers out of hot state.
3. **No environment-dependent ordering in engine paths.** This covers object-key
   iteration, `for...in`, RNG inside sort comparators, implementation-dependent
   sort behavior, mutable regex state, and anything else where two JS engines may
   legitimately choose different execution details.
4. **No silent persistence failure.** Save APIs return explicit results and the
   UI surfaces unsaved state.
5. **No exact combinatorial planner over user-scale rosters.** Recommendations
   may be budgeted and heuristic.
6. **No unbudgeted imported content.** Arc import has platform-declared byte,
   count, and string limits.
7. **No direct access to raw relationship storage outside the relationship
   module.** Use selectors and mutation helpers.
8. **Exact paths and approximate paths are statically distinguishable.** The
   deterministic resolver is the product promise and remains exact; advisory
   planners can be approximate and must say so.
9. **OrgState is sparse; OrgIndexes are pure derivations.** Indexes must be cheap
   to rebuild from canonical state. If an index requires O(N²) reconstruction,
   the state is already too dense.

Law 7 and Law 9 meet at the module boundary: indexes must be **rebuildable** from
canonical state for recovery, tests, save/load, and migration correctness, but
hot paths may maintain them incrementally behind relationship/module APIs. The
index is never the source of truth, and callers never mutate it directly.

## Tier 0 — decide/fix before public saves harden

### 0.1 Present-day determinism bug: RNG inside `Array.sort()` comparators

`applyAfflictionBarks()` shuffles Fearful bark targets with:

```ts
const shuffled = [...nearby].sort(() => rng.next() - 0.5);
```

This is broken today, not merely at scale. Sort comparator call counts and call
orders are implementation details. V8, JSC, and SpiderMonkey can consume a
different number of RNG values for the same input. Identical seed can diverge
across browsers.

**Decision:** ban RNG-consuming comparators in engine paths.

**Solution direction:** add deterministic shuffle helpers and semantic RNG
substreams:

```ts
rngFor(org.rngSeed, cycle, "fearful-bark", sourceAgentId)
rngFor(org.rngSeed, cycle, "affliction", agentId)
rngFor(org.rngSeed, cycle, "challenge", challengeId)
```

The seed-substream pattern already exists in spirit via `hashSeed(orgSeed,
cycle, challengeId)`. Generalize it so loop order stops mattering. Design the
key space now with future concurrent encounters in mind: `rngFor(seed, cycle,
"encounter", groupId)` is what makes parallel resolution deterministic instead
of dependent on scheduling or traversal order.

### 0.2 Relationships: dense materialization, linear lookup, copy amplification

Current relationship state is a flat array. Reads use `.find()` / `.findIndex()`.
Writes rebuild the relationship array with `.map()` or append a new array. Those
writes occur inside pair loops.

At N=500, a dense relationship set has 124,750 edges. Even if lookup becomes
O(1), a write path that copies 124,750 edges per delta is still catastrophic.
The current problem is lookup amplification **and** copy amplification.

**Decision:** change relationship substrate before public save compatibility
matters.

**Runtime shape:**

```ts
type PairKey = `${AgentId}|${AgentId}`;
relationshipByPair: Map<PairKey, Relationship>;
relationshipsByAgent: Map<AgentId, Set<PairKey>>;
```

**Save shape:** sparse JSON, not runtime maps:

```ts
relationships: {
  version: 2,
  edges: Array<{
    a: AgentId,
    b: AgentId,
    state: RelationshipState,
    affinity: number,
    flags?: string[]
  }>
}
```

Only persist edges where `state !== "Neutral"`, `affinity !== 0`, or special
metadata exists. Missing edge is neutral.

**Migration:** canonicalize pair keys, drop zero-affinity neutral edges, preserve
special states.

**Pre-release option:** if saves are still effectively private/test-only, prefer
breaking with a save-version bump over writing migration code. Migration is the
post-release tool; before saves harden, discard-and-reset can be the cheaper and
safer substrate move. Make this an explicit release decision rather than assuming
migration work is mandatory.

### 0.3 Deterministic execution contract

Determinism cannot ride on incidental object insertion order. Engine paths must
use canonical iteration and semantic RNG streams.

**Decision:** define deterministic primitives:

- `orderedAgentIds(org)`
- `orderedRelationshipPairs(org)`
- `orderedChallengeIds(arc)`
- `rngFor(seed, cycle, semanticKey, entityId?)`
- `deterministicShuffle(items, rng)`

Every engine loop over agents, relationships, or imported content uses these
primitives. Every migration canonicalizes order.

### 0.4 Silent save loss

The save wrapper catches all `localStorage` failures and only logs to console.
The app continues running on a stale save. Quota exhaustion turns into invisible
progress loss.

This is separable from IndexedDB. Fix save semantics first, backend second.

**Decision:** save APIs return explicit results:

```ts
type SaveResult =
  | { ok: true; bytes: number }
  | { ok: false; reason: "quota" | "unavailable" | "serialization" | "unknown"; bytes?: number; recoverable: boolean };
```

**Solution direction:**

- app-level `saveStatus` / dirty state;
- visible “save failed” UI;
- export-recovery button;
- transactional localStorage while it remains the backend:
  - write `save.tmp`,
  - read back and verify,
  - promote to current key.

IndexedDB remains the correct medium-term backend, especially once portraits,
arc libraries, and larger saves exist.

### 0.5 Unbounded canonical history

The audit originally caught `dramaQueue` and `precedents`; the same issue exists
inside every agent:

- `assignmentHistory`
- `afflictionHistory`
- `rewardHistory`

Multiple systems scan these histories. Repeat-clear detection scans every
agent's full assignment history. Morale and reward systems read recent slices.
Relationship bonding derives shared challenge history.

**Decision:** canonical org state stores bounded recent history plus aggregates,
not infinite ledgers.

**Solution direction:**

```ts
assignmentRecent: RingBuffer<AssignmentRecord>
assignmentStats: {
  total: number,
  byChallenge: Record<ChallengeId, {
    success: number,
    partial: number,
    failure: number,
    lastCycle: number | null
  }>
}
rewardRecent: RingBuffer<RewardRecord>
rewardStats: {
  total: number,
  lastRewardCycle: number | null,
  bySlot: Record<string, number>
}
afflictionStats: {
  counts: Record<Affliction, number>,
  recent: RingBuffer<AfflictionRecord>
}
```

Full ledgers can exist later as export/debug data, but not in hot canonical org
state.

**Precedent caveat:** not every history can be bounded as a pure storage
optimization. Lossless counters are safe. Pattern memory is design-bearing: a
high-ambition agent remembering a 40-cycle-old violation may be intended
behavior, not bloat. Split histories into:

- lossless aggregates that can always replace scans;
- recent buffers for UX and local sim texture;
- deliberate long-memory signals whose retention horizon is a design call.

### 0.6 Imported arc budgets

Arc import validates shape, not platform scale. That makes imported content a
DoS vector: huge JSON, huge strings, thousands of challenges, giant reward
tables, or many imported arcs can collapse parsing, storage, UI, and runtime.

**Decision:** publish platform budgets now.

Budget examples:

- max raw arc JSON bytes;
- max imported arcs;
- max total library bytes;
- max challenges;
- max mechanic checks per challenge;
- max reward entries per outcome;
- max items;
- max custom traits;
- max narrative events;
- max string length by field;
- max roster requirement sizes unless `scaleHint` opts into larger modes.

The codex should surface these budgets to authors: “this arc declares 500 agents
× 50 challenges; projected save is over recommended budget.” This extends the
codex from manual/model surface/balance QA into scale QA.

### 0.7 Enterprise fiction: not one 500-person roster

A 500-person organization should not be modeled as one fully adjacent roster.
That is wrong for data and wrong for fiction. Departments, cohorts, squads, and
relationship neighborhoods are the narrative model that makes sparse data true.

**Decision:** enterprise scale means org topology:

- organization;
- departments/cohorts;
- squads/active pools;
- assignment groups;
- relationship neighborhoods;
- cross-cohort relationships only when authored or earned.

This also belongs in arc vocabulary: `scaleHint`, groups, concurrent encounters,
and encounter packs. “Karazhan 10 → 25” is not just bigger numbers; it implies
concurrent groups and different adjacency.

This is Tier 0 philosophically and Tier 3 operationally: decide the fiction now,
build the full cohort/squad UI and engine later. Waiting to decide lets saves and
arcs harden around the one-roster fiction; trying to build it all immediately
turns a substrate call into a rewrite.

### 0.8 Enforcement harness: give the laws teeth

Substrate laws need failing tests and CI guardrails, or they become aspirations.
The minimum harness:

- **Golden-seed insertion-order invariance:** run the same seed and arc with
  deliberately permuted agent insertion order; assert byte-identical reports,
  events, and resulting canonical state.
- **Save round-trip determinism:** uninterrupted play to cycle K must match
  save/load/resume to cycle K. This catches serialization-order drift and index
  rebuild errors.
- **Cross-engine determinism check:** run at least Node plus one browser engine
  in CI for deterministic replay. Comparator and ordering bugs can be invisible
  on Node-only tests.
- **Save-size budget test:** declared `scaleHint` plus generated/projected state
  must stay under platform budgets, or CI fails.
- **Static scan for banned patterns:** flag RNG-consuming sort comparators and
  direct relationship storage scans outside the relationship module.

The first substrate implementation should include one golden test with permuted
agent insertion order. That is the executable form of Law 3.

## Tier 1 — fix before large rosters are possible

### 1.1 Planner combinatorics

The recommended-roster planner materializes combinations from `minAgents` to
`maxAgents` and evaluates every one. This is exact optimization over an
exponential candidate space.

**Law:** recommendations are approximate; resolver paths are exact.

**Solution direction:** deterministic budgeted planner:

- hard candidate/evaluation cap;
- pre-score agents per challenge role/check;
- required roles first;
- top-K candidates per role;
- greedy fill plus bounded beam search;
- explicit UI copy when capped: “Best recommendation within planning budget.”

A Web Worker can protect the UI, but it is not the algorithmic fix.

### 1.2 Resolver recomputes team aggregate per agent

The resolver comment says team aggregate is computed once and shared, but the
cache is local to each agent's `mechanicResults`. Aggregate checks are recomputed
for each assigned agent.

**Verification flag:** confirm whether the recomputation consumes RNG or depends
on agent order before changing it. If it does, this is a determinism bug wearing
a performance costume, and “compute once” changes results. If the repeated
calculation is provably identical, compute each team-aggregate mechanic once per
challenge and reuse the result for each report row as an exact-path optimization,
not an approximation.

### 1.3 Drama as denial-of-advance

Drama queue growth is not just storage growth. Drama blocks Advance. At large N,
a cycle that produces dozens of cards becomes a UX dead-end.

**Solution direction:** split drama into priority lanes:

- blocking drama: must resolve before Advance;
- inbox drama: player-visible but non-blocking;
- ambient reports: summarized context.

Coalesce repeated low-priority triggers:

- “12 prolonged benching complaints”
- “5 rivalrous performance gaps”
- “3 morale extremes in Cohort B”

The goal is to preserve drama as the game's texture without turning it into
paperwork.

### 1.4 Runtime indexes for hot lookups

Repeated `.find()` calls over arc and org arrays appear throughout resolver,
projection, reward, relationship, and UI paths.

**Solution direction:** derive cheap indexes from sparse canonical state:

- agent by ID;
- item by ID;
- tier rank by ID;
- role by ID;
- trait by ID;
- challenge by ID;
- relationship by pair;
- relationships by agent.

These indexes must be pure derivations, not second sources of truth.

## Tier 2 — reversible UI work when N demands it

Large rosters also need presentation changes, but these are less irreversible
than data-model promises:

- virtualized roster and assignment lists;
- search/filter/grouping;
- cohort/squad views;
- paginated reports;
- summarized drama inbox;
- no relationship matrix view as a default product surface.

Do these when the substrate can support them. Virtualization does not save a bad
relationship model or a broken save shape.

## Tier 3 — arc format vocabulary

The arc format already has a dormant `ArcScaling` concept. It needs an additive,
explicit vocabulary before large/community arcs depend on implicit conventions.

`scaleHint` should be one declaration doing three jobs:

1. choose UI render mode and whether roster views default to cohorts/squads;
2. select storage/import/save-size budgets;
3. declare relationship adjacency topology and expected density.

The author declares scale once; the platform sizes itself.

Additive direction:

```ts
scaleHint?: {
  expectedAgents: number,
  expectedActiveAgents: number,
  expectedCycles: number,
  expectedChallenges: number,
  topology?: "single-roster" | "cohorts" | "squads" | "concurrent-groups"
}
```

Challenge/encounter vocabulary direction:

```ts
encounterGroups?: Array<{
  id: string,
  rosterRequirements: RosterRequirements,
  mechanics: MechanicCheck[]
}>
concurrency?: {
  mode: "single" | "parallel" | "staged",
  requiredGroups: number
}
```

Scale is not only “more agents.” It is topology, concurrency, and adjacency.
Concurrency depends on Tier 0 RNG substreams: parallel encounters need
per-group/per-encounter RNG keys before they can be safe to execute in any order.

## Recommended sequencing

1. Fix present-day determinism bug: remove RNG-consuming sort comparators.
2. Add the first golden-seed insertion-order invariance test.
3. Fix present-day save correctness: explicit save results and visible failure.
4. Add imported-arc budgets before community content accumulates.
5. Decide whether the relationship save-shape change can break old saves now or
   must migrate them.
6. Decide relationship save/runtime shape while saves are young.
7. Add deterministic ordering and semantic RNG substreams everywhere in engine
   paths.
8. Replace unbounded canonical histories with recent buffers, aggregates, and
   explicit long-memory design calls.
9. Cap/replace exact planner with budgeted advisory planning.
10. Verify then fix resolver team-aggregate recomputation.
11. Introduce cohort/squad/scale vocabulary additively.
12. Build UI virtualization and grouping once the substrate is safe.

## Decisions to lock

1. Is enterprise scale represented as one roster or cohorts/squads?
   - Recommendation: cohorts/squads.
2. Are neutral relationships persisted?
   - Recommendation: no; missing edge means neutral.
3. Is full history canonical org state?
   - Recommendation: no; bounded recent history plus aggregates.
4. Is exact recommended roster required?
   - Recommendation: no; deterministic best-effort under budget.
5. Can imported arcs be arbitrary size?
   - Recommendation: no; platform budgets are part of the format contract.
6. Is localStorage an enterprise save backend?
   - Recommendation: no; keep it for tiny settings/bootstrap only.
7. Are resolver paths ever approximate?
   - Recommendation: no; exact engine, approximate recommendations.
8. Are runtime indexes maintained as state?
   - Recommendation: no; sparse state, rebuildable derived indexes maintained
     incrementally behind module APIs.
9. Can pre-release substrate changes break old saves?
   - Recommendation: yes while saves are private/test-only; migrate only once
     saves are public commitments.
10. What does `scaleHint` control?
    - Recommendation: UI mode, storage/import budgets, and relationship
      topology from one declaration.

## Final frame

The future to avoid is not “the game gets slow.” The future to avoid is that
saves, arcs, and mental models all encode a tiny fully connected roster, and
every later feature must either preserve that mistake or break users' worlds.

The way out is to make scale a substrate property now:

- sparse state;
- pure indexes;
- deterministic order;
- explicit save failure;
- bounded histories;
- budgeted imports;
- exact engine paths;
- approximate advisory paths;
- organization topology instead of one giant roster.
