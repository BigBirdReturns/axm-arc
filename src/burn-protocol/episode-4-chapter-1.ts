import type {
  CanonicalStoryChapter,
  CanonicalStoryEpisode,
  CanonicalStorySourceReceipt,
} from "../canonical-story/types.js";
import { appendBurnProtocolEpisode } from "./assembly.js";
import { BURN_PROTOCOL_THROUGH_EPISODE_3_SOURCE } from "./episode-3-chapter-3.js";

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

const EPISODE_4_CHAPTER_1_RECEIPTS: CanonicalStorySourceReceipt[] = [
  {
    id: "episode-04-source",
    path: "source/episodes/episode-04.json",
    bytes: 111285,
    sha256: "a6c18aef5acdbc4108b955ebfa5c50e6be2b08adb49987502f9a0bd533c9bdda",
    role: "canonical-story-source",
    available: false,
  },
  {
    id: "episode-04-compiled",
    path: "site/data/episode-04.json",
    bytes: 164954,
    sha256: "a92f19d2b04e8589da86471ad81771a68710111105e3e80dca8279c9aa570884",
    role: "compiled-reader-source",
    available: false,
  },
  {
    id: "episode-04-script",
    path: "scripts/episode-04-fractured-allegiances.md",
    bytes: 76163,
    sha256: "22a68429b2360f0a0ecda3e416cc64f3a9bbbae8a484fd5052f642ec0e8831e5",
    role: "canonical-script-render",
    available: false,
  },
  {
    id: "a04c1-chapter-source",
    path: "source/art/A04C1/chapter.json",
    bytes: 2007,
    sha256: "fded0eea35340997287c1fa37cc5e38f537ff65515ec3e75f7a52b0d67e7d04e",
    role: "chapter-source",
    available: false,
  },
  {
    id: "a04c1-lettering-source",
    path: "source/art/A04C1/lettering.json",
    bytes: 25330,
    sha256: "2c825035d0fc05dd3e8fc6151f75df70c4cd8745f8686ad3b80e4ebaa78cd093",
    role: "canonical-lettering",
    available: false,
  },
  {
    id: "a04c1-panel-art-source",
    path: "source/art/A04C1/panel-art.json",
    bytes: 18482,
    sha256: "4c8b40487179180dc21d382ed88ee492764c88ba42af5755bb7650bde1bb8202",
    role: "chapter-panel-art-source",
    available: false,
  },
  {
    id: "a04c1-provenance",
    path: "source/art/A04C1/provenance.json",
    bytes: 10094,
    sha256: "3bfa3c09f7b78dc4e5215946ce7b3ae9377bd29731d19a0d7d27f15ee77df540",
    role: "chapter-provenance",
    available: false,
  },
  {
    id: "a04c1-recovery",
    path: "manifests/a04c1-recovery.json",
    bytes: 5921,
    sha256: "044c9020c5197d6fed92cb6a89e7940c946da4f3d7a007308da45eceb3a20463",
    role: "chapter-recovery-receipt",
    available: false,
  },
  {
    id: "a04c1-scroll-plates",
    path: "manifests/a04c1-scroll-plates.json",
    bytes: 1521,
    sha256: "bca6a43a880eb30433f9c3f0665c3b1e22fc38a4bbe725167e1c41b5e48fecc0",
    role: "plate-composition-map",
    available: false,
  },
];

const PANELS: AssetRow[] = [
  { number: 1, bytes: 91204, sha256: "d0afc1821d1f9e03f8063818ea052f1cbacf8331b21732cdac4d0c7c156ed49a" },
  { number: 2, bytes: 130616, sha256: "a8d3ae4fd3d8a0f52ece3eb1465b8b41ab2d637eea1169a44281f4fb18d1223b" },
  { number: 3, bytes: 101164, sha256: "3e02e584656a05b15623fff7da5daaff71772c1730a508a701e8eb07b656f140" },
  { number: 4, bytes: 131334, sha256: "5619f40f3416ae9da68c5f20d7d0df2e4c87c002af14f1fa3bfcfee66147554d" },
  { number: 5, bytes: 136300, sha256: "33bd7477bd589eb90b9fe7187b731461ca062d0cf40e6e6fa0e279695484e633" },
  { number: 6, bytes: 111628, sha256: "13c9dd0e3c48c891976f4f795640b35e7b29099ccabd05c5cbf5e95089dbda15" },
  { number: 7, bytes: 112244, sha256: "9e8a770055314705d68682ca170effd762f9d758921bf2428b160672db46c6d9" },
  { number: 8, bytes: 112666, sha256: "09821bf86ecb33ade33bbbf3740288078deef73ed8c09a58904e67df40dcd11b" },
  { number: 9, bytes: 105914, sha256: "9742264f553b01f6b2c016ef46aebaae6b0a8f2c606d179871e3a1e05fc99bc4" },
  { number: 10, bytes: 131116, sha256: "4be438a58a391d360054571563e1cf93ece5127800b2eec18da993df744e64cf" },
  { number: 11, bytes: 160616, sha256: "cb694747ec33499904336a82a6fee4aa013dacb951a6d9cd4d70ec2caadafcb2" },
  { number: 12, bytes: 108760, sha256: "cee4bfc0ff5b11bc5d5bf6637ff698a0731ca1eb1fadc7d7171837e5597ff3f8" },
  { number: 13, bytes: 103550, sha256: "6e082af84b6baabfe9780cd76a7195a9a60fbac46aed5bb3e4593661dfcaad12" },
  { number: 14, bytes: 157758, sha256: "c80f94ff7e6f56bad542caa387c623eade7d71676af745c62eb1c17c20c7788a" },
  { number: 15, bytes: 138086, sha256: "0fbd304fed49c52ca6adf2aff6819345e92cb8d20d4912fa6f81cd86fdb8ae5e" },
  { number: 16, bytes: 104278, sha256: "3153f3f6cfb16b1bece5e7d93b9c28bddf3942753df530d89f029d8f1b6945ba" },
  { number: 17, bytes: 117882, sha256: "c3519fdf7384962dc8c359598832a466cab59885495ddd5df2fcc327ab3a697b" },
  { number: 18, bytes: 119766, sha256: "cdf3c35b1e9c0611b4e0a3f442846f60d2be481711f20d4b1272d0371e5f4728" },
  { number: 19, bytes: 126248, sha256: "fe4390e92dfec51bc0a808344fcecab0c325ad132a5f5abf77beca65aa7a5366" },
  { number: 20, bytes: 145422, sha256: "1b2964c7e3e9d2efd3bca39425e3d68890bbd73189d33934b793c34909f037ff" },
];

const PLATES: PlateRow[] = [
  { ordinal: 1, bytes: 542814, sha256: "7c5cee4363540ff5cb478ff7e38601648029cd06aec0e28af5b31570955dbe97" },
  { ordinal: 2, bytes: 527728, sha256: "76804482da22b621fdae15e09e943e607180f70a3fd3936a0a5b4e3bf7752217" },
  { ordinal: 3, bytes: 611544, sha256: "cfacb0456df01e5a9615ddb5d313ad61b9308323bac9f6898d426d8ddd926c1c" },
  { ordinal: 4, bytes: 559974, sha256: "7c8804dff305764ff9fc3030de56735ea695ffaaf804611079de2d12ebbfaf7d" },
];

export const BURN_PROTOCOL_EPISODE_4_CHAPTER_1: CanonicalStoryChapter = {
  id: "E04-C1",
  number: 1,
  title: "Osyraa's Offer",
  complete: true,
  openingPanelId: "E04-C1-P01",
  terminalPanelId: "E04-C1-P20",
  previousPanelId: "E03-C3-P60",
  nextPanelId: "E04-C2-P21",
  panels: PANELS.map((row, index) => {
    const panelId = `E04-C1-P${String(row.number).padStart(2, "0")}`;
    return {
      id: panelId,
      ordinal: index + 1,
      chapterId: "E04-C1",
      previousPanelId: row.number === 1
        ? "E03-C3-P60"
        : `E04-C1-P${String(row.number - 1).padStart(2, "0")}`,
      nextPanelId: row.number === 20
        ? "E04-C2-P21"
        : `E04-C1-P${String(row.number + 1).padStart(2, "0")}`,
      asset: {
        id: `asset:${panelId}`,
        path: `site/assets/art/A04C1/panels/${panelId}.webp`,
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
          "a04c1-lettering-source",
          "q01-dialogue-parity",
        ],
        reason: "The exact Episode 4 and A04C1 lettering bytes are not present in this repository. Canonical captions, dialogue, sound effects, and alt text cannot be reconstructed from parity or causal ledgers.",
      },
    };
  }),
  plates: PLATES.map((row) => {
    const plateId = `A04C1-plate-${String(row.ordinal).padStart(2, "0")}`;
    return {
      id: plateId,
      ordinal: row.ordinal,
      chapterId: "E04-C1",
      asset: {
        id: `asset:${plateId}`,
        path: `site/assets/art/A04C1/plates/${plateId}.webp`,
        bytes: row.bytes,
        sha256: row.sha256,
        mimeType: "image/webp" as const,
        availability: "manifested-external" as const,
        visualStanding: "q02-review-required" as const,
      },
      panelMapping: {
        status: "source-required" as const,
        expectedSourceReceiptIds: ["a04c1-scroll-plates"],
        reason: "The exact A04C1 scroll-plate composition map is not present in this repository. Plate-to-panel ranges cannot be inferred from asset order.",
      },
    };
  }),
};

export const BURN_PROTOCOL_EPISODE_4_THROUGH_CHAPTER_1: CanonicalStoryEpisode = {
  id: "E04",
  number: 4,
  title: "Fractured Allegiances",
  complete: false,
  nextChapterId: "E04-C2",
  chapters: [BURN_PROTOCOL_EPISODE_4_CHAPTER_1],
};

export const BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_1_SOURCE = appendBurnProtocolEpisode(
  BURN_PROTOCOL_THROUGH_EPISODE_3_SOURCE,
  {
    identity: {
      id: "burn-protocol",
      title: "The Burn Protocol through Episode 4, Chapter 1 — Osyraa's Offer",
      description: "The corpus-native Burn cartridge through Episode 4, Chapter 1, represented as two hundred ordered panel positions, forty plate assets, exact available source receipts, and one inherited source-required panel asset without simulation or invented branching.",
      author: "The Burn Project",
      version: "0.8.0",
    },
    storyVersion: "0.8.0",
    sourceReceipts: EPISODE_4_CHAPTER_1_RECEIPTS,
    canonicalSourceReceiptIds: [
      ...BURN_PROTOCOL_THROUGH_EPISODE_3_SOURCE.estate.canonicalSourceReceiptIds,
      "episode-04-source",
    ],
    compiledSourceReceiptIds: [
      ...BURN_PROTOCOL_THROUGH_EPISODE_3_SOURCE.estate.compiledSourceReceiptIds,
      "episode-04-compiled",
    ],
    missingRequiredReceiptIds: [
      ...BURN_PROTOCOL_THROUGH_EPISODE_3_SOURCE.estate.missingRequiredReceiptIds,
      "episode-04-source",
      "episode-04-compiled",
      "a04c1-lettering-source",
      "a04c1-scroll-plates",
    ],
    boundary: "The fixed panel sequence is explicit from E01-C1-P01 through E04-C1-P20, including the E03-to-E04 seam, 200 panel positions, 199 exact panel asset receipts, 40 exact plate asset receipts, and the inherited source-required panel asset at E03-C2-P31. Canonical text and plate mappings remain blocked until their source bytes are supplied. The next canonical panel is E04-C2-P21.",
    episode: BURN_PROTOCOL_EPISODE_4_THROUGH_CHAPTER_1,
    notes: {
      implementationPurpose: "Append Episode 4 Chapter 1 as ordinary episode and chapter data under the same stable Burn source plane and fixed canonical-story authority.",
      noSimulation: true,
      noChoices: true,
      stableSeriesIdentity: "burn-protocol",
      episodeBoundary: "E03-C3-P60 -> E04-C1-P01",
      nextCanonicalPanelId: "E04-C2-P21",
      sourceAuthority: {
        canonical: "source/episodes/episode-04.json",
        compiled: "site/data/episode-04.json",
        script: "scripts/episode-04-fractured-allegiances.md",
      },
      inheritedAssetLedgerGap: {
        id: "asset:E03-C2-P31",
        path: "site/assets/art/A03C2/panels/E03-C2-P31.webp",
        expectedBytes: 156208,
        requiredReceiptId: "a03c2-art-manifest",
        reason: "Exact SHA-256 remains unavailable; Episode 4 assembly neither removes nor resolves the inherited custody gap.",
      },
    },
  },
);
