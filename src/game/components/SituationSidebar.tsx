import { predictImminentEvents } from "../../engine/projections.js";
import type { Arc, Organization, RunReport } from "../../engine/types.js";

interface Props {
  arc: Arc;
  org: Organization;
  lastReports: RunReport[];
}

export function SituationSidebar({ arc, org, lastReports }: Props): JSX.Element {
  const imminent = predictImminentEvents(org, arc);
  const lastReport = lastReports[0];
  const challenge = lastReport ? arc.challenges.find((c) => c.id === lastReport.challengeId) : null;

  return (
    <div className="sidebar">
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

      {lastReport && challenge && (
        <div className="sidebar-section">
          <div className="sidebar-label">Last Report · Cycle {String(lastReport.cycle).padStart(2, "0")}</div>
          <div className="sidebar-card">
            <div className="sidebar-card-headline">
              {challenge.name}, {lastReport.outcome === "success" ? "Clean" : lastReport.outcome === "partial" ? "Partial" : "Wipe"}.
            </div>
            <div className="sidebar-card-body">
              {lastReport.assignedAgents[0]?.mechanicResults.filter((m) => m.passed).length ?? 0} of{" "}
              {challenge.mechanicChecks.length} checks passed.
              {lastReport.lootDrops.length > 0 && ` ${lastReport.lootDrops.length} drop${lastReport.lootDrops.length > 1 ? "s" : ""}.`}
            </div>
          </div>
        </div>
      )}

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
