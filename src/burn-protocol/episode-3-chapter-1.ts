import type {
  CanonicalStoryChapter,
  CanonicalStoryEpisode,
  CanonicalStorySourceReceipt,
} from "../canonical-story/types.js";
import { appendBurnProtocolEpisode } from "./assembly.js";
import { BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE } from "./episode-2.js";

interface AssetRow {
  number: number;
  bytes: number;
  sha256: string;
}

interface PlateRow {
  ordinal: number;
  bytes: number;
  sha256: string;
}

const EPISODE_3_CHAPTER_1_RECEIPTS: CanonicalStorySourceReceipt[] = [
  {
    id: "episode-03-source",
    path: "source/episodes/episode-03.json",
    bytes: 107884,
    sha256: "5960f8f6849a5c03d28f286fdca49259056fc18a07f85a4a1b2a69a79e903998",
    role: "canonical-story-source",
    available: false,
  },
  {
    id: "episode-03-script",
    path: "scripts/episode-03-the-omega-thread.md",
    bytes: 73375,
    sha256: "633fcaa5a1ff302e0aefbeeaf3afb4b4d5f64dc9574df9997bc35db2d0530d44",
    role: "canonical-script-render",
    available: false,
  },
];

const PANELS: AssetRow[] = [
  { number: 1, bytes: 174158, sha256: "77fc8652214c06c5f6c6e9cb00193185f823db8d090331012a469e698160d7ac" },
  { number: 2, bytes: 121290, sha256: "7aa465b63670041ca351be938d1ee64010bd2b34c3f090ce8eca6271eff26b95" },
  { number: 3, bytes: 134768, sha256: "8209c5eac85f92e001518ca74193509deb6b04ef754a0a8fe24d0fae60144bfc" },
  { number: 4, bytes: 112064, sha256: "3c3f4be45907a0c4185f4708ca3c4804d8b7545db21494add76227d1be220721" },
  { number: 5, bytes: 71842, sha256: "5b6c846c71ea1ae8886128982e004ea861ad626b372b42ef8a4846625335c2e7" },
  { number: 6, bytes: 188942, sha256: "427c3998509811bdf2859015ff141fef1c7d6dde472f4e1110fa6557a38eff83" },
  { number: 7, bytes: 147814, sha256: "1590337f55016023de132a3d71146e8ebd65898ac83554b6ccd3b9b2841635f7" },
  { number: 8, bytes: 129944, sha256: "d152fe1220cc656119b32193239f0caa40bb6530cd6f99faac7d267e5dd96b61" },
  { number: 9, bytes: 126632, sha256: "c3426f013c877566676fb3f1613a646e24cd9807dd47dcba26f72cb850c4cfca" },
  { number: 10, bytes: 129636, sha256: "dea9ec1b2456d9bebc38b6aa5fc639043be7d53ae15363e1d035ce495db0bc39" },
  { number: 11, bytes: 192230, sha256: "ac54d5255c6b4610342e51b73cfedac8a8a486e88d9cd4784619ffcc42642ce2" },
  { number: 12, bytes: 138786, sha256: "286ffcc243db14a502bc4be6a28a37398abd8a07232db9373a795e307fe0962f" },
  { number: 13, bytes: 145248, sha256: "84f1e5be6713039df8659a776ff902d03c196eb9397f5d15f0fc5354c0ea217d" },
  { number: 14, bytes: 136662, sha256: "964df1a4a0d6eaf46ddd5062fd1cfe6de2b283cf03a16b4bb30e832de966b946" },
  { number: 15, bytes: 159322, sha256: "71a1db91a9dd54c2ff2234b1b4b4a1d4fd8c6c15abebc9ef9435c55f0732c67f" },
  { number: 16, bytes: 164198, sha256: "89e8b914ae6aca0dccba776526fe2dca545d5bad725027d945c682febecf3f30" },
  { number: 17, bytes: 147566, sha256: "192b74ddafb7dd1fc6d3b7eee792f66e600ac91dfe8078e88fa6a6a892455383" },
  { number: 18, bytes: 134444, sha256: "de2306b3eaaaebe4d5bd8b11b8ecd1c8d8490f359959811d655f4cd1d2e108c3" },
  { number: 19, bytes: 158398, sha256: "1bb3eef7ecbe719856ff246db301ac2a3597a84339445010c411900662844305" },
  { number: 20, bytes: 126060, sha256: "f1f4ad0e80b4235b4793a559a0822246e12bf565c627cef46d3564ea3b6599d3" },
];

const PLATES: PlateRow[] = [
  { ordinal: 1, bytes: 543238, sha256: "8b873d0d3ec6951cacc318cdb270ef8010a572f0d3dbbbf9a4beccdc5c01d5c0" },
  { ordinal: 2, bytes: 630502, sha256: "c9e162e3816a567734b23dc121a201e6947d4954d5a5f25e8302308d2603007f" },
  { ordinal: 3, bytes: 632808, sha256: "e17b782aa1435803ef2e31a55bb2432a3ddee78b6be0fe16da9b8efc5fd3b9fb" },
  { ordinal: 4, bytes: 631940, sha256: "8fcfc3b0027472219993fea2956f48847b9821aa3b45bde5f7a7bd66ae146d94" },
];

export const BURN_PROTOCOL_EPISODE_3_CHAPTER_1: CanonicalStoryChapter = {
  id: "E03-C1",
  number: 1,
  title: "Headquarters",
  complete: true,
  openingPanelId: "E03-C1-P01",
  terminalPanelId: "E03-C1-P20",
  previousPanelId: "E02-C3-P60",
  nextPanelId: "E03-C2-P21",
  panels: PANELS.map((row, index) => {
    const panelId = `E03-C1-P${String(row.number).padStart(2, "0")}`;
    return {
      id: panelId,
      ordinal: index + 1,
      chapterId: "E03-C1",
      previousPanelId: row.number === 1
        ? "E02-C3-P60"
        : `E03-C1-P${String(row.number - 1).padStart(2, "0")}`,
      nextPanelId: row.number === 20
        ? "E03-C2-P21"
        : `E03-C1-P${String(row.number + 1).padStart(2, "0")}`,
      asset: {
        id: `asset:${panelId}`,
        path: `site/assets/art/A03C1/panels/${panelId}.webp`,
        bytes: row.bytes,
        sha256: row.sha256,
        mimeType: "image/webp" as const,
        availability: "manifested-external" as const,
        visualStanding: "q02-review-required" as const,
      },
      text: {
        status: "source-required" as const,
        expectedSourceReceiptIds: [
          "episode-03-source",
          "q01-dialogue-parity",
        ],
        reason: "The exact Episode 3 source bytes are not present in this repository. Canonical captions, dialogue, sound effects, and alt text cannot be reconstructed from derivative ledgers.",
      },
    };
  }),
  plates: PLATES.map((row) => {
    const plateId = `A03C1-plate-${String(row.ordinal).padStart(2, "0")}`;
    return {
      id: plateId,
      ordinal: row.ordinal,
      chapterId: "E03-C1",
      asset: {
        id: `asset:${plateId}`,
        path: `site/assets/art/A03C1/plates/${plateId}.webp`,
        bytes: row.bytes,
        sha256: row.sha256,
        mimeType: "image/webp" as const,
        availability: "manifested-external" as const,
        visualStanding: "q02-review-required" as const,
      },
      panelMapping: {
        status: "source-required" as const,
        expectedSourceReceiptIds: ["estate-archive-v062"],
        reason: "The exact A03C1 scroll-plate composition map is not available in the active source estate. Plate-to-panel ranges cannot be inferred from asset order.",
      },
    };
  }),
};

export const BURN_PROTOCOL_EPISODE_3_THROUGH_CHAPTER_1: CanonicalStoryEpisode = {
  id: "E03",
  number: 3,
  title: "The Omega Thread",
  complete: false,
  nextChapterId: "E03-C2",
  chapters: [BURN_PROTOCOL_EPISODE_3_CHAPTER_1],
};

export const BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_1_SOURCE = appendBurnProtocolEpisode(
  BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE,
  {
    identity: {
      id: "burn-protocol",
      title: "The Burn Protocol through Episode 3, Chapter 1 — Headquarters",
      description: "The corpus-native Burn cartridge through Episode 3, Chapter 1, represented as one hundred forty ordered panel slots and the exact currently recovered scroll-plate asset ledger without simulation or invented branching.",
      author: "The Burn Project",
      version: "0.5.0",
    },
    storyVersion: "0.5.0",
    sourceReceipts: EPISODE_3_CHAPTER_1_RECEIPTS,
    canonicalSourceReceiptIds: [
      "episode-01-source",
      "episode-02-source",
      "episode-03-source",
    ],
    compiledSourceReceiptIds: [
      "episode-01-compiled",
      "episode-02-compiled",
    ],
    missingRequiredReceiptIds: [
      ...BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE.estate.missingRequiredReceiptIds,
      "episode-03-source",
    ],
    boundary: "Panel order, both completed prior episodes, the E02-to-E03 seam, Episode 3 Chapter 1, and manifested custody for all twenty A03C1 panels and four A03C1 plates are explicit through E03-C1-P20. The exact Episode 3 compiled reader receipt, canonical text, and plate mappings remain blocked until their source bytes are supplied.",
    episode: BURN_PROTOCOL_EPISODE_3_THROUGH_CHAPTER_1,
    notes: {
      implementationPurpose: "Append Episode 3 Chapter 1 as ordinary episode and chapter data under the same Burn source plane and fixed canonical-story authority.",
      noSimulation: true,
      noChoices: true,
      stableSeriesIdentity: "burn-protocol",
      episodeBoundary: "E02-C3-P60 -> E03-C1-P01",
      nextCanonicalPanelId: "E03-C2-P21",
      sourceLedgerGaps: [
        {
          id: "episode-03-compiled",
          path: "site/data/episode-03.json",
          reason: "The active evidence established the path but did not expose an exact byte count and SHA-256 receipt. No placeholder receipt has been invented.",
        },
      ],
    },
  },
);
