// Cartridge Workshop — pure helpers backing the workshop screen. No React,
// no DOM beyond localStorage (guarded try/catch, same pattern as
// src/game/lib/storage.ts and arc-library.ts). The screen is the only
// consumer; validation itself is never duplicated here — it goes through
// arc-library.ts's validateArcJson (the same seam importArcFromJson uses).

import type { Arc } from "../../engine/types.js";
import { aggregateRuns, simulateArcRun, type ArcAggregate } from "../../sim/cartridge-conformance.js";

const DRAFT_KEY = "axm-arc:workshop-draft:v1";

// A minimal arc that passes validateArc as-is: one role, three attributes
// (the schema floor — see engine/schema.ts's ArcAttributeSchema.min(3)), one
// tier, one progression tier chaining two challenges, each challenge with a
// single mechanicCheck. Every string value is written to explain the field
// it fills, since JSON has no comments — replace them with real content.
const SKELETON_ARC = {
  meta: {
    id: "my-first-cartridge",
    name: "My First Cartridge",
    description: "Replace this with a one- or two-sentence pitch for what this cartridge is about.",
    author: "Your name here",
    version: "0.1.0",
    engineVersion: "1.0",
    domain: "e.g. heist-crew, war-campaign, monster-hunt",
    estimatedCycles: 10,
  },
  attributes: [
    { id: "grit", name: "Grit", description: "Physical toughness and force." },
    { id: "wit", name: "Wit", description: "Cunning, planning, and improvisation." },
    { id: "nerve", name: "Nerve", description: "Composure under pressure." },
  ],
  roles: [
    { id: "operative", name: "Operative", attributeWeights: { grit: 0.4, wit: 0.4, nerve: 0.2 } },
  ],
  tiers: [
    { id: "rookie", name: "Rookie", statBudgetMin: 15, statBudgetMax: 24, upkeepCost: 1, baseEfficiencyModifier: 1.0 },
  ],
  currencyName: "Credits",
  materialName: "Supplies",
  tokenName: "Orders",
  reputationName: "Standing",
  tokensPerCycle: 2,
  maxTokens: 6,
  infrastructureTokenBonus: 0.1,
  namePool: {
    firstNames: ["Ada", "Bo", "Cass"],
    lastNames: ["Reyes", "Okafor"],
  },
  customTraits: [],
  progressionTiers: [
    {
      id: "chapter-1",
      name: "Chapter I: Getting Started",
      flavorText: "Two opening jobs to learn the loop before you write your own.",
      unlockConditions: { orgMilestones: [], reputationMinimum: null },
      challenges: ["first-job", "second-job"],
      requiredChallenges: ["first-job", "second-job"],
      optionalChallenges: [],
    },
  ],
  attunementChains: [],
  challenges: [
    {
      id: "first-job",
      name: "The First Job",
      description: "A simple opening test — replace this with your own first challenge.",
      rosterRequirements: { minAgents: 1, maxAgents: 3, roleRequirements: [] },
      accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
      difficultyRating: 10,
      mechanicChecks: [
        {
          id: "first-job-check",
          name: "Pull It Off",
          description: "The team's combined grit and wit, weighed against the job's difficulty.",
          attributeWeights: [
            { attributeId: "grit", weight: 0.5 },
            { attributeId: "wit", weight: 0.5 },
          ],
          difficultyThreshold: 6,
          scope: "team_aggregate",
          failureConsequence: { type: "stress", severity: 0.2 },
        },
      ],
      completionCriteria: { type: "all_mechanics_passed", parameters: {} },
      timePressure: null,
      outcomes: {
        success: {
          rewardTable: [],
          narrative: "It goes clean. Replace this with your own success text.",
          reputationGain: 1,
          currencyReward: 20,
          milestoneFlag: "first-job-cleared",
        },
        partial: {
          rewardTable: [],
          narrative: "It goes sideways, but you get out.",
          agentDowntimeCycles: 1,
        },
        failure: {
          rewardTable: [],
          narrative: "It falls apart.",
          stressPenalty: 1,
          tokenRefund: 0.5,
        },
      },
    },
    {
      id: "second-job",
      name: "The Second Job",
      description: "A slightly harder follow-up — replace this with your own second challenge.",
      rosterRequirements: { minAgents: 1, maxAgents: 3, roleRequirements: [] },
      accessRequirements: { orgMilestones: ["first-job-cleared"], agentAttunements: [], attunementThreshold: null },
      difficultyRating: 16,
      mechanicChecks: [
        {
          id: "second-job-check",
          name: "Hold Your Nerve",
          description: "Each assigned agent's composure is tested individually.",
          attributeWeights: [
            { attributeId: "nerve", weight: 0.7 },
            { attributeId: "wit", weight: 0.3 },
          ],
          difficultyThreshold: 8,
          scope: "per_agent",
          failureConsequence: { type: "agent_damage", severity: 0.2 },
        },
      ],
      completionCriteria: { type: "all_mechanics_passed", parameters: {} },
      timePressure: null,
      outcomes: {
        success: {
          rewardTable: [],
          narrative: "Nerves hold. Replace this with your own success text.",
          reputationGain: 2,
          currencyReward: 35,
          milestoneFlag: "second-job-cleared",
        },
        partial: {
          rewardTable: [],
          narrative: "A close call, but you're through.",
          agentDowntimeCycles: 1,
        },
        failure: {
          rewardTable: [],
          narrative: "Someone breaks.",
          stressPenalty: 2,
          tokenRefund: 0.5,
        },
      },
    },
  ],
  difficultyModes: [],
  items: [],
  narrativeEvents: [],
  scaling: null,
};

export function workshopSkeleton(): string {
  return JSON.stringify(SKELETON_ARC, null, 2);
}

export function loadWorkshopDraft(): string | null {
  try {
    return localStorage.getItem(DRAFT_KEY);
  } catch (e) {
    console.warn("loadWorkshopDraft failed", e);
    return null;
  }
}

export function saveWorkshopDraft(text: string): void {
  try {
    localStorage.setItem(DRAFT_KEY, text);
  } catch (e) {
    console.warn("saveWorkshopDraft failed", e);
  }
}

export interface ArcSummary {
  challenges: number;
  roles: number;
  items: number;
  attunementChains: number;
  narrativeEvents: number;
  progressionTiers: number;
}

export function summarizeArc(arc: Arc): ArcSummary {
  return {
    challenges: arc.challenges.length,
    roles: arc.roles.length,
    items: arc.items.length,
    attunementChains: arc.attunementChains.length,
    narrativeEvents: arc.narrativeEvents.length,
    progressionTiers: arc.progressionTiers.length,
  };
}

// ── Playtest preview (RFC_WORKSHOP PR 062) ──────────────────────────────────
// A fixed, small, deterministic seed set and a visible maxCycles bound —
// bounded seeded facts through the one conformance harness (reused
// read-only), never a certification. maxCycles matches the shipped cartridge
// conformance tests' REACHABILITY_MAX_CYCLES (tests/cartridges/*.test.ts),
// the bound those tests use for full-run aggregation via aggregateRuns.
export const PLAYTEST_SEEDS = [1, 2, 3, 4, 5] as const;
export const PLAYTEST_MAX_CYCLES = 45;

export interface PlaytestReport {
  seeds: number;
  maxCycles: number;
  aggregate: ArcAggregate;
}

/** Pure and deterministic: the same arc always yields an identical report.
 *  Runs are bounded (5 seeds × PLAYTEST_MAX_CYCLES cycles) so this stays
 *  synchronous-safe for a click handler. */
export function playtestPreview(arc: Arc): PlaytestReport {
  const runs = PLAYTEST_SEEDS.map((seed) => simulateArcRun(arc, { seed, maxCycles: PLAYTEST_MAX_CYCLES }));
  const aggregate = aggregateRuns(arc, runs, PLAYTEST_MAX_CYCLES);
  return { seeds: PLAYTEST_SEEDS.length, maxCycles: PLAYTEST_MAX_CYCLES, aggregate };
}
