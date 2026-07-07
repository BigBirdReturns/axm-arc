// The Guild Hall's derivations: pure functions of the committed campaign ledger
// (RFC_GUILD_HALL — reads, never writes). Every Hall panel is one of these, so
// the Hall can render only what the ledger stores and never disagree with any
// other surface that reads the same fact.
import type { CampaignLedger } from "./ledger.js";

/** The identity + campaign-record summary shown at the top of the Guild Hall. */
export interface GuildHallSummary {
  hasGuild: boolean;
  guildName: string;
  legacyLevel: number;
  legacyPoints: number;
  tiersCleared: number;
  tiersSeen: number;
  currentTierIndex: number;
  commits: number;
  victories: number;
  failedLockouts: number;
  rosterSize: number;
  scars: number;
  precedents: number;
}

/** One raider's memory card: identity + the attendance record the ledger holds.
 *  Role is the cartridge's own role id (vocabulary flows verbatim). */
export interface AgentMemoryCard {
  agentId: string;
  name: string;
  role: string | null;
  nightsAttended: number;
  nightsBenched: number;
  reliability: string;
  morale: number;
  stress: number;
}

/** Derive the roster's memory cards, most-attended first. Pure over the ledger. */
export function agentMemoryCards(ledger: CampaignLedger | null): AgentMemoryCard[] {
  if (!ledger) return [];
  return ledger.roster
    .map((m) => ({
      agentId: m.agentId,
      name: m.agent.name,
      role: m.agent.role,
      nightsAttended: m.attendance.nightsAttended,
      nightsBenched: m.attendance.nightsBenched,
      reliability: m.attendance.reliability,
      morale: m.agent.morale,
      stress: m.agent.stress,
    }))
    .sort((a, b) => b.nightsAttended - a.nightsAttended || (a.name < b.name ? -1 : 1));
}

/** A scar the guild carries: a boss's lasting mark, its readiness modifier and
 *  the note explaining what hardened the guild. */
export interface ScarView { scarId: string; name: string; note: string; modifier: number; durationTiers: number; }

/** A precedent the guild set: a distribution decision and the basis it was made
 *  on — the record of how the guild decided, not just what it decided. */
export interface PrecedentView { type: string; basis: string; winner: string | null; involved: number; }

/** Derive the scars carried by the guild. Pure over the ledger. */
export function scarViews(ledger: CampaignLedger | null): ScarView[] {
  if (!ledger) return [];
  return ledger.scars.map((s) => ({
    scarId: s.scarId, name: s.name, note: s.effect.note, modifier: s.effect.modifier, durationTiers: s.durationTiers,
  }));
}

/** Derive the precedents the guild set, most-recent first. Pure over the ledger. */
export function precedentViews(ledger: CampaignLedger | null): PrecedentView[] {
  if (!ledger) return [];
  return ledger.precedents
    .map((p) => ({ type: p.type, basis: p.decisionBasis, winner: p.winner, involved: p.agentsInvolved.length }))
    .reverse();
}

/** One raider's share of the guild's loot, as the ledger's fairness memory recorded it. */
export interface FairnessRow { agentId: string; name: string; received: number; passedOver: number }

/** One item the guild remembers acquiring — memory, not a stat (Q1). */
export interface GearRow { gearMemoryId: string; displayName: string; acquiredBy: string | null; contributedToClear: boolean }

/** The loot & fairness history: the distribution score/disputes the ledger
 *  tracked, plus one row per raider's share and one row per remembered item. */
export interface LootFairnessView {
  distributionScore: number;
  disputesResolved: number;
  totalAwarded: number;
  rows: FairnessRow[];
  gear: GearRow[];
}

/** Derive the loot & fairness history. Pure over the ledger. A null ledger is
 *  an honest empty view — no fabricated distribution. */
export function lootFairnessView(ledger: CampaignLedger | null): LootFairnessView {
  if (!ledger) return { distributionScore: 0, disputesResolved: 0, totalAwarded: 0, rows: [], gear: [] };
  const nameOf = (agentId: string) => ledger.roster.find((m) => m.agentId === agentId)?.agent.name ?? agentId;
  const rows: FairnessRow[] = Object.entries(ledger.fairness.perAgent)
    .map(([agentId, f]) => ({ agentId, name: nameOf(agentId), received: f.received, passedOver: f.passedOver }))
    .sort((a, b) => b.received - a.received || (a.name < b.name ? -1 : 1));
  const totalAwarded = rows.reduce((sum, r) => sum + r.received, 0);
  const gear: GearRow[] = ledger.gear.map((g) => ({
    gearMemoryId: g.gearMemoryId, displayName: g.displayName,
    acquiredBy: g.acquiredByAgentId ? nameOf(g.acquiredByAgentId) : null,
    contributedToClear: g.contributedToClear,
  }));
  return { distributionScore: ledger.fairness.distributionScore, disputesResolved: ledger.fairness.disputesResolved, totalAwarded, rows, gear };
}

/** Derive the campaign-record summary. A null ledger is an honest empty hall —
 *  no guild founded yet — not a fabricated one. */
export function summarizeGuildHall(ledger: CampaignLedger | null): GuildHallSummary {
  if (!ledger) {
    return {
      hasGuild: false, guildName: "", legacyLevel: 0, legacyPoints: 0,
      tiersCleared: 0, tiersSeen: 0, currentTierIndex: 0,
      commits: 0, victories: 0, failedLockouts: 0, rosterSize: 0, scars: 0, precedents: 0,
    };
  }
  return {
    hasGuild: true,
    guildName: ledger.guild.name,
    legacyLevel: ledger.guild.legacyLevel,
    legacyPoints: ledger.guild.legacyPoints,
    tiersCleared: ledger.progress.tiers.filter((t) => t.cleared).length,
    tiersSeen: ledger.progress.tiers.length,
    currentTierIndex: ledger.progress.currentTierIndex,
    commits: ledger.commits.length,
    victories: ledger.commits.filter((c) => c.type === "victory").length,
    failedLockouts: ledger.commits.filter((c) => c.type === "failed-lockout").length,
    rosterSize: ledger.roster.length,
    scars: ledger.scars.length,
    precedents: ledger.precedents.length,
  };
}
