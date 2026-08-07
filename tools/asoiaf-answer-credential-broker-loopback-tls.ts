#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  asoiafAnswerCredentialBrokerLoopbackTlsPaths,
  invokeAsoiafAnswerCredentialBrokerLoopbackTls,
  probeAsoiafAnswerCredentialBrokerLoopbackTls,
  readAsoiafAnswerCredentialBrokerLoopbackTlsStatus,
  retainAsoiafAnswerCredentialBrokerLoopbackTlsPolicy,
  retainAsoiafAnswerCredentialBrokerLoopbackTlsSession,
  startAsoiafAnswerCredentialBrokerLoopbackTls,
  verifyAsoiafAnswerCredentialBrokerLoopbackTlsEstate,
  type AsoiafAnswerCredentialBrokerLoopbackTlsPolicyInput,
  type AsoiafAnswerCredentialBrokerLoopbackTlsSessionInput,
} from "./lib/asoiaf-answer-credential-broker-loopback-tls.js";
import type {
  AsoiafAnswerCredentialBrokerServicePayload,
  AsoiafAnswerCredentialBrokerServiceRequest,
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

function integer(name: string, fallback?: number): number {
  const raw = value(name, fallback === undefined ? undefined : String(fallback));
  if (raw === undefined || !/^\d+$/.test(raw)) {
    throw new Error(`--${name} must be a non-negative integer`);
  }
  return Number(raw);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8")) as T;
}

function readMaterial(filePath: string): Buffer {
  return fs.readFileSync(path.resolve(filePath));
}

function print(valueToPrint: unknown): void {
  process.stdout.write(`${JSON.stringify(valueToPrint, null, 2)}\n`);
}

function writeJson(valueToWrite: unknown, target?: string): void {
  const serialized = `${JSON.stringify(valueToWrite, null, 2)}\n`;
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
  process.stdout.write("ASOIAF credential broker loopback mutual-TLS listener\n\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  policy   Bind one broker-service policy to an exact loopback endpoint lease and mTLS client\n");
  process.stdout.write("  prepare  Retain one bounded listener start intent\n");
  process.stdout.write("  serve    Bind the exact loopback endpoint and serve authenticated service requests\n");
  process.stdout.write("  invoke   Send one signed service request through pinned mutual TLS\n");
  process.stdout.write("  probe    Retain one pinned mutual-TLS availability observation\n");
  process.stdout.write("  status   Read listener policies, sessions, lifecycle receipts, and state\n");
  process.stdout.write("  verify   Reconstruct service, transport, certificate, endpoint, and listener custody\n");
  process.stdout.write("  paths    Print listener storage paths\n\n");
  process.stdout.write("Common options:\n");
  process.stdout.write("  --input <json>                  Typed policy, session, or invocation input\n");
  process.stdout.write("  --root <path>                   Holder-controlled estate root\n");
  process.stdout.write("  --server-certificate <path>     Transient admitted server certificate PEM\n");
  process.stdout.write("  --server-key <path>             Transient matching server private key PEM\n");
  process.stdout.write("  --client-certificate <path>     Transient admitted client certificate PEM\n");
  process.stdout.write("  --client-key <path>             Transient matching client private key PEM\n");
  process.stdout.write("  --client-ca-certificate <path>  Transient accepted client CA certificate PEM\n");
  process.stdout.write("  --server-ca-certificate <path>  Transient trusted server CA certificate PEM\n");
  process.stdout.write("  --out <path>                    Optional JSON output path\n");
}

try {
  switch (command) {
    case "policy":
      writeJson(
        retainAsoiafAnswerCredentialBrokerLoopbackTlsPolicy(
          readJson<AsoiafAnswerCredentialBrokerLoopbackTlsPolicyInput>(
            required("input"),
          ),
        ),
        value("out"),
      );
      break;
    case "prepare":
      writeJson(
        retainAsoiafAnswerCredentialBrokerLoopbackTlsSession(
          readJson<AsoiafAnswerCredentialBrokerLoopbackTlsSessionInput>(
            required("input"),
          ),
        ),
        value("out"),
      );
      break;
    case "serve": {
      const root = path.resolve(required("root"));
      const server = await startAsoiafAnswerCredentialBrokerLoopbackTls({
        root,
        sessionId: required("session-id"),
        serverCertificate: readMaterial(required("server-certificate")),
        serverPrivateKey: readMaterial(required("server-key")),
        clientCertificateAuthority: readMaterial(
          required("client-ca-certificate"),
        ),
        ...(value("max-requests") === undefined
          ? {}
          : { maxRequests: integer("max-requests") }),
      });
      writeJson({
        ok: true,
        listenerPolicyId: server.listenerPolicyId,
        sessionId: server.sessionId,
        endpointLeaseId: server.endpointLeaseId,
        baseUrl: server.baseUrl,
        host: server.host,
        port: server.port,
        ready: server.ready,
        mutualTlsRequired: true,
        privateKeyRetained: false,
        certificateRetained: false,
      }, value("out"));

      let closing = false;
      const close = async (signal: string): Promise<void> => {
        if (closing) return;
        closing = true;
        try {
          await server.close(
            `The operator closed the loopback mutual-TLS listener after receiving ${signal}; the runtime retained only public lifecycle counts and no certificate or key material.`,
          );
        } catch (error) {
          process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
          process.exitCode = 1;
        }
      };
      process.once("SIGINT", () => void close("SIGINT"));
      process.once("SIGTERM", () => void close("SIGTERM"));
      const summary = await server.closed;
      const summaryTarget = value("summary-out");
      if (summaryTarget) writeJson({ ok: true, ...summary }, summaryTarget);
      else process.stderr.write(`${JSON.stringify({ ok: true, ...summary }, null, 2)}\n`);
      break;
    }
    case "invoke": {
      const input = readJson<{
        baseUrl: string;
        expectedServerCertificateFingerprint: string;
        request: AsoiafAnswerCredentialBrokerServiceRequest;
        payload: AsoiafAnswerCredentialBrokerServicePayload;
        timeoutMilliseconds?: number;
        maxResponseBytes?: number;
      }>(required("input"));
      const response = await invokeAsoiafAnswerCredentialBrokerLoopbackTls({
        baseUrl: input.baseUrl,
        expectedServerCertificateFingerprint:
          input.expectedServerCertificateFingerprint,
        clientCertificate: readMaterial(required("client-certificate")),
        clientPrivateKey: readMaterial(required("client-key")),
        serverCertificateAuthority: readMaterial(
          required("server-ca-certificate"),
        ),
        request: input.request,
        payload: input.payload,
        ...(input.timeoutMilliseconds === undefined
          ? {}
          : { timeoutMilliseconds: input.timeoutMilliseconds }),
        ...(input.maxResponseBytes === undefined
          ? {}
          : { maxResponseBytes: input.maxResponseBytes }),
      });
      writeJson(response, value("out"));
      if (!response.ok) process.exitCode = 1;
      break;
    }
    case "probe":
      writeJson(
        await probeAsoiafAnswerCredentialBrokerLoopbackTls({
          root: path.resolve(required("root")),
          listenerPolicyId: required("listener-policy-id"),
          clientCertificate: readMaterial(required("client-certificate")),
          clientPrivateKey: readMaterial(required("client-key")),
          serverCertificateAuthority: readMaterial(
            required("server-ca-certificate"),
          ),
          observedAt: required("observed-at"),
          ...(value("timeout-ms") === undefined
            ? {}
            : { timeoutMilliseconds: integer("timeout-ms") }),
        }),
        value("out"),
      );
      break;
    case "status": {
      const root = path.resolve(required("root"));
      const status = readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(root);
      writeJson({
        ok: true,
        root,
        ...status,
        counts: {
          policies: status.policies.length,
          sessions: status.sessions.length,
          ready: status.lifecycle.filter((entry) => entry.kind === "ready").length,
          stopped: status.lifecycle.filter((entry) => entry.kind === "stopped").length,
          recovered: status.lifecycle.filter((entry) => entry.kind === "recovered").length,
          activeSessions: status.state?.entries.reduce(
            (total, entry) => total + entry.activeSessionIds.length,
            0,
          ) ?? 0,
          preparedSessions: status.state?.entries.reduce(
            (total, entry) => total + entry.preparedSessionIds.length,
            0,
          ) ?? 0,
        },
      }, value("out"));
      break;
    }
    case "verify": {
      const root = path.resolve(required("root"));
      const findings = verifyAsoiafAnswerCredentialBrokerLoopbackTlsEstate(root);
      const errors = findings.filter((entry) => entry.severity === "error");
      writeJson({
        ok: errors.length === 0,
        root,
        findings,
        counts: {
          errors: errors.length,
          warnings: findings.filter((entry) => entry.severity === "warning").length,
          notices: findings.filter((entry) => entry.severity === "notice").length,
        },
      }, value("out"));
      if (errors.length > 0) process.exitCode = 1;
      break;
    }
    case "paths":
      writeJson(
        asoiafAnswerCredentialBrokerLoopbackTlsPaths(
          path.resolve(required("root")),
        ),
        value("out"),
      );
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
