import { CANONICAL_STORY_FORMAT } from "../canonical-story/types.js";
import {
  BURN_PROTOCOL_EXTENSION_KEY,
  BURN_PROTOCOL_SOURCE_FORMAT,
  type BurnProtocolSource,
} from "./types.js";

const ZERO_SHA256 = "0".repeat(64);

/** Lightweight creator starter. It exercises the Burn grammar without
 * embedding any published Burn Protocol canon in downstream registries. */
export function newBurnProtocolSkeleton(): BurnProtocolSource {
  const receiptIds = {
    archive: "starter-archive",
    canonical: "starter-canonical-source",
    compiled: "starter-compiled-source",
  };
  return {
    format: BURN_PROTOCOL_SOURCE_FORMAT,
    identity: {
      id: "burn-starter",
      title: "Untitled Burn Story",
      description: "A fixed canonical story awaiting exact source custody.",
      author: "Creator",
      version: "0.1.0",
    },
    estate: {
      release: "0.1.0",
      archiveReceiptId: receiptIds.archive,
      canonicalSourceReceiptId: receiptIds.canonical,
      compiledSourceReceiptId: receiptIds.compiled,
      productionStanding: "source-ledger-only",
      missingRequiredReceiptIds: [receiptIds.archive, receiptIds.canonical, receiptIds.compiled],
      boundary: "Starter only. Replace placeholder receipts with exact creator custody before publication.",
    },
    canonicalStory: {
      format: CANONICAL_STORY_FORMAT,
      identity: { id: "burn-starter", title: "Untitled Burn Story", version: "0.1.0" },
      sourcePlane: { format: BURN_PROTOCOL_SOURCE_FORMAT, extensionKey: BURN_PROTOCOL_EXTENSION_KEY },
      authority: {
        pathPolicy: "canonical-fixed",
        choicePolicy: "none",
        textAuthority: "exact-source-required",
        assetAuthority: "external-manifest",
      },
      sourceReceipts: [
        { id: receiptIds.archive, path: "starter/archive.zip", bytes: 0, sha256: ZERO_SHA256, role: "archive", available: false },
        { id: receiptIds.canonical, path: "starter/canonical-source.pdf", bytes: 0, sha256: ZERO_SHA256, role: "canonical source", available: false },
        { id: receiptIds.compiled, path: "starter/compiled-source.txt", bytes: 0, sha256: ZERO_SHA256, role: "compiled source", available: false },
      ],
      episodes: [{
        id: "E99",
        number: 1,
        title: "Untitled Episode",
        complete: false,
        nextChapterId: "E99-C2",
        chapters: [{
          id: "E99-C1",
          number: 1,
          title: "Untitled Chapter",
          complete: false,
          openingPanelId: "E99-C1-P01",
          terminalPanelId: "E99-C1-P01",
          previousPanelId: null,
          nextPanelId: "E99-C1-P02",
          panels: [{
            id: "E99-C1-P01",
            ordinal: 1,
            chapterId: "E99-C1",
            previousPanelId: null,
            nextPanelId: "E99-C1-P02",
            asset: {
              status: "source-required",
              id: "starter-panel",
              path: "starter/panels/E99-C1-P01.png",
              mimeType: "image/png",
              availability: "manifested-external",
              visualStanding: "missing",
              expectedSourceReceiptIds: [receiptIds.canonical],
              reason: "Replace with the creator's exact manifested panel asset.",
            },
            text: {
              status: "source-required",
              expectedSourceReceiptIds: [receiptIds.canonical],
              reason: "Replace with exact canonical text from creator custody.",
            },
          }],
          plates: [],
        }],
      }],
    },
  };
}
