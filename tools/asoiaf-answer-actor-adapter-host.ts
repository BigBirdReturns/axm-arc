#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  asoiafAnswerActorAdapterHostPaths,
  executeAsoiafAnswerActorAdapterInvocation,
  prepareAsoiafAnswerActorAdapterInvocation,
  readAsoiafAnswerActorAdapterHostStatus,
  recoverAsoiafAnswerActorAdapterInvocation,
  retainAsoiafAnswerActorAdapterInstallation,
  retainAsoiafAnswerActorAdapterManifest,
  startAsoiafAnswerActorAdapterInvocation,
  verifyAsoiafAnswerActorAdapterHostEstate,
  type AsoiafAnswerActorAdapterExecuteInput,
  type AsoiafAnswerActorAdapterInstallationInput,
  type AsoiafAnswerActorAdapterManifestInput,
  type AsoiafAnswerActorAdapterPrepareInput,
  type AsoiafAnswerActorAdapterRecoverInput,
  type AsoiafAnswerActorAdapterStartInput,
} from "./lib/asoiaf-answer-actor-adapter-host.js";

interface Options {
  input: string | null;
  root: string | null;
  out: string | null;
}

function help(): string {
  return `ASOIAF actor adapter host and process custody

Commands:
  manifest  Bind an adapter identity, executable, bundle, fixed arguments, environment, and process ceilings
  install   Bind one exact manifest to one holder-controlled host installation
  prepare   Bind one runtime execution intent and provider result to one adapter invocation
  start     Retain one process-start receipt without launching the process
  execute   Launch one exact process with stdin-only task input and retain one terminal receipt
  recover   Close an incomplete retained start as an interrupted process without relaunch
  status    Read adapter manifests, installations, invocations, process receipts, and state
  verify    Reconstruct runtime, provider, process, replay, retention, and state custody
  paths     Print the portable adapter-host storage contract

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
    throw new Error(`unknown or incomplete actor adapter option ${name ?? ""}`);
  }
  return { command, options };
}

function readInput<T>(options: Options): T {
  if (!options.input) throw new Error("actor adapter command requires --input");
  const value = JSON.parse(fs.readFileSync(path.resolve(options.input), "utf8")) as T;
  if (options.root) {
    return { ...value as Record<string, unknown>, root: path.resolve(options.root) } as T;
  }
  return value;
}

function requiredRoot(options: Options): string {
  if (!options.root) throw new Error("actor adapter command requires --root");
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
  const value = readAsoiafAnswerActorAdapterHostStatus(root);
  return {
    ok: true,
    ...value,
    counts: {
      manifests: value.manifests.length,
      installations: value.installations.length,
      invocations: value.invocations.length,
      starts: value.starts.length,
      terminals: value.terminals.length,
      stateEntries: value.state?.entries.length ?? 0,
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
    case "manifest":
      emit(retainAsoiafAnswerActorAdapterManifest(
        readInput<AsoiafAnswerActorAdapterManifestInput>(options),
      ), options.out);
      return;
    case "install":
      emit(retainAsoiafAnswerActorAdapterInstallation(
        readInput<AsoiafAnswerActorAdapterInstallationInput>(options),
      ), options.out);
      return;
    case "prepare":
      emit(prepareAsoiafAnswerActorAdapterInvocation(
        readInput<AsoiafAnswerActorAdapterPrepareInput>(options),
      ), options.out);
      return;
    case "start": {
      const started = startAsoiafAnswerActorAdapterInvocation(
        readInput<AsoiafAnswerActorAdapterStartInput>(options),
      );
      emit({ start: started.start, replayed: started.replayed }, options.out);
      return;
    }
    case "execute":
      emit(await executeAsoiafAnswerActorAdapterInvocation(
        readInput<AsoiafAnswerActorAdapterExecuteInput>(options),
      ), options.out);
      return;
    case "recover":
      emit(recoverAsoiafAnswerActorAdapterInvocation(
        readInput<AsoiafAnswerActorAdapterRecoverInput>(options),
      ), options.out);
      return;
    case "status":
      emit(status(requiredRoot(options)), options.out);
      return;
    case "verify": {
      const root = requiredRoot(options);
      const findings = verifyAsoiafAnswerActorAdapterHostEstate(root);
      emit({
        ok: findings.every((entry) => entry.severity !== "error"),
        findings,
        counts: {
          errors: findings.filter((entry) => entry.severity === "error").length,
          warnings: findings.filter((entry) => entry.severity === "warning").length,
          notices: findings.filter((entry) => entry.severity === "notice").length,
        },
        adapterCounts: status(root).counts,
      }, options.out);
      return;
    }
    case "paths":
      emit(asoiafAnswerActorAdapterHostPaths(requiredRoot(options)), options.out);
      return;
    default:
      throw new Error(`unknown actor adapter command ${command}`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
