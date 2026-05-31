import { useState } from "react";
import type {
  Agent,
  Arc,
  Challenge,
  Organization,
} from "../../engine/types.js";
import type { ChallengeAssignment } from "../../engine/cycle.js";
import {
  projectMechanics,
  type MechanicProjection,
} from "../../engine/projections.js";
import { agentInitials } from "../lib/ui-helpers.js";

interface Props {
  arc: Arc;
  org: Organization;
  assignments: ChallengeAssignment[];
  setAssignments: (a: ChallengeAssignment[]) => void;
}

function unlockedChallenges(arc: Arc, org: Organization): Challenge[] {
  const cleared = new Set<string>();
  for (const a of Object.values(org.agents)) {
    for (const r of a.assignmentHistory) {
      if (r.outcome === "success") cleared.add(`${r.challengeId}-cleared`);
    }
  }
  const unlockedTiers = new Set<string>();
  for (const pt of arc.progressionTiers) {
    const milestonesMet = pt.unlockConditions.orgMilestones.every((m) =>
      cleared.has(m),
    );
    const repMet =
      (pt.unlockConditions.reputationMinimum ?? 0) <= org.reputation;
    if (milestonesMet && repMet) unlockedTiers.add(pt.id);
  }
  const challengeIds = new Set<string>();
  for (const pt of arc.progressionTiers) {
    if (unlockedTiers.has(pt.id))
      for (const c of pt.challenges) challengeIds.add(c);
  }
  return arc.challenges.filter((c) => challengeIds.has(c.id));
}

interface RosterPlan {
  agentIds: string[];
  projections: MechanicProjection[];
  failCount: number;
  tightCount: number;
  passCount: number;
  totalMargin: number;
  averageStress: number;
}

function roleRequirementsMet(challenge: Challenge, agents: Agent[]): boolean {
  return challenge.rosterRequirements.roleRequirements.every(
    (req) => agents.filter((a) => a.role === req.roleId).length >= req.count,
  );
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [head, ...tail] = items;
  return [
    ...combinations(tail, size - 1).map((combo) => [head!, ...combo]),
    ...combinations(tail, size),
  ];
}

function gradePlan(
  projections: MechanicProjection[],
  agents: Agent[],
): Omit<RosterPlan, "agentIds" | "projections"> {
  const failCount = projections.filter((p) => p.assessment === "fail").length;
  const tightCount = projections.filter((p) => p.assessment === "tight").length;
  const passCount = projections.filter(
    (p) => p.assessment === "comfortable",
  ).length;
  const totalMargin = projections.reduce((sum, p) => sum + p.margin, 0);
  const averageStress =
    agents.length > 0
      ? agents.reduce((sum, a) => sum + a.stress, 0) / agents.length
      : 0;
  return { failCount, tightCount, passCount, totalMargin, averageStress };
}

function findBestRosterPlan(
  challenge: Challenge,
  available: Agent[],
  org: Organization,
  arc: Arc,
): RosterPlan | null {
  const min = challenge.rosterRequirements.minAgents;
  const max = Math.min(
    challenge.rosterRequirements.maxAgents,
    available.length,
  );
  let best: RosterPlan | null = null;

  for (let size = min; size <= max; size++) {
    for (const agents of combinations(available, size)) {
      if (!roleRequirementsMet(challenge, agents)) continue;
      const projections = projectMechanics({
        challenge,
        assignedAgents: agents,
        org,
        arc,
      });
      const grade = gradePlan(projections, agents);
      const plan: RosterPlan = {
        agentIds: agents.map((a) => a.id),
        projections,
        ...grade,
      };
      if (!best) {
        best = plan;
        continue;
      }
      const planRank = [
        plan.failCount,
        plan.tightCount,
        -plan.totalMargin,
        plan.averageStress,
        plan.agentIds.length,
      ];
      const bestRank = [
        best.failCount,
        best.tightCount,
        -best.totalMargin,
        best.averageStress,
        best.agentIds.length,
      ];
      if (
        planRank.some(
          (value, i) =>
            value < bestRank[i]! &&
            planRank.slice(0, i).every((v, j) => v === bestRank[j]),
        )
      ) {
        best = plan;
      }
    }
  }

  return best;
}

function summarizePlan(plan: RosterPlan | null): {
  badge: string;
  className: string;
  text: string;
} {
  if (!plan) {
    return {
      badge: "No legal team",
      className: "fail",
      text: "You do not currently have enough available agents for this contract's role and roster requirements.",
    };
  }
  if (plan.failCount > 0) {
    const worst = [...plan.projections].sort((a, b) => a.margin - b.margin)[0];
    return {
      badge: "Not ready",
      className: "fail",
      text: worst
        ? `Best roster still misses ${worst.mechanicName} by ${Math.abs(worst.margin)}. Build Training, gear ${worst.primaryAttributeName}, or recruit before forcing it.`
        : "Best roster still fails at least one check.",
    };
  }
  if (plan.tightCount > 0) {
    return {
      badge: "Risky clear",
      className: "pending",
      text: `${plan.tightCount} check${plan.tightCount === 1 ? "" : "s"} are close. You can run it, but stress/morale swings may matter after the report.`,
    };
  }
  return {
    badge: "Good plan",
    className: "pass",
    text: "Current roster clears every projected check comfortably. This is the safe pick.",
  };
}

function namesForPlan(plan: RosterPlan | null, available: Agent[]): string {
  if (!plan) return "—";
  return plan.agentIds
    .map((id) => available.find((a) => a.id === id)?.name.split(" ")[0] ?? id)
    .join(" · ");
}

function clearCount(org: Organization, challengeId: string): number {
  let count = 0;
  for (const a of Object.values(org.agents)) {
    for (const r of a.assignmentHistory) {
      if (r.challengeId === challengeId && r.outcome === "success") {
        count++;
        break;
      }
    }
  }
  return count;
}

export function AssignScreen({
  arc,
  org,
  assignments,
  setAssignments,
}: Props): JSX.Element {
  const [picking, setPicking] = useState<Challenge | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const challenges = unlockedChallenges(arc, org);
  const availableAgents = Object.values(org.agents).filter(
    (a) => a.downedUntilCycle === null,
  );
  const tokensUsed = assignments.reduce((s, a) => s + a.tokensSpent, 0);
  const tokensLeft = org.resources.tokens - tokensUsed;

  return (
    <div className="screen">
      <h2>
        Contracts{" "}
        <span className="count">Tier I · {challenges.length} available</span>
      </h2>

      {assignments.length === 0 && (
        <div className="guidance-callout">
          <strong>Core loop:</strong> pick a contract, read the projected
          checks, slot the recommended roster, then use gold on Base upgrades
          when the readout says you are not ready.
        </div>
      )}

      {assignments.length > 0 &&
        assignments.map((a, i) => {
          const c = arc.challenges.find((cc) => cc.id === a.challengeId);
          const agents = a.agentIds
            .map((id) => org.agents[id])
            .filter(Boolean) as Agent[];
          const projections = c
            ? projectMechanics({
                challenge: c,
                assignedAgents: agents,
                org,
                arc,
              })
            : [];
          const isFirstClear = c ? clearCount(org, c.id) === 0 : false;
          const isExpanded = expanded.has(i);
          const passCount = projections.filter(
            (p) => p.assessment === "comfortable",
          ).length;
          const tightCount = projections.filter(
            (p) => p.assessment === "tight",
          ).length;
          const failCount = projections.filter(
            (p) => p.assessment === "fail",
          ).length;
          const toggleExpanded = () => {
            const next = new Set(expanded);
            if (next.has(i)) next.delete(i);
            else next.add(i);
            setExpanded(next);
          };

          return (
            <div
              key={i}
              className={`card${isFirstClear ? " danger" : ""}`}
              style={{ padding: 0 }}
            >
              <div
                style={{
                  padding: "10px 14px",
                  background: isFirstClear ? "var(--ink)" : "var(--paper-dk)",
                  color: isFirstClear ? "var(--paper)" : "var(--ink)",
                }}
              >
                <div className="row between">
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: isFirstClear ? "var(--accent-lt)" : "var(--muted)",
                    }}
                  >
                    Contract {String(i + 1).padStart(2, "0")} ·{" "}
                    {isFirstClear ? "First Clear Push" : "Farm"}
                  </span>
                  <span
                    className="badge"
                    style={
                      isFirstClear
                        ? {
                            background: "var(--accent)",
                            color: "#fff",
                            border: 0,
                          }
                        : {}
                    }
                  >
                    Diff {c?.difficultyRating ?? "?"}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "var(--display)",
                    fontWeight: 800,
                    fontSize: 22,
                    textTransform: "uppercase",
                    letterSpacing: "-0.01em",
                    marginTop: 4,
                  }}
                >
                  {c?.name ?? a.challengeId}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    marginTop: 2,
                    color: isFirstClear
                      ? "rgba(240,235,224,0.6)"
                      : "var(--dim)",
                  }}
                >
                  {a.agentIds.length} / {c?.rosterRequirements.maxAgents ?? "?"}{" "}
                  assigned · {a.tokensSpent} lockout
                </div>
              </div>

              <div style={{ padding: 14 }}>
                <div
                  className="row"
                  style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}
                >
                  {agents.map((ag) => (
                    <div key={ag.id} style={{ textAlign: "center" }}>
                      <div className="portrait small">
                        {agentInitials(ag.name)}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 9,
                          color: "var(--muted)",
                          marginTop: 2,
                        }}
                      >
                        {ag.name.split(" ")[0]}
                      </div>
                    </div>
                  ))}
                </div>

                {projections.length > 0 && (
                  <>
                    <div
                      onClick={toggleExpanded}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 0",
                        borderBottom: "1px solid var(--rule)",
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--muted)",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ color: "var(--accent)" }}>
                        {isExpanded ? "▾" : "▸"}
                      </span>
                      <span>{projections.length} checks</span>
                      {!isExpanded && (
                        <>
                          {passCount > 0 && (
                            <span
                              className="badge pass"
                              style={{ fontSize: 8, padding: "1px 5px" }}
                            >
                              {passCount} pass
                            </span>
                          )}
                          {tightCount > 0 && (
                            <span
                              className="badge pending"
                              style={{ fontSize: 8, padding: "1px 5px" }}
                            >
                              {tightCount} tight
                            </span>
                          )}
                          {failCount > 0 && (
                            <span
                              className="badge fail"
                              style={{ fontSize: 8, padding: "1px 5px" }}
                            >
                              {failCount} fail
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {isExpanded && (
                      <>
                        <div className="audit-section">
                          Projected Mechanics · {projections.length} checks
                        </div>
                        {projections.map((p) => (
                          <ProjectionRow key={p.mechanicId} p={p} />
                        ))}
                      </>
                    )}
                  </>
                )}

                <button
                  className="icon"
                  style={{ width: "100%", marginTop: 8 }}
                  onClick={() =>
                    setAssignments(assignments.filter((_, j) => j !== i))
                  }
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}

      <h3 style={{ marginTop: 16 }}>Available</h3>
      {challenges.length === 0 && (
        <div className="empty">Nothing unlocked yet.</div>
      )}
      {challenges.map((c) => {
        const alreadyQueued = assignments.some((a) => a.challengeId === c.id);
        const isCleared = clearCount(org, c.id) > 0;
        const bestPlan = findBestRosterPlan(c, availableAgents, org, arc);
        const planSummary = summarizePlan(bestPlan);
        return (
          <div
            key={c.id}
            className={`card${alreadyQueued ? "" : " clickable"}`}
            onClick={() => !alreadyQueued && setPicking(c)}
          >
            <div className="row between">
              <span className="agent-name" style={{ fontSize: 14 }}>
                {c.name}
              </span>
              <span className="badge">
                {isCleared ? `Cleared` : `Diff ${c.difficultyRating}`}
              </span>
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 13,
                color: "var(--muted)",
                marginTop: 4,
              }}
            >
              {c.description}
            </div>
            <div className="agent-meta" style={{ marginTop: 6 }}>
              {c.rosterRequirements.minAgents}-{c.rosterRequirements.maxAgents}{" "}
              agents
              {c.rosterRequirements.roleRequirements.length > 0 && " · "}
              {c.rosterRequirements.roleRequirements
                .map((r) => {
                  const role = arc.roles.find((ro) => ro.id === r.roleId);
                  return `${r.count}× ${role?.name ?? r.roleId}`;
                })
                .join(", ")}
              {alreadyQueued && " · Queued"}
              {isCleared && !alreadyQueued && " · 0 lockout (farm)"}
            </div>
            <div className="contract-readiness">
              <span className={`badge ${planSummary.className}`}>
                {planSummary.badge}
              </span>
              <span>{planSummary.text}</span>
            </div>
            <div className="agent-meta" style={{ marginTop: 4 }}>
              Recommended: {namesForPlan(bestPlan, availableAgents)}
            </div>
          </div>
        );
      })}

      {picking && (
        <RosterPicker
          challenge={picking}
          org={org}
          arc={arc}
          onCancel={() => setPicking(null)}
          onSubmit={(agentIds, tokens) => {
            setAssignments([
              ...assignments,
              { challengeId: picking.id, agentIds, tokensSpent: tokens },
            ]);
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}

function ProjectionRow({ p }: { p: MechanicProjection }): JSX.Element {
  const pct = Math.min(
    100,
    Math.max(0, (p.projectedScore / Math.max(p.threshold, 1)) * 100),
  );
  return (
    <div className="mechanic-row" style={{ paddingTop: 6, paddingBottom: 6 }}>
      <div className="row between">
        <span className="mechanic-name" style={{ fontSize: 13 }}>
          {p.mechanicName}
        </span>
        <span
          className={`badge ${p.assessment === "fail" ? "fail" : p.assessment === "tight" ? "pending" : "pass"}`}
        >
          {p.assessment.toUpperCase()}
        </span>
      </div>
      <div className="mechanic-detail">
        Reads {p.attributeSummary} · {p.agentName ?? "Team"} ·{" "}
        {p.projectedScore} / {p.threshold}
      </div>
      <div className="mechanic-explainer">
        <strong>{p.primaryAttributeName}</strong>:{" "}
        {p.primaryAttributeDescription} {p.scopeHint}
      </div>
      <div className="mechanic-bar-row">
        <div
          className={`bar mechanic${p.assessment === "fail" ? " fail" : ""}`}
          style={{ flex: 1 }}
        >
          <div className="fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="projection-cause">{p.targetSummary}</div>
      <div
        className={`projection-hint${p.assessment === "fail" ? " fail" : ""}`}
      >
        {p.improvementHint}
      </div>
    </div>
  );
}

function RosterPicker({
  challenge,
  org,
  arc,
  onCancel,
  onSubmit,
}: {
  challenge: Challenge;
  org: Organization;
  arc: Arc;
  onCancel: () => void;
  onSubmit: (agentIds: string[], tokens: number) => void;
}): JSX.Element {
  const available: Agent[] = Object.values(org.agents).filter(
    (a) => a.downedUntilCycle === null,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const max = challenge.rosterRequirements.maxAgents;
  const min = challenge.rosterRequirements.minAgents;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < max) next.add(id);
    setSelected(next);
  };

  const autoFill = () => {
    const filled = new Set<string>();
    for (const req of challenge.rosterRequirements.roleRequirements) {
      const candidates = available
        .filter((a) => a.role === req.roleId && !filled.has(a.id))
        .sort((a, b) =>
          a.stress !== b.stress ? a.stress - b.stress : b.morale - a.morale,
        );
      for (let i = 0; i < req.count && i < candidates.length; i++) {
        filled.add(candidates[i]!.id);
      }
    }
    const rest = available
      .filter((a) => !filled.has(a.id))
      .sort((a, b) =>
        a.stress !== b.stress ? a.stress - b.stress : b.morale - a.morale,
      );
    for (const a of rest) {
      if (filled.size >= min) break;
      filled.add(a.id);
    }
    setSelected(filled);
  };

  const bestPlan = findBestRosterPlan(challenge, available, org, arc);
  const bestSummary = summarizePlan(bestPlan);
  const selectedAgents = available.filter((a) => selected.has(a.id));
  const projections =
    selectedAgents.length > 0
      ? projectMechanics({
          challenge,
          assignedAgents: selectedAgents,
          org,
          arc,
        })
      : [];

  const reqsMet = challenge.rosterRequirements.roleRequirements.every((req) => {
    const count = available.filter(
      (a) => selected.has(a.id) && a.role === req.roleId,
    ).length;
    return count >= req.count;
  });

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h3>{challenge.name}</h3>
          <button className="icon" onClick={onCancel}>
            Cancel
          </button>
        </div>
        <div className="row between" style={{ marginBottom: 12 }}>
          <div className="agent-meta">
            Pick {min}-{max} agents · {selected.size} selected
          </div>
          <button
            className="icon"
            onClick={autoFill}
            disabled={available.length < min}
          >
            Auto-fill
          </button>
        </div>
        <div className="recommendation-card">
          <div className="row between">
            <span className="audit-section" style={{ margin: 0 }}>
              Recommended roster
            </span>
            <span className={`badge ${bestSummary.className}`}>
              {bestSummary.badge}
            </span>
          </div>
          <div className="recommendation-body">{bestSummary.text}</div>
          <div className="agent-meta" style={{ marginTop: 6 }}>
            {namesForPlan(bestPlan, available)}
          </div>
          <button
            className="secondary"
            style={{ width: "100%", marginTop: 8 }}
            disabled={!bestPlan}
            onClick={() => setSelected(new Set(bestPlan?.agentIds ?? []))}
          >
            Use recommended roster
          </button>
        </div>
        {projections.length > 0 && (
          <div className="projection-preview">
            <div className="audit-section">Live Readout · before you slot</div>
            {projections.map((p) => (
              <ProjectionRow key={p.mechanicId} p={p} />
            ))}
          </div>
        )}
        {available.map((a) => {
          const role = arc.roles.find((r) => r.id === a.role)?.name ?? "Flex";
          const tierName =
            arc.tiers.find((t) => t.id === a.tier)?.name ?? a.tier;
          const stressClass =
            a.stress >= 8
              ? "portrait-danger"
              : a.stress >= 6
                ? "portrait-warn"
                : "";
          return (
            <label key={a.id} className="checkbox-row">
              <input
                type="checkbox"
                checked={selected.has(a.id)}
                onChange={() => toggle(a.id)}
              />
              <div
                className={`portrait small${stressClass ? ` ${stressClass}` : ""}`}
              >
                {agentInitials(a.name)}
              </div>
              <div style={{ flex: 1 }}>
                <div className="agent-name" style={{ fontSize: 13 }}>
                  {a.name}
                </div>
                <div className="agent-meta">
                  {role} · {tierName} · M{a.morale} S{a.stress}
                  {a.stress >= 8 && (
                    <span
                      className="badge fail"
                      style={{ marginLeft: 6, fontSize: 8, padding: "1px 5px" }}
                    >
                      STRESS
                    </span>
                  )}
                </div>
              </div>
            </label>
          );
        })}
        {!reqsMet && <div className="warning">Role requirements not met.</div>}
        <button
          className="primary accent"
          disabled={selected.size < min || selected.size > max || !reqsMet}
          onClick={() => onSubmit(Array.from(selected), 1)}
          style={{ marginTop: 8 }}
        >
          Slot Roster ({selected.size} agents, 1 lockout)
        </button>
      </div>
    </div>
  );
}
