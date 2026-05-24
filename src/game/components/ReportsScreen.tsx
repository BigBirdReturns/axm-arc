import type { Arc, Organization, RunReport } from "../../engine/types.js";
import type { PendingRewardChoice, RewardDecision } from "../../engine/cycle.js";
import { renderReport, DEFAULT_TEMPLATES } from "../../engine/report.js";

interface Props {
  arc: Arc;
  org: Organization;
  reports: RunReport[];
  pendingRewardChoices: PendingRewardChoice[];
  rewardDecisions: RewardDecision[];
  setRewardDecisions: (d: RewardDecision[]) => void;
}

export function ReportsScreen({
  arc,
  org,
  reports,
  pendingRewardChoices,
  rewardDecisions,
  setRewardDecisions,
}: Props): JSX.Element {
  const agentMap = new Map(Object.entries(org.agents));

  const award = (choice: PendingRewardChoice, winner: string) => {
    const next = rewardDecisions.filter(
      (d) => !(d.itemId === choice.itemId && d.sourceChallenge === choice.sourceChallenge),
    );
    next.push({
      itemId: choice.itemId,
      eligible: choice.eligibleAgentIds,
      winner,
      sourceChallenge: choice.sourceChallenge,
    });
    setRewardDecisions(next);
  };

  const decisionFor = (c: PendingRewardChoice): RewardDecision | undefined =>
    rewardDecisions.find((d) => d.itemId === c.itemId && d.sourceChallenge === c.sourceChallenge);

  return (
    <div className="screen">
      {reports.length === 0 && pendingRewardChoices.length === 0 && (
        <div className="empty">No reports yet. Assign agents and advance the cycle.</div>
      )}

      {pendingRewardChoices.length > 0 && (
        <>
          <div className="audit-section">Drops · {pendingRewardChoices.length}</div>
          {pendingRewardChoices.map((p, i) => {
            const item = arc.items.find((it) => it.id === p.itemId);
            const decided = decisionFor(p);
            return (
              <div key={i} className="card">
                <div className="row between">
                  <span className="agent-name" style={{ fontSize: 14 }}>{item?.name ?? p.itemId}</span>
                  {decided
                    ? <span className="badge pass">Awarded</span>
                    : <span className="badge pending">Decision Pending</span>
                  }
                </div>
                <div className="agent-meta" style={{ marginTop: 4 }}>
                  From: {p.sourceChallenge} · Cycle {p.cycle}
                </div>
                <div style={{ marginTop: 8 }}>
                  {p.eligibleAgentIds.map((aid) => {
                    const a = agentMap.get(aid);
                    const chosen = decided?.winner === aid;
                    return (
                      <button
                        key={aid}
                        className={chosen ? "primary" : "secondary"}
                        style={{ width: "100%", marginTop: 4 }}
                        onClick={() => award(p, aid)}
                      >
                        {chosen ? `→ ${a?.name ?? aid}` : `Award ${a?.name ?? aid}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}

      {reports.map((r, i) => {
        const challenge = arc.challenges.find((c) => c.id === r.challengeId);
        if (!challenge) return null;
        const narrative = renderReport(r, DEFAULT_TEMPLATES, { agents: agentMap, challenge, arc });
        const passedCount = r.assignedAgents[0]?.mechanicResults.filter((m) => m.passed).length ?? 0;
        const totalChecks = challenge.mechanicChecks.length;
        const totalStress = r.assignedAgents.reduce((s, a) => s + a.stressGained, 0);

        return (
          <div key={i} style={{ marginBottom: 24 }}>
            <div className="report-meta">Field Report / No. {String(org.cycle).padStart(2, "0")}</div>
            <div className="report-headline">
              {challenge.name}{" "}
              {r.outcome === "partial" && <span className="accent">Nearly</span>}{" "}
              {r.outcome === "failure" && <span className="accent">Failed.</span>}
              {r.outcome === "success" && "Clear."}
            </div>
            <div className="agent-meta" style={{ marginBottom: 8 }}>
              Cycle {r.cycle} · {arc.meta.domain} · Tier I · Composition: {r.assignedAgents.length} agents
              · {r.outcome.toUpperCase()}
            </div>

            <div className="abstract">
              <span className="abstract-label">Abstract</span>
              <p>{narrative.split("\n")[0]}</p>
            </div>

            <div className="stat-strip" style={{ margin: "12px 0" }}>
              <div className="stat-cell">
                <div className="stat-lbl">Outcome</div>
                <div className={`stat-val${r.outcome === "failure" ? " accent" : r.outcome === "partial" ? " accent" : " positive"}`}>
                  {r.outcome.toUpperCase()}
                </div>
              </div>
              <div className="stat-cell">
                <div className="stat-lbl">Checks</div>
                <div className="stat-val">{passedCount}/{totalChecks}</div>
                <div className="stat-sub">{totalChecks - passedCount} failed</div>
              </div>
              <div className="stat-cell">
                <div className="stat-lbl">Stress Δ</div>
                <div className="stat-val accent">+{totalStress}</div>
                <div className="stat-sub">across roster</div>
              </div>
              <div className="stat-cell">
                <div className="stat-lbl">Loot</div>
                <div className="stat-val">{r.lootDrops.length}</div>
                <div className="stat-sub">drops</div>
              </div>
            </div>

            <div className="narrative">{narrative}</div>

            <div className="audit-section">The Audit · {totalChecks} Checks</div>
            {r.assignedAgents.length > 0 && r.assignedAgents[0]!.mechanicResults.map((mr) => {
              const mech = challenge.mechanicChecks.find((m) => m.id === mr.mechanicId);
              const margin = mr.score - mr.threshold;
              const pct = Math.min(100, Math.max(0, (mr.score / Math.max(mr.threshold, 1)) * 100));
              return (
                <div key={mr.mechanicId} className="mechanic-row">
                  <div className="row between">
                    <span className="mechanic-name">{mech?.name ?? mr.mechanicId}</span>
                    <span className={`badge ${mr.passed ? "pass" : "fail"}`}>
                      {mr.passed ? "Pass" : "Fail"} · {margin >= 0 ? "+" : ""}{Math.round(margin)}
                    </span>
                  </div>
                  <div className="mechanic-detail">
                    {mr.mechanicId} · {Math.round(mr.score)} vs threshold {mr.threshold}
                  </div>
                  <div className={`bar mechanic${!mr.passed ? " fail" : ""}`}>
                    <div className="fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}

            {r.lootDrops.length > 0 && (
              <>
                <div className="audit-section">Drops · {r.lootDrops.length}</div>
                {r.lootDrops.map((l) => {
                  const item = arc.items.find((it) => it.id === l.itemId);
                  return (
                    <div key={l.itemId} className="card" style={{ marginTop: 4 }}>
                      <div className="row between">
                        <span className="agent-name" style={{ fontSize: 14 }}>{item?.name ?? l.itemId}</span>
                        <span className="badge">Drop</span>
                      </div>
                      <div className="agent-meta">
                        Eligible: {l.eligibleAgents.map((id) => agentMap.get(id)?.name ?? id).join(", ")}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
