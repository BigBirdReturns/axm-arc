// Property tests for the resource-spend lever — the four guarantees the engine
// invariant (axm-world docs/design/RESOURCE_SPEND_DECISION.md) requires before any
// UI ships. Each maps 1:1 to an invariant clause and is asserted against the real
// resolver over a sweep of seeds:
//
//   (a) gate independence + cannot-create-success — a below-gate or hopeless party
//       resolves identically with and without spend.
//   (b) reduce variance — a plausible party's check spread strictly narrows.
//   (c1) preserve the mean — spend does not move the expected score.
//   (c2) cannot guarantee — a marginal party can still fail at max spend.
//   (d) determinism — same inputs (incl. tokensSpent) → identical report.
//
// The lever scales only the symmetric, mean-zero variance terms, so these hold as
// theorems (see the proposal) — the tests pin them empirically.

import { describe, it, expect } from "vitest";
import { resolveChallenge } from "../../src/engine/resolver";
import { MINI_ARC, makeAgent } from "../fixtures/mini-arc";
import type { Agent, Challenge, Organization, ResourceSpendLever } from "../../src/engine/types";

// Each token shaves 20% off the ±band, floored at k = 0.4 (so 3 tokens → k = 0.4).
const LEVER: ResourceSpendLever = { maxTokens: 3, steadinessPerToken: 0.2, minSteadiness: 0.4 };

/** A fully-controlled agent: score reduces to power + (symmetric variance). Morale
 *  50 (no morale mod), volatility 0 (no swing), no gear/traits/affliction; solo →
 *  no relationship mod. So on a power-weighted per_agent check, score = power + V. */
function agent(power: number, role = "striker", seed = 1): Agent {
  const a = makeAgent(seed);
  return {
    ...a,
    role,
    attributes: { power, focus: 0, reflex: 0 },
    morale: 50,
    afflictionState: { kind: "none" },
    traits: [],
    equippedItems: {},
    hiddenAttributes: { ...a.hiddenAttributes, volatility: 0 },
  };
}

function challenge(opts?: {
  threshold?: number;
  lever?: ResourceSpendLever;
  roles?: Array<{ roleId: string; count: number }>;
}): Challenge {
  return {
    id: "rs-test",
    name: "RS Test",
    description: "resource-spend test",
    rosterRequirements: { minAgents: 1, maxAgents: 3, roleRequirements: opts?.roles ?? [] },
    accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
    difficultyRating: 20,
    mechanicChecks: [
      {
        id: "pc",
        name: "Power",
        description: "brute force",
        attributeWeights: [{ attributeId: "power", weight: 1.0 }],
        difficultyThreshold: opts?.threshold ?? 8,
        scope: "per_agent",
        failureConsequence: { type: "stress", severity: 0.3 },
      },
    ],
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: null,
    outcomes: {
      success: { rewardTable: [], narrative: "s" },
      partial: { rewardTable: [], narrative: "p" },
      failure: { rewardTable: [], narrative: "f" },
    },
    resourceSpend: opts?.lever,
  };
}

function org(agents: Agent[], rngSeed: number): Organization {
  const m: Record<string, Agent> = {};
  for (const a of agents) m[a.id] = a;
  return {
    id: "o", name: "O", reputation: 50,
    resources: { currency: 100, materials: 0, tokens: 10 },
    infrastructure: {} as Organization["infrastructure"],
    agents: m, relationships: [], precedents: [], dramaQueue: [],
    cycle: 1, distributionPolicy: "council", rngSeed,
  };
}

// resolveChallenge derives its RNG from hashSeed(org.rngSeed, cycle, challenge.id),
// so varying rngSeed samples different rolls.
function run(ch: Challenge, agents: Agent[], tokensSpent: number, rngSeed: number) {
  const rep = resolveChallenge({ challenge: ch, assignedAgents: agents, org: org(agents, rngSeed), arc: MINI_ARC, cycle: 1, tokensSpent });
  const mr = rep.assignedAgents[0]!.mechanicResults.find((m) => m.mechanicId === "pc")!;
  return { report: rep, score: mr.score, passed: mr.passed, outcome: rep.outcome };
}

function populationVariance(xs: number[]): number {
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  return xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
}

describe("resource-spend lever — engine invariant", () => {
  it("(a) gate independence: a below-gate party resolves byte-identically with or without spend", () => {
    // Challenge requires a Guardian; the party has only a Striker → gates fail.
    const ch = challenge({ threshold: 8, lever: LEVER, roles: [{ roleId: "guardian", count: 1 }] });
    const party = [agent(20, "striker")];
    for (let seed = 0; seed < 40; seed++) {
      const r0 = run(ch, party, 0, seed).report;
      const r3 = run(ch, party, 3, seed).report;
      expect(r3).toEqual(r0); // gates fail → k forced to 1 → identical
    }
  });

  it("(a) cannot create success: a hopeless party's pass/fail is identical with and without spend", () => {
    const ch = challenge({ threshold: 8, lever: LEVER });
    const party = [agent(1, "striker")]; // max score 1 + 4 = 5 < 8, always fails
    for (let seed = 0; seed < 60; seed++) {
      const a = run(ch, party, 0, seed);
      const b = run(ch, party, 3, seed);
      expect(a.passed).toBe(false);
      expect(b.passed).toBe(a.passed);
      expect(b.outcome).toBe(a.outcome);
    }
  });

  it("(b) reduce variance: a plausible party's check spread strictly narrows with spend", () => {
    const ch = challenge({ threshold: 8, lever: LEVER });
    const party = [agent(30, "striker")]; // clears gates, mean 30 >> 8
    const N = 600;
    const s0: number[] = [];
    const s3: number[] = [];
    for (let seed = 0; seed < N; seed++) {
      s0.push(run(ch, party, 0, seed).score);
      s3.push(run(ch, party, 3, seed).score);
    }
    expect(populationVariance(s3)).toBeLessThan(populationVariance(s0));
    // k = 0.4 → variance scales by 0.16; assert it really collapsed, not just <.
    expect(populationVariance(s3)).toBeLessThan(populationVariance(s0) * 0.3);
  });

  it("(c1) preserve the mean: spend does not move the expected score", () => {
    const ch = challenge({ threshold: 8, lever: LEVER });
    const party = [agent(30, "striker")];
    const N = 600;
    let m0 = 0;
    let m3 = 0;
    for (let seed = 0; seed < N; seed++) {
      m0 += run(ch, party, 0, seed).score;
      m3 += run(ch, party, 3, seed).score;
    }
    m0 /= N;
    m3 /= N;
    // Both means ≈ 30 (rawScore); the scaled term is mean-zero, so they track.
    expect(Math.abs(m0 - m3)).toBeLessThan(0.4);
  });

  it("(c2) cannot guarantee success: a marginal party can still fail at max spend", () => {
    const ch = challenge({ threshold: 8, lever: LEVER });
    const party = [agent(8, "striker")]; // mean exactly at the threshold
    const N = 200;
    let failures = 0;
    for (let seed = 0; seed < N; seed++) if (!run(ch, party, 3, seed).passed) failures++;
    expect(failures).toBeGreaterThan(0); // bounded floor keeps a real loss chance
    expect(failures).toBeLessThan(N); // and it is not simply always-failing
  });

  it("(d) determinism: same inputs incl. tokensSpent → identical report", () => {
    const ch = challenge({ threshold: 8, lever: LEVER });
    const party = [agent(12, "striker")];
    const a = run(ch, party, 2, 777).report;
    const b = run(ch, party, 2, 777).report;
    expect(a).toEqual(b);
  });

  it("no authored lever: spend is inert even for a gate-clearing party", () => {
    const ch = challenge({ threshold: 8 }); // no resourceSpend authored
    const party = [agent(30, "striker")];
    for (let seed = 0; seed < 40; seed++) {
      expect(run(ch, party, 3, seed).report).toEqual(run(ch, party, 0, seed).report);
    }
  });
});
