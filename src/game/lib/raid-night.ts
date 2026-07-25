// Raid-night slice logic — the playable loop around the wipe-diagnosis slice.
// Pull the boss, diagnose a wipe, apply one fix, pull again — and (tier-2) start
// the night from a guild ledger instead of a generated roster. The starting-org
// source is the projection seam (src/game/lib/ledger.ts): no ledger → generate
// exactly as before (standalone play preserved); a compatible ledger → project
// the guild in; an incompatible one → refuse with a readable report.
//
// Each pull uses an incrementing pull number as the resolver's cycle, so a
// re-pull after a fix is a fresh attempt (new roll) on the improved roster.

import firstLockout from "../../../cartridges/first-lockout.arc.json";
import secondLockout from "../../../cartridges/second-lockout.arc.json";
import { validateArc } from "../../engine/schema.js";
import { resolveChallenge } from "../../engine/resolver.js";
import { diagnoseWipe, type Fix, type WipeDiagnosis } from "../../sim/wipe-diagnosis.js";
import {
  project, commitVictory, commitFailedLockout, buildConsequences, saveLedger,
  type CampaignLedger, type CompatibilityReport, type ConsequenceSet, type NightResult,
} from "./ledger.js";
import type { SaveResult, StorageWriter } from "./persistence.js";
import type { Agent, Arc, Challenge, Organization, RunReport } from "../../engine/types.js";

const BOSS_ID = "the-hollow-choir"; // the wall this slice is built around
const TRAIN_GAIN = 3;
const RALLY_TO = 60;

export const RAID_ARC: Arc = validateArc(firstLockout);       // tier 1
export const RAID_ARC_T2: Arc = validateArc(secondLockout);   // tier 2 (profile-compatible)
function bossOf(arc: Arc): Challenge {
  return arc.challenges.find((c) => c.id === BOSS_ID) ?? arc.challenges[arc.challenges.length - 1]!;
}
export function raidBoss(): Challenge { return bossOf(RAID_ARC); }

/** What the fix changed, plus enough to judge on the next pull whether it
 *  mattered — the check it targeted and that check's value/threshold last pull. */
export interface LastFix {
  lever: string;
  checkId: string;
  checkName: string;
  prevValue: number;
  prevThreshold: number;
}

export interface RaidNightState {
  arc: Arc;             // which cartridge (tier) this night is
  ledger: CampaignLedger | null;   // the guild carried in, if any
  blocked: CompatibilityReport | null;  // set when the ledger is incompatible with this cartridge
  org: Organization;
  partyIds: string[];   // the fielded raid party (8–10)
  pull: number;         // attempts taken (drives the seed → fresh rolls)
  wipes: number;        // failed pulls this night
  bestShortfall: number | null;    // closest the raid came (min wall shortfall)
  report: RunReport | null;
  diagnosis: WipeDiagnosis | null;
  cleared: boolean;
  /** The lever of the fix applied since the last pull, or null. Exactly one fix
   *  is allowed per wipe; this gates the fix buttons until the next pull. */
  fixApplied: string | null;
  /** One-line receipt of what the applied fix changed (before → after). */
  receipt: string | null;
  /** The fix carried into the next pull, so we can report whether it mattered. */
  lastFix: LastFix | null;
  /** After a pull that followed a fix: did the fixed factor improve, matter, or
   *  get overtaken by another failure. */
  pullDelta: string | null;
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

/** Tier 1, no ledger — a fresh guild, exactly as before (the null-ledger path). */
export function newRaidNight(seed = 1): RaidNightState {
  return startNight(RAID_ARC, null, seed);
}

/** Start a night on any cartridge from an optional guild ledger. Compatible →
 *  the guild projects in; incompatible → `blocked` carries the readable report
 *  and the org is a fresh fallback the player may choose to play (start fresh). */
export function newRaidNightFrom(arc: Arc, ledger: CampaignLedger | null, seed = 1): RaidNightState {
  return startNight(arc, ledger, seed);
}

function startNight(arc: Arc, ledger: CampaignLedger | null, seed: number): RaidNightState {
  const proj = project(ledger, arc, seed);
  const boss = bossOf(arc);
  const org = proj.ok ? proj.org! : project(null, arc, seed).org!; // fresh fallback behind the refusal
  return {
    arc, ledger, blocked: proj.ok ? null : proj.compatibility,
    org,
    partyIds: legalParty(boss, org),
    pull: 0, wipes: 0, bestShortfall: null,
    report: null, diagnosis: null, cleared: false,
    fixApplied: null, receipt: null, lastFix: null, pullDelta: null,
  };
}

/** A check's value-vs-threshold on a report: teamScore for aggregate checks, the
 *  worst contributor for role/per-agent. Reads the diagnostics the resolver
 *  captured — never re-scores. */
function checkStatus(report: RunReport, checkId: string): { passed: boolean; value: number; threshold: number } | null {
  const cd = report.diagnostics?.checks.find((c) => c.mechanicId === checkId);
  if (!cd) return null;
  const value = cd.scope === "team_aggregate"
    ? (cd.teamScore ?? 0)
    : Math.min(...cd.contributions.map((c) => c.score), cd.threshold);
  return { passed: cd.passed, value, threshold: cd.threshold };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Whether the current party satisfies the boss's roster requirements. */
export function partyLegal(state: RaidNightState): boolean {
  const boss = bossOf(state.arc);
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
  const boss = bossOf(state.arc);
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
  const boss = bossOf(state.arc);
  const assignedAgents = state.partyIds.map((id) => state.org.agents[id]).filter(Boolean) as Agent[];
  const cycle = state.pull + 1;
  const report = resolveChallenge({
    challenge: boss, assignedAgents, org: state.org, arc: state.arc,
    cycle, collectDiagnostics: true,
  });
  const cleared = report.outcome === "success";
  const diagnosis = cleared ? null : diagnoseWipe(report, boss, state.org, state.arc);

  // If a fix was carried into this pull, report whether it mattered — grounded
  // in the fixed check's value moving (or not) against its threshold.
  let pullDelta: string | null = null;
  const lf = state.lastFix;
  if (lf) {
    const now = checkStatus(report, lf.checkId);
    if (cleared) {
      pullDelta = `The ${lf.lever} carried — "${lf.checkName}" held and the pull CLEARED.`;
    } else if (now && now.passed) {
      const newFail = diagnosis?.failedChecks[0];
      pullDelta = newFail
        ? `"${lf.checkName}" held this time (was short ${r1(lf.prevThreshold - lf.prevValue)}). Wiped on "${newFail.mechanicName}" instead — the wall moved.`
        : `"${lf.checkName}" held this time.`;
    } else if (now) {
      const moved = now.value - lf.prevValue;
      pullDelta = moved > 0.5
        ? `"${lf.checkName}": ${r1(lf.prevValue)} → ${r1(now.value)} (still short ${r1(now.threshold - now.value)}) — the fix helped, not enough yet.`
        : `"${lf.checkName}": ${r1(lf.prevValue)} → ${r1(now.value)} — the fix barely moved this; it was variance or the wrong lever.`;
    }
  }

  const shortfall = diagnosis?.failedChecks[0]?.shortfall ?? null;
  const bestShortfall = cleared
    ? 0
    : shortfall == null ? state.bestShortfall
    : state.bestShortfall == null ? shortfall
    : Math.min(state.bestShortfall, shortfall);

  return {
    ...state, pull: cycle, report, diagnosis, cleared,
    wipes: cleared ? state.wipes : state.wipes + 1,
    bestShortfall,
    fixApplied: null, receipt: null, lastFix: null, pullDelta,
  };
}

/** Apply exactly one fix — the concrete state change the lever describes. Returns
 *  unchanged state if a fix was already applied since the last pull. */
export function applyFix(state: RaidNightState, fix: Fix): RaidNightState {
  if (state.fixApplied) return state;
  const org: Organization = structuredClone(state.org);
  let partyIds = [...state.partyIds];
  const name = (id?: string) => (id ? org.agents[id]?.name ?? id : "");
  let receipt = "No roster change — re-pulling the same party for a fresh roll.";

  switch (fix.lever) {
    case "gear": {
      const a = fix.agentId ? org.agents[fix.agentId] : undefined;
      const item = fix.itemId ? RAID_ARC.items.find((i) => i.id === fix.itemId) : undefined;
      if (a && item) {
        a.equippedItems = { ...a.equippedItems, [item.slot]: item.id };
        const bonus = fix.attrId ? item.statBonuses[fix.attrId] ?? 0 : 0;
        receipt = `Equipped ${item.name} on ${a.name} — +${bonus} ${fix.attrId} (was bare in that slot).`;
      }
      break;
    }
    case "train": {
      const a = fix.agentId ? org.agents[fix.agentId] : undefined;
      if (a && fix.attrId) {
        const before = a.attributes[fix.attrId] ?? 0;
        a.attributes = { ...a.attributes, [fix.attrId]: before + TRAIN_GAIN };
        receipt = `Trained ${a.name}'s ${fix.attrId}: ${before} → ${before + TRAIN_GAIN}.`;
      }
      break;
    }
    case "rest": {
      const a = fix.agentId ? org.agents[fix.agentId] : undefined;
      if (a) {
        const before = a.stress;
        const had = a.afflictionState.kind;
        a.stress = 0; a.afflictionState = { kind: "none" };
        receipt = `Rested ${a.name}: stress ${before} → 0${had !== "none" ? `, cleared ${had}` : ""}.`;
      }
      break;
    }
    case "rally": {
      const a = fix.agentId ? org.agents[fix.agentId] : undefined;
      if (a) {
        const before = a.morale;
        a.morale = Math.max(a.morale, RALLY_TO);
        receipt = `Rallied ${a.name}: morale ${before} → ${a.morale}.`;
      }
      break;
    }
    case "bench_swap": {
      if (fix.agentId && fix.swapAgentId) {
        partyIds = partyIds.filter((id) => id !== fix.agentId);
        if (!partyIds.includes(fix.swapAgentId)) partyIds.push(fix.swapAgentId);
        receipt = `Benched ${name(fix.agentId)}, fielded ${name(fix.swapAgentId)}.`;
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
        receipt = `Fielded ${name(fix.swapAgentId)}${sit ? `, sat ${sit.name}` : ""} — more offense, thinner defense.`;
      }
      break;
    }
  }

  // Remember what this fix was aimed at, and that check's value last pull, so the
  // next pull can say whether it mattered.
  let lastFix: LastFix | null = null;
  if (fix.checkId && state.report) {
    const before = checkStatus(state.report, fix.checkId);
    const fc = state.diagnosis?.failedChecks.find((f) => f.mechanicId === fix.checkId);
    if (before && fc) {
      lastFix = { lever: fix.lever, checkId: fix.checkId, checkName: fc.mechanicName, prevValue: before.value, prevThreshold: before.threshold };
    }
  }

  return { ...state, org, partyIds, fixApplied: fix.lever, receipt, lastFix };
}

// ── commits (the ceremonial persistence path; Q3) ────────────────────────────

function nightResult(state: RaidNightState): NightResult {
  return {
    arc: state.arc, org: state.org, cleared: state.cleared,
    pulls: state.pull, wipes: state.wipes, bestPull: state.bestShortfall,
  };
}

/** The consequence set shown BEFORE anything persists — nothing is committed
 *  that the player didn't see. */
export function nightConsequences(state: RaidNightState): ConsequenceSet {
  return buildConsequences(state.ledger, nightResult(state));
}

/** Pure/headless adapter: commit a cleared night to a new in-memory ledger.
 * Interactive callers use the result-bearing path so a browser write failure
 * cannot be mislabeled as a committed record. */
export function commitNightVictory(state: RaidNightState): CampaignLedger {
  return commitVictory(state.ledger, nightResult(state));
}

/** Pure/headless adapter for a failed lockout. */
export function commitNightFailed(state: RaidNightState): CampaignLedger {
  return commitFailedLockout(state.ledger, nightResult(state));
}

export interface LedgerCommitResult {
  ledger: CampaignLedger;
  save: SaveResult;
}

export function commitNightVictoryWithResult(
  state: RaidNightState,
  storage?: StorageWriter | null,
): LedgerCommitResult {
  const ledger = commitVictory(state.ledger, nightResult(state));
  return { ledger, save: saveLedger(ledger, storage) };
}

export function commitNightFailedWithResult(
  state: RaidNightState,
  storage?: StorageWriter | null,
): LedgerCommitResult {
  const ledger = commitFailedLockout(state.ledger, nightResult(state));
  return { ledger, save: saveLedger(ledger, storage) };
}
