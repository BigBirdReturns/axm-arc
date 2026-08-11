# Canon work moved to `axm-canon`

This file is the permanent tombstone for canon work that was built in `axm-arc` as a temporary home.

The portable Canon Constraint Bible and the ASOIAF lore estate now live in `BigBirdReturns/axm-canon`, with domain-specific source, corpus, reconciliation, retrieval, and reader work under `asoiaf/`.

The ownership cut is:

- PR #221: portable canon law;
- PRs #224 through #248: ASOIAF lore and its source refinery, excluding disposable carriers and unrelated PR #245;
- PR #249 and later: Tier Bench execution infrastructure, not ASOIAF lore.

## Live destination identity

GitHub reproduces the prepared repository exactly:

```text
repository       BigBirdReturns/axm-canon
main commit      fec0ddc9a5697d465ac46e55b7e3cb7647221952
main tree        7a4ecfa77dc3816a0b57328c762f632c1a42eae1
annotated tag    migration-v1
manifest sha256  a3a3e62c66f14243126c9ff4ca49a9d96a13aad2b4409ebeac54d9569121a521
extra refs       0
```

The live commit, tree, annotated tag target, and manifest digest were read back through GitHub rather than inferred from push output. Both repository-owned qualification workflows passed on that exact head:

```text
AXM Canon qualification            run 31525320455  success
ASOIAF canon estate qualification  run 31525320485  success
```

The terminal migration receipt is:

```text
sha256:c53b958254c17a3f1b83198260e62cf8d816a3a1f8a1205dcb85beb075cf4182
```

It binds the source repository, all three material heads, all sixteen qualified lineage SHAs, the destination commit, tree, tag, manifest, both workflow runs, and rollback bundle `sha256:3f458e8b3686bdae4a0d7557e124f000b710a3a8edd30058edfddf297e756ffa`.

## Source-home cleanup

Post-publication cleanup closed the fifteen migrated lore pull requests unmerged and removed their fifteen exact published-lineage refs:

```text
pull requests  221 224 225 226 229 231 232 233 234 236 238 239 242 243 248
cleanup run    31532725097
artifact       9117524388
artifact zip   sha256:746a738cd824dca1e561624e91f75e469d04765cba143c6de5613f0f288a354b
receipt        sha256:134b88ec1e85102b846750c9d1dffe2dbdf62da1aab2bd67fe0e05525482f265
```

A final residue pass deleted seven observer-only branches and four closed repair-trigger branches after proving each exact tip changed only `.github/workflows/**` and was not the head or base of an open pull request:

```text
cleanup run    31533528649
artifact       9117826447
artifact zip   sha256:d86c6a579306383a81460f6410487d8ee07b9ee2bf1319403a4e8a1c57a5c039
receipt        sha256:dd806e10cf35408943a343934a6450e81393dea19a066ec413fc934749dfd3cf
```

The two temporary cleanup refs were deleted by the same terminal transaction. The only remaining `axm-canon`-named branch in `axm-arc` is this tombstone branch.

## Continuing boundary

No new canon compiler, ASOIAF corpus, exact-edition, source-atlas, reconciliation, private-retrieval, research-dossier, or reviewed-answer work belongs in `axm-arc`.

PR #249 and its descendants are a separate Tier Bench migration. Its current base branch `feature/asoiaf-reviewed-answer-packet-v1` remains only because open PR #249 still requires that exact Git ancestry. The remaining `asoiaf`-named execution branches are protected until Tier Bench imports the generic protocols, separates the ASOIAF adapter, applies domain-neutral names, independently qualifies the Linux product and orthogonal service, reproduces the Windows mechanism as a clean product, and retains rollback and tombstone custody.

The construction garbage, retained exceptions, unfinished corpus work, and Tier Bench boundary are recorded in `docs/AXM_CANON_MIGRATION_GARBAGE.md`.
