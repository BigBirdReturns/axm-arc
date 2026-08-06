#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  admitAsoiafAnswerCredentialActivation,
  admitAsoiafAnswerCredentialInstallation,
  asoiafAnswerCredentialDeploymentPaths,
  buildAsoiafAnswerCredentialActivationStatement,
  buildAsoiafAnswerCredentialInstallationStatement,
  buildAsoiafAnswerCredentialRollbackStatement,
  planAsoiafAnswerCredentialDeployment,
  readAsoiafAnswerCredentialDeploymentStatus,
  rebuildAsoiafAnswerCredentialDeploymentState,
  retainAsoiafAnswerCredentialDevice,
  retainAsoiafAnswerCredentialKeyReference,
  retainAsoiafAnswerCredentialRollback,
  serializeAsoiafAnswerCredentialActivationStatement,
  serializeAsoiafAnswerCredentialInstallationStatement,
  serializeAsoiafAnswerCredentialRollbackStatement,
  verifyAsoiafAnswerCredentialDeploymentEstate,
  type AsoiafAnswerCredentialDeploymentMode,
  type AsoiafAnswerCredentialDeviceInput,
  type AsoiafAnswerCredentialKeyReferenceInput,
  type AsoiafAnswerCredentialPlatform,
  type AsoiafAnswerCredentialProviderClass,
} from "./lib/asoiaf-answer-credential-deployment.js";
import type {
  AsoiafAnswerTransportAdmissionLink,
  AsoiafAnswerTransportIssuanceReceipt,
  AsoiafAnswerTransportKeyCustodyClass,
  AsoiafAnswerTransportProofAlgorithm,
} from "./lib/asoiaf-answer-desk-transport-enrollment.js";

const args = process.argv.slice(2);
const command = args[0] ?? "help";

interface RegisterDeviceFileInput {
  root: string;
  deviceAgentId: string;
  deviceAgentPublicKeyPath: string;
  platform: AsoiafAnswerCredentialPlatform;
  trustDomain: string;
  allowedProviderClasses: AsoiafAnswerCredentialProviderClass[];
  registeredAt: string;
  operatorId: string;
}

interface RegisterKeyFileInput {
  root: string;
  deviceId: string;
  providerClass: AsoiafAnswerCredentialProviderClass;
  providerKeyId: string;
  providerHandleDigest: string;
  publicKeyPath: string;
  custodyClass: AsoiafAnswerTransportKeyCustodyClass;
  privateKeyExportable: boolean;
  registeredAt: string;
  operatorId: string;
}

interface PlanFileInput {
  root: string;
  mode: AsoiafAnswerCredentialDeploymentMode;
  serviceId: string;
  deviceId: string;
  keyReferenceId: string;
  issuance: AsoiafAnswerTransportIssuanceReceipt;
  admissionLink?: AsoiafAnswerTransportAdmissionLink | null;
  predecessorPlanId?: string | null;
  predecessorActivationId?: string | null;
  plannedInstallAt: string;
  plannedActivateAt: string;
  rollbackUntil: string;
  retirePredecessorAfter: string;
  createdAt: string;
  operatorId: string;
}

interface InstallationStatementFileInput {
  root: string;
  planId: string;
  installedAt: string;
  providerReceiptDigest: string;
}

interface InstallationFileInput extends InstallationStatementFileInput {
  certificatePath: string;
  issuerCertificatePath: string;
  deviceAgentSignatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  deviceAgentSignaturePath?: string;
  deviceAgentSignatureBase64?: string;
  operatorId: string;
}

interface ActivationStatementFileInput {
  root: string;
  planId: string;
  installationId: string;
  challengeDigest: string;
  activatedAt: string;
}

interface ActivationFileInput extends ActivationStatementFileInput {
  credentialSignatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  credentialSignaturePath?: string;
  credentialSignatureBase64?: string;
  deviceAgentSignatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  deviceAgentSignaturePath?: string;
  deviceAgentSignatureBase64?: string;
  operatorId: string;
}

interface RollbackStatementFileInput {
  root: string;
  planId: string;
  activationId: string;
  predecessorActivationId: string;
  providerReceiptDigest: string;
  rolledBackAt: string;
  reason: string;
}

interface RollbackFileInput extends RollbackStatementFileInput {
  deviceAgentSignatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  deviceAgentSignaturePath?: string;
  deviceAgentSignatureBase64?: string;
  operatorId: string;
}

function value(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
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

function signature(input: {
  path?: string;
  base64?: string;
  label: string;
}): Buffer {
  if (input.path && input.base64) {
    throw new Error(`${input.label} must use a path or base64, not both`);
  }
  if (input.path) return readBytes(input.path);
  if (input.base64 && /^[A-Za-z0-9+/]+={0,2}$/.test(input.base64)) {
    return Buffer.from(input.base64, "base64");
  }
  throw new Error(`${input.label} path or canonical base64 is required`);
}

function writeJson(output: unknown, target?: string): void {
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

function signingEnvelope(statement: unknown, bytes: Buffer): unknown {
  return {
    statement,
    signingBytesBase64: bytes.toString("base64"),
    signingBytesSha256:
      `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`,
    privateKeyRetained: false,
    rawProviderHandleRetained: false,
    authority: "none",
    graphEffect: "none",
    canonEffect: "none",
    answerEffect: "none",
  };
}

function usage(): void {
  process.stdout.write("ASOIAF device-bound answer transport credential deployment\n\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  register-device       Retain one device and device-agent verification key\n");
  process.stdout.write("  register-key          Retain one opaque non-exportable provider key reference\n");
  process.stdout.write("  plan                  Bind enrollment custody to one deployment schedule\n");
  process.stdout.write("  prepare-installation  Emit canonical device-agent installation signing bytes\n");
  process.stdout.write("  admit-installation    Verify certificate, provider receipt, and agent signature\n");
  process.stdout.write("  prepare-activation    Emit canonical credential and agent activation signing bytes\n");
  process.stdout.write("  admit-activation      Verify independent credential-key and device-agent proofs\n");
  process.stdout.write("  prepare-rollback      Emit canonical bounded rollback signing bytes\n");
  process.stdout.write("  rollback              Verify and retain one predecessor-specific rollback\n");
  process.stdout.write("  status                Read deployment records and deterministic service state\n");
  process.stdout.write("  verify                Reconstruct device, key, plan, proof, rollback, and state custody\n");
  process.stdout.write("  paths                 Print the deployment storage contract\n\n");
  process.stdout.write("Options:\n");
  process.stdout.write("  --input <json>  Command input\n");
  process.stdout.write("  --root <path>   Holder-controlled answer-desk estate root\n");
  process.stdout.write("  --out <path>    Optional JSON output path\n");
}

try {
  switch (command) {
    case "register-device": {
      const input = readJson<RegisterDeviceFileInput>(required("input"));
      const libraryInput: AsoiafAnswerCredentialDeviceInput = {
        ...input,
        root: path.resolve(input.root),
        deviceAgentPublicKey: readBytes(input.deviceAgentPublicKeyPath),
      };
      writeJson(retainAsoiafAnswerCredentialDevice(libraryInput), value("out"));
      break;
    }
    case "register-key": {
      const input = readJson<RegisterKeyFileInput>(required("input"));
      const libraryInput: AsoiafAnswerCredentialKeyReferenceInput = {
        ...input,
        root: path.resolve(input.root),
        publicKey: readBytes(input.publicKeyPath),
      };
      writeJson(retainAsoiafAnswerCredentialKeyReference(libraryInput), value("out"));
      break;
    }
    case "plan": {
      const input = readJson<PlanFileInput>(required("input"));
      writeJson(planAsoiafAnswerCredentialDeployment({
        ...input,
        root: path.resolve(input.root),
      }), value("out"));
      break;
    }
    case "prepare-installation": {
      const input = readJson<InstallationStatementFileInput>(required("input"));
      const statement = buildAsoiafAnswerCredentialInstallationStatement({
        ...input,
        root: path.resolve(input.root),
      });
      writeJson(
        signingEnvelope(
          statement,
          serializeAsoiafAnswerCredentialInstallationStatement(statement),
        ),
        value("out"),
      );
      break;
    }
    case "admit-installation": {
      const input = readJson<InstallationFileInput>(required("input"));
      writeJson(admitAsoiafAnswerCredentialInstallation({
        root: path.resolve(input.root),
        planId: input.planId,
        certificate: readBytes(input.certificatePath),
        issuerCertificate: readBytes(input.issuerCertificatePath),
        installedAt: input.installedAt,
        providerReceiptDigest: input.providerReceiptDigest,
        deviceAgentSignatureAlgorithm: input.deviceAgentSignatureAlgorithm,
        deviceAgentSignature: signature({
          path: input.deviceAgentSignaturePath,
          base64: input.deviceAgentSignatureBase64,
          label: "device-agent installation signature",
        }),
        operatorId: input.operatorId,
      }), value("out"));
      break;
    }
    case "prepare-activation": {
      const input = readJson<ActivationStatementFileInput>(required("input"));
      const statement = buildAsoiafAnswerCredentialActivationStatement({
        ...input,
        root: path.resolve(input.root),
      });
      writeJson(
        signingEnvelope(
          statement,
          serializeAsoiafAnswerCredentialActivationStatement(statement),
        ),
        value("out"),
      );
      break;
    }
    case "admit-activation": {
      const input = readJson<ActivationFileInput>(required("input"));
      writeJson(admitAsoiafAnswerCredentialActivation({
        root: path.resolve(input.root),
        planId: input.planId,
        installationId: input.installationId,
        challengeDigest: input.challengeDigest,
        activatedAt: input.activatedAt,
        credentialSignatureAlgorithm: input.credentialSignatureAlgorithm,
        credentialSignature: signature({
          path: input.credentialSignaturePath,
          base64: input.credentialSignatureBase64,
          label: "credential activation signature",
        }),
        deviceAgentSignatureAlgorithm: input.deviceAgentSignatureAlgorithm,
        deviceAgentSignature: signature({
          path: input.deviceAgentSignaturePath,
          base64: input.deviceAgentSignatureBase64,
          label: "device-agent activation signature",
        }),
        operatorId: input.operatorId,
      }), value("out"));
      break;
    }
    case "prepare-rollback": {
      const input = readJson<RollbackStatementFileInput>(required("input"));
      const statement = buildAsoiafAnswerCredentialRollbackStatement({
        ...input,
        root: path.resolve(input.root),
      });
      writeJson(
        signingEnvelope(
          statement,
          serializeAsoiafAnswerCredentialRollbackStatement(statement),
        ),
        value("out"),
      );
      break;
    }
    case "rollback": {
      const input = readJson<RollbackFileInput>(required("input"));
      writeJson(retainAsoiafAnswerCredentialRollback({
        root: path.resolve(input.root),
        planId: input.planId,
        activationId: input.activationId,
        predecessorActivationId: input.predecessorActivationId,
        providerReceiptDigest: input.providerReceiptDigest,
        rolledBackAt: input.rolledBackAt,
        reason: input.reason,
        deviceAgentSignatureAlgorithm: input.deviceAgentSignatureAlgorithm,
        deviceAgentSignature: signature({
          path: input.deviceAgentSignaturePath,
          base64: input.deviceAgentSignatureBase64,
          label: "device-agent rollback signature",
        }),
        operatorId: input.operatorId,
      }), value("out"));
      break;
    }
    case "status": {
      const root = path.resolve(required("root"));
      const status = readAsoiafAnswerCredentialDeploymentStatus(root);
      writeJson({
        ok: true,
        root,
        ...status,
        rebuiltState: rebuildAsoiafAnswerCredentialDeploymentState(root),
        counts: {
          devices: status.devices.length,
          keys: status.keys.length,
          plans: status.plans.length,
          installations: status.installations.length,
          activations: status.activations.length,
          rollbacks: status.rollbacks.length,
          activeServices: status.state?.entries.length ?? 0,
        },
      }, value("out"));
      break;
    }
    case "verify": {
      const root = path.resolve(required("root"));
      const findings = verifyAsoiafAnswerCredentialDeploymentEstate(root);
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
    case "paths": {
      writeJson(
        asoiafAnswerCredentialDeploymentPaths(path.resolve(required("root"))),
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
