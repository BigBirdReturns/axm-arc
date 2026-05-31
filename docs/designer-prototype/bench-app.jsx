// ════════════════════════════════════════════════════════════════════
// bench-app.jsx — AXM Arc Designer · Roster Workshop.
//
// Author a whole roster of agents (not just one), give each a portrait,
// and export the set as engine-shaped JSON. Everything runs on the real
// engine (window.AXM). Roster persists to localStorage; portraits persist
// via <image-slot>. Sections scaffold the arc-creator: Roster is live;
// Items browses the real arc items; Challenges/Arc show what's next.
// ════════════════════════════════════════════════════════════════════
const { useState, useEffect, useMemo, useRef } = React;
const AXM = window.AXM;
const ARC = AXM.FIRST_CHARTER;

const ROSTER_KEY = "axm-arc-designer:roster:v2";
const SEL_KEY = "axm-arc-designer:selected:v2";
const THEME_KEY = "axm-arc-designer:theme:v1";

// ── Persistence ──────────────────────────────────────────────────────
function loadRoster() {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    if (raw) { const a = JSON.parse(raw); if (Array.isArray(a) && a.length) return a; }
  } catch (e) { /* noop */ }
  // First run: roll a starter charter of three.
  return [0, 1, 2].map((i) => AXM.rollAgent(ARC, AXM.randomSeed() + i));
}

// Recompute derived fields so an edited agent stays a legal Agent.
function reconcile(agent) {
  const t = ARC.tiers.find((x) => x.id === agent.tier) ?? ARC.tiers[0];
  return { ...agent, upkeep: t.upkeepCost, baseEfficiency: AXM.computeBaseEfficiency(ARC, t, agent.traits) };
}

// ════════════════════════════════════════════════════════════════════
// Agent editor (the Bench detail pane)
// ════════════════════════════════════════════════════════════════════
function AgentEditor({ agent, onPatch }) {
  const [hoverTrait, setHoverTrait] = useState(null);
  const traitPool = useMemo(() => AXM.buildTraitPool(ARC), []);
  const slots = useMemo(() => [...new Set(ARC.items.map((i) => i.slot))], []);

  const tier = ARC.tiers.find((t) => t.id === agent.tier) ?? ARC.tiers[0];
  const role = ARC.roles.find((r) => r.id === agent.role) ?? null;
  const attrIds = ARC.attributes.map((a) => a.id);
  const statSum = attrIds.reduce((s, id) => s + (agent.attributes[id] ?? 0), 0);
  const overBudget = statSum > tier.statBudgetMax;

  const itemBonuses = {};
  for (const itemId of Object.values(agent.equippedItems)) {
    const item = ARC.items.find((i) => i.id === itemId);
    if (!item) continue;
    for (const [k, v] of Object.entries(item.statBonuses)) itemBonuses[k] = (itemBonuses[k] ?? 0) + v;
  }

  const roleFit = useMemo(() => {
    if (!role) return null;
    const w = role.attributeWeights;
    const totalW = attrIds.reduce((s, id) => s + (w[id] ?? 0), 0);
    if (totalW === 0) return null;
    const score = attrIds.reduce((s, id) => s + (agent.attributes[id] ?? 0) * (w[id] ?? 0), 0) / totalW;
    return Math.round(score * 10) / 10;
  }, [role, agent.attributes]);

  const HIDDEN_KEYS = ["loyalty", "ambition", "volatility", "leadership"];

  return (
    <div>
      {/* Identity + portrait */}
      <div className="d-panel">
        <div className="d-identity">
          <image-slot
            id={`axm-portrait-${agent.id}`}
            shape="rounded" radius="8"
            placeholder="Drop portrait"
            style={{ width: "96px", height: "96px", flexShrink: 0 }}
          ></image-slot>
          <div style={{ flex: 1 }}>
            <input className="d-name-input" value={agent.name}
              onChange={(e) => onPatch({ name: e.target.value })} aria-label="Agent name" />
            <div className="d-derived">
              <span className="d-stat">base eff <b>{agent.baseEfficiency}</b></span>
              <span className="d-stat">upkeep <b>{agent.upkeep}⟡</b></span>
              {roleFit !== null && <span className="d-stat">role fit <b>{roleFit}</b></span>}
              <span className="d-stat">budget <b>{statSum}</b>/{tier.statBudgetMin}–{tier.statBudgetMax}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Standing */}
      <div className="d-panel">
        <div className="d-section-label">Standing</div>
        <div className="d-field">
          <div className="d-field-label">Tier</div>
          <div className="d-seg">
            {ARC.tiers.map((t) => (
              <button key={t.id} className={t.id === agent.tier ? "on" : ""} onClick={() => onPatch({ tier: t.id })}>
                {t.name}<span className="d-seg-meta">{t.statBudgetMin}–{t.statBudgetMax} · up {t.upkeepCost}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="d-field">
          <div className="d-field-label">Role</div>
          <div className="d-seg">
            <button className={agent.role === null ? "on" : ""} onClick={() => onPatch({ role: null })}>Flex</button>
            {ARC.roles.map((r) => (
              <button key={r.id} className={r.id === agent.role ? "on" : ""} onClick={() => onPatch({ role: r.id })}>{r.name}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Attributes */}
      <div className="d-panel">
        <div className="d-section-label">Attributes · 1–20</div>
        {ARC.attributes.map((a) => {
          const base = agent.attributes[a.id] ?? 1;
          const bonus = itemBonuses[a.id] ?? 0;
          const eff = base + bonus;
          const setVal = (clientX, el) => {
            const r = el.getBoundingClientRect();
            const pct = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
            const v = Math.max(1, Math.min(20, Math.round(pct * 20)));
            onPatch({ attributes: { ...agent.attributes, [a.id]: v } });
          };
          return (
            <div className="d-attr-row" key={a.id} title={a.description}>
              <span className="d-attr-name">{a.name}</span>
              <div className="d-track"
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setVal(e.clientX, e.currentTarget); }}
                onPointerMove={(e) => { if (e.buttons === 1) setVal(e.clientX, e.currentTarget); }}>
                <div className="d-fill" style={{ width: `${(base / 20) * 100}%` }} />
                {bonus > 0 && <div className="d-bonus" style={{ left: `${(base / 20) * 100}%`, width: `${(Math.min(20, eff) - base) / 20 * 100}%` }} />}
              </div>
              <span className="d-attr-val">{base}{bonus > 0 && <span className="d-plus"> +{bonus}</span>}</span>
            </div>
          );
        })}
        <div className={`d-budget${overBudget ? " over" : ""}`}>
          <span>Stat total <b>{statSum}</b></span>
          <span>{overBudget ? "above tier budget — legal, but richer than a rolled agent" : `tier budget ${tier.statBudgetMin}–${tier.statBudgetMax}`}</span>
        </div>
      </div>

      {/* Disposition */}
      <div className="d-panel">
        <div className="d-section-label">Disposition · Sealed · 1–20</div>
        <div className="d-hidden-note">Hidden from the player until cycles of service reveal them. The simulation reads these from cycle one.</div>
        {HIDDEN_KEYS.map((k) => (
          <div className="d-hidden-row" key={k}>
            <span className="d-hidden-name" style={{ textTransform: "capitalize" }}>{k}</span>
            <input type="range" min={1} max={20} value={agent.hiddenAttributes[k]}
              onChange={(e) => onPatch({ hiddenAttributes: { ...agent.hiddenAttributes, [k]: parseInt(e.target.value, 10) } })} />
            <span className="d-hidden-val">{agent.hiddenAttributes[k]}</span>
          </div>
        ))}
      </div>

      {/* Traits */}
      <div className="d-panel">
        <div className="d-section-label">Traits <span className="d-chip-count">{agent.traits.length} chosen · pool of {traitPool.length}</span></div>
        <div className="d-chips">
          {traitPool.map((t) => {
            const on = agent.traits.includes(t.id);
            return (
              <button key={t.id} className={`d-chip${on ? " on" : ""}`}
                onClick={() => onPatch({ traits: on ? agent.traits.filter((x) => x !== t.id) : [...agent.traits, t.id] })}
                onMouseEnter={() => setHoverTrait(t)} onMouseLeave={() => setHoverTrait(null)}>{t.name}</button>
            );
          })}
        </div>
        <div className="d-trait-desc">
          {(hoverTrait ?? traitPool.find((t) => agent.traits.includes(t.id)))?.description ?? "Hover a trait to read what it does to the simulation."}
        </div>
      </div>

      {/* Equipment */}
      {slots.length > 0 && (
        <div className="d-panel">
          <div className="d-section-label">Equipment</div>
          {slots.map((slot) => {
            const equipped = agent.equippedItems[slot];
            const items = ARC.items.filter((i) => i.slot === slot);
            return (
              <div className="d-slot" key={slot}>
                <div className="d-slot-name">{slot}</div>
                <div className="d-items">
                  <button className={`d-item${!equipped ? " on" : ""}`}
                    onClick={() => { const next = { ...agent.equippedItems }; delete next[slot]; onPatch({ equippedItems: next }); }}>— none —</button>
                  {items.map((item) => {
                    const locked = AXM.tierRank(ARC, item.tierRequirement) > AXM.tierRank(ARC, agent.tier);
                    const bonus = Object.entries(item.statBonuses).map(([k, v]) => `+${v} ${k.slice(0, 3)}`).join(" ");
                    return (
                      <button key={item.id} className={`d-item${equipped === item.id ? " on" : ""}`} disabled={locked}
                        title={locked ? `Requires ${item.tierRequirement}` : item.flavorText}
                        onClick={() => onPatch({ equippedItems: { ...agent.equippedItems, [slot]: item.id } })}>
                        {item.name} <span className="d-item-bonus">{bonus}</span>
                        {locked && <span className="d-item-lock"> · {item.tierRequirement}🔒</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Engine record
// ════════════════════════════════════════════════════════════════════
function EngineRecord({ agent }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(agent, null, 2);
  const copy = () => navigator.clipboard?.writeText(json).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); });
  return (
    <div className="d-panel">
      <div className="d-record-head">
        <div className="d-section-label" style={{ margin: 0, border: "none", padding: 0 }}>Engine Record</div>
        <button className="d-copy" onClick={copy}>{copied ? "Copied ✓" : "Copy JSON"}</button>
      </div>
      <pre className="d-record">{json}</pre>
      <div className="d-truth">
        The exact <code>Agent</code> object the cycle engine consumes — same <code>generateAgent()</code>, same PRNG as a live game.
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Roster rail
// ════════════════════════════════════════════════════════════════════
function RosterRail({ roster, selectedId, rolling, exported, onSelect, onAdd, onDuplicate, onDelete, onExport }) {
  const upkeep = roster.reduce((s, a) => s + a.upkeep, 0);
  return (
    <div className="rail">
      <div className="rail-head">
        <span>Roster · {String(roster.length).padStart(2, "0")}</span>
        <span className="rail-upkeep">{upkeep}⟡ upkeep</span>
      </div>
      <div className="rail-list">
        {roster.map((a) => {
          const role = ARC.roles.find((r) => r.id === a.role);
          return (
            <div key={a.id} className={`rail-card${a.id === selectedId ? " on" : ""}`} onClick={() => onSelect(a.id)}>
              <div className="rail-portrait" style={{ background: AXM.tierBadgeColor(a.tier) }}>{AXM.agentInitials(a.name)}</div>
              <div className="rail-meta">
                <div className="rail-name">{a.name}</div>
                <div className="rail-sub">{role?.name ?? "Flex"} · {a.tier}</div>
              </div>
              <div className="rail-actions">
                <button title="Duplicate" onClick={(e) => { e.stopPropagation(); onDuplicate(a.id); }}>⧉</button>
                <button title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(a.id); }}>✕</button>
              </div>
            </div>
          );
        })}
      </div>
      <button className={`rail-add${rolling ? " rolling" : ""}`} onClick={onAdd}><span className="d-die">⟳</span> Roll new agent</button>
      <button className="rail-export" onClick={onExport}>{exported ? "Saved ✓" : "⤓ Export roster JSON"}</button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Sections that scaffold the arc-creator
// ════════════════════════════════════════════════════════════════════
function ItemsSection() {
  const slots = [...new Set(ARC.items.map((i) => i.slot))];
  return (
    <div className="section-pad">
      <div className="d-panel">
        <div className="d-section-label">Items · {ARC.items.length} in this arc</div>
        <div className="item-grid">
          {ARC.items.map((it) => (
            <div className="item-card" key={it.id}>
              <div className="item-card-name">{it.name}</div>
              <div className="item-card-meta">
                <span className="item-card-slot">{it.slot}</span>
                <span className="item-card-tier">{it.tierRequirement}</span>
              </div>
              <div className="item-card-bonus">
                {Object.entries(it.statBonuses).map(([k, v]) => <span key={k}>+{v} {k}</span>)}
              </div>
              <div className="item-card-flavor">{it.flavorText}</div>
            </div>
          ))}
        </div>
        <div className="next-note">Item authoring (new items, edit bonuses, drop sprites) lands here next — same live-data model as the roster.</div>
      </div>
    </div>
  );
}

function ArcSection() {
  return (
    <div className="section-pad">
      <div className="d-panel">
        <div className="d-section-label">Arc · {ARC.meta.name}</div>
        <div className="arc-meta-grid">
          <div><span className="arc-k">Domain</span><span className="arc-v">{ARC.meta.domain}</span></div>
          <div><span className="arc-k">Currency</span><span className="arc-v">{ARC.currencyName}</span></div>
          <div><span className="arc-k">Renown</span><span className="arc-v">{ARC.reputationName}</span></div>
          <div><span className="arc-k">Version</span><span className="arc-v">{ARC.meta.version}</span></div>
        </div>
      </div>
      <div className="d-panel">
        <div className="d-section-label">Attributes</div>
        {ARC.attributes.map((a) => (
          <div className="arc-row" key={a.id}><b>{a.name}</b><span>{a.description}</span></div>
        ))}
      </div>
      <div className="d-panel">
        <div className="d-section-label">Roles & Tiers</div>
        <div className="arc-pills">{ARC.roles.map((r) => <span key={r.id} className="arc-pill">{r.name}</span>)}</div>
        <div className="arc-pills" style={{ marginTop: 8 }}>{ARC.tiers.map((t) => <span key={t.id} className="arc-pill alt">{t.name} · {t.statBudgetMin}–{t.statBudgetMax}</span>)}</div>
        <div className="next-note">Editing attributes, roles, tiers and currencies turns this read-only arc view into the full arc-creator. The roster + items above already follow whatever this defines.</div>
      </div>
    </div>
  );
}

function ChallengesSection() {
  return (
    <div className="section-pad">
      <div className="d-panel next-panel">
        <div className="d-section-label">Challenges</div>
        <div className="next-big">The First Charter ships 12 contracts — from <em>The Cellar</em> to <em>Karazhan</em>.</div>
        <div className="next-note">Challenge authoring (mechanic checks, roster requirements, reward tables, narrative) is the deepest surface and comes after items. The roster you build here is what gets thrown at them.</div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Workshop
// ════════════════════════════════════════════════════════════════════
function Workshop() {
  const [roster, setRoster] = useState(loadRoster);
  const [selectedId, setSelectedId] = useState(() => {
    try { return localStorage.getItem(SEL_KEY) || null; } catch (e) { return null; }
  });
  const [section, setSection] = useState("roster");
  const [rolling, setRolling] = useState(false);
  const [exported, setExported] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch (e) {}
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }, [theme]);

  useEffect(() => { try { localStorage.setItem(ROSTER_KEY, JSON.stringify(roster)); } catch (e) {} }, [roster]);
  useEffect(() => { try { if (selectedId) localStorage.setItem(SEL_KEY, selectedId); } catch (e) {} }, [selectedId]);

  const selected = roster.find((a) => a.id === selectedId) ?? roster[0];
  useEffect(() => { if (selected && selected.id !== selectedId) setSelectedId(selected.id); }, [selected, selectedId]);

  const patchAgent = (patch) => {
    setRoster((prev) => prev.map((a) => (a.id === selected.id ? reconcile({ ...a, ...patch }) : a)));
  };

  const addAgent = () => {
    if (rolling) return;
    setRolling(true);
    let ticks = 0;
    const spin = () => {
      ticks++;
      if (ticks < 5) { setRolling(true); setTimeout(spin, 50 + ticks * 16); }
      else {
        const fresh = AXM.rollAgent(ARC, AXM.randomSeed());
        setRoster((prev) => [...prev, fresh]);
        setSelectedId(fresh.id);
        setSection("roster");
        setRolling(false);
      }
    };
    spin();
  };

  const duplicateAgent = (id) => {
    const src = roster.find((a) => a.id === id);
    if (!src) return;
    const copy = { ...JSON.parse(JSON.stringify(src)), id: `agent-${AXM.randomSeed() % 900000 + 100000}`, name: src.name + " (copy)" };
    setRoster((prev) => { const i = prev.findIndex((a) => a.id === id); const next = [...prev]; next.splice(i + 1, 0, copy); return next; });
    setSelectedId(copy.id);
  };

  const deleteAgent = (id) => {
    setRoster((prev) => {
      if (prev.length <= 1) return prev; // keep at least one
      const i = prev.findIndex((a) => a.id === id);
      const next = prev.filter((a) => a.id !== id);
      if (id === selectedId) setSelectedId(next[Math.max(0, i - 1)].id);
      return next;
    });
  };

  const exportRoster = () => {
    const json = JSON.stringify(roster, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "first-charter.roster.json"; a.click();
    URL.revokeObjectURL(url);
    setExported(true); setTimeout(() => setExported(false), 1600);
  };

  const SECTIONS = [["roster", "Roster"], ["items", "Items"], ["challenges", "Challenges"], ["arc", "Arc"]];

  return (
    <div className="designer">
      <div className="designer-bar">
        <div className="d-title"><em>AXM</em> Arc Designer</div>
        <nav className="sectionnav">
          {SECTIONS.map(([id, label]) => (
            <button key={id} className={section === id ? "on" : ""} onClick={() => setSection(id)}>
              {label}{id === "roster" && <span className="sectionnav-count">{roster.length}</span>}
            </button>
          ))}
        </nav>
        <div className="d-spacer"></div>
        <button className="theme-toggle" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}>
          <span className="tt-icon">{theme === "dark" ? "☀" : "☾"}</span>{theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>

      {section === "roster" && (
        <div className="workshop-grid">
          <RosterRail roster={roster} selectedId={selected?.id} rolling={rolling} exported={exported}
            onSelect={setSelectedId} onAdd={addAgent} onDuplicate={duplicateAgent} onDelete={deleteAgent} onExport={exportRoster} />
          <div className="workshop-editor">
            {selected && <AgentEditor key={selected.id} agent={selected} onPatch={patchAgent} />}
          </div>
          <div className="workshop-record">
            {selected && <EngineRecord agent={selected} />}
          </div>
        </div>
      )}
      {section === "items" && <ItemsSection />}
      {section === "challenges" && <ChallengesSection />}
      {section === "arc" && <ArcSection />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Workshop />);
