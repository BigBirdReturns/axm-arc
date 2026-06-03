import "../styles/designer.css";
import type { Arc } from "../../engine/types.js";
import { DEFAULT_TRAIT_POOL } from "../../engine/constants.js";

interface Props {
  arc: Arc;
  onBack: () => void;
}

// Designer port — Step 1: static authoring scaffold.
// Three-pane layout (rail / editor / engine-record) rendered as a visual
// shell. NO roster state, NO engine generation, NO persistence — those are
// steps 2-4 in DESIGNER_PORT.md. Labels read from arc data so the shell is
// arc-agnostic from the start; the agent rows and record JSON are static
// placeholders illustrating the eventual shape.

const SECTIONS = ["Roster", "Items", "Challenges", "Arc"] as const;

// Static placeholder roster for the rail (visual only — not engine agents).
const PLACEHOLDER_AGENTS = [
  { initials: "AX", name: "New Agent", role: "—", tier: "—", selected: true },
  { initials: "··", name: "Empty slot", role: "—", tier: "—", selected: false },
  { initials: "··", name: "Empty slot", role: "—", tier: "—", selected: false },
];

export function DesignerScreen({ arc, onBack }: Props): JSX.Element {
  const tiers = arc.tiers ?? [];
  const roles = arc.roles ?? [];
  const attributes = arc.attributes ?? [];
  const firstTier = tiers[0];

  // Illustrative engine-record placeholder — shows the Agent shape the record
  // pane will render live once state is wired (step 2).
  const sampleRecord = {
    id: "agent_0001",
    name: "New Agent",
    role: roles[0]?.id ?? null,
    tier: firstTier?.id ?? null,
    attributes: Object.fromEntries(attributes.map((a) => [a.id, 10])),
    traits: [],
  };

  return (
    <div className="designer-screen" data-designer-step="1">
      <header className="d-topbar">
        <button className="d-back" onClick={onBack} aria-label="Back to title">
          ‹ Back
        </button>
        <div className="d-title">
          <span className="d-title-kicker">Designer</span>
          <span className="d-title-arc">{arc.meta.name}</span>
        </div>
        <nav className="d-section-nav">
          {SECTIONS.map((s) => (
            <button key={s} className={s === "Roster" ? "on" : ""} disabled={s !== "Roster"}>
              {s}
            </button>
          ))}
        </nav>
      </header>

      <div className="d-body">
        {/* ── LEFT RAIL ─────────────────────────────────────────── */}
        <aside className="rail">
          <div className="rail-head">
            <span className="rail-title">Roster</span>
            <button className="rail-add" disabled>+ Agent</button>
          </div>
          <div className="rail-list">
            {PLACEHOLDER_AGENTS.map((a, i) => (
              <div key={i} className={`rail-card${a.selected ? " on" : ""}`}>
                <span className="rail-mono">{a.initials}</span>
                <span className="rail-info">
                  <span className="rail-name">{a.name}</span>
                  <span className="rail-sub">{a.role} · {a.tier}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="rail-foot">
            <span className="d-muted">Upkeep tally</span>
            <span className="d-muted">— ⟡</span>
          </div>
        </aside>

        {/* ── CENTER EDITOR ─────────────────────────────────────── */}
        <main className="d-editor">
          <div className="d-panel">
            <div className="d-identity">
              <span className="d-portrait" aria-hidden="true">AX</span>
              <div className="d-id-fields">
                <input className="d-name-input" value="New Agent" readOnly />
                <div className="d-derived">
                  <span className="d-stat">role fit <b>—</b></span>
                  <span className="d-stat">upkeep <b>—⟡</b></span>
                  {firstTier && (
                    <span className="d-stat">
                      budget <b>—</b>/{firstTier.statBudgetMin}–{firstTier.statBudgetMax}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="d-panel">
            <div className="d-section-label">Standing</div>
            <div className="d-field">
              <div className="d-field-label">Tier</div>
              <div className="d-seg">
                {tiers.map((t, i) => (
                  <button key={t.id} className={i === 0 ? "on" : ""} disabled>
                    {t.name}
                    <span className="d-seg-meta">{t.statBudgetMin}–{t.statBudgetMax} · up {t.upkeepCost}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="d-field">
              <div className="d-field-label">Role</div>
              <div className="d-seg">
                <button className="on" disabled>Flex</button>
                {roles.map((r) => (
                  <button key={r.id} disabled>{r.name}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="d-panel">
            <div className="d-section-label">Attributes · 1–20</div>
            {attributes.map((a) => (
              <div className="d-attr-row" key={a.id} title={a.description}>
                <span className="d-attr-name">{a.name}</span>
                <div className="d-track">
                  <div className="d-fill" style={{ width: "50%" }} />
                </div>
                <span className="d-attr-val">10</span>
              </div>
            ))}
          </div>

          <div className="d-panel">
            <div className="d-section-label">
              Traits <span className="d-chip-count">0 chosen · pool of {DEFAULT_TRAIT_POOL.length}</span>
            </div>
            <div className="d-chips">
              {DEFAULT_TRAIT_POOL.slice(0, 8).map((t) => (
                <span key={t.id} className="d-chip" title={t.description}>{t.name}</span>
              ))}
            </div>
          </div>

          <div className="d-panel d-panel-muted">
            <div className="d-section-label">Equipment</div>
            <div className="d-muted">No equipment slots wired yet.</div>
          </div>
        </main>

        {/* ── RIGHT ENGINE RECORD ───────────────────────────────── */}
        <aside className="d-record">
          <div className="d-record-head">Engine record</div>
          <pre className="d-record-json">{JSON.stringify(sampleRecord, null, 2)}</pre>
          <div className="d-record-note d-muted">
            Live agent JSON renders here once state is wired (step 2).
          </div>
        </aside>
      </div>
    </div>
  );
}
