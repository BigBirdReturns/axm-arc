import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import {
  admitAsoiafAnswerCredentialPossessionProof,
  admitAsoiafAnswerCredentialTransportResult,
  buildAsoiafAnswerCredentialTransportResultStatement,
  readAsoiafAnswerCredentialBrokerStatus,
  retainAsoiafAnswerCredentialBrokerInvocation,
  retainAsoiafAnswerCredentialBrokerPolicy,
  serializeAsoiafAnswerCredentialBrokerInvocation,
  serializeAsoiafAnswerCredentialTransportResultStatement,
  verifyAsoiafAnswerCredentialBrokerEstate,
} from "../../../tools/lib/asoiaf-answer-credential-broker.js";
import {
  sha256,
} from "../../../tools/lib/asoiaf-external-estate.js";

let templateRoot = "";
let templateOutput = "";
const roots: string[] = [];

function read<T>(target: string): T {
  return JSON.parse(fs.readFileSync(target, "utf8")) as T;
}

function cloneEstate(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-broker-clone-"));
  roots.push(root);
  fs.cpSync(templateRoot, root, { recursive: true });
  return root;
}

beforeAll(() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-broker-template-"));
  roots.push(base);
  templateRoot = path.join(base, "estate");
  templateOutput = path.join(base, "output");
  fs.mkdirSync(templateOutput, { recursive: true });
  execFileSync("npx", [
    "vite-node",
    "tests/fixtures/emit-asoiaf-answer-credential-broker-input.ts",
    templateOutput,
    templateRoot,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    stdio: "pipe",
  });
}, 120_000);

afterAll(() => {
  for (const root of roots.reverse()) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("ASOIAF device-local credential broker", () => {
  it("retains one exact active-deployment binding, possession proof, transport result, and replay chain", () => {
    const status = readAsoiafAnswerCredentialBrokerStatus(templateRoot);
    const verification = read<{ ok: boolean; findings: unknown[] }>(
      path.join(templateOutput, "broker-verification.json"),
    );
    const expected = read<{
      counts: Record<string, number>;
      policyId: string;
      bindingId: string;
      proofId: string;
      transportResultId: string;
      stateId: string;
    }>(path.join(templateOutput, "expected.json"));
    const possessionFirst = read<{ replayed: boolean }>(
      path.join(templateOutput, "possession-invocation-first.json"),
    );
    const possessionReplay = read<{ replayed: boolean }>(
      path.join(templateOutput, "possession-invocation-replay.json"),
    );
    const proofFirst = read<{ replayed: boolean }>(
      path.join(templateOutput, "possession-proof-first.json"),
    );
    const proofReplay = read<{ replayed: boolean }>(
      path.join(templateOutput, "possession-proof-replay.json"),
    );
    const transportFirst = read<{ replayed: boolean }>(
      path.join(templateOutput, "transport-result-first.json"),
    );
    const transportReplay = read<{ replayed: boolean }>(
      path.join(templateOutput, "transport-result-replay.json"),
    );

    expect(verification).toEqual({
      ok: true,
      root: templateRoot,
      findings: [],
      status: expect.any(Object),
    });
    expect(status.policies).toHaveLength(1);
    expect(status.bindings).toHaveLength(1);
    expect(status.invocations).toHaveLength(2);
    expect(status.proofs).toHaveLength(1);
    expect(status.transportResults).toHaveLength(1);
    expect(status.state?.entries).toHaveLength(1);
    expect(status.policies[0]?.policyId).toBe(expected.policyId);
    expect(status.bindings[0]?.bindingId).toBe(expected.bindingId);
    expect(status.proofs[0]?.proofId).toBe(expected.proofId);
    expect(status.transportResults[0]?.resultId).toBe(expected.transportResultId);
    expect(status.state?.stateId).toBe(expected.stateId);
    expect(possessionFirst.replayed).toBe(false);
    expect(possessionReplay.replayed).toBe(true);
    expect(proofFirst.replayed).toBe(false);
    expect(proofReplay.replayed).toBe(true);
    expect(transportFirst.replayed).toBe(false);
    expect(transportReplay.replayed).toBe(true);
    expect(verifyAsoiafAnswerCredentialBrokerEstate(templateRoot)).toEqual([]);
  });

  it("refuses non-local endpoints and provider classes outside the active deployment", () => {
    const root = cloneEstate();
    const status = readAsoiafAnswerCredentialBrokerStatus(root);
    const policy = status.policies[0]!;
    expect(() => retainAsoiafAnswerCredentialBrokerPolicy({
      root,
      brokerId: "broker:invalid:endpoint",
      deviceId: policy.deviceId,
      serviceId: policy.serviceId,
      localEndpoint: "https://remote.example.test/broker",
      allowedProviderClasses: policy.allowedProviderClasses,
      allowedOperations: policy.allowedOperations,
      maxInvocationLifetimeMilliseconds: policy.maxInvocationLifetimeMilliseconds,
      maxPossessionProofAgeMilliseconds: policy.maxPossessionProofAgeMilliseconds,
      maxResponseBytes: policy.maxResponseBytes,
      createdAt: policy.createdAt,
      operatorId: "operator:test:invalid-endpoint",
    })).toThrow(/npipe|unix|loopback-https/);

    expect(() => retainAsoiafAnswerCredentialBrokerPolicy({
      root,
      brokerId: "broker:invalid:provider",
      deviceId: policy.deviceId,
      serviceId: policy.serviceId,
      localEndpoint: "unix:///run/axm/invalid.sock",
      allowedProviderClasses: ["windows-cng"],
      allowedOperations: policy.allowedOperations,
      maxInvocationLifetimeMilliseconds: policy.maxInvocationLifetimeMilliseconds,
      maxPossessionProofAgeMilliseconds: policy.maxPossessionProofAgeMilliseconds,
      maxResponseBytes: policy.maxResponseBytes,
      createdAt: policy.createdAt,
      operatorId: "operator:test:invalid-provider",
    })).toThrow(/active provider class/);
  });

  it("refuses an idempotency key reused with changed invocation custody", () => {
    const root = cloneEstate();
    const status = readAsoiafAnswerCredentialBrokerStatus(root);
    const invocation = status.invocations.find(
      (entry) => entry.operation === "prove-possession",
    )!;
    expect(() => retainAsoiafAnswerCredentialBrokerInvocation({
      root,
      policyId: invocation.policyId,
      bindingId: invocation.bindingId,
      operation: "prove-possession",
      idempotencyKey: "qualification-broker-possession-v1",
      request: {
        kind: "possession",
        challengeDigest: sha256("changed-challenge"),
        contextDigest: sha256("changed-context"),
      },
      createdAt: invocation.createdAt,
      expiresAt: invocation.expiresAt,
      operatorId: invocation.operatorId,
    })).toThrow(/idempotency key was reused/);
  });

  it("refuses a possession proof not signed by the deployed credential key", () => {
    const root = cloneEstate();
    const status = readAsoiafAnswerCredentialBrokerStatus(root);
    const policy = status.policies[0]!;
    const binding = status.bindings[0]!;
    const prior = status.invocations.find(
      (entry) => entry.operation === "prove-possession",
    )!;
    const invocation = retainAsoiafAnswerCredentialBrokerInvocation({
      root,
      policyId: policy.policyId,
      bindingId: binding.bindingId,
      operation: "prove-possession",
      idempotencyKey: "test-invalid-possession-signature",
      request: {
        kind: "possession",
        challengeDigest: sha256("test-invalid-proof-challenge"),
        contextDigest: sha256("test-invalid-proof-context"),
      },
      createdAt: prior.createdAt,
      expiresAt: prior.expiresAt,
      operatorId: "operator:test:invalid-proof",
    }).invocation;
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const signature = crypto.sign(
      "sha256",
      serializeAsoiafAnswerCredentialBrokerInvocation(invocation),
      privateKey,
    );
    expect(() => admitAsoiafAnswerCredentialPossessionProof({
      root,
      invocationId: invocation.invocationId,
      signatureAlgorithm: "rsa-sha256",
      signature,
      provedAt: prior.createdAt,
      operatorId: "operator:test:invalid-proof",
    })).toThrow(/signature is invalid/);
  });

  it("requires a fresh possession proof before a mutual-TLS invocation", () => {
    const root = cloneEstate();
    const status = readAsoiafAnswerCredentialBrokerStatus(root);
    const policy = status.policies[0]!;
    const binding = status.bindings[0]!;
    const proof = status.proofs[0]!;
    const createdAt = new Date(
      Date.parse(proof.provedAt) + policy.maxPossessionProofAgeMilliseconds + 1,
    ).toISOString();
    expect(() => retainAsoiafAnswerCredentialBrokerInvocation({
      root,
      policyId: policy.policyId,
      bindingId: binding.bindingId,
      operation: "mutual-tls-request",
      idempotencyKey: "test-stale-possession-proof",
      request: {
        kind: "mutual-tls",
        possessionProofId: proof.proofId,
        possessionProofFingerprint: proof.proofFingerprint,
        method: "POST",
        targetUrl: "https://answer-desk.example.test/v1/results/admit",
        requestBodyDigest: sha256("stale-proof-request"),
        requestBodyBytes: 64,
        lowerIdempotencyKeyDigest: sha256("stale-proof-idempotency"),
        expectedServerCertificateFingerprint: sha256("stale-proof-server"),
        expectedServerIssuerFingerprint: sha256("stale-proof-issuer"),
        maxResponseBytes: 1024,
      },
      createdAt,
      expiresAt: new Date(Date.parse(createdAt) + 60_000).toISOString(),
      operatorId: "operator:test:stale-proof",
    })).toThrow(/possession proof is stale/);
  });

  it("refuses wrong server pins and a transport result signed by another device agent", () => {
    const root = cloneEstate();
    const status = readAsoiafAnswerCredentialBrokerStatus(root);
    const invocation = status.invocations.find(
      (entry) => entry.operation === "mutual-tls-request",
    )!;
    const request = invocation.request;
    if (request.kind !== "mutual-tls") throw new Error("fixture transport request is absent");
    expect(() => buildAsoiafAnswerCredentialTransportResultStatement({
      root,
      invocationId: invocation.invocationId,
      lowerRequestId: "lower-request:test-wrong-pin",
      lowerRequestFingerprint: sha256("lower-request:test-wrong-pin"),
      lowerResponseId: "lower-response:test-wrong-pin",
      lowerResponseFingerprint: sha256("lower-response:test-wrong-pin"),
      observedServerCertificateFingerprint: sha256("wrong-server-certificate"),
      observedServerIssuerFingerprint: request.expectedServerIssuerFingerprint,
      httpStatus: 200,
      responseBytes: 32,
      responseDigest: sha256("wrong-pin-response"),
      providerReceiptDigest: sha256("wrong-pin-provider-receipt"),
      startedAt: invocation.createdAt,
      completedAt: invocation.createdAt,
    })).toThrow(/server identity differs/);

    const existing = status.transportResults[0]!.statement;
    const statement = buildAsoiafAnswerCredentialTransportResultStatement({
      root,
      invocationId: invocation.invocationId,
      lowerRequestId: existing.lowerRequestId,
      lowerRequestFingerprint: existing.lowerRequestFingerprint,
      lowerResponseId: existing.lowerResponseId,
      lowerResponseFingerprint: existing.lowerResponseFingerprint,
      observedServerCertificateFingerprint:
        existing.observedServerCertificateFingerprint,
      observedServerIssuerFingerprint: existing.observedServerIssuerFingerprint,
      httpStatus: existing.httpStatus,
      responseBytes: existing.responseBytes,
      responseDigest: existing.responseDigest,
      providerReceiptDigest: existing.providerReceiptDigest,
      startedAt: existing.startedAt,
      completedAt: existing.completedAt,
    });
    const { privateKey } = crypto.generateKeyPairSync("ed25519");
    const signature = crypto.sign(
      null,
      serializeAsoiafAnswerCredentialTransportResultStatement(statement),
      privateKey,
    );
    expect(() => admitAsoiafAnswerCredentialTransportResult({
      root,
      invocationId: invocation.invocationId,
      lowerRequestId: statement.lowerRequestId,
      lowerRequestFingerprint: statement.lowerRequestFingerprint,
      lowerResponseId: statement.lowerResponseId,
      lowerResponseFingerprint: statement.lowerResponseFingerprint,
      observedServerCertificateFingerprint:
        statement.observedServerCertificateFingerprint,
      observedServerIssuerFingerprint: statement.observedServerIssuerFingerprint,
      httpStatus: statement.httpStatus,
      responseBytes: statement.responseBytes,
      responseDigest: statement.responseDigest,
      providerReceiptDigest: statement.providerReceiptDigest,
      startedAt: statement.startedAt,
      completedAt: statement.completedAt,
      deviceAgentSignatureAlgorithm: "ed25519",
      deviceAgentSignature: signature,
      operatorId: "operator:test:invalid-agent",
    })).toThrow(/device-agent signature is invalid/);
  });

  it("refuses new use after the deployment projection changes", () => {
    const root = cloneEstate();
    const status = readAsoiafAnswerCredentialBrokerStatus(root);
    const policy = status.policies[0]!;
    const binding = status.bindings[0]!;
    const statePath = path.join(
      root,
      "answer-credential-deployment",
      "STATE.json",
    );
    const deploymentState = read<Record<string, unknown>>(statePath);
    fs.writeFileSync(
      statePath,
      `${JSON.stringify({
        ...deploymentState,
        stateFingerprint: sha256("tampered-deployment-state"),
      }, null, 2)}\n`,
      "utf8",
    );
    expect(() => retainAsoiafAnswerCredentialBrokerInvocation({
      root,
      policyId: policy.policyId,
      bindingId: binding.bindingId,
      operation: "prove-possession",
      idempotencyKey: "test-stale-deployment-binding",
      request: {
        kind: "possession",
        challengeDigest: sha256("stale-binding-challenge"),
        contextDigest: sha256("stale-binding-context"),
      },
      createdAt: policy.createdAt,
      expiresAt: new Date(Date.parse(policy.createdAt) + 60_000).toISOString(),
      operatorId: "operator:test:stale-binding",
    })).toThrow(/valid deployment estate|active deployment projection/);
  });

  it("detects changed proof bytes, state drift, secret paths, and authority leakage", () => {
    const root = cloneEstate();
    const status = readAsoiafAnswerCredentialBrokerStatus(root);
    const proof = status.proofs[0]!;
    const proofPath = path.join(
      root,
      "answer-credential-broker",
      "proofs",
      `${proof.proofFingerprint.slice("sha256:".length)}.json`,
    );
    fs.writeFileSync(
      proofPath,
      `${JSON.stringify({
        ...proof,
        operatorId: "operator:tampered",
      }, null, 2)}\n`,
      "utf8",
    );
    const statePath = path.join(
      root,
      "answer-credential-broker",
      "BROKER-STATE.json",
    );
    const brokerState = read<Record<string, unknown>>(statePath);
    fs.writeFileSync(
      statePath,
      `${JSON.stringify({
        ...brokerState,
        stateFingerprint: sha256("tampered-broker-state"),
      }, null, 2)}\n`,
      "utf8",
    );
    const secretPath = path.join(
      root,
      "answer-credential-broker",
      "private-key.pem",
    );
    fs.writeFileSync(
      secretPath,
      "-----BEGIN PRIVATE KEY-----\nforbidden\n-----END PRIVATE KEY-----\n",
      "utf8",
    );
    const findings = verifyAsoiafAnswerCredentialBrokerEstate(root);
    expect(findings.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "broker-proof-invalid",
        "broker-state-projection",
        "broker-secret-path",
        "broker-secret-content",
      ]),
    );

    const clean = readAsoiafAnswerCredentialBrokerStatus(templateRoot);
    for (const object of [
      ...clean.policies,
      ...clean.bindings,
      ...clean.invocations,
      ...clean.proofs,
      ...clean.transportResults,
      ...(clean.state ? [clean.state] : []),
    ]) {
      expect(object).toEqual(expect.objectContaining({
        authority: "none",
        graphEffect: "none",
        canonEffect: "none",
        answerEffect: "none",
      }));
    }
  });
});
