import type { Arc, Organization, RunReport } from "../../engine/types.js";
import type { PendingRewardChoice, RewardDecision } from "../../engine/cycle.js";
import { generateHeadline, agentRunLine } from "../lib/headline.js";
import { agentInitials } from "../lib/ui-helpers.js";
import CycleDigest from "./CycleDigest.js";

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
      {/* Cycle digest — pure render of this cycle's reports, no engine changes. */}
      <CycleDigest arc={arc} org={org} reports={reports} />

      {reports.length === 0 && pendingRewardChoices.length === 0 && (
        <div className="empty">No reports yet. Go to Assign, slot a roster on a contract, then hit Advance Cycle.</div>
      )}

      {/* ── Pending reward decisions ── */}
      {pendingRewardChoices.length > 0 && (
        <>
          <div className="audit-section">Drops · {pendingRewardChoices.length} pending</div>
          {pendingRewardChoices.map((p, i) => {
            const item = arc.items.find((it) => it.id === p.itemId);
            const decided = decisionFor(p);
            const statTotal = item
              ? Object.entries(item.statBonuses)
                  .map(([attr, val]) => `+${val} ${attr.toUpperCase()}`)
                  .join(" · ")
              : "";
            return (
              <div key={i} className="card">
                <div className="row between">
                  <div>
                    <div className="agent-name" style={{ fontSize: 14 }}>{item?.name ?? p.itemId}</div>
                    {statTotal && (
                      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.06em", marginTop: 2 }}>
                        {statTotal}
                      </div>
                    )}
                  </div>
                  {decided
                    ? <span className="badge pass">Awarded</span>
                    : <span className="badge pending">Decision Pending</span>
                  }
                </div>
                <div className="agent-meta" style={{ marginTop: 6 }}>
                  From: {p.sourceChallenge} · Cycle {p.cycle}
                </div>
                <div style={{ marginTop: 10 }}>
                  {p.eligibleAgentIds.map((aid) => {
                    const a = agentMap.get(aid);
                    const chosen = decided?.winner === aid;
                    const bonusLines = item
                      ? Object.entries(item.statBonuses).map(([attrId, bonus]) => {
                          const attr = arc.attributes.find((at) => at.id === attrId);
                          const current = a?.attributes[attrId] ?? 0;
                          return { name: attr?.name ?? attrId, current, bonus };
                        })
                      : [];
                    const roleName = a?.role ? arc.roles.find((r) => r.id === a.role)?.name : null;
                    return (
                      <div
                        key={aid}
                        className={`loot-candidate${chosen ? " chosen" : ""}`}
                        onClick={() => award(p, aid)}
                      >
                        <div className="row between">
                          <div>
                            <div className="agent-name" style={{ fontSize: 13 }}>{a?.name ?? aid}</div>
                            <div className="agent-meta">
                              {roleName ?? "Flex"} · M{a?.morale ?? 0} S{a?.stress ?? 0}
                            </div>
                          </div>
                          {chosen && <span className="badge pass">Awarded</span>}
                        </div>
                        {bonusLines.length > 0 && (
                          <div className="loot-stats">
                            {bonusLines.map((b) => (
                              <span key={b.name} className="loot-stat-chip">
                                {b.name} {b.current} → <strong>{b.current + b.bonus}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ── Run reports ── */}
      {reports.map((r, i) => {
        const challenge = arc.challenges.find((c) => c.id === r.challengeId);
        if (!challenge) return null;

        const headline = generateHeadline(r, arc, agentMap);
        const passedCount = r.assignedAgents[0]?.mechanicResults.filter((m) => m.passed).length ?? 0;
        const totalChecks = challenge.mechanicChecks.length;
        const totalStress = r.assignedAgents.reduce((s, a) => s + a.stressGained, 0);
        const heroicAgent = r.assignedAgents.find((ar) => ar.isHeroic);
        const clutchAgent = headline.clutchAgent;
        const collapseAgent = headline.collapseAgent;

        const summaryClass = `report-summary outcome-${r.outcome}`;

        return (
          <div key={i} style={{
            marginBottom: 32,
            borderLeft: r.outcome === "success" ? "3px solid var(--positive)" : r.outcome === "failure" ? "3px solid var(--accent)" : "3px solid var(--rule-dk)",
            paddingLeft: 14,
          }}>
            {/* ── Situation room summary ── */}
            <div className={summaryClass}>
              {buildSummary(r, challenge, agentMap)}
            </div>

            {/* ── Kicker ── */}
            <div className="report-meta">
              Field Report / No. {String(org.cycle).padStart(2, "0")} · {arc.meta.domain} · Tier I
            </div>

            {/* ── Display headline ── */}
            <div className="report-headline">
              {headline.challenge}{" "}
              {headline.qualifier && (
                <span className="accent">{headline.qualifier} </span>
              )}
              {headline.primary}
            </div>

            {/* ── Sub-kicker ── */}
            <div className="agent-meta" style={{ marginBottom: 14 }}>
              Cycle {r.cycle} · Composition: {r.assignedAgents.length} agents · 1 lockout spent · {r.outcome.toUpperCase()}
            </div>

            {/* ── Abstract ── */}
            <div className="abstract">
              <span className="abstract-label">Abstract</span>
              <p>{buildAbstract(r, headline, agentMap, challenge.mechanicChecks.length)}</p>
            </div>

            {/* ── Stat strip ── */}
            <div className="stat-strip" style={{ margin: "14px 0" }}>
              <div className="stat-cell">
                <div className="stat-lbl">Outcome</div>
                <div className={`stat-val${r.outcome === "failure" ? " accent" : r.outcome === "partial" ? " accent" : ""}`} style={r.outcome === "success" ? { color: "var(--positive)" } : {}}>
                  {r.outcome.toUpperCase()}
                </div>
              </div>
              <div className="stat-cell">
                <div className="stat-lbl">Checks</div>
                <div className="stat-val">{passedCount}/{totalChecks}</div>
                <div className="stat-sub">{totalChecks - passedCount > 0 ? `${totalChecks - passedCount} failed` : "all passed"}</div>
              </div>
              <div className="stat-cell">
                <div className="stat-lbl">Stress Δ</div>
                <div className={`stat-val${totalStress > 0 ? " accent" : ""}`}>
                  {totalStress > 0 ? `+${totalStress}` : "0"}
                </div>
                <div className="stat-sub">across roster</div>
              </div>
              <div className="stat-cell">
                <div className="stat-lbl">Loot</div>
                <div className="stat-val">{r.lootDrops.length}</div>
                <div className="stat-sub">
                  {r.lootDrops.length > 0 ? `${pendingRewardChoices.length} pending` : "no drops"}
                </div>
              </div>
              <div className="stat-cell">
                <div className="stat-lbl">{arc.currencyName}</div>
                <div className="stat-val" style={(r.rewardsGranted?.currency ?? 0) > 0 ? { color: "var(--positive)" } : {}}>
                  {(r.rewardsGranted?.currency ?? 0) > 0 ? `+${r.rewardsGranted!.currency}` : "0"}
                </div>
                <div className="stat-sub">
                  {(r.rewardsGranted?.reputation ?? 0) > 0 ? `+${r.rewardsGranted!.reputation} rep` : "no rep"}
                </div>
              </div>
            </div>

            {/* ── Resolve callout (distinct event, not buried in narrative) ── */}
            {heroicAgent && headline.resolveAgent && (
              <div className="callout resolve" style={{ marginBottom: 14 }}>
                <p>
                  <span className="highlight">{headline.resolveAgent.split(" ")[0]}</span> hit their stress ceiling and rolled{" "}
                  <span className="highlight">Resolve</span>. +3 to every check for two cycles.{" "}
                  The team felt it.
                </p>
              </div>
            )}

            {/* ── Clutch callout ── */}
            {clutchAgent && !heroicAgent && r.outcome !== "failure" && (
              <div className="callout" style={{ marginBottom: 14 }}>
                <p>
                  <span className="highlight">{clutchAgent.split(" ")[0]}</span> pulled the party through.
                  The margin was not comfortable.
                </p>
              </div>
            )}

            {/* ── The Audit ── */}
            <div className="audit-section">The Audit · {totalChecks} Checks</div>
            {challenge.mechanicChecks.map((mech) => {
              // Find the representative result for this mechanic
              // For team_aggregate, use first agent's result (it's shared)
              const repResult = r.assignedAgents
                .flatMap((ar) => ar.mechanicResults.map((mr) => ({ ...mr, agentId: ar.agentId })))
                .find((mr) => mr.mechanicId === mech.id);

              if (!repResult) return null;

              const margin = repResult.score - repResult.threshold;
              const pct = Math.min(100, Math.max(0, (repResult.score / Math.max(repResult.threshold, 1)) * 100));
              const agentForMech = mech.scope === "role_specific" || mech.scope === "per_agent"
                ? agentMap.get(repResult.agentId)
                : null;
              const roleName = agentForMech
                ? arc.roles.find((ro) => ro.id === agentForMech.role)?.name ?? "Flex"
                : "Team aggregate";

              return (
                <div key={mech.id} className="mechanic-row">
                  <div className="row between">
                    <span className="mechanic-name">{mech.name}</span>
                    <span className={`badge ${repResult.passed ? "pass" : "fail"}`}>
                      {repResult.passed ? "PASS" : "FAIL"} · {margin >= 0 ? "+" : ""}{Math.round(margin)}
                    </span>
                  </div>
                  <div className="mechanic-detail">
                    {agentForMech ? agentForMech.name : roleName}
                    {agentForMech && r.assignedAgents.find((ar) => ar.agentId === agentForMech.id)?.isHeroic && (
                      <span className="badge pass" style={{ marginLeft: 6, fontSize: 8, padding: "1px 5px" }}>HEROIC</span>
                    )}
                    {agentForMech && (() => {
                      const ar = r.assignedAgents.find(a => a.agentId === agentForMech.id);
                      if (!ar) return null;
                      const allPassed = ar.mechanicResults.every(m => m.passed);
                      return (
                        <>
                          {ar.stressGained > 0 && (
                            <span className="tag-label delta-stress">{` +${ar.stressGained} STRESS`}</span>
                          )}
                          {ar.wasDowned && (
                            <span className="tag-label delta-downed">DOWNED</span>
                          )}
                          {allPassed && !ar.wasDowned && (
                            <span className="tag-label delta-clean">CLEAN</span>
                          )}
                        </>
                      );
                    })()}
                    {agentForMech ? ` · ${roleName}` : ""} · {Math.round(repResult.score)} vs threshold {repResult.threshold}
                  </div>
                  <div className={`bar mechanic${!repResult.passed ? " fail" : ""}`}>
                    <div className="fill" style={{ width: `${pct}%` }} />
                  </div>
                  {/* Per-agent narrative line */}
                  {agentForMech && (
                    <div style={{ fontFamily: "var(--serif)", fontSize: 13, color: "var(--muted)", marginTop: 4, fontStyle: "italic" }}>
                      {agentRunLine(agentForMech.name, roleName, r.assignedAgents.find(ar => ar.agentId === agentForMech.id)?.mechanicResults ?? [], arc, r.challengeId)}
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Loot drops ── */}
            {r.lootDrops.length > 0 && (
              <>
                <div className="audit-section" style={{ marginTop: 20 }}>Drops · {r.lootDrops.length}</div>
                {r.lootDrops.map((l) => {
                  const item = arc.items.find((it) => it.id === l.itemId);
                  const statLine = item
                    ? Object.entries(item.statBonuses)
                        .map(([attr, val]) => `+${val} ${attr.charAt(0).toUpperCase() + attr.slice(1)}`)
                        .join(" · ")
                    : "";
                  const decision = rewardDecisions.find((d) => d.itemId === l.itemId);
                  return (
                    <div key={l.itemId} className="card" style={{ marginTop: 6 }}>
                      <div className="row between">
                        <div>
                          <div className="agent-name" style={{ fontSize: 14 }}>{item?.name ?? l.itemId}</div>
                          {statLine && (
                            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.06em", marginTop: 2 }}>
                              {statLine}
                            </div>
                          )}
                        </div>
                        <span className={`badge ${decision ? "pass" : "pending"}`}>
                          {decision ? "AWARDED" : "DECISION PENDING"}
                        </span>
                      </div>
                      <div className="agent-meta" style={{ marginTop: 6 }}>
                        Eligible: {l.eligibleAgents.map((id) => agentMap.get(id)?.name ?? id).join(" · ")}
                      </div>
                      {item?.flavorText && (
                        <div style={{ fontFamily: "var(--serif)", fontSize: 13, color: "var(--dim)", marginTop: 6, fontStyle: "italic" }}>
                          "{item.flavorText}"
                        </div>
                      )}
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

function buildSummary(
  report: RunReport,
  challenge: import("../../engine/types.js").Challenge,
  agentMap: Map<string, import("../../engine/types.js").Agent>,
): string {
  const totalChecks = challenge.mechanicChecks.length;
  const passedCount = report.assignedAgents[0]?.mechanicResults.filter((m) => m.passed).length ?? 0;
  const totalStress = report.assignedAgents.reduce((s, a) => s + a.stressGained, 0);
  const downedAgents = report.assignedAgents.filter((a) => a.wasDowned);
  const highStressAgents = report.assignedAgents.filter((a) => {
    const agent = agentMap.get(a.agentId);
    return agent && agent.stress >= 7;
  });

  // 1. Outcome statement
  const outcomeLabel =
    report.outcome === "success" ? "Clean" :
    report.outcome === "partial" ? "Partial" :
    "Wipe";
  const outcome = `${challenge.name}: ${outcomeLabel}.`;

  // 2. Key delta
  let delta: string;
  if (report.outcome === "success" && passedCount === totalChecks) {
    if (report.lootDrops.length > 0) {
      delta = `Full clear — all ${totalChecks} checks passed. ${report.lootDrops.length} loot drop${report.lootDrops.length > 1 ? "s" : ""}.`;
    } else {
      delta = `Full clear — all ${totalChecks} checks passed.${totalStress > 0 ? ` Total stress accrued: +${totalStress}.` : " Zero stress."}`;
    }
  } else if (report.outcome === "partial") {
    const failedCount = totalChecks - passedCount;
    const stressPart = totalStress > 0 ? ` +${totalStress} stress across roster.` : "";
    delta = `${passedCount} of ${totalChecks} checks passed; ${failedCount} failed.${stressPart}`;
  } else {
    const stressPart = totalStress > 0 ? ` +${totalStress} stress distributed.` : "";
    const downPart = downedAgents.length > 0
      ? ` ${downedAgents.map((a) => agentMap.get(a.agentId)?.name?.split(" ")[0] ?? a.agentId).join(", ")} downed.`
      : "";
    delta = `${passedCount} of ${totalChecks} checks met.${stressPart}${downPart}`;
  }

  // 3. Action cue
  let action: string;
  if (report.outcome === "success" && report.lootDrops.length > 0) {
    action = "Award the drop below.";
  } else if (report.outcome === "success") {
    action = highStressAgents.length > 0
      ? `Consider resting ${highStressAgents.map((a) => agentMap.get(a.agentId)?.name?.split(" ")[0] ?? a.agentId).join(", ")} before next deployment.`
      : "Team is ready to advance.";
  } else if (report.outcome === "partial") {
    action = highStressAgents.length > 0
      ? `Consider resting high-stress agents before retry.`
      : `Re-evaluate roster composition before retry.`;
  } else {
    action = downedAgents.length > 0
      ? `Downed agents are unavailable next cycle. Re-evaluate roster for retry.`
      : `Re-evaluate roster for retry.`;
  }

  return `${outcome} ${delta} ${action}`;
}

function buildAbstract(
  report: RunReport,
  headline: ReturnType<typeof generateHeadline>,
  agentMap: Map<string, import("../../engine/types.js").Agent>,
  totalChecks: number,
): string {
  const passedCount = report.assignedAgents[0]?.mechanicResults.filter((m) => m.passed).length ?? 0;
  const failedCount = totalChecks - passedCount;
  const totalStress = report.assignedAgents.reduce((s, a) => s + a.stressGained, 0);

  const parts: string[] = [];
  parts.push("The contract was completed.");

  if (report.outcome === "failure") {
    parts[0] = "The contract failed.";
  } else if (report.outcome === "partial") {
    parts[0] = "The contract was completed.";
  }

  if (failedCount > 0) {
    parts.push(`${failedCount === 1 ? "One" : `${failedCount} of ${totalChecks}`} mechanic ${failedCount === 1 ? "check" : "checks"} failed${headline.clutchAgent ? `; one was carried by ${headline.clutchAgent.split(" ")[0]}'s clutch resolve` : ""}.`);
  } else {
    parts.push("All checks passed.");
  }

  if (headline.collapseAgent) {
    parts.push(`The cost is in ${headline.collapseAgent.split(" ")[0]}.`);
  } else if (totalStress > 6) {
    parts.push("The stress toll was significant.");
  } else if (totalStress === 0 && report.outcome === "success") {
    parts.push("The team came home clean.");
  } else {
    parts.push("The team came home.");
  }

  return parts.join(" ");
}
