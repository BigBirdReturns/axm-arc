#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  admitAsoiafAnswerExchangeResult,
  asoiafAnswerExchangePaths,
  issueAsoiafAnswerExchangeAssignment,
  readAsoiafAnswerExchangeStatus,
  verifyAsoiafAnswerExchangeEstate,
  type AsoiafAnswerExchangeIssueInput,
  type AsoiafAnswerExchangeResultInput,
} from "./lib/asoiaf-answer-desk-exchange.js";
import {
  planAsoiafAnswerDeskWorkers,
  validateAsoiafAnswerWorkerPlan,
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
  process.stdout.write("ASOIAF persistent answer desk external exchange\n\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  plan    Project current automatic and external assignments\n");
  process.stdout.write("  issue   Claim one external item and retain its actor-bound bundle\n");
  process.stdout.write("  admit   Validate one external result and settle the exact lease\n");
  process.stdout.write("  status  Read retained assignments, results, and current plan\n");
  process.stdout.write("  verify  Reconstruct the desk, worker, exchange, and settlements\n");
  process.stdout.write("  paths   Print the external exchange storage path contract\n\n");
  process.stdout.write("Options:\n");
  process.stdout.write("  --input <json>  Issue or admission input\n");
  process.stdout.write("  --root <path>   Holder-controlled answer-desk estate root\n");
  process.stdout.write("  --out <path>    Optional emitted JSON path\n");
}

try {
  switch (command) {
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
    case "issue": {
      const input = readJson<AsoiafAnswerExchangeIssueInput>(required("input"));
      writeJson(issueAsoiafAnswerExchangeAssignment(input), value("out"));
      break;
    }
    case "admit": {
      const input = readJson<AsoiafAnswerExchangeResultInput>(required("input"));
      writeJson(admitAsoiafAnswerExchangeResult(input), value("out"));
      break;
    }
    case "status": {
      const root = path.resolve(required("root"));
      const status = readAsoiafAnswerExchangeStatus(root);
      writeJson(
        {
          ok: true,
          root,
          ...status,
          counts: {
            assignments: status.assignments.length,
            results: status.results.length,
            automaticAvailable: status.plan.automaticAvailableItemIds.length,
            externalAvailable: status.plan.externalAvailableItemIds.length,
          },
        },
        value("out"),
      );
      break;
    }
    case "verify": {
      const root = path.resolve(required("root"));
      const findings = verifyAsoiafAnswerExchangeEstate(root);
      const errors = findings.filter((entry) => entry.severity === "error");
      const status = errors.length === 0
        ? readAsoiafAnswerExchangeStatus(root)
        : null;
      writeJson(
        {
          ok: errors.length === 0,
          root,
          findings,
          plan: status?.plan ?? null,
          counts: status
            ? {
                assignments: status.assignments.length,
                results: status.results.length,
                automaticAvailable: status.plan.automaticAvailableItemIds.length,
                externalAvailable: status.plan.externalAvailableItemIds.length,
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
        asoiafAnswerExchangePaths(path.resolve(required("root"))),
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
