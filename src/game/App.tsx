import { useEffect, useMemo, useState } from "react";
import type { Agent, Facility, InfrastructureFacility, Organization, RunReport } from "../engine/types.js";
import { runCycle, type ChallengeAssignment, type PendingRewardChoice, type RewardDecision } from "../engine/cycle.js";
import {
  FIRST_CHARTER,
  FIRST_CHARTER_STARTING_ROSTER,
  FIRST_CHARTER_STARTING_RELATIONSHIPS,
} from "../arcs/index.js";
import { loadSave, saveSave, clearSave } from "./lib/storage.js";
import { RosterScreen } from "./components/RosterScreen.js";
import { AssignScreen } from "./components/AssignScreen.js";
import { DramaScreen } from "./components/DramaScreen.js";
import { BaseScreen } from "./components/BaseScreen.js";
import { ReportsScreen } from "./components/ReportsScreen.js";

type Tab = "Roster" | "Assign" | "Drama" | "Base" | "Reports";

const arc = FIRST_CHARTER;

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
  return {
    id: "player-charter",
    name: "Your Charter",
    reputation: 0,
    resources: { currency: 100, materials: 0, tokens: 2 },
    infrastructure: defaultFacilities(),
    agents,
    relationships: [...FIRST_CHARTER_STARTING_RELATIONSHIPS],
    precedents: [],
    dramaQueue: [],
    cycle: 0,
    distributionPolicy: "council",
    rngSeed: Math.floor(Math.random() * 2 ** 31),
  };
}

function getAdvanceBlocker(opts: {
  dramaQueueCount: number;
  pendingRewardChoicesCount: number;
  rewardDecisionsCount: number;
}): string | null {
  if (opts.dramaQueueCount > 0) return "Resolve drama cards before advancing.";
  if (opts.pendingRewardChoicesCount > opts.rewardDecisionsCount) {
    return "Resolve all pending reward decisions in Reports.";
  }
  return null;
}

export function App(): JSX.Element {
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

  useEffect(() => {
    saveSave(org, arc);
  }, [org]);

  const advanceBlocker = useMemo(() => getAdvanceBlocker({
    dramaQueueCount: org.dramaQueue.length,
    pendingRewardChoicesCount: pendingRewardChoices.length,
    rewardDecisionsCount: rewardDecisions.length,
  }), [org.dramaQueue.length, pendingRewardChoices.length, rewardDecisions.length]);

  const hasAdvancePayload = assignments.length > 0 || lastReports.length > 0;
  const canAdvanceCycle = hasAdvancePayload && !advanceBlocker;

  const advanceCycle = () => {
    setAdvanceError(null);
    if (advanceBlocker) {
      setAdvanceError(advanceBlocker);
      return;
    }
    const result = runCycle({
      org,
      arc,
      assignments,
      pendingRewardDecisions: rewardDecisions,
    });
    setOrg(result.org);
    setLastReports(result.reports);
    setPendingRewardChoices(result.pendingRewardChoices);
    setRewardDecisions([]);
    setAssignments([]);
    setTab("Reports");
  };

  const resetGame = () => {
    if (!confirm("Reset the game? All progress will be lost.")) return;
    clearSave();
    setOrg(buildNewOrg());
    setLastReports([]);
    setPendingRewardChoices([]);
    setRewardDecisions([]);
    setAssignments([]);
    setTab("Roster");
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

  return (
    <>
      <header className="app-header">
        <div className="top-row">
          <div className="kicker">Cycle / Week {org.cycle}</div>
          <div className="imprint">AXM · Arc 01</div>
        </div>
        <h1>{arc.meta.name}</h1>
        <div className="subtitle">
          {arc.meta.domain} · Tier I · {cleared.size} of {arc.challenges.length} cleared
        </div>
      </header>

      <div className="stat-strip">
        <div className="stat-cell">
          <div className="stat-lbl">{arc.tokenName}</div>
          <div className="stat-val">{org.resources.tokens}</div>
          <div className="stat-sub">+{arc.tokensPerCycle} next cycle</div>
        </div>
        <div className="stat-cell">
          <div className="stat-lbl">{arc.currencyName}</div>
          <div className="stat-val">{org.resources.currency.toLocaleString()}</div>
          <div className="stat-sub">
            -{Object.values(org.agents).reduce((s, a) => s + a.upkeep, 0)} upkeep
          </div>
        </div>
        <div className="stat-cell">
          <div className="stat-lbl">{arc.reputationName}</div>
          <div className="stat-val">{org.reputation}</div>
          <div className="stat-sub">of 50 to T II</div>
        </div>
        <div className="stat-cell">
          <div className="stat-lbl">Drama</div>
          <div className={`stat-val${org.dramaQueue.length > 0 ? " accent" : ""}`}>
            {org.dramaQueue.length}
          </div>
          <div className="stat-sub">queued</div>
        </div>
      </div>

      {tab === "Roster" && <RosterScreen agents={Object.values(org.agents)} arc={arc} />}
      {tab === "Assign" && (
        <AssignScreen arc={arc} org={org} assignments={assignments} setAssignments={setAssignments} />
      )}
      {tab === "Drama" && <DramaScreen org={org} setOrg={setOrg} cycle={org.cycle} />}
      {tab === "Base" && <BaseScreen arc={arc} org={org} setOrg={setOrg} />}
      {tab === "Reports" && (
        <ReportsScreen
          arc={arc}
          org={org}
          reports={lastReports}
          pendingRewardChoices={pendingRewardChoices}
          rewardDecisions={rewardDecisions}
          setRewardDecisions={setRewardDecisions}
        />
      )}

      {(tab === "Assign" || tab === "Reports") && (
        <div className="advance-footer">
          {advanceError && <div className="warning">{advanceError}</div>}
          {!advanceError && advanceBlocker && <div className="warning">{advanceBlocker}</div>}
          <button
            className={`primary${!advanceBlocker ? " accent" : ""}`}
            disabled={!canAdvanceCycle}
            onClick={advanceCycle}
          >
            {advanceBlocker
              ? "Advance blocked"
              : `Advance Cycle →`}
          </button>
        </div>
      )}

      <nav className="tabbar">
        {(["Roster", "Assign", "Drama", "Base", "Reports"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`${tab === t ? "active" : ""}${t === "Drama" && org.dramaQueue.length > 0 ? " drama-active" : ""}`}
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
