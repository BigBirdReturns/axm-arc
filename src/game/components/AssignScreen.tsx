import { useState } from "react";
import type { Agent, Arc, Challenge, Organization } from "../../engine/types.js";
import type { ChallengeAssignment } from "../../engine/cycle.js";
import { projectMechanics, type MechanicProjection } from "../../engine/projections.js";
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
    const milestonesMet = pt.unlockConditions.orgMilestones.every((m) => cleared.has(m));
    const repMet = (pt.unlockConditions.reputationMinimum ?? 0) <= org.reputation;
    if (milestonesMet && repMet) unlockedTiers.add(pt.id);
  }
  const challengeIds = new Set<string>();
  for (const pt of arc.progressionTiers) {
    if (unlockedTiers.has(pt.id)) for (const c of pt.challenges) challengeIds.add(c);
  }
  return arc.challenges.filter((c) => challengeIds.has(c.id));
}

function clearCount(org: Organization, challengeId: string): number {
  let count = 0;
  for (const a of Object.values(org.agents)) {
    for (const r of a.assignmentHistory) {
      if (r.challengeId === challengeId && r.outcome === "success") { count++; break; }
    }
  }
  return count;
}

export function AssignScreen({ arc, org, assignments, setAssignments }: Props): JSX.Element {
  const [picking, setPicking] = useState<Challenge | null>(null);
  const challenges = unlockedChallenges(arc, org);
  const tokensUsed = assignments.reduce((s, a) => s + a.tokensSpent, 0);
  const tokensLeft = org.resources.tokens - tokensUsed;

  return (
    <div className="screen">
      <h2>Contracts <span className="count">Tier I · {challenges.length} available</span></h2>

      {assignments.length === 0 && (
        <div className="guidance-callout">
          Pick a contract below, then choose agents to send. Each contract costs 1 lockout token.
        </div>
      )}

      {assignments.length > 0 && assignments.map((a, i) => {
        const c = arc.challenges.find((cc) => cc.id === a.challengeId);
        const agents = a.agentIds.map((id) => org.agents[id]).filter(Boolean) as Agent[];
        const projections = c ? projectMechanics({ challenge: c, assignedAgents: agents, org, arc }) : [];
        const isFirstClear = c ? clearCount(org, c.id) === 0 : false;

        return (
          <div key={i} className={`card${isFirstClear ? " danger" : ""}`} style={{ padding: 0 }}>
            <div style={{ padding: "10px 14px", background: isFirstClear ? "var(--ink)" : "var(--paper-dk)", color: isFirstClear ? "var(--paper)" : "var(--ink)" }}>
              <div className="row between">
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: isFirstClear ? "var(--accent-lt)" : "var(--muted)" }}>
                  Contract {String(i + 1).padStart(2, "0")} · {isFirstClear ? "First Clear Push" : "Farm"}
                </span>
                <span className="badge" style={isFirstClear ? { background: "var(--accent)", color: "#fff", border: 0 } : {}}>
                  Diff {c?.difficultyRating ?? "?"}
                </span>
              </div>
              <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 22, textTransform: "uppercase", letterSpacing: "-0.01em", marginTop: 4 }}>
                {c?.name ?? a.challengeId}
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, marginTop: 2, color: isFirstClear ? "rgba(240,235,224,0.6)" : "var(--dim)" }}>
                {a.agentIds.length} / {c?.rosterRequirements.maxAgents ?? "?"} assigned · {a.tokensSpent} lockout
              </div>
            </div>

            <div style={{ padding: 14 }}>
              <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {agents.map((ag) => (
                  <div key={ag.id} style={{ textAlign: "center" }}>
                    <div className="portrait small">{agentInitials(ag.name)}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)", marginTop: 2 }}>
                      {ag.name.split(" ")[0]}
                    </div>
                  </div>
                ))}
              </div>

              {projections.length > 0 && (
                <>
                  <div className="audit-section">Projected Mechanics · {projections.length} checks</div>
                  {projections.map((p) => (
                    <ProjectionRow key={p.mechanicId} p={p} />
                  ))}
                </>
              )}

              <button
                className="icon"
                style={{ width: "100%", marginTop: 8 }}
                onClick={() => setAssignments(assignments.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          </div>
        );
      })}

      <h3 style={{ marginTop: 16 }}>Available</h3>
      {challenges.length === 0 && <div className="empty">Nothing unlocked yet.</div>}
      {challenges.map((c) => {
        const alreadyQueued = assignments.some((a) => a.challengeId === c.id);
        const isCleared = clearCount(org, c.id) > 0;
        return (
          <div key={c.id} className={`card${alreadyQueued ? "" : " clickable"}`} onClick={() => !alreadyQueued && setPicking(c)}>
            <div className="row between">
              <span className="agent-name" style={{ fontSize: 14 }}>{c.name}</span>
              <span className="badge">{isCleared ? `Cleared` : `Diff ${c.difficultyRating}`}</span>
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{c.description}</div>
            <div className="agent-meta" style={{ marginTop: 6 }}>
              {c.rosterRequirements.minAgents}-{c.rosterRequirements.maxAgents} agents
              {c.rosterRequirements.roleRequirements.length > 0 && " · "}
              {c.rosterRequirements.roleRequirements.map((r) => `${r.count}× ${r.roleId}`).join(", ")}
              {alreadyQueued && " · Queued"}
              {isCleared && !alreadyQueued && " · 0 lockout (farm)"}
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
            setAssignments([...assignments, { challengeId: picking.id, agentIds, tokensSpent: tokens }]);
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}

function ProjectionRow({ p }: { p: MechanicProjection }): JSX.Element {
  const pct = Math.min(100, Math.max(0, (p.projectedScore / Math.max(p.threshold, 1)) * 100));
  return (
    <div className="mechanic-row" style={{ paddingTop: 6, paddingBottom: 6 }}>
      <div className="row between">
        <span className="mechanic-name" style={{ fontSize: 13 }}>{p.mechanicName}</span>
        <span className={`badge ${p.assessment === "fail" ? "fail" : p.assessment === "tight" ? "pending" : "pass"}`}>
          {p.assessment.toUpperCase()}
        </span>
      </div>
      <div className="mechanic-detail">
        {p.agentName ?? "Team"} · {p.projectedScore} / {p.threshold}
      </div>
      <div className="mechanic-bar-row">
        <div className={`bar mechanic${p.assessment === "fail" ? " fail" : ""}`} style={{ flex: 1 }}>
          <div className="fill" style={{ width: `${pct}%` }} />
        </div>
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
  const available: Agent[] = Object.values(org.agents).filter((a) => a.downedUntilCycle === null);
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
        .sort((a, b) => a.stress !== b.stress ? a.stress - b.stress : b.morale - a.morale);
      for (let i = 0; i < req.count && i < candidates.length; i++) {
        filled.add(candidates[i]!.id);
      }
    }
    const rest = available
      .filter((a) => !filled.has(a.id))
      .sort((a, b) => a.stress !== b.stress ? a.stress - b.stress : b.morale - a.morale);
    for (const a of rest) {
      if (filled.size >= min) break;
      filled.add(a.id);
    }
    setSelected(filled);
  };

  const reqsMet = challenge.rosterRequirements.roleRequirements.every((req) => {
    const count = available.filter((a) => selected.has(a.id) && a.role === req.roleId).length;
    return count >= req.count;
  });

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h3>{challenge.name}</h3>
          <button className="icon" onClick={onCancel}>Cancel</button>
        </div>
        <div className="row between" style={{ marginBottom: 12 }}>
          <div className="agent-meta">Pick {min}-{max} agents · {selected.size} selected</div>
          <button className="icon" onClick={autoFill} disabled={available.length < min}>Auto-fill</button>
        </div>
        {available.map((a) => {
          const role = arc.roles.find((r) => r.id === a.role)?.name ?? "Flex";
          const stressClass = a.stress >= 8 ? "portrait-danger" : a.stress >= 6 ? "portrait-warn" : "";
          return (
            <label key={a.id} className="checkbox-row">
              <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
              <div className={`portrait small${stressClass ? ` ${stressClass}` : ""}`}>{agentInitials(a.name)}</div>
              <div style={{ flex: 1 }}>
                <div className="agent-name" style={{ fontSize: 13 }}>{a.name}</div>
                <div className="agent-meta">
                  {role} · {a.tier} · M{a.morale} S{a.stress}
                  {a.stress >= 8 && <span className="badge fail" style={{ marginLeft: 6, fontSize: 8, padding: "1px 5px" }}>STRESS</span>}
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
