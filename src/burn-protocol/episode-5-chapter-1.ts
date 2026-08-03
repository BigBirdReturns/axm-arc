import type {
  CanonicalStoryChapter,
  CanonicalStoryEpisode,
  CanonicalStorySourceReceipt,
} from "../canonical-story/types.js";
import { appendBurnProtocolEpisode } from "./assembly.js";
import { BURN_PROTOCOL_THROUGH_EPISODE_4_SOURCE } from "./episode-4-chapter-3.js";

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

const EPISODE_5_CHAPTER_1_RECEIPTS: CanonicalStorySourceReceipt[] = [
  {
    id: "episode-05-source",
    path: "source/episodes/episode-05.json",
    bytes: 102175,
    sha256: "b0c738dfe510dc04437f9b0edfddcb9a5faa254d13109875470d02f0c1591fd7",
    role: "canonical-story-source",
    available: false,
  },
  {
    id: "episode-05-compiled",
    path: "site/data/episode-05.json",
    bytes: 155844,
    sha256: "d9dac19f58a7cedeacdb3af2cf52c95be327cd4eddfc578a8459bffef3e2ebc1",
    role: "compiled-reader-source",
    available: false,
  },
  {
    id: "episode-05-script",
    path: "scripts/episode-05-nursery-world.md",
    bytes: 68757,
    sha256: "c39b3470286bcbebef9d7cee452d544d42e8627211a68539bd7815ebe5fe4d64",
    role: "canonical-script-render",
    available: false,
  },
  {
    id: "a05c1-chapter-source",
    path: "source/art/A05C1/chapter.json",
    bytes: 2001,
    sha256: "b9d6c568eacfd754d0f1d3a0635b3212bb2f352bd72a9076f535602343429e14",
    role: "chapter-source",
    available: false,
  },
  {
    id: "a05c1-lettering-source",
    path: "source/art/A05C1/lettering.json",
    bytes: 23862,
    sha256: "ad0ad5f24c5e594f4c6875acafda820838775849c9e664be1c5cbfee2755f7c7",
    role: "canonical-lettering",
    available: false,
  },
  {
    id: "a05c1-panel-art-source",
    path: "source/art/A05C1/panel-art.json",
    bytes: 18482,
    sha256: "b445c72e4dec7e5bb4067775c319c2f02bd64c4a3ff403ad8f079ab7e11963d3",
    role: "chapter-panel-art-source",
    available: false,
  },
  {
    id: "a05c1-scroll-plates",
    path: "manifests/a05c1-scroll-plates.json",
    bytes: 1521,
    sha256: "6a399d9ffb32176f95aec7dde5e68cb7922747d5b45906d1bd816e1d679077b0",
    role: "plate-composition-map",
    available: false,
  },
];

const PANELS: AssetRow[] = [
  { number: 1, bytes: 93284, sha256: "7c57604a1c63d035277169f0d2aaf4b5756fc222f8eff7443942e4cc6f546780" },
  { number: 2, bytes: 64146, sha256: "29c11d6794aff7ff9657a8a5de1e1748f74b753aa4a1cba54eba01cd279880a1" },
  { number: 3, bytes: 77260, sha256: "d76b7137597dea30b18f52e5a1bd3753889a08b57fdef43c18ea99775ebada84" },
  { number: 4, bytes: 62362, sha256: "e1e2a656624c94761c967f7e9684bfffbb7b0b168a55a7e10b10a2b105cb7a81" },
  { number: 5, bytes: 79390, sha256: "922a4a028e61562c4ca992dc6ca11acac6298cc0d480ac95f918e4962e92c9eb" },
  { number: 6, bytes: 76840, sha256: "f52e8e4c0be8911a76fb764d9578b91100c947f87add3aefbfeb42ec6522821b" },
  { number: 7, bytes: 86280, sha256: "1218eb719be5879156f4fabf282eaa93a48202915d7d3bd9b2f10ab1469b0210" },
  { number: 8, bytes: 53206, sha256: "26c659dbe09cfab67ece2d80f8648d63aa2298928cfa94acefe6dbbc4f2954eb" },
  { number: 9, bytes: 61610, sha256: "0f239324a806cdcf9b2b115ace55ad5b0f3b565a05381b4ca9e6f300ed684e6f" },
  { number: 10, bytes: 76840, sha256: "e9744478658268c539e7cf9cc8440487348b800a3e0d6aedf574773e1761c0f7" },
  { number: 11, bytes: 77920, sha256: "29e876d0918d20cb16c991c2669e836afe5b1383be014336c54d979c7a883a5a" },
  { number: 12, bytes: 61234, sha256: "abb7d53695827e0d78bd0343899cca9a15c17c03de2f04405f1cfbb65e77fca4" },
  { number: 13, bytes: 63406, sha256: "f3d13713d5a026e197313de997c0d0e5314f799cb0a168c839e3e1693bf8fc2b" },
  { number: 14, bytes: 54578, sha256: "7e9490620bf8d6d5b2191b29e70e616406bcb83c40a952336e05daad40d6d1d3" },
  { number: 15, bytes: 75192, sha256: "a658d986690b8f285b938e912ecaf041e729000948ab6b5902630155a251ce15" },
  { number: 16, bytes: 56772, sha256: "7d0db91bc703952df366b72017b4377e7d5c95d9e907ce845221ced58ad9a147" },
  { number: 17, bytes: 60208, sha256: "695c0fa85a585da2fcaeb33cd135f382d9c0b8565bd6a488f54ac7908740efb8" },
  { number: 18, bytes: 61870, sha256: "36b33e67431a25068fd05ee625483797bc5ae8cbaefccf54cc45eb301dabf712" },
  { number: 19, bytes: 50678, sha256: "76cf71e817ddec6ce86493ee8a863e5e9129040c34495f6210ab4b3fb45e68db" },
  { number: 20, bytes: 61772, sha256: "1da033099e27be1ba9ccc169b0e753d6df0a79837bb83efaa87489249cca9ffd" },
];

const PLATES: PlateRow[] = [
  { ordinal: 1, bytes: 363048, sha256: "39ae7ea3783af3d28750ddafbae8acc6de53bd6c189a25f4e98a69ec8e061f33" },
  { ordinal: 2, bytes: 336138, sha256: "9d625c21886a0407482ddf5af6cae18c9b4a38b69e61e735aea9220e7f8eeb76" },
  { ordinal: 3, bytes: 321384, sha256: "b7f82ecd3d7f5ecc9021d6a55d9ae6a7a7f3b20299ffeabed7fb2e7065bf6bdd" },
  { ordinal: 4, bytes: 278884, sha256: "241c9c4165e8778c813bea98011f564f8ee038ce2b4680bf5e170057df0ec822" },
];

export const BURN_PROTOCOL_EPISODE_5_CHAPTER_1: CanonicalStoryChapter = {
  id: "E05-C1",
  number: 1,
  title: "The Song",
  complete: true,
  openingPanelId: "E05-C1-P01",
  terminalPanelId: "E05-C1-P20",
  previousPanelId: "E04-C3-P60",
  nextPanelId: "E05-C2-P21",
  panels: PANELS.map((row, index) => {
    const panelId = `E05-C1-P${String(row.number).padStart(2, "0")}`;
    return {
      id: panelId,
      ordinal: index + 1,
      chapterId: "E05-C1",
      previousPanelId: row.number === 1
        ? "E04-C3-P60"
        : `E05-C1-P${String(row.number - 1).padStart(2, "0")}`,
      nextPanelId: row.number === 20
        ? "E05-C2-P21"
        : `E05-C1-P${String(row.number + 1).padStart(2, "0")}`,
      asset: {
        id: `asset:${panelId}`,
        path: `site/assets/art/A05C1/panels/${panelId}.webp`,
        bytes: row.bytes,
        sha256: row.sha256,
        mimeType: "image/webp" as const,
        availability: "manifested-external" as const,
        visualStanding: "q02-review-required" as const,
      },
      text: {
        status: "source-required" as const,
        expectedSourceReceiptIds: [
          "episode-05-source",
          "episode-05-compiled",
          "a05c1-lettering-source",
          "q01-dialogue-parity",
        ],
        reason: "The exact Episode 5 and A05C1 lettering bytes are not present in this repository. Canonical captions, dialogue, sound effects, and alt text cannot be reconstructed from parity or causal ledgers.",
      },
    };
  }),
  plates: PLATES.map((row) => {
    const plateId = `A05C1-plate-${String(row.ordinal).padStart(2, "0")}`;
    return {
      id: plateId,
      ordinal: row.ordinal,
      chapterId: "E05-C1",
      asset: {
        id: `asset:${plateId}`,
        path: `site/assets/art/A05C1/plates/${plateId}.webp`,
        bytes: row.bytes,
        sha256: row.sha256,
        mimeType: "image/webp" as const,
        availability: "manifested-external" as const,
        visualStanding: "q02-review-required" as const,
      },
      panelMapping: {
        status: "source-required" as const,
        expectedSourceReceiptIds: ["a05c1-scroll-plates"],
        reason: "The exact A05C1 scroll-plate composition map is not present in this repository. Plate-to-panel ranges cannot be inferred from asset order.",
      },
    };
  }),
};

export const BURN_PROTOCOL_EPISODE_5_THROUGH_CHAPTER_1: CanonicalStoryEpisode = {
  id: "E05",
  number: 5,
  title: "Nursery World",
  complete: false,
  nextChapterId: "E05-C2",
  chapters: [BURN_PROTOCOL_EPISODE_5_CHAPTER_1],
};

export const BURN_PROTOCOL_THROUGH_EPISODE_5_CHAPTER_1_SOURCE = appendBurnProtocolEpisode(
  BURN_PROTOCOL_THROUGH_EPISODE_4_SOURCE,
  {
    identity: {
      id: "burn-protocol",
      title: "The Burn Protocol through Episode 5, Chapter 1 — The Song",
      description: "The corpus-native Burn cartridge through Episode 5, Chapter 1, represented as two hundred sixty ordered panel positions, fifty-two plate assets, exact available source receipts, and one inherited source-required panel asset without simulation or invented branching.",
      author: "The Burn Project",
      version: "0.11.0",
    },
    storyVersion: "0.11.0",
    sourceReceipts: EPISODE_5_CHAPTER_1_RECEIPTS,
    canonicalSourceReceiptIds: [
      ...(BURN_PROTOCOL_THROUGH_EPISODE_4_SOURCE.estate.canonicalSourceReceiptIds ?? []),
      "episode-05-source",
    ],
    compiledSourceReceiptIds: [
      ...(BURN_PROTOCOL_THROUGH_EPISODE_4_SOURCE.estate.compiledSourceReceiptIds ?? []),
      "episode-05-compiled",
    ],
    missingRequiredReceiptIds: [
      ...BURN_PROTOCOL_THROUGH_EPISODE_4_SOURCE.estate.missingRequiredReceiptIds,
      "episode-05-source",
      "episode-05-compiled",
      "a05c1-lettering-source",
      "a05c1-scroll-plates",
    ],
    boundary: "The fixed panel sequence is explicit from E01-C1-P01 through E05-C1-P20, including the E04-to-E05 seam, 260 panel positions, 259 exact panel asset receipts, 52 exact plate asset receipts, and the inherited source-required panel asset at E03-C2-P31. Canonical text and plate mappings remain blocked until their source bytes are supplied. The next canonical panel is E05-C2-P21.",
    episode: BURN_PROTOCOL_EPISODE_5_THROUGH_CHAPTER_1,
    notes: {
      implementationPurpose: "Append Episode 5 Chapter 1 as ordinary episode and chapter data under the same stable Burn source plane and fixed canonical-story authority.",
      noSimulation: true,
      noChoices: true,
      stableSeriesIdentity: "burn-protocol",
      episodeBoundary: "E04-C3-P60 -> E05-C1-P01",
      nextCanonicalPanelId: "E05-C2-P21",
      sourceAuthority: {
        canonical: "source/episodes/episode-05.json",
        compiled: "site/data/episode-05.json",
        script: "scripts/episode-05-nursery-world.md",
        chapter: "source/art/A05C1/chapter.json",
        lettering: "source/art/A05C1/lettering.json",
        panelArt: "source/art/A05C1/panel-art.json",
        plateMap: "manifests/a05c1-scroll-plates.json",
        audit: [
          "manifests/q01-causal-ledger.json",
          "manifests/q01-dialogue-parity.json",
          "manifests/v0.62.0-file-manifest.json",
        ],
      },
      inheritedAssetLedgerGap: {
        id: "asset:E03-C2-P31",
        path: "site/assets/art/A03C2/panels/E03-C2-P31.webp",
        expectedBytes: 156208,
        requiredReceiptId: "a03c2-art-manifest",
        reason: "Exact SHA-256 remains unavailable; the A05C1 amendment neither removes nor resolves the inherited custody gap.",
      },
    },
  },
);
