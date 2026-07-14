import { describe, it, expect } from "vitest";
import { Rng } from "../../src/engine/prng.js";
import {
  canApplyDramaEffect,
  generateDramaCards,
  enqueueDramaCards,
  resolveDramaCard,
} from "../../src/engine/drama.js";
import type { DramaTriggerInput } from "../../src/engine/drama.js";
import { makeTestAgent, makeTestOrg } from "../fixtures/state-arc.js";

// ── generateDramaCards ────────────────────────────────────────────────────────

describe("generateDramaCards", () => {
  it("generates a card for each trigger", () => {
    const a = makeTestAgent({ id: "a1" });
    const b = makeTestAgent({ id: "a2" });
    const org = makeTestOrg([a, b]);
    const rng = new Rng(42);
    const triggers: DramaTriggerInput[] = [
      { type: "relationship_transition", agentA: "a1", agentB: "a2", from: "Neutral", to: "Hostile" },
      { type: "morale_extreme", agentId: "a1", morale: 20 },
    ];
    const cards = generateDramaCards(triggers, org, rng, 1);
    expect(cards).toHaveLength(2);
  });

  it("card triggerType matches input trigger type", () => {
    const a = makeTestAgent({ id: "a1" });
    const org = makeTestOrg([a]);
    const rng = new Rng(42);
    const triggers: DramaTriggerInput[] = [
      { type: "affliction_threshold", agentId: "a1", affliction: "Defiant" },
    ];
    const cards = generateDramaCards(triggers, org, rng, 1);
    expect(cards[0]!.triggerType).toBe("affliction_threshold");
  });

  it("reward_dispute card has 3 options (award a, award b, disenchant)", () => {
    const a = makeTestAgent({ id: "a1" });
    const b = makeTestAgent({ id: "a2" });
    const org = makeTestOrg([a, b]);
    const rng = new Rng(42);
    const triggers: DramaTriggerInput[] = [
      { type: "reward_dispute", itemId: "sword-1", eligible: ["a1", "a2"], winner: "a1" },
    ];
    const cards = generateDramaCards(triggers, org, rng, 1);
    expect(cards[0]!.options).toHaveLength(3);
    const ids = cards[0]!.options.map((o) => o.id);
    expect(ids).toContain("award_a");
    expect(ids).toContain("award_b");
    expect(ids).toContain("disenchant");
  });

  it("prolonged_benching card has rotation/stay/promote options", () => {
    const a = makeTestAgent({ id: "a1" });
    const org = makeTestOrg([a]);
    const rng = new Rng(42);
    const triggers: DramaTriggerInput[] = [
      { type: "prolonged_benching", agentId: "a1", cyclesBenched: 3 },
    ];
    const cards = generateDramaCards(triggers, org, rng, 1);
    const ids = cards[0]!.options.map((o) => o.id);
    expect(ids).toContain("promise_rotation");
    expect(ids).toContain("stay_course");
    expect(ids).toContain("promote_officer");
  });

  it("narrative text is filled with agent names", () => {
    const a = makeTestAgent({ id: "a1" });
    const org = makeTestOrg([a]);
    const rng = new Rng(42);
    const triggers: DramaTriggerInput[] = [
      { type: "morale_extreme", agentId: "a1", morale: 90 },
    ];
    const cards = generateDramaCards(triggers, org, rng, 1);
    expect(cards[0]!.narrativeText).toContain("a1");
  });

  it("each card has a unique id", () => {
    const a = makeTestAgent({ id: "a1" });
    const b = makeTestAgent({ id: "a2" });
    const org = makeTestOrg([a, b]);
    const rng = new Rng(42);
    const triggers: DramaTriggerInput[] = [
      { type: "morale_extreme", agentId: "a1", morale: 20 },
      { type: "morale_extreme", agentId: "a2", morale: 90 },
    ];
    const cards = generateDramaCards(triggers, org, rng, 1);
    const ids = new Set(cards.map((c) => c.id));
    expect(ids.size).toBe(2);
  });
});

// ── enqueueDramaCards ─────────────────────────────────────────────────────────

describe("enqueueDramaCards", () => {
  it("adds cards to the queue", () => {
    const a = makeTestAgent({ id: "a1" });
    const org = makeTestOrg([a]);
    const rng = new Rng(42);
    const triggers: DramaTriggerInput[] = [
      { type: "morale_extreme", agentId: "a1", morale: 20 },
    ];
    const cards = generateDramaCards(triggers, org, rng, 1);
    const result = enqueueDramaCards(org, cards, 1);
    expect(result.dramaQueue).toHaveLength(1);
  });

  it("queue cap of 5 is enforced per cycle", () => {
    const a = makeTestAgent({ id: "a1", tier: "tier1" });
    const b = makeTestAgent({ id: "a2", tier: "tier2" });
    const org = makeTestOrg([a, b]);
    const rng = new Rng(42);
    // Generate 8 triggers
    const triggers: DramaTriggerInput[] = Array.from({ length: 8 }, (_, i) => ({
      type: "morale_extreme" as const,
      agentId: i % 2 === 0 ? "a1" : "a2",
      morale: 20,
    }));
    const cards = generateDramaCards(triggers, org, rng, 1);
    const result = enqueueDramaCards(org, cards, 1);
    // Max 5 cards per cycle
    expect(result.dramaQueue.length).toBeLessThanOrEqual(5);
  });

  it("prioritizes relationship_transition over morale_extreme over benching", () => {
    const a = makeTestAgent({ id: "a1" });
    const b = makeTestAgent({ id: "a2" });
    const org = makeTestOrg([a, b]);
    const rng = new Rng(42);

    // Generate more than 5 triggers with different priorities
    const triggers: DramaTriggerInput[] = [
      { type: "prolonged_benching", agentId: "a1", cyclesBenched: 3 },
      { type: "prolonged_benching", agentId: "a2", cyclesBenched: 3 },
      { type: "morale_extreme", agentId: "a1", morale: 20 },
      { type: "morale_extreme", agentId: "a2", morale: 90 },
      { type: "relationship_transition", agentA: "a1", agentB: "a2", from: "Neutral", to: "Hostile" },
      { type: "prolonged_benching", agentId: "a1", cyclesBenched: 4 },
      { type: "morale_extreme", agentId: "a1", morale: 15 },
    ];

    // Generate all cards
    const cards = generateDramaCards(triggers, org, rng, 1);

    // Enqueue them — cap forces prioritization
    const result = enqueueDramaCards(org, cards, 1);
    const queuedTypes = result.dramaQueue.map((c) => c.triggerType);

    // relationship_transition must be in queue (highest severity)
    expect(queuedTypes).toContain("relationship_transition");
    // Benching cards should be trimmed before morale_extreme if queue hits cap
    const benchingCount = queuedTypes.filter((t) => t === "prolonged_benching").length;
    const moraleCount = queuedTypes.filter((t) => t === "morale_extreme").length;
    // morale_extreme (sev 4) > benching (sev 1)
    expect(moraleCount).toBeGreaterThanOrEqual(benchingCount);
  });

  it("does not mutate original org", () => {
    const a = makeTestAgent({ id: "a1" });
    const org = makeTestOrg([a]);
    const rng = new Rng(42);
    const triggers: DramaTriggerInput[] = [
      { type: "morale_extreme", agentId: "a1", morale: 20 },
    ];
    const cards = generateDramaCards(triggers, org, rng, 1);
    enqueueDramaCards(org, cards, 1);
    expect(org.dramaQueue).toHaveLength(0);
  });
});

// ── resolveDramaCard ──────────────────────────────────────────────────────────

describe("resolveDramaCard", () => {
  it("removes card from queue after resolution", () => {
    const a = makeTestAgent({ id: "a1" });
    const org = makeTestOrg([a]);
    const rng = new Rng(42);
    const triggers: DramaTriggerInput[] = [
      { type: "morale_extreme", agentId: "a1", morale: 20 },
    ];
    const cards = generateDramaCards(triggers, org, rng, 1);
    const withCards = enqueueDramaCards(org, cards, 1);
    const cardId = withCards.dramaQueue[0]!.id;
    const optionId = withCards.dramaQueue[0]!.options[0]!.id;
    const { org: result } = resolveDramaCard(withCards, cardId, optionId, 1);
    expect(result.dramaQueue).toHaveLength(0);
  });

  it("applies morale effect from chosen option", () => {
    const a = makeTestAgent({ id: "a1", morale: 50 });
    const org = makeTestOrg([a]);
    const rng = new Rng(42);
    // affliction_threshold → rest_treatment → morale +5 for agent
    const triggers: DramaTriggerInput[] = [
      { type: "affliction_threshold", agentId: "a1", affliction: "Fearful" },
    ];
    const cards = generateDramaCards(triggers, org, rng, 1);
    const withCards = enqueueDramaCards(org, cards, 1);
    const card = withCards.dramaQueue[0]!;
    // Pick rest_treatment option (morale +5)
    const option = card.options.find((o) => o.id === "rest_treatment")!;
    const { org: result } = resolveDramaCard(withCards, card.id, option.id, 1);
    expect(result.agents["a1"]!.morale).toBeGreaterThan(50);
  });

  it("applies supported hidden effects without mixing them into the visible receipt", () => {
    const a = makeTestAgent({ id: "a1", loyalty: 10 });
    const org = makeTestOrg([a]);
    const rng = new Rng(42);
    const triggers: DramaTriggerInput[] = [
      { type: "prolonged_benching", agentId: "a1", cyclesBenched: 3 },
    ];
    const cards = generateDramaCards(triggers, org, rng, 1);
    const withCards = enqueueDramaCards(org, cards, 1);
    const card = withCards.dramaQueue[0]!;
    // stay_course has hidden effect
    const option = card.options.find((o) => o.id === "stay_course")!;
    const { org: result, appliedVisibleEffects, appliedHiddenEffects } = resolveDramaCard(
      withCards,
      card.id,
      option.id,
      1,
    );
    expect(result.agents["a1"]!.hiddenAttributes.loyalty).toBe(7);
    expect(appliedVisibleEffects).toEqual([
      { target: "a1", type: "stress", value: 1 },
    ]);
    expect(appliedHiddenEffects).toEqual([
      { target: "a1", type: "loyalty", value: -3 },
    ]);
  });

  it("reports the bounded delta that actually landed", () => {
    const a = makeTestAgent({ id: "a1", morale: 98 });
    const org = makeTestOrg([a]);
    const rng = new Rng(42);
    const [card] = generateDramaCards(
      [{ type: "morale_extreme", agentId: "a1", morale: 98 }],
      org,
      rng,
      1,
    );
    const option = card!.options.find((candidate) => candidate.id === "acknowledge")!;
    const withCards = enqueueDramaCards(org, [card!], 1);

    const { org: result, appliedVisibleEffects } = resolveDramaCard(
      withCards,
      card!.id,
      option.id,
      1,
    );

    expect(result.agents["a1"]!.morale).toBe(100);
    expect(appliedVisibleEffects).toEqual([
      { target: "a1", type: "morale", value: 2 },
    ]);
  });

  it("does not advertise effects the drama resolver cannot apply", () => {
    const org = makeTestOrg([makeTestAgent({ id: "a1" })]);
    expect(canApplyDramaEffect(org, { target: "a1", type: "morale", value: 1 })).toBe(true);
    expect(canApplyDramaEffect(org, { target: "a1", type: "attributes", value: 1 })).toBe(false);
    expect(canApplyDramaEffect(org, { target: "_org_", type: "reputation", value: 1 })).toBe(false);
  });

  it("resolving nonexistent card returns unchanged org", () => {
    const a = makeTestAgent({ id: "a1" });
    const org = makeTestOrg([a]);
    const { org: result } = resolveDramaCard(org, "nonexistent-card", "option-1", 1);
    expect(result).toBe(org);
  });

  it("applies stress effect from chosen option", () => {
    const a = makeTestAgent({ id: "a1", stress: 3 });
    const org = makeTestOrg([a]);
    const rng = new Rng(42);
    const triggers: DramaTriggerInput[] = [
      { type: "prolonged_benching", agentId: "a1", cyclesBenched: 3 },
    ];
    const cards = generateDramaCards(triggers, org, rng, 1);
    const withCards = enqueueDramaCards(org, cards, 1);
    const card = withCards.dramaQueue[0]!;
    // stay_course adds +1 stress
    const option = card.options.find((o) => o.id === "stay_course")!;
    const { org: result } = resolveDramaCard(withCards, card.id, option.id, 1);
    expect(result.agents["a1"]!.stress).toBe(4);
  });
});
