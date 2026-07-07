// Raid Night — a management-client play surface (arc is the text/management
// client; world is the embodied appliance — CARTRIDGE_LIFECYCLE §6). Same
// mechanical loop; this pass reuses ARC'S OWN existing UI vocabulary instead of
// inventing raid-only styling.
//
// PROVENANCE — reused from arc's management screens, not reinvented:
//   ThresholdBar (./ThresholdBar)        — morale/stress bars, as RosterScreen
//   .card / .sidebar-card                — panels/agent cards (RosterScreen)
//   .badge / .badge.role / .badge.tier   — role + state chips (AssignScreen/Roster)
//   .stat-strip/.stat-cell/.stat-val     — mono stat readouts
//   .recommendation-card/.recommendation-body — the fix cards (AssignScreen)
//   .projection-cause                    — the primary-cause line (AssignScreen)
//   .mechanic-row/.mechanic-name         — failed-check rows (AssignScreen)
//   .row/.row.between, .primary.accent/.secondary, arc CSS tokens (styles.css)
// Drill-hook classes (raid-fix/raid-cause/raid-delta/rn-*) are preserved as
// structural hooks only; all *look* now comes from the arc tokens + classes.

import { useState } from "react";
import { t, useLocale } from "../../i18n/index.js";
import { ThresholdBar } from "./ThresholdBar.js";
import {
  RAID_ARC_T2, newRaidNight, newRaidNightFrom, pull, applyFix, toggleFielded, partyLegal,
  nightConsequences, commitNightVictory, commitNightFailed,
  type RaidNightState,
} from "../lib/raid-night.js";
import { validateArc } from "../../engine/schema.js";
import severedMarch from "../../../cartridges/severed-march.arc.json";
import type { Agent, Arc } from "../../engine/types.js";
import type { Fix } from "../../sim/wipe-diagnosis.js";

interface Props { onBack: () => void; }

const CHECK_ATTRS = ["mitigation", "restoration", "output", "control"];
const INCOMPATIBLE: Arc = validateArc(severedMarch);

function bossOf(arc: Arc) {
  return arc.challenges.find((c) => c.id === "the-hollow-choir") ?? arc.challenges[arc.challenges.length - 1]!;
}

export function RaidNightScreen({ onBack }: Props): JSX.Element {
  useLocale();
  const [state, setState] = useState<RaidNightState>(() => newRaidNight(1));
  const [committed, setCommitted] = useState<import("../lib/ledger.js").CampaignLedger | null>(null);
  const boss = bossOf(state.arc);
  const roleName = (id: string | null) => state.arc.roles.find((r) => r.id === id)?.name ?? id ?? "—";
  const legal = partyLegal(state);

  const party = state.partyIds.map((id) => state.org.agents[id]).filter(Boolean) as Agent[];
  const bench = Object.values(state.org.agents)
    .filter((a) => !state.partyIds.includes(a.id))
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  const agentCard = (a: Agent, fielded: boolean) => (
    <button
      key={a.id}
      className={`card clickable rn-agent ${fielded ? "good" : ""}`}
      onClick={() => setState((s) => toggleFielded(s, a.id))}
      title={fielded ? t("raidnight.benchVerb") : t("raidnight.field")}
    >
      <div className="row between">
        <span className="agent-name">{a.name}</span>
        <span className="badge role">{roleName(a.role)}</span>
      </div>
      <div className="stat-strip">
        {CHECK_ATTRS.map((k) => (
          <div key={k} className="stat-cell">
            <span className="stat-lbl">{k.slice(0, 3)}</span>
            <span className="stat-val rn-num">{a.attributes[k] ?? 0}</span>
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 12, marginTop: 6 }}>
        <div className="bar-wrap">
          <div className="bar-label"><span>{t("raidnight.morale")}</span><span className="rn-num">{a.morale}</span></div>
          <ThresholdBar value={a.morale} max={100} kind="morale" threshold={30} direction="below" />
        </div>
        <div className="bar-wrap">
          <div className="bar-label"><span>{t("raidnight.stress")}</span><span className="rn-num">{a.stress}/10</span></div>
          <ThresholdBar value={a.stress} max={10} kind="stress" threshold={7} direction="above" />
        </div>
      </div>
    </button>
  );

  const rosterGroups = (agents: Agent[], fielded: boolean) =>
    state.arc.roles.map((role) => {
      const members = agents.filter((a) => a.role === role.id);
      if (members.length === 0) return null;
      return (
        <div key={role.id} className="rn-rolegroup">
          <div className="audit-section">{role.name} · {members.length}</div>
          <div className="rn-agents">{members.map((a) => agentCard(a, fielded))}</div>
        </div>
      );
    });

  const guildChip = state.ledger
    ? t("raidnight.guildCarried", { n: state.ledger.roster.length })
    : t("raidnight.freshGuild");

  return (
    <div className="screen raid-shell">
      {/* ── top runtime bar ── */}
      <header className="rn-topbar">
        <div className="rn-brand">
          <span className="rn-kicker">{t("raidnight.title")}</span>
          <span className="rn-boss">{boss.name}</span>
        </div>
        <div className="rn-chips">
          <span className="badge role rn-chip">{guildChip}</span>
          <span className="badge tier rn-chip">{t("raidnight.attempt", { n: state.pull })}</span>
          <span className={`badge rn-chip ${committed ? "pass" : "pending"}`}>
            {committed ? t("raidnight.committed") : t("raidnight.ledgerNone")}
          </span>
        </div>
      </header>

      {state.blocked ? (
        <div className="rn-body rn-body-single">
          <div className="card danger raid-blocked">
            <div className="audit-section rn-state-wipe">{t("raidnight.incompatible")}</div>
            <p>{state.blocked.message}</p>
            <ul className="raid-bottleneck">
              {state.blocked.dimensions.filter((d) => !d.match).map((d) => (
                <li key={d.dimension}>▸ <strong>{d.dimension}</strong>: <span className="rn-num">{d.ledgerValue.join(", ")}</span> ≠ <span className="rn-num">{d.cartridgeValue.join(", ")}</span></li>
              ))}
            </ul>
            <button className="primary accent" onClick={() => setState(newRaidNightFrom(state.arc, null, 1))}>
              {t("raidnight.startFresh")}
            </button>
          </div>
        </div>
      ) : (
        <div className="rn-body">
          {/* ── left: roster, grouped by role ── */}
          <aside className="rn-left sidebar">
            <div className="audit-section">{t("raidnight.raidParty")} · <span className="rn-num">{party.length}/10</span></div>
            {rosterGroups(party, true)}
            <div className="audit-section" style={{ marginTop: 16 }}>{t("raidnight.bench")} · <span className="rn-num">{bench.length}</span></div>
            {rosterGroups(bench, false)}
          </aside>

          {/* ── center: encounter ── */}
          <section className="rn-center situation-room">
            <div className="rn-encounter">
              <div className={`rn-state ${state.cleared ? "rn-state-clear" : state.diagnosis ? "rn-state-wipe" : "rn-state-ready"}`}>
                {state.cleared ? t("raidnight.cleared") : state.diagnosis ? t("raidnight.wipe") : t("raidnight.ready")}
              </div>
              <div className="rn-encounter-boss">{boss.name}</div>
              <div className="rn-encounter-sub">
                {state.cleared ? t("raidnight.clearedIn", { n: state.pull }) : t("raidnight.subtitle")}
              </div>
            </div>

            <div className="raid-actions">
              {!legal && <span className="warning">{t("raidnight.partyIllegal", {
                min: boss.rosterRequirements.minAgents, max: boss.rosterRequirements.maxAgents,
              })}</span>}
              <button className="primary accent raid-pull" disabled={!legal || !!state.blocked} onClick={() => setState((s) => pull(s))}>
                {state.pull === 0 ? t("raidnight.pull") : t("raidnight.pullAgain")}
              </button>
              {state.diagnosis && !state.cleared && (
                <button className="secondary" onClick={() => { commitNightFailed(state); setCommitted(state.ledger); }}>
                  {t("raidnight.callItNight")}
                </button>
              )}
            </div>

            {state.pullDelta && (
              <div className="card raid-delta"><span className="raid-delta-tag">{t("raidnight.lastPull")}</span> {state.pullDelta}</div>
            )}
          </section>

          {/* ── right: memory — diagnosis or consequence ── */}
          <aside className="rn-right sidebar">
            {!state.cleared && state.diagnosis && (
              <div className="raid-diagnosis">
                <div className="audit-section">
                  {t("raidnight.whyWiped")}{" "}
                  <span className="badge fail raid-check-count rn-num">{state.diagnosis.failedChecks.length}</span>
                </div>
                <div className={`projection-cause raid-cause cause-${state.diagnosis.primaryCause.kind}`}>
                  <span className="badge raid-cause-tag">{state.diagnosis.primaryCause.kind}</span>{" "}
                  {state.diagnosis.primaryCause.note}
                </div>
                {state.diagnosis.failedChecks.map((fc) => (
                  <div key={fc.mechanicId} className="mechanic-row raid-check">
                    <div className="mechanic-name">
                      {fc.mechanicName}{" "}
                      <span className="badge tier">{fc.scope === "team_aggregate" ? "team" : fc.scope === "role_specific" ? "role" : "each"}</span>{" "}
                      {fc.teamScore !== undefined
                        ? <>— {t("raidnight.putUp")} <span className="rn-num">{fc.teamScore}</span>, {t("raidnight.needed")} <span className="rn-num">{fc.threshold}</span></>
                        : <>— {t("raidnight.needed")} <span className="rn-num">{fc.threshold}</span></>}
                    </div>
                    {fc.culprits.map((c) => (
                      <div key={c.agentId} className="raid-culprit">
                        <span>{c.name} ({roleName(c.role)}): <strong className="rn-num">{c.score}</strong> vs <span className="rn-num">{c.threshold}</span> · {t("raidnight.morale")} <span className="rn-num">{c.morale}</span>, {t("raidnight.stress")} <span className="rn-num">{c.stress}</span></span>
                        {c.factors.map((f, i) => <div key={i} className="raid-factor">└ {f.note}</div>)}
                      </div>
                    ))}
                  </div>
                ))}

                <div className="audit-section" style={{ marginTop: 12 }}>{t("raidnight.bottleneck")}</div>
                <ul className="raid-bottleneck">
                  {state.diagnosis.bottlenecks.map((b, i) => (
                    <li key={i}>▸ <strong>{b.label}</strong> ({b.kind}) — {b.reason}</li>
                  ))}
                </ul>

                <div className="audit-section" style={{ marginTop: 12 }}>
                  {t("raidnight.threeThings")}{" "}
                  <span className="badge raid-fix-count rn-num">{state.diagnosis.fixes.length}</span>
                </div>
                <div className="raid-fixes">
                  {state.diagnosis.fixes.map((fix, i) => (
                    <FixButton key={i} fix={fix} disabled={state.fixApplied !== null}
                      chosen={state.fixApplied === fix.lever} onApply={() => setState((s) => applyFix(s, fix))} />
                  ))}
                </div>
                {state.fixApplied && (
                  <div className="card good raid-receipt">
                    <span className="badge pass raid-receipt-tag">{t("raidnight.changed")}</span>{" "}
                    {state.receipt}
                    <div className="raid-applied">{t("raidnight.applied")}</div>
                  </div>
                )}
              </div>
            )}

            {state.cleared && <Consequence state={state} committed={committed}
              onCommit={() => setCommitted(commitNightVictory(state))}
              onNextTier={() => { setState(newRaidNightFrom(RAID_ARC_T2, committed, 1)); setCommitted(null); }}
              onTryIncompatible={() => { setState(newRaidNightFrom(INCOMPATIBLE, committed, 1)); setCommitted(null); }}
              nextBoss={bossOf(RAID_ARC_T2).name} />}

            {!state.cleared && !state.diagnosis && (
              <div className="empty rn-hint">{t("raidnight.rightHint")}</div>
            )}
          </aside>
        </div>
      )}

      {/* ── bottom action strip ── */}
      <footer className="rn-bottom">
        <span className="rn-bottom-ledger">{committed ? t("raidnight.consequencesRemain") : guildChip}</span>
        <div className="rn-bottom-actions">
          <button className="secondary" onClick={() => { setState(newRaidNight(1)); setCommitted(null); }}>{t("raidnight.reset")}</button>
          <button className="secondary" onClick={onBack}>{t("raidnight.back")}</button>
        </div>
      </footer>
    </div>
  );
}

function Consequence({ state, committed, onCommit, onNextTier, onTryIncompatible, nextBoss }: {
  state: RaidNightState;
  committed: import("../lib/ledger.js").CampaignLedger | null;
  onCommit: () => void; onNextTier: () => void; onTryIncompatible: () => void; nextBoss: string;
}): JSX.Element {
  const cons = nightConsequences(state);
  const agents = Object.values(state.org.agents);
  const avg = (f: (a: Agent) => number) => agents.length ? Math.round(agents.reduce((s, a) => s + f(a), 0) / agents.length) : 0;
  const card = (head: string, body: JSX.Element) => (
    <div className="recommendation-card rn-cons-card">
      <div className="audit-section" style={{ margin: 0 }}>{head}</div>
      <div className="recommendation-body">{body}</div>
    </div>
  );
  return (
    <div className="rn-consequence">
      <div className="audit-section">{t("raidnight.consequences")}</div>
      <div className="rn-cons-grid">
        {card(t("raidnight.consScars"), <>{cons.scarsEarned.length ? cons.scarsEarned.map((s) => <div key={s.scarId}>✦ {s.name} — {s.effect.note}</div>) : <span className="empty">—</span>}</>)}
        {card(t("raidnight.consLegends"), <>{cons.legends.length ? cons.legends.map((l, i) => <div key={i}>★ {state.org.agents[l.agentId]?.name}: {l.citation}</div>) : <span className="empty">—</span>}</>)}
        {card(t("raidnight.consMorale"), <>{t("raidnight.morale")} <b className="rn-num">{avg((a) => a.morale)}</b> · {t("raidnight.stress")} <b className="rn-num">{avg((a) => a.stress)}</b></>)}
        {card(t("raidnight.consLoot"), <><b className="rn-num">{cons.loot.length}</b> {t("raidnight.consLootFair")}</>)}
        {card(t("raidnight.consPrecedents"), <b className="rn-num">{cons.precedentsSet.length}</b>)}
        {card(t("raidnight.consProgress"), <>{cons.clearedTier ? t("raidnight.consTierUnlocked") : t("raidnight.consNoAdvance")}</>)}
      </div>
      {!committed ? (
        <button className="primary accent rn-btn-commit" onClick={onCommit}>{t("raidnight.commit")}</button>
      ) : (
        <div className="rn-committed">
          <div className="rn-committed-line">{t("raidnight.consequencesRemain")}</div>
          <div className="rn-next">
            <button className="primary accent" onClick={onNextTier}>{t("raidnight.startNextTier", { boss: nextBoss })}</button>
            <button className="secondary" onClick={onTryIncompatible}>{t("raidnight.tryIncompatible")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

const LEVER_GLYPH: Record<string, string> = {
  gear: "⚙", train: "▲", rest: "✚", rally: "✦", bench_swap: "⇄", tradeoff: "⚖",
};

function FixButton({ fix, disabled, chosen, onApply }: {
  fix: Fix; disabled: boolean; chosen: boolean; onApply: () => void;
}): JSX.Element {
  return (
    <div className={`recommendation-card raid-fix ${chosen ? "good chosen" : ""}`} data-lever={fix.lever}>
      <div className="raid-fix-body">
        <div className="row between">
          <span className="badge tier"><span className="raid-fix-glyph">{LEVER_GLYPH[fix.lever] ?? "•"}</span> <span className="raid-fix-lever">{fix.lever}</span></span>
        </div>
        <div className="recommendation-body raid-fix-desc">{fix.description}</div>
        <div className="raid-fix-proj"><span className="badge pending raid-fix-proj-tag">{t("raidnight.ifApplied")}</span> → {fix.projectedEffect}</div>
        <div className="agent-meta raid-fix-cost">{t("raidnight.tradeoffLabel")}: {fix.cost}</div>
      </div>
      <button className="secondary" disabled={disabled} onClick={onApply}>{t("raidnight.apply")}</button>
    </div>
  );
}
