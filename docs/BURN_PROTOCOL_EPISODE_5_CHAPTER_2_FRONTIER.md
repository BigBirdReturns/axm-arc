# The Burn Protocol Episode 5 Chapter 2 source frontier — landed history

This frontier transaction established repository-owned intake at `E05-C2-P21`. The source-ledger chapter subsequently landed through Arc PR #227 as:

```text
Episode 5: Nursery World
Chapter 2: The Mother
E05-C2-P21 through E05-C2-P40
next outside continuation E05-C3-P41
```

The historical E05C2 recovery contract remains in Git for reproducibility and compatibility verification:

```text
tools/burn-protocol-source-frontier/contracts/e05c2-source-intake.contract.json
```

Its former production workflow is retired:

```text
retired  .github/workflows/burn-protocol-e05c2-source-harvest.yml
```

The sole active source frontier is now recorded in:

```text
tools/burn-protocol-source-frontier/active-frontier.json
```

and documented by `docs/BURN_PROTOCOL_EPISODE_5_CHAPTER_3_FRONTIER.md`. The E05C2 contract and prior sweep receipts remain evidence of the earlier custody boundary; they have no current schedule, push trigger, dispatch surface, or issue-publishing authority.

The original authority law remains unchanged. Only the exact 641,627,846-byte parent with SHA-256 `f67dcd2c632720566e38b04c0a6b844188de24c967a77a4be31978a5ff82349a`, or an independently approved packet set verified against the named contract, could grant custody standing. Neither the historical sweep nor the later source-ledger amendment reconstructed canonical text or plate mappings.
