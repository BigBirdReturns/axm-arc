// Arc library screen — lists every arc available to this engine, lets the
// user import new ones, inspect their data, and load a different one as the
// active arc. Arc-agnostic: no hardcoded ids.

import { useState } from "react";
import type { Arc } from "../../engine/types.js";
import { CodexOverlay, TrustLabel } from "../../codex/index.js";
import {
  type ArcLibraryEntry,
  importArcFromJson,
  loadArcLibrary,
  removeArc,
} from "../lib/arc-library.js";

interface Props {
  arc: Arc; // currently-active arc (for "this is loaded" badge)
  onBack: () => void;
  onLoadArc: (arcId: string) => void;
}

export function LibraryScreen({ arc, onBack, onLoadArc }: Props): JSX.Element {
  const [entries, setEntries] = useState<ArcLibraryEntry[]>(() => loadArcLibrary());
  const [jsonDraft, setJsonDraft] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [inspectEntry, setInspectEntry] = useState<ArcLibraryEntry | null>(null);

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
    const result = importArcFromJson(jsonDraft);
    if (!result.ok) {
      setImportErrors(result.errors);
      return;
    }
    setImportMsg(`Imported "${result.entry.arc.meta.name}" v${result.entry.arc.meta.version}.`);
    setJsonDraft("");
    refresh();
  };

  const handleRemove = (entry: ArcLibraryEntry) => {
    if (entry.source !== "imported") return;
    if (!confirm(`Remove "${entry.arc.meta.name}" from the library? Bundled arcs cannot be removed; only imported ones.`)) return;
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
        <h1 className="title-name">Library</h1>
        <div className="title-meta">
          {entries.length} arc{entries.length === 1 ? "" : "s"} available
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
          {entries.map((entry) => {
            const isActive = entry.arc.meta.id === arc.meta.id;
            return (
              <div key={`${entry.arc.meta.id}:${entry.source}`} className="card" style={{ padding: 12 }}>
                <div className="row between" style={{ alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 16 }}>{entry.arc.meta.name}</strong>
                      <TrustLabel trust={entry.trust} />
                      {isActive && <span className="badge pass">Active</span>}
                    </div>
                    <div className="agent-meta" style={{ marginTop: 4 }}>
                      v{entry.arc.meta.version} · {entry.arc.meta.domain} · {entry.arc.meta.author} · {entry.source}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button className="secondary" onClick={() => setInspectEntry(entry)}>
                      Inspect
                    </button>
                    <button className="primary" onClick={() => handleLoad(entry)}>
                      {isActive ? "Resume" : "Load"}
                    </button>
                    {entry.source === "imported" && (
                      <button className="icon" onClick={() => handleRemove(entry)} aria-label="Remove arc">
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 32 }}>
          <h2 className="codex-section-title">Import arc</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Paste arc JSON below, or upload a file. Import runs schema validation;
            invalid arcs are rejected with a line-by-line explanation.
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
              Validate & Save
            </button>
          </div>

          {importErrors.length > 0 && (
            <div className="warning" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
              <strong>Validation failed:</strong>
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
        </div>

        <div className="title-actions" style={{ marginTop: 32 }}>
          <button className="secondary" onClick={onBack}>
            Back
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
