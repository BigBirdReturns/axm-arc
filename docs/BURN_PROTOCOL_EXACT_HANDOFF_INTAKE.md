# Burn Protocol exact handoff intake

## Classification

This surface receives the reported `v0.58.0 → A13C1` fresh-session handoff without weakening the existing metadata-only publication boundary. It does not store the archive in Git, infer missing pixels, accept a similarly named substitute, or promote a generated Rodoh run into canonical history.

The exact handoff contract is pinned to:

```text
Burn_Protocol_FRESH_SESSION_HANDOFF_v0.58.0_A13C1.zip
363,384,929 bytes
24 ZIP entries
e96874ca4c753f49eed1c6ecf5db7f924ad4bfa006e242bf426319345dfaedde
```

The nested parent contract is pinned to:

```text
Star_Trek_Discovery_The_Burn_Protocol_Web_Series_v0.58.0.zip
353,717,668 bytes
1,986 ZIP entries
b3b299e14d8c22cde88629eb6bc4d197b8f8015eec7bf46b95f0de2a31b5f0df
```

The nested deterministic manifest must verify 1,985 payload files and 383,401,783 uncompressed bytes. The outer manifest must verify the other 23 handoff payloads.

## Verification transaction

`tools/verify-burn-protocol-handoff.mjs` performs the intake as one refusal-oriented transaction:

```text
hash and size the supplied handoff
  → reject unsafe, absolute, duplicated, or parent-traversing ZIP paths
  → run ZIP integrity testing
  → require exactly 24 outer entries
  → discover and verify the 23-record outer manifest
  → require every named release, visual, audit, lineage, and contract payload
  → verify the nested parent archive and its checksum receipt
  → run nested ZIP integrity testing
  → require exactly 1,986 parent entries
  → verify every byte named by the 1,985-record parent manifest
  → locate the v0.58.0 and A13C1 state pointer
  → inspect the A13C1 production-contract boundary
  → confirm the corpus validation record carries the sealed counts
  → emit an intake receipt and corpus asset index
```

The verifier accepts stored or deflated ZIPs supported by the platform `unzip` implementation. It extracts only after validating every entry name against ZIP-slip paths. Manifest discovery is structural: the outer manifest must contain exactly 23 path, SHA-256, and byte records, while the nested manifest must contain exactly 1,985 such records. Every record is then rehashed from the extracted file.

## Usage

Run from the repository root on a machine with Node and `unzip`:

```bash
node tools/verify-burn-protocol-handoff.mjs \
  --handoff /absolute/path/Burn_Protocol_FRESH_SESSION_HANDOFF_v0.58.0_A13C1.zip \
  --output /absolute/path/burn-protocol-handoff-intake
```

The default contract is `docs/contracts/burn-protocol-v0.58.0-a13c1-handoff.contract.json`. A different contract may be passed only for a fixture or a separately versioned handoff:

```bash
node tools/verify-burn-protocol-handoff.mjs \
  --handoff /path/to/fixture.zip \
  --contract /path/to/fixture.contract.json \
  --output /path/to/fixture-output
```

A successful exact run emits:

```text
handoff-intake-receipt.json
corpus-asset-index.json
```

The receipt binds the handoff, outer manifest, executable verifier entry, nested parent, parent manifest, production contract, state-pointer evidence, and authority boundary. The asset index is derived from the verified nested manifest. It does not itself license or publish any image.

## Qualification without the private payload

The repository workflow builds a deterministic miniature handoff with the same structural relationships: twenty-four outer entries, one nested parent ZIP, a parent checksum receipt, an outer manifest excluding itself, a nested manifest excluding itself, a production contract, a state pointer, validation evidence, and an executable verifier. It then proves positive intake and three refusal cases:

```text
changed outer byte        refused by handoff SHA-256
unsafe ZIP entry          refused before extraction
changed manifested file   refused by manifest SHA-256
```

This fixture qualifies the verifier mechanism. It does not qualify the reported 363,384,929-byte handoff, because that exact archive is not currently present in the repository, connected Drive, or this runtime.

## Authority boundary

Before exact intake succeeds:

```text
inherited history  metadata-supported, read-only
live runs           counterfactual-only
story changes       none
panel payloads      absent
```

After exact intake succeeds, the panel and plate payloads may become verified source material for a dedicated World presentation pack. Their canonical status remains inherited from the sealed estate, while Rodoh outcomes remain counterfactual unless a later authored transaction explicitly changes that law.
