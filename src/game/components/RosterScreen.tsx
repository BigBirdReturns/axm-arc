import { useState } from "react";
import type { Agent, Arc } from "../../engine/types.js";
import {
  agentInitials,
  formatMorale,
  formatStress,
  isTraitVisible,
  hiddenAttrVisibleCount,
  visibleAttrs,
  nextRevealHint,
  tierBadgeColor,
} from "../lib/ui-helpers.js";

interface Props {
  agents: Agent[];
  arc: Arc;
}

export function RosterScreen({ agents, arc }: Props): JSX.Element {
  const [selected, setSelected] = useState<Agent | null>(null);

  return (
    <div className="screen">
      <h2>Roster ({agents.length})</h2>
      {agents.length === 0 && <div className="empty">No agents. Recruit from the Base screen.</div>}
      {agents.map((a) => (
        <AgentCard key={a.id} agent={a} arc={arc} onClick={() => setSelected(a)} />
      ))}
      {selected && <AgentDetail agent={selected} arc={arc} onClose={() => setSelected(null)} />}
    </div>
  );
}

function AgentCard({ agent, arc, onClick }: { agent: Agent; arc: Arc; onClick: () => void }): JSX.Element {
  const tier = arc.tiers.find((t) => t.id === agent.tier);
  const role = arc.roles.find((r) => r.id === agent.role);
  return (
    <div className="card clickable" onClick={onClick}>
      <div className="row">
        <div className="portrait">{agentInitials(agent.name)}</div>
        <div style={{ flex: 1 }}>
          <div className="row between">
            <strong>{agent.name}</strong>
            <span className="badge" style={{ background: tierBadgeColor(agent.tier) }}>
              {tier?.name ?? agent.tier}
            </span>
          </div>
          <div className="dim">{role?.name ?? "Flex"}</div>
        </div>
      </div>
      <div className="row between" style={{ marginTop: 8 }}>
        <div style={{ flex: 1 }}>
          <div className="tiny">Morale: {formatMorale(agent.morale)} ({agent.morale})</div>
          <div className="bar morale"><div className="fill" style={{ width: `${agent.morale}%` }} /></div>
        </div>
        <div style={{ width: 12 }} />
        <div style={{ flex: 1 }}>
          <div className="tiny">Stress: {formatStress(agent.stress)} ({agent.stress}/10)</div>
          <div className="bar stress"><div className="fill" style={{ width: `${agent.stress * 10}%` }} /></div>
        </div>
      </div>
      {agent.afflictionState.kind !== "none" && (
        <div className="warning" style={{ marginTop: 6 }}>Afflicted: {agent.afflictionState.kind}</div>
      )}
      {agent.downedUntilCycle !== null && (
        <div className="warning" style={{ marginTop: 6 }}>Downed until cycle {agent.downedUntilCycle}</div>
      )}
    </div>
  );
}

function AgentDetail({ agent, arc, onClose }: { agent: Agent; arc: Arc; onClose: () => void }): JSX.Element {
  const attrs = visibleAttrs(agent, arc);
  const hiddenShown = hiddenAttrVisibleCount(agent);
  const hidden: Array<[string, number]> = [
    ["Loyalty", agent.hiddenAttributes.loyalty],
    ["Ambition", agent.hiddenAttributes.ambition],
    ["Volatility", agent.hiddenAttributes.volatility],
    ["Leadership", agent.hiddenAttributes.leadership],
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h3>{agent.name}</h3>
          <button className="icon" onClick={onClose}>Close</button>
        </div>
        <div className="dim">{nextRevealHint(agent)}</div>

        <h4 style={{ marginTop: 16, marginBottom: 4 }}>Attributes</h4>
        <div className="attr-grid">
          {attrs.map((a) => (
            <div key={a.name} className="attr"><span>{a.name}</span><span className="v">{a.value}</span></div>
          ))}
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 4 }}>Hidden Traits</h4>
        <div className="attr-grid">
          {hidden.map(([name, val], i) => (
            <div key={name} className="attr">
              <span>{name}</span>
              <span className="v">{i < hiddenShown ? val : "?"}</span>
            </div>
          ))}
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 4 }}>Personality Traits</h4>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          {agent.traits.map((t, i) => (
            <li key={i}>{isTraitVisible(agent, i) ? t : <span className="dim">(undiscovered)</span>}</li>
          ))}
        </ul>

        <h4 style={{ marginTop: 16, marginBottom: 4 }}>Recent Assignments</h4>
        {agent.assignmentHistory.length === 0 ? (
          <div className="dim">No assignments yet.</div>
        ) : (
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {agent.assignmentHistory.slice(-5).reverse().map((h, i) => (
              <li key={i} className="tiny">
                Cycle {h.cycle}: {h.challengeId} — {h.outcome}
              </li>
            ))}
          </ul>
        )}

        <h4 style={{ marginTop: 16, marginBottom: 4 }}>Equipment</h4>
        {Object.keys(agent.equippedItems).length === 0 ? (
          <div className="dim">Unequipped.</div>
        ) : (
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {Object.entries(agent.equippedItems).map(([slot, itemId]) => {
              const item = arc.items.find((it) => it.id === itemId);
              return <li key={slot} className="tiny">{slot}: {item?.name ?? itemId}</li>;
            })}
          </ul>
        )}

        <div className="tiny" style={{ marginTop: 12 }}>
          Tier {agent.tier} · Upkeep {agent.upkeep}/cycle · Base efficiency {agent.baseEfficiency.toFixed(1)}
        </div>
      </div>
    </div>
  );
}
