#!/usr/bin/env node
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import {
  asoiafAnswerRemoteSupervisorPaths,
  buildAsoiafAnswerRemoteSupervisorPolicy,
  planAsoiafAnswerDeskRemoteSupervisor,
  prepareAsoiafAnswerRemoteSupervisorIntent,
  readAsoiafAnswerRemoteSupervisorStatus,
  tickAsoiafAnswerDeskRemoteSupervisor,
  validateAsoiafAnswerRemoteSupervisorPolicy,
  validateAsoiafAnswerRemoteSupervisorProjection,
  verifyAsoiafAnswerRemoteSupervisorEstate,
  type AsoiafAnswerRemoteSupervisorPolicy,
  type AsoiafAnswerRemoteSupervisorPolicyInput,
  type AsoiafAnswerRemoteSupervisorTickInput,
} from "./lib/asoiaf-answer-desk-remote-supervisor.js";

const args = process.argv.slice(2);
const command = args[0] ?? "help";

process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EPIPE") {
    process.exit(0);
  }
  throw error;
});

interface RemoteTickFileInput extends Omit<AsoiafAnswerRemoteSupervisorTickInput, "credentials"> {
  credentialFiles?: {
    certificateAdmissionId: string;
    clientCertificate: string;
    clientPrivateKey: string;
    serverCertificateAuthority: string;
    timeoutMilliseconds?: number;
  } | null;
}

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

function readBytes(filePath: string): Buffer {
  return fs.readFileSync(path.resolve(filePath));
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

function tickInput(filePath: string): AsoiafAnswerRemoteSupervisorTickInput {
  const input = readJson<RemoteTickFileInput>(filePath);
  const files = input.credentialFiles ?? null;
  const { credentialFiles: _credentialFiles, ...base } = input;
  return {
    ...base,
    credentials: files
      ? {
          certificateAdmissionId: files.certificateAdmissionId,
          clientCertificate: readBytes(files.clientCertificate),
          clientPrivateKey: readBytes(files.clientPrivateKey),
          serverCertificateAuthority: readBytes(files.serverCertificateAuthority),
          timeoutMilliseconds: files.timeoutMilliseconds,
        }
      : null,
  };
}

function usage(): void {
  process.stdout.write("ASOIAF remote answer-desk supervisor\n\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  policy   Bind qualified supervisor actors to exact admitted certificates and rendezvous\n");
  process.stdout.write("  plan     Project one remote scheduling decision without retaining intent or work\n");
  process.stdout.write("  prepare  Retain one remote write-ahead intent before any supervisor or network mutation\n");
  process.stdout.write("  tick     Dispatch externally through pinned rendezvous or delegate the exact local supervisor decision\n");
  process.stdout.write("  status   Read remote intents, runs, pending intents, and optional current projection\n");
  process.stdout.write("  verify   Reconstruct remote, supervisor, operations, transport, exchange, worker, and desk custody\n");
  process.stdout.write("  paths    Print the remote-supervisor storage path contract\n\n");
  process.stdout.write("Options:\n");
  process.stdout.write("  --input <json>   Policy or tick input. Tick credentialFiles are loaded ephemerally and never retained.\n");
  process.stdout.write("  --policy <json>  Optional remote policy for status projection\n");
  process.stdout.write("  --at <time>      Projection time used with --policy during status\n");
  process.stdout.write("  --root <path>    Holder-controlled answer-desk estate root\n");
  process.stdout.write("  --out <path>     Optional emitted JSON path\n");
}

try {
  switch (command) {
    case "policy": {
      const input = readJson<AsoiafAnswerRemoteSupervisorPolicyInput>(required("input"));
      const policy = buildAsoiafAnswerRemoteSupervisorPolicy(input);
      const findings = validateAsoiafAnswerRemoteSupervisorPolicy(policy);
      const errors = findings.filter((entry) => entry.severity === "error");
      writeJson({ ok: errors.length === 0, policy, findings }, value("out"));
      if (errors.length > 0) process.exitCode = 1;
      break;
    }
    case "plan": {
      const input = tickInput(required("input"));
      const projection = planAsoiafAnswerDeskRemoteSupervisor({
        root: input.root,
        policy: input.policy,
        projectedAt: input.requestedAt,
      });
      const findings = validateAsoiafAnswerRemoteSupervisorProjection(
        projection,
        input.root,
      );
      const errors = findings.filter((entry) => entry.severity === "error");
      writeJson({ ok: errors.length === 0, projection, findings }, value("out"));
      if (errors.length > 0) process.exitCode = 1;
      break;
    }
    case "prepare": {
      writeJson(
        prepareAsoiafAnswerRemoteSupervisorIntent(tickInput(required("input"))),
        value("out"),
      );
      break;
    }
    case "tick": {
      try {
        writeJson(
          await tickAsoiafAnswerDeskRemoteSupervisor(tickInput(required("input"))),
          value("out"),
        );
      } finally {
        https.globalAgent.destroy();
      }
      break;
    }
    case "status": {
      const root = path.resolve(required("root"));
      const policyPath = value("policy");
      const policy = policyPath
        ? readJson<AsoiafAnswerRemoteSupervisorPolicy>(policyPath)
        : null;
      const projectedAt = value("at") ?? null;
      const status = readAsoiafAnswerRemoteSupervisorStatus(
        root,
        policy,
        projectedAt,
      );
      writeJson(
        {
          ok: true,
          root,
          ...status,
          counts: {
            intents: status.intents.length,
            runs: status.runs.length,
            pendingIntents: status.pendingIntentIds.length,
            remoteBindings: status.projection?.policy.remoteBindings.length ?? null,
            readyRemoteBindings:
              status.projection?.readiness.filter((entry) => entry.ready).length ?? null,
          },
        },
        value("out"),
      );
      break;
    }
    case "verify": {
      const root = path.resolve(required("root"));
      const findings = verifyAsoiafAnswerRemoteSupervisorEstate(root);
      const errors = findings.filter((entry) => entry.severity === "error");
      const status = errors.length === 0
        ? readAsoiafAnswerRemoteSupervisorStatus(root)
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
                errors: errors.length,
                warnings: findings.filter((entry) => entry.severity === "warning").length,
                notices: findings.filter((entry) => entry.severity === "notice").length,
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
        asoiafAnswerRemoteSupervisorPaths(path.resolve(required("root"))),
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
