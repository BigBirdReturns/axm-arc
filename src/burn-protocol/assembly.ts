import type {
  CanonicalStoryChapter,
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
  nextChapterId: string | null;
  chapter: CanonicalStoryChapter;
  notes?: JsonValue;
}

/** Add one ordinary chapter to an existing Burn source. The final combined
 * source is revalidated through burn-protocol/1, so a chapter cannot bypass
 * receipt custody, panel-chain law, or the fixed no-choice story authority. */
export function appendBurnProtocolChapter(
  previous: BurnProtocolSource,
  amendment: BurnProtocolChapterAmendment,
): BurnProtocolSource {
  const source = structuredClone(previous);
  source.identity = structuredClone(amendment.identity);
  source.estate.missingRequiredReceiptIds = [
    ...amendment.missingRequiredReceiptIds,
  ];
  source.estate.boundary = amendment.boundary;
  source.canonicalStory.identity.version = amendment.storyVersion;

  const receiptIds = new Set(
    source.canonicalStory.sourceReceipts.map((receipt) => receipt.id),
  );
  for (const receipt of amendment.sourceReceipts) {
    if (receiptIds.has(receipt.id)) {
      throw new Error(`Burn chapter amendment duplicates source receipt "${receipt.id}".`);
    }
    receiptIds.add(receipt.id);
    source.canonicalStory.sourceReceipts.push(structuredClone(receipt));
  }

  const episode = source.canonicalStory.episodes.find(
    (candidate) => candidate.id === amendment.episodeId,
  );
  if (!episode) {
    throw new Error(`Burn chapter amendment targets unknown episode "${amendment.episodeId}".`);
  }
  if (episode.chapters.some((chapter) => chapter.id === amendment.chapter.id)) {
    throw new Error(`Burn chapter amendment duplicates chapter "${amendment.chapter.id}".`);
  }

  episode.chapters.push(structuredClone(amendment.chapter));
  episode.nextChapterId = amendment.nextChapterId;
  source.notes = amendment.notes === undefined
    ? source.notes
    : structuredClone(amendment.notes);

  return parseBurnProtocol(source);
}
