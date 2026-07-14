// The Expansion Archive — a read-only join of the arc library and the campaign
// ledger (RFC_EXPANSION_ARCHIVE). It loads its own data and renders the join;
// it never writes the library or the ledger. PR 042 stands up the minimal
// route + the expansion roster; PR 043 adds the per-expansion campaign record
// (tiers, outcomes, scars, legends, precedents) under each played row.
import { useMemo } from "react";
import { t, useLocale } from "../../i18n/index.js";
import { loadArcLibrary, loadActiveArcId, type ArcLibraryEntry } from "../lib/arc-library.js";
import { loadLedger } from "../lib/ledger.js";
import { expansionRoster, expansionRecord, journeyTimeline, carryVerdict, type ExpansionRow } from "../lib/expansion-archive.js";
import { summarizeGuildHall } from "../lib/guild-hall.js";
import { cartridgeDigest } from "../../engine/cartridge-digest.js";
import { KarazhanEmblem, isKarazhan } from "../karazhan-theme.js";
import { TrustLabel } from "../../codex/index.js";

export function ExpansionArchiveScreen({ onBack, onOpenLibrary }: { onBack: () => void; onOpenLibrary: () => void }): JSX.Element {
  useLocale();
  // Read-only: the Archive loads the library and the ledger once and never
  // mutates either.
  const library = useMemo(() => loadArcLibrary(), []);
  const ledger = useMemo(() => loadLedger(), []);
  const summary = useMemo(() => summarizeGuildHall(ledger), [ledger]);
  const activeArcId = useMemo(() => loadActiveArcId(), []);
  const rows = useMemo(() => expansionRoster(library, ledger, activeArcId), [library, ledger, activeArcId]);
  const journey = useMemo(() => journeyTimeline(ledger), [ledger]);
  // Library rows have a real cartridge in hand — join back to it by digest
  // (the safest key: robust to id churn) so the carry-forward signal only
  // ever runs against an actual loaded Arc, never a digest alone.
  const libraryByDigest = useMemo(() => {
    const m = new Map<string, ArcLibraryEntry>();
    for (const entry of library) m.set(cartridgeDigest(entry.arc), entry);
    return m;
  }, [library]);

  // The carry-forward badge (PR 047): "can this guild carry into this
  // expansion?" Library rows get a genuine verdict from the loaded cartridge;
  // artifact-missing rows have no cartridge to check and render an honest
  // "can't assess" state instead — never a guessed verdict.
  const renderCarryBadge = (row: ExpansionRow) => {
    if (row.artifactMissing) {
      return <span className="badge expansion-archive-carry">{t("archive.carryUnavailable")}</span>;
    }
    const entry = libraryByDigest.get(row.digest);
    if (!entry) return null; // structurally shouldn't happen for a library row
    const verdict = carryVerdict(entry.arc, ledger);
    if (verdict === "null-ledger") return null;
    return verdict === "compatible" ? (
      <span className="badge pass expansion-archive-carry">{t("archive.carryReady")}</span>
    ) : (
      <span className="badge expansion-archive-carry">{t("archive.carryIncompatible")}</span>
    );
  };

  const statusLabel = (status: "cleared" | "in-progress" | "unattempted") =>
    status === "cleared"
      ? t("archive.cleared")
      : status === "in-progress"
        ? t("archive.inProgress")
        : t("archive.unattempted");

  const statusBadgeClass = (status: "cleared" | "in-progress" | "unattempted") =>
    status === "cleared" ? "badge pass" : status === "in-progress" ? "badge tier" : "badge";

  const stat = (label: string, value: string | number) => (
    <div className="stat-cell"><span className="stat-lbl">{label}</span><span className="stat-val rn-num">{value}</span></div>
  );

  // Best-pull honesty relabel (owner-requested): a genuine 0 means the guild
  // reached the tier's target on its best attempt (best-shortfall 0) — the
  // number is true but "Best pull 0" reads as "we recorded nothing." Spell out
  // the three distinct truths: never recorded, no shortfall, or the number.
  const bestPullLabel = (v: number | null) =>
    v == null ? t("archive.notRecorded") : v === 0 ? t("archive.noShortfall") : String(v);

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
            <div key={i} className="mechanic-row">
              <span className="agent-name">{tr.tierLabel}</span>{" "}
              {tr.grade && <span className="badge tier">{t("archive.grade")} {tr.grade}</span>}
              {" "}· {t("guildhall.pulls")} <span className="rn-num">{tr.pulls}</span>
              {" "}· {t("guildhall.wipes")} <span className="rn-num">{tr.wipes}</span>
              {" "}· {t("guildhall.bestPull")} <span className="rn-num">{bestPullLabel(tr.bestPull)}</span>
            </div>
          ))}
        </div>
        <div className="stat-strip expansion-archive-outcomes">
          {stat(t("guildhall.victories"), record.victories)}
          {stat(t("guildhall.failedLockouts"), record.failedLockouts)}
          {stat(t("guildhall.pulls"), record.totalPulls)}
          {stat(t("guildhall.wipes"), record.totalWipes)}
        </div>

        {record.scars.length > 0 && (
          <div className="expansion-archive-scars">
            <div className="agent-meta">{t("guildhall.scars")}{" "}<span className="badge rn-num">{record.scars.length}</span></div>
            {record.scars.map((s, i) => (
              <div key={i} className="recommendation-card expansion-archive-scar">
                <div className="mechanic-name"><span aria-hidden="true">✦</span> {s.name} <span className="badge tier rn-num">+{s.modifier}</span></div>
                <div className="recommendation-body">{s.note}</div>
              </div>
            ))}
          </div>
        )}

        {record.legends.length > 0 && (
          <div className="expansion-archive-legends">
            <div className="agent-meta">{t("archive.legends")}{" "}<span className="badge rn-num">{record.legends.length}</span></div>
            {record.legends.map((l, i) => (
              <div key={i} className="mechanic-row">{l.citation}</div>
            ))}
          </div>
        )}

        {record.precedents.length > 0 && (
          <div className="expansion-archive-precedents">
            <div className="agent-meta">{t("guildhall.precedents")}{" "}<span className="badge rn-num">{record.precedents.length}</span></div>
            {record.precedents.map((p, i) => (
              <div key={i} className="mechanic-row">
                <span className="badge">{p.type}</span> <span className="badge tier">{p.decisionBasis}</span>
                {p.winner && <> · {p.winner}</>}
              </div>
            ))}
          </div>
        )}

        {record.lastCommitSeq !== null && (
          <div className="agent-meta expansion-archive-last-commit">
            {t("archive.lastCommit")} <span className="rn-num">{record.lastCommitSeq + 1}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="screen expansion-archive" role="region" aria-label={t("archive.title")}>
      <header className="rn-topbar">
        <div className="rn-brand">
          <span className="rn-kicker">{t("archive.title")}</span>
          {summary.hasGuild && <span className="rn-boss">{summary.guildName}</span>}
        </div>
        <div className="rn-chips">
          <button className="secondary" onClick={onBack}>{t("archive.back")}</button>
          <button className="secondary archive-to-library" onClick={onOpenLibrary}>{t("library.heading")}</button>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="card empty expansion-archive-empty">{t("archive.emptyBody")}</div>
      ) : (
        <div className="expansion-archive-body">
          {summary.hasGuild && (
            <div className="stat-strip expansion-archive-guild">
              {stat(t("guildhall.legacyLevel"), summary.legacyLevel)}
              {stat(t("guildhall.commits"), summary.commits)}
              {stat(t("guildhall.roster"), summary.rosterSize)}
              {stat(t("guildhall.tiersCleared"), `${summary.tiersCleared}/${summary.tiersSeen}`)}
            </div>
          )}
          <div className="audit-section">
            {t("archive.journey")}{" "}<span className="badge rn-num">{journey.length}</span>
          </div>
          {journey.length === 0 ? (
            <span className="empty">—</span>
          ) : (
            <div className="expansion-archive-journey" aria-label={`${t("archive.journey")} ${journey.length}`}>
              {journey.map((entry) => (
                <div key={entry.commitSeq} className="mechanic-row">
                  <span className="agent-name">{t("archive.night")} {entry.journeyNumber}</span>{" "}
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
          <div className="expansion-archive-roster" aria-label={`${t("archive.expansions")} ${rows.length}`}>
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
                  <span className="agent-name">
                    {!row.artifactMissing && isKarazhan(row.arcId) && (
                      <span className="karazhan-emblem" aria-hidden="true">
                        <KarazhanEmblem size={18} />
                      </span>
                    )}
                    {row.name}
                  </span>
                  <span className="rn-agent-tags">
                    {row.isActive && <span className="badge pass">{t("archive.active")}</span>}
                    {row.artifactMissing && <span className="badge">{t("archive.artifactMissing")}</span>}
                    {!row.artifactMissing && (() => {
                      const entry = libraryByDigest.get(row.digest);
                      return entry ? <TrustLabel trust={entry.trust} /> : null;
                    })()}
                    <span className={statusBadgeClass(row.status)}>{statusLabel(row.status)}</span>
                    {renderCarryBadge(row)}
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
