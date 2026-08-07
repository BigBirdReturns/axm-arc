import fs from "node:fs";
import { execFileSync } from "node:child_process";
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
  advertiseAsoiafAnswerTransportEndpoint,
  readAsoiafAnswerTransportOperationsStatus,
} from "../../../tools/lib/asoiaf-answer-desk-transport-operations.js";
import {
  asoiafAnswerCredentialBrokerLoopbackTlsPaths,
  readAsoiafAnswerCredentialBrokerLoopbackTlsStatus,
  retainAsoiafAnswerCredentialBrokerLoopbackTlsPolicy,
  retainAsoiafAnswerCredentialBrokerLoopbackTlsSession,
  startAsoiafAnswerCredentialBrokerLoopbackTls,
  verifyAsoiafAnswerCredentialBrokerLoopbackTlsEstate,
} from "../../../tools/lib/asoiaf-answer-credential-broker-loopback-tls.js";

let templateRoot = "";
let templateOutput = "";
let templateMaterial = "";
const roots: string[] = [];

function read<T>(target: string): T {
  return JSON.parse(fs.readFileSync(target, "utf8")) as T;
}

function cloneEstate(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-loopback-tls-clone-"));
  roots.push(root);
  fs.cpSync(templateRoot, root, { recursive: true });
  return root;
}

function material(name: string): Buffer {
  return fs.readFileSync(path.join(templateMaterial, "tls", name));
}

beforeAll(() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-loopback-tls-template-"));
  roots.push(base);
  templateRoot = path.join(base, "estate");
  templateOutput = path.join(base, "output");
  templateMaterial = path.join(base, "material");
  fs.mkdirSync(templateOutput, { recursive: true });
  fs.mkdirSync(templateMaterial, { recursive: true });
  execFileSync("npx", [
    "vite-node",
    "tests/fixtures/emit-asoiaf-answer-credential-broker-loopback-tls-input.ts",
    templateOutput,
    templateRoot,
    templateMaterial,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    stdio: "pipe",
    timeout: 300_000,
  });
}, 320_000);

afterAll(() => {
  for (const root of roots.reverse()) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("ASOIAF governed loopback mutual-TLS credential broker listener", () => {
  it("retains one exact policy, three sessions, terminal lifecycle custody, and clean verification", () => {
    const status = readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(templateRoot);
    const expected = read<{
      listenerCounts: {
        policies: number;
        sessions: number;
        ready: number;
        stopped: number;
        recovered: number;
        activeSessions: number;
        preparedSessions: number;
      };
    }>(path.join(templateOutput, "expected.json"));
    const verification = read<{
      ok: boolean;
      findings: unknown[];
      counts: { errors: number; warnings: number; notices: number };
    }>(path.join(templateOutput, "listener-verification.json"));

    expect(expected.listenerCounts).toEqual({
      policies: 1,
      sessions: 3,
      ready: 3,
      stopped: 2,
      recovered: 1,
      activeSessions: 0,
      preparedSessions: 0,
    });
    expect(status.policies).toHaveLength(1);
    expect(status.sessions).toHaveLength(3);
    expect(status.lifecycle.filter((entry) => entry.kind === "ready")).toHaveLength(3);
    expect(status.lifecycle.filter((entry) => entry.kind === "stopped")).toHaveLength(2);
    expect(status.lifecycle.filter((entry) => entry.kind === "recovered")).toHaveLength(1);
    expect(verification).toMatchObject({
      ok: true,
      findings: [],
      counts: { errors: 0, warnings: 0, notices: 0 },
    });
    expect(verifyAsoiafAnswerCredentialBrokerLoopbackTlsEstate(templateRoot)).toEqual([]);
  });

  it("executes a signed provider preparation and possession proof through the exact mutual-TLS peer", () => {
    const expected = read<{
      prepareRequestId: string;
      prepareReceiptId: string;
      executeRequestId: string;
      executeReceiptId: string;
      providerInvocationId: string;
      providerResultId: string;
      proofId: string;
      serviceCounts: Record<string, number>;
      providerCounts: Record<string, number>;
      brokerCounts: Record<string, number>;
    }>(path.join(templateOutput, "expected.json"));
    const prepare = read<any>(
      path.join(templateOutput, "loopback-possession-prepare-response.json"),
    );
    const execute = read<any>(
      path.join(templateOutput, "loopback-possession-execute-first-response.json"),
    );
    const proof = read<any>(path.join(templateOutput, "possession-broker-admission.json"));

    expect(prepare.ok).toBe(true);
    expect(prepare.result.request.requestId).toBe(expected.prepareRequestId);
    expect(prepare.result.receipt.receiptId).toBe(expected.prepareReceiptId);
    expect(prepare.result.response.kind).toBe("provider-invocation");
    expect(prepare.result.response.invocation.providerInvocationId)
      .toBe(expected.providerInvocationId);
    expect(execute.ok).toBe(true);
    expect(execute.result.request.requestId).toBe(expected.executeRequestId);
    expect(execute.result.receipt.receiptId).toBe(expected.executeReceiptId);
    expect(execute.result.response.kind).toBe("provider-result");
    expect(execute.result.response.result.resultId).toBe(expected.providerResultId);
    expect(proof.proof.proofId).toBe(expected.proofId);
    expect(expected.serviceCounts).toEqual({
      policies: 1,
      requests: 2,
      receipts: 2,
      pendingRequests: 0,
    });
    expect(expected.providerCounts).toEqual({
      profiles: 1,
      invocations: 1,
      results: 1,
    });
    expect(expected.brokerCounts).toEqual({
      policies: 1,
      bindings: 1,
      invocations: 1,
      proofs: 1,
      transportResults: 0,
    });
  });

  it("returns the original service request, receipt, and provider result on exact replay", () => {
    const first = read<any>(
      path.join(templateOutput, "loopback-possession-execute-first-response.json"),
    );
    const replay = read<any>(
      path.join(templateOutput, "loopback-possession-execute-replay-response.json"),
    );
    const expected = read<{
      executeReplay: { requestReplayed: boolean; receiptReplayed: boolean };
    }>(path.join(templateOutput, "expected.json"));

    expect(first.ok).toBe(true);
    expect(replay.ok).toBe(true);
    expect(first.result.requestReplayed).toBe(false);
    expect(first.result.receiptReplayed).toBe(false);
    expect(replay.result.requestReplayed).toBe(true);
    expect(replay.result.receiptReplayed).toBe(true);
    expect(replay.result.request).toEqual(first.result.request);
    expect(replay.result.receipt).toEqual(first.result.receipt);
    expect(replay.result.response).toEqual(first.result.response);
    expect(expected.executeReplay).toEqual({
      requestReplayed: true,
      receiptReplayed: true,
    });
  });

  it("retains a pinned availability observation and rejects a different same-CA client", () => {
    const availability = read<any>(
      path.join(templateOutput, "listener-availability.json"),
    );
    const unauthorized = read<any>(
      path.join(templateOutput, "unauthorized-client-response.json"),
    );
    const expected = read<{
      endpointLeaseId: string;
      serverCertificateFingerprint: string;
      clientCertificateFingerprint: string;
      availabilityObservationId: string;
      unauthorizedClientRejected: boolean;
      transportOperationsCounts: Record<string, number>;
    }>(path.join(templateOutput, "expected.json"));

    expect(availability.observation.observationId)
      .toBe(expected.availabilityObservationId);
    expect(availability.observation.endpointLeaseId).toBe(expected.endpointLeaseId);
    expect(availability.observation.serverCertificateFingerprint)
      .toBe(expected.serverCertificateFingerprint);
    expect(availability.observation.clientCertificateFingerprint)
      .toBe(expected.clientCertificateFingerprint);
    expect(availability.observation.outcome).toBe("available");
    expect(unauthorized.ok).toBe(false);
    expect(unauthorized.error.message).toMatch(/peer certificate differs/);
    expect(expected.unauthorizedClientRejected).toBe(true);
    expect(expected.transportOperationsCounts).toEqual({
      certificates: 2,
      endpoints: 1,
      availability: 1,
    });
  });

  it("closes an interrupted ready session only after a later session binds the exact endpoint", () => {
    const status = readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(templateRoot);
    const expected = read<{
      sessionTwoId: string;
      sessionThreeId: string;
      recoveredSessionId: string;
      recoveredBySessionId: string;
      staleLockDigest: string;
    }>(path.join(templateOutput, "expected.json"));
    const recovered = status.lifecycle.find(
      (entry) => entry.sessionId === expected.sessionTwoId
        && entry.kind === "recovered",
    );
    const readyThree = status.lifecycle.find(
      (entry) => entry.sessionId === expected.sessionThreeId
        && entry.kind === "ready",
    );
    const stoppedThree = status.lifecycle.find(
      (entry) => entry.sessionId === expected.sessionThreeId
        && entry.kind === "stopped",
    );

    expect(expected.recoveredSessionId).toBe(expected.sessionTwoId);
    expect(expected.recoveredBySessionId).toBe(expected.sessionThreeId);
    expect(recovered).toMatchObject({
      recoveredBySessionId: expected.sessionThreeId,
      staleLockDigest: expected.staleLockDigest,
    });
    expect(readyThree).toBeDefined();
    expect(stoppedThree).toBeDefined();
    expect(Date.parse(recovered!.eventAt)).toBeGreaterThanOrEqual(
      Date.parse(readyThree!.eventAt),
    );
  });

  it("retains only public fingerprints, identities, counts, and no certificate or key material", () => {
    const paths = asoiafAnswerCredentialBrokerLoopbackTlsPaths(templateRoot);
    const status = readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(templateRoot);
    const serialized = JSON.stringify(status);

    expect(serialized).not.toMatch(/BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY/);
    expect(serialized).not.toContain("BEGIN CERTIFICATE");
    expect(serialized).not.toContain("credentialPrivateKeyPem");
    expect(serialized).not.toContain("clientPrivateKey");
    expect(serialized).not.toContain("serverPrivateKey");
    expect(fs.existsSync(paths.lock)).toBe(false);
    for (const file of fs.readdirSync(paths.listenerRoot, { recursive: true }) as string[]) {
      expect(file).not.toMatch(/\.(?:key|pem|crt|csr|p12|pfx)$/i);
    }
    for (const policy of status.policies) {
      expect(policy.privateKeyRetained).toBe(false);
      expect(policy.certificateRetained).toBe(false);
      expect(policy.rawRequestBodyRetained).toBe(false);
      expect(policy.rawResponseBodyRetained).toBe(false);
      expect(policy.authority).toBe("none");
      expect(policy.graphEffect).toBe("none");
      expect(policy.canonEffect).toBe("none");
      expect(policy.answerEffect).toBe("none");
    }
  });

  it("refuses endpoint leases whose declared network scope is not loopback", () => {
    const root = cloneEstate();
    const listeners = readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(root);
    const operations = readAsoiafAnswerTransportOperationsStatus(root);
    const policy = listeners.policies[0]!;
    const endpoint = operations.endpoints[0]!;
    const alternate = advertiseAsoiafAnswerTransportEndpoint({
      root,
      serverId: endpoint.serverId,
      baseUrl: endpoint.baseUrl,
      networkScope: "lan",
      priority: endpoint.priority + 1,
      serverCertificateFingerprint: endpoint.serverCertificateFingerprint,
      acceptedClientCaCertificateFingerprint:
        endpoint.acceptedClientCaCertificateFingerprint,
      advertisedAt: endpoint.advertisedAt,
      availableFrom: endpoint.availableFrom,
      expiresAt: endpoint.expiresAt,
      operatorId: "operator:test:loopback-tls-lan-endpoint",
    }).endpoint;

    expect(() => retainAsoiafAnswerCredentialBrokerLoopbackTlsPolicy({
      root,
      brokerServicePolicyId: policy.brokerServicePolicyId,
      endpointLeaseId: alternate.endpointLeaseId,
      clientCertificateFingerprint: policy.clientCertificateFingerprint,
      maxSessionLifetimeMilliseconds: policy.maxSessionLifetimeMilliseconds,
      createdAt: policy.createdAt,
      operatorId: "operator:test:loopback-tls-lan-policy",
    })).toThrow(/requires a loopback endpoint lease/);
  });

  it("refuses loopback endpoint hostnames that are not literal loopback addresses", () => {
    const root = cloneEstate();
    const listeners = readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(root);
    const operations = readAsoiafAnswerTransportOperationsStatus(root);
    const policy = listeners.policies[0]!;
    const endpoint = operations.endpoints[0]!;
    const port = new URL(endpoint.baseUrl).port;
    const alternate = advertiseAsoiafAnswerTransportEndpoint({
      root,
      serverId: endpoint.serverId,
      baseUrl: `https://localhost:${port}/`,
      networkScope: "loopback",
      priority: endpoint.priority + 1,
      serverCertificateFingerprint: endpoint.serverCertificateFingerprint,
      acceptedClientCaCertificateFingerprint:
        endpoint.acceptedClientCaCertificateFingerprint,
      advertisedAt: endpoint.advertisedAt,
      availableFrom: endpoint.availableFrom,
      expiresAt: endpoint.expiresAt,
      operatorId: "operator:test:loopback-tls-hostname-endpoint",
    }).endpoint;

    expect(() => retainAsoiafAnswerCredentialBrokerLoopbackTlsPolicy({
      root,
      brokerServicePolicyId: policy.brokerServicePolicyId,
      endpointLeaseId: alternate.endpointLeaseId,
      clientCertificateFingerprint: policy.clientCertificateFingerprint,
      maxSessionLifetimeMilliseconds: policy.maxSessionLifetimeMilliseconds,
      createdAt: policy.createdAt,
      operatorId: "operator:test:loopback-tls-hostname-policy",
    })).toThrow(/literal 127\.0\.0\.1 or ::1/);
  });

  it("refuses a server private key that differs from the admitted endpoint certificate", async () => {
    const root = cloneEstate();
    const listenerStatus = readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(root);
    const operations = readAsoiafAnswerTransportOperationsStatus(root);
    const policy = listenerStatus.policies[0]!;
    const endpoint = operations.endpoints[0]!;
    const preparedAt = Date.parse(endpoint.availableFrom) + 10_000;
    const session = retainAsoiafAnswerCredentialBrokerLoopbackTlsSession({
      root,
      listenerPolicyId: policy.listenerPolicyId,
      idempotencyKey: "test-loopback-tls-wrong-server-key",
      preparedAt: new Date(preparedAt).toISOString(),
      expiresAt: new Date(preparedAt + 600_000).toISOString(),
      operatorId: "operator:test:loopback-tls-wrong-server-key",
    }).session;

    await expect(startAsoiafAnswerCredentialBrokerLoopbackTls({
      root,
      sessionId: session.sessionId,
      serverCertificate: material("loopback-server.crt"),
      serverPrivateKey: material("wrong-client.key"),
      clientCertificateAuthority: material("loopback-ca.crt"),
      clock: () => new Date(preparedAt + 1_000).toISOString(),
    })).rejects.toThrow(/private key differs from the admitted certificate/);
    expect(fs.existsSync(
      asoiafAnswerCredentialBrokerLoopbackTlsPaths(root).lock,
    )).toBe(false);
  });

  it("reports a prepared but unstarted session as a notice without fabricating runtime success", () => {
    const root = cloneEstate();
    const listenerStatus = readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(root);
    const operations = readAsoiafAnswerTransportOperationsStatus(root);
    const policy = listenerStatus.policies[0]!;
    const endpoint = operations.endpoints[0]!;
    const preparedAt = Date.parse(endpoint.availableFrom) + 20_000;
    const session = retainAsoiafAnswerCredentialBrokerLoopbackTlsSession({
      root,
      listenerPolicyId: policy.listenerPolicyId,
      idempotencyKey: "test-loopback-tls-unstarted-session",
      preparedAt: new Date(preparedAt).toISOString(),
      expiresAt: new Date(preparedAt + 600_000).toISOString(),
      operatorId: "operator:test:loopback-tls-unstarted-session",
    }).session;
    const findings = verifyAsoiafAnswerCredentialBrokerLoopbackTlsEstate(root);

    expect(findings.filter((entry) => entry.severity === "error")).toEqual([]);
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "loopback-tls-session-unstarted",
        severity: "notice",
        subjectId: session.sessionId,
      }),
    ]));
  });

  it("detects lifecycle tampering, forbidden secret paths, and retained runtime locks", () => {
    const root = cloneEstate();
    const status = readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(root);
    const paths = asoiafAnswerCredentialBrokerLoopbackTlsPaths(root);
    const lifecycle = status.lifecycle[0]!;
    const lifecyclePath = path.join(
      paths.lifecycle,
      `${lifecycle.lifecycleFingerprint.slice("sha256:".length)}.json`,
    );
    fs.writeFileSync(lifecyclePath, `${JSON.stringify({
      ...lifecycle,
      reason: `${lifecycle.reason} changed`,
    }, null, 2)}\n`, "utf8");
    fs.writeFileSync(
      path.join(paths.listenerRoot, "forbidden.key"),
      "BEGIN PRIVATE KEY",
      "utf8",
    );
    fs.writeFileSync(paths.lock, `${JSON.stringify({ format: "invalid-lock" })}\n`, "utf8");

    const codes = verifyAsoiafAnswerCredentialBrokerLoopbackTlsEstate(root)
      .map((entry) => entry.code);
    expect(codes).toEqual(expect.arrayContaining([
      "loopback-tls-lifecycle-invalid",
      "loopback-tls-lock-invalid",
      "loopback-tls-lock-retained",
      "loopback-tls-secret-path",
      "loopback-tls-secret-content",
    ]));
  });
});
