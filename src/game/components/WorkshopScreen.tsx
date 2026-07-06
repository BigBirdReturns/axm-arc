// Cartridge Workshop — an author-facing screen for writing or editing a
// cartridge as JSON, validated through the real import seam (arc-library.ts's
// validateArcJson, the same path importArcFromJson and exportArcToJson run).
// Layout mirrors LibraryScreen: same title-screen/title-content shell, same
// textarea-paste + Validate idiom, same export-download side effect.

import { useState } from "react";
import type { Arc } from "../../engine/types.js";
import { cartridgeDigest } from "../../engine/cartridge-digest.js";
import {
  type ArcLibraryEntry,
  exportArcToJson,
  importArcFromJson,
  loadArcLibrary,
  validateArcJson,
} from "../lib/arc-library.js";
import { loadWorkshopDraft, saveWorkshopDraft, summarizeArc, workshopSkeleton, type ArcSummary } from "../lib/workshop.js";
import { t, useLocale } from "../../i18n/index.js";

interface Props {
  onBack: () => void;
}

export function WorkshopScreen({ onBack }: Props): JSX.Element {
  useLocale(); // this screen renders outside App's play shell — subscribe directly
  const [text, setText] = useState<string>(() => loadWorkshopDraft() ?? workshopSkeleton());
  const [entries] = useState<ArcLibraryEntry[]>(() => loadArcLibrary());
  const [duplicateId, setDuplicateId] = useState("");

  const [validateErrors, setValidateErrors] = useState<string[]>([]);
  const [validateResult, setValidateResult] = useState<{ digest: string; summary: ArcSummary } | null>(null);

  const [saveErrors, setSaveErrors] = useState<string[] | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [exportErrors, setExportErrors] = useState<string[] | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  // Any edit to the draft invalidates whatever the last Validate/Save/Export
  // run reported — stale results next to a changed editor would mislead.
  const clearResults = (): void => {
    setValidateErrors([]);
    setValidateResult(null);
    setSaveErrors(null);
    setSaveMsg(null);
    setExportErrors(null);
    setExportMsg(null);
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
    const result = validateArcJson(text);
    if (!result.ok) {
      setValidateErrors(result.errors);
      setValidateResult(null);
      return;
    }
    setValidateErrors([]);
    setValidateResult({ digest: cartridgeDigest(result.arc), summary: summarizeArc(result.arc) });
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
  };

  return (
    <div className="title-screen">
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

        {validateErrors.length > 0 && (
          <div className="warning" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
            <strong>{t("workshop.validationFailed")}</strong>
            <ul style={{ marginTop: 4, paddingLeft: 20 }}>
              {validateErrors.map((err, i) => (
                <li key={i} style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {validateResult && (
          <div style={{ marginTop: 12, color: "var(--positive)" }}>
            <div style={{ fontWeight: 600 }}>
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
          </div>
        )}

        {saveErrors && (
          <div className="warning" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
            <strong>{t("workshop.saveBlocked")}</strong>
            <ul style={{ marginTop: 4, paddingLeft: 20 }}>
              {saveErrors.map((err, i) => (
                <li key={i} style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{err}</li>
              ))}
            </ul>
          </div>
        )}
        {saveMsg && (
          <div style={{ marginTop: 12, color: "var(--positive)", fontWeight: 600 }}>{saveMsg}</div>
        )}

        {exportErrors && (
          <div className="warning" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
            <strong>{t("workshop.exportBlocked")}</strong>
            <ul style={{ marginTop: 4, paddingLeft: 20 }}>
              {exportErrors.map((err, i) => (
                <li key={i} style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{err}</li>
              ))}
            </ul>
          </div>
        )}
        {exportMsg && (
          <div style={{ marginTop: 12, color: "var(--positive)", fontWeight: 600 }}>{exportMsg}</div>
        )}

        <div className="title-actions" style={{ marginTop: 32 }}>
          <button className="secondary" onClick={onBack}>
            {t("common.back")}
          </button>
        </div>
      </div>
    </div>
  );
}
