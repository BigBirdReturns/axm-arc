import type {
  CanonicalStoryChapter,
  CanonicalStorySourceReceipt,
} from "../canonical-story/types.js";
import { appendBurnProtocolChapter } from "./assembly.js";
import { BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_2_SOURCE } from "./episode-3-chapter-2.js";

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

const EPISODE_3_CHAPTER_3_RECEIPTS: CanonicalStorySourceReceipt[] = [
  {
    id: "a03c3-scroll-plates",
    path: "manifests/a03c3-scroll-plates.json",
    bytes: 1521,
    sha256: "aff773bbc712d31960818dacccac017cea9112b850dc45edeaff69d7510e58d1",
    role: "plate-composition-map",
    available: false,
  },
  {
    id: "a03c3-recovery",
    path: "manifests/a03c3-recovery.json",
    bytes: 5921,
    sha256: "c9c0a9df8362d1cfaba581407415c266eab1aa5663642646c4450521131de80b",
    role: "chapter-recovery-receipt",
    available: false,
  },
];

const PANELS: AssetRow[] = [
  { number: 41, bytes: 115500, sha256: "2525bf05ef4ac194237e9e5354a5e1aad43413cc42154c7323c25226e13cc537" },
  { number: 42, bytes: 109530, sha256: "94d2a05a2058ad187150cf5b37829cd012e970b52917a66226794396a8f34667" },
  { number: 43, bytes: 124232, sha256: "83dc993c01eb520f800eda74a509a9c5a02127a3d2de449a8b1bdfed3f8cb2cb" },
  { number: 44, bytes: 141984, sha256: "2773020b27147469fce6f1057d9e389ca5205213dabd14f6618fdc2110acb3c7" },
  { number: 45, bytes: 111244, sha256: "2c8dd0c6d7d917f089edcec71bcf636b013734b30e31427b23decb8e94e63377" },
  { number: 46, bytes: 154066, sha256: "2d56f1aa41f43dc6b931f0a6ccdda6194ee020447c67456aa92e5630b3f7e5f0" },
  { number: 47, bytes: 110016, sha256: "0de65ca107b0a1e6b501f69bc40daec48e7c01083424d5ebfa56366c85ebf1c3" },
  { number: 48, bytes: 105928, sha256: "5191cf240933651d83944a3dd9470991219ded704a0638940ea917dfd974372f" },
  { number: 49, bytes: 124520, sha256: "f731b5dabcda7da3500aadf23cac55aa4bdb3aacb13cb98fa0bce377038d3bfa" },
  { number: 50, bytes: 162222, sha256: "e72bbf419f0668af66c9dc891b55c1b009beab7f7e759703bf3bf34bb24237d0" },
  { number: 51, bytes: 137520, sha256: "133419f4b5d638afa41e2fcab2d567c10e291e7d507f8130d1ee5fe611aed305" },
  { number: 52, bytes: 116272, sha256: "0d31afd365ef97aa7a7ee94d6e9e45b43cf393a2c289057bd7fe045bbf962871" },
  { number: 53, bytes: 106910, sha256: "8abd43cb076d7420bb252a9e784c0dba23eb5d9400ccb14938750e23f26f448f" },
  { number: 54, bytes: 144804, sha256: "23c0fc245b4b0e33574319bb025b16e84c8cffce0379c3b5e1229e705b319bbe" },
  { number: 55, bytes: 104740, sha256: "c61341cd7786eda92c0b6bdceb45a6a9959d61ffb35a75cebb93fe0cca729fcc" },
  { number: 56, bytes: 110534, sha256: "93c85f6138f2b98520976a745abbcbe2799c9c18d914bad9178dd25bf22e51cd" },
  { number: 57, bytes: 115064, sha256: "10da0231b344892a193a35c04b910fb6227dc116507530992a503cc0b3116927" },
  { number: 58, bytes: 113752, sha256: "b256b79c678fd5d504fe7846bcab8840c7cfe26de165756c9c637cd3427c2af4" },
  { number: 59, bytes: 89092, sha256: "c468bfd2eeff1ad4655d0bad5bfa7430507e0141623906d0626c1dd93b14d57a" },
  { number: 60, bytes: 141270, sha256: "a7d21a68115b520fe3d35638707f7e36dc2eb3213c8c3ad8f77b1965154bd93d" },
];

const PLATES: PlateRow[] = [
  { ordinal: 1, bytes: 558502, sha256: "51928d7736d87636a7c114449be549c0df83c4dd12c66f1a43c8ac13b457440b" },
  { ordinal: 2, bytes: 605736, sha256: "426ffa7e6aac003d9e45f99bdb81428faf0ea4dd4bdc380a43165026d9880c02" },
  { ordinal: 3, bytes: 570582, sha256: "4df03d06486607208eb5afb35ac3d08b76dbed5f32d2f51d1d0bbee884cdc69d" },
  { ordinal: 4, bytes: 524706, sha256: "9a16cc4e9cbde75a7033a82471f0326f7465509252deb07bcfee4cbee7a18b88" },
];

export const BURN_PROTOCOL_EPISODE_3_CHAPTER_3: CanonicalStoryChapter = {
  id: "E03-C3",
  number: 3,
  title: "Prime Incident",
  complete: true,
  openingPanelId: "E03-C3-P41",
  terminalPanelId: "E03-C3-P60",
  previousPanelId: "E03-C2-P40",
  nextPanelId: "E04-C1-P01",
  panels: PANELS.map((row, index) => {
    const panelId = `E03-C3-P${String(row.number).padStart(2, "0")}`;
    return {
      id: panelId,
      ordinal: index + 1,
      chapterId: "E03-C3",
      previousPanelId: row.number === 41
        ? "E03-C2-P40"
        : `E03-C3-P${String(row.number - 1).padStart(2, "0")}`,
      nextPanelId: row.number === 60
        ? "E04-C1-P01"
        : `E03-C3-P${String(row.number + 1).padStart(2, "0")}`,
      asset: {
        id: `asset:${panelId}`,
        path: `site/assets/art/A03C3/panels/${panelId}.webp`,
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
        reason: "The exact Episode 3 source bytes are not present in this repository. Canonical captions, dialogue, sound effects, and alt text cannot be reconstructed from derivative ledgers; no unreceipted A03C3 lettering record has been invented.",
      },
    };
  }),
  plates: PLATES.map((row) => {
    const plateId = `A03C3-plate-${String(row.ordinal).padStart(2, "0")}`;
    return {
      id: plateId,
      ordinal: row.ordinal,
      chapterId: "E03-C3",
      asset: {
        id: `asset:${plateId}`,
        path: `site/assets/art/A03C3/plates/${plateId}.webp`,
        bytes: row.bytes,
        sha256: row.sha256,
        mimeType: "image/webp" as const,
        availability: "manifested-external" as const,
        visualStanding: "q02-review-required" as const,
      },
      panelMapping: {
        status: "source-required" as const,
        expectedSourceReceiptIds: ["a03c3-scroll-plates"],
        reason: "The exact A03C3 scroll-plate composition map is not present in this repository. Plate-to-panel ranges cannot be inferred from asset order.",
      },
    };
  }),
};

export const BURN_PROTOCOL_THROUGH_EPISODE_3_SOURCE = appendBurnProtocolChapter(
  BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_2_SOURCE,
  {
    identity: {
      id: "burn-protocol",
      title: "The Burn Protocol through Episode 3 — The Omega Thread",
      description: "The corpus-native Burn cartridge through Episode 3, represented as one hundred eighty ordered panel slots, exact available asset receipts, and one explicit unresolved panel-asset receipt without simulation or invented branching.",
      author: "The Burn Project",
      version: "0.7.0",
    },
    storyVersion: "0.7.0",
    sourceReceipts: EPISODE_3_CHAPTER_3_RECEIPTS,
    missingRequiredReceiptIds: [
      ...BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_2_SOURCE.estate.missingRequiredReceiptIds,
      "a03c3-scroll-plates",
    ],
    boundary: "The complete fixed panel sequence through Episode 3 is explicit from E01-C1-P01 through E03-C3-P60, including every episode and chapter seam, 180 panel positions, 179 exact panel asset receipts, 36 exact plate asset receipts, and one source-required panel asset at E03-C2-P31. Canonical text and plate mappings remain blocked until their source bytes are supplied. The next canonical panel is E04-C1-P01.",
    episodeId: "E03",
    episodeComplete: true,
    nextChapterId: null,
    chapter: BURN_PROTOCOL_EPISODE_3_CHAPTER_3,
    notes: {
      implementationPurpose: "Complete Episode 3 through the same fixed canonical-story assembly while preserving the one honest asset-receipt gap introduced in Chapter 2.",
      noSimulation: true,
      noChoices: true,
      stableSeriesIdentity: "burn-protocol",
      canonicalSeams: [
        "E02-C3-P60 -> E03-C1-P01",
        "E03-C1-P20 -> E03-C2-P21",
        "E03-C2-P40 -> E03-C3-P41",
      ],
      nextCanonicalPanelId: "E04-C1-P01",
      sourceLedgerGaps: [
        {
          id: "episode-03-compiled",
          path: "site/data/episode-03.json",
          reason: "Exact byte count and SHA-256 receipt are unavailable in the active evidence.",
        },
        {
          id: "a03c3-lettering",
          path: "manifests/a03c3-lettering.json",
          reason: "Exact byte count and SHA-256 receipt are unavailable in the active evidence.",
        },
        {
          id: "a03c3-art-manifest",
          path: "manifests/a03c3-art-manifest.csv",
          reason: "Exact byte count and SHA-256 receipt are unavailable in the active evidence; panel and plate rows remain individually content-addressed.",
        },
      ],
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
