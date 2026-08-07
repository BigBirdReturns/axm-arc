#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  admitAsoiafAnswerCredentialPossessionProof,
  admitAsoiafAnswerCredentialTransportResult,
  asoiafAnswerCredentialBrokerPaths,
  bindAsoiafAnswerCredentialBrokerDeployment,
  buildAsoiafAnswerCredentialTransportResultStatement,
  readAsoiafAnswerCredentialBrokerStatus,
  retainAsoiafAnswerCredentialBrokerInvocation,
  retainAsoiafAnswerCredentialBrokerPolicy,
  serializeAsoiafAnswerCredentialBrokerInvocation,
  serializeAsoiafAnswerCredentialTransportResultStatement,
  verifyAsoiafAnswerCredentialBrokerEstate,
  type AsoiafAnswerCredentialBrokerRequest,
} from "./lib/asoiaf-answer-credential-broker.js";
import type {
  AsoiafAnswerCredentialProviderClass,
} from "./lib/asoiaf-answer-credential-deployment.js";
import type {
  AsoiafAnswerTransportProofAlgorithm,
} from "./lib/asoiaf-answer-desk-transport-enrollment.js";

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

function signature(input: Record<string, unknown>): string | Buffer {
  const file = typeof input.signatureFile === "string" ? input.signatureFile : null;
  if (file) return fs.readFileSync(path.resolve(file));
  if (typeof input.signatureBase64 === "string") return input.signatureBase64;
  if (typeof input.deviceAgentSignatureBase64 === "string") {
    return input.deviceAgentSignatureBase64;
  }
  throw new Error(
    "signatureFile, signatureBase64, or deviceAgentSignatureBase64 is required",
  );
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
  process.stdout.write("ASOIAF device-local credential broker\n\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  policy             Retain one device-local broker policy\n");
  process.stdout.write("  bind               Bind policy to the current active deployment\n");
  process.stdout.write("  invoke             Retain a possession or mutual-TLS invocation\n");
  process.stdout.write("  invocation-bytes   Emit exact canonical invocation bytes\n");
  process.stdout.write("  admit-proof        Verify and retain a credential possession proof\n");
  process.stdout.write("  transport-statement Prepare exact device-agent transport statement\n");
  process.stdout.write("  admit-transport    Verify and retain an attested transport result\n");
  process.stdout.write("  status             Read broker objects and deterministic state\n");
  process.stdout.write("  verify             Reconstruct deployment and broker custody\n");
  process.stdout.write("  paths              Print broker storage paths\n\n");
  process.stdout.write("Options:\n");
  process.stdout.write("  --input <json>  Command input\n");
  process.stdout.write("  --root <path>   Holder-controlled estate root\n");
  process.stdout.write("  --out <path>    Optional JSON output path\n");
}

try {
  switch (command) {
    case "policy": {
      const input = readJson<{
        root: string;
        brokerId: string;
        deviceId: string;
        serviceId: string;
        localEndpoint: string;
        allowedProviderClasses: AsoiafAnswerCredentialProviderClass[];
        allowedOperations: Array<"prove-possession" | "mutual-tls-request">;
        maxInvocationLifetimeMilliseconds: number;
        maxPossessionProofAgeMilliseconds: number;
        maxResponseBytes: number;
        createdAt: string;
        operatorId: string;
      }>(required("input"));
      writeJson(retainAsoiafAnswerCredentialBrokerPolicy(input));
      break;
    }
    case "bind": {
      writeJson(bindAsoiafAnswerCredentialBrokerDeployment(
        readJson(required("input")),
      ));
      break;
    }
    case "invoke": {
      const input = readJson<{
        root: string;
        policyId: string;
        bindingId: string;
        operation: "prove-possession" | "mutual-tls-request";
        idempotencyKey: string;
        request: AsoiafAnswerCredentialBrokerRequest;
        createdAt: string;
        expiresAt: string;
        operatorId: string;
      }>(required("input"));
      writeJson(retainAsoiafAnswerCredentialBrokerInvocation(input));
      break;
    }
    case "invocation-bytes": {
      const input = readJson<{ invocation: Parameters<typeof serializeAsoiafAnswerCredentialBrokerInvocation>[0] }>(required("input"));
      writeJson({
        invocationId: input.invocation.invocationId,
        invocationFingerprint: input.invocation.invocationFingerprint,
        bytesBase64: serializeAsoiafAnswerCredentialBrokerInvocation(
          input.invocation,
        ).toString("base64"),
      });
      break;
    }
    case "admit-proof": {
      const input = readJson<Record<string, unknown>>(required("input"));
      writeJson(admitAsoiafAnswerCredentialPossessionProof({
        root: String(input.root),
        invocationId: String(input.invocationId),
        signatureAlgorithm: String(input.signatureAlgorithm) as AsoiafAnswerTransportProofAlgorithm,
        signature: signature(input),
        provedAt: String(input.provedAt),
        operatorId: String(input.operatorId),
      }));
      break;
    }
    case "transport-statement": {
      writeJson(buildAsoiafAnswerCredentialTransportResultStatement(
        readJson(required("input")),
      ));
      break;
    }
    case "admit-transport": {
      const input = readJson<Record<string, unknown>>(required("input"));
      writeJson(admitAsoiafAnswerCredentialTransportResult({
        root: String(input.root),
        invocationId: String(input.invocationId),
        lowerRequestId: String(input.lowerRequestId),
        lowerRequestFingerprint: String(input.lowerRequestFingerprint),
        lowerResponseId: String(input.lowerResponseId),
        lowerResponseFingerprint: String(input.lowerResponseFingerprint),
        observedServerCertificateFingerprint: String(input.observedServerCertificateFingerprint),
        observedServerIssuerFingerprint: String(input.observedServerIssuerFingerprint),
        httpStatus: Number(input.httpStatus),
        responseBytes: Number(input.responseBytes),
        responseDigest: String(input.responseDigest),
        providerReceiptDigest: String(input.providerReceiptDigest),
        startedAt: String(input.startedAt),
        completedAt: String(input.completedAt),
        deviceAgentSignatureAlgorithm: String(input.deviceAgentSignatureAlgorithm) as AsoiafAnswerTransportProofAlgorithm,
        deviceAgentSignature: signature(input),
        operatorId: String(input.operatorId),
      }));
      break;
    }
    case "status": {
      const root = path.resolve(required("root"));
      const status = readAsoiafAnswerCredentialBrokerStatus(root);
      writeJson({
        ok: true,
        root,
        ...status,
        counts: {
          policies: status.policies.length,
          bindings: status.bindings.length,
          invocations: status.invocations.length,
          proofs: status.proofs.length,
          transportResults: status.transportResults.length,
          stateEntries: status.state?.entries.length ?? 0,
        },
      });
      break;
    }
    case "verify": {
      const root = path.resolve(required("root"));
      const findings = verifyAsoiafAnswerCredentialBrokerEstate(root);
      const errors = findings.filter((entry) => entry.severity === "error");
      writeJson({
        ok: errors.length === 0,
        root,
        findings,
        status: errors.length === 0
          ? readAsoiafAnswerCredentialBrokerStatus(root)
          : null,
      });
      if (errors.length > 0) process.exitCode = 1;
      break;
    }
    case "paths":
      writeJson(asoiafAnswerCredentialBrokerPaths(path.resolve(required("root"))));
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
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
