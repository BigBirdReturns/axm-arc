# Karazhan balance simulation report

**Date:** 2026-07-03 · **Harness:** `src/sim/karazhan-autoplay.ts` ·
**Command:** `npm run sim:karazhan` (or `npx vite-node src/sim/karazhan-sim-cli.ts -- --seeds N --max-cycles A,B [--heroic]`)

The question this answers: **is Karazhan finishable, where do runs stall, and
is the authored curve sane?** All numbers below come from the real engine —
`runCycle` resolution, `challengeAccess` gating, real attunement stamping,
real loot, drama, reputation, and tier unlocks. No gate is bypassed:
across every sweep in this report, **gate violations = 0** (asserted by the
harness per assignment and enforced by `tests/sim/karazhan-sim.test.ts`).

## Method — autoplay policy v0

Deterministic (seeds 1..N; no wall-clock, no unseeded randomness):

1. Resolve every pending drama card by its first option.
2. Loot, per the spec's "loot to unblock the next challenge" rule: if the
   item is an attunement-chain step, route it to an eligible agent who
   already satisfies the chain's other steps, so acquiring it opens what the
   chain gates (this is what a competent player does with the Blackened Urn —
   hand it to a key-attuned raider). Otherwise, give it to the eligible agent
   whose role most weights the item's biggest bonus. Engine auto-equips.
3. Target the lowest-wing uncleared challenge that is accessible.
4. Party: exhaustive search over legal combinations (roles + attunement gate
   checked per party). Prefer zero projected-fail checks; otherwise attempt
   the closest risky party if its worst margin ≥ −6, or after 4 consecutive
   training cycles.
5. All idle, non-downed agents train every cycle.
6. **Not modeled:** recruitment, facility upgrades, re-clear farming, tier
   promotion. Gold accumulates unspent — reported, not hidden.

Policy limitations are part of the result: a smarter player outperforms v0,
so v0 clear rates are a *floor*, not a ceiling.

## Results — base difficulty

| Sweep | Clear | Stall | Out of cycles | Gate violations |
|---|---|---|---|---|
| 30 seeds × 25 cycles | **7%** | 0% | 93% | 0 |
| 30 seeds × 40 cycles | **23%** | 0% | 77% | 0 |

Median cycle each wing's required encounters cleared (40-cycle sweep):

| Wing | Name | Median clear cycle |
|---|---|---|
| wing-1 | The Servants' Quarters | 4 |
| wing-2 | The Opera House & the Menagerie | 16 |
| wing-3 | The Broken Stair | 18 |
| wing-4 | The Spire | 21 |
| wing-5 | Beyond the Tower | 31 |

Attunement/gate timings (medians): first Master's Key **cycle 5**, half-raid
keyed **cycle 5** (the whole party clears together, so the key arrives as a
raid, not per-agent) · Blackened Urn: **never acquired** · Nightbane access:
**never** (see Finding 1).

Attempt outcomes across all 30 × 40-cycle runs (success/partial/failure):

| Encounter | S | P | F | Read |
|---|---|---|---|---|
| attumen | 30 | 52 | 0 | fine — early risky, clears |
| moroes | 30 | 59 | 0 | grindy but clears |
| maiden | 30 | 18 | 0 | fine |
| **opera** | 30 | **210** | 0 | partial mill — worst mid-game drag |
| curator | 30 | 26 | 0 | gate works; fight fine once keyed |
| chess | 26 | 61 | 0 | grindy |
| illhoof | 29 | 44 | 0 | acceptable |
| aran | 29 | 12 | 0 | fine |
| netherspite | 28 | 18 | 0 | fine |
| prince | 27 | 11 | 0 | fine |
| **nightbane** | — | — | — | **never attempted in any run** |
| maulgar | 27 | 6 | 0 | fine |
| gruul | 26 | 11 | 0 | fine |
| **magtheridon** | 7 | **215** | 0 | partial wall at the finish line |

Median unspent gold at run end: **830–1040** (economy generates a large
surplus mid-game that v0 has nothing to spend on).

## Results — heroic from a fresh roster

30 seeds × 40 cycles, every assignment on `heroic`: **0% clear**, wing-1
median clear at cycle **32**, attumen 28 successes / **869** partials.
Heroic is not an early-game mode; it is working as an aspirational
post-growth mode. No change recommended — but the shell could someday
recommend against it pre-growth.

## Findings

1. **BUG — Nightbane is unreachable content.** The Blackened Urn drops from
   Prince Malchezaar (27 successes across the sweep) but was **never
   claimed once**: `evaluateLootEligibility` gates items on agent tier, the
   urn (and all wing 4–5 loot) is authored `elite`/`champion`, the starting
   roster tops out at `veteran`, and **no tier-promotion mechanic exists in
   play**. Consequence: the urn chain can never complete, Nightbane can
   never be summoned, and late-game gearing contributes nothing (agents
   grow only via Training). This is authored-content-assuming-a-mechanic-
   that-doesn't-exist, not a taste question.
2. **Partial mills at opera and magtheridon.** Both are role-check-bound:
   opera's Stage Direction (support, threshold 13) with only two support
   agents, and magtheridon's Cube Discipline (support, 16) plus a
   10-per-agent burn check. Successes eventually land (the engine's
   variance gets there) but the expected value is a slog: 7 mills per
   success at opera, 30 at magtheridon.
3. **The campaign is finishable and gate-sound.** 0 hard stalls, 0
   impossible gates besides Finding 1, curator's key gate opens exactly as
   authored (whole-raid keying at wing-1 completion is elegant in practice).
4. **`meta.estimatedCycles: 25` is wrong.** Observed median completion is
   beyond 40 cycles at v0 skill. 25 cycles yields a 7% clear rate.
5. **Unused economy.** ~1000 gold accumulates with no sink in v0 (no
   recruits/upgrades modeled). If upgrades/recruiting are intended as the
   growth levers, the sim's Training-only growth still finishing 23% of
   runs suggests the curve is close once Finding 1–2 are addressed.

## Recommendation

Per the menu: **tune thresholds (small), tune loot tiers (bug fix), tune
cycle budget; no reward tuning; no roster-seed change; engine support
optional.**

Applied in this PR as a separate, clearly-labeled tuning commit:

- **Fix Finding 1 (bug):** retier the wing 4–5 *dropped* items to
  `veteran` so a grown starting roster can claim them. The `elite` /
  `champion` ranks stay in the arc (designer + future recruits); only drop
  eligibility changes. Alternative considered and deferred: a tier-promotion
  mechanic (engine feature — bigger than a balance pass).
- **Soften the two partial mills:** opera Stage Direction 13 → 12;
  magtheridon Cube Discipline 16 → 15 and channeler burn 10 → 9.
- **Fix Finding 4:** `estimatedCycles` 25 → 40.

Explicitly NOT done: reward changes, roster seed changes, heroic changes,
any engine change.

## Post-tuning verification

*(Numbers from re-running the identical sweeps after the tuning commit.)*

*(Identical sweeps, seeds 1..30, after the tuning commit — clean `.ts` runs,
no stale compiled artifacts.)*

| Sweep | Clear | Stall | Out of cycles | Gate violations |
|---|---|---|---|---|
| 25 cycles | 0% | 0% | 100% | 0 |
| 40 cycles | **13%** | 0% | 87% | 0 |

Attempt outcomes (30 × 40-cycle), the encounters the tuning touched:

| Encounter | Pre S/P | Post S/P | Effect |
|---|---|---|---|
| opera | 30/210 | 30/147 | mill softened ~30% |
| magtheridon | 7/215 | 4/283 | still the wall (see below) |
| **nightbane** | never attempted | **26/27** | now reachable — the bug is fixed |

- **Finding 1 fixed and verified.** With the wing 4–5 drops retiered to
  `veteran`, the Blackened Urn now drops (median cycle 21), the urn-bearer
  chain completes, Nightbane access opens the same cycle, and Nightbane is
  attempted and cleared in **26 of 30** runs (was 0). No authored content is
  unreachable anymore. *Note:* this depends on the loot policy routing the
  urn to a key-attuned raider — the sim does this deliberately (a competent
  player does too); role-weight-only routing reaches it far less often. This
  is a second-order lesson, not a content bug: **a gate item is only as
  reachable as the reward decision that routes it.**
- **Opera mill softened**, 210 → 147 partials per 30 clears.
- **`estimatedCycles` corrected** to 40.
- **Magtheridon remains the wall** and is now a *design decision, not a bug*:
  4 successes / 283 partials. The overall clear rate moving 23% → 13% is not
  a regression — it is the honest cost of the autoplayer now spending cycles
  on the optional Nightbane it can finally reach, plus routing the low-stat
  urn for gating rather than gearing. The final boss dominates completion.
  Two defensible readings, left to the owner: (a) an epic multi-cycle grind
  finale is *appropriate* for a raid's last boss — ship as is; or (b) it
  should fall to a v0-skill roster inside 40 cycles, which needs either a
  channeler-burn softening or one of the growth levers the sim does not model
  (facility upgrades, elite recruitment). **Recommend playing wing 5 once by
  hand before any further magtheridon change** — the sim can't see the levers
  a real player has.
- Attunement pacing after tuning: first key cycle 5, half-raid cycle 5, urn
  cycle 21, Nightbane access cycle 21 — the two-chain design works exactly as
  authored.

## Reproduce

```bash
npm run sim:karazhan                       # 30 seeds at 25 and 40 cycles
npx vite-node src/sim/karazhan-sim-cli.ts -- --seeds 30 --max-cycles 40 --heroic
npx vitest run tests/sim/karazhan-sim.test.ts
```
