import { describe, expect, it } from "vitest";
import { resolveDramaCard } from "../../src/engine/drama.js";
import { buildOpeningCard, enqueueAuthoredOpening } from "../../src/engine/opening.js";
import type { AuthoredOpening } from "../../src/engine/types.js";
import { makeCycleAgent, makeCycleOrg } from "../fixtures/cycle-arc.js";

const OPENING: AuthoredOpening = {
  triggerType: "founding-oath",
  narrativeText: "Choose the charter's posture.",
  options: [
    {
      id: "stand-open",
      label: "Stand open",
      description: "The roster rises.",
      effects: [
        { scope: "all", type: "morale", value: 3 },
        { scope: "all", type: "loyalty", value: 2 },
      ],
    },
    {
      id: "stand-back",
      label: "Stand back",
      description: "The roster waits.",
      effects: [{ scope: "all", type: "stress", value: 1 }],
    },
  ],
};

describe("Arc-authored opening law", () => {
  it("projects identical bytes regardless of agent record insertion order", () => {
    const alpha = makeCycleAgent({ id: "alpha" });
    const omega = makeCycleAgent({ id: "omega" });
    const forward = makeCycleOrg([alpha, omega]);
    const reverse = makeCycleOrg([structuredClone(omega), structuredClone(alpha)]);

    expect(JSON.stringify(buildOpeningCard(OPENING, reverse))).toBe(
      JSON.stringify(buildOpeningCard(OPENING, forward)),
    );
    expect(buildOpeningCard(OPENING, reverse).agentsInvolved).toEqual(["alpha", "omega"]);
    const option = buildOpeningCard(OPENING, forward).options[0]!;
    expect(option.effects.map((effect) => effect.type)).toEqual(["morale", "morale"]);
    expect(option.hiddenEffects.map((effect) => effect.type)).toEqual(["loyalty", "loyalty"]);
  });

  it("enqueues once and resolves through the canonical drama transition", () => {
    const before = makeCycleOrg([
      makeCycleAgent({ id: "alpha", morale: 50 }),
      makeCycleAgent({ id: "omega", morale: 60 }),
    ]);
    const queued = enqueueAuthoredOpening(before, { opening: OPENING });
    expect(queued.dramaQueue.map((card) => card.id)).toEqual(["opening:founding-oath"]);
    expect(enqueueAuthoredOpening(queued, { opening: OPENING })).toBe(queued);

    const { org: after } = resolveDramaCard(queued, "opening:founding-oath", "stand-open", 0);
    expect(after.dramaQueue).toEqual([]);
    expect(after.agents.alpha!.morale).toBe(53);
    expect(after.agents.omega!.morale).toBe(63);
    expect(after.agents.alpha!.hiddenAttributes.loyalty).toBe(
      before.agents.alpha!.hiddenAttributes.loyalty + 2,
    );
  });

  it("does not synthesize opening behavior for an Arc that omits it", () => {
    const org = makeCycleOrg([makeCycleAgent({ id: "alpha" })]);
    expect(enqueueAuthoredOpening(org, {})).toBe(org);
  });
});
