import { useMemo, useState } from "react";
import type { Arc } from "../../engine/types.js";
import { loadSave } from "../lib/storage.js";
import { cartridgeDigest } from "../../engine/cartridge-digest.js";
import { loadArcLibrary } from "../lib/arc-library.js";
import { CodexOverlay, TrustLabel } from "../../codex/index.js";
import { WhatsNew } from "../../release-notes/index.js";
import { VARIANT, VARIANT_LABELS } from "../../variants/index.js";
import { t, useLocale } from "../../i18n/index.js";
import { LocaleSwitcher } from "../../i18n/LocaleSwitcher.js";

interface Props {
  arc: Arc;
  onContinue: () => void;
  onNewGame: () => void;
  onExportRun: () => void;
  saveFailure: string | null;
  exportMessage: string | null;
  onOpenLibrary: () => void;
  onOpenDesigner: () => void;
  onOpenWorkshop: () => void;
  onOpenRaidNight: () => void;
  onOpenGuildHall: () => void;
  onOpenArchive: () => void;
}

export function TitleScreen({ arc, onContinue, onNewGame, onExportRun, saveFailure, exportMessage, onOpenLibrary, onOpenDesigner, onOpenWorkshop, onOpenRaidNight, onOpenGuildHall, onOpenArchive }: Props): JSX.Element {
  useLocale(); // re-render this screen's chrome on locale switch
  const existing = loadSave(arc);
  const hasSave = existing !== null;
  const [manualOpen, setManualOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const activeTrust = useMemo(() => {
    const digest = cartridgeDigest(arc);
    return loadArcLibrary().find((entry) => cartridgeDigest(entry.arc) === digest)?.trust ?? "bundled";
  }, [arc]);
  const labels = VARIANT_LABELS[VARIANT];

  return (
    <div className="title-screen">
      {/* Locale switch must be reachable before entering play — the header
          switcher only exists inside the play shell. Pinned to the corner so
          the tall centered column can't push it off-viewport. */}
      <div style={{ position: "fixed", top: 12, right: 12, zIndex: 10 }}>
        <LocaleSwitcher />
      </div>
      <div className="title-content">
        <div className="title-imprint">AXM</div>
        <div className="title-rule" />
        <h1 className="title-name">{arc.meta.name}</h1>
        <div className="title-meta" style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <span>
            {arc.meta.domain} · {t("title.contractsItems", { contracts: arc.challenges.length, items: Object.keys(arc.items).length > 0 ? arc.items.length : 0 })}
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
          {hasSave && (
            <button className="secondary" onClick={onExportRun}>
              {t("common.exportRun")}
            </button>
          )}
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
            onClick={onOpenWorkshop}
          >
            {t("title.workshop")}
          </button>
          <button
            className="secondary"
            onClick={onOpenRaidNight}
          >
            {t("title.raidNight")}
          </button>
          <button
            className="secondary"
            onClick={onOpenGuildHall}
          >
            {t("title.guildHall")}
          </button>
          <button
            className="secondary"
            onClick={onOpenArchive}
          >
            {t("archive.title")}
          </button>
          <button
            className="secondary"
            onClick={() => setManualOpen(true)}
          >
            {t("common.manual")}
          </button>
        </div>

        {saveFailure && (
          <div className="warning" role="alert" style={{ marginTop: 16 }}>
            {t("save.unsaved", { reason: saveFailure })}{" "}
            <button className="secondary" type="button" onClick={onExportRun}>
              {t("common.exportRun")}
            </button>
          </div>
        )}
        {exportMessage && (
          <div role="status" style={{ marginTop: 12, color: "var(--positive)", fontWeight: 600 }}>
            {exportMessage}
          </div>
        )}

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
