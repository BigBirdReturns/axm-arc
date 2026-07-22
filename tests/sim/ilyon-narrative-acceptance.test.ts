import { describe, expect, it } from "vitest";
import { KIND_GODS_OF_ILYON } from "../../src/arcs/kind-gods-of-ilyon.js";
import { readGodscarPocketExtension } from "../../src/godscar/compiler.js";

const source = readGodscarPocketExtension(KIND_GODS_OF_ILYON);
if (!source) throw new Error("The Kind Gods of Ilyon must retain its Godscar source extension");

const beatIds = [
  "end-the-fever",
  "map-the-dependency",
  "read-the-dead-star",
  "hear-the-ocean",
  "refuse-integration",
  "carry-the-evidence",
];

const consequenceIds = [
  "cure-dependency",
  "public-dependency-map",
  "dead-star-custody",
  "ocean-embassy",
  "forked-infrastructure",
  "scarway-disclosure",
];

describe("The Kind Gods of Ilyon narrative acceptance contract", () => {
  it("carries the control question through opening, campaign, completion, and source", () => {
    expect(KIND_GODS_OF_ILYON.opening?.narrativeText).toBe(source.controlQuestion);
    expect(KIND_GODS_OF_ILYON.opening?.options.map((option) => option.id)).toEqual([
      "accept-the-gift",
      "preserve-refusal",
    ]);
    expect(KIND_GODS_OF_ILYON.opening?.options[0]?.effects).not.toEqual(
      KIND_GODS_OF_ILYON.opening?.options[1]?.effects,
    );

    const completion = (KIND_GODS_OF_ILYON.narrativeEvents ?? []).find(
      (event) => event.trigger.type === "arc_complete",
    );
    expect(completion?.text).toContain(source.controlQuestion);
    expect(source.identity.description).toMatch(/salvation|integration/i);
  });

  it("escalates one causal argument from public good through evidence to refusal", () => {
    expect(source.beats.map((beat) => beat.id)).toEqual(beatIds);
    expect(source.beats.map((beat) => beat.accessAfter ?? null)).toEqual([
      null,
      "end-the-fever",
      "map-the-dependency",
      "read-the-dead-star",
      "hear-the-ocean",
      "refuse-integration",
    ]);
    expect(KIND_GODS_OF_ILYON.progressionTiers.map((tier) => tier.id)).toEqual([
      "arrival",
      "disclosure",
      "refusal",
    ]);
    expect(source.beats.map((beat) => beat.tierId)).toEqual([
      "arrival",
      "arrival",
      "disclosure",
      "disclosure",
      "refusal",
      "refusal",
    ]);
  });

  it("binds every beat to a persistent consequence and named inheritor", () => {
    expect(source.beats.map((beat) => beat.consequenceId)).toEqual(consequenceIds);
    expect(source.consequences.map((consequence) => consequence.id)).toEqual(consequenceIds);

    for (const consequence of source.consequences) {
      expect(consequence.description.trim().length).toBeGreaterThan(30);
      expect(consequence.inheritedBy.trim().length).toBeGreaterThan(15);
    }

    const completion = (KIND_GODS_OF_ILYON.narrativeEvents ?? []).find(
      (event) => event.trigger.type === "arc_complete",
    );
    expect(completion?.rewards).toEqual(source.consequences.map((consequence) => consequence.label));
  });

  it("keeps evidence provenance, uncertainty, and false-claim cost attached", () => {
    expect(source.evidence.tier).toBe("contested-canon");
    expect(source.evidence.venue.trim()).not.toBe("");
    expect(source.evidence.legitimacyTarget.trim()).not.toBe("");
    expect(source.evidence.upsideIfAccepted.trim()).not.toBe("");
    expect(source.evidence.downsideIfAccepted.trim()).not.toBe("");
    expect(source.evidence.failureIfFalse.trim()).not.toBe("");

    for (const receipt of source.evidence.receipts) {
      expect(receipt.source.trim()).not.toBe("");
      expect(receipt.intervention.trim()).not.toBe("");
      expect(receipt.limits.trim()).not.toBe("");
    }
  });

  it("gives every faction a real public good and a characteristic failure", () => {
    expect(source.factionReceipts.length).toBeGreaterThanOrEqual(3);
    for (const faction of source.factionReceipts) {
      expect(faction.publicGood.trim().length).toBeGreaterThan(25);
      expect(faction.characteristicFailure.trim().length).toBeGreaterThan(25);
      expect(faction.publicGood).not.toBe(faction.characteristicFailure);
    }
  });

  it("embeds all five incompatible cast responsibilities", () => {
    expect(source.cast.map((member) => member.responsibility).sort()).toEqual([
      "benefits-from-delay",
      "depends-on-system",
      "holds-evidence",
      "sovereign-exception",
      "translates-excluded-actor",
    ]);
    expect(new Set(source.cast.map((member) => member.name)).size).toBe(source.cast.length);
  });

  it("makes success, partial success, and failure narratively distinct at every beat", () => {
    for (const beat of source.beats) {
      const outcomes = [beat.success, beat.partial, beat.failure];
      expect(new Set(outcomes).size).toBe(3);
      for (const outcome of outcomes) expect(outcome.trim().length).toBeGreaterThan(40);
    }
  });

  it("retains every declared Story Physics invariant", () => {
    expect(Object.values(source.storyPhysics)).toHaveLength(8);
    expect(Object.values(source.storyPhysics).every((value) => value === true)).toBe(true);
  });
});
