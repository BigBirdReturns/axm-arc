import { useEffect, type ReactNode } from "react";
import type { Arc } from "../engine/types.js";
import AttributeRef from "./AttributeRef.js";
import RoleRef from "./RoleRef.js";

export default function CodexOverlay({
  arc,
  open,
  onClose,
}: {
  arc: Arc;
  open: boolean;
  onClose: () => void;
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

  // Section list is data-driven so the next slice can add Traits / Facilities /
  // MechanicChecks with a single entry here — keep this array authoritative.
  const sections: Array<{ label: string; render: () => ReactNode }> = [
    {
      label: "Attributes",
      render: () => arc.attributes.map((a) => <AttributeRef key={a.id} arc={arc} id={a.id} />),
    },
    {
      label: "Roles",
      render: () => arc.roles.map((r) => <RoleRef key={r.id} arc={arc} id={r.id} />),
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
        {sections.map((s) => (
          <section key={s.label} className="codex-section">
            <h2 className="codex-section-title">{s.label}</h2>
            {s.render()}
          </section>
        ))}
      </aside>
    </div>
  );
}
