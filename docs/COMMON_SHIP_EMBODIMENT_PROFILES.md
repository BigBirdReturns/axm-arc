# Common Ship embodiment profiles

**Authority:** *The Godscar Codex, Book III: The Common Ship*, first recension, with the Gate 0 somatic-scale and temporal-legibility amendment.

A Common Ship source now carries `embodimentProfiles`. The profile is part of creator-owned source and survives unchanged inside `Arc.extensions["godscar.common-ship@1"]`. It records the conditions under which a person can participate without assigning that person an occupation or treating their body as an administrative destiny.

## Required profile fields

Each profile records:

- somatic scale class, typical height and mass where those concepts apply, occupied volume, minimum passage, reach, locomotion, and manipulation scale;
- environmental medium, pressure, temperature, gravity, radiation tolerance, and lineage dependencies;
- sensory channels, communication channels, and characteristic environmental hazards;
- direct interface paths, mediated paths, and host assumptions the vessel may not treat as neutral;
- external interval, subjective resolution, developmental tempo, recovery cycle, continuity span, expected lifespan, and life-fraction accounting.

`micro`, `small`, `human-scale`, `large`, `colossal`, and `distributed` are source classifications rather than moral or occupational categories. A large citizen is not automatically maintenance labor. A small citizen is not automatically a vent-crawler. An aquatic citizen is not confined to care. A short-lived or fast-processing citizen is not permanent emergency staff.

## Binding people and watches

Each cast member names one `profileId`. Each authored watch carries `requiredProfileIds` inside its profile ledger. Validation refuses:

- duplicate profile identifiers;
- cast or watch references to undeclared profiles;
- duplicate watch requirements;
- profiles that describe no actual cast member;
- missing environmental, interface, temporal, or lineage-dependency fields.

The watch still records prose requirements for bodies, habitats, clocks, translators, reserves, and life-fraction costs. Gate 1 converts the profile references and those requirements into deterministic composition constraints. Gate 0 establishes the source authority first so the engine and receiver do not invent body law independently.

## Starter coverage

The private Common Ship starter includes six materially different profiles:

1. a dry human-scale response body;
2. a large aquatic care lineage;
3. a high-gravity large-bodied maintainer lineage;
4. a distributed Manyborn mediator cloud;
5. a nine-year short-lived analyst lineage;
6. a distributed Counterborn vessel fork.

The starter remains a compiler and authoring fixture. It is not the canonical Common Ship campaign and does not expand the accepted three-cartridge World release.
