import { predictImminentEvents } from "../../engine/projections.js";
import type { Arc, Organization, RunReport } from "../../engine/types.js";
import { generateHeadline } from "../lib/headline.js";

interface Props {
  intent?: string;
  arc: Arc;
  org: Organization;
  lastReports: RunReport[];
}

export function SituationSidebar({ arc, org, lastReports, intent = "" }: Props): JSX.Element {
  const imminent = predictImminentEvents(org, arc);
  const agentMap = new Map(Object.entries(org.agents));
  const lastReport = lastReports[0];
  const challenge = lastReport ? arc.challenges.find((c) => c.id === lastReport.challengeId) : null;
  const headline = lastReport ? generateHeadline(lastReport, arc, agentMap) : null;

  // Build severity-framed alerts
  const alerts = buildAlerts(org, arc);

  return (
    <div className="sidebar">
      {/* ── Intent pull-quote ── */}
      {intent && (
        <div className="sidebar-section">
          <div className="sidebar-label">Intent · This Cycle</div>
          <div style={{
            borderLeft: "2px solid var(--ink)",
            paddingLeft: 12,
            fontFamily: "var(--display)",
            fontWeight: 700,
            fontSize: 15,
            color: "var(--ink)",
            lineHeight: 1.3,
          }}>
            {intent}
          </div>
        </div>
      )}

      {/* ── Drama blocking alerts ── */}
      {org.dramaQueue.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-label">Drama · {String(org.dramaQueue.length).padStart(2, "0")} Queued</div>
          <div className="sidebar-alert">Blocking</div>
          {org.dramaQueue.slice(0, 3).map((card) => (
            <div key={card.id} className="sidebar-card danger">
              <div className="sidebar-card-type">{card.triggerType.replace(/_/g, " ")}</div>
              <div className="sidebar-card-headline">
                {card.narrativeText.split(".")[0]}.
              </div>
              <div className="sidebar-card-meta">
                {card.options.length} option{card.options.length > 1 ? "s" : ""} · tap to resolve
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Severity-framed alerts ── */}
      {alerts.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-label">Stress · Threshold</div>
          {alerts.map((alert, i) => (
            <div key={i} className="sidebar-card" style={{
              borderLeft: `3px solid ${alert.severity === "critical" ? "var(--accent)" : "var(--rule-dk)"}`,
              marginBottom: 8,
            }}>
              <div style={{
                fontFamily: "var(--display)",
                fontWeight: 800,
                fontSize: 15,
                color: alert.severity === "critical" ? "var(--accent)" : "var(--ink)",
                textTransform: "uppercase",
                lineHeight: 1.2,
                marginBottom: 4,
              }}>
                {alert.headline}
              </div>
              <div className="sidebar-card-meta">{alert.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Last report ── */}
      {lastReport && challenge && headline && (
        <div className="sidebar-section">
          <div className="sidebar-label">Last Report · Cycle {String(lastReport.cycle).padStart(2, "0")}</div>
          <div className="sidebar-card">
            <div className="sidebar-card-headline">
              {challenge.name}, {lastReport.outcome === "success" ? "Clean." : lastReport.outcome === "partial" ? "Partial." : "Wipe."}{" "}
            </div>
            <div className="sidebar-card-body">
              {lastReport.assignedAgents[0]?.mechanicResults.filter((m) => m.passed).length ?? 0} of{" "}
              {challenge.mechanicChecks.length} checks passed.
              {lastReport.lootDrops.length > 0 && ` ${lastReport.lootDrops.length} drop${lastReport.lootDrops.length > 1 ? "s" : ""}.`}
            </div>
          </div>
        </div>
      )}

      {/* ── Imminent events ── */}
      {imminent.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-label">Imminent</div>
          <ul className="sidebar-list">
            {imminent.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Alert builder ─────────────────────────────────────────────────────────────

interface Alert {
  headline: string;
  sub: string;
  severity: "critical" | "warning" | "info";
}



function buildAlerts(org: Organization, arc: Arc): Alert[] {
  const alerts: Alert[] = [];

  for (const agent of Object.values(org.agents)) {
    const firstName = agent.name.split(" ")[0]!;

    // Stress threshold alerts — this is the "VEX IS AT 7. ONE BAD CYCLE." pattern
    if (agent.stress >= 9 && agent.afflictionState.kind === "none") {
      alerts.push({
        headline: `${firstName.toUpperCase()} IS AT ${agent.stress}. ONE BAD CYCLE.`,
        sub: `3 options · tap to resolve`,
        severity: "critical",
      });
    } else if (agent.stress >= 7 && agent.afflictionState.kind === "none") {
      alerts.push({
        headline: `${firstName.toUpperCase()} IS AT ${agent.stress}. WATCH THIS.`,
        sub: `Send to Recreation or reduce assignments`,
        severity: "warning",
      });
    }

    // Active affliction alerts
    if (agent.afflictionState.kind !== "none") {
      alerts.push({
        headline: `${firstName.toUpperCase()} IS ${agent.afflictionState.kind.toUpperCase()}.`,
        sub: `Rest or mentor to clear`,
        severity: "critical",
      });
    }
  }

  // Precedent violation proximity
  const rewardPrecedents = org.precedents.filter((p) => p.type === "reward");
  if (rewardPrecedents.length >= 3) {
    const recent = rewardPrecedents.slice(-3);
    const bases = new Set(recent.map((p) => p.decisionBasis));
    if (bases.size > 1) {
      alerts.push({
        headline: "THREE AMBITIOUS AGENTS NOTICED.",
        sub: `2 options · tap to resolve`,
        severity: "warning",
      });
    }
  }

  // Relationship transitions
  const hostileCount = org.relationships.filter((r) => r.state === "Hostile").length;
  if (hostileCount > 0) {
    alerts.push({
      headline: `${hostileCount} HOSTILE PAIR${hostileCount > 1 ? "S" : ""} IN ROTATION.`,
      sub: `+1 stress per shared challenge`,
      severity: "warning",
    });
  }

  // Return max 4 alerts, critical first
  return alerts
    .sort((a, b) => (a.severity === "critical" ? -1 : 1) - (b.severity === "critical" ? -1 : 1))
    .slice(0, 4);
}
