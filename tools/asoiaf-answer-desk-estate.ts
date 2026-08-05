#!/usr/bin/env node
import path from "node:path";
import {
  adoptAsoiafAnswerDeskWorkOrder,
  asoiafAnswerDeskEstatePaths,
  claimAsoiafAnswerDeskWork,
  readAsoiafAnswerDeskStatus,
  refreshAsoiafAnswerDeskState,
  settleAsoiafAnswerDeskWork,
  verifyAsoiafAnswerDeskEstate,
  type AsoiafAnswerDeskAdoptInput,
  type AsoiafAnswerDeskClaimInput,
  type AsoiafAnswerDeskSettleInput,
} from "./lib/asoiaf-answer-desk-estate.js";
import fs from "node:fs";

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
  process.stdout.write("ASOIAF persistent answer desk estate\n\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  adopt    Adopt one qualified answer work order into the local estate\n");
  process.stdout.write("  claim    Claim one exact open item from the authoritative local ledgers\n");
  process.stdout.write("  settle   Append one exact settlement and optionally advance the work-order head\n");
  process.stdout.write("  status   Read manifest, current desk state, and append-only ledger summaries\n");
  process.stdout.write("  refresh  Regenerate time-sensitive desk state from stored custody\n");
  process.stdout.write("  verify   Reconstruct and verify the complete persistent estate\n");
  process.stdout.write("  paths    Print the portable estate path contract\n\n");
  process.stdout.write("Options:\n");
  process.stdout.write("  --input <json>    Adopt, claim, or settlement input\n");
  process.stdout.write("  --root <path>     Holder-controlled answer-desk estate root\n");
  process.stdout.write("  --at <iso>        Refresh time\n");
  process.stdout.write("  --operator <id>   Refresh operator identity\n");
  process.stdout.write("  --out <path>      Optional emitted JSON path\n");
}

try {
  switch (command) {
    case "adopt": {
      const input = readJson<AsoiafAnswerDeskAdoptInput>(required("input"));
      const result = adoptAsoiafAnswerDeskWorkOrder(input);
      writeJson(result, value("out"));
      break;
    }
    case "claim": {
      const input = readJson<AsoiafAnswerDeskClaimInput>(required("input"));
      const result = claimAsoiafAnswerDeskWork(input);
      writeJson(result, value("out"));
      break;
    }
    case "settle": {
      const input = readJson<AsoiafAnswerDeskSettleInput>(required("input"));
      const result = settleAsoiafAnswerDeskWork(input);
      writeJson(result, value("out"));
      break;
    }
    case "status": {
      const root = path.resolve(required("root"));
      const status = readAsoiafAnswerDeskStatus(root);
      print({
        ok: true,
        root,
        manifest: status.manifest,
        state: status.state,
        counts: {
          workOrders: status.workOrders.length,
          leases: status.leases.length,
          settlements: status.settlements.length,
        },
        workOrders: status.workOrders,
        leases: status.leases,
        settlements: status.settlements,
      });
      break;
    }
    case "refresh": {
      const root = path.resolve(required("root"));
      const at = required("at");
      const state = refreshAsoiafAnswerDeskState(
        root,
        at,
        value("operator", "answer-desk:operator-refresh"),
      );
      writeJson(state, value("out"));
      break;
    }
    case "verify": {
      const root = path.resolve(required("root"));
      const findings = verifyAsoiafAnswerDeskEstate(root);
      const errors = findings.filter((entry) => entry.severity === "error");
      const status = errors.length === 0
        ? readAsoiafAnswerDeskStatus(root)
        : null;
      print({
        ok: errors.length === 0,
        root,
        findings,
        manifest: status?.manifest ?? null,
        state: status?.state ?? null,
        counts: status
          ? {
              workOrders: status.workOrders.length,
              leases: status.leases.length,
              settlements: status.settlements.length,
            }
          : null,
      });
      if (errors.length > 0) process.exitCode = 1;
      break;
    }
    case "paths": {
      print(asoiafAnswerDeskEstatePaths(path.resolve(required("root"))));
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