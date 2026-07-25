#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { parseBoundedJson } from "../src/engine/bounded-json.js";
import { validateArc } from "../src/engine/schema.js";
import { cartridgeDigest } from "../src/engine/cartridge-digest.js";
import { parsePortableRun } from "../src/engine/portable-run.js";
import { runSweep } from "../src/sim/cartridge-conformance.js";
import { inspectArcSourcePlanes, sourcePlaneById, type SourcePlaneId } from "../src/source-planes/registry.js";

function fail(message: string, code = 1): never {
  console.error(JSON.stringify({ format: "rodoh-creator-cli-error/1", error: message }, null, 2));
  process.exit(code);
}
function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
function option(args: string[], name: string, fallback: string | null = null): string | null {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) fail(`Missing value for ${name}.`);
  return value;
}
function integerOption(args: string[], name: string, fallback: number): number {
  const raw = option(args, name);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) fail(`${name} must be a positive integer.`);
  return value;
}
function fileArg(args: string[]): string {
  const file = option(args, "--file") ?? args.find((value) => !value.startsWith("--"));
  if (!file) fail("A cartridge or run path is required through --file.");
  return resolve(file);
}
function loadArc(path: string) {
  const text = readFileSync(path, "utf8");
  const raw = parseBoundedJson(text);
  const arc = validateArc(raw);
  return { path, text, arc, digest: cartridgeDigest(arc) };
}
function help(): void {
  process.stdout.write(`RODOH creator custody CLI\n\n`);
  process.stdout.write(`Commands:\n`);
  process.stdout.write(`  validate --file cartridge.arc.json\n`);
  process.stdout.write(`  digest --file cartridge.arc.json\n`);
  process.stdout.write(`  inspect --file cartridge.arc.json\n`);
  process.stdout.write(`  simulate --file cartridge.arc.json [--seeds 16] [--max-cycles 120]\n`);
  process.stdout.write(`  recover-source --file cartridge.arc.json --plane godscar-pocket|dark-tomb-pocket|common-ship-pocket [--output source.json]\n`);
  process.stdout.write(`  verify-run --file changed.run.json\n`);
}

const [command = "help", ...args] = process.argv.slice(2);
try {
  if (command === "help" || command === "--help" || command === "-h") {
    help();
  } else if (command === "validate") {
    const loaded = loadArc(fileArg(args));
    print({
      format: "rodoh-creator-validation-receipt/1",
      file: basename(loaded.path),
      cartridgeDigest: loaded.digest,
      meta: loaded.arc.meta,
      counts: {
        attributes: loaded.arc.attributes.length,
        roles: loaded.arc.roles.length,
        tiers: loaded.arc.tiers.length,
        challenges: loaded.arc.challenges.length,
        items: loaded.arc.items.length,
        extensions: Object.keys(loaded.arc.extensions ?? {}).length,
      },
      status: "pass",
    });
  } else if (command === "digest") {
    const loaded = loadArc(fileArg(args));
    print({ format: "rodoh-cartridge-digest-receipt/1", file: basename(loaded.path), cartridgeDigest: loaded.digest });
  } else if (command === "inspect") {
    const loaded = loadArc(fileArg(args));
    print({
      format: "rodoh-creator-inspection-receipt/1",
      file: basename(loaded.path),
      cartridgeDigest: loaded.digest,
      sourcePlanes: inspectArcSourcePlanes(loaded.arc).map((inspection) => ({
        id: inspection.definition.id,
        format: inspection.definition.format,
        extensionKey: inspection.definition.extensionKey,
        status: inspection.status,
        errors: inspection.errors ?? [],
      })),
      unknownExtensions: Object.keys(loaded.arc.extensions ?? {}).filter((key) =>
        !inspectArcSourcePlanes(loaded.arc).some((inspection) => inspection.definition.extensionKey === key)
      ).sort(),
    });
  } else if (command === "simulate") {
    const loaded = loadArc(fileArg(args));
    const seeds = integerOption(args, "--seeds", 16);
    const maxCycles = integerOption(args, "--max-cycles", 120);
    const sweep = runSweep(loaded.arc, { seeds, maxCycles });
    const status = sweep.clearRate === 1
      && sweep.stallRate === 0
      && sweep.maxCycleRate === 0
      && sweep.totalGateViolations === 0
      && sweep.runs.every((run) => run.warnings.length === 0)
      ? "pass"
      : "fail";
    print({
      format: "rodoh-creator-simulation-receipt/1",
      file: basename(loaded.path),
      cartridgeDigest: loaded.digest,
      seeds,
      maxCycles,
      clearRate: sweep.clearRate,
      stallRate: sweep.stallRate,
      maxCycleRate: sweep.maxCycleRate,
      totalGateViolations: sweep.totalGateViolations,
      warnings: sweep.runs.flatMap((run) => run.warnings),
      runs: sweep.runs.map((run) => ({
        seed: run.seed,
        cleared: run.cleared,
        cycles: run.cycles,
        stalled: run.stalled,
        hitMaxCycles: run.hitMaxCycles,
        gateViolations: run.gateViolations,
      })),
      status,
    });
    if (status !== "pass") process.exitCode = 2;
  } else if (command === "recover-source") {
    const loaded = loadArc(fileArg(args));
    const plane = option(args, "--plane") as SourcePlaneId | null;
    if (!plane) fail("recover-source requires --plane.");
    const definition = sourcePlaneById(plane);
    if (!definition) fail(`Unknown registered source plane: ${plane}.`);
    const source = definition.recover(loaded.arc);
    if (source === null) fail(`Cartridge does not carry a valid ${plane} source.`);
    const output = `${JSON.stringify(source, null, 2)}\n`;
    const outputPath = option(args, "--output");
    if (outputPath) {
      writeFileSync(resolve(outputPath), output);
      print({ format: "rodoh-source-recovery-receipt/1", plane, output: resolve(outputPath), status: "pass" });
    } else {
      process.stdout.write(output);
    }
  } else if (command === "verify-run") {
    const path = fileArg(args);
    const restored = parsePortableRun(readFileSync(path, "utf8"));
    print({
      format: "rodoh-run-verification-receipt/1",
      file: basename(path),
      cartridgeDigest: restored.authoredArcDigest,
      runIntegrityDigest: restored.run.integrity.digest,
      cycle: restored.org.cycle,
      extensions: Object.keys(restored.extensions).sort(),
      status: "pass",
    });
  } else {
    fail(`Unknown command: ${command}. Use help.`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
