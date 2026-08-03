import type {
  CanonicalStoryChapter,
  CanonicalStorySourceReceipt,
} from "../canonical-story/types.js";
import { appendBurnProtocolChapter } from "./assembly.js";
import { BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_1_SOURCE } from "./episode-4-chapter-1.js";

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

const EPISODE_4_CHAPTER_2_RECEIPTS: CanonicalStorySourceReceipt[] = [
  {
    id: "a04c2-chapter-source",
    path: "source/art/A04C2/chapter.json",
    bytes: 2011,
    sha256: "072d60a661e01ddd8669c729eab0f545d43648241f91ab77e2b671c1c1812553",
    role: "chapter-source",
    available: false,
  },
  {
    id: "a04c2-lettering-source",
    path: "source/art/A04C2/lettering.json",
    bytes: 28727,
    sha256: "7dc95ce86cdf38616177a2ad6bf743981f57f29223907c464aae5c8cba008636",
    role: "canonical-lettering",
    available: false,
  },
  {
    id: "a04c2-panel-art-source",
    path: "source/art/A04C2/panel-art.json",
    bytes: 18482,
    sha256: "90573aae72c7a1893322323d4a3fbff4db970ab36b70f928182644566670ce05",
    role: "chapter-panel-art-source",
    available: false,
  },
  {
    id: "a04c2-provenance",
    path: "source/art/A04C2/provenance.json",
    bytes: 10094,
    sha256: "386a50372e2f5ddda8d3f4b02ef81b52ee0417316e5adc1e4595fe070856975a",
    role: "chapter-provenance",
    available: false,
  },
  {
    id: "a04c2-recovery",
    path: "manifests/a04c2-recovery.json",
    bytes: 5921,
    sha256: "c5920c4018fa0aeb46b616b32061dc90de2845d03501faba7612f96d1bcb0c53",
    role: "chapter-recovery-receipt",
    available: false,
  },
  {
    id: "a04c2-scroll-plates",
    path: "manifests/a04c2-scroll-plates.json",
    bytes: 1521,
    sha256: "f3e9d4be5dbf8e2f788357c7d909349d846072da983a124fb56edeef3dabf3f3",
    role: "plate-composition-map",
    available: false,
  },
];

const PANELS: AssetRow[] = [
  { number: 21, bytes: 179966, sha256: "af5e1b520c32d8a7c7c9fb2af529dd9c3bf68f940e38779c1240ab0ac53a67e6" },
  { number: 22, bytes: 154644, sha256: "1ac804b1458f32d38c34464a0941d9b3c496fdc581657d455e0c9ba03a7a08c5" },
  { number: 23, bytes: 149500, sha256: "4d490cb524ff7de1c1e95ddfb24d3f86ebd27251dafdb4df61f3c6394570122f" },
  { number: 24, bytes: 106172, sha256: "4cbf82ca7d8a75b3bd0f6a2f33dbc00a294cde68001649a16bc8cbd53d9d4fe3" },
  { number: 25, bytes: 143366, sha256: "0f44a77c804e14f97692d904fe5ebd330bf22747bb64e752ace9c2d55299ff33" },
  { number: 26, bytes: 100990, sha256: "597be6927d9ee4b6c53794f59acd4413b12ba03915b5ad6e511a874da9f3157d" },
  { number: 27, bytes: 129252, sha256: "08d650aa8ed520244c7a7aeedab82544527ff3d7f148b00c0e7024dca2e22b45" },
  { number: 28, bytes: 120798, sha256: "1c53c5c153c397a790e14ead90c71af717ec1e6b1ea5f9dce996d406d620c219" },
  { number: 29, bytes: 105062, sha256: "eb20a2fbd06cfaec987ffa5cc646cfd3dbc86ed9ed5762e93bd392b0a0d9e962" },
  { number: 30, bytes: 129654, sha256: "486ba36066501dc7eec2b1fd042ba3f35deb926844603aca7b89c1abf665cefb" },
  { number: 31, bytes: 107542, sha256: "1d05c701dafcb31bcbac8a46b272b0e2e0b89d7f41a17339babef8d687aae663" },
  { number: 32, bytes: 127752, sha256: "c65a782f88af89d5a36cde81ed7c28b28753a52921eeb6de05b1851609408622" },
  { number: 33, bytes: 151962, sha256: "6521d5d7856d8feca8a27b5e629df1bf8fd8e6a8d253b9f61d6f6290ddb0b671" },
  { number: 34, bytes: 129764, sha256: "3d154e6e6bf7b2a36ada99b6a4cebad6a478e71d5385ed90ea490a58759b58b3" },
  { number: 35, bytes: 139794, sha256: "fedecfc0d007cb36c9d78cfda7cf2389fec5202e13dfd6d531981e588d6cd71f" },
  { number: 36, bytes: 206070, sha256: "cb50600b5cf0581c1a2e0acb7a32eeb078a57609ac0cc4437129ce9039ec3505" },
  { number: 37, bytes: 108264, sha256: "14795b891bcfc3c00cdc162530fec99f1d071f13f240641c8368b6d4fe1aec40" },
  { number: 38, bytes: 171600, sha256: "94751ef4b96082184ff4ed9514138502ff17fc7ceb795d2b970d9b9d3ebd66b6" },
  { number: 39, bytes: 127316, sha256: "dab88ac44440bc2c9c8a14a92e8faad70022579fedcb72b3f3662f842734989c" },
  { number: 40, bytes: 147124, sha256: "0030e166fc6518998d9fba4416f8497649a528cdb1bc149a5e97eb8175c9f218" },
];

const PLATES: PlateRow[] = [
  { ordinal: 1, bytes: 693458, sha256: "70c253211051166d075aa268c59a7f1c3e29419f5ad32d5e686e6ca6a5df4967" },
  { ordinal: 2, bytes: 540056, sha256: "d3cec37f322dbf89ff4d2b211b0a44416150ab577de14cfb542d9dccb7f28b88" },
  { ordinal: 3, bytes: 603588, sha256: "03725511b691925995d10c7ca2d64e8225a61c2c50b6275ee162fe3d8fe43bdb" },
  { ordinal: 4, bytes: 690254, sha256: "d41bc352982b6082afbc738691a1badc4c695d9e57616e117a03d4918ed25f3b" },
];

export const BURN_PROTOCOL_EPISODE_4_CHAPTER_2: CanonicalStoryChapter = {
  id: "E04-C2",
  number: 2,
  title: "Georgiou's Pattern",
  complete: true,
  openingPanelId: "E04-C2-P21",
  terminalPanelId: "E04-C2-P40",
  previousPanelId: "E04-C1-P20",
  nextPanelId: "E04-C3-P41",
  panels: PANELS.map((row, index) => {
    const panelId = `E04-C2-P${String(row.number).padStart(2, "0")}`;
    return {
      id: panelId,
      ordinal: index + 1,
      chapterId: "E04-C2",
      previousPanelId: row.number === 21
        ? "E04-C1-P20"
        : `E04-C2-P${String(row.number - 1).padStart(2, "0")}`,
      nextPanelId: row.number === 40
        ? "E04-C3-P41"
        : `E04-C2-P${String(row.number + 1).padStart(2, "0")}`,
      asset: {
        id: `asset:${panelId}`,
        path: `site/assets/art/A04C2/panels/${panelId}.webp`,
        bytes: row.bytes,
        sha256: row.sha256,
        mimeType: "image/webp" as const,
        availability: "manifested-external" as const,
        visualStanding: "q02-review-required" as const,
      },
      text: {
        status: "source-required" as const,
        expectedSourceReceiptIds: [
          "episode-04-source",
          "episode-04-compiled",
          "a04c2-lettering-source",
          "q01-dialogue-parity",
        ],
        reason: "The exact Episode 4 and A04C2 lettering bytes are not present in this repository. Canonical captions, dialogue, sound effects, and alt text cannot be reconstructed from parity or causal ledgers.",
      },
    };
  }),
  plates: PLATES.map((row) => {
    const plateId = `A04C2-plate-${String(row.ordinal).padStart(2, "0")}`;
    return {
      id: plateId,
      ordinal: row.ordinal,
      chapterId: "E04-C2",
      asset: {
        id: `asset:${plateId}`,
        path: `site/assets/art/A04C2/plates/${plateId}.webp`,
        bytes: row.bytes,
        sha256: row.sha256,
        mimeType: "image/webp" as const,
        availability: "manifested-external" as const,
        visualStanding: "q02-review-required" as const,
      },
      panelMapping: {
        status: "source-required" as const,
        expectedSourceReceiptIds: ["a04c2-scroll-plates"],
        reason: "The exact A04C2 scroll-plate composition map is not present in this repository. Plate-to-panel ranges cannot be inferred from asset order.",
      },
    };
  }),
};

export const BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_2_SOURCE = appendBurnProtocolChapter(
  BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_1_SOURCE,
  {
    identity: {
      id: "burn-protocol",
      title: "The Burn Protocol through Episode 4, Chapter 2 — Osyraa's Offer / Georgiou's Pattern",
      description: "The corpus-native Burn cartridge through Episode 4, Chapter 2, represented as two hundred twenty ordered panel positions, forty-four plate assets, exact available source receipts, and one inherited source-required panel asset without simulation or invented branching.",
      author: "The Burn Project",
      version: "0.9.0",
    },
    storyVersion: "0.9.0",
    sourceReceipts: EPISODE_4_CHAPTER_2_RECEIPTS,
    missingRequiredReceiptIds: [
      ...BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_1_SOURCE.estate.missingRequiredReceiptIds,
      "a04c2-lettering-source",
      "a04c2-scroll-plates",
    ],
    boundary: "The fixed panel sequence is explicit from E01-C1-P01 through E04-C2-P40, including the E03-to-E04 series seam, the E04-C1-to-E04-C2 chapter seam, 220 panel positions, 219 exact panel asset receipts, 44 exact plate asset receipts, and the inherited source-required panel asset at E03-C2-P31. Canonical text and plate mappings remain blocked until their source bytes are supplied. The next canonical panel is E04-C3-P41.",
    episodeId: "E04",
    nextChapterId: "E04-C3",
    chapter: BURN_PROTOCOL_EPISODE_4_CHAPTER_2,
    notes: {
      implementationPurpose: "Append Episode 4 Chapter 2 through the same ordinary chapter amendment while preserving the stable source plane, fixed authority, and inherited media-custody refusal.",
      noSimulation: true,
      noChoices: true,
      stableSeriesIdentity: "burn-protocol",
      canonicalSeams: [
        "E03-C3-P60 -> E04-C1-P01",
        "E04-C1-P20 -> E04-C2-P21",
      ],
      nextCanonicalPanelId: "E04-C3-P41",
      sourceAuthority: {
        canonical: "source/episodes/episode-04.json",
        compiled: "site/data/episode-04.json",
        script: "scripts/episode-04-fractured-allegiances.md",
        chapter: "source/art/A04C2/chapter.json",
        lettering: "source/art/A04C2/lettering.json",
        plateMap: "manifests/a04c2-scroll-plates.json",
      },
      inheritedAssetLedgerGap: {
        id: "asset:E03-C2-P31",
        path: "site/assets/art/A03C2/panels/E03-C2-P31.webp",
        expectedBytes: 156208,
        requiredReceiptId: "a03c2-art-manifest",
        reason: "Exact SHA-256 remains unavailable; the A04C2 amendment neither removes nor resolves the inherited custody gap.",
      },
    },
  },
);
