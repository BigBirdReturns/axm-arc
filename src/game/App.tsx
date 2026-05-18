import { useEffect, useState } from "react";
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

  const advanceCycle = () => {
    setAdvanceError(null);
    if (org.dramaQueue.length > 0) {
      setAdvanceError("Resolve drama cards before advancing.");
      return;
    }
    if (pendingRewardChoices.length > rewardDecisions.length) {
      setAdvanceError("Resolve all pending reward decisions in Reports.");
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

  return (
    <>
      <header className="app-header">
        <h1>axm-arc</h1>
        <div className="meta">
          Cycle {org.cycle} · Tokens {org.resources.tokens} · {org.reputation} {arc.reputationName}
          <button className="icon" style={{ marginLeft: 8 }} onClick={resetGame}>Reset</button>
        </div>
      </header>

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
        <div style={{ padding: "8px 16px", background: "var(--bg-elev)", borderTop: "1px solid var(--border)" }}>
          {advanceError && <div className="warning">{advanceError}</div>}
          <button
            className="primary"
            disabled={assignments.length === 0 && lastReports.length === 0}
            onClick={advanceCycle}
          >
            Advance Cycle ({assignments.length} contract{assignments.length === 1 ? "" : "s"})
          </button>
        </div>
      )}

      <nav className="tabbar">
        {(["Roster", "Assign", "Drama", "Base", "Reports"] as Tab[]).map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}{t === "Drama" && org.dramaQueue.length > 0 ? ` (${org.dramaQueue.length})` : ""}
          </button>
        ))}
      </nav>
    </>
  );
}
