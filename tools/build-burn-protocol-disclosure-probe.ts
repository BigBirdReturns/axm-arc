import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BURN_PROTOCOL_DISCLOSURE_PROBE } from "../src/arcs/burn-protocol-disclosure-probe.js";
import {
  BURN_PROTOCOL_CORPUS_PUBLICATION_PROBE,
  BURN_PROTOCOL_DISCLOSURE_PROBE_SOURCE,
} from "../src/common-ship/burn-protocol-disclosure-probe.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(
  process.argv[2] ?? resolve(root, "cartridges", "probes", "burn-protocol-disclosure"),
);
await mkdir(outputDir, { recursive: true });

const files = {
  "burn-protocol-v0.58.0.corpus.json": BURN_PROTOCOL_CORPUS_PUBLICATION_PROBE,
  "burn-protocol-disclosure-probe.ship.json": BURN_PROTOCOL_DISCLOSURE_PROBE_SOURCE,
  "burn-protocol-disclosure-probe.arc.json": BURN_PROTOCOL_DISCLOSURE_PROBE,
} as const;

const receiptFiles: Record<string, { sha256: string; bytes: number }> = {};
for (const [name, value] of Object.entries(files)) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(resolve(outputDir, name), bytes, "utf8");
  receiptFiles[name] = {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: Buffer.byteLength(bytes),
  };
}

const receipt = {
  format: "rodoh-corpus-publication-receipt/1",
  status: "pass",
  cartridgeId: BURN_PROTOCOL_DISCLOSURE_PROBE.meta.id,
  engineVersion: BURN_PROTOCOL_DISCLOSURE_PROBE.meta.engineVersion,
  sourcePlane: BURN_PROTOCOL_DISCLOSURE_PROBE_SOURCE.format,
  exactParentSha256: BURN_PROTOCOL_CORPUS_PUBLICATION_PROBE.exactParent.sha256,
  challenges: BURN_PROTOCOL_DISCLOSURE_PROBE.challenges.map((challenge) => challenge.id),
  files: receiptFiles,
};
const receiptBytes = `${JSON.stringify(receipt, null, 2)}\n`;
await writeFile(resolve(outputDir, "publication-receipt.json"), receiptBytes, "utf8");

console.log(JSON.stringify({ ...receipt, outputDir }, null, 2));
