import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  BURN_PROTOCOL_THROUGH_CHAPTER_2_SOURCE,
  compileBurnProtocol,
} from "../src/burn-protocol/index.js";
import { canonicalStoryCoverage } from "../src/canonical-story/index.js";
import { cartridgeDigest } from "../src/engine/cartridge-digest.js";

const output = resolve(
  process.argv[2] ?? "burn-protocol-episode-01-through-chapter-2-publication",
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

const source = BURN_PROTOCOL_THROUGH_CHAPTER_2_SOURCE;
const arc = compileBurnProtocol(source);
const coverage = canonicalStoryCoverage(source.canonicalStory);
const prefix = "burn-protocol-episode-01-through-chapter-02";

const sourcePath = await writeJson(`${prefix}.burn.json`, source);
const arcPath = await writeJson(`${prefix}.arc.json`, arc);
const coveragePath = await writeJson(
  `${prefix}.coverage.json`,
  {
    format: "burn-protocol-canonical-story-coverage/1",
    status: coverage.productionReady ? "production-ready" : "source-blocked",
    storyId: source.canonicalStory.identity.id,
    episodeId: "E01",
    chapterIds: ["E01-C1", "E01-C2"],
    openingPanelId: "E01-C1-P01",
    terminalPanelId: "E01-C2-P38",
    continuationPanelId: "E01-C3-P39",
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
    episode: {
      id: "E01",
      chapterIds: ["E01-C1", "E01-C2"],
      panelCount: coverage.panels,
      plateCount: coverage.plates,
      openingPanelId: "E01-C1-P01",
      terminalPanelId: "E01-C2-P38",
      continuationPanelId: "E01-C3-P39",
    },
    chapterBoundary: {
      fromPanelId: "E01-C1-P18",
      toPanelId: "E01-C2-P19",
      canonical: true,
    },
    unresolved: {
      textPanels: coverage.unresolvedTextPanels,
      plateMappings: coverage.unresolvedPlateMappings,
      requiredReceiptIds: source.estate.missingRequiredReceiptIds,
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
  chapters: coverage.chapters,
  panels: coverage.panels,
  plates: coverage.plates,
  unresolvedTextPanels: coverage.unresolvedTextPanels,
  unresolvedPlateMappings: coverage.unresolvedPlateMappings,
  chapterBoundary: "E01-C1-P18 -> E01-C2-P19",
  continuationPanelId: "E01-C3-P39",
  files: allPaths.map((path) => basename(path)),
}).trimEnd());
