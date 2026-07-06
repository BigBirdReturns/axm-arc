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
import { t, type MessageId } from "../../i18n/index.js";
import { useModalDialog } from "../../lib/use-modal-dialog.js";

// ── Bark library ──────────────────────────────────────────────────────────────
// App-authored flavor lines (chrome, not arc data) — catalogued as bark.* ids.

const BARKS_THRESHOLD: MessageId[] = ["bark.threshold0", "bark.threshold1", "bark.threshold2"];
const BARKS_AFFLICTED: MessageId[] = ["bark.afflicted0", "bark.afflicted1", "bark.afflicted2"];
const BARKS_HIGH_MORALE: MessageId[] = ["bark.high0", "bark.high1", "bark.high2"];
const BARKS_LOW_MORALE: MessageId[] = ["bark.low0", "bark.low1", "bark.low2"];

function pickBark(agent: Agent): string | null {
  const idx = agent.id.charCodeAt(0) % 3;
  const isAfflicted = agent.afflictionState.kind !== "none";
  const nearThreshold = agent.stress >= 8 && !isAfflicted;

  if (isAfflicted) return t(BARKS_AFFLICTED[idx]!);
  if (nearThreshold) return t(BARKS_THRESHOLD[idx]!);
  if (agent.morale < 30) return t(BARKS_LOW_MORALE[idx]!);
  if (agent.morale > 75) return t(BARKS_HIGH_MORALE[idx]!);
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
      <h2>{t("roster.personnel")} <span className="count">{t("roster.activeCount", { count: agents.length })}</span></h2>
      {agents.length === 0 && <div className="empty">{t("roster.empty")}</div>}
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
            <span className="agent-number">{t("roster.agentNo", { n: String(agent.id.charCodeAt(0) % 100).padStart(2, "0") })}</span>
          </div>
          <div className="agent-meta">
            {role?.name ?? t("common.flex")} · {tier?.name ?? agent.tier}
            {agent.traits.filter((_, i) => isTraitVisible(agent, i)).map((tr) => ` · ${tr}`)}
          </div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 8, gap: 16 }}>
        <div className="bar-wrap">
          <div className="bar-label">
            <span>{t("roster.morale")}</span>
            <span>{agent.morale}</span>
          </div>
          <ThresholdBar value={agent.morale} max={100} kind="morale" threshold={30} direction="below" />
        </div>
        <div className="bar-wrap">
          <div className="bar-label">
            <span>{t("roster.stress")}</span>
            <span>{agent.stress}/10</span>
          </div>
          <ThresholdBar value={agent.stress} max={10} kind="stress" threshold={7} direction="above" />
        </div>
      </div>
      {agent.afflictionState.kind !== "none" && (
        <div className="warning" style={{ marginTop: 6 }}>{t("roster.afflicted", { kind: agent.afflictionState.kind })}</div>
      )}
      {nearThreshold && (
        <div className="warning" style={{ marginTop: 6 }}>{t("roster.thresholdNear")}</div>
      )}
      {bark && <div className="bark">{bark}</div>}
    </div>
  );
}

function AgentDetail({ agent, arc, onClose }: { agent: Agent; arc: Arc; onClose: () => void }): JSX.Element {
  const dialogRef = useModalDialog(onClose);
  const attrs = visibleAttrs(agent, arc);
  const hiddenShown = hiddenAttrVisibleCount(agent);
  const hidden: Array<[string, number]> = [
    [t("roster.hiddenLoyalty"), agent.hiddenAttributes.loyalty],
    [t("roster.hiddenAmbition"), agent.hiddenAttributes.ambition],
    [t("roster.hiddenVolatility"), agent.hiddenAttributes.volatility],
    [t("roster.hiddenLeadership"), agent.hiddenAttributes.leadership],
  ];

  return (
    <dialog ref={dialogRef} className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h3>{agent.name}</h3>
          <button className="icon" onClick={onClose}>{t("common.close")}</button>
        </div>
        <div className="agent-meta" style={{ marginBottom: 12 }}>{nextRevealHint(agent)}</div>

        <div className="audit-section">{t("roster.attributes")}</div>
        <div className="attr-grid">
          {attrs.map((a) => (
            <div key={a.name} className="attr"><span>{a.name}</span><span className="v">{a.value}</span></div>
          ))}
        </div>

        <div className="audit-section">{t("roster.hiddenAttributes")}</div>
        <div className="attr-grid">
          {hidden.map(([name, val], i) => (
            <div key={name} className="attr">
              <span>{name}</span>
              <span className="v">{i < hiddenShown ? val : "?"}</span>
            </div>
          ))}
        </div>

        <div className="audit-section">{t("roster.traits")}</div>
        <ul style={{ paddingLeft: 20, margin: "8px 0", fontFamily: "var(--serif)", fontSize: 14, color: "var(--ink-2)" }}>
          {agent.traits.map((tr, i) => (
            <li key={i}>{isTraitVisible(agent, i) ? tr : <span style={{ color: "var(--dim)" }}>{t("roster.undiscovered")}</span>}</li>
          ))}
        </ul>

        <div className="audit-section">{t("roster.equipment")}</div>
        {Object.keys(agent.equippedItems).length === 0 ? (
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--dim)", padding: "8px 0" }}>{t("roster.unequipped")}</div>
        ) : (
          <div className="attr-grid">
            {Object.entries(agent.equippedItems).map(([slot, itemId]) => {
              const item = arc.items.find((it) => it.id === itemId);
              return <div key={slot} className="attr"><span>{slot}</span><span className="v">{item?.name ?? itemId}</span></div>;
            })}
          </div>
        )}

        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim)", marginTop: 16, borderTop: "1px solid var(--rule)", paddingTop: 8 }}>
          {t("roster.footer", { tier: agent.tier, upkeep: agent.upkeep, eff: agent.baseEfficiency.toFixed(1) })}
        </div>
      </div>
    </dialog>
  );
}
