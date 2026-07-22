import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Arc } from "../../engine/types.js";
import type {
  CanonRelation,
  CanonTier,
  GodscarBeatBlueprint,
  GodscarCastMember,
  GodscarCastResponsibility,
  GodscarCheckBlueprint,
  GodscarConsequence,
  GodscarPocketSource,
} from "../../godscar/types.js";
import { KIND_GODS_OF_ILYON_BLUEPRINT } from "../../godscar/templates.js";
import { t, useLocale } from "../../i18n/index.js";
import { importArcFromJson } from "../lib/arc-library.js";
import {
  compileGodscarJson,
  godscarSkeletonJson,
  loadGodscarDraft,
  playtestGodscarArc,
  saveGodscarDraft,
  type GodscarCompileResult,
} from "../lib/godscar-forge.js";
import {
  newBeat,
  newCastMember,
  newConsequence,
  newEvidenceReceipt,
  newFactionReceipt,
  newGodscarCheck,
  parseEditableGodscarSource,
  updateEditableGodscarSource,
} from "../lib/godscar-guided.js";
import { playArcPresentationCue } from "../lib/sensory-prefs.js";
import { AuthoringAuditPanel } from "./AuthoringAuditPanel.js";
import "../styles/godscar-forge.css";

interface Props {
  onBack: () => void;
  onOpenLibrary: () => void;
  onPlayArc: (arc: Arc) => void;
}

type ForgeMode = "guided" | "source";
type RoleId = GodscarCastMember["roleId"];
type ConsequenceKind = GodscarConsequence["kind"];
type BeatTier = GodscarBeatBlueprint["tierId"];
type CheckScope = GodscarCheckBlueprint["scope"];
type FailureType = NonNullable<GodscarCheckBlueprint["failureType"]>;
type AttributeId = keyof GodscarCheckBlueprint["weights"];

const CANON_RELATIONS: CanonRelation[] = ["foundational", "compatible", "contested", "alternate-sequence", "crossover", "private-branch"];
const CANON_TIERS: CanonTier[] = ["settled-canon", "contested-canon", "faction-doctrine", "story-facing-unknown"];
const ROLE_IDS: RoleId[] = ["auditor", "interlocutor", "witness", "protector", "exception"];
const RESPONSIBILITIES: GodscarCastResponsibility[] = ["depends-on-system", "translates-excluded-actor", "holds-evidence", "benefits-from-delay", "sovereign-exception"];
const CONSEQUENCE_KINDS: ConsequenceKind[] = ["citizen", "dependency", "route", "archive", "doctrine", "adaptive-capacity", "trauma"];
const BEAT_TIERS: BeatTier[] = ["arrival", "disclosure", "refusal"];
const CHECK_SCOPES: CheckScope[] = ["team", "role", "per-agent"];
const FAILURE_TYPES: FailureType[] = ["agent_damage", "team_damage", "stress", "debuff", "cascade"];
const ATTRIBUTES: AttributeId[] = ["care", "evidence", "exteriority", "systems", "resolve"];
const STORY_PHYSICS: Array<keyof GodscarPocketSource["storyPhysics"]> = [
  "noCleanReset",
  "crowningIsConcentration",
  "answerReflectsExclusion",
  "counterformInheritsClaim",
  "scaleIsDistributed",
  "distanceRemainsPolitical",
  "factionReceiptsRequired",
  "everyVictoryChangesMap",
];

function download(filename: string, json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }): JSX.Element {
  return <label className={`godscar-field${wide ? " godscar-field--wide" : ""}`}><span>{label}</span>{children}</label>;
}

function TextField({ label, value, onChange, multiline = false, wide = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  wide?: boolean;
}): JSX.Element {
  return (
    <Field label={label} wide={wide || multiline}>
      {multiline
        ? <textarea value={value} rows={3} onChange={(event) => onChange(event.target.value)} />
        : <input value={value} onChange={(event) => onChange(event.target.value)} />}
    </Field>
  );
}

function NumberField({ label, value, onChange, min, max, step = 1 }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}): JSX.Element {
  return <Field label={label}><input type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></Field>;
}

function SelectField<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}): JSX.Element {
  return <Field label={label}><select value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>;
}

function RemoveButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }): JSX.Element {
  return <button type="button" className="secondary godscar-remove" disabled={disabled} onClick={onClick}>{t("common.remove")}</button>;
}

function NotesEditor({ source, onCommit }: { source: GodscarPocketSource; onCommit: (value: unknown) => void }): JSX.Element {
  const serialized = JSON.stringify(source.notes ?? {}, null, 2);
  const [draft, setDraft] = useState(serialized);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setDraft(serialized); setError(null); }, [serialized]);
  const commit = () => {
    try {
      onCommit(JSON.parse(draft));
      setError(null);
    } catch (caught) {
      setError((caught as Error).message);
    }
  };
  return (
    <div className="godscar-notes">
      <textarea rows={8} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} aria-label={t("godscar.notes")} />
      {error && <small role="alert">{error}</small>}
    </div>
  );
}

function CheckEditor({ beat, check, checkIndex, onMutate, onRemove }: {
  beat: GodscarBeatBlueprint;
  check: GodscarCheckBlueprint;
  checkIndex: number;
  onMutate: (mutate: (check: GodscarCheckBlueprint) => void) => void;
  onRemove: () => void;
}): JSX.Element {
  const weightTotal = ATTRIBUTES.reduce((sum, attribute) => sum + (check.weights[attribute] ?? 0), 0);
  return (
    <article className="godscar-subcard" data-testid={`godscar-check-${beat.id}-${check.id}`}>
      <header><strong>{checkIndex + 1}. {check.name || check.id}</strong><RemoveButton disabled={beat.checks.length <= 1} onClick={onRemove} /></header>
      <div className="godscar-grid">
        <TextField label={t("godscar.fieldId")} value={check.id} onChange={(value) => onMutate((entry) => { entry.id = value; })} />
        <TextField label={t("godscar.fieldName")} value={check.name} onChange={(value) => onMutate((entry) => { entry.name = value; })} />
        <TextField wide multiline label={t("godscar.fieldDescription")} value={check.description} onChange={(value) => onMutate((entry) => { entry.description = value; })} />
        <SelectField label={t("godscar.fieldScope")} value={check.scope} options={CHECK_SCOPES} onChange={(value) => onMutate((entry) => {
          entry.scope = value;
          if (value === "role" && (!entry.roleIds || entry.roleIds.length === 0)) entry.roleIds = ["auditor"];
          if (value !== "role") delete entry.roleIds;
        })} />
        <NumberField label={t("godscar.fieldThreshold")} value={check.threshold} onChange={(value) => onMutate((entry) => { entry.threshold = value; })} />
        <SelectField label={t("godscar.fieldFailureType")} value={check.failureType ?? "stress"} options={FAILURE_TYPES} onChange={(value) => onMutate((entry) => { entry.failureType = value; })} />
        <NumberField label={t("godscar.fieldSeverity")} value={check.severity ?? 0.2} min={0} max={1} step={0.05} onChange={(value) => onMutate((entry) => { entry.severity = value; })} />
      </div>
      {check.scope === "role" && (
        <fieldset className="godscar-inline-options"><legend>{t("godscar.fieldRole")}</legend>{ROLE_IDS.map((roleId) => {
          const checked = check.roleIds?.includes(roleId) ?? false;
          return <label key={roleId}><input type="checkbox" checked={checked} onChange={() => onMutate((entry) => {
            const next = new Set(entry.roleIds ?? []);
            if (next.has(roleId)) next.delete(roleId); else next.add(roleId);
            entry.roleIds = [...next];
          })} />{roleId}</label>;
        })}</fieldset>
      )}
      <fieldset className="godscar-weights"><legend>{t("godscar.fieldWeights")} · {weightTotal.toFixed(2)}</legend>{ATTRIBUTES.map((attribute) => (
        <NumberField key={attribute} label={attribute} value={check.weights[attribute] ?? 0} min={0} max={1} step={0.05} onChange={(value) => onMutate((entry) => { entry.weights[attribute] = value; })} />
      ))}</fieldset>
    </article>
  );
}

function BeatEditor({ source, beat, beatIndex, mutateSource, removeBeat }: {
  source: GodscarPocketSource;
  beat: GodscarBeatBlueprint;
  beatIndex: number;
  mutateSource: (mutate: (source: GodscarPocketSource) => void) => void;
  removeBeat: () => void;
}): JSX.Element {
  const mutateBeat = (mutate: (entry: GodscarBeatBlueprint) => void) => mutateSource((draft) => mutate(draft.beats[beatIndex]!));
  return (
    <details className="godscar-card" data-testid={`godscar-beat-${beat.id}`}>
      <summary><span>{beatIndex + 1}</span><strong>{beat.name || beat.id}</strong><small>{beat.tierId} · {beat.checks.length} {t("godscar.fieldChecks").toLowerCase()}</small></summary>
      <div className="godscar-card__body">
        <div className="godscar-card__actions"><RemoveButton disabled={source.beats.length <= 3} onClick={removeBeat} /></div>
        <div className="godscar-grid">
          <TextField label={t("godscar.fieldId")} value={beat.id} onChange={(value) => mutateBeat((entry) => { entry.id = value; })} />
          <TextField label={t("godscar.fieldName")} value={beat.name} onChange={(value) => mutateBeat((entry) => { entry.name = value; })} />
          <TextField wide multiline label={t("godscar.fieldDescription")} value={beat.description} onChange={(value) => mutateBeat((entry) => { entry.description = value; })} />
          <SelectField label={t("godscar.fieldProgressionTier")} value={beat.tierId} options={BEAT_TIERS} onChange={(value) => mutateBeat((entry) => { entry.tierId = value; })} />
          <Field label={t("godscar.fieldAccessAfter")}><select value={beat.accessAfter ?? ""} onChange={(event) => mutateBeat((entry) => {
            if (event.target.value) entry.accessAfter = event.target.value; else delete entry.accessAfter;
          })}><option value="">—</option>{source.beats.filter((candidate) => candidate.id !== beat.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name || candidate.id}</option>)}</select></Field>
          <NumberField label={t("godscar.fieldDifficulty")} value={beat.difficulty} min={1} max={100} onChange={(value) => mutateBeat((entry) => { entry.difficulty = value; })} />
          <NumberField label={t("godscar.fieldMinAgents")} value={beat.minAgents} min={1} onChange={(value) => mutateBeat((entry) => { entry.minAgents = value; })} />
          <NumberField label={t("godscar.fieldMaxAgents")} value={beat.maxAgents} min={1} onChange={(value) => mutateBeat((entry) => { entry.maxAgents = value; })} />
          <Field label={t("godscar.fieldConsequence")}><select value={beat.consequenceId} onChange={(event) => mutateBeat((entry) => { entry.consequenceId = event.target.value; })}>{source.consequences.map((consequence) => <option key={consequence.id} value={consequence.id}>{consequence.label || consequence.id}</option>)}</select></Field>
          <NumberField label={t("godscar.fieldReputationGain")} value={beat.reputationGain} min={0} onChange={(value) => mutateBeat((entry) => { entry.reputationGain = value; })} />
          <NumberField label={t("godscar.fieldCurrencyReward")} value={beat.currencyReward} min={0} onChange={(value) => mutateBeat((entry) => { entry.currencyReward = value; })} />
        </div>

        <fieldset className="godscar-array-field"><legend>{t("godscar.fieldRequiredRoles")}</legend>
          {(beat.requiredRoles ?? []).map((requirement, requirementIndex) => (
            <div className="godscar-array-row" key={`${requirement.roleId}-${requirementIndex}`}>
              <SelectField label={t("godscar.fieldRole")} value={requirement.roleId} options={ROLE_IDS} onChange={(value) => mutateBeat((entry) => { entry.requiredRoles![requirementIndex]!.roleId = value; })} />
              <NumberField label="#" value={requirement.count} min={1} onChange={(value) => mutateBeat((entry) => { entry.requiredRoles![requirementIndex]!.count = value; })} />
              <RemoveButton onClick={() => mutateBeat((entry) => { entry.requiredRoles?.splice(requirementIndex, 1); })} />
            </div>
          ))}
          <button type="button" className="secondary" onClick={() => mutateBeat((entry) => { (entry.requiredRoles ??= []).push({ roleId: "auditor", count: 1 }); })}>{t("godscar.addRequiredRole")}</button>
        </fieldset>

        <div className="godscar-stack"><div className="godscar-section-heading"><strong>{t("godscar.fieldChecks")}</strong><button type="button" className="secondary" onClick={() => mutateBeat((entry) => { entry.checks.push(newGodscarCheck(entry)); })}>{t("godscar.addCheck")}</button></div>
          {beat.checks.map((check, checkIndex) => <CheckEditor key={`${check.id}-${checkIndex}`} beat={beat} check={check} checkIndex={checkIndex} onMutate={(mutate) => mutateBeat((entry) => mutate(entry.checks[checkIndex]!))} onRemove={() => mutateBeat((entry) => { if (entry.checks.length > 1) entry.checks.splice(checkIndex, 1); })} />)}
        </div>

        <div className="godscar-grid">
          <TextField wide multiline label={t("godscar.fieldSuccess")} value={beat.success} onChange={(value) => mutateBeat((entry) => { entry.success = value; })} />
          <TextField wide multiline label={t("godscar.fieldPartial")} value={beat.partial} onChange={(value) => mutateBeat((entry) => { entry.partial = value; })} />
          <TextField wide multiline label={t("godscar.fieldFailure")} value={beat.failure} onChange={(value) => mutateBeat((entry) => { entry.failure = value; })} />
        </div>
      </div>
    </details>
  );
}

function GuidedEditor({ source, mutateSource }: {
  source: GodscarPocketSource;
  mutateSource: (mutate: (source: GodscarPocketSource) => void) => void;
}): JSX.Element {
  return (
    <div className="godscar-guided" data-testid="godscar-guided-editor">
      <details className="godscar-card" open><summary><span>01</span><strong>{t("godscar.identity")}</strong><small>{source.identity.id}</small></summary><div className="godscar-card__body"><div className="godscar-grid">
        <TextField label={t("godscar.fieldId")} value={source.identity.id} onChange={(value) => mutateSource((draft) => { draft.identity.id = value; })} />
        <TextField label={t("godscar.fieldTitle")} value={source.identity.title} onChange={(value) => mutateSource((draft) => { draft.identity.title = value; })} />
        <TextField wide multiline label={t("godscar.fieldDescription")} value={source.identity.description} onChange={(value) => mutateSource((draft) => { draft.identity.description = value; })} />
        <TextField label={t("godscar.fieldAuthor")} value={source.identity.author} onChange={(value) => mutateSource((draft) => { draft.identity.author = value; })} />
        <TextField label={t("godscar.fieldVersion")} value={source.identity.version} onChange={(value) => mutateSource((draft) => { draft.identity.version = value; })} />
        <NumberField label={t("godscar.fieldEstimatedCycles")} value={source.identity.estimatedCycles} min={1} max={1000} onChange={(value) => mutateSource((draft) => { draft.identity.estimatedCycles = value; })} />
        <SelectField label={t("godscar.fieldCanonRelation")} value={source.identity.canonRelation} options={CANON_RELATIONS} onChange={(value) => mutateSource((draft) => { draft.identity.canonRelation = value; })} />
        <TextField wide multiline label={t("godscar.fieldParentCanons")} value={source.identity.parentCanons.join("\n")} onChange={(value) => mutateSource((draft) => { draft.identity.parentCanons = value.split("\n").map((line) => line.trim()).filter(Boolean); })} />
        <TextField wide multiline label={t("godscar.controlQuestion")} value={source.controlQuestion} onChange={(value) => mutateSource((draft) => { draft.controlQuestion = value; })} />
      </div></div></details>

      <details className="godscar-card" open><summary><span>02</span><strong>{t("godscar.pressures")}</strong><small>6</small></summary><div className="godscar-card__body godscar-stack">
        {source.pressures.map((pressure, index) => <article className="godscar-subcard" key={`${pressure.kind}-${index}`} data-testid={`godscar-guided-pressure-${index + 1}`}><header><strong>{index + 1}. {pressure.kind}</strong></header><div className="godscar-grid">
          <TextField label={t("godscar.fieldId")} value={pressure.id} onChange={(value) => mutateSource((draft) => { draft.pressures[index]!.id = value; })} />
          <TextField label={t("godscar.fieldLabel")} value={pressure.label} onChange={(value) => mutateSource((draft) => { draft.pressures[index]!.label = value; })} />
          <TextField wide multiline label={t("godscar.fieldDescription")} value={pressure.description} onChange={(value) => mutateSource((draft) => { draft.pressures[index]!.description = value; })} />
        </div></article>)}
      </div></details>

      <details className="godscar-card"><summary><span>03</span><strong>{t("godscar.evidence")}</strong><small>{source.evidence.receipts.length}</small></summary><div className="godscar-card__body">
        <div className="godscar-grid">
          <SelectField label={t("godscar.fieldTier")} value={source.evidence.tier} options={CANON_TIERS} onChange={(value) => mutateSource((draft) => { draft.evidence.tier = value; })} />
          <TextField wide multiline label={t("godscar.fieldClaim")} value={source.evidence.claim} onChange={(value) => mutateSource((draft) => { draft.evidence.claim = value; })} />
          <TextField wide multiline label={t("godscar.fieldVenue")} value={source.evidence.venue} onChange={(value) => mutateSource((draft) => { draft.evidence.venue = value; })} />
          <TextField wide multiline label={t("godscar.fieldLegitimacyTarget")} value={source.evidence.legitimacyTarget} onChange={(value) => mutateSource((draft) => { draft.evidence.legitimacyTarget = value; })} />
          <TextField wide multiline label={t("godscar.fieldUpside")} value={source.evidence.upsideIfAccepted} onChange={(value) => mutateSource((draft) => { draft.evidence.upsideIfAccepted = value; })} />
          <TextField wide multiline label={t("godscar.fieldDownside")} value={source.evidence.downsideIfAccepted} onChange={(value) => mutateSource((draft) => { draft.evidence.downsideIfAccepted = value; })} />
          <TextField wide multiline label={t("godscar.fieldFalseCost")} value={source.evidence.failureIfFalse} onChange={(value) => mutateSource((draft) => { draft.evidence.failureIfFalse = value; })} />
        </div>
        <div className="godscar-stack"><div className="godscar-section-heading"><strong>{t("godscar.addReceipt")}</strong><button type="button" className="secondary" onClick={() => mutateSource((draft) => { draft.evidence.receipts.push(newEvidenceReceipt(draft)); })}>{t("godscar.addReceipt")}</button></div>
          {source.evidence.receipts.map((receipt, index) => <article className="godscar-subcard" key={`${receipt.id}-${index}`}><header><strong>{receipt.label || receipt.id}</strong><RemoveButton disabled={source.evidence.receipts.length <= 1} onClick={() => mutateSource((draft) => { if (draft.evidence.receipts.length > 1) draft.evidence.receipts.splice(index, 1); })} /></header><div className="godscar-grid">
            <TextField label={t("godscar.fieldId")} value={receipt.id} onChange={(value) => mutateSource((draft) => { draft.evidence.receipts[index]!.id = value; })} />
            <TextField label={t("godscar.fieldLabel")} value={receipt.label} onChange={(value) => mutateSource((draft) => { draft.evidence.receipts[index]!.label = value; })} />
            <TextField wide multiline label={t("godscar.fieldSource")} value={receipt.source} onChange={(value) => mutateSource((draft) => { draft.evidence.receipts[index]!.source = value; })} />
            <TextField wide multiline label={t("godscar.fieldIntervention")} value={receipt.intervention} onChange={(value) => mutateSource((draft) => { draft.evidence.receipts[index]!.intervention = value; })} />
            <TextField wide multiline label={t("godscar.fieldLimits")} value={receipt.limits} onChange={(value) => mutateSource((draft) => { draft.evidence.receipts[index]!.limits = value; })} />
          </div></article>)}
        </div>
      </div></details>

      <details className="godscar-card"><summary><span>04</span><strong>{t("godscar.factions")}</strong><small>{source.factionReceipts.length}</small></summary><div className="godscar-card__body godscar-stack">
        <div className="godscar-section-heading"><span /><button type="button" className="secondary" onClick={() => mutateSource((draft) => { draft.factionReceipts.push(newFactionReceipt(draft)); })}>{t("godscar.addFaction")}</button></div>
        {source.factionReceipts.map((faction, index) => <article className="godscar-subcard" key={`${faction.factionId}-${index}`}><header><strong>{faction.factionName || faction.factionId}</strong><RemoveButton disabled={source.factionReceipts.length <= 2} onClick={() => mutateSource((draft) => { if (draft.factionReceipts.length > 2) draft.factionReceipts.splice(index, 1); })} /></header><div className="godscar-grid">
          <TextField label={t("godscar.fieldId")} value={faction.factionId} onChange={(value) => mutateSource((draft) => { draft.factionReceipts[index]!.factionId = value; })} />
          <TextField label={t("godscar.fieldFactionName")} value={faction.factionName} onChange={(value) => mutateSource((draft) => { draft.factionReceipts[index]!.factionName = value; })} />
          <TextField wide multiline label={t("godscar.fieldVariable")} value={faction.variableControlled} onChange={(value) => mutateSource((draft) => { draft.factionReceipts[index]!.variableControlled = value; })} />
          <TextField wide multiline label={t("godscar.fieldPublicGood")} value={faction.publicGood} onChange={(value) => mutateSource((draft) => { draft.factionReceipts[index]!.publicGood = value; })} />
          <TextField wide multiline label={t("godscar.fieldCharacteristicFailure")} value={faction.characteristicFailure} onChange={(value) => mutateSource((draft) => { draft.factionReceipts[index]!.characteristicFailure = value; })} />
        </div></article>)}
      </div></details>

      <details className="godscar-card"><summary><span>05</span><strong>{t("godscar.cast")}</strong><small>{source.cast.length}</small></summary><div className="godscar-card__body godscar-stack">
        <div className="godscar-section-heading"><span /><button type="button" className="secondary" onClick={() => mutateSource((draft) => { draft.cast.push(newCastMember(draft)); })}>{t("godscar.addPerson")}</button></div>
        {source.cast.map((person, index) => <article className="godscar-subcard" key={`${person.id}-${index}`}><header><strong>{person.name || person.id}</strong><RemoveButton disabled={source.cast.length <= 5} onClick={() => mutateSource((draft) => { if (draft.cast.length > 5) draft.cast.splice(index, 1); })} /></header><div className="godscar-grid">
          <TextField label={t("godscar.fieldId")} value={person.id} onChange={(value) => mutateSource((draft) => { draft.cast[index]!.id = value; })} />
          <TextField label={t("godscar.fieldName")} value={person.name} onChange={(value) => mutateSource((draft) => { draft.cast[index]!.name = value; })} />
          <SelectField label={t("godscar.fieldRole")} value={person.roleId} options={ROLE_IDS} onChange={(value) => mutateSource((draft) => { draft.cast[index]!.roleId = value; })} />
          <SelectField label={t("godscar.fieldResponsibility")} value={person.responsibility} options={RESPONSIBILITIES} onChange={(value) => mutateSource((draft) => { draft.cast[index]!.responsibility = value; })} />
          <TextField label={t("godscar.fieldFaction")} value={person.factionId ?? ""} onChange={(value) => mutateSource((draft) => { if (value) draft.cast[index]!.factionId = value; else delete draft.cast[index]!.factionId; })} />
          <TextField wide multiline label={t("godscar.fieldDescription")} value={person.description} onChange={(value) => mutateSource((draft) => { draft.cast[index]!.description = value; })} />
        </div></article>)}
      </div></details>

      <details className="godscar-card"><summary><span>06</span><strong>{t("godscar.consequences")}</strong><small>{source.consequences.length}</small></summary><div className="godscar-card__body godscar-stack">
        <div className="godscar-section-heading"><span /><button type="button" className="secondary" onClick={() => mutateSource((draft) => { draft.consequences.push(newConsequence(draft)); })}>{t("godscar.addConsequence")}</button></div>
        {source.consequences.map((consequence, index) => <article className="godscar-subcard" key={`${consequence.id}-${index}`}><header><strong>{consequence.label || consequence.id}</strong><RemoveButton disabled={source.consequences.length <= 1} onClick={() => mutateSource((draft) => { if (draft.consequences.length > 1) draft.consequences.splice(index, 1); })} /></header><div className="godscar-grid">
          <TextField label={t("godscar.fieldId")} value={consequence.id} onChange={(value) => mutateSource((draft) => { draft.consequences[index]!.id = value; })} />
          <TextField label={t("godscar.fieldLabel")} value={consequence.label} onChange={(value) => mutateSource((draft) => { draft.consequences[index]!.label = value; })} />
          <SelectField label={t("godscar.fieldKind")} value={consequence.kind} options={CONSEQUENCE_KINDS} onChange={(value) => mutateSource((draft) => { draft.consequences[index]!.kind = value; })} />
          <TextField wide multiline label={t("godscar.fieldDescription")} value={consequence.description} onChange={(value) => mutateSource((draft) => { draft.consequences[index]!.description = value; })} />
          <TextField wide multiline label={t("godscar.fieldInheritedBy")} value={consequence.inheritedBy} onChange={(value) => mutateSource((draft) => { draft.consequences[index]!.inheritedBy = value; })} />
        </div></article>)}
      </div></details>

      <details className="godscar-card"><summary><span>07</span><strong>{t("godscar.beats")}</strong><small>{source.beats.length}</small></summary><div className="godscar-card__body godscar-stack">
        <div className="godscar-section-heading"><span /><button type="button" className="secondary" onClick={() => mutateSource((draft) => { draft.beats.push(newBeat(draft)); })}>{t("godscar.addBeat")}</button></div>
        {source.beats.map((beat, beatIndex) => <BeatEditor key={`${beat.id}-${beatIndex}`} source={source} beat={beat} beatIndex={beatIndex} mutateSource={mutateSource} removeBeat={() => mutateSource((draft) => { if (draft.beats.length > 3) draft.beats.splice(beatIndex, 1); })} />)}
      </div></details>

      <details className="godscar-card"><summary><span>08</span><strong>{t("godscar.storyPhysics")}</strong><small>8 / 8</small></summary><div className="godscar-card__body"><div className="godscar-invariants">{STORY_PHYSICS.map((key) => <div key={key}><span aria-hidden="true">✓</span><code>{key}</code></div>)}</div></div></details>
      <details className="godscar-card"><summary><span>09</span><strong>{t("godscar.notes")}</strong><small>JSON</small></summary><div className="godscar-card__body"><NotesEditor source={source} onCommit={(value) => mutateSource((draft) => { draft.notes = value as GodscarPocketSource["notes"]; })} /></div></details>
    </div>
  );
}

export function GodscarForgeScreen({ onBack, onOpenLibrary, onPlayArc }: Props): JSX.Element {
  useLocale();
  const [text, setText] = useState(() => loadGodscarDraft() ?? godscarSkeletonJson());
  const [mode, setMode] = useState<ForgeMode>("guided");
  const [result, setResult] = useState<GodscarCompileResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [playtest, setPlaytest] = useState<ReturnType<typeof playtestGodscarArc> | null>(null);
  const editable = useMemo(() => parseEditableGodscarSource(text), [text]);

  const replaceDraft = (next: string) => {
    setText(next);
    const write = saveGodscarDraft(next);
    setMessage(write.ok ? null : write.message);
    setResult(null);
    setPlaytest(null);
  };

  const mutateSource = (mutate: (source: GodscarPocketSource) => void) => {
    const updated = updateEditableGodscarSource(text, mutate);
    if (!updated.ok) {
      setMessage(updated.message);
      setMode("source");
      return;
    }
    replaceDraft(updated.text);
  };

  const compile = (): Extract<GodscarCompileResult, { ok: true }> | null => {
    const next = compileGodscarJson(text);
    setResult(next);
    setPlaytest(null);
    if (next.ok) playArcPresentationCue("compile", next.arc.meta.id);
    return next.ok ? next : null;
  };

  const install = () => {
    const compiled = compile();
    if (!compiled) return;
    const installed = importArcFromJson(JSON.stringify(compiled.arc));
    setMessage(installed.ok
      ? `Installed “${installed.entry.arc.meta.name}” as an imported, unsigned cartridge.`
      : installed.errors.join(" "));
  };

  const actualMode: ForgeMode = mode === "guided" && !editable.ok ? "source" : mode;

  return (
    <div className="title-screen godscar-forge-screen" role="region" aria-label={t("godscar.forgeAria")}>
      <div className="title-content godscar-forge-shell">
        <header className="godscar-forge-header">
          <div><div className="title-imprint">GODSCAR</div><div className="title-rule" /><h1 className="title-name">{t("godscar.heading")}</h1><p>{t("godscar.intro")}</p></div>
          <div className="godscar-mode-switch" role="group" aria-label={t("godscar.forgeAria")}>
            <button type="button" className={actualMode === "guided" ? "primary accent" : "secondary"} disabled={!editable.ok} aria-pressed={actualMode === "guided"} onClick={() => setMode("guided")}>{t("godscar.guidedMode")}</button>
            <button type="button" className={actualMode === "source" ? "primary accent" : "secondary"} aria-pressed={actualMode === "source"} onClick={() => setMode("source")}>{t("godscar.sourceMode")}</button>
          </div>
        </header>

        <div className="godscar-toolbar">
          <button className="secondary" onClick={() => { replaceDraft(godscarSkeletonJson()); setMode("guided"); }}>{t("godscar.newPocket")}</button>
          <button className="secondary" onClick={() => { replaceDraft(JSON.stringify(KIND_GODS_OF_ILYON_BLUEPRINT, null, 2)); setMode("guided"); }}>{t("godscar.loadIlyon")}</button>
          <label className="secondary godscar-file-button">{t("godscar.importPocket")}<input type="file" accept="application/json,.json,.pocket.json" onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) replaceDraft(await file.text());
          }} /></label>
          <button className="secondary" onClick={onOpenLibrary}>{t("library.heading")}</button>
          <button className="secondary" onClick={onBack}>{t("common.back")}</button>
        </div>

        {!editable.ok && <div className="warning godscar-guided-warning" role="alert"><strong>{t("godscar.guidedUnavailable")}</strong><span>{editable.message}</span></div>}

        {actualMode === "guided" && editable.ok ? (
          <GuidedEditor source={editable.source} mutateSource={mutateSource} />
        ) : (
          <textarea className="godscar-source-editor" data-testid="godscar-forge-editor" aria-label={t("godscar.sourceEditor")} rows={32} value={text} onChange={(event) => replaceDraft(event.target.value)} />
        )}

        <p className="godscar-source-note">{t("godscar.sourceHeld")}</p>

        <div className="godscar-build-actions">
          <button className="primary accent" onClick={compile}>{t("godscar.validateCompile")}</button>
          <button className="secondary" onClick={() => { const compiled = compile(); if (compiled) setPlaytest(playtestGodscarArc(compiled.arc)); }}>{t("godscar.seededPlaytest")}</button>
          <button className="secondary" onClick={install}>{t("godscar.install")}</button>
          <button className="secondary" onClick={() => { const compiled = compile(); if (compiled) download(`${compiled.source.identity.id}.pocket.json`, JSON.stringify(compiled.source, null, 2)); }}>{t("godscar.exportSource")}</button>
          <button className="secondary" onClick={() => { const compiled = compile(); if (compiled) download(`${compiled.arc.meta.id}.arc.json`, JSON.stringify(compiled.arc, null, 2)); }}>{t("godscar.exportArc")}</button>
          <button className="secondary" onClick={() => { const compiled = compile(); if (compiled) onPlayArc(compiled.arc); }}>{t("godscar.openArc")}</button>
        </div>

        {message && <div role="status" className="warning godscar-message">{message}</div>}
        {result && !result.ok && <div role="alert" className="warning godscar-result"><strong>{t("godscar.compilationRefused")}</strong><ul>{result.errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
        {result?.ok && <section data-testid="godscar-forge-summary" className="godscar-result godscar-result--valid"><div className="godscar-valid-line">{t("godscar.valid")} · {result.digest}</div><h2>{result.summary.title}</h2><p><strong>{result.summary.canonTier}</strong> · {result.summary.canonRelation}</p><blockquote>{result.summary.controlQuestion}</blockquote><div className="godscar-pressure-summary">{result.summary.pressures.map((pressure, index) => <div key={pressure.kind} data-testid={`godscar-pressure-${index + 1}`}><small>{index + 1} · {pressure.kind}</small><strong>{pressure.label}</strong></div>)}</div><p>{result.summary.castCount} cast responsibilities · {result.summary.factionCount} faction receipts · {result.summary.consequenceCount} persistent consequences · {result.summary.beatCount} playable beats</p><AuthoringAuditPanel arc={result.arc} compact /></section>}
        {playtest && <section data-testid="godscar-playtest" className="godscar-result"><strong>{t("godscar.boundedPlaytest")}</strong><p>{t("godscar.playtestMetrics", { seeds: playtest.seeds, clearRate: `${(playtest.clearRate * 100).toFixed(0)}%`, stallRate: `${(playtest.stallRate * 100).toFixed(0)}%`, violations: playtest.totalGateViolations })}</p><p>{t("godscar.reachabilityNote")}</p></section>}
      </div>
    </div>
  );
}
