import { useEffect, type ReactNode } from "react";
import type { Arc, InfrastructureFacility, TrustLabel as TrustLabelValue } from "../engine/types.js";
import { DEFAULT_TRAIT_POOL } from "../engine/constants.js";
import AttributeRef from "./AttributeRef.js";
import RoleRef from "./RoleRef.js";
import TraitRef from "./TraitRef.js";
import FacilityRef from "./FacilityRef.js";
import MechanicCheckRef from "./MechanicCheckRef.js";
import TrustLabel from "./TrustLabel.js";

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
  onReplayTutorialLabel = "Replay tutorial",
  trust,
}: {
  arc: Arc;
  open: boolean;
  onClose: () => void;
  onReplayTutorial?: () => void;
  onReplayTutorialLabel?: string;
  trust?: TrustLabelValue;
}): JSX.Element | null {
  // Escape key + body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  // Resolved trait pool: engine defaults plus any arc-specific custom traits.
  const traits = [...DEFAULT_TRAIT_POOL, ...arc.customTraits];

  // Section list is data-driven so each new slice can add a section with a
  // single entry here — keep this array authoritative.
  const sections: Array<{ label: string; render: () => ReactNode }> = [
    {
      label: "Attributes",
      render: () => arc.attributes.map((a) => <AttributeRef key={a.id} arc={arc} id={a.id} />),
    },
    {
      label: "Roles",
      render: () => arc.roles.map((r) => <RoleRef key={r.id} arc={arc} id={r.id} />),
    },
    {
      label: "Traits",
      render: () => traits.map((t) => <TraitRef key={t.id} trait={t} />),
    },
    {
      label: "Facilities",
      render: () => FACILITY_ORDER.map((f) => <FacilityRef key={f} facility={f} />),
    },
    {
      label: "How challenges resolve",
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
    <div
      className="codex-overlay-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="codex-overlay"
        role="dialog"
        aria-label="Manual"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="codex-close" onClick={onClose} aria-label="Close manual">
          Close
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
              {onReplayTutorialLabel}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
