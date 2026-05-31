import { useState } from "react";
import type { Arc } from "../../engine/types.js";
import { loadSave } from "../lib/storage.js";
import { CodexOverlay } from "../../codex/index.js";

interface Props {
  arc: Arc;
  onContinue: () => void;
  onNewGame: () => void;
}

export function TitleScreen({ arc, onContinue, onNewGame }: Props): JSX.Element {
  const existing = loadSave(arc);
  const hasSave = existing !== null;
  const [manualOpen, setManualOpen] = useState(false);

  return (
    <div className="title-screen">
      <div className="title-content">
        <div className="title-imprint">AXM</div>
        <div className="title-rule" />
        <h1 className="title-name">{arc.meta.name}</h1>
        <div className="title-meta">
          {arc.meta.domain} · {arc.challenges.length} contracts · {Object.keys(arc.items).length > 0 ? `${arc.items.length} items` : ""}
        </div>
        <p className="title-abstract">{arc.meta.description}</p>

        <div className="title-actions">
          {hasSave && (
            <button className="primary accent" onClick={onContinue}>
              Continue · Cycle {String(existing.org.cycle).padStart(2, "0")}
            </button>
          )}
          <button
            className={hasSave ? "secondary" : "primary accent"}
            onClick={onNewGame}
          >
            New Game
          </button>
          <button
            className="secondary"
            onClick={() => setManualOpen(true)}
          >
            Manual
          </button>
        </div>

        {hasSave && (
          <div className="title-save-info">
            <span>{Object.keys(existing.org.agents).length} agents</span>
            <span className="sep">·</span>
            <span>Reputation {existing.org.reputation}</span>
            <span className="sep">·</span>
            <span>{existing.org.resources.currency} {arc.currencyName.toLowerCase()}</span>
          </div>
        )}

        <div className="title-guarantees">
          <div className="title-guarantee">
            <span className="g-label">Deterministic</span>
            <span className="g-body">Same seed, same run</span>
          </div>
          <div className="title-guarantee">
            <span className="g-label">Offline</span>
            <span className="g-body">No API, no cloud</span>
          </div>
          <div className="title-guarantee">
            <span className="g-label">Portable</span>
            <span className="g-body">JSON arc format</span>
          </div>
        </div>

        <div className="title-colophon">
          AXM Arc · v{arc.meta.version} · Engine {arc.meta.engineVersion}
        </div>
        <div className="title-secondary-links">
          <a
            href="../designer-prototype/"
            target="_blank"
            rel="noopener noreferrer"
            className="title-secondary-link"
          >
            Designer Prototype
          </a>
        </div>
      </div>
      <CodexOverlay
        arc={arc}
        open={manualOpen}
        onClose={() => setManualOpen(false)}
      />
    </div>
  );
}
