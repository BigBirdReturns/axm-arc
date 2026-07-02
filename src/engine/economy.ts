import type { Organization, Arc, Challenge } from "./types.js";
import type { RunReport } from "./types.js";

// ── CycleEvent (minimal union used in this file) ──────────────────────────────

export interface CycleEvent {
  type: string;
  agentId?: string;
  data: unknown;
}

// ── regenerateTokens ──────────────────────────────────────────────────────────

export function regenerateTokens(org: Organization, arc: Arc): Organization {
  // Base regen from arc
  let regen = arc.tokensPerCycle;

  // Infrastructure bonus: Production/Quarters/etc contribute via arc.infrastructureTokenBonus
  // Design §1.6: "Infrastructure investment can accelerate regeneration by up to 50%"
  // We sum facility levels scaled by infrastructureTokenBonus, capped at 50% bonus
  const facilities = Object.values(org.infrastructure);
  const totalFacilityLevel = facilities.reduce((s, f) => s + f.level, 0);
  const bonusFraction = Math.min(0.5, totalFacilityLevel * arc.infrastructureTokenBonus);
  regen = regen * (1 + bonusFraction);

  const newTokens = Math.min(arc.maxTokens, org.resources.tokens + regen);
  return {
    ...org,
    resources: { ...org.resources, tokens: Math.floor(newTokens) },
  };
}

// ── spendTokens ───────────────────────────────────────────────────────────────

export function spendTokens(org: Organization, n: number): Organization {
  if (org.resources.tokens < n) {
    throw new Error(`Insufficient tokens: have ${org.resources.tokens}, need ${n}`);
  }
  return {
    ...org,
    resources: { ...org.resources, tokens: org.resources.tokens - n },
  };
}

// ── chargeUpkeep ──────────────────────────────────────────────────────────────

export type OrgWithBalance = Organization & { negativeBalance?: boolean };

export function chargeUpkeep(org: Organization, _cycle: number): OrgWithBalance {
  const totalUpkeep = Object.values(org.agents).reduce((s, a) => s + a.upkeep, 0);
  if (org.resources.currency < totalUpkeep) {
    return {
      ...org,
      resources: { ...org.resources, currency: org.resources.currency - totalUpkeep },
      negativeBalance: true,
    };
  }
  return {
    ...org,
    resources: { ...org.resources, currency: org.resources.currency - totalUpkeep },
  };
}

// ── accrueChallengeRewards ────────────────────────────────────────────────────

// Re-clearing an already-beaten challenge ("farming") still pays, but at a
// fraction of the first-clear reward — enough to sustain upkeep, not enough to
// trivialise the economy. Reputation is only awarded once per challenge.
export const REPEAT_CLEAR_REWARD_FACTOR = 0.25;

export interface AccruedRewards {
  org: Organization;
  currencyGranted: number;
  reputationGranted: number;
}

function hasPriorSuccess(org: Organization, challengeId: string, currentCycle: number): boolean {
  for (const agent of Object.values(org.agents)) {
    for (const entry of agent.assignmentHistory) {
      if (entry.challengeId === challengeId && entry.outcome === "success" && entry.cycle < currentCycle) {
        return true;
      }
    }
  }
  return false;
}

// challengeOverride: the challenge the resolver actually ran (e.g. after
// applyDifficultyMode), so scaled outcomes pay what was resolved. Omitted,
// the base challenge is looked up by id as before.
export function accrueChallengeRewards(org: Organization, report: RunReport, arc: Arc, challengeOverride?: Challenge): AccruedRewards {
  const challenge = challengeOverride ?? arc.challenges.find((c) => c.id === report.challengeId);
  if (!challenge) return { org, currencyGranted: 0, reputationGranted: 0 };

  const outcome = challenge.outcomes[report.outcome];
  const baseCurrency = outcome.currencyReward ?? 0;
  const baseReputation = outcome.reputationGain ?? 0;

  const isRepeatClear = report.outcome === "success" && hasPriorSuccess(org, report.challengeId, report.cycle);
  const currencyGranted = isRepeatClear ? Math.floor(baseCurrency * REPEAT_CLEAR_REWARD_FACTOR) : baseCurrency;
  const reputationGranted = isRepeatClear ? 0 : baseReputation;

  if (currencyGranted === 0 && reputationGranted === 0) {
    return { org, currencyGranted: 0, reputationGranted: 0 };
  }

  return {
    org: {
      ...org,
      reputation: org.reputation + reputationGranted,
      resources: { ...org.resources, currency: org.resources.currency + currencyGranted },
    },
    currencyGranted,
    reputationGranted,
  };
}
