import type {
  CanonicalStoryChapter,
  CanonicalStorySourceReceipt,
} from "../canonical-story/types.js";
import { appendBurnProtocolChapter } from "./assembly.js";
import { BURN_PROTOCOL_CHAPTER_1_SOURCE } from "./chapter-1.js";

interface PanelRow {
  number: number;
  bytes: number;
  sha256: string;
  location: string;
  actorIds: string[];
  summary: string;
}

const CHAPTER_2_RECEIPTS: CanonicalStorySourceReceipt[] = [
  {
    id: "a01c2-lettering",
    path: "manifests/a01c2-lettering.json",
    bytes: 19056,
    sha256: "fe2d36e4d26dee3d0d3b5e1d7f1da2819064e84c8ce0136512ae6a9489ff7e17",
    role: "canonical-lettering",
    available: false,
  },
  {
    id: "a01c2-scroll-plates",
    path: "manifests/a01c2-scroll-plates.json",
    bytes: 1521,
    sha256: "f2ba06488c4db7d21bb2afae2a4a2cbf77ba214c77e56e8f1a698a655bec1855",
    role: "plate-composition-map",
    available: false,
  },
  {
    id: "a01c2-art-audit",
    path: "manifests/a01c2-art-audit.json",
    bytes: 34419,
    sha256: "86cbe89f61df90d75b2fcb824e2c24d5281ae28e68e2b87ef2f4f59134684327",
    role: "chapter-art-audit",
    available: false,
  },
  {
    id: "a01c2-art-manifest",
    path: "manifests/a01c2-art-manifest.csv",
    bytes: 3940,
    sha256: "a2d4071e905631b1f6027803ea61ae1dd4760d602bfe775d1606b91fa4281681",
    role: "chapter-art-manifest",
    available: false,
  },
];

const PANELS: PanelRow[] = [
  { number: 19, bytes: 105536, sha256: "fc3827c7f4bd18bffe16b77a31a56eee2695bd40481bbdf92c5b8816f19e745f", location: "Book's rented repair bay", actorIds: ["BOOK", "BURNHAM"], summary: "Burnham opens the black box in a repair bay while Book works on his damaged ship." },
  { number: 20, bytes: 97610, sha256: "9dc25c9356b933f6a964d7ec08eb5f35d1a54ee497de0068bf5222a3a9e2f883", location: "Repair bay", actorIds: ["BOOK", "BURNHAM", "RECORDED_CAPTAIN", "RECORDED_OFFICER"], summary: "The black box shows a medical crew detecting an external subspace pulse just before its warp core exploded." },
  { number: 21, bytes: 93628, sha256: "ddbad894be39a99981aebbb7a2aeb06b3e0fef2f3995ac63af7787a380c1fae9", location: "Repair bay", actorIds: ["BOOK", "BURNHAM"], summary: "Burnham discovers that the medical ship failed 0.193 seconds after the official time of the Burn." },
  { number: 22, bytes: 98676, sha256: "11f2f18b7475061733b7c605f16a6f9a30aead1c3b90a38e9626bd005f073ee5", location: "Repair bay", actorIds: ["BOOK", "BURNHAM"], summary: "Book challenges the timestamp while Burnham explains that recorded pulsars can correct the damaged clock." },
  { number: 23, bytes: 94080, sha256: "5de4926b29530d4c7ed8bc7374e38c6924438aaaed8c857ac9a612de1d95d178", location: "Repair bay", actorIds: ["BOOK", "BURNHAM"], summary: "Burnham reconstructs pulsar timing from the black box but needs a modern independent beacon to verify it." },
  { number: 24, bytes: 99660, sha256: "b05db35eb30b65caaa19c070c271568a52bc0959cd847a081d6139d659927c29", location: "Repair bay", actorIds: ["BOOK", "BURNHAM", "VENN"], summary: "Emerald Chain officers arrive to acquire the black box as protected route data." },
  { number: 25, bytes: 111720, sha256: "db83e10e9fac7f2f469099aa19ac488650997be87f8eb09cb063bc5417f7a4d5", location: "Repair bay", actorIds: ["BOOK", "BURNHAM", "VENN"], summary: "Venn offers Book a valuable route key for the recorder, revealing the Chain's interest in historical routes rather than only the Burn mystery." },
  { number: 26, bytes: 103526, sha256: "3de85860ad5089e6f94c99f3127ebf30a1aebc3b67a59cce094885690ffc4284", location: "Repair bay", actorIds: ["BOOK", "BURNHAM", "VENN"], summary: "Book rejects a profitable route key because the Chain would gain permanent control of the recorder's route history." },
  { number: 27, bytes: 103406, sha256: "ccb3d050f97e3b23ed8833a0f9b0b0ad5e9620f8aa1338d3213f8c75b9537620", location: "Repair bay", actorIds: ["BOOK", "BURNHAM", "VENN"], summary: "Book and Burnham begin an escape while Venn orders her officers not to damage the recorder." },
  { number: 28, bytes: 122084, sha256: "974113257434ec95a887cf790c3eab4ab00c903a11623b78eb3c45288645f864", location: "Courier exchange", actorIds: ["BOOK", "BURNHAM"], summary: "Burnham and Book flee through the market as they realize the Chain is assembling a private route map from black boxes." },
  { number: 29, bytes: 112534, sha256: "3518032e0cf266b4392264e09b686437767e65a68cb9a023aec1dc7d71d85de8", location: "Market gantries", actorIds: ["BOOK", "BURNHAM"], summary: "Burnham recognizes an ancient Starfleet emergency hatch that may provide an escape route." },
  { number: 30, bytes: 63068, sha256: "5228b29513b0a5026b348c1102efcba3bde1e1f35d4a7473c266a19255f72d6c", location: "Sealed maintenance hatch", actorIds: ["BOOK", "BURNHAM"], summary: "Burnham opens a powerless Starfleet emergency passage using a mechanical standard embedded in the recorder casing." },
  { number: 31, bytes: 106952, sha256: "42d1b2bb26175d870ec178fa94cafd0d60498edd5089a8551b599fd31dd453a2", location: "Service artery", actorIds: ["BOOK", "BURNHAM"], summary: "In a service tunnel, Book questions Burnham's decision to trade away the beacon she hoped Discovery might follow." },
  { number: 32, bytes: 96032, sha256: "d6dff19ba0d8f429c2a1cbec19060121474b31bb6dbd6e731a4138dfb6281cc6", location: "Service artery exit", actorIds: ["BOOK", "BURNHAM", "VENN"], summary: "Venn intercepts them at the old passage exit and still frames the confrontation as a transaction." },
  { number: 33, bytes: 109784, sha256: "7e27763acb4d26664eb195ca31e1058ea83b9b42faf5f70dfc46e5814949ba9c", location: "Docking platform", actorIds: ["BURNHAM", "VENN"], summary: "Burnham and Venn argue over whether dangerous route knowledge should be published or privately controlled." },
  { number: 34, bytes: 119520, sha256: "600dee714e84c4f050c47afe377e42948d33b022b0d77763dc1c895189e30978", location: "Docking platform", actorIds: ["BOOK", "BURNHAM", "VENN"], summary: "Book disarms Venn with a cargo tether by exploiting her position on the loading platform." },
  { number: 35, bytes: 125312, sha256: "1f1307624f0c2478bce6f3102762b1a96081fc1fc7608dcfcb6338c4e3848ff5", location: "Book's ship", actorIds: ["BOOK", "BURNHAM"], summary: "As they launch under pursuit, Book reveals a distant relay operator who may have the timing data Burnham needs." },
  { number: 36, bytes: 106338, sha256: "a620e34ac9b66778d30e4776f1fa3e351776b8d88cfc8ab626312426f6d95d61", location: "Book's ship, cockpit", actorIds: ["BOOK", "BURNHAM"], summary: "Burnham proposes using the black box's pre-Burn inertial record to cross a dangerous scar by an approach no modern ship uses." },
  { number: 37, bytes: 117204, sha256: "ad8c8e8b9fc283d03ff2d954b67abc09dbef8d70c086552471960519af57ba73", location: "Subspace corridor", actorIds: ["BOOK", "BURNHAM"], summary: "Burnham and Book navigate a distorted corridor using the old recorder while Chain ships refuse to follow." },
  { number: 38, bytes: 127862, sha256: "3e02f535daa1dc947f1bf15d7b2e9a63daaa3adb35a566ae41f23b955f4dbffc", location: "Book's ship, cockpit", actorIds: ["BOOK", "BURNHAM"], summary: "After the dangerous crossing succeeds, Book concedes the recorder was useful while Burnham insists on precise causal language." },
];

const PLATES = [
  { ordinal: 1, bytes: 372686, sha256: "90afb55a7fa7b8b9d07a285c28813ad74d893f57510edf95cf54a51deeccaf9a" },
  { ordinal: 2, bytes: 416748, sha256: "e8d899fb1d2c2185e007e680d35b77772846c791df51d3bbbe97ab6dd5240368" },
  { ordinal: 3, bytes: 373672, sha256: "2b1d9ecb4e943000d1daeb4697a641043f238b5904ba718993c333a2b4b79301" },
  { ordinal: 4, bytes: 468824, sha256: "e0174242a1822305314ed511f620d9133cab4bcd5441e49fcfb7b65fad432a1b" },
];

export const BURN_PROTOCOL_CHAPTER_2: CanonicalStoryChapter = {
  id: "E01-C2",
  number: 2,
  title: "The Black Box",
  complete: true,
  openingPanelId: "E01-C2-P19",
  terminalPanelId: "E01-C2-P38",
  previousPanelId: "E01-C1-P18",
  nextPanelId: "E01-C3-P39",
  panels: PANELS.map((row, index) => {
    const panelId = `E01-C2-P${String(row.number).padStart(2, "0")}`;
    return {
      id: panelId,
      ordinal: index + 1,
      chapterId: "E01-C2",
      previousPanelId: row.number === 19
        ? "E01-C1-P18"
        : `E01-C2-P${String(row.number - 1).padStart(2, "0")}`,
      nextPanelId: row.number === 38
        ? "E01-C3-P39"
        : `E01-C2-P${String(row.number + 1).padStart(2, "0")}`,
      asset: {
        id: `asset:${panelId}`,
        path: `site/assets/art/A01C2/panels/${panelId}.webp`,
        bytes: row.bytes,
        sha256: row.sha256,
        mimeType: "image/webp" as const,
        availability: "manifested-external" as const,
        visualStanding: "q02-review-required" as const,
      },
      text: {
        status: "source-required" as const,
        expectedSourceReceiptIds: [
          "episode-01-source",
          "episode-01-compiled",
          "a01c2-lettering",
          "q01-dialogue-parity",
        ],
        reason: "The exact Episode 1 and A01C2 lettering bytes are not present in this repository. Canonical captions, dialogue, sound effects, and alt text cannot be reconstructed from derivative ledgers.",
      },
      auditProjection: {
        authority: "derived-q01-q02" as const,
        location: row.location,
        actorIds: [...row.actorIds],
        summary: row.summary,
        sourceReceiptIds: ["q01-causal-ledger", "a01c2-art-audit"],
      },
    };
  }),
  plates: PLATES.map((row) => {
    const plateId = `A01C2-plate-${String(row.ordinal).padStart(2, "0")}`;
    return {
      id: plateId,
      ordinal: row.ordinal,
      chapterId: "E01-C2",
      asset: {
        id: `asset:${plateId}`,
        path: `site/assets/art/A01C2/plates/${plateId}.webp`,
        bytes: row.bytes,
        sha256: row.sha256,
        mimeType: "image/webp" as const,
        availability: "manifested-external" as const,
        visualStanding: "q02-review-required" as const,
      },
      panelMapping: {
        status: "source-required" as const,
        expectedSourceReceiptIds: ["a01c2-scroll-plates"],
        reason: "The exact A01C2 scroll-plate composition map is not present. Plate-to-panel ranges cannot be inferred from asset order.",
      },
    };
  }),
};

export const BURN_PROTOCOL_THROUGH_CHAPTER_2_SOURCE = appendBurnProtocolChapter(
  BURN_PROTOCOL_CHAPTER_1_SOURCE,
  {
    identity: {
      id: "burn-protocol",
      title: "The Burn Protocol: Episode 1 through Chapter 2 — Impact / The Black Box",
      description: "The corpus-native Burn cartridge through Episode 1, Chapter 2, represented as thirty-eight ordered panel slots and eight scroll-plate assets without simulation or invented branching.",
      author: "The Burn Project",
      version: "0.2.0",
    },
    storyVersion: "0.2.0",
    sourceReceipts: CHAPTER_2_RECEIPTS,
    missingRequiredReceiptIds: [
      "estate-archive-v062",
      "episode-01-source",
      "episode-01-compiled",
      "a01c1-lettering",
      "a01c1-scroll-plates",
      "a01c2-lettering",
      "a01c2-scroll-plates",
    ],
    boundary: "Panel order, cross-chapter continuity, and asset custody are explicit through E01-C2-P38. Exact canonical captions, dialogue, sound effects, alt text, and plate-to-panel mappings remain blocked until the source bytes named by the receipts are supplied.",
    episodeId: "E01",
    nextChapterId: "E01-C3",
    chapter: BURN_PROTOCOL_CHAPTER_2,
    notes: {
      implementationPurpose: "Extend the same reusable canonical-story source with the complete Chapter 2 panel inventory and prove that an internal chapter boundary becomes ordinary traversal rather than a new cartridge abstraction.",
      noSimulation: true,
      noChoices: true,
      stableSeriesIdentity: "burn-protocol",
    },
  },
);
