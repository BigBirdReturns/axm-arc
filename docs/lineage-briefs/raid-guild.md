# Lineage brief — the raid-guild loop

**Reference lineage:** the endgame raid loop of large cooperative online RPGs —
a standing roster, a gated multi-stage encounter, probabilistic loot, and the
social friction of coordinating people.
**Our cartridge:** `cartridges/` — Karazhan is the reference clone (#1); this
brief documents the loop the engine was first shaped around.

## Core tension
Individual reward vs. group readiness. You gear up to clear the content, but
the content is cleared by the *group*, so your own progress is gated by the
weakest link in coordination and composition. The loop constantly asks: invest
in yourself, or invest in making the group able to function?

## Retention loop
The reset cadence. Content re-opens on a fixed clock, so there is always a
"this week's" objective — engagement is paced, not binged. Loot is
probabilistic, so the chase never fully completes; the median player returns
because the specific thing they want hasn't dropped yet, not because they've
run out of game.

## Progression arc (the beats)
Form the group → the wipe phase (learning the encounter, failing together, the
bonding cost) → crossing the gear threshold where clears become reliable →
farm status (the content is now a routine income source) → the group outgrows
it and needs the next tier. The wipe phase is load-bearing: a loop that lets
you win first try never earns the clear.

## Tuning lessons
- Encounter difficulty must sit *just above* current gear, so a clear feels
  like it required the gear you brought — not below (trivial) or far above
  (a wall the group dissolves against).
- Loot rates tuned so the median player needs several clears — enough to drive
  the return cadence, not so many the reward feels withheld.
- One hard "gate" stage that filters unprepared groups. It's the beat that
  makes readiness legible; remove it and preparation stops mattering.

## Known failure modes
- Loot too generous → the chase ends → players leave with nothing left to want.
- Coordination cost too high → casual players bounce before the payoff.
- The gate stage too hard → the group stalls, blame starts, the guild fractures.
  The social failure is the real failure; the numbers just trigger it.

## How our cartridge honors it — and where it doesn't yet
Karazhan is the reference: the deterministic roster → contract → check → loot →
drama loop *is* this lineage, and its gated stages (the Curator/Nightbane
beats) are the readiness filter. Conformance proves the gate is reached
honestly — never bypassed, never unreachable. The one thing the single-player
cartridge cannot embody is the *social* friction that is half this loop's soul;
our drama system is the honest stand-in (consequence and precedent stand where
guild politics stood), and that substitution is worth stating plainly rather
than pretending the solo cartridge reproduces a twenty-five-person raid night.
