// Raid Night — an AXM-WORLD dark runtime screen for the wipe-diagnosis +
// tier-2 loop. Shell integration pass: same mechanics exactly (pull → diagnose
// → one fix → re-pull → clear → commit → next tier), restructured into the
// runtime regions — top bar, left roster, center encounter, right memory
// (diagnosis or consequence), bottom action strip. Chrome routes through t();
// cartridge vocabulary + diagnosis prose flow verbatim.

import { useState } from "react";
import { t, useLocale } from "../../i18n/index.js";
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
const INCOMPATIBLE: Arc = validateArc(severedMarch); // different profile — proves the refusal surface

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
      className={`raid-agent rn-agent ${fielded ? "is-fielded" : "is-benched"}`}
      onClick={() => setState((s) => toggleFielded(s, a.id))}
      title={fielded ? t("raidnight.benchVerb") : t("raidnight.field")}
    >
      <div className="rn-agent-top">
        <span className="rn-agent-name">{a.name}</span>
        <span className="rn-agent-role">{roleName(a.role)}</span>
      </div>
      <div className="rn-agent-stats">
        {CHECK_ATTRS.map((k) => (
          <span key={k} className="rn-stat"><em>{k.slice(0, 3)}</em> <b className="rn-num">{a.attributes[k] ?? 0}</b></span>
        ))}
      </div>
      <div className="rn-agent-cond">
        <span className="rn-cond">{t("raidnight.morale")} <b className="rn-num">{a.morale}</b></span>
        <span className="rn-cond">{t("raidnight.stress")} <b className="rn-num">{a.stress}</b></span>
      </div>
    </button>
  );

  const rosterGroups = (agents: Agent[], fielded: boolean) =>
    state.arc.roles.map((role) => {
      const members = agents.filter((a) => a.role === role.id);
      if (members.length === 0) return null;
      return (
        <div key={role.id} className="rn-rolegroup">
          <div className="rn-rolegroup-head">{role.name} <span className="rn-num">{members.length}</span></div>
          <div className="rn-agents">{members.map((a) => agentCard(a, fielded))}</div>
        </div>
      );
    });

  const guildChip = state.ledger
    ? t("raidnight.guildCarried", { n: state.ledger.roster.length })
    : t("raidnight.freshGuild");

  return (
    <div className="raid-shell">
      {/* ── top runtime bar ── */}
      <header className="rn-topbar">
        <div className="rn-brand">
          <span className="rn-kicker">{t("raidnight.title")}</span>
          <span className="rn-boss">{boss.name}</span>
        </div>
        <div className="rn-chips">
          <span className="rn-chip rn-chip-guild">{guildChip}</span>
          <span className="rn-chip">{t("raidnight.attempt", { n: state.pull })}</span>
          <span className={`rn-chip ${committed ? "rn-chip-ok" : ""}`}>
            {committed ? t("raidnight.committed") : t("raidnight.ledgerNone")}
          </span>
        </div>
      </header>

      {state.blocked ? (
        <div className="rn-body rn-body-single">
          <div className="raid-blocked rn-panel">
            <div className="rn-state rn-state-wipe">{t("raidnight.incompatible")}</div>
            <p>{state.blocked.message}</p>
            <ul className="raid-bottleneck">
              {state.blocked.dimensions.filter((d) => !d.match).map((d) => (
                <li key={d.dimension}>▸ <strong>{d.dimension}</strong>: <span className="rn-num">{d.ledgerValue.join(", ")}</span> ≠ <span className="rn-num">{d.cartridgeValue.join(", ")}</span></li>
              ))}
            </ul>
            <button className="rn-btn rn-btn-primary" onClick={() => setState(newRaidNightFrom(state.arc, null, 1))}>
              {t("raidnight.startFresh")}
            </button>
          </div>
        </div>
      ) : (
        <div className="rn-body">
          {/* ── left: roster, grouped by role ── */}
          <aside className="rn-left rn-panel">
            <div className="rn-panel-head">{t("raidnight.raidParty")} <span className="rn-num">{party.length}/10</span></div>
            {rosterGroups(party, true)}
            <div className="rn-panel-head rn-panel-head-sub">{t("raidnight.bench")} <span className="rn-num">{bench.length}</span></div>
            {rosterGroups(bench, false)}
          </aside>

          {/* ── center: encounter ── */}
          <section className="rn-center rn-panel">
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
              {!legal && <span className="raid-illegal">{t("raidnight.partyIllegal", {
                min: boss.rosterRequirements.minAgents, max: boss.rosterRequirements.maxAgents,
              })}</span>}
              <button className="rn-btn rn-btn-primary raid-pull" disabled={!legal || !!state.blocked} onClick={() => setState((s) => pull(s))}>
                {state.pull === 0 ? t("raidnight.pull") : t("raidnight.pullAgain")}
              </button>
              {state.diagnosis && !state.cleared && (
                <button className="rn-btn" onClick={() => { commitNightFailed(state); setCommitted(state.ledger); }}>
                  {t("raidnight.callItNight")}
                </button>
              )}
            </div>

            {state.pullDelta && (
              <div className="raid-delta"><span className="raid-delta-tag">{t("raidnight.lastPull")}</span> {state.pullDelta}</div>
            )}
          </section>

          {/* ── right: memory — diagnosis or consequence ── */}
          <aside className="rn-right rn-panel">
            {!state.cleared && state.diagnosis && (
              <div className="raid-diagnosis">
                <div className="rn-panel-head">{t("raidnight.whyWiped")}</div>
                <div className={`raid-cause cause-${state.diagnosis.primaryCause.kind}`}>
                  <span className="raid-cause-tag">{state.diagnosis.primaryCause.kind}</span>
                  {state.diagnosis.primaryCause.note}
                </div>
                {state.diagnosis.failedChecks.map((fc) => (
                  <div key={fc.mechanicId} className="raid-check">
                    <div className="raid-check-head">
                      <strong>{fc.mechanicName}</strong>{" "}
                      <span className="raid-scope">[{fc.scope === "team_aggregate" ? "team" : fc.scope === "role_specific" ? "role" : "each"}]</span>{" "}
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

                <div className="rn-panel-head rn-panel-head-sub">{t("raidnight.bottleneck")}</div>
                <ul className="raid-bottleneck">
                  {state.diagnosis.bottlenecks.map((b, i) => (
                    <li key={i}>▸ <strong>{b.label}</strong> ({b.kind}) — {b.reason}</li>
                  ))}
                </ul>

                <div className="rn-panel-head rn-panel-head-sub">{t("raidnight.threeThings")}</div>
                <div className="raid-fixes">
                  {state.diagnosis.fixes.map((fix, i) => (
                    <FixButton key={i} fix={fix} disabled={state.fixApplied !== null}
                      chosen={state.fixApplied === fix.lever} onApply={() => setState((s) => applyFix(s, fix))} />
                  ))}
                </div>
                {state.fixApplied && (
                  <div className="raid-receipt">
                    <span className="raid-receipt-tag">{t("raidnight.changed")}</span>
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
              <div className="rn-hint">{t("raidnight.rightHint")}</div>
            )}
          </aside>
        </div>
      )}

      {/* ── bottom action strip ── */}
      <footer className="rn-bottom">
        <span className="rn-bottom-ledger">{committed ? t("raidnight.consequencesRemain") : guildChip}</span>
        <div className="rn-bottom-actions">
          <button className="rn-btn" onClick={() => { setState(newRaidNight(1)); setCommitted(null); }}>{t("raidnight.reset")}</button>
          <button className="rn-btn" onClick={onBack}>{t("raidnight.back")}</button>
        </div>
      </footer>
    </div>
  );
}

// ── the consequence commit moment ────────────────────────────────────────────

function Consequence({ state, committed, onCommit, onNextTier, onTryIncompatible, nextBoss }: {
  state: RaidNightState;
  committed: import("../lib/ledger.js").CampaignLedger | null;
  onCommit: () => void; onNextTier: () => void; onTryIncompatible: () => void; nextBoss: string;
}): JSX.Element {
  const cons = nightConsequences(state);
  const agents = Object.values(state.org.agents);
  const avg = (f: (a: Agent) => number) => agents.length ? Math.round(agents.reduce((s, a) => s + f(a), 0) / agents.length) : 0;
  return (
    <div className="rn-consequence">
      <div className="rn-panel-head rn-consequence-title">{t("raidnight.consequences")}</div>

      <div className="rn-cons-grid">
        <div className="rn-cons-card">
          <div className="rn-cons-head">{t("raidnight.consScars")}</div>
          {cons.scarsEarned.length ? cons.scarsEarned.map((s) => <div key={s.scarId} className="rn-cons-line">✦ {s.name} — {s.effect.note}</div>)
            : <div className="rn-cons-line rn-muted">—</div>}
        </div>
        <div className="rn-cons-card">
          <div className="rn-cons-head">{t("raidnight.consLegends")}</div>
          {cons.legends.length ? cons.legends.map((l, i) => <div key={i} className="rn-cons-line">★ {state.org.agents[l.agentId]?.name}: {l.citation}</div>)
            : <div className="rn-cons-line rn-muted">—</div>}
        </div>
        <div className="rn-cons-card">
          <div className="rn-cons-head">{t("raidnight.consMorale")}</div>
          <div className="rn-cons-line">{t("raidnight.morale")} <b className="rn-num">{avg((a) => a.morale)}</b> · {t("raidnight.stress")} <b className="rn-num">{avg((a) => a.stress)}</b></div>
        </div>
        <div className="rn-cons-card">
          <div className="rn-cons-head">{t("raidnight.consLoot")}</div>
          <div className="rn-cons-line"><b className="rn-num">{cons.loot.length}</b> {t("raidnight.consLootFair")}</div>
        </div>
        <div className="rn-cons-card">
          <div className="rn-cons-head">{t("raidnight.consPrecedents")}</div>
          <div className="rn-cons-line"><b className="rn-num">{cons.precedentsSet.length}</b></div>
        </div>
        <div className="rn-cons-card">
          <div className="rn-cons-head">{t("raidnight.consProgress")}</div>
          <div className="rn-cons-line">{cons.clearedTier ? t("raidnight.consTierUnlocked") : t("raidnight.consNoAdvance")}</div>
        </div>
      </div>

      {!committed ? (
        <button className="rn-btn rn-btn-commit" onClick={onCommit}>{t("raidnight.commit")}</button>
      ) : (
        <div className="rn-committed">
          <div className="rn-committed-line">{t("raidnight.consequencesRemain")}</div>
          <div className="rn-next">
            <button className="rn-btn rn-btn-primary" onClick={onNextTier}>{t("raidnight.startNextTier", { boss: nextBoss })}</button>
            <button className="rn-btn" onClick={onTryIncompatible}>{t("raidnight.tryIncompatible")}</button>
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
    <div className={`raid-fix ${chosen ? "chosen" : ""}`} data-lever={fix.lever}>
      <div className="raid-fix-body">
        <div className="raid-fix-head">
          <span className="raid-fix-glyph">{LEVER_GLYPH[fix.lever] ?? "•"}</span>
          <span className="raid-fix-lever">{fix.lever}</span>
        </div>
        <div className="raid-fix-desc">{fix.description}</div>
        <div className="raid-fix-proj">→ {fix.projectedEffect}</div>
        <div className="raid-fix-cost">{t("raidnight.tradeoffLabel")}: {fix.cost}</div>
      </div>
      <button className="rn-btn rn-btn-primary" disabled={disabled} onClick={onApply}>{t("raidnight.apply")}</button>
    </div>
  );
}
