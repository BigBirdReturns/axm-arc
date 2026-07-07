# Clone porting protocol — how a lineage becomes a cartridge

The repeatable recipe behind the Compatibility Atlas
(`docs/COMPATIBILITY_ATLAS.md`). Follow it in order; every step's output is a
durable artifact. A port that skips a step isn't done.

## 0. Pick from the atlas, respect the tier
Only Tier-A lineages port with this protocol as-is. Tier B needs the
world-side presentation seam to exist first; Tier C needs its RFC answered.
Don't promote a lineage mid-port.

## 1. Extract the lineage brief BEFORE anything
Write the design wisdom down first: the core tension, the retention loop, the
progression beats, the tuning lessons a decade of play taught, and the failure
modes to avoid — in original vocabulary, no assets/names/story. This is the
`docs/lineage-briefs/` artifact and it decides the tuning, which is half the
port. The brief keeps the *lessons* of a proven loop while touching nothing
anyone owns; a cartridge tuned to its brief is *good*, not merely valid. If you
can't state the loop's core tension without referencing someone's expression,
you don't understand the lineage yet — stop until you do.

## 2. Write the mapping table
One table: lineage noun → arc schema field. ("Stronghold → challenge",
"Chapter → progressionTier", "Law/Chaos → drama basis + precedents",
"Hunger → upkeep".) If a noun has no row, the lineage is not Tier A — stop
and file the gap as an engine RFC. The mapping table is the most reusable
structural artifact of the port; keep it in the PR description and in the
cartridge's header comment.

## 3. Author against the schema, envelope against the brief + reference
`src/engine/schema.ts` is law — emit only fields it defines. Take every
numeric envelope (difficulty scale, thresholds vs achievable scores, item
bonus sizes, upkeep, token income) from the closest existing cartridge
(Karazhan for combat-shaped loops) — but aim the *curve* at the brief's tuning
lessons: put the difficulty bite, the economy pressure, and the gates on the
beats the brief says matter. Original vocabulary only: mechanics are lineage;
names/text/art are expression and must be new.

## 4. Validate through the real seam
The cartridge must pass `importArcFromJson` (the same path a player's
paste/upload takes) with zero errors, and `cartridgeDigest` must compute.
Not a hand-rolled validator — the actual import function.

## 5. Prove it plays, against the brief's tuning lessons
Ship a conformance test with the cartridge (pattern: `tests/cartridges/`):
- determinism: same seed → identical run, twice;
- reachability: simulated play unlocks every chapter and can reach the
  finale (gates are honest — never bypassed, never unreachable);
- tuning: chapter-appropriate parties clear chapter content; the finale is
  tight but reachable. Read the clear-rate against the brief — a lineage whose
  brief calls for a mid-game crunch but which clears every seed is *soft*, and
  that gap is a tuning-backlog finding, not a pass.
A cartridge without its sim test is content, not a clone.

## 6. Load it where players will
Library → Import arc → paste/upload → Validate & Save → Load. If the UI
path fails where the test passed, the seam is what's broken — fix that,
it protects every future cartridge.

## 7. Bank the leftovers (use all of the buffalo)
Anything generic you built during the port — sim helpers, envelope notes,
schema clarifications, gaps discovered, tuning divergences from the brief —
gets extracted into shared helpers/docs/RFCs in the same PR. The next port
should be strictly cheaper than this one.
