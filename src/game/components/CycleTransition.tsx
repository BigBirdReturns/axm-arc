import { useEffect, useState, useMemo } from "react";
import type { RunReport, Arc, Organization, Agent } from "../../engine/types.js";
import { generateHeadline, type Headline } from "../lib/headline.js";
import { evaluateIntent, type IntentOutcome } from "../lib/intent-eval.js";

type Beat = "passing" | "headline" | "done";

interface TickerLine {
  text: string;
  accent?: boolean; // true → render in accent color
}

function buildTickerLines(
  reports: RunReport[],
  arc: Arc,
  org: Organization,
): TickerLine[] {
  const lines: TickerLine[] = [];

  // 1. Challenge outcomes
  for (const r of reports) {
    if (lines.length >= 6) break;
    const challenge = arc.challenges.find((c) => c.id === r.challengeId);
    const name = challenge?.name.toUpperCase() ?? r.challengeId.toUpperCase();
    const outcomeLabel =
      r.outcome === "success"
        ? "CLEARED"
        : r.outcome === "partial"
          ? "PARTIAL"
          : "FAILED";
    lines.push({
      text: `${name} — ${outcomeLabel}`,
      accent: r.outcome === "success",
    });
  }

  // 2. High-stress agents
  for (const r of reports) {
    for (const ar of r.assignedAgents) {
      if (lines.length >= 6) break;
      if (ar.stressGained >= 2) {
        const agent = org.agents[ar.agentId];
        const name = agent?.name?.split(" ")[0]?.toUpperCase() ?? ar.agentId.toUpperCase();
        lines.push({ text: `${name} — STRESS +${ar.stressGained}` });
      }
    }
  }

  // 3. Morale extremes
  for (const agent of Object.values(org.agents)) {
    if (lines.length >= 6) break;
    const firstName = agent.name.split(" ")[0]?.toUpperCase() ?? agent.name.toUpperCase();
    if (agent.morale < 40) {
      lines.push({ text: `${firstName} — MORALE ↓` });
    } else if (agent.morale > 80) {
      lines.push({ text: `${firstName} — MORALE ↑`, accent: true });
    }
  }

  // 4. Relationship shifts — check for hostile/rivalrous states
  for (const rel of org.relationships) {
    if (lines.length >= 6) break;
    if (rel.state === "Hostile" || rel.state === "Rivalrous") {
      const a1 = org.agents[rel.agentIds[0]];
      const a2 = org.agents[rel.agentIds[1]];
      const n1 = a1?.name?.split(" ")[0]?.toUpperCase() ?? rel.agentIds[0].toUpperCase();
      const n2 = a2?.name?.split(" ")[0]?.toUpperCase() ?? rel.agentIds[1].toUpperCase();
      lines.push({ text: `${n1} → ${rel.state.toUpperCase()} W/ ${n2}` });
    }
  }

  return lines.slice(0, 6);
}

function pickKicker(headline: Headline, reports: RunReport[]): string {
  const allSuccess = reports.every((r) => r.outcome === "success");
  const anyFailure = reports.some((r) => r.outcome === "failure");

  if (allSuccess) return "CLEAN SWEEP";
  if (anyFailure && headline.collapseAgent) return "PERSONNEL CRISIS";
  if (anyFailure) return "RAID REPORT";
  if (headline.resolveAgent) return "STANDOUT PERFORMANCE";
  if (headline.clutchAgent) return "CLOSE CALL";
  return "RAID REPORT";
}

function buildDeck(headline: Headline, reports: RunReport[], arc: Arc): string {
  const challenge = arc.challenges.find(
    (c) => c.name.toUpperCase() === headline.challenge,
  );
  const challengeName = challenge?.name ?? headline.challenge;

  // Wipe
  if (headline.primary.includes("WIPED") && !headline.qualifier) {
    return `The roster took heavy losses against ${challengeName}.`;
  }
  // Near wipe
  if (headline.primary.includes("WIPED") && headline.qualifier === "NEARLY") {
    if (headline.clutchAgent) {
      return `${headline.clutchAgent.split(" ")[0]} barely held the line.`;
    }
    return "The margin was razor-thin.";
  }
  // Clean
  if (headline.primary === "CLEAN.") {
    return "No issues. The group executed perfectly.";
  }
  // Carried
  if (headline.resolveAgent) {
    return `${headline.resolveAgent.split(" ")[0]} stepped up when it mattered.`;
  }
  // Barely cleared
  if (headline.primary.includes("BARELY")) {
    return "The margin was razor-thin.";
  }
  // Partial
  if (headline.primary.includes("PARTIAL")) {
    return "The group managed a partial clear under pressure.";
  }
  // Fell apart
  if (headline.primary.includes("FELL APART")) {
    if (headline.collapseAgent) {
      return `${headline.collapseAgent.split(" ")[0]} couldn't hold it together.`;
    }
    return "The group managed a partial clear under pressure.";
  }
  // Failed
  if (headline.primary === "FAILED.") {
    return `The roster took heavy losses against ${challengeName}.`;
  }
  // Default
  return "Another cycle in the books.";
}

interface CycleTransitionProps {
  fromCycle: number;
  toCycle: number;
  reports: RunReport[];
  arc: Arc;
  org: Organization;
  intent: string;
  onComplete: () => void;
}

function intentColor(outcome: IntentOutcome): string {
  if (outcome === "achieved") return "var(--positive)";
  if (outcome === "missed") return "var(--accent)";
  return "var(--dim)";
}

export function CycleTransition({
  fromCycle,
  toCycle,
  reports,
  arc,
  org,
  intent,
  onComplete,
}: CycleTransitionProps): JSX.Element {
  const [beat, setBeat] = useState<Beat>("passing");
  const [tickerVisible, setTickerVisible] = useState(0);

  const tickerLines = useMemo(
    () => buildTickerLines(reports, arc, org),
    [reports, arc, org],
  );

  // Pick the most dramatic report for the headline
  const primaryReport = useMemo(() => {
    if (reports.length === 0) return null;
    // Prefer failures, then partials, then successes
    const sorted = [...reports].sort((a, b) => {
      const order = { failure: 0, partial: 1, success: 2 };
      return order[a.outcome] - order[b.outcome];
    });
    return sorted[0]!;
  }, [reports]);

  const agentMap = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of Object.values(org.agents)) m.set(a.id, a);
    return m;
  }, [org.agents]);

  const headline = useMemo<Headline | null>(() => {
    if (!primaryReport) return null;
    return generateHeadline(primaryReport, arc, agentMap);
  }, [primaryReport, arc, agentMap]);

  const kicker = useMemo(
    () => (headline ? pickKicker(headline, reports) : "CYCLE UPDATE"),
    [headline, reports],
  );

  const deck = useMemo(
    () => (headline ? buildDeck(headline, reports, arc) : ""),
    [headline, reports, arc],
  );

  const intentResult = useMemo(
    () => evaluateIntent(intent, reports, arc),
    [intent, reports, arc],
  );

  // Beat 1: reveal ticker lines one by one, then auto-advance
  useEffect(() => {
    if (beat !== "passing") return;
    const lineDelay = 180; // ms between each ticker line appearing
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < tickerLines.length; i++) {
      timers.push(
        setTimeout(() => setTickerVisible(i + 1), 300 + i * lineDelay),
      );
    }

    // Auto-advance after 1.4s
    timers.push(setTimeout(() => setBeat("headline"), 1400));

    return () => timers.forEach(clearTimeout);
  }, [beat, tickerLines.length]);

  // Beat done
  useEffect(() => {
    if (beat === "done") onComplete();
  }, [beat, onComplete]);

  if (beat === "done") return <></>;

  // ── Beat 1: WEEK PASSING ──────────────────────────────────────────────────
  if (beat === "passing") {
    return (
      <div className="beat-overlay">
        <div className="passing-stamp">PROCESSING</div>

        <div className="passing-cycle">
          <span className="cycle-old" key={`old-${fromCycle}`}>
            {String(fromCycle).padStart(2, "0")}
          </span>
          <span className="cycle-new" key={`new-${toCycle}`}>
            {String(toCycle).padStart(2, "0")}
          </span>
        </div>

        <div className="press-band" />
        {/* Accent ink-bar pass — lifted from digest-prototype `pressSweep`. */}
        <div className="press-sweep" />

        <div className="passing-ticker">
          {tickerLines.slice(0, tickerVisible).map((line, i) => (
            <div
              className={`ticker-line${line.accent ? " accent" : ""}`}
              key={i}
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              {line.text}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Beat 2: HEADLINE ──────────────────────────────────────────────────────
  return (
    <div className="headline-screen" onClick={() => setBeat("done")}>
      <div className="headline-masthead">The Daily Charter</div>
      <div className="headline-rule" />
      <div className="headline-meta">
        <span>CYCLE {String(toCycle).padStart(2, "0")} · ARC 01</span>
        <span>{arc.meta.name.toUpperCase()}</span>
      </div>

      <div className="headline-kicker">{kicker}</div>

      {headline && (
        <div className="headline-headline">
          {headline.challenge}{" "}
          {headline.qualifier && (
            <span className="hl-qualifier">{headline.qualifier} </span>
          )}
          {headline.primary}
        </div>
      )}

      <div className="headline-deck">{deck}</div>

      {intentResult && (
        <div className="intent-recap">
          <div className="intent-recap-label">INTENT</div>
          <div className="intent-recap-overall" style={{ color: intentColor(intentResult.overall) }}>
            {intentResult.overall === "achieved" ? "ACHIEVED" : intentResult.overall === "missed" ? "MISSED" : "PARTIAL"}
          </div>
          <div className="intent-recap-matches">
            {intentResult.matches.map((m) => (
              <div key={m.challenge} className="intent-recap-row">
                <span className="intent-recap-challenge">{m.challenge}</span>
                <span style={{ color: intentColor(m.outcome) }}>
                  {m.outcome === "achieved" ? "Achieved" : m.outcome === "missed" ? "Missed" : "Partial"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="headline-tap">TAP TO CONTINUE</div>
    </div>
  );
}
