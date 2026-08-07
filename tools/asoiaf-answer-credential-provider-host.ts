#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  asoiafAnswerCredentialProviderHostPaths,
  asoiafAnswerCredentialWindowsCngPowerShell,
  executeAsoiafAnswerSyntheticPossession,
  executeAsoiafAnswerSyntheticTransport,
  executeAsoiafAnswerWindowsCngPossession,
  executeAsoiafAnswerWindowsCngTransport,
  prepareAsoiafAnswerCredentialProviderInvocation,
  readAsoiafAnswerCredentialProviderStatus,
  retainAsoiafAnswerCredentialProviderProfile,
  verifyAsoiafAnswerCredentialProviderHostEstate,
  type AsoiafAnswerCredentialProviderPrepareInput,
  type AsoiafAnswerCredentialProviderProfileInput,
  type AsoiafAnswerCredentialSyntheticPossessionInput,
  type AsoiafAnswerCredentialSyntheticTransportInput,
  type AsoiafAnswerCredentialWindowsPossessionInput,
  type AsoiafAnswerCredentialWindowsTransportInput,
} from "./lib/asoiaf-answer-credential-provider-host.js";

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
  process.stdout.write("ASOIAF device-local credential provider host\n\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  profile             Bind one local provider profile to an exact broker deployment\n");
  process.stdout.write("  prepare             Retain one provider invocation for a broker invocation\n");
  process.stdout.write("  synthetic-proof     Sign one possession invocation with a transient fixture key\n");
  process.stdout.write("  synthetic-transport Sign one synthetic transport statement with a transient agent key\n");
  process.stdout.write("  windows-proof       Sign one possession invocation through Windows CNG\n");
  process.stdout.write("  windows-transport   Execute one pinned mTLS request and attest it through Windows CNG\n");
  process.stdout.write("  powershell          Emit the exact Windows CNG adapter script\n");
  process.stdout.write("  status              Read provider profiles, invocations, results, and state\n");
  process.stdout.write("  verify              Reconstruct broker, deployment, and provider custody\n");
  process.stdout.write("  paths               Print provider-host storage paths\n\n");
  process.stdout.write("Options:\n");
  process.stdout.write("  --input <json>  Command input\n");
  process.stdout.write("  --root <path>   Holder-controlled estate root\n");
  process.stdout.write("  --out <path>    Optional JSON or script output path\n");
}

try {
  switch (command) {
    case "profile":
      writeJson(retainAsoiafAnswerCredentialProviderProfile(
        readJson<AsoiafAnswerCredentialProviderProfileInput>(required("input")),
      ));
      break;
    case "prepare":
      writeJson(prepareAsoiafAnswerCredentialProviderInvocation(
        readJson<AsoiafAnswerCredentialProviderPrepareInput>(required("input")),
      ));
      break;
    case "synthetic-proof":
      writeJson(executeAsoiafAnswerSyntheticPossession(
        readJson<AsoiafAnswerCredentialSyntheticPossessionInput>(required("input")),
      ));
      break;
    case "synthetic-transport":
      writeJson(executeAsoiafAnswerSyntheticTransport(
        readJson<AsoiafAnswerCredentialSyntheticTransportInput>(required("input")),
      ));
      break;
    case "windows-proof":
      writeJson(executeAsoiafAnswerWindowsCngPossession(
        readJson<AsoiafAnswerCredentialWindowsPossessionInput>(required("input")),
      ));
      break;
    case "windows-transport":
      writeJson(executeAsoiafAnswerWindowsCngTransport(
        readJson<AsoiafAnswerCredentialWindowsTransportInput>(required("input")),
      ));
      break;
    case "powershell": {
      const script = asoiafAnswerCredentialWindowsCngPowerShell();
      const target = value("out");
      if (!target) {
        process.stdout.write(script);
      } else {
        const resolved = path.resolve(target);
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        fs.writeFileSync(resolved, script, "utf8");
        process.stdout.write(`${JSON.stringify({ ok: true, output: resolved }, null, 2)}\n`);
      }
      break;
    }
    case "status": {
      const root = path.resolve(required("root"));
      const status = readAsoiafAnswerCredentialProviderStatus(root);
      writeJson({
        ok: true,
        root,
        ...status,
        counts: {
          profiles: status.profiles.length,
          invocations: status.invocations.length,
          results: status.results.length,
          stateEntries: status.state?.entries.length ?? 0,
        },
      });
      break;
    }
    case "verify": {
      const root = path.resolve(required("root"));
      const findings = verifyAsoiafAnswerCredentialProviderHostEstate(root);
      const errors = findings.filter((entry) => entry.severity === "error");
      writeJson({
        ok: errors.length === 0,
        root,
        findings,
        status: errors.length === 0
          ? readAsoiafAnswerCredentialProviderStatus(root)
          : null,
      });
      if (errors.length > 0) process.exitCode = 1;
      break;
    }
    case "paths":
      writeJson(asoiafAnswerCredentialProviderHostPaths(path.resolve(required("root"))));
      break;
    case "help":
    case "--help":
    case "-h":
      usage();
      break;
    default:
      throw new Error(`unknown command ${command}`);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}
