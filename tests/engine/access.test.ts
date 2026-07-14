// Gating derivations (src/engine/access.ts): the Karazhan-class vocabulary —
// attunement chains, agent-attunement gates, progression tiers — made live.
// Milestone normalization must match world's compile pipeline (see
// RECONCILIATION.md): both "<id>-cleared" and bare "<id>" satisfy a gate once
// the named challenge has a success record.

import { describe, it, expect } from "vitest";
import {
  challengeAccess,
  clearedChallenges,
  completedAttunementChains,
  milestoneSatisfied,
  requiredAttunementChains,
  stampNewAttunements,
  stampUnlockedProgressionTiers,
  unlockedProgressionTierIds,
} from "../../src/engine/access.js";
import { runCycle } from "../../src/engine/cycle.js";
import type { Challenge } from "../../src/engine/types.js";
import { GATED_ARC } from "../fixtures/gated-arc.js";
import { makeCycleAgent, makeCycleOrg } from "../fixtures/cycle-arc.js";

const innerVault = GATED_ARC.challenges.find((c) => c.id === "inner-vault")!;

describe("milestone normalization (world-compile parity)", () => {
  it("accepts both -cleared and bare challenge-id spellings", () => {
    const cleared = new Set(["test-challenge"]);
    expect(milestoneSatisfied("test-challenge-cleared", cleared)).toBe(true);
    expect(milestoneSatisfied("test-challenge", cleared)).toBe(true);
    expect(milestoneSatisfied("other-cleared", cleared)).toBe(false);
  });

  it("derives cleared challenges from success records only", () => {
    const winner = makeCycleAgent({ assignmentCount: 1 });
    const loser = makeCycleAgent();
    loser.assignmentHistory = [{ challengeId: "inner-vault", cycle: 1, outcome: "failure" }];
    const org = makeCycleOrg([winner, loser]);
    expect(clearedChallenges(org)).toEqual(new Set(["test-challenge"]));
  });
});

describe("progression tier unlock", () => {
  it("an unconditioned tier is open from the start; gated tiers are not", () => {
    const org = makeCycleOrg([makeCycleAgent()]);
    expect(unlockedProgressionTierIds(org, GATED_ARC)).toEqual(new Set(["tier-1"]));
  });

  it("unlocks on milestone + reputation together, not either alone", () => {
    const cleared = makeCycleAgent({ assignmentCount: 1 });
    const milestoneOnly = makeCycleOrg([cleared], { reputation: 30 });
    expect(unlockedProgressionTierIds(milestoneOnly, GATED_ARC).has("tier-2")).toBe(false);

    const repOnly = makeCycleOrg([makeCycleAgent()], { reputation: 40 });
    expect(unlockedProgressionTierIds(repOnly, GATED_ARC).has("tier-2")).toBe(false);

    const both = makeCycleOrg([cleared], { reputation: 40 });
    expect(unlockedProgressionTierIds(both, GATED_ARC).has("tier-2")).toBe(true);
  });

  it("stamps an earned tier so a later reputation dip cannot re-lock it", () => {
    const cleared = makeCycleAgent({ assignmentCount: 1 });
    const earned = stampUnlockedProgressionTiers(
      makeCycleOrg([cleared], { reputation: 40 }),
      GATED_ARC,
    );
    expect(earned.unlockedProgressionTiers).toEqual(["tier-1", "tier-2"]);

    const lapsed = { ...earned, reputation: 0 };
    expect(unlockedProgressionTierIds(lapsed, GATED_ARC)).toEqual(
      new Set(["tier-1", "tier-2"]),
    );
    expect(stampUnlockedProgressionTiers(lapsed, GATED_ARC).unlockedProgressionTiers)
      .toEqual(["tier-1", "tier-2"]);
  });

  it("ignores stale stamped ids that the loaded cartridge does not define", () => {
    const org = {
      ...makeCycleOrg([makeCycleAgent()]),
      unlockedProgressionTiers: ["removed-tier"],
    };
    expect(unlockedProgressionTierIds(org, GATED_ARC)).toEqual(new Set(["tier-1"]));
  });
});

describe("attunement chain completion", () => {
  it("challenge_clear completes on a success record", () => {
    const agent = makeCycleAgent({ assignmentCount: 1 });
    const org = makeCycleOrg([agent]);
    expect(completedAttunementChains(agent, org, GATED_ARC).has("keyholder")).toBe(true);
  });

  it("reputation_threshold reads current org reputation", () => {
    const agent = makeCycleAgent();
    const rich = makeCycleOrg([agent], { reputation: 50 });
    expect(completedAttunementChains(agent, rich, GATED_ARC).has("exalted")).toBe(true);
    const poor = makeCycleOrg([agent], { reputation: 49 });
    expect(completedAttunementChains(agent, poor, GATED_ARC).has("exalted")).toBe(false);
  });

  it("item_acquire counts reward history and currently equipped items", () => {
    const viaReward = makeCycleAgent({ assignmentCount: 1 });
    viaReward.rewardHistory = [{ itemId: "test-item", cycle: 1, challengeId: "test-challenge" }];
    const org1 = makeCycleOrg([viaReward]);
    expect(completedAttunementChains(viaReward, org1, GATED_ARC).has("master")).toBe(true);

    const viaEquip = makeCycleAgent({ assignmentCount: 1 });
    viaEquip.equippedItems = { weapon: "test-item" };
    const org2 = makeCycleOrg([viaEquip]);
    expect(completedAttunementChains(viaEquip, org2, GATED_ARC).has("master")).toBe(true);
  });

  it("chain_complete resolves dependencies regardless of authoring order", () => {
    // master needs the item AND keyholder; the item alone is not enough.
    const itemOnly = makeCycleAgent();
    itemOnly.rewardHistory = [{ itemId: "test-item", cycle: 1, challengeId: "test-challenge" }];
    const org = makeCycleOrg([itemOnly]);
    const done = completedAttunementChains(itemOnly, org, GATED_ARC);
    expect(done.has("keyholder")).toBe(false);
    expect(done.has("master")).toBe(false);
  });

  it("stamped attunements are monotonic: a lapsed condition does not revoke", () => {
    const agent = makeCycleAgent();
    agent.attunements = ["exalted"];
    const org = makeCycleOrg([agent], { reputation: 0 });
    expect(completedAttunementChains(agent, org, GATED_ARC).has("exalted")).toBe(true);
  });
});

describe("stampNewAttunements", () => {
  it("stamps newly completed chains and reports the grants deterministically", () => {
    const a = makeCycleAgent({ id: "agent-b", assignmentCount: 1 });
    const b = makeCycleAgent({ id: "agent-a", assignmentCount: 1 });
    const org = makeCycleOrg([a, b]);
    const { org: next, newlyAttuned } = stampNewAttunements(org, GATED_ARC);
    expect(newlyAttuned).toEqual([
      { agentId: "agent-a", chainId: "keyholder" },
      { agentId: "agent-b", chainId: "keyholder" },
    ]);
    expect(next.agents["agent-a"]!.attunements).toContain("keyholder");
    // Input untouched; re-stamping is a no-op.
    expect(org.agents["agent-a"]!.attunements).toEqual([]);
    expect(stampNewAttunements(next, GATED_ARC).newlyAttuned).toEqual([]);
  });
});

describe("challengeAccess", () => {
  it("union of agentAttunements and grantsAccessTo forms the gate", () => {
    expect(requiredAttunementChains(innerVault, GATED_ARC)).toEqual(["keyholder"]);
    const withOwn: Challenge = structuredClone(innerVault);
    withOwn.accessRequirements.agentAttunements = ["exalted"];
    expect(requiredAttunementChains(withOwn, GATED_ARC)).toEqual(["exalted", "keyholder"]);
  });

  it("reports missing org milestones", () => {
    const org = makeCycleOrg([makeCycleAgent()]);
    const access = challengeAccess(innerVault, org, GATED_ARC);
    expect(access.accessible).toBe(false);
    expect(access.missingMilestones).toEqual(["test-challenge-cleared"]);
  });

  it("attunement threshold is a fraction of the declared party", () => {
    const attuned1 = makeCycleAgent({ id: "att-1", assignmentCount: 1 });
    const attuned2 = makeCycleAgent({ id: "att-2", assignmentCount: 1 });
    const fresh1 = makeCycleAgent({ id: "raw-1" });
    const fresh2 = makeCycleAgent({ id: "raw-2" });
    const org = makeCycleOrg([attuned1, attuned2, fresh1, fresh2]);

    // threshold 0.5 of a party of 4 -> 2 attuned required
    const ok = challengeAccess(innerVault, org, GATED_ARC, ["att-1", "att-2", "raw-1", "raw-2"]);
    expect(ok.attunement!.requiredCount).toBe(2);
    expect(ok.accessible).toBe(true);

    const short = challengeAccess(innerVault, org, GATED_ARC, ["att-1", "raw-1", "raw-2"]);
    expect(short.attunement!.requiredCount).toBe(2);
    expect(short.attunement!.attunedAgentIds).toEqual(["att-1"]);
    expect(short.accessible).toBe(false);
  });

  it("a null threshold means every party member must be attuned", () => {
    const strict: Challenge = structuredClone(innerVault);
    strict.accessRequirements.attunementThreshold = null;
    const attuned = makeCycleAgent({ id: "att-1", assignmentCount: 1 });
    const fresh = makeCycleAgent({ id: "raw-1" });
    const org = makeCycleOrg([attuned, fresh]);

    expect(challengeAccess(strict, org, GATED_ARC, ["att-1", "raw-1"]).accessible).toBe(false);
    expect(challengeAccess(strict, org, GATED_ARC, ["att-1"]).accessible).toBe(true);
  });

  it("without a party, feasibility is judged against minAgents over the roster", () => {
    // minAgents 2, threshold 0.5 -> one attuned roster agent is enough to
    // form a legal party, so pickers should show the challenge.
    const attuned = makeCycleAgent({ id: "att-1", assignmentCount: 1 });
    const fresh = makeCycleAgent({ id: "raw-1" });
    const org = makeCycleOrg([attuned, fresh]);
    const access = challengeAccess(innerVault, org, GATED_ARC);
    expect(access.attunement!.requiredCount).toBe(1);
    expect(access.accessible).toBe(true);
  });
});

describe("runCycle gate enforcement and attunement stamping", () => {
  it("backfills progression unlocks into the returned transition state", () => {
    const cleared = makeCycleAgent({ id: "veteran", assignmentCount: 1 });
    const org = makeCycleOrg([cleared], { reputation: 40 });
    expect(org.unlockedProgressionTiers).toBeUndefined();

    const result = runCycle({ org, arc: GATED_ARC, assignments: [] });
    expect(result.org.unlockedProgressionTiers).toEqual(["tier-1", "tier-2"]);
  });

  it("a locked challenge is skipped with a warning and spends no tokens", () => {
    const fresh = makeCycleAgent({ id: "raw-1" });
    const org = makeCycleOrg([fresh], { tokens: 5 });
    const result = runCycle({
      org,
      arc: GATED_ARC,
      assignments: [{ challengeId: "inner-vault", agentIds: ["raw-1"], tokensSpent: 2 }],
    });
    expect(result.reports).toEqual([]);
    expect(result.warnings.some((w) => w.includes("locked"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("test-challenge-cleared"))).toBe(true);
    // Tokens: nothing spent, only regenerated (capped at maxTokens 10).
    expect(result.org.resources.tokens).toBeGreaterThanOrEqual(5);
  });

  it("stamps attunements at cycle end and emits attuned events", () => {
    const veteran = makeCycleAgent({ id: "vet-1", assignmentCount: 1 });
    const org = makeCycleOrg([veteran]);
    const result = runCycle({ org, arc: GATED_ARC, assignments: [] });
    expect(result.org.agents["vet-1"]!.attunements).toContain("keyholder");
    expect(result.events).toContainEqual({
      type: "attuned",
      agentId: "vet-1",
      data: { chainId: "keyholder" },
    });
  });

  it("resolves with a difficulty mode when named, and skips unknown modes", () => {
    const agent = makeCycleAgent({ id: "vet-1" });
    const org = makeCycleOrg([agent]);
    const heroic = runCycle({
      org,
      arc: GATED_ARC,
      assignments: [
        { challengeId: "test-challenge", agentIds: ["vet-1"], tokensSpent: 0, difficultyModeId: "heroic" },
      ],
    });
    expect(heroic.reports).toHaveLength(1);
    expect(heroic.warnings).toEqual([]);
    // The mode's added mechanic ran; history stays keyed to the base id.
    const mechanicIds = heroic.reports[0]!.assignedAgents.flatMap((a) =>
      a.mechanicResults.map((m) => m.mechanicId),
    );
    expect(mechanicIds).toContain("heroic-focus");
    expect(heroic.reports[0]!.challengeId).toBe("test-challenge");

    const unknown = runCycle({
      org,
      arc: GATED_ARC,
      assignments: [
        { challengeId: "test-challenge", agentIds: ["vet-1"], tokensSpent: 0, difficultyModeId: "mythic" },
      ],
    });
    expect(unknown.reports).toEqual([]);
    expect(unknown.warnings.some((w) => w.includes("Difficulty mode not found"))).toBe(true);
  });
});
