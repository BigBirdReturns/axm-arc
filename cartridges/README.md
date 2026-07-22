# cartridges/

Importable Arc cartridges and their creator-owned source objects. Compiled
`.arc.json` files pass the same engine schema and import seam used by the
browser product. Source-plane files remain editable authority and compile into
ordinary Arcs without executable plugin code.

## Loading a cartridge

In the running game choose **Library → Import Arc**, then paste or upload the
`.arc.json` file. Import validates against the schema and never throws. A
successful import is recorded as `trust: "imported-unsigned"`; bundled revisions
are never overwritten by a same-id import.

## Conformance

Every compiled cartridge in this directory must validate through `ArcSchema`
and match the artifact generated from its adjacent creator source. Source-plane
round-trip, exact digest, full-campaign reachability, state inheritance, and
gate honesty are permanent tests rather than release notes.

## Book I reference

- `kind-gods-of-ilyon.pocket.json` is the creator-owned six-pressure Book I source.
- `kind-gods-of-ilyon.arc.json` is its exact compiled cartridge.
- Rebuild both with `npm run build:godscar-reference`.

## Book II reference: The Lamp District

- `lamp-district.tomb.json` is the canonical `dark-tomb-pocket/1` source.
- `lamp-district.arc.json` is the exact engine-1.3 cartridge compiled from it.
- Rebuild both with `npm run build:dark-tomb-reference`.

The Lamp District carries eight movements through Ordinary Life, Descent,
Breach, and Return. Its Long Alarm, signature credibility, visibility, and
inherited civic consequences are engine-owned state. The Dark Tomb Forge can
load the canonical source, edit the same object in guided or exact-source mode,
run bounded deterministic completion sweeps, install the compiled cartridge,
and export both artifacts.

## Dark Tomb source plane

Book II is encoded under `src/dark-tomb/` as `dark-tomb-pocket/1`. It reuses
Book I's evidence and provenance discipline, then adds the eight Tomb Engine
pressures, seven-layer anatomy, five-dimensional depth, signature budget, Long
Alarm, expedition ledger, incompatible cast responsibilities, and ten Story
Physics invariants. `DARK_TOMB_STARTER` remains a private authoring seed. The
Lamp District is the first canonical reference.

## Common Ship source plane

Book III is encoded under `src/common-ship/` as `common-ship-pocket/1`. It adds
the nine-pressure Watch Engine, seven-system vessel anatomy, structured
embodiment profiles, six-dimensional temporal profile, translation stack,
Common Watch viability tests, ship-state tracks, handoff ledgers, and Mission
Physics. `COMMON_SHIP_STARTER` remains a private authoring seed and does not yet
expand the accepted World release.
