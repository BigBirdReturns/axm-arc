# Portable Run v3 — exact changed-state custody

`axm-cartridge-run/v3` is the common run envelope shared by compatible AXM
players. A raw Arc proves that authored law can move. A v3 run proves that a
holder can move the **changed execution state** without asking the player that
created it to reinterpret or discard another player's memory.

The canonical implementation is `src/engine/portable-run.ts`.

## Envelope

```ts
interface PortableRunV3 {
  format: "axm-cartridge-run/v3";
  authoredArcDigest: string;
  arc: Arc;
  engine: {
    saveVersion: number;
    game: string; // exact serializeGame(...) output
  };
  extensions: Record<string, JsonValue>;
  integrity: {
    algorithm: "sha256";
    digest: `run3_${string}`;
  };
}
```

The integrity digest covers the canonical JSON representation of every field
except `integrity`. Object keys are codepoint-ordered. Arrays retain authored
order. Non-finite numbers and non-JSON values are refused.

## Import order

A compatible importer must:

1. parse a plain JSON object and reject unknown top-level fields;
2. verify the `run3_` payload digest before executing or normalizing state;
3. validate the included Arc;
4. require the Arc to already be in canonical validated form;
5. recompute `authoredArcDigest` from the included Arc bytes;
6. compare the declared save version with the embedded engine save;
7. call the canonical engine `deserializeGame` against that exact Arc;
8. assign trust and local provenance at the receiving runtime;
9. preserve every JSON extension namespace, including namespaces it does not
   understand.

A file cannot claim that it is bundled, verified, official, or signed merely by
including such language in an extension. Trust is receiver-side provenance.

## Extension law

The engine does not interpret runtime presentation state. Runtime players own
namespaced extension records such as:

- `axm-arc.turn@1` — hub assignments and unresolved reward decisions;
- `rodoh.ledger@2` — Rodoh's append-only consequence record;
- `rodoh.experience@1` — a resumable presentation checkpoint;
- `rodoh.runtime@1` — the selected runtime representation;
- future private or third-party namespaces.

Unknown namespaces are holder-owned memory. A runtime may ignore one while
playing, but must not silently strip it during a load/save/export round trip.

## Local storage

The hub stores the exact engine save and extension bag in one local envelope
under the Arc digest. Previous direct engine-save slots remain readable and are
upgraded on the next successful write.

Every load-bearing write returns an explicit result. A failed write must produce
an unsaved state and an immediate v3 export recovery path; a console warning is
not custody.

## Revision identity

Installed cartridge revisions are immutable. A new bundled digest is installed
alongside an older held digest rather than replacing it in place. The active
selection records both Arc id and exact digest, so same-id revisions and their
separate saves remain addressable.

## Conformance

The engine test vectors cover:

- exact build/parse round trips;
- payload mutation rejection;
- Arc identity recomputation;
- embedded save-to-Arc binding;
- save-version mismatch rejection;
- strict top-level fields and JSON-only extensions;
- preservation of unknown extension namespaces.

The hub integration tests additionally prove installation, exact restore,
in-progress turn restore, same-id digest selection, and no writes on an invalid
file.
