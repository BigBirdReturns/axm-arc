import { describe, expect, it } from "vitest";
import { runCycle } from "../../src/engine/cycle.js";
import { validateArc } from "../../src/engine/schema.js";
import type { Arc, Challenge } from "../../src/engine/types.js";
import { MINI_ARC } from "../fixtures/mini-arc.js";
import { makeCycleAgent, makeCycleOrg } from "../fixtures/cycle-arc.js";

function challenge(base: Challenge, id: string, value: number): Challenge {
  return {
    ...structuredClone(base),
    id,
    name: id,
    accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
    mechanicChecks: [{
      id: `${id}-certain`,
      name: "Certain",
      description: "A deterministic low threshold.",
      attributeWeights: [{ attributeId: "power", weight: 1 }],
      difficultyThreshold: 0,
      scope: "per_agent",
      failureConsequence: { type: "stress", severity: 0 },
    }],
    timePressure: null,
    outcomes: {
      success: {
        rewardTable: [],
        narrative: `${id} writes the track.`,
        stateEffects: [{
          stateId: "shared-track",
          operation: "set",
          value,
          reason: `${id} has canonical precedence.`,
        }],
      },
      partial: { rewardTable: [], narrative: "Partial." },
      failure: { rewardTable: [], narrative: "Failure." },
    },
  };
}

function orderingArc(): Arc {
  const raw = structuredClone(MINI_ARC);
  raw.meta.engineVersion = "1.3.0";
  raw.stateDefinitions = [{
    id: "shared-track",
    label: "Shared track",
    description: "Two simultaneous reports write this state.",
    visibility: "public",
    kind: "number",
    initial: 0,
    min: 0,
    max: 2,
  }];
  const base = raw.challenges[0]!;
  raw.challenges = [challenge(base, "alpha", 1), challenge(base, "omega", 2)];
  raw.progressionTiers[0]!.challenges = ["alpha", "omega"];
  raw.progressionTiers[0]!.requiredChallenges = ["alpha", "omega"];
  raw.progressionTiers[0]!.optionalChallenges = [];
  return validateArc(raw);
}

describe("engine 1.3 state ordering", () => {
  it("applies simultaneous report effects in canonical challenge-and-party order", () => {
    const arc = orderingArc();
    const alphaAgent = makeCycleAgent({ id: "alpha-agent" });
    const omegaAgent = makeCycleAgent({ id: "omega-agent" });
    const org = makeCycleOrg([alphaAgent, omegaAgent], { tokens: 5 });

    const reversed = runCycle({
      org,
      arc,
      assignments: [
        { challengeId: "omega", agentIds: [omegaAgent.id], tokensSpent: 0 },
        { challengeId: "alpha", agentIds: [alphaAgent.id], tokensSpent: 0 },
      ],
    });
    const forward = runCycle({
      org,
      arc,
      assignments: [
        { challengeId: "alpha", agentIds: [alphaAgent.id], tokensSpent: 0 },
        { challengeId: "omega", agentIds: [omegaAgent.id], tokensSpent: 0 },
      ],
    });

    expect(reversed.org.cartridgeState).toEqual({ "shared-track": 2 });
    expect(forward.org.cartridgeState).toEqual(reversed.org.cartridgeState);
    expect(reversed.events
      .filter((event) => event.type === "cartridge_state_change")
      .map((event) => (event.data as { source: { challengeId: string } }).source.challengeId)
    ).toEqual(["alpha", "omega"]);
  });
});
