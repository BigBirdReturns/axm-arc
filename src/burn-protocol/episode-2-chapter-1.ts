import type {
  CanonicalStoryChapter,
  CanonicalStoryEpisode,
  CanonicalStorySourceReceipt,
} from "../canonical-story/types.js";
import { appendBurnProtocolEpisode } from "./assembly.js";
import { BURN_PROTOCOL_EPISODE_1_SOURCE } from "./chapter-3.js";

interface PanelRow {
  number: number;
  bytes: number;
  sha256: string;
}

const EPISODE_2_CHAPTER_1_RECEIPTS: CanonicalStorySourceReceipt[] = [
  {
    id: "episode-02-source",
    path: "source/episodes/episode-02.json",
    bytes: 85198,
    sha256: "dbf114eb62e1e20b9d88034a7bcbf27c1ee055841141bc96dd73048687c155cb",
    role: "canonical-story-source",
    available: false,
  },
  {
    id: "episode-02-compiled",
    path: "site/data/episode-02.json",
    bytes: 105605,
    sha256: "a3ad82a545032668d58830563c330582b8130720a363abfbfcdb9596f551c67e",
    role: "compiled-reader-source",
    available: false,
  },
  {
    id: "a02c1-lettering",
    path: "manifests/a02c1-lettering.json",
    bytes: 21161,
    sha256: "0823437970dcf437f82ab376e7525f002af5e202281975b3995e58901a56db79",
    role: "canonical-lettering",
    available: false,
  },
  {
    id: "a02c1-scroll-plates",
    path: "manifests/a02c1-scroll-plates.json",
    bytes: 1521,
    sha256: "7ea379f40afddfb1c690096233df438b2042c3e5200594073d45b03e06ae0c04",
    role: "plate-composition-map",
    available: false,
  },
  {
    id: "a02c1-art-audit",
    path: "manifests/a02c1-art-audit.json",
    bytes: 45084,
    sha256: "026088151267cfe5806ba71db31200d8a5c74c75affaf4b0d7941eb7124bc14c",
    role: "chapter-art-audit",
    available: false,
  },
  {
    id: "a02c1-art-manifest",
    path: "manifests/a02c1-art-manifest.csv",
    bytes: 3940,
    sha256: "79e243efffb6ac91606ecc4c45269c704c81ba5a747b6392de380104958a75df",
    role: "chapter-art-manifest",
    available: false,
  },
];

const PANELS: PanelRow[] = [
  { number: 1, bytes: 126004, sha256: "f3327774a0461fd2f43fffd1107d772bcb26bd1716af1b4a4353fdd55258a086" },
  { number: 2, bytes: 75822, sha256: "65e7888e13e2aabfc391c4dd6f6caa4b3d16741226893ffb3d384c6946858670" },
  { number: 3, bytes: 77634, sha256: "9aeadd1bc58874710a3bd54bd96a40e2601b396db6f5f865a04cb468e6d63d78" },
  { number: 4, bytes: 112246, sha256: "2e9c6e5358dba53e213f092845c4aa6ea01c7837bcf027e82f3f92a922c1aaa7" },
  { number: 5, bytes: 90856, sha256: "4f68ced25181e47aa1be52a6e299ba3fbea06e39a114547de5a00732856adfd6" },
  { number: 6, bytes: 70016, sha256: "9e1021ccd9da998b7107afacafd303b5594405baf6c4ef98482aa0c565dbd030" },
  { number: 7, bytes: 99284, sha256: "cd790cab56f7274edf46380c522cebb4c9472115a170bd929954c9bc2b5c3ce3" },
  { number: 8, bytes: 84360, sha256: "b6ccb5cc849ab425792168ed47a604acb4d5a5131eb1c81eef677339625d7fef" },
  { number: 9, bytes: 73494, sha256: "160c8d3cb539bc3a0210d6770968a16b5b7498c1c331c339b12634ddf64b1444" },
  { number: 10, bytes: 88664, sha256: "2424405b810612d2c6b2d289ef4ef932e8600437036cb076adf846f6c312a8fb" },
  { number: 11, bytes: 89508, sha256: "3b3ecd6f35c4a9865a102cdbab0fbc40f84f0270f399d2e03b1e0b7ef0960a32" },
  { number: 12, bytes: 87916, sha256: "636aa95f65cc9e25e8a42968dc8b5f792a43b0166f9b7ad72c59f9a8c1c4c7e0" },
  { number: 13, bytes: 88620, sha256: "70bb0317fa166e050df3f5c9c43c57569f95054d9652532878198fe171362f92" },
  { number: 14, bytes: 89882, sha256: "e3208efa73e56741b249e14d7752defc4f3633f2f34054990230763bc2e83706" },
  { number: 15, bytes: 73886, sha256: "69bdac193e393237ce5339ad53d6f54ec19afed4908a354448d209425e2fdd65" },
  { number: 16, bytes: 86406, sha256: "b4610efc698cd314c16a592c6cd9e2ef724823fee4752ef0281323f8be90c907" },
  { number: 17, bytes: 83000, sha256: "db88d2a4e08719742152bd379e4fcf5aaae3f221bc37937c8715e1d44a069c40" },
  { number: 18, bytes: 81494, sha256: "6e9593f0d3ecc2d40c93217cb1f85830fa438d450a3eb1cb157e70e512af4f3b" },
  { number: 19, bytes: 79346, sha256: "ff733b94da2730df8bc56c6d4ab85e440b7679c671201280e12ad08003e3f2c6" },
  { number: 20, bytes: 91158, sha256: "fbc06d81c06c354748cd2ad9a38770b257477f578f569c01f1527fbbc8934a8c" },
];

const PLATES = [
  { ordinal: 1, bytes: 345772, sha256: "bdfebd3332059610d1c12c02505c82194ed03910a0cd73fc2d5641bb6aae5bfe" },
  { ordinal: 2, bytes: 315546, sha256: "07820ebfcd575174ba176ffbeef88f89f579d5928ae640f6a1a2d01d70420090" },
  { ordinal: 3, bytes: 331620, sha256: "9e688808f1f0424ac31e45e0249ab87bd5797a12395a050395238e229a08a7a5" },
  { ordinal: 4, bytes: 325786, sha256: "4557c376f781f38b98f3f044caa529e9214bb0ea3749a0ae6afddd25aa935c3d" },
];

export const BURN_PROTOCOL_EPISODE_2_CHAPTER_1: CanonicalStoryChapter = {
  id: "E02-C1",
  number: 1,
  title: "Reunion",
  complete: true,
  openingPanelId: "E02-C1-P01",
  terminalPanelId: "E02-C1-P20",
  previousPanelId: "E01-C3-P60",
  nextPanelId: "E02-C2-P21",
  panels: PANELS.map((row, index) => {
    const panelId = `E02-C1-P${String(row.number).padStart(2, "0")}`;
    return {
      id: panelId,
      ordinal: index + 1,
      chapterId: "E02-C1",
      previousPanelId: row.number === 1
        ? "E01-C3-P60"
        : `E02-C1-P${String(row.number - 1).padStart(2, "0")}`,
      nextPanelId: row.number === 20
        ? "E02-C2-P21"
        : `E02-C1-P${String(row.number + 1).padStart(2, "0")}`,
      asset: {
        id: `asset:${panelId}`,
        path: `site/assets/art/A02C1/panels/${panelId}.webp`,
        bytes: row.bytes,
        sha256: row.sha256,
        mimeType: "image/webp" as const,
        availability: "manifested-external" as const,
        visualStanding: "q02-review-required" as const,
      },
      text: {
        status: "source-required" as const,
        expectedSourceReceiptIds: [
          "episode-02-source",
          "episode-02-compiled",
          "a02c1-lettering",
          "q01-dialogue-parity",
        ],
        reason: "The exact Episode 2 and A02C1 lettering bytes are not present in this repository. Canonical captions, dialogue, sound effects, and alt text cannot be reconstructed from derivative ledgers.",
      },
    };
  }),
  plates: PLATES.map((row) => {
    const plateId = `A02C1-plate-${String(row.ordinal).padStart(2, "0")}`;
    return {
      id: plateId,
      ordinal: row.ordinal,
      chapterId: "E02-C1",
      asset: {
        id: `asset:${plateId}`,
/${panelId}.webp`,
        bytes: row.bytes,
        sha256: row.sha256,
        mimeType: "image/webp" as const,
        availability: "manifested-external" as const,
        visualStanding: "q02-review-required" as const,
      },
      text: {
        status: "source-required" as const,
        expectedSourceReceiptIds: [
          "episode-02-source",
          "episode-02-compiled",
          "a02c1-lettering",
          "q01-dialogue-parity",
        ],
        reason: "The exact Episode 2 and A02C1 lettering bytes are not present in this repository. Canonical captions, dialogue, sound effects, and alt text cannot be reconstructed from derivative ledgers.",
      },
    };
  }),
  plates: PLATES.map((row) => {
    const plateId = `A02C1-plate-${String(row.ordinal).padStart(2, "0")}`;
    return {
      id: plateId,
      ordinal: row.ordinal,
      chapterId: "E02-C1",
      asset: {
        id: `asset:${plateId}`,
        path: `site/assets/art/A02C1/plates/${plateId}.webp`,
        bytes: row.bytes,
        sha256: row.sha256,
        mimeType: "image/webp" as const,
        availability: "manifested-external" as const,
        visualStanding: "q02-review-required" as const,
      },
      panelMapping: {
        status: "source-required" as const,
        expectedSourceReceiptIds: ["a02c1-scroll-plates"],
        reason: "The exact A02C1 scroll-plate composition map is not present. Plate-to-panel ranges cannot be inferred from asset order.",
      },
    };
  }),
};

export const BURN_PROTOCOL_EPISODE_2_THROUGH_CHAPTER_1: CanonicalStoryEpisode = {
  id: "E02",
  number: 2,
  title: "Ghosts of Then",
  complete: false,
  nextChapterId: "E02-C2",
  chapters: [BURN_PROTOCOL_EPISODE_2_CHAPTER_1],
};

export const BURN_PROTOCOL_THROUGH_EPISODE_2_CHAPTER_1_SOURCE = appendBurnProtocolEpisode(
  BURN_PROTOCOL_EPISODE_1_SOURCE,
  {
    identity: {
      id: "burn-protocol",
      title: "The Burn Protocol through Episode 2, Chapter 1 — Reunion",
      description: "The corpus-native Burn cartridge through Episode 2, Chapter 1, represented as eighty ordered panel slots and sixteen scroll-plate assets without simulation or invented branching.",
      author: "The Burn Project",
      version: "0.4.0",
    },
    storyVersion: "0.4.0",
    sourceReceipts: EPISODE_2_CHAPTER_1_RECEIPTS,
    missingRequiredReceiptIds: [
      "estate-archive-v062",
      "episode-01-source",
      "episode-01-compiled",
      "a01c1-lettering",
      "a01c1-scroll-plates",
      "a01c2-lettering",
      "a01c2-scroll-plates",
      "a01c3-lettering",
      "a01c3-scroll-plates",
      "episode-02-source",
      "episode-02-compiled",
      "a02c1-lettering",
      "a02c1-scroll-plates",
    ],
    boundary: "Panel order, the complete Episode 1 path, the E01-to-E02 seam, Episode 2 Chapter 1, and asset custody are explicit through E02-C1-P20. Exact canonical captions, dialogue, sound effects, alt text, and plate-to-panel mappings remain blocked until the source bytes named by the receipts are supplied.",
    episode: BURN_PROTOCOL_EPISODE_2_THROUGH_CHAPTER_1,
    notes: {
      implementationPurpose: "Append the first chapter of Episode 2 as ordinary episode and chapter data, proving that the same Arc authority crosses the series seam without a new cartridge or reader abstraction.",
      noSimulation: true,
      noChoices: true,
      stableSeriesIdentity: "burn-protocol",
      episodeBoundary: "E01-C3-P60 -> E02-C1-P01",
      nextCanonicalPanelId: "E02-C2-P21",
    },
  },
);
