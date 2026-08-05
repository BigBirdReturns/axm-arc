#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  asoiafAnswerDeskWorkerPaths,
  buildAsoiafAnswerWorkerManifest,
  planAsoiafAnswerDeskWorkers,
  readAsoiafAnswerDeskWorkerStatus,
  runAsoiafAnswerDeskWorker,
  validateAsoiafAnswerWorkerPlan,
  verifyAsoiafAnswerDeskWorkerEstate,
  type AsoiafAnswerDeskWorkerRunInput,
} from "./lib/asoiaf-answer-desk-worker.js";

const args = process.argv.slice(2);
const command = args[0] ?? "help";

function value(name: string, fallback?: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
}

function required(name: string): string {
  const result = value(name);
  if (!result) throw new Error(`--${name} is required`);
  return result;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8")) as T;
}

function print(output: unknown): void {
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

function writeJson(output: unknown, target: string | undefined): void {
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (!target) {
    process.stdout.write(serialized);
    return;
  }
  const resolved = path.resolve(target);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, serialized, "utf8");
  print({ ok: true, output: resolved });
}

function usage(): void {
  process.stdout.write("ASOIAF persistent answer desk worker\n\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  manifest  Print the bounded worker capability manifest\n");
  process.stdout.write("  plan      Project automatic and external assignments from the desk\n");
  process.stdout.write("  run       Claim, invoke, render, retain, and settle one automatic item\n");
  process.stdout.write("  status    Read worker files and current deterministic assignment plan\n");
  process.stdout.write("  verify    Reconstruct the desk, invocations, results, outputs, and settlements\n");
  process.stdout.write("  paths     Print the worker storage path contract\n\n");
  process.stdout.write("Options:\n");
  process.stdout.write("  --input <json>  Run input\n");
  process.stdout.write("  --root <path>   Holder-controlled answer-desk estate root\n");
  process.stdout.write("  --out <path>    Optional emitted JSON path\n");
}

try {
  switch (command) {
    case "manifest": {
      writeJson(buildAsoiafAnswerWorkerManifest(), value("out"));
      break;
    }
    case "plan": {
      const root = path.resolve(required("root"));
      const plan = planAsoiafAnswerDeskWorkers(root);
      const findings = validateAsoiafAnswerWorkerPlan(plan, root);
      const errors = findings.filter((entry) => entry.severity === "error");
      writeJson(
        {
          ok: errors.length === 0,
          root,
          plan,
          findings,
        },
        value("out"),
      );
      if (errors.length > 0) process.exitCode = 1;
      break;
    }
    case "run": {
      const input = readJson<AsoiafAnswerDeskWorkerRunInput>(required("input"));
      const result = runAsoiafAnswerDeskWorker(input);
      writeJson(result, value("out"));
      break;
    }
    case "status": {
      const root = path.resolve(required("root"));
      const status = readAsoiafAnswerDeskWorkerStatus(root);
      writeJson(
        {
          ok: true,
          root,
          ...status,
          counts: {
            assignments: status.plan.assignments.length,
            automaticAvailable: status.plan.automaticAvailableItemIds.length,
            externalAvailable: status.plan.externalAvailableItemIds.length,
            invocations: status.invocations.length,
            results: status.results.length,
          },
        },
        value("out"),
      );
      break;
    }
    case "verify": {
      const root = path.resolve(required("root"));
      const findings = verifyAsoiafAnswerDeskWorkerEstate(root);
      const errors = findings.filter((entry) => entry.severity === "error");
      const status = errors.length === 0
        ? readAsoiafAnswerDeskWorkerStatus(root)
        : null;
      writeJson(
        {
          ok: errors.length === 0,
          root,
          findings,
          manifest: status?.manifest ?? null,
          plan: status?.plan ?? null,
          counts: status
            ? {
                assignments: status.plan.assignments.length,
                automaticAvailable: status.plan.automaticAvailableItemIds.length,
                externalAvailable: status.plan.externalAvailableItemIds.length,
                invocations: status.invocations.length,
                results: status.results.length,
              }
            : null,
        },
        value("out"),
      );
      if (errors.length > 0) process.exitCode = 1;
      break;
    }
    case "paths": {
      writeJson(
        asoiafAnswerDeskWorkerPaths(path.resolve(required("root"))),
        value("out"),
      );
      break;
    }
    case "help":
    case "--help":
    case "-h":
      usage();
      break;
    default:
      throw new Error(`unknown command ${command}`);
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
