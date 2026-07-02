// Karazhan cartridge acceptance + a general arc lint run over every bundled
// arc. The lint catches what the zod schema cannot: cross-references between
// challenges, items, roles, chains, tiers, and milestones.

import { describe, it, expect } from "vitest";
import type { Arc } from "../../src/engine/types.js";
import { validateArc } from "../../src/engine/schema.js";
import { challengeAccess, unlockedProgressionTierIds } from "../../src/engine/access.js";
import { FIRST_CHARTER, KARAZHAN, KARAZHAN_STARTING_ROSTER } from "../../src/arcs/index.js";
import { makeCycleOrg } from "../fixtures/cycle-arc.js";

/** Milestones an arc can actually produce: outcome milestoneFlags plus the
 * "<challenge-id>-cleared" normalization the access module accepts. */
function producibleMilestones(arc: Arc): Set<string> {
  const out = new Set<string>();
  for (const c of arc.challenges) {
    out.add(c.id);
    out.add(`${c.id}-cleared`);
    for (const o of [c.outcomes.success, c.outcomes.partial, c.outcomes.failure]) {
      if (o.milestoneFlag) out.add(o.milestoneFlag);
    }
  }
  return out;
}

function lintArc(arc: Arc): string[] {
  const errors: string[] = [];
  const challengeIds = new Set(arc.challenges.map((c) => c.id));
  const itemIds = new Set(arc.items.map((i) => i.id));
  const roleIds = new Set(arc.roles.map((r) => r.id));
  const tierIds = new Set(arc.tiers.map((t) => t.id));
  const chainIds = new Set(arc.attunementChains.map((c) => c.id));
  const milestones = producibleMilestones(arc);

  for (const item of arc.items) {
    if (!tierIds.has(item.tierRequirement)) errors.push(`item ${item.id}: unknown tier ${item.tierRequirement}`);
  }
  for (const c of arc.challenges) {
    for (const rr of c.rosterRequirements.roleRequirements) {
      if (!roleIds.has(rr.roleId)) errors.push(`challenge ${c.id}: unknown role ${rr.roleId}`);
    }
    for (const m of c.accessRequirements.orgMilestones) {
      if (!milestones.has(m)) errors.push(`challenge ${c.id}: unearnable milestone ${m}`);
    }
    for (const chain of c.accessRequirements.agentAttunements) {
      if (!chainIds.has(chain)) errors.push(`challenge ${c.id}: unknown attunement ${chain}`);
    }
    for (const check of c.mechanicChecks) {
      for (const rid of check.roleIds ?? []) {
        if (!roleIds.has(rid)) errors.push(`check ${check.id}: unknown role ${rid}`);
      }
    }
    for (const outcome of [c.outcomes.success, c.outcomes.partial, c.outcomes.failure]) {
      for (const entry of outcome.rewardTable) {
        if (!itemIds.has(entry.itemId)) errors.push(`challenge ${c.id}: unknown reward item ${entry.itemId}`);
      }
    }
  }
  for (const tier of arc.progressionTiers) {
    for (const cid of [...tier.challenges, ...tier.requiredChallenges, ...tier.optionalChallenges]) {
      if (!challengeIds.has(cid)) errors.push(`progression ${tier.id}: unknown challenge ${cid}`);
    }
    for (const m of tier.unlockConditions.orgMilestones) {
      if (!milestones.has(m)) errors.push(`progression ${tier.id}: unearnable milestone ${m}`);
    }
  }
  for (const chain of arc.attunementChains) {
    for (const step of chain.steps) {
      if (step.type === "challenge_clear" && !challengeIds.has(step.target)) errors.push(`chain ${chain.id}: unknown challenge ${step.target}`);
      if (step.type === "item_acquire" && !itemIds.has(step.target)) errors.push(`chain ${chain.id}: unknown item ${step.target}`);
      if (step.type === "chain_complete" && !chainIds.has(step.target)) errors.push(`chain ${chain.id}: unknown chain ${step.target}`);
    }
    for (const cid of chain.grantsAccessTo) {
      if (!challengeIds.has(cid)) errors.push(`chain ${chain.id}: grantsAccessTo unknown challenge ${cid}`);
    }
  }
  return errors;
}

describe("bundled arc lint", () => {
  for (const arc of [FIRST_CHARTER, KARAZHAN]) {
    it(`${arc.meta.id} passes schema validation`, () => {
      expect(() => validateArc(JSON.parse(JSON.stringify(arc)))).not.toThrow();
    });
    it(`${arc.meta.id} has no dangling cross-references`, () => {
      expect(lintArc(arc)).toEqual([]);
    });
  }
});

describe("karazhan is a different game, not a reskin", () => {
  it("shares no role vocabulary with first-charter", () => {
    const fc = new Set(FIRST_CHARTER.roles.map((r) => r.id));
    for (const role of KARAZHAN.roles) expect(fc.has(role.id)).toBe(false);
  });

  it("has its own resource grammar and a wider progression", () => {
    expect(KARAZHAN.attributes).toHaveLength(5);
    expect(FIRST_CHARTER.attributes).toHaveLength(4);
    expect(KARAZHAN.tiers.map((t) => t.id)).toEqual(["recruit", "member", "veteran", "elite", "champion"]);
    expect(KARAZHAN.reputationName).not.toBe(FIRST_CHARTER.reputationName);
    expect(KARAZHAN.tokenName).not.toBe(FIRST_CHARTER.tokenName);
    expect(KARAZHAN.challenges.length).toBeGreaterThanOrEqual(14);
    expect(KARAZHAN.difficultyModes.map((m) => m.id)).toContain("heroic");
  });
});

describe("karazhan boot state", () => {
  it("ships a full ten-raider roster covering all five roles", () => {
    expect(KARAZHAN_STARTING_ROSTER).toHaveLength(10);
    const byRole = new Map<string, number>();
    for (const a of KARAZHAN_STARTING_ROSTER) byRole.set(a.role ?? "?", (byRole.get(a.role ?? "?") ?? 0) + 1);
    for (const role of KARAZHAN.roles) expect(byRole.get(role.id) ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("is deterministic across builds", () => {
    const again = KARAZHAN_STARTING_ROSTER.map((a) => a.id);
    expect(new Set(again).size).toBe(10);
  });

  it("wing-1 is open on a fresh org; the tower's gates are shut", () => {
    const org = makeCycleOrg(KARAZHAN_STARTING_ROSTER.map((a) => ({ ...a })), { reputation: 0 });
    const unlocked = unlockedProgressionTierIds(org, KARAZHAN);
    expect(unlocked).toEqual(new Set(["wing-1"]));

    const attumen = KARAZHAN.challenges.find((c) => c.id === "attumen")!;
    expect(challengeAccess(attumen, org, KARAZHAN).accessible).toBe(true);

    // Curator: milestone-gated AND attunement-gated (the Master's Key chain).
    const curator = KARAZHAN.challenges.find((c) => c.id === "curator")!;
    const access = challengeAccess(curator, org, KARAZHAN);
    expect(access.accessible).toBe(false);
    expect(access.attunement!.requiredChains).toEqual(["the-masters-key"]);

    // Nightbane needs the urn-bearer chain on top of the prince milestone.
    const nightbane = KARAZHAN.challenges.find((c) => c.id === "nightbane")!;
    const nb = challengeAccess(nightbane, org, KARAZHAN);
    expect(nb.accessible).toBe(false);
    expect(nb.attunement!.requiredChains).toEqual(["the-blackened-urn"]);
  });

  it("wing-1 clears open the Master's Key path end to end", () => {
    const roster = KARAZHAN_STARTING_ROSTER.map((a) => ({
      ...a,
      assignmentHistory: [
        { challengeId: "attumen", cycle: 1, outcome: "success" as const },
        { challengeId: "moroes", cycle: 2, outcome: "success" as const },
        { challengeId: "maiden", cycle: 3, outcome: "success" as const },
      ],
    }));
    const org = makeCycleOrg(roster, { reputation: 10 });
    const curator = KARAZHAN.challenges.find((c) => c.id === "curator")!;
    // opera not yet cleared -> curator still milestone-locked, but the raid IS attuned
    const access = challengeAccess(curator, org, KARAZHAN);
    expect(access.attunement!.satisfied).toBe(true);
    expect(access.missingMilestones).toEqual(["opera-cleared"]);
  });
});
