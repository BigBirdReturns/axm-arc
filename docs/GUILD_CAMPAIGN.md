# The flagship — a persistent raid-guild campaign

**You run a persistent raid guild through expansion-era raid cartridges, where
every boss is a structured challenge and every roster decision changes the
organization that faces the next one.**

This is the north star. Not a clone, not a tech demo — the game this whole
engine was built to make, and the hardest possible proof that its loop holds a
human's voluntary attention. Everything else (the atlas, the clones, the
Workshop) was breadth to prove the engine *generalizes*; this is depth to prove
it's *fun*. Fun is the whole bet.

## What it is

The unit is **one long guild campaign made of discrete raid cartridges.** The
raids are not separate games — they are content packs inside one persistent
guild record. Each raid cartridge adds bosses, loot tables, roster pressures,
role checks, failure patterns, reputation effects, and a new readiness ceiling.
The player clears a tier, carries the guild forward, and the next tier tests
whether the guild was built well or merely overfitted to the last wall.

The campaign is the emotional continuity. The raid cartridge is the executable
constraint package. When a tier ends, the guild does not reset — its veterans,
habits, liabilities, legends, grudges, and loot history travel into the next
cartridge. **The fantasy is not "clear the raid." It is "become the kind of
organization that can keep clearing raids."** It should feel like a playable
archive of eras.

(Clean-room note, per this repo's law: shipped raid cartridges use *original*
vocabulary and content. The era-archive *feeling* is the target; the bosses,
zones, and loot are authored fresh, never any franchise's names or data.)

## The five loops (not every MMO system — these five)

1. **Recruitment** — balancing raw talent, role scarcity, personality risk,
   attendance reliability, and long-term fit.
2. **Roster composition** — who sits, who starts, who swaps roles, who gets
   trusted on progression.
3. **Gear & loot governance** — not inventory optimization; whether reward
   allocation improves readiness *without breaking perceived fairness*.
4. **Scheduling & commitment** — availability, fatigue, lockouts, and social
   obligation as actual game state.
5. **Drama & retention** — the system remembers whether a player feels
   invested, ignored, overused, carried, punished, or essential.

**Training** exists but is a lightweight lever (the fix for a hunter who keeps
missing interrupts, a healer who panics under burst, a tank with threat
issues) — not the fantasy by itself. **Economy** exists as *pressure, not
bookkeeping*: consumables, repairs, enchants, bank stock force tradeoffs without
becoming spreadsheet procurement. The fun is *"I know exactly why we wiped, I
know which two people are the bottleneck, and I have three imperfect ways to fix
it before reset."*

## The hook: one more lockout

The player is always one decision from seeing whether the guild is finally
ready. One more recruit trial. One more loot assignment. One more role swap. One
more morale repair. One more farm night. One more pull to see whether the
readiness line was real. A session should end on visible unresolved tension —
the boss at 18%, the off-tank threatening to quit, the brilliant undergeared
mage, the priest and the raid lead's friend eyeing the same staff, reset
incoming. That is the hook.

## The acceptance test (the control question)

**After a wipe, does the player blame the simulation, or immediately think "I
know what I am changing before next reset"?**

The engine makes the answer *yes* by construction. It is a per-agent, seeded,
deterministic check resolver — "blame the sim" is the symptom of opacity or
randomness, and this engine has neither. Every wipe is a specific failed check
with specific under-threshold agents, reproducibly. So the wipe diagnosis is
*computable*, not fuzzy. The whole design risk therefore reduces to **making
that diagnosis legible** — which is world's founding discipline ("make the
current truth readable" before it is embodied or recorded). Pass the readability
bar and you pass the control question.

## What the engine already expresses (free)

| Flagship need | Engine mechanism |
|---|---|
| Guild members, talent, personality | roster: attributes, roles, tiers, traits |
| Roster composition, bench, swaps | assignment + bench (core engine loop) |
| Bosses; interrupts / threat / heal-under-burst | challenges + `role_specific` / `per_agent` / `team_aggregate` checks |
| Raid tiers | progressionTiers (milestone + reputation gated) |
| Gear, drops | items / rewardTable / statBonuses |
| Consumables/repairs as pressure | economy: tokens / currency / materials |
| Fatigue/burnout; investment | per-agent **stress** + **morale** (world surfaces both today) |
| Lightweight training lever | train / rally / rest actions |
| Retention memory; grudges; legends | drama + precedents + the consequence ledger |
| Lockout / reset cadence | cycles |
| "Why we wiped" is a fact, not a vibe | seeded determinism + per-check resolution |

## What's genuinely new (the honest gaps)

1. **Cross-cartridge guild persistence — the architectural decision.** Today arc
   runs one arc at a time; world keeps a per-cartridge ledger keyed by digest.
   *Neither carries one org across a sequence of content packs.* Persisting the
   guild — veterans, liabilities, loot history — across raid cartridges is the
   campaign's spine, and it is an **owner-gated RFC**, not a hack. Now written
   up: `docs/RFC_TIER2_PERSISTENCE.md` (Proposed; recommends a projected guild
   ledger — game-layer, no engine change). This is the decision that unlocks
   "campaign" over "one-off."
2. **Attendance / availability** as per-lockout state — possibly just stress plus
   a schedule field; scope it before building.
3. **Loot → fairness / morale wiring** — substrate exists (loot + drama +
   morale); the *linkage* (who got the drop → who feels punished vs. essential)
   is the new part.
4. **The wipe-diagnosis readout** — derivable from resolver output; the *legible
   presentation* is the build. This is the control question made concrete.

## The first slice (buildable on today's engine)

Do not start with a whole expansion. Start with **one mini-tier**: 12 guild
members, 3 roles, one raid night, three bosses, one loot table, one bench
decision, one drama event, one persistent ledger. The player recruits or accepts
two trials, assigns a ten-person roster, chooses a loot rule, resolves boss
attempts, **receives a failure diagnosis**, distributes one meaningful drop,
absorbs one social consequence, and sees the next lockout become easier or harder
because of what they did.

Key property: **one tier defers the cross-cartridge RFC.** The slice is a single
cartridge on today's engine plus the diagnosis readout — the persistence
question only bites at tier 2. So the full loop can be built and *felt* now, and
the architecture decided when the campaign actually needs it. Build the riskiest
piece first: the **wipe → diagnosis → "three imperfect fixes" → next pull** loop,
because it is the acceptance test in executable form.

## The enterprise pruning (quiet through-line)

Game first. This does not pitch "enterprise simulation in a costume" — it pitches
the game a person actually wants to play. But the loop was never about elves.
Replace "raid boss" with "delivery milestone," "loot" with "promotion / budget /
access / credit," "class role" with "function," "attendance" with "capacity,"
"morale" with "retention risk" — and the loop survives, because it was always
about readiness, allocation, trust, scarcity, and consequence memory. The
grammar rule (chrome translates; cartridge vocabulary flows verbatim) is the
pruning mechanism, already shipped: the same engine renders a guild for a player
and an org for an operator. Build the fun; the enterprise is the fun with the
fantasy pruned off.
