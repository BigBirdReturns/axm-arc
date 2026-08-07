import { useEffect, useMemo, useState } from "react";
import type { Arc } from "../../engine/types.js";
import { compileActionEncounter } from "../../engine/action/compile.js";
import { readActionProfile } from "../../engine/action/profile.js";
import type { ActionArenaKit, ActionEnemyKit, ActionPlayerKit } from "../../engine/action/types.js";
import {
  materializeActionProfile,
  removeActionEncounterAuthoring,
  summarizeActionAuthoring,
  updateActionEncounterAuthoring,
} from "../lib/action-authoring.js";
import { t } from "../../i18n/index.js";

interface Props {
  arc: Arc;
  onChange: (arc: Arc) => void;
}

export function ActionAuthoringPanel({ arc, onChange }: Props): JSX.Element {
  const summary = useMemo(() => summarizeActionAuthoring(arc), [arc]);
  const [challengeId, setChallengeId] = useState(arc.challenges[0]?.id ?? "");
  useEffect(() => {
    if (!arc.challenges.some((challenge) => challenge.id === challengeId)) {
      setChallengeId(arc.challenges[0]?.id ?? "");
    }
  }, [arc, challengeId]);
  const challenge = arc.challenges.find((candidate) => candidate.id === challengeId) ?? arc.challenges[0];
  if (!challenge) return <div className="d-panel">{t("workshop.actionNoChallenges")}</div>;

  const profile = readActionProfile(arc);
  const explicit = profile?.encounters[challenge.id];
  const spec = compileActionEncounter(arc, challenge);
  const selected = summary.challenges.find((candidate) => candidate.challengeId === challenge.id)!;
  const durationSeconds = explicit?.durationSeconds ?? Math.round(spec.maxTicks / spec.tickRate);
  const arenaScale = explicit?.arenaScale ?? 1;
  const enemyScale = explicit?.enemyScale ?? 1;

  const patch = (value: Parameters<typeof updateActionEncounterAuthoring>[2]): void => {
    onChange(updateActionEncounterAuthoring(arc, challenge.id, value));
  };

  const moveObjective = (objectiveId: string, direction: -1 | 1): void => {
    const order = spec.objectives.map((objective) => objective.id);
    const from = order.indexOf(objectiveId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to]!, order[from]!];
    patch({ objectiveOrder: order });
  };

  const setObjectiveKit = (objectiveId: string, enemyKit: ActionEnemyKit): void => {
    const objectiveKits = Object.fromEntries(spec.objectives.map((objective) => [objective.id, objective.enemyKit]));
    patch({ objectiveKits: { ...objectiveKits, [objectiveId]: enemyKit } });
  };

  return (
    <section className="d-panel workshop-action-authoring" data-testid="workshop-action-authoring">
      <div className="row between" style={{ gap: 12, alignItems: "flex-start" }}>
        <div>
          <div className="d-section-label">{t("workshop.actionHeading")}</div>
          <p className="d-muted" style={{ margin: "4px 0 8px" }}>{t("workshop.actionIntro")}</p>
        </div>
        <span className="badge rn-num">
          {t("workshop.actionExplicitCount", { explicit: summary.explicitEncounterCount, total: summary.challengeCount })}
        </span>
      </div>

      <div className="d-field">
        <label className="d-field-label" htmlFor="action-challenge">{t("workshop.actionChallenge")}</label>
        <select id="action-challenge" value={challenge.id} onChange={(event) => setChallengeId(event.target.value)}>
          {arc.challenges.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
        </select>
      </div>

      <div className="row" style={{ flexWrap: "wrap", gap: 12, marginTop: 10 }}>
        <label className="d-field" style={{ minWidth: 150 }}>
          <span className="d-field-label">{t("workshop.actionArena")}</span>
          <select value={spec.arena.kit} onChange={(event) => patch({ arenaKit: event.target.value as ActionArenaKit })}>
            <option value="ring">ring</option>
            <option value="lane">lane</option>
            <option value="islands">islands</option>
          </select>
        </label>
        <label className="d-field" style={{ minWidth: 150 }}>
          <span className="d-field-label">{t("workshop.actionMoveset")}</span>
          <select value={spec.player.kit} onChange={(event) => patch({ playerKit: event.target.value as ActionPlayerKit })}>
            <option value="staff">staff</option>
            <option value="blade">blade</option>
            <option value="hammer">hammer</option>
          </select>
        </label>
        <label className="d-field" style={{ minWidth: 150 }}>
          <span className="d-field-label">{t("workshop.actionDuration")}</span>
          <input
            type="number"
            min={20}
            max={600}
            value={durationSeconds}
            onChange={(event) => patch({ durationSeconds: Math.max(20, Math.min(600, Math.round(Number(event.target.value)))) })}
          />
        </label>
        <label className="d-field" style={{ minWidth: 180 }}>
          <span className="d-field-label">{t("workshop.actionArenaScale")} · {arenaScale.toFixed(1)}×</span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={arenaScale}
            onChange={(event) => patch({ arenaScale: Number(event.target.value) })}
          />
        </label>
        <label className="d-field" style={{ minWidth: 180 }}>
          <span className="d-field-label">{t("workshop.actionEnemyScale")} · {enemyScale.toFixed(1)}×</span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={enemyScale}
            onChange={(event) => patch({ enemyScale: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="agent-meta" style={{ marginTop: 10 }} title={selected.specDigest}>
        {explicit ? t("workshop.actionExplicit") : t("workshop.actionImplicit")}
        {" · "}{t("workshop.actionObjectives", { count: selected.objectiveCount })}
        {" · "}{t("workshop.actionMaxWave", { count: selected.maxWaveEnemies })}
        {" · "}{selected.objectiveKits.join(" · ")}
        {" · "}<span className="rn-num">{selected.specDigest.slice(0, 16)}…</span>
      </div>

      <div style={{ marginTop: 10 }}>
        {spec.objectives.map((objective, index) => (
          <div className="d-budget" key={objective.id} style={{ gap: 10, alignItems: "center" }}>
            <span style={{ flex: "1 1 220px" }}><b>{objective.label}</b> · {objective.failureKind}</span>
            <label className="row" style={{ gap: 6, alignItems: "center" }}>
              <span className="agent-meta">{t("workshop.actionEnemyKit")}</span>
              <select
                aria-label={`${t("workshop.actionEnemyKit")}: ${objective.label}`}
                value={objective.enemyKit}
                onChange={(event) => setObjectiveKit(objective.id, event.target.value as ActionEnemyKit)}
              >
                <option value="skirmisher">skirmisher</option>
                <option value="duelist">duelist</option>
                <option value="swarm">swarm</option>
                <option value="hexer">hexer</option>
                <option value="breaker">breaker</option>
              </select>
            </label>
            <span className="rn-num">{objective.enemyCount} ×</span>
            <span className="row" style={{ gap: 4 }}>
              <button
                className="secondary"
                type="button"
                disabled={index === 0}
                aria-label={`${t("workshop.actionMoveUp")}: ${objective.label}`}
                onClick={() => moveObjective(objective.id, -1)}
              >↑</button>
              <button
                className="secondary"
                type="button"
                disabled={index === spec.objectives.length - 1}
                aria-label={`${t("workshop.actionMoveDown")}: ${objective.label}`}
                onClick={() => moveObjective(objective.id, 1)}
              >↓</button>
            </span>
          </div>
        ))}
      </div>

      <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <button className="secondary" onClick={() => onChange(materializeActionProfile(arc))}>
          {t("workshop.actionMaterialize")}
        </button>
        <button className="secondary" disabled={!explicit} onClick={() => onChange(removeActionEncounterAuthoring(arc, challenge.id))}>
          {t("workshop.actionGeneric")}
        </button>
        <span className="agent-meta">{t("workshop.actionLowPower")}</span>
      </div>
    </section>
  );
}
