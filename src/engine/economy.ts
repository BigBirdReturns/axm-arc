import type { Organization, Arc } from "./types.js";
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

export function accrueChallengeRewards(
  org: Organization,
  report: RunReport,
  arc: Arc,
): Organization {
  // Bump reputation by the outcome's reputationGain if applicable
  const challenge = arc.challenges.find((c) => c.id === report.challengeId);
  if (!challenge) return org;

  const outcome = challenge.outcomes[report.outcome];
  const repGain = outcome.reputationGain ?? 0;
  if (repGain === 0) return org;

  return {
    ...org,
    reputation: org.reputation + repGain,
  };
}
