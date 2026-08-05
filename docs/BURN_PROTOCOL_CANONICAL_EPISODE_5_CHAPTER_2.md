# The Burn Protocol through Episode 5, Chapter 2

## Classification

This transaction appends Episode 5, Chapter 2 to the landed corpus-native `burn-protocol/1` source and `axm-canonical-story/1` authority. It uses the same source-ledger implementation tier as the accepted chapters before it. It does not claim that the exact Episode 5 JSON, A05C2 lettering, chapter, panel-art, provenance, recovery, or scroll-plate bytes are present in Git.

The accepted prior extent is:

```text
E01-C1-P01 through E05-C1-P20
```

The appended fixed sequence is:

```text
Episode 5: Nursery World
Chapter 2: The Mother
E05-C2-P21 through E05-C2-P40

internal chapter seam
E05-C1-P20 ↔ E05-C2-P21

next outside continuation
E05-C3-P41
```

## Source ledger

The chapter identity and extent are supported by the accepted validation report, which identifies A05C2 as Episode 5 Chapter 2, titled `The Mother`, with twenty panels and four plates. The v0.62.0 file manifest supplies exact path, byte-count, and SHA-256 rows for the A05C2 chapter, lettering, panel-art, provenance, recovery, and plate-map records, all twenty site panel assets, and all four site plate assets.

The source-bearing records remain external and are therefore recorded with `available: false`:

```text
source/art/A05C2/chapter.json
source/art/A05C2/lettering.json
source/art/A05C2/panel-art.json
source/art/A05C2/provenance.json
manifests/a05c2-recovery.json
manifests/a05c2-scroll-plates.json
```

The autonomous E05C2 sweep remains a correct remote-custody absence receipt. It did not inspect the separately supplied source-ledger files used by this amendment, and it did not author the chapter. The amendment is grounded in those retained manifest and validation records rather than inferred from the twenty-panel convention.

## Assembly law

The chapter enters through the existing `appendBurnProtocolChapter` operation. The transaction changes no generic canonical-story type, validator, compiler, runtime, source-plane registry, cartridge identity model, or World reader.

The combined source must report:

```text
5 episodes
14 chapters
280 ordered panel positions
56 plate assets
279 exact panel asset receipts
1 inherited source-required panel asset
280 unresolved text panels
56 unresolved plate mappings
0 choices
0 challenges
0 roles
productionReady false
```

Advancing from `E05-C1-P20` must enter `E05-C2-P21` through a canonical transition receipt. Retreating from P21 must return to P20. Advancing from P40 must produce an extent-completion receipt naming `E05-C3-P41`.

## Expression boundary

Every A05C2 panel text layer remains `source-required`. The Q01 parity ledger proves that canonical, compiled, and lettering representations were compared, but it does not expose the text-bearing bytes in this repository. Captions, dialogue, sound effects, speakers, and alt text are therefore not reconstructed.

Every A05C2 plate mapping remains `source-required`. Exact plate image custody does not disclose the panel ranges encoded by the absent composition map.

The inherited media refusal remains:

```text
asset:E03-C2-P31
expected bytes: 156,208
exact SHA-256: source-required
```

## Acceptance

The Arc transaction must prove strict TypeScript, focused assembly and custody contracts, exact source-plane recovery, deterministic publication built twice, internal SHA-256 verification, complete Arc regression, production build, product parity, supply-chain evidence, and compatibility with the landed Episode 5 Chapter 1 authority.

The evidence tier is source-ledger implementation; the venue is the Episode 5 Chapter 2 Arc branch; the target is production-complete A05C2 after exact source-byte intake; the upside is another ordinary chapter assembled from the same reusable pieces; the downside is that canonical expression and plate composition remain unavailable; the failure mode is inferring text, plate ranges, or media custody, losing the inherited P31 refusal, or adding chapter-specific runtime law.

The control question is whether Episode 5 Chapter 3 can be appended through the same operation while the generic Arc authority and World reader remain unchanged.
