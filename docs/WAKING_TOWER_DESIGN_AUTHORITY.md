# The Waking Tower design authority

## Status and name

**The Waking Tower** is the authoritative player-facing identity of AXM's second bundled cartridge. The string `karazhan` remains only as a compatibility id, historical file name, and stable persistence key. It is not a license to restore donor fiction, trademarked names, or an older presentation architecture.

## Source authority

Current Arc `main` owns the authored cartridge and engine-facing compatibility boundary:

- `src/arcs/karazhan.ts` contains the exact Arc source. Its `meta.name` and all player-facing content are original Waking Tower fiction.
- `src/game/karazhan-theme.tsx` contains cartridge-owned Arc-player presentation.
- `src/game/styles/cartridge-themes.css` contains the Waking Tower material treatment under the compatibility scope `data-cartridge="karazhan"`.
- `tests/game/product-parity.test.ts` forbids the retired donor vocabulary from returning to player-facing fields.
- `DESIGN.md` remains the system design authority for the engine and large-roster stress-cartridge role.

The compatibility id must remain stable until a separately versioned migration updates saved runs, active-library selection, World vendoring, and every digest-bearing custody receipt together. A cosmetic rename of the internal id would break custody without improving the product.

## World projection authority

The accepted three-cartridge World release is the squash merge `axm-world@24d238302d659264552bc002b73aaf3592c1f84e`, sourced from `axm-arc@ac3c4f620cf5df802567c7dd10d3ee972cabfa46`. Its Waking Tower projection owns the current browser parity expression across Board, Map, Hall, Encounter, Aperture, Globe, cartridge bay, guided entry, and cartridge object.

World's governed art-direction reference remains `docs/design/KARAZHAN_ASSET_BIBLE.md` in `axm-world`. The legacy file name is a compatibility pointer. The document's production subject is The Waking Tower. Reference boards, inline SVG motifs, CSS palettes, and code-native grids are direction and current local-first expression; they are not evidence of a substantial standalone production asset library.

## Release boundary

The current World release contains The First Charter, The Waking Tower, and The Kind Gods of Ilyon. Dark Tomb is a subsequent Arc source-plane lane and must not be inferred into that three-cartridge World boundary.

## Change control

A Waking Tower change is authoritative only when it preserves exact cartridge custody, passes Arc schema and campaign validation, keeps player-facing fiction free of retired donor vocabulary, and passes the corresponding World drift and browser gates when projection bytes change. Historical branches may donate a small coherent improvement, but they are never merge targets for reviving the pre-convergence architecture.
