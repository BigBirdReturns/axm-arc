// Raid Night — the first playable loop around the wipe-diagnosis slice.
// View the guild → field the party → pull the boss → on a wipe, read the
// diagnosis (failed check, bottleneck, score vs threshold, modifiers, three
// fixes) inline, apply exactly one fix, pull again. Readable before pretty:
// the whole diagnosis is on the page, no debug panel. Shell chrome routes
// through t(); the cartridge's own vocabulary (boss, check, role, agent names)
// and the diagnosis prose flow verbatim, per the grammar rule.

import { useState } from "react";
import { t, useLocale } from "../../i18n/index.js";
import {
  RAID_ARC, raidBoss, newRaidNight, pull, applyFix, toggleFielded, partyLegal,
  type RaidNightState,
} from "../lib/raid-night.js";
import type { Agent } from "../../engine/types.js";
import type { Fix } from "../../sim/wipe-diagnosis.js";

interface Props { onBack: () => void; }

const CHECK_ATTRS = ["mitigation", "restoration", "output", "control"];

export function RaidNightScreen({ onBack }: Props): JSX.Element {
  useLocale();
  const [state, setState] = useState<RaidNightState>(() => newRaidNight(1));
  const boss = raidBoss();
  const roleName = (id: string | null) => RAID_ARC.roles.find((r) => r.id === id)?.name ?? id ?? "—";
  const legal = partyLegal(state);

  const party = state.partyIds.map((id) => state.org.agents[id]).filter(Boolean) as Agent[];
  const bench = Object.values(state.org.agents)
    .filter((a) => !state.partyIds.includes(a.id))
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  const agentCard = (a: Agent, fielded: boolean) => (
    <button
      key={a.id}
      className={`raid-agent ${fielded ? "fielded" : "benched"}`}
      onClick={() => setState((s) => toggleFielded(s, a.id))}
      title={fielded ? t("raidnight.benchVerb") : t("raidnight.field")}
    >
      <span className="raid-agent-name">{a.name}</span>
      <span className="raid-agent-role">{roleName(a.role)}</span>
      <span className="raid-agent-attrs">
        {CHECK_ATTRS.map((k) => (
          <span key={k} className="raid-attr">{k.slice(0, 3)} {a.attributes[k] ?? 0}</span>
        ))}
      </span>
      <span className="raid-agent-cond">
        {t("raidnight.morale")} {a.morale} · {t("raidnight.stress")} {a.stress}
      </span>
    </button>
  );

  return (
    <div className="title-screen raid-night">
      <div className="title-content">
        <div className="raid-header">
          <div>
            <div className="raid-kicker">{t("raidnight.title")}</div>
            <h1 className="raid-boss">{boss.name}</h1>
            <div className="raid-sub">{t("raidnight.subtitle")}</div>
          </div>
          <div className="raid-attempt">{t("raidnight.attempt", { n: state.pull })}</div>
        </div>

        {/* ── roster: field / bench ── */}
        <div className="raid-roster">
          <section>
            <h2>{t("raidnight.raidParty")} · {party.length}</h2>
            <div className="raid-grid">{party.map((a) => agentCard(a, true))}</div>
          </section>
          <section>
            <h2>{t("raidnight.bench")} · {bench.length}</h2>
            <div className="raid-grid">{bench.map((a) => agentCard(a, false))}</div>
          </section>
        </div>

        {/* ── pull ── */}
        <div className="raid-actions">
          {!legal && <span className="raid-illegal">{t("raidnight.partyIllegal", {
            min: boss.rosterRequirements.minAgents, max: boss.rosterRequirements.maxAgents,
          })}</span>}
          <button className="primary raid-pull" disabled={!legal} onClick={() => setState((s) => pull(s))}>
            {state.pull === 0 ? t("raidnight.pull") : t("raidnight.pullAgain")}
          </button>
        </div>

        {/* ── did the last fix matter? (grounded delta from the previous pull) ── */}
        {state.pullDelta && (
          <div className="raid-delta"><span className="raid-delta-tag">{t("raidnight.lastPull")}</span> {state.pullDelta}</div>
        )}

        {/* ── result ── */}
        {state.cleared && (
          <div className="raid-cleared">
            <strong>{t("raidnight.cleared")}</strong> — {boss.name} · {t("raidnight.clearedIn", { n: state.pull })}
          </div>
        )}

        {state.diagnosis && !state.cleared && (
          <div className="raid-diagnosis">
            <div className="raid-wipe-head">{t("raidnight.wipe")} — {boss.name}</div>

            {/* Q3 — what KIND of problem, in one line, from the deciding factors */}
            <div className={`raid-cause cause-${state.diagnosis.primaryCause.kind}`}>
              <span className="raid-cause-tag">{state.diagnosis.primaryCause.kind}</span>
              {state.diagnosis.primaryCause.note}
            </div>

            <h3>{t("raidnight.whyWiped")}</h3>
            {state.diagnosis.failedChecks.map((fc) => (
              <div key={fc.mechanicId} className="raid-check">
                <div className="raid-check-head">
                  <strong>{fc.mechanicName}</strong>{" "}
                  <span className="raid-scope">[{fc.scope === "team_aggregate" ? "team" : fc.scope === "role_specific" ? "role" : "each"}]</span>{" "}
                  {fc.teamScore !== undefined
                    ? <>— {t("raidnight.putUp")} {fc.teamScore}, {t("raidnight.needed")} {fc.threshold}</>
                    : <>— {t("raidnight.needed")} {fc.threshold}</>}
                </div>
                {fc.culprits.map((c) => (
                  <div key={c.agentId} className="raid-culprit">
                    <span>{c.name} ({roleName(c.role)}): <strong>{c.score}</strong> vs {c.threshold} · {t("raidnight.morale")} {c.morale}, {t("raidnight.stress")} {c.stress}</span>
                    {c.factors.map((f, i) => <div key={i} className="raid-factor">└ {f.note}</div>)}
                  </div>
                ))}
              </div>
            ))}

            <h3>{t("raidnight.bottleneck")}</h3>
            <ul className="raid-bottleneck">
              {state.diagnosis.bottlenecks.map((b, i) => (
                <li key={i}>▸ <strong>{b.label}</strong> ({b.kind}) — {b.reason}</li>
              ))}
            </ul>

            <h3>{t("raidnight.threeThings")}</h3>
            <div className="raid-fixes">
              {state.diagnosis.fixes.map((fix, i) => (
                <FixButton
                  key={i}
                  fix={fix}
                  disabled={state.fixApplied !== null}
                  chosen={state.fixApplied === fix.lever}
                  onApply={() => setState((s) => applyFix(s, fix))}
                />
              ))}
            </div>
            {state.fixApplied && (
              <div className="raid-receipt">
                <span className="raid-receipt-tag">{t("raidnight.changed")}</span>
                {state.receipt}
                <div className="raid-applied">{t("raidnight.applied")}</div>
              </div>
            )}
          </div>
        )}

        <div className="raid-footer">
          <button className="secondary" onClick={() => setState(newRaidNight(1))}>{t("raidnight.reset")}</button>
          <button className="secondary" onClick={onBack}>{t("raidnight.back")}</button>
        </div>
      </div>
    </div>
  );
}

const LEVER_GLYPH: Record<string, string> = {
  gear: "⚙", train: "▲", rest: "✚", rally: "✦", bench_swap: "⇄", tradeoff: "⚖",
};

function FixButton({ fix, disabled, chosen, onApply }: {
  fix: Fix; disabled: boolean; chosen: boolean; onApply: () => void;
}): JSX.Element {
  return (
    <div className={`raid-fix ${chosen ? "chosen" : ""}`} data-lever={fix.lever}>
      <div className="raid-fix-body">
        <div className="raid-fix-head">
          <span className="raid-fix-glyph">{LEVER_GLYPH[fix.lever] ?? "•"}</span>
          <span className="raid-fix-lever">{fix.lever}</span>
        </div>
        <div className="raid-fix-desc">{fix.description}</div>
        <div className="raid-fix-proj">→ {fix.projectedEffect}</div>
        <div className="raid-fix-cost">{t("raidnight.tradeoffLabel")}: {fix.cost}</div>
      </div>
      <button className="primary" disabled={disabled} onClick={onApply}>{t("raidnight.apply")}</button>
    </div>
  );
}
