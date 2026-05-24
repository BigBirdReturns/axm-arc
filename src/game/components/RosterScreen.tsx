import { useState } from "react";
import type { Agent, Arc } from "../../engine/types.js";
import {
  agentInitials,
  visibleAttrs,
  isTraitVisible,
  hiddenAttrVisibleCount,
  nextRevealHint,
} from "../lib/ui-helpers.js";

interface Props {
  agents: Agent[];
  arc: Arc;
}

export function RosterScreen({ agents, arc }: Props): JSX.Element {
  const [selected, setSelected] = useState<Agent | null>(null);

  return (
    <div className="screen">
      <h2>Personnel <span className="count">{agents.length} Active</span></h2>
      {agents.length === 0 && <div className="empty">No agents. Recruit from the Base screen.</div>}
      {agents.map((a) => (
        <AgentRow key={a.id} agent={a} arc={arc} onClick={() => setSelected(a)} />
      ))}
      {selected && <AgentDetail agent={selected} arc={arc} onClose={() => setSelected(null)} />}
    </div>
  );
}

function AgentRow({ agent, arc, onClick }: { agent: Agent; arc: Arc; onClick: () => void }): JSX.Element {
  const tier = arc.tiers.find((t) => t.id === agent.tier);
  const role = arc.roles.find((r) => r.id === agent.role);
  const nearThreshold = agent.stress >= 8 && agent.afflictionState.kind === "none";

  return (
    <div className={`card clickable${nearThreshold ? " danger" : ""}`} onClick={onClick}>
      <div className="row">
        <div className={`portrait${nearThreshold ? " accent" : ""}`}>
          {agentInitials(agent.name)}
        </div>
        <div style={{ flex: 1 }}>
          <div className="row between">
            <span className="agent-name">{agent.name}</span>
            <span className="agent-number">N° {String(agent.id.charCodeAt(0) % 100).padStart(2, "0")}</span>
          </div>
          <div className="agent-meta">
            {role?.name ?? "Flex"} · {tier?.name ?? agent.tier}
            {agent.traits.filter((_, i) => isTraitVisible(agent, i)).map((t) => ` · ${t}`)}
          </div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 8, gap: 16 }}>
        <div className="bar-wrap">
          <div className="bar-label">
            <span>Morale</span>
            <span>{agent.morale}</span>
          </div>
          <div className="bar morale"><div className="fill" style={{ width: `${agent.morale}%` }} /></div>
        </div>
        <div className="bar-wrap">
          <div className="bar-label">
            <span>Stress</span>
            <span>{agent.stress}/10</span>
          </div>
          <div className="bar stress"><div className="fill" style={{ width: `${agent.stress * 10}%` }} /></div>
        </div>
      </div>
      {agent.afflictionState.kind !== "none" && (
        <div className="warning" style={{ marginTop: 6 }}>Afflicted: {agent.afflictionState.kind}</div>
      )}
      {nearThreshold && (
        <div className="warning" style={{ marginTop: 6 }}>Stress threshold near</div>
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
        <div className="agent-meta" style={{ marginBottom: 12 }}>{nextRevealHint(agent)}</div>

        <div className="audit-section">Attributes</div>
        <div className="attr-grid">
          {attrs.map((a) => (
            <div key={a.name} className="attr"><span>{a.name}</span><span className="v">{a.value}</span></div>
          ))}
        </div>

        <div className="audit-section">Hidden Attributes</div>
        <div className="attr-grid">
          {hidden.map(([name, val], i) => (
            <div key={name} className="attr">
              <span>{name}</span>
              <span className="v">{i < hiddenShown ? val : "?"}</span>
            </div>
          ))}
        </div>

        <div className="audit-section">Traits</div>
        <ul style={{ paddingLeft: 20, margin: "8px 0", fontFamily: "var(--serif)", fontSize: 14, color: "var(--ink-2)" }}>
          {agent.traits.map((t, i) => (
            <li key={i}>{isTraitVisible(agent, i) ? t : <span style={{ color: "var(--dim)" }}>(undiscovered)</span>}</li>
          ))}
        </ul>

        <div className="audit-section">Equipment</div>
        {Object.keys(agent.equippedItems).length === 0 ? (
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--dim)", padding: "8px 0" }}>Unequipped.</div>
        ) : (
          <div className="attr-grid">
            {Object.entries(agent.equippedItems).map(([slot, itemId]) => {
              const item = arc.items.find((it) => it.id === itemId);
              return <div key={slot} className="attr"><span>{slot}</span><span className="v">{item?.name ?? itemId}</span></div>;
            })}
          </div>
        )}

        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim)", marginTop: 16, borderTop: "1px solid var(--rule)", paddingTop: 8 }}>
          Tier {agent.tier} · Upkeep {agent.upkeep}/cycle · Base eff. {agent.baseEfficiency.toFixed(1)}
        </div>
      </div>
    </div>
  );
}
