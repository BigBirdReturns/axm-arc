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
      <h2>Reports</h2>

      {pendingRewardChoices.length > 0 && (
        <>
          <h3 style={{ fontSize: 15, color: "var(--accent)" }}>Pending Reward Decisions</h3>
          {pendingRewardChoices.map((p, i) => {
            const item = arc.items.find((it) => it.id === p.itemId);
            const decided = decisionFor(p);
            return (
              <div key={i} className="card">
                <strong>{item?.name ?? p.itemId}</strong>
                <div className="tiny" style={{ marginTop: 4 }}>
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
                        style={{ marginTop: 4, width: "100%" }}
                        onClick={() => award(p, aid)}
                      >
                        Award to {a?.name ?? aid}{chosen ? " ✓" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {pendingRewardChoices.length > rewardDecisions.length && (
            <div className="warning">
              {pendingRewardChoices.length - rewardDecisions.length} reward decisions still pending.
            </div>
          )}
        </>
      )}

      <h3 style={{ fontSize: 15, color: "var(--accent)", marginTop: 16 }}>Last Cycle</h3>
      {reports.length === 0 && <div className="empty">No reports yet. Assign agents and advance the cycle.</div>}
      {reports.map((r, i) => {
        const challenge = arc.challenges.find((c) => c.id === r.challengeId);
        if (!challenge) return null;
        const narrative = renderReport(r, DEFAULT_TEMPLATES, { agents: agentMap, challenge, arc });
        return (
          <div key={i} className="card">
            <div className="row between">
              <strong>{challenge.name}</strong>
              <span
                className="badge"
                style={{
                  background:
                    r.outcome === "success" ? "var(--positive)" :
                    r.outcome === "partial" ? "var(--accent-dim)" : "var(--danger)",
                }}
              >
                {r.outcome}
              </span>
            </div>
            <div className="narrative">{narrative}</div>
            {r.lootDrops.length > 0 && (
              <div className="tiny" style={{ marginTop: 8 }}>
                Loot: {r.lootDrops.map((l) => arc.items.find((it) => it.id === l.itemId)?.name ?? l.itemId).join(", ")}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
