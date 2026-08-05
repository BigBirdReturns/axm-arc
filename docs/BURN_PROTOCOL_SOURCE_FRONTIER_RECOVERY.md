# Burn Protocol source-frontier recovery

## Current boundary

The landed Arc authority is accepted through:

```text
Episode 5: Nursery World
Chapter 2: The Mother
E05-C2-P21 through E05-C2-P40
```

The exact next canonical position is `E05-C3-P41`. No Chapter 3 title, terminal panel, panel count, plate count, canonical expression, plate composition, or source byte is admitted by the continuation identifier.

## Singular active authority

The repository records the active frontier in:

```text
tools/burn-protocol-source-frontier/active-frontier.json
```

That record binds:

```text
frontier      E05-C3-P41
contract      tools/burn-protocol-source-frontier/contracts/e05c3-source-intake.contract.json
workflow      .github/workflows/burn-protocol-e05c3-source-harvest.yml
issue ledger  BigBirdReturns/axm-arc#212
```

`.github/workflows/burn-protocol-source-frontier.yml` qualifies the complete recovery, transport, packet, refusal, and active-authority suite on Ubuntu and Windows. The E05C3 workflow is the only scheduled, landing-push, dispatchable, or issue-publishing source sweep.

## Pinned parent authority

```text
basename  Star_Trek_Discovery_The_Burn_Protocol_Web_Series_v0.62.0.zip
bytes     641627846
sha256    f67dcd2c632720566e38b04c0a6b844188de24c967a77a4be31978a5ff82349a
manifest  v0.62.0-file-manifest.json
```

A name, path, repository, artifact title, release title, or URL is a discovery hint only. Exact byte count and SHA-256 are mandatory before the parent manifest may grant custody standing.

## E05C3 contract

The active contract requires exact manifest receipts for the Episode 5 source pair and A05C3 family, including the opening panel `E05-C3-P41` and opening plate `A05C3-plate-01`. The Episode 5 script remains required through the manifest-selected `canonical-script-render` classification; its filename is not inferred.

`recover.py` verifies the complete parent, ZIP safety, one authoritative manifest, unambiguous record structure, exact expected paths and classifications, and every emitted byte count and SHA-256. `verify_packet_set.py` independently checks recovery envelopes, selected manifest membership, packet declarations, and payload bytes. Internal consistency alone never grants approval.

## Promotion sequence

```text
active autonomous sweep
  → exact parent or independently approved E05C3 packet set
  → byte-verified E05C3 evidence family
  → separately reviewed burn-protocol/1 amendment
  → deterministic Arc publication
  → unchanged World SequenceHost receiver
```

The inherited `asset:E03-C2-P31` source-required media refusal remains outside this transaction and must survive every later publication unless an exact canonical digest is independently admitted.
