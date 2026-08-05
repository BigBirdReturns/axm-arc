#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  asoiafAnswerSupervisorPaths,
  buildAsoiafAnswerSupervisorPolicy,
  planAsoiafAnswerDeskSupervisor,
  prepareAsoiafAnswerSupervisorIntent,
  readAsoiafAnswerSupervisorStatus,
  tickAsoiafAnswerDeskSupervisor,
  validateAsoiafAnswerSupervisorPolicy,
  validateAsoiafAnswerSupervisorProjection,
  verifyAsoiafAnswerSupervisorEstate,
  type AsoiafAnswerSupervisorPolicy,
  type AsoiafAnswerSupervisorPolicyInput,
  type AsoiafAnswerSupervisorTickInput,
} from "./lib/asoiaf-answer-desk-supervisor.js";

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
  process.stdout.write("ASOIAF persistent answer desk supervisor\n\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  policy   Build and verify one deterministic actor-capacity policy\n");
  process.stdout.write("  plan     Project the next JIT scheduling decision without claiming work\n");
  process.stdout.write("  prepare  Retain one immutable write-ahead scheduling intent\n");
  process.stdout.write("  tick     Prepare and execute exactly one scheduling decision\n");
  process.stdout.write("  status   Read intents, runs, pending intents, and optional current plan\n");
  process.stdout.write("  verify   Reconstruct exchange, worker, intent, run, and operation custody\n");
  process.stdout.write("  paths    Print the supervisor storage path contract\n\n");
  process.stdout.write("Options:\n");
  process.stdout.write("  --input <json>   Policy or tick input\n");
  process.stdout.write("  --policy <json>  Optional policy for status projection\n");
  process.stdout.write("  --root <path>    Holder-controlled answer-desk estate root\n");
  process.stdout.write("  --out <path>     Optional emitted JSON path\n");
}

try {
  switch (command) {
    case "policy": {
      const input = readJson<AsoiafAnswerSupervisorPolicyInput>(required("input"));
      const policy = buildAsoiafAnswerSupervisorPolicy(input);
      const findings = validateAsoiafAnswerSupervisorPolicy(policy);
      const errors = findings.filter((entry) => entry.severity === "error");
      writeJson({ ok: errors.length === 0, policy, findings }, value("out"));
      if (errors.length > 0) process.exitCode = 1;
      break;
    }
    case "plan": {
      const input = readJson<AsoiafAnswerSupervisorTickInput>(required("input"));
      const projection = planAsoiafAnswerDeskSupervisor({
        root: input.root,
        policy: input.policy,
      });
      const findings = validateAsoiafAnswerSupervisorProjection(projection);
      const errors = findings.filter((entry) => entry.severity === "error");
      writeJson(
        {
          ok: errors.length === 0,
          root: path.resolve(input.root),
          projection,
          findings,
        },
        value("out"),
      );
      if (errors.length > 0) process.exitCode = 1;
      break;
    }
    case "prepare": {
      const input = readJson<AsoiafAnswerSupervisorTickInput>(required("input"));
      writeJson(prepareAsoiafAnswerSupervisorIntent(input), value("out"));
      break;
    }
    case "tick": {
      const input = readJson<AsoiafAnswerSupervisorTickInput>(required("input"));
      writeJson(tickAsoiafAnswerDeskSupervisor(input), value("out"));
      break;
    }
    case "status": {
      const root = path.resolve(required("root"));
      const policyPath = value("policy");
      const policy = policyPath
        ? readJson<AsoiafAnswerSupervisorPolicy>(policyPath)
        : null;
      const status = readAsoiafAnswerSupervisorStatus(root, policy);
      writeJson(
        {
          ok: true,
          root,
          ...status,
          counts: {
            intents: status.intents.length,
            runs: status.runs.length,
            pendingIntents: status.pendingIntentIds.length,
            automaticAvailable:
              status.projection?.automaticAvailableItemIds.length ?? null,
            externalAvailable:
              status.projection?.externalAvailableItemIds.length ?? null,
          },
        },
        value("out"),
      );
      break;
    }
    case "verify": {
      const root = path.resolve(required("root"));
      const findings = verifyAsoiafAnswerSupervisorEstate(root);
      const errors = findings.filter((entry) => entry.severity === "error");
      const status = errors.length === 0
        ? readAsoiafAnswerSupervisorStatus(root)
        : null;
      writeJson(
        {
          ok: errors.length === 0,
          root,
          findings,
          counts: status
            ? {
                intents: status.intents.length,
                runs: status.runs.length,
                pendingIntents: status.pendingIntentIds.length,
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
        asoiafAnswerSupervisorPaths(path.resolve(required("root"))),
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
