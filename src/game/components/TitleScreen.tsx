import { useMemo, useState } from "react";
import type { Arc } from "../../engine/types.js";
import { loadSave } from "../lib/storage.js";
import { loadArcLibrary } from "../lib/arc-library.js";
import { CodexOverlay, TrustLabel } from "../../codex/index.js";
import { WhatsNew } from "../../release-notes/index.js";
import { VARIANT, VARIANT_LABELS } from "../../variants/index.js";
import { t, useLocale } from "../../i18n/index.js";

interface Props {
  arc: Arc;
  onContinue: () => void;
  onNewGame: () => void;
  onOpenLibrary: () => void;
  onOpenDesigner: () => void;
}

export function TitleScreen({ arc, onContinue, onNewGame, onOpenLibrary, onOpenDesigner }: Props): JSX.Element {
  useLocale(); // re-render this screen's chrome on locale switch
  const existing = loadSave(arc);
  const hasSave = existing !== null;
  const [manualOpen, setManualOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const activeTrust = useMemo(() => {
    const entries = loadArcLibrary();
    return entries.find((e) => e.arc.meta.id === arc.meta.id)?.trust ?? "bundled";
  }, [arc]);
  const labels = VARIANT_LABELS[VARIANT];

  return (
    <div className="title-screen">
      <div className="title-content">
        <div className="title-imprint">AXM</div>
        <div className="title-rule" />
        <h1 className="title-name">{arc.meta.name}</h1>
        <div className="title-meta" style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <span>
            {arc.meta.domain} · {arc.challenges.length} contracts · {Object.keys(arc.items).length > 0 ? `${arc.items.length} items` : ""}
          </span>
          <TrustLabel trust={activeTrust} />
        </div>
        <p className="title-abstract">{arc.meta.description}</p>

        <div
          className="title-kicker"
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginTop: 16,
          }}
        >
          {labels.kicker}
        </div>

        <div className="title-actions">
          {hasSave && (
            <button className="primary accent" onClick={onContinue}>
              {t("title.continue", { cycle: String(existing.org.cycle).padStart(2, "0") })}
            </button>
          )}
          <button
            className={hasSave ? "secondary" : "primary accent"}
            onClick={onNewGame}
          >
            {labels.ctaPlay}
          </button>
          <button
            className="secondary"
            onClick={onOpenLibrary}
          >
            {labels.ctaLibrary}
          </button>
          <button
            className="secondary"
            onClick={onOpenDesigner}
          >
            {t("common.designer")}
          </button>
          <button
            className="secondary"
            onClick={() => setManualOpen(true)}
          >
            {t("common.manual")}
          </button>
        </div>

        {hasSave && (
          <div className="title-save-info">
            <span>{t("title.agentsCount", { count: Object.keys(existing.org.agents).length })}</span>
            <span className="sep">·</span>
            <span>{t("title.reputation", { value: existing.org.reputation })}</span>
            <span className="sep">·</span>
            <span>{existing.org.resources.currency} {arc.currencyName.toLowerCase()}</span>
          </div>
        )}

        <div className="title-guarantees">
          <div className="title-guarantee">
            <span className="g-label">{t("title.guaranteeDeterministicLabel")}</span>
            <span className="g-body">{t("title.guaranteeDeterministicBody")}</span>
          </div>
          <div className="title-guarantee">
            <span className="g-label">{t("title.guaranteeOfflineLabel")}</span>
            <span className="g-body">{t("title.guaranteeOfflineBody")}</span>
          </div>
          <div className="title-guarantee">
            <span className="g-label">{t("title.guaranteePortableLabel")}</span>
            <span className="g-body">{t("title.guaranteePortableBody")}</span>
          </div>
        </div>

        <div className="title-colophon">
          {t("title.colophon", { version: arc.meta.version, engine: arc.meta.engineVersion })}
        </div>
        <div className="title-secondary-links">
          <a
            href="../designer-prototype/"
            target="_blank"
            rel="noopener noreferrer"
            className="title-secondary-link"
          >
            {t("title.designerPrototype")}
          </a>
          <button
            type="button"
            className="title-secondary-link"
            onClick={() => setWhatsNewOpen(true)}
          >
            {t("title.releaseNotes")}
          </button>
        </div>
      </div>
      <CodexOverlay
        arc={arc}
        open={manualOpen}
        onClose={() => setManualOpen(false)}
      />
      <WhatsNew open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
    </div>
  );
}
