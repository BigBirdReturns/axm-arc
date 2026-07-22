# STATUS — AXM Arc / World, 2026-07-13

**The "where exactly are we right now + what's next" artifact.** Re-readable
in any new session or by any agent picking up cold. Updated as state changes.

> Read alongside: `ROADMAP.md` (strategic frame), `RECONCILIATION.md` (the
> hub⇄world contract), `HOOK.md` / `BALANCE.md` / `SCALE.md` (design docs),
> `docs/DEPLOY.md` (pipeline), axm-world `docs/POSITIONING.md` (platform
> pitch).

---

## Current overlay — 2026-07-22

**Local-first product parity train:**

- Arc's authoring lane now has functional Roster, Items, Challenges, and Arc
  Designer sections, exact export, shared Workshop editing, and a visible
  role/check coverage audit.
- Godscar Forge now offers guided and exact-source modes over the same Pocket
  object, including identity, six pressures, evidence provenance, faction
  receipts, incompatible cast responsibilities, persistent consequences,
  playable beats, checks, and Story Physics.
- Entry, play, and standalone tools share persistent local sound and reduced
  motion controls, visible keyboard focus, mobile target floors, and contrast
  fallbacks.
- World carries the three bundled cartridges through the same full-campaign,
  custody, representation, responsive, and white-label visual parity contract.
- The second cartridge now ships as **The Waking Tower**: original names,
  fiction, steward copy, motifs, role art, and material treatment. The historical
  `karazhan` id remains only as a compatibility key for held runs.
- `<AttendedStamp>` is wired to accepted drama decisions, and all standalone
  creator/record surfaces expose the same sensory and localization controls.
- `product-parity.yml` and World's `bundled-parity.yml` make the completion
  boundary executable rather than rhetorical.

See `docs/PARITY_COMPLETION.md`.

---

## Previous current overlay — 2026-07-21

**Godscar creator foundation:**

- `godscar-pocket/1` turns the Codex's six-pressure Story Engine into a
  validated, creator-owned source object: pocket, controlling system, excluded
  actor, trigger, cost of resistance, and scale revelation.
- The source carries disciplined canon tiering, evidence provenance, faction
  receipts, five incompatible cast responsibilities, story-physics invariants,
  and persistent consequences. It compiles into an ordinary engine-1.2 Arc and
  remains embedded under `godscar.pocket@1`, so the cartridge can always yield
  its editable source.
- The Pocket Forge starts from a complete source rather than an empty page,
  validates, runs bounded exact-founding simulations, installs the compiled Arc,
  and exports both `.pocket.json` and `.arc.json`.
- The Kind Gods of Ilyon is the first reference source and cartridge: exact
  named cast, six playable beats, three progression tiers, and deterministic
  campaign completion from authored founding state.

See `docs/GODSCAR_POCKET_FORMAT.md` and the two Ilyon artifacts in
`cartridges/`.

---

## Previous current overlay — 2026-07-21

**Working change at the portability/game-completion boundary:**

- `axm-cartridge-run/v3` now carries the canonical Arc, exact engine save,
  unresolved engine choices, losslessly preserved namespaced runtime memory,
  and a deterministic integrity digest. The hub imports, restores, saves, and
  re-exports that object without dropping unknown World or future-player
  extensions.
- Hub persistence now reports rejected writes and exposes exact-run export as
  the recovery path. Active cartridge selection is digest-addressed; new
  bundled revisions install beside held revisions rather than rewriting their
  bytes.
- The First Charter is versioned to 1.2.0 and its authored founding roster,
  gates, and tier-two calibration now pass a complete six-challenge campaign
  acceptance sweep from authored founding state. The default run finishes
  within the stated ten-cycle estimate; the sampled multi-seed gate remains
  green with no access bypass or structural stall.

**Still required before the full claim closes:** World must consume the exact
v3 bridge, reunite guided entry with the reusable multi-representation runtime,
and complete production-shaped desktop/mobile and independent play evidence.

See `docs/PORTABLE_RUN_V3.md` and `docs/FIRST_CHARTER_ACCEPTANCE.md`.

---

## Previous overlay — 2026-07-13

The July 3 checkpoint below is retained as historical evidence, not current
head state. Since it was written:

- Arc shipped the Workshop round trip, Library custody work, digest/profile
  visibility, ledger, Guild Hall, Expansion Archive, CI floor, and six JSON
  proof cartridges with conformance coverage.
- World shipped the generic appliance/bay path, per-cartridge memory,
  digest-visible custody, and the proximity-gated inhabited Cellar slice with
  transformed-location export.
- The product ontology is now explicit: authored law, deterministic execution,
  representations, run memory, custody, and provenance are separate layers.
  The game remains the current shipping priority and reference proof.

**Current correctness queue, ahead of expansion:**

1. Finish First Charter cold onboarding and the full six-challenge campaign.
2. Import and resume the changed-run custody object; export alone remains
   one-way portability.

**Closed in the current working change:** open-pool recruitment now excludes the
highest authored tier for three-, four-, and five-tier arcs, including every
shipped JSON cartridge; World custody no longer calls a cleared location
`recorded` without a matching ledger entry. Economy admission is now checked
before capacity is charged; invalid token debits are refused; upkeep records
paid and unpaid amounts without persisting negative currency; Industrious is
applied exactly once; and the Arc assignment UI prevents capacity overcommit
while honoring zero-cost farm runs. Progression unlocks are now stamped into
the run record before and after each cycle, so later reputation loss cannot
re-lock a tier the holder already earned.

**Verification:** both repository gates are green after these changes. Arc:
typecheck + 59 Vitest files / 588 tests. World: strict engine drift against the
pinned Arc commit + typecheck + 81 Vitest files / 667 tests.

Library and Workshop are maintained foundations. Repair their correctness and
use them to support the game/custody loop; do not grow them as independent lanes
ahead of game completion.

---

## Product frame and current mandate

Arc is an authored-model, deterministic-decision, custody, and institutional-
record system. The checkpoints below use games because games expose whether the
schema is expressive, the runtime exact, the choices legible, the consequences
memorable, the artifact portable, and the ledger honest.

Current work must continue finishing the reference game and cartridges. The
broader AXM thesis never lowers that bar and never creates permission to replace
game completion with speculative enterprise UI. Every completion claim should
name the layer it proves: model expressiveness, execution, evidence, custody,
continuity, presentation, or game quality.

---

## ⬛ HISTORICAL CHECKPOINT — the cartridge-platform milestone (2026-07-03)

This section records the trust boundary as it stood on July 3. Everything in
§1–§2 was merged, tested, and verified live at that checkpoint. Everything in
§3 was explicitly unproven then. Use the current overlay above for today's
priority and status.

### 1. What exists now

**The end-to-end cartridge loop:**

```
author/select in hub (axm-arc)
  → export raw validated Arc JSON        (PR #29, exportArcToJson)
  → import in world (axm-world)          (world PR #17, cartridge bay)
  → validate + trust-label               (same vendored validateArc both sides)
  → boot                                 (bootstrapOrg → compile, arc-agnostic)
  → play through the same deterministic engine
```

**The gating layer, live** (PR #30): `engine/access.ts` (one canonical
derivation for milestone gates, attunement chains, progression tiers),
`engine/difficulty.ts` (modes as a pure challenge transform), `runCycle`
enforcement (locked challenges never resolve, never spend tokens),
attunement stamping (monotonic, onto the pre-existing `agent.attunements`).

**Two bundled proof cartridges** (PR #31):
- **The First Charter** — compact starter: 4 attributes, 3 roles, 3 tiers,
  6 challenges, 2 progression tiers, 1 attunement chain.
- **Karazhan** — raid-grammar stress cartridge: 5 attributes, 5 roles
  (tank/healer/melee/ranged/support), 5 rank tiers, 14 encounters across 5
  wings, 2 attunement chains (play-earned Master's Key; item-borne
  Blackened Urn), heroic difficulty mode, 10-raider deterministic roster.

**World at rule parity** (world PR #18): re-pinned to `axm-arc@35a4e2b`;
board status delegates to engine `challengeAccess`; locked cards render
milestone AND attunement reasons; difficulty-mode picker renders only where
authored; `engine:check` drift guard green.

### 2. What is proven (tests + live browser runs, with screenshots)

- Hub export → world import **round-trip**: `karazhan.arc.json` exported via
  the real download event, byte-validated, imported through world's shipped
  file input, booted, played. Also proven with a hand-authored Operations
  Lab reskin (world commit `d50bc8c`).
- Export of an **invalid** arc is blocked with per-path errors and fires no
  download (verified live with a corrupted library entry).
- **Curator gate**: locked until ≥50% of the party holds the Master's Key —
  behavioral tests (3 attuned raiders insufficient, 5 sufficient) + live
  screenshot showing `requires opera-cleared` and
  `attunement: The Master's Key (50% of party)` on the locked card.
- **Nightbane gate**: locked after prince-cleared until a key-attuned agent
  holds the urn — behavioral tests both sides; locked card + label verified
  live.
- **Heroic exposure**: picker present on Karazhan, absent on First Charter
  (live both ways); the transform itself is unit-tested and the runCycle
  plumbing test shows the mode-only mechanic actually runs.
- **No reskin**: a guard test asserts disjoint role vocabulary, distinct
  economies, wider progression between the two bundled arcs.
- **First Charter regression**: still plays end to end live (opening
  decision → run The Cellar → report). Its authored Veteran-of-the-Charter
  chain now really gates The Mine Collapse in BOTH hub and world — that was
  previously silent drift, now killed.
- Suites: axm-arc **284/284**, axm-world **350/350**; typecheck + build
  green in both; world `engine:check` green at the pin.

### 3. What is NOT proven — do not claim these

- **Karazhan campaign balance.** Nothing past wing 1 has been played. Wing
  3–5 reachability, economy pacing over ~25 cycles, and soft-lock risk are
  unmeasured. (A simulation harness is the queued fix — Tier A.)
- **The Nightbane/urn path in live UI.** Proven by state-injected tests and
  locked-card rendering; no one has actually farmed the urn and summoned
  him through the UI.
- **Heroic resolution across a campaign.** Picker + transform + one-run
  plumbing proven; no multi-encounter heroic playthrough.
- **IP-safe naming.** "Karazhan", the boss names, and "Violet Eye" are
  Warcraft IP. Fine as a private proof cartridge; **must be renamed/reskinned
  before anything public or commercial.** Open owner decision.
- **Theme-sheet visuals.** Encounter ids match the Karazhan theme asset
  sheet's working ids, but the violet-night palette, per-boss motifs, and
  tower emblem are NOT rendered — Karazhan currently plays in the default
  skin.

### 4. The demo script (the one that is safe to run for anyone)

1. Open the hub → **Arc Library**: two bundled cartridges, trust chips.
2. Karazhan → **Export** → `karazhan.arc.json` downloads (validated first).
3. Open world's boot screen → **Open cartridge…** → select the file.
4. Entry appears with an **imported · unsigned** trust chip.
5. **Boot.** Board renders the wings: Attumen available; Curator and
   Nightbane locked, each card stating exactly why.
6. Select Attumen → **Standard / Heroic** picker → run the contract.
7. Contrast: boot The First Charter (different grammar, no mode picker), or
   import the Operations Lab file (different vocabulary entirely).

The sentence the demo earns: **"Different authored grammar. Same deterministic
runtime and custody/evidence contract. Playable immediately."**

### 5. What must NOT be touched casually

- **The shared surface** (`src/engine`, `src/arcs`, `tests/engine`,
  `tests/fixtures`): changes land in axm-arc FIRST, world re-vendors via
  `npm run engine:sync`. Editing vendored copies in world is drift by
  definition; its CI fails on it. (`RECONCILIATION.md`.)
- **The arc schema.** It is now the platform ABI — three cartridges and two
  apps depend on it. Additive changes only; anything else is a versioned,
  deliberate event.
- **The milestone normalization contract** (`-cleared` / bare-id, in
  `engine/access.ts`): guard tests in both repos pin it. Board status and
  runCycle enforcement must keep deriving from the same function.
- **`exportArcToJson`'s raw-object rule**: never export `trust` /
  `importedAt` / `source`. A file must not be able to claim its own trust
  level.
- **`validateArc` as the single gate** on every import AND export path.
- **Bundled arc ids** (`first-charter`, `karazhan`): saves, cartridge-bay
  keys, and testids derive from them.
- **Karazhan roster seeds** (`hashSeed("karazhan", "starting-roster", i)`)
  and the 424242-style fixture seeds: changing them silently changes every
  new game / golden test.
- **Attunement monotonicity**: stamped chains are never revoked; saves now
  depend on that semantic.

---

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

**Owner (Operations Lab screenshot):** "a cartridge is not a skin, a
cartridge is a playable grammar" → drove the export button, the gating
layer, Karazhan, and world parity — the whole checkpoint above ✅.

## D. Lessons learned (keep these — process-level)

1. **Prototypes are CSS/keyframe source, not fridge art.** Structure /
   data / fake-engine = discard; visual craft = lift verbatim.
2. **Deploy cadence was the bug.** Actions-Pages fixed it structurally.
3. **One engine, two audiences, no fork.** Every UX win is dual-use.
   This is the governing law.
4. **Codex PRs are cheap option-generation.** Harvest the signal, close
   the rest.
5. **Determinism is a present-tense promise, not a scale concern.**
   Laws need *enforcing tests* or they erode.
6. **Substrate decisions rank by reversibility, not severity.** Things
   that get expensive after saves/arcs harden are the ones to decide now.
7. **Dead schema is drift waiting to happen.** Attunements/tiers/modes
   were authorable-but-ignored for weeks, and three half-implementations
   of gating grew in the vacuum. If the schema can say it, the engine
   must do it — or the schema shouldn't say it yet.
8. **Checkpoint before continuing.** A merged milestone gets smeared by
   the next "continue" unless its boundary (proven vs unproven) is
   written down. That is what the checkpoint section above is for.

## E. The queue — ranked by leverage

### Tier A — protect the milestone
1. **Karazhan balance simulation harness.** Auto-play N cycles with the
   recommender; measure wing-clear rates, cycle-of-death, urn drop
   timing. Converts "second game exists" into "second game is
   finishable." No UI work.
2. **Karazhan theme pack rendering** (world). Wire the `--kz-*` palette
   tokens, per-encounter motif icons (keyed by challenge id, per the
   asset sheet), and the tower emblem. Pure presentation; makes the
   two-cartridge screenshot undeniable.
3. **IP rename decision** (owner). Private proof vs public demo naming.

### Tier B — parked design bets (need owner gut, not just code)
4. **Gameplay-screen layout redesign** — the "same disease" list (heavy
   left rail, cramped board, floating tutorial copy, bolted-on right
   rail). Spec: `docs/design/GAMEPLAY_SCREEN_REDESIGN_SPEC.md` (world).
5. **Digest ticket 3** — inline blocking docket + narrow advance-gating.
6. **Wits decision** (`BALANCE.md`) — now informed by Karazhan's 5-role
   grammar.

### Tier C — substrate correctness
7. **SCALE 0.4 silent-save-loss** — present-day correctness bug,
   cheapest substrate win.
8. **SCALE 0.2 relationship sparse+indexed** — needs the cohorts/squads
   (0.7) call first.

### Tier D — smaller parity gaps
9. **Hub heroic picker** — engine + world expose difficulty modes; the
   hub's own AssignScreen doesn't yet.
10. **60-sec-to-first-win pass** — `<AttendedStamp>`, unused keyframes.

## F. Branch hygiene

- axm-arc `main` = `35a4e2b` (PRs #29, #30, #31 merged). 284/284 tests.
- axm-world `main` = `b2ea1d9` (PRs #16, #17, #18 merged). 350/350 tests,
  `engine:check` green at the `35a4e2b` pin.
- Working branches (`claude/reconciliation-strategy-garwpq` in both repos,
  `claude/karazhan-enablement-garwpq` in axm-arc) are fully merged; safe to
  delete.

## G. Status snapshot

- Build: green both repos. Deploy: Actions-based Pages —
  `bigbirdreturns.github.io/axm-arc/game/` and
  `bigbirdreturns.github.io/axm-world/game/`.
- Threads: loop-feel mostly done · platform **done through the cartridge
  loop checkpoint** · authoring steps 1–3 done (equipment editing still
  open) · Karazhan content **shipped, balance unproven**.
- Substrate (SCALE): determinism enforced; 0.4 is the next cheapest win.
