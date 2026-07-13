# Seam Audit — axm-world + axm-arc — 2026-07-13

> A full QA sweep of every guarded seam across both repos. Read cold by any
> agent or human picking up the platform. This is the honest record: what was
> run, what is green, what is a real bug, and — the recurring theme — where a
> green test does not actually test the contract it is named for.

---

## 0. TL;DR

- **Both repos are green.** Typecheck clean; **1,212 tests pass** (world 645 /
  arc 567). Nothing here is a broken build.
- **59 seams audited** by an independent QA agent each (one per seam), then
  **every high/critical finding adversarially verified** by a second,
  default-refute skeptic. **145 findings**: 0 critical, 3 high, 76 medium, 55
  low, 11 nit. All 3 highs **confirmed** on re-audit (verify sharpened two of
  them down to medium with reasoning — see §3).
- **The headline is not the bug count. It is the guard quality.** 48 of 59
  seams' guards were judged **partial** — the test passes but asserts something
  weaker than, or tangential to, the contract. A large share of the 145
  findings are *"the guard is tautological / never exercises the path where the
  contract can break."* Several real behavior bugs sit directly behind such
  guards.
- **The green suite is a floor, not a proof.** Every real bug below lives in a
  branch the passing tests never enter.

---

## 1. Method (so this is reproducible, not vibes)

1. **Baseline gate**, run to completion before any analysis, isolated from the
   fan-out to avoid the `.js`-shadow stomp axm-arc's CLAUDE.md warns about:
   - `axm-world`: `tsc --noEmit` ✅ + `vitest run` → **79 files / 645 tests pass**.
   - `axm-arc`: purge emitted `.js`/`.d.ts` → `tsc --noEmit` ✅ + `vitest run`
     → **57 files / 567 tests pass**.
2. **Seam inventory**: 59 seams derived from the actual guard-test files + the
   contracts named in both CLAUDE.md / ADRs (constitution, vendored-surface
   drift, one-helper-two-surfaces derivations, engine invariants, cartridge
   conformance, import/export, the Library/Workshop/Archive/Guild-Hall app
   surfaces, i18n, assets, determinism).
3. **Fan-out**: one senior-QA agent per seam. Each read the guard test **and**
   the implementation, judged whether the guard enforces the contract, and
   reported only defects anchored to a concrete file+line with quoted evidence.
   Static reading only — no test execution in the fan-out (parallel runs corrupt
   each other).
4. **Adversarial verify**: every `high`/`critical` finding handed to a second
   agent instructed to **refute by default** and read the source itself.
5. Totals: **62 agents, 0 errors, ~3.75M tokens, ~812 tool calls.**

---

## 2. Baseline — what is genuinely green

| Repo | Typecheck | Test files | Tests | Result |
|------|-----------|-----------|-------|--------|
| axm-world | clean | 79 | 645 | ✅ all pass |
| axm-arc | clean | 57 | 567 | ✅ all pass |

This supersedes `axm-arc/STATUS.md` (2026-07-03, "284/350") — the suites have
roughly doubled since that checkpoint. The floor is real. The rest of this doc
is about what the floor does **not** catch.

---

## 3. Confirmed defects (adversarially verified)

All three were confirmed by an independent refute-first pass. None is caught by
the green suite.

### 3.1 `HIGH` — Recruitment top-tier suppression is broken for **every shipped cartridge**
`axm-arc/src/engine/recruitment.ts:31`

The spec invariant (`DESIGN.md:442` — *"Top-tier agents never appear in the open
pool"*) and the code's own comment (*"legendary never in open pool — clamp to
0"*) are enforced **only positionally**. `pickTier` maps four weight buckets
(common/uncommon/rare/epic) onto `arc.tiers[0..3]` via a hardcoded 4-entry
`tierByRank`. Suppression only happens when a 5th tier exists at index ≥4
(karazhan-shaped). **All six shipped cartridges declare exactly 3 tiers**, so
their genuine top tier sits at `arc.tiers[2]` and is surfaced in the open pool.
At reputation > 50 the `rare` weight (40) maps to that top tier while `epic`
(35) maps to `undefined` and is dropped → **~62% of draws are the "unfindable"
top tier**; ~26% at mid-rep.

- **Why the suite misses it:** `recruitment.test.ts:36` ("legendary never
  appears") runs on a fixture arc whose four tiers are literally named
  common/uncommon/rare/epic with no hidden 5th tier — the assertion is
  vacuous for the shipped 3-tier shape.
- **Verify verdict:** *confirmed, severity high.* Read recruitment.ts, types.ts,
  DESIGN.md, all 6 cartridges. `refreshOpenPool` is live from `cycle.ts:407`.
- **Fix:** derive the hidden set from the arc — `arc.tiers[arc.tiers.length-1]`
  or an explicit `ArcTier.recruitable=false` flag — never a magic index.

### 3.2 `MEDIUM` (reported high) — Industrious trait bonus double-applied
`axm-arc/src/engine/infrastructure.ts:39` + `character.ts:70`

`computeBaseEfficiency()` bakes `×1.3` into `baseEfficiency` for the
`industrious` trait, and `tickProduction` **multiplies by 1.3 again** for the
same trait. Output is `base×1.69`, not the documented `×1.3`
(`constants.ts:13`). The trait is declared infra-only
(`infraEfficiencyMultiplier`), so folding it into general `baseEfficiency` is
both semantically wrong and the root of the double count.

- **Verify verdict:** *confirmed; medium* — deterministic economy corruption
  for any industrious agent in a Production facility, but not a crash/data-loss.
- **Fix:** remove the multiplier from **one** surface (prefer `character.ts:70`,
  keeping `baseEfficiency` trait-neutral).

### 3.3 `MEDIUM` (reported high) — `foldCommit` mutates the prior ledger in place
`axm-arc/src/game/lib/ledger.ts:437`

`const tiers = [...base.progress.tiers]` is a **shallow** copy — the
`TierRecord` objects are shared with the prior ledger. A repeat commit of the
same cartridge finds a shared record and does `existing.pulls += … ;
existing.wipes += … ; existing.cleared = true`, mutating the **prior** ledger's
tier record. Violates the module's own "Append-only / a prior ledger is never
mutated" contract (Article 3 — memory stays honest). It is the lone in-place
mutation among otherwise-functional rebuilds (roster/gear/fairness all rebuild
fresh objects in the same function).

- **Verify verdict:** *confirmed; medium* — harm requires a retained `prev`
  reference (undo, snapshot, before/after compare); current call sites replace
  and persist the returned ledger, so the mutated `prev` is usually discarded
  before it reaches a surface. Real latent-integrity bug, bounded blast radius.
- **Fix:** `base.progress.tiers.map(t => t.cartridgeDigest === digest ? {...t} :
  t)` then mutate the clone — mirror the fresh-object pattern already used
  beside it.

---

## 4. The systemic finding — vacuous guards ("green ≠ tested")

This is the most important QA output. **48 / 59 seam guards are `partial`.** The
pattern repeats: a test named for a contract asserts something the contract does
not actually require, so it stays green through a real regression. The worst
offenders (each anchored, medium unless noted):

**Determinism / correctness guards that pin nothing**
- `prng-determinism`: guards are tautological — **no frozen golden vector** pins
  actual PRNG/hash output. (`tests/engine/prng.test.ts:80`)
- `resolver`: `resolveChallenge` silently **ignores its required `rng`
  parameter**; `runCycle`'s `step1Rng.fork()` is dead code.
  (`src/engine/resolver.ts:297`) — the locked-challenge "spends no tokens"
  assertion is also tautological (`access.test.ts:191`).
- `projections-stability`: no purity/no-rng/stability guard — the test only
  asserts fixed UX strings. (`tests/engine/projections.test.ts:60`)
- `engine save migration`: the migration loop is **entirely unexercised** — the
  one test iterates an empty `MIGRATIONS` map. (`tests/engine/save.test.ts:64`)

**Guards that never run the path where the contract breaks**
- `escalation-signal`, `readiness`, `gate-parity`, `difficulty-mode-choice`,
  `mobile-play-flow`, `one-world-routing`, `resource-spend-projection`,
  `engine-grammar`, `presentation-prefs`, `i18n-coverage` (bare-literal detector
  misses conditional/binary expressions) — all assert a proxy, not the contract.
- `cartridge-bay` / `constitution`: the seam's **headline invariant — "a file
  cannot claim its own trust" — has no adversarial guard** (see §5.1).

**Guards that assert on always-empty or bounds-only data**
- `guild-hall` precedentViews (length-only, always-empty, never checks ordering),
  `carry-forward` growth-cap (ceiling never exercised; scars/attendance
  uncovered), `fairness-loot` (`typeof`-only), `consequence-honesty`
  ("every loot line backed by a real reward" is vacuous **and** tautological),
  `library-profile` (cannot catch a wrong sort order), `ledger-migration`
  (never exercises an actual transform).

**Coverage holes**
- `second-lockout.arc.json` — a shipped cartridge with **zero
  conformance-harness coverage**. (`cartridges/` — all 5 others have a test.)
- "Original vocabulary / no franchise names" clause — enforced by **no test**.
- Fresh-boot wiring (`useArcWorld`) — not covered by any CI-gated test; only the
  pure decision is.

---

## 5. Real behavior bugs behind weak guards (medium, high-confidence, unverified pass)

These were rated medium so they skipped the verify wave, but each is anchored
and concrete. Triage-worthy:

### 5.1 Trust can be self-claimed on the envelope import path — Article 2
`axm-world/src/world/cartridge.ts:195`. The full-envelope branch builds
`{ ...manifestForArc(arc, trust), ...env.manifest, id: arc.meta.id }` — `id` is
re-pinned after the untrusted spread but **`trust` and `signature` are not**, so
an imported envelope claiming `trust:"verified"` / a forged `signature` parses
to a cartridge wearing that false seal. Latent today (the bay only imports bare
Arcs), but the docstring markets this branch as the creator-packaging seam — the
"next lane" — so wiring it activates the spoof. Fix: re-force `trust` +
`signature: null` after the spread. **This is the one to fix before the
publish/packaging lane ships.**

### 5.2 Economy — pay-before-gate and unbounded/negative balances
`axm-arc/src/engine/cycle.ts:175` debits tokens **before** the roster-gate
check, so a gate-failing party pays for nothing; the debit is also unbounded by
the authored lever (`cycle.ts:177`). `economy.ts:51` `chargeUpkeep` permits a
**negative currency balance** ("no negative balances" unenforced). The economy
guard covers none of conservation / non-negativity / authored-cost.

### 5.3 Honesty violation — "recorded" claimed without a ledger entry
`axm-world/src/world/world-state.ts:22`: `deriveWorldTransformations` reports
`state:"recorded"` for any cleared node **even when the ledger holds no matching
entry** — the runtime claiming memory it cannot back (Article 6).

### 5.4 Progression non-monotonicity
`axm-arc/src/engine/access.ts:55`: reputation-gated progression-tier unlock is
**non-monotonic**, contradicting the program-loop seam's "progression monotonic"
contract (a reputation dip can re-lock a tier).

### 5.5 Others, anchored
- **Relationships**: `applyRelationshipDelta` trait multipliers are
  order-dependent / double-counted, breaking the symmetric-edge invariant.
  (`relationships.ts:145`)
- **Stress**: `Resentful` affliction declared 0 but applies 1; `Resolve` grants
  +5 morale to the **whole org**, not just witnesses; several declared trait
  effects the codex UI describes are unimplemented. (`stress.ts:176,350,93`)
- **Rewards**: `applyRewardDecision` awards the item to `winner` **without
  verifying eligibility**, and decisions aren't linked to an authored dropped
  loot choice. (`rewards.ts:164`, `cycle.ts:246`)
- **Designer**: `duplicateAgent` mints **colliding agent ids** after
  duplicate→delete→duplicate. (`DesignerScreen.tsx:126`)
- **Expansion Archive**: contract says "1-indexed" journey numbering; code and
  guard pin the raw **0-indexed** value. (`ExpansionArchiveScreen.tsx:178`)
- **Compat refusal**: verdict trusts the ledger's self-reported `profileDigest`,
  never reconciled with the profile arrays or roster — a crafted digest can pass
  an incompatible pairing. (`ledger.ts:76`)
- **Strategy board**: `initialStrategyState` ignores `seatCountRange` — can
  construct an out-of-range / invalid-active-index state. (`turn.ts:78`)
- **Schema strictness**: cartridge objects are non-strict — unknown/misspelled
  fields are **silently stripped, not rejected** (contra "cartridges emit only
  schema-defined fields"); `role_specific` `roleIds` are never cross-validated
  against the arc's roles. (`schema.ts:246,28`)
- **Two-surface divergence risk**: `deriveWorldMap` "Steep hides once recorded"
  is duplicated in two components with no guard; the shared "Squad fit" band is
  fed different parties on board vs detail panel and computes `squadFitReason`
  by non-shared logic in each — the two surfaces **can show contradictory
  verdicts** (violates "one helper, two surfaces").
  (`WorldMap.tsx:149`, `ContractBoard.tsx:92`, `regions.tsx:533`)
- **Fairness**: `fairness.distributionScore` is a frozen constant `100`, never
  derived from the actual loot distribution. (`ledger.ts:425`)
- **Ledger migrate**: `migrate()` accepts **newer-than-current** schema versions
  silently and never rewrites `schemaVersion` (no-op); `loadLedger` accepts
  structurally-invalid JSON (no shape check, unlike `importLedger`).
  (`ledger.ts:236,238,181`)
- **wipe-diagnosis sim**: `bench_swap` and `tradeoff` fixes project **unhalved
  gear** — the #109 fix landed only on the gear lever. (`wipe-diagnosis.ts:165`)

---

## 6. What is genuinely solid

4 seams passed clean (0 findings, guard **enforced**), and 11 seams have guards
that truly enforce their contract:

- **Solid, zero findings:** `card-axes` (grade vs Recorded never blur),
  `access.ts` milestone normalization + attunement monotonicity,
  `cartridge-digest-envelope`, `bundled-cartridge-golden-digests`.
- **Enforced guards:** the above + `vendored-engine-drift-guard`,
  `deriveHallView`, `encounter-compile-agency-staging`,
  `proximity-adjacency-walkable`, `playable-world-acceptance`,
  `theme-select-neutral-default`, `compat-refusal`.

The core memory/identity axioms the constitution rests on — digest stability,
attunement monotonicity, the grade-vs-Recorded split, engine-drift detection —
are the best-guarded surfaces in the codebase. The rot is concentrated in the
**engine economy/character math** and in **guard quality**, not in the
platform's spine.

---

## 7. Recommended triage order

1. **Fix §3.1 (recruitment top-tier)** — wrong for 100% of shipped content; and
   its guard is vacuous. High.
2. **Fix §5.1 (trust self-claim) before the packaging lane** — cheap now, a
   trust hole later. It is the Article-2 seam the roadmap's next lane leans on.
3. **Fix §3.2 / §3.3 (industrious double-apply, ledger in-place mutation)** —
   small, self-contained, mirror existing patterns.
4. **Sweep the economy trio (§5.2)** — pay-before-gate + negative/unbounded
   balances are a conservation problem in the ABI-critical engine.
5. **De-vacuum the top guards** — start with a **frozen PRNG golden vector**
   (§4), `second-lockout` conformance coverage, and turning the "recorded",
   "monotonic", "single-helper", and "no-negative-balance" contracts from
   substring/`typeof` checks into behavioral assertions. Every de-vacuumed guard
   in §4 should be paired with the matching §5 fix so the test would have caught
   the bug.

None of this touches the vendored engine surface without landing in axm-arc
first (RECONCILIATION contract). The three engine bugs (§3.1, §3.2, §5.2) are
**axm-arc changes**; the world-side items (§5.1, §5.3, two-surface divergence)
are **axm-world changes**.

---

## Appendix — seam health table

`concerning` = has a confirmed/real bug; `partial` guard = passes but under-tests
the contract; `enforced` = guard actually protects the contract.

| health | guard | findings | seam |
|--------|-------|---------:|------|
| concerning | partial | 5 (1 hi) | character-model |
| concerning | partial | 2 (1 hi) | commit-flow / advance-blockers |
| concerning | partial | 2 | escalation-signal |
| minor-gaps | partial | 3 (1 hi) | recruitment |
| minor-gaps | partial | 4 | economy / resource-spend |
| minor-gaps | partial | 4 | stress-morale |
| minor-gaps | partial | 4 | engine-save / ledger-migration |
| minor-gaps | partial | 4 | drama-triage |
| minor-gaps | partial | 4 | pixel-ui ↔ gameplay integration |
| minor-gaps | partial | 4 | program-001 controlled-object loop |
| minor-gaps | partial | 4 | engine-grammar coverage |
| minor-gaps | partial | 4 | guild-hall |
| minor-gaps | partial | 4 | carry-forward / gear-memory |
| minor-gaps | partial | 4 | fairness-loot / one-more-pull |
| minor-gaps | partial | 5 | designer-edit / storage |
| minor-gaps | partial | 3 | resolver / runCycle |
| minor-gaps | partial | 3 | rewards |
| minor-gaps | partial | 3 | strategy-board turn machine |
| minor-gaps | partial | 3 | cartridge-conformance |
| minor-gaps | partial | 3 | import/export + single validator |
| minor-gaps | partial | 3 | workshop author round-trip |
| minor-gaps | partial | 3 | gate-parity |
| minor-gaps | partial | 3 | evaluateParty / readiness |
| minor-gaps | partial | 3 | summarizeLedger |
| minor-gaps | partial | 3 | mobile-play-flow |
| minor-gaps | partial | 3 | resource-spend-projection |
| minor-gaps | partial | 3 | asset-standard |
| minor-gaps | partial | 2 | schema.ts is law (#115) |
| minor-gaps | partial | 2 | precedents-relationships |
| minor-gaps | partial | 2 | engine-integration |
| minor-gaps | partial | 2 | projections-stability |
| minor-gaps | partial | 2 | cartridge-library custody |
| minor-gaps | partial | 2 | expansion-archive |
| minor-gaps | partial | 2 | consequence-honesty / failed-lockout |
| minor-gaps | partial | 2 | tab-badges |
| minor-gaps | partial | 2 | sim-harness |
| minor-gaps | partial | 2 | arc-ledger-migration |
| minor-gaps | partial | 2 | deriveWorldMap |
| minor-gaps | partial | 2 | cartridge-bay custody/identity |
| minor-gaps | partial | 2 | board-map-hall one-route |
| minor-gaps | partial | 2 | world-save / presentation-prefs |
| minor-gaps | partial | 2 | platform-constitution |
| minor-gaps | partial | 1 | difficulty-mode-choice |
| minor-gaps | partial | 1 | prng-codepoint-determinism |
| minor-gaps | partial | 1 | structured-consequence-record |
| minor-gaps | partial | 1 | generic-appliance-boot |
| minor-gaps | partial | 1 | i18n-locale (arc) |
| minor-gaps | enforced | 4 | (assorted enforced-guard seams w/ minor notes) |
| minor-gaps | enforced | 3 | proximity / adjacency / walkable |
| minor-gaps | enforced | 2 | encounter compile/agency/staging |
| minor-gaps | enforced | 2 | playable-world acceptance |
| minor-gaps | enforced | 2 | theme-select neutral default |
| minor-gaps | enforced | 2 | compat-refusal |
| minor-gaps | enforced | 1 | vendored-engine-drift-guard |
| minor-gaps | enforced | 1 | deriveHallView |
| solid | enforced | 1 | bundled-cartridge golden digests |
| solid | enforced | 0 | card-axes |
| solid | enforced | 0 | access.ts milestone/attunement |
| solid | enforced | 0 | cartridge-digest envelope |

*Generated by a 62-agent seam-QA sweep (59 auditors + 3 verifiers), 2026-07-13.
Findings are anchored to file:line in the audit journal; nothing here was
executed against production data.*
