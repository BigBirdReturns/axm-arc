# The First Charter — campaign acceptance

The First Charter is the reference cartridge. It must prove more than a valid
schema and a polished first contract: its own authored founding law must be able
to field, progress through, and finish all six authored challenges without a
hidden recruitment dependency or a gate bypass.

## Closed structural defects in v1.2.0

- The founding roster now contains the final contract's persistent role floor:
  one Vanguard, two Skirmishers, and two Menders among the six founders.
- Tier-two attunement gates require a majority of the committed party rather
  than every member. A legal five-person Merchant Escort clear can no longer
  strand a later six-person rescue party.
- Tier-two check and time-pressure thresholds were calibrated against the exact
  authored founding distribution rather than only a synthetic high-capacity
  roster.

## Executable acceptance

`tests/sim/first-charter-campaign.test.ts` starts the conformance harness from
`foundOrganization(FIRST_CHARTER, input)` and requires:

- the default authored founding seed to clear all six challenges within the
  cartridge's stated ten-cycle estimate;
- every sampled explicit founding seed to clear all six within forty cycles;
- zero access-gate violations;
- zero structurally unfieldable final rosters.

The acceptance test deliberately lives under `tests/sim/`, not the vendored
engine suite: campaign balance is Arc product evidence, while World consumes the
same authored data and deterministic engine through the reconciliation pin.

## What this proves — and what it does not

It proves campaign reachability, role feasibility, progression integrity, and a
bounded deterministic balance floor across sampled authored starts.

It does not replace cold-player evidence, encounter pacing, mobile craft, or a
complete Rodoh presentation run. Those are World/reference-product gates and
remain separately testable.
