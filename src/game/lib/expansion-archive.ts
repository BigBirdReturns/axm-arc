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
  inLibrary: boolean;
  artifactMissing: boolean;
}

const STATUS_RANK: Record<ExpansionRow["status"], number> = {
  cleared: 0,
  "in-progress": 1,
  unattempted: 2,
};

/** Join the library against the ledger's recorded tiers, one row per library
 *  expansion, UNIONED (PR 044) with any ledger-recorded digest that has no
 *  library counterpart — an "artifact-missing" row surfacing history for a
 *  cartridge the guild played but no longer (or not yet) holds in the
 *  library. A digest present in both sources renders exactly once, as its
 *  library row — the union is derived on every read, so importing the
 *  cartridge later simply makes its digest match a library row and the
 *  artifact-missing row disappears on the next render. Pure — never mutates
 *  either input. Sort: cleared, then in-progress, then unattempted last;
 *  within a status, most tiers cleared first; ties broken by name codepoint
 *  order (never localeCompare) — artifact-missing rows are not special-cased
 *  in the sort. */
export function expansionRoster(
  library: ArcLibraryEntry[],
  ledger: CampaignLedger | null,
  activeArcId: string | null,
): ExpansionRow[] {
  const libraryRows: ExpansionRow[] = library.map((entry) => {
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
      inLibrary: true,
      artifactMissing: false,
    };
  });

  const libraryDigests = new Set(libraryRows.map((r) => r.digest));

  const ledgerDigests = ledger
    ? new Set([
        ...ledger.progress.tiers.map((t) => t.cartridgeDigest),
        ...ledger.commits.map((c) => c.cartridgeDigest),
      ])
    : new Set<string>();

  const artifactMissingRows: ExpansionRow[] = ledger
    ? [...ledgerDigests]
        .filter((digest) => !libraryDigests.has(digest))
        .map((digest) => {
          const matched = ledger.progress.tiers.filter((t) => t.cartridgeDigest === digest);
          const tiersPlayed = matched.length;
          const tiersCleared = matched.filter((t) => t.cleared).length;
          const status: ExpansionRow["status"] =
            tiersPlayed === 0 ? "unattempted" : tiersCleared === tiersPlayed ? "cleared" : "in-progress";
          const cartridgeId =
            ledger.progress.tiers.find((t) => t.cartridgeDigest === digest)?.cartridgeId ??
            ledger.commits.find((c) => c.cartridgeDigest === digest)?.cartridgeId ??
            digest;
          return {
            arcId: cartridgeId,
            name: cartridgeId,
            digest,
            trust: "",
            source: "ledger",
            status,
            isActive: false,
            tiersPlayed,
            tiersCleared,
            inLibrary: false,
            artifactMissing: true,
          };
        })
    : [];

  return [...libraryRows, ...artifactMissingRows].sort((a, b) => {
    const rankDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rankDiff !== 0) return rankDiff;
    const clearedDiff = b.tiersCleared - a.tiersCleared;
    if (clearedDiff !== 0) return clearedDiff;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
}

// ── per-expansion campaign record (PR 043) ───────────────────────────────────
// The record that came out of playing one expansion — every fact attributable
// to it by cartridge digest, and nothing else. A pure join of the ledger's
// tiers/commits/scars against a single digest; no cross-cartridge fabrication.

/** One tier this expansion's ledger recorded — in ledger order (tier order is
 *  meaningful; never re-sorted). */
export interface TierLine {
  tierLabel: string;
  cleared: boolean;
  grade: string | null;
  pulls: number;
  wipes: number;
  bestPull: number | null;
}

/** A scar this expansion's boss left on the guild. */
export interface ScarLine { name: string; note: string; modifier: number }

/** A legend citation earned during this expansion — verbatim, never t(). */
export interface LegendLine { agentId: string; citation: string }

/** A precedent this expansion's nights set. */
export interface PrecedentLine { type: string; decisionBasis: string; winner: string | null }

/** The full campaign record for one expansion, joined by cartridge digest.
 *  Everything here is attributable to `digest` — no cross-cartridge data. */
export interface ExpansionRecord {
  digest: string;
  tiers: TierLine[];
  totalPulls: number;
  totalWipes: number;
  victories: number;
  failedLockouts: number;
  scars: ScarLine[];
  legends: LegendLine[];
  precedents: PrecedentLine[];
  lastCommitSeq: number | null;
}

/** Derive one expansion's campaign record from the ledger, by cartridge
 *  digest. Pure — never mutates the ledger. A null ledger or a digest with no
 *  match is an honest empty record (the passed digest, zero counts, empty
 *  arrays) — never a fabricated one. */
export function expansionRecord(digest: string, ledger: CampaignLedger | null): ExpansionRecord {
  if (!ledger) {
    return { digest, tiers: [], totalPulls: 0, totalWipes: 0, victories: 0, failedLockouts: 0, scars: [], legends: [], precedents: [], lastCommitSeq: null };
  }

  const tiers: TierLine[] = ledger.progress.tiers
    .filter((t) => t.cartridgeDigest === digest)
    .map((t) => ({ tierLabel: t.tierLabel, cleared: t.cleared, grade: t.grade, pulls: t.pulls, wipes: t.wipes, bestPull: t.bestPull }));

  const commits = ledger.commits.filter((c) => c.cartridgeDigest === digest);
  const totalPulls = commits.reduce((sum, c) => sum + c.pulls, 0);
  const totalWipes = commits.reduce((sum, c) => sum + c.wipes, 0);
  const victories = commits.filter((c) => c.type === "victory").length;
  const failedLockouts = commits.filter((c) => c.type === "failed-lockout").length;
  const legends: LegendLine[] = commits.flatMap((c) => c.consequences.legends);
  const precedents: PrecedentLine[] = commits.flatMap((c) =>
    c.consequences.precedentsSet.map((p) => ({ type: p.type, decisionBasis: p.decisionBasis, winner: p.winner })),
  );

  const scars: ScarLine[] = ledger.scars
    .filter((s) => s.sourceBossRef.cartridgeDigest === digest)
    .map((s) => ({ name: s.name, note: s.effect.note, modifier: s.effect.modifier }));

  const lastCommitSeq = commits.length ? Math.max(...commits.map((c) => c.commitSeq)) : null;

  return { digest, tiers, totalPulls, totalWipes, victories, failedLockouts, scars, legends, precedents, lastCommitSeq };
}

// ── journey timeline (PR 045) ─────────────────────────────────────────────────
// The cross-expansion chronology — every recorded night, in the order the
// ledger recorded it, regardless of which cartridge it belongs to. Distinct
// from expansionRecord (grouped by cartridge digest): this is the guild's
// campaign as it was actually lived, night by night.

/** One recorded night, in ledger (commitSeq-ascending) order. */
export interface JourneyEntry {
  commitSeq: number;
  cartridgeId: string;
  digest: string;
  type: "victory" | "failed-lockout";
  cleared: boolean;
  grade: string | null;
  pulls: number;
  wipes: number;
}

/** Derive the guild's journey timeline from the ledger's append-only commit
 *  log. Pure — never mutates the ledger, never re-sorts (the ledger's stored
 *  order IS the recorded chronology). A null ledger is an honest empty
 *  journey. */
export function journeyTimeline(ledger: CampaignLedger | null): JourneyEntry[] {
  if (!ledger) return [];
  return ledger.commits.map((c) => ({
    commitSeq: c.commitSeq,
    cartridgeId: c.cartridgeId,
    digest: c.cartridgeDigest,
    type: c.type,
    cleared: c.consequences.clearedTier,
    grade: c.type === "victory" ? c.grade : null,
    pulls: c.pulls,
    wipes: c.wipes,
  }));
}
