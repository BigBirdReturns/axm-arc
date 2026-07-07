# Lineage briefs — the design wisdom, without the skin

A classic game is two things: **expression** (its art, names, story, music —
owned, copyrighted, not ours) and **design lessons** (its beats, its tension,
the tuning that millions of hours of play beat into shape — not copyrightable,
just *known*). A lineage brief keeps the second and throws away the first.

These are not summaries of anyone's game. They are white-label statements of
how a *kind* of loop works and what a decade of players taught about it,
written in original vocabulary so a cartridge can be tuned to proven pacing
instead of guessed. The reference game is named only as a factual pointer to
the lineage — no story, no characters, no assets, nothing that belongs to
anyone flows through these docs or the cartridges they produce.

## Why they exist

A cartridge that passes conformance is *mechanically valid*. A cartridge tuned
to its lineage brief is *good* — its difficulty bites where the lineage taught
difficulty should bite, its economy paces the way the loop needs pacing, its
gates land on the beats that matter. The brief is the difference between "the
engine can express this" and "this is worth playing."

## The template

Every brief states, in this order:

1. **Core tension** — the one decision the loop keeps asking you to make.
2. **Retention loop** — why the hours accrue; the hook that reloads each session.
3. **Progression arc (the beats)** — the shape over time: onboarding → first
   mastery → the wall that forces investment → mid-game → payoff.
4. **Tuning lessons** — what the hours taught. Where difficulty must bite, what
   ratios hold people, where players found the degenerate strategy and how the
   design closed it.
5. **Known failure modes** — the beats that *don't* work, banked so nobody
   reinvents the mistake. (Sometimes the lesson is what NOT to carry over.)
6. **How our cartridge honors it — and where it doesn't yet** — the tie-back to
   the shipped cartridge, including honest divergences as tuning backlog.

## Where it fits

The lineage brief is **step 1 of the porting protocol** (`docs/CLONE_PORTING.md`)
— extracted before the mapping table, because the beats decide the tuning and
the tuning is half the port. A brief outlives any specific cartridge: the next
person porting that lineage inherits the wisdom instead of rediscovering it.

## The set

| Brief | Lineage | Cartridge |
|---|---|---|
| `raid-guild.md` | Raid-guild loop | Karazhan (clone #1, the reference) |
| `liberation-campaign.md` | Squad liberation campaign | The Severed March (#2) |
| `rescue-dungeon.md` | Rescue-mission dungeon | Deepway Rescue Guild (#3) |
| `live-service-party.md` | Live-service party RPG | The Wandering Court (#4) |
| `async-base-war.md` | Async base-war strategy | The Palisade War (#5) |
