import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  BURN_PROTOCOL_CHAPTER_1_SOURCE,
  compileBurnProtocol,
} from "../src/burn-protocol/index.js";
import { canonicalStoryCoverage } from "../src/canonical-story/index.js";
import { cartridgeDigest } from "../src/engine/cartridge-digest.js";

const output = resolve(process.argv[2] ?? "burn-protocol-chapter-1-publication");
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

const arc = compileBurnProtocol(BURN_PROTOCOL_CHAPTER_1_SOURCE);
const coverage = canonicalStoryCoverage(BURN_PROTOCOL_CHAPTER_1_SOURCE.canonicalStory);
const sourcePath = await writeJson(
  "burn-protocol-episode-01-chapter-01.burn.json",
  BURN_PROTOCOL_CHAPTER_1_SOURCE,
);
const arcPath = await writeJson(
  "burn-protocol-episode-01-chapter-01.arc.json",
  arc,
);
const coveragePath = await writeJson(
  "burn-protocol-episode-01-chapter-01.coverage.json",
  {
    format: "burn-protocol-canonical-story-coverage/1",
    status: coverage.productionReady ? "production-ready" : "source-blocked",
    storyId: BURN_PROTOCOL_CHAPTER_1_SOURCE.canonicalStory.identity.id,
    episodeId: "E01",
    chapterId: "E01-C1",
    openingPanelId: "E01-C1-P01",
    terminalPanelId: "E01-C1-P18",
    continuationPanelId: "E01-C2-P19",
    ...coverage,
    boundary: BURN_PROTOCOL_CHAPTER_1_SOURCE.estate.boundary,
  },
);

const artifactPaths = [sourcePath, arcPath, coveragePath];
const artifactRows = await Promise.all(artifactPaths.map(async (path) => ({
  name: basename(path),
  bytes: (await stat(path)).size,
  sha256: await sha256File(path),
})));
const receiptPath = await writeJson(
  "burn-protocol-episode-01-chapter-01.publication-receipt.json",
  {
    format: "burn-protocol-canonical-story-publication-receipt/1",
    status: "pass-source-ledger-only",
    sourceFormat: BURN_PROTOCOL_CHAPTER_1_SOURCE.format,
    canonicalStoryFormat: BURN_PROTOCOL_CHAPTER_1_SOURCE.canonicalStory.format,
    cartridgeId: arc.meta.id,
    cartridgeDigest: cartridgeDigest(arc),
    engineVersion: arc.meta.engineVersion,
    challengeCount: arc.challenges.length,
    roleCount: arc.roles.length,
    choiceNodes: coverage.choiceNodes,
    chapter: {
      id: "E01-C1",
      panelCount: coverage.panels,
      plateCount: coverage.plates,
      openingPanelId: "E01-C1-P01",
      terminalPanelId: "E01-C1-P18",
      continuationPanelId: "E01-C2-P19",
    },
    unresolved: {
      textPanels: coverage.unresolvedTextPanels,
      plateMappings: coverage.unresolvedPlateMappings,
      requiredReceiptIds: BURN_PROTOCOL_CHAPTER_1_SOURCE.estate.missingRequiredReceiptIds,
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
  panels: coverage.panels,
  plates: coverage.plates,
  unresolvedTextPanels: coverage.unresolvedTextPanels,
  unresolvedPlateMappings: coverage.unresolvedPlateMappings,
  continuationPanelId: "E01-C2-P19",
  files: allPaths.map((path) => basename(path)),
}).trimEnd());
