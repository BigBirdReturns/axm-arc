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
  ASOIAF_ANSWER_ACTOR_CAPABILITY_LAUNCHER_SOURCE_DIGEST,
  asoiafAnswerActorCapabilityBrokerPaths,
  readAsoiafAnswerActorCapabilityStatus,
  verifyAsoiafAnswerActorCapabilityBrokerEstate,
} from "../../../tools/lib/asoiaf-answer-actor-capability-broker.js";
import {
  readAsoiafAnswerActorAdapterHostStatus,
} from "../../../tools/lib/asoiaf-answer-actor-adapter-host.js";
import {
  readAsoiafAnswerActorRuntimeStatus,
} from "../../../tools/lib/asoiaf-answer-actor-runtime.js";

interface Expected {
  counts: {
    policies: number;
    starts: number;
    terminals: number;
    stateEntries: number;
    isolatedTerminals: number;
  };
  reviewInvocationId: string;
  closeInvocationId: string;
  timeoutInvocationId: string;
  protocolInvocationId: string;
  failureInvocationId: string;
  oversizedInvocationId: string;
  interruptedInvocationId: string;
  variantOutcomes: {
    timeout: string;
    protocol: string;
    failure: string;
    oversized: string;
    interrupted: string;
  };
  mainVerificationCounts: {
    errors: number;
    warnings: number;
    notices: number;
  };
  parentAdapterCounts: {
    manifests: number;
    installations: number;
    invocations: number;
    starts: number;
    terminals: number;
  };
}

function read<T>(directory: string, name: string): T {
  return JSON.parse(fs.readFileSync(path.join(directory, name), "utf8")) as T;
}

function firstJson(directory: string): string {
  const name = fs.readdirSync(directory).find((entry) => /^[a-f0-9]{64}\.json$/.test(entry));
  if (!name) throw new Error(`no digest JSON file in ${directory}`);
  return path.join(directory, name);
}

describe.sequential("ASOIAF actor capability broker", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-actor-capability-test-"));
  const output = path.join(temporary, "receipts");
  const estate = path.join(temporary, "estate");
  let expected: Expected;

  beforeAll(() => {
    if (process.platform !== "linux" || process.arch !== "x64") {
      throw new Error("actor capability qualification requires Linux x64");
    }
    execFileSync(process.execPath, [
      path.join("node_modules", "vite-node", "vite-node.mjs"),
      "tests/fixtures/emit-asoiaf-answer-actor-capability-broker-input.ts",
      output,
      estate,
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
      maxBuffer: 256 * 1024 * 1024,
      timeout: 30 * 60 * 1000,
      stdio: ["ignore", "pipe", "inherit"],
    });
    expected = read<Expected>(output, "expected.json");
  }, 30 * 60 * 1000);

  afterAll(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
  });

  it("retains two exact successful kernel-isolated process transactions", () => {
    const status = readAsoiafAnswerActorCapabilityStatus(estate);
    expect({
      policies: status.policies.length,
      starts: status.starts.length,
      terminals: status.terminals.length,
      stateEntries: status.state?.entries.length ?? 0,
      isolatedTerminals: status.terminals.filter((entry) => entry.osIsolationEnforced).length,
    }).toEqual(expected.counts);
    expect(status.terminals.map((entry) => entry.outcome).sort()).toEqual([
      "succeeded",
      "succeeded",
    ]);
    expect(verifyAsoiafAnswerActorCapabilityBrokerEstate(estate).filter(
      (entry) => entry.severity === "error",
    )).toEqual([]);
  });

  it("binds the compiled launcher, compiler, exact ELF loader, live kernel, and adapter installation", () => {
    const status = readAsoiafAnswerActorCapabilityStatus(estate);
    for (const policy of status.policies) {
      expect(policy.platform).toBe("linux");
      expect(policy.architecture).toBe("x64");
      expect(policy.landlockAbi).toBeGreaterThanOrEqual(3);
      expect(policy.launcherSourceDigest).toBe(
        ASOIAF_ANSWER_ACTOR_CAPABILITY_LAUNCHER_SOURCE_DIGEST,
      );
      expect(policy.launcherBinaryDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(policy.compilerDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(policy.compilationDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(policy.runtimeLoaderPathDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(policy.runtimeLoaderDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(policy.runtimeLoaderBytes).toBeGreaterThan(0);
      expect(policy.executableScope).toBe("manifest-executable-plus-runtime-loader");
      expect(policy.runtimeLoaderExact).toBe(true);
      expect(policy.addressSpaceLimitBytes).toBe(4 * 1024 * 1024 * 1024);
      expect(policy.fileSizeLimitBytes).toBe(1024 * 1024);
      expect(policy.openFileLimit).toBe(64);
      expect(policy.inputRelease).toBe("after-isolation-attestation");
      expect(policy.rawCompilerPathRetained).toBe(false);
    }
  });

  it("admits worker threads while refusing filesystem escape, networking, and child processes", () => {
    const status = readAsoiafAnswerActorCapabilityStatus(estate);
    for (const terminal of status.terminals) {
      expect(terminal.outcome).toBe("succeeded");
      expect(terminal.osIsolationEnforced).toBe(true);
      expect(terminal.adapterInputReleased).toBe(true);
      expect(terminal.isolationReceipt).toMatchObject({
        noNewPrivileges: true,
        landlockFilesystemEnforced: true,
        seccompNetworkEnforced: true,
        seccompChildProcessEnforced: true,
        seccompProcessSignalEnforced: true,
        seccompInterprocessMemoryEnforced: true,
        executableScope: "manifest-executable-plus-runtime-loader",
        runtimeLoaderExact: true,
        cloneThreadAdmitted: true,
        clone3Compatibility: "enosys-fallback",
        resourceLimitsEnforced: true,
        environmentMode: "manifest-exact",
        inputReleased: false,
      });
      expect(terminal.isolationReceiptDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(terminal.adapterEvidence).not.toBeNull();
    }
  });

  it("withholds task input until the launcher attests the complete kernel boundary", () => {
    const status = readAsoiafAnswerActorCapabilityStatus(estate);
    expect(status.policies.every(
      (entry) => entry.inputRelease === "after-isolation-attestation",
    )).toBe(true);
    expect(status.starts.every(
      (entry) => entry.inputRelease === "after-isolation-attestation",
    )).toBe(true);
    expect(status.terminals.every(
      (entry) => entry.isolationReceipt?.inputReleased === false
        && entry.adapterInputReleased === true,
    )).toBe(true);
  });

  it("replays immutable policies, starts, and terminals without compilation or another launch", () => {
    for (const stem of ["review-success", "close-success"]) {
      expect(read<{ replayed: boolean }>(output, `${stem}-bind-first.json`).replayed).toBe(false);
      expect(read<{ replayed: boolean }>(output, `${stem}-bind-replay.json`).replayed).toBe(true);
      expect(read<{ processLaunched: boolean; terminalReplayed: boolean }>(
        output,
        `${stem}-execute-first.json`,
      )).toMatchObject({ processLaunched: true, terminalReplayed: false });
      expect(read<{ processLaunched: boolean; terminalReplayed: boolean }>(
        output,
        `${stem}-execute-replay.json`,
      )).toMatchObject({ processLaunched: false, terminalReplayed: true });
    }
  });

  it("keeps the predecessor adapter host prepared and excludes its weaker start path", () => {
    const adapter = readAsoiafAnswerActorAdapterHostStatus(estate);
    expect({
      manifests: adapter.manifests.length,
      installations: adapter.installations.length,
      invocations: adapter.invocations.length,
      starts: adapter.starts.length,
      terminals: adapter.terminals.length,
    }).toEqual(expected.parentAdapterCounts);
    expect(adapter.starts).toEqual([]);
    expect(adapter.terminals).toEqual([]);
    expect(adapter.invocations).toHaveLength(2);
  });

  it("binds isolated digest evidence to typed runtime results without declaring task outcome", () => {
    const capability = readAsoiafAnswerActorCapabilityStatus(estate);
    const runtime = readAsoiafAnswerActorRuntimeStatus(estate);
    for (const terminal of capability.terminals) {
      const result = runtime.results.find(
        (entry) => entry.executionIntentId === terminal.runtimeExecutionIntentId,
      );
      expect(result?.providerResultId).toBe(terminal.providerResultId);
      expect(result?.outputDigest).toBe(terminal.adapterEvidence?.outputDigest);
      expect(result?.outputBytes).toBe(terminal.adapterEvidence?.outputBytes);
      expect(terminal.taskOutcomeDeclared).toBe(false);
      expect(terminal.terminalAuthority).toBe("kernel-isolation-observation-only");
    }
  });

  it("refuses changed input and changed bundle custody before another mutation", () => {
    const wrongInput = read<{ exitCode: number; message: string }>(output, "wrong-input-refusal.json");
    const wrongBundle = read<{ exitCode: number; message: string }>(output, "wrong-bundle-refusal.json");
    expect(wrongInput.exitCode).not.toBe(0);
    expect(wrongInput.message).toContain("transient capability input differs");
    expect(wrongBundle.exitCode).not.toBe(0);
    expect(wrongBundle.message).toContain("transient adapter bundle differs");
    expect(readAsoiafAnswerActorCapabilityStatus(estate).terminals).toHaveLength(2);
  });

  it("distinguishes timeout, protocol refusal, process failure, resource failure, and restart interruption", () => {
    expect(expected.variantOutcomes).toEqual({
      timeout: "timed-out",
      protocol: "protocol-refused",
      failure: "failed",
      oversized: "failed",
      interrupted: "interrupted",
    });
    const timeout = read<{ terminal: { timedOut: boolean; osIsolationEnforced: boolean } }>(
      output,
      "timeout-execute-first.json",
    ).terminal;
    const protocol = read<{ terminal: { adapterEvidence: unknown; recoveryReason: string } }>(
      output,
      "protocol-execute-first.json",
    ).terminal;
    const failure = read<{ terminal: { exitCode: number; osIsolationEnforced: boolean } }>(
      output,
      "failure-execute-first.json",
    ).terminal;
    const oversized = read<{ terminal: { outcome: string; osIsolationEnforced: boolean } }>(
      output,
      "oversized-execute-first.json",
    ).terminal;
    const interrupted = read<{ terminal: { processLaunched: boolean; adapterInputReleased: boolean } }>(
      output,
      "interrupted-recover-first.json",
    ).terminal;
    expect(timeout).toMatchObject({ timedOut: true, osIsolationEnforced: true });
    expect(protocol.adapterEvidence).toBeNull();
    expect(protocol.recoveryReason).toContain("not valid JSON");
    expect(failure).toMatchObject({ exitCode: 17, osIsolationEnforced: true });
    expect(oversized).toMatchObject({ outcome: "failed", osIsolationEnforced: true });
    expect(interrupted).toMatchObject({ processLaunched: false, adapterInputReleased: false });
  });

  it("retains digest custody without compiler paths, executable paths, task input, or task output", () => {
    const status = readAsoiafAnswerActorCapabilityStatus(estate);
    expect(status.policies.every((entry) =>
      !entry.rawCompilerPathRetained
      && !entry.rawExecutablePathRetained
      && !entry.rawRuntimeLoaderPathRetained
      && !entry.rawAdapterBundlePathRetained
      && !entry.rawTaskInputRetained
      && !entry.rawTaskOutputRetained,
    )).toBe(true);
    expect(status.starts.every((entry) =>
      !entry.rawInputRetained
      && !entry.rawCompilerPathRetained
      && !entry.rawExecutablePathRetained
      && !entry.rawRuntimeLoaderPathRetained
      && !entry.rawAdapterBundlePathRetained,
    )).toBe(true);
    expect(status.terminals.every((entry) =>
      !entry.rawInputRetained
      && !entry.rawStdoutRetained
      && !entry.rawStderrRetained
      && !entry.rawTaskOutputRetained,
    )).toBe(true);
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain("inputBase64");
    expect(serialized).not.toContain('"runtimeLoaderPath":');
    expect(serialized).not.toContain(process.execPath);
    expect(serialized).not.toContain("/usr/bin/cc");
  });

  it("projects exact isolated execution state from append-only receipts", () => {
    const state = readAsoiafAnswerActorCapabilityStatus(estate).state;
    expect(state?.entries.map((entry) => entry.status).sort()).toEqual([
      "succeeded",
      "succeeded",
    ]);
    expect(state?.entries.map((entry) => entry.invocationId).sort()).toEqual([
      expected.closeInvocationId,
      expected.reviewInvocationId,
    ].sort());
    expect(state?.entries.every((entry) => entry.osIsolationEnforced)).toBe(true);
    expect(state?.stateAuthority).toBe("projection-only");
  });

  it("detects a self-consistent-looking retained policy mutation", () => {
    const paths = asoiafAnswerActorCapabilityBrokerPaths(estate);
    const target = firstJson(paths.policies);
    const original = fs.readFileSync(target, "utf8");
    const value = JSON.parse(original) as { operatorId: string };
    value.operatorId = `${value.operatorId}:tampered`;
    fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    try {
      expect(verifyAsoiafAnswerActorCapabilityBrokerEstate(estate).some(
        (entry) => entry.code === "capability-policy-fingerprint" && entry.severity === "error",
      )).toBe(true);
    } finally {
      fs.writeFileSync(target, original, "utf8");
    }
    expect(verifyAsoiafAnswerActorCapabilityBrokerEstate(estate).filter(
      (entry) => entry.severity === "error",
    )).toEqual([]);
  });

  it("detects credential-bearing paths and content under the capability estate", () => {
    const paths = asoiafAnswerActorCapabilityBrokerPaths(estate);
    const leak = path.join(paths.brokerRoot, "forbidden.pem");
    fs.writeFileSync(leak, "-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n", "utf8");
    try {
      const findings = verifyAsoiafAnswerActorCapabilityBrokerEstate(estate);
      expect(findings.some((entry) => entry.code === "capability-secret-path")).toBe(true);
      expect(findings.some((entry) => entry.code === "capability-secret-content")).toBe(true);
    } finally {
      fs.rmSync(leak, { force: true });
    }
  });
});
