import type {
  CanonicalStoryChapter,
  CanonicalStorySourceReceipt,
} from "../canonical-story/types.js";
import { appendBurnProtocolChapter } from "./assembly.js";
import { BURN_PROTOCOL_THROUGH_CHAPTER_2_SOURCE } from "./chapter-2.js";

interface PanelRow {
  number: number;
  bytes: number;
  sha256: string;
  location: string;
  actorIds: string[];
  summary: string;
}

const CHAPTER_3_RECEIPTS: CanonicalStorySourceReceipt[] = [
  {
    id: "a01c3-lettering",
    path: "manifests/a01c3-lettering.json",
    bytes: 20930,
    sha256: "8177cdf809545fdb12bfd7fd8988f7ae056b098bc1efa22c0e3826c4ad70afa3",
    role: "canonical-lettering",
    available: false,
  },
  {
    id: "a01c3-scroll-plates",
    path: "manifests/a01c3-scroll-plates.json",
    bytes: 1565,
    sha256: "9a0e110a37019df56ddd65aaac614b78ffdf148df8adc58163fbeaeada0d287f",
    role: "plate-composition-map",
    available: false,
  },
  {
    id: "a01c3-art-audit",
    path: "manifests/a01c3-art-audit.json",
    bytes: 47168,
    sha256: "723ec6478903b78be0653596bcb47fcfa75c2d1b9466909d4beb4f6f92a40be4",
    role: "chapter-art-audit",
    available: false,
  },
  {
    id: "a01c3-art-manifest",
    path: "manifests/a01c3-art-manifest.csv",
    bytes: 4326,
    sha256: "33d5ebf61a6a2a63f0d5f1dbce1cab282ea5e1c8cd602c11b3ae2d3fefb212af",
    role: "chapter-art-manifest",
    available: false,
  },
];

const PANELS: PanelRow[] = [
  { number: 39, bytes: 76718, sha256: "8da76ebf5371cbee318a7bda2015a37a3be695f35477b8ae1f859fdc35172b70", location: "Relay K-47", actorIds: ["BOOK", "SAHIL"], summary: "Book approaches an ancient but functioning Federation relay station that still broadcasts civil-assistance instructions." },
  { number: 40, bytes: 105034, sha256: "022ddf7f73ef8cb20f24b7d7841d0721c0da242b8b2714eef661a4e0789e5425", location: "Book's ship", actorIds: ["BOOK", "BURNHAM", "SAHIL"], summary: "Burnham identifies herself with an ancient Starfleet service number, and Sahil responds with cautious procedure rather than immediate belief." },
  { number: 41, bytes: 101890, sha256: "d20eb7425300e5cabe915062dee77d09c62d85199d51d95d4253eda8973dacf9", location: "Relay K-47 airlock", actorIds: ["BURNHAM", "SAHIL"], summary: "Sahil authenticates Burnham with an obsolete general-order clause and quietly confirms its moral premise still matters." },
  { number: 42, bytes: 98776, sha256: "d96aca120ad10110d884657ff8c99b807be648e86da5fa0e79ca3d935a6c2d45", location: "Relay K-47 operations room", actorIds: ["BURNHAM", "SAHIL"], summary: "Sahil verifies Burnham and tells her that Starfleet and the Federation still exist, but beyond his reach." },
  { number: 43, bytes: 66322, sha256: "f59f1d391b12512edd74434f7f966c4998497bf11ea5d32e8bc319fc4d9def95", location: "Relay K-47 operations room", actorIds: ["BOOK", "BURNHAM", "SAHIL"], summary: "Burnham sees that Sahil operates a real regional timing and distress service, supported by couriers and settlements." },
  { number: 44, bytes: 87438, sha256: "ccb76c7ef08c5cdab0d1a9713ac451080d26505964634421bda829835ec25eee", location: "Relay K-47 operations room", actorIds: ["BURNHAM", "SAHIL"], summary: "Sahil shows a meticulous distress ledger that records both aid delivered and obligations the relay could not fulfill." },
  { number: 45, bytes: 97060, sha256: "8b7adb8fb40fb6aba361d171da06dfce2e4381273c58b700f4df6316eff3fb39", location: "Relay K-47 timing lab", actorIds: ["BURNHAM", "SAHIL"], summary: "Burnham gives Sahil the black box and asks him to independently verify its pulsar-corrected time." },
  { number: 46, bytes: 88876, sha256: "c26b83aba0473b7190c42216f05a96220b2b115a8fd1b084267339b40874744d", location: "Relay K-47 timing lab", actorIds: ["BOOK", "BURNHAM", "SAHIL"], summary: "Burnham, Sahil, and Book independently correct the clocks and determine the destroyed ship was charging its core rather than traveling at warp." },
  { number: 47, bytes: 88868, sha256: "eefa1f48ef754bd3cbe53c0e0585b54a6dda22865bee1e334c22d96aab1a0ebd", location: "Relay K-47 timing lab", actorIds: ["BOOK", "BURNHAM", "SAHIL"], summary: "The independent correction verifies a real 0.191-second delay, disproving a perfectly simultaneous Burn." },
  { number: 48, bytes: 91070, sha256: "ab255bef3c5383b847d1bea7f92818833e4b7dcf7e9745c675db198c4f8f0781", location: "Relay K-47 timing lab", actorIds: ["BOOK", "BURNHAM", "SAHIL"], summary: "Burnham acknowledges that one timestamp is not enough to locate an origin, but it provides a method for gathering more evidence." },
  { number: 49, bytes: 95214, sha256: "b8be2437250c2d38866fc53b002962c2fefa32807b5cefd274414594310e41f9", location: "Relay K-47 archive wall", actorIds: ["BOOK", "BURNHAM", "SAHIL"], summary: "Sahil reveals a catalog of black-box locations, allowing Burnham to design a privacy-preserving evidence request." },
  { number: 50, bytes: 94414, sha256: "12f995bc2743d84e7c19283c751ce2a0f59e5473fa03695ef3dc4fa875b0f50b", location: "Relay K-47 operations room", actorIds: ["BOOK", "BURNHAM", "SAHIL"], summary: "Burnham, Book, and Sahil build a distributed evidence ledger that verifies black-box timing without exposing complete private routes." },
  { number: 51, bytes: 96010, sha256: "d2b056ea259c96a238245e592574534414395435533883ab05ecbf3f705802ee", location: "Relay K-47 observation port", actorIds: ["BOOK", "BURNHAM"], summary: "Burnham tells Book that investigating the Burn serves both her search for Discovery and the people already living in the future." },
  { number: 52, bytes: 100172, sha256: "263c50ec2e8d62cb73a8586b4babfbb48be457e52e1407db929ff5a1c909ed8d", location: "Relay K-47 operations room", actorIds: ["BURNHAM", "SAHIL"], summary: "Sahil offers Burnham a preserved Federation flag, and she insists it must signal active service rather than restored authority." },
  { number: 53, bytes: 79238, sha256: "5eb9d0451a5f3114b13548412aa7c5fa0072f5553512f5525876b28677af7b57", location: "Relay K-47 exterior and operations room", actorIds: ["BOOK", "BURNHAM", "SAHIL"], summary: "Relay K-47 lights the Federation emblem while broadcasting Burnham's verification method to courier networks." },
  { number: 54, bytes: 99278, sha256: "bf8240fb7e72ff2c5a4f79c9360065501986b05adcb2c6d38e34625dbeb34795", location: "Relay K-47 operations room", actorIds: ["BOOK", "BURNHAM", "SAHIL"], summary: "Courier networks begin responding to the evidence request while the Chain moves to contain it." },
  { number: 55, bytes: 71834, sha256: "96bd97b9acd9f43dbd697263cfd768c7e3d1729eb6d126c6facdfdb057a28d80", location: "Relay K-47 docking ring", actorIds: ["BOOK", "COURIER_PILOT", "SAHIL"], summary: "A courier secretly delivers a second black-box timing record after becoming suspicious of the Chain's purchase offer." },
  { number: 56, bytes: 82204, sha256: "97a137da303169821923cfc3fa77de1db947950276c3f66bbca99d793baae0e3", location: "Relay K-47 timing lab", actorIds: ["BOOK", "BURNHAM", "SAHIL"], summary: "The team independently verifies a second black-box delay of 0.478 seconds using the same published method." },
  { number: 57, bytes: 98576, sha256: "6c1055334544d60698ece753336acfa404aa6c231ae7dc8e74eeec0491a54ef5", location: "Relay K-47 operations room", actorIds: ["BOOK", "BURNHAM", "SAHIL"], summary: "The two verified delays form the first arc of an expanding propagation wave on the galactic map." },
  { number: 58, bytes: 100564, sha256: "b3eaf4d3bfb522e4199aa1c0cb80ccbfc34a81fddc02779c20b21f715c3694d8", location: "Relay K-47 operations room", actorIds: ["BOOK", "BURNHAM", "SAHIL"], summary: "Sahil, Book, and Burnham each grasp a different consequence of the propagation pattern." },
  { number: 59, bytes: 103814, sha256: "2c6e51a865ec800d004f4a241d029cae0d8a85cab80abda16d96c1726095d788", location: "Relay K-47 operations room and space beyond", actorIds: ["BURNHAM"], summary: "Burnham stands before the first propagation arc and states that the Burn traveled rather than occurring everywhere at once." },
  { number: 60, bytes: 69144, sha256: "dc198d90f11bd5a56669ec312d3ec8528c82cdc459efed6bcbdc60d8970ccb3a", location: "Unknown archive vault", actorIds: ["AUTOMATED_SYSTEM", "BURNHAM"], summary: "An automated receiver detects the new evidence ledger, reveals a partial Omega-shaped mark, and wakes a dormant monitoring process." },
];

const PLATES = [
  { ordinal: 1, bytes: 427046, sha256: "c791b8aecabe62be6008cbc5126ffaeda06a0452d02a789733d36109e6650e96" },
  { ordinal: 2, bytes: 430436, sha256: "1b87645c8b293edbd5cc0a53762a6dafe18ea9b8571ffa0353f8e1a9600d3e7a" },
  { ordinal: 3, bytes: 341926, sha256: "2b729ce76133b5f2f294c01823f9559aef9e3cf62ef552735cd87fa1639f03bd" },
  { ordinal: 4, bytes: 355800, sha256: "4f6d6f32ccd3eb2410af9502c3f1eeb058a0c64229a449d35dac0213fa9a538a" },
];

export const BURN_PROTOCOL_CHAPTER_3: CanonicalStoryChapter = {
  id: "E01-C3",
  number: 3,
  title: "A Direction in Time",
  complete: true,
  openingPanelId: "E01-C3-P39",
  terminalPanelId: "E01-C3-P60",
  previousPanelId: "E01-C2-P38",
  nextPanelId: "E02-C1-P01",
  panels: PANELS.map((row, index) => {
    const panelId = `E01-C3-P${String(row.number).padStart(2, "0")}`;
    return {
      id: panelId,
      ordinal: index + 1,
      chapterId: "E01-C3",
      previousPanelId: row.number === 39
        ? "E01-C2-P38"
        : `E01-C3-P${String(row.number - 1).padStart(2, "0")}`,
      nextPanelId: row.number === 60
        ? "E02-C1-P01"
        : `E01-C3-P${String(row.number + 1).padStart(2, "0")}`,
      asset: {
        id: `asset:${panelId}`,
        path: `site/assets/art/A01C3/panels/${panelId}.webp`,
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
          "a01c3-lettering",
          "q01-dialogue-parity",
        ],
        reason: "The exact Episode 1 and A01C3 lettering bytes are not present in this repository. Canonical captions, dialogue, sound effects, and alt text cannot be reconstructed from derivative ledgers.",
      },
      auditProjection: {
        authority: "derived-q01-q02" as const,
        location: row.location,
        actorIds: [...row.actorIds],
        summary: row.summary,
        sourceReceiptIds: ["q01-causal-ledger", "a01c3-art-audit"],
      },
    };
  }),
  plates: PLATES.map((row) => {
    const plateId = `A01C3-plate-${String(row.ordinal).padStart(2, "0")}`;
    return {
      id: plateId,
      ordinal: row.ordinal,
      chapterId: "E01-C3",
      asset: {
        id: `asset:${plateId}`,
        path: `site/assets/art/A01C3/plates/${plateId}.webp`,
        bytes: row.bytes,
        sha256: row.sha256,
        mimeType: "image/webp" as const,
        availability: "manifested-external" as const,
        visualStanding: "q02-review-required" as const,
      },
      panelMapping: {
        status: "source-required" as const,
        expectedSourceReceiptIds: ["a01c3-scroll-plates"],
        reason: "The exact A01C3 scroll-plate composition map is not present. Plate-to-panel ranges cannot be inferred from asset order.",
      },
    };
  }),
};

export const BURN_PROTOCOL_EPISODE_1_SOURCE = appendBurnProtocolChapter(
  BURN_PROTOCOL_THROUGH_CHAPTER_2_SOURCE,
  {
    identity: {
      id: "burn-protocol",
      title: "The Burn Protocol: Episode 1 — The Broken Road",
      description: "The complete corpus-native Episode 1 cartridge, represented as sixty ordered panel slots and twelve scroll-plate assets without simulation or invented branching.",
      author: "The Burn Project",
      version: "0.3.0",
    },
    storyVersion: "0.3.0",
    sourceReceipts: CHAPTER_3_RECEIPTS,
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
    ],
    boundary: "Episode 1 panel order, both internal chapter seams, the Episode 2 continuation, and asset custody are explicit through E01-C3-P60. Exact canonical captions, dialogue, sound effects, alt text, and plate-to-panel mappings remain blocked until the source bytes named by the receipts are supplied.",
    episodeId: "E01",
    episodeComplete: true,
    nextChapterId: null,
    chapter: BURN_PROTOCOL_CHAPTER_3,
    notes: {
      implementationPurpose: "Complete Episode 1 through the same reusable chapter assembly operation and prove that the full sixty-panel episode requires no source-plane or runtime replacement.",
      noSimulation: true,
      noChoices: true,
      stableSeriesIdentity: "burn-protocol",
      episodeTerminalPanelId: "E01-C3-P60",
      nextCanonicalPanelId: "E02-C1-P01",
    },
  },
);
