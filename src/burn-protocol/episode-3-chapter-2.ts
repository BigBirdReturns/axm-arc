import type {
  CanonicalStoryAssetReference,
  CanonicalStoryChapter,
  CanonicalStorySourceReceipt,
} from "../canonical-story/types.js";
import { appendBurnProtocolChapter } from "./assembly.js";
import { BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_1_SOURCE } from "./episode-3-chapter-1.js";

interface ManifestedPanelRow {
  number: number;
  bytes: number;
  sha256: string;
}

interface PlateRow {
  ordinal: number;
  bytes: number;
  sha256: string;
}

const EPISODE_3_CHAPTER_2_RECEIPTS: CanonicalStorySourceReceipt[] = [
  {
    id: "a03c2-lettering",
    path: "manifests/a03c2-lettering.json",
    bytes: 27336,
    sha256: "73494ad24884dca84181d2e5cb48dc3445ad85f1a1be69902ed7719acba1fbd7",
    role: "canonical-lettering",
    available: false,
  },
  {
    id: "a03c2-scroll-plates",
    path: "manifests/a03c2-scroll-plates.json",
    bytes: 1521,
    sha256: "c80d50e9d7279540d8de2fbd4cf76363d8628456b099963a967e0a7cf42593d1",
    role: "plate-composition-map",
    available: false,
  },
  {
    id: "a03c2-art-audit",
    path: "manifests/a03c2-art-audit.json",
    bytes: 80570,
    sha256: "392e4eb46497087825ae4d819dbef4876164e095d0a858dbdd3bc84fbebb9d88",
    role: "chapter-art-audit",
    available: false,
  },
  {
    id: "a03c2-art-manifest",
    path: "manifests/a03c2-art-manifest.csv",
    bytes: 3940,
    sha256: "9c5a4184e08e5388e97310fbd59343c35a93d6a261dc51c630b7d93980e608a4",
    role: "chapter-art-manifest",
    available: false,
  },
];

const MANIFESTED_PANELS: ManifestedPanelRow[] = [
  { number: 21, bytes: 132340, sha256: "f11e650732441802dcbff3e228b5cdf18065ecd96487dc1079a7ae494a1ed4b1" },
  { number: 22, bytes: 180902, sha256: "39cf5242968641e704e3abf92dfb8662a139a2b023b2262219bb5cb2f96d7b41" },
  { number: 23, bytes: 136832, sha256: "d856aa5c5287e10b179943de002b58bf6bd6a3abe75326e23e740f5fb4ce6f86" },
  { number: 24, bytes: 136328, sha256: "3526332754dab6223d86162d6abd93fe117a994f648c3adf790eb2a133deef43" },
  { number: 25, bytes: 149194, sha256: "9e615e1c07755d2781d922d20db628677a6f97f169c4e7bfb097e0ffebe985c8" },
  { number: 26, bytes: 125476, sha256: "5f6c6959310d5407512a76533f110452846bc77576ed6916eea19086fe20b2aa" },
  { number: 27, bytes: 152404, sha256: "4c347795af6001092d77a70b47844a75b066869e42b6b20dc90d53a8f15cf016" },
  { number: 28, bytes: 143900, sha256: "bce453baf579c64218f7c32bee6de7d78b72d0ad563b9196f500fa09604d88e1" },
  { number: 29, bytes: 140248, sha256: "531bb40273db50677431aee7a1a375a67a5487b6d07cba80cbdc76de31e3180b" },
  { number: 30, bytes: 192050, sha256: "6c01011a503fcdbe6478d77bda3e44d1ba4666b3c01d52a56bb63c347dd45189" },
  { number: 32, bytes: 196558, sha256: "ee96b8ffc21ffe573b513b3d187aa20189e92765820077699ebc41c72e68e558" },
  { number: 33, bytes: 114536, sha256: "ca83de666fb7cf5923d590242be633e070d667c64198e8efd936e4d58403eec1" },
  { number: 34, bytes: 109018, sha256: "b1b1b34ac22951ab05df887482d0f4e55234bbe22824ea4ed611e428b7932bbc" },
  { number: 35, bytes: 95448, sha256: "199367acf12cd5f515e1de71f5595cbdef9714418af85f22b95ebf5b8ec40893" },
  { number: 36, bytes: 245374, sha256: "54fc8e6fd0740163e32b3a640b1f936fd26544c3cb32610df7d9758d5a243a72" },
  { number: 37, bytes: 226936, sha256: "a90ac3311ec6a8a5df20376d81494c0083917cc568912c5c4c042995b0900678" },
  { number: 38, bytes: 267404, sha256: "713c9921177332c5947bc08237de0b27ea6cdd477e344743785f71b44ef32e4e" },
  { number: 39, bytes: 252272, sha256: "515b21bf5cadbae13a16da5fa647ba78bb7617714ea24890b97b63a0ccc62299" },
  { number: 40, bytes: 207130, sha256: "b4c113d06b601e26a7d7828485342a8d1efcc0dcb7fd0c9e5bcfc6bbf1e473f3" },
];

const MANIFESTED_PANEL_BY_NUMBER = new Map(
  MANIFESTED_PANELS.map((row) => [row.number, row]),
);

const PLATES: PlateRow[] = [
  { ordinal: 1, bytes: 603044, sha256: "b54217603eb56c496405240d7a4b28a62ecd0dd9433a59e07dabe61e5b4dc7d3" },
  { ordinal: 2, bytes: 626970, sha256: "342ee42bb5150e6c8cac78ec63ae39efb1ee765c65fa77568b11cb77f02aef38" },
  { ordinal: 3, bytes: 626464, sha256: "8325be9184f67af054f4ff6f22f4c8001df5a388c92cb8faeabdba7a2a1584cc" },
  { ordinal: 4, bytes: 1027624, sha256: "d5018787fba87092604c1365e435d03f690fdc356243cd9b259d73cfe6be9f62" },
];

function panelAsset(number: number, panelId: string): CanonicalStoryAssetReference {
  const manifested = MANIFESTED_PANEL_BY_NUMBER.get(number);
  if (manifested) {
    return {
      id: `asset:${panelId}`,
      path: `site/assets/art/A03C2/panels/${panelId}.webp`,
      bytes: manifested.bytes,
      sha256: manifested.sha256,
      mimeType: "image/webp",
      availability: "manifested-external",
      visualStanding: "q02-review-required",
    };
  }
  if (number !== 31) throw new Error(`A03C2 panel ${number} has no custody record.`);
  return {
    status: "source-required",
    id: `asset:${panelId}`,
    path: `site/assets/art/A03C2/panels/${panelId}.webp`,
    expectedBytes: 156208,
    mimeType: "image/webp",
    availability: "manifested-external",
    visualStanding: "missing",
    expectedSourceReceiptIds: ["a03c2-art-manifest"],
    reason: "The active custody evidence exposes the canonical path and 156,208-byte count for E03-C2-P31 but not its exact SHA-256 row. The asset remains source-required; no digest has been invented.",
  };
}

export const BURN_PROTOCOL_EPISODE_3_CHAPTER_2: CanonicalStoryChapter = {
  id: "E03-C2",
  number: 2,
  title: "Lockout",
  complete: true,
  openingPanelId: "E03-C2-P21",
  terminalPanelId: "E03-C2-P40",
  previousPanelId: "E03-C1-P20",
  nextPanelId: "E03-C3-P41",
  panels: Array.from({ length: 20 }, (_, index) => {
    const number = index + 21;
    const panelId = `E03-C2-P${String(number).padStart(2, "0")}`;
    return {
      id: panelId,
      ordinal: index + 1,
      chapterId: "E03-C2",
      previousPanelId: number === 21
        ? "E03-C1-P20"
        : `E03-C2-P${String(number - 1).padStart(2, "0")}`,
      nextPanelId: number === 40
        ? "E03-C3-P41"
        : `E03-C2-P${String(number + 1).padStart(2, "0")}`,
      asset: panelAsset(number, panelId),
      text: {
        status: "source-required" as const,
        expectedSourceReceiptIds: [
          "episode-03-source",
          "a03c2-lettering",
          "q01-dialogue-parity",
        ],
        reason: "The exact Episode 3 and A03C2 lettering bytes are not present in this repository. Canonical captions, dialogue, sound effects, and alt text cannot be reconstructed from derivative ledgers.",
      },
    };
  }),
  plates: PLATES.map((row) => {
    const plateId = `A03C2-plate-${String(row.ordinal).padStart(2, "0")}`;
    return {
      id: plateId,
      ordinal: row.ordinal,
      chapterId: "E03-C2",
      asset: {
        id: `asset:${plateId}`,
        path: `site/assets/art/A03C2/plates/${plateId}.webp`,
        bytes: row.bytes,
        sha256: row.sha256,
        mimeType: "image/webp" as const,
        availability: "manifested-external" as const,
        visualStanding: "q02-review-required" as const,
      },
      panelMapping: {
        status: "source-required" as const,
        expectedSourceReceiptIds: ["a03c2-scroll-plates"],
        reason: "The exact A03C2 scroll-plate composition map is not present in this repository. Plate-to-panel ranges cannot be inferred from asset order.",
      },
    };
  }),
};

export const BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_2_SOURCE = appendBurnProtocolChapter(
  BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_1_SOURCE,
  {
    identity: {
      id: "burn-protocol",
      title: "The Burn Protocol through Episode 3, Chapter 2 — Headquarters / Lockout",
      description: "The corpus-native Burn cartridge through Episode 3, Chapter 2, represented as one hundred sixty ordered panel slots, exact available asset receipts, and one explicit unresolved panel-asset receipt without simulation or invented branching.",
      author: "The Burn Project",
      version: "0.6.0",
    },
    storyVersion: "0.6.0",
    sourceReceipts: EPISODE_3_CHAPTER_2_RECEIPTS,
    missingRequiredReceiptIds: [
      ...BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_1_SOURCE.estate.missingRequiredReceiptIds,
      "a03c2-lettering",
      "a03c2-scroll-plates",
      "a03c2-art-manifest",
    ],
    boundary: "Panel order, the E02-to-E03 seam, both published Episode 3 chapter seams, all forty Episode 3 panel positions, thirty-nine exact Episode 3 panel asset receipts, and all eight Episode 3 plate receipts are explicit through E03-C2-P40. E03-C2-P31 remains source-required because its exact SHA-256 row is unavailable. Canonical text and plate mappings remain blocked until their source bytes are supplied.",
    episodeId: "E03",
    nextChapterId: "E03-C3",
    chapter: BURN_PROTOCOL_EPISODE_3_CHAPTER_2,
    notes: {
      implementationPurpose: "Extend the same fixed canonical-story source with Episode 3 Chapter 2 while representing a missing digest as a reusable source-required asset rather than a fabricated hash.",
      noSimulation: true,
      noChoices: true,
      stableSeriesIdentity: "burn-protocol",
      canonicalSeams: [
        "E02-C3-P60 -> E03-C1-P01",
        "E03-C1-P20 -> E03-C2-P21",
      ],
      nextCanonicalPanelId: "E03-C3-P41",
      assetLedgerGap: {
        id: "asset:E03-C2-P31",
        path: "site/assets/art/A03C2/panels/E03-C2-P31.webp",
        expectedBytes: 156208,
        requiredReceiptId: "a03c2-art-manifest",
        reason: "Exact SHA-256 unavailable in the active custody evidence; no placeholder digest was created.",
      },
    },
  },
);
