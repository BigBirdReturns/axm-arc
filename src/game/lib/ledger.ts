// Tier-2 guild persistence — the ledger, the source seam, compatibility,
// projection, and the two commit paths. Implements docs/RFC_TIER2_LEDGER_SCHEMA.md
// (minimal). arc-owned, local-first, deterministic; no world/network/clock/random.
//
// The whole point: the guild does not reset. A guild that cleared tier 1 carries
// its people and consequences into a compatible tier 2, while tier 1 stays
// replayable standalone (the null-ledger path === today's buildStartingOrg).

import type { Agent, Arc, Organization, Precedent } from "../../engine/types.js";
import { cartridgeDigest, sha256Hex } from "../../engine/cartridge-digest.js";
import { hashSeed } from "../../engine/prng.js";
import { buildStartingOrg } from "../../sim/cartridge-conformance.js";

const LEDGER_KEY = "axm-arc:campaign-ledger:v1";
const SCHEMA_VERSION = "ledger/1.0";
const GROWTH_CAP = 6; // per-attribute lifetime growth ceiling (anti-inflation)

// ── compatibility (Q2: computed, never guessed) ──────────────────────────────

export interface CompatibilityProfile {
  roleIds: string[];
  attributeIds: string[];
  tierIds: string[];
  itemSlots: string[];
  checkVocab: string[];
  profileDigest: string;
}

export function compatibilityProfile(arc: Arc): CompatibilityProfile {
  const roleIds = arc.roles.map((r) => r.id).sort();
  const attributeIds = arc.attributes.map((a) => a.id).sort();
  const tierIds = arc.tiers.map((t) => t.id).sort();
  const itemSlots = [...new Set(arc.items.map((i) => i.slot))].sort();
  const vocab = new Set<string>();
  for (const c of arc.challenges) {
    for (const m of c.mechanicChecks) {
      vocab.add(`scope:${m.scope}`);
      for (const rid of m.roleIds ?? []) vocab.add(`role:${rid}`);
      for (const w of m.attributeWeights) vocab.add(`attr:${w.attributeId}`);
    }
  }
  const checkVocab = [...vocab].sort();
  const profileDigest =
    "prof1_" + sha256Hex(JSON.stringify({ roleIds, attributeIds, tierIds, itemSlots, checkVocab }));
  return { roleIds, attributeIds, tierIds, itemSlots, checkVocab, profileDigest };
}

export interface CompatibilityReport {
  compatible: boolean;
  verdict: "null-ledger" | "compatible" | "incompatible";
  ledgerProfile: CompatibilityProfile | null;
  cartridgeProfile: CompatibilityProfile;
  dimensions: { dimension: string; ledgerValue: string[]; cartridgeValue: string[]; match: boolean }[];
  remedy: null | "archive" | "export" | "start-fresh" | "adapter-required";
  message: string;
}

export function checkCompatibility(ledger: CampaignLedger | null, arc: Arc): CompatibilityReport {
  const cartridgeProfile = compatibilityProfile(arc);
  if (!ledger) {
    return {
      compatible: true, verdict: "null-ledger", ledgerProfile: null, cartridgeProfile,
      dimensions: [], remedy: null, message: "No guild ledger — a fresh guild will be generated.",
    };
  }
  const lp = ledger.profile;
  const dims: CompatibilityReport["dimensions"] = ([
    ["roles", lp.roleIds, cartridgeProfile.roleIds],
    ["attributes", lp.attributeIds, cartridgeProfile.attributeIds],
    ["tiers", lp.tierIds, cartridgeProfile.tierIds],
    ["item slots", lp.itemSlots, cartridgeProfile.itemSlots],
    ["check vocabulary", lp.checkVocab, cartridgeProfile.checkVocab],
  ] as const).map(([dimension, a, b]) => ({
    dimension, ledgerValue: a, cartridgeValue: b, match: JSON.stringify(a) === JSON.stringify(b),
  }));
  const compatible = lp.profileDigest === cartridgeProfile.profileDigest;
  const mism = dims.filter((d) => !d.match).map((d) => d.dimension);
  return {
    compatible,
    verdict: compatible ? "compatible" : "incompatible",
    ledgerProfile: lp, cartridgeProfile, dimensions: dims,
    remedy: compatible ? null : "start-fresh",
    message: compatible
      ? "This guild's vocabulary matches the cartridge — projection allowed."
      : `Incompatible: ${mism.join(", ")} differ. Archive/export this guild or start fresh — no vocabulary is guessed.`,
  };
}

// ── the ledger object model (minimal, per the schema RFC) ─────────────────────

export interface AgentMemory {
  agentId: string;
  agent: Agent;                                  // full engine-agent snapshot (identity, morale, stress, attrs, traits, loyalty)
  growthBase: Record<string, number>;            // attributes as first recorded (growth = current − base, capped)
  attendance: { nightsAttended: number; nightsBenched: number; reliability: string };
  bench: { benchedCount: number; resentment: number };
  joinedCommitSeq: number;
}

export interface GearMemory {
  gearMemoryId: string;
  itemRef: { itemId: string; cartridgeDigest: string };  // labelled — never a bare id
  displayName: string;
  acquiredByAgentId: string | null;
  passedOverAgentIds: string[];
  contributedToClear: boolean;
  projection: { kind: "none" } | { kind: "legacy-readiness-modifier"; modifier: number } | { kind: "role-identity-signal"; roleId: string };
}

export interface BossScar {
  scarId: string;
  sourceBossRef: { challengeId: string; cartridgeDigest: string };
  name: string;
  effect: { modifier: number; appliesTo: "guild"; note: string };
  earnedCommitSeq: number;
  durationTiers: number;
}

export interface FairnessMemory {
  perAgent: Record<string, { received: number; passedOver: number }>;
  distributionScore: number;
  disputesResolved: number;
}

export interface TierRecord {
  tierIndex: number;
  cartridgeId: string;
  cartridgeDigest: string;
  tierLabel: string;
  cleared: boolean;
  grade: string | null;
  firstClearCommitSeq: number | null;
  pulls: number; wipes: number; bestPull: number | null;
}

export interface ConsequenceSet {
  loot: { itemId: string; toAgentId: string | null }[];
  moraleShifts: { agentId: string; morale: number }[];
  stress: { agentId: string; stress: number }[];
  scarsEarned: BossScar[];
  precedentsSet: Precedent[];
  legends: { agentId: string; citation: string }[];
  clearedTier: boolean;
}

interface LockoutCommitBase {
  commitSeq: number;
  type: "victory" | "failed-lockout";
  cartridgeId: string;
  cartridgeDigest: string;
  rngSeedAtNight: number;
  pulls: number; wipes: number; bestPull: number | null;
  consequences: ConsequenceSet;
}
export interface VictoryCommit extends LockoutCommitBase { type: "victory"; clearedTier: boolean; grade: string; tierAdvanced: boolean; }
export interface FailedLockoutCommit extends LockoutCommitBase { type: "failed-lockout"; tierAdvanced: false; }
export type LockoutCommit = VictoryCommit | FailedLockoutCommit;

export interface CampaignLedger {
  schemaVersion: string;
  ledgerId: string;
  profile: CompatibilityProfile;
  rngSeed: number;
  guild: { name: string; legacyLevel: number; legacyPoints: number };
  progress: { currentTierIndex: number; tiers: TierRecord[] };
  roster: AgentMemory[];
  gear: GearMemory[];
  fairness: FairnessMemory;
  precedents: Precedent[];
  scars: BossScar[];
  commits: LockoutCommit[];
  nextCommitSeq: number;
}

// ── custody (local-first, arc-owned, exportable) ─────────────────────────────

export function loadLedger(): CampaignLedger | null {
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw) as CampaignLedger);
  } catch {
    return null;
  }
}
export function saveLedger(ledger: CampaignLedger): void {
  try { localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger)); } catch { /* headless / quota */ }
}
export function clearLedger(): void {
  try { localStorage.removeItem(LEDGER_KEY); } catch { /* headless */ }
}
export function exportLedger(ledger: CampaignLedger): { filename: string; json: string } {
  return { filename: `${ledger.guild.name.replace(/\s+/g, "-").toLowerCase()}.guild.json`, json: JSON.stringify(ledger, null, 2) };
}
/** Forward migration hook. Additive versions load as-is; a destructive bump would
 *  register a transform here. Never migrates a cartridge (it is not embedded). */
function migrate(ledger: CampaignLedger): CampaignLedger {
  return ledger; // ledger/1.0 is current
}

// ── projection (Q1 gear rule + purity; the source seam) ──────────────────────

export interface ProjectionResult {
  ok: boolean;
  org: Organization | null;
  compatibility: CompatibilityReport;
  carried: { agents: number; scars: number; precedents: number; gearMemory: number };
}

/** THE SEAM. `project(undefined/null, ...)` is byte-identical to today's
 *  buildStartingOrg (standalone play preserved). A compatible ledger projects
 *  the guild in; an incompatible one refuses with a readable report. Pure in
 *  (ledger, arc, seed). */
export function project(ledger: CampaignLedger | null, arc: Arc, seed: number): ProjectionResult {
  const compatibility = checkCompatibility(ledger, arc);
  if (compatibility.verdict === "null-ledger") {
    return { ok: true, org: buildStartingOrg(arc, seed, { rosterSize: 12 }), compatibility,
      carried: { agents: 0, scars: 0, precedents: 0, gearMemory: 0 } };
  }
  if (compatibility.verdict === "incompatible") {
    return { ok: false, org: null, compatibility, carried: { agents: 0, scars: 0, precedents: 0, gearMemory: 0 } };
  }
  // compatible — build the shell for correct economy/facilities, then swap in the guild.
  const base = buildStartingOrg(arc, seed, { rosterSize: 12 });
  const digest = cartridgeDigest(arc);
  const agents: Record<string, Agent> = {};
  for (const m of ledger!.roster) {
    agents[m.agentId] = projectAgent(m.agent);
  }
  // Top up with generated slack only if the guild is smaller than the roster need.
  if (Object.keys(agents).length < Object.keys(base.agents).length) {
    for (const a of Object.values(base.agents)) {
      if (Object.keys(agents).length >= 12) break;
      if (!agents[a.id]) agents[a.id] = a;
    }
  }
  const org: Organization = {
    ...base,
    agents,
    precedents: ledger!.precedents.map((p) => ({ ...p })),
    rngSeed: hashSeed(ledger!.rngSeed, digest, seed),
  };
  return {
    ok: true, org, compatibility,
    carried: { agents: ledger!.roster.length, scars: ledger!.scars.length, precedents: ledger!.precedents.length, gearMemory: ledger!.gear.length },
  };
}

/** Carry the PERSON, not the prior tier's raw content. Keeps identity, role,
 *  attributes (same vocabulary), morale, stress, loyalty, traits; STRIPS raw
 *  prior-tier gear and cartridge-bound history so no old-tier stats inflate the
 *  new tier (Q1). */
function projectAgent(a: Agent): Agent {
  const clone: Agent = structuredClone(a);
  clone.equippedItems = {};            // raw prior-tier gear does NOT carry (no inflation)
  clone.assignmentHistory = [];        // cartridge-bound — fresh slate for the new tier
  clone.rewardHistory = [];            // cartridge-bound
  clone.lastClearCycle = {};
  clone.downedUntilCycle = null;
  return clone;                        // morale/stress/attributes/traits/hiddenAttributes preserved
}

// ── commits (Q3: ceremonial; victory advances, failed does not) ──────────────

export interface NightResult {
  arc: Arc;
  org: Organization;      // the guild's final state after the night
  cleared: boolean;
  pulls: number; wipes: number; bestPull: number | null;
}

/** What the consequence screen shows BEFORE anything persists. Derived from the
 *  night's org + result — nothing persists that the player did not see. */
export function buildConsequences(prev: CampaignLedger | null, night: NightResult): ConsequenceSet {
  const digest = cartridgeDigest(night.arc);
  const agents = Object.values(night.org.agents);
  const loot = agents.flatMap((a) => a.rewardHistory.map((r) => ({ itemId: r.itemId, toAgentId: a.id })));
  const moraleShifts = agents.map((a) => ({ agentId: a.id, morale: a.morale }));
  const stress = agents.map((a) => ({ agentId: a.id, stress: a.stress }));
  const scarsEarned: BossScar[] = night.cleared
    ? [{
        scarId: `scar-${digest.slice(6, 12)}`,
        sourceBossRef: { challengeId: night.arc.challenges.at(-1)?.id ?? "", cartridgeDigest: digest },
        name: `Mark of ${night.arc.meta.name}`,
        effect: { modifier: 2, appliesTo: "guild", note: "hardened by a first clear" },
        earnedCommitSeq: (prev?.nextCommitSeq ?? 0),
        durationTiers: 1,
      }]
    : [];
  const top = [...agents].sort((a, b) => b.morale - a.morale)[0];
  const legends = night.cleared && top ? [{ agentId: top.id, citation: "held the line through the clear" }] : [];
  return { loot, moraleShifts, stress, scarsEarned, precedentsSet: night.org.precedents.map((p) => ({ ...p })), legends, clearedTier: night.cleared };
}

export function commitVictory(prev: CampaignLedger | null, night: NightResult, grade = "B"): CampaignLedger {
  const cons = buildConsequences(prev, night);
  const base = prev ?? foundingLedger(night);
  const seq = base.nextCommitSeq;
  const commit: VictoryCommit = {
    commitSeq: seq, type: "victory", cartridgeId: night.arc.meta.id, cartridgeDigest: cartridgeDigest(night.arc),
    rngSeedAtNight: night.org.rngSeed, pulls: night.pulls, wipes: night.wipes, bestPull: night.bestPull,
    consequences: cons, clearedTier: night.cleared, grade, tierAdvanced: night.cleared,
  };
  return foldCommit(base, night, commit);
}

export function commitFailedLockout(prev: CampaignLedger | null, night: NightResult): CampaignLedger {
  const cons = buildConsequences(prev, { ...night, cleared: false });
  const base = prev ?? foundingLedger(night);
  const seq = base.nextCommitSeq;
  const commit: FailedLockoutCommit = {
    commitSeq: seq, type: "failed-lockout", cartridgeId: night.arc.meta.id, cartridgeDigest: cartridgeDigest(night.arc),
    rngSeedAtNight: night.org.rngSeed, pulls: night.pulls, wipes: night.wipes, bestPull: night.bestPull,
    consequences: cons, tierAdvanced: false,
  };
  return foldCommit(base, { ...night, cleared: false }, commit);
}

// ── ledger construction / fold ───────────────────────────────────────────────

function foundingLedger(night: NightResult): CampaignLedger {
  const digest = cartridgeDigest(night.arc);
  const roster: AgentMemory[] = Object.values(night.org.agents).map((a) => ({
    agentId: a.id, agent: structuredClone(a), growthBase: { ...a.attributes },
    attendance: { nightsAttended: 0, nightsBenched: 0, reliability: "steady" },
    bench: { benchedCount: 0, resentment: 0 }, joinedCommitSeq: 0,
  }));
  return {
    schemaVersion: SCHEMA_VERSION,
    ledgerId: `guild-${digest.slice(6, 14)}`,
    profile: compatibilityProfile(night.arc),
    rngSeed: night.org.rngSeed,
    guild: { name: "The Founded Guild", legacyLevel: 1, legacyPoints: 0 },
    progress: { currentTierIndex: 0, tiers: [] },
    roster, gear: [], fairness: { perAgent: {}, distributionScore: 100, disputesResolved: 0 },
    precedents: [], scars: [], commits: [], nextCommitSeq: 0,
  };
}

/** Apply a commit to the ledger: record the tier, roll the roster forward
 *  (morale/stress/attrs/attendance), bank gear memory + scars + precedents +
 *  fairness, advance the gate only on a tier-clearing victory. Append-only. */
function foldCommit(base: CampaignLedger, night: NightResult, commit: LockoutCommit): CampaignLedger {
  const digest = cartridgeDigest(night.arc);
  const attended = new Set(Object.keys(night.org.agents));

  // Roster forward: refresh each member's snapshot from the night's org, capping growth.
  const roster: AgentMemory[] = base.roster.map((m) => {
    const live = night.org.agents[m.agentId];
    if (!live) return { ...m, attendance: { ...m.attendance, nightsBenched: m.attendance.nightsBenched + 1 }, bench: { ...m.bench, benchedCount: m.bench.benchedCount + 1 } };
    const capped: Record<string, number> = {};
    for (const [k, v] of Object.entries(live.attributes)) {
      const cap = (m.growthBase[k] ?? v) + GROWTH_CAP;
      capped[k] = Math.min(v, cap);
    }
    const agent: Agent = { ...structuredClone(live), attributes: capped };
    return {
      ...m, agent, attendance: { ...m.attendance, nightsAttended: m.attendance.nightsAttended + 1, reliability: "reliable" },
    };
  });
  // Newly-present agents (founding case: base.roster already has them; guard anyway).
  for (const a of Object.values(night.org.agents)) {
    if (!roster.some((m) => m.agentId === a.id)) {
      roster.push({ agentId: a.id, agent: structuredClone(a), growthBase: { ...a.attributes },
        attendance: { nightsAttended: 1, nightsBenched: 0, reliability: "reliable" }, bench: { benchedCount: 0, resentment: 0 }, joinedCommitSeq: commit.commitSeq });
    }
  }

  // Gear memory (Q1: memory, not stats). Record each equipped item as memory only.
  const gear: GearMemory[] = [...base.gear];
  for (const a of Object.values(night.org.agents)) {
    for (const itemId of Object.values(a.equippedItems)) {
      if (gear.some((g) => g.itemRef.itemId === itemId && g.acquiredByAgentId === a.id)) continue;
      const item = night.arc.items.find((i) => i.id === itemId);
      gear.push({
        gearMemoryId: `gm-${itemId}-${a.id}`, itemRef: { itemId, cartridgeDigest: digest },
        displayName: item?.name ?? itemId, acquiredByAgentId: a.id, passedOverAgentIds: [],
        contributedToClear: night.cleared, projection: { kind: "legacy-readiness-modifier", modifier: 1 },
      });
    }
  }

  // Fairness memory.
  const fairness: FairnessMemory = { perAgent: { ...base.fairness.perAgent }, distributionScore: base.fairness.distributionScore, disputesResolved: base.fairness.disputesResolved };
  for (const c of commit.consequences.loot) {
    if (!c.toAgentId) continue;
    const f = fairness.perAgent[c.toAgentId] ?? { received: 0, passedOver: 0 };
    fairness.perAgent[c.toAgentId] = { received: f.received + 1, passedOver: f.passedOver };
  }

  // Tier record + gate advance (victory + cleared only).
  const tiers = [...base.progress.tiers];
  const advanced = commit.type === "victory" && commit.consequences.clearedTier;
  const existing = tiers.find((t) => t.cartridgeDigest === digest);
  if (existing) {
    existing.pulls += commit.pulls; existing.wipes += commit.wipes;
    existing.bestPull = minPull(existing.bestPull, commit.bestPull);
    if (advanced && !existing.cleared) { existing.cleared = true; existing.firstClearCommitSeq = commit.commitSeq; existing.grade = (commit as VictoryCommit).grade; }
  } else {
    tiers.push({
      tierIndex: tiers.length, cartridgeId: night.arc.meta.id, cartridgeDigest: digest, tierLabel: night.arc.meta.name,
      cleared: advanced, grade: advanced ? (commit as VictoryCommit).grade : null,
      firstClearCommitSeq: advanced ? commit.commitSeq : null, pulls: commit.pulls, wipes: commit.wipes, bestPull: commit.bestPull,
    });
  }
  const currentTierIndex = advanced ? Math.min(tiers.length, base.progress.currentTierIndex + 1) : base.progress.currentTierIndex;

  return {
    ...base,
    roster, gear, fairness,
    scars: [...base.scars, ...commit.consequences.scarsEarned],
    precedents: dedupePrecedents([...base.precedents, ...commit.consequences.precedentsSet]),
    progress: { currentTierIndex, tiers },
    commits: [...base.commits, commit],
    nextCommitSeq: commit.commitSeq + 1,
    guild: { ...base.guild, legacyPoints: base.guild.legacyPoints + (advanced ? 15 : 0) },
  };
}

function minPull(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}
function dedupePrecedents(ps: Precedent[]): Precedent[] {
  const seen = new Set<string>();
  const out: Precedent[] = [];
  for (const p of ps) {
    const k = (p as { id?: string }).id ?? JSON.stringify(p);
    if (seen.has(k)) continue;
    seen.add(k); out.push(p);
  }
  return out;
}
