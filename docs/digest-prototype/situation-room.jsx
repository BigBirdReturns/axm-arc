/* ════════════════════════════════════════════════════════════════
   AXM · Situation Room — Digest model
   The collapsed cycle loop: advance → ONE page (digest + one decision).
   No tab tour. No claim buttons. Outcomes are reported, not collected.
   ════════════════════════════════════════════════════════════════ */

const { useState, useMemo, useEffect } = React;

/* ── ROSTER (matches the live Situation Room) ─────────────────── */
const ROSTER = [
  { id: 'brimstone', initials: 'JB', name: 'Jareth Brimstone', role: 'Vanguard',   tier: 'VE', morale: 64, stress: 3 },
  { id: 'hollowfen', initials: 'GH', name: 'Gwenna Hollowfen', role: 'Mender',     tier: 'VE', morale: 49, stress: 4 },
  { id: 'emberveil', initials: 'GE', name: 'Gwenna Emberveil', role: 'Skirmisher', tier: 'VE', morale: 58, stress: 6 },
  { id: 'fylan',     initials: 'FH', name: 'Fylan Hollowfen',  role: 'Skirmisher', tier: 'RE', morale: 55, stress: 7 },
  { id: 'forhaven',  initials: 'JF', name: 'Jareth Forhaven',  role: 'Vanguard',   tier: 'CH', morale: 70, stress: 6 },
  { id: 'nyara',     initials: 'ND', name: 'Nyara Dunmark',    role: 'Vanguard',   tier: 'RE', morale: 52, stress: 2 },
];
const BY_ID = Object.fromEntries(ROSTER.map((a) => [a.id, a]));

/* What the cycle does to each named person — applied automatically. */
const DELTAS = {
  emberveil: { morale: +7, resolve: true,  note: '↑ RESOLVE' },
  fylan:     { stress: +3, morale: -4, afflicted: true, note: 'AFFLICTED' },
  forhaven:  { stress: +1, threshold: true, note: 'S7' },
  hollowfen: { morale: +3, note: '+3 MOR' },
  brimstone: { morale: +2, note: '+2 MOR' },
  nyara:     { note: '—' },
};

/* The week's events, streamed during the press run. */
const TICKER = [
  <><span className="name">THE CELLAR</span> · <span className="dim">CLEARED</span></>,
  <><span className="name">THE WARRENS</span> · <span className="dim">HELD BY 2 HP</span></>,
  <><span className="name">EMBERVEIL</span> · <span className="accent">BURN FINISH</span></>,
  <><span className="dim">+1 RENOWN</span></>,
  <><span className="name">FYLAN</span> · <span className="accent">AFFLICTED</span></>,
  <><span className="name">WARDEN'S GRIP</span> · <span className="dim">DROPS</span></>,
  <><span className="accent">COUNCIL DECISION QUEUED</span></>,
];

/* The field report — everything resolved. */
const REPORT = {
  cycle: 4,
  headline: ['The Warrens ', 'held', ' by two health.'],
  accentWord: 'held',
  deck: 'Both contracts cleared. Emberveil finished the kill the depth chart said she couldn’t. Fylan crossed threshold and hasn’t been right since.',
  narrative: 'The Cellar went down on farm — Forhaven opened, Brimstone held the line, nothing the roster hasn’t done three times now. The Warrens did not come easy. The recruit pack swarmed in the second phase and Hollowfen spent her cooldowns early keeping Fylan upright. He held, then he didn’t — stress crossed threshold with the warden still standing. Emberveil took the burn she was never slotted for and finished it with two health to spare. The strongbox held the Warden’s Grip.',
  contracts: [
    {
      name: 'The Cellar', outcome: 'cleared', outcomeLabel: 'Cleared',
      mechanics: [
        { name: 'Open Pull', score: 54, threshold: 40, carry: 'Forhaven', verdict: 'pass', gloss: 'Clean. He has opened this one before.' },
        { name: 'Hold Line', score: 47, threshold: 38, carry: 'Brimstone', verdict: 'pass', gloss: 'Never in doubt. Farm run.' },
      ],
      drops: [{ name: 'Ratcatcher’s Coin', stat: '+6 Gold', status: 'auto', statusLabel: 'applied' }],
    },
    {
      name: 'The Warrens', outcome: 'near', outcomeLabel: 'Cleared · 2 HP',
      mechanics: [
        { name: 'Swarm Control', score: 39, threshold: 45, carry: 'Fylan',     verdict: 'fail',  gloss: 'Overran him in the second wave. He held past the point he should have.' },
        { name: 'Mend Throughput', score: 41, threshold: 44, carry: 'Hollowfen', verdict: 'tight', gloss: 'Spent early on Fylan. Nothing left for the finish.' },
        { name: 'Burn Warden',   score: 50, threshold: 42, carry: 'Emberveil', verdict: 'pass',  gloss: 'The recruit finished the kill while the veteran was on the floor.' },
      ],
      drops: [{ name: 'Warden’s Grip', stat: '+2 Reflex · +1 Resolve', status: 'docket', statusLabel: 'one decision' }],
    },
  ],
};

/* The single decision that actually needs the player. */
const DECISION = {
  no: 'CRD 04-1',
  type: 'Council Decision',
  headline: ['Who takes the ', 'Grip', '?'],
  accentWord: 'Grip',
  prompt: <>The <span className="name">Warden’s Grip</span> dropped from the Warrens. Two skirmishers are eligible by slot. Allocate by seniority, by need — or shelve it and decide next cycle.</>,
  item: { name: 'Warden’s Grip', stat: '+2 Reflex · +1 Resolve', flavor: 'Worn leather, re-stitched twice. Cut for someone who finishes the job.' },
  choices: [
    { id: 'emberveil', who: 'By need · Skirmisher · VE', verdict: 'Gwenna Emberveil', read: <>Took the burn unprompted and finished the contract. <em>The roster is watching this one.</em></> },
    { id: 'fylan',     who: 'By seniority · Skirmisher · RE', verdict: 'Fylan Hollowfen', read: <>Higher Reflex floor, but <em>crossed threshold this cycle.</em> Reward, or rest him?</> },
    { id: 'shelve',    who: 'No allocation', verdict: 'Shelve the Grip', read: <>Store it. Both skirmishers stay put. <em>Cycle 05 opens with one fewer reward to negotiate.</em></> },
  ],
};

const RESOLVED_LINES = {
  emberveil: <>Logged · <span className="accent">Warden’s Grip → Emberveil.</span> Need over seniority. Precedent set for Cycle 05.</>,
  fylan:     <>Logged · <span className="accent">Warden’s Grip → Fylan.</span> Seniority held. He carries the reward and the affliction.</>,
  shelve:    <>Logged · <span className="accent">Grip shelved.</span> No allocation this cycle. Both skirmishers stay on the depth chart.</>,
};

/* ── HELPERS ──────────────────────────────────────────────────── */
function stressTag(s) { return s >= 8 ? 'hot' : s >= 6 ? 'warm' : 'cool'; }

function Portrait({ a, applied }) {
  const d = applied ? DELTAS[a.id] : null;
  let corner = null;
  if (d && d.afflicted) corner = { k: 'afflicted', c: '×' };
  else if (d && d.resolve) corner = { k: 'resolve', c: '↑' };
  else if ((d && d.threshold) || (!applied && a.stress >= 7)) corner = { k: 'threshold', c: '!' };
  return (
    <div className={`portrait${d && d.afflicted ? ' afflicted' : ''}`}>
      {a.initials}
      {corner && <span className={`corner ${corner.k}`}>{corner.c}</span>}
    </div>
  );
}

/* ── ROSTER RAIL ──────────────────────────────────────────────── */
function RosterRail({ applied }) {
  return (
    <div className="col col-left">
      <div className="rail-head">
        <span className="h">Roster · 06</span>
        <span className="mini">Reset</span>
      </div>
      <div className="roster-list">
        {ROSTER.map((a) => {
          const d = applied ? DELTAS[a.id] : null;
          const morale = Math.max(0, Math.min(100, a.morale + (d?.morale || 0)));
          const stress = Math.max(0, Math.min(10, a.stress + (d?.stress || 0)));
          const changed = applied && d && (d.morale || d.stress || d.afflicted || d.resolve);
          return (
            <div key={a.id} className={`agent-card${changed ? ' changed' : ''}`}>
              <div className="agent-card-top">
                <Portrait a={a} applied={applied} />
                <div className="agent-id">
                  <div className="agent-name">{a.name}</div>
                  <div className="agent-role">{a.role}</div>
                </div>
                <span className="tier-chip">{a.tier}</span>
              </div>
              <div className="agent-bars">
                <div className="bar-row">
                  <div className="bar-lbl"><span>Morale</span><span className="v">{morale}</span></div>
                  <div className="bar-track"><div className="bar-fill morale" style={{ width: `${morale}%` }} /></div>
                </div>
                <div className="bar-row">
                  <div className="bar-lbl"><span>Stress</span><span className="v">{stress}/10</span></div>
                  <div className={`bar-track${changed && d.stress ? ' pulse' : ''}`}>
                    <div className={`bar-fill stress ${stressTag(stress)}`} style={{ width: `${stress * 10}%` }} />
                  </div>
                </div>
              </div>
              {applied && d && d.afflicted && <div className="agent-flag">Afflicted · stress threshold crossed.</div>}
              {applied && d && d.resolve && <div className="agent-flag scope">Resolved · held under pressure.</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── IMMINENT RAIL ────────────────────────────────────────────── */
const IMMINENT = [
  <><strong>Jareth Brimstone</strong> trait reveal in <span className="mono">3 jobs</span></>,
  <><strong>Gwenna Emberveil</strong> trait reveal in <span className="mono">3 jobs</span></>,
  <><strong>Fylan Hollowfen</strong> trait reveal in <span className="mono">3 jobs</span></>,
  <><strong>Jareth Forhaven</strong> trait reveal in <span className="mono">3 jobs</span></>,
  <><span className="mono">Recreation L2</span> → +1 token/cycle</>,
];
function ImminentRail() {
  return (
    <div className="col col-right">
      <div className="imminent-head">Imminent</div>
      <div className="imminent-list">
        {IMMINENT.map((x, i) => (
          <div key={i} className="imm-item"><span className="dot">◇</span><span>{x}</span></div>
        ))}
      </div>
    </div>
  );
}

/* ── PLAN VIEW (pre-advance) ──────────────────────────────────── */
function PlanView() {
  return (
    <div className="col col-center">
      <div className="center-inner">
        <div className="oob">
          <h2><span className="ord">Order of Business</span>Cycle 03</h2>
          <div className="right">Tier I · 2 of 6 cleared<br/><span className="accent">Plan the cycle, then advance</span></div>
        </div>

        <div className="intent">
          <div className="lbl"><span>Intent · This Cycle</span><span className="edit">Edit</span></div>
          <div className="txt">Push the Warrens for first clear. Run the Cellar on farm. Watch Fylan — he’s one bad run from threshold.</div>
        </div>

        <div className="sec-head"><h3>Contracts</h3><span className="meta">Tier I · 2 slotted</span></div>

        <div className="contract cleared">
          <div className="contract-head">
            <span className="contract-name">The Cellar</span>
            <span className="tag cleared">Farm</span>
          </div>
          <div className="contract-body">
            <div className="contract-desc">A nest of giant rats in the guild cellar. An easy contract to keep the charter on its feet.</div>
            <div className="contract-stat">6 of 6 agents · 0 lockout · cleared ×3</div>
            <div className="plan-readout">
              <span className="verdict">Good plan</span>
              <span className="txt">Current roster clears every projected check comfortably. The safe pick.</span>
            </div>
          </div>
        </div>

        <div className="contract push">
          <div className="contract-head">
            <span className="contract-name">The Warrens</span>
            <span className="tag push">First-clear push</span>
          </div>
          <div className="contract-body">
            <div className="contract-desc">A recruit-pack warren under the east wall. Swarm-heavy. The first contract that can actually punish a tired roster.</div>
            <div className="contract-stat">4 of 6 agents · 1 lockout · first attempt</div>
            <div className="plan-readout" style={{ borderColor: 'var(--accent)' }}>
              <span className="verdict" style={{ background: 'var(--accent)' }}>Tight</span>
              <span className="txt">Swarm Control projects <strong>under</strong> threshold on Fylan. Clears if Emberveil carries the burn — but he may break.</span>
            </div>
            <div className="contract-roster">
              {['forhaven', 'hollowfen', 'fylan', 'emberveil'].map((id) => (
                <div key={id} className="mini-chip">
                  <span className="pp">{BY_ID[id].initials}</span>
                  <span className="nm">{BY_ID[id].name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── DIGEST VIEW (post-advance) ───────────────────────────────── */
function Headline({ parts, accentWord }) {
  return parts.map((p, i) => (
    <React.Fragment key={i}>{p === accentWord ? <span className="accent">{p}</span> : p}</React.Fragment>
  ));
}

function DigestView({ decided, onDecide }) {
  const [picked, setPicked] = useState(null);
  const [stamping, setStamping] = useState(false);
  const affected = Object.keys(DELTAS);

  const commit = () => {
    if (!picked) return;
    setStamping(true);
    setTimeout(() => onDecide(picked), 650);
  };

  return (
    <div className="col col-center">
      <div className="center-inner digest">
        <div className="digest-masthead">
          <span>Field Report · N° 04 · Karazhan, Tier I</span>
          <span className="accent">2 contracts · 1 near-miss</span>
        </div>

        <div className="digest-kicker">The cycle resolved</div>
        <div className="digest-headline"><Headline parts={REPORT.headline} accentWord={REPORT.accentWord} /></div>
        <div className="digest-deck">{REPORT.deck}</div>

        <div className="applied-note">
          <span className="tick">✓</span>
          All outcomes applied
          <span className="x">— gold, renown, morale and stress are already on the roster. Nothing to collect.</span>
        </div>

        {/* the one thing that needs you — pinned up top */}
        <Docket picked={picked} setPicked={setPicked} decided={decided} stamping={stamping} commit={commit} />

        <div className="sec-head"><h3>What happened</h3><span className="meta">Cycle 03 → 04</span></div>

        <div className="tally">
          <div className="tally-stamp">Cycle<br/>Tally <span className="accent">▸</span></div>
          {[...affected].sort((a, b) => (DELTAS[b].morale || DELTAS[b].stress || 0) === 0 ? -1 : 0).map((id) => {
            const a = BY_ID[id];
            const d = DELTAS[id];
            const sign = d.afflicted ? 'flag' : d.resolve ? 'pos' : (d.morale > 0 ? 'pos' : d.morale < 0 ? 'neg' : 'calm');
            return (
              <div key={id} className={`tally-cell${(d.morale || d.stress || d.afflicted || d.resolve) ? ' changed' : ''}`}>
                <Portrait a={a} applied={true} />
                <span className="nm">{a.name.split(' ')[0]}</span>
                <span className={`delta ${sign}`}>{d.note}</span>
              </div>
            );
          })}
        </div>

        <div className="digest-narr">{REPORT.narrative}</div>

        {REPORT.contracts.map((c) => (
          <div key={c.name} className="audit">
            <div className="audit-head">
              <span className="audit-name">{c.name}</span>
              <span className={`outcome ${c.outcome}`}>{c.outcomeLabel}</span>
            </div>
            <div className="audit-rows">
              {c.mechanics.map((m, i) => (
                <div key={i} className="mech">
                  <span className="mech-name">{m.name}</span>
                  <span className="mech-score"><span className="v">{m.score}</span> / {m.threshold}<span className={`mech-verdict ${m.verdict}`}>{m.verdict}</span></span>
                  <span className="mech-gloss">Carried · <span className="name">{m.carry}</span> — {m.gloss}</span>
                </div>
              ))}
            </div>
            <div className="drops">
              <div className="drops-lbl">Drops</div>
              {c.drops.map((d) => (
                <div key={d.name} className="drop">
                  <div>
                    <span className="nm">{d.name}</span>
                    <span className="st"> · {d.stat}</span>
                  </div>
                  <span className={`status ${d.status}`}>{d.statusLabel}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="digest-close">
          <span>Cycle 04 closes.</span>
          <span className="next">{decided ? 'Cycle 05 ready ▸' : 'One decision pending'}</span>
        </div>
      </div>
    </div>
  );
}

function Docket({ picked, setPicked, decided, stamping, commit }) {
  return (
    <div className={`docket${decided ? ' attended' : ''}`}>
      <div className="docket-banner">
        <span className="l"><span className="pip">Needs you</span> Order of Business · {DECISION.type}</span>
        <span className="r">{DECISION.no}</span>
      </div>
      <div className="docket-body">
        <div className="docket-headline"><Headline parts={DECISION.headline} accentWord={DECISION.accentWord} /></div>
        <div className="docket-prompt">{DECISION.prompt}</div>
        <div className="docket-item">
          <div className="inm">{DECISION.item.name}</div>
          <div className="ist">{DECISION.item.stat}</div>
          <div className="ifl">{DECISION.item.flavor}</div>
        </div>
        <div className="choices">
          {DECISION.choices.map((c) => (
            <button
              key={c.id}
              className={`choice${picked === c.id ? ' selected' : ''}`}
              disabled={decided}
              onClick={() => setPicked(c.id)}
            >
              <span className={`pp${c.id === 'shelve' ? ' none' : ''}`}>{c.id === 'shelve' ? '—' : BY_ID[c.id].initials}</span>
              <span className="c-main">
                <span className="c-verdict">{c.verdict}</span>
                <span className="c-who">{c.who}</span>
                <span className="c-read">{c.read}</span>
              </span>
            </button>
          ))}
        </div>
        {!decided && (
          <div className="docket-commit">
            <button className={`btn primary${picked ? '' : ''}`} disabled={!picked} onClick={commit}>
              {picked ? 'Commit decision' : 'Pick an option'}<span className="arrow">▸</span>
            </button>
            <span className="hint">Resolved here. No screen to visit.</span>
          </div>
        )}
      </div>
      <span className={`attended-stamp${stamping || decided ? ' show' : ''}`}>Attended</span>
      {decided && <div className="docket-resolved-line">{RESOLVED_LINES[decided]}</div>}
    </div>
  );
}

/* ── OVERLAYS ─────────────────────────────────────────────────── */
function PressRun() {
  return (
    <div className="overlay">
      <div className="press-stamp">Cycle passes · Auditing</div>
      <div className="press-cycle">
        <span className="from">03</span>
        <span className="arrow">▸</span>
        <span>04</span>
      </div>
      <div className="press-band" />
      <div className="press-ticker">
        {TICKER.map((t, i) => (
          <div key={i} className="press-line" style={{ animationDelay: `${0.15 + i * 0.14}s`, position: i === 0 ? 'relative' : 'absolute', display: 'none' }}>{t}</div>
        ))}
        <RollingTicker />
      </div>
    </div>
  );
}
function RollingTicker() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= TICKER.length - 1) return;
    const t = setTimeout(() => setI(i + 1), 175);
    return () => clearTimeout(t);
  }, [i]);
  return <div key={i} className="press-line">{TICKER[i]}</div>;
}

function HeadlineScreen({ onTap }) {
  const words = 'The Warrens held by two health.'.split(' ');
  return (
    <div className="headline-screen" onClick={onTap}>
      <div className="hs-masthead"><em>AXM</em> Arc<span className="small">Field Report · N° 04 · Karazhan, Tier I</span></div>
      <div className="hs-meta"><span>Cycle 04</span><span className="accent">2 contracts · 1 near-miss</span></div>
      <div className="hs-kicker">Field Report · Verdict</div>
      <div className="hs-headline">
        {words.map((w, i) => (
          <span key={i} className={`w${w === 'held' ? ' accent' : ''}`} style={{ animationDelay: `${0.1 + i * 0.11}s` }}>{w}{' '}</span>
        ))}
      </div>
      <div className="hs-deck">{REPORT.deck}</div>
      <div className="hs-hint">Click to read the cycle ▸</div>
    </div>
  );
}

/* ── APP ──────────────────────────────────────────────────────── */
function App() {
  const [phase, setPhase] = useState('plan'); // plan | press | headline | digest
  const [decided, setDecided] = useState(null);
  const applied = phase === 'digest';

  const advance = () => {
    setPhase('press');
    setTimeout(() => setPhase('headline'), 1500);
  };
  const reset = () => { setPhase('plan'); setDecided(null); };

  // resource counters
  const counters = applied
    ? [
        { lbl: 'Contracts', val: '4', sub: '+2 next' },
        { lbl: 'Gold', val: '135', delta: { t: '+6', d: 'up' }, sub: 'Warrens clear' },
        { lbl: 'Charter Renown', val: '4 / 5', accent: true, sub: 'to next tier' },
        { lbl: 'Drama', val: decided ? '0' : '1', accent: !decided, sub: decided ? 'clear' : 'one decision' },
      ]
    : [
        { lbl: 'Contracts', val: '4', sub: '+2 next' },
        { lbl: 'Gold', val: '129', delta: { t: '−17', d: 'dn' }, sub: 'upkeep' },
        { lbl: 'Charter Renown', val: '3 / 5', accent: true, sub: 'to next tier' },
        { lbl: 'Drama', val: '0', sub: 'queued' },
      ];

  return (
    <div className="frame">
      <div className="topbar">
        <span className="tb-room">Situation Room · Cycle {applied ? '04' : '03'} <span className="tb-help">?</span></span>
        <span className="tb-wordmark"><em>AXM</em></span>
        <span className="tb-arc">· Arc 01</span>
        <span className="tb-title">The First Charter</span>
        <span className="tb-meta">Fantasy · Tier I · {applied ? '3' : '2'} of 6 cleared · Build 4F7804F</span>
        <span className="tb-spacer" />
        <div className="counters">
          {counters.map((c) => (
            <div key={c.lbl} className="counter">
              <div className="c-lbl">{c.lbl}</div>
              <div className={`c-val${c.accent ? ' accent' : ''}`}>
                <span className={applied ? 'num-flash' : ''}>{c.val}</span>
                {c.delta && <span className={`delta ${c.delta.d}`}>{c.delta.t}</span>}
              </div>
              <div className="c-sub">{c.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="actionrow">
        <button className="btn">Save</button>
        {!applied && <button className="btn primary" onClick={advance}>Advance Cycle <span className="arrow">→</span></button>}
        {applied && (
          <button className={`btn primary${decided ? ' pending' : ''}`} disabled={!decided} onClick={reset}>
            {decided ? 'Open Cycle 05' : 'Resolve the decision first'} <span className="arrow">→</span>
          </button>
        )}
        <div className="action-readback">
          {!applied && (
            <>Running <span className="name">2</span> contracts<span className="sep">·</span><span className="name">1</span> lockout<span className="sep">·</span><span className="warn">Fylan at S7</span></>
          )}
          {applied && !decided && (
            <><span className="warn">▸ One decision on the page.</span> Resolve it where it sits — then open the next cycle.</>
          )}
          {applied && decided && (
            <><span className="ok">▸ Business attended.</span> The cycle is clean. No tabs were visited.</>
          )}
        </div>
      </div>

      <div className="body">
        <RosterRail applied={applied} />
        {phase === 'digest'
          ? <DigestView decided={decided} onDecide={setDecided} />
          : <PlanView />}
        <ImminentRail />
      </div>

      {phase === 'press' && <PressRun />}
      {phase === 'headline' && <HeadlineScreen onTap={() => setPhase('digest')} />}

      <div className="caption">
        <span className="accent">▸</span>
        <span>The collapsed loop: <em>Advance Cycle</em> → one digest page. Outcomes are reported, not collected. Only the real decision asks for you.</span>
        <button className="reset" onClick={reset}>↺ Reset</button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
