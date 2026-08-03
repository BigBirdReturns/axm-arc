# Burn Protocol autonomous source harvest

## Purpose

The Burn source frontier does not depend on a person running a command on a particular workstation. The repository owns a scheduled, landing-push, and dispatchable GitHub Actions harvester that searches remote custody, verifies the exact parent estate, and invokes the landed fail-closed Episode 5 Chapter 1 recovery authority when the parent appears.

The mechanism removes a transport dependency, not an evidence requirement. It does not infer Episode 5’s title, chapter extent, canonical text, media custody, or continuity beyond the already authored continuation identifier.

## Exact authority

Only this parent can authorize the current source frontier:

```text
Star_Trek_Discovery_The_Burn_Protocol_Web_Series_v0.62.0.zip
641,627,846 bytes
sha256:f67dcd2c632720566e38b04c0a6b844188de24c967a77a4be31978a5ff82349a
```

The continuation is:

```text
E04-C3-P60 → E05-C1-P01
```

Artifact names, release titles, repository paths, URLs, and filenames are discovery hints only. Every candidate is delegated to `recover.py`, which verifies the complete parent byte count and SHA-256 before reading its authoritative manifest or emitting a packet.

The E05C1 contract requires exact manifest receipts for:

```text
source/episodes/episode-05.json
site/data/episode-05.json
source/art/A05C1/chapter.json
source/art/A05C1/lettering.json
source/art/A05C1/panel-art.json
source/art/A05C1/provenance.json
manifests/a05c1-recovery.json
manifests/a05c1-scroll-plates.json
site/assets/art/A05C1/panels/E05-C1-P01.webp
site/assets/art/A05C1/plates/A05C1-plate-01.webp
```

The Episode 5 script is required through the manifest-selected `canonical-script-render` classification, but its filename is not guessed because the canonical Episode 5 title is not yet admitted.

## Autonomous surfaces

`.github/workflows/burn-protocol-autonomous-source-harvest.yml` runs every twelve hours, on qualifying `main` pushes, and through GitHub-native dispatch.

The default sweep starts with the explicit Arc and World repositories and also enumerates the public repository estate owned by `BigBirdReturns`:

```text
explicit repositories
  BigBirdReturns/axm-arc
  BigBirdReturns/axm-world

owner enumeration
  BigBirdReturns
```

Owner enumeration grants discovery scope only. Every artifact or release name still passes through the bounded Burn/source/estate/handoff/frontier candidate filter, every download remains subject to per-candidate and total byte ceilings, and only the exact parent byte count and SHA-256 can grant source standing. A broader repository map therefore increases recall without weakening admission.

For each repository it inspects recent, non-expired GitHub Actions artifacts and GitHub release assets. Candidate names are bounded by a Burn/source/estate/handoff/frontier filter before download. Exact Actions artifact IDs and release asset IDs can also be supplied in `owner/repo:id` form. Downloaded artifacts are searched through bounded nested ZIP layers, so an exact parent inside a landing kit or retained source package can be recovered without restaging it.

The ordinary repository token is used by default. A repository secret named `BURN_SOURCE_TOKEN`, when present, is preferred for cross-repository private-artifact access. Inaccessible repositories and objects are recorded in the harvest receipt.

## Download and credential boundary

The harvester:

```text
limits each candidate to 1 GiB by default
limits one sweep to 4 GiB by default
streams downloads instead of buffering them in memory
bounds nested ZIP depth and declared extraction bytes
records every refusal or inaccessible remote object
never places bearer credentials in receipts
strips Authorization and Proxy-Authorization on cross-origin redirects
refuses HTTPS-to-HTTP redirect downgrade
permits plain HTTP only for loopback qualification fixtures
```

GitHub artifact downloads redirect to signed object-storage URLs. Cross-origin credential stripping is a tested security property.

## Result and audit law

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
  exact parent admitted and the contracted Episode 5 / A05C1 evidence family is present

source-required
  exact parent admitted, but the required evidence family remains incomplete

source-not-found
  the remote sweep completed and no candidate matched the exact parent

harvest-error
  remote enumeration, download, or workflow execution failed before a normal receipt
```

A scheduled or landing-push `source-not-found` sweep remains green and auditable. It is not a human action item and does not authorize inferred Episode 5 content. A manually dispatched run can set `require_source=true` to retain the same receipt while making absence a failing control signal.

Each sweep also posts an addressable summary to GitHub issue #212 with the run ID, exact candidate SHA, trigger, status, repository, candidate and byte counts, artifact ID, artifact URL, artifact digest, and current frontier. The uploaded artifact remains the authoritative byte package.

## Qualification

The harvester and recovery authority use only the Python standard library. Their combined suite runs on Ubuntu 24.04 and hosted Windows and proves:

```text
direct exact-parent recovery
nested handoff recovery
deterministic packet reproduction
sub-limit packet splitting
source-required classification
manifest, exact-path, and ZIP-path refusal law
recursive local candidate sweep
GitHub owner repository enumeration
GitHub Actions artifact discovery and download
explicit artifact lookup without listing
explicit release-asset lookup
candidate, nested-archive, and total download ceilings
bounded recursive landing-kit inspection
cross-origin bearer-token stripping
audited source absence
```

No production Burn source, private media byte, inferred Episode 5 title, inferred panel count, or inferred continuity is committed by this mechanism.
