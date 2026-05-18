import { useState } from "react";
import type { Agent, Arc, Challenge, Organization } from "../../engine/types.js";
import type { ChallengeAssignment } from "../../engine/cycle.js";
import { agentInitials, tierBadgeColor } from "../lib/ui-helpers.js";

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
  // Determine which progression tiers are unlocked
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

export function AssignScreen({ arc, org, assignments, setAssignments }: Props): JSX.Element {
  const [picking, setPicking] = useState<Challenge | null>(null);
  const challenges = unlockedChallenges(arc, org);
  const tokensUsed = assignments.reduce((s, a) => s + a.tokensSpent, 0);
  const tokensLeft = org.resources.tokens - tokensUsed;

  return (
    <div className="screen">
      <h2>Assign Contracts</h2>
      <div className="card row between">
        <strong>{arc.tokenName}: {tokensLeft} / {org.resources.tokens}</strong>
        <span className="dim">{assignments.length} queued</span>
      </div>

      {assignments.length > 0 && (
        <>
          <h3 style={{ fontSize: 15, color: "var(--accent)", marginTop: 16 }}>Queued</h3>
          {assignments.map((a, i) => {
            const c = arc.challenges.find((cc) => cc.id === a.challengeId);
            return (
              <div key={i} className="card">
                <div className="row between">
                  <strong>{c?.name ?? a.challengeId}</strong>
                  <button className="icon" onClick={() => setAssignments(assignments.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </div>
                <div className="tiny">{a.agentIds.length} agents · {a.tokensSpent} tokens</div>
              </div>
            );
          })}
        </>
      )}

      <h3 style={{ fontSize: 15, color: "var(--accent)", marginTop: 16 }}>Available</h3>
      {challenges.length === 0 && <div className="empty">Nothing unlocked yet.</div>}
      {challenges.map((c) => {
        const alreadyQueued = assignments.some((a) => a.challengeId === c.id);
        return (
          <div key={c.id} className={alreadyQueued ? "card" : "card clickable"} onClick={() => !alreadyQueued && setPicking(c)}>
            <div className="row between">
              <strong>{c.name}</strong>
              <span className="badge" style={{ background: "var(--accent-dim)" }}>Diff {c.difficultyRating}</span>
            </div>
            <div className="dim" style={{ marginTop: 4 }}>{c.description}</div>
            <div className="tiny" style={{ marginTop: 6 }}>
              {c.rosterRequirements.minAgents}-{c.rosterRequirements.maxAgents} agents
              {c.rosterRequirements.roleRequirements.length > 0 && " · "}
              {c.rosterRequirements.roleRequirements.map((r) => `${r.count}× ${r.roleId}`).join(", ")}
              {alreadyQueued && " · Queued"}
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
        <div className="dim">Pick {min}-{max} agents · {selected.size} selected</div>
        <div style={{ marginTop: 12 }}>
          {available.map((a) => {
            const role = arc.roles.find((r) => r.id === a.role)?.name ?? "Flex";
            return (
              <label key={a.id} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selected.has(a.id)}
                  onChange={() => toggle(a.id)}
                />
                <div className="portrait" style={{ width: 28, height: 28, fontSize: 12 }}>
                  {agentInitials(a.name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div>{a.name}</div>
                  <div className="tiny">
                    <span className="badge" style={{ background: tierBadgeColor(a.tier) }}>{a.tier}</span>
                    {" "}{role} · M{a.morale} S{a.stress}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
        <div style={{ marginTop: 16 }}>
          {!reqsMet && <div className="warning">Role requirements not met.</div>}
          <button
            className="primary"
            disabled={selected.size < min || selected.size > max || !reqsMet}
            onClick={() => onSubmit(Array.from(selected), 1)}
          >
            Confirm ({selected.size} agents, 1 token)
          </button>
        </div>
      </div>
    </div>
  );
}
