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
