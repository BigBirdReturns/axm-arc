import type {
  CanonicalStoryChapter,
  CanonicalStoryEpisode,
  CanonicalStorySourceReceipt,
} from "../canonical-story/types.js";
import { appendBurnProtocolEpisode } from "./assembly.js";
import { BURN_PROTOCOL_EPISODE_1_SOURCE } from "./chapter-3.js";

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

interface ChapterDefinition {
  id: string;
  number: number;
  title: string;
  artCode: string;
  firstPanel: number;
  lastPanel: number;
  previousPanelId: string;
  nextPanelId: string;
  letteringReceiptId: string;
  plateReceiptId: string;
  panels: AssetRow[];
  plates: PlateRow[];
}

const EPISODE_2_RECEIPTS: CanonicalStorySourceReceipt[] = [
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
    id: "episode-02-panel-manifest",
    path: "manifests/episode-02-panel-manifest.csv",
    bytes: 9956,
    sha256: "22ae5eadd26deb629a010271d0709e294d0da931384e18ea407985f9a3f2f397",
    role: "episode-panel-manifest",
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
  {
    id: "a02c2-lettering",
    path: "manifests/a02c2-lettering.json",
    bytes: 24307,
    sha256: "3422cd714a5cf1e302754c2832a75b9f214d3f7d6f92fdbed9c58e7357f77d77",
    role: "canonical-lettering",
    available: false,
  },
  {
    id: "a02c2-scroll-plates",
    path: "manifests/a02c2-scroll-plates.json",
    bytes: 1521,
    sha256: "b4e4f668938584ef47ec7bdca8cfcd9405aadec8cda96d5534a222b0920e3122",
    role: "plate-composition-map",
    available: false,
  },
  {
    id: "a02c2-art-audit",
    path: "manifests/a02c2-art-audit.json",
    bytes: 45988,
    sha256: "a3794505f1e07b0706561f6b5dbac8b104c8a919bcddff782df3b3b522ed4278",
    role: "chapter-art-audit",
    available: false,
  },
  {
    id: "a02c2-art-manifest",
    path: "manifests/a02c2-art-manifest.csv",
    bytes: 3940,
    sha256: "85e45b8223017e76e113062f0215d347eaad216c34d0248c5b8b394c1969dbcd",
    role: "chapter-art-manifest",
    available: false,
  },
  {
    id: "a02c3-lettering",
    path: "manifests/a02c3-lettering.json",
    bytes: 23186,
    sha256: "792d924a09398e8f599b069b99d788f3118ef20a920c220926f372a976708b20",
    role: "canonical-lettering",
    available: false,
  },
  {
    id: "a02c3-scroll-plates",
    path: "manifests/a02c3-scroll-plates.json",
    bytes: 1521,
    sha256: "f4ed900dc96ffc3f3a4524c6145dd41889494dcf51da6a0bb5c55dd58509f51e",
    role: "plate-composition-map",
    available: false,
  },
  {
    id: "a02c3-art-audit",
    path: "manifests/a02c3-art-audit.json",
    bytes: 75253,
    sha256: "234c7d53307da4ad8a672e0712f6997bf6edb884ba759bbaebc55764113e3cde",
    role: "chapter-art-audit",
    available: false,
  },
  {
    id: "a02c3-art-manifest",
    path: "manifests/a02c3-art-manifest.csv",
    bytes: 3940,
    sha256: "ef2ae5c0fb30dc3899c9a0930e7fea06d0fbd8765f87178ca7b89a23715a04b3",
    role: "chapter-art-manifest",
    available: false,
  },
];

const A02C1_PANELS: AssetRow[] = [
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

const A02C1_PLATES: PlateRow[] = [
  { ordinal: 1, bytes: 345772, sha256: "bdfebd3332059610d1c12c02505c82194ed03910a0cd73fc2d5641bb6aae5bfe" },
  { ordinal: 2, bytes: 315546, sha256: "07820ebfcd575174ba176ffbeef88f89f579d5928ae640f6a1a2d01d70420090" },
  { ordinal: 3, bytes: 331620, sha256: "9e688808f1f0424ac31e45e0249ab87bd5797a12395a050395238e229a08a7a5" },
  { ordinal: 4, bytes: 325786, sha256: "4557c376f781f38b98f3f044caa529e9214bb0ea3749a0ae6afddd25aa935c3d" },
];

const A02C2_PANELS: AssetRow[] = [
  { number: 21, bytes: 69244, sha256: "5bbef10435e52ffd600c53fd04361d3f73bb3ea35bef6f0fba1d1d79e36299ec" },
  { number: 22, bytes: 85958, sha256: "b44938dd034c64dca0f0afd9fb014da079a868f4764658f395e9040faa149bb4" },
  { number: 23, bytes: 86294, sha256: "4b58d8e3dfa16b3220836745032088b94befc91730aafe4e3b44bb168308acc4" },
  { number: 24, bytes: 92806, sha256: "e41a98a7bd8978d402a58de56e12f4ffc1afaedfdc406a54a01acba00b2825f9" },
  { number: 25, bytes: 68706, sha256: "bfa85933e4ff0ebfbe22666d699484530030f41171e7ad420643d546ead40302" },
  { number: 26, bytes: 80406, sha256: "81999ea0d42632584026559febcf55b27ea82701853cf0589cc0ba963e378b15" },
  { number: 27, bytes: 88478, sha256: "f166d55b0e035ed46b9712f9086ebaf852c51c6273bd6a6666fcb44dd27f5253" },
  { number: 28, bytes: 72230, sha256: "64c9139c5e27f28db3ecdf5f665447172fd5fd97aec55793d18ff491845c453a" },
  { number: 29, bytes: 84340, sha256: "355116909eb09a777c9d86ff8693492696eb85ad55bad5045cdc6d7b61f0fbd5" },
  { number: 30, bytes: 89482, sha256: "95c7c498f92c8fa5a9d84d0b5a7c6a2528bd7eda1a5f84fadcb0c200f8c2223f" },
  { number: 31, bytes: 74776, sha256: "9184342db342577fbb795fabf2f2bb5aa92938467f9d8d135dfc47f6c7d5ac8f" },
  { number: 32, bytes: 87014, sha256: "4a542726d3223993f76f1343bb3f8075127b903941f0861f1480fd133601a048" },
  { number: 33, bytes: 80638, sha256: "e4b87adfbb9da376c6d90b6c308d3af6f9810ee580bd1d95681c9d1071c144a8" },
  { number: 34, bytes: 86260, sha256: "1aaaf82eba249b5084532ba6e1ae29124448c7eca8bdab60ba1f413331ce96fa" },
  { number: 35, bytes: 88564, sha256: "d4f855f4bc2e13a29c1410c4f46ddb4de2fe812f2afbe817ea181514ee56da9c" },
  { number: 36, bytes: 81632, sha256: "61ecc366f707da05b12619e09c5d9a3ad51ba9aaaa7599770dffba67c04eaba2" },
  { number: 37, bytes: 101074, sha256: "300a31c4ae66a9c954ab2214bca9f4a4f5ff1e1d6df2753b6399505a71a9e662" },
  { number: 38, bytes: 94032, sha256: "0a9c84a85039ba251197a992764361965dd9a4a58d8bc0feb2d5d04794a66836" },
  { number: 39, bytes: 94092, sha256: "2202975ab311356d00785a79b24a7a8bfb0dce776f00325ff7dd9e63eb0dfc91" },
  { number: 40, bytes: 121058, sha256: "7b1f1063e71a1cdf9067d6d083c33f2eae316694fa18ce5ce4a6d170ed7b3f9f" },
];

const A02C2_PLATES: PlateRow[] = [
  { ordinal: 1, bytes: 302722, sha256: "7b846fa825b01e22f6883f6d81e9aa26145379055ef3a6b04dc4c44e25c04069" },
  { ordinal: 2, bytes: 319244, sha256: "29d3a6c289d52355396bed5769c30bbf5f7bfb50abfa5d4c49b863734cc32ef6" },
  { ordinal: 3, bytes: 323404, sha256: "3b114b31b82539e7763d823d766ddd113787230810a189dfee74071b1260e4e4" },
  { ordinal: 4, bytes: 387846, sha256: "6b0ca0c52e0370a3b9dad8600b07a1b606c35caa2dbaa1869a09a1a139c7d85a" },
];

const A02C3_PANELS: AssetRow[] = [
  { number: 41, bytes: 80828, sha256: "993b1f3d53e60ab106b1d31a95891787968713aca3632ca4db9142bec5128792" },
  { number: 42, bytes: 82110, sha256: "12bef2fef029cedcda83b4d1fe9558e1f25923d751751eb81e58d465c27c0956" },
  { number: 43, bytes: 74938, sha256: "df5d2944c83ec89300ee3633818131a4454d0fb76c613db55a4fcb50541295cf" },
  { number: 44, bytes: 78682, sha256: "fcbf5a8211562eb3fee346c65b914b0966a8984b54a236ab9644057a2d7daec8" },
  { number: 45, bytes: 78266, sha256: "8c00148c0618898cd3c815144d328f1a0ca18fd786c2f311239fc1449d979e61" },
  { number: 46, bytes: 74800, sha256: "27b184bcc1b41027e8ba5b7590b8b34eed5adaac5dcda5bd8013e257b5bac24d" },
  { number: 47, bytes: 76988, sha256: "8860398d78b6c423a863d6bba56867961ec96eaef288b01d533f92a62218cd90" },
  { number: 48, bytes: 77908, sha256: "ce39390a466ab686d3ab1a3d9dc488884076bd2a8b02a89c841e286e0845d345" },
  { number: 49, bytes: 69220, sha256: "58551928c19f3263d5ed54f10ee07376b2009e3c73b24ad015e25888640c605f" },
  { number: 50, bytes: 83650, sha256: "6ecec91c0f18bc1e7923d745f9c5595a0757d2d5ad8d24822ce174e243bb370d" },
  { number: 51, bytes: 84024, sha256: "8e1813297d41b6edb7565babea900d95e4aebb8b8590cfccee9524561d102eda" },
  { number: 52, bytes: 72516, sha256: "451463909a19b05f5c5d778b96999ddc0672202596aebf59542dae87c9704f17" },
  { number: 53, bytes: 75384, sha256: "c9ce2a1a0a8173a93ff912cbf833ccaf350304b304542153cbe9d4211ea750cf" },
  { number: 54, bytes: 69516, sha256: "0ff9b27c64be75d7a372c343fa39ab99b87e508cd7515b305d17acfc75f93ba4" },
  { number: 55, bytes: 80354, sha256: "478be9badd31a758d5b5105d3b56abe82e86035ac5321682dbd661569d730c54" },
  { number: 56, bytes: 95096, sha256: "c4642941ea62a3faaeea2b1e3d3b382a219d6ea17bc755664e846f853d10810f" },
  { number: 57, bytes: 83558, sha256: "fc985056019ab0ec64cecdc7cdfc8d4987e2f55afeb890c4395774c36a7e0a97" },
  { number: 58, bytes: 76422, sha256: "a97c7ef7cbd1842f0b245106ba88305fa49165384b47aa665b21b8149cefcc2c" },
  { number: 59, bytes: 72732, sha256: "375dba9086ef8ba785d336d9f538ad6504670074cd9db1f9234391135fa4450f" },
  { number: 60, bytes: 94642, sha256: "bced5683af28facb18ca02a1e4c4cc833995f7523c882f7dd1e35517a059471e" },
];

const A02C3_PLATES: PlateRow[] = [
  { ordinal: 1, bytes: 295404, sha256: "8eaa814951a861faaad7c993e55419205029eeaf663f4ca1041ab811a9a43e6d" },
  { ordinal: 2, bytes: 295096, sha256: "14c6af2517073c67b6981244398e226d62fbf4b46308d8f678ed7f19db3be986" },
  { ordinal: 3, bytes: 288794, sha256: "959fc5e900442fdeef3bda2162f559c70a5b098a7894d791f6be6f60014dce88" },
];

function buildChapter(definition: ChapterDefinition): CanonicalStoryChapter {
  return {
    id: definition.id,
    number: definition.number,
    title: definition.title,
    complete: true,
    openingPanelId: `${definition.id}-P${String(definition.firstPanel).padStart(2, "0")}`,
    terminalPanelId: `${definition.id}-P${String(definition.lastPanel).padStart(2, "0")}`,
    previousPanelId: definition.previousPanelId,
    nextPanelId: definition.nextPanelId,
    panels: definition.panels.map((row, index) => {
      const panelId = `${definition.id}-P${String(row.number).padStart(2, "0")}`;
      return {
        id: panelId,
        ordinal: index + 1,
        chapterId: definition.id,
        previousPanelId: row.number === definition.firstPanel
          ? definition.previousPanelId
          : `${definition.id}-P${String(row.number - 1).padStart(2, "0")}`,
        nextPanelId: row.number === definition.lastPanel
          ? definition.nextPanelId
          : `${definition.id}-P${String(row.number + 1).padStart(2, "0")}`,
        asset: {
          id: `asset:${panelId}`,
          path: `site/assets/art/${definition.artCode}/panels/${panelId}.webp`,
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
            definition.letteringReceiptId,
            "q01-dialogue-parity",
          ],
          reason: `The exact Episode 2 and ${definition.artCode} lettering bytes are not present in this repository. Canonical captions, dialogue, sound effects, and alt text cannot be reconstructed from derivative ledgers.`,
        },
      };
    }),
    plates: definition.plates.map((row) => {
      const plateId = `${definition.artCode}-plate-${String(row.ordinal).padStart(2, "0")}`;
      return {
        id: plateId,
        ordinal: row.ordinal,
        chapterId: definition.id,
        asset: {
          id: `asset:${plateId}`,
          path: `site/assets/art/${definition.artCode}/plates/${plateId}.webp`,
          bytes: row.bytes,
          sha256: row.sha256,
          mimeType: "image/webp" as const,
          availability: "manifested-external" as const,
          visualStanding: "q02-review-required" as const,
        },
        panelMapping: {
          status: "source-required" as const,
          expectedSourceReceiptIds: [definition.plateReceiptId],
          reason: `The exact ${definition.artCode} scroll-plate composition map is not present. Plate-to-panel ranges cannot be inferred from asset order.`,
        },
      };
    }),
  };
}

export const BURN_PROTOCOL_EPISODE_2: CanonicalStoryEpisode = {
  id: "E02",
  number: 2,
  title: "Ghosts of Then",
  complete: true,
  nextChapterId: null,
  chapters: [
    buildChapter({
      id: "E02-C1",
      number: 1,
      title: "Reunion",
      artCode: "A02C1",
      firstPanel: 1,
      lastPanel: 20,
      previousPanelId: "E01-C3-P60",
      nextPanelId: "E02-C2-P21",
      letteringReceiptId: "a02c1-lettering",
      plateReceiptId: "a02c1-scroll-plates",
      panels: A02C1_PANELS,
      plates: A02C1_PLATES,
    }),
    buildChapter({
      id: "E02-C2",
      number: 2,
      title: "Earth and Titan",
      artCode: "A02C2",
      firstPanel: 21,
      lastPanel: 40,
      previousPanelId: "E02-C1-P20",
      nextPanelId: "E02-C3-P41",
      letteringReceiptId: "a02c2-lettering",
      plateReceiptId: "a02c2-scroll-plates",
      panels: A02C2_PANELS,
      plates: A02C2_PLATES,
    }),
    buildChapter({
      id: "E02-C3",
      number: 3,
      title: "Discovery's Echo",
      artCode: "A02C3",
      firstPanel: 41,
      lastPanel: 60,
      previousPanelId: "E02-C2-P40",
      nextPanelId: "E03-C1-P01",
      letteringReceiptId: "a02c3-lettering",
      plateReceiptId: "a02c3-scroll-plates",
      panels: A02C3_PANELS,
      plates: A02C3_PLATES,
    }),
  ],
};

export const BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE = appendBurnProtocolEpisode(
  BURN_PROTOCOL_EPISODE_1_SOURCE,
  {
    identity: {
      id: "burn-protocol",
      title: "The Burn Protocol: Episodes 1–2 — The Broken Road / Ghosts of Then",
      description: "The corpus-native Burn cartridge through Episode 2, represented as one hundred twenty ordered panel slots and the exact currently recovered scroll-plate asset ledger without simulation or invented branching.",
      author: "The Burn Project",
      version: "0.4.0",
    },
    storyVersion: "0.4.0",
    sourceReceipts: EPISODE_2_RECEIPTS,
    canonicalSourceReceiptIds: [
      "episode-01-source",
      "episode-02-source",
    ],
    compiledSourceReceiptIds: [
      "episode-01-compiled",
      "episode-02-compiled",
    ],
    missingRequiredReceiptIds: [
      ...BURN_PROTOCOL_EPISODE_1_SOURCE.estate.missingRequiredReceiptIds,
      "episode-02-source",
      "episode-02-compiled",
      "a02c1-lettering",
      "a02c1-scroll-plates",
      "a02c2-lettering",
      "a02c2-scroll-plates",
      "a02c3-lettering",
      "a02c3-scroll-plates",
      "a02c3-art-manifest",
    ],
    boundary: "Panel order, the E01-to-E02 seam, both Episode 2 chapter seams, and exact manifested custody for all sixty Episode 2 panels and eleven recovered Episode 2 plate rows are explicit through E02-C3-P60. The exact A02C3 plate-04 asset row, canonical text, and all plate mappings remain blocked until the named source bytes are supplied.",
    episode: BURN_PROTOCOL_EPISODE_2,
    notes: {
      implementationPurpose: "Append a complete second episode as ordinary episode, chapter, panel, plate, receipt, and seam pieces under the existing Burn source plane.",
      noSimulation: true,
      noChoices: true,
      stableSeriesIdentity: "burn-protocol",
      canonicalSeams: [
        "E01-C3-P60 -> E02-C1-P01",
        "E02-C1-P20 -> E02-C2-P21",
        "E02-C2-P40 -> E02-C3-P41",
      ],
      nextCanonicalPanelId: "E03-C1-P01",
      assetLedgerGap: {
        id: "A02C3-plate-04",
        path: "site/assets/art/A02C3/plates/A02C3-plate-04.webp",
        expectedBytes: 332220,
        requiredReceiptId: "a02c3-art-manifest",
        reason: "The active extracted ledger exposed the asset path and byte count but not its exact SHA-256 row. No placeholder digest has been invented.",
      },
    },
  },
);
