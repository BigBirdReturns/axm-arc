import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  collectorContentId,
  sha256,
} from "./asoiaf-external-estate.js";
import {
  readAsoiafAnswerActorRuntimeStatus,
  verifyAsoiafAnswerActorRuntimeEstate,
  type AsoiafAnswerActorRuntimeAcceptance,
  type AsoiafAnswerActorRuntimeExecutionIntent,
  type AsoiafAnswerActorRuntimeResult,
} from "./asoiaf-answer-actor-runtime.js";
import {
  readAsoiafAnswerCredentialProviderStatus,
  verifyAsoiafAnswerCredentialProviderHostEstate,
  type AsoiafAnswerCredentialProviderProfile,
  type AsoiafAnswerCredentialProviderResult,
} from "./asoiaf-answer-credential-provider-host.js";

export const ASOIAF_ANSWER_ACTOR_ADAPTER_MANIFEST_FORMAT =
  "axm-asoiaf-answer-actor-adapter-manifest/1" as const;
export const ASOIAF_ANSWER_ACTOR_ADAPTER_INSTALLATION_FORMAT =
  "axm-asoiaf-answer-actor-adapter-installation/1" as const;
export const ASOIAF_ANSWER_ACTOR_ADAPTER_INVOCATION_FORMAT =
  "axm-asoiaf-answer-actor-adapter-invocation/1" as const;
export const ASOIAF_ANSWER_ACTOR_ADAPTER_START_FORMAT =
  "axm-asoiaf-answer-actor-adapter-start/1" as const;
export const ASOIAF_ANSWER_ACTOR_ADAPTER_TERMINAL_FORMAT =
  "axm-asoiaf-answer-actor-adapter-terminal/1" as const;
export const ASOIAF_ANSWER_ACTOR_ADAPTER_STATE_FORMAT =
  "axm-asoiaf-answer-actor-adapter-state/1" as const;
export const ASOIAF_ANSWER_ACTOR_ADAPTER_INPUT_FORMAT =
  "axm-asoiaf-answer-actor-adapter-input/1" as const;
export const ASOIAF_ANSWER_ACTOR_ADAPTER_OUTPUT_FORMAT =
  "axm-asoiaf-answer-actor-adapter-output/1" as const;

const MAX_FILE_BYTES = 128 * 1024 * 1024;
const MAX_STREAM_BYTES = 16 * 1024 * 1024;
const MAX_TIMEOUT_MILLISECONDS = 60 * 60 * 1000;
const EMPTY_DIGEST: `sha256:${string}` = `sha256:${crypto.createHash("sha256").digest("hex")}`;

interface NoAuthority {
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
}

const NO_AUTHORITY: NoAuthority = {
  authority: "none",
  graphEffect: "none",
  canonEffect: "none",
  answerEffect: "none",
};

export interface AsoiafAnswerActorAdapterHostPaths {
  root: string;
  hostRoot: string;
  manifests: string;
  installations: string;
  invocations: string;
  starts: string;
  terminals: string;
  state: string;
}

export interface AsoiafAnswerActorAdapterManifest extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_ADAPTER_MANIFEST_FORMAT;
  manifestId: string;
  manifestFingerprint: `sha256:${string}`;
  adapterId: string;
  adapterVersion: string;
  executableName: string;
  executableDigest: `sha256:${string}`;
  executableBytes: number;
  adapterBundleName: string;
  adapterBundleDigest: `sha256:${string}`;
  adapterBundleBytes: number;
  fixedArgumentTemplate: string[];
  fixedArgumentsDigest: `sha256:${string}`;
  fixedEnvironment: Record<string, string>;
  environmentDigest: `sha256:${string}`;
  allowedResultKinds: string[];
  maxInputBytes: number;
  maxStdoutBytes: number;
  maxStderrBytes: number;
  timeoutMilliseconds: number;
  shell: false;
  inheritEnvironment: false;
  workingDirectory: "ephemeral-empty";
  declaredFilesystemAccess: "adapter-bundle-and-ephemeral-cwd-only";
  declaredNetworkAccess: "none";
  declaredChildProcessAccess: "none";
  osIsolationEnforced: false;
  createdAt: string;
  operatorId: string;
  rawExecutablePathRetained: false;
  rawAdapterBundlePathRetained: false;
  rawTaskInputRetained: false;
  rawTaskOutputRetained: false;
  manifestAuthority: "process-policy-only";
}

export interface AsoiafAnswerActorAdapterInstallation extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_ADAPTER_INSTALLATION_FORMAT;
  installationId: string;
  installationFingerprint: `sha256:${string}`;
  manifestId: string;
  manifestFingerprint: `sha256:${string}`;
  hostId: string;
  platform: NodeJS.Platform;
  architecture: string;
  executablePathDigest: `sha256:${string}`;
  executableDigest: `sha256:${string}`;
  executableBytes: number;
  adapterBundlePathDigest: `sha256:${string}`;
  adapterBundleDigest: `sha256:${string}`;
  adapterBundleBytes: number;
  fixedArgumentsDigest: `sha256:${string}`;
  installedAt: string;
  operatorId: string;
  rawExecutablePathRetained: false;
  rawAdapterBundlePathRetained: false;
  installationAuthority: "host-installation-reference-only";
}

export interface AsoiafAnswerActorAdapterInvocation extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_ADAPTER_INVOCATION_FORMAT;
  invocationId: string;
  invocationFingerprint: `sha256:${string}`;
  manifestId: string;
  manifestFingerprint: `sha256:${string}`;
  installationId: string;
  installationFingerprint: `sha256:${string}`;
  runtimeExecutionIntentId: string;
  runtimeExecutionIntentFingerprint: `sha256:${string}`;
  runtimeAcceptanceId: string;
  runtimeAcceptanceFingerprint: `sha256:${string}`;
  runtimeSlotId: string;
  runtimeSlotFingerprint: `sha256:${string}`;
  providerProfileId: string;
  providerProfileFingerprint: `sha256:${string}`;
  providerResultId: string;
  providerResultFingerprint: `sha256:${string}`;
  adapterId: string;
  adapterVersion: string;
  inputDigest: `sha256:${string}`;
  inputBytes: number;
  idempotencyKeyDigest: `sha256:${string}`;
  preparedAt: string;
  expiresAt: string;
  operatorId: string;
  rawInputRetained: false;
  rawIdempotencyKeyRetained: false;
  invocationAuthority: "process-invocation-request-only";
}

export interface AsoiafAnswerActorAdapterStart extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_ADAPTER_START_FORMAT;
  startId: string;
  startFingerprint: `sha256:${string}`;
  invocationId: string;
  invocationFingerprint: `sha256:${string}`;
  manifestId: string;
  manifestFingerprint: `sha256:${string}`;
  installationId: string;
  installationFingerprint: `sha256:${string}`;
  runtimeExecutionIntentId: string;
  runtimeExecutionIntentFingerprint: `sha256:${string}`;
  commandDigest: `sha256:${string}`;
  environmentDigest: `sha256:${string}`;
  inputDigest: `sha256:${string}`;
  inputBytes: number;
  startedAt: string;
  operatorId: string;
  shell: false;
  inheritEnvironment: false;
  workingDirectory: "ephemeral-empty";
  rawInputRetained: false;
  rawExecutablePathRetained: false;
  rawAdapterBundlePathRetained: false;
  startAuthority: "process-start-observation-only";
}

export interface AsoiafAnswerActorAdapterEvidence {
  format: typeof ASOIAF_ANSWER_ACTOR_ADAPTER_OUTPUT_FORMAT;
  invocationId: string;
  invocationFingerprint: `sha256:${string}`;
  runtimeExecutionIntentId: string;
  runtimeExecutionIntentFingerprint: `sha256:${string}`;
  adapterId: string;
  adapterVersion: string;
  resultKind: string;
  outputDigest: `sha256:${string}`;
  outputBytes: number;
  rawOutputRetained: false;
  evidenceAuthority: "digest-evidence-only";
}

export type AsoiafAnswerActorAdapterTerminalOutcome =
  | "succeeded"
  | "failed"
  | "timed-out"
  | "protocol-refused"
  | "interrupted";

export interface AsoiafAnswerActorAdapterTerminal extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_ADAPTER_TERMINAL_FORMAT;
  terminalId: string;
  terminalFingerprint: `sha256:${string}`;
  startId: string;
  startFingerprint: `sha256:${string}`;
  invocationId: string;
  invocationFingerprint: `sha256:${string}`;
  manifestId: string;
  manifestFingerprint: `sha256:${string}`;
  installationId: string;
  installationFingerprint: `sha256:${string}`;
  runtimeExecutionIntentId: string;
  runtimeExecutionIntentFingerprint: `sha256:${string}`;
  providerResultId: string;
  providerResultFingerprint: `sha256:${string}`;
  outcome: AsoiafAnswerActorAdapterTerminalOutcome;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  startedAt: string;
  completedAt: string;
  durationMilliseconds: number;
  stdoutDigest: `sha256:${string}`;
  stdoutBytes: number;
  stderrDigest: `sha256:${string}`;
  stderrBytes: number;
  adapterEvidence: AsoiafAnswerActorAdapterEvidence | null;
  recoveryReason: string | null;
  processLaunched: boolean;
  timedOut: boolean;
  outputLimitExceeded: boolean;
  rawInputRetained: false;
  rawStdoutRetained: false;
  rawStderrRetained: false;
  rawTaskOutputRetained: false;
  taskOutcomeDeclared: false;
  osIsolationEnforced: false;
  terminalAuthority: "process-observation-only";
}

export type AsoiafAnswerActorAdapterInvocationStatus =
  | "prepared"
  | "started"
  | AsoiafAnswerActorAdapterTerminalOutcome;

export interface AsoiafAnswerActorAdapterStateEntry {
  invocationId: string;
  invocationFingerprint: `sha256:${string}`;
  manifestId: string;
  installationId: string;
  runtimeExecutionIntentId: string;
  startId: string | null;
  terminalId: string | null;
  status: AsoiafAnswerActorAdapterInvocationStatus;
  updatedAt: string;
}

export interface AsoiafAnswerActorAdapterState extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_ADAPTER_STATE_FORMAT;
  stateId: string;
  stateFingerprint: `sha256:${string}`;
  asOf: string;
  entries: AsoiafAnswerActorAdapterStateEntry[];
  stateAuthority: "projection-only";
}

export interface AsoiafAnswerActorAdapterStatus {
  format: "axm-asoiaf-answer-actor-adapter-host-status/1";
  paths: AsoiafAnswerActorAdapterHostPaths;
  manifests: AsoiafAnswerActorAdapterManifest[];
  installations: AsoiafAnswerActorAdapterInstallation[];
  invocations: AsoiafAnswerActorAdapterInvocation[];
  starts: AsoiafAnswerActorAdapterStart[];
  terminals: AsoiafAnswerActorAdapterTerminal[];
  state: AsoiafAnswerActorAdapterState | null;
}

export interface AsoiafAnswerActorAdapterFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

export interface AsoiafAnswerActorAdapterManifestInput {
  root: string;
  adapterId: string;
  adapterVersion: string;
  executablePath: string;
  adapterBundlePath: string;
  fixedArgumentTemplate: string[];
  fixedEnvironment?: Record<string, string>;
  allowedResultKinds: string[];
  maxInputBytes: number;
  maxStdoutBytes: number;
  maxStderrBytes: number;
  timeoutMilliseconds: number;
  createdAt: string;
  operatorId: string;
}

export interface AsoiafAnswerActorAdapterInstallationInput {
  root: string;
  manifestId: string;
  hostId: string;
  executablePath: string;
  adapterBundlePath: string;
  installedAt: string;
  operatorId: string;
}

export interface AsoiafAnswerActorAdapterPrepareInput {
  root: string;
  manifestId: string;
  installationId: string;
  runtimeExecutionIntentId: string;
  providerResultId: string;
  idempotencyKey: string;
  preparedAt: string;
  expiresAt: string;
  operatorId: string;
}

export interface AsoiafAnswerActorAdapterStartInput {
  root: string;
  invocationId: string;
  executablePath: string;
  adapterBundlePath: string;
  inputBase64: string;
  startedAt: string;
  operatorId: string;
}

export interface AsoiafAnswerActorAdapterExecuteInput extends AsoiafAnswerActorAdapterStartInput {}

export interface AsoiafAnswerActorAdapterRecoverInput {
  root: string;
  invocationId: string;
  recoveredAt: string;
  reason: string;
  operatorId: string;
}

interface ProcessRunResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdoutDigest: `sha256:${string}`;
  stdoutBytes: number;
  stderrDigest: `sha256:${string}`;
  stderrBytes: number;
  stdoutBuffer: Buffer;
  timedOut: boolean;
  outputLimitExceeded: boolean;
  spawnError: string | null;
  completedAt: string;
}

function finding(
  code: string,
  severity: AsoiafAnswerActorAdapterFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafAnswerActorAdapterFinding {
  return { code, severity, subjectId, detail };
}

function sortedFindings(
  values: readonly AsoiafAnswerActorAdapterFinding[],
): AsoiafAnswerActorAdapterFinding[] {
  const rank = { error: 0, warning: 1, notice: 2 } as const;
  return [...values].sort((left, right) =>
    rank[left.severity] - rank[right.severity]
    || left.code.localeCompare(right.code)
    || left.subjectId.localeCompare(right.subjectId)
    || left.detail.localeCompare(right.detail));
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function requireId(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 1024 || /[\r\n\0]/.test(normalized)) {
    throw new Error(`${label} is invalid`);
  }
  return normalized;
}

function requireReason(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length < 24 || normalized.length > 4096 || /\0/.test(normalized)) {
    throw new Error(`${label} must contain 24 through 4096 characters`);
  }
  return normalized;
}

function requireTime(value: string, label: string): string {
  if (!value.trim() || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} is invalid`);
  }
  return new Date(value).toISOString();
}

function requireDigest(value: string, label: string): `sha256:${string}` {
  const normalized = value.trim().toLowerCase();
  if (!/^sha256:[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
  return normalized as `sha256:${string}`;
}

function requireInteger(
  value: number,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} through ${maximum}`);
  }
  return value;
}

function normalizeResultKinds(values: readonly string[]): string[] {
  const normalized = values.map((entry) => requireId(entry, "adapter result kind"));
  const unique = [...new Set(normalized)].sort();
  if (unique.length === 0 || unique.length !== normalized.length) {
    throw new Error("adapter manifest requires one or more unique result kinds");
  }
  return unique;
}

function normalizeArgumentTemplate(values: readonly string[]): string[] {
  if (!Array.isArray(values) || values.length === 0 || values.length > 64) {
    throw new Error("adapter fixed argument template must contain 1 through 64 entries");
  }
  const normalized = values.map((entry, index) => {
    if (
      typeof entry !== "string"
      || entry.length === 0
      || entry.length > 4096
      || /[\r\n\0]/.test(entry)
    ) {
      throw new Error(`adapter fixed argument template entry ${index} is invalid`);
    }
    return entry;
  });
  if (normalized.filter((entry) => entry === "{adapterBundle}").length !== 1) {
    throw new Error("adapter fixed argument template must contain exactly one {adapterBundle} token");
  }
  if (normalized.some((entry) => entry.includes("{") && entry !== "{adapterBundle}")) {
    throw new Error("adapter fixed argument template contains an unsupported substitution token");
  }
  return normalized;
}

function normalizeEnvironment(value: Record<string, string> | undefined): Record<string, string> {
  const source = value ?? {
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    TZ: "UTC",
  };
  const normalized: Record<string, string> = {};
  for (const name of Object.keys(source).sort()) {
    const entry = source[name];
    if (!/^[A-Z_][A-Z0-9_]{0,63}$/.test(name)) {
      throw new Error(`adapter environment name ${name} is invalid`);
    }
    if (/(?:AUTH|CERT|COOKIE|CREDENTIAL|KEY|PASS|PASSWORD|PIN|SECRET|SESSION|TOKEN)/.test(name)) {
      throw new Error(`adapter environment name ${name} is secret-bearing`);
    }
    if (typeof entry !== "string" || entry.length > 2048 || /[\0]/.test(entry)) {
      throw new Error(`adapter environment value ${name} is invalid`);
    }
    if (/-----BEGIN |pkcs11:|(?:password|secret|token|session|pin)\s*[=:]/i.test(entry)) {
      throw new Error(`adapter environment value ${name} is secret-bearing`);
    }
    normalized[name] = entry;
  }
  return normalized;
}

function fileIdentity(target: string, label: string): {
  path: string;
  pathDigest: `sha256:${string}`;
  name: string;
  digest: `sha256:${string}`;
  bytes: number;
} {
  const absolute = path.resolve(target);
  const stat = fs.statSync(absolute);
  if (!stat.isFile()) throw new Error(`${label} must be a regular file`);
  const bytes = requireInteger(stat.size, `${label} byte count`, 1, MAX_FILE_BYTES);
  const digest = `sha256:${crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex")}` as const;
  return {
    path: absolute,
    pathDigest: sha256(absolute),
    name: path.basename(absolute),
    digest,
    bytes,
  };
}

function exactObject(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be one JSON object`);
  }
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} contains missing or unknown fields`);
  }
  return record;
}

function readJson<T>(target: string): T {
  return JSON.parse(fs.readFileSync(target, "utf8")) as T;
}

function listJson<T>(directory: string): T[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name) => /^[a-f0-9]{64}\.json$/.test(name))
    .sort()
    .map((name) => readJson<T>(path.join(directory, name)));
}

function digestPath(directory: string, digest: `sha256:${string}`): string {
  return path.join(directory, `${digest.slice("sha256:".length)}.json`);
}

function writeExact<T>(target: string, value: T): { value: T; replayed: boolean } {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    fs.writeFileSync(target, serialized, { encoding: "utf8", flag: "wx" });
    return { value, replayed: false };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = fs.readFileSync(target, "utf8");
    if (existing !== serialized) {
      throw new Error(`actor adapter immutable file collision at ${target}`);
    }
    return { value: JSON.parse(existing) as T, replayed: true };
  }
}

function writeAtomic(target: string, value: unknown): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, target);
}

function objectCore(
  value: Record<string, unknown>,
  idKey: string,
  fingerprintKey: string,
): Record<string, unknown> {
  const clone = { ...value };
  delete clone[idKey];
  delete clone[fingerprintKey];
  return clone;
}

function fingerprintMatches(
  value: Record<string, unknown>,
  idKey: string,
  fingerprintKey: string,
): boolean {
  return value[fingerprintKey] === sha256(objectCore(value, idKey, fingerprintKey));
}

export function asoiafAnswerActorAdapterHostPaths(
  root: string,
): AsoiafAnswerActorAdapterHostPaths {
  const absolute = path.resolve(root);
  const hostRoot = path.join(absolute, "answer-actor-adapter-host");
  return {
    root: absolute,
    hostRoot,
    manifests: path.join(hostRoot, "manifests"),
    installations: path.join(hostRoot, "installations"),
    invocations: path.join(hostRoot, "invocations"),
    starts: path.join(hostRoot, "starts"),
    terminals: path.join(hostRoot, "terminals"),
    state: path.join(hostRoot, "ADAPTER-STATE.json"),
  };
}

export function readAsoiafAnswerActorAdapterHostStatus(
  root: string,
): AsoiafAnswerActorAdapterStatus {
  const paths = asoiafAnswerActorAdapterHostPaths(root);
  return {
    format: "axm-asoiaf-answer-actor-adapter-host-status/1",
    paths,
    manifests: listJson<AsoiafAnswerActorAdapterManifest>(paths.manifests),
    installations: listJson<AsoiafAnswerActorAdapterInstallation>(paths.installations),
    invocations: listJson<AsoiafAnswerActorAdapterInvocation>(paths.invocations),
    starts: listJson<AsoiafAnswerActorAdapterStart>(paths.starts),
    terminals: listJson<AsoiafAnswerActorAdapterTerminal>(paths.terminals),
    state: fs.existsSync(paths.state)
      ? readJson<AsoiafAnswerActorAdapterState>(paths.state)
      : null,
  };
}

function unique<T>(
  values: readonly T[],
  predicate: (entry: T) => boolean,
  label: string,
): T {
  const matches = values.filter(predicate);
  if (matches.length !== 1) throw new Error(`${label} is absent or duplicated`);
  return matches[0]!;
}

function manifestById(root: string, manifestId: string): AsoiafAnswerActorAdapterManifest {
  return unique(
    readAsoiafAnswerActorAdapterHostStatus(root).manifests,
    (entry) => entry.manifestId === manifestId,
    `actor adapter manifest ${manifestId}`,
  );
}

function installationById(root: string, installationId: string): AsoiafAnswerActorAdapterInstallation {
  return unique(
    readAsoiafAnswerActorAdapterHostStatus(root).installations,
    (entry) => entry.installationId === installationId,
    `actor adapter installation ${installationId}`,
  );
}

function invocationById(root: string, invocationId: string): AsoiafAnswerActorAdapterInvocation {
  return unique(
    readAsoiafAnswerActorAdapterHostStatus(root).invocations,
    (entry) => entry.invocationId === invocationId,
    `actor adapter invocation ${invocationId}`,
  );
}

function runtimeIntentById(root: string, intentId: string): AsoiafAnswerActorRuntimeExecutionIntent {
  return unique(
    readAsoiafAnswerActorRuntimeStatus(root).executionIntents,
    (entry) => entry.executionIntentId === intentId,
    `actor runtime execution intent ${intentId}`,
  );
}

function runtimeAcceptanceById(root: string, acceptanceId: string): AsoiafAnswerActorRuntimeAcceptance {
  return unique(
    readAsoiafAnswerActorRuntimeStatus(root).acceptances,
    (entry) => entry.acceptanceId === acceptanceId,
    `actor runtime acceptance ${acceptanceId}`,
  );
}

function providerProfileById(root: string, profileId: string): AsoiafAnswerCredentialProviderProfile {
  return unique(
    readAsoiafAnswerCredentialProviderStatus(root).profiles,
    (entry) => entry.profileId === profileId,
    `credential provider profile ${profileId}`,
  );
}

function providerResultById(root: string, resultId: string): AsoiafAnswerCredentialProviderResult {
  return unique(
    readAsoiafAnswerCredentialProviderStatus(root).results,
    (entry) => entry.resultId === resultId,
    `credential provider result ${resultId}`,
  );
}

function buildState(root: string): AsoiafAnswerActorAdapterState | null {
  const status = readAsoiafAnswerActorAdapterHostStatus(root);
  if (status.manifests.length === 0 && status.invocations.length === 0) return null;
  const entries = status.invocations.map((invocation): AsoiafAnswerActorAdapterStateEntry => {
    const start = status.starts.find((entry) => entry.invocationId === invocation.invocationId) ?? null;
    const terminal = status.terminals.find((entry) => entry.invocationId === invocation.invocationId) ?? null;
    return {
      invocationId: invocation.invocationId,
      invocationFingerprint: invocation.invocationFingerprint,
      manifestId: invocation.manifestId,
      installationId: invocation.installationId,
      runtimeExecutionIntentId: invocation.runtimeExecutionIntentId,
      startId: start?.startId ?? null,
      terminalId: terminal?.terminalId ?? null,
      status: terminal?.outcome ?? (start ? "started" : "prepared"),
      updatedAt: terminal?.completedAt ?? start?.startedAt ?? invocation.preparedAt,
    };
  }).sort((left, right) => left.invocationId.localeCompare(right.invocationId));
  const asOf = [
    ...status.manifests.map((entry) => entry.createdAt),
    ...status.installations.map((entry) => entry.installedAt),
    ...entries.map((entry) => entry.updatedAt),
  ].sort().at(-1) ?? "1970-01-01T00:00:00.000Z";
  const stateCore = {
    format: ASOIAF_ANSWER_ACTOR_ADAPTER_STATE_FORMAT,
    asOf,
    entries,
    stateAuthority: "projection-only" as const,
    ...NO_AUTHORITY,
  };
  const stateFingerprint = sha256(stateCore);
  return {
    ...stateCore,
    stateId: collectorContentId("asoiaf-answer-actor-adapter-state", {
      asOf,
      stateFingerprint,
    }),
    stateFingerprint,
  };
}

function refreshState(root: string): AsoiafAnswerActorAdapterState | null {
  const paths = asoiafAnswerActorAdapterHostPaths(root);
  const state = buildState(root);
  if (state) writeAtomic(paths.state, state);
  else fs.rmSync(paths.state, { force: true });
  return state;
}

function validateTransientFiles(
  manifest: AsoiafAnswerActorAdapterManifest,
  installation: AsoiafAnswerActorAdapterInstallation,
  executablePath: string,
  adapterBundlePath: string,
): { executable: ReturnType<typeof fileIdentity>; bundle: ReturnType<typeof fileIdentity> } {
  const executable = fileIdentity(executablePath, "adapter executable");
  const bundle = fileIdentity(adapterBundlePath, "adapter bundle");
  if (
    executable.pathDigest !== installation.executablePathDigest
    || executable.digest !== manifest.executableDigest
    || executable.digest !== installation.executableDigest
    || executable.bytes !== manifest.executableBytes
    || executable.bytes !== installation.executableBytes
  ) {
    throw new Error("transient adapter executable differs from the retained manifest or installation");
  }
  if (
    bundle.pathDigest !== installation.adapterBundlePathDigest
    || bundle.digest !== manifest.adapterBundleDigest
    || bundle.digest !== installation.adapterBundleDigest
    || bundle.bytes !== manifest.adapterBundleBytes
    || bundle.bytes !== installation.adapterBundleBytes
  ) {
    throw new Error("transient adapter bundle differs from the retained manifest or installation");
  }
  return { executable, bundle };
}

export function retainAsoiafAnswerActorAdapterManifest(
  input: AsoiafAnswerActorAdapterManifestInput,
): { manifest: AsoiafAnswerActorAdapterManifest; replayed: boolean } {
  const executable = fileIdentity(input.executablePath, "adapter executable");
  const bundle = fileIdentity(input.adapterBundlePath, "adapter bundle");
  const fixedArgumentTemplate = normalizeArgumentTemplate(input.fixedArgumentTemplate);
  const fixedEnvironment = normalizeEnvironment(input.fixedEnvironment);
  const allowedResultKinds = normalizeResultKinds(input.allowedResultKinds);
  const manifestCore = {
    format: ASOIAF_ANSWER_ACTOR_ADAPTER_MANIFEST_FORMAT,
    adapterId: requireId(input.adapterId, "adapter identity"),
    adapterVersion: requireId(input.adapterVersion, "adapter version"),
    executableName: executable.name,
    executableDigest: executable.digest,
    executableBytes: executable.bytes,
    adapterBundleName: bundle.name,
    adapterBundleDigest: bundle.digest,
    adapterBundleBytes: bundle.bytes,
    fixedArgumentTemplate,
    fixedArgumentsDigest: sha256(fixedArgumentTemplate),
    fixedEnvironment,
    environmentDigest: sha256(fixedEnvironment),
    allowedResultKinds,
    maxInputBytes: requireInteger(input.maxInputBytes, "adapter maximum input bytes", 1, MAX_STREAM_BYTES),
    maxStdoutBytes: requireInteger(input.maxStdoutBytes, "adapter maximum stdout bytes", 1, MAX_STREAM_BYTES),
    maxStderrBytes: requireInteger(input.maxStderrBytes, "adapter maximum stderr bytes", 1, MAX_STREAM_BYTES),
    timeoutMilliseconds: requireInteger(
      input.timeoutMilliseconds,
      "adapter timeout milliseconds",
      100,
      MAX_TIMEOUT_MILLISECONDS,
    ),
    shell: false as const,
    inheritEnvironment: false as const,
    workingDirectory: "ephemeral-empty" as const,
    declaredFilesystemAccess: "adapter-bundle-and-ephemeral-cwd-only" as const,
    declaredNetworkAccess: "none" as const,
    declaredChildProcessAccess: "none" as const,
    osIsolationEnforced: false as const,
    createdAt: requireTime(input.createdAt, "adapter manifest creation time"),
    operatorId: requireId(input.operatorId, "adapter manifest operator"),
    rawExecutablePathRetained: false as const,
    rawAdapterBundlePathRetained: false as const,
    rawTaskInputRetained: false as const,
    rawTaskOutputRetained: false as const,
    manifestAuthority: "process-policy-only" as const,
    ...NO_AUTHORITY,
  };
  const manifestFingerprint = sha256(manifestCore);
  const manifest: AsoiafAnswerActorAdapterManifest = {
    ...manifestCore,
    manifestId: collectorContentId("asoiaf-answer-actor-adapter-manifest", {
      adapterId: manifestCore.adapterId,
      adapterVersion: manifestCore.adapterVersion,
      manifestFingerprint,
    }),
    manifestFingerprint,
  };
  const conflicts = readAsoiafAnswerActorAdapterHostStatus(input.root).manifests.filter(
    (entry) => entry.adapterId === manifest.adapterId && entry.adapterVersion === manifest.adapterVersion,
  );
  if (conflicts.length > 0 && !conflicts.some((entry) => stableJson(entry) === stableJson(manifest))) {
    throw new Error("adapter identity and version already have a different manifest");
  }
  const paths = asoiafAnswerActorAdapterHostPaths(input.root);
  const persisted = writeExact(digestPath(paths.manifests, manifestFingerprint), manifest);
  refreshState(input.root);
  return { manifest: persisted.value, replayed: persisted.replayed };
}

export function retainAsoiafAnswerActorAdapterInstallation(
  input: AsoiafAnswerActorAdapterInstallationInput,
): { installation: AsoiafAnswerActorAdapterInstallation; replayed: boolean } {
  const manifest = manifestById(input.root, input.manifestId);
  const executable = fileIdentity(input.executablePath, "adapter executable");
  const bundle = fileIdentity(input.adapterBundlePath, "adapter bundle");
  if (
    executable.digest !== manifest.executableDigest
    || executable.bytes !== manifest.executableBytes
    || bundle.digest !== manifest.adapterBundleDigest
    || bundle.bytes !== manifest.adapterBundleBytes
  ) {
    throw new Error("adapter installation files differ from the retained manifest");
  }
  const installationCore = {
    format: ASOIAF_ANSWER_ACTOR_ADAPTER_INSTALLATION_FORMAT,
    manifestId: manifest.manifestId,
    manifestFingerprint: manifest.manifestFingerprint,
    hostId: requireId(input.hostId, "adapter host identity"),
    platform: process.platform,
    architecture: requireId(process.arch, "adapter host architecture"),
    executablePathDigest: executable.pathDigest,
    executableDigest: executable.digest,
    executableBytes: executable.bytes,
    adapterBundlePathDigest: bundle.pathDigest,
    adapterBundleDigest: bundle.digest,
    adapterBundleBytes: bundle.bytes,
    fixedArgumentsDigest: manifest.fixedArgumentsDigest,
    installedAt: requireTime(input.installedAt, "adapter installation time"),
    operatorId: requireId(input.operatorId, "adapter installation operator"),
    rawExecutablePathRetained: false as const,
    rawAdapterBundlePathRetained: false as const,
    installationAuthority: "host-installation-reference-only" as const,
    ...NO_AUTHORITY,
  };
  const installationFingerprint = sha256(installationCore);
  const installation: AsoiafAnswerActorAdapterInstallation = {
    ...installationCore,
    installationId: collectorContentId("asoiaf-answer-actor-adapter-installation", {
      manifestId: manifest.manifestId,
      hostId: installationCore.hostId,
      installationFingerprint,
    }),
    installationFingerprint,
  };
  const conflicts = readAsoiafAnswerActorAdapterHostStatus(input.root).installations.filter(
    (entry) => entry.manifestId === manifest.manifestId && entry.hostId === installation.hostId,
  );
  if (conflicts.length > 0 && !conflicts.some((entry) => stableJson(entry) === stableJson(installation))) {
    throw new Error("adapter manifest already has a different installation on this host");
  }
  const paths = asoiafAnswerActorAdapterHostPaths(input.root);
  const persisted = writeExact(
    digestPath(paths.installations, installationFingerprint),
    installation,
  );
  refreshState(input.root);
  return { installation: persisted.value, replayed: persisted.replayed };
}

export function prepareAsoiafAnswerActorAdapterInvocation(
  input: AsoiafAnswerActorAdapterPrepareInput,
): { invocation: AsoiafAnswerActorAdapterInvocation; replayed: boolean } {
  const manifest = manifestById(input.root, input.manifestId);
  const installation = installationById(input.root, input.installationId);
  const runtimeIntent = runtimeIntentById(input.root, input.runtimeExecutionIntentId);
  const acceptance = runtimeAcceptanceById(input.root, runtimeIntent.acceptanceId);
  const providerProfile = providerProfileById(input.root, runtimeIntent.providerProfileId);
  const providerResult = providerResultById(input.root, input.providerResultId);
  if (
    installation.manifestId !== manifest.manifestId
    || installation.manifestFingerprint !== manifest.manifestFingerprint
  ) {
    throw new Error("adapter installation differs from the requested manifest");
  }
  if (
    runtimeIntent.adapterId !== manifest.adapterId
    || runtimeIntent.adapterVersion !== manifest.adapterVersion
  ) {
    throw new Error("adapter manifest differs from the runtime execution intent adapter");
  }
  if (
    runtimeIntent.providerProfileId !== providerProfile.profileId
    || runtimeIntent.providerProfileFingerprint !== providerProfile.profileFingerprint
    || providerResult.profileId !== providerProfile.profileId
    || providerResult.profileFingerprint !== providerProfile.profileFingerprint
  ) {
    throw new Error("provider result differs from the runtime execution intent profile");
  }
  if (manifest.allowedResultKinds.some((kind) => !acceptance.acceptedResultKinds.includes(kind))) {
    throw new Error("adapter manifest declares a result kind outside the assignment contract");
  }
  const preparedAt = requireTime(input.preparedAt, "adapter invocation preparation time");
  const expiresAt = requireTime(input.expiresAt, "adapter invocation expiry time");
  if (
    Date.parse(preparedAt) < Date.parse(runtimeIntent.preparedAt)
    || Date.parse(expiresAt) <= Date.parse(preparedAt)
    || Date.parse(expiresAt) > Date.parse(runtimeIntent.expiresAt)
  ) {
    throw new Error("adapter invocation schedule escapes the runtime execution intent interval");
  }
  const invocationCore = {
    format: ASOIAF_ANSWER_ACTOR_ADAPTER_INVOCATION_FORMAT,
    manifestId: manifest.manifestId,
    manifestFingerprint: manifest.manifestFingerprint,
    installationId: installation.installationId,
    installationFingerprint: installation.installationFingerprint,
    runtimeExecutionIntentId: runtimeIntent.executionIntentId,
    runtimeExecutionIntentFingerprint: runtimeIntent.executionIntentFingerprint,
    runtimeAcceptanceId: acceptance.acceptanceId,
    runtimeAcceptanceFingerprint: acceptance.acceptanceFingerprint,
    runtimeSlotId: runtimeIntent.slotId,
    runtimeSlotFingerprint: runtimeIntent.slotFingerprint,
    providerProfileId: providerProfile.profileId,
    providerProfileFingerprint: providerProfile.profileFingerprint,
    providerResultId: providerResult.resultId,
    providerResultFingerprint: providerResult.resultFingerprint,
    adapterId: manifest.adapterId,
    adapterVersion: manifest.adapterVersion,
    inputDigest: runtimeIntent.inputDigest,
    inputBytes: runtimeIntent.inputBytes,
    idempotencyKeyDigest: sha256(requireId(input.idempotencyKey, "adapter invocation idempotency key")),
    preparedAt,
    expiresAt,
    operatorId: requireId(input.operatorId, "adapter invocation operator"),
    rawInputRetained: false as const,
    rawIdempotencyKeyRetained: false as const,
    invocationAuthority: "process-invocation-request-only" as const,
    ...NO_AUTHORITY,
  };
  const invocationFingerprint = sha256(invocationCore);
  const invocation: AsoiafAnswerActorAdapterInvocation = {
    ...invocationCore,
    invocationId: collectorContentId("asoiaf-answer-actor-adapter-invocation", {
      runtimeExecutionIntentId: runtimeIntent.executionIntentId,
      idempotencyKeyDigest: invocationCore.idempotencyKeyDigest,
      invocationFingerprint,
    }),
    invocationFingerprint,
  };
  const conflicts = readAsoiafAnswerActorAdapterHostStatus(input.root).invocations.filter(
    (entry) => entry.runtimeExecutionIntentId === runtimeIntent.executionIntentId
      || entry.idempotencyKeyDigest === invocation.idempotencyKeyDigest,
  );
  if (conflicts.length > 0 && !conflicts.some((entry) => stableJson(entry) === stableJson(invocation))) {
    throw new Error("runtime execution intent or idempotency key already has a different adapter invocation");
  }
  const paths = asoiafAnswerActorAdapterHostPaths(input.root);
  const persisted = writeExact(digestPath(paths.invocations, invocationFingerprint), invocation);
  refreshState(input.root);
  return { invocation: persisted.value, replayed: persisted.replayed };
}

function decodeInput(value: string, manifest: AsoiafAnswerActorAdapterManifest): Buffer {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error("adapter inputBase64 is invalid");
  }
  const buffer = Buffer.from(value, "base64");
  if (buffer.length > manifest.maxInputBytes) {
    throw new Error("adapter input exceeds the manifest input ceiling");
  }
  return buffer;
}

function commandDigest(manifest: AsoiafAnswerActorAdapterManifest): `sha256:${string}` {
  return sha256({
    executableDigest: manifest.executableDigest,
    adapterBundleDigest: manifest.adapterBundleDigest,
    fixedArgumentsDigest: manifest.fixedArgumentsDigest,
    environmentDigest: manifest.environmentDigest,
    shell: manifest.shell,
    inheritEnvironment: manifest.inheritEnvironment,
    workingDirectory: manifest.workingDirectory,
  });
}

function expandedArguments(
  manifest: AsoiafAnswerActorAdapterManifest,
  adapterBundlePath: string,
): string[] {
  return manifest.fixedArgumentTemplate.map((entry) =>
    entry === "{adapterBundle}" ? path.resolve(adapterBundlePath) : entry);
}

function inputEnvelope(
  invocation: AsoiafAnswerActorAdapterInvocation,
  input: Buffer,
): Record<string, unknown> {
  return {
    format: ASOIAF_ANSWER_ACTOR_ADAPTER_INPUT_FORMAT,
    invocationId: invocation.invocationId,
    invocationFingerprint: invocation.invocationFingerprint,
    runtimeExecutionIntentId: invocation.runtimeExecutionIntentId,
    runtimeExecutionIntentFingerprint: invocation.runtimeExecutionIntentFingerprint,
    adapterId: invocation.adapterId,
    adapterVersion: invocation.adapterVersion,
    inputDigest: invocation.inputDigest,
    inputBytes: invocation.inputBytes,
    inputBase64: input.toString("base64"),
  };
}

function findStart(
  root: string,
  invocationId: string,
): AsoiafAnswerActorAdapterStart | null {
  const matches = readAsoiafAnswerActorAdapterHostStatus(root).starts.filter(
    (entry) => entry.invocationId === invocationId,
  );
  if (matches.length > 1) throw new Error("adapter invocation has duplicate start receipts");
  return matches[0] ?? null;
}

function findTerminal(
  root: string,
  invocationId: string,
): AsoiafAnswerActorAdapterTerminal | null {
  const matches = readAsoiafAnswerActorAdapterHostStatus(root).terminals.filter(
    (entry) => entry.invocationId === invocationId,
  );
  if (matches.length > 1) throw new Error("adapter invocation has duplicate terminal receipts");
  return matches[0] ?? null;
}

export function startAsoiafAnswerActorAdapterInvocation(
  input: AsoiafAnswerActorAdapterStartInput,
): {
  start: AsoiafAnswerActorAdapterStart;
  replayed: boolean;
  input: Buffer;
  executablePath: string;
  adapterBundlePath: string;
} {
  const invocation = invocationById(input.root, input.invocationId);
  const manifest = manifestById(input.root, invocation.manifestId);
  const installation = installationById(input.root, invocation.installationId);
  const transient = validateTransientFiles(
    manifest,
    installation,
    input.executablePath,
    input.adapterBundlePath,
  );
  const rawInput = decodeInput(input.inputBase64, manifest);
  const digest = `sha256:${crypto.createHash("sha256").update(rawInput).digest("hex")}` as const;
  if (digest !== invocation.inputDigest || rawInput.length !== invocation.inputBytes) {
    throw new Error("transient adapter input differs from the runtime execution intent digest or byte count");
  }
  const startedAt = requireTime(input.startedAt, "adapter process start time");
  if (
    Date.parse(startedAt) < Date.parse(invocation.preparedAt)
    || Date.parse(startedAt) >= Date.parse(invocation.expiresAt)
  ) {
    throw new Error("adapter process start falls outside the invocation interval");
  }
  const startCore = {
    format: ASOIAF_ANSWER_ACTOR_ADAPTER_START_FORMAT,
    invocationId: invocation.invocationId,
    invocationFingerprint: invocation.invocationFingerprint,
    manifestId: manifest.manifestId,
    manifestFingerprint: manifest.manifestFingerprint,
    installationId: installation.installationId,
    installationFingerprint: installation.installationFingerprint,
    runtimeExecutionIntentId: invocation.runtimeExecutionIntentId,
    runtimeExecutionIntentFingerprint: invocation.runtimeExecutionIntentFingerprint,
    commandDigest: commandDigest(manifest),
    environmentDigest: manifest.environmentDigest,
    inputDigest: invocation.inputDigest,
    inputBytes: invocation.inputBytes,
    startedAt,
    operatorId: requireId(input.operatorId, "adapter start operator"),
    shell: false as const,
    inheritEnvironment: false as const,
    workingDirectory: "ephemeral-empty" as const,
    rawInputRetained: false as const,
    rawExecutablePathRetained: false as const,
    rawAdapterBundlePathRetained: false as const,
    startAuthority: "process-start-observation-only" as const,
    ...NO_AUTHORITY,
  };
  const startFingerprint = sha256(startCore);
  const start: AsoiafAnswerActorAdapterStart = {
    ...startCore,
    startId: collectorContentId("asoiaf-answer-actor-adapter-start", {
      invocationId: invocation.invocationId,
      startFingerprint,
    }),
    startFingerprint,
  };
  const existingStart = findStart(input.root, invocation.invocationId);
  const existingTerminal = findTerminal(input.root, invocation.invocationId);
  if (existingStart) {
    if (stableJson(existingStart) !== stableJson(start)) {
      throw new Error("adapter invocation already has a different start receipt");
    }
    return {
      start: existingStart,
      replayed: true,
      input: rawInput,
      executablePath: transient.executable.path,
      adapterBundlePath: transient.bundle.path,
    };
  }
  if (existingTerminal) {
    throw new Error("completed adapter invocation is missing its retained start receipt");
  }
  const paths = asoiafAnswerActorAdapterHostPaths(input.root);
  const persisted = writeExact(digestPath(paths.starts, startFingerprint), start);
  refreshState(input.root);
  return {
    start: persisted.value,
    replayed: persisted.replayed,
    input: rawInput,
    executablePath: transient.executable.path,
    adapterBundlePath: transient.bundle.path,
  };
}

function parseAdapterEvidence(
  value: Buffer,
  invocation: AsoiafAnswerActorAdapterInvocation,
  manifest: AsoiafAnswerActorAdapterManifest,
  acceptance: AsoiafAnswerActorRuntimeAcceptance,
): AsoiafAnswerActorAdapterEvidence {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value.toString("utf8"));
  } catch {
    throw new Error("adapter stdout is not valid JSON");
  }
  const record = exactObject(parsed, [
    "format",
    "invocationId",
    "invocationFingerprint",
    "runtimeExecutionIntentId",
    "runtimeExecutionIntentFingerprint",
    "adapterId",
    "adapterVersion",
    "resultKind",
    "outputDigest",
    "outputBytes",
    "rawOutputRetained",
    "evidenceAuthority",
  ], "adapter output evidence");
  const resultKind = requireId(String(record.resultKind ?? ""), "adapter output result kind");
  if (
    !manifest.allowedResultKinds.includes(resultKind)
    || !acceptance.acceptedResultKinds.includes(resultKind)
  ) {
    throw new Error("adapter output result kind is outside the manifest or assignment contract");
  }
  const outputBytes = requireInteger(
    Number(record.outputBytes),
    "adapter output byte count",
    1,
    MAX_STREAM_BYTES,
  );
  const evidence: AsoiafAnswerActorAdapterEvidence = {
    format: record.format as typeof ASOIAF_ANSWER_ACTOR_ADAPTER_OUTPUT_FORMAT,
    invocationId: String(record.invocationId ?? ""),
    invocationFingerprint: requireDigest(
      String(record.invocationFingerprint ?? ""),
      "adapter output invocation fingerprint",
    ),
    runtimeExecutionIntentId: String(record.runtimeExecutionIntentId ?? ""),
    runtimeExecutionIntentFingerprint: requireDigest(
      String(record.runtimeExecutionIntentFingerprint ?? ""),
      "adapter output runtime execution fingerprint",
    ),
    adapterId: String(record.adapterId ?? ""),
    adapterVersion: String(record.adapterVersion ?? ""),
    resultKind,
    outputDigest: requireDigest(String(record.outputDigest ?? ""), "adapter output digest"),
    outputBytes,
    rawOutputRetained: record.rawOutputRetained as false,
    evidenceAuthority: record.evidenceAuthority as "digest-evidence-only",
  };
  if (
    evidence.format !== ASOIAF_ANSWER_ACTOR_ADAPTER_OUTPUT_FORMAT
    || evidence.invocationId !== invocation.invocationId
    || evidence.invocationFingerprint !== invocation.invocationFingerprint
    || evidence.runtimeExecutionIntentId !== invocation.runtimeExecutionIntentId
    || evidence.runtimeExecutionIntentFingerprint !== invocation.runtimeExecutionIntentFingerprint
    || evidence.adapterId !== invocation.adapterId
    || evidence.adapterVersion !== invocation.adapterVersion
    || evidence.rawOutputRetained !== false
    || evidence.evidenceAuthority !== "digest-evidence-only"
  ) {
    throw new Error("adapter output evidence differs from invocation custody");
  }
  return evidence;
}

async function runProcess(input: {
  executablePath: string;
  arguments: string[];
  environment: Record<string, string>;
  cwd: string;
  stdin: Buffer;
  timeoutMilliseconds: number;
  maxStdoutBytes: number;
  maxStderrBytes: number;
}): Promise<ProcessRunResult> {
  return await new Promise<ProcessRunResult>((resolve) => {
    const stdoutHash = crypto.createHash("sha256");
    const stderrHash = crypto.createHash("sha256");
    const stdoutChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;
    let outputLimitExceeded = false;
    let spawnError: string | null = null;
    let settled = false;
    let timer: NodeJS.Timeout | null = null;
    const child = spawn(input.executablePath, input.arguments, {
      cwd: input.cwd,
      env: input.environment,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const finish = (exitCode: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({
        exitCode,
        signal,
        stdoutDigest: `sha256:${stdoutHash.digest("hex")}`,
        stdoutBytes,
        stderrDigest: `sha256:${stderrHash.digest("hex")}`,
        stderrBytes,
        stdoutBuffer: Buffer.concat(stdoutChunks),
        timedOut,
        outputLimitExceeded,
        spawnError,
        completedAt: new Date().toISOString(),
      });
    };
    child.stdout.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      stdoutHash.update(buffer);
      stdoutBytes += buffer.length;
      if (stdoutBytes <= input.maxStdoutBytes) stdoutChunks.push(buffer);
      else if (!outputLimitExceeded) {
        outputLimitExceeded = true;
        child.kill("SIGKILL");
      }
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      stderrHash.update(buffer);
      stderrBytes += buffer.length;
      if (stderrBytes > input.maxStderrBytes && !outputLimitExceeded) {
        outputLimitExceeded = true;
        child.kill("SIGKILL");
      }
    });
    child.on("error", (error) => {
      spawnError = error.message;
      finish(null, null);
    });
    child.on("close", (code, signal) => finish(code, signal));
    timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, input.timeoutMilliseconds);
    child.stdin.on("error", () => undefined);
    child.stdin.end(input.stdin);
  });
}

function buildTerminal(input: {
  invocation: AsoiafAnswerActorAdapterInvocation;
  start: AsoiafAnswerActorAdapterStart;
  outcome: AsoiafAnswerActorAdapterTerminalOutcome;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  completedAt: string;
  stdoutDigest: `sha256:${string}`;
  stdoutBytes: number;
  stderrDigest: `sha256:${string}`;
  stderrBytes: number;
  evidence: AsoiafAnswerActorAdapterEvidence | null;
  recoveryReason: string | null;
  processLaunched: boolean;
  timedOut: boolean;
  outputLimitExceeded: boolean;
}): AsoiafAnswerActorAdapterTerminal {
  const completedAt = requireTime(input.completedAt, "adapter terminal completion time");
  const durationMilliseconds = Math.max(
    0,
    Date.parse(completedAt) - Date.parse(input.start.startedAt),
  );
  const terminalCore = {
    format: ASOIAF_ANSWER_ACTOR_ADAPTER_TERMINAL_FORMAT,
    startId: input.start.startId,
    startFingerprint: input.start.startFingerprint,
    invocationId: input.invocation.invocationId,
    invocationFingerprint: input.invocation.invocationFingerprint,
    manifestId: input.invocation.manifestId,
    manifestFingerprint: input.invocation.manifestFingerprint,
    installationId: input.invocation.installationId,
    installationFingerprint: input.invocation.installationFingerprint,
    runtimeExecutionIntentId: input.invocation.runtimeExecutionIntentId,
    runtimeExecutionIntentFingerprint: input.invocation.runtimeExecutionIntentFingerprint,
    providerResultId: input.invocation.providerResultId,
    providerResultFingerprint: input.invocation.providerResultFingerprint,
    outcome: input.outcome,
    exitCode: input.exitCode,
    signal: input.signal,
    startedAt: input.start.startedAt,
    completedAt,
    durationMilliseconds,
    stdoutDigest: input.stdoutDigest,
    stdoutBytes: input.stdoutBytes,
    stderrDigest: input.stderrDigest,
    stderrBytes: input.stderrBytes,
    adapterEvidence: input.evidence,
    recoveryReason: input.recoveryReason,
    processLaunched: input.processLaunched,
    timedOut: input.timedOut,
    outputLimitExceeded: input.outputLimitExceeded,
    rawInputRetained: false as const,
    rawStdoutRetained: false as const,
    rawStderrRetained: false as const,
    rawTaskOutputRetained: false as const,
    taskOutcomeDeclared: false as const,
    osIsolationEnforced: false as const,
    terminalAuthority: "process-observation-only" as const,
    ...NO_AUTHORITY,
  };
  const terminalFingerprint = sha256(terminalCore);
  return {
    ...terminalCore,
    terminalId: collectorContentId("asoiaf-answer-actor-adapter-terminal", {
      invocationId: input.invocation.invocationId,
      terminalFingerprint,
    }),
    terminalFingerprint,
  };
}

function persistTerminal(
  root: string,
  terminal: AsoiafAnswerActorAdapterTerminal,
): { terminal: AsoiafAnswerActorAdapterTerminal; replayed: boolean } {
  const existing = findTerminal(root, terminal.invocationId);
  if (existing && stableJson(existing) !== stableJson(terminal)) {
    throw new Error("adapter invocation already has a different terminal receipt");
  }
  const paths = asoiafAnswerActorAdapterHostPaths(root);
  const persisted = writeExact(
    digestPath(paths.terminals, terminal.terminalFingerprint),
    terminal,
  );
  const terminals = readAsoiafAnswerActorAdapterHostStatus(root).terminals.filter(
    (entry) => entry.invocationId === terminal.invocationId,
  );
  if (terminals.length !== 1) throw new Error("adapter invocation acquired multiple terminal receipts");
  refreshState(root);
  return { terminal: persisted.value, replayed: persisted.replayed };
}

export async function executeAsoiafAnswerActorAdapterInvocation(
  input: AsoiafAnswerActorAdapterExecuteInput,
): Promise<{
  start: AsoiafAnswerActorAdapterStart;
  terminal: AsoiafAnswerActorAdapterTerminal;
  startReplayed: boolean;
  terminalReplayed: boolean;
  processLaunched: boolean;
}> {
  const invocation = invocationById(input.root, input.invocationId);
  const manifest = manifestById(input.root, invocation.manifestId);
  const installation = installationById(input.root, invocation.installationId);
  const acceptance = runtimeAcceptanceById(input.root, invocation.runtimeAcceptanceId);
  const existingTerminal = findTerminal(input.root, invocation.invocationId);
  const started = startAsoiafAnswerActorAdapterInvocation(input);
  if (existingTerminal) {
    return {
      start: started.start,
      terminal: existingTerminal,
      startReplayed: true,
      terminalReplayed: true,
      processLaunched: false,
    };
  }
  if (started.replayed) {
    throw new Error("adapter invocation has a retained start without a terminal; recover it before retrying execution");
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-actor-adapter-"));
  try {
    const envelope = Buffer.from(
      `${JSON.stringify(inputEnvelope(invocation, started.input))}\n`,
      "utf8",
    );
    const run = await runProcess({
      executablePath: started.executablePath,
      arguments: expandedArguments(manifest, started.adapterBundlePath),
      environment: manifest.fixedEnvironment,
      cwd: temporary,
      stdin: envelope,
      timeoutMilliseconds: Math.max(
        1,
        Math.min(
          manifest.timeoutMilliseconds,
          Date.parse(invocation.expiresAt) - Date.parse(started.start.startedAt),
        ),
      ),
      maxStdoutBytes: manifest.maxStdoutBytes,
      maxStderrBytes: manifest.maxStderrBytes,
    });
    let outcome: AsoiafAnswerActorAdapterTerminalOutcome;
    let evidence: AsoiafAnswerActorAdapterEvidence | null = null;
    let recoveryReason: string | null = null;
    if (run.timedOut) {
      outcome = "timed-out";
      recoveryReason = "adapter process exceeded the manifest timeout";
    } else if (run.outputLimitExceeded) {
      outcome = "protocol-refused";
      recoveryReason = "adapter process exceeded a retained stream ceiling";
    } else if (run.spawnError) {
      outcome = "failed";
      recoveryReason = `adapter process could not start: ${run.spawnError}`;
    } else if (run.exitCode !== 0) {
      outcome = "failed";
      recoveryReason = `adapter process exited with code ${run.exitCode ?? "null"}`;
    } else {
      try {
        evidence = parseAdapterEvidence(
          run.stdoutBuffer,
          invocation,
          manifest,
          acceptance,
        );
        outcome = "succeeded";
      } catch (error) {
        outcome = "protocol-refused";
        recoveryReason = error instanceof Error ? error.message : String(error);
      }
    }
    const terminal = buildTerminal({
      invocation,
      start: started.start,
      outcome,
      exitCode: run.exitCode,
      signal: run.signal,
      completedAt: run.completedAt,
      stdoutDigest: run.stdoutDigest,
      stdoutBytes: run.stdoutBytes,
      stderrDigest: run.stderrDigest,
      stderrBytes: run.stderrBytes,
      evidence,
      recoveryReason,
      processLaunched: true,
      timedOut: run.timedOut,
      outputLimitExceeded: run.outputLimitExceeded,
    });
    const persisted = persistTerminal(input.root, terminal);
    return {
      start: started.start,
      terminal: persisted.terminal,
      startReplayed: false,
      terminalReplayed: persisted.replayed,
      processLaunched: true,
    };
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

export function recoverAsoiafAnswerActorAdapterInvocation(
  input: AsoiafAnswerActorAdapterRecoverInput,
): {
  terminal: AsoiafAnswerActorAdapterTerminal;
  replayed: boolean;
} {
  const invocation = invocationById(input.root, input.invocationId);
  const start = findStart(input.root, invocation.invocationId);
  if (!start) throw new Error("adapter invocation has no retained start to recover");
  const existing = findTerminal(input.root, invocation.invocationId);
  if (existing) {
    if (existing.outcome !== "interrupted") {
      throw new Error("adapter invocation already has a non-interrupted terminal receipt");
    }
    return { terminal: existing, replayed: true };
  }
  const recoveredAt = requireTime(input.recoveredAt, "adapter recovery time");
  if (Date.parse(recoveredAt) < Date.parse(start.startedAt)) {
    throw new Error("adapter recovery precedes the retained process start");
  }
  const terminal = buildTerminal({
    invocation,
    start,
    outcome: "interrupted",
    exitCode: null,
    signal: null,
    completedAt: recoveredAt,
    stdoutDigest: EMPTY_DIGEST,
    stdoutBytes: 0,
    stderrDigest: EMPTY_DIGEST,
    stderrBytes: 0,
    evidence: null,
    recoveryReason: requireReason(input.reason, "adapter recovery reason"),
    processLaunched: false,
    timedOut: false,
    outputLimitExceeded: false,
  });
  const persisted = persistTerminal(input.root, terminal);
  return { terminal: persisted.terminal, replayed: persisted.replayed };
}

function noAuthorityValid(value: NoAuthority): boolean {
  return value.authority === "none"
    && value.graphEffect === "none"
    && value.canonEffect === "none"
    && value.answerEffect === "none";
}

function verifyDigestDirectory(input: {
  directory: string;
  expected: Set<string>;
  code: string;
}): AsoiafAnswerActorAdapterFinding[] {
  const findings: AsoiafAnswerActorAdapterFinding[] = [];
  if (!fs.existsSync(input.directory)) return findings;
  for (const name of fs.readdirSync(input.directory).sort()) {
    if (!/^[a-f0-9]{64}\.json$/.test(name)) {
      findings.push(finding(`${input.code}-unsafe-name`, "error", name, "adapter directory contains a non-digest JSON filename"));
    } else if (!input.expected.has(name)) {
      findings.push(finding(`${input.code}-orphan-name`, "error", name, "adapter filename does not match reconstructed custody"));
    }
  }
  return findings;
}

function secretFindings(root: string): AsoiafAnswerActorAdapterFinding[] {
  const findings: AsoiafAnswerActorAdapterFinding[] = [];
  const hostRoot = asoiafAnswerActorAdapterHostPaths(root).hostRoot;
  if (!fs.existsSync(hostRoot)) return findings;
  const directories = [hostRoot];
  const pattern = /BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY|BEGIN CERTIFICATE(?: REQUEST)?|pkcs11:[^\s"']+|provider(?:Pin|Password|Token|Secret|Session)\s*["=:]/i;
  while (directories.length > 0) {
    const directory = directories.pop()!;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        directories.push(target);
      } else {
        if (/\.(?:key|crt|cer|pem|csr|p12|pfx)$/i.test(entry.name)) {
          findings.push(finding("adapter-secret-path", "error", target, "adapter estate retained a credential-bearing path"));
        }
        if (fs.statSync(target).size <= 2_000_000 && pattern.test(fs.readFileSync(target, "utf8"))) {
          findings.push(finding("adapter-secret-content", "error", target, "adapter estate retained credential or provider-secret content"));
        }
      }
    }
  }
  return findings;
}

function checkObjectAuthority(
  value: NoAuthority,
  subjectId: string,
  findings: AsoiafAnswerActorAdapterFinding[],
): void {
  if (!noAuthorityValid(value)) {
    findings.push(finding("adapter-authority", "error", subjectId, "adapter object crossed task, graph, canon, or answer authority"));
  }
}

export function verifyAsoiafAnswerActorAdapterHostEstate(
  root: string,
): AsoiafAnswerActorAdapterFinding[] {
  const findings: AsoiafAnswerActorAdapterFinding[] = [];
  for (const parent of verifyAsoiafAnswerActorRuntimeEstate(root)) {
    findings.push(finding(`runtime:${parent.code}`, parent.severity, parent.subjectId, parent.detail));
  }
  for (const parent of verifyAsoiafAnswerCredentialProviderHostEstate(root)) {
    findings.push(finding(`provider:${parent.code}`, parent.severity, parent.subjectId, parent.detail));
  }
  let status: AsoiafAnswerActorAdapterStatus;
  try {
    status = readAsoiafAnswerActorAdapterHostStatus(root);
  } catch (error) {
    return sortedFindings([
      ...findings,
      finding(
        "adapter-estate-read",
        "error",
        path.resolve(root),
        error instanceof Error ? error.message : String(error),
      ),
    ]);
  }
  const runtime = readAsoiafAnswerActorRuntimeStatus(root);
  const provider = readAsoiafAnswerCredentialProviderStatus(root);

  const duplicate = <T>(
    values: readonly T[],
    identity: (value: T) => string,
    code: string,
  ) => {
    const seen = new Set<string>();
    for (const value of values) {
      const id = identity(value);
      if (seen.has(id)) findings.push(finding(code, "error", id, "adapter object identity is duplicated"));
      seen.add(id);
    }
  };
  duplicate(status.manifests, (entry) => entry.manifestId, "adapter-manifest-duplicate");
  duplicate(status.installations, (entry) => entry.installationId, "adapter-installation-duplicate");
  duplicate(status.invocations, (entry) => entry.invocationId, "adapter-invocation-duplicate");
  duplicate(status.starts, (entry) => entry.startId, "adapter-start-duplicate");
  duplicate(status.terminals, (entry) => entry.terminalId, "adapter-terminal-duplicate");

  for (const manifest of status.manifests) {
    if (
      manifest.format !== ASOIAF_ANSWER_ACTOR_ADAPTER_MANIFEST_FORMAT
      || !fingerprintMatches(
        manifest as unknown as Record<string, unknown>,
        "manifestId",
        "manifestFingerprint",
      )
    ) {
      findings.push(finding("adapter-manifest-fingerprint", "error", manifest.manifestId, "adapter manifest format or fingerprint is stale"));
    }
    if (
      manifest.fixedArgumentsDigest !== sha256(manifest.fixedArgumentTemplate)
      || manifest.environmentDigest !== sha256(manifest.fixedEnvironment)
      || manifest.fixedArgumentTemplate.filter((entry) => entry === "{adapterBundle}").length !== 1
      || manifest.allowedResultKinds.length === 0
      || manifest.allowedResultKinds.length !== new Set(manifest.allowedResultKinds).size
    ) {
      findings.push(finding("adapter-manifest-policy", "error", manifest.manifestId, "adapter manifest arguments, environment, or result kinds are inconsistent"));
    }
    if (
      manifest.shell !== false
      || manifest.inheritEnvironment !== false
      || manifest.workingDirectory !== "ephemeral-empty"
      || manifest.declaredNetworkAccess !== "none"
      || manifest.declaredChildProcessAccess !== "none"
      || manifest.osIsolationEnforced !== false
    ) {
      findings.push(finding("adapter-manifest-boundary", "error", manifest.manifestId, "adapter manifest exceeds the v1 host boundary"));
    }
    if (
      manifest.rawExecutablePathRetained
      || manifest.rawAdapterBundlePathRetained
      || manifest.rawTaskInputRetained
      || manifest.rawTaskOutputRetained
    ) {
      findings.push(finding("adapter-manifest-retention", "error", manifest.manifestId, "adapter manifest retained a path or task payload"));
    }
    checkObjectAuthority(manifest, manifest.manifestId, findings);
  }

  for (const installation of status.installations) {
    const manifest = status.manifests.find((entry) => entry.manifestId === installation.manifestId);
    if (
      installation.format !== ASOIAF_ANSWER_ACTOR_ADAPTER_INSTALLATION_FORMAT
      || !fingerprintMatches(
        installation as unknown as Record<string, unknown>,
        "installationId",
        "installationFingerprint",
      )
    ) {
      findings.push(finding("adapter-installation-fingerprint", "error", installation.installationId, "adapter installation format or fingerprint is stale"));
    }
    if (
      !manifest
      || manifest.manifestFingerprint !== installation.manifestFingerprint
      || manifest.executableDigest !== installation.executableDigest
      || manifest.executableBytes !== installation.executableBytes
      || manifest.adapterBundleDigest !== installation.adapterBundleDigest
      || manifest.adapterBundleBytes !== installation.adapterBundleBytes
      || manifest.fixedArgumentsDigest !== installation.fixedArgumentsDigest
    ) {
      findings.push(finding("adapter-installation-parent", "error", installation.installationId, "adapter installation differs from manifest custody"));
    }
    if (installation.rawExecutablePathRetained || installation.rawAdapterBundlePathRetained) {
      findings.push(finding("adapter-installation-retention", "error", installation.installationId, "adapter installation retained a raw path"));
    }
    checkObjectAuthority(installation, installation.installationId, findings);
  }

  const invocationIntentIds = new Set<string>();
  const invocationKeyDigests = new Set<string>();
  for (const invocation of status.invocations) {
    if (
      invocation.format !== ASOIAF_ANSWER_ACTOR_ADAPTER_INVOCATION_FORMAT
      || !fingerprintMatches(
        invocation as unknown as Record<string, unknown>,
        "invocationId",
        "invocationFingerprint",
      )
    ) {
      findings.push(finding("adapter-invocation-fingerprint", "error", invocation.invocationId, "adapter invocation format or fingerprint is stale"));
    }
    if (invocationIntentIds.has(invocation.runtimeExecutionIntentId)) {
      findings.push(finding("adapter-invocation-intent-duplicate", "error", invocation.invocationId, "runtime execution intent has multiple adapter invocations"));
    }
    invocationIntentIds.add(invocation.runtimeExecutionIntentId);
    if (invocationKeyDigests.has(invocation.idempotencyKeyDigest)) {
      findings.push(finding("adapter-invocation-key-duplicate", "error", invocation.invocationId, "adapter idempotency digest is reused"));
    }
    invocationKeyDigests.add(invocation.idempotencyKeyDigest);
    const manifest = status.manifests.find((entry) => entry.manifestId === invocation.manifestId);
    const installation = status.installations.find((entry) => entry.installationId === invocation.installationId);
    const intent = runtime.executionIntents.find((entry) => entry.executionIntentId === invocation.runtimeExecutionIntentId);
    const acceptance = runtime.acceptances.find((entry) => entry.acceptanceId === invocation.runtimeAcceptanceId);
    const providerResult = provider.results.find((entry) => entry.resultId === invocation.providerResultId);
    if (
      !manifest
      || !installation
      || !intent
      || !acceptance
      || !providerResult
      || manifest.manifestFingerprint !== invocation.manifestFingerprint
      || installation.installationFingerprint !== invocation.installationFingerprint
      || installation.manifestId !== manifest.manifestId
      || intent.executionIntentFingerprint !== invocation.runtimeExecutionIntentFingerprint
      || intent.acceptanceId !== acceptance.acceptanceId
      || acceptance.acceptanceFingerprint !== invocation.runtimeAcceptanceFingerprint
      || intent.slotId !== invocation.runtimeSlotId
      || intent.slotFingerprint !== invocation.runtimeSlotFingerprint
      || intent.providerProfileId !== invocation.providerProfileId
      || intent.providerProfileFingerprint !== invocation.providerProfileFingerprint
      || providerResult.resultFingerprint !== invocation.providerResultFingerprint
      || providerResult.profileId !== invocation.providerProfileId
      || providerResult.profileFingerprint !== invocation.providerProfileFingerprint
      || intent.adapterId !== invocation.adapterId
      || intent.adapterVersion !== invocation.adapterVersion
      || intent.inputDigest !== invocation.inputDigest
      || intent.inputBytes !== invocation.inputBytes
      || Date.parse(invocation.expiresAt) > Date.parse(intent.expiresAt)
    ) {
      findings.push(finding("adapter-invocation-parent", "error", invocation.invocationId, "adapter invocation differs from manifest, installation, runtime, or provider custody"));
    }
    if (invocation.rawInputRetained || invocation.rawIdempotencyKeyRetained) {
      findings.push(finding("adapter-invocation-retention", "error", invocation.invocationId, "adapter invocation retained raw input or idempotency key"));
    }
    checkObjectAuthority(invocation, invocation.invocationId, findings);
  }

  const startInvocations = new Set<string>();
  for (const start of status.starts) {
    if (
      start.format !== ASOIAF_ANSWER_ACTOR_ADAPTER_START_FORMAT
      || !fingerprintMatches(
        start as unknown as Record<string, unknown>,
        "startId",
        "startFingerprint",
      )
    ) {
      findings.push(finding("adapter-start-fingerprint", "error", start.startId, "adapter start format or fingerprint is stale"));
    }
    if (startInvocations.has(start.invocationId)) {
      findings.push(finding("adapter-start-invocation-duplicate", "error", start.startId, "adapter invocation has multiple starts"));
    }
    startInvocations.add(start.invocationId);
    const invocation = status.invocations.find((entry) => entry.invocationId === start.invocationId);
    const manifest = invocation
      ? status.manifests.find((entry) => entry.manifestId === invocation.manifestId)
      : null;
    if (
      !invocation
      || !manifest
      || invocation.invocationFingerprint !== start.invocationFingerprint
      || invocation.manifestId !== start.manifestId
      || invocation.manifestFingerprint !== start.manifestFingerprint
      || invocation.installationId !== start.installationId
      || invocation.installationFingerprint !== start.installationFingerprint
      || invocation.runtimeExecutionIntentId !== start.runtimeExecutionIntentId
      || invocation.runtimeExecutionIntentFingerprint !== start.runtimeExecutionIntentFingerprint
      || invocation.inputDigest !== start.inputDigest
      || invocation.inputBytes !== start.inputBytes
      || manifest.environmentDigest !== start.environmentDigest
      || commandDigest(manifest) !== start.commandDigest
      || Date.parse(start.startedAt) < Date.parse(invocation.preparedAt)
      || Date.parse(start.startedAt) >= Date.parse(invocation.expiresAt)
    ) {
      findings.push(finding("adapter-start-parent", "error", start.startId, "adapter start differs from invocation or command custody"));
    }
    if (start.rawInputRetained || start.rawExecutablePathRetained || start.rawAdapterBundlePathRetained) {
      findings.push(finding("adapter-start-retention", "error", start.startId, "adapter start retained raw input or paths"));
    }
    checkObjectAuthority(start, start.startId, findings);
  }

  const terminalInvocations = new Set<string>();
  for (const terminal of status.terminals) {
    if (
      terminal.format !== ASOIAF_ANSWER_ACTOR_ADAPTER_TERMINAL_FORMAT
      || !fingerprintMatches(
        terminal as unknown as Record<string, unknown>,
        "terminalId",
        "terminalFingerprint",
      )
    ) {
      findings.push(finding("adapter-terminal-fingerprint", "error", terminal.terminalId, "adapter terminal format or fingerprint is stale"));
    }
    if (terminalInvocations.has(terminal.invocationId)) {
      findings.push(finding("adapter-terminal-invocation-duplicate", "error", terminal.terminalId, "adapter invocation has multiple terminals"));
    }
    terminalInvocations.add(terminal.invocationId);
    const invocation = status.invocations.find((entry) => entry.invocationId === terminal.invocationId);
    const start = status.starts.find((entry) => entry.startId === terminal.startId);
    const manifest = invocation
      ? status.manifests.find((entry) => entry.manifestId === invocation.manifestId)
      : null;
    const acceptance = invocation
      ? runtime.acceptances.find((entry) => entry.acceptanceId === invocation.runtimeAcceptanceId)
      : null;
    if (
      !invocation
      || !start
      || !manifest
      || !acceptance
      || start.startFingerprint !== terminal.startFingerprint
      || invocation.invocationFingerprint !== terminal.invocationFingerprint
      || invocation.manifestId !== terminal.manifestId
      || invocation.manifestFingerprint !== terminal.manifestFingerprint
      || invocation.installationId !== terminal.installationId
      || invocation.installationFingerprint !== terminal.installationFingerprint
      || invocation.runtimeExecutionIntentId !== terminal.runtimeExecutionIntentId
      || invocation.runtimeExecutionIntentFingerprint !== terminal.runtimeExecutionIntentFingerprint
      || invocation.providerResultId !== terminal.providerResultId
      || invocation.providerResultFingerprint !== terminal.providerResultFingerprint
      || terminal.startedAt !== start.startedAt
      || Date.parse(terminal.completedAt) < Date.parse(start.startedAt)
      || (terminal.outcome === "succeeded"
        && Date.parse(terminal.completedAt) > Date.parse(invocation.expiresAt))
      || terminal.durationMilliseconds !== Math.max(0, Date.parse(terminal.completedAt) - Date.parse(start.startedAt))
    ) {
      findings.push(finding("adapter-terminal-parent", "error", terminal.terminalId, "adapter terminal differs from start or invocation custody"));
    }
    if (terminal.outcome === "succeeded") {
      const evidence = terminal.adapterEvidence;
      if (
        !evidence
        || !invocation
        || !manifest
        || !acceptance
        || evidence.format !== ASOIAF_ANSWER_ACTOR_ADAPTER_OUTPUT_FORMAT
        || evidence.invocationId !== invocation.invocationId
        || evidence.invocationFingerprint !== invocation.invocationFingerprint
        || evidence.runtimeExecutionIntentId !== invocation.runtimeExecutionIntentId
        || evidence.runtimeExecutionIntentFingerprint !== invocation.runtimeExecutionIntentFingerprint
        || evidence.adapterId !== manifest.adapterId
        || evidence.adapterVersion !== manifest.adapterVersion
        || !manifest.allowedResultKinds.includes(evidence.resultKind)
        || !acceptance.acceptedResultKinds.includes(evidence.resultKind)
        || evidence.rawOutputRetained
        || evidence.evidenceAuthority !== "digest-evidence-only"
      ) {
        findings.push(finding("adapter-terminal-evidence", "error", terminal.terminalId, "successful adapter terminal lacks exact digest evidence"));
      }
    } else if (terminal.adapterEvidence !== null) {
      findings.push(finding("adapter-terminal-failure-evidence", "error", terminal.terminalId, "non-successful adapter terminal retained success evidence"));
    }
    if (terminal.outcome === "interrupted" && terminal.processLaunched) {
      findings.push(finding("adapter-terminal-interrupted-launch", "error", terminal.terminalId, "recovered interrupted terminal claims a process launch"));
    }
    if (
      terminal.rawInputRetained
      || terminal.rawStdoutRetained
      || terminal.rawStderrRetained
      || terminal.rawTaskOutputRetained
      || terminal.taskOutcomeDeclared
      || terminal.osIsolationEnforced
    ) {
      findings.push(finding("adapter-terminal-retention", "error", terminal.terminalId, "adapter terminal crossed retention, task-outcome, or isolation evidence boundary"));
    }
    if (invocation) {
      const runtimeResult = runtime.results.find(
        (entry) => entry.executionIntentId === invocation.runtimeExecutionIntentId,
      ) ?? null;
      if (terminal.outcome === "succeeded" && terminal.adapterEvidence) {
        if (!runtimeResult) {
          findings.push(finding("adapter-terminal-awaiting-runtime-result", "notice", terminal.terminalId, "successful process evidence has not yet been admitted as a typed runtime result"));
        } else if (
          runtimeResult.providerResultId !== invocation.providerResultId
          || runtimeResult.providerResultFingerprint !== invocation.providerResultFingerprint
          || runtimeResult.outputDigest !== terminal.adapterEvidence.outputDigest
          || runtimeResult.outputBytes !== terminal.adapterEvidence.outputBytes
          || Date.parse(runtimeResult.completedAt) < Date.parse(terminal.completedAt)
        ) {
          findings.push(finding("adapter-terminal-runtime-result", "error", terminal.terminalId, "typed runtime result differs from adapter process evidence"));
        }
      } else if (runtimeResult) {
        findings.push(finding("adapter-terminal-runtime-contradiction", "error", terminal.terminalId, "runtime retained a typed result for a non-successful adapter process"));
      }
    }
    checkObjectAuthority(terminal, terminal.terminalId, findings);
  }

  for (const start of status.starts) {
    if (!status.terminals.some((entry) => entry.invocationId === start.invocationId)) {
      findings.push(finding("adapter-start-incomplete", "warning", start.startId, "adapter start has no retained terminal receipt and requires recovery"));
    }
  }
  for (const invocation of status.invocations) {
    if (!status.starts.some((entry) => entry.invocationId === invocation.invocationId)) {
      findings.push(finding("adapter-invocation-pending", "notice", invocation.invocationId, "adapter invocation is prepared but has not started"));
    }
  }

  const expectedState = buildState(root);
  if (stableJson(status.state) !== stableJson(expectedState)) {
    findings.push(finding("adapter-state-projection", "error", status.paths.state, "adapter state differs from deterministic projection"));
  }
  if (status.state && !fingerprintMatches(
    status.state as unknown as Record<string, unknown>,
    "stateId",
    "stateFingerprint",
  )) {
    findings.push(finding("adapter-state-fingerprint", "error", status.state.stateId, "adapter state fingerprint is stale"));
  }

  findings.push(...verifyDigestDirectory({
    directory: status.paths.manifests,
    expected: new Set(status.manifests.map((entry) => `${entry.manifestFingerprint.slice("sha256:".length)}.json`)),
    code: "adapter-manifest-name",
  }));
  findings.push(...verifyDigestDirectory({
    directory: status.paths.installations,
    expected: new Set(status.installations.map((entry) => `${entry.installationFingerprint.slice("sha256:".length)}.json`)),
    code: "adapter-installation-name",
  }));
  findings.push(...verifyDigestDirectory({
    directory: status.paths.invocations,
    expected: new Set(status.invocations.map((entry) => `${entry.invocationFingerprint.slice("sha256:".length)}.json`)),
    code: "adapter-invocation-name",
  }));
  findings.push(...verifyDigestDirectory({
    directory: status.paths.starts,
    expected: new Set(status.starts.map((entry) => `${entry.startFingerprint.slice("sha256:".length)}.json`)),
    code: "adapter-start-name",
  }));
  findings.push(...verifyDigestDirectory({
    directory: status.paths.terminals,
    expected: new Set(status.terminals.map((entry) => `${entry.terminalFingerprint.slice("sha256:".length)}.json`)),
    code: "adapter-terminal-name",
  }));
  findings.push(...secretFindings(root));
  return sortedFindings(findings);
}
