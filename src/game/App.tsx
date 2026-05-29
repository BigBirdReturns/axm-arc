import { useEffect, useMemo, useState } from "react";
import type { Agent, DramaCard, Facility, InfrastructureFacility, Organization, RunReport } from "../engine/types.js";
import { runCycle, type ChallengeAssignment, type PendingRewardChoice, type RewardDecision } from "../engine/cycle.js";
import {
  FIRST_CHARTER,
  FIRST_CHARTER_STARTING_ROSTER,
  FIRST_CHARTER_STARTING_RELATIONSHIPS,
  FIRST_CHARTER_STARTING_SKIRMISHERS,
} from "../arcs/index.js";
import { loadSave, saveSave, clearSave } from "./lib/storage.js";
import { getAdvanceBlockers, isAdvanceBlocked } from "./lib/advance-blockers.js";
import { RosterScreen } from "./components/RosterScreen.js";
import { AssignScreen } from "./components/AssignScreen.js";
import { DramaScreen } from "./components/DramaScreen.js";
import { BaseScreen } from "./components/BaseScreen.js";
import { ReportsScreen } from "./components/ReportsScreen.js";
import { SituationSidebar } from "./components/SituationSidebar.js";
import { CycleTransition } from "./components/CycleTransition.js";
import { TutorialGuide, useTutorial, deriveTutorialStep, tutorialPulseTab, tutorialPulseAdvance } from "./components/TutorialGuide.js";
import { TitleScreen } from "./components/TitleScreen.js";
import { CycleChecklist } from "./components/CycleChecklist.js";
import { agentInitials } from "./lib/ui-helpers.js";

declare const __BUILD_SHA__: string;
const BUILD_SHA = typeof __BUILD_SHA__ === "string" ? __BUILD_SHA__ : "dev";

type Tab = "Roster" | "Assign" | "Drama" | "Base" | "Reports";

const arc = FIRST_CHARTER;
const INTENT_KEY = "axm-arc:intent:v1";

function defaultFacilities(): Record<InfrastructureFacility, Facility> {
  const names: InfrastructureFacility[] = [
    "Quarters", "Production", "Recreation", "Research", "Training", "Storage", "Medical",
  ];
  const out: Partial<Record<InfrastructureFacility, Facility>> = {};
  for (const n of names) {
    out[n] = { type: n, level: n === "Quarters" || n === "Recreation" ? 1 : 0, assignedAgents: [] };
  }
  return out as Record<InfrastructureFacility, Facility>;
}

function buildNewOrg(): Organization {
  const agents: Record<string, Agent> = {};
  for (const a of FIRST_CHARTER_STARTING_ROSTER) agents[a.id] = a;

  const { veteran: vet, recruit: rec } = FIRST_CHARTER_STARTING_SKIRMISHERS;
  const vetFirst = vet.name.split(" ")[0]!;
  const recFirst = rec.name.split(" ")[0]!;

  const openingCard: DramaCard = {
    id: "opening-rivalry",
    cycleGenerated: 0,
    triggerType: "rivalrous_perf_gap",
    agentsInvolved: [vet.id, rec.id],
    narrativeText: `${vet.name} has history. ${rec.name} arrived with ambition. Both skirmishers, both watching to see who gets slotted first. You haven't run a contract yet.`,
    options: [
      {
        id: "acknowledge_winner",
        label: `Acknowledge ${vetFirst}'s edge`,
        description: `Pull ${vetFirst} aside. Their record speaks for itself. Draw the line before the first contract runs.`,
        effects: [
          { target: vet.id, type: "morale", value: 4 },
          { target: rec.id, type: "morale", value: -2 },
        ],
        hiddenEffects: [
          { target: vet.id, type: "loyalty", value: 2 },
        ],
      },
      {
        id: "let_it_play",
        label: "Run them both. See what the field produces.",
        description: `Assign both to the same contract. Either they figure it out or the friction tells you what you need to know.`,
        effects: [
          { target: vet.id, type: "stress", value: 1 },
          { target: rec.id, type: "stress", value: 1 },
        ],
        hiddenEffects: [],
      },
    ],
  };

  return {
    id: "player-charter",
    name: "Your Charter",
    reputation: 0,
    resources: { currency: 100, materials: 0, tokens: 2 },
    infrastructure: defaultFacilities(),
    agents,
    relationships: [...FIRST_CHARTER_STARTING_RELATIONSHIPS],
    precedents: [],
    dramaQueue: [openingCard],
    cycle: 0,
    distributionPolicy: "council",
    rngSeed: Math.floor(Math.random() * 2 ** 31),
  };
}

export function App(): JSX.Element {
  const [mode, setMode] = useState<"title" | "play">("title");
  const tutorial = useTutorial();
  const [tab, setTab] = useState<Tab>("Roster");
  const [org, setOrg] = useState<Organization>(() => {
    const loaded = loadSave(arc);
    return loaded ? loaded.org : buildNewOrg();
  });
  const [assignments, setAssignments] = useState<ChallengeAssignment[]>([]);
  const [lastReports, setLastReports] = useState<RunReport[]>([]);
  const [pendingRewardChoices, setPendingRewardChoices] = useState<PendingRewardChoice[]>([]);
  const [rewardDecisions, setRewardDecisions] = useState<RewardDecision[]>([]);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [cycleTransition, setCycleTransition] = useState<{ fromCycle: number; toCycle: number } | null>(null);

  // Intent — player-authored pull-quote, persisted separately from game state
  const [intent, setIntent] = useState<string>(() => {
    try { return localStorage.getItem(INTENT_KEY) ?? ""; } catch { return ""; }
  });
  const [editingIntent, setEditingIntent] = useState(false);
  const [intentDraft, setIntentDraft] = useState("");

  useEffect(() => {
    saveSave(org, arc);
  }, [org]);

  useEffect(() => {
    try { localStorage.setItem(INTENT_KEY, intent); } catch { /* noop */ }
  }, [intent]);

  // ── Tutorial: step derived from game state ──────────────────────────────
  const tutorialStep = deriveTutorialStep(
    tutorial.active,
    org.dramaQueue.length,
    assignments.length,
    org.cycle,
    lastReports.length,
  );
  const pulseTab = tutorialPulseTab(tutorialStep);
  const pulseAdvance = tutorialPulseAdvance(tutorialStep);

  const advanceBlockers = useMemo(() => getAdvanceBlockers({
    dramaQueueCount: org.dramaQueue.length,
    pendingRewardChoicesCount: pendingRewardChoices.length,
    rewardDecisionsCount: rewardDecisions.length,
  }), [org.dramaQueue.length, pendingRewardChoices.length, rewardDecisions.length]);

  const blocked = isAdvanceBlocked(advanceBlockers);
  const cycleContext = useMemo(() => {
    const dramaCount = org.dramaQueue.length;
    const unresolvedRewards = pendingRewardChoices.length - rewardDecisions.length;
    const totalDeployed = assignments.reduce((s, a) => s + a.agentIds.length, 0);
    if (dramaCount > 0)
      return { text: `${dramaCount} decision${dramaCount !== 1 ? "s" : ""} pending`, color: "var(--accent)" };
    if (unresolvedRewards > 0)
      return { text: `${unresolvedRewards} reward${unresolvedRewards !== 1 ? "s" : ""} to assign`, color: "var(--accent)" };
    if (assignments.length > 0)
      return { text: `${assignments.length} contract${assignments.length !== 1 ? "s" : ""} queued · ${totalDeployed} deployed`, color: "var(--muted)" };
    return { text: "Ready to advance", color: "var(--positive)" };
  }, [org.dramaQueue.length, pendingRewardChoices.length, rewardDecisions.length, assignments]);

  const hasAdvancePayload = assignments.length > 0 || lastReports.length > 0;
  const canAdvanceCycle = hasAdvancePayload && !blocked;

  const advanceCycle = () => {
    setAdvanceError(null);
    if (blocked) { setAdvanceError(advanceBlockers.map((b) => b.message).join(" ")); return; }
    const fromCycle = org.cycle;
    const result = runCycle({ org, arc, assignments, pendingRewardDecisions: rewardDecisions });
    setOrg(result.org);
    setLastReports(result.reports);
    setPendingRewardChoices(result.pendingRewardChoices);
    setRewardDecisions([]);
    setAssignments([]);
    setCycleTransition({ fromCycle, toCycle: result.org.cycle });
  };

  const resetGame = () => {
    if (!confirm("Reset the game? All progress will be lost.")) return;
    clearSave();
    try { localStorage.removeItem(INTENT_KEY); } catch { /* noop */ }
    setOrg(buildNewOrg());
    setLastReports([]);
    setPendingRewardChoices([]);
    setRewardDecisions([]);
    setAssignments([]);
    setIntent("");
    setTab("Drama");
    tutorial.start();
  };

  const agentCount = Object.keys(org.agents).length;
  const cleared = new Set<string>();
  for (const a of Object.values(org.agents)) {
    for (const r of a.assignmentHistory) {
      if (r.outcome === "success") cleared.add(r.challengeId);
    }
  }

  const tabCounts: Record<Tab, number | string> = {
    Roster: agentCount,
    Assign: assignments.length,
    Drama: org.dramaQueue.length,
    Base: Object.values(org.infrastructure).filter((f) => f.level > 0).length,
    Reports: lastReports.length > 0 ? lastReports.length : "—",
  };

  const upkeep = Object.values(org.agents).reduce((s, a) => s + a.upkeep, 0);
  const agentList = Object.values(org.agents);

  // Next reputation gate, read from arc progression tiers (not hardcoded).
  const nextRepGate = arc.progressionTiers
    .map((pt) => pt.unlockConditions.reputationMinimum)
    .filter((m): m is number => m !== null && m > org.reputation)
    .sort((a, b) => a - b)[0];

  // ── Intent block (shared across mobile + desktop) ────────────────────────
  const intentBlock = (
    <div className="intent-block">
      <div className="intent-label">
        <span>Intent · This Cycle</span>
        <button
          onClick={() => {
            if (editingIntent) {
              setIntent(intentDraft);
              setEditingIntent(false);
            } else {
              setIntentDraft(intent);
              setEditingIntent(true);
            }
          }}
        >
          {editingIntent ? "Save" : "Edit"}
        </button>
      </div>
      {editingIntent ? (
        <textarea
          autoFocus
          rows={2}
          value={intentDraft}
          placeholder="e.g. Run Attumen on farm. Push Moroes for first clear."
          onChange={(e) => setIntentDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              setIntent(intentDraft);
              setEditingIntent(false);
            }
          }}
        />
      ) : (
        <div className="intent-text">
          {intent || <span style={{ color: "var(--dim)", fontWeight: 400, fontSize: 14 }}>No intent set. Tap Edit to add one.</span>}
        </div>
      )}
    </div>
  );

  // ── Stat strip ────────────────────────────────────────────────────────────
  const statStrip = (
    <div className="stat-strip">
      <div className="stat-cell">
        <div className="stat-lbl">{arc.tokenName}</div>
        <div className="stat-val">{org.resources.tokens}</div>
        <div className="stat-sub">+{arc.tokensPerCycle} next cycle</div>
      </div>
      <div className="stat-cell">
        <div className="stat-lbl">{arc.currencyName}</div>
        <div className="stat-val">{org.resources.currency.toLocaleString()}</div>
        <div className="stat-sub">-{upkeep} upkeep</div>
      </div>
      <div className="stat-cell">
        <div className="stat-lbl">{arc.reputationName}</div>
        <div className="stat-val">{org.reputation}</div>
        <div className="stat-sub">{nextRepGate !== undefined ? `of ${nextRepGate} to next tier` : "top tier"}</div>
      </div>
      <div className="stat-cell">
        <div className="stat-lbl">Drama</div>
        <div className={`stat-val${org.dramaQueue.length > 0 ? " accent" : ""}`}>{org.dramaQueue.length}</div>
        <div className="stat-sub">queued</div>
      </div>
    </div>
  );

  const advanceButton = (
    <div className="advance-footer">
      <CycleChecklist
        dramaCount={org.dramaQueue.length}
        rewardsResolved={rewardDecisions.length}
        rewardsTotal={pendingRewardChoices.length}
        assignmentCount={assignments.length}
      />
      {advanceError && (
        <div className="warning">{advanceError}</div>
      )}
      <button
        className={`primary${!blocked ? " accent" : ""}${pulseAdvance && canAdvanceCycle ? " tutorial-pulse-btn" : ""}`}
        disabled={!canAdvanceCycle}
        onClick={advanceCycle}
      >
        {blocked ? "Advance blocked" : "Advance Cycle →"}
      </button>
    </div>
  );

  const activeScreen = (
    <>
      {tab === "Roster" && <RosterScreen agents={agentList} arc={arc} />}
      {tab === "Assign" && (
        <>
          <AssignScreen arc={arc} org={org} assignments={assignments} setAssignments={setAssignments} />
        </>
      )}
      {tab === "Drama" && (
        <DramaScreen
          org={org}
          arc={arc}
          setOrg={setOrg}
          cycle={org.cycle}
          pendingRewardChoices={pendingRewardChoices}
        />
      )}
      {tab === "Base" && <BaseScreen arc={arc} org={org} setOrg={setOrg} />}
      {tab === "Reports" && (
        <ReportsScreen
          arc={arc} org={org} reports={lastReports}
          pendingRewardChoices={pendingRewardChoices}
          rewardDecisions={rewardDecisions}
          setRewardDecisions={setRewardDecisions}
        />
      )}
    </>
  );

  if (mode === "title") {
    return (
      <TitleScreen
        arc={arc}
        onContinue={() => {
          const loaded = loadSave(arc);
          if (loaded) {
            setOrg(loaded.org);
            // Land returning players where action is needed: drama queue first,
            // otherwise the Assign tab so they can slot agents and advance.
            setTab(loaded.org.dramaQueue.length > 0 ? "Drama" : "Assign");
          }
          setMode("play");
        }}
        onNewGame={() => {
          clearSave();
          setOrg(buildNewOrg());
          setLastReports([]);
          setPendingRewardChoices([]);
          setRewardDecisions([]);
          setAssignments([]);
          setTab("Drama");
          tutorial.start();
          setMode("play");
        }}
      />
    );
  }

  return (
    <>
      {/* ── TUTORIAL GUIDE (nudge bar) ── */}
      {tutorialStep !== null && (
        <TutorialGuide
          step={tutorialStep}
          setTab={setTab}
          onDismiss={tutorial.dismiss}
        />
      )}

      {/* ── CYCLE TRANSITION OVERLAY ── */}
      {cycleTransition && (
        <CycleTransition
          fromCycle={cycleTransition.fromCycle}
          toCycle={cycleTransition.toCycle}
          reports={lastReports}
          arc={arc}
          org={org}
          intent={intent}
          onComplete={() => {
            setCycleTransition(null);
            setTab("Reports");
          }}
        />
      )}

      {/* ── HEADER ── */}
      <header className="app-header">
        <div className="top-row">
          <div className="kicker">Situation Room · Cycle {String(org.cycle).padStart(2, "0")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="icon"
              title="Replay tutorial"
              style={{ fontSize: 11, padding: "2px 7px", minHeight: 0, color: "var(--dim)" }}
              onClick={tutorial.start}
            >
              ?
            </button>
            <div className="wordmark">
              <em>AXM</em>
              <span className="sep">·</span>
              <span className="arc-num">ARC 01</span>
            </div>
          </div>
        </div>
        <h1>{arc.meta.name}</h1>
        <div className="subtitle">
          {arc.meta.domain} · Tier I · {cleared.size} of {arc.challenges.length} cleared · build {BUILD_SHA}
        </div>

        {/* Desktop inline stat strip */}
        <div className="desktop-header-stats" style={{ display: "none" }}>
          {[
            { lbl: arc.tokenName, val: org.resources.tokens, sub: `+${arc.tokensPerCycle} next` },
            { lbl: arc.currencyName, val: org.resources.currency.toLocaleString(), sub: `-${upkeep}` },
            { lbl: arc.reputationName, val: nextRepGate !== undefined ? `${org.reputation} / ${nextRepGate}` : `${org.reputation}`, sub: nextRepGate !== undefined ? "to next tier" : "top tier" },
            { lbl: "Drama", val: org.dramaQueue.length, sub: "queued", accent: org.dramaQueue.length > 0 },
          ].map((s) => (
            <div key={s.lbl} className="stat-cell">
              <div className="stat-lbl">{s.lbl}</div>
              <div className={`stat-val${s.accent ? " accent" : ""}`}>{s.val}</div>
              <div className="stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>
        <div className="desktop-actions" style={{ display: "none" }}>
          <button className="secondary" onClick={() => saveSave(org, arc)}>Save</button>
          <button
            className={`primary${!blocked ? " accent" : ""}`}
            disabled={!canAdvanceCycle}
            onClick={advanceCycle}
            style={{ width: "auto" }}
          >
            {blocked ? "Blocked" : "Advance Cycle →"}
          </button>
        </div>
      </header>

      {/* ── MOBILE ── */}
      <div className="mobile-only">
        {statStrip}
        <div style={{
          fontFamily: "var(--mono)", fontSize: 10, fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase" as const,
          padding: "6px 16px", borderBottom: "1px solid var(--rule)",
          background: "var(--paper-alt)", color: cycleContext.color,
        }}>
          {cycleContext.text}
        </div>
        {tab === "Assign" && intentBlock}
        {activeScreen}
        {(tab === "Assign" || tab === "Reports") && advanceButton}
      </div>

      {/* ── DESKTOP: 3-column Situation Room ── */}
      <div className="situation-room">
        <div className="situation-roster">
          <div className="row between" style={{ marginBottom: 8 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
              Roster · {String(agentCount).padStart(2, "0")}
            </span>
            <button className="icon" onClick={resetGame} style={{ fontSize: 9, padding: "3px 6px", minHeight: 0 }}>Reset</button>
          </div>
          {agentList.map((a) => {
            const role = arc.roles.find((r) => r.id === a.role);
            return (
              <div key={a.id} className="card" style={{ cursor: "default" }}>
                <div className="row" style={{ gap: 8 }}>
                  <div className={`portrait${a.stress >= 8 ? " accent" : ""}`}>{agentInitials(a.name)}</div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div className="agent-name">{a.name}</div>
                    <div className="agent-meta">{role?.name ?? "Flex"}</div>
                  </div>
                  <span className="badge role">{a.tier.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="row" style={{ marginTop: 4, gap: 8 }}>
                  <div className="bar-wrap">
                    <div className="bar morale"><div className="fill" style={{ width: `${a.morale}%` }} /></div>
                  </div>
                  <div className="bar-wrap">
                    <div className="bar stress"><div className="fill" style={{ width: `${a.stress * 10}%` }} /></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="situation-main">
          <nav className="desktop-tabstrip">
            {(["Assign", "Drama", "Base", "Reports"] as Tab[]).map((t) => (
              <button
                key={t}
                className={`${tab === t ? "active" : ""}${pulseTab === t ? " tutorial-pulse" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
                {t === "Drama" && org.dramaQueue.length > 0 && (
                  <span className="tab-badge">{org.dramaQueue.length}</span>
                )}
              </button>
            ))}
          </nav>
          {tab === "Assign" && intentBlock}
          {activeScreen}
        </div>

        <div className="situation-sidebar">
          <SituationSidebar arc={arc} org={org} lastReports={lastReports} intent={intent} />
        </div>
      </div>

      {/* ── MOBILE: tab bar ── */}
      <nav className="tabbar">
        {(["Roster", "Assign", "Drama", "Base", "Reports"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`${tab === t ? "active" : ""}${t === "Drama" && org.dramaQueue.length > 0 ? " drama-active" : ""}${pulseTab === t ? " tutorial-pulse" : ""}`}
            onClick={() => setTab(t)}
          >
            <span className="tab-count">{tabCounts[t]}</span>
            {t}
          </button>
        ))}
      </nav>
    </>
  );
}
