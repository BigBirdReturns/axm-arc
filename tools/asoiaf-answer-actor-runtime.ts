#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  acceptAsoiafAnswerActorRuntimeDelivery,
  asoiafAnswerActorRuntimePaths,
  prepareAsoiafAnswerActorRuntimeExecution,
  prepareAsoiafAnswerActorRuntimeReturn,
  readAsoiafAnswerActorRuntimeStatus,
  recordAsoiafAnswerActorRuntimeResult,
  recordAsoiafAnswerActorRuntimeReturn,
  retainAsoiafAnswerActorRuntimeSlot,
  retireAsoiafAnswerActorRuntimeSlot,
  verifyAsoiafAnswerActorRuntimeEstate,
  type AsoiafAnswerActorRuntimeAcceptInput,
  type AsoiafAnswerActorRuntimePrepareInput,
  type AsoiafAnswerActorRuntimePrepareReturnInput,
  type AsoiafAnswerActorRuntimeRecordReturnInput,
  type AsoiafAnswerActorRuntimeResultInput,
  type AsoiafAnswerActorRuntimeRetireInput,
  type AsoiafAnswerActorRuntimeSlotInput,
} from "./lib/asoiaf-answer-actor-runtime.js";

const args = process.argv.slice(2);
const command = args[0] ?? "help";

function value(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

function required(name: string): string {
  const result = value(name);
  if (!result) throw new Error(`--${name} is required`);
  return result;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8")) as T;
}

function writeJson(output: unknown): void {
  const target = value("out");
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (!target) {
    process.stdout.write(serialized);
    return;
  }
  const resolved = path.resolve(target);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, serialized, "utf8");
  process.stdout.write(`${JSON.stringify({ ok: true, output: resolved }, null, 2)}\n`);
}

function usage(): void {
  process.stdout.write("ASOIAF actor runtime and durable mailbox\n\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  slot            Bind one delivery certificate and provider profile to a local actor slot\n");
  process.stdout.write("  accept          Import one exact certificate-bound supervised assignment\n");
  process.stdout.write("  prepare         Retain one digest-only adapter execution intent\n");
  process.stdout.write("  result          Retain one typed local result bound to a public provider result\n");
  process.stdout.write("  prepare-return  Retain one durable supervised result-return intent\n");
  process.stdout.write("  record-return   Bind one exact supervised return and settlement acknowledgement\n");
  process.stdout.write("  retire          Retire one local credential slot and strand unresolved work on emergency retirement\n");
  process.stdout.write("  status          Read slots, assignments, execution, returns, retirements, and state\n");
  process.stdout.write("  verify          Reconstruct delivery, provider, runtime, return, and retirement custody\n");
  process.stdout.write("  paths           Print the actor-runtime storage contract\n\n");
  process.stdout.write("Options:\n");
  process.stdout.write("  --input <json>  Command input\n");
  process.stdout.write("  --root <path>   Holder-controlled answer estate root\n");
  process.stdout.write("  --out <path>    Optional JSON output path\n");
}

try {
  switch (command) {
    case "slot":
      writeJson(retainAsoiafAnswerActorRuntimeSlot(
        readJson<AsoiafAnswerActorRuntimeSlotInput>(required("input")),
      ));
      break;
    case "accept":
      writeJson(acceptAsoiafAnswerActorRuntimeDelivery(
        readJson<AsoiafAnswerActorRuntimeAcceptInput>(required("input")),
      ));
      break;
    case "prepare":
      writeJson(prepareAsoiafAnswerActorRuntimeExecution(
        readJson<AsoiafAnswerActorRuntimePrepareInput>(required("input")),
      ));
      break;
    case "result":
      writeJson(recordAsoiafAnswerActorRuntimeResult(
        readJson<AsoiafAnswerActorRuntimeResultInput>(required("input")),
      ));
      break;
    case "prepare-return":
      writeJson(prepareAsoiafAnswerActorRuntimeReturn(
        readJson<AsoiafAnswerActorRuntimePrepareReturnInput>(required("input")),
      ));
      break;
    case "record-return":
      writeJson(recordAsoiafAnswerActorRuntimeReturn(
        readJson<AsoiafAnswerActorRuntimeRecordReturnInput>(required("input")),
      ));
      break;
    case "retire":
      writeJson(retireAsoiafAnswerActorRuntimeSlot(
        readJson<AsoiafAnswerActorRuntimeRetireInput>(required("input")),
      ));
      break;
    case "status": {
      const root = path.resolve(required("root"));
      const status = readAsoiafAnswerActorRuntimeStatus(root);
      writeJson({
        ok: true,
        root,
        ...status,
        counts: {
          slots: status.slots.length,
          acceptances: status.acceptances.length,
          executionIntents: status.executionIntents.length,
          results: status.results.length,
          returnIntents: status.returnIntents.length,
          returnReceipts: status.returnReceipts.length,
          retirements: status.retirements.length,
          stranded: status.stranded.length,
          stateEntries: status.state?.entries.length ?? 0,
        },
      });
      break;
    }
    case "verify": {
      const root = path.resolve(required("root"));
      const findings = verifyAsoiafAnswerActorRuntimeEstate(root);
      const counts = {
        errors: findings.filter((entry) => entry.severity === "error").length,
        warnings: findings.filter((entry) => entry.severity === "warning").length,
        notices: findings.filter((entry) => entry.severity === "notice").length,
      };
      writeJson({
        ok: counts.errors === 0,
        root,
        findings,
        counts,
        status: counts.errors === 0 ? readAsoiafAnswerActorRuntimeStatus(root) : null,
      });
      if (counts.errors > 0) process.exitCode = 1;
      break;
    }
    case "paths":
      writeJson(asoiafAnswerActorRuntimePaths(path.resolve(required("root"))));
      break;
    case "help":
    case "--help":
    case "-h":
      usage();
      break;
    default:
      throw new Error(`unknown actor runtime command ${command}`);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}
