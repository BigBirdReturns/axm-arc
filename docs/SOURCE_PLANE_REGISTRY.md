# Creator source-plane registry

The source-plane registry is the canonical catalog connecting editable creator source to an ordinary deterministic Arc. It exists so Arc authoring and Rodoh projection can discover the same source formats without either client maintaining a parallel switch statement or a second compiler.

## Registered 1.0 source planes

| Registry id | Source format | Arc extension | Source suffix | Authority |
|---|---|---|---|---|
| `godscar-pocket` | `godscar-pocket/1` | `godscar.pocket@1` | `.pocket.json` | *The Godscar Codex, Book I: The Open Universe* |
| `dark-tomb-pocket` | `dark-tomb-pocket/1` | `godscar.dark-tomb@1` | `.tomb.json` | *The Godscar Codex, Book II: The Dark Tomb* |
| `common-ship-pocket` | `common-ship-pocket/1` | `godscar.common-ship@1` | `.ship.json` | *The Godscar Codex, Book III: The Common Ship* |

Every definition supplies one starter, validator, compiler, and exact recovery function. The compiler always emits an ordinary Arc and embeds the validated source unchanged under the definition's namespaced extension key. The holder can therefore recover, inspect, fork, and redistribute the editable source without a server or receiver-specific database.

## Public operations

`src/source-planes/registry.ts` exports:

- `SOURCE_PLANE_REGISTRY`, the stable ordered catalog;
- lookup by registry id, source format, or extension key;
- source-format discovery without guessing;
- `validateRegisteredSourcePlane()`;
- `compileRegisteredSourcePlane()`;
- `inspectArcSourcePlanes()`;
- exact recovery by registered source-plane id.

Unknown formats fail validation. Unknown namespaced Arc extensions are ignored by source-plane inspection and remain preserved by the cartridge and run custody layers. Recognition never grants authority to rewrite an extension.

## Addition rule

A new source plane is incomplete until all of the following land together in Arc:

1. versioned creator source type and strict validator;
2. deterministic compiler into the published Arc ABI;
3. exact source embedding and recovery;
4. complete starter or reference fixture;
5. source-plane-specific tests;
6. registry definition and cross-plane round-trip tests;
7. reconciliation and World vendoring updates.

World may render a known source and use registry metadata for labels, file handling, and projection selection. It may not implement a second validator, compiler, state transition, or composition evaluator.

## Gate boundary

The registry and expanded Arc/World reconciliation complete RODOH Gate 2. They do not themselves ship the Lamp District, Relief Circuit, a Tomb receiver, a Common Ship receiver, or a public distribution service.
