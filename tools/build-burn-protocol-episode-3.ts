import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  BURN_PROTOCOL_THROUGH_EPISODE_3_SOURCE,
} from "../src/burn-protocol/episode-3-chapter-3.js";
import { compileBurnProtocol } from "../src/burn-protocol/compiler.js";
import {
  canonicalStoryAssetIsManifested,
  canonicalStoryCoverage,
} from "../src/canonical-story/runtime.js";
import { cartridgeDigest } from "../src/engine/cartridge-digest.js";

const output = resolve(
  process.argv[2] ?? "burn-protocol-through-episode-03-publication",
);
await mkdir(output, { recursive: true });

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeJson(name: string, value: unknown): Promise<string> {
  const path = resolve(output, name);
  await writeFile(path, json(value), "utf8");
  return path;
}

async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

const source = BURN_PROTOCOL_THROUGH_EPISODE_3_SOURCE;
const arc = compileBurnProtocol(source);
const coverage = canonicalStoryCoverage(source.canonicalStory);
const assets = source.canonicalStory.episodes.flatMap((episode) => episode.chapters)
  .flatMap((chapter) => [
    ...chapter.panels.map((panel) => panel.asset),
    ...chapter.plates.map((plate) => plate.asset),
  ]);
const sourceRequiredAssets = assets.filter(
  (asset) => !canonicalStoryAssetIsManifested(asset),
);
const prefix = "burn-protocol-through-episode-03";

const sourcePath = await writeJson(`${prefix}.burn.json`, source);
const arcPath = await writeJson(`${prefix}.arc.json`, arc);
const coveragePath = await writeJson(`${prefix}.coverage.json`, {
  format: "burn-protocol-canonical-story-coverage/1",
  status: coverage.productionReady ? "production-ready" : "source-blocked",
  storyId: source.canonicalStory.identity.id,
  episodeIds: source.canonicalStory.episodes.map((episode) => episode.id),
  chapterIds: source.canonicalStory.episodes.flatMap((episode) =>
    episode.chapters.map((chapter) => chapter.id)),
  openingPanelId: "E01-C1-P01",
  terminalPanelId: "E03-C3-P60",
  continuationPanelId: "E04-C1-P01",
  sourceRequiredAssets,
  ...coverage,
  boundary: source.estate.boundary,
});

const artifactPaths = [sourcePath, arcPath, coveragePath];
const artifacts = await Promise.all(artifactPaths.map(async (path) => ({
  name: basename(path),
  bytes: (await stat(path)).size,
  sha256: await sha256File(path),
})));
const receiptPath = await writeJson(`${prefix}.publication-receipt.json`, {
  format: "burn-protocol-canonical-story-publication-receipt/1",
  status: "pass-source-ledger-only",
  cartridgeId: arc.meta.id,
  cartridgeDigest: cartridgeDigest(arc),
  challengeCount: arc.challenges.length,
  roleCount: arc.roles.length,
  choiceNodes: coverage.choiceNodes,
  extent: {
    episodeIds: ["E01", "E02", "E03"],
    chapterCount: coverage.chapters,
    panelCount: coverage.panels,
    plateCount: coverage.plates,
    openingPanelId: "E01-C1-P01",
    terminalPanelId: "E03-C3-P60",
    continuationPanelId: "E04-C1-P01",
  },
  canonicalSeams: [
    { fromPanelId: "E02-C3-P60", toPanelId: "E03-C1-P01" },
    { fromPanelId: "E03-C1-P20", toPanelId: "E03-C2-P21" },
    { fromPanelId: "E03-C2-P40", toPanelId: "E03-C3-P41" },
  ],
  sourceCustody: {
    canonicalSourceReceiptIds: source.estate.canonicalSourceReceiptIds,
    compiledSourceReceiptIds: source.estate.compiledSourceReceiptIds,
  },
  unresolved: {
    textPanels: coverage.unresolvedTextPanels,
    plateMappings: coverage.unresolvedPlateMappings,
    sourceRequiredAssets,
    requiredReceiptIds: source.estate.missingRequiredReceiptIds,
    unreceiptedSourceLedgerGaps: source.notes && typeof source.notes === "object"
      && !Array.isArray(source.notes)
      ? source.notes["sourceLedgerGaps"] ?? []
      : [],
  },
  artifacts,
});

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
  sourceRequiredAssets: sourceRequiredAssets.map((asset) => asset.id),
  continuationPanelId: "E04-C1-P01",
}).trimEnd());
