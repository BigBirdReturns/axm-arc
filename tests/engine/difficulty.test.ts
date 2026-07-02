// applyDifficultyMode (src/engine/difficulty.ts): a pure challenge transform.
// The resolver stays mode-blind; identity is preserved so history and
// milestones key to the base challenge.

import { describe, it, expect } from "vitest";
import { applyDifficultyMode } from "../../src/engine/difficulty.js";
import { accrueChallengeRewards } from "../../src/engine/economy.js";
import type { DifficultyMode, RunReport } from "../../src/engine/types.js";
import { GATED_ARC } from "../fixtures/gated-arc.js";
import { makeCycleAgent, makeCycleOrg } from "../fixtures/cycle-arc.js";

const heroic = GATED_ARC.difficultyModes.find((m) => m.id === "heroic")!;
const innerVault = GATED_ARC.challenges.find((c) => c.id === "inner-vault")!;

describe("applyDifficultyMode", () => {
  it("scales base check thresholds and appends mode mechanics unscaled", () => {
    const out = applyDifficultyMode(innerVault, heroic);
    // base vault-power 7 * 1.5 -> 11 (rounded)
    expect(out.mechanicChecks.find((c) => c.id === "vault-power")!.difficultyThreshold).toBe(11);
    // additions are authored FOR the mode: appended as-is
    expect(out.mechanicChecks.find((c) => c.id === "heroic-focus")!.difficultyThreshold).toBe(6);
    expect(out.mechanicChecks).toHaveLength(innerVault.mechanicChecks.length + 1);
  });

  it("scales time pressure and clamps difficultyRating to the schema range", () => {
    const out = applyDifficultyMode(innerVault, heroic);
    expect(out.timePressure!.aggregateThreshold).toBe(30); // 20 * 1.5
    expect(out.difficultyRating).toBe(60); // 40 * 1.5

    const brutal: DifficultyMode = {
      id: "brutal",
      name: "Brutal",
      globalModifiers: { difficultyMultiplier: 10, rewardMultiplier: 1, mechanicAdditions: [] },
    };
    expect(applyDifficultyMode(innerVault, brutal).difficultyRating).toBe(100);
  });

  it("scales outcome currency and reputation, preserves identity, mutates nothing", () => {
    const out = applyDifficultyMode(innerVault, heroic);
    expect(out.id).toBe(innerVault.id);
    expect(out.outcomes.success.currencyReward).toBe(200); // 100 * 2
    expect(out.outcomes.success.reputationGain).toBe(10); // 5 * 2
    expect(out.outcomes.partial.currencyReward).toBe(80); // 40 * 2
    // failure has no currency/reputation authored; scaling must not invent them
    expect(out.outcomes.failure.currencyReward).toBeUndefined();

    // purity: the arc's challenge is untouched
    expect(innerVault.mechanicChecks).toHaveLength(1);
    expect(innerVault.outcomes.success.currencyReward).toBe(100);
    expect(innerVault.difficultyRating).toBe(40);
  });

  it("scaled outcomes pay through reward accrual via the challenge override", () => {
    const agent = makeCycleAgent({ id: "vet-1" });
    const org = makeCycleOrg([agent], { currency: 0, reputation: 0 });
    const report = {
      challengeId: "inner-vault",
      outcome: "success",
      cycle: 1,
    } as RunReport;
    const scaled = applyDifficultyMode(innerVault, heroic);
    const paid = accrueChallengeRewards(org, report, GATED_ARC, scaled);
    expect(paid.currencyGranted).toBe(200);
    expect(paid.reputationGranted).toBe(10);
    // without the override, base rates pay — proving the override is what
    // carries the mode through runCycle
    const base = accrueChallengeRewards(org, report, GATED_ARC);
    expect(base.currencyGranted).toBe(100);
  });
});
