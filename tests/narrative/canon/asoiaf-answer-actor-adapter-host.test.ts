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
  asoiafAnswerActorAdapterHostPaths,
  readAsoiafAnswerActorAdapterHostStatus,
  verifyAsoiafAnswerActorAdapterHostEstate,
} from "../../../tools/lib/asoiaf-answer-actor-adapter-host.js";
import {
  readAsoiafAnswerActorRuntimeStatus,
} from "../../../tools/lib/asoiaf-answer-actor-runtime.js";

interface Expected {
  counts: {
    manifests: number;
    installations: number;
    invocations: number;
    starts: number;
    terminals: number;
    stateEntries: number;
  };
  reviewInvocationId: string;
  closeInvocationId: string;
  timeoutInvocationId: string;
  protocolInvocationId: string;
  failureInvocationId: string;
  interruptedInvocationId: string;
  variantOutcomes: {
    timeout: string;
    protocol: string;
    failure: string;
    interrupted: string;
  };
  mainVerificationCounts: {
    errors: number;
    warnings: number;
    notices: number;
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

describe.sequential("ASOIAF actor adapter host", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-actor-adapter-test-"));
  const output = path.join(temporary, "receipts");
  const estate = path.join(temporary, "estate");
  let expected: Expected;

  beforeAll(() => {
    execFileSync(process.execPath, [
      path.join("node_modules", "vite-node", "vite-node.mjs"),
      "tests/fixtures/emit-asoiaf-answer-actor-adapter-host-input.ts",
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

  it("retains two exact successful process transactions above the runtime and provider floor", () => {
    const status = readAsoiafAnswerActorAdapterHostStatus(estate);
    expect({
      manifests: status.manifests.length,
      installations: status.installations.length,
      invocations: status.invocations.length,
      starts: status.starts.length,
      terminals: status.terminals.length,
      stateEntries: status.state?.entries.length ?? 0,
    }).toEqual(expected.counts);
    expect(status.terminals.map((entry) => entry.outcome).sort()).toEqual([
      "succeeded",
      "succeeded",
    ]);
    expect(verifyAsoiafAnswerActorAdapterHostEstate(estate).filter(
      (entry) => entry.severity === "error",
    )).toEqual([]);
  });

  it("replays immutable manifests, installations, invocations, starts, and terminals without another launch", () => {
    for (const stem of ["review-success", "close-success"]) {
      expect(read<{ replayed: boolean }>(output, `${stem}-manifest-first.json`).replayed).toBe(false);
      expect(read<{ replayed: boolean }>(output, `${stem}-manifest-replay.json`).replayed).toBe(true);
      expect(read<{ replayed: boolean }>(output, `${stem}-installation-first.json`).replayed).toBe(false);
      expect(read<{ replayed: boolean }>(output, `${stem}-installation-replay.json`).replayed).toBe(true);
      expect(read<{ replayed: boolean }>(output, `${stem}-prepare-first.json`).replayed).toBe(false);
      expect(read<{ replayed: boolean }>(output, `${stem}-prepare-replay.json`).replayed).toBe(true);
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

  it("binds public process evidence to the typed runtime result without declaring task outcome", () => {
    const adapter = readAsoiafAnswerActorAdapterHostStatus(estate);
    const runtime = readAsoiafAnswerActorRuntimeStatus(estate);
    for (const terminal of adapter.terminals) {
      const evidence = terminal.adapterEvidence;
      expect(evidence).not.toBeNull();
      const result = runtime.results.find(
        (entry) => entry.executionIntentId === terminal.runtimeExecutionIntentId,
      );
      expect(result?.providerResultId).toBe(terminal.providerResultId);
      expect(result?.outputDigest).toBe(evidence?.outputDigest);
      expect(result?.outputBytes).toBe(evidence?.outputBytes);
      expect(terminal.taskOutcomeDeclared).toBe(false);
      expect(terminal.terminalAuthority).toBe("process-observation-only");
    }
  });

  it("uses fixed shell-free process custody and records the remaining OS-isolation boundary", () => {
    const status = readAsoiafAnswerActorAdapterHostStatus(estate);
    for (const manifest of status.manifests) {
      expect(manifest.shell).toBe(false);
      expect(manifest.inheritEnvironment).toBe(false);
      expect(manifest.workingDirectory).toBe("ephemeral-empty");
      expect(manifest.declaredNetworkAccess).toBe("none");
      expect(manifest.declaredChildProcessAccess).toBe("none");
      expect(manifest.osIsolationEnforced).toBe(false);
      expect(Object.keys(manifest.fixedEnvironment).sort()).toEqual(["LANG", "LC_ALL", "TZ"]);
    }
    expect(status.installations.every(
      (entry) => entry.rawExecutablePathRetained === false
        && entry.rawAdapterBundlePathRetained === false,
    )).toBe(true);
  });

  it("refuses changed input and changed executable-bundle custody before mutation", () => {
    const wrongInput = read<{ exitCode: number; message: string }>(output, "wrong-input-refusal.json");
    const wrongBundle = read<{ exitCode: number; message: string }>(output, "wrong-bundle-refusal.json");
    expect(wrongInput.exitCode).not.toBe(0);
    expect(wrongInput.message).toContain("transient adapter input differs");
    expect(wrongBundle.exitCode).not.toBe(0);
    expect(wrongBundle.message).toContain("transient adapter bundle differs");
    expect(readAsoiafAnswerActorAdapterHostStatus(estate).terminals).toHaveLength(2);
  });

  it("distinguishes timeout, protocol refusal, process failure, and restart interruption", () => {
    expect(expected.variantOutcomes).toEqual({
      timeout: "timed-out",
      protocol: "protocol-refused",
      failure: "failed",
      interrupted: "interrupted",
    });
    const timeout = read<{ terminal: { timedOut: boolean; processLaunched: boolean } }>(
      output,
      "timeout-execute-first.json",
    ).terminal;
    const protocol = read<{ terminal: { adapterEvidence: unknown; recoveryReason: string } }>(
      output,
      "protocol-execute-first.json",
    ).terminal;
    const failure = read<{ terminal: { exitCode: number; processLaunched: boolean } }>(
      output,
      "failure-execute-first.json",
    ).terminal;
    const interrupted = read<{ terminal: { processLaunched: boolean; recoveryReason: string } }>(
      output,
      "interrupted-recover-first.json",
    ).terminal;
    expect(timeout).toMatchObject({ timedOut: true, processLaunched: true });
    expect(protocol.adapterEvidence).toBeNull();
    expect(protocol.recoveryReason).toContain("not valid JSON");
    expect(failure).toMatchObject({ exitCode: 17, processLaunched: true });
    expect(interrupted.processLaunched).toBe(false);
    expect(interrupted.recoveryReason).toContain("without launching a duplicate process");
  });

  it("retains only digest custody for task input, task output, stdout, and stderr", () => {
    const status = readAsoiafAnswerActorAdapterHostStatus(estate);
    expect(status.invocations.every((entry) => entry.rawInputRetained === false)).toBe(true);
    expect(status.starts.every((entry) => entry.rawInputRetained === false)).toBe(true);
    expect(status.terminals.every((entry) =>
      entry.rawInputRetained === false
      && entry.rawStdoutRetained === false
      && entry.rawStderrRetained === false
      && entry.rawTaskOutputRetained === false,
    )).toBe(true);
    expect(JSON.stringify(status)).not.toContain("inputBase64");
  });

  it("projects exact process state from append-only receipts", () => {
    const state = readAsoiafAnswerActorAdapterHostStatus(estate).state;
    expect(state?.entries.map((entry) => entry.status).sort()).toEqual([
      "succeeded",
      "succeeded",
    ]);
    expect(state?.entries.map((entry) => entry.invocationId).sort()).toEqual([
      expected.closeInvocationId,
      expected.reviewInvocationId,
    ].sort());
    expect(state?.stateAuthority).toBe("projection-only");
  });

  it("detects a self-consistent-looking retained manifest mutation", () => {
    const paths = asoiafAnswerActorAdapterHostPaths(estate);
    const target = firstJson(paths.manifests);
    const original = fs.readFileSync(target, "utf8");
    const value = JSON.parse(original) as { operatorId: string };
    value.operatorId = `${value.operatorId}:tampered`;
    fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    try {
      expect(verifyAsoiafAnswerActorAdapterHostEstate(estate).some(
        (entry) => entry.code === "adapter-manifest-fingerprint" && entry.severity === "error",
      )).toBe(true);
    } finally {
      fs.writeFileSync(target, original, "utf8");
    }
    expect(verifyAsoiafAnswerActorAdapterHostEstate(estate).filter(
      (entry) => entry.severity === "error",
    )).toEqual([]);
  });

  it("detects credential-bearing paths and content under the adapter estate", () => {
    const paths = asoiafAnswerActorAdapterHostPaths(estate);
    const leak = path.join(paths.hostRoot, "forbidden.pem");
    fs.writeFileSync(leak, "-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n", "utf8");
    try {
      const findings = verifyAsoiafAnswerActorAdapterHostEstate(estate);
      expect(findings.some((entry) => entry.code === "adapter-secret-path")).toBe(true);
      expect(findings.some((entry) => entry.code === "adapter-secret-content")).toBe(true);
    } finally {
      fs.rmSync(leak, { force: true });
    }
  });
});
