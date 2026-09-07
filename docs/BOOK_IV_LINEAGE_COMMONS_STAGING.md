# Book IV staging: The Lineage Commons

**Status:** canon staged, implementation deferred. This document translates the professionally reviewed first recension of *The Godscar Codex, Book IV: The Lineage Commons* into a post-RODOH-1.0 implementation boundary. It does not register a fourth source plane, change engine law, alter any current cartridge identity, or enter the RODOH 1.0 critical path.

**Canon source:** *The Godscar Codex, Book IV: The Lineage Commons*, professionally reviewed first recension, July 2026.

**Control question:** When a civilization's future requires another person, body, habitat, archive, route, or ecology to perform a missing continuity function, what institution can distinguish necessary continuity from predation that has learned to describe itself as kinship?

## What Book IV governs

Book IV governs the inherited future. Its fundamental unit is a **Lineage Commons**: the political and material system through which future persons arise, develop, inherit, diverge, receive standing, and enter a continuing polity.

The canon establishes the following durable objects:

- continuity claims and their evidence;
- carriers, including bodies, machines, ecologies, habitats, routes, archives, and institutions;
- developmental bands and the conditions under which new persons become whole;
- transmission meshes carrying memory, skill, language, ritual, maintenance, and identity;
- succession forums recognizing descendants, forks, resurrection, adoption, divergence, shared inheritance, and ending;
- obligation ledgers recording inherited labor, risk, promises, extraction, compensation, dissent, and uncertainty;
- alternatives and refusal capacity;
- future standing and the possibilities preserved or foreclosed by present action;
- Lineage Scars created by lost functions, bodies, habitats, symbionts, archives, or routes;
- Lineage Assemblies that issue bounded, reviewable receipts rather than universal answers.

Book IV inherits the evidence discipline of Book I, the maintained-misclassification mechanics of Book II, the Commonship authority and embodiment profiles of Book III, and the additive Second Recension custody protocol. It must not replace those local games.

## Candidate source-plane identity

The following names are reserved for implementation review. They are not registered formats in this staging change.

```text
source-plane id:       lineage-commons-pocket
source format:         lineage-commons-pocket/1
extension key:         godscar.lineage-commons@1
editable file suffix:  .lineage.json
compiled file suffix:  .arc.json
```

The source plane should be registered only after RODOH 1.0 ships and a canonical reference campaign proves that the grammar requires a distinct executable surface rather than another Book II or Book III extension.

## Candidate source authority

A future `LineageCommonsPocketSource` should carry these authored fields without allowing arbitrary executable code:

1. **Identity and canon relation**
   - id, title, description, author, source version, parent canons, canon relation, estimated cycles;
   - a control question and evidence tier.
2. **The nine Lineage Engine pressures**
   - threatened continuity function;
   - apparent scarcity;
   - carrier field;
   - developmental environment;
   - transmission path;
   - succession rule;
   - institution claiming custody;
   - excluded claimant;
   - approaching trigger.
3. **The Canon and Lineage Ledger**
   - claim, venue, legitimacy target, provenance, intervention history, limits, dissent, uncertainty, and review authority;
   - present claimants, future claimants, absent voices, and disputed personhood or continuity claims.
4. **Carrier and embodiment profiles**
   - somatic scale, occupied volume, passage, locomotion, environment, sensorium, interface, temporal structure, continuity span, developmental role, and lineage dependencies;
   - one carrier profile may be shared by several people, and one person may occupy several carriers.
5. **Developmental bands**
   - required habitats, care, education, symbionts, social relations, time, transitions, and harms caused by normalization or compression.
6. **Transmission meshes**
   - memory, skill, language, ritual, maintenance, identity, provenance, access, failure modes, and refusal paths.
7. **Succession and divergence**
   - recognized successor relations, inheritance claims, archive access, resurrection limits, divergence rights, ending conditions, and review institutions.
8. **Obligation and future-standing ledgers**
   - labor, extraction, risk, compensation, promises, dissent, uncertainty, alternatives, foreclosed futures, and future claimants.
9. **Lineage Assemblies**
   - the endangered function and decision horizon;
   - current claimants, carriers, custodians, developmental advocates, succession representatives, dissenters, and Future Chamber;
   - need, consent, custody, refusal, alternatives, future standing, review, and termination;
   - authorized intervention, reversible elements, burdens, obligations, and exact receipt.
10. **Consequences and Story Physics**
    - changed carriers, habitats, archives, routes, succession rules, constituencies, dependencies, alternatives, visibility, compatibility debt, and future options;
    - no intervention may resolve into a clean reset.

## The eight state tracks

The Book IV management layer rates eight tracks from 0 to 4:

| Track | Crisis at 0 | Durable capacity at 4 |
|---|---|---|
| Carrier Viability | Necessary bodies or substrates are failing | Several viable carriers and replacement paths exist |
| Developmental Integrity | New persons cannot become whole without injury or normalization | Several developmental environments preserve variation |
| Archive Trust | Provenance or access is unusable | Memory is auditable, plural, and revisable |
| Succession Legitimacy | No forum can recognize continuity or divergence | Several successor relations can receive standing |
| Alternative Capacity | The current custodian is the only viable mechanism | Several carriers, routes, or methods remain usable |
| Refusal Capacity | Exit means annihilation or legal nonexistence | Claimants can leave without destroying the future |
| Visibility | The commons cannot be audited or is dangerously exposed | Recognition and opacity are under bounded authority |
| Compatibility Debt | The present arrangement leaves little inherited constraint | Temporary accommodations have credible retirement paths |

Compatibility Debt remains inverse in practical play: rising debt narrows future choice. A future implementation must make that direction explicit in UI and receipt language rather than relying on color alone.

## The seven-operation loop

A canonical Lineage Commons campaign should execute this loop through ordinary Arc law:

1. State the endangered continuity function and decision horizon.
2. Read evidence and identify missing or delayed voices.
3. Map carriers, development, transmission, succession, obligations, and alternatives.
4. Convene, refuse, defer, or bypass a Lineage Assembly.
5. Allocate resources, custody, burden, and temporary authority.
6. Resolve the intervention through deterministic engine law.
7. Record the receipt, dissent, uncertainty, review date, termination condition, and futures newly possible or impossible.

The loop must support refusal, negotiated ending, migration, temporary carriers, habitat conversion, archive activation, emergency reproduction, and construction of alternatives without treating any one intervention as a universal definition of personhood.

## Assembly receipt candidate

A future bounded receipt should include at least:

```text
format
assembly id
source cartridge identity
evidence tier and provenance
endangered function and remaining interval
present claimants
future claimants
carriers and custodians
developmental conditions
consent and refusal positions
viable alternatives
burdens and extraction
custody and transfer authority
dissent and uncertainty
authorized intervention
reversible elements
review date
termination condition
obligations
state before and after
futures newly possible
futures newly impossible
unknown namespaced memory
```

The receipt should compose with `godscar-consequence-plane-receipt/1`, `axm-connected-operation/v1`, and `axm-cartridge-run/v3` without merging separately sovereign state sets.

## Canonical reference campaign criteria

No Book IV source plane should ship without one reference campaign satisfying all of the following:

- a complete ordinary-life, claim, assembly, intervention, review, and succession path;
- at least five materially different claimants, including one future or delayed claimant;
- several viable carriers or a playable process for building alternatives;
- at least one lawful refusal and one continuity-capture failure fixture;
- all eight state tracks changing through exact engine receipts;
- a Lineage Scar whose apparent solution can create a new Scar;
- deterministic multi-seed completion without access bypasses or engine warnings;
- source validation, exact source recovery, stable cartridge identity, and portable-run resume;
- a connected operation with at least one existing Book I, II, or III reference;
- no receiver-authored personhood decision, future claimant, or continuity outcome.

Candidate campaign frames from the codex include **The Nursery Without Children**, **The Ship That Inherits Its Crew**, **The Last Carrier Treaty**, and **The Archive of Unchosen Ancestors**. Selection remains a later canon decision.

## Engine impact assessment

Engine 1.3 already provides bounded cartridge state, declarative composition, exact receipts, migration, portable runs, and connected-operation custody. Book IV staging identifies likely additive needs rather than assuming a new engine:

- a typed Assembly receipt extension;
- future or delayed claimant representation without inventing a present agent;
- explicit review and termination triggers;
- succession relations and divergence receipts;
- obligation and alternative ledgers;
- connected custody of foreclosed-future and unknown-memory records.

The implementation review must first attempt these as ordinary source fields, state definitions, consequences, and namespaced run memory. A new engine ABI is justified only where the existing bounded data model cannot preserve or resolve the authored fact.

## RODOH 1.0 exclusion

Book IV is staged outside the 1.0 release boundary.

Before RODOH 1.0:

- do not register `lineage-commons-pocket/1`;
- do not add a Book IV compiler, Forge, receiver, Program number, bundled cartridge, theme dispatch, or asset binding;
- do not use Book IV to satisfy the clean-room generalization proof;
- do not modify the five accepted reference cartridge identities for Book IV;
- do not let Book IV reopen engine, save, run, or source-plane versions unless Gate 8 independently requires the change.

After RODOH 1.0:

1. select the canonical reference campaign;
2. encode the source schema and validator;
3. compile through existing Arc law wherever possible;
4. ship a Lineage Forge and deterministic campaign proof;
5. vendor one exact Arc head into World;
6. build a neutral-first Lineage Commons receiver;
7. produce the Book IV asset pack and desktop/mobile acceptance;
8. connect its receipts back into Books I–III without rewriting their outcomes.

## Staging acceptance

This staging change is complete when:

- the reviewed Book IV concepts are mapped into a bounded candidate source contract;
- the eight tracks, nine pressures, seven operations, and Assembly receipt are named exactly;
- the post-1.0 engine, authoring, receiver, asset, and connected-play work is separated;
- the existing source-plane registry and RODOH 1.0 acceptance contract remain unchanged;
- no executable Book IV code or artifact enters the repository.
