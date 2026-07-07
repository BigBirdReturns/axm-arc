# Lineage brief — the rescue-mission dungeon

**Reference lineage:** the roguelite rescue dungeon — accept postings, descend
under a hunger/supply clock, recruit team members by clearing content, grow a
persistent roster across expendable runs.
**Our cartridge:** `cartridges/deepway-rescue.arc.json` (clone #3).

## Core tension
Go deeper vs. come back. A resource clock (hunger, supplies, upkeep) means every
step deeper spends something you might not recover. The reward is below; the
safety is behind you; the loop makes you price that gap on every floor.

## Retention loop
Recruit-on-clear. Clearing brings new members, so the roster grows as a
*persistent* reward that outlives any single expendable run — the run is the
lottery ticket, the roster is the savings account. Layered on top: the
help-a-failed-run hook, where recovering a loss (your own or another's) turns
setbacks into fresh objectives rather than dead ends.

## Progression arc (the beats)
Shallow tutorial floors (learn the loop cheaply) → the first resource crunch
that teaches the go-deeper/return decision → roster expansion unlocking new
compositions → the deep floors where the upkeep clock bites hardest → a finale
that demands the *fullest* roster, cashing the whole savings account at once.

## Tuning lessons
- The upkeep rate must be gentle early (let players learn) and bite in the
  mid-game (force the core decision). A clock that never bites deletes the
  entire tension.
- Recruit rates tuned so the roster grows *steadily* but each member feels
  earned — inflation trivializes composition, scarcity flattens the reward.
- The deepest content gated on roster *breadth*, not raw power, so the
  persistent-collection reward and the difficulty gate reinforce each other.

## Known failure modes
- Upkeep too punishing → players stop going deep → the whole point evaporates.
- Recruiting too fast → roster bloat → composition stops mattering.
- Recruiting too slow → the savings-account reward feels flat and quitting rises.

## How our cartridge honors it — and where it doesn't yet
The economy (Marks / Expedition Slots / Guild Standing / Salvaged Kit), the
"Deep Beacon Charts" chain, and the Hollow Crown finale carry the descent and
the persistent-roster payoff. **Divergence to bank:** the conformance sweep
clears **15/15 seeds** — which means the upkeep clock is *not yet biting* the
way the brief's mid-game crunch demands. This is the clearest tuning-backlog
item the briefs surfaced: Deepway is currently mechanically valid but tuned
soft against its own lineage. A pass that raises mid-tier upkeep pressure (or
tightens the deep-floor gates) toward a ~13/15 band would move it from "plays"
to "plays like the lineage." (Retuning re-pins the digest and its conformance
test — do it deliberately, not casually.)
