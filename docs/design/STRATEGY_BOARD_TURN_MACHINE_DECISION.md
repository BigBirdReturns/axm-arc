# Strategy Board Turn Machine — Decision Memo

**Current status ? 2026-09-13:** bounded first deterministic executor implemented
in `src/engine/strategy-board/executor.ts`, with behavioral and generated-sequence
property tests in `tests/engine/strategy-board-executor.test.ts`. This is generic
Strategy Board execution, not a Program-of-Record port or a shipped game.

The original scaffold and mini fixture remain available. `initialStrategyState`
produces the original **structural preview**; its choices are not an execution
admission claim. `initialStrategyExecutionState(def, seats, rules)` validates the
supported subset and creates an executable state. `listLegalActions` on that
state delegates to the executor's affordability, location, ownership, and
reaction gates. Use executable states for any future player-facing choices.

### Bounded execution contract

- Execution rules are explicit version-1 companion data (`StrategyExecutionRules`),
  held in run state. They supply the starting space, adjacent-destination input
  mode, obligation-to-doctrine assignments, reaction limit/effect semantics, and
  ordered ending predicates. They are **not yet a cartridge schema extension or
  a custody/save format**. Definition changes during a run are rejected.
- `advanceStrategyPhase` handles resolver phases; `applyLegalStrategyAction`
  handles choices. Both return independent state copies. Failed transitions
  preserve the input state and ledger. `replayStrategyInputs` reconstructs a run
  from its definition, seat order, execution rules, and ordered inputs.
- A quarter is one round of seats. Each seat receives its owned-asset income
  before assigned obligations at its quarter start. Obligations run through their
  authored term, inclusive. No debt, partial payment, or bankruptcy is invented:
  an unpayable transition rejects. Safe integer resource units are required.
- Movement consumes an explicit adjacent destination; no dice, path selection,
  start-crossing reward, or hazard effect is inferred. Landing settles the exact
  authored toll with both debit and owner credit, only for a non-owner occupant.
- Only an unowned asset at the active seat's location can be bought or auctioned.
  Purchases pay the authored list price. Auctions consume explicit bid inputs;
  ascending bids start at the minimum increment, rise by at least that increment,
  and alternate bidders. Sealed bids allow one bid per seat, with seat-order ties.
  The highest bidder pays its bid; losing seats pay nothing. Empty bids mean no
  sale. Bid validity includes ability to pay. No random choice is needed.
- Exactly one permitted, affordable program action executes per turn. Supported
  targets are self/none; costs and effects mutate the active seat. An empty legal
  menu blocks progression rather than inventing a free action.
- Non-active seats react once each in cyclic seat order, by interference or pass.
  Interference must name the action actually taken. Its costs debit the reacting
  seat; explicit effect mutations apply to the active seat after the program's
  effect. No cancellation or yield reduction is inferred from summary text.
- Milestone eligibility uses a pre-reward snapshot, evaluates the active seat,
  and locks/rewards each milestone once. Ending rules conjunct their explicit
  milestone ids and optional minimum quarter; authored rule order arbitrates
  simultaneous matches. Ending unlocks must correspond to those predicates.
  An ending emits once and immediately makes the run terminal. No subsequent
  phase/action is accepted, and no score or winner is inferred from scoring notes.
- All resource changes pass through a single ledger-writing seam. Ordered
  receipts record bids, purchases, passes, actions, interference, milestones,
  endings, and phase execution, with ledger offsets for correlation. The input
  sequence plus emitted state/ledger is deterministic, without clock or RNG.

**Rejected/deferred:** hazards; fixed initial ownership; non-owner asset effect
scopes; space/asset/seat-target program semantics; empty prose-only interference;
non-ending unlocks; fractional/unsafe amounts; implicit obligation assignment or
ending predicates. The mini fixture intentionally remains schema-only because it
contains several of these unresolved behaviors. CPU/personality, UI/World,
scoring, save admission, cartridge custody, and a full reference campaign remain
unimplemented. Do not claim this executor proves those layers.

**Verification scope:** executor tests cover deterministic replay and ledger
reconciliation across generated multi-turn sequences; legal-action soundness and
atomic rejection; purchase and auction payment/ownership; toll symmetry;
interference limits/recording; income/obligation order and expiry; monotonic
milestones and once-only terminal endings. Typecheck passes. All 42 Strategy Board
tests pass (12 executor and 30 existing schema/scaffold tests). The full Arc run
before the final two executor edge-case tests produced 117 passing files / 920
passing tests and 2 failing files / 7 failing tests. These seven failures are
existing subprocess checks in `tests/release/supply-chain.test.ts` and
`tests/clean-room/creator-recovery-kit.test.ts`; a direct Node spawn probe returns
`status: null, error: EPERM` in this sandbox. They remain unverified.

Ordinary Vitest startup also hits esbuild `spawn EPERM`. Verification used a
temporary programmatic Vitest runner with the same includes/environment, a single
thread pool, `configFile: false`, `esbuild: false`, `preserveSymlinks: true`, and a
TypeScript `transpileModule` pre-transform (ES2022/ESNext). No tests were excluded
or assertions changed. No emitted source shadows existed; the tracked,
hand-authored declaration file was preserved. Standard CI still needs an
environment that permits subprocesses.

### Historical scaffold decision

The sections below preserve the original non-executing scaffold decision. Their
?future?, ?not included yet?, and ?no resolution? statements describe that earlier
artifact; the current execution boundary above supersedes them.

Companion documents:
- axm-world `docs/runtime/STRATEGY_BOARD_RUNTIME_PROPOSAL.md` — the family proposal.
- `src/engine/strategy-board/{types,schema}.ts` — the authored-data schema (Phase 1).

> **Scope guard.** This memo governs the turn machine's *interface and
> invariants*, not its *resolution algorithms*. The algorithms (how an auction
> settles, how interference blunts an action, how income/tolls/obligations post)
> are deferred to the implementation step and are property-test-gated (§7).

---

## 1. Phase order

The turn advances through exactly these phases, in this order, per active seat:

1. **quarterStart** — advance the clock; post asset income; settle due
   obligations; refresh per-turn budgets. *(resolver-driven; no player choice)*
2. **movementResolution** — the active seat moves; the landed space resolves
   (toll owed, buy prompt, hazard). *(resolver-driven; movement input is a later
   concern, out of this scaffold)*
3. **buyAuctionPass** — acquire at list price, enter an auction, or pass.
   *(player choice)*
4. **programAction** — take exactly one doctrine-and-resource-permitted action.
   *(player choice)*
5. **reactionInterference** — non-active seats may spend to interfere.
   *(player choice, by non-active seats)*
6. **milestoneAttempt** — evaluate milestone conditions; lock in rewards.
   *(resolver-driven; no player choice)*
7. **receiptLedger** — emit the turn receipt from the recorded ledger events.
   *(resolver-driven; no player choice)*

"Exactly one program action per turn" is a machine invariant; the *menu* of
actions is authored (schema). Phase presence and ordering are runtime; the
content resolved in each phase is authored.

## 2. Legal-action envelope

Player choices exist in **three** phases only: `buyAuctionPass`, `programAction`,
`reactionInterference`. The other four are resolver-driven and expose no choice.

A **legal action** is described by:

- `kind` — `programAction` | `auction` | `interference` | `pass`
- `refId` — the authored object's id (action/auction/interference), or `null` for `pass`
- `honoredByPhase` — the phase that will honor it (must equal the current phase)
- `resolver` — the **name of the future resolver** that will honor it (e.g.
  `resolveProgramAction`); a choice with no named resolver is not expressible
- `declaredMutations` — the resource cost the choice would incur, each a
  `ResourceLedgerMutation` carrying an `eventKind`

Gating is declarative and authored:
- `programAction`: the active seat's `doctrine.permittedActionIds` (doctrine gate).
- `buyAuctionPass` / `reactionInterference`: the authored auctions / interferences,
  plus `pass`.

`listLegalActions(def, state)` returns exactly the choices legal in the current
phase. It is **pure**: it reads the definition and state and returns a list; it
**mutates nothing** and **resolves nothing**.

## 3. Ledger-event model

Every resource change is a recorded ledger event; there are no implicit side
effects. Enforced two ways:

- **At the type level:** every `ResourceLedgerMutation` carries an
  `eventKind` (schema, Phase 1). A mutation with no event kind does not typecheck.
- **At the machine level:** the machine never mutates a balance except by
  emitting a `StrategyLedgerEvent` whose `mutations` are the change. The scaffold
  proves the negative: enumerating legal actions produces no state change at all.

The event kinds are the authored vocabulary: `income`, `purchase`,
`auctionSettlement`, `tollPayment`, `obligationSettlement`, `programActionCost`,
`programActionYield`, `interferenceCost`, `milestoneReward`.

## 4. Determinism requirement

- **Deterministic initial state.** `initialStrategyState(def, seatIds)` is pure
  and seed-free: same inputs → byte-identical state (doctrines assigned by seat
  index, balances from `doctrine.startingResources`, all ownership null).
- **Deterministic resolution (future).** When resolution lands, all randomness
  (auction tie-breaks, hazard draws) must flow through the engine's seeded PRNG
  (`src/engine/prng.ts`), so a run replays byte-identically. No `Math.random`.
- **Deterministic enumeration.** `listLegalActions` is a pure function of
  `(def, state)`; identical inputs yield an identical list in a stable order.

## 5. Player choice vs. resolver-honored choice

- A **player choice** is an option surfaced to a seat in a choice phase
  (`buyAuctionPass` / `programAction` / `reactionInterference`).
- A **resolver-honored choice** is a player choice that names a resolver which
  will actually honor it. The sovereignty rule (see the proposal §6) is encoded
  in the shape: `listLegalActions` never emits an action without a `resolver`
  name and a matching `honoredByPhase`. A choice the runtime cannot honor is not
  listed — so no UI can offer a lever with no law behind it.

This is the strategy-board analogue of resource-spend's rule: *no authored lever
→ no UI; no resolver → no choice.*

## 6. What is explicitly NOT included yet

- **No resolution of any action.** No `applyAction`/executor. Nothing advances a
  phase, moves a seat, settles an auction, applies interference, evaluates a
  milestone/ending, or posts income/tolls/obligations.
- **No movement input model** (how a seat chooses/rolls movement).
- **No opponent driver / CPU personality.**
- **No world projection / UI.**
- **No shipped strategy-board content.**

The scaffold is limited to: the phase vocabulary, the turn-state type, the
legal-action type, deterministic initial state, and a pure `listLegalActions`
enumerator — plus tests.

## 7. Property tests required before implementation

These gate the *resolution* step (not this scaffold). Before any executor lands:

1. **Determinism** — same def + seed + input sequence → byte-identical run and
   ledger event stream; recorded runs replay.
2. **Ledger conservation** — no resource created/destroyed except by an authored
   rule; per-turn debits/credits reconcile; no balance change without an event.
3. **Legal-action soundness** — no seat can take an action not returned by
   `listLegalActions` for the current phase/state; "one program action per turn"
   holds.
4. **Auction integrity** — one owner at a well-defined price; no sub-increment
   win; no win a seat cannot pay; deterministic under seed.
5. **Ownership & toll correctness** — toll charged iff non-owner occupant; amount
   matches the schedule; debit and owner credit both recorded.
6. **Interference bounded & recorded** — only authored-interferable actions,
   within limits, every interference a ledger event.
7. **Milestone/ending monotonicity** — a locked milestone cannot silently
   unlock; an ending fires once; scoring deterministic.
8. **No-fake-agency** — a choice is listed iff the runtime honors it; no hidden
   cost; no ledger event without a cause.

The scaffold in this PR already satisfies the *enumeration-side* invariants of
(3) and (8): actions are phase-valid, illegal actions are rejected, enumeration
mutates nothing, and no action is listed without a named resolver.

## 8. Open questions — deferred to the implementation step (non-blocking)

None of these block the memo or the scaffold; they are resolution-time decisions
to settle when the executor is designed. Recording them so they are not lost:

- **Movement model** — dice, fixed step, or programmed route? Affects
  `movementResolution` only.
- **Auction format default** — english-ascending vs. sealed-bid as the baseline,
  and tie-break rule (seat order vs. seeded).
- **Interference window scope** — which non-active seats may react, and in what
  order, and whether reactions can chain.
- **Simultaneity** — are `programAction` and `reactionInterference` strictly
  sequential, or is there a resolution stack?
- **Obligation settlement order** vs. income at `quarterStart`.
- **Ending arbitration** — if two endings' conditions meet in the same quarter.

Because these are all *resolution* decisions and the scaffold resolves nothing,
they do not gate this step. They become the agenda for the executor's own
memo + property tests.

---

*Decision memo + non-behavioral scaffold. No resolution behavior is implemented.
The next artifact, when authorized, is the turn-machine executor — its own
memo + property tests (§7) — proposal-first and proven before any world surface.*
