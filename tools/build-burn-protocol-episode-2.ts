import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE,
  compileBurnProtocol,
} from "../src/burn-protocol/index.js";
import { canonicalStoryCoverage } from "../src/canonical-story/index.js";
import { cartridgeDigest } from "../src/engine/cartridge-digest.js";

const output = resolve(
  process.argv[2] ?? "burn-protocol-through-episode-02-publication",
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

function assetLedgerGap(): unknown {
  const notes = BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE.notes;
  return notes && typeof notes === "object" && !Array.isArray(notes)
    ? (notes as { assetLedgerGap?: unknown }).assetLedgerGap ?? null
    : null;
}

const source = BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE;
const arc = compileBurnProtocol(source);
const coverage = canonicalStoryCoverage(source.canonicalStory);
const prefix = "burn-protocol-through-episode-02";

const sourcePath = await writeJson(`${prefix}.burn.json`, source);
const arcPath = await writeJson(`${prefix}.arc.json`, arc);
const coveragePath = await writeJson(
  `${prefix}.coverage.json`,
  {
    format: "burn-protocol-canonical-story-coverage/1",
    status: coverage.productionReady ? "production-ready" : "source-blocked",
    storyId: source.canonicalStory.identity.id,
    episodeIds: ["E01", "E02"],
    completeEpisodeIds: source.canonicalStory.episodes
      .filter((episode) => episode.complete)
      .map((episode) => episode.id),
    chapterIds: source.canonicalStory.episodes.flatMap((episode) =>
      episode.chapters.map((chapter) => chapter.id)),
    openingPanelId: "E01-C1-P01",
    terminalPanelId: "E02-C3-P60",
    continuationPanelId: "E03-C1-P01",
    expectedPlateAssets: 24,
    representedPlateAssets: coverage.plates,
    assetLedgerGap: assetLedgerGap(),
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
    series: {
      episodeIds: ["E01", "E02"],
      chapterCount: coverage.chapters,
      panelCount: coverage.panels,
      representedPlateCount: coverage.plates,
      expectedPlateCount: 24,
      openingPanelId: "E01-C1-P01",
      terminalPanelId: "E02-C3-P60",
      continuationPanelId: "E03-C1-P01",
    },
    episodeBoundary: {
      fromPanelId: "E01-C3-P60",
      toPanelId: "E02-C1-P01",
      canonical: true,
    },
    episode2ChapterBoundaries: [
      {
        fromPanelId: "E02-C1-P20",
        toPanelId: "E02-C2-P21",
        canonical: true,
      },
      {
        fromPanelId: "E02-C2-P40",
        toPanelId: "E02-C3-P41",
        canonical: true,
      },
    ],
    unresolved: {
      textPanels: coverage.unresolvedTextPanels,
      plateMappings: coverage.unresolvedPlateMappings,
      assetLedgerGap: assetLedgerGap(),
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
  expectedPlates: 24,
  unresolvedTextPanels: coverage.unresolvedTextPanels,
  unresolvedPlateMappings: coverage.unresolvedPlateMappings,
  episodeBoundary: "E01-C3-P60 -> E02-C1-P01",
  continuationPanelId: "E03-C1-P01",
  files: allPaths.map((path) => basename(path)),
}).trimEnd());
