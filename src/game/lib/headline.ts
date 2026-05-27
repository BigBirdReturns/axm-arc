/**
 * headline.ts
 *
 * Derives a newspaper-style display headline from a RunReport.
 * Priority order:
 *   1. Resolve event (rarest, most positive)
 *   2. Wipe / failure with all checks failed
 *   3. Partial with a dramatic failure (biggest negative margin)
 *   4. Success with a close call (margin 1-5)
 *   5. Clean success
 *
 * Returns { primary, qualifier } where the rendered headline is:
 *   <challenge.name> <qualifier> <primary>.
 * e.g. "MOROES" "NEARLY" "WIPED THE GROUP."
 *      "ATTUMEN" ""       "CLEAN."
 */

import type { RunReport, Arc, Agent } from "../../engine/types.js";

export interface Headline {
  challenge: string;       // "MOROES"
  qualifier: string;       // "NEARLY" | "" — rendered in accent color
  primary: string;         // "WIPED THE GROUP." — rest of sentence
  resolveAgent?: string;   // name of agent who resolved, if applicable
  clutchAgent?: string;    // name of agent whose clutch pass saved the run
  collapseAgent?: string;  // name of agent whose failure caused the worst moment
}

interface MechanicWithMargin {
  mechanicId: string;
  agentId: string;
  margin: number;          // negative = failed by this much, positive = passed by this much
  passed: boolean;
}

export function generateHeadline(
  report: RunReport,
  arc: Arc,
  agentMap: Map<string, Agent>,
): Headline {
  const challenge = arc.challenges.find((c) => c.id === report.challengeId);
  const challengeName = challenge?.name.toUpperCase() ?? report.challengeId.toUpperCase();

  // Flatten all mechanic results with margins
  const allMechanics: MechanicWithMargin[] = [];
  for (const ar of report.assignedAgents) {
    for (const mr of ar.mechanicResults) {
      allMechanics.push({
        mechanicId: mr.mechanicId,
        agentId: ar.agentId,
        margin: mr.score - mr.threshold,
        passed: mr.passed,
      });
    }
  }

  const failures = allMechanics.filter((m) => !m.passed)
    .sort((a, b) => a.margin - b.margin); // worst first

  const closePasses = allMechanics.filter((m) => m.passed && m.margin <= 5)
    .sort((a, b) => a.margin - b.margin); // closest first

  const bigPasses = allMechanics.filter((m) => m.passed && m.margin >= 10)
    .sort((a, b) => b.margin - a.margin); // biggest first

  const worstFailure = failures[0];
  const closestPass = closePasses[0];
  const biggestPass = bigPasses[0];

  // ── Priority 1: Full wipe / failure ────────────────────────────────────────
  if (report.outcome === "failure") {
    const allFailed = report.assignedAgents.every((ar) =>
      ar.mechanicResults.every((mr) => !mr.passed),
    );
    if (allFailed) {
      return {
        challenge: challengeName,
        qualifier: "",
        primary: "WIPED THE GROUP.",
        collapseAgent: worstFailure ? agentMap.get(worstFailure.agentId)?.name : undefined,
      };
    }
    return {
      challenge: challengeName,
      qualifier: "",
      primary: "FAILED.",
      collapseAgent: worstFailure ? agentMap.get(worstFailure.agentId)?.name : undefined,
    };
  }

  // ── Priority 2: Partial with dramatic failure ───────────────────────────────
  if (report.outcome === "partial") {
    const downed = report.assignedAgents.find((ar) => ar.wasDowned);
    if (downed) {
      const name = agentMap.get(downed.agentId)?.name?.split(" ")[0] ?? "an agent";
      return {
        challenge: challengeName,
        qualifier: "NEARLY",
        primary: `WIPED THE GROUP.`,
        collapseAgent: worstFailure ? agentMap.get(worstFailure.agentId)?.name : undefined,
        clutchAgent: closestPass ? agentMap.get(closestPass.agentId)?.name : undefined,
      };
    }
    if (worstFailure && Math.abs(worstFailure.margin) >= 7) {
      const name = agentMap.get(worstFailure.agentId)?.name?.split(" ")[0] ?? "someone";
      return {
        challenge: challengeName,
        qualifier: "NEARLY",
        primary: "FELL APART.",
        collapseAgent: agentMap.get(worstFailure.agentId)?.name,
        clutchAgent: biggestPass ? agentMap.get(biggestPass.agentId)?.name : undefined,
      };
    }
    return {
      challenge: challengeName,
      qualifier: "",
      primary: "PARTIAL CLEAR.",
      collapseAgent: worstFailure ? agentMap.get(worstFailure.agentId)?.name : undefined,
    };
  }

  // ── Priority 3: Heroic moment (engine-authoritative, not heuristic) ─────────
  const heroicAgent = report.assignedAgents.find((ar) => ar.isHeroic);
  if (heroicAgent) {
    const name = agentMap.get(heroicAgent.agentId)?.name?.split(" ")[0] ?? "someone";
    return {
      challenge: challengeName,
      qualifier: "",
      primary: `${name.toUpperCase()} CARRIED IT.`,
      resolveAgent: agentMap.get(heroicAgent.agentId)?.name,
    };
  }

  // ── Priority 4: Success with a close call ──────────────────────────────────
  if (closestPass && closestPass.margin <= 3) {
    const name = agentMap.get(closestPass.agentId)?.name?.split(" ")[0] ?? "someone";
    return {
      challenge: challengeName,
      qualifier: "",
      primary: `CLEARED. BARELY.`,
      clutchAgent: agentMap.get(closestPass.agentId)?.name,
    };
  }

  // ── Priority 5: Clean success ───────────────────────────────────────────────
  const allPassed = report.assignedAgents.every((ar) =>
    ar.mechanicResults.every((mr) => mr.passed),
  );
  if (allPassed && failures.length === 0) {
    return {
      challenge: challengeName,
      qualifier: "",
      primary: "CLEAN.",
    };
  }

  return {
    challenge: challengeName,
    qualifier: "",
    primary: "CLEAR.",
  };
}

/**
 * Generates the precedent context sentence for a reward decision.
 * "Your last seven awards went by merit."
 * "Six of your last ten decisions were by seniority."
 */
export function precedentContextSentence(
  precedents: Array<{ decisionBasis: string }>,
  lookback = 10,
): string {
  const recent = precedents.slice(-lookback);
  if (recent.length === 0) return "No precedent established yet.";

  const counts = new Map<string, number>();
  for (const p of recent) {
    counts.set(p.decisionBasis, (counts.get(p.decisionBasis) ?? 0) + 1);
  }

  let dominant = "";
  let dominantCount = 0;
  for (const [basis, count] of counts) {
    if (count > dominantCount) { dominant = basis; dominantCount = count; }
  }

  if (dominantCount === recent.length) {
    const word = recent.length === 1 ? "decision" : `${numberWord(recent.length)} awards`;
    return `Your last ${word} went by ${dominant}.`;
  }

  return `${numberWord(dominantCount)} of your last ${recent.length} decisions were by ${dominant}.`;
}

function numberWord(n: number): string {
  const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  return words[n] ?? String(n);
}

/**
 * Returns the most dramatic per-agent line for a single agent's run results.
 * Used in the audit section of the field report.
 */
export function agentRunLine(
  agentName: string,
  roleName: string,
  mechanicResults: Array<{ mechanicId: string; score: number; threshold: number; passed: boolean }>,
  arc: Arc,
  challengeId: string,
): string {
  const challenge = arc.challenges.find((c) => c.id === challengeId);
  if (!challenge || mechanicResults.length === 0) return "";

  const failures = mechanicResults
    .filter((mr) => !mr.passed)
    .map((mr) => {
      const mech = challenge.mechanicChecks.find((m) => m.id === mr.mechanicId);
      return { name: mech?.name ?? mr.mechanicId, margin: mr.score - mr.threshold, score: mr.score, threshold: mr.threshold };
    })
    .sort((a, b) => a.margin - b.margin);

  const passes = mechanicResults
    .filter((mr) => mr.passed)
    .map((mr) => {
      const mech = challenge.mechanicChecks.find((m) => m.id === mr.mechanicId);
      return { name: mech?.name ?? mr.mechanicId, margin: mr.score - mr.threshold, score: mr.score, threshold: mr.threshold };
    })
    .sort((a, b) => b.margin - a.margin);

  const firstName = agentName.split(" ")[0] ?? agentName;

  if (failures.length > 0) {
    const f = failures[0]!;
    return `${firstName} missed ${f.name} (score ${Math.round(f.score)} vs threshold ${f.threshold}).`;
  }

  if (passes.length > 0) {
    const p = passes[0]!;
    if (p.margin >= 10) return `${firstName} carried ${p.name}, posting the top output.`;
    if (p.margin <= 5) return `${firstName} barely handled ${p.name}, scraping through with nothing to spare.`;
    return `${firstName} passed ${p.name} with a comfortable margin.`;
  }

  return "";
}
