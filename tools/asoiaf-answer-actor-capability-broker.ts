#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  asoiafAnswerActorCapabilityBrokerPaths,
  executeAsoiafAnswerActorCapabilityInvocation,
  readAsoiafAnswerActorCapabilityStatus,
  recoverAsoiafAnswerActorCapabilityInvocation,
  retainAsoiafAnswerActorCapabilityPolicy,
  startAsoiafAnswerActorCapabilityInvocation,
  verifyAsoiafAnswerActorCapabilityBrokerEstate,
  type AsoiafAnswerActorCapabilityExecuteInput,
  type AsoiafAnswerActorCapabilityPolicyInput,
  type AsoiafAnswerActorCapabilityRecoverInput,
  type AsoiafAnswerActorCapabilityStartInput,
} from "./lib/asoiaf-answer-actor-capability-broker.js";

interface Options {
  input: string | null;
  root: string | null;
  out: string | null;
}

function help(): string {
  return `ASOIAF actor capability broker and kernel isolation custody

Commands:
  bind     Bind one exact ELF adapter, runtime loader, installation, compiler, and Linux x64 policy
  start    Validate and retain one isolated process start without releasing task input
  execute  Attest the kernel boundary, release task input, and retain one terminal receipt
  recover  Close an incomplete retained start without launching a duplicate process
  status   Read capability policies, isolated execution receipts, and projected state
  verify   Reconstruct parent, compiler, kernel, isolation, replay, and retention custody
  paths    Print the portable capability-broker storage contract

Options:
  --input <json>  Command input
  --root <path>   Holder-controlled answer estate root
  --out <path>    Optional JSON output path
`;
}

function parse(argv: string[]): { command: string; options: Options } {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  const command = args[0] ?? "help";
  const options: Options = { input: null, root: null, out: null };
  for (let index = 1; index < args.length; index += 1) {
    const name = args[index];
    const value = args[index + 1];
    if ((name === "--input" || name === "--root" || name === "--out") && value) {
      if (name === "--input") options.input = value;
      if (name === "--root") options.root = value;
      if (name === "--out") options.out = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown or incomplete actor capability option ${name ?? ""}`);
  }
  return { command, options };
}

function readInput<T>(options: Options): T {
  if (!options.input) throw new Error("actor capability command requires --input");
  const value = JSON.parse(fs.readFileSync(path.resolve(options.input), "utf8")) as T;
  if (options.root) {
    return { ...value as Record<string, unknown>, root: path.resolve(options.root) } as T;
  }
  return value;
}

function requiredRoot(options: Options): string {
  if (!options.root) throw new Error("actor capability command requires --root");
  return path.resolve(options.root);
}

function emit(value: unknown, out: string | null): void {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (out) {
    const target = path.resolve(out);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, serialized, "utf8");
  }
  process.stdout.write(serialized);
}

function status(root: string) {
  const value = readAsoiafAnswerActorCapabilityStatus(root);
  return {
    ok: true,
    ...value,
    counts: {
      policies: value.policies.length,
      starts: value.starts.length,
      terminals: value.terminals.length,
      stateEntries: value.state?.entries.length ?? 0,
      isolatedTerminals: value.terminals.filter((entry) => entry.osIsolationEnforced).length,
    },
  };
}

async function main(): Promise<void> {
  const { command, options } = parse(process.argv.slice(2));
  if (command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(help());
    return;
  }
  switch (command) {
    case "bind":
      emit(retainAsoiafAnswerActorCapabilityPolicy(
        readInput<AsoiafAnswerActorCapabilityPolicyInput>(options),
      ), options.out);
      return;
    case "start":
      emit(startAsoiafAnswerActorCapabilityInvocation(
        readInput<AsoiafAnswerActorCapabilityStartInput>(options),
      ), options.out);
      return;
    case "execute":
      emit(await executeAsoiafAnswerActorCapabilityInvocation(
        readInput<AsoiafAnswerActorCapabilityExecuteInput>(options),
      ), options.out);
      return;
    case "recover":
      emit(recoverAsoiafAnswerActorCapabilityInvocation(
        readInput<AsoiafAnswerActorCapabilityRecoverInput>(options),
      ), options.out);
      return;
    case "status":
      emit(status(requiredRoot(options)), options.out);
      return;
    case "verify": {
      const root = requiredRoot(options);
      const findings = verifyAsoiafAnswerActorCapabilityBrokerEstate(root);
      emit({
        ok: findings.every((entry) => entry.severity !== "error"),
        findings,
        counts: {
          errors: findings.filter((entry) => entry.severity === "error").length,
          warnings: findings.filter((entry) => entry.severity === "warning").length,
          notices: findings.filter((entry) => entry.severity === "notice").length,
        },
        capabilityCounts: status(root).counts,
      }, options.out);
      return;
    }
    case "paths":
      emit(asoiafAnswerActorCapabilityBrokerPaths(requiredRoot(options)), options.out);
      return;
    default:
      throw new Error(`unknown actor capability command ${command}`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
