#!/usr/bin/env node
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import {
  admitAsoiafAnswerTransportCertificate,
  advertiseAsoiafAnswerTransportEndpoint,
  asoiafAnswerTransportOperationsPaths,
  dispatchAsoiafAnswerTransport,
  probeAsoiafAnswerTransportEndpoint,
  readAsoiafAnswerTransportOperationsStatus,
  retainAsoiafAnswerTransportRendezvous,
  retireAsoiafAnswerTransportCertificate,
  verifyAsoiafAnswerTransportOperationsEstate,
  type AsoiafAnswerTransportCertificateUsage,
  type AsoiafAnswerTransportNetworkScope,
  type AsoiafAnswerTransportOperation,
  type AsoiafAnswerTransportRendezvous,
  type AsoiafAnswerTransportRetirementKind,
} from "./lib/asoiaf-answer-desk-transport-operations.js";
import type {
  AsoiafAnswerTransportBody,
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

function usage(): void {
  process.stdout.write("ASOIAF answer-desk transport operations\n\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  admit-certificate  Admit a CA-verified client or server certificate lifecycle\n");
  process.stdout.write("  retire-certificate Retire one admitted certificate and revoke client transport use\n");
  process.stdout.write("  advertise          Retain one bounded HTTPS endpoint lease\n");
  process.stdout.write("  probe              Perform and retain one pinned mutual-TLS availability observation\n");
  process.stdout.write("  resolve            Build and retain one deterministic client-specific rendezvous\n");
  process.stdout.write("  issue              Dispatch an assignment through a retained rendezvous\n");
  process.stdout.write("  admit              Dispatch a typed result through a retained rendezvous\n");
  process.stdout.write("  status             Read certificate, endpoint, availability, rendezvous, and dispatch custody\n");
  process.stdout.write("  verify             Reconstruct operations, transport, exchange, worker, and desk custody\n");
  process.stdout.write("  paths              Print the operations storage path contract\n\n");
  process.stdout.write("Common options:\n");
  process.stdout.write("  --root <path>                  Holder-controlled answer-desk estate root\n");
  process.stdout.write("  --certificate <path>           X.509 leaf certificate PEM\n");
  process.stdout.write("  --issuer-certificate <path>    X.509 issuer CA certificate PEM\n");
  process.stdout.write("  --out <path>                   Optional emitted JSON path\n");
}

function findRendezvous(root: string, rendezvousId: string): AsoiafAnswerTransportRendezvous {
  const found = readAsoiafAnswerTransportOperationsStatus(root).rendezvous.find(
    (entry) => entry.rendezvousId === rendezvousId,
  );
  if (!found) throw new Error(`rendezvous ${rendezvousId} does not exist`);
  return found;
}

async function dispatch(operation: AsoiafAnswerTransportOperation): Promise<void> {
  try {
    const root = path.resolve(required("root"));
    const result = await dispatchAsoiafAnswerTransport({
      root,
      rendezvous: findRendezvous(root, required("rendezvous-id")),
      operation,
      body: readJson<AsoiafAnswerTransportBody>(required("input")),
      idempotencyKey: required("idempotency-key"),
      clientCertificate: readPem(required("client-certificate")),
      clientPrivateKey: readPem(required("client-key")),
      serverCertificateAuthority: readPem(required("server-ca-certificate")),
      dispatchedAt: required("dispatched-at"),
      timeoutMilliseconds: integer("timeout-ms", 15_000),
    });
    writeJson(
      {
        ok: result.receipt.envelope.ok && result.receipt.statusCode >= 200 && result.receipt.statusCode < 300,
        ...result,
      },
      value("out"),
    );
    if (!result.receipt.envelope.ok || result.receipt.statusCode >= 400) process.exitCode = 1;
  } finally {
    https.globalAgent.destroy();
  }
}

try {
  switch (command) {
    case "admit-certificate": {
      const usage = required("usage") as AsoiafAnswerTransportCertificateUsage;
      writeJson(
        admitAsoiafAnswerTransportCertificate({
          root: path.resolve(required("root")),
          usage,
          principalId: required("principal-id"),
          actorRole: value("actor-role") as AsoiafAnswerExchangeActorRole | undefined,
          certificate: readPem(required("certificate")),
          issuerCertificate: readPem(required("issuer-certificate")),
          admittedAt: required("admitted-at"),
          activateAt: required("activate-at"),
          renewAfter: required("renew-after"),
          retireAfter: required("retire-after"),
          predecessorCertificateFingerprint: value("predecessor-fingerprint"),
          rotationReason: required("reason"),
          operatorId: required("operator-id"),
        }),
        value("out"),
      );
      break;
    }
    case "retire-certificate": {
      writeJson(
        retireAsoiafAnswerTransportCertificate({
          root: path.resolve(required("root")),
          certificateFingerprint: required("fingerprint"),
          retiredAt: required("retired-at"),
          kind: required("kind") as AsoiafAnswerTransportRetirementKind,
          reason: required("reason"),
          operatorId: required("operator-id"),
        }),
        value("out"),
      );
      break;
    }
    case "advertise": {
      writeJson(
        advertiseAsoiafAnswerTransportEndpoint({
          root: path.resolve(required("root")),
          serverId: required("server-id"),
          baseUrl: required("url"),
          networkScope: required("network-scope") as AsoiafAnswerTransportNetworkScope,
          priority: integer("priority"),
          serverCertificateFingerprint: required("server-certificate-fingerprint"),
          acceptedClientCaCertificateFingerprint: required("accepted-client-ca-fingerprint"),
          advertisedAt: required("advertised-at"),
          availableFrom: required("available-from"),
          expiresAt: required("expires-at"),
          operatorId: required("operator-id"),
        }),
        value("out"),
      );
      break;
    }
    case "probe": {
      writeJson(
        await probeAsoiafAnswerTransportEndpoint({
          root: path.resolve(required("root")),
          endpointLeaseId: required("endpoint-id"),
          clientCertificate: readPem(required("client-certificate")),
          clientPrivateKey: readPem(required("client-key")),
          serverCertificateAuthority: readPem(required("server-ca-certificate")),
          observedAt: required("observed-at"),
          timeoutMilliseconds: integer("timeout-ms", 10_000),
        }),
        value("out"),
      );
      break;
    }
    case "resolve": {
      writeJson(
        retainAsoiafAnswerTransportRendezvous({
          root: path.resolve(required("root")),
          serverId: required("server-id"),
          clientCertificateFingerprint: required("client-certificate-fingerprint"),
          generatedAt: required("generated-at"),
          maxObservationAgeMilliseconds: integer("max-observation-age-ms", 300_000),
          operatorId: required("operator-id"),
        }),
        value("out"),
      );
      break;
    }
    case "issue": {
      await dispatch("issue-assignment");
      break;
    }
    case "admit": {
      await dispatch("admit-result");
      break;
    }
    case "status": {
      const root = path.resolve(required("root"));
      const status = readAsoiafAnswerTransportOperationsStatus(root);
      writeJson(
        {
          ok: true,
          root,
          ...status,
          counts: {
            certificates: status.certificates.length,
            clientCertificates: status.certificates.filter((entry) => entry.usage === "client-auth").length,
            serverCertificates: status.certificates.filter((entry) => entry.usage === "server-auth").length,
            retirements: status.retirements.length,
            endpoints: status.endpoints.length,
            availabilityObservations: status.availability.length,
            availableObservations: status.availability.filter((entry) => entry.outcome === "available").length,
            rendezvous: status.rendezvous.length,
            selectedRendezvous: status.rendezvous.filter((entry) => entry.selectedEndpointLeaseId !== null).length,
            dispatches: status.dispatches.length,
          },
        },
        value("out"),
      );
      break;
    }
    case "verify": {
      const root = path.resolve(required("root"));
      const findings = verifyAsoiafAnswerTransportOperationsEstate(root);
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
        asoiafAnswerTransportOperationsPaths(path.resolve(required("root"))),
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
