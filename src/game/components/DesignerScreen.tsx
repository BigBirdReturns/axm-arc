import { useEffect, useMemo, useState } from "react";
import "../styles/designer.css";
import "../styles/workshop.css";
import type { Agent, Arc, Item } from "../../engine/types.js";
import { DEFAULT_TRAIT_POOL } from "../../engine/constants.js";
import { generateAgent, computeBaseEfficiency } from "../../engine/character.js";
import { Rng, hashSeed } from "../../engine/prng.js";
import {
  clampAttribute,
  computeItemBonuses,
  isItemLocked,
  nextCopyId,
  statBudgetStatus,
  toggleEquip,
  toggleTrait,
} from "../lib/designer-edit.js";
import {
  emptyDraft,
  loadRosterDraft,
  saveRosterDraft,
  type RosterDraft,
  type DesignerSection,
} from "../lib/designer-storage.js";
import { exportArcToJson } from "../lib/arc-library.js";
import { AuthoringAuditPanel } from "./AuthoringAuditPanel.js";
import { CartridgePortrait } from "./CartridgePortrait.js";
import { CartridgeEmblem, cartridgeThemeScope } from "../cartridge-theme.js";

interface Props {
  arc: Arc;
  onBack: () => void;
  onOpenWorkshop: () => void;
}

// Designer port — Step 3: the editor sections (identity, standing, attributes,
// disposition, traits, equipment) are now writable, wired through patchAgent
// below. Every mutation reconciles derived fields (upkeep, baseEfficiency)
// through the same real engine helper generateAgent uses
// (engine/character.computeBaseEfficiency) — no re-implemented formulas here.
// Tier/role changes never re-roll stats; going over a tier's stat budget is a
// soft warning, never a block (DESIGNER_PORT.md prototype decisions).
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

const HIDDEN_KEYS: Array<keyof Agent["hiddenAttributes"]> = [
  "loyalty",
  "ambition",
  "volatility",
  "leadership",
];

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

export function DesignerScreen({ arc, onBack, onOpenWorkshop }: Props): JSX.Element {
  const [draft, setDraft] = useState<RosterDraft>(() => loadRosterDraft(arc.meta.id));
  const [hoverTraitId, setHoverTraitId] = useState<string | null>(null);

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

  const tierById = useMemo(() => new Map(arc.tiers.map((t) => [t.id, t])), [arc.tiers]);
  const roleById = useMemo(() => new Map(arc.roles.map((r) => [r.id, r])), [arc.roles]);

  const itemsBySlot = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of arc.items) {
      const list = map.get(item.slot) ?? [];
      list.push(item);
      map.set(item.slot, list);
    }
    return map;
  }, [arc.items]);
  const itemSlots = useMemo(() => [...itemsBySlot.keys()], [itemsBySlot]);

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
      clone.id = nextCopyId(d.agents.map((a) => a.id), src.id);
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

  // Apply a partial edit to one agent, then reconcile derived fields
  // (upkeep, baseEfficiency) through the real engine helper so the agent
  // stays a legal Agent record after the patch — same pattern the prototype's
  // `reconcile()` used, now backed by engine/character.computeBaseEfficiency
  // instead of a re-implemented formula. Never re-rolls attributes/traits.
  const patchAgent = (id: string, patch: Partial<Agent>): void => {
    setDraft((d) => {
      const idx = d.agents.findIndex((a) => a.id === id);
      if (idx === -1) return d;
      const merged: Agent = { ...(d.agents[idx] as Agent), ...patch };
      const tier = tierById.get(merged.tier);
      const reconciled: Agent = tier
        ? { ...merged, upkeep: tier.upkeepCost, baseEfficiency: computeBaseEfficiency(arc, tier, merged.traits) }
        : merged;
      const agents = [...d.agents];
      agents[idx] = reconciled;
      return { ...d, agents };
    });
  };

  // ── Render helpers ───────────────────────────────────────────────────────
  const upkeepTotal = draft.agents.reduce((s, a) => s + a.upkeep, 0);
  const selectedTier = selected ? tierById.get(selected.tier) : undefined;
  const itemBonuses = selected ? computeItemBonuses(arc, selected.equippedItems) : {};
  const statSum = selected
    ? Object.values(selected.attributes).reduce((s, v) => s + v, 0)
    : 0;
  const budgetStatus = statBudgetStatus(statSum, selectedTier);
  const hoverTrait = hoverTraitId ? traitById.get(hoverTraitId) : undefined;
  const activeTraitDesc =
    hoverTrait ?? (selected ? traitPool.find((t) => selected.traits.includes(t.id)) : undefined);

  const exportActiveArc = (): void => {
    const result = exportArcToJson(arc);
    if (!result.ok) return;
    const blob = new Blob([result.payload.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.payload.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const recordValue: unknown = draft.section === "roster"
    ? (selected ?? { note: "Select an agent to see its live engine record.", agents: draft.agents.length })
    : draft.section === "items"
      ? arc.items
      : draft.section === "challenges"
        ? arc.challenges
        : arc;

  return (
    <div
      className="designer-screen"
      data-designer-step="3"
      data-arc={cartridgeThemeScope(arc.meta.id) ?? undefined}
    >
      <header className="d-topbar">
        <button className="d-back" onClick={onBack} aria-label="Back to title">
          ‹ Back
        </button>
        <div className="d-title">
          <CartridgeEmblem arcId={arc.meta.id} size={28} />
          <span className="d-title-kicker">Designer</span>
          <span className="d-title-arc">{arc.meta.name}</span>
        </div>
        <nav className="d-section-nav">
          {SECTIONS.map((s) => (
            <button
              key={s}
              className={s === draft.section ? "on" : ""}
              onClick={() => setSection(s)}
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
                  <CartridgePortrait arcId={arc.meta.id} roleId={a.role} name={a.name} size={34} className="rail-mono" />
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
          {draft.section === "roster" && !selected && (
            <div className="d-panel d-panel-muted">
              <div className="d-muted">
                {draft.agents.length === 0
                  ? "Add an agent to start. The editor will appear here."
                  : "Select an agent from the rail to inspect."}
              </div>
            </div>
          )}

          {draft.section === "roster" && selected && (
            <>
              <div className="d-panel">
                <div className="d-identity">
                  <CartridgePortrait arcId={arc.meta.id} roleId={selected.role} name={selected.name} size={62} className="d-portrait" />
                  <div className="d-id-fields">
                    <input
                      className="d-name-input"
                      value={selected.name}
                      onChange={(e) => patchAgent(selected.id, { name: e.target.value })}
                      aria-label="Agent name"
                    />
                    <div className="d-derived">
                      <span className="d-stat">base eff <b>{selected.baseEfficiency.toFixed(2)}</b></span>
                      <span className="d-stat">upkeep <b>{selected.upkeep}⟡</b></span>
                      {selectedTier && (
                        <span className="d-stat">
                          budget <b>{statSum}</b>/{selectedTier.statBudgetMin}–{selectedTier.statBudgetMax}
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
                      <button
                        key={t.id}
                        className={t.id === selected.tier ? "on" : ""}
                        onClick={() => patchAgent(selected.id, { tier: t.id })}
                      >
                        {t.name}
                        <span className="d-seg-meta">{t.statBudgetMin}–{t.statBudgetMax} · up {t.upkeepCost}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="d-field">
                  <div className="d-field-label">Role</div>
                  <div className="d-seg">
                    <button
                      className={selected.role === null ? "on" : ""}
                      onClick={() => patchAgent(selected.id, { role: null })}
                    >
                      Flex
                    </button>
                    {arc.roles.map((r) => (
                      <button
                        key={r.id}
                        className={r.id === selected.role ? "on" : ""}
                        onClick={() => patchAgent(selected.id, { role: r.id })}
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="d-panel">
                <div className="d-section-label">Attributes · 1–20</div>
                {arc.attributes.map((a) => {
                  const val = selected.attributes[a.id] ?? 1;
                  const bonus = itemBonuses[a.id] ?? 0;
                  const eff = Math.min(20, val + bonus);
                  return (
                    <div className="d-attr-row" key={a.id} title={a.description}>
                      <span className="d-attr-name">{a.name}</span>
                      <div className="d-track">
                        <div className="d-fill" style={{ width: `${(val / 20) * 100}%` }} />
                        {bonus > 0 && (
                          <div
                            className="d-bonus"
                            style={{ left: `${(val / 20) * 100}%`, width: `${((eff - val) / 20) * 100}%` }}
                          />
                        )}
                      </div>
                      <input
                        type="number"
                        className="d-attr-input"
                        min={1}
                        max={20}
                        value={val}
                        onChange={(e) =>
                          patchAgent(selected.id, {
                            attributes: { ...selected.attributes, [a.id]: clampAttribute(Number(e.target.value)) },
                          })
                        }
                        aria-label={`${a.name} value`}
                      />
                      {bonus > 0 && <span className="d-plus"> +{bonus}</span>}
                    </div>
                  );
                })}
                <div className={`d-budget${budgetStatus === "over" ? " over" : ""}`}>
                  <span>Stat total <b>{statSum}</b></span>
                  <span>
                    {budgetStatus === "over"
                      ? "above tier budget — legal, but richer than a rolled agent"
                      : selectedTier
                        ? `tier budget ${selectedTier.statBudgetMin}–${selectedTier.statBudgetMax}`
                        : "no tier budget defined"}
                  </span>
                </div>
              </div>

              <div className="d-panel">
                <div className="d-section-label">Disposition · Sealed · 1–20</div>
                <div className="d-hidden-note">
                  Hidden from the player until cycles of service reveal them. The simulation
                  reads these from cycle one.
                </div>
                {HIDDEN_KEYS.map((k) => (
                  <div className="d-hidden-row" key={k}>
                    <span className="d-hidden-name">{k}</span>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      value={selected.hiddenAttributes[k]}
                      onChange={(e) =>
                        patchAgent(selected.id, {
                          hiddenAttributes: {
                            ...selected.hiddenAttributes,
                            [k]: clampAttribute(Number(e.target.value)),
                          },
                        })
                      }
                      aria-label={`${k} value`}
                    />
                    <span className="d-hidden-val">{selected.hiddenAttributes[k]}</span>
                  </div>
                ))}
              </div>

              <div className="d-panel">
                <div className="d-section-label">
                  Traits{" "}
                  <span className="d-chip-count">
                    {selected.traits.length} chosen · pool of {traitPool.length}
                  </span>
                </div>
                <div className="d-chips">
                  {traitPool.map((t) => {
                    const on = selected.traits.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`d-chip${on ? " d-chip-on" : ""}`}
                        onClick={() => patchAgent(selected.id, { traits: toggleTrait(selected.traits, t.id) })}
                        onMouseEnter={() => setHoverTraitId(t.id)}
                        onMouseLeave={() => setHoverTraitId(null)}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
                <div className="d-trait-desc">
                  {activeTraitDesc?.description ?? "Hover a trait to read what it does to the simulation."}
                </div>
              </div>

              <div className="d-panel">
                <div className="d-section-label">Equipment</div>
                {itemSlots.length === 0 && (
                  <div className="d-muted">This arc defines no items.</div>
                )}
                {itemSlots.map((slot) => {
                  const equippedId = selected.equippedItems[slot];
                  const items = itemsBySlot.get(slot) ?? [];
                  return (
                    <div className="d-field" key={slot}>
                      <div className="d-field-label">{slot}</div>
                      <div className="item-grid">
                        {items.map((item) => {
                          const locked = isItemLocked(arc, item, selected.tier);
                          const on = equippedId === item.id;
                          const bonusText = Object.entries(item.statBonuses)
                            .map(([k, v]) => `+${v} ${k}`)
                            .join(" · ");
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={`item-card${on ? " on" : ""}${locked ? " locked" : ""}`}
                              disabled={locked}
                              title={locked ? `Requires ${item.tierRequirement}` : item.flavorText}
                              onClick={() =>
                                patchAgent(selected.id, {
                                  equippedItems: toggleEquip(selected.equippedItems, slot, item.id),
                                })
                              }
                            >
                              <div className="item-card-name">{item.name}</div>
                              <div className="item-card-meta">
                                <span className="item-card-tier">{item.tierRequirement}</span>
                                {locked && <span className="item-card-lock">locked</span>}
                              </div>
                              {bonusText && <div className="item-card-bonus">{bonusText}</div>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {draft.section === "items" && (
            <>
              <div className="d-panel"><div className="d-section-label">Item catalog · {arc.items.length}</div><p className="d-muted">The cartridge owns these slots, tier gates, bonuses, and flavor. Roster equipment reads this exact catalog.</p></div>
              {arc.items.length === 0 ? <div className="d-panel d-panel-muted">This cartridge intentionally defines no items.</div> : arc.items.map((item) => (
                <article className="d-panel" key={item.id} data-testid={`designer-item-${item.id}`}>
                  <div className="row between"><strong>{item.name}</strong><span className="badge">{item.slot}</span></div>
                  <div className="agent-meta">id {item.id} · requires {item.tierRequirement}</div>
                  <p>{item.flavorText}</p>
                  <div className="d-chips">{Object.entries(item.statBonuses).map(([attributeId, value]) => <span className="d-chip d-chip-on" key={attributeId}>+{value} {attributeId}</span>)}</div>
                </article>
              ))}
              <div className="d-panel"><button className="primary" onClick={onOpenWorkshop}>Edit item law in Workshop</button></div>
            </>
          )}

          {draft.section === "challenges" && (
            <>
              <div className="d-panel"><div className="d-section-label">Challenge grammar · {arc.challenges.length}</div><p className="d-muted">Every row below is executable Arc law: roster gate, access gate, mechanic checks, and three continuations.</p></div>
              {arc.challenges.map((challenge) => (
                <article className="d-panel" key={challenge.id} data-testid={`designer-challenge-${challenge.id}`}>
                  <div className="row between"><strong>{challenge.name}</strong><span className="badge">difficulty {challenge.difficultyRating}</span></div>
                  <div className="agent-meta">{challenge.id} · party {challenge.rosterRequirements.minAgents}–{challenge.rosterRequirements.maxAgents}</div>
                  <p>{challenge.description}</p>
                  <div className="d-section-label">Checks</div>
                  {challenge.mechanicChecks.map((check) => <div className="d-budget" key={check.id}><span><b>{check.name}</b> · {check.scope}</span><span>{check.attributeWeights.map((weight) => `${weight.attributeId} ${weight.weight}`).join(" · ")} · target {check.difficultyThreshold}</span></div>)}
                  <div className="d-section-label" style={{ marginTop: 10 }}>Continuations</div>
                  <div className="agent-meta">success — {challenge.outcomes.success.narrative}</div>
                  <div className="agent-meta">partial — {challenge.outcomes.partial.narrative}</div>
                  <div className="agent-meta">failure — {challenge.outcomes.failure.narrative}</div>
                </article>
              ))}
              <div className="d-panel"><button className="primary" onClick={onOpenWorkshop}>Edit challenge law in Workshop</button></div>
            </>
          )}

          {draft.section === "arc" && (
            <>
              <div className="d-panel">
                <div className="d-section-label">Authored cartridge</div><h2 style={{ margin: "4px 0" }}>{arc.meta.name}</h2><p>{arc.meta.description}</p>
                <div className="agent-meta">{arc.meta.id} · {arc.meta.domain} · v{arc.meta.version} · engine {arc.meta.engineVersion}</div>
                <div className="d-chips" style={{ marginTop: 10 }}><span className="d-chip d-chip-on">{arc.roles.length} roles</span><span className="d-chip d-chip-on">{arc.attributes.length} attributes</span><span className="d-chip d-chip-on">{arc.challenges.length} challenges</span><span className="d-chip d-chip-on">{arc.progressionTiers.length} progression tiers</span></div>
              </div>
              <AuthoringAuditPanel arc={arc} />
              <div className="d-panel"><div className="d-section-label">Custody actions</div><div className="row" style={{ flexWrap: "wrap", gap: 8 }}><button className="primary" onClick={onOpenWorkshop}>Open full source in Workshop</button><button className="secondary" onClick={exportActiveArc}>Export exact .arc.json</button></div></div>
            </>
          )}
        </main>

        {/* ── RIGHT ENGINE RECORD ───────────────────────────────── */}
        <aside className="d-record">
          <div className="d-record-head">
            Engine record {selected ? `· ${selected.id}` : ""}
          </div>
          <pre className="d-record-json">{JSON.stringify(recordValue, null, 2)}</pre>
          <div className="d-record-note d-muted">
            Live — the exact record behind the active Designer section. Full cartridge-law edits route to the validated Workshop source.
          </div>
        </aside>
      </div>
    </div>
  );
}
