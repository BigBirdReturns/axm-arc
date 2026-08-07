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
  readAsoiafAnswerCredentialBrokerStatus,
  retainAsoiafAnswerCredentialBrokerInvocation,
} from "../../../tools/lib/asoiaf-answer-credential-broker.js";
import {
  asoiafAnswerCredentialProviderHostPaths,
  asoiafAnswerCredentialWindowsCngPowerShell,
  executeAsoiafAnswerSyntheticPossession,
  prepareAsoiafAnswerCredentialProviderInvocation,
  readAsoiafAnswerCredentialProviderStatus,
  retainAsoiafAnswerCredentialProviderProfile,
  verifyAsoiafAnswerCredentialProviderHostEstate,
} from "../../../tools/lib/asoiaf-answer-credential-provider-host.js";
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-provider-clone-"));
  roots.push(root);
  fs.cpSync(templateRoot, root, { recursive: true });
  return root;
}

beforeAll(() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-provider-template-"));
  roots.push(base);
  templateRoot = path.join(base, "estate");
  templateOutput = path.join(base, "output");
  fs.mkdirSync(templateOutput, { recursive: true });
  execFileSync("npx", [
    "vite-node",
    "tests/fixtures/emit-asoiaf-answer-credential-provider-host-input.ts",
    templateOutput,
    templateRoot,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    stdio: "pipe",
  });
}, 180_000);

afterAll(() => {
  for (const root of roots.reverse()) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("ASOIAF device-local credential provider host", () => {
  it("retains one exact provider profile, two invocations, two public results, and clean broker admission", () => {
    const provider = readAsoiafAnswerCredentialProviderStatus(templateRoot);
    const broker = readAsoiafAnswerCredentialBrokerStatus(templateRoot);
    const verification = read<{ ok: boolean; findings: unknown[] }>(
      path.join(templateOutput, "provider-verification.json"),
    );
    const expected = read<{
      providerCounts: Record<string, number>;
      brokerCounts: Record<string, number>;
      providerProfileId: string;
      possessionProviderResultId: string;
      transportProviderResultId: string;
      proofId: string;
    }>(path.join(templateOutput, "expected.json"));

    expect(verification).toEqual({
      ok: true,
      root: templateRoot,
      findings: [],
      status: expect.any(Object),
    });
    expect(provider.profiles).toHaveLength(1);
    expect(provider.invocations).toHaveLength(2);
    expect(provider.results).toHaveLength(2);
    expect(provider.state?.entries).toHaveLength(1);
    expect(broker.proofs).toHaveLength(1);
    expect(broker.transportResults).toHaveLength(1);
    expect(provider.profiles[0]?.profileId).toBe(expected.providerProfileId);
    expect(provider.results.map((entry) => entry.resultId)).toEqual(
      expect.arrayContaining([
        expected.possessionProviderResultId,
        expected.transportProviderResultId,
      ]),
    );
    expect(broker.proofs[0]?.proofId).toBe(expected.proofId);
    expect(expected.providerCounts).toEqual({
      profiles: 1,
      invocations: 2,
      results: 2,
      stateEntries: 1,
    });
    expect(expected.brokerCounts).toEqual({
      policies: 1,
      bindings: 1,
      invocations: 2,
      proofs: 1,
      transportResults: 1,
    });
    expect(verifyAsoiafAnswerCredentialProviderHostEstate(templateRoot)).toEqual([]);
  });

  it("replays profiles, invocations, results, and downstream broker admissions exactly", () => {
    for (const name of [
      "provider-profile-replay.json",
      "possession-provider-prepare-replay.json",
      "possession-provider-result-replay.json",
      "possession-broker-admission-replay.json",
      "transport-provider-prepare-replay.json",
      "transport-provider-result-replay.json",
      "transport-broker-admission-replay.json",
    ]) {
      expect(read<{ replayed: boolean }>(path.join(templateOutput, name)).replayed).toBe(true);
    }
    const paths = asoiafAnswerCredentialProviderHostPaths(templateRoot);
    expect(fs.readdirSync(paths.profiles)).toHaveLength(1);
    expect(fs.readdirSync(paths.invocations)).toHaveLength(2);
    expect(fs.readdirSync(paths.results)).toHaveLength(2);
  });

  it("retains only selector digests and public proof material", () => {
    const provider = readAsoiafAnswerCredentialProviderStatus(templateRoot);
    const serialized = JSON.stringify(provider);
    expect(serialized).not.toContain("synthetic:qualification:deployment-initial");
    expect(serialized).not.toContain("synthetic:qualification:device-agent");
    expect(serialized).not.toMatch(/BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY/);
    expect(serialized).not.toContain("deployment-initial.key");
    expect(serialized).not.toContain("device-agent.key");
    for (const profile of provider.profiles) {
      expect(profile.privateKeyRetained).toBe(false);
      expect(profile.rawProviderSelectorRetained).toBe(false);
      expect(profile.providerSecretRetained).toBe(false);
      expect(profile.authority).toBe("none");
      expect(profile.graphEffect).toBe("none");
      expect(profile.canonEffect).toBe("none");
    }
    for (const result of provider.results) {
      expect(result.privateKeyRetained).toBe(false);
      expect(result.rawResponseRetained).toBe(false);
      expect(result.providerSecretRetained).toBe(false);
      expect(result.authority).toBe("none");
    }
  });

  it("refuses remote origins and a provider host that differs from deployment class", () => {
    const root = cloneEstate();
    const broker = readAsoiafAnswerCredentialBrokerStatus(root);
    const policy = broker.policies[0]!;
    const binding = broker.bindings[0]!;
    expect(() => retainAsoiafAnswerCredentialProviderProfile({
      root,
      brokerPolicyId: policy.policyId,
      brokerBindingId: binding.bindingId,
      hostKind: "synthetic-fixture",
      credentialSelector: "synthetic:other-credential",
      deviceAgentSelector: "synthetic:other-agent",
      allowedTargetOrigins: ["http://remote.example.test"],
      maxResponseBytes: 65_536,
      createdAt: new Date(Date.parse(binding.boundAt) + 1_000).toISOString(),
      operatorId: "operator:invalid-origin",
    })).toThrow(/HTTPS origins/);
    expect(() => retainAsoiafAnswerCredentialProviderProfile({
      root,
      brokerPolicyId: policy.policyId,
      brokerBindingId: binding.bindingId,
      hostKind: "windows-cng",
      credentialSelector: "ABCDEF0123456789",
      deviceAgentSelector: "0123456789ABCDEF",
      allowedTargetOrigins: ["https://answer-desk.example.test"],
      maxResponseBytes: 65_536,
      createdAt: new Date(Date.parse(binding.boundAt) + 1_000).toISOString(),
      operatorId: "operator:invalid-host",
    })).toThrow(/cannot execute deployment class/);
  });

  it("refuses a changed broker invocation under one provider idempotency key", () => {
    const root = cloneEstate();
    const broker = readAsoiafAnswerCredentialBrokerStatus(root);
    const provider = readAsoiafAnswerCredentialProviderStatus(root);
    const policy = broker.policies[0]!;
    const binding = broker.bindings[0]!;
    const original = broker.invocations.find((entry) => entry.operation === "prove-possession")!;
    const createdAt = new Date(Date.parse(original.createdAt) + 1_000).toISOString();
    const expiresAt = new Date(Date.parse(original.expiresAt) - 1_000).toISOString();
    const second = retainAsoiafAnswerCredentialBrokerInvocation({
      root,
      policyId: policy.policyId,
      bindingId: binding.bindingId,
      operation: "prove-possession",
      idempotencyKey: "provider-conflict-broker-invocation",
      request: {
        kind: "possession",
        challengeDigest: sha256("provider-conflict-challenge"),
        contextDigest: sha256("provider-conflict-context"),
      },
      createdAt,
      expiresAt,
      operatorId: "operator:provider-conflict-broker",
    }).invocation;
    expect(() => prepareAsoiafAnswerCredentialProviderInvocation({
      root,
      profileId: provider.profiles[0]!.profileId,
      brokerInvocationId: second.invocationId,
      idempotencyKey: "qualification-provider-possession-host-v1",
      preparedAt: new Date(Date.parse(createdAt) + 100).toISOString(),
      expiresAt: new Date(Date.parse(expiresAt) - 100).toISOString(),
      operatorId: "operator:provider-conflict",
    })).toThrow(/idempotency key conflicts/);
  });

  it("refuses a transient credential key that differs from the active deployment binding", () => {
    const root = cloneEstate();
    const broker = readAsoiafAnswerCredentialBrokerStatus(root);
    const provider = readAsoiafAnswerCredentialProviderStatus(root);
    const policy = broker.policies[0]!;
    const binding = broker.bindings[0]!;
    const original = broker.invocations.find((entry) => entry.operation === "prove-possession")!;
    const createdAt = new Date(Date.parse(original.createdAt) + 2_000).toISOString();
    const expiresAt = new Date(Date.parse(original.expiresAt) - 2_000).toISOString();
    const pending = retainAsoiafAnswerCredentialBrokerInvocation({
      root,
      policyId: policy.policyId,
      bindingId: binding.bindingId,
      operation: "prove-possession",
      idempotencyKey: "provider-wrong-key-broker-invocation",
      request: {
        kind: "possession",
        challengeDigest: sha256("provider-wrong-key-challenge"),
        contextDigest: sha256("provider-wrong-key-context"),
      },
      createdAt,
      expiresAt,
      operatorId: "operator:provider-wrong-key-broker",
    }).invocation;
    const prepared = prepareAsoiafAnswerCredentialProviderInvocation({
      root,
      profileId: provider.profiles[0]!.profileId,
      brokerInvocationId: pending.invocationId,
      idempotencyKey: "provider-wrong-key-host-invocation",
      preparedAt: new Date(Date.parse(createdAt) + 100).toISOString(),
      expiresAt: new Date(Date.parse(expiresAt) - 100).toISOString(),
      operatorId: "operator:provider-wrong-key-prepare",
    }).invocation;
    const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    expect(() => executeAsoiafAnswerSyntheticPossession({
      root,
      providerInvocationId: prepared.providerInvocationId,
      credentialPrivateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      completedAt: new Date(Date.parse(createdAt) + 200).toISOString(),
      operatorId: "operator:provider-wrong-key-execute",
    })).toThrow(/differs from active deployment binding/);
  });

  it("detects changed result bytes and forbidden secret-bearing files", () => {
    const root = cloneEstate();
    const status = readAsoiafAnswerCredentialProviderStatus(root);
    const paths = asoiafAnswerCredentialProviderHostPaths(root);
    const result = status.results[0]!;
    const resultPath = path.join(
      paths.results,
      `${result.resultFingerprint.slice("sha256:".length)}.json`,
    );
    fs.writeFileSync(resultPath, `${JSON.stringify({
      ...result,
      providerReceiptDigest: sha256("tampered-provider-receipt"),
    }, null, 2)}\n`, "utf8");
    fs.writeFileSync(path.join(paths.providerRoot, "forbidden.key"), "BEGIN PRIVATE KEY", "utf8");
    expect(
      verifyAsoiafAnswerCredentialProviderHostEstate(root).map((entry) => entry.code),
    ).toEqual(expect.arrayContaining([
      "provider-result-invalid",
      "provider-secret-path",
      "provider-secret-content",
    ]));
  });

  it("emits a Windows CNG adapter that resolves non-exported CurrentUser keys without an export path", () => {
    const script = asoiafAnswerCredentialWindowsCngPowerShell();
    expect(script).toContain("Cert:\\CurrentUser\\My\\");
    expect(script).toContain("GetRSAPrivateKey");
    expect(script).toContain("GetECDsaPrivateKey");
    expect(script).toContain("ClientCertificates.Add");
    expect(script).toContain("ServerCertificateCustomValidationCallback");
    expect(script).toContain("expectedServerCertificateFingerprint");
    expect(script).toContain("expectedServerIssuerFingerprint");
    expect(script).not.toMatch(/Export(?:Pkcs8|RSAPrivateKey|ECPrivateKey|Parameters)/);
    expect(script).not.toContain("PrivateKey.Export");
  });
});
