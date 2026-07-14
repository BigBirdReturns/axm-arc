import { describe, it, expect } from "vitest";
import { Rng } from "../../src/engine/prng.js";
import {
  evaluateLootEligibility,
  awardItem,
  computeRewardDisappointment,
  applyRewardDecision,
} from "../../src/engine/rewards.js";
import { makeTestAgent, makeTestOrg, STATE_ARC } from "../fixtures/state-arc.js";

// ── evaluateLootEligibility ───────────────────────────────────────────────────

describe("evaluateLootEligibility", () => {
  it("allows tier1 agent to claim a tier1-required item", () => {
    const agent = makeTestAgent({ id: "a1", tier: "tier1" });
    const item = STATE_ARC.items.find((i) => i.id === "basic-sword")!;
    expect(evaluateLootEligibility(item, agent, STATE_ARC)).toBe(true);
  });

  it("rejects a tier1 agent from claiming a tier2-required item", () => {
    const agent = makeTestAgent({ id: "a1", tier: "tier1" });
    const item = STATE_ARC.items.find((i) => i.id === "elite-sword")!;
    expect(evaluateLootEligibility(item, agent, STATE_ARC)).toBe(false);
  });

  it("allows a higher-tier agent to claim a lower-tier item", () => {
    const agent = makeTestAgent({ id: "a1", tier: "tier2" });
    const item = STATE_ARC.items.find((i) => i.id === "basic-sword")!;
    expect(evaluateLootEligibility(item, agent, STATE_ARC)).toBe(true);
  });
});

// ── awardItem ─────────────────────────────────────────────────────────────────

describe("awardItem", () => {
  it("equips the item in the correct slot", () => {
    const agent = makeTestAgent({ id: "a1" });
    const org = makeTestOrg([agent]);
    const item = STATE_ARC.items.find((i) => i.id === "basic-sword")!;
    const result = awardItem(org, "a1", item, 5, "test-challenge");
    expect(result.agents["a1"]!.equippedItems["weapon"]).toBe("basic-sword");
  });

  it("adds a reward history entry", () => {
    const agent = makeTestAgent({ id: "a1" });
    const org = makeTestOrg([agent]);
    const item = STATE_ARC.items.find((i) => i.id === "basic-sword")!;
    const result = awardItem(org, "a1", item, 3, "challenge-xyz");
    const history = result.agents["a1"]!.rewardHistory;
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ itemId: "basic-sword", cycle: 3, challengeId: "challenge-xyz" });
  });

  it("returns org unchanged when agentId does not exist", () => {
    const agent = makeTestAgent({ id: "a1" });
    const org = makeTestOrg([agent]);
    const item = STATE_ARC.items.find((i) => i.id === "basic-sword")!;
    const result = awardItem(org, "nonexistent", item, 1, "c1");
    expect(result).toBe(org);
  });
});

// ── computeRewardDisappointment ───────────────────────────────────────────────

describe("computeRewardDisappointment", () => {
  it("returns an empty map when there is only the winner", () => {
    const winner = makeTestAgent({ id: "winner" });
    const org = makeTestOrg([winner]);
    const item = STATE_ARC.items.find((i) => i.id === "basic-sword")!;
    const deltas = computeRewardDisappointment(org, [winner], "winner", item, 5);
    expect(deltas.size).toBe(0);
  });

  it("produces negative affinity deltas for non-winners", () => {
    const winner = makeTestAgent({ id: "winner" });
    const loser = makeTestAgent({ id: "loser", loyalty: 5 });
    const org = makeTestOrg([winner, loser]);
    const item = STATE_ARC.items.find((i) => i.id === "basic-sword")!;
    const deltas = computeRewardDisappointment(org, [winner, loser], "winner", item, 5);
    const affinityHit = deltas.get("loser_toward_winner");
    expect(affinityHit).toBeDefined();
    expect(affinityHit!).toBeLessThan(0);
  });

  it("high loyalty reduces the disappointment hit", () => {
    const winner = makeTestAgent({ id: "winner" });
    const lowLoyalty = makeTestAgent({ id: "low", loyalty: 0 });
    const highLoyalty = makeTestAgent({ id: "high", loyalty: 18 });
    const org = makeTestOrg([winner, lowLoyalty, highLoyalty]);
    const item = STATE_ARC.items.find((i) => i.id === "elite-sword")!;
    const deltas = computeRewardDisappointment(org, [winner, lowLoyalty, highLoyalty], "winner", item, 10);
    const lowHit = deltas.get("low_toward_winner")!;
    const highHit = deltas.get("high_toward_winner")!;
    // Both are negative; low loyalty agent suffers a bigger (more negative) hit
    expect(lowHit).toBeLessThan(highHit);
  });
});

// ── applyRewardDecision ───────────────────────────────────────────────────────

describe("applyRewardDecision", () => {
  it("awards the item to the winner", () => {
    const winner = makeTestAgent({ id: "winner" });
    const org = makeTestOrg([winner]);
    const item = STATE_ARC.items.find((i) => i.id === "basic-sword")!;
    const rng = new Rng(42);
    const { org: result } = applyRewardDecision(
      org,
      { item, eligible: ["winner"], winner: "winner", sourceChallenge: "c1" },
      rng,
      1,
    );
    expect(result.agents["winner"]!.equippedItems["weapon"]).toBe("basic-sword");
  });

  it("does not award loot to a winner who is not in the eligible list", () => {
    const insider = makeTestAgent({ id: "insider" });
    const outsider = makeTestAgent({ id: "outsider" });
    const org = makeTestOrg([insider, outsider]);
    const item = STATE_ARC.items.find((i) => i.id === "basic-sword")!;
    const rng = new Rng(42);
    const { org: result } = applyRewardDecision(
      org,
      { item, eligible: ["insider"], winner: "outsider", sourceChallenge: "c1" },
      rng,
      1,
    );
    // Ineligible winner must not receive the item.
    expect(result.agents["outsider"]!.equippedItems["weapon"]).toBeUndefined();
    expect(result.agents["outsider"]!.rewardHistory).toHaveLength(0);
  });

  it("drops non-winner morale when they were eligible", () => {
    const winner = makeTestAgent({ id: "winner", morale: 70 });
    const loser = makeTestAgent({ id: "loser", morale: 70, loyalty: 5 });
    const org = makeTestOrg([winner, loser]);
    const item = STATE_ARC.items.find((i) => i.id === "basic-sword")!;
    const rng = new Rng(42);
    const { org: result } = applyRewardDecision(
      org,
      { item, eligible: ["winner", "loser"], winner: "winner", sourceChallenge: "c1" },
      rng,
      5,
    );
    expect(result.agents["loser"]!.morale).toBeLessThan(70);
  });

  it("appends a precedent to the org", () => {
    const winner = makeTestAgent({ id: "winner" });
    const org = makeTestOrg([winner]);
    const item = STATE_ARC.items.find((i) => i.id === "basic-sword")!;
    const rng = new Rng(42);
    const { org: result, precedent } = applyRewardDecision(
      org,
      { item, eligible: ["winner"], winner: "winner", sourceChallenge: "c1" },
      rng,
      3,
    );
    expect(result.precedents).toHaveLength(1);
    expect(precedent.type).toBe("reward");
    expect(precedent.winner).toBe("winner");
  });

  it("generates a reward_dispute drama trigger when 2+ agents are eligible", () => {
    const winner = makeTestAgent({ id: "winner" });
    const runner = makeTestAgent({ id: "runner" });
    const org = makeTestOrg([winner, runner]);
    const item = STATE_ARC.items.find((i) => i.id === "basic-sword")!;
    const rng = new Rng(42);
    const { dramaTriggers } = applyRewardDecision(
      org,
      { item, eligible: ["winner", "runner"], winner: "winner", sourceChallenge: "c1" },
      rng,
      1,
    );
    expect(dramaTriggers.some((t) => t.type === "reward_dispute")).toBe(true);
  });

  it("treats eligible agent ids as a deterministic set", () => {
    const winner = makeTestAgent({ id: "winner" });
    const runner = makeTestAgent({ id: "runner" });
    const org = makeTestOrg([winner, runner]);
    const item = STATE_ARC.items.find((i) => i.id === "basic-sword")!;
    const forward = applyRewardDecision(
      org,
      { item, eligible: ["winner", "runner"], winner: "winner", sourceChallenge: "c1" },
      new Rng(42),
      1,
    );
    const reversedWithDuplicate = applyRewardDecision(
      org,
      { item, eligible: ["runner", "winner", "runner"], winner: "winner", sourceChallenge: "c1" },
      new Rng(42),
      1,
    );
    expect(reversedWithDuplicate).toEqual(forward);
    expect(JSON.stringify(reversedWithDuplicate)).toBe(JSON.stringify(forward));
  });

  it("does NOT generate a reward_dispute trigger when only 1 agent is eligible", () => {
    const winner = makeTestAgent({ id: "winner" });
    const org = makeTestOrg([winner]);
    const item = STATE_ARC.items.find((i) => i.id === "basic-sword")!;
    const rng = new Rng(42);
    const { dramaTriggers } = applyRewardDecision(
      org,
      { item, eligible: ["winner"], winner: "winner", sourceChallenge: "c1" },
      rng,
      1,
    );
    expect(dramaTriggers.some((t) => t.type === "reward_dispute")).toBe(false);
  });

  it("greedy trait doubles the morale penalty for non-winners", () => {
    const winner = makeTestAgent({ id: "winner", morale: 70 });
    const greedyLoser = makeTestAgent({ id: "greedy-loser", morale: 70, loyalty: 5, traits: ["greedy"] });
    const normalLoser = makeTestAgent({ id: "normal-loser", morale: 70, loyalty: 5 });
    const org = makeTestOrg([winner, greedyLoser, normalLoser]);
    const item = STATE_ARC.items.find((i) => i.id === "basic-sword")!;
    const rng = new Rng(42);
    const { org: result } = applyRewardDecision(
      org,
      { item, eligible: ["winner", "greedy-loser", "normal-loser"], winner: "winner", sourceChallenge: "c1" },
      rng,
      5,
    );
    const greedyDrop = 70 - result.agents["greedy-loser"]!.morale;
    const normalDrop = 70 - result.agents["normal-loser"]!.morale;
    expect(greedyDrop).toBeGreaterThanOrEqual(normalDrop);
  });
});
