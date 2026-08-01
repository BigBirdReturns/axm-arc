# Burn Protocol handoff publication activation

## Classification

This stacked transaction joins two already separate authorities without collapsing them. Arc continues to own the authored `common-ship-pocket/1` source and the calibrated Engine 1.3 cartridge identity. Exact handoff intake owns custody of the private v0.58.0 estate, A13C1 production evidence, and the manifest-derived visual index. The activation overlay records their verified relationship while leaving the authored Arc bytes unchanged.

The production publication authority is:

```text
axm-arc publication head
4b076089f9b7ae1949ba8fac45f2373aeeb5b344

cartridge identity
cart1_870f3dfcab909fc9aace115e2c46cd30268339f80bc87a14f0eebcc4e2c28c3e
```

The exact handoff contract remains:

```text
Burn_Protocol_FRESH_SESSION_HANDOFF_v0.58.0_A13C1.zip
363,384,929 bytes
24 ZIP entries
e96874ca4c753f49eed1c6ecf5db7f924ad4bfa006e242bf426319345dfaedde

Star_Trek_Discovery_The_Burn_Protocol_Web_Series_v0.58.0.zip
353,717,668 bytes
1,986 ZIP entries
b3b299e14d8c22cde88629eb6bc4d197b8f8015eec7bf46b95f0de2a31b5f0df
```

## Authority separation

The publication source still states that inherited history is read-only, generated runs are counterfactual-only, story changes are none, and panel payloads are not present in the authored cartridge. Exact intake may establish that panel and plate bytes exist under external custody, but it cannot insert those bytes into the Arc, change the cartridge digest, or convert a generated Rodoh run into canonical history.

The activation contract therefore distinguishes the authored boundary from supplemental custody:

```text
authored Arc payloads       not-present
verified external custody   manifest-indexed after exact intake
runtime bundling            none
cartridge identity          unchanged
```

## Approval mechanism

`tools/build-burn-protocol-publication-approval.mjs` accepts only a passing `burn-protocol-handoff-intake-receipt/1`, its exact manifest-derived asset index, and the intake contract that produced the receipt. It verifies the contract hash, handoff identity, parent identity, manifest counts, authority record, asset paths, asset hashes, classifications, and recomputed classification counts. It then emits `burn-protocol-handoff-publication-approval/1` with content hashes for the receipt, index, and intake contract, plus an integrity digest over the approval core.

The approval is a transfer record between two workflow stages. It is not a publisher signature and does not replace the retained Actions artifact or its custody history.

## Activation mechanism

`tools/activate-burn-protocol-handoff-publication.mjs` requires the activation contract, approval, original intake receipt, original asset index, original intake contract, and exact Arc publication directory. It independently rechecks the approval hashes and integrity, verifies the publication receipt against every source, corpus, and Arc byte, recomputes the cartridge digest using Engine 1.3 codepoint ordering and reserved-envelope-key law, and confirms that the Arc carries the exact Common Ship source extension.

A passing production activation emits:

```text
burn-protocol-handoff-publication-overlay.json
handoff-publication-activation-receipt.json
```

The overlay classifies the verified estate as external custody attached to the existing cartridge identity. World or another receiver may later consume that overlay as a custody record, but it must fetch and verify individual assets from a separately approved payload channel before rendering them.

## Production command

After the exact handoff has passed intake, the publication bridge is:

```bash
node tools/build-burn-protocol-publication-approval.mjs \
  --intake-receipt /path/to/intake/handoff-intake-receipt.json \
  --asset-index /path/to/intake/corpus-asset-index.json \
  --intake-contract docs/contracts/burn-protocol-v0.58.0-a13c1-handoff.contract.json \
  --output /path/to/intake/handoff-publication-approval.json

node tools/activate-burn-protocol-handoff-publication.mjs \
  --activation-contract docs/contracts/burn-protocol-handoff-publication.activation.json \
  --approval /path/to/intake/handoff-publication-approval.json \
  --intake-receipt /path/to/intake/handoff-intake-receipt.json \
  --asset-index /path/to/intake/corpus-asset-index.json \
  --intake-contract docs/contracts/burn-protocol-v0.58.0-a13c1-handoff.contract.json \
  --publication-dir /path/to/calibrated/publication \
  --output /path/to/activation
```

The production activation contract requires the exact handoff and exact v0.58.0 parent. A structurally valid fixture, renamed archive, altered receipt, changed asset index, different parent, or modified Arc publication cannot satisfy it.

## Mechanism qualification

The dedicated workflow uses the previously qualified deterministic handoff fixture, derives an approval from its passing intake output, and creates an activation contract explicitly classified as `mechanism-fixture`. The fixture overlay must retain the calibrated Arc digest, preserve `panelPayloads: not-present`, keep runtime bundling at `none`, and classify its one fixture panel only as fixture custody.

The workflow then proves four refusal boundaries:

```text
fixture approval under production contract    refused
intake receipt changed after approval          refused
asset index changed after approval             refused
Arc publication changed after receipt          refused
```

This qualification demonstrates the bridge mechanism. It does not satisfy the production activation contract because the fixture handoff and nested parent identities differ from the exact Burn contract.

## Evidence boundary

The evidence tier is mechanism-qualified; the venue is the stacked Arc activation branch; the target is a passing approval derived from the exact 363,384,929-byte handoff; the upside is a stable external-custody overlay that World can consume without changing authored law; the downside is that no production asset may yet render; the failure mode is allowing fixture, stale, altered, or independently rewritten custody records to acquire production standing.

The control question for the next receiver transaction is whether World can expose verified external Burn assets through a holder-controlled browser without bundling the estate, weakening per-asset hash checks, or allowing the presentation layer to acquire authority over the authored record.
