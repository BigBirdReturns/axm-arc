# RFC: Tier-2 guild persistence — memory across raid cartridges

**Status: Proposed — no code until this RFC is accepted (owner-gated).**

Triggered by the Raid Night v0 playtest (`docs/playtests/raid-night-v0.md`),
which passed on the immediate loop and named the first missing desire exactly:
*"remember what this night did to the guild."* Not "explain the wipe better" —
that surface is legible. The gap is memory.

## The question this answers

**What must the guild remember across raid cartridges so that a clear feels
like organizational history rather than a reset?**

## The one insight that keeps this small

Today's Raid Night already builds a fresh roster from the cartridge on every
session (`buildStartingOrg` → `buildStartingRoster`, `src/game/lib/raid-night.ts`).
That is **persistence with a null ledger.** Tier-2 does not rewrite the loop; it
swaps the roster's *source* from "generated for this cartridge" to "hydrated
from a guild ledger, then generated for whatever the ledger doesn't cover." The
current slice is the degenerate case of the design below. That continuity is the
reason this is an evolution, not a second engine.

## Invariants every option must hold (the laws, restated for this RFC)

- **No engine change.** Persistence lives *above* the engine, in the game layer
  (`src/game/`, `src/sim/`), exactly where `raid-night.ts` lives now. The engine
  still only resolves an `Organization` against a `Challenge`. Atlas rule #1
  holds; the vendored surface (`src/engine`) is untouched, so world does not
  drift.
- **Compatibility is computed, not claimed.** Two cartridges are
  *campaign-compatible* iff their `{roles, attributes, tiers}` vocabularies
  match — a pure function of existing cartridge data (like `cartridgeDigest`).
  No new schema field. This echoes the constitution's "identity is computed, not
  claimed." A cartridge with no compatible profile is simply standalone-only
  (plays with a generated roster — today's behavior).
- **Determinism.** A run is `f(ledger snapshot, cartridge, seed)`. The ledger
  mutates only on an explicit **commit** after the night; during play it is a
  read-only snapshot, so a night replays exactly. Seeded PRNG, codepoint
  compare, no wall-clock in engine paths — unchanged.
- **Old cartridges always boot; old ledgers always migrate.** (Constitution
  articles 5 and 3.) The cartridge is read-only content addressed by digest; the
  ledger is a separately-versioned save with forward-migrations.

## What must persist (the ten objects)

The guild is essentially the runtime `Organization` plus campaign metadata. Most
of these fields already exist on `Agent`/`Organization` today — persistence is
recording and rehydrating them, not inventing them.

| # | Object | Lives in | Notes |
|---|---|---|---|
| 1 | Guild identity + campaign record | ledger header + campaign log | name, crest, legacy level; per-tier {digest, cleared, grade, dates} |
| 2 | Agent identity/role/attributes/traits/morale/stress/loyalty/growth | ledger roster (the `Agent` objects) | already on `Agent`: attributes, traits, morale, stress, `hiddenAttributes.loyalty`, `assignmentHistory` (growth) |
| 3 | Gear ownership + equipped | agent `equippedItems` + guild inventory | items are cartridge-scoped; see carry-forward policy (open Q1) |
| 4 | Loot history + fairness memory | ledger loot log + fairness metrics | from `rewardHistory` + a distribution record; fairness feeds drama |
| 5 | Pull history: wipes, clears, best pull, boss scars | campaign record, digest-keyed | `{pulls, wipes, cleared, bestPull, scarsEarned}` per cartridge |
| 6 | Drama, grudges, precedents, resolved disputes | `org.precedents` + `relationships` + `dramaQueue` | already engine state; persisted verbatim |
| 7 | Bench history + attendance/reliability | derived per agent from `assignmentHistory` | stored as rolled-up per-agent stats |
| 8 | Raid-tier progression gates | campaign record (computed) | which tiers unlocked = f(cleared tiers, readiness metrics) |
| 9 | Carry-forward rewards and costs | scars, legacy points/perks, reputation; grudges, morale debt | the **cartridge-agnostic** modifiers — the honest carry (see below) |
| 10 | *(What must NOT persist — next section)* | — | — |

**The carry-forward principle (object 9, the load-bearing one).** Raw
tier-1 gear must not become raw power in tier-2 — a tier-1 sword in a tier-2
economy would be either meaningless or broken, and it would leak one cartridge's
vocabulary into another's balance. Instead, **capability carries as the guild's
people** (their attributes/traits/growth, which are the guild's own data) and
**consequence carries as cartridge-agnostic modifiers** (scars = bounded buffs
with a stated cost, legacy/reputation, precedents). This is the mockups' "Scars
& Legacy" made principled: the guild is stronger in tier-2 because its *people*
grew and it *earned* scars, not because it's holding tier-1 loot. Gear itself is
ledger-recorded and re-equippable only where its item id exists (a shared item
pool within a campaign); across incompatible pools it converts to nothing —
capability already carried through the people.

## What must NOT persist

- **Per-pull RNG and roll outcomes.** Each pull re-rolls from the seed; only the
  *summarized* result (pass/fail, scores) is recorded. Storing rolls would let a
  save contradict a re-derivation.
- **The wipe diagnosis.** It is derived per-attempt and stateless (noted in
  `src/sim/wipe-diagnosis.ts`); it is recomputed, never stored.
- **Cartridge content.** Bosses, checks, economy, items-as-authored — never
  copied into the save. The save references the cartridge by digest; the content
  stays read-only. This is what keeps the cartridge replayable standalone.
- **Ephemeral UI/loop state** — `fixApplied`, `receipt`, `pullDelta`, the
  current party selection. Rebuilt each session.
- **Wall-clock as truth.** "Campaign days" may be *displayed* if a timestamp is
  passed in, but no gate or resolution may depend on real time — the schema has
  no wall-clock and the engine paths stay clock-free.
- **Another guild's data.** One ledger, one guild; no ambient cross-save state.

## The three architectures

### A. One campaign save wrapping many cartridges
The `CampaignSave` is the top object: it *contains* the guild state and
*references* the cartridges played, plus the progression record. Entering a tier
loads the cartridge by digest and hydrates the org from the campaign's guild
state.

- **Determinism:** good — snapshot the guild state at tier entry; the run is
  reproducible from it. But guild mutation and campaign record are entangled in
  one object, so "replay this night" means carefully sub-snapshotting.
- **Old cartridges:** untouched (referenced by digest, never mutated). Standalone
  replay works — load the cartridge with no campaign.
- **Migration:** the campaign save owns a schema that *embeds* the guild state;
  one migration surface, but a large one (the whole org lives inside it).
- **Boundary:** the guild's people are data inside the campaign; campaign chrome
  (gates, readiness) is app chrome. Holds, as long as the save stores agents as
  verbatim data.
- **Enterprise pruning:** workable but the guild is *owned by* a "campaign" — a
  game concept. Pruning to "an org and its operating history" means unwrapping
  the guild from the campaign first.

### B. A guild ledger projected into each cartridge — **RECOMMENDED**
The `GuildLedger` is the independent source of truth: the roster, growth, gear,
grudges, precedents, campaign record. It belongs to no cartridge. Entering a
cartridge **projects** the ledger into a fresh `Organization` for that cartridge
(identity-mapped when the vocabulary profile matches; topped up with generated
agents for any roster slack, exactly as `buildStartingRoster` does now).

- **Determinism:** clean — projection is a pure function of `(ledger snapshot,
  cartridge)`; the run is `f(projected org, cartridge, seed)`. The ledger is
  read-only during the night; **commit** after.
- **Old cartridges:** untouched. Standalone replay = **project a null ledger**,
  which is literally today's `newRaidNight`. The cartridge never contains guild
  state, so it is always independently valid and replayable.
- **Migration:** the ledger is a single, focused, versioned schema; the
  projection layer tolerates cartridges missing fields. Cartridges migrate
  independently via `validateArc`. Two *small* surfaces instead of one large.
- **Boundary:** cleanest. The ledger holds the guild's **people** (data,
  verbatim). The cartridge holds **bosses/economy** (data). The projection maps
  ledger agents into the cartridge's roster vocabulary; when profiles match it is
  identity. Chrome (readiness, gates, "carry-forward") is app-layer, translated.
- **Enterprise pruning:** best. The ledger *is* an org's persistent operating
  record, independent of any campaign; projecting it into cartridges is exactly
  "run this org against these engagements." Operations Night is this option with
  the vocabulary swapped — the ledger is domain-agnostic by construction.

### C. A cartridge chain where each completion emits the next starting state
Tier-1 completion emits an export (its ending org) that becomes tier-2's import;
a linked list of save-states.

- **Determinism:** each link deterministic given its input; replaying the chain
  needs every link's starting snapshot.
- **Old cartridges:** untouched, and tier-1 replayable from a fresh start — but
  the emitted state bakes the guild into a snapshot the cartridge doesn't own.
- **Migration:** **brittle.** Every stored link is an org-schema snapshot; a
  schema change forces migrating the whole chain. Worse, "emit the next starting
  state" couples tier-1's completion to tier-2's expected input shape — tier-1
  must know about tier-2, breaking cartridge independence.
- **Boundary:** at risk — the emitted state can leak the next cartridge's
  vocabulary back into the previous one's completion.
- **Enterprise pruning:** weakest — a chain of snapshots is not a queryable org
  history; an operating record wants a ledger, not a save-file relay.

## Comparison

| | A — campaign save | B — projected ledger | C — cartridge chain |
|---|---|---|---|
| Determinism | good (entangled) | **clean (pure projection)** | good (needs every link) |
| Old cartridges safe | yes | **yes (null-ledger = today)** | yes, but coupled |
| Migration | one large surface | **two small, focused** | brittle (whole chain) |
| Vocabulary boundary | holds | **cleanest** | at risk (leak) |
| Enterprise pruning | needs unwrapping | **native** | weakest |
| Continuity w/ current slice | moderate rewrite | **drop-in seam swap** | rewrite |

## Recommendation: **B, the projected guild ledger.**

Because it is the only option where the current slice is already the null case —
the tier-2 build is "replace the roster source at `raid-night.ts:71` with a
projection from a ledger, falling back to generation." Standalone replayability
isn't engineered; it *falls out* (a cartridge with no ledger is a fresh guild).
The determinism story is a pure function. And it is the cleanest path to the
enterprise pruning the family is ultimately aiming at, because the ledger is an
org record that happens to be playing raids, not a raid save that happens to
contain an org.

Its honest weakness: **projection across mismatched vocabularies is unsolved
here** and deferred to the compatibility contract (open Q2). B works cleanly only
within a *campaign* — a set of cartridges sharing a `{roles, attributes, tiers}`
profile (same classes, harder bosses). That is exactly how raid tiers actually
work, so the constraint is honest rather than limiting; but it must be stated,
not hand-waved.

## How B meets the acceptance criterion

*The same guild clears tier 1, carries its people and consequences into tier 2,
and tier 1 stays replayable as a standalone cartridge.*

1. **Clear tier 1.** Play `cart-1` with a ledger (fresh or existing). On the
   commit moment, write consequences to the ledger (agent growth, scars,
   precedents, morale/loyalty shifts) and record the tier in the campaign log
   (digest, grade, pulls, best pull).
2. **Carry into tier 2.** Entering `cart-2` (compatible profile) projects the
   ledger's roster + carried scars/reputation/precedents into `cart-2`'s
   starting org. The guild that walks into tier 2 is the one that walked out of
   tier 1 — same people, grown, carrying what they earned and what they owe.
3. **Tier 1 stays standalone.** `cart-1` is read-only content addressed by
   digest; loading it with a null ledger plays a fresh guild — today's behavior,
   unchanged and forever valid. The cartridge never contained the guild, so
   nothing about the campaign can corrupt it.

## Open questions for the owner (decide before code)

- **Q1 — gear carry-forward.** Recommend: capability carries via *people*;
  consequence carries via *scars/legacy* (cartridge-agnostic); literal gear
  re-equips only within a shared item pool. Confirm, or specify a conversion.
- **Q2 — vocabulary-incompatible cartridges.** Recommend: standalone-only (no
  projection). Alternative (defer to a later RFC): cartridge-authored attribute
  mapping. Confirm the deferral.
- **Q3 — the commit moment.** When does the night write the ledger — on *clear*
  only, on *Call It a Night*, or on any pull? Recommend: an explicit
  end-of-night commit ("the night is won, the consequences remain"), so the
  ledger mutates once per night, deterministically.
- **Q4 — ledger custody.** Which repo owns the ledger schema, and does world's
  digest-keyed save become the ledger's cartridge-record layer? (Reconciliation
  question; the ledger is game-layer either way.)

## Enterprise pruning note (why this is the right long bet)

Under B, the ledger is an organization's persistent record — roster, capability,
history, obligations — and a cartridge is a bounded engagement it runs against.
Swap the vocabulary (raid boss → milestone, loot → promotion/budget, scar →
carried operational debt) and the ledger *is* Operations Night's "Guild Memory /
Campaign Save." Nothing about B is raid-specific; the raid is the fun instance
that proves the org record works. The grammar rule does the pruning for free.

*No code lands against this RFC until it is accepted. On acceptance, update
`docs/GUILD_CAMPAIGN.md` and axm-genesis `docs/CONTINUITY.md`'s index in the same
change.*
