// The Expansion Archive — a read-only join of the arc library and the campaign
// ledger (RFC_EXPANSION_ARCHIVE). It loads its own data and renders the join;
// it never writes the library or the ledger. PR 042 stands up the minimal
// route + the expansion roster; PR 043 adds the per-expansion campaign record
// (tiers, outcomes, scars, legends, precedents) under each played row.
import { useMemo } from "react";
import { t, useLocale } from "../../i18n/index.js";
import { loadArcLibrary, loadActiveArcId } from "../lib/arc-library.js";
import { loadLedger } from "../lib/ledger.js";
import { expansionRoster, expansionRecord, journeyTimeline, type ExpansionRow } from "../lib/expansion-archive.js";

export function ExpansionArchiveScreen({ onBack }: { onBack: () => void }): JSX.Element {
  useLocale();
  // Read-only: the Archive loads the library and the ledger once and never
  // mutates either.
  const library = useMemo(() => loadArcLibrary(), []);
  const ledger = useMemo(() => loadLedger(), []);
  const activeArcId = useMemo(() => loadActiveArcId(), []);
  const rows = useMemo(() => expansionRoster(library, ledger, activeArcId), [library, ledger, activeArcId]);
  const journey = useMemo(() => journeyTimeline(ledger), [ledger]);

  const statusLabel = (status: "cleared" | "in-progress" | "unattempted") =>
    status === "cleared"
      ? t("archive.cleared")
      : status === "in-progress"
        ? t("archive.inProgress")
        : t("archive.unattempted");

  const statusBadgeClass = (status: "cleared" | "in-progress" | "unattempted") =>
    status === "cleared" ? "badge pass" : status === "in-progress" ? "badge tier" : "badge";

  // Renders one played expansion's campaign record — omitted entirely for
  // unattempted rows (nothing recorded is honest; there is no empty state to
  // fake). Each sub-section (scars/legends/precedents) is itself omitted when
  // its array is empty, rather than rendering an empty placeholder.
  const renderRecord = (row: ExpansionRow) => {
    const record = expansionRecord(row.digest, ledger);
    return (
      <div className="expansion-archive-record">
        <div className="agent-meta">{t("archive.record")}</div>
        <div className="expansion-archive-tiers">
          {record.tiers.map((tr, i) => (
            <div key={i} className="mechanic-row expansion-archive-tier">
              <span className="agent-name">{tr.tierLabel}</span>{" "}
              {tr.grade && <span className="badge tier">{t("archive.grade")} {tr.grade}</span>}
              {" "}· {t("guildhall.pulls")} <span className="rn-num">{tr.pulls}</span>
              {" "}· {t("guildhall.wipes")} <span className="rn-num">{tr.wipes}</span>
              {" "}· {t("guildhall.bestPull")} <span className="rn-num">{tr.bestPull ?? "—"}</span>
            </div>
          ))}
        </div>
        <div className="agent-meta expansion-archive-outcomes">
          {t("guildhall.victories")} <span className="rn-num">{record.victories}</span>
          {" "}· {t("guildhall.failedLockouts")} <span className="rn-num">{record.failedLockouts}</span>
          {" "}· {t("guildhall.pulls")} <span className="rn-num">{record.totalPulls}</span>
          {" "}· {t("guildhall.wipes")} <span className="rn-num">{record.totalWipes}</span>
        </div>

        {record.scars.length > 0 && (
          <div className="expansion-archive-scars">
            <div className="agent-meta">{t("guildhall.scars")}{" "}<span className="badge rn-num">{record.scars.length}</span></div>
            {record.scars.map((s, i) => (
              <div key={i} className="mechanic-row expansion-archive-scar">
                <span className="agent-name">{s.name}</span>{" "}
                <span className="badge tier rn-num">+{s.modifier}</span>{" "}{s.note}
              </div>
            ))}
          </div>
        )}

        {record.legends.length > 0 && (
          <div className="expansion-archive-legends">
            <div className="agent-meta">{t("archive.legends")}{" "}<span className="badge rn-num">{record.legends.length}</span></div>
            {record.legends.map((l, i) => (
              <div key={i} className="mechanic-row expansion-archive-legend">{l.citation}</div>
            ))}
          </div>
        )}

        {record.precedents.length > 0 && (
          <div className="expansion-archive-precedents">
            <div className="agent-meta">{t("guildhall.precedents")}{" "}<span className="badge rn-num">{record.precedents.length}</span></div>
            {record.precedents.map((p, i) => (
              <div key={i} className="mechanic-row expansion-archive-precedent">
                <span className="badge">{p.type}</span> <span className="badge tier">{p.decisionBasis}</span>
                {p.winner && <> · {p.winner}</>}
              </div>
            ))}
          </div>
        )}

        {record.lastCommitSeq !== null && (
          <div className="agent-meta expansion-archive-last-commit">
            {t("archive.lastCommit")} <span className="rn-num">#{record.lastCommitSeq}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="screen expansion-archive">
      <header className="rn-topbar">
        <div className="rn-brand">
          <span className="rn-kicker">{t("archive.title")}</span>
        </div>
        <div className="rn-chips">
          <button className="secondary" onClick={onBack}>{t("archive.back")}</button>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="card empty expansion-archive-empty">{t("archive.emptyBody")}</div>
      ) : (
        <div className="expansion-archive-body">
          <div className="audit-section">
            {t("archive.journey")}{" "}<span className="badge rn-num">{journey.length}</span>
          </div>
          {journey.length === 0 ? (
            <span className="empty">—</span>
          ) : (
            <div className="expansion-archive-journey">
              {journey.map((entry, i) => (
                <div key={entry.commitSeq} className="mechanic-row expansion-archive-journey-entry">
                  <span className="agent-name">{t("archive.night")} {i + 1}</span>{" "}
                  <span className="badge rn-num">#{entry.commitSeq}</span>{" "}
                  <span className="agent-name">{entry.cartridgeId}</span>{" "}
                  <span className={entry.type === "victory" ? "badge pass" : "badge"}>
                    {entry.type === "victory" ? t("archive.victory") : t("archive.failed")}
                  </span>{" "}
                  {entry.grade && <span className="badge tier">{t("archive.grade")} {entry.grade}</span>}
                  {" "}· {t("guildhall.pulls")} <span className="rn-num">{entry.pulls}</span>
                  {" "}· {t("guildhall.wipes")} <span className="rn-num">{entry.wipes}</span>
                </div>
              ))}
            </div>
          )}

          <div className="audit-section">
            {t("archive.expansions")}{" "}<span className="badge rn-num">{rows.length}</span>
          </div>
          <div className="expansion-archive-roster">
            {rows.map((row) => (
              <div
                key={row.arcId}
                className={
                  row.artifactMissing
                    ? "card mechanic-row expansion-archive-row expansion-archive-artifact-missing"
                    : "card mechanic-row expansion-archive-row"
                }
              >
                <div className="row between">
                  <span className="agent-name">{row.name}</span>
                  <span className="rn-agent-tags">
                    {row.isActive && <span className="badge pass">{t("archive.active")}</span>}
                    {row.artifactMissing && <span className="badge">{t("archive.artifactMissing")}</span>}
                    <span className={statusBadgeClass(row.status)}>{statusLabel(row.status)}</span>
                  </span>
                </div>
                <div className="agent-meta">
                  {t("archive.tiersCleared")} <span className="rn-num">{row.tiersCleared}/{row.tiersPlayed}</span>
                </div>
                {row.artifactMissing && (
                  <div className="agent-meta expansion-archive-digest">
                    {t("archive.digest")} <span className="rn-num">{row.digest.slice(0, 10)}</span>
                  </div>
                )}
                {row.artifactMissing && (
                  <div className="agent-meta expansion-archive-artifact-missing-note">
                    {t("archive.artifactMissingNote")}
                  </div>
                )}
                {row.status !== "unattempted" && renderRecord(row)}
              </div>
            ))}
          </div>
          <div className="agent-meta expansion-archive-note">{t("archive.readOnlyNote")}</div>
        </div>
      )}
    </div>
  );
}
