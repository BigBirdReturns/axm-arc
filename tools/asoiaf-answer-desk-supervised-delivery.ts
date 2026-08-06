#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  asoiafAnswerSupervisedDeliveryPaths,
  createAsoiafAnswerSupervisedDeliveryServer,
  listenAsoiafAnswerSupervisedDeliveryServer,
  readAsoiafAnswerSupervisedDeliveryStatus,
  requestAsoiafAnswerSupervisedDelivery,
  verifyAsoiafAnswerSupervisedDeliveryEstate,
  type AsoiafAnswerSupervisedDeliveryOperation,
} from "./lib/asoiaf-answer-desk-supervised-delivery.js";

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

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
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
  process.stdout.write("ASOIAF supervised answer-desk delivery\n\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  serve   Run the mutual-TLS supervisor-intent delivery gate\n");
  process.stdout.write("  pull    Pull the assignment selected by one prepared supervisor intent\n");
  process.stdout.write("  return  Return one typed result for a retained assignment delivery\n");
  process.stdout.write("  status  Read request, response, delivery, and return custody\n");
  process.stdout.write("  verify  Reconstruct delivery and every qualified lower authority plane\n");
  process.stdout.write("  paths   Print the supervised-delivery storage contract\n\n");
  process.stdout.write("Credential material is loaded ephemerally and never retained.\n\n");
  process.stdout.write("Common options:\n");
  process.stdout.write("  --root <path>                 Holder-controlled answer-desk estate root\n");
  process.stdout.write("  --input <json>                Pull or return request body\n");
  process.stdout.write("  --url <https-url>             Selected supervised-delivery endpoint\n");
  process.stdout.write("  --client-certificate <path>   Client certificate PEM\n");
  process.stdout.write("  --client-key <path>           Client private key PEM\n");
  process.stdout.write("  --ca-certificate <path>       Server certificate authority PEM\n");
  process.stdout.write("  --out <path>                  Optional emitted JSON path\n");
}

async function remote(operation: AsoiafAnswerSupervisedDeliveryOperation): Promise<void> {
  const result = await requestAsoiafAnswerSupervisedDelivery({
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
    case "serve": {
      const root = path.resolve(required("root"));
      const host = value("host", "127.0.0.1")!;
      const port = integer("port", 8443);
      const server = createAsoiafAnswerSupervisedDeliveryServer({
        root,
        certificate: readPem(required("server-certificate")),
        privateKey: readPem(required("server-key")),
        clientCertificateAuthority: readPem(required("client-ca-certificate")),
        maxBodyBytes: integer("max-body-bytes", 8 * 1024 * 1024),
        operatorId: value("operator-id"),
      });
      const listening = await listenAsoiafAnswerSupervisedDeliveryServer(
        server,
        host,
        port,
      );
      print({
        ok: true,
        root,
        host: listening.host,
        port: listening.port,
        mutualTlsRequired: true,
        credentialMaterialRetained: false,
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
    case "pull": {
      await remote("pull-assignment");
      break;
    }
    case "return": {
      await remote("return-result");
      break;
    }
    case "status": {
      const root = path.resolve(required("root"));
      const status = readAsoiafAnswerSupervisedDeliveryStatus(root);
      writeJson(
        {
          ok: true,
          root,
          ...status,
          counts: {
            requests: status.requests.length,
            responses: status.responses.length,
            succeededResponses: status.responses.filter(
              (entry) => entry.outcome === "succeeded",
            ).length,
            refusedResponses: status.responses.filter(
              (entry) => entry.outcome === "refused",
            ).length,
            deliveries: status.deliveries.length,
            returns: status.returns.length,
          },
        },
        value("out"),
      );
      break;
    }
    case "verify": {
      const root = path.resolve(required("root"));
      const findings = verifyAsoiafAnswerSupervisedDeliveryEstate(root);
      const errors = findings.filter((entry) => entry.severity === "error");
      const warnings = findings.filter((entry) => entry.severity === "warning");
      writeJson(
        {
          ok: errors.length === 0,
          root,
          findings,
          counts: {
            errors: errors.length,
            warnings: warnings.length,
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
        asoiafAnswerSupervisedDeliveryPaths(path.resolve(required("root"))),
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
