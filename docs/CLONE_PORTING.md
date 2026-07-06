# Clone porting protocol — how a lineage becomes a cartridge

The repeatable recipe behind the Compatibility Atlas
(`docs/COMPATIBILITY_ATLAS.md`). Follow it in order; every step's output is a
durable artifact. A port that skips a step isn't done.

## 0. Pick from the atlas, respect the tier
Only Tier-A lineages port with this protocol as-is. Tier B needs the
world-side presentation seam to exist first; Tier C needs its RFC answered.
Don't promote a lineage mid-port.

## 1. Write the mapping table BEFORE any content
One table: lineage noun → arc schema field. ("Stronghold → challenge",
"Chapter → progressionTier", "Law/Chaos → drama basis + precedents",
"Hunger → upkeep".) If a noun has no row, the lineage is not Tier A — stop
and file the gap as an engine RFC. The mapping table is the most reusable
artifact of the whole port; keep it in the PR description and in the
cartridge's header comment.

## 2. Author against the schema, envelope against the reference
`src/engine/schema.ts` is law — emit only fields it defines. Take every
numeric envelope (difficulty scale, thresholds vs achievable scores, item
bonus sizes, upkeep, token income) from the closest existing cartridge
(Karazhan for combat-shaped loops) rather than inventing scales. Original
vocabulary only: mechanics are lineage; names/text/art are expression and
must be new.

## 3. Validate through the real seam
The cartridge must pass `importArcFromJson` (the same path a player's
paste/upload takes) with zero errors, and `cartridgeDigest` must compute.
Not a hand-rolled validator — the actual import function.

## 4. Prove it plays, mechanically
Ship a conformance test with the cartridge (pattern: `tests/sim/` /
`tests/cartridges/`):
- determinism: same seed → identical run, twice;
- reachability: simulated play unlocks every chapter and can reach the
  finale (gates are honest — never bypassed, never unreachable);
- tuning: chapter-appropriate parties clear chapter content; the finale is
  tight but reachable.
A cartridge without its sim test is content, not a clone.

## 5. Load it where players will
Library → Import arc → paste/upload → Validate & Save → Load. If the UI
path fails where the test passed, the seam is what's broken — fix that,
it protects every future cartridge.

## 6. Bank the leftovers (use all of the buffalo)
Anything generic you built during the port — sim helpers, envelope notes,
schema clarifications, gaps discovered — gets extracted into shared
helpers/docs/RFCs in the same PR. The next port should be strictly cheaper
than this one.
