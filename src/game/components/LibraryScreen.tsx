// Arc library screen — lists every arc available to this engine, lets the
// user import new ones, inspect their data, and load a different one as the
// active arc. Arc-agnostic: no hardcoded ids.

import { useMemo, useState } from "react";
import type { Arc } from "../../engine/types.js";
import { CodexOverlay, TrustLabel } from "../../codex/index.js";
import { cartridgeDigest } from "../../engine/cartridge-digest.js";
import {
  type ArcLibraryEntry,
  type ImportPreflight,
  exportArcToJson,
  importArcFromJson,
  importPreflight,
  loadArcLibrary,
  removeArc,
} from "../lib/arc-library.js";
import { KarazhanEmblem, isKarazhan } from "../karazhan-theme.js";
import { t, useLocale } from "../../i18n/index.js";

interface Props {
  arc: Arc; // currently-active arc (for "this is loaded" badge)
  onBack: () => void;
  onLoadArc: (arcId: string) => void;
}

export function LibraryScreen({ arc, onBack, onLoadArc }: Props): JSX.Element {
  useLocale(); // this screen renders outside App's play shell — subscribe directly
  const [entries, setEntries] = useState<ArcLibraryEntry[]>(() => loadArcLibrary());
  const [jsonDraft, setJsonDraft] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<Extract<ImportPreflight, { ok: true }> | null>(null);
  const [exportErrors, setExportErrors] = useState<{ arcName: string; errors: string[] } | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [inspectEntry, setInspectEntry] = useState<ArcLibraryEntry | null>(null);

  // Content-identity anchor per entry, computed once per entries change — the
  // same fact the Archive joins by and world's boot-import verifies against
  // (RFC_CARTRIDGE_LIBRARY PR 072). Keyed by id+source to match the card key.
  const digests = useMemo(
    () => new Map(entries.map((e) => [e.arc.meta.id + ":" + e.source, cartridgeDigest(e.arc)])),
    [entries],
  );

  const refresh = () => setEntries(loadArcLibrary());

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setJsonDraft(text);
    };
    reader.readAsText(file);
  };

  const handleValidate = () => {
    setImportErrors([]);
    setImportMsg(null);
    setPreflight(null);
    // Additive custody report (RFC_CARTRIDGE_LIBRARY PR 073): computed BEFORE
    // the write, from the library as it stands right now, reusing
    // validateArcJson verbatim (via importPreflight) — never a second
    // validator. The write itself below is byte-for-byte unchanged: one
    // click still validates AND saves.
    const pre = importPreflight(jsonDraft, entries);
    const result = importArcFromJson(jsonDraft);
    if (!result.ok) {
      setImportErrors(result.errors);
      return;
    }
    setImportMsg(t("library.imported", { name: result.entry.arc.meta.name, version: result.entry.arc.meta.version }));
    if (pre.ok) setPreflight(pre);
    setJsonDraft("");
    refresh();
  };

  // Download the exact library arc as a world-loadable cartridge file. The
  // validate/serialize half lives in arc-library.ts (exportArcToJson); this
  // handler only owns the browser download side-effect.
  const handleExport = (entry: ArcLibraryEntry) => {
    setExportErrors(null);
    setExportMsg(null);
    const result = exportArcToJson(entry.arc);
    if (!result.ok) {
      setExportErrors({ arcName: entry.arc.meta.name, errors: result.errors });
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
    setExportMsg(t("library.exported", { name: entry.arc.meta.name, file: result.payload.filename }));
  };

  const handleRemove = (entry: ArcLibraryEntry) => {
    if (entry.source !== "imported") return;
    if (!confirm(t("confirm.removeArc", { name: entry.arc.meta.name }))) return;
    removeArc(entry.arc.meta.id);
    refresh();
  };

  const handleLoad = (entry: ArcLibraryEntry) => {
    if (entry.arc.meta.id === arc.meta.id) {
      onBack();
      return;
    }
    onLoadArc(entry.arc.meta.id);
  };

  return (
    <div className="title-screen">
      <div className="title-content" style={{ maxWidth: 800 }}>
        <div className="title-imprint">AXM</div>
        <div className="title-rule" />
        <h1 className="title-name">{t("library.heading")}</h1>
        <div className="title-meta">
          {t("library.arcsAvailable", { n: entries.length })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
          {entries.map((entry) => {
            const isActive = entry.arc.meta.id === arc.meta.id;
            const karazhan = isKarazhan(entry.arc.meta.id);
            return (
              <div
                key={`${entry.arc.meta.id}:${entry.source}`}
                className="card"
                data-arc={karazhan ? "karazhan" : undefined}
                style={{ padding: 12 }}
              >
                <div className="row between" style={{ alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {karazhan && (
                        <span className="karazhan-emblem" aria-hidden="true">
                          <KarazhanEmblem size={20} />
                        </span>
                      )}
                      <strong style={{ fontSize: 16 }}>{entry.arc.meta.name}</strong>
                      <TrustLabel trust={entry.trust} />
                      {isActive && <span className="badge pass">{t("library.active")}</span>}
                    </div>
                    <div className="agent-meta" style={{ marginTop: 4 }}>
                      v{entry.arc.meta.version} · {entry.arc.meta.domain} · {entry.arc.meta.author} · {entry.source}
                    </div>
                    {(() => {
                      const digest = digests.get(entry.arc.meta.id + ":" + entry.source)!;
                      return (
                        <div className="agent-meta library-digest" title={digest}>
                          <span>{t("archive.digest")}</span> <span className="rn-num">{digest.slice(0, 12)}…</span>
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button className="secondary" onClick={() => setInspectEntry(entry)}>
                      {t("library.inspect")}
                    </button>
                    <button
                      className="secondary"
                      data-testid={`export-arc-${entry.arc.meta.id}`}
                      onClick={() => handleExport(entry)}
                    >
                      {t("library.export")}
                    </button>
                    <button className="primary" onClick={() => handleLoad(entry)}>
                      {isActive ? t("library.resume") : t("library.load")}
                    </button>
                    {entry.source === "imported" && (
                      <button className="icon" onClick={() => handleRemove(entry)} aria-label={t("library.removeAria")}>
                        {t("common.remove")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {exportErrors && (
          <div className="warning" data-testid="export-errors" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
            <strong>{t("library.exportBlocked", { name: exportErrors.arcName })}</strong>
            <ul style={{ marginTop: 4, paddingLeft: 20 }}>
              {exportErrors.errors.map((err, i) => (
                <li key={i} style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                  {err}
                </li>
              ))}
            </ul>
          </div>
        )}

        {exportMsg && (
          <div data-testid="export-success" style={{ marginTop: 12, color: "var(--positive)", fontWeight: 600 }}>
            {exportMsg}
          </div>
        )}

        <div style={{ marginTop: 32 }}>
          <h2 className="codex-section-title">{t("library.importArc")}</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            {t("library.importHelp")}
          </p>

          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            style={{ display: "block", marginTop: 8 }}
          />

          <textarea
            value={jsonDraft}
            onChange={(e) => setJsonDraft(e.target.value)}
            placeholder='{ "meta": { "id": "...", ... }, "attributes": [...], ... }'
            rows={10}
            style={{ width: "100%", marginTop: 8, fontFamily: "var(--mono)", fontSize: 12 }}
          />

          <div style={{ marginTop: 8 }}>
            <button
              className="primary accent"
              onClick={handleValidate}
              disabled={jsonDraft.trim().length === 0}
            >
              {t("library.validateSave")}
            </button>
          </div>

          {importErrors.length > 0 && (
            <div className="warning" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
              <strong>{t("library.validationFailed")}</strong>
              <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                {importErrors.map((err, i) => (
                  <li key={i} style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {importMsg && (
            <div style={{ marginTop: 12, color: "var(--positive)", fontWeight: 600 }}>
              {importMsg}
            </div>
          )}

          {preflight && (
            <div className="library-preflight agent-meta" style={{ marginTop: 8 }}>
              <div title={preflight.digest}>
                <span>{t("archive.digest")}</span>{" "}
                <span className="rn-num">{preflight.digest.slice(0, 12)}…</span>
              </div>
              <div style={{ marginTop: 4 }}>
                {preflight.action === "new" && (
                  <span className="badge pass">{t("library.preflightNew")}</span>
                )}
                {preflight.action === "update" && preflight.existing && (
                  <span className="badge pending" title={preflight.existing.digest}>
                    {t("library.preflightUpdate")} — v{preflight.existing.version} ·{" "}
                    <span className="rn-num">{preflight.existing.digest.slice(0, 12)}…</span>
                  </span>
                )}
                {preflight.action === "duplicate" && preflight.existing && (
                  <span className="badge" title={preflight.existing.digest}>
                    {t("library.preflightDuplicate")}
                  </span>
                )}
              </div>
              {preflight.sameIdBundled && (
                <div style={{ marginTop: 4 }}>
                  <span className="badge">
                    {t("library.preflightBundledSameId")} — v{preflight.sameIdBundled.version}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="title-actions" style={{ marginTop: 32 }}>
          <button className="secondary" onClick={onBack}>
            {t("common.back")}
          </button>
        </div>
      </div>

      {inspectEntry && (
        <CodexOverlay
          arc={inspectEntry.arc}
          open={true}
          onClose={() => setInspectEntry(null)}
        />
      )}
    </div>
  );
}
