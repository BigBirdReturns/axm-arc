// Raid-night slice logic — the playable loop around the wipe-diagnosis slice
// (cartridges/first-lockout.arc.json). Pure functions over an immutable state:
// build the guild, assign the party, pull the boss, diagnose a wipe, apply
// exactly one fix, pull again. NO tier-2 persistence, no extra bosses, no
// campaign architecture — one lockout on one cartridge.
//
// Each pull uses an incrementing pull number as the resolver's cycle, so a
// re-pull after a fix is a fresh attempt (new roll) that reflects the improved
// roster — the "one more pull" feel without any new system.

import firstLockout from "../../../cartridges/first-lockout.arc.json";
import { validateArc } from "../../engine/schema.js";
import { resolveChallenge } from "../../engine/resolver.js";
import { Rng } from "../../engine/prng.js";
import { buildStartingOrg } from "../../sim/cartridge-conformance.js";
import { diagnoseWipe, type Fix, type WipeDiagnosis } from "../../sim/wipe-diagnosis.js";
import type { Agent, Arc, Challenge, Organization, RunReport } from "../../engine/types.js";

const BOSS_ID = "the-hollow-choir"; // the wall this slice is built around
const TRAIN_GAIN = 3;
const RALLY_TO = 60;

export const RAID_ARC: Arc = validateArc(firstLockout);
export function raidBoss(): Challenge {
  return RAID_ARC.challenges.find((c) => c.id === BOSS_ID)!;
}

export interface RaidNightState {
  org: Organization;
  partyIds: string[];   // the fielded raid party (8–10)
  pull: number;         // attempts taken (drives the seed → fresh rolls)
  report: RunReport | null;
  diagnosis: WipeDiagnosis | null;
  cleared: boolean;
  /** The lever of the fix applied since the last pull, or null. Exactly one fix
   *  is allowed per wipe; this gates the fix buttons until the next pull. */
  fixApplied: string | null;
}

/** A legal-by-roster party (role requirements first, then filled by id). The
 *  guild is already at the wall, so we don't re-gate progression here. */
export function legalParty(challenge: Challenge, org: Organization): string[] {
  const agents = Object.values(org.agents).sort((a, b) => (a.id < b.id ? -1 : 1));
  const size = Math.min(challenge.rosterRequirements.maxAgents, 10);
  const chosen: Agent[] = [];
  for (const req of challenge.rosterRequirements.roleRequirements) {
    for (const a of agents.filter((x) => x.role === req.roleId && !chosen.includes(x)).slice(0, req.count)) chosen.push(a);
  }
  for (const a of agents) { if (chosen.length >= size) break; if (!chosen.includes(a)) chosen.push(a); }
  return chosen.slice(0, size).map((a) => a.id);
}

export function newRaidNight(seed = 1): RaidNightState {
  const org = buildStartingOrg(RAID_ARC, seed, { rosterSize: 12 });
  return {
    org,
    partyIds: legalParty(raidBoss(), org),
    pull: 0,
    report: null,
    diagnosis: null,
    cleared: false,
    fixApplied: null,
  };
}

/** Whether the current party satisfies the boss's roster requirements. */
export function partyLegal(state: RaidNightState): boolean {
  const boss = raidBoss();
  const party = state.partyIds.map((id) => state.org.agents[id]).filter(Boolean) as Agent[];
  if (party.length < boss.rosterRequirements.minAgents || party.length > boss.rosterRequirements.maxAgents) {
    return false;
  }
  return boss.rosterRequirements.roleRequirements.every(
    (req) => party.filter((a) => a.role === req.roleId).length >= req.count,
  );
}

/** Field or bench an agent, keeping within the boss's size bounds. Returns the
 *  same state (no-op) if the move would break the size ceiling/floor. */
export function toggleFielded(state: RaidNightState, agentId: string): RaidNightState {
  const boss = raidBoss();
  const inParty = state.partyIds.includes(agentId);
  if (inParty) {
    if (state.partyIds.length <= boss.rosterRequirements.minAgents) return state;
    return { ...state, partyIds: state.partyIds.filter((id) => id !== agentId) };
  }
  if (state.partyIds.length >= boss.rosterRequirements.maxAgents) return state;
  return { ...state, partyIds: [...state.partyIds, agentId] };
}

/** Pull the boss. Deterministic in (org state, pull number). On a wipe, attaches
 *  the diagnosis. Clears the per-wipe fix gate so the next wipe allows one fix. */
export function pull(state: RaidNightState): RaidNightState {
  const boss = raidBoss();
  const assignedAgents = state.partyIds.map((id) => state.org.agents[id]).filter(Boolean) as Agent[];
  const cycle = state.pull + 1;
  const report = resolveChallenge({
    challenge: boss, assignedAgents, org: state.org, arc: RAID_ARC,
    rng: new Rng(0), cycle, collectDiagnostics: true,
  });
  const cleared = report.outcome === "success";
  const diagnosis = cleared ? null : diagnoseWipe(report, boss, state.org, RAID_ARC);
  return { ...state, pull: cycle, report, diagnosis, cleared, fixApplied: null };
}

/** Apply exactly one fix — the concrete state change the lever describes. Returns
 *  unchanged state if a fix was already applied since the last pull. */
export function applyFix(state: RaidNightState, fix: Fix): RaidNightState {
  if (state.fixApplied) return state;
  const org: Organization = structuredClone(state.org);
  let partyIds = [...state.partyIds];

  switch (fix.lever) {
    case "gear": {
      const a = fix.agentId ? org.agents[fix.agentId] : undefined;
      const item = fix.itemId ? RAID_ARC.items.find((i) => i.id === fix.itemId) : undefined;
      if (a && item) a.equippedItems = { ...a.equippedItems, [item.slot]: item.id };
      break;
    }
    case "train": {
      const a = fix.agentId ? org.agents[fix.agentId] : undefined;
      if (a && fix.attrId) a.attributes = { ...a.attributes, [fix.attrId]: (a.attributes[fix.attrId] ?? 0) + TRAIN_GAIN };
      break;
    }
    case "rest": {
      const a = fix.agentId ? org.agents[fix.agentId] : undefined;
      if (a) { a.stress = 0; a.afflictionState = { kind: "none" }; }
      break;
    }
    case "rally": {
      const a = fix.agentId ? org.agents[fix.agentId] : undefined;
      if (a) a.morale = Math.max(a.morale, RALLY_TO);
      break;
    }
    case "bench_swap": {
      if (fix.agentId && fix.swapAgentId) {
        partyIds = partyIds.filter((id) => id !== fix.agentId);
        if (!partyIds.includes(fix.swapAgentId)) partyIds.push(fix.swapAgentId);
      }
      break;
    }
    case "tradeoff": {
      // Field the offense body and sit a defensive one — or, for the no-op
      // "re-pull as composed" floor fix, change nothing.
      if (fix.swapAgentId && !partyIds.includes(fix.swapAgentId)) {
        const sit = partyIds.map((id) => org.agents[id]).find((a) => a?.role === "warden");
        if (sit) partyIds = partyIds.filter((id) => id !== sit.id);
        partyIds.push(fix.swapAgentId);
      }
      break;
    }
  }

  return { ...state, org, partyIds, fixApplied: fix.lever };
}
