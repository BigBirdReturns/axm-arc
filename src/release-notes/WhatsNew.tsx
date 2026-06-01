import { useEffect } from "react";
import { RELEASE_NOTES, type ReleaseNote } from "./notes.js";

// Slide-over modal that surfaces RELEASE_NOTES. Deliberately mirrors the codex
// Manual overlay's visual language and close affordances (Escape, backdrop
// click, Close button) so the two feel like one system. Arc-agnostic.

function NoteSection({
  label,
  items,
}: {
  label: string;
  items?: string[];
}): JSX.Element | null {
  if (!items || items.length === 0) return null;
  return (
    <div className="whatsnew-group">
      <h4 className="whatsnew-group-label">{label}</h4>
      <ul className="whatsnew-list">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function NoteEntry({ note }: { note: ReleaseNote }): JSX.Element {
  return (
    <section className="whatsnew-entry">
      <div className="whatsnew-entry-head">
        <h3 className="whatsnew-version">{note.version}</h3>
        <span className="whatsnew-date">{note.date}</span>
      </div>
      <p className="whatsnew-summary">{note.summary}</p>
      <NoteSection label="Added" items={note.added} />
      <NoteSection label="Changed" items={note.changed} />
      <NoteSection label="Fixed" items={note.fixed} />
    </section>
  );
}

export default function WhatsNew({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): JSX.Element | null {
  // Escape key + body scroll lock while open (mirrors CodexOverlay).
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

  return (
    <div
      className="codex-overlay-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="codex-overlay"
        role="dialog"
        aria-label="What's new"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="codex-close" onClick={onClose} aria-label="Close what's new">
          Close
        </button>
        <h2 className="codex-section-title whatsnew-title">What&apos;s new</h2>
        {RELEASE_NOTES.map((note) => (
          <NoteEntry key={note.version} note={note} />
        ))}
      </aside>
    </div>
  );
}
