# AXM Compatibility Atlas — classic lineages as cartridges

Strategy in one line: **stop designing a game from scratch while designing an
ecosystem — express already-proven game loops as cartridges instead.** Every
"clone" is a conformance test of the cartridge standard: the fun is already
proven by decades of play, so a port either works (proof the engine is
expressive) or fails in a *specific* place (a motivated engine RFC, not a
design gamble). This is the same move axm-genesis makes with golden shards.

Vocabulary: a **lineage** is the mechanical skeleton of a classic game, with
none of its expression (names, art, text). Cartridges here implement lineages
with original vocabulary — mechanics are not copyrightable; expression is.
Nothing in this atlas ships anyone else's names, story, art, or data.

## The compatibility ladder

Every lineage lands in exactly one tier. The tier states its COST, honestly.

### Tier A — pure cartridge, zero code
The engine already expresses these: it is a deterministic roster-management +
probabilistic-check resolver with economy, recruitment, drama, relationships,
facilities, progression gates, loot, and seeded PRNG.

| Lineage | Loop expressed | Mapping notes |
|---|---|---|
| Raid guild (proven: **Karazhan**, clone #1) | roster → contract → checks → loot → drama | the existing reference |
| Liberation campaign / Ogre Battle 64 (proven: **The Severed March**, clone #2) | squads dispatched to strongholds; doctrine decisions accrete | chapters = progressionTiers; Law↔Chaos analog = precedents + drama basis |
| Rescue-mission dungeon (Mystery Dungeon line) | missions with role gates, recruit-on-clear, hunger economy | floors abstract to checks; hunger = upkeep |
| Live-service party RPG skeleton (FGO / Star Rail line) | roster, banners, event cadence | banners = recruitment pools; events = cycles |
| Async base war (Clash of Clans line, strategic layer) | base building + async attacks | facilities already exist (Quarters/Training/…) |

### Tier B — cartridge + world-side presentation; engine untouched
These hinge on **position**, which the engine deliberately lacks. The seam is
world's encounter-staging layer: positioning (terrain, height, weapon
triangle, lanes) becomes *modifiers on existing mechanicChecks*; the engine
still owns the deterministic outcome. Real work, but presentation-side — the
cartridge stays portable and the determinism law holds.

| Lineage | What presentation adds | What stays engine |
|---|---|---|
| Grid tactics (Fire Emblem line) | tile movement, triangle, forecast panel | check resolution, growth, permadeath-as-downed |
| Isometric tactics (Tactics Ogre / FFT line) | height, facing, turn order display | same |
| Campaign wargame (Advance Wars line) | capture map, fog display | economy, unit checks |
| Mech tactics (Front Mission line) | loadout/limb presentation | items-as-loadout, per-part checks |

### Tier C — new input layer; requires a design decision first
Real-time or skill input whose *result* maps into engine checks ("the minigame
produces the roll"). Possible under the same law, but real-time play is in
tension with same-seed-same-run — the replay/determinism question must be
answered in an RFC **before** any code.

Match-3 combat (Puzzle & Dragons line) · physics flings (Monster Strike line)
· real-time lanes (Clash Royale line) · tower defense (Arknights line) ·
action timing (Paper Mario / Mario RPG line).

### Tier D — out of scope for the cartridge standard
Full 3D open-world exploration (Genshin-line boundary case), and anything
whose core loop cannot round-trip through a deterministic check resolver
without becoming a different game. Named so nobody burns a quarter on them
by accident.

## Rules that keep this reusable for decades

1. **A clone may not change the engine.** If a lineage doesn't fit, the gap is
   written up as an engine RFC and the clone waits. The ladder tier is the
   honest price tag; moving a lineage up a tier requires the RFC, not a hack.
2. **Cartridges are data.** Tier-A clones live as importable JSON in
   `cartridges/` and load through the same import seam players use. Bundled
   arcs (`src/arcs/`) are for the tutorial surface only.
3. **Every clone ships with its conformance test** (schema-valid, digest
   computes, deterministic sim: same seed → same run, progression reachable).
   See `docs/CLONE_PORTING.md` for the protocol.
4. **Original vocabulary always.** Lineage mechanics, never expression.

Concept sheets for these lineages (the visual atlas) are owner-provided and
can be committed alongside this file as they're produced.
