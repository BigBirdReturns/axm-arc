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

interface BurnProtocolAmendmentBase {
  identity: BurnProtocolIdentity;
  storyVersion: string;
  sourceReceipts: CanonicalStorySourceReceipt[];
  missingRequiredReceiptIds: string[];
  boundary: string;
  notes?: JsonValue;
}

export interface BurnProtocolChapterAmendment extends BurnProtocolAmendmentBase {
  episodeId: string;
  episodeComplete?: boolean;
  nextChapterId: string | null;
  chapter: CanonicalStoryChapter;
}

export interface BurnProtocolEpisodeAmendment extends BurnProtocolAmendmentBase {
  episode: CanonicalStoryEpisode;
}

function applyCommonAmendment(
  previous: BurnProtocolSource,
  amendment: BurnProtocolAmendmentBase,
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
      throw new Error(`Burn amendment duplicates source receipt "${receipt.id}".`);
    }
    receiptIds.add(receipt.id);
    source.canonicalStory.sourceReceipts.push(structuredClone(receipt));
  }

  source.notes = amendment.notes === undefined
    ? source.notes
    : structuredClone(amendment.notes);
  return source;
}

/** Add one ordinary chapter to an existing Burn source. The final combined
 * source is revalidated through burn-protocol/1, so a chapter cannot bypass
 * receipt custody, panel-chain law, or the fixed no-choice story authority. */
export function appendBurnProtocolChapter(
  previous: BurnProtocolSource,
  amendment: BurnProtocolChapterAmendment,
): BurnProtocolSource {
  const source = applyCommonAmendment(previous, amendment);
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
  episode.complete = amendment.episodeComplete ?? episode.complete;
  episode.nextChapterId = amendment.nextChapterId;
  return parseBurnProtocol(source);
}

/** Add one ordinary episode to the same Burn source and cartridge identity.
 * The accepted source is revalidated after assembly, so the new episode must
 * satisfy global ordering, cross-episode continuity, receipt custody, panel
 * identity, and fixed no-choice authority before it can compile into an Arc. */
export function appendBurnProtocolEpisode(
  previous: BurnProtocolSource,
  amendment: BurnProtocolEpisodeAmendment,
): BurnProtocolSource {
  const source = applyCommonAmendment(previous, amendment);
  if (source.canonicalStory.episodes.some(
    (episode) => episode.id === amendment.episode.id,
  )) {
    throw new Error(`Burn episode amendment duplicates episode "${amendment.episode.id}".`);
  }
  source.canonicalStory.episodes.push(structuredClone(amendment.episode));
  return parseBurnProtocol(source);
}
