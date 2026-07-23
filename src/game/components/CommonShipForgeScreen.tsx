import { useMemo, useState } from "react";
import type { Arc } from "../../engine/types.js";
import {
  clearCommonShipDraft,
  commonShipStarterJson,
  compileCommonShipJson,
  loadCommonShipDraft,
  playtestCommonShipArc,
  reliefCircuitJson,
  saveCommonShipDraft,
} from "../lib/common-ship-forge.js";

interface Props {
  onBack: () => void;
  onOpenLibrary: () => void;
  onPlayArc: (arc: Arc) => void;
}

function download(name: string, text: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function CommonShipForgeScreen({ onBack, onOpenLibrary, onPlayArc }: Props): JSX.Element {
  const [text, setText] = useState(() => loadCommonShipDraft() ?? reliefCircuitJson());
  const [message, setMessage] = useState<string | null>(null);
  const compiled = useMemo(() => compileCommonShipJson(text), [text]);
  const source = compiled.ok ? compiled.source : null;

  const saveDraft = () => {
    const result = saveCommonShipDraft(text);
    setMessage(result.ok ? "Common Ship source saved locally." : result.message);
  };
  const playtest = () => {
    if (!compiled.ok) { setMessage(compiled.errors.join("\n")); return; }
    const result = playtestCommonShipArc(compiled.arc);
    setMessage(`${result.cleared}/${result.seeds.length} seeds cleared; worst ${result.worstCycles} cycles; ${result.gateViolations} gate violations.${result.warnings.length ? ` ${result.warnings.join(" ")}` : ""}`);
  };

  return (
    <main className="designer-screen common-ship-forge" data-testid="common-ship-forge">
      <header className="designer-header">
        <div>
          <div className="eyebrow">BOOK III · COMMON SHIP FORGE</div>
          <h1>{source?.identity.title ?? "Common Ship source"}</h1>
          <p>{source?.controlQuestion ?? "Edit the exact registered source and compile it through Arc."}</p>
        </div>
        <div className="designer-actions">
          <button className="secondary" onClick={onOpenLibrary}>Library</button>
          <button className="secondary" onClick={onBack}>Back</button>
        </div>
      </header>

      <section className="designer-grid">
        <div className="designer-panel">
          <div className="panel-heading"><h2>Exact source</h2><span>common-ship-pocket/1</span></div>
          <textarea
            data-testid="common-ship-source"
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            style={{ width: "100%", minHeight: "62vh", fontFamily: "var(--mono)", fontSize: 12 }}
          />
        </div>
        <aside className="designer-panel">
          <div className="panel-heading"><h2>Authority</h2><span>{compiled.ok ? "valid" : "refused"}</span></div>
          {compiled.ok ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div>{compiled.source.embodimentProfiles.length} embodiment profiles</div>
              <div>{compiled.source.watches.length} watches</div>
              <div>{compiled.source.shipState.length} ship-state tracks</div>
              <div>{compiled.arc.challenges.length} compiled challenges</div>
            </div>
          ) : <pre className="warning" style={{ whiteSpace: "pre-wrap" }}>{compiled.errors.join("\n")}</pre>}
          <div className="designer-actions" style={{ marginTop: 16, display: "grid", gap: 8 }}>
            <button className="secondary" onClick={() => { setText(commonShipStarterJson()); setMessage("Loaded private Common Ship starter."); }}>Load starter</button>
            <button className="secondary" onClick={() => { setText(reliefCircuitJson()); setMessage("Loaded The Relief Circuit."); }}>Load Relief Circuit</button>
            <button className="secondary" onClick={saveDraft}>Save local draft</button>
            <button className="secondary" onClick={() => { const result = clearCommonShipDraft(); setMessage(result.ok ? "Local draft cleared." : result.message); }}>Clear local draft</button>
            <button className="secondary" disabled={!compiled.ok} onClick={playtest}>Run deterministic sweep</button>
            <button className="secondary" disabled={!compiled.ok} onClick={() => compiled.ok && download(`${compiled.source.identity.id}.ship.json`, `${JSON.stringify(compiled.source, null, 2)}\n`)}>Export source</button>
            <button className="secondary" disabled={!compiled.ok} onClick={() => compiled.ok && download(`${compiled.arc.meta.id}.arc.json`, `${JSON.stringify(compiled.arc, null, 2)}\n`)}>Export Arc</button>
            <button className="primary accent" disabled={!compiled.ok} onClick={() => compiled.ok && onPlayArc(compiled.arc)}>Open compiled Arc</button>
          </div>
          {message && <div role="status" style={{ marginTop: 14, whiteSpace: "pre-wrap" }}>{message}</div>}
        </aside>
      </section>
    </main>
  );
}
