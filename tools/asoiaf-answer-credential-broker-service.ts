#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  asoiafAnswerCredentialBrokerServicePaths,
  createAsoiafAnswerCredentialBrokerServiceRequest,
  dispatchAsoiafAnswerCredentialBrokerServiceRequest,
  invokeAsoiafAnswerCredentialBrokerService,
  probeAsoiafAnswerCredentialBrokerServiceEndpoint,
  readAsoiafAnswerCredentialBrokerServiceStatus,
  retainAsoiafAnswerCredentialBrokerServicePolicy,
  startAsoiafAnswerCredentialBrokerService,
  verifyAsoiafAnswerCredentialBrokerServiceEstate,
  type AsoiafAnswerCredentialBrokerServiceDispatchInput,
  type AsoiafAnswerCredentialBrokerServiceInvokeInput,
  type AsoiafAnswerCredentialBrokerServicePolicyInput,
  type AsoiafAnswerCredentialBrokerServiceRequestInput,
} from "./lib/asoiaf-answer-credential-broker-service.js";

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

function writeFileJson(target: string, output: unknown): string {
  const resolved = path.resolve(target);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return resolved;
}

function writeJson(output: unknown): void {
  const target = value("out");
  if (!target) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }
  const resolved = writeFileJson(target, output);
  process.stdout.write(`${JSON.stringify({ ok: true, output: resolved }, null, 2)}\n`);
}

function usage(): void {
  process.stdout.write("ASOIAF authenticated local credential broker service\n\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  policy          Bind one broker policy and provider profile to a signed local-service policy\n");
  process.stdout.write("  sign            Build and sign one payload-digest-only local-service request\n");
  process.stdout.write("  dispatch        Admit and execute one signed request in-process\n");
  process.stdout.write("  serve           Listen on the retained Unix socket or Windows named pipe\n");
  process.stdout.write("  invoke          Send one signed request and transient payload to the local service\n");
  process.stdout.write("  probe-endpoint  Exercise bounded local framing on Unix or Windows IPC\n");
  process.stdout.write("  status          Read service policies, requests, receipts, and deterministic state\n");
  process.stdout.write("  verify          Reconstruct broker, provider, request, receipt, and secret custody\n");
  process.stdout.write("  paths           Print broker-service storage paths\n\n");
  process.stdout.write("Options:\n");
  process.stdout.write("  --input <json>  Command input\n");
  process.stdout.write("  --root <path>   Holder-controlled estate root\n");
  process.stdout.write("  --out <path>    Optional JSON output path\n");
}

async function main(): Promise<void> {
  switch (command) {
    case "policy":
      writeJson(retainAsoiafAnswerCredentialBrokerServicePolicy(
        readJson<AsoiafAnswerCredentialBrokerServicePolicyInput>(required("input")),
      ));
      return;
    case "sign":
      writeJson(createAsoiafAnswerCredentialBrokerServiceRequest(
        readJson<AsoiafAnswerCredentialBrokerServiceRequestInput>(required("input")),
      ));
      return;
    case "dispatch":
      writeJson(dispatchAsoiafAnswerCredentialBrokerServiceRequest(
        readJson<AsoiafAnswerCredentialBrokerServiceDispatchInput>(required("input")),
      ));
      return;
    case "serve": {
      const input = readJson<{
        root: string;
        servicePolicyId: string;
        maxRequests?: number;
        powershellExecutable?: string;
        readyFile?: string;
        summaryFile?: string;
      }>(required("input"));
      const server = await startAsoiafAnswerCredentialBrokerService({
        root: input.root,
        servicePolicyId: input.servicePolicyId,
        maxRequests: input.maxRequests,
        powershellExecutable: input.powershellExecutable,
      });
      const ready = {
        ok: true,
        endpoint: server.endpoint,
        endpointKind: server.endpointKind,
        startedAt: server.startedAt,
      };
      if (input.readyFile) writeFileJson(input.readyFile, ready);
      process.stdout.write(`${JSON.stringify(ready)}\n`);
      const close = (): void => {
        void server.close();
      };
      process.once("SIGINT", close);
      process.once("SIGTERM", close);
      const summary = await server.closed;
      if (input.summaryFile) writeFileJson(input.summaryFile, summary);
      else process.stdout.write(`${JSON.stringify(summary)}\n`);
      return;
    }
    case "invoke": {
      const input = readJson<AsoiafAnswerCredentialBrokerServiceInvokeInput>(required("input"));
      writeJson(await invokeAsoiafAnswerCredentialBrokerService(input));
      return;
    }
    case "probe-endpoint": {
      const input = readJson<{
        endpoint: string;
        challenge: string;
        timeoutMilliseconds?: number;
      }>(required("input"));
      writeJson(await probeAsoiafAnswerCredentialBrokerServiceEndpoint(input));
      return;
    }
    case "status": {
      const root = path.resolve(required("root"));
      const status = readAsoiafAnswerCredentialBrokerServiceStatus(root);
      writeJson({
        ok: true,
        root,
        ...status,
        counts: {
          policies: status.policies.length,
          requests: status.requests.length,
          receipts: status.receipts.length,
          stateEntries: status.state?.entries.length ?? 0,
          pendingRequests: status.state?.entries.reduce(
            (total, entry) => total + entry.pendingRequestIds.length,
            0,
          ) ?? 0,
        },
      });
      return;
    }
    case "verify": {
      const root = path.resolve(required("root"));
      const findings = verifyAsoiafAnswerCredentialBrokerServiceEstate(root);
      const errors = findings.filter((entry) => entry.severity === "error");
      writeJson({
        ok: errors.length === 0,
        root,
        findings,
        status: errors.length === 0
          ? readAsoiafAnswerCredentialBrokerServiceStatus(root)
          : null,
      });
      if (errors.length > 0) process.exitCode = 1;
      return;
    }
    case "paths":
      writeJson(asoiafAnswerCredentialBrokerServicePaths(path.resolve(required("root"))));
      return;
    case "help":
    case "--help":
    case "-h":
      usage();
      return;
    default:
      throw new Error(`unknown command ${command}`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
