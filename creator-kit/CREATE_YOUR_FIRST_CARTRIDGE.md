# Create your first cartridge

The shortest reliable path is to fork a complete, unaffiliated generic Arc and replace its authored nouns and decisions without changing the engine beneath it.

## 1. Copy the clean-room reference

Copy:

```text
examples/orchard-at-low-tide/orchard-at-low-tide.source.arc.json
```

Rename it to a stable lowercase identifier such as:

```text
signal-garden.arc.json
```

Keep the original Orchard beside it as a comparison. Do not edit the reference in place.

## 2. Change identity before mechanics

Update:

- `meta.id`
- `meta.name`
- `meta.description`
- `meta.author`
- `meta.version`
- `meta.domain`

The identifier is compatibility infrastructure. Do not recycle an existing cartridge ID for unrelated authored law.

Validate immediately:

```bash
node dist/rodoh-cartridge.mjs validate --file signal-garden.arc.json
```

## 3. Define the vocabulary the player will actually manage

An Arc needs at least three attributes. Attributes should describe distinct capacities that can create materially different roster choices. Roles are weighted interpretations of those attributes; they are not presentation class names the runtime is allowed to infer.

Give every player-facing object a readable name and description. The runtime translates its own chrome. Authored cartridge vocabulary travels verbatim.

## 4. Author a complete starting organization

The cartridge's founding law must produce a playable roster and enough ordinary resources to attempt the opening work. The system may generate a deterministic generic roster when the Arc uses the legacy founding fallback, but a first-party-quality cartridge should declare its intended founding state explicitly.

A challenge whose minimum party, required roles, gates, or state constraints cannot be satisfied by any lawful founding path is structurally invalid even when the JSON schema accepts it.

## 5. Build one visible decision at a time

For each challenge, state:

- what is being attempted;
- the minimum and maximum party;
- required roles or composition constraints;
- the mechanics and thresholds that decide the result;
- any bounded resource-spend lever;
- success, partial, and failure consequences;
- access requirements and the exact milestone or state that later work inherits.

A resource-spend lever narrows uncertainty within its authored cap. It does not purchase a guaranteed pass or move the expected score.

## 6. Preserve consequence and refusal

A complete campaign needs more than reachable nodes. Outcomes should change resources, people, relationships, state, evidence, or future access in ways the next decision can inspect.

Do not encode a fictional choice whose options resolve to the same result. Do not use a malformed artifact as an invitation for the runtime to repair what the author did not specify.

## 7. Simulate bounded completion

Run:

```bash
node dist/rodoh-cartridge.mjs simulate \
  --file signal-garden.arc.json \
  --seeds 16 \
  --max-cycles 120
```

A passing receipt requires:

- every tested seed clears the complete campaign;
- no access gate is bypassed;
- no run stalls;
- no run reaches the maximum cycle boundary;
- the engine emits no warning.

A failed sweep is evidence. Lowering every threshold is not the only response. Inspect roster diversity, role coverage, gates, resource economy, state transitions, and whether ordinary preparation exists.

## 8. Compute exact identity

After the authored bytes are final:

```bash
node dist/rodoh-cartridge.mjs digest --file signal-garden.arc.json
```

Record the resulting `cart1_…` value in the custody manifest. Any authored change produces new authored law and therefore a new digest.

Top-level custody metadata such as signatures and trust labels does not change `cart1_`. Nested authored data always does.

## 9. Test the real neutral player

Import the cartridge through Rodoh's ordinary file input. It must:

- remain outside the Program-of-Record registry;
- show the exact computed digest;
- use neutral presentation unless it carries a separately governed theme pack;
- render unfamiliar roles, attributes, resources, and consequences without runtime source changes;
- complete through visible player actions;
- export `axm-cartridge-run/v3`;
- clear the holder context, import the exact run, and resume;
- preserve unknown namespaced memory;
- make no external network request to play.

A new cartridge-specific switch statement, resolver, schema exception, role heuristic, first-party art binding, or trust claim fails this proof.

## 10. Publish the custody set

A durable creator release contains:

```text
source or editable Arc
executable Arc
malformed refusal fixture
representative changed run
manifest with exact digest and file SHA-256 values
validation receipt
simulation receipt
neutral-player receipt
license and attribution
```

A release attestation may prove which workflow assembled that custody set. It does not turn the cartridge into certified canon.

## Registered Godscar source planes

The current registered source formats are:

```text
godscar-pocket/1
dark-tomb-pocket/1
common-ship-pocket/1
```

Their sources compile into ordinary Arcs and survive inside the cartridge for exact recovery. Book IV's Lineage Commons remains publication canon and staged post-1.0 work. It is not a valid source plane in this kit.
