# Burn Protocol corpus publication probe

## Classification and purpose

This branch is a non-bundled, metadata-only publication probe. It tests whether the supplied *Burn Protocol* v0.58.0 production record can cross the existing Common Ship source, Arc compiler, deterministic founding, and Rodoh World engine boundaries without importing panel payloads, rewriting canonical history, or treating a status record as the underlying sealed estate.

The evidence ledger is bounded once. The evidence tier is `contested-canon`; the venue is the A13C1 public hearing and first reconstruction cycle; the target is Starfleet's inherited combination of archive custody, failure classification, and repair jurisdiction; the upside is accountable repair through separate custody and bounded mandates; the downside is fragmented coordination and new indexing power; the failure mode is either a sovereign transcript or a public record too weak to govern repair.

## Source boundary

The only Burn input available to this probe is the supplied markdown status record. It states that v0.58.0 is sealed through A12C3, gives the parent SHA-256, reports thirteen canonical episode sources, 780 scripted panels, 720 illustrated panels, thirty-six completed visual chapters, and 144 scroll plates, and names A13C1, “Disclosure,” as the next transaction. The estate ZIP, handoff ZIP, panel and plate payloads, manifests, audit JSON, and complete A13C1 production-contract bytes are not present here and are not independently revalidated.

The probe therefore records those missing payloads explicitly. It carries no image path and makes no byte-identity claim beyond the SHA-256 stated in the supplied record.

## Publication surface

The probe introduces three related artifacts:

```text
rodoh-corpus-publication-probe/1 metadata receipt
  → common-ship-pocket/1 creator source
  → engine-1.3 compiled Arc
  → deterministic founding and composition evaluation in axm-arc
  → validation and founding through the vendored engine in axm-world
```

The Common Ship source projects A13C1 into four watches:

```text
open the six-repository hearing
  → assign six incomplete mandates with separate withdrawal rights
  → repair one public corridor through a reversible local intervention
  → reconstruct the result after action through six read-only repositories
```

The source preserves the project’s stated control question: whether public truth can produce accountable repair without allowing Starfleet, the former Chain, the hearing, or the archive itself to become the new sovereign owner of the record.

## Canonical boundary

The v0.58.0 corpus is inherited history and remains read-only. Probe runs are counterfactual records. A successful run cannot alter the sealed estate, claim a canonical A13C1 outcome, or issue a new production pointer. The first later integration that receives the exact handoff ZIP must verify its checksum and manifests before replacing the metadata-only parent receipt with a payload-backed custody claim.

## Build and smoke commands

From `axm-arc`:

```bash
npx vitest run tests/common-ship/burn-protocol-disclosure-probe.test.ts
npx vite-node tools/build-burn-protocol-disclosure-probe.ts /tmp/burn-protocol-probe
```

The builder emits:

```text
burn-protocol-v0.58.0.corpus.json
burn-protocol-disclosure-probe.ship.json
burn-protocol-disclosure-probe.arc.json
publication-receipt.json
```

The dedicated GitHub workflow then checks out `axm-world`, validates the compiled Arc through World’s vendored engine, founds the same six-profile population twice from one seed, evaluates every challenge composition, and builds the World browser product. Its retained artifact contains the source, Arc, corpus receipt, publication receipt, World smoke report, and SHA-256 list.

## Current pass criteria

The probe passes when the source schema accepts the full Common Ship record, compilation is deterministic, exact source recovery succeeds, all four watches are feasible from the named founding population, World validates and founds the compiled Arc without drift or inference, and the ordinary World production build remains green.

This does not yet qualify a dedicated Burn visual theme, panel browser, canonical episode graph, direct corpus asset import, authored A13C1 dialogue, or a hosted one-click Burn lobby. Those are the next receiver and custody transactions after the exact estate and handoff payloads are available.
