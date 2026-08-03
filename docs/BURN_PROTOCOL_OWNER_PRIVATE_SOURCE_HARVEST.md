# Burn Protocol public-owner and private custody harvest

## Supersession

The broad public-owner/private-best-effort mechanism remains active inside the singular frontier workflow:

```text
retired  .github/workflows/burn-protocol-owner-private-source-harvest.yml
retired  .github/workflows/burn-protocol-autonomous-source-harvest.yml
retired  .github/workflows/burn-protocol-e05c2-source-harvest.yml
active   .github/workflows/burn-protocol-e05c3-source-harvest.yml
record   tools/burn-protocol-source-frontier/active-frontier.json
```

The retired workflows were pinned to completed canonical positions. Keeping them scheduled beside the current frontier produced duplicate downloads and stale issue #212 receipts. Git history and retained artifacts preserve their evidence; they have no current execution authority.

## Active scope

The sole active workflow deterministically unions:

```text
explicit required anchors
  BigBirdReturns/axm-arc
  BigBirdReturns/axm-world

bounded public owner estate
  BigBirdReturns
  maximum 100 repositories by default

best-effort private custody
  BigBirdReturns/axm-chat
  BigBirdReturns/spectra-genesis
  BigBirdReturns/axm-bloodstream
  BigBirdReturns/chatgpt-web
```

Owner enumeration or required repository discovery failure is fatal. An inaccessible optional repository is retained under `optionalDiscoveryErrors` and cannot be silently counted as searched. Accessible private objects receive the same transport, nested-archive, byte-ceiling, exact-parent, and packet-set checks as public objects.

## Current frontier and parent

```text
accepted through  E05-C2-P40
active frontier   E05-C3-P41
```

Only this parent may grant parent standing:

```text
Star_Trek_Discovery_The_Burn_Protocol_Web_Series_v0.62.0.zip
641,627,846 bytes
sha256:f67dcd2c632720566e38b04c0a6b844188de24c967a77a4be31978a5ff82349a
```

A transport or owner-resolution failure can never appear as source absence. Packet approval remains independent and grants transport standing only. Neither the sweep nor its receipt can author Chapter 3, canonical expression, media custody, or a `burn-protocol/1` amendment.
