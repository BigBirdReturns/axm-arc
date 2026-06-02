import { useState } from "react";
import type { Agent, Arc } from "../../engine/types.js";
import {
  agentInitials,
  visibleAttrs,
  isTraitVisible,
  hiddenAttrVisibleCount,
  nextRevealHint,
} from "../lib/ui-helpers.js";
import { ThresholdBar } from "./ThresholdBar.js";

// ── Bark library ──────────────────────────────────────────────────────────────

const BARKS_THRESHOLD = [
  "I can do one more. Maybe.",
  "Don't put me next to them again.",
  "The numbers are fine. I'm fine.",
];

const BARKS_AFFLICTED = [
  "I'm done volunteering.",
  "Ask someone who still cares.",
  "You already know what I think.",
];

const BARKS_HIGH_MORALE = [
  "Put me in. Any contract.",
  "We're better than what we've been running.",
  "This is what it's supposed to feel like.",
];

const BARKS_LOW_MORALE = [
  "Whatever you decide.",
  "I'll be on the bench if you need me.",
  "Starting to wonder what the point is.",
];

function pickBark(agent: Agent): string | null {
  const idx = agent.id.charCodeAt(0) % 3;
  const isAfflicted = agent.afflictionState.kind !== "none";
  const nearThreshold = agent.stress >= 8 && !isAfflicted;

  if (isAfflicted) return BARKS_AFFLICTED[idx]!;
  if (nearThreshold) return BARKS_THRESHOLD[idx]!;
  if (agent.morale < 30) return BARKS_LOW_MORALE[idx]!;
  if (agent.morale > 75) return BARKS_HIGH_MORALE[idx]!;
  return null;
}

// ── Portrait state helpers ────────────────────────────────────────────────────

function portraitStateClass(agent: Agent): string {
  const isAfflicted = agent.afflictionState.kind !== "none";
  if (isAfflicted) return "portrait-afflicted";
  if (agent.stress >= 8) return "portrait-danger";
  if (agent.stress >= 6) return "portrait-warn";
  return "";
}

function portraitGlyph(agent: Agent): { glyph: string; kind: string } | null {
  const isAfflicted = agent.afflictionState.kind !== "none";
  if (isAfflicted) return { glyph: "×", kind: "glyph-afflicted" };
  if (agent.stress >= 8) return { glyph: "!", kind: "glyph-threshold" };
  if (agent.afflictionState.kind === "none" && agent.morale > 80)
    return { glyph: "↑", kind: "glyph-resolve" };
  return null;
}

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
  const stateClass = portraitStateClass(agent);
  const glyphInfo = portraitGlyph(agent);
  const bark = pickBark(agent);

  return (
    <div className={`card clickable${nearThreshold ? " danger" : ""}`} onClick={onClick}>
      <div className="row">
        <div className={`portrait ${stateClass}`}>
          {agentInitials(agent.name)}
          {glyphInfo && <span className={`corner-glyph ${glyphInfo.kind}`}>{glyphInfo.glyph}</span>}
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
          <ThresholdBar value={agent.morale} max={100} kind="morale" threshold={30} direction="below" />
        </div>
        <div className="bar-wrap">
          <div className="bar-label">
            <span>Stress</span>
            <span>{agent.stress}/10</span>
          </div>
          <ThresholdBar value={agent.stress} max={10} kind="stress" threshold={7} direction="above" />
        </div>
      </div>
      {agent.afflictionState.kind !== "none" && (
        <div className="warning" style={{ marginTop: 6 }}>Afflicted: {agent.afflictionState.kind}</div>
      )}
      {nearThreshold && (
        <div className="warning" style={{ marginTop: 6 }}>Stress threshold near</div>
      )}
      {bark && <div className="bark">{bark}</div>}
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
