from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one marker in {path}, found {count}: {old[:100]!r}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    "README.md",
    "The first arc is a guild management game. The bundled campaigns are **The First Charter**, **The Waking Tower**, and **The Kind Gods of Ilyon**.",
    "The first arc is a guild management game. The Arc browser product now bundles **The First Charter**, **The Waking Tower**, **The Kind Gods of Ilyon**, and the first Book II campaign, **The Lamp District**. Rodoh World remains on its separately accepted three-cartridge player boundary until the Underworld receiver ships.",
)
replace_once(
    "README.md",
    "fallbacks are protected by dedicated Arc and World parity workflows. Engine 1.3\nadds bounded creator-authored state and declarative composition law for Dark Tomb\nand Common Ship source planes; see `docs/ENGINE_1_3_STATE_COMPOSITION.md`.\nMultiplayer, cloud sync, marketplace, publisher signing, cinematic media, and",
    "fallbacks are protected by dedicated Arc and World parity workflows. Engine 1.3\nadds bounded creator-authored state and declarative composition law for Dark Tomb\nand Common Ship source planes; see `docs/ENGINE_1_3_STATE_COMPOSITION.md`. The\nLamp District and Dark Tomb Forge close the Arc-side Book II campaign and\nauthoring gate; see `docs/LAMP_DISTRICT_ACCEPTANCE.md`. Multiplayer, cloud sync,\nmarketplace, publisher signing, cinematic media, and",
)
replace_once(
    "README.md",
    '| **Arc format** | `src/arcs/` | Portable JSON scenario definitions. The tutorial arc "The First Charter" ships here: 4 attributes, 3 roles, 3 tiers, 6 challenges across 2 progression tiers, 8 items, 6-agent starting roster with a seeded rivalrous pair. |',
    '| **Arc format** | `src/arcs/` | Portable deterministic scenario definitions. The four bundled references now cover the tutorial guild, large-roster campaign, Book I pocket, and Book II Dark Tomb forms. |',
)
replace_once(
    "README.md",
    "| **Godscar source planes** | `src/godscar/`, `src/dark-tomb/`, `src/common-ship/` | Creator-owned Pocket, Dark Tomb, and Common Ship source grammars and compilers. Book II and Book III project their persistent state and roster constraints through engine 1.3 rather than receiver law. |",
    "| **Godscar source planes** | `src/godscar/`, `src/dark-tomb/`, `src/common-ship/`, `src/source-planes/` | Creator-owned Pocket, Dark Tomb, and Common Ship grammars plus the one registry connecting formats, validators, compilers, starters, and exact source recovery. The Lamp District is the canonical Book II source and cartridge. |",
)
replace_once(
    "README.md",
    "| **Authoring + custody** | `src/game/`, `docs/RFC_WORKSHOP.md`, `docs/RFC_CARTRIDGE_LIBRARY.md` | Library, Workshop, writable Designer, guided/source Godscar Forge, validation, authoring QA, digest/profile, import/export, simulation, and explicit custody receipts. |",
    "| **Authoring + custody** | `src/game/`, `docs/RFC_WORKSHOP.md`, `docs/RFC_CARTRIDGE_LIBRARY.md` | Library, Workshop, writable Designer, guided/source Pocket and Dark Tomb Forges, validation, authoring QA, bounded campaign simulation, digest/profile, import/export, installation, and explicit custody receipts. |",
)
replace_once(
    "README.md",
    "| **Tests** | `tests/engine/`, `tests/game/` | Complete engine, custody, authoring, campaign, localization, sensory, and product-parity suites, including deterministic full-campaign acceptance for all bundled references. |",
    "| **Tests** | `tests/engine/`, `tests/game/`, `tests/sim/`, `tests/dark-tomb/` | Complete engine, custody, authoring, campaign, localization, sensory, and product-parity suites, including exact Lamp District artifacts, multi-seed completion, and inherited Tomb-state acceptance. |",
)
replace_once(
    "README.md",
    "| `npm run build` | Production bundle → `docs/game/` |",
    "| `npm run build` | Production bundle → `docs/game/` |\n| `npm run build:godscar-reference` | Rebuild the canonical Ilyon source and Arc artifacts |\n| `npm run build:dark-tomb-reference` | Rebuild the canonical Lamp District source and Arc artifacts |",
)
replace_once(
    "README.md",
    "The browser product now includes the playable reference loop, Arc Library,\nWorkshop authoring, digest/profile visibility, import/export custody, ledger,\nGuild Hall, and Expansion Archive.",
    "The browser product now includes the playable reference loops, Arc Library,\nWorkshop authoring, Pocket and Dark Tomb Forges, digest/profile visibility,\nimport/export custody, ledger, Guild Hall, and Expansion Archive.",
)
replace_once(
    "README.md",
    "The Waking Tower is the shipped large-roster stress cartridge after The First Charter; Ilyon proves the Godscar creator grammar on the same engine.",
    "The Waking Tower is the shipped large-roster stress cartridge after The First Charter; Ilyon proves the Book I creator grammar; The Lamp District proves Book II civic underworld play, exact inherited state, and a dedicated source Forge on the same engine.",
)

status_path = Path("STATUS.md")
status = status_path.read_text()
start = status.index("## Current overlay — 2026-07-22")
end = status.index("\n---\n\n## Previous current overlay — 2026-07-21", start)
current = """## Current overlay — 2026-07-22

**RODOH Gates 0 through 3: exact current boundary**

- The accepted local-first base remains The First Charter, The Waking Tower, and
  The Kind Gods of Ilyon in World, with complete campaign, custody,
  representation, responsive, accessibility, and production-parity receipts.
- Gate 0 is closed. The First Charter Hall production slice is merged, Book III
  carries structured embodiment and lineage profiles, and World owns the frozen
  five-reference RODOH 1.0 acceptance contract.
- Gate 1 is closed. Engine 1.3 owns bounded creator state, exact before-and-after
  receipts, declarative composition law, shared direct and cycle enforcement,
  and exact-digest save-v2 to save-v3 migration.
- Gate 2 is closed in both repositories. Arc publishes one canonical registry for
  Book I Pocket, Book II Dark Tomb, and Book III Common Ship source planes.
  World vendors the exact complete source and execution plane, checks drift
  across it, and exposes only a read-only registry-backed inspection seam.
- Gate 3 is closed on the Arc product line. **The Lamp District** is the first
  canonical Book II campaign, with editable `.tomb.json` source, exact compiled
  `.arc.json`, eight movements through Ordinary Life, Descent, Breach, and
  Return, and persistent Alarm, signature, visibility, habitat, map, and
  constituency state.
- Dark Tomb Forge now provides guided and exact-source views over the same
  `dark-tomb-pocket/1` object, local draft custody, registered compilation,
  bounded authored-founding campaign sweeps, installation, source and Arc export,
  and direct opening in the ordinary player.
- Arc product parity deterministically rebuilds Ilyon and Lamp District artifacts,
  proves their source custody, runs the focused Book I through Book III source
  contracts, executes complete campaign regressions, and builds the production
  browser product from one exact head.
- World deliberately remains on its accepted three-cartridge player release.
  It now carries Lamp District source and engine authority, but a dedicated
  Underworld hub, layered map, production art set, and desktop/mobile Lamp
  District journey remain Gate 4 rather than inferred completion.

See `docs/PARITY_COMPLETION.md`, `docs/ENGINE_1_3_STATE_COMPOSITION.md`,
`docs/SOURCE_PLANE_REGISTRY.md`, and `docs/LAMP_DISTRICT_ACCEPTANCE.md`.
"""
status_path.write_text(status[:start] + current + status[end:])
