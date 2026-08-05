# The Godscar Codex: Second Recension Addenda for Books I-III

**Repository authority:** This document encodes the professionally reviewed Second Recension addenda for Books I through III. It preserves the first recensions and deliberately excludes Book IV from the current implementation boundary.

## Canon rule

The first three source planes remain stable:

- `godscar-pocket/1`
- `dark-tomb-pocket/1`
- `common-ship-pocket/1`

The Second Recension is additive. Existing first-recension source remains valid without the new note. New and reviewed reference source carries a namespaced `notes["godscar.second-recension@1"]` value with exact typed ledgers.

The addenda do not grant a narrator, faction, receiver, or compiler broader knowledge than the source evidence supports. Bounded receipts retain provenance, dissent, uncertainty, and local authority.

## Book I addendum: The Consequence Plane

Book I now distinguishes four consequence scales:

1. **Pocket:** immediate changes to a world, vessel, Tomb, institution, person, dependency, archive, route, doctrine, or capacity.
2. **Route:** changes to access, traffic, migration, quarantine, trust, and exposure between pockets.
3. **Sector:** reinterpretation by several routes, factions, and claimants.
4. **Cascade:** contested interpretation of whether a bounded event accelerates, delays, redirects, conceals, or reveals Crowning, Counterform, Answer, or large-scale convergence.

The typed Sector Ledger records changed pockets, changed routes, classification shifts, faction standing, evidence, dissent, uncertainty, and the next pressure. The Consequence Turn receives a bounded receipt, updates route and classification state, records faction interpretations, preserves dissent and uncertainty, and declares the next pressure.

The Ilyon reference source carries a complete Book I ledger.

## Book II addendum: The Living Tomb

Book II now carries typed ledgers for:

- Lineage Scars beneath the Long Alarm;
- reproductive overhead inside the signature budget;
- surface populations whose inherited classification denied sovereignty;
- Negative Confederation membership and partial-map verification;
- fixed, Living, and Chronal Tomb host relations;
- layered opening with separate status, authority, protected unknowns, exposure cost, and review triggers.

The Dark Tomb starter and Lamp District reference source carry reviewed Book II ledgers. These additions do not create a Book IV source plane. They describe how continuity, reproduction, and inherited bodies alter concealment, jurisdiction, and opening inside Book II.

## Book III addendum: The Expanded Commonship

Book III already executes most of its Second Recension through the accepted Common Ship source plane and Relief Circuit:

- complete embodiment profiles;
- several people sharing one profile without representational collapse;
- somatic scale and public geometry;
- preparation through ordinary cycle law;
- connected operations preserving both state sets;
- handoff, readiness debt, dissent, uncertainty, precedent, and constitutional inheritance;
- vessel continuity claims that do not imply ownership of inhabitants.

The Common Ship starter and Relief Circuit reference source carry reviewed Book III ledgers.

## Cross-book custody

`axm-connected-operation/v1` remains the executable connected-operation format. Its transfer and return ledgers now support additive provenance, decisions, dissent, uncertainty, obligations, and unknown namespaced memory. Older connected-operation records remain valid when those fields are absent.

The Second Recension also defines `godscar-consequence-plane-receipt/1` for bounded Pocket, Route, Sector, and Cascade receipts. Receiving institutions may interpret those facts at their own scale, but they may not invent an outcome, normalize unfamiliar people into local vocabulary, claim an ungranted map or authority, or discard uninterpreted memory.

## Version and compatibility policy

- The source-plane format identifiers remain `/1`.
- Existing first-recension sources without the Second Recension note remain valid.
- The three reviewed reference cartridges advance their authored source versions because their canon notes and custody facts change.
- Generated source, compiled cartridges, and connected-operation fixtures must be rebuilt and reviewed together.
- Book IV remains outside this repository update and outside the RODOH 1.0 critical path until separately authorized.
