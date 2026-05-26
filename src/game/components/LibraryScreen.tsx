import { useRef, useState } from "react";
import type { Arc } from "../../engine/types.js";
import type { ArcLibraryEntry } from "../lib/storage.js";
import { importArcFromJson } from "../lib/storage.js";

interface Props {
  arcs: ArcLibraryEntry[];
  bundledArc: Arc;
  onBack: () => void;
  onRefresh: () => void;
}

export function LibraryScreen({ arcs, bundledArc, onBack, onRefresh }: Props): JSX.Element {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [msg, setMsg] = useState<string>("");

  return (
    <div className="title-screen">
      <div className="title-content">
        <h1 className="title-name">Arc Library</h1>
        <p className="title-abstract">Bundled and imported arcs. Imported arcs are marked unsigned by default.</p>

        <div className="title-actions">
          <button className="primary accent" onClick={() => fileRef.current?.click()}>Import Arc JSON</button>
          <button className="secondary" onClick={onBack}>Back</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                const entry = importArcFromJson(text);
                setMsg(`Imported ${entry.name} v${entry.version} (unsigned).`);
                onRefresh();
              } catch (err) {
                setMsg(`Import failed: ${String(err)}`);
              }
            }}
          />
        </div>
        {msg && <div className="warning">{msg}</div>}

        <div className="reports-list" style={{ marginTop: 16 }}>
          {[{ arcId: bundledArc.meta.id, name: bundledArc.meta.name, version: bundledArc.meta.version, domain: bundledArc.meta.domain, challengeCount: bundledArc.challenges.length, itemCount: bundledArc.items.length, trustLevel: "bundled" },
            ...arcs.filter((a) => a.sourceType === "imported")].map((entry, i) => (
            <div key={`${entry.arcId}-${entry.version}-${i}`} className="card">
              <div className="row between">
                <strong>{entry.name}</strong>
                <span className="badge role">{entry.trustLevel === "bundled" ? "Bundled" : "Imported"}</span>
              </div>
              <div className="agent-meta">{entry.domain} · v{entry.version}</div>
              <div className="agent-meta">{entry.challengeCount} contracts · {entry.itemCount} items</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
