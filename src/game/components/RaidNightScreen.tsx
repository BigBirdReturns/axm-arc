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
  RAID_ARC, RAID_ARC_T2, newRaidNight, newRaidNightFrom, pull, applyFix, toggleFielded, partyLegal,
  nightConsequences, commitNightVictory, commitNightFailed,
  type RaidNightState,
} from "../lib/raid-night.js";
import { validateArc } from "../../engine/schema.js";
import severedMarch from "../../../cartridges/severed-march.arc.json";
import type { Agent, Arc } from "../../engine/types.js";
import type { Fix } from "../../sim/wipe-diagnosis.js";

interface Props { onBack: () => void; }

const CHECK_ATTRS = ["mitigation", "restoration", "output", "control"];
// A deliberately different-profile cartridge, to prove the refusal surface.
const INCOMPATIBLE: Arc = validateArc(severedMarch);

function bossOf(arc: Arc) {
  return arc.challenges.find((c) => c.id === "the-hollow-choir") ?? arc.challenges[arc.challenges.length - 1]!;
}

export function RaidNightScreen({ onBack }: Props): JSX.Element {
  useLocale();
  const [state, setState] = useState<RaidNightState>(() => newRaidNight(1));
  const [committed, setCommitted] = useState<import("../lib/ledger.js").CampaignLedger | null>(null);
  const boss = bossOf(state.arc);
  const roleName = (id: string | null) => state.arc.roles.find((r) => r.id === id)?.name ?? id ?? "—";
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
            <div className="raid-sub">
              {state.ledger
                ? t("raidnight.guildCarried", { n: state.ledger.roster.length })
                : t("raidnight.freshGuild")}
            </div>
          </div>
          <div className="raid-attempt">{t("raidnight.attempt", { n: state.pull })}</div>
        </div>

        {/* ── incompatible ledger: refuse projection, show why, offer a clean out ── */}
        {state.blocked && (
          <div className="raid-blocked">
            <div className="raid-wipe-head">{t("raidnight.incompatible")}</div>
            <p>{state.blocked.message}</p>
            <ul className="raid-bottleneck">
              {state.blocked.dimensions.filter((d) => !d.match).map((d) => (
                <li key={d.dimension}>▸ <strong>{d.dimension}</strong>: {d.ledgerValue.join(", ")} ≠ {d.cartridgeValue.join(", ")}</li>
              ))}
            </ul>
            <button className="primary" onClick={() => setState(newRaidNightFrom(state.arc, null, 1))}>
              {t("raidnight.startFresh")}
            </button>
          </div>
        )}

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
          <button className="primary raid-pull" disabled={!legal || !!state.blocked} onClick={() => setState((s) => pull(s))}>
            {state.pull === 0 ? t("raidnight.pull") : t("raidnight.pullAgain")}
          </button>
          {state.diagnosis && !state.cleared && (
            <button className="secondary" onClick={() => { commitNightFailed(state); setCommitted(state.ledger); }}>
              {t("raidnight.callItNight")}
            </button>
          )}
        </div>

        {/* ── did the last fix matter? (grounded delta from the previous pull) ── */}
        {state.pullDelta && (
          <div className="raid-delta"><span className="raid-delta-tag">{t("raidnight.lastPull")}</span> {state.pullDelta}</div>
        )}

        {/* ── result: clear → consequence screen → commit → next tier ── */}
        {state.cleared && (() => {
          const cons = nightConsequences(state);
          return (
            <div className="raid-cleared">
              <div className="raid-wipe-head raid-victory">{t("raidnight.cleared")} — {boss.name} · {t("raidnight.clearedIn", { n: state.pull })}</div>
              <h3>{t("raidnight.consequences")}</h3>
              <ul className="raid-bottleneck">
                {cons.scarsEarned.map((s) => <li key={s.scarId}>✦ {s.name} — {s.effect.note}</li>)}
                {cons.legends.map((l, i) => <li key={i}>★ {state.org.agents[l.agentId]?.name}: {l.citation}</li>)}
                <li>{cons.loot.length} loot · {cons.moraleShifts.length} morale states · {cons.precedentsSet.length} precedents</li>
              </ul>
              {!committed ? (
                <button className="primary" onClick={() => setCommitted(commitNightVictory(state))}>
                  {t("raidnight.commit")}
                </button>
              ) : (
                <div className="raid-receipt">
                  <span className="raid-receipt-tag">{t("raidnight.committed")}</span>
                  {t("raidnight.consequencesRemain")}
                  <div className="raid-next">
                    <button className="primary" onClick={() => { setState(newRaidNightFrom(RAID_ARC_T2, committed, 1)); setCommitted(null); }}>
                      {t("raidnight.startNextTier", { boss: bossOf(RAID_ARC_T2).name })}
                    </button>
                    <button className="secondary" onClick={() => { setState(newRaidNightFrom(INCOMPATIBLE, committed, 1)); setCommitted(null); }}>
                      {t("raidnight.tryIncompatible")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

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
