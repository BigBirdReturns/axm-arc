# RFC: real-time input vs. the determinism law

**Status: Proposed — no code until this RFC is accepted.**

## The problem

Tier C lineages — match-3 combat, physics flings, real-time lanes, tower
defense, action timing — all need player skill input *at resolution time*.
That's the whole appeal of the lineage: the player, not the roster, throws
the ball. It runs straight into the family law: same seed produces the same
run, and the run record (`RunReport`) is ledger-grade — it's the thing a
replay, an audit, or a future signed-cartridge verifier trusts. A resolution
step that depends on live human input during play is not a function of the
seed. Something has to give, and this RFC is about which thing.

Three options. The first is honest and cheap. The second is thorough and
expensive. The third is the recommendation, and it's recommended with its
weaknesses stated plainly rather than argued away.

## Option 1 — reject: move Tier C to Tier D

Tier C stops being a compatibility question. Match-3 combat, physics flings,
real-time lanes, tower defense, and action timing all move to Tier D —
named, in the Atlas's own words, "so nobody burns a quarter on them by
accident." The price is exactly five lineages, paid up front, with no
runtime cost and no cheat surface because there is no feature. This is the
floor every other option has to beat.

## Option 2 — input-trace replay

Record the full input stream — every tap, drag, flick, timing — in the run
record. Determinism is redefined at the input layer: same seed *and* same
recorded input trace re-simulates to the same outcome, because the "skill"
step becomes a deterministic replay of exactly what happened, run through an
authoritative simulator.

Price: an engine-adjacent replay VM per minigame family (match-3 needs a
different resimulation model than physics flings, which needs a different
one than lane defense) — that's real, ongoing engine-shaped surface, not a
cartridge concern. Run records grow large — a full input trace dwarfs the
handful of fields `RunReport` carries today. And it's only cheat-resistant
if the resimulation is authoritative: if the "replay" just re-displays the
recorded trace rather than re-deriving the outcome from it, a doctored trace
is just as replayable as an honest one. Authoritative resimulation is
achievable but it's the expensive part of this option, not a footnote to it.

## Option 3 — outcome mapping (recommended)

The minigame runs client-side, non-deterministically — real-time input,
real physics, no seed dependency, no replay VM. Its **result** is compressed
into a bounded check-modifier, under the *same bounded-modifier law Tier B
already uses*: additive, capped at ±15% of the check's `difficultyThreshold`,
recorded on the decision rather than the schema. The run record stores only
the result — not the trace, not the inputs, not the physics state.

This means two different things are true at once, and they must not be
blurred together:

- **Ledger determinism holds.** The run record replays exactly — same
  stored result, same modifier, same check outcome, every time. Anything
  downstream (progression, audit, a future signed-cartridge verifier) sees
  a fully deterministic record, because all it ever sees is the compressed
  result.
- **Performance determinism does not hold, and this RFC concedes that
  explicitly.** The minigame itself is not reproducible — replaying the
  same seed does not make the ball fall the same way twice. If a future
  feature needs "watch the exact match replay," Option 3 cannot provide it;
  that need would require Option 2's trace, layered on top, for that
  specific lineage.

**Cheat surface, stated plainly:** the result is self-reported by a
client-side, non-deterministic minigame. There is no authoritative check
that the reported result is the result the player actually earned. That is
acceptable for single-player cartridges, where the only person a cheated
result harms is the cheater. It is **not acceptable for competitive play**
— a leaderboard, a PvP wager, anything where one player's self-reported
result costs another player something. Competitive Tier C content is out of
scope for this RFC and would need Option 2's authoritative trace to exist
first, for that lineage specifically.

The weakness worth sitting with: Option 3 works by *not asking the hard
question* Option 2 answers. It doesn't make Tier C real-time input safe for
competition; it makes it safe for the same single-player cartridge context
every other tier already assumes. That's a real limitation, not a solved
problem deferred by better naming.

## Decision criteria

| | Option 1 — reject | Option 2 — input-trace replay | Option 3 — outcome mapping |
|---|---|---|---|
| Ledger integrity | N/A — no Tier C content exists | Full — trace + authoritative resim both replay exactly | Full — the stored result replays exactly |
| Replay fidelity (performance) | N/A | Exact, if the resimulator is authoritative | None — conceded; the minigame itself never replays |
| Implementation cost | None | High — an engine-adjacent replay VM per minigame family, large run records | Low — one bounded-modifier adapter per minigame, reuses Tier B's law |
| Cheat surface | None (no feature) | Low, but only if resimulation is authoritative — otherwise equal to Option 3's | High — self-reported result, unverified |
| Lineages unlocked | Zero of five | All five, at the cost above | All five, single-player only |

## Recommendation

Option 3, adopted with its limits named in the cartridge format itself (a
Tier C cartridge is single-player by construction until an RFC extends a
specific lineage with Option 2's trace). This keeps Tier C real without
paying for a replay VM the roadmap doesn't need yet, and it keeps the
family's actual invariant — the ledger replays exactly — fully intact. It
does not pretend the performance is reproducible, and it does not pretend
the cheat surface is closed for anything beyond single-player. Either of
those claims would be the kind of hack Atlas rule #1 exists to prevent.

No code lands against this RFC until it is accepted.
