import type { Arc } from "../../engine/types.js";
import { auditArcAuthoring, type AttributeCoverageStatus } from "../lib/authoring-audit.js";
import { t, type MessageId } from "../../i18n/index.js";

const STATUS_ID: Record<AttributeCoverageStatus, MessageId> = {
  covered: "authoring.covered",
  specialist: "authoring.specialist",
  cosmetic: "authoring.cosmetic",
  dead: "authoring.dead",
};
const TONE: Record<AttributeCoverageStatus, string> = {
  covered: "var(--positive)", specialist: "var(--accent)", cosmetic: "var(--warning)", dead: "var(--danger)",
};

export function AuthoringAuditPanel({ arc, compact = false }: { arc: Arc; compact?: boolean }): JSX.Element {
  const audit = auditArcAuthoring(arc);
  return (
    <section className="authoring-audit" data-testid="authoring-audit" data-passes={audit.passes ? "true" : "false"}>
      <div className="row between" style={{ gap: 12, alignItems: "baseline" }}>
        <strong>{t("authoring.auditHeading")}</strong>
        <span className="agent-meta" style={{ color: audit.passes ? "var(--positive)" : "var(--danger)" }}>
          {audit.warnings.length === 0 ? t("authoring.auditPass") : t("authoring.auditWarnings", { count: audit.warnings.length })}
        </span>
      </div>
      <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
        {audit.attributes.map((entry) => (
          <article key={entry.attributeId} data-testid={`attribute-coverage-${entry.attributeId}`} data-status={entry.status} style={{ border: "1px solid var(--rule)", padding: compact ? "6px 8px" : "8px 10px", background: "var(--paper-alt)" }}>
            <div className="row between" style={{ gap: 10 }}>
              <strong>{entry.attributeName}</strong>
              <span className="badge" style={{ color: TONE[entry.status], borderColor: TONE[entry.status] }}>{t(STATUS_ID[entry.status])}</span>
            </div>
            {!compact && <>
              <div className="agent-meta" style={{ marginTop: 4 }}>{t("authoring.roleLeads")}: {entry.roleIds.join(" · ") || t("authoring.none")}</div>
              <div className="agent-meta">{t("authoring.checkLeads")}: {entry.checkIds.join(" · ") || t("authoring.none")}</div>
              {entry.status === "specialist" && <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 12 }}>{t("authoring.specialistHint")}</p>}
              {(entry.status === "dead" || entry.status === "cosmetic") && <p style={{ margin: "6px 0 0", color: "var(--danger)", fontSize: 12 }}>{t("authoring.structuralHint")}</p>}
            </>}
          </article>
        ))}
      </div>
    </section>
  );
}
