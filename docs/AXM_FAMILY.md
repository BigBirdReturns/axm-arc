# AXM_FAMILY.md — axm-arc's role in family adoption

The **canonical** world-arc adoption plan and transfer audit lives in
**axm-world's `docs/AXM_FAMILY.md`**. This file is the arc-side pointer, mirroring
the convention already used for `RECONCILIATION.md` (canonical here in axm-arc,
a short operational pointer in axm-world) — just inverted, because the adoption
plan is authored from the world/spoke side.

Read the world doc for the full picture: the family map, the two meanings of
"adoption," the genesis conformance ladder, the deliberate refusals, the
proposed genesis `ALIGNMENT.md` ledger rows, and the first work item.

## arc's role

- **arc is the signing spoke to the genesis kernel.** Because arc *authors*
  cartridges (the hub owns the engine, the arc format, and the tutorial arcs),
  arc — not world — is where a genesis publisher key lives and where signing
  happens. This realizes world's existing `"null until the hub signs it"`
  signature slot: *the hub signs, the spoke reads*. It matches
  `RECONCILIATION.md`'s hub/spoke split and `exportArcToJson`'s rule that a file
  never declares its own trust.

- **Shared-surface code lands here first.** The conformance ladder's first rung
  — a pure `canonicalizeArc(arc)` + `cartridgeDigest(arc)` in `src/engine/`,
  behind a tamper property test — is an **arc-first** engine change, per
  `RECONCILIATION.md`. world adopts it via `npm run engine:sync`; the
  `engine-drift` guard keeps the two in step. See world's `docs/AXM_FAMILY.md`
  §7 for the exact work item.

- **Genesis integration is already on arc's roadmap.** arc's `README.md` names
  *"Full Genesis integration (signed arcs, Merkle roots, `axm-verify`)"* as a
  roadmap item and lists axm-genesis as the "Kernel." This plan is the staged,
  additive path to get there without touching the frozen arc schema ABI beyond
  additive fields.

## Pointer

- Canonical plan: **axm-world `docs/AXM_FAMILY.md`**
- The arc⇄world vendoring contract: `RECONCILIATION.md` (this repo, canonical)
- The genesis kernel's adoption kit: axm-genesis `docs/ADOPTING.md`,
  `ALIGNMENT.md`, `spec/v1/CONFORMANCE.md`
