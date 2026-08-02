import type {
  CanonicalStoryChapter,
  CanonicalStoryEpisode,
  CanonicalStorySourceReceipt,
} from "../canonical-story/types.js";
import type { JsonValue } from "../engine/types.js";
import { parseBurnProtocol } from "./schema.js";
import type {
  BurnProtocolIdentity,
  BurnProtocolSource,
} from "./types.js";

export interface BurnProtocolChapterAmendment {
  identity: BurnProtocolIdentity;
  storyVersion: string;
  sourceReceipts: CanonicalStorySourceReceipt[];
  missingRequiredReceiptIds: string[];
  boundary: string;
  episodeId: string;
  episodeComplete?: boolean;
  nextChapterId: string | null;
  chapter: CanonicalStoryChapter;
  notes?: JsonValue;
}

export interface BurnProtocolEpisodeAmendment {
  identity: BurnProtocolIdentity;
  storyVersion: string;
  sourceReceipts: CanonicalStorySourceReceipt[];
  canonicalSourceReceiptIds: string[];
  compiledSourceReceiptIds: string[];
  missingRequiredReceiptIds: string[];
  boundary: string;
  episode: CanonicalStoryEpisode;
  notes?: JsonValue;
}

function appendReceipts(
  source: BurnProtocolSource,
  receipts: readonly CanonicalStorySourceReceipt[],
  amendmentKind: "chapter" | "episode",
): void {
  const receiptIds = new Set(
    source.canonicalStory.sourceReceipts.map((receipt) => receipt.id),
  );
  for (const receipt of receipts) {
    if (receiptIds.has(receipt.id)) {
      throw new Error(
        `Burn ${amendmentKind} amendment duplicates source receipt "${receipt.id}".`,
      );
    }
    receiptIds.add(receipt.id);
    source.canonicalStory.sourceReceipts.push(structuredClone(receipt));
  }
}

function applySharedAmendment(
  source: BurnProtocolSource,
  amendment: Pick<
    BurnProtocolChapterAmendment,
    | "identity"
    | "storyVersion"
    | "missingRequiredReceiptIds"
    | "boundary"
    | "notes"
  >,
): void {
  source.identity = structuredClone(amendment.identity);
  source.estate.missingRequiredReceiptIds = [
    ...amendment.missingRequiredReceiptIds,
  ];
  source.estate.boundary = amendment.boundary;
  source.canonicalStory.identity.version = amendment.storyVersion;
  source.notes = amendment.notes === undefined
    ? source.notes
    : structuredClone(amendment.notes);
}

/** Add one ordinary chapter to an existing Burn source. The final combined
 * source is revalidated through burn-protocol/1, so a chapter cannot bypass
 * receipt custody, panel-chain law, or the fixed no-choice story authority. */
export function appendBurnProtocolChapter(
  previous: BurnProtocolSource,
  amendment: BurnProtocolChapterAmendment,
): BurnProtocolSource {
  const source = structuredClone(previous);
  applySharedAmendment(source, amendment);
  appendReceipts(source, amendment.sourceReceipts, "chapter");

  const episode = source.canonicalStory.episodes.find(
    (candidate) => candidate.id === amendment.episodeId,
  );
  if (!episode) {
    throw new Error(
      `Burn chapter amendment targets unknown episode "${amendment.episodeId}".`,
    );
  }
  if (episode.chapters.some((chapter) => chapter.id === amendment.chapter.id)) {
    throw new Error(
      `Burn chapter amendment duplicates chapter "${amendment.chapter.id}".`,
    );
  }

  episode.chapters.push(structuredClone(amendment.chapter));
  episode.complete = amendment.episodeComplete ?? episode.complete;
  episode.nextChapterId = amendment.nextChapterId;

  return parseBurnProtocol(source);
}

/** Add one complete ordinary episode to the continuing Burn source. This is the
 * series-scale equivalent of appending a chapter: it extends receipt custody,
 * preserves the prior terminal-to-opening seam, and revalidates the complete
 * cartridge before it can acquire Arc identity. */
export function appendBurnProtocolEpisode(
  previous: BurnProtocolSource,
  amendment: BurnProtocolEpisodeAmendment,
): BurnProtocolSource {
  const source = structuredClone(previous);
  applySharedAmendment(source, amendment);
  appendReceipts(source, amendment.sourceReceipts, "episode");

  if (source.canonicalStory.episodes.some(
    (episode) => episode.id === amendment.episode.id,
  )) {
    throw new Error(
      `Burn episode amendment duplicates episode "${amendment.episode.id}".`,
    );
  }

  source.canonicalStory.episodes.push(structuredClone(amendment.episode));
  source.estate.canonicalSourceReceiptIds = [
    ...amendment.canonicalSourceReceiptIds,
  ];
  source.estate.compiledSourceReceiptIds = [
    ...amendment.compiledSourceReceiptIds,
  ];

  return parseBurnProtocol(source);
}
