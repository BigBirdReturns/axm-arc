import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ORCHARD_AT_LOW_TIDE } from "../src/clean-room/orchard-at-low-tide.js";
import { cartridgeDigest } from "../src/engine/cartridge-digest.js";
import { foundOrganization } from "../src/engine/founding.js";
import { runCycle } from "../src/engine/cycle.js";
import { bestParty } from "../src/sim/cartridge-conformance.js";
import { buildPortableRun, portableRunPayloadDigest, type PortableRunV3 } from "../src/engine/portable-run.js";
import type { Arc, Organization } from "../src/engine/types.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = resolve(root, "cartridges", "clean-room");
const FIXTURE_SAVED_AT = "2026-07-24T00:00:00.000Z";
await mkdir(dir, { recursive: true });

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function complete(arc: Arc, seed: number): Organization {
  let org = foundOrganization(arc, { format: "axm-founding-input/1", seed });
  for (const challenge of arc.challenges) {
    const plan = bestParty(challenge, org, arc);
    if (!plan) throw new Error(`No legal party for ${challenge.id}.`);
    const cycle = runCycle({
      org,
      arc,
      assignments: [{
        challengeId: challenge.id,
        agentIds: plan.agentIds,
        tokensSpent: challenge.resourceSpend && org.resources.tokens > 0 ? 1 : 0,
      }],
    });
    const report = cycle.reports.find((candidate) => candidate.challengeId === challenge.id);
    if (!report || report.outcome !== "success") {
      throw new Error(`${challenge.id} resolved ${report?.outcome ?? "without report"}.`);
    }
    org = cycle.org;
  }
  return org;
}

function stabilizeRun(run: PortableRunV3): PortableRunV3 {
  const saved = JSON.parse(run.engine.game) as { savedAt?: unknown };
  saved.savedAt = FIXTURE_SAVED_AT;
  const core = {
    format: run.format,
    authoredArcDigest: run.authoredArcDigest,
    arc: run.arc,
    engine: { ...run.engine, game: JSON.stringify(saved) },
    extensions: run.extensions,
  };
  return {
    ...core,
    integrity: {
      algorithm: run.integrity.algorithm,
      digest: portableRunPayloadDigest(core),
    },
  };
}

const exactSource = structuredClone(ORCHARD_AT_LOW_TIDE);
const compiled = structuredClone(ORCHARD_AT_LOW_TIDE);
const malformed = structuredClone(ORCHARD_AT_LOW_TIDE);
malformed.meta.id = "orchard-at-low-tide-malformed";
malformed.meta.name = "Malformed Orchard Fixture";
malformed.challenges[0]!.rosterRequirements.minAgents = malformed.challenges[0]!.rosterRequirements.maxAgents + 1;

const completedOrg = complete(ORCHARD_AT_LOW_TIDE, 2707);
const run = stabilizeRun(buildPortableRun({
  arc: ORCHARD_AT_LOW_TIDE,
  org: completedOrg,
  extensions: {
    "holder.field-notes@1": {
      status: "changed-run",
      observations: ["the hidden wells entered the census", "the ninth field remains revisable"],
      arbitraryUnknown: { code: 71, nested: [true, "silt"] },
    },
  },
}));

const sourcePath = resolve(dir, "orchard-at-low-tide.source.arc.json");
const compiledPath = resolve(dir, "orchard-at-low-tide.arc.json");
const malformedPath = resolve(dir, "orchard-at-low-tide.invalid.arc.json");
const runPath = resolve(dir, "orchard-at-low-tide.changed.run.json");

await writeFile(sourcePath, json(exactSource), "utf8");
await writeFile(compiledPath, json(compiled), "utf8");
await writeFile(malformedPath, json(malformed), "utf8");
await writeFile(runPath, json(run), "utf8");

const files = {
  source: "cartridges/clean-room/orchard-at-low-tide.source.arc.json",
  compiled: "cartridges/clean-room/orchard-at-low-tide.arc.json",
  malformed: "cartridges/clean-room/orchard-at-low-tide.invalid.arc.json",
  changedRun: "cartridges/clean-room/orchard-at-low-tide.changed.run.json",
} as const;

const texts = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, relative]) => [key, await readFile(resolve(root, relative), "utf8")]),
));

const manifest = {
  format: "rodoh-clean-room-custody/1",
  id: "orchard-at-low-tide",
  status: "unbundled",
  canon: "non-canon-clean-room-proof",
  programOfRecord: null,
  sourceKind: "exact-generic-arc",
  generator: "npm run build:clean-room-reference",
  deterministicSavedAt: FIXTURE_SAVED_AT,
  engineVersion: ORCHARD_AT_LOW_TIDE.meta.engineVersion,
  cartridgeDigest: cartridgeDigest(ORCHARD_AT_LOW_TIDE),
  runIntegrityDigest: run.integrity.digest,
  recomputedRunPayloadDigest: portableRunPayloadDigest({
    format: run.format,
    authoredArcDigest: run.authoredArcDigest,
    arc: run.arc,
    engine: run.engine,
    extensions: run.extensions,
  }),
  unknownNamespaces: [
    "unfamiliar.garden-memory@7",
    "holder.field-notes@1",
  ],
  files: Object.fromEntries(Object.entries(files).map(([key, path]) => [
    key,
    { path, sha256: sha256(texts[key] as string), bytes: Buffer.byteLength(texts[key] as string, "utf8") },
  ])),
};
await writeFile(resolve(dir, "manifest.json"), json(manifest), "utf8");
console.log(`Wrote clean-room cartridge ${manifest.cartridgeDigest}.`);
