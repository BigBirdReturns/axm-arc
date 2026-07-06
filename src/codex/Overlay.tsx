import { useEffect, type ReactNode } from "react";
import type { Arc, InfrastructureFacility, TrustLabel as TrustLabelValue } from "../engine/types.js";
import { DEFAULT_TRAIT_POOL } from "../engine/constants.js";
import AttributeRef from "./AttributeRef.js";
import RoleRef from "./RoleRef.js";
import TraitRef from "./TraitRef.js";
import FacilityRef from "./FacilityRef.js";
import MechanicCheckRef from "./MechanicCheckRef.js";
import TrustLabel from "./TrustLabel.js";
import { t, useLocale } from "../i18n/index.js";
import { useModalDialog } from "../lib/use-modal-dialog.js";

// Facilities are an engine-level fixed set, not arc data; list them in the same
// order BaseScreen presents them.
const FACILITY_ORDER: InfrastructureFacility[] = [
  "Quarters",
  "Recreation",
  "Production",
  "Training",
  "Research",
  "Medical",
  "Storage",
];

export default function CodexOverlay({
  arc,
  open,
  onClose,
  onReplayTutorial,
  onReplayTutorialLabel,
  trust,
}: {
  arc: Arc;
  open: boolean;
  onClose: () => void;
  onReplayTutorial?: () => void;
  onReplayTutorialLabel?: string;
  trust?: TrustLabelValue;
}): JSX.Element | null {
  useLocale(); // overlay renders above screens that may not re-render it — subscribe directly
  // Body scroll lock while open (Escape now comes from <dialog> cancel).
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const dialogRef = useModalDialog(onClose);

  if (!open) return null;

  // Resolved trait pool: engine defaults plus any arc-specific custom traits.
  const traits = [...DEFAULT_TRAIT_POOL, ...arc.customTraits];

  // Section list is data-driven so each new slice can add a section with a
  // single entry here — keep this array authoritative.
  const sections: Array<{ label: string; render: () => ReactNode }> = [
    {
      label: t("codex.attributes"),
      render: () => arc.attributes.map((a) => <AttributeRef key={a.id} arc={arc} id={a.id} />),
    },
    {
      label: t("codex.roles"),
      render: () => arc.roles.map((r) => <RoleRef key={r.id} arc={arc} id={r.id} />),
    },
    {
      label: t("codex.traits"),
      render: () => traits.map((trait) => <TraitRef key={trait.id} trait={trait} />),
    },
    {
      label: t("codex.facilities"),
      render: () => FACILITY_ORDER.map((f) => <FacilityRef key={f} facility={f} />),
    },
    {
      label: t("codex.howChallenges"),
      render: () =>
        arc.challenges.map((ch) => (
          <div key={ch.id} className="codex-challenge-group">
            <h3 className="codex-subheading">{ch.name}</h3>
            {ch.mechanicChecks.map((mc) => (
              <MechanicCheckRef key={mc.id} arc={arc} check={mc} />
            ))}
          </div>
        )),
    },
  ];

  return (
    <dialog
      ref={dialogRef}
      className="codex-overlay-backdrop"
      onClick={onClose}
      aria-label={t("codex.manualAria")}
    >
      <aside
        className="codex-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="codex-close" onClick={onClose} aria-label={t("codex.closeManualAria")}>
          {t("common.close")}
        </button>
        {trust && (
          <div
            className="codex-header"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <strong style={{ fontSize: 13 }}>{arc.meta.name}</strong>
            <TrustLabel trust={trust} />
          </div>
        )}
        {sections.map((s) => (
          <section key={s.label} className="codex-section">
            <h2 className="codex-section-title">{s.label}</h2>
            {s.render()}
          </section>
        ))}
        {onReplayTutorial && (
          <div className="codex-footer">
            <button
              type="button"
              className="codex-footer-action"
              onClick={() => {
                onReplayTutorial();
                onClose();
              }}
            >
              {onReplayTutorialLabel ?? t("codex.replayTutorial")}
            </button>
          </div>
        )}
      </aside>
    </dialog>
  );
}
