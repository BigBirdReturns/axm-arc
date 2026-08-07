import { describe, expect, it } from "vitest";
import { runCycle } from "../../src/engine/cycle.js";
import { compileActionEncounter } from "../../src/engine/action/compile.js";
import { actionSeed, buildActionReceipt } from "../../src/engine/action/receipt.js";
import { CYCLE_ARC, makeCycleAgent, makeCycleOrg } from "../fixtures/cycle-arc.js";
import { buildCompetentTrace } from "./helpers.js";

function actionFixture() {
  const challenge = CYCLE_ARC.challenges[0]!;
  const agent = makeCycleAgent({ id: "operator" });
  const org = makeCycleOrg([agent], { tokens: 5 });
  const spec = compileActionEncounter(CYCLE_ARC, challenge);
  const seed = actionSeed(org.rngSeed, org.cycle, challenge.id, null);
  const { trace, state } = buildCompetentTrace(spec, seed);
  const receipt = buildActionReceipt({
    arc: CYCLE_ARC,
    challenge,
    cycle: org.cycle,
    orgSeed: org.rngSeed,
    controlledAgentId: agent.id,
    partyAgentIds: [agent.id],
    trace,
  });
  return { challenge, agent, org, receipt, state };
}

describe("action receipt cycle adjudication", () => {
  it("uses the verified human-skill result as the authoritative ordinary run report", () => {
    const { challenge, agent, org, receipt, state } = actionFixture();
    const result = runCycle({
      org,
      arc: CYCLE_ARC,
      assignments: [{ challengeId: challenge.id, agentIds: [agent.id], tokensSpent: 0, actionReceipt: receipt }],
    });
    expect(state.result?.outcome).toBe("success");
    expect(result.warnings).toEqual([]);
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]?.outcome).toBe(receipt.result.outcome);
    expect(result.reports[0]?.action?.receiptDigest).toBe(receipt.receiptDigest);
    expect(result.reports[0]?.lootDrops[0]?.itemId).toBe("test-item");
    expect(result.org.agents[agent.id]?.assignmentHistory.at(-1)).toMatchObject({
      challengeId: challenge.id,
      outcome: receipt.result.outcome,
    });
  });

  it("refuses invalid evidence and meaningless action resource spend before mutation", () => {
    const { challenge, agent, org, receipt } = actionFixture();
    const control = runCycle({ org, arc: CYCLE_ARC, assignments: [] });
    const invalid = runCycle({
      org,
      arc: CYCLE_ARC,
      assignments: [{
        challengeId: challenge.id,
        agentIds: [agent.id],
        tokensSpent: 0,
        actionReceipt: { ...receipt, receiptDigest: receipt.receiptDigest.replace(/.$/, "x") },
      }],
    });
    expect(invalid.reports).toHaveLength(0);
    expect(invalid.warnings.some((warning) => warning.includes("Action receipt refused"))).toBe(true);
    expect(invalid.org.resources.tokens).toBe(control.org.resources.tokens);
    expect(invalid.org.agents[agent.id]?.assignmentHistory).toEqual(control.org.agents[agent.id]?.assignmentHistory);

    const spent = runCycle({
      org,
      arc: CYCLE_ARC,
      assignments: [{ challengeId: challenge.id, agentIds: [agent.id], tokensSpent: 1, actionReceipt: receipt }],
    });
    expect(spent.reports).toHaveLength(0);
    expect(spent.warnings.some((warning) => warning.includes("refuses resource spend"))).toBe(true);
    expect(spent.org.resources.tokens).toBe(control.org.resources.tokens);
  });
});
