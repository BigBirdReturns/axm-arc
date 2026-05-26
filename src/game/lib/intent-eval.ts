import type { Arc, RunReport } from "../../engine/types.js";

export type IntentOutcome = "achieved" | "partial" | "missed";

export interface IntentMatch {
  challenge: string;
  outcome: IntentOutcome;
}

export interface IntentEvalResult {
  overall: IntentOutcome;
  matches: IntentMatch[];
}

export function evaluateIntent(
  intent: string,
  reports: RunReport[],
  arc: Arc,
): IntentEvalResult | null {
  if (!intent.trim()) return null;

  const lower = intent.toLowerCase();

  const mentioned = arc.challenges.filter((c) =>
    lower.includes(c.name.toLowerCase()),
  );

  if (mentioned.length === 0) return null;

  const reportMap = new Map<string, RunReport["outcome"]>();
  for (const r of reports) {
    reportMap.set(r.challengeId, r.outcome);
  }

  const matches: IntentMatch[] = mentioned.map((c) => {
    const reportOutcome = reportMap.get(c.id);
    let outcome: IntentOutcome;
    if (reportOutcome === "success") {
      outcome = "achieved";
    } else if (reportOutcome === "partial") {
      outcome = "partial";
    } else {
      outcome = "missed";
    }
    return { challenge: c.name, outcome };
  });

  const allAchieved = matches.every((m) => m.outcome === "achieved");
  const allMissed = matches.every((m) => m.outcome === "missed");
  const overall: IntentOutcome = allAchieved
    ? "achieved"
    : allMissed
      ? "missed"
      : "partial";

  return { overall, matches };
}
