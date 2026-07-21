# Godscar Pocket source format

`godscar-pocket/1` is a creator-owned source object that compiles into an ordinary AXM Arc. The source is embedded unchanged under `Arc.extensions["godscar.pocket@1"]`, so the creator can recover, inspect, fork, and redistribute the story grammar from the cartridge itself.

## Six required pressures

Every pocket declares, in order:

1. the bounded **pocket** in which institutions, travel, information, and consequence remain immediate;
2. the **patron or controlling system** whose real public good creates dependency;
3. the **excluded actor** the system cannot represent without changing or suppressing it;
4. the **approaching trigger** that will convert pressure into an irreversible decision;
5. the **cost of resistance**, stated as concrete suffering rather than abstract purity;
6. the **scale revelation** that widens the map without making local actors irrelevant.

This is a mechanism, not a theme collage. The patron's method must produce the exclusion. Resistance must preserve one good while endangering another.

## Disciplined canon uncertainty

The evidence ledger uses one of four tiers:

- `settled-canon`
- `contested-canon`
- `faction-doctrine`
- `story-facing-unknown`

It also declares the venue that can certify the claim, the legitimacy at stake, the consequences of accepting the claim, and what happens if it is false. Each receipt carries the intervention that made it visible and its limits; provenance is part of the evidence.

## Cast and receipts

A valid pocket contains characters responsible for all five functions:

- depends on the controlling system;
- translates or represents the excluded actor;
- holds evidence whose verification changes the world;
- benefits from delay;
- becomes a sovereign exception capable of invalidating the model.

Factions carry both a public good and a characteristic failure. A faction cannot enter the compiler as a moral color without receipts for suffering its method prevents.

## Story physics

All eight invariants are required and true: no clean reset; Crowning is concentration; the Answer reflects exclusion; the Counterform inherits the claim; scale is distributed; distance remains political; faction receipts are required; every victory changes the map.

## Compilation

The compiler produces engine version 1.2 Arcs with:

- exact named founding cast;
- fixed Godscar attributes and role vocabulary;
- arrival, disclosure, and refusal progression tiers;
- authored access milestones between beats;
- an authored opening control decision;
- an `arc_complete` event that names inherited consequences;
- the complete source in the content-addressed extension.

No executable plugin code is accepted. Extensions are recursive JSON and namespaced with an explicit version suffix.

## Reference artifacts

- `cartridges/kind-gods-of-ilyon.pocket.json` — editable creator source.
- `cartridges/kind-gods-of-ilyon.arc.json` — compiled standalone cartridge.
- `npm run build:godscar-reference` — rebuild both from the checked-in compiler.
