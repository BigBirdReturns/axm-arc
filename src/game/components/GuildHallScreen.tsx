// The Guild Hall — a read-only window on the committed campaign ledger
// (RFC_GUILD_HALL). It loads the guild's memory and renders it; it never writes.
// PR 032 stands up the route + the identity / campaign-record view; later PRs
// add the per-panel derivations (agent memory, scars, fairness, readiness).
import { useMemo } from "react";
import { t, useLocale } from "../../i18n/index.js";
import { loadLedger } from "../lib/ledger.js";
import { summarizeGuildHall, agentMemoryCards, scarViews, precedentViews } from "../lib/guild-hall.js";

export function GuildHallScreen({ onBack }: { onBack: () => void }): JSX.Element {
  useLocale();
  // Read-only: the Hall loads the ledger once and never mutates it.
  const ledger = useMemo(() => loadLedger(), []);
  const summary = useMemo(() => summarizeGuildHall(ledger), [ledger]);
  const raiders = useMemo(() => agentMemoryCards(ledger), [ledger]);
  const scars = useMemo(() => scarViews(ledger), [ledger]);
  const precedents = useMemo(() => precedentViews(ledger), [ledger]);

  const stat = (label: string, value: string | number) => (
    <div className="stat-cell">
      <span className="stat-lbl">{label}</span>
      <span className="stat-val rn-num">{value}</span>
    </div>
  );

  return (
    <div className="screen guild-hall">
      <header className="rn-topbar">
        <div className="rn-brand">
          <span className="rn-kicker">{t("guildhall.title")}</span>
          <span className="rn-boss">{summary.hasGuild ? summary.guildName : t("guildhall.empty")}</span>
        </div>
        <div className="rn-chips">
          <button className="secondary" onClick={onBack}>{t("guildhall.back")}</button>
        </div>
      </header>

      {!summary.hasGuild ? (
        <div className="card empty guild-hall-empty">{t("guildhall.emptyBody")}</div>
      ) : (
        <div className="guild-hall-body">
          <div className="audit-section">{t("guildhall.record")}</div>
          <div className="stat-strip guild-hall-record">
            {stat(t("guildhall.legacyLevel"), summary.legacyLevel)}
            {stat(t("guildhall.tiersCleared"), `${summary.tiersCleared}/${summary.tiersSeen}`)}
            {stat(t("guildhall.victories"), summary.victories)}
            {stat(t("guildhall.failedLockouts"), summary.failedLockouts)}
            {stat(t("guildhall.roster"), summary.rosterSize)}
            {stat(t("guildhall.scars"), summary.scars)}
            {stat(t("guildhall.precedents"), summary.precedents)}
          </div>
          <div className="audit-section" style={{ marginTop: 16 }}>
            {t("guildhall.raiders")}{" "}<span className="badge rn-num">{raiders.length}</span>
          </div>
          <div className="guild-hall-raiders">
            {raiders.map((r) => (
              <div key={r.agentId} className="card rn-agent guild-hall-raider">
                <div className="row between">
                  <span className="agent-name">{r.name}</span>
                  <span className="rn-agent-tags">
                    <span className={`badge rn-attend-mem ${r.reliability === "reliable" ? "pass" : ""}`}>{t("raidnight.nightsAttended", { n: r.nightsAttended })}</span>
                    {r.nightsBenched > 0 && <span className="badge rn-bench-mem">{t("raidnight.benchedCount", { n: r.nightsBenched })}</span>}
                    {r.role && <span className="badge role">{r.role}</span>}
                  </span>
                </div>
                <div className="agent-meta">
                  {t("raidnight.morale")} <span className="rn-num">{r.morale}</span> · {t("raidnight.stress")} <span className="rn-num">{r.stress}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="audit-section" style={{ marginTop: 16 }}>
            {t("guildhall.scars")}{" "}<span className="badge rn-num">{scars.length}</span>
          </div>
          <div className="guild-hall-scars">
            {scars.length ? scars.map((s) => (
              <div key={s.scarId} className="recommendation-card guild-hall-scar">
                <div className="mechanic-name">✦ {s.name} <span className="badge tier rn-num">+{s.modifier}</span></div>
                <div className="recommendation-body">{s.note}</div>
              </div>
            )) : <span className="empty">—</span>}
          </div>

          <div className="audit-section" style={{ marginTop: 16 }}>
            {t("guildhall.precedents")}{" "}<span className="badge rn-num">{precedents.length}</span>
          </div>
          <div className="guild-hall-precedents">
            {precedents.length ? precedents.map((p, i) => (
              <div key={i} className="mechanic-row guild-hall-precedent">
                <span className="badge">{p.type}</span> <span className="badge tier">{p.basis}</span>
                {p.winner && <> · {p.winner}</>}
              </div>
            )) : <span className="empty">—</span>}
          </div>

          <div className="agent-meta guild-hall-note">{t("guildhall.readOnlyNote")}</div>
        </div>
      )}
    </div>
  );
}
