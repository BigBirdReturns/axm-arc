import type { Organization, Agent, Precedent } from "./types.js";
import { PRECEDENT_LOOKBACK } from "./constants.js";

// ── logPrecedent ──────────────────────────────────────────────────────────────

export function logPrecedent(org: Organization, p: Precedent): Organization {
  return { ...org, precedents: [...org.precedents, p] };
}

// ── scanPrecedents ────────────────────────────────────────────────────────────

export function scanPrecedents(
  org: Organization,
  type: Precedent["type"],
  lookback: number,
): Precedent[] {
  const ofType = org.precedents.filter((p) => p.type === type);
  return ofType.slice(-lookback);
}

// ── consistencyScore ──────────────────────────────────────────────────────────

export function consistencyScore(
  precedents: Precedent[],
  decision_basis: Precedent["decisionBasis"],
): number {
  if (precedents.length === 0) return 0;
  const matching = precedents.filter((p) => p.decisionBasis === decision_basis).length;
  return matching / precedents.length;
}

// ── detectPrecedentViolation ──────────────────────────────────────────────────

export function detectPrecedentViolation(
  org: Organization,
  newPrecedent: Precedent,
  witnesses: Agent[],
): {
  violated: boolean;
  affectedAgents: string[];
  loyaltyDeltas: Map<string, number>;
} {
  const recent = scanPrecedents(org, newPrecedent.type, PRECEDENT_LOOKBACK);

  if (recent.length < 3) {
    // Not enough history to establish a pattern
    return { violated: false, affectedAgents: [], loyaltyDeltas: new Map() };
  }

  // Find the dominant basis among recent precedents (excluding the new one)
  const basisCounts = new Map<Precedent["decisionBasis"], number>();
  for (const p of recent) {
    basisCounts.set(p.decisionBasis, (basisCounts.get(p.decisionBasis) ?? 0) + 1);
  }

  let dominantBasis: Precedent["decisionBasis"] | null = null;
  let dominantCount = 0;
  for (const [basis, count] of basisCounts) {
    if (count > dominantCount) {
      dominantCount = count;
      dominantBasis = basis;
    }
  }

  if (!dominantBasis || dominantBasis === newPrecedent.decisionBasis) {
    return { violated: false, affectedAgents: [], loyaltyDeltas: new Map() };
  }

  // Consistency to the OTHER (dominant) basis >= 0.7 → violation
  const otherConsistency = dominantCount / recent.length;
  if (otherConsistency < 0.7) {
    return { violated: false, affectedAgents: [], loyaltyDeltas: new Map() };
  }

  // How many prior violations of the same dominant pattern?
  const priorViolations = recent.filter(
    (p) => p.decisionBasis !== dominantBasis,
  ).length;
  // Penalty scales by 0.5x for each additional violation (they stop being surprised)
  const scaleFactor = Math.pow(0.5, priorViolations);
  const baseLoyaltyHit = Math.round(-2 * scaleFactor);

  const affectedAgents: string[] = [];
  const loyaltyDeltas = new Map<string, number>();

  for (const witness of witnesses) {
    if (witness.hiddenAttributes.ambition > 12) {
      affectedAgents.push(witness.id);
      loyaltyDeltas.set(witness.id, baseLoyaltyHit);
    }
  }

  return {
    violated: affectedAgents.length > 0,
    affectedAgents,
    loyaltyDeltas,
  };
}
