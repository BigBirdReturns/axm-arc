import { useEffect, useMemo, useState } from "react";
import "../styles/designer.css";
import type { Agent, Arc } from "../../engine/types.js";
import { DEFAULT_TRAIT_POOL } from "../../engine/constants.js";
import { generateAgent } from "../../engine/character.js";
import { Rng, hashSeed } from "../../engine/prng.js";
import {
  emptyDraft,
  loadRosterDraft,
  saveRosterDraft,
  type RosterDraft,
  type DesignerSection,
} from "../lib/designer-storage.js";

interface Props {
  arc: Arc;
  onBack: () => void;
}

// Designer port — Step 2: real roster state + localStorage draft + live
// engine-record JSON. Add / duplicate / delete / select are wired through
// engine/character. Editor sections remain read-only display of the selected
// agent (step 3 ports the editors themselves).
//
// Persistence: docs default — drafts stored as JSON under
// `axm-arc:roster-draft:v1` parallel to the org save (DESIGNER_PORT.md §State).

const SECTIONS: DesignerSection[] = ["roster", "items", "challenges", "arc"];
const SECTION_LABEL: Record<DesignerSection, string> = {
  roster: "Roster",
  items: "Items",
  challenges: "Challenges",
  arc: "Arc",
};

function agentInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

// Deterministic agent generation: a fresh sub-seed per added agent so adding
// N agents in a row produces the same N agents on the same arc + draft index.
function generateForDraft(arc: Arc, indexInDraft: number, seedSalt: string): Agent {
  const tier = arc.tiers[0];
  if (!tier) throw new Error("Arc has no tiers — cannot generate agent");
  const seed = hashSeed("designer", arc.meta.id, seedSalt, indexInDraft);
  const rng = new Rng(seed);
  return generateAgent({ rng, tier, arc, cycle: 0 });
}

export function DesignerScreen({ arc, onBack }: Props): JSX.Element {
  const [draft, setDraft] = useState<RosterDraft>(() => loadRosterDraft(arc.meta.id));

  // Persist on every change. Cheap enough; the draft is small.
  useEffect(() => { saveRosterDraft(draft); }, [draft]);

  // Resync if the active arc changes while the screen is mounted (rare but
  // covered for correctness — the storage layer rejects mismatched arcId).
  useEffect(() => {
    if (draft.arcId !== arc.meta.id) setDraft(loadRosterDraft(arc.meta.id));
  }, [arc.meta.id, draft.arcId]);

  const selected = useMemo<Agent | null>(
    () => draft.agents.find((a) => a.id === draft.selectedId) ?? null,
    [draft.agents, draft.selectedId],
  );

  const traitPool = useMemo(() => {
    const arcIds = new Set(arc.customTraits.map((t) => t.id));
    return [...arc.customTraits, ...DEFAULT_TRAIT_POOL.filter((t) => !arcIds.has(t.id))];
  }, [arc.customTraits]);

  const traitById = useMemo(() => new Map(traitPool.map((t) => [t.id, t])), [traitPool]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const addAgent = (): void => {
    setDraft((d) => {
      const fresh = generateForDraft(arc, d.agents.length, `add:${Date.now()}`);
      return { ...d, agents: [...d.agents, fresh], selectedId: fresh.id };
    });
  };

  const duplicateAgent = (id: string): void => {
    setDraft((d) => {
      const src = d.agents.find((a) => a.id === id);
      if (!src) return d;
      // Deep clone via JSON — Agent is plain data. Mint a new id; refresh name.
      const clone = JSON.parse(JSON.stringify(src)) as Agent;
      clone.id = `${src.id}-copy-${d.agents.length}`;
      clone.name = `${src.name} (copy)`;
      const idx = d.agents.findIndex((a) => a.id === id);
      const next = [...d.agents];
      next.splice(idx + 1, 0, clone);
      return { ...d, agents: next, selectedId: clone.id };
    });
  };

  const deleteAgent = (id: string): void => {
    setDraft((d) => {
      const next = d.agents.filter((a) => a.id !== id);
      const nextSelected = d.selectedId === id ? (next[0]?.id ?? null) : d.selectedId;
      return { ...d, agents: next, selectedId: nextSelected };
    });
  };

  const selectAgent = (id: string): void => {
    setDraft((d) => ({ ...d, selectedId: id }));
  };

  const setSection = (section: DesignerSection): void => {
    setDraft((d) => ({ ...d, section }));
  };

  const clearDraftAgents = (): void => {
    if (draft.agents.length === 0) return;
    if (!confirm(`Discard ${draft.agents.length} drafted agent(s)?`)) return;
    setDraft((d) => ({ ...emptyDraft(d.arcId), section: d.section }));
  };

  // ── Render helpers ───────────────────────────────────────────────────────
  const upkeepTotal = draft.agents.reduce((s, a) => s + a.upkeep, 0);
  const tierById = useMemo(() => new Map(arc.tiers.map((t) => [t.id, t])), [arc.tiers]);
  const roleById = useMemo(() => new Map(arc.roles.map((r) => [r.id, r])), [arc.roles]);

  const selectedTier = selected ? tierById.get(selected.tier) : undefined;

  return (
    <div className="designer-screen" data-designer-step="2">
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
            <button
              key={s}
              className={s === draft.section ? "on" : ""}
              onClick={() => setSection(s)}
              disabled={s !== "roster"}
              title={s !== "roster" ? "Available in a later step" : undefined}
            >
              {SECTION_LABEL[s]}
            </button>
          ))}
        </nav>
      </header>

      <div className="d-body">
        {/* ── LEFT RAIL ─────────────────────────────────────────── */}
        <aside className="rail">
          <div className="rail-head">
            <span className="rail-title">Roster · {draft.agents.length}</span>
            <button className="rail-add" onClick={addAgent}>+ Agent</button>
          </div>
          <div className="rail-list">
            {draft.agents.length === 0 && (
              <div className="rail-empty d-muted">
                Empty draft. Add an agent to begin authoring against{" "}
                <strong>{arc.meta.name}</strong>.
              </div>
            )}
            {draft.agents.map((a) => {
              const role = a.role ? roleById.get(a.role)?.name ?? a.role : "Flex";
              const tierName = tierById.get(a.tier)?.name ?? a.tier;
              const isOn = a.id === draft.selectedId;
              return (
                <div
                  key={a.id}
                  className={`rail-card${isOn ? " on" : ""}`}
                  onClick={() => selectAgent(a.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") selectAgent(a.id); }}
                >
                  <span className="rail-mono">{agentInitials(a.name)}</span>
                  <span className="rail-info">
                    <span className="rail-name">{a.name}</span>
                    <span className="rail-sub">{role} · {tierName}</span>
                  </span>
                  <span className="rail-actions">
                    <button
                      className="rail-mini"
                      onClick={(e) => { e.stopPropagation(); duplicateAgent(a.id); }}
                      title="Duplicate"
                      aria-label="Duplicate agent"
                    >⎘</button>
                    <button
                      className="rail-mini"
                      onClick={(e) => { e.stopPropagation(); deleteAgent(a.id); }}
                      title="Delete"
                      aria-label="Delete agent"
                    >×</button>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="rail-foot">
            <span className="d-muted">Upkeep tally</span>
            <span><b>{upkeepTotal}</b> ⟡</span>
          </div>
          {draft.agents.length > 0 && (
            <div className="rail-foot">
              <button className="d-textbutton" onClick={clearDraftAgents}>
                Clear draft
              </button>
            </div>
          )}
        </aside>

        {/* ── CENTER EDITOR ─────────────────────────────────────── */}
        <main className="d-editor">
          {!selected && (
            <div className="d-panel d-panel-muted">
              <div className="d-muted">
                {draft.agents.length === 0
                  ? "Add an agent to start. The editor will appear here."
                  : "Select an agent from the rail to inspect."}
              </div>
            </div>
          )}

          {selected && (
            <>
              <div className="d-panel">
                <div className="d-identity">
                  <span className="d-portrait" aria-hidden="true">{agentInitials(selected.name)}</span>
                  <div className="d-id-fields">
                    <input className="d-name-input" value={selected.name} readOnly />
                    <div className="d-derived">
                      <span className="d-stat">base eff <b>{selected.baseEfficiency}</b></span>
                      <span className="d-stat">upkeep <b>{selected.upkeep}⟡</b></span>
                      {selectedTier && (
                        <span className="d-stat">
                          budget{" "}
                          <b>{Object.values(selected.attributes).reduce((s, v) => s + v, 0)}</b>
                          /{selectedTier.statBudgetMin}–{selectedTier.statBudgetMax}
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
                    {arc.tiers.map((t) => (
                      <button key={t.id} className={t.id === selected.tier ? "on" : ""} disabled>
                        {t.name}
                        <span className="d-seg-meta">{t.statBudgetMin}–{t.statBudgetMax} · up {t.upkeepCost}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="d-field">
                  <div className="d-field-label">Role</div>
                  <div className="d-seg">
                    <button className={selected.role === null ? "on" : ""} disabled>Flex</button>
                    {arc.roles.map((r) => (
                      <button key={r.id} className={r.id === selected.role ? "on" : ""} disabled>
                        {r.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="d-panel">
                <div className="d-section-label">Attributes · 1–20</div>
                {arc.attributes.map((a) => {
                  const val = selected.attributes[a.id] ?? 0;
                  return (
                    <div className="d-attr-row" key={a.id} title={a.description}>
                      <span className="d-attr-name">{a.name}</span>
                      <div className="d-track">
                        <div className="d-fill" style={{ width: `${(val / 20) * 100}%` }} />
                      </div>
                      <span className="d-attr-val">{val}</span>
                    </div>
                  );
                })}
              </div>

              <div className="d-panel">
                <div className="d-section-label">
                  Traits{" "}
                  <span className="d-chip-count">
                    {selected.traits.length} chosen · pool of {traitPool.length}
                  </span>
                </div>
                <div className="d-chips">
                  {selected.traits.map((tid) => {
                    const t = traitById.get(tid);
                    return (
                      <span key={tid} className="d-chip d-chip-on" title={t?.description ?? tid}>
                        {t?.name ?? tid}
                      </span>
                    );
                  })}
                  {selected.traits.length === 0 && (
                    <span className="d-muted">No traits.</span>
                  )}
                </div>
              </div>

              <div className="d-panel d-panel-muted">
                <div className="d-section-label">Equipment</div>
                <div className="d-muted">Edit support lands in step 3.</div>
              </div>
            </>
          )}
        </main>

        {/* ── RIGHT ENGINE RECORD ───────────────────────────────── */}
        <aside className="d-record">
          <div className="d-record-head">
            Engine record {selected ? `· ${selected.id}` : ""}
          </div>
          <pre className="d-record-json">
            {selected
              ? JSON.stringify(selected, null, 2)
              : JSON.stringify(
                  { note: "Select an agent to see its live engine record.", agents: draft.agents.length },
                  null,
                  2,
                )}
          </pre>
          <div className="d-record-note d-muted">
            Live — what the engine sees. Editor wiring in step 3.
          </div>
        </aside>
      </div>
    </div>
  );
}
