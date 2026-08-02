# Burn Protocol source-frontier recovery

## Current boundary

The landed corpus-native cartridge stops at:

```text
Episode 4: Fractured Allegiances
Chapter 1: Osyraa's Offer
E04-C1-P01 through E04-C1-P20

outside continuation
E04-C2-P21
```

No Episode 4 Chapter 2 source object, asset ledger, Arc implementation, or World receiver is present in Git. The continuation identifier establishes continuity only. It does not establish Chapter 2 dialogue, panel count, plate count, filenames, byte counts, hashes, or visual standing.

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

The archive remains holder-owned and external to Git. The tool may receive either that parent directly or one handoff ZIP containing exactly one nested copy of it.

## Recovery command

From the Arc repository root:

```bash
python tools/burn-protocol-source-frontier/recover.py \
  --input /path/to/Star_Trek_Discovery_The_Burn_Protocol_Web_Series_v0.62.0.zip \
  --output /path/to/recovered-e04c2
```

The default contract is:

```text
tools/burn-protocol-source-frontier/contracts/e04c2-source-intake.contract.json
```

The output directory must be empty. The default packet ceiling is 200 MiB, below the project’s observed approximately 220 MB session-survival boundary.

## Admission law

The recovery tool does not trust a filename by itself. It:

1. verifies the complete parent archive by exact byte count and SHA-256;
2. rejects duplicate, absolute, traversal, symbolic-link, encrypted, or CRC-invalid ZIP entries;
3. requires exactly one manifest with the contracted basename;
4. finds one unambiguous structural collection of manifest records;
5. rejects duplicate manifest paths;
6. selects records using the bounded Episode 4 / Chapter 2 identity tokens in the contract;
7. requires a minimum evidence classification set;
8. verifies every emitted file against its manifest byte count and SHA-256 while copying it;
9. emits deterministic `ZIP_STORED` packets with fixed timestamps;
10. writes a root receipt, selected manifest, authoritative parent manifest, and SHA-256 ledger.

The contracted classification floor is:

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

These minima prove that a coherent frontier evidence family was recovered. They do **not** claim the final Chapter 2 extent. Exact panel and plate counts, identities, seams, and source-receipt IDs must be derived from the recovered, verified records.

## Result states

### Exit 0 — `verified-frontier-evidence`

The exact parent and every emitted byte passed custody verification, and every required evidence classification is present. This authorizes inspection and Arc source assembly from the recovered records. It does not make the cartridge production-ready by itself.

### Exit 3 — `source-required`

The exact parent and emitted records are valid, but one or more required evidence classifications or explicitly contracted paths are absent. The verified packet set is retained with the missing evidence recorded. No Chapter 2 source should be authored from incomplete evidence.

### Exit 2 — custody refusal

The parent receipt, ZIP safety, manifest structure, central-directory size, file byte count, or SHA-256 contradicted the contract. The output directory is removed so a failed run cannot resemble a complete intake.

## Output authority

A successful or source-required run emits:

```text
RECOVERY_RECEIPT.json
SELECTED_MANIFEST.json
v0.62.0-file-manifest.json
SHA256SUMS
burn-protocol-v0.62.0-E04-C2-intake-packet-*.zip
```

Every packet contains `PACKET.json` plus only verified parent bytes. Packet records bind the exact parent, manifest, selected paths, sizes, hashes, classifications, packet count, and tool version.

Do not commit the recovered source or media bytes. Use the receipts to author the next `burn-protocol/1` source amendment with explicit source-required boundaries wherever exact canonical expression or composition remains unavailable.

## Promotion sequence

After an exit-0 recovery:

```text
exact parent and manifest
  → verified E04C2 evidence packets
  → explicit Chapter 2 source receipts and asset rows
  → appendBurnProtocolChapter
  → deterministic Arc publication and coverage receipt
  → unchanged World SequenceHost receiver
```

The first Arc implementation must prove the exact `E04-C1-P20 → E04-C2-P21` seam in both directions and preserve the inherited `E03-C2-P31` source-required media refusal. It must not infer Chapter 2 expression from Episode summaries, causal ledgers, numbering conventions, or adjacent chapter structure.

## Qualification

The repository self-test uses synthetic, content-bound parent archives and covers:

```text
direct exact-parent recovery
nested handoff recovery
deterministic packet reproduction
sub-limit packet splitting
missing-classification source-required status
manifest hash contradiction refusal
wrong-parent receipt refusal
unsafe ZIP-path refusal
```

Run it locally with:

```bash
python -m unittest discover \
  -s tools/burn-protocol-source-frontier \
  -p 'test_*.py' \
  -v
```
