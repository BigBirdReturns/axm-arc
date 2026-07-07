# Tier B: the positional presentation seam

**Positioning is presentation.** world's encounter-staging layer compiles a
challenge into a positional tableau — tiles, height, lanes, whatever the
lineage's skin calls for — and the player's placement choices produce
**bounded modifiers** applied to the challenge's existing `mechanicChecks`
before resolution. The engine API does not change. That's Atlas rule #1: *a
clone may not change the engine; a gap becomes an RFC, not a hack.* Tier B
exists because positioning is not a gap — the engine already resolves
checks, grants outcomes, and gates progression; what it lacks is a board,
and a board is exactly the kind of thing presentation can own without
touching `schema.ts`.

This doc is the seam's contract: what it's allowed to touch, what it must
never touch, and the law that keeps it from quietly becoming a second engine.

## The modifier law

A positional modifier is:

1. **Additive.** It shifts a check's effective score or effective threshold
   by a signed delta. It never multiplies, never re-rolls, never swaps which
   attributes a check weighs.
2. **Bounded at ±15% of the check's `difficultyThreshold`.** This is not a
   round number picked for looks — it's sized to the near-miss band. A check
   decided by more than 15% was decided by roster and rolls, as it should be;
   a check within 15% is exactly the case where "where did you stand" ought
   to matter. The cap means placement can flip a near-miss, in either
   direction, but it can never rescue a rout and it can never overturn a
   result the party's build already decided outright. Position is a garnish,
   not a second currency that outbids the fight itself — if a lineage needs
   more leverage than that, it isn't Tier B anymore, and the honest move is
   an engine RFC, not a bigger cap.
3. **Fully recorded in the decision, not the schema.** Nothing here adds a
   field to `MechanicCheck`, `Challenge`, or `RunReport` — that's the
   non-goal below. The precedent is already in the engine: an assignment
   already carries a runtime spend figure (`tokensSpent`) that isn't part of
   the authored check, only part of *this attempt's* decision. Placement
   modifiers follow the same shape — they live on the seam's own
   tableau/assignment record, sitting beside whatever the engine already
   records for that attempt, not inside it.
4. **Replay-exact by construction.** Because placement is part of the
   recorded decision, re-running a recorded attempt reproduces the same
   modifier and therefore the same check outcome. Determinism was never
   about the engine being the only thing that varies — it's about every
   input to resolution being on the record. Placement joins `tokensSpent`
   on that record; it doesn't sit outside it.

Nothing here licenses a new `resourceSpend`-shaped lever with its own
tuning knobs. `ResourceSpendLever` narrows a roll's symmetric variance and
is explicitly mean-preserving; a positional modifier is explicitly
mean-*shifting* (it's supposed to reward good placement) — that's a
different mechanism and it lives in the seam, not in `schema.ts`, precisely
because it must never grow the engine's authored surface.

## What stays engine / what the seam owns

| Stays engine | Seam owns |
|---|---|
| Check resolution (score vs. `difficultyThreshold`) | Tableau compilation (challenge → tiles/height/lanes) |
| Growth, drama, economy, progression gates | Placement UI and input |
| `failureConsequence`, outcomes, rewards | Deriving the bounded modifier from a placement |
| `orgMilestones`, `accessRequirements` | Per-lineage modifier tables (authored as cartridge data) |

The engine never learns that a tableau exists. It receives a check and a
modifier-adjusted attempt, the same shape it already resolves today.

## Per-lineage notes

**Grid tactics (Fire Emblem line).** Weapon triangle and terrain are
modifier tables **authored in the cartridge as data** — not engine code, not
even seam code, just JSON the tableau compiler looks up. A triangle
advantage and a forest tile both resolve to "look up a number in a table,"
same mechanism, so a cartridge author can retune both without a release.

**Isometric tactics (Tactics Ogre / FFT line).** Height tiers are the
modifier axis; facing and turn-order display are presentation with no
mechanical weight at all — they inform the player, they don't touch the
check.

**Campaign wargame (Advance Wars line).** Capture points map onto
`accessRequirements.orgMilestones` — a captured point is an org milestone
like any other, which means the campaign layer doesn't need its own gating
concept; it reuses the one the engine already exposes.

**Mech tactics (Front Mission line).** Loadout slots are items-as-parts;
per-part checks are ordinary `role_specific` checks (`scope:
"role_specific"`, `roleIds` naming the part). A part isn't a new scope —
it's a role, so the existing per-agent/team_aggregate/role_specific split
already covers it.

## Test strategy

- **Staging determinism.** Same placement in, same modifier out, every
  time — a pure function test on the tableau compiler, no randomness
  involved (the check's own roll is a separate concern).
- **Bound enforcement.** A property test over every derivable placement for
  a lineage's modifier table: no combination of tile/height/lane/part
  produces a modifier outside ±15% of the check's threshold. This is the
  test that keeps the law honest — a cartridge author stacking terrain
  bonuses should hit a wall, not a workaround.
- **Cartridge-data-driven modifier tables validated at import.** Modifier
  tables ship as cartridge data, so they're validated the same moment the
  cartridge is — a malformed or out-of-bound table fails import, not first
  contact in play. This validation sits in the seam's importer, layered on
  top of `importArcFromJson`, not inside it: the engine's import path stays
  exactly as portable as it is for every other tier.

## Non-goals

- No real-time input. Tier B placement is a pre-resolution decision, not a
  skill-timed one — that question belongs to Tier C.
- No pathfinding AI opponent for v1. Enemy placement is authored, the same
  way enemy rosters already are — a v1 opponent that reasons about the
  board is a real feature with its own scope, not a Tier B prerequisite.
- No new engine fields. If a lineage needs one, it isn't Tier B — file the
  RFC.
