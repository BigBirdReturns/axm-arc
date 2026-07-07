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
