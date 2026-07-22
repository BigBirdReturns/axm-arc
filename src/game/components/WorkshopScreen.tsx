// Cartridge Workshop — an author-facing screen for writing or editing a
// cartridge as JSON, validated through the real import seam (arc-library.ts's
// validateArcJson, the same path importArcFromJson and exportArcToJson run).
// Layout mirrors LibraryScreen: same title-screen/title-content shell, same
// textarea-paste + Validate idiom, same export-download side effect.

import { useEffect, useState } from "react";
import type { Arc } from "../../engine/types.js";
import { cartridgeDigest } from "../../engine/cartridge-digest.js";
import { compatibilityProfile } from "../lib/ledger.js";
import {
  type ArcLibraryEntry,
  exportArcToJson,
  importArcFromJson,
  loadArcLibrary,
  validateArcJson,
} from "../lib/arc-library.js";
import {
  describeValidationErrors,
  loadWorkshopDraft,
  playtestPreview,
  saveWorkshopDraft,
  selectWorkshopDraft,
  summarizeArc,
  workshopSkeleton,
  type ArcSummary,
  type PlaytestReport,
} from "../lib/workshop.js";
import { t, useLocale } from "../../i18n/index.js";
import { AuthoringAuditPanel } from "./AuthoringAuditPanel.js";

interface Props {
  onBack: () => void;
  onOpenLibrary: () => void;
  seedArc?: Arc | null;
}

export function WorkshopScreen({ onBack, onOpenLibrary, seedArc = null }: Props): JSX.Element {
  useLocale(); // this screen renders outside App's play shell — subscribe directly
  const [initialDraft] = useState(() => selectWorkshopDraft(seedArc, loadWorkshopDraft()));
  const [text, setText] = useState<string>(initialDraft.text);
  const restoredFromStorage = initialDraft.origin === "stored-draft";
  const seededFromDesigner = initialDraft.origin === "selected-arc";

  // An explicit Designer handoff becomes the held browser draft immediately,
  // so reload, validation, save, and export all continue from the selected Arc
  // rather than an unrelated older draft. The editor text was already seeded
  // synchronously above; this effect only records that exact source for custody.
  useEffect(() => {
    if (seededFromDesigner) saveWorkshopDraft(initialDraft.text);
  }, [initialDraft.text, seededFromDesigner]);
  const [entries] = useState<ArcLibraryEntry[]>(() => loadArcLibrary());
  const [duplicateId, setDuplicateId] = useState("");

  const [validateErrors, setValidateErrors] = useState<string[]>([]);
  // arc is kept alongside digest+summary so the vocabulary profile section
  // (RFC_WORKSHOP PR 063) can call compatibilityProfile(validated.arc)
  // without a second parse — one validate, every downstream fact reuses it.
  const [validateResult, setValidateResult] = useState<{ digest: string; summary: ArcSummary; arc: Arc } | null>(null);

  const [playtestReport, setPlaytestReport] = useState<PlaytestReport | null>(null);

  const [saveErrors, setSaveErrors] = useState<string[] | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [exportErrors, setExportErrors] = useState<string[] | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  // Export receipt (RFC_WORKSHOP PR 064, parity with the Library's 076
  // receipt): digest is computed from the EXPORTED bytes (result.payload.json
  // re-parsed through validateArcJson — never a second validator), never from
  // in-memory state. matches compares that digest against the digest of the
  // draft validation that produced this same export (fresh in the handler,
  // not stale state).
  const [exportReceipt, setExportReceipt] = useState<{ digest: string | null; matches: boolean } | null>(null);

  // Any edit to the draft invalidates whatever the last Validate/Save/Export
  // run reported — stale results next to a changed editor would mislead.
  const clearResults = (): void => {
    setValidateErrors([]);
    setValidateResult(null);
    setPlaytestReport(null);
    setSaveErrors(null);
    setSaveMsg(null);
    setExportErrors(null);
    setExportMsg(null);
    setExportReceipt(null);
  };

  const setDraft = (next: string): void => {
    setText(next);
    saveWorkshopDraft(next);
    clearResults();
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setDraft(e.target.value);
  };

  const handleNewFromSkeleton = (): void => {
    setDraft(workshopSkeleton());
  };

  const handleDuplicateLoad = (): void => {
    const entry = entries.find((e) => e.arc.meta.id === duplicateId);
    if (!entry) return;
    setDraft(JSON.stringify(entry.arc, null, 2));
  };

  const handleFile = (file: File): void => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setDraft(content);
    };
    reader.readAsText(file);
  };

  const handleValidate = (): void => {
    setPlaytestReport(null);
    const result = validateArcJson(text);
    if (!result.ok) {
      setValidateErrors(result.errors);
      setValidateResult(null);
      return;
    }
    setValidateErrors([]);
    setValidateResult({ digest: cartridgeDigest(result.arc), summary: summarizeArc(result.arc), arc: result.arc });
  };

  const handlePlaytest = (): void => {
    // Re-validate the draft text through the same seam Validate uses — the
    // Playtest action never runs on text that hasn't just been confirmed
    // valid, and bails silently to the error panel (mirroring Save/Export)
    // if the draft drifted invalid since the last Validate click.
    const result = validateArcJson(text);
    if (!result.ok) {
      setValidateErrors(result.errors);
      setValidateResult(null);
      setPlaytestReport(null);
      return;
    }
    setValidateErrors([]);
    setValidateResult({ digest: cartridgeDigest(result.arc), summary: summarizeArc(result.arc), arc: result.arc });
    setPlaytestReport(playtestPreview(result.arc));
  };

  const handleSave = (): void => {
    setSaveErrors(null);
    setSaveMsg(null);
    const result = importArcFromJson(text);
    if (!result.ok) {
      setSaveErrors(result.errors);
      return;
    }
    setSaveMsg(t("workshop.saved", { name: result.entry.arc.meta.name, version: result.entry.arc.meta.version }));
  };

  const handleExport = (): void => {
    setExportErrors(null);
    setExportMsg(null);
    setExportReceipt(null);
    const validated = validateArcJson(text);
    if (!validated.ok) {
      setExportErrors(validated.errors);
      return;
    }
    const result = exportArcToJson(validated.arc as Arc);
    if (!result.ok) {
      setExportErrors(result.errors);
      return;
    }
    const blob = new Blob([result.payload.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.payload.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setExportMsg(t("workshop.exported", { name: validated.arc.meta.name, file: result.payload.filename }));

    // Export receipt (RFC_WORKSHOP PR 064, parity with the Library's 076
    // receipt): a true round-trip check. Re-parse the EXPORTED bytes (not
    // the in-memory arc) through the same validateArcJson — never a second
    // validator — and compare the resulting digest against the digest of
    // the draft validation that produced this export, computed fresh here
    // (not read from stale validateResult state, which may lag the current
    // Export click). This should always match; if it ever doesn't, the
    // author must see that honestly, never a false "ok".
    const draftDigest = cartridgeDigest(validated.arc);
    const reparsed = validateArcJson(result.payload.json);
    const receiptDigest = reparsed.ok ? cartridgeDigest(reparsed.arc) : null;
    const matches = receiptDigest !== null && receiptDigest === draftDigest;
    setExportReceipt({ digest: receiptDigest, matches });
  };

  return (
    <div className="title-screen" role="region" aria-label={t("workshop.heading")}>
      <div className="title-content" style={{ maxWidth: 900 }}>
        <div className="title-imprint">AXM</div>
        <div className="title-rule" />
        <h1 className="title-name">{t("workshop.heading")}</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
          {t("workshop.intro")}
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 20, alignItems: "center" }}>
          <button className="secondary" onClick={handleNewFromSkeleton}>
            {t("workshop.newFromSkeleton")}
          </button>

          <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("workshop.duplicateFromLibrary")}</span>
          <select
            aria-label={t("workshop.duplicateSelectAria")}
            value={duplicateId}
            onChange={(e) => setDuplicateId(e.target.value)}
          >
            <option value="">{t("workshop.duplicateSelectPlaceholder")}</option>
            {entries.map((entry) => (
              <option key={`${entry.arc.meta.id}:${entry.source}`} value={entry.arc.meta.id}>
                {entry.arc.meta.name}
              </option>
            ))}
          </select>
          <button className="secondary" onClick={handleDuplicateLoad} disabled={!duplicateId}>
            {t("workshop.duplicateLoad")}
          </button>

          <input
            type="file"
            accept="application/json,.json"
            aria-label={t("workshop.importFileAria")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>

        {entries.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>
            {t("workshop.duplicateEmptyLibrary")}
          </div>
        )}

        {seededFromDesigner && seedArc && (
          <div
            className="agent-meta workshop-draft-restored"
            data-testid="workshop-seeded-arc"
            role="status"
            style={{ marginTop: 12 }}
          >
            <strong>{t("workshop.seededFromDesigner", { name: initialDraft.arcName ?? seedArc.meta.name })}</strong>
            {" · "}
            <code title={cartridgeDigest(seedArc)}>{cartridgeDigest(seedArc).slice(0, 18)}…</code>
          </div>
        )}
        {restoredFromStorage && (
          <div className="agent-meta workshop-draft-restored" role="status" style={{ marginTop: 12 }}>
            {t("workshop.draftRestored")}
          </div>
        )}
        <div className="agent-meta workshop-draft-notice" style={{ marginTop: seededFromDesigner || restoredFromStorage ? 4 : 12 }}>
          {t("workshop.draftPersists")}
        </div>

        <textarea
          aria-label={t("workshop.editorAria")}
          value={text}
          onChange={handleTextChange}
          rows={20}
          style={{ width: "100%", marginTop: 16, fontFamily: "var(--mono)", fontSize: 12 }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <button className="primary accent" onClick={handleValidate}>
            {t("workshop.validate")}
          </button>
          <button className="primary" onClick={handleSave}>
            {t("workshop.saveToLibrary")}
          </button>
          <button className="secondary" onClick={handleExport}>
            {t("workshop.exportArc")}
          </button>
        </div>

        {validateErrors.length > 0 && (() => {
          const view = describeValidationErrors(validateErrors, text);
          return (
            <div className="warning workshop-error-panel" role="alert" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
              <strong>
                {t("workshop.validationFailed")} <span className="badge rn-num">{view.count}</span>
              </strong>
              <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                {view.items.map((item, i) => (
                  <li key={i} style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                    {item.line !== null && (
                      <span className="badge" style={{ marginRight: 6 }}>
                        {t("workshop.lineCol", { line: item.line, col: item.column ?? 0 })}
                      </span>
                    )}
                    {item.raw}
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {validateResult && (
          <div role="status" style={{ marginTop: 12, color: "var(--positive)" }}>
            <div
              style={{ fontWeight: 600 }}
              aria-label={`${t("workshop.validOk")} ${t("workshop.digest", { digest: validateResult.digest })}`}
            >
              {t("workshop.validOk")} {t("workshop.digest", { digest: validateResult.digest })}
            </div>
            <div className="agent-meta" style={{ marginTop: 4 }}>
              {t("workshop.countChallenges", { n: validateResult.summary.challenges })}
              {" · "}
              {t("workshop.countRoles", { n: validateResult.summary.roles })}
              {" · "}
              {t("workshop.countItems", { n: validateResult.summary.items })}
              {" · "}
              {t("workshop.countAttunementChains", { n: validateResult.summary.attunementChains })}
              {" · "}
              {t("workshop.countNarrativeEvents", { n: validateResult.summary.narrativeEvents })}
              {" · "}
              {t("workshop.countProgressionTiers", { n: validateResult.summary.progressionTiers })}
            </div>

            {(() => {
              // Author vocabulary profile (RFC_WORKSHOP PR 063) — pure reuse
              // of compatibilityProfile, the same derivation the Library's
              // per-card profile panel (074) renders, zero reimplementation.
              // Shape pinned by tests/game/library-profile.test.ts; no new
              // test added here. Always-on (not toggled): the author is
              // exactly the person who needs "what would a guild need to
              // carry in" visible the moment the draft validates, and this
              // is cheap to compute.
              const p = compatibilityProfile(validateResult.arc);
              const rows: [string, string[]][] = [
                [t("library.profileRoles"), p.roleIds],
                [t("library.profileAttributes"), p.attributeIds],
                [t("guildhall.tiers"), p.tierIds],
                [t("library.profileSlots"), p.itemSlots],
                [t("library.profileVocab"), p.checkVocab],
              ];
              return (
                <div className="workshop-profile agent-meta" style={{ marginTop: 8 }}>
                  <div title={p.profileDigest}>
                    <span>{t("library.profileDigest")}</span>{" "}
                    <span className="rn-num">{p.profileDigest.slice(0, 14)}…</span>
                  </div>
                  {rows.map(([label, values]) => (
                    <div key={label} style={{ marginTop: 4 }}>
                      <span>{label}</span> <span className="badge">{values.length}</span>{" "}
                      <span className="rn-num" style={{ wordBreak: "break-word" }}>
                        {values.join(" · ")}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}

            <AuthoringAuditPanel arc={validateResult.arc} />

            <div style={{ marginTop: 8 }}>
              <button className="secondary" onClick={handlePlaytest}>
                {t("workshop.playtest")}
              </button>
            </div>
          </div>
        )}

        {playtestReport && (
          <div className="workshop-playtest" role="status" style={{ marginTop: 12 }}>
            <div className="agent-meta">
              {t("workshop.playtestParams", { runs: playtestReport.seeds, cycles: playtestReport.maxCycles })}
            </div>
            <div className="stat-strip" style={{ marginTop: 8 }}>
              <div className="stat-cell">
                <span className="stat-lbl">{t("workshop.clearRate")}</span>
                <span className="stat-val rn-num">{Math.round(playtestReport.aggregate.clearRate * 100)}%</span>
              </div>
              <div className="stat-cell">
                <span className="stat-lbl">{t("workshop.stallRate")}</span>
                <span className="stat-val rn-num">{Math.round(playtestReport.aggregate.stallRate * 100)}%</span>
              </div>
              <div className="stat-cell">
                <span className="stat-lbl">{t("workshop.maxCycleRate")}</span>
                <span className="stat-val rn-num">{Math.round(playtestReport.aggregate.maxCycleRate * 100)}%</span>
              </div>
              <div className="stat-cell">
                <span className="stat-lbl">{t("workshop.gateViolations")}</span>
                <span className="stat-val rn-num">
                  {playtestReport.aggregate.totalGateViolations === 0 ? (
                    <span className="badge pass">0</span>
                  ) : (
                    playtestReport.aggregate.totalGateViolations
                  )}
                </span>
              </div>
              <div className="stat-cell">
                <span className="stat-lbl">{t("workshop.medianCurrency")}</span>
                <span className="stat-val rn-num">{playtestReport.aggregate.medianFinalCurrency}</span>
              </div>
            </div>

            <div className="audit-section" style={{ marginTop: 12 }}>{t("workshop.medianTierClear")}</div>
            {Object.entries(playtestReport.aggregate.medianTierClear).map(([tierId, cycle]) => (
              <div key={tierId} className="mechanic-row">
                <span className="agent-name">{tierId}</span>{" "}
                <span className="rn-num">{cycle === null ? t("archive.notRecorded") : cycle}</span>
              </div>
            ))}

            {Object.keys(playtestReport.aggregate.stallReasons).length > 0 && (
              <>
                <div className="audit-section" style={{ marginTop: 12 }}>{t("workshop.stallReasons")}</div>
                {Object.entries(playtestReport.aggregate.stallReasons).map(([reason, count]) => (
                  <div key={reason} className="mechanic-row">
                    <span className="agent-name">{reason}</span>{" "}
                    <span className="rn-num">{count}</span>
                  </div>
                ))}
              </>
            )}

            {Object.keys(playtestReport.aggregate.firstStalls).length > 0 && (
              <>
                <div className="audit-section" style={{ marginTop: 12 }}>{t("workshop.firstStalls")}</div>
                {Object.entries(playtestReport.aggregate.firstStalls).map(([challengeId, count]) => (
                  <div key={challengeId} className="mechanic-row">
                    <span className="agent-name">{challengeId}</span>{" "}
                    <span className="rn-num">{count}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {saveErrors && (
          <div className="warning" role="alert" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
            <strong>{t("workshop.saveBlocked")}</strong>
            <ul style={{ marginTop: 4, paddingLeft: 20 }}>
              {saveErrors.map((err, i) => (
                <li key={i} style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{err}</li>
              ))}
            </ul>
          </div>
        )}
        {saveMsg && (
          <div role="status" style={{ marginTop: 12, color: "var(--positive)", fontWeight: 600 }}>{saveMsg}</div>
        )}

        {exportErrors && (
          <div className="warning" role="alert" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
            <strong>{t("workshop.exportBlocked")}</strong>
            <ul style={{ marginTop: 4, paddingLeft: 20 }}>
              {exportErrors.map((err, i) => (
                <li key={i} style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{err}</li>
              ))}
            </ul>
          </div>
        )}
        {exportMsg && (
          <div role="status" style={{ marginTop: 12, color: "var(--positive)", fontWeight: 600 }}>{exportMsg}</div>
        )}

        {exportReceipt && (
          <div
            className="workshop-export-receipt agent-meta"
            role="status"
            style={{ marginTop: 4 }}
            title={exportReceipt.digest ?? undefined}
            aria-label={exportReceipt.digest ? `${t("archive.digest")} ${exportReceipt.digest}` : undefined}
          >
            <span>{t("archive.digest")}</span>{" "}
            <span className="rn-num">
              {exportReceipt.digest ? `${exportReceipt.digest.slice(0, 12)}…` : "—"}
            </span>{" "}
            {exportReceipt.matches ? (
              <span className="badge pass">{t("workshop.exportMatches")}</span>
            ) : (
              <span className="badge">{t("workshop.exportMismatch")}</span>
            )}
          </div>
        )}

        <div className="title-actions" style={{ marginTop: 32 }}>
          <button className="secondary" onClick={onBack}>
            {t("common.back")}
          </button>
          <button className="secondary workshop-to-library" onClick={onOpenLibrary}>
            {t("library.heading")}
          </button>
        </div>
      </div>
    </div>
  );
}
