import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Arc } from "../../engine/types.js";
import { cartridgeDigest } from "../../engine/cartridge-digest.js";
import type {
  DarkTombDelveBlueprint,
  DarkTombLayerKind,
  DarkTombPocketSource,
} from "../../dark-tomb/types.js";
import { importArcFromJson } from "../lib/arc-library.js";
import {
  compileDarkTombJson,
  darkTombStarterJson,
  lampDistrictJson,
  loadDarkTombDraft,
  parseEditableDarkTombSource,
  playtestDarkTombArc,
  saveDarkTombDraft,
  updateEditableDarkTombSource,
  type DarkTombCompileResult,
  type DarkTombPlaytestResult,
} from "../lib/dark-tomb-forge.js";
import { playArcPresentationCue } from "../lib/sensory-prefs.js";
import { AuthoringAuditPanel } from "./AuthoringAuditPanel.js";
import "../styles/godscar-forge.css";

interface Props {
  onBack: () => void;
  onOpenLibrary: () => void;
  onPlayArc: (arc: Arc) => void;
}

type ForgeMode = "guided" | "source";

const CANON_RELATIONS = ["foundational", "compatible", "contested", "alternate-sequence", "crossover", "private-branch"] as const;
const CANON_TIERS = ["settled-canon", "contested-canon", "faction-doctrine", "story-facing-unknown"] as const;
const DELVE_TIERS = ["ordinary-life", "descent", "breach", "return"] as const;
const LAYERS: readonly DarkTombLayerKind[] = [
  "grave-skin",
  "shroud",
  "quiet-works",
  "common-depths",
  "custodial-ring",
  "war-layer",
  "black-core",
];
const ALARM_PHASES = ["shadow", "hush", "fold", "black", "cut", "wake"] as const;

function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }): JSX.Element {
  return <label className={`godscar-field${wide ? " godscar-field--wide" : ""}`}><span>{label}</span>{children}</label>;
}

function TextField({ label, value, onChange, wide = false, multiline = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
  multiline?: boolean;
}): JSX.Element {
  return (
    <Field label={label} wide={wide}>
      {multiline
        ? <textarea value={value} onChange={(event) => onChange(event.target.value)} />
        : <input value={value} onChange={(event) => onChange(event.target.value)} />}
    </Field>
  );
}

function NumberField({ label, value, onChange, min = 0, max = 1000 }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}): JSX.Element {
  return <Field label={label}><input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></Field>;
}

function SelectField<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}): JSX.Element {
  return <Field label={label}><select value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>;
}

function JsonEditor({ label, value, onCommit, note }: {
  label: string;
  value: unknown;
  onCommit: (value: unknown) => void;
  note?: string;
}): JSX.Element {
  const serialized = JSON.stringify(value, null, 2);
  const [text, setText] = useState(serialized);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setText(serialized); setError(null); }, [serialized]);
  const commit = () => {
    try {
      onCommit(JSON.parse(text) as unknown);
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  return (
    <div className="godscar-notes">
      <strong>{label}</strong>
      {note && <span className="godscar-source-note">{note}</span>}
      <textarea rows={Math.min(22, Math.max(7, text.split("\n").length + 1))} value={text} onChange={(event) => setText(event.target.value)} />
      <div><button type="button" className="secondary" onClick={commit}>Apply structured JSON</button></div>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}

function DelveEditor({ source, delve, index, mutateSource }: {
  source: DarkTombPocketSource;
  delve: DarkTombDelveBlueprint;
  index: number;
  mutateSource: (mutate: (source: DarkTombPocketSource) => void) => void;
}): JSX.Element {
  const mutate = (edit: (entry: DarkTombDelveBlueprint) => void) => mutateSource((draft) => edit(draft.delves[index]!));
  return (
    <details className="godscar-card" data-testid={`dark-tomb-delve-${delve.id}`}>
      <summary><span>{index + 1}</span><strong>{delve.name || delve.id}</strong><small>{delve.tierId} · {delve.layer}</small></summary>
      <div className="godscar-card__body godscar-stack">
        <div className="godscar-grid">
          <TextField label="Id" value={delve.id} onChange={(value) => mutate((entry) => { entry.id = value; })} />
          <TextField label="Name" value={delve.name} onChange={(value) => mutate((entry) => { entry.name = value; })} />
          <TextField wide multiline label="Description" value={delve.description} onChange={(value) => mutate((entry) => { entry.description = value; })} />
          <SelectField label="Movement" value={delve.tierId} options={DELVE_TIERS} onChange={(value) => mutate((entry) => { entry.tierId = value; })} />
          <SelectField label="Layer" value={delve.layer} options={LAYERS} onChange={(value) => mutate((entry) => { entry.layer = value; })} />
          <Field label="Access after"><select value={delve.accessAfter ?? ""} onChange={(event) => mutate((entry) => { if (event.target.value) entry.accessAfter = event.target.value; else delete entry.accessAfter; })}><option value="">—</option>{source.delves.filter((candidate) => candidate.id !== delve.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></Field>
          <Field label="Consequence"><select value={delve.consequenceId} onChange={(event) => mutate((entry) => { entry.consequenceId = event.target.value; })}>{source.consequences.map((consequence) => <option key={consequence.id} value={consequence.id}>{consequence.label}</option>)}</select></Field>
          <NumberField label="Difficulty" value={delve.difficulty} min={1} max={100} onChange={(value) => mutate((entry) => { entry.difficulty = value; })} />
          <NumberField label="Minimum expedition" value={delve.minAgents} min={1} max={20} onChange={(value) => mutate((entry) => { entry.minAgents = value; })} />
          <NumberField label="Maximum expedition" value={delve.maxAgents} min={1} max={20} onChange={(value) => mutate((entry) => { entry.maxAgents = value; })} />
          <NumberField label="Standing" value={delve.reputationGain} min={0} onChange={(value) => mutate((entry) => { entry.reputationGain = value; })} />
          <NumberField label="Quiet tonnage" value={delve.currencyReward} min={0} onChange={(value) => mutate((entry) => { entry.currencyReward = value; })} />
        </div>
        <div className="godscar-grid">
          <TextField wide multiline label="Success" value={delve.success} onChange={(value) => mutate((entry) => { entry.success = value; })} />
          <TextField wide multiline label="Partial" value={delve.partial} onChange={(value) => mutate((entry) => { entry.partial = value; })} />
          <TextField wide multiline label="Failure" value={delve.failure} onChange={(value) => mutate((entry) => { entry.failure = value; })} />
        </div>
        <JsonEditor label="Five-dimensional depth vector" value={delve.depth} onCommit={(value) => mutate((entry) => { entry.depth = value as DarkTombDelveBlueprint["depth"]; })} />
        <JsonEditor label="Expedition ledger" value={delve.expedition} onCommit={(value) => mutate((entry) => { entry.expedition = value as DarkTombDelveBlueprint["expedition"]; })} />
        <JsonEditor label="Required roles" value={delve.requiredRoles ?? []} onCommit={(value) => mutate((entry) => { entry.requiredRoles = value as NonNullable<DarkTombDelveBlueprint["requiredRoles"]>; })} />
        <JsonEditor label="Checks" value={delve.checks} onCommit={(value) => mutate((entry) => { entry.checks = value as DarkTombDelveBlueprint["checks"]; })} />
      </div>
    </details>
  );
}

function GuidedEditor({ source, mutateSource }: {
  source: DarkTombPocketSource;
  mutateSource: (mutate: (source: DarkTombPocketSource) => void) => void;
}): JSX.Element {
  return (
    <div className="godscar-guided" data-testid="dark-tomb-guided-editor">
      <details className="godscar-card" open>
        <summary><span>01</span><strong>Identity and control question</strong><small>{source.identity.id}</small></summary>
        <div className="godscar-card__body"><div className="godscar-grid">
          <TextField label="Id" value={source.identity.id} onChange={(value) => mutateSource((draft) => { draft.identity.id = value; })} />
          <TextField label="Title" value={source.identity.title} onChange={(value) => mutateSource((draft) => { draft.identity.title = value; })} />
          <TextField wide multiline label="Description" value={source.identity.description} onChange={(value) => mutateSource((draft) => { draft.identity.description = value; })} />
          <TextField label="Author" value={source.identity.author} onChange={(value) => mutateSource((draft) => { draft.identity.author = value; })} />
          <TextField label="Version" value={source.identity.version} onChange={(value) => mutateSource((draft) => { draft.identity.version = value; })} />
          <NumberField label="Estimated cycles" value={source.identity.estimatedCycles} min={1} max={1000} onChange={(value) => mutateSource((draft) => { draft.identity.estimatedCycles = value; })} />
          <SelectField label="Canon relation" value={source.identity.canonRelation} options={CANON_RELATIONS} onChange={(value) => mutateSource((draft) => { draft.identity.canonRelation = value; })} />
          <TextField wide multiline label="Parent canons, one per line" value={source.identity.parentCanons.join("\n")} onChange={(value) => mutateSource((draft) => { draft.identity.parentCanons = value.split("\n").map((line) => line.trim()).filter(Boolean); })} />
          <TextField wide multiline label="Control question" value={source.controlQuestion} onChange={(value) => mutateSource((draft) => { draft.controlQuestion = value; })} />
        </div></div>
      </details>

      <details className="godscar-card" open>
        <summary><span>02</span><strong>Eight Tomb Engine pressures</strong><small>8 / 8</small></summary>
        <div className="godscar-card__body godscar-stack">{source.pressures.map((pressure, index) => <article className="godscar-subcard" key={pressure.kind}><header><strong>{index + 1}. {pressure.kind}</strong></header><div className="godscar-grid">
          <TextField label="Id" value={pressure.id} onChange={(value) => mutateSource((draft) => { draft.pressures[index]!.id = value; })} />
          <TextField label="Label" value={pressure.label} onChange={(value) => mutateSource((draft) => { draft.pressures[index]!.label = value; })} />
          <TextField wide multiline label="Description" value={pressure.description} onChange={(value) => mutateSource((draft) => { draft.pressures[index]!.description = value; })} />
        </div></article>)}</div>
      </details>

      <details className="godscar-card">
        <summary><span>03</span><strong>Evidence, Alarm, and signature</strong><small>{source.alarm.currentPhase}</small></summary>
        <div className="godscar-card__body godscar-stack">
          <div className="godscar-grid">
            <SelectField label="Evidence tier" value={source.evidence.tier} options={CANON_TIERS} onChange={(value) => mutateSource((draft) => { draft.evidence.tier = value; })} />
            <SelectField label="Current Alarm phase" value={source.alarm.currentPhase} options={ALARM_PHASES} onChange={(value) => mutateSource((draft) => { draft.alarm.currentPhase = value; })} />
            <TextField wide multiline label="Claim" value={source.evidence.claim} onChange={(value) => mutateSource((draft) => { draft.evidence.claim = value; })} />
            <TextField wide multiline label="Certifying venue" value={source.evidence.venue} onChange={(value) => mutateSource((draft) => { draft.evidence.venue = value; })} />
            <TextField wide multiline label="Legitimacy target" value={source.evidence.legitimacyTarget} onChange={(value) => mutateSource((draft) => { draft.evidence.legitimacyTarget = value; })} />
            <TextField wide multiline label="Upside if accepted" value={source.evidence.upsideIfAccepted} onChange={(value) => mutateSource((draft) => { draft.evidence.upsideIfAccepted = value; })} />
            <TextField wide multiline label="Downside if accepted" value={source.evidence.downsideIfAccepted} onChange={(value) => mutateSource((draft) => { draft.evidence.downsideIfAccepted = value; })} />
            <TextField wide multiline label="Failure if false" value={source.evidence.failureIfFalse} onChange={(value) => mutateSource((draft) => { draft.evidence.failureIfFalse = value; })} />
            <TextField wide multiline label="Original threat" value={source.alarm.originalThreat} onChange={(value) => mutateSource((draft) => { draft.alarm.originalThreat = value; })} />
            <TextField wide multiline label="Audit problem" value={source.alarm.auditProblem} onChange={(value) => mutateSource((draft) => { draft.alarm.auditProblem = value; })} />
            <TextField label="Observer" value={source.signatureBudget.observer} onChange={(value) => mutateSource((draft) => { draft.signatureBudget.observer = value; })} />
            <TextField label="Exterior classification" value={source.signatureBudget.exteriorClassification} onChange={(value) => mutateSource((draft) => { draft.signatureBudget.exteriorClassification = value; })} />
          </div>
          <JsonEditor label="Evidence receipts" value={source.evidence.receipts} onCommit={(value) => mutateSource((draft) => { draft.evidence.receipts = value as DarkTombPocketSource["evidence"]["receipts"]; })} />
          <JsonEditor label="Alarm phases" value={source.alarm.phases} onCommit={(value) => mutateSource((draft) => { draft.alarm.phases = value as DarkTombPocketSource["alarm"]["phases"]; })} />
          <JsonEditor label="Signature wake sources" value={source.signatureBudget.wakeSources} onCommit={(value) => mutateSource((draft) => { draft.signatureBudget.wakeSources = value as string[]; })} />
          <JsonEditor label="Signature operations" value={source.signatureBudget.operations} onCommit={(value) => mutateSource((draft) => { draft.signatureBudget.operations = value as DarkTombPocketSource["signatureBudget"]["operations"]; })} />
          <JsonEditor label="Ordinary-life signature allocations" value={source.signatureBudget.allocations} onCommit={(value) => mutateSource((draft) => { draft.signatureBudget.allocations = value as DarkTombPocketSource["signatureBudget"]["allocations"]; })} />
        </div>
      </details>

      <details className="godscar-card">
        <summary><span>04</span><strong>Political and spatial source</strong><small>creator-owned JSON</small></summary>
        <div className="godscar-card__body godscar-stack">
          <JsonEditor label="Faction receipts" value={source.factionReceipts} onCommit={(value) => mutateSource((draft) => { draft.factionReceipts = value as DarkTombPocketSource["factionReceipts"]; })} />
          <JsonEditor label="Named cast and incompatible responsibilities" value={source.cast} onCommit={(value) => mutateSource((draft) => { draft.cast = value as DarkTombPocketSource["cast"]; })} />
          <JsonEditor label="Seven-layer anatomy" value={source.anatomy} onCommit={(value) => mutateSource((draft) => { draft.anatomy = value as DarkTombPocketSource["anatomy"]; })} />
          <JsonEditor label="Five forms of depth" value={source.depths} onCommit={(value) => mutateSource((draft) => { draft.depths = value as DarkTombPocketSource["depths"]; })} />
          <JsonEditor label="Persistent consequences" value={source.consequences} onCommit={(value) => mutateSource((draft) => { draft.consequences = value as DarkTombPocketSource["consequences"]; })} />
          <JsonEditor label="Story Physics" value={source.storyPhysics} onCommit={(value) => mutateSource((draft) => { draft.storyPhysics = value as DarkTombPocketSource["storyPhysics"]; })} note="A valid first-recension source keeps all ten invariants true." />
          <JsonEditor label="Notes" value={source.notes ?? {}} onCommit={(value) => mutateSource((draft) => { draft.notes = value as DarkTombPocketSource["notes"]; })} />
        </div>
      </details>

      <div className="godscar-section-heading"><h2>Ordinary life, descent, breach, and return</h2><span>{source.delves.length} movements</span></div>
      {source.delves.map((delve, index) => <DelveEditor key={`${delve.id}-${index}`} source={source} delve={delve} index={index} mutateSource={mutateSource} />)}
    </div>
  );
}

export function DarkTombForgeScreen({ onBack, onOpenLibrary, onPlayArc }: Props): JSX.Element {
  const [text, setText] = useState(() => loadDarkTombDraft() ?? darkTombStarterJson());
  const [mode, setMode] = useState<ForgeMode>("guided");
  const [result, setResult] = useState<DarkTombCompileResult | null>(null);
  const [playtest, setPlaytest] = useState<DarkTombPlaytestResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const editable = useMemo(() => parseEditableDarkTombSource(text), [text]);

  const replaceDraft = (next: string): void => {
    setText(next);
    const write = saveDarkTombDraft(next);
    setMessage(write.ok ? null : write.message);
    setResult(null);
    setPlaytest(null);
  };

  const mutateSource = (mutate: (source: DarkTombPocketSource) => void): void => {
    const updated = updateEditableDarkTombSource(text, mutate);
    if (!updated.ok) {
      setMessage(updated.message);
      setMode("source");
      return;
    }
    replaceDraft(updated.text);
  };

  const compile = (): Extract<DarkTombCompileResult, { ok: true }> | null => {
    const next = compileDarkTombJson(text);
    setResult(next);
    setPlaytest(null);
    if (next.ok) playArcPresentationCue("compile", next.arc.meta.id);
    return next.ok ? next : null;
  };

  const install = (): void => {
    const compiled = compile();
    if (!compiled) return;
    const installed = importArcFromJson(JSON.stringify(compiled.arc));
    setMessage(installed.ok
      ? `Installed “${installed.entry.arc.meta.name}” as an imported, unsigned cartridge.`
      : installed.errors.join(" "));
  };

  const actualMode: ForgeMode = mode === "guided" && !editable.ok ? "source" : mode;
  const digest = result?.ok ? cartridgeDigest(result.arc) : null;

  return (
    <div className="title-screen godscar-forge-screen" role="region" aria-label="Dark Tomb Forge">
      <div className="title-content godscar-forge-shell">
        <header className="godscar-forge-header">
          <div><div className="title-imprint">GODSCAR · BOOK II</div><div className="title-rule" /><h1 className="title-name">Dark Tomb Forge</h1><p>Author a hidden civic underworld through the exact Book II source contract. The Forge validates and compiles through the registered Arc source plane, then executes the ordinary deterministic engine.</p></div>
          <div className="godscar-mode-switch" role="group" aria-label="Dark Tomb editor mode">
            <button type="button" className={actualMode === "guided" ? "primary accent" : "secondary"} disabled={!editable.ok} aria-pressed={actualMode === "guided"} onClick={() => setMode("guided")}>Guided source</button>
            <button type="button" className={actualMode === "source" ? "primary accent" : "secondary"} aria-pressed={actualMode === "source"} onClick={() => setMode("source")}>Exact JSON</button>
          </div>
        </header>

        <div className="godscar-toolbar">
          <button className="secondary" onClick={() => { replaceDraft(darkTombStarterJson()); setMode("guided"); }}>New private Tomb</button>
          <button className="secondary" onClick={() => { replaceDraft(lampDistrictJson()); setMode("guided"); }}>Load The Lamp District</button>
          <label className="secondary godscar-file-button">Import `.tomb.json`<input type="file" accept="application/json,.json,.tomb.json" onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) replaceDraft(await file.text()); }} /></label>
          <button className="secondary" onClick={onOpenLibrary}>Library</button>
          <button className="secondary" onClick={onBack}>Back</button>
        </div>

        {!editable.ok && <div className="warning godscar-guided-warning" role="alert"><strong>Guided editing is unavailable until the exact source validates.</strong><span>{editable.message}</span></div>}

        {actualMode === "guided" && editable.ok
          ? <GuidedEditor source={editable.source} mutateSource={mutateSource} />
          : <textarea className="godscar-source-editor" data-testid="dark-tomb-forge-editor" aria-label="Dark Tomb exact source editor" rows={34} value={text} onChange={(event) => replaceDraft(event.target.value)} />}

        <p className="godscar-source-note">The editable `dark-tomb-pocket/1` object remains the holder's source. Compilation embeds it unchanged under `godscar.dark-tomb@1`; the receiver does not become its author.</p>

        <div className="godscar-build-actions">
          <button className="primary accent" onClick={compile}>Validate and compile</button>
          <button className="secondary" onClick={() => { const compiled = compile(); if (compiled) setPlaytest(playtestDarkTombArc(compiled.arc)); }}>Seeded campaign test</button>
          <button className="secondary" onClick={install}>Install cartridge</button>
          <button className="secondary" onClick={() => { const compiled = compile(); if (compiled) download(`${compiled.source.identity.id}.tomb.json`, JSON.stringify(compiled.source, null, 2)); }}>Export source</button>
          <button className="secondary" onClick={() => { const compiled = compile(); if (compiled) download(`${compiled.arc.meta.id}.arc.json`, JSON.stringify(compiled.arc, null, 2)); }}>Export Arc</button>
          <button className="secondary" onClick={() => { const compiled = compile(); if (compiled) onPlayArc(compiled.arc); }}>Open compiled Arc</button>
        </div>

        {message && <div role="status" className="warning godscar-message">{message}</div>}
        {result && !result.ok && <div role="alert" className="warning godscar-result"><strong>Compilation refused</strong><ul>{result.errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
        {result?.ok && <section data-testid="dark-tomb-forge-summary" className="godscar-result godscar-result--valid"><div className="godscar-valid-line">VALID DARK TOMB · {digest}</div><h2>{result.source.identity.title}</h2><p><strong>{result.source.evidence.tier}</strong> · Alarm {result.source.alarm.currentPhase} · {result.source.delves.length} movements</p><blockquote>{result.source.controlQuestion}</blockquote><div className="godscar-pressure-summary">{result.source.pressures.map((pressure, index) => <div key={pressure.kind}><small>{index + 1} · {pressure.kind}</small><strong>{pressure.label}</strong></div>)}</div><p>{result.source.cast.length} named actors · {result.source.anatomy.length} layers · {result.source.consequences.length} inherited consequences</p><AuthoringAuditPanel arc={result.arc} compact /></section>}
        {playtest && <section data-testid="dark-tomb-playtest" className="godscar-result"><strong>Bounded deterministic campaign test</strong><p>{playtest.cleared} / {playtest.seeds.length} seeds cleared within {playtest.maxCycles} cycles. Worst run: {playtest.worstCycles} cycles. Gate violations: {playtest.gateViolations}.</p>{playtest.warnings.length > 0 && <ul>{playtest.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}</section>}
      </div>
    </div>
  );
}
