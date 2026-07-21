import { useState } from "react";
import type { Arc } from "../../engine/types.js";
import { KIND_GODS_OF_ILYON_BLUEPRINT } from "../../godscar/templates.js";
import { importArcFromJson } from "../lib/arc-library.js";
import {
  compileGodscarJson,
  godscarSkeletonJson,
  loadGodscarDraft,
  playtestGodscarArc,
  saveGodscarDraft,
  type GodscarCompileResult,
} from "../lib/godscar-forge.js";

interface Props {
  onBack: () => void;
  onOpenLibrary: () => void;
  onPlayArc: (arc: Arc) => void;
}

function download(filename: string, json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function GodscarForgeScreen({ onBack, onOpenLibrary, onPlayArc }: Props): JSX.Element {
  const [text, setText] = useState(() => loadGodscarDraft() ?? godscarSkeletonJson());
  const [result, setResult] = useState<GodscarCompileResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [playtest, setPlaytest] = useState<ReturnType<typeof playtestGodscarArc> | null>(null);

  const replaceDraft = (next: string) => {
    setText(next);
    const write = saveGodscarDraft(next);
    setMessage(write.ok ? null : write.message);
    setResult(null);
    setPlaytest(null);
  };

  const compile = (): Extract<GodscarCompileResult, { ok: true }> | null => {
    const next = compileGodscarJson(text);
    setResult(next);
    setPlaytest(null);
    return next.ok ? next : null;
  };

  const install = () => {
    const compiled = compile();
    if (!compiled) return;
    const installed = importArcFromJson(JSON.stringify(compiled.arc));
    setMessage(installed.ok
      ? `Installed “${installed.entry.arc.meta.name}” as an imported, unsigned cartridge.`
      : installed.errors.join(" "));
  };

  return (
    <div className="title-screen" role="region" aria-label="Godscar Pocket Forge">
      <div className="title-content" style={{ maxWidth: 1060, width: "min(1060px, 96vw)" }}>
        <div className="title-imprint">GODSCAR</div>
        <div className="title-rule" />
        <h1 className="title-name">Pocket Forge</h1>
        <p style={{ color: "var(--muted)", maxWidth: 800, marginInline: "auto" }}>
          Begin with a complete six-pressure story machine, not an empty page. The source stays yours; validation compiles it into an ordinary content-addressed Arc that any compatible runtime can receive.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", margin: "18px 0 10px" }}>
          <button className="secondary" onClick={() => replaceDraft(godscarSkeletonJson())}>New pocket</button>
          <button className="secondary" onClick={() => replaceDraft(JSON.stringify(KIND_GODS_OF_ILYON_BLUEPRINT, null, 2))}>Load Ilyon reference</button>
          <label className="secondary" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
            Import .pocket.json
            <input type="file" accept="application/json,.json,.pocket.json" style={{ display: "none" }} onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) replaceDraft(await file.text());
            }} />
          </label>
          <button className="secondary" onClick={onOpenLibrary}>Library</button>
          <button className="secondary" onClick={onBack}>Back</button>
        </div>

        <textarea
          data-testid="godscar-forge-editor"
          aria-label="Godscar pocket JSON editor"
          rows={25}
          value={text}
          onChange={(event) => replaceDraft(event.target.value)}
          style={{ width: "100%", fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.45 }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          <button className="primary accent" onClick={compile}>Validate & compile</button>
          <button className="secondary" onClick={() => {
            const compiled = compile();
            if (compiled) setPlaytest(playtestGodscarArc(compiled.arc));
          }}>Seeded playtest</button>
          <button className="secondary" onClick={install}>Install cartridge</button>
          <button className="secondary" onClick={() => {
            const compiled = compile();
            if (compiled) download(`${compiled.source.identity.id}.pocket.json`, JSON.stringify(compiled.source, null, 2));
          }}>Export source</button>
          <button className="secondary" onClick={() => {
            const compiled = compile();
            if (compiled) download(`${compiled.arc.meta.id}.arc.json`, JSON.stringify(compiled.arc, null, 2));
          }}>Export compiled Arc</button>
          <button className="secondary" onClick={() => {
            const compiled = compile();
            if (compiled) onPlayArc(compiled.arc);
          }}>Open compiled cartridge</button>
        </div>

        {message && <div role="status" className="warning" style={{ marginTop: 12 }}>{message}</div>}
        {result && !result.ok && (
          <div role="alert" className="warning" style={{ marginTop: 12, textAlign: "left" }}>
            <strong>Compilation refused</strong>
            <ul>{result.errors.map((error, index) => <li key={index}>{error}</li>)}</ul>
          </div>
        )}
        {result?.ok && (
          <section data-testid="godscar-forge-summary" style={{ marginTop: 16, textAlign: "left", border: "1px solid var(--rule)", padding: 16, background: "var(--paper-alt)" }}>
            <div style={{ fontFamily: "var(--mono)", color: "var(--positive)", fontWeight: 700 }}>VALID · {result.digest}</div>
            <h2 style={{ marginBottom: 4 }}>{result.summary.title}</h2>
            <p style={{ marginTop: 0 }}><strong>{result.summary.canonTier}</strong> · {result.summary.canonRelation}</p>
            <blockquote style={{ marginInline: 0 }}>{result.summary.controlQuestion}</blockquote>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
              {result.summary.pressures.map((pressure, index) => (
                <div key={pressure.kind} data-testid={`godscar-pressure-${index + 1}`} className="card" style={{ padding: 10 }}>
                  <div className="agent-meta">{index + 1} · {pressure.kind}</div>
                  <strong>{pressure.label}</strong>
                </div>
              ))}
            </div>
            <p>{result.summary.castCount} cast responsibilities · {result.summary.factionCount} faction receipts · {result.summary.consequenceCount} persistent consequences · {result.summary.beatCount} playable beats</p>
          </section>
        )}
        {playtest && (
          <section data-testid="godscar-playtest" style={{ marginTop: 12, textAlign: "left", border: "1px solid var(--rule)", padding: 16 }}>
            <strong>Bounded playtest</strong>
            <p>{playtest.seeds} exact founding seeds · clear rate {(playtest.clearRate * 100).toFixed(0)}% · stalls {(playtest.stallRate * 100).toFixed(0)}% · gate violations {playtest.totalGateViolations}</p>
            <p style={{ color: "var(--muted)" }}>This proves engine reachability, not human comprehension or story quality.</p>
          </section>
        )}
      </div>
    </div>
  );
}
