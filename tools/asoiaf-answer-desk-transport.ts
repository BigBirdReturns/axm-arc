#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  asoiafAnswerTransportPaths,
  createAsoiafAnswerTransportServer,
  fingerprintAsoiafAnswerTransportCertificate,
  listenAsoiafAnswerTransportServer,
  readAsoiafAnswerTransportStatus,
  registerAsoiafAnswerTransportActor,
  requestAsoiafAnswerTransport,
  revokeAsoiafAnswerTransportActor,
  verifyAsoiafAnswerTransportEstate,
  type AsoiafAnswerTransportOperation,
} from "./lib/asoiaf-answer-desk-transport.js";
import type {
  AsoiafAnswerExchangeActorRole,
} from "./lib/asoiaf-answer-desk-exchange.js";

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

function readPem(filePath: string): Buffer {
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

function certificateFingerprint(): `sha256:${string}` {
  const explicit = value("fingerprint");
  if (explicit) return explicit.trim().toLowerCase() as `sha256:${string}`;
  return fingerprintAsoiafAnswerTransportCertificate(
    readPem(required("certificate")),
  );
}

function usage(): void {
  process.stdout.write("ASOIAF authenticated answer-desk transport\n\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  fingerprint  Compute the SHA-256 identity of one X.509 certificate\n");
  process.stdout.write("  register     Bind one certificate fingerprint to an external actor and role\n");
  process.stdout.write("  revoke       Revoke one registered certificate fingerprint\n");
  process.stdout.write("  serve        Run the mutual-TLS assignment and result server\n");
  process.stdout.write("  issue        Issue an assignment through the mutual-TLS server\n");
  process.stdout.write("  admit        Admit a result through the mutual-TLS server\n");
  process.stdout.write("  status       Read actor, revocation, request, and response custody\n");
  process.stdout.write("  verify       Reconstruct transport, exchange, worker, and desk custody\n");
  process.stdout.write("  paths        Print the transport storage path contract\n\n");
  process.stdout.write("Common options:\n");
  process.stdout.write("  --root <path>          Holder-controlled answer-desk estate root\n");
  process.stdout.write("  --certificate <path>   X.509 certificate PEM\n");
  process.stdout.write("  --out <path>           Optional emitted JSON path\n");
}

async function remote(operation: AsoiafAnswerTransportOperation): Promise<void> {
  const result = await requestAsoiafAnswerTransport({
    baseUrl: required("url"),
    operation,
    idempotencyKey: required("idempotency-key"),
    body: readJson<unknown>(required("input")),
    certificate: readPem(required("client-certificate")),
    privateKey: readPem(required("client-key")),
    certificateAuthority: readPem(required("ca-certificate")),
    timeoutMilliseconds: integer("timeout-ms", 15_000),
  });
  writeJson(
    {
      ok: result.envelope.ok && result.statusCode >= 200 && result.statusCode < 300,
      statusCode: result.statusCode,
      ...result.envelope,
    },
    value("out"),
  );
  if (!result.envelope.ok || result.statusCode >= 400) process.exitCode = 1;
}

try {
  switch (command) {
    case "fingerprint": {
      writeJson(
        {
          ok: true,
          certificateFingerprint: fingerprintAsoiafAnswerTransportCertificate(
            readPem(required("certificate")),
          ),
        },
        value("out"),
      );
      break;
    }
    case "register": {
      const root = path.resolve(required("root"));
      writeJson(
        registerAsoiafAnswerTransportActor({
          root,
          certificateFingerprint: certificateFingerprint(),
          actorId: required("actor-id"),
          actorRole: required("actor-role") as AsoiafAnswerExchangeActorRole,
          registeredAt: required("registered-at"),
          operatorId: value("operator-id"),
        }),
        value("out"),
      );
      break;
    }
    case "revoke": {
      const root = path.resolve(required("root"));
      writeJson(
        revokeAsoiafAnswerTransportActor({
          root,
          certificateFingerprint: certificateFingerprint(),
          revokedAt: required("revoked-at"),
          reason: required("reason"),
          operatorId: value("operator-id"),
        }),
        value("out"),
      );
      break;
    }
    case "serve": {
      const root = path.resolve(required("root"));
      const host = value("host", "127.0.0.1")!;
      const port = integer("port", 8443);
      const server = createAsoiafAnswerTransportServer({
        root,
        certificate: readPem(required("server-certificate")),
        privateKey: readPem(required("server-key")),
        clientCertificateAuthority: readPem(required("client-ca-certificate")),
        host,
        port,
        maxBodyBytes: integer("max-body-bytes", 8 * 1024 * 1024),
        operatorId: value("operator-id"),
      });
      const listening = await listenAsoiafAnswerTransportServer(server, host, port);
      print({
        ok: true,
        root,
        host: listening.host,
        port: listening.port,
        mutualTlsRequired: true,
      });
      await new Promise<void>((resolve, reject) => {
        const shutdown = () => {
          server.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        };
        process.once("SIGINT", shutdown);
        process.once("SIGTERM", shutdown);
        server.once("error", reject);
      });
      break;
    }
    case "issue": {
      await remote("issue-assignment");
      break;
    }
    case "admit": {
      await remote("admit-result");
      break;
    }
    case "status": {
      const root = path.resolve(required("root"));
      const status = readAsoiafAnswerTransportStatus(root);
      const revoked = new Set(
        status.revocations.map((entry) => entry.certificateFingerprint),
      );
      writeJson(
        {
          ok: true,
          root,
          ...status,
          counts: {
            registrations: status.registrations.length,
            activeRegistrations: status.registrations.filter(
              (entry) => !revoked.has(entry.certificateFingerprint),
            ).length,
            revocations: status.revocations.length,
            requests: status.requests.length,
            responses: status.responses.length,
            succeededResponses: status.responses.filter(
              (entry) => entry.outcome === "succeeded",
            ).length,
            refusedResponses: status.responses.filter(
              (entry) => entry.outcome === "refused",
            ).length,
          },
        },
        value("out"),
      );
      break;
    }
    case "verify": {
      const root = path.resolve(required("root"));
      const findings = verifyAsoiafAnswerTransportEstate(root);
      const errors = findings.filter((entry) => entry.severity === "error");
      writeJson(
        {
          ok: errors.length === 0,
          root,
          findings,
          counts: {
            errors: errors.length,
            warnings: findings.filter((entry) => entry.severity === "warning").length,
            notices: findings.filter((entry) => entry.severity === "notice").length,
          },
        },
        value("out"),
      );
      if (errors.length > 0) process.exitCode = 1;
      break;
    }
    case "paths": {
      writeJson(
        asoiafAnswerTransportPaths(path.resolve(required("root"))),
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
