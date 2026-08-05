import type {
  CanonicalStoryChapter,
  CanonicalStorySourceReceipt,
} from "../canonical-story/types.js";
import { appendBurnProtocolChapter } from "./assembly.js";
import { BURN_PROTOCOL_THROUGH_EPISODE_5_CHAPTER_1_SOURCE } from "./episode-5-chapter-1.js";

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

const EPISODE_5_CHAPTER_2_RECEIPTS: CanonicalStorySourceReceipt[] = [
  {
    id: "a05c2-chapter-source",
    path: "source/art/A05C2/chapter.json",
    bytes: 2003,
    sha256: "3c7c5919cdae2c100398c97f28e8e63045abec644d48245664c7ca2611b4025f",
    role: "chapter-source",
    available: false,
  },
  {
    id: "a05c2-lettering-source",
    path: "source/art/A05C2/lettering.json",
    bytes: 24420,
    sha256: "a91d050640b4a2cb105693b575e93b36fe17047772c566b239d906dd28a161b7",
    role: "canonical-lettering",
    available: false,
  },
  {
    id: "a05c2-panel-art-source",
    path: "source/art/A05C2/panel-art.json",
    bytes: 18482,
    sha256: "54262a4c55f17d67fc0db0f783f77c2c39775c2a2b1003ba0465717606ec777a",
    role: "chapter-panel-art-source",
    available: false,
  },
  {
    id: "a05c2-provenance",
    path: "source/art/A05C2/provenance.json",
    bytes: 10094,
    sha256: "7dc1dbd08225e1cbdf331b649b9bcca6537e4b9a09453624c86de1bc2bd37631",
    role: "chapter-provenance",
    available: false,
  },
  {
    id: "a05c2-recovery",
    path: "manifests/a05c2-recovery.json",
    bytes: 5921,
    sha256: "8fd084f4f34495741e1373e74b1232e0ded6fcd445309e7b0fad02bda0a44743",
    role: "chapter-recovery-receipt",
    available: false,
  },
  {
    id: "a05c2-scroll-plates",
    path: "manifests/a05c2-scroll-plates.json",
    bytes: 1521,
    sha256: "027726e318eac73e97071a9964ec688979cdf53496171171d96c597f01861a2c",
    role: "plate-composition-map",
    available: false,
  },
];

const PANELS: AssetRow[] = [
  { number: 21, bytes: 62096, sha256: "5c5c1d8024d8c9227b00c76b94d783941b800717d97f67846ac784fcdc1bd5b1" },
  { number: 22, bytes: 72840, sha256: "5725b0ca6a37714c87d45bb7ae96a2f4e974d6c873f3522b26f8fb6f7e1d11bf" },
  { number: 23, bytes: 72202, sha256: "679bdee5743d7240f0ce6a82cb39e8a00fd5a6f65ac6b830bf75427e04bc9812" },
  { number: 24, bytes: 76120, sha256: "67fbeac484395e24eae6847db03ad0f932d0d76f4f0a4809424aec64657a91c5" },
  { number: 25, bytes: 74216, sha256: "e021586860901ef9a7a3dd57e1d69915d04e38bda90fe96201c9e98860b8a8c8" },
  { number: 26, bytes: 63318, sha256: "b566a258689a4431207df7dcf238a73064dbbd94ce1bff80524c7db8bc624362" },
  { number: 27, bytes: 65478, sha256: "b6ea13b426ec6296458fdaba09d5315dc2c219d1a433436bbb419901c2973966" },
  { number: 28, bytes: 62942, sha256: "e4baa0a7557da0a27429d475ad8bc2a21691120ab270ba444de1bd3adf0753e9" },
  { number: 29, bytes: 60432, sha256: "8c17c2e9cd373e474c41c4f10a923a05f311faaafaaf7e3f61c8d9e48c6da51e" },
  { number: 30, bytes: 58600, sha256: "04a4929709c5fc460eca77ab8ae6085eff1b3dd01b93323a18037e7ca03f491f" },
  { number: 31, bytes: 91118, sha256: "f3c8127a17f9a7b4fa232e9eb8ea4811e2858814cebe28d6ec335fe41569c67e" },
  { number: 32, bytes: 76592, sha256: "d2003ecc64afb06fb556963dfed07bf07696154a7ae40e90173f0a64bc4158a0" },
  { number: 33, bytes: 81630, sha256: "119fcbd394fb961ab269b1c53264e52a145465677b8d1af4701595d6a83c061c" },
  { number: 34, bytes: 87252, sha256: "c3dacbccbf11db0f19f56e69f7c4f93225073c635c261953ed6a2af8a84f2976" },
  { number: 35, bytes: 68248, sha256: "882c96aaf9fd42343f97cbc8ef430c2afb3c3d7bd9b07a9b00d9b1c92c143a08" },
  { number: 36, bytes: 56150, sha256: "d040ce34b5d8bdc64b1c1b57f7585cfc6dde8d6b0c90eefe803eb87fc5ddc17b" },
  { number: 37, bytes: 71496, sha256: "8f22e3f7cab0b433abe17d563671741e84abc088eaa225c0faa6e1fec7e9f285" },
  { number: 38, bytes: 63316, sha256: "f4dc5cfef0d78e1deb57faf8046b17feb46593f325011c6805f2d5be918dcf39" },
  { number: 39, bytes: 53550, sha256: "fac92fa56d263d173c1c97a9ae89b15234c45f570d9ca43203977d598b36347b" },
  { number: 40, bytes: 74456, sha256: "a7a3320d2f5973715c7f5a61fa782f0abe5870213a72050491a96bdfeda3a27e" },
];

const PLATES: PlateRow[] = [
  { ordinal: 1, bytes: 349896, sha256: "3a438b907da64a5267504eb3f0a193bf56d7107f118443c4f097762cddd82876" },
  { ordinal: 2, bytes: 297332, sha256: "284082dc4f0c8bda511b5d70ab2f1b8fcbb193c4fc410842913828acaae3b28f" },
  { ordinal: 3, bytes: 382194, sha256: "32152a5589266eeb7d79c9b9fbfa49ec281252cf747bcb887140fda58ae13a55" },
  { ordinal: 4, bytes: 304132, sha256: "c46f6978c15f268b2c1aa812e47a61393a7b56ae71b0b88a287d8d830361887c" },
];

export const BURN_PROTOCOL_EPISODE_5_CHAPTER_2: CanonicalStoryChapter = {
  id: "E05-C2",
  number: 2,
  title: "The Mother",
  complete: true,
  openingPanelId: "E05-C2-P21",
  terminalPanelId: "E05-C2-P40",
  previousPanelId: "E05-C1-P20",
  nextPanelId: "E05-C3-P41",
  panels: PANELS.map((row, index) => {
    const panelId = `E05-C2-P${String(row.number).padStart(2, "0")}`;
    return {
      id: panelId,
      ordinal: index + 1,
      chapterId: "E05-C2",
      previousPanelId: row.number === 21
        ? "E05-C1-P20"
        : `E05-C2-P${String(row.number - 1).padStart(2, "0")}`,
      nextPanelId: row.number === 40
        ? "E05-C3-P41"
        : `E05-C2-P${String(row.number + 1).padStart(2, "0")}`,
      asset: {
        id: `asset:${panelId}`,
        path: `site/assets/art/A05C2/panels/${panelId}.webp`,
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
          "a05c2-lettering-source",
          "q01-dialogue-parity",
        ],
        reason: "The exact Episode 5 and A05C2 lettering bytes are not present in this repository. Canonical captions, dialogue, sound effects, and alt text cannot be reconstructed from parity or causal ledgers.",
      },
    };
  }),
  plates: PLATES.map((row) => {
    const plateId = `A05C2-plate-${String(row.ordinal).padStart(2, "0")}`;
    return {
      id: plateId,
      ordinal: row.ordinal,
      chapterId: "E05-C2",
      asset: {
        id: `asset:${plateId}`,
        path: `site/assets/art/A05C2/plates/${plateId}.webp`,
        bytes: row.bytes,
        sha256: row.sha256,
        mimeType: "image/webp" as const,
        availability: "manifested-external" as const,
        visualStanding: "q02-review-required" as const,
      },
      panelMapping: {
        status: "source-required" as const,
        expectedSourceReceiptIds: ["a05c2-scroll-plates"],
        reason: "The exact A05C2 scroll-plate composition map is not present in this repository. Plate-to-panel ranges cannot be inferred from asset order.",
      },
    };
  }),
};

export const BURN_PROTOCOL_THROUGH_EPISODE_5_CHAPTER_2_SOURCE = appendBurnProtocolChapter(
  BURN_PROTOCOL_THROUGH_EPISODE_5_CHAPTER_1_SOURCE,
  {
    identity: {
      id: "burn-protocol",
      title: "The Burn Protocol through Episode 5, Chapter 2 — The Song / The Mother",
      description: "The corpus-native Burn cartridge through Episode 5, Chapter 2, represented as two hundred eighty ordered panel positions, fifty-six plate assets, exact available source receipts, and one inherited source-required panel asset without simulation or invented branching.",
      author: "The Burn Project",
      version: "0.12.0",
    },
    storyVersion: "0.12.0",
    sourceReceipts: EPISODE_5_CHAPTER_2_RECEIPTS,
    missingRequiredReceiptIds: [
      ...BURN_PROTOCOL_THROUGH_EPISODE_5_CHAPTER_1_SOURCE.estate.missingRequiredReceiptIds,
      "a05c2-lettering-source",
      "a05c2-scroll-plates",
    ],
    boundary: "The fixed panel sequence is explicit from E01-C1-P01 through E05-C2-P40, including the E04-to-E05 series seam, the E05-C1-to-E05-C2 chapter seam, 280 panel positions, 279 exact panel asset receipts, 56 exact plate asset receipts, and the inherited source-required panel asset at E03-C2-P31. Canonical text and plate mappings remain blocked until their source bytes are supplied. The next canonical panel is E05-C3-P41.",
    episodeId: "E05",
    nextChapterId: "E05-C3",
    chapter: BURN_PROTOCOL_EPISODE_5_CHAPTER_2,
    notes: {
      implementationPurpose: "Append Episode 5 Chapter 2 through the same ordinary chapter amendment while preserving the stable source plane, fixed authority, and inherited media-custody refusal.",
      noSimulation: true,
      noChoices: true,
      stableSeriesIdentity: "burn-protocol",
      canonicalSeams: [
        "E04-C3-P60 -> E05-C1-P01",
        "E05-C1-P20 -> E05-C2-P21",
      ],
      nextCanonicalPanelId: "E05-C3-P41",
      sourceAuthority: {
        canonical: "source/episodes/episode-05.json",
        compiled: "site/data/episode-05.json",
        script: "scripts/episode-05-nursery-world.md",
        chapter: "source/art/A05C2/chapter.json",
        lettering: "source/art/A05C2/lettering.json",
        panelArt: "source/art/A05C2/panel-art.json",
        provenance: "source/art/A05C2/provenance.json",
        recovery: "manifests/a05c2-recovery.json",
        plateMap: "manifests/a05c2-scroll-plates.json",
        audit: [
          "manifests/validation-report-v0.60.0.json",
          "manifests/q01-dialogue-parity.json",
          "manifests/v0.62.0-file-manifest.json",
        ],
      },
      inheritedAssetLedgerGap: {
        id: "asset:E03-C2-P31",
        path: "site/assets/art/A03C2/panels/E03-C2-P31.webp",
        expectedBytes: 156208,
        requiredReceiptId: "a03c2-art-manifest",
        reason: "Exact SHA-256 remains unavailable; the A05C2 amendment neither removes nor resolves the inherited custody gap.",
      },
    },
  },
);
