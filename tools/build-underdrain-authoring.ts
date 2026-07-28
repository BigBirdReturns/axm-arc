import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { UNDERDRAIN_STANDALONE_MANIFEST } from "../src/demos/underdrain/index.js";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputRoot = resolve(process.argv[2] ?? resolve(repositoryRoot, "examples/underdrain-draft"));
const outputPath = resolve(outputRoot, "authoring.json");
const sumsPath = resolve(outputRoot, "SHA256SUMS");

mkdirSync(outputRoot, { recursive: true });
const bytes = JSON.stringify(UNDERDRAIN_STANDALONE_MANIFEST, null, 2) + "\n";
const digest = createHash("sha256").update(bytes).digest("hex");
writeFileSync(outputPath, bytes, "utf8");
writeFileSync(sumsPath, `${digest}  authoring.json\n`, "utf8");

console.log(JSON.stringify({
  format: "rodoh-underdrain-authoring-build/2",
  status: "pass",
  output: outputPath,
  sha256: digest,
  challenges: UNDERDRAIN_STANDALONE_MANIFEST.challengeOrder,
  experiences: UNDERDRAIN_STANDALONE_MANIFEST.experienceOrder,
}, null, 2));
