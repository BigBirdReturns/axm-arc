# Burn Protocol autonomous source harvest

## Purpose

The Burn source frontier no longer depends on a person running a command on a particular workstation. The repository owns a scheduled and dispatchable GitHub Actions harvester that searches remote custody, verifies the exact parent estate, and invokes the landed fail-closed E04C2 recovery authority when the parent appears.

The mechanism does not weaken the source boundary. It removes a transport dependency, not an evidence requirement.

## Exact authority

Only this parent can authorize the current source frontier:

```text
Star_Trek_Discovery_The_Burn_Protocol_Web_Series_v0.62.0.zip
641,627,846 bytes
sha256:f67dcd2c632720566e38b04c0a6b844188de24c967a77a4be31978a5ff82349a
```

The continuation remains:

```text
E04-C1-P20 → E04-C2-P21
```

Artifact names, release titles, repository paths, URLs, and filenames are discovery hints only. Every candidate is delegated to `recover.py`, which verifies the complete parent byte count and SHA-256 before reading its authoritative manifest or emitting a packet.

## Autonomous surfaces

`.github/workflows/burn-protocol-autonomous-source-harvest.yml` runs every twelve hours after landing. It can also be dispatched through GitHub Actions without a local checkout.

The default sweep covers:

```text
BigBirdReturns/axm-arc
BigBirdReturns/axm-world
```

For each repository it inspects recent, non-expired:

```text
GitHub Actions artifacts
GitHub release assets
```

Candidate names are bounded by a Burn/source/estate/handoff/frontier filter before any download. The workflow also accepts exact Actions artifact IDs and release asset IDs in `owner/repo:id` form, so a known remote object can bypass listing and be examined directly. Downloaded artifacts are searched through bounded nested ZIP layers, allowing a parent estate inside a landing kit or retained source package to be recovered without restaging it.

The ordinary repository token is used by default. A repository secret named `BURN_SOURCE_TOKEN`, when present, is preferred for cross-repository private-artifact access. Absence of that optional token does not alter the evidence law; inaccessible repositories are recorded in the harvest receipt.

## Download and credential boundary

The harvester:

```text
limits each candidate to 1 GiB by default
limits one sweep to 4 GiB by default
streams downloads instead of buffering them in memory
records every refusal or inaccessible remote object
never places bearer credentials in receipts
strips Authorization and Proxy-Authorization on cross-origin redirects
refuses HTTPS-to-HTTP redirect downgrade
permits plain HTTP only for loopback qualification fixtures
```

GitHub artifact downloads redirect to signed object-storage URLs. Cross-origin credential stripping is a tested security property rather than an assumption.

## Result law

Every completed sweep writes:

```text
burn-protocol-source-harvest/HARVEST_RECEIPT.json
burn-protocol-source-harvest/SHA256SUMS
```

When the exact parent is found, the output also contains the complete `recover.py` result under:

```text
burn-protocol-source-harvest/recovery/
```

Statuses are:

```text
verified-frontier-evidence
  exact parent admitted and the contracted E04C2 evidence family is present

source-required
  exact parent admitted, but the required evidence family remains incomplete

source-not-found
  the remote sweep completed and no candidate matched the exact parent

harvest-error
  remote enumeration, download, or workflow execution failed before a normal receipt
```

A scheduled `source-not-found` sweep remains green and auditable. It is not a human action item and does not authorize inferred Chapter 2 content. A manually dispatched run can set `require_source=true` to retain the same receipt while making absence a failing control signal.

## Qualification

The harvester and recovery authority use only the Python standard library. Their combined suite runs on Ubuntu 24.04 and hosted Windows and proves:

```text
direct exact-parent recovery
nested handoff recovery
deterministic packet reproduction
sub-limit packet splitting
source-required classification
manifest and ZIP-path refusal law
recursive local candidate sweep
GitHub Actions artifact discovery and download
explicit artifact lookup without listing
explicit release-asset lookup
candidate, nested-archive, and total download ceilings
bounded recursive landing-kit inspection
cross-origin bearer-token stripping
audited source absence
```

No production Burn source, private media byte, inferred chapter title, inferred panel count, or inferred continuity is committed by this mechanism.
