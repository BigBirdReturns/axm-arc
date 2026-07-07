// The Expansion Archive — a read-only join of the arc library and the campaign
// ledger (RFC_EXPANSION_ARCHIVE). It loads its own data and renders the join;
// it never writes the library or the ledger. PR 042 stands up the minimal
// route + the expansion roster; later PRs add per-panel derivations.
import { useMemo } from "react";
import { t, useLocale } from "../../i18n/index.js";
import { loadArcLibrary, loadActiveArcId } from "../lib/arc-library.js";
import { loadLedger } from "../lib/ledger.js";
import { expansionRoster } from "../lib/expansion-archive.js";

export function ExpansionArchiveScreen({ onBack }: { onBack: () => void }): JSX.Element {
  useLocale();
  // Read-only: the Archive loads the library and the ledger once and never
  // mutates either.
  const library = useMemo(() => loadArcLibrary(), []);
  const ledger = useMemo(() => loadLedger(), []);
  const activeArcId = useMemo(() => loadActiveArcId(), []);
  const rows = useMemo(() => expansionRoster(library, ledger, activeArcId), [library, ledger, activeArcId]);

  const statusLabel = (status: "cleared" | "in-progress" | "unattempted") =>
    status === "cleared"
      ? t("archive.cleared")
      : status === "in-progress"
        ? t("archive.inProgress")
        : t("archive.unattempted");

  const statusBadgeClass = (status: "cleared" | "in-progress" | "unattempted") =>
    status === "cleared" ? "badge pass" : status === "in-progress" ? "badge tier" : "badge";

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
            {t("archive.expansions")}{" "}<span className="badge rn-num">{rows.length}</span>
          </div>
          <div className="expansion-archive-roster">
            {rows.map((row) => (
              <div key={row.arcId} className="card mechanic-row expansion-archive-row">
                <div className="row between">
                  <span className="agent-name">{row.name}</span>
                  <span className="rn-agent-tags">
                    {row.isActive && <span className="badge pass">{t("archive.active")}</span>}
                    <span className={statusBadgeClass(row.status)}>{statusLabel(row.status)}</span>
                  </span>
                </div>
                <div className="agent-meta">
                  {t("archive.tiersCleared")} <span className="rn-num">{row.tiersCleared}/{row.tiersPlayed}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="agent-meta expansion-archive-note">{t("archive.readOnlyNote")}</div>
        </div>
      )}
    </div>
  );
}
