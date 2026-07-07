# Lineage brief — the async base-war strategy

**Reference lineage:** the asynchronous base-builder war loop — fortify a
holding, raid others for resources, get raided while you're away, fund the next
upgrade with the spoils, escalate an arms race with a social layer around it.
**Our cartridge:** `cartridges/palisade-war.arc.json` (clone #5).

## Core tension
Offense vs. defense investment. Resources spent raiding don't fortify you
against being raided; you are always most exposed exactly when you're most
extended. Every upgrade is a bet on which side of that exposure will decide
your next encounter.

## Retention loop
Asynchronous consequence plus the build clock. Your holding persists and gets
attacked while you're offline, so you return to *consequences* — a reason to
check back that the game creates without you. Build/upgrade timers pace
engagement (the "come back when it's done" loop); the loot economy funds the
next upgrade, closing the cycle. The revenge/counter-raid beat gives the whole
thing emotional stakes: being raided isn't just a loss, it's a grudge.

## Progression arc (the beats)
Tutorial raids (learn offense cheaply) → the first time you get raided — the
sting that teaches defense matters → the arms race (offense and defense
escalating against each other) → the social/clan layer → the sustained
mid-to-late competitive grind. The first raid *against you* is the pivotal beat;
before it, defense is abstract; after it, it's personal.

## Tuning lessons
- Build timers are the master pacing knob: long enough to create a return
  cadence, short enough that they read as rhythm, not paywall.
- Loot balance tuned so raiding is worth the exposure but defense still matters
  — if offense always wins, the build side is pointless and half the loop dies.
- Matchmaking must pair comparable holdings; new players farmed by veterans quit
  fast, and that single tuning failure has killed more of these games than any
  content gap.

## Known failure modes
- Timers too long → they read as paywalls → resentment and churn.
- Timers too short → the return-cadence loop collapses into a binge-and-drop.
- Unbalanced matchmaking → newcomers farmed → the top of the funnel bleeds out.

## How our cartridge honors it — and where it doesn't yet
Our cartridge expresses the *strategic economy* as Tier A: Plunder / War
Parties / Dread / Timber, the "War Horns" chain, the Rival Bastion finale — the
raid-and-fund cycle in its single-player, deterministic form. **Stated
honestly:** the beats that make this lineage *social and asynchronous* — getting
raided while offline, real-time build timers, matchmaking against live
opponents — are Tier B/C territory (position, real-time, live PvP) and are
deliberately abstracted out, not faked. Our Palisade War is the strategy layer's
economy and escalation, not its async-PvP soul; that boundary is the honest one
the atlas draws. **Divergence to bank:** like Deepway, the sweep clears
**15/15** — the escalation curve isn't yet biting toward an "arms race" feel; a
tuning pass toward a tighter finale band would help, and the async-PvP beats are
a standing Tier-B/C RFC candidate rather than a tuning fix.
