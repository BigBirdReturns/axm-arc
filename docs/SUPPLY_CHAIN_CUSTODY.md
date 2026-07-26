# AXM Arc supply-chain custody

AXM Arc is the source, engine, authoring, and reference-player authority. A World workflow may build and checksum an exact Arc dependency for coordinated estate reproduction, but it cannot truthfully issue repository provenance on Arc's behalf. Arc therefore emits its own release evidence from its own accepted repository and workflow identity.

## Evidence object

The permanent `Arc supply-chain evidence` workflow produces:

- a deterministic archive of the exact static Arc product;
- a deterministic CycloneDX 1.7 dependency graph generated from the committed npm lockfile;
- an in-toto Statement v1 with a SLSA provenance v1 predicate;
- `SHA256SUMS` over the archive, SBOM, and provenance statement;
- a dependency-free offline verifier for checksums, provenance subjects, SBOM structure, root confinement, and optional GitHub attestation bundles;
- GitHub build-provenance and SBOM attestations on accepted non-pull-request runs;
- the trusted root and attestation bundles needed for offline re-verification.

All ordering is byte-order deterministic. The archive normalizes path order, modification time, ownership, and gzip metadata. Evidence paths are confined through both lexical and real-path checks, so a symlink cannot make a checksummed file escape its evidence root.

## Trust boundary

The evidence proves that one Arc repository commit and one recorded workflow produced the named bytes. It does not certify:

- cartridge authorship or marketplace publisher identity;
- narrative or aesthetic quality;
- universal browser or operating-system behavior;
- local operator acceptance;
- Book IV implementation;
- the future decision kernel or connected-operation v2.

Cartridge identity remains the frozen `cart1_` content contract. Repository provenance and cartridge identity are separate forms of custody and neither silently substitutes for the other.

## Coordinated RODOH release

A coordinated release must carry both independent repository attestations:

1. Arc attests `artifacts/axm-arc-game.tar.gz` from `BigBirdReturns/axm-arc`.
2. World attests `artifacts/rodoh-world-game.tar.gz` from `BigBirdReturns/axm-world`.
3. The World estate lock names the exact accepted Arc commit.
4. Offline verification checks each artifact against the repository that actually produced its attestation.

No World bundle may be applied to the Arc artifact, and no Arc bundle may be represented as World provenance.
