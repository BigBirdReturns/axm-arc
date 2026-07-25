# RODOH Creator Recovery Kit

This directory is the public, offline-capable entry point for creating and checking a RODOH cartridge without reading engine internals.

The release form of this kit contains one self-contained Node 22 command:

```text
dist/rodoh-cartridge.mjs
```

It also carries the exact Orchard clean-room reference, its malformed companion, its changed-run receipt, source-plane starter examples, the `cart1_` conformance vectors, resource-limit contract, error catalog, and checksums.

## Commands

```bash
node dist/rodoh-cartridge.mjs validate --file my-cartridge.arc.json
node dist/rodoh-cartridge.mjs digest --file my-cartridge.arc.json
node dist/rodoh-cartridge.mjs inspect --file my-cartridge.arc.json
node dist/rodoh-cartridge.mjs simulate --file my-cartridge.arc.json --seeds 16 --max-cycles 120
node dist/rodoh-cartridge.mjs verify-run --file my-changed.run.json
node dist/rodoh-cartridge.mjs recover-source --file my-cartridge.arc.json --plane common-ship-pocket --output recovered.ship.json
```

Every command writes a machine-readable receipt to standard output and exits nonzero when the claim it was asked to prove is false.

## Authority boundary

- The CLI validates and simulates through the same Arc engine modules used by AXM Arc and Rodoh World.
- It does not certify quality, safety, canon status, publisher identity, or marketplace trust.
- A successful `validate` receipt proves schema conformance at the named engine baseline.
- A successful `simulate` receipt proves that the bounded deterministic autoplay policy completed the tested seeds without gate bypass, stall, max-cycle exit, or warning. It does not promise that every human strategy succeeds.
- `cart1_` identifies exact authored law and does not prove who authored it.
- A cartridge remains ordinary JSON. It contains no executable code.

## Start here

Read `CREATE_YOUR_FIRST_CARTRIDGE.md`, copy the complete Orchard example, change one concept at a time, and keep the validation and simulation receipts beside the artifact they describe.

For the three registered Godscar source planes, author the source object first and compile it through AXM Arc. For a plain generic Arc, author the Arc directly. Both routes produce the same executable cartridge contract.
