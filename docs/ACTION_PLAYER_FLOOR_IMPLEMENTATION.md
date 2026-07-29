# Arc Action Player Floor implementation

This post-v1 candidate implements Arc-owned player law under the consolidated floor:

```text
Tier Bench floor main
9693cb99694338e72c15d0ffbb87b5a1c5bbf16a

catalog
actionfloor1_55eb8869417b3b36a28a309263624fe04ad07028f2254337a2f1548cd03b47d8

UNDERDRAIN player intent
playerintent1_91647652ca3f387b114d5fa7cfab416e2d99c5f307098b6426a17f624cdfbe6c
```

## Owned law

Arc now owns a provider-neutral `axm-action-player-profile/1` extension containing:

- named integer timing profiles;
- per-challenge allowed and default timing profiles;
- teach, practice, and mastery stages for mandatory mechanics;
- required semantic cue identities;
- authored advantages and alternate completion windows;
- canonical validation through ordinary `validateArc`.

A selected timing profile is an optional part of `axm-action-spec/1` and `axm-action-receipt/1`. Its absence preserves the legacy compile, seed, spec, trace, state, and receipt path. Its presence changes the exact spec and seed and must survive exact Arc replay.

The semantic cue plane is a pure deterministic projection over exact Arc specifications and adjacent action states. It emits content-addressed `axm-action-cue/1` records and an `axm-action-cue-trace/1` without changing simulation state or accepted receipts.

## UNDERDRAIN learning law

```text
teach
  diagnose-spore-valves
  forgiving timing
  low-damage skirmisher pressure
  optional parry advantage

practice
  operate-purge-wheel
  standard timing
  optional full stagger work window

master
  open-crown-sluice
  standard timing
  full parry-stagger work window
  authored shorter enemy-recovery alternate
```

The player presentation may express the cue stream through animation, VFX, audio, camera, HUD, haptics, subtitles, and accessibility alternatives. It may not invent cue timing, widen an action window locally, apply damage, complete an objective, move an authoritative actor, or accept an outcome.

## Evidence ladder

The permanent workflow proves TypeScript, hostile profile and receipt contracts, deterministic cue identities, exact reference reconstruction, complete Arc regression, production build, and a pristine checkout. It does not prove Unity import, Windows-player feel, controller feel, player comprehension, Quest, or physical acceptance.
