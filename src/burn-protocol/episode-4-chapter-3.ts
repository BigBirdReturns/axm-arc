import type {
  CanonicalStoryChapter,
  CanonicalStorySourceReceipt,
} from "../canonical-story/types.js";
import { appendBurnProtocolChapter } from "./assembly.js";
import { BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_2_SOURCE } from "./episode-4-chapter-2.js";

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

const EPISODE_4_CHAPTER_3_RECEIPTS: CanonicalStorySourceReceipt[] = [
  {
    id: "a04c3-chapter-source",
    path: "source/art/A04C3/chapter.json",
    bytes: 2016,
    sha256: "b2ff5fbf635b677684a3c3eb843fc358a0be101edaa1610fb05966b4e92cf814",
    role: "chapter-source",
    available: false,
  },
  {
    id: "a04c3-lettering-source",
    path: "source/art/A04C3/lettering.json",
    bytes: 28761,
    sha256: "4f13e90c9616cd1e13025ac4e5c51b497593ce1a65f08dd36c384feb1e0d4012",
    role: "canonical-lettering",
    available: false,
  },
  {
    id: "a04c3-panel-art-source",
    path: "source/art/A04C3/panel-art.json",
    bytes: 18482,
    sha256: "0b961a66176cb094587eb6525386305fb0969a78bdfeb95b994a30fcf5aa1261",
    role: "chapter-panel-art-source",
    available: false,
  },
  {
    id: "a04c3-provenance",
    path: "source/art/A04C3/provenance.json",
    bytes: 10094,
    sha256: "3188d0e405e6ce6f8fe9c97e50da9fc025a80d842919536cbbe7dc55a90318fc",
    role: "chapter-provenance",
    available: false,
  },
  {
    id: "a04c3-recovery",
    path: "manifests/a04c3-recovery.json",
    bytes: 5921,
    sha256: "fb132caaea4cb394fc8e13f827fd631bde5c5f743ba2f76cbfa6b413dc22b19b",
    role: "chapter-recovery-receipt",
    available: false,
  },
  {
    id: "a04c3-scroll-plates",
    path: "manifests/a04c3-scroll-plates.json",
    bytes: 1521,
    sha256: "96d12414747c00f6073016f2ddcff5b5fa45f4f167b610d4a7087612f98fbdd8",
    role: "plate-composition-map",
    available: false,
  },
];

const PANELS: AssetRow[] = [
  { number: 41, bytes: 105096, sha256: "ba23bf753e07a318fd54659b0bfebdd2ebbc96669bc86a82a5ee399b776d5cc8" },
  { number: 42, bytes: 69728, sha256: "7f4ca65eb2497eac245d10cdca3369b5346683198856fb5024c28cb5e0d26b84" },
  { number: 43, bytes: 113284, sha256: "2416ab7e3d9dcadae32506048937cd13cabce5fcf97d0d1baaf909fb90477210" },
  { number: 44, bytes: 67112, sha256: "bdf86ad4a0d2928d165d53c8970674f285c2f52a8aebd04129394319f181de10" },
  { number: 45, bytes: 90474, sha256: "3ae8dc300854f6bf8827ade59c2e7f7a5f44de102920efbbdb8673ac59a7578a" },
  { number: 46, bytes: 71644, sha256: "905db51c94c90bc11b7c0ea355c1f0b76a68a03af7710639479c62a895dd812e" },
  { number: 47, bytes: 125500, sha256: "3e9fb09ba36c222af4f8ae0d354ede564fde12fc3b8cafdf0be42f72581207c4" },
  { number: 48, bytes: 102094, sha256: "a0bdf1539c47f15150126f8ad0313730c16c0e5dfef73b10c1f8a9085a4ba956" },
  { number: 49, bytes: 101724, sha256: "a9d50fc0ea7f5acb767ab661ff3f79761e5bd79fd349fc17dafea7f1ed996e9d" },
  { number: 50, bytes: 100330, sha256: "6e02e1ac1be8cf3de42c529e36af6d705a351751e6cf1674f02f95dd0b677104" },
  { number: 51, bytes: 66900, sha256: "283b475bdd37ce7c0c3fb7ecf507e37fbb8e676d49e7f164dd3914d8b3cfb3a7" },
  { number: 52, bytes: 98196, sha256: "c0a7dcc6311c9d343c86d9b57871dce37004589e673d592b1a687129b63bff6e" },
  { number: 53, bytes: 56918, sha256: "a15e2c49df9ab9135d3c1c83ff47aea3ed86bce6c2220ec9b30f5a87175a0647" },
  { number: 54, bytes: 66760, sha256: "b2b4ab827dcddb9e877ae343f9fb09b6ad9728eee60c2a18f8dbd73422255d53" },
  { number: 55, bytes: 67678, sha256: "037cb1bcec99077d552f66291dbee2570833b2c83d91a9f96579259db6d3d1d9" },
  { number: 56, bytes: 91622, sha256: "c5fb929dd7b75a8fbb53f6347d29bba859fb10b059c549997a4185915b769c36" },
  { number: 57, bytes: 108872, sha256: "8ce93ed2fb1a89f2b5a1b9d9a00abfc40110adb2ed7be43c7c0765997d83a87d" },
  { number: 58, bytes: 90880, sha256: "ae469037cd8e0e4d1818a705a4e7afdda10b20a1ea9b1936d5945f849133f9ad" },
  { number: 59, bytes: 89330, sha256: "902e897cfd3b4a342ce9bee9a441617aa3893f03bd1455e634d666333418221c" },
  { number: 60, bytes: 105160, sha256: "0c2b8a54ba8e6e7ea9eb3de86a1ab1af6d79e15ba2de34193ef329488b7cb96d" },
];

const PLATES: PlateRow[] = [
  { ordinal: 1, bytes: 442138, sha256: "d86850d47dee3e6bb83d5c2742fa9220fbe5a0ef087b89cdc7eab86c4c2e4d4a" },
  { ordinal: 2, bytes: 490482, sha256: "3402cc7fbfa310f5c2362ca6f2f06fdb75b315ac8fe838d122fed0dbce6e6345" },
  { ordinal: 3, bytes: 359052, sha256: "b7a564f7144e2a17b5a98060ab84becec64d72cee7941fb7674821d98f278d53" },
  { ordinal: 4, bytes: 474020, sha256: "2b53efc4f8a1cc1d41468f405e4813b191a3c9a710ee9d9715b6929afaa93420" },
];

export const BURN_PROTOCOL_EPISODE_4_CHAPTER_3: CanonicalStoryChapter = {
  id: "E04-C3",
  number: 3,
  title: "The Dead Man's Checksum",
  complete: true,
  openingPanelId: "E04-C3-P41",
  terminalPanelId: "E04-C3-P60",
  previousPanelId: "E04-C2-P40",
  nextPanelId: "E05-C1-P01",
  panels: PANELS.map((row, index) => {
    const panelId = `E04-C3-P${String(row.number).padStart(2, "0")}`;
    return {
      id: panelId,
      ordinal: index + 1,
      chapterId: "E04-C3",
      previousPanelId: row.number === 41
        ? "E04-C2-P40"
        : `E04-C3-P${String(row.number - 1).padStart(2, "0")}`,
      nextPanelId: row.number === 60
        ? "E05-C1-P01"
        : `E04-C3-P${String(row.number + 1).padStart(2, "0")}`,
      asset: {
        id: `asset:${panelId}`,
        path: `site/assets/art/A04C3/panels/${panelId}.webp`,
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
          "a04c3-lettering-source",
          "q01-dialogue-parity",
        ],
        reason: "The exact Episode 4 and A04C3 lettering bytes are not present in this repository. Canonical captions, dialogue, sound effects, and alt text cannot be reconstructed from parity or causal ledgers.",
      },
    };
  }),
  plates: PLATES.map((row) => {
    const plateId = `A04C3-plate-${String(row.ordinal).padStart(2, "0")}`;
    return {
      id: plateId,
      ordinal: row.ordinal,
      chapterId: "E04-C3",
      asset: {
        id: `asset:${plateId}`,
        path: `site/assets/art/A04C3/plates/${plateId}.webp`,
        bytes: row.bytes,
        sha256: row.sha256,
        mimeType: "image/webp" as const,
        availability: "manifested-external" as const,
        visualStanding: "q02-review-required" as const,
      },
      panelMapping: {
        status: "source-required" as const,
        expectedSourceReceiptIds: ["a04c3-scroll-plates"],
        reason: "The exact A04C3 scroll-plate composition map is not present in this repository. Plate-to-panel ranges cannot be inferred from asset order.",
      },
    };
  }),
};

export const BURN_PROTOCOL_THROUGH_EPISODE_4_SOURCE = appendBurnProtocolChapter(
  BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_2_SOURCE,
  {
    identity: {
      id: "burn-protocol",
      title: "The Burn Protocol through Episode 4 — Fractured Allegiances",
      description: "The corpus-native Burn cartridge through complete Episode 4, represented as two hundred forty ordered panel positions, forty-eight plate assets, exact available source receipts, and one inherited source-required panel asset without simulation or invented branching.",
      author: "The Burn Project",
      version: "0.10.0",
    },
    storyVersion: "0.10.0",
    sourceReceipts: EPISODE_4_CHAPTER_3_RECEIPTS,
    missingRequiredReceiptIds: [
      ...BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_2_SOURCE.estate.missingRequiredReceiptIds,
      "a04c3-lettering-source",
      "a04c3-scroll-plates",
    ],
    boundary: "The complete fixed panel sequence through Episode 4 is explicit from E01-C1-P01 through E04-C3-P60, including every published series and chapter seam, 240 panel positions, 239 exact panel asset receipts, 48 exact plate asset receipts, and the inherited source-required panel asset at E03-C2-P31. Canonical text and plate mappings remain blocked until their source bytes are supplied. The next canonical panel is E05-C1-P01.",
    episodeId: "E04",
    episodeComplete: true,
    nextChapterId: null,
    chapter: BURN_PROTOCOL_EPISODE_4_CHAPTER_3,
    notes: {
      implementationPurpose: "Complete Episode 4 through the same ordinary chapter amendment while preserving the stable source plane, fixed authority, and inherited media-custody refusal.",
      noSimulation: true,
      noChoices: true,
      stableSeriesIdentity: "burn-protocol",
      canonicalSeams: [
        "E03-C3-P60 -> E04-C1-P01",
        "E04-C1-P20 -> E04-C2-P21",
        "E04-C2-P40 -> E04-C3-P41",
      ],
      nextCanonicalPanelId: "E05-C1-P01",
      sourceAuthority: {
        canonical: "source/episodes/episode-04.json",
        compiled: "site/data/episode-04.json",
        script: "scripts/episode-04-fractured-allegiances.md",
        chapter: "source/art/A04C3/chapter.json",
        lettering: "source/art/A04C3/lettering.json",
        plateMap: "manifests/a04c3-scroll-plates.json",
      },
      inheritedAssetLedgerGap: {
        id: "asset:E03-C2-P31",
        path: "site/assets/art/A03C2/panels/E03-C2-P31.webp",
        expectedBytes: 156208,
        requiredReceiptId: "a03c2-art-manifest",
        reason: "Exact SHA-256 remains unavailable; the A04C3 amendment neither removes nor resolves the inherited custody gap.",
      },
    },
  },
);
