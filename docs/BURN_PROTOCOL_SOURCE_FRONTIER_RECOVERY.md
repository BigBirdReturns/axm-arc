# Burn Protocol source-frontier recovery

## Current boundary

The landed corpus-native cartridge is complete through:

```text
Episode 4: Fractured Allegiances
E04-C1-P01 through E04-C3-P60

outside continuation
E05-C1-P01
```

The accepted cartridge contains four complete episodes, twelve chapters, 240 ordered panel positions, and 48 plate assets. Episode 5 has not been admitted. The continuation identifier establishes continuity only; it does not establish an Episode 5 title, Chapter 1 title, final panel or plate extent, canonical expression, filenames, byte counts, hashes, or visual standing.

The next canonical transaction therefore begins with exact source recovery rather than source reconstruction.

## Pinned parent authority

The recovery contract accepts only the exact v0.62.0 parent estate:

```text
basename
Star_Trek_Discovery_The_Burn_Protocol_Web_Series_v0.62.0.zip

bytes
641627846

sha256
f67dcd2c632720566e38b04c0a6b844188de24c967a77a4be31978a5ff82349a

manifest basename
v0.62.0-file-manifest.json
```

A filename, artifact title, release title, URL, or repository path is a discovery hint only. Exact byte count and SHA-256 are mandatory before the parent manifest may grant source standing.

## Current contract

```text
tools/burn-protocol-source-frontier/contracts/e05c1-source-intake.contract.json
```

The contract requires exact manifest receipts for:

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

A canonical Episode 5 script render is also required through the manifest-derived `canonical-script-render` classification. Its filename is deliberately not guessed before the Episode 5 title is admitted.

## Admission law

`recover.py`:

1. verifies the complete parent archive by exact byte count and SHA-256;
2. rejects duplicate, absolute, traversal, symbolic-link, encrypted, or CRC-invalid ZIP entries;
3. requires exactly one authoritative manifest basename;
4. finds one unambiguous structural collection of manifest records;
5. rejects duplicate manifest paths;
6. selects records using bounded Episode 5 / Chapter 1 identity tokens;
7. requires the exact A05C1 paths and evidence classifications in the contract;
8. verifies every emitted file against its manifest byte count and SHA-256 while copying it;
9. emits deterministic `ZIP_STORED` packets with fixed timestamps; and
10. writes a recovery receipt, selected manifest, authoritative parent manifest, and SHA-256 ledger.

The classification floor remains:

```text
canonical Episode source
compiled reader source
canonical script render
chapter source
canonical lettering
chapter panel-art source
chapter provenance
chapter recovery receipt
plate composition map
at least one panel raster
at least one plate raster
```

These requirements prove a coherent, exact E05C1 evidence family. They do not predeclare the final Episode 5 or Chapter 1 extent.

## Result states

### Exit 0 — `verified-frontier-evidence`

The exact parent and every emitted byte passed custody verification, and every contracted path and classification is present. This authorizes inspection and an explicit `burn-protocol/1` Episode 5 amendment. It does not make the cartridge production-ready by itself.

### Exit 3 — `source-required`

The exact parent and emitted records are valid, but one or more contracted paths or classifications are absent. The verified packet set is retained with the missing evidence recorded. No Episode 5 source should be authored from incomplete evidence.

### Exit 2 — custody refusal

The parent receipt, ZIP safety, manifest structure, central-directory size, file byte count, CRC, or SHA-256 contradicted the contract. Failed output is removed so a refusal cannot resemble a complete intake.

## Autonomous execution

The repository-owned workflow:

```text
.github/workflows/burn-protocol-autonomous-source-harvest.yml
```

runs every twelve hours, on qualifying `main` pushes, and through GitHub-native dispatch. It searches bounded Actions artifacts and release assets in Arc and World, examines bounded nested ZIP layers, delegates every candidate to `recover.py`, uploads the authoritative receipt package, and posts an addressable summary to issue #212.

No workstation command or file transfer is part of the operating path. `source-not-found` is an auditable green result, not a request for human transport and not permission to fabricate Episode 5.

## Promotion sequence

```text
scheduled, push-triggered, or dispatched remote sweep
  → exact parent admission
  → verified E05C1 evidence packet
  → explicit burn-protocol/1 Episode 5 Chapter 1 amendment
  → deterministic Arc publication
  → unchanged World SequenceHost receiver
```

Every future amendment must preserve the inherited `asset:E03-C2-P31` source-required media refusal unless an exact canonical digest is independently admitted.

## Qualification

The permanent source-frontier gate runs the complete recovery and autonomous-harvest suite on Ubuntu 24.04 and hosted Windows. Its retained receipt binds:

```text
exact candidate SHA
E05-C1-P01 frontier
E05C1 contract path and SHA-256
exact parent authority
expected A05C1 paths
required evidence classifications
humanWorkstationRequired: false
canonicalTextInference: forbidden
```
