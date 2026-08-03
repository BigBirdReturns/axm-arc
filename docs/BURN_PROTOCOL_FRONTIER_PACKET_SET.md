# Burn Protocol frontier packet-set verification

## Classification

This authority verifies one recovery packet set emitted from an exact Burn parent without requiring every later receiver to reopen or transport the complete 641,627,846-byte estate. It is a reusable custody and transport primitive. It does not author Episode 5, infer source content, approve an unpinned packet set, alter the `burn-protocol/1` source plane, compile an Arc, or advance World.

The current canonical frontier remains:

```text
E04-C3-P60 → E05-C1-P01
```

The exact parent authority remains:

```text
Star_Trek_Discovery_The_Burn_Protocol_Web_Series_v0.62.0.zip
641,627,846 bytes
sha256:f67dcd2c632720566e38b04c0a6b844188de24c967a77a4be31978a5ff82349a
```

## Input object

`verify_packet_set.py` accepts either a recovery directory or a ZIP containing exactly one recovery root. The root must contain the ordinary output of `recover.py`:

```text
RECOVERY_RECEIPT.json
SELECTED_MANIFEST.json
v0.62.0-file-manifest.json
burn-protocol-...-intake-packet-...zip
SHA256SUMS
```

Wrapper ZIPs are path-validated, CRC-checked, bounded by entry count and declared bytes, and refused when they contain absolute paths, traversal, symbolic links, encryption, duplicate names, or unsafe path syntax.

## Verification mechanism

The verifier independently recomputes and cross-checks:

```text
exact recovery-contract bytes and SHA-256
exact parent byte count and SHA-256 asserted by every receipt
exact authoritative manifest bytes and SHA-256
manifest record collection, record count, and uncompressed-byte total
selected manifest membership in the authoritative manifest
selection tokens, expected paths, and classification minima
recovery status and selected-file summary
root SHA256SUMS coverage
packet byte counts and SHA-256 values
packet index completeness
PACKET.json parent, manifest, frontier, and file declarations
every packet payload byte count and SHA-256
one-and-only-one coverage of every selected manifest record
absence of undeclared packet or recovery-root files
```

The result is one canonical packet-set identity:

```text
burn-protocol-source-frontier-packet-set-identity/1
```

Its SHA-256 binds the exact recovery contract, parent identity, manifest receipt, selection law, selected-manifest digest, packet names, packet sizes, packet hashes, packet file counts, and packet payload totals.

## Approval boundary

Byte verification and transport approval are separate states.

Without an external pin, a complete and internally consistent set returns exit code 3 and:

```text
status    approval-required
standing  byte-verified-approval-required
```

This state proves that the supplied files agree with each other. It does not prove that the set was produced by an admitted parent transaction, because a self-consistent packet family can be fabricated.

An authorized recovery transaction may publish the packet-set SHA-256 through a separately reviewed custody record. Supplying that exact digest through:

```text
--approved-packet-set-sha256 <64-hex-digest>
```

promotes only transport standing:

```text
status    pass
standing  transport-approved
```

A changed manifest, payload, packet partition, contract, or receipt produces a different identity and cannot reuse the old pin. Source amendment remains separately reviewed and must still prove that the approved packet set satisfies the current `burn-protocol/1` frontier contract. The verifier cannot create canonical text, episode titles, panel identities, plate mappings, or Arc law.

## Output

A successful byte verification writes:

```text
PACKET_SET_IDENTITY.json
PACKET_SET_VERIFICATION_RECEIPT.json
SHA256SUMS
```

The receipt states the byte-verification result, transport standing, packet-set identity, contract identity, parent identity, manifest receipt, selected coverage, packet ledger, and the continuing source-amendment boundary.

## Refusal law

The verifier fails closed with exit code 2 and removes partial output when it encounters:

```text
contract or parent mismatch
manifest mismatch or ambiguity
selected record absent from the authoritative manifest
selection or classification contradiction
root ledger mismatch
missing, duplicate, or extra packet
packet index gap
undeclared packet member
payload byte-count or SHA-256 mismatch
unsafe wrapper or packet path
approval digest mismatch
```

## Qualification

The dedicated Ubuntu and Windows gate exercises:

```text
complete byte verification without approval
external exact-set approval
packet tamper refusal
coherent changed-set approval refusal
missing packet refusal
duplicate payload refusal
safe nested wrapper admission
unsafe wrapper refusal
```

The evidence tier is custody-mechanism implementation; the venue is the frontier packet-set branch; the target is an independently transportable E05C1 recovery packet family; the upside is that the exact parent must be opened once rather than moved through every later system; the downside is that an external packet-set pin becomes an additional reviewed custody record; the failure mode is allowing internal consistency to masquerade as parent-derived source authority.

## Autonomous discovery

The landed autonomous and owner/private harvesters treat a recovery packet family as a separate candidate class after exact-parent recovery fails. A cheap marker preflight prevents unrelated ZIPs from invoking the full verifier. A matching wrapper is then verified byte-for-byte.

```text
no external pin
  → packet-set-approval-required
  → identity and remote candidate receipt published

matching external pin
  → verified-frontier-packet-set or source-required-packet-set
  → packet-set verification retained
  → source amendment still separate
```

The accepted pins enter only through `--approved-packet-set-sha256`, the `approved_packet_set_sha256s` workflow input, or `BURN_APPROVED_PACKET_SET_SHA256S`. A candidate can never supply its own approval. Exact-parent recovery has precedence when a candidate contains both the parent and packet material. Discovery or transport failures still outrank an unapproved packet candidate and remain `harvest-error`.

The control question is whether an exact-parent recovery can publish one approved E05C1 packet-set identity that the Arc amendment and unchanged World receiver can consume without moving the complete estate again.
