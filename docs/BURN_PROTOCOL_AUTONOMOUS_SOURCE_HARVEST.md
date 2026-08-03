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

Artifact names, release titles, repository paths, URLs, and filenames are discovery hints only. Every candidate is first delegated to `recover.py`, which verifies the complete parent byte count and SHA-256 before reading its authoritative manifest or emitting a packet. When a candidate is instead a previously emitted recovery packet family, `verify_packet_set.py` verifies its recovery receipt, authoritative manifest, selected manifest, packet envelopes, root ledger, and every payload byte.

A self-consistent packet set has no source standing by itself. It is reported as `packet-set-approval-required` with its computed packet-set SHA-256. Only a digest supplied independently through `--approved-packet-set-sha256`, the `approved_packet_set_sha256s` dispatch input, or repository variable `BURN_APPROVED_PACKET_SET_SHA256S` grants transport standing. Transport approval still does not authorize a `burn-protocol/1` source amendment.

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

The default required sweep covers the public repositories most likely to retain project source, build, tool, fleet, console, or aide custody:

```text
BigBirdReturns/axm-arc
BigBirdReturns/axm-world
BigBirdReturns/axm
BigBirdReturns/axm-core
BigBirdReturns/axm-tools
BigBirdReturns/axm-fleet
BigBirdReturns/axm-console
BigBirdReturns/axm-aide
```

The default best-effort sweep also attempts the connected private repositories most likely to retain chat, rehydration, bloodstream, or web-session custody:

```text
BigBirdReturns/axm-chat
BigBirdReturns/spectra-genesis
BigBirdReturns/axm-bloodstream
BigBirdReturns/chatgpt-web
```

Required and best-effort repositories have different absence standing. A discovery failure in a required repository makes the sweep `harvest-error`. An inaccessible best-effort repository is recorded under `optionalDiscoveryErrors` and cannot weaken or enlarge the required-scope `source-not-found` claim. If a best-effort repository is accessible, its selected artifacts are downloaded and inspected under the same exact-parent, byte-budget, and transport-failure law as every required repository.

The workflow-dispatch inputs can replace both lists. Repository variables `BURN_SOURCE_REPOSITORIES` and `BURN_SOURCE_OPTIONAL_REPOSITORIES` can also replace the scheduled and landing-push defaults without changing code. Externally reviewed packet-set identities may be supplied as a comma-separated list through `approved_packet_set_sha256s` or `BURN_APPROVED_PACKET_SET_SHA256S`; the harvester never derives its own approval pin from a candidate.

For each repository the harvester inspects recent, non-expired GitHub Actions artifacts and GitHub release assets. Candidate names are bounded by a Burn/source/estate/handoff/frontier filter before download. Exact Actions artifact IDs and release asset IDs can also be supplied in `owner/repo:id` form. Downloaded artifacts are searched through bounded nested ZIP layers, so an exact parent inside a landing kit or retained source package can be recovered without restaging it.

The ordinary repository token is used by default. A repository secret named `BURN_SOURCE_TOKEN`, when present, is preferred for cross-repository private-artifact access. Required discovery errors, best-effort discovery errors, and candidate transport failures are reported separately.

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

GitHub Actions artifact archive requests use GitHub’s REST media type and follow the documented redirect to signed storage. The redirected request strips credentials and replaces API-specific content negotiation before downloading bytes. Release-asset downloads retain their binary media type.

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

When an approved packet set is found, the output contains its independently replayed verification receipt under:

```text
burn-protocol-source-harvest/packet-set-verification/
```

Unapproved packet families are recorded in `packetSetCandidates` with the remote identity, candidate hash, computed packet-set hash, recovery standing, selected summary, and packet ledger. Their bytes remain in the identified remote artifact until a separate approval transaction admits one exact identity.

Statuses are:

```text
verified-frontier-evidence
  exact parent admitted and the contracted Episode 5 / A05C1 evidence family is present

source-required
  exact parent admitted, but the required evidence family remains incomplete

verified-frontier-packet-set
  a complete packet family passed byte verification and matched an external packet-set SHA-256 pin; this grants transport standing only

source-required-packet-set
  an externally pinned packet family passed byte verification, but its underlying recovery receipt remains source-required

packet-set-approval-required
  a packet family is internally byte-exact but has no independently supplied packet-set approval pin

source-not-found
  required repository custody was completely enumerated and every selected candidate was downloaded and inspected, but none matched the exact parent; any inaccessible best-effort repositories remain explicitly outside that absence authority

harvest-error
  enumeration, artifact or release download, nested inspection, or workflow execution was incomplete; transport refusal can never be reported as source absence
```

A scheduled or landing-push `source-not-found` sweep remains green and auditable. It is not a human action item and does not authorize inferred Episode 5 content. A manually dispatched run can set `require_source=true` to retain the same receipt while making absence a failing control signal.

Each sweep also posts an addressable summary to GitHub issue #212 with the run ID, exact candidate SHA, trigger, status, required and best-effort repository counts, candidate and byte counts, required discovery errors, best-effort discovery errors, transport failures, packet-set candidate and approval counts, any admitted packet-set identity, artifact ID, artifact URL, artifact digest, and current frontier. The uploaded artifact remains the authoritative receipt package.

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
GitHub Actions artifact discovery and download
GitHub artifact versus release-asset media negotiation
explicit artifact lookup without listing
explicit release-asset lookup
candidate, nested-archive, and total download ceilings
bounded recursive landing-kit inspection
cross-origin bearer-token and API-header stripping
transport failure cannot become source absence
required repository discovery failure remains fatal
best-effort repository discovery gaps remain explicit and non-authoritative
accessible best-effort custody can supply the exact parent
recovered packet-set discovery without parent restaging
unapproved packet-set reporting without source standing
externally pinned packet-set transport admission
changed packet-set refusal under an old approval pin
exact-parent precedence over packet material
workflow defaults retain the expanded custody scope
audited required-scope source absence
```

No production Burn source, private media byte, inferred Episode 5 title, inferred panel count, or inferred continuity is committed by this mechanism.
