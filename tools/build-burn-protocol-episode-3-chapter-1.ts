import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_1_SOURCE,
  compileBurnProtocol,
} from "../src/burn-protocol/index.js";
import { canonicalStoryCoverage } from "../src/canonical-story/index.js";
import { cartridgeDigest } from "../src/engine/cartridge-digest.js";

const output = resolve(
  process.argv[2] ?? "burn-protocol-through-episode-03-chapter-01-publication",
);
await mkdir(output, { recursive: true });

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function writeJson(name: string, value: unknown): Promise<string> {
  const path = resolve(output, name);
  await writeFile(path, json(value), "utf8");
  return path;
}

function sourceLedgerGaps(): unknown {
  const notes = BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_1_SOURCE.notes;
  return notes && typeof notes === "object" && !Array.isArray(notes)
    ? (notes as { sourceLedgerGaps?: unknown }).sourceLedgerGaps ?? []
    : [];
}

const source = BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_1_SOURCE;
const arc = compileBurnProtocol(source);
const coverage = canonicalStoryCoverage(source.canonicalStory);
const prefix = "burn-protocol-through-episode-03-chapter-01";

const sourcePath = await writeJson(`${prefix}.burn.json`, source);
const arcPath = await writeJson(`${prefix}.arc.json`, arc);
const coveragePath = await writeJson(
  `${prefix}.coverage.json`,
  {
    format: "burn-protocol-canonical-story-coverage/1",
    status: coverage.productionReady ? "production-ready" : "source-blocked",
    storyId: source.canonicalStory.identity.id,
    episodeIds: ["E01", "E02", "E03"],
    completeEpisodeIds: source.canonicalStory.episodes
      .filter((episode) => episode.complete)
      .map((episode) => episode.id),
    chapterIds: source.canonicalStory.episodes.flatMap((episode) =>
      episode.chapters.map((chapter) => chapter.id)),
    openingPanelId: "E01-C1-P01",
    currentTerminalPanelId: "E03-C1-P20",
    continuationPanelId: "E03-C2-P21",
    expectedPlateAssets: 28,
    representedPlateAssets: coverage.plates,
    sourceLedgerGaps: sourceLedgerGaps(),
    ...coverage,
    boundary: source.estate.boundary,
  },
);

const artifactPaths = [sourcePath, arcPath, coveragePath];
const artifactRows = await Promise.all(artifactPaths.map(async (path) => ({
  name: basename(path),
  bytes: (await stat(path)).size,
  sha256: await sha256File(path),
})));
const receiptPath = await writeJson(
  `${prefix}.publication-receipt.json`,
  {
    format: "burn-protocol-canonical-story-publication-receipt/1",
    status: "pass-source-ledger-only",
    sourceFormat: source.format,
    canonicalStoryFormat: source.canonicalStory.format,
    cartridgeId: arc.meta.id,
    cartridgeDigest: cartridgeDigest(arc),
    engineVersion: arc.meta.engineVersion,
    challengeCount: arc.challenges.length,
    roleCount: arc.roles.length,
    choiceNodes: coverage.choiceNodes,
    extent: {
      episodeIds: ["E01", "E02", "E03"],
      chapterCount: coverage.chapters,
      panelCount: coverage.panels,
      plateCount: coverage.plates,
      openingPanelId: "E01-C1-P01",
      currentTerminalPanelId: "E03-C1-P20",
      continuationPanelId: "E03-C2-P21",
    },
    episodeBoundary: {
      fromPanelId: "E02-C3-P60",
      toPanelId: "E03-C1-P01",
      canonical: true,
    },
    recoveredAsset: {
      id: "A02C3-plate-04",
      path: "site/assets/art/A02C3/plates/A02C3-plate-04.webp",
      bytes: 332220,
      sha256: "ea21b4b95e72da8c8d8372bdf1b76c65ec8d97c88dd14aa266094458cfa3d65d",
    },
    unresolved: {
      textPanels: coverage.unresolvedTextPanels,
      plateMappings: coverage.unresolvedPlateMappings,
      sourceLedgerGaps: sourceLedgerGaps(),
      requiredReceiptIds: source.estate.missingRequiredReceiptIds,
    },
    sourceCustody: {
      canonicalSourceReceiptIds: source.estate.canonicalSourceReceiptIds,
      compiledSourceReceiptIds: source.estate.compiledSourceReceiptIds,
    },
    artifacts: artifactRows,
  },
);

const allPaths = [...artifactPaths, receiptPath];
const sums = await Promise.all(allPaths.map(async (path) =>
  `${await sha256File(path)}  ${basename(path)}`));
await writeFile(resolve(output, "SHA256SUMS"), `${sums.join("\n")}\n`, "utf8");

console.log(json({
  status: "pass-source-ledger-only",
  output,
  cartridgeDigest: cartridgeDigest(arc),
  episodes: coverage.episodes,
  chapters: coverage.chapters,
  panels: coverage.panels,
  plates: coverage.plates,
  unresolvedTextPanels: coverage.unresolvedTextPanels,
  unresolvedPlateMappings: coverage.unresolvedPlateMappings,
  episodeBoundary: "E02-C3-P60 -> E03-C1-P01",
  continuationPanelId: "E03-C2-P21",
  files: allPaths.map((path) => basename(path)),
}).trimEnd());
