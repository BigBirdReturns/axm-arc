import { describe, expect, it } from "vitest";
import {
  UNDERDRAIN_ROOT_GATE_CHOICE_IDS,
  UNDERDRAIN_ROOT_GATE_RECEIPT_FORMAT,
  acceptUnderdrainRootGateChoice,
  initialUnderdrainCampaignState,
  verifyUnderdrainRootGateReceipt,
} from "../../src/demos/underdrain/index.js";

describe("UNDERDRAIN Root Gate accepted choice authority", () => {
  it("accepts the balanced compact as a deterministic Arc-owned state transition", () => {
    const before = {
      ...initialUnderdrainCampaignState(),
      "town-water-pressure": 6,
      "fungus-contact": "parley",
      "crown-grievance": 4,
      "rhea-status": "drafted",
      "evidence-custody": "sampled",
      "root-gate-open": true,
    };
    const receipt = acceptUnderdrainRootGateChoice({
      choiceId: "balanced-flow-compact",
      campaignBefore: before,
    });
    expect(receipt).toMatchObject({
      format: UNDERDRAIN_ROOT_GATE_RECEIPT_FORMAT,
      challengeId: "root-gate-parley",
      experienceId: "root-gate-parley",
      choiceId: "balanced-flow-compact",
      outcome: "success",
      campaignAfter: {
        "fungus-contact": "compact",
        "crown-grievance": 2,
        "rhea-status": "liaison",
        "evidence-custody": "public",
      },
    });
    expect(receipt.receiptDigest).toMatch(/^choice1_[0-9a-f]{64}$/);
    expect(verifyUnderdrainRootGateReceipt({ receipt })).toEqual(receipt);
    expect(acceptUnderdrainRootGateChoice({
      choiceId: "balanced-flow-compact",
      campaignBefore: before,
    })).toEqual(receipt);
  });

  it("keeps the two unilateral compacts distinct and honestly partial", () => {
    const before = initialUnderdrainCampaignState();
    const town = acceptUnderdrainRootGateChoice({
      choiceId: "town-first-flow",
      campaignBefore: before,
    });
    const nursery = acceptUnderdrainRootGateChoice({
      choiceId: "nursery-first-flow",
      campaignBefore: before,
    });
    expect(town.outcome).toBe("partial");
    expect(nursery.outcome).toBe("partial");
    expect(town.choiceId).not.toBe(nursery.choiceId);
    expect(town.receiptDigest).not.toBe(nursery.receiptDigest);
    expect(town.campaignAfter).toEqual(nursery.campaignAfter);
  });

  it("refuses a choice that is not present in the authored Root Gate experience", () => {
    expect(UNDERDRAIN_ROOT_GATE_CHOICE_IDS).toEqual([
      "town-first-flow",
      "nursery-first-flow",
      "balanced-flow-compact",
    ]);
    expect(() => acceptUnderdrainRootGateChoice({
      choiceId: "secret-fourth-compact" as never,
      campaignBefore: initialUnderdrainCampaignState(),
    })).toThrow(/Unknown Root Gate choice/);
  });

  it("refuses receipt or state tampering on replay", () => {
    const receipt = acceptUnderdrainRootGateChoice({
      choiceId: "balanced-flow-compact",
      campaignBefore: initialUnderdrainCampaignState(),
    });
    const tampered = structuredClone(receipt);
    tampered.campaignAfter["crown-grievance"] = 0;
    expect(() => verifyUnderdrainRootGateReceipt({ receipt: tampered })).toThrow(/receipt replay mismatch/);
  });
});
