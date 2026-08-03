# Burn Protocol owner/private custody harvest

## Purpose

This workflow is the authoritative broad-custody companion to the compatibility harvester. It preserves the bounded public-owner sweep introduced at the `E05-C1-P01` frontier and adds explicit best-effort discovery across connected private repositories without weakening source-absence law.

It changes discovery only. It does not add Episode 5 source, title, chapter extent, canonical text, media bytes, a Burn amendment, an Arc publication, or a World receiver.

## Canonical frontier

```text
E04-C3-P60 → E05-C1-P01
```

Only this exact parent may grant source standing:

```text
Star_Trek_Discovery_The_Burn_Protocol_Web_Series_v0.62.0.zip
641,627,846 bytes
sha256:f67dcd2c632720566e38b04c0a6b844188de24c967a77a4be31978a5ff82349a
```

Repository identities, artifact names, release names, URLs, and filenames are discovery hints only. A retained recovery packet family is also a candidate, but internal consistency does not grant source standing. `verify_packet_set.py` computes its exact identity, and only an independently supplied packet-set SHA-256 may grant transport standing.

## Required public custody

The default required scope is resolved by `resolve_owner_scope.py` from:

```text
explicit anchors
  BigBirdReturns/axm-arc
  BigBirdReturns/axm-world

bounded public owner estate
  owner: BigBirdReturns
  maximum repositories: 100
```

The resolver uses GitHub’s public owner repository listing, deduplicates it with the explicit anchors, and emits a deterministic scope receipt. Failure to enumerate the owner estate is fatal. A partial required scope can never produce `source-not-found`.

## Best-effort private custody

The default best-effort repositories are:

```text
BigBirdReturns/axm-chat
BigBirdReturns/spectra-genesis
BigBirdReturns/axm-bloodstream
BigBirdReturns/chatgpt-web
```

These may require the optional `BURN_SOURCE_TOKEN` repository secret. Inaccessible private discovery is retained under `optionalDiscoveryErrors` and remains outside required-scope source-absence authority. An accessible private repository may supply the exact parent and is inspected under the same byte ceilings, transport law, nested-ZIP limits, and exact-parent checks as public custody.

## Execution surfaces

`.github/workflows/burn-protocol-owner-private-source-harvest.yml` runs:

```text
every twelve hours at minute 47
on qualifying main pushes
through GitHub-native workflow dispatch
```

Dispatch inputs and repository variables can replace the defaults:

```text
BURN_SOURCE_REPOSITORIES
BURN_SOURCE_OWNERS
BURN_SOURCE_OPTIONAL_REPOSITORIES
BURN_APPROVED_PACKET_SET_SHA256S
```

The packet-set variable and matching `approved_packet_set_sha256s` dispatch input accept comma-separated exact identities. They are external approval records. The workflow does not promote a packet set using a digest learned from the same candidate.

No workstation checkout, local command, or manual file movement is required.

## Receipt law

The uploaded audit combines:

```text
owner scope receipt
resolved required repository list
optional repository list
candidate outcomes
downloaded byte count
required discovery errors
optional discovery errors
transport failures
exact-parent recovery packets, when present
packet-set candidate identities and standing
approved packet-set verification, when present
SHA256SUMS
```

Statuses are:

```text
verified-frontier-evidence
  exact parent admitted and every contracted E05C1 evidence requirement is present

source-required
  exact parent admitted, but one or more E05C1 evidence requirements remain absent

verified-frontier-packet-set
  an externally pinned packet family passed complete byte verification and carries verified frontier evidence

source-required-packet-set
  an externally pinned packet family passed complete byte verification, but its underlying recovery remains incomplete

packet-set-approval-required
  a complete packet family was found and identified, but no external approval pin grants transport standing

source-not-found
  public owner scope resolved completely, every selected required candidate downloaded and inspected, and no exact parent matched; inaccessible optional repositories remain explicitly outside this claim

harvest-error
  owner resolution, required discovery, download, nested inspection, or workflow execution was incomplete
```

A transport or owner-resolution failure can never appear as source absence.

Every production run posts an addressable summary to issue #212 and uploads the authoritative artifact `burn-protocol-owner-private-source-harvest`.

## Qualification

The permanent suite proves:

```text
explicit anchor and owner-estate union
owner listing deduplication
owner enumeration refusal
scope output non-overwrite
public artifact and release discovery
private best-effort discovery gaps
accessible private exact-parent recovery
GitHub artifact media negotiation
cross-origin credential stripping
transport failure law
nested landing-kit recovery
exact-parent and manifest verification
packet-set identity, payload, wrapper, and external-approval law
packet-set discovery without parent restaging
E05C1 exact-path contract
```

The inherited `E03-C2-P31` source-required media record remains outside this discovery transaction and must remain intact in every future publication.
