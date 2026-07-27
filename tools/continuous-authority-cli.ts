#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { FIRST_CHARTER, KARAZHAN, KIND_GODS_OF_ILYON, LAMP_DISTRICT, RELIEF_CIRCUIT } from "../src/arcs/index.js";
import { parseBoundedJson } from "../src/engine/bounded-json.js";
import { cartridgeDigest, sha256Hex } from "../src/engine/cartridge-digest.js";
import { orderRecordKeysDeep } from "../src/engine/determinism.js";
import { parseActionReceipt } from "../src/engine/action/receipt.js";
import type { Arc } from "../src/engine/types.js";
import {
  commitAcceptedActionNarrative,
  parseNarrativeConstitution,
  parseNarrativeRuntimeState,
} from "../src/narrative/index.js";

const DELIVERY_FORMAT = "axm-continuous-authority-delivery/1" as const;
const MAX_INPUT_BYTES = 32 * 1024 * 1024;
const ARCS: Arc[] = [FIRST_CHARTER, KARAZHAN, KIND_GODS_OF_ILYON, LAMP_DISTRICT, RELIEF_CIRCUIT];
const args = process.argv.slice(2);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function values(name: string): string[] {
  const output: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== name) continue;
    const value = args[index + 1];
    if (!value || value.startsWith("--")) fail(`Missing value for ${name}.`);
    output.push(value);
    index += 1;
  }
  return output;
}

function option(name: string): string {
  const matches = values(name);
  if (matches.length !== 1) fail(`${name} must be supplied exactly once.`);
  return matches[0]!;
}

function nonNegativeInteger(name: string): number {
  const raw = option(name);
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) fail(`${name} must be a non-negative integer.`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) fail(`${name} exceeds the safe integer range.`);
  return parsed;
}

function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

function canonical(value: unknown): string {
  return `${JSON.stringify(orderRecordKeysDeep(value), null, 2)}\n`;
}

function readInput(path: string, label: string): { path: string; name: string; text: string; sha256: string; value: unknown } {
  const resolved = resolve(path);
  if (!existsSync(resolved) || !lstatSync(resolved).isFile()) fail(`${label} is not a regular file: ${resolved}`);
  const bytes = lstatSync(resolved).size;
  if (bytes > MAX_INPUT_BYTES) fail(`${label} is ${bytes} bytes; maximum is ${MAX_INPUT_BYTES}.`);
  const text = readFileSync(resolved, "utf8");
  return {
    path: resolved,
    name: basename(resolved),
    text,
    sha256: sha256(Buffer.from(text, "utf8")),
    value: parseBoundedJson(text),
  };
}

function resolveArc(digest: string): Arc {
  const matches = ARCS.filter((arc) => cartridgeDigest(arc) === digest);
  if (matches.length !== 1) fail(`No unique built-in Arc matches action receipt digest ${digest}.`);
  return matches[0]!;
}

function writeJson(root: string, name: string, value: unknown): { name: string; sha256: string; bytes: number } {
  const text = canonical(value);
  writeFileSync(join(root, name), text, { encoding: "utf8", flag: "wx" });
  return { name, sha256: sha256(Buffer.from(text, "utf8")), bytes: Buffer.byteLength(text, "utf8") };
}

function filesIn(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .map((entry) => {
      if (!entry.isFile()) fail(`Continuous authority output contains non-file entry ${entry.name}.`);
      return entry.name;
    })
    .sort();
}

function verifySums(root: string): string {
  const sumsPath = join(root, "SHA256SUMS");
  if (!existsSync(sumsPath)) fail(`Existing output lacks SHA256SUMS: ${root}`);
  const text = readFileSync(sumsPath, "utf8");
  const expectedNames = new Set<string>();
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line) continue;
    const match = /^([0-9a-f]{64})  ([A-Za-z0-9._-]+)$/.exec(line);
    if (!match) fail(`Malformed SHA256SUMS line ${index + 1} in ${root}.`);
    const [, expected, name] = match;
    if (name === "SHA256SUMS") fail("SHA256SUMS may not checksum itself.");
    if (expectedNames.has(name!)) fail(`SHA256SUMS repeats ${name}.`);
    expectedNames.add(name!);
    const path = join(root, name!);
    if (!existsSync(path) || !lstatSync(path).isFile()) fail(`Checksummed output is absent: ${name}.`);
    const actual = sha256(readFileSync(path));
    if (actual !== expected) fail(`Checksum mismatch for existing output ${name}: ${actual} != ${expected}.`);
  }
  const actualNames = filesIn(root).filter((name) => name !== "SHA256SUMS");
  if (JSON.stringify([...expectedNames].sort()) !== JSON.stringify(actualNames)) {
    fail(`Existing output file set is not identical to SHA256SUMS in ${root}.`);
  }
  return text;
}

function publish(temp: string, output: string): { reused: boolean; sumsDigest: string } {
  const tempSums = verifySums(temp);
  if (existsSync(output)) {
    if (!lstatSync(output).isDirectory()) fail(`Output path exists and is not a directory: ${output}`);
    const currentSums = verifySums(output);
    if (currentSums !== tempSums) fail(`Output already exists with different qualified bytes: ${output}`);
    rmSync(temp, { recursive: true, force: true });
    return { reused: true, sumsDigest: sha256(Buffer.from(currentSums, "utf8")) };
  }
  renameSync(temp, output);
  return { reused: false, sumsDigest: sha256(Buffer.from(tempSums, "utf8")) };
}

function main(): void {
  const command = args[0];
  if (command !== "commit") {
    fail(
      "Usage: continuous-authority-cli.ts commit --receipt <file> --binding <file> --state <file> " +
      "--constitution <file> --org-seed <integer> --output <directory> [--causal-parent <beat-id>]",
    );
  }
  const receiptInput = readInput(option("--receipt"), "Action receipt");
  const bindingInput = readInput(option("--binding"), "Action narrative binding");
  const stateInput = readInput(option("--state"), "Narrative state");
  const constitutionInput = readInput(option("--constitution"), "Narrative constitution");
  const orgSeed = nonNegativeInteger("--org-seed");
  const output = resolve(option("--output"));
  const causalParentBeatIds = [...new Set(values("--causal-parent"))].sort();

  const receipt = parseActionReceipt(receiptInput.value);
  const arc = resolveArc(receipt.arcDigest);
  const challenge = arc.challenges.find((entry) => entry.id === receipt.challengeId);
  if (!challenge) fail(`Arc ${arc.meta.id} has no challenge ${receipt.challengeId}.`);
  const state = parseNarrativeRuntimeState(stateInput.value);
  const constitution = parseNarrativeConstitution(constitutionInput.value);
  const transaction = commitAcceptedActionNarrative({
    arc,
    challenge,
    difficultyModeId: receipt.difficultyModeId,
    cycle: receipt.cycle,
    orgSeed,
    partyAgentIds: receipt.partyAgentIds,
    narrativeState: state,
    constitution,
    binding: bindingInput.value,
    receipt,
    causalParentBeatIds,
  });

  mkdirSync(dirname(output), { recursive: true });
  const temp = mkdtempSync(join(dirname(output), ".continuous-authority-"));
  try {
    const outputs = [
      writeJson(temp, "action-narrative-ingestion.json", transaction.ingestion.receipt),
      writeJson(temp, "action-narrative-fact.json", transaction.ingestion.fact),
      writeJson(temp, "action-narrative-candidate.json", transaction.ingestion.candidate),
      writeJson(temp, "narrative-selection.json", transaction.selection),
      writeJson(temp, "narrative-commit.json", transaction.commit.receipt),
      writeJson(temp, "narrative-state.json", transaction.commit.state),
      writeJson(temp, "action-narrative-transition.json", transaction.receipt),
    ];
    const manifestCore = {
      format: DELIVERY_FORMAT,
      arcId: arc.meta.id,
      arcVersion: arc.meta.version,
      arcDigest: receipt.arcDigest,
      challengeId: receipt.challengeId,
      cycle: receipt.cycle,
      orgSeed,
      actionReceiptDigest: receipt.receiptDigest,
      actionOutcome: receipt.result.outcome,
      transitionReceiptDigest: transaction.receipt.receiptDigest,
      narrativeCommitBeatId: transaction.commit.receipt.beatId,
      narrativeStateFingerprint: transaction.commit.receipt.stateAfterFingerprint,
      causalParentBeatIds,
      inputs: [
        { role: "action-receipt", file: receiptInput.name, sha256: receiptInput.sha256 },
        { role: "action-narrative-binding", file: bindingInput.name, sha256: bindingInput.sha256 },
        { role: "narrative-state", file: stateInput.name, sha256: stateInput.sha256 },
        { role: "narrative-constitution", file: constitutionInput.name, sha256: constitutionInput.sha256 },
      ],
      outputs,
    };
    const manifest = orderRecordKeysDeep({
      ...manifestCore,
      manifestDigest: "contauth1_" + sha256Hex(JSON.stringify(orderRecordKeysDeep(manifestCore))),
    });
    writeJson(temp, "manifest.json", manifest);
    const names = filesIn(temp);
    const sums = names
      .map((name) => `${sha256(readFileSync(join(temp, name)))}  ${name}`)
      .join("\n") + "\n";
    writeFileSync(join(temp, "SHA256SUMS"), sums, { encoding: "utf8", flag: "wx" });
    const published = publish(temp, output);
    process.stdout.write(canonical({
      format: "axm-continuous-authority-cli-result/1",
      status: "pass",
      output,
      reused: published.reused,
      sumsDigest: published.sumsDigest,
      transitionReceiptDigest: transaction.receipt.receiptDigest,
      beatId: transaction.commit.receipt.beatId,
      stateAfterFingerprint: transaction.commit.receipt.stateAfterFingerprint,
    }));
  } catch (error) {
    rmSync(temp, { recursive: true, force: true });
    throw error;
  }
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
