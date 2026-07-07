// The Expansion Archive's derivation: a pure join of the arc library (which
// expansions this engine can load) and the campaign ledger (which of them
// this guild has actually played), per docs/RFC_EXPANSION_ARCHIVE.md.
// Reads, never writes — the Archive renders this join and nothing it cannot
// back: no fabricated expansion metadata, no invented clear, no persisted
// summary the schema lacks.
import type { ArcLibraryEntry } from "./arc-library.js";
import type { CampaignLedger } from "./ledger.js";
import { cartridgeDigest } from "../../engine/cartridge-digest.js";

export interface ExpansionRow {
  arcId: string;
  name: string;
  digest: string;
  trust: string;
  source: string;
  status: "cleared" | "in-progress" | "unattempted";
  isActive: boolean;
  tiersPlayed: number;
  tiersCleared: number;
}

const STATUS_RANK: Record<ExpansionRow["status"], number> = {
  cleared: 0,
  "in-progress": 1,
  unattempted: 2,
};

/** Join the library against the ledger's recorded tiers, one row per library
 *  expansion. Pure — never mutates either input. Sort: cleared, then
 *  in-progress, then unattempted last; within a status, most tiers cleared
 *  first; ties broken by name codepoint order (never localeCompare). */
export function expansionRoster(
  library: ArcLibraryEntry[],
  ledger: CampaignLedger | null,
  activeArcId: string | null,
): ExpansionRow[] {
  const rows: ExpansionRow[] = library.map((entry) => {
    const digest = cartridgeDigest(entry.arc);
    const matched = ledger ? ledger.progress.tiers.filter((t) => t.cartridgeDigest === digest) : [];
    const tiersPlayed = matched.length;
    const tiersCleared = matched.filter((t) => t.cleared).length;
    const status: ExpansionRow["status"] =
      tiersPlayed === 0 ? "unattempted" : tiersCleared === tiersPlayed ? "cleared" : "in-progress";
    return {
      arcId: entry.arc.meta.id,
      name: entry.arc.meta.name,
      digest,
      trust: String(entry.trust),
      source: entry.source,
      status,
      isActive: entry.arc.meta.id === activeArcId,
      tiersPlayed,
      tiersCleared,
    };
  });

  return rows.sort((a, b) => {
    const rankDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rankDiff !== 0) return rankDiff;
    const clearedDiff = b.tiersCleared - a.tiersCleared;
    if (clearedDiff !== 0) return clearedDiff;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
}
