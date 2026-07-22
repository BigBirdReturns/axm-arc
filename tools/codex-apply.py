from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one marker in {path}, found {count}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    "docs/COMMON_SHIP_POCKET_FORMAT.md",
    '''`compileCommonShipPocket()` produces an engine `1.2.0` Arc with:

- domain `godscar-common-ship`;
- exact creator identity and named cast;
- the four compiled movements;
- milestone-gated watches;
- an opening choice between marking the baseline and accepting a bounded emergency baseline;
- persistent completion rewards naming the changed constitution;
- the exact source under `godscar.common-ship@1`.''',
    '''`compileCommonShipPocket()` produces an engine `1.3.0` Arc with:

- domain `godscar-common-ship`;
- exact creator identity and named cast;
- the four compiled movements;
- milestone-gated watches;
- all eight ship-state tracks as bounded, engine-owned state definitions;
- every embodiment profile as a deterministic composition profile;
- founder-to-profile bindings and the six Common Watch viability categories as authored composition constraints;
- exact success-state effects with before-and-after receipts;
- an opening choice between marking the baseline and accepting a bounded emergency baseline;
- persistent completion rewards naming the changed constitution;
- the exact source under `godscar.common-ship@1`.''',
)
replace_once(
    "docs/COMMON_SHIP_POCKET_FORMAT.md",
    '''This source plane encodes the Codex into executable law. It does **not** yet claim:

- a canonical Common Ship reference campaign;
- a dedicated guided Watch Forge UI;''',
    '''This source plane now compiles its state and composition law through engine 1.3. It does **not** yet claim:

- a canonical Common Ship reference campaign;
- a dedicated guided Watch Forge UI;''',
)

replace_once(
    "docs/DARK_TOMB_POCKET_FORMAT.md",
    '''`compileDarkTombPocket()` produces an engine `1.2.0` Arc with:

- domain `godscar-dark-tomb`;
- exact creator identity and named cast;
- the four compiled movements;
- milestone-gated delves;
- an opening choice between preserving the Alarm and authorizing a bounded breach;
- persistent completion rewards naming the changed map;
- the exact source under `godscar.dark-tomb@1`.''',
    '''`compileDarkTombPocket()` produces an engine `1.3.0` Arc with:

- domain `godscar-dark-tomb`;
- exact creator identity and named cast;
- the four compiled movements;
- milestone-gated delves;
- Long Alarm, signature credibility, and external visibility as engine-owned state;
- one exact boolean state for every authored inherited consequence;
- success-state effects that write the changed Alarm, signature, visibility, and consequence record with before-and-after receipts;
- an opening choice between preserving the Alarm and authorizing a bounded breach;
- persistent completion rewards naming the changed map;
- the exact source under `godscar.dark-tomb@1`.''',
)
replace_once(
    "docs/DARK_TOMB_POCKET_FORMAT.md",
    '''This source plane encodes the Codex into executable law. It does **not** yet claim:

- a canonical Dark Tomb reference campaign;''',
    '''This source plane now compiles its persistent Tomb state through engine 1.3. It does **not** yet claim:

- a canonical Dark Tomb reference campaign;''',
)

replace_once(
    "docs/COMMON_SHIP_EMBODIMENT_PROFILES.md",
    '''The watch still records prose requirements for bodies, habitats, clocks, translators, reserves, and life-fraction costs. Gate 1 converts the profile references and those requirements into deterministic composition constraints. Gate 0 establishes the source authority first so the engine and receiver do not invent body law independently.''',
    '''The watch still records prose requirements for bodies, habitats, clocks, translators, reserves, and life-fraction costs. Engine 1.3 now converts the declared profile references into deterministic composition profiles and the six Common Watch viability categories into authored constraints. Arc owns that evaluation. A receiver may display the result but may not invent body law independently.''',
)

replace_once(
    "STATUS.md",
    '''- `product-parity.yml` and World's `bundled-parity.yml` make the completion
  boundary executable rather than rhetorical.

See `docs/PARITY_COMPLETION.md`.''',
    '''- `product-parity.yml` and World's `bundled-parity.yml` make the completion
  boundary executable rather than rhetorical.
- RODOH Gate 0 is closed: the First Charter Hall production slice is merged, the
  Book III source carries structured embodiment and lineage profiles, and World
  owns the frozen five-reference RODOH 1.0 acceptance contract.
- RODOH Gate 1 is closed on the Arc side. Engine 1.3 adds bounded cartridge state,
  exact state-change receipts, declarative composition profiles and constraints,
  shared direct/cycle enforcement, and save-v2 to save-v3 migration.
- Dark Tomb now compiles Long Alarm, signature, visibility, and inherited
  consequences into engine-owned state. Common Ship now compiles its eight ship
  tracks and six watch-viability categories into executable state and composition
  law.
- World remains on the accepted three-cartridge Arc pin until the separate Gate 2
  reconciliation and receiver train. Source-plane completion does not imply a
  bundled Lamp District or Relief Circuit runtime.

See `docs/PARITY_COMPLETION.md` and `docs/ENGINE_1_3_STATE_COMPOSITION.md`.''',
)

replace_once(
    "README.md",
    '''The current browser product is governed by `docs/PARITY_COMPLETION.md`: engine,
custody, complete reference campaigns, authoring, responsive World expression,
local pixel/vector assets, bilingual chrome, sensory preferences, and access
fallbacks are protected by dedicated Arc and World parity workflows. Multiplayer,
cloud sync, marketplace, publisher signing, cinematic media, and authored-content
translation packs are separate future products rather than hidden prerequisites.''',
    '''The current browser product is governed by `docs/PARITY_COMPLETION.md`: engine,
custody, complete reference campaigns, authoring, responsive World expression,
local pixel/vector assets, bilingual chrome, sensory preferences, and access
fallbacks are protected by dedicated Arc and World parity workflows. Engine 1.3
adds bounded creator-authored state and declarative composition law for Dark Tomb
and Common Ship source planes; see `docs/ENGINE_1_3_STATE_COMPOSITION.md`.
Multiplayer, cloud sync, marketplace, publisher signing, cinematic media, and
authored-content translation packs are separate future products rather than
hidden prerequisites.''',
)
replace_once(
    "README.md",
    '''| **Engine** | `src/engine/` | Generic deterministic simulation. Resolver, stress/morale/affliction cascade, relationship state machine, drama event cards, reward distribution (Council mode), infrastructure tick, recruitment, save/load. Content-free — zero imports from `src/arcs/`. |
| **Arc format** | `src/arcs/` | Portable JSON scenario definitions. The tutorial arc "The First Charter" ships here: 4 attributes, 3 roles, 3 tiers, 6 challenges across 2 progression tiers, 8 items, 6-agent starting roster with a seeded rivalrous pair. |''',
    '''| **Engine** | `src/engine/` | Generic deterministic simulation. Resolver, stress/morale/affliction cascade, relationship state machine, drama event cards, bounded cartridge state, declarative composition, recruitment, save/load, and exact receipts. Content-free — zero imports from `src/arcs/`. |
| **Arc format** | `src/arcs/` | Portable JSON scenario definitions. The tutorial arc "The First Charter" ships here: 4 attributes, 3 roles, 3 tiers, 6 challenges across 2 progression tiers, 8 items, 6-agent starting roster with a seeded rivalrous pair. |
| **Godscar source planes** | `src/godscar/`, `src/dark-tomb/`, `src/common-ship/` | Creator-owned Pocket, Dark Tomb, and Common Ship source grammars and compilers. Book II and Book III project their persistent state and roster constraints through engine 1.3 rather than receiver law. |''',
)
replace_once(
    "README.md",
    '''**Content-free engine.** No domain knowledge is hardcoded. The engine processes agents, attributes, challenges, and relationships. The arc and the game layer provide all domain specifics.

**Offline-first save.** Versioned JSON in localStorage (`axm-arc:save:v1` for game state, `axm-arc:intent:v1` for the player's cycle intent note). Migration dictionary for future versions. Arc-ID mismatch throws. Your decisions persist across sessions and survive indefinitely.''',
    '''**Content-free engine.** No challenge, role, lineage, state-track, or domain vocabulary is hardcoded. The engine processes authored actors, attributes, challenges, bounded state, and declarative composition profiles. The Arc and optional game policy provide domain specifics.

**Cartridge state.** Engine 1.3 initializes creator-declared number, enum, and boolean state, validates bounded effects, and writes exact before-and-after receipts into the run report and cycle event stream.

**Composition law.** Engine 1.3 evaluates bounded role, profile, tag, metric, range, fraction, redundancy, `all`, and `any` constraints through one deterministic authority used by both direct resolution and the full cycle.

**Offline-first save.** Versioned, digest-bound JSON persists locally. Save v3 migrates exact-identity v2 saves and deterministically backfills any state declared by the bound cartridge; pre-digest v1 saves remain refused rather than relabelled. Arc-ID or digest mismatch throws. Your decisions persist across sessions and remain exportable.''',
)

workflow = Path(".github/workflows/gate1-diagnostics.yml")
if workflow.exists():
    workflow.unlink()
else:
    raise SystemExit("Expected temporary Gate 1 diagnostics workflow to exist")

print("Applied final Gate 1 documentation and workflow cleanup.")
