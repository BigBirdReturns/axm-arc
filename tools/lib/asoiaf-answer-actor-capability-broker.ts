import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  collectorContentId,
  sha256,
} from "./asoiaf-external-estate.js";
import {
  ASOIAF_ANSWER_ACTOR_ADAPTER_INPUT_FORMAT,
  ASOIAF_ANSWER_ACTOR_ADAPTER_OUTPUT_FORMAT,
  readAsoiafAnswerActorAdapterHostStatus,
  verifyAsoiafAnswerActorAdapterHostEstate,
  type AsoiafAnswerActorAdapterEvidence,
  type AsoiafAnswerActorAdapterInstallation,
  type AsoiafAnswerActorAdapterInvocation,
  type AsoiafAnswerActorAdapterManifest,
} from "./asoiaf-answer-actor-adapter-host.js";
import {
  readAsoiafAnswerActorRuntimeStatus,
  type AsoiafAnswerActorRuntimeAcceptance,
} from "./asoiaf-answer-actor-runtime.js";

export const ASOIAF_ANSWER_ACTOR_CAPABILITY_POLICY_FORMAT =
  "axm-asoiaf-answer-actor-capability-policy/1" as const;
export const ASOIAF_ANSWER_ACTOR_CAPABILITY_START_FORMAT =
  "axm-asoiaf-answer-actor-capability-start/1" as const;
export const ASOIAF_ANSWER_ACTOR_CAPABILITY_TERMINAL_FORMAT =
  "axm-asoiaf-answer-actor-capability-terminal/1" as const;
export const ASOIAF_ANSWER_ACTOR_CAPABILITY_STATE_FORMAT =
  "axm-asoiaf-answer-actor-capability-state/1" as const;
export const ASOIAF_ANSWER_ACTOR_ISOLATION_RECEIPT_FORMAT =
  "axm-asoiaf-answer-actor-isolation-receipt/1" as const;

const MAX_FILE_BYTES = 128 * 1024 * 1024;
const MAX_STREAM_BYTES = 16 * 1024 * 1024;
const MIN_LANDLOCK_ABI = 3;
const ADDRESS_SPACE_LIMIT_BYTES = 4 * 1024 * 1024 * 1024;
const MIN_FILE_SIZE_LIMIT_BYTES = 1024 * 1024;
const OPEN_FILE_LIMIT = 64;
const MAX_ATTESTATION_BYTES = 4096;
const COMPILER_ARGUMENTS = [
  "-O2",
  "-std=c11",
  "-fstack-protector-strong",
  "-D_FORTIFY_SOURCE=2",
  "-Wall",
  "-Wextra",
  "-Werror",
] as const;
const COMPILER_ENVIRONMENT = {
  LANG: "C.UTF-8",
  LC_ALL: "C.UTF-8",
  PATH: "/usr/bin:/bin",
  TZ: "UTC",
} as const;
const EMPTY_DIGEST: `sha256:${string}` = rawDigest(Buffer.alloc(0));

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

export interface AsoiafAnswerActorCapabilityBrokerPaths {
  root: string;
  brokerRoot: string;
  policies: string;
  starts: string;
  terminals: string;
  state: string;
}

export interface AsoiafAnswerActorCapabilityPolicy extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_CAPABILITY_POLICY_FORMAT;
  policyId: string;
  policyFingerprint: `sha256:${string}`;
  manifestId: string;
  manifestFingerprint: `sha256:${string}`;
  installationId: string;
  installationFingerprint: `sha256:${string}`;
  hostId: string;
  platform: "linux";
  architecture: "x64";
  kernelReleaseDigest: `sha256:${string}`;
  landlockAbi: number;
  launcherSourceDigest: `sha256:${string}`;
  launcherBinaryDigest: `sha256:${string}`;
  compilerPathDigest: `sha256:${string}`;
  compilerDigest: `sha256:${string}`;
  compilerBytes: number;
  compilerVersionDigest: `sha256:${string}`;
  compilationDigest: `sha256:${string}`;
  runtimeLoaderPathDigest: `sha256:${string}`;
  runtimeLoaderDigest: `sha256:${string}`;
  runtimeLoaderBytes: number;
  addressSpaceLimitBytes: number;
  cpuSecondsLimit: number;
  fileSizeLimitBytes: number;
  openFileLimit: number;
  noNewPrivileges: true;
  landlockFilesystemEnforced: true;
  seccompNetworkEnforced: true;
  seccompChildProcessEnforced: true;
  seccompProcessSignalEnforced: true;
  seccompInterprocessMemoryEnforced: true;
  executableScope: "manifest-executable-plus-runtime-loader";
  runtimeLoaderExact: true;
  cloneThreadAdmitted: true;
  clone3Compatibility: "enosys-fallback";
  environmentMode: "manifest-exact";
  inputRelease: "after-isolation-attestation";
  boundAt: string;
  operatorId: string;
  rawCompilerPathRetained: false;
  rawExecutablePathRetained: false;
  rawRuntimeLoaderPathRetained: false;
  rawAdapterBundlePathRetained: false;
  rawTaskInputRetained: false;
  rawTaskOutputRetained: false;
  policyAuthority: "kernel-capability-policy-only";
}

export interface AsoiafAnswerActorIsolationReceipt {
  format: typeof ASOIAF_ANSWER_ACTOR_ISOLATION_RECEIPT_FORMAT;
  landlockAbi: number;
  noNewPrivileges: true;
  landlockFilesystemEnforced: true;
  seccompNetworkEnforced: true;
  seccompChildProcessEnforced: true;
  seccompProcessSignalEnforced: true;
  seccompInterprocessMemoryEnforced: true;
  executableScope: "manifest-executable-plus-runtime-loader";
  runtimeLoaderExact: true;
  cloneThreadAdmitted: true;
  clone3Compatibility: "enosys-fallback";
  resourceLimitsEnforced: true;
  addressSpaceLimitBytes: number;
  cpuSecondsLimit: number;
  fileSizeLimitBytes: number;
  openFileLimit: number;
  environmentMode: "manifest-exact";
  inputReleased: false;
}

export interface AsoiafAnswerActorCapabilityStart extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_CAPABILITY_START_FORMAT;
  startId: string;
  startFingerprint: `sha256:${string}`;
  policyId: string;
  policyFingerprint: `sha256:${string}`;
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
  commandDigest: `sha256:${string}`;
  environmentDigest: `sha256:${string}`;
  inputDigest: `sha256:${string}`;
  inputBytes: number;
  launcherSourceDigest: `sha256:${string}`;
  launcherBinaryDigest: `sha256:${string}`;
  compilationDigest: `sha256:${string}`;
  kernelReleaseDigest: `sha256:${string}`;
  runtimeLoaderPathDigest: `sha256:${string}`;
  runtimeLoaderDigest: `sha256:${string}`;
  runtimeLoaderBytes: number;
  startedAt: string;
  operatorId: string;
  shell: false;
  inheritEnvironment: false;
  workingDirectory: "ephemeral-empty";
  inputRelease: "after-isolation-attestation";
  rawInputRetained: false;
  rawCompilerPathRetained: false;
  rawExecutablePathRetained: false;
  rawRuntimeLoaderPathRetained: false;
  rawAdapterBundlePathRetained: false;
  startAuthority: "isolated-process-start-observation-only";
}

export type AsoiafAnswerActorCapabilityTerminalOutcome =
  | "succeeded"
  | "failed"
  | "timed-out"
  | "protocol-refused"
  | "isolation-refused"
  | "interrupted";

export interface AsoiafAnswerActorCapabilityTerminal extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_CAPABILITY_TERMINAL_FORMAT;
  terminalId: string;
  terminalFingerprint: `sha256:${string}`;
  startId: string;
  startFingerprint: `sha256:${string}`;
  policyId: string;
  policyFingerprint: `sha256:${string}`;
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
  outcome: AsoiafAnswerActorCapabilityTerminalOutcome;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  startedAt: string;
  completedAt: string;
  durationMilliseconds: number;
  stdoutDigest: `sha256:${string}`;
  stdoutBytes: number;
  stderrDigest: `sha256:${string}`;
  stderrBytes: number;
  isolationReceipt: AsoiafAnswerActorIsolationReceipt | null;
  isolationReceiptDigest: `sha256:${string}` | null;
  adapterEvidence: AsoiafAnswerActorAdapterEvidence | null;
  recoveryReason: string | null;
  processLaunched: boolean;
  adapterInputReleased: boolean;
  timedOut: boolean;
  outputLimitExceeded: boolean;
  rawInputRetained: false;
  rawStdoutRetained: false;
  rawStderrRetained: false;
  rawTaskOutputRetained: false;
  taskOutcomeDeclared: false;
  osIsolationEnforced: boolean;
  terminalAuthority: "kernel-isolation-observation-only";
}

export interface AsoiafAnswerActorCapabilityStateEntry {
  invocationId: string;
  invocationFingerprint: `sha256:${string}`;
  policyId: string;
  startId: string;
  terminalId: string | null;
  status: "started" | AsoiafAnswerActorCapabilityTerminalOutcome;
  osIsolationEnforced: boolean;
  updatedAt: string;
}

export interface AsoiafAnswerActorCapabilityState extends NoAuthority {
  format: typeof ASOIAF_ANSWER_ACTOR_CAPABILITY_STATE_FORMAT;
  stateId: string;
  stateFingerprint: `sha256:${string}`;
  asOf: string;
  entries: AsoiafAnswerActorCapabilityStateEntry[];
  stateAuthority: "projection-only";
}

export interface AsoiafAnswerActorCapabilityStatus {
  format: "axm-asoiaf-answer-actor-capability-broker-status/1";
  paths: AsoiafAnswerActorCapabilityBrokerPaths;
  policies: AsoiafAnswerActorCapabilityPolicy[];
  starts: AsoiafAnswerActorCapabilityStart[];
  terminals: AsoiafAnswerActorCapabilityTerminal[];
  state: AsoiafAnswerActorCapabilityState | null;
}

export interface AsoiafAnswerActorCapabilityFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

export interface AsoiafAnswerActorCapabilityPolicyInput {
  root: string;
  manifestId: string;
  installationId: string;
  compilerPath: string;
  executablePath: string;
  boundAt: string;
  operatorId: string;
}

export interface AsoiafAnswerActorCapabilityStartInput {
  root: string;
  policyId: string;
  invocationId: string;
  compilerPath: string;
  executablePath: string;
  adapterBundlePath: string;
  inputBase64: string;
  startedAt: string;
  operatorId: string;
}

export interface AsoiafAnswerActorCapabilityExecuteInput
  extends AsoiafAnswerActorCapabilityStartInput {}

export interface AsoiafAnswerActorCapabilityRecoverInput {
  root: string;
  invocationId: string;
  recoveredAt: string;
  reason: string;
  operatorId: string;
}

interface FileIdentity {
  path: string;
  pathDigest: `sha256:${string}`;
  digest: `sha256:${string}`;
  bytes: number;
}

interface CompilerCustody {
  compiler: FileIdentity;
  compilerVersionDigest: `sha256:${string}`;
  compilationDigest: `sha256:${string}`;
}

interface CompiledLauncher {
  directory: string;
  sourcePath: string;
  binaryPath: string;
  sourceDigest: `sha256:${string}`;
  binaryDigest: `sha256:${string}`;
  compiler: FileIdentity;
  compilerVersionDigest: `sha256:${string}`;
  compilationDigest: `sha256:${string}`;
  dispose: () => void;
}

interface ParentContext {
  manifest: AsoiafAnswerActorAdapterManifest;
  installation: AsoiafAnswerActorAdapterInstallation;
  invocation: AsoiafAnswerActorAdapterInvocation;
  acceptance: AsoiafAnswerActorRuntimeAcceptance;
}

interface ProcessRunResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdoutDigest: `sha256:${string}`;
  stdoutBytes: number;
  stderrDigest: `sha256:${string}`;
  stderrBytes: number;
  stdoutBuffer: Buffer;
  isolationReceipt: AsoiafAnswerActorIsolationReceipt | null;
  isolationError: string | null;
  adapterInputReleased: boolean;
  timedOut: boolean;
  outputLimitExceeded: boolean;
  spawnError: string | null;
  completedAt: string;
}

const LAUNCHER_SOURCE = String.raw`#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/landlock.h>
#include <linux/seccomp.h>
#include <sched.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/syscall.h>
#include <unistd.h>

#ifndef O_PATH
#define O_PATH 010000000
#endif

extern char **environ;

static void die(const char *message) {
  fprintf(stderr, "capability-launcher: %s: %s\n", message, strerror(errno));
  _exit(125);
}

static int ll_create(const struct landlock_ruleset_attr *attr, size_t size, uint32_t flags) {
  return (int)syscall(SYS_landlock_create_ruleset, attr, size, flags);
}

static int ll_add(int fd, enum landlock_rule_type type, const void *attr, uint32_t flags) {
  return (int)syscall(SYS_landlock_add_rule, fd, type, attr, flags);
}

static int ll_restrict(int fd, uint32_t flags) {
  return (int)syscall(SYS_landlock_restrict_self, fd, flags);
}

static __u64 handled_fs(int abi) {
  __u64 value = LANDLOCK_ACCESS_FS_EXECUTE | LANDLOCK_ACCESS_FS_WRITE_FILE |
    LANDLOCK_ACCESS_FS_READ_FILE | LANDLOCK_ACCESS_FS_READ_DIR |
    LANDLOCK_ACCESS_FS_REMOVE_DIR | LANDLOCK_ACCESS_FS_REMOVE_FILE |
    LANDLOCK_ACCESS_FS_MAKE_CHAR | LANDLOCK_ACCESS_FS_MAKE_DIR |
    LANDLOCK_ACCESS_FS_MAKE_REG | LANDLOCK_ACCESS_FS_MAKE_SOCK |
    LANDLOCK_ACCESS_FS_MAKE_FIFO | LANDLOCK_ACCESS_FS_MAKE_BLOCK |
    LANDLOCK_ACCESS_FS_MAKE_SYM;
#ifdef LANDLOCK_ACCESS_FS_REFER
  if (abi >= 2) value |= LANDLOCK_ACCESS_FS_REFER;
#endif
#ifdef LANDLOCK_ACCESS_FS_TRUNCATE
  if (abi >= 3) value |= LANDLOCK_ACCESS_FS_TRUNCATE;
#endif
  return value;
}

static void add_path(int ruleset, const char *path, __u64 allowed) {
  int fd = open(path, O_PATH | O_CLOEXEC);
  if (fd < 0) {
    if (errno == ENOENT) return;
    die(path);
  }
  struct landlock_path_beneath_attr rule = {
    .allowed_access = allowed,
    .parent_fd = fd,
  };
  if (ll_add(ruleset, LANDLOCK_RULE_PATH_BENEATH, &rule, 0) < 0) die("landlock_add_rule");
  close(fd);
}

static int landlock_abi(void) {
  return ll_create(NULL, 0, LANDLOCK_CREATE_RULESET_VERSION);
}

static int apply_landlock(
  const char *target,
  const char *bundle,
  const char *runtime_loader,
  const char *cwd
) {
  int abi = landlock_abi();
  if (abi < 3) {
    errno = abi < 0 ? errno : ENOTSUP;
    die("Landlock ABI 3 or newer required");
  }
  __u64 handled = handled_fs(abi);
  struct landlock_ruleset_attr ruleset_attr = { .handled_access_fs = handled };
  int ruleset = ll_create(&ruleset_attr, sizeof(ruleset_attr), 0);
  if (ruleset < 0) die("landlock_create_ruleset");
  __u64 ro_dir = LANDLOCK_ACCESS_FS_READ_FILE | LANDLOCK_ACCESS_FS_READ_DIR;
  __u64 cwd_access = handled & ~(LANDLOCK_ACCESS_FS_EXECUTE |
    LANDLOCK_ACCESS_FS_MAKE_CHAR | LANDLOCK_ACCESS_FS_MAKE_BLOCK);
  add_path(ruleset, target, LANDLOCK_ACCESS_FS_EXECUTE | LANDLOCK_ACCESS_FS_READ_FILE);
  add_path(ruleset, bundle, LANDLOCK_ACCESS_FS_READ_FILE);
  add_path(ruleset, runtime_loader, LANDLOCK_ACCESS_FS_EXECUTE | LANDLOCK_ACCESS_FS_READ_FILE);
  add_path(ruleset, "/usr", ro_dir);
  add_path(ruleset, "/lib", ro_dir);
  add_path(ruleset, "/lib64", ro_dir);
  add_path(ruleset, "/etc/ld.so.cache", LANDLOCK_ACCESS_FS_READ_FILE);
  add_path(ruleset, "/etc/ssl/openssl.cnf", LANDLOCK_ACCESS_FS_READ_FILE);
  add_path(ruleset, "/dev/null", LANDLOCK_ACCESS_FS_READ_FILE | LANDLOCK_ACCESS_FS_WRITE_FILE);
  add_path(ruleset, cwd, cwd_access);
  if (ll_restrict(ruleset, 0) < 0) die("landlock_restrict_self");
  close(ruleset);
  return abi;
}

#define DENY_SYSCALL(number) \
  BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, (number), 0, 1), \
  BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | (EPERM & SECCOMP_RET_DATA))

static void apply_seccomp(void) {
  struct sock_filter filter[] = {
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, arch)),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, AUDIT_ARCH_X86_64, 1, 0),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_KILL_PROCESS),
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),
#ifdef __NR_clone
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_clone, 0, 5),
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, args[0])),
    BPF_STMT(BPF_ALU | BPF_AND | BPF_K, CLONE_THREAD),
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, CLONE_THREAD, 0, 1),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | (EPERM & SECCOMP_RET_DATA)),
#endif
#ifdef __NR_clone3
    BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_clone3, 0, 1),
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | (ENOSYS & SECCOMP_RET_DATA)),
#endif
#ifdef __NR_socket
    DENY_SYSCALL(__NR_socket),
#endif
#ifdef __NR_connect
    DENY_SYSCALL(__NR_connect),
#endif
#ifdef __NR_bind
    DENY_SYSCALL(__NR_bind),
#endif
#ifdef __NR_listen
    DENY_SYSCALL(__NR_listen),
#endif
#ifdef __NR_accept
    DENY_SYSCALL(__NR_accept),
#endif
#ifdef __NR_accept4
    DENY_SYSCALL(__NR_accept4),
#endif
#ifdef __NR_sendto
    DENY_SYSCALL(__NR_sendto),
#endif
#ifdef __NR_recvfrom
    DENY_SYSCALL(__NR_recvfrom),
#endif
#ifdef __NR_sendmsg
    DENY_SYSCALL(__NR_sendmsg),
#endif
#ifdef __NR_recvmsg
    DENY_SYSCALL(__NR_recvmsg),
#endif
#ifdef __NR_sendmmsg
    DENY_SYSCALL(__NR_sendmmsg),
#endif
#ifdef __NR_recvmmsg
    DENY_SYSCALL(__NR_recvmmsg),
#endif
#ifdef __NR_shutdown
    DENY_SYSCALL(__NR_shutdown),
#endif
#ifdef __NR_fork
    DENY_SYSCALL(__NR_fork),
#endif
#ifdef __NR_vfork
    DENY_SYSCALL(__NR_vfork),
#endif
#ifdef __NR_unshare
    DENY_SYSCALL(__NR_unshare),
#endif
#ifdef __NR_setns
    DENY_SYSCALL(__NR_setns),
#endif
#ifdef __NR_mount
    DENY_SYSCALL(__NR_mount),
#endif
#ifdef __NR_umount2
    DENY_SYSCALL(__NR_umount2),
#endif
#ifdef __NR_ptrace
    DENY_SYSCALL(__NR_ptrace),
#endif
#ifdef __NR_bpf
    DENY_SYSCALL(__NR_bpf),
#endif
#ifdef __NR_perf_event_open
    DENY_SYSCALL(__NR_perf_event_open),
#endif
#ifdef __NR_keyctl
    DENY_SYSCALL(__NR_keyctl),
#endif
#ifdef __NR_add_key
    DENY_SYSCALL(__NR_add_key),
#endif
#ifdef __NR_request_key
    DENY_SYSCALL(__NR_request_key),
#endif
#ifdef __NR_execveat
    DENY_SYSCALL(__NR_execveat),
#endif
#ifdef __NR_memfd_create
    DENY_SYSCALL(__NR_memfd_create),
#endif
#ifdef __NR_kill
    DENY_SYSCALL(__NR_kill),
#endif
#ifdef __NR_tkill
    DENY_SYSCALL(__NR_tkill),
#endif
#ifdef __NR_tgkill
    DENY_SYSCALL(__NR_tgkill),
#endif
#ifdef __NR_pidfd_send_signal
    DENY_SYSCALL(__NR_pidfd_send_signal),
#endif
#ifdef __NR_process_vm_readv
    DENY_SYSCALL(__NR_process_vm_readv),
#endif
#ifdef __NR_process_vm_writev
    DENY_SYSCALL(__NR_process_vm_writev),
#endif
#ifdef __NR_shmget
    DENY_SYSCALL(__NR_shmget),
#endif
#ifdef __NR_shmat
    DENY_SYSCALL(__NR_shmat),
#endif
#ifdef __NR_shmdt
    DENY_SYSCALL(__NR_shmdt),
#endif
#ifdef __NR_shmctl
    DENY_SYSCALL(__NR_shmctl),
#endif
#ifdef __NR_msgget
    DENY_SYSCALL(__NR_msgget),
#endif
#ifdef __NR_msgsnd
    DENY_SYSCALL(__NR_msgsnd),
#endif
#ifdef __NR_msgrcv
    DENY_SYSCALL(__NR_msgrcv),
#endif
#ifdef __NR_msgctl
    DENY_SYSCALL(__NR_msgctl),
#endif
#ifdef __NR_semget
    DENY_SYSCALL(__NR_semget),
#endif
#ifdef __NR_semop
    DENY_SYSCALL(__NR_semop),
#endif
#ifdef __NR_semtimedop
    DENY_SYSCALL(__NR_semtimedop),
#endif
#ifdef __NR_semctl
    DENY_SYSCALL(__NR_semctl),
#endif
    BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
  };
  struct sock_fprog program = {
    .len = (unsigned short)(sizeof(filter) / sizeof(filter[0])),
    .filter = filter,
  };
  if (prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &program) < 0) die("seccomp filter");
}

static unsigned long long parse_ull(const char *value, const char *label) {
  char *end = NULL;
  errno = 0;
  unsigned long long parsed = strtoull(value, &end, 10);
  if (errno || !end || *end != '\0' || parsed == 0) {
    errno = EINVAL;
    die(label);
  }
  return parsed;
}

static void apply_limits(
  unsigned long long address_space,
  unsigned long long cpu_seconds,
  unsigned long long file_size,
  unsigned long long open_files
) {
  struct rlimit limit;
  limit.rlim_cur = limit.rlim_max = (rlim_t)address_space;
  if (setrlimit(RLIMIT_AS, &limit) < 0) die("RLIMIT_AS");
  limit.rlim_cur = limit.rlim_max = (rlim_t)cpu_seconds;
  if (setrlimit(RLIMIT_CPU, &limit) < 0) die("RLIMIT_CPU");
  limit.rlim_cur = limit.rlim_max = (rlim_t)file_size;
  if (setrlimit(RLIMIT_FSIZE, &limit) < 0) die("RLIMIT_FSIZE");
  limit.rlim_cur = limit.rlim_max = (rlim_t)open_files;
  if (setrlimit(RLIMIT_NOFILE, &limit) < 0) die("RLIMIT_NOFILE");
  limit.rlim_cur = limit.rlim_max = 0;
  if (setrlimit(RLIMIT_CORE, &limit) < 0) die("RLIMIT_CORE");
}

int main(int argc, char **argv) {
  if (argc == 2 && strcmp(argv[1], "--probe") == 0) {
    int abi = landlock_abi();
    printf("{\"format\":\"axm-asoiaf-answer-actor-isolation-probe/1\",\"landlockAbi\":%d,\"architecture\":\"x64\"}\n", abi);
    return abi >= 3 ? 0 : 125;
  }
  if (argc < 10 || strcmp(argv[8], "--") != 0) {
    fprintf(stderr, "usage: launcher TARGET BUNDLE RUNTIME_LOADER ADDRESS_SPACE CPU_SECONDS FILE_SIZE OPEN_FILES -- [ARGS...]\n");
    return 64;
  }
  unsigned long long address_space = parse_ull(argv[4], "address-space limit");
  unsigned long long cpu_seconds = parse_ull(argv[5], "cpu limit");
  unsigned long long file_size = parse_ull(argv[6], "file-size limit");
  unsigned long long open_files = parse_ull(argv[7], "open-file limit");
  char cwd[4096];
  if (!getcwd(cwd, sizeof(cwd))) die("getcwd");
  apply_limits(address_space, cpu_seconds, file_size, open_files);
  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) < 0) die("PR_SET_NO_NEW_PRIVS");
  int abi = apply_landlock(argv[1], argv[2], argv[3], cwd);
  apply_seccomp();
  if (dprintf(3,
    "{\"format\":\"axm-asoiaf-answer-actor-isolation-receipt/1\","
    "\"landlockAbi\":%d,\"noNewPrivileges\":true,"
    "\"landlockFilesystemEnforced\":true,\"seccompNetworkEnforced\":true,"
    "\"seccompChildProcessEnforced\":true,\"seccompProcessSignalEnforced\":true,"
    "\"seccompInterprocessMemoryEnforced\":true,"
    "\"executableScope\":\"manifest-executable-plus-runtime-loader\","
    "\"runtimeLoaderExact\":true,\"cloneThreadAdmitted\":true,"
    "\"clone3Compatibility\":\"enosys-fallback\",\"resourceLimitsEnforced\":true,"
    "\"addressSpaceLimitBytes\":%llu,\"cpuSecondsLimit\":%llu,"
    "\"fileSizeLimitBytes\":%llu,\"openFileLimit\":%llu,"
    "\"environmentMode\":\"manifest-exact\",\"inputReleased\":false}\n",
    abi, address_space, cpu_seconds, file_size, open_files) < 0) {
    die("isolation attestation");
  }
  close(3);
  for (int fd = 4; fd < (int)open_files; ++fd) close(fd);
  size_t child_count = (size_t)argc - 7;
  char **child = calloc(child_count, sizeof(char *));
  if (!child) die("calloc");
  child[0] = argv[1];
  for (int index = 9; index < argc; ++index) child[index - 8] = argv[index];
  child[argc - 8] = NULL;
  execve(argv[1], child, environ);
  die("execve target");
}
`;

export const ASOIAF_ANSWER_ACTOR_CAPABILITY_LAUNCHER_SOURCE_DIGEST = rawDigest(
  Buffer.from(LAUNCHER_SOURCE, "utf8"),
);

function rawDigest(value: Buffer | string): `sha256:${string}` {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
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

function requireInteger(value: number, label: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} through ${maximum}`);
  }
  return value;
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

function fileIdentity(target: string, label: string): FileIdentity {
  const absolute = path.resolve(target);
  const stat = fs.statSync(absolute);
  if (!stat.isFile()) throw new Error(`${label} must be a regular file`);
  const bytes = requireInteger(stat.size, `${label} byte count`, 1, MAX_FILE_BYTES);
  return {
    path: absolute,
    pathDigest: sha256(absolute),
    digest: rawDigest(fs.readFileSync(absolute)),
    bytes,
  };
}

function elfRuntimeLoaderPath(executablePath: string): string {
  const executable = fs.readFileSync(executablePath);
  if (
    executable.length < 64
    || executable[0] !== 0x7f
    || executable[1] !== 0x45
    || executable[2] !== 0x4c
    || executable[3] !== 0x46
    || executable[4] !== 2
    || executable[5] !== 1
    || executable.readUInt16LE(18) !== 62
  ) {
    throw new Error("capability executable must be a little-endian ELF64 x86-64 image");
  }
  const programOffset = Number(executable.readBigUInt64LE(32));
  const programEntryBytes = executable.readUInt16LE(54);
  const programEntries = executable.readUInt16LE(56);
  if (
    !Number.isSafeInteger(programOffset)
    || programEntryBytes < 56
    || programEntries < 1
    || programEntries > 4096
    || programOffset + programEntryBytes * programEntries > executable.length
  ) {
    throw new Error("capability executable has an invalid ELF program-header table");
  }
  const interpreters: string[] = [];
  for (let index = 0; index < programEntries; index += 1) {
    const offset = programOffset + index * programEntryBytes;
    if (executable.readUInt32LE(offset) !== 3) continue;
    const valueOffset = Number(executable.readBigUInt64LE(offset + 8));
    const valueBytes = Number(executable.readBigUInt64LE(offset + 32));
    if (
      !Number.isSafeInteger(valueOffset)
      || !Number.isSafeInteger(valueBytes)
      || valueBytes < 2
      || valueBytes > 4096
      || valueOffset + valueBytes > executable.length
    ) {
      throw new Error("capability executable has an invalid ELF interpreter record");
    }
    const raw = executable.subarray(valueOffset, valueOffset + valueBytes);
    const nul = raw.indexOf(0);
    if (nul < 1 || nul !== raw.length - 1) {
      throw new Error("capability executable ELF interpreter must be exactly NUL terminated");
    }
    const interpreterBytes = raw.subarray(0, nul);
    const interpreter = interpreterBytes.toString("utf8");
    if (
      !interpreterBytes.equals(Buffer.from(interpreter, "utf8"))
      || !path.isAbsolute(interpreter)
    ) {
      throw new Error("capability executable ELF interpreter must be one UTF-8 absolute path");
    }
    interpreters.push(interpreter);
  }
  if (interpreters.length !== 1) {
    throw new Error("capability executable must retain exactly one ELF runtime loader");
  }
  return path.resolve(interpreters[0]!);
}

function runtimeLoaderIdentity(executablePath: string): FileIdentity {
  return fileIdentity(elfRuntimeLoaderPath(executablePath), "adapter ELF runtime loader");
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
    if (existing !== serialized) throw new Error(`actor capability immutable file collision at ${target}`);
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

function finding(
  code: string,
  severity: AsoiafAnswerActorCapabilityFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafAnswerActorCapabilityFinding {
  return { code, severity, subjectId, detail };
}

function sortedFindings(
  values: readonly AsoiafAnswerActorCapabilityFinding[],
): AsoiafAnswerActorCapabilityFinding[] {
  const rank = { error: 0, warning: 1, notice: 2 } as const;
  return [...values].sort((left, right) =>
    rank[left.severity] - rank[right.severity]
    || left.code.localeCompare(right.code)
    || left.subjectId.localeCompare(right.subjectId)
    || left.detail.localeCompare(right.detail));
}

function unique<T>(values: readonly T[], predicate: (entry: T) => boolean, label: string): T {
  const matches = values.filter(predicate);
  if (matches.length !== 1) throw new Error(`${label} is absent or duplicated`);
  return matches[0]!;
}

export function asoiafAnswerActorCapabilityBrokerPaths(
  root: string,
): AsoiafAnswerActorCapabilityBrokerPaths {
  const absolute = path.resolve(root);
  const brokerRoot = path.join(absolute, "answer-actor-capability-broker");
  return {
    root: absolute,
    brokerRoot,
    policies: path.join(brokerRoot, "policies"),
    starts: path.join(brokerRoot, "starts"),
    terminals: path.join(brokerRoot, "terminals"),
    state: path.join(brokerRoot, "CAPABILITY-STATE.json"),
  };
}

export function readAsoiafAnswerActorCapabilityStatus(
  root: string,
): AsoiafAnswerActorCapabilityStatus {
  const paths = asoiafAnswerActorCapabilityBrokerPaths(root);
  return {
    format: "axm-asoiaf-answer-actor-capability-broker-status/1",
    paths,
    policies: listJson<AsoiafAnswerActorCapabilityPolicy>(paths.policies),
    starts: listJson<AsoiafAnswerActorCapabilityStart>(paths.starts),
    terminals: listJson<AsoiafAnswerActorCapabilityTerminal>(paths.terminals),
    state: fs.existsSync(paths.state) ? readJson<AsoiafAnswerActorCapabilityState>(paths.state) : null,
  };
}

function policyById(root: string, policyId: string): AsoiafAnswerActorCapabilityPolicy {
  return unique(
    readAsoiafAnswerActorCapabilityStatus(root).policies,
    (entry) => entry.policyId === policyId,
    `actor capability policy ${policyId}`,
  );
}

function findStart(root: string, invocationId: string): AsoiafAnswerActorCapabilityStart | null {
  const matches = readAsoiafAnswerActorCapabilityStatus(root).starts.filter(
    (entry) => entry.invocationId === invocationId,
  );
  if (matches.length > 1) throw new Error("actor capability invocation has duplicate start receipts");
  return matches[0] ?? null;
}

function findTerminal(root: string, invocationId: string): AsoiafAnswerActorCapabilityTerminal | null {
  const matches = readAsoiafAnswerActorCapabilityStatus(root).terminals.filter(
    (entry) => entry.invocationId === invocationId,
  );
  if (matches.length > 1) throw new Error("actor capability invocation has duplicate terminal receipts");
  return matches[0] ?? null;
}

function buildState(root: string): AsoiafAnswerActorCapabilityState | null {
  const status = readAsoiafAnswerActorCapabilityStatus(root);
  if (status.policies.length === 0 && status.starts.length === 0) return null;
  const entries = status.starts.map((start): AsoiafAnswerActorCapabilityStateEntry => {
    const terminal = status.terminals.find((entry) => entry.invocationId === start.invocationId) ?? null;
    return {
      invocationId: start.invocationId,
      invocationFingerprint: start.invocationFingerprint,
      policyId: start.policyId,
      startId: start.startId,
      terminalId: terminal?.terminalId ?? null,
      status: terminal?.outcome ?? "started",
      osIsolationEnforced: terminal?.osIsolationEnforced ?? false,
      updatedAt: terminal?.completedAt ?? start.startedAt,
    };
  }).sort((left, right) => left.invocationId.localeCompare(right.invocationId));
  const asOf = [
    ...status.policies.map((entry) => entry.boundAt),
    ...entries.map((entry) => entry.updatedAt),
  ].sort().at(-1) ?? "1970-01-01T00:00:00.000Z";
  const core = {
    format: ASOIAF_ANSWER_ACTOR_CAPABILITY_STATE_FORMAT,
    asOf,
    entries,
    stateAuthority: "projection-only" as const,
    ...NO_AUTHORITY,
  };
  const stateFingerprint = sha256(core);
  return {
    ...core,
    stateId: collectorContentId("asoiaf-answer-actor-capability-state", { asOf, stateFingerprint }),
    stateFingerprint,
  };
}

function refreshState(root: string): AsoiafAnswerActorCapabilityState | null {
  const paths = asoiafAnswerActorCapabilityBrokerPaths(root);
  const state = buildState(root);
  if (state) writeAtomic(paths.state, state);
  else fs.rmSync(paths.state, { force: true });
  return state;
}

function requireLinuxX64(): void {
  if (process.platform !== "linux" || process.arch !== "x64") {
    throw new Error("actor capability broker v1 requires Linux x64");
  }
}

function validateParentEstate(root: string): void {
  const errors = verifyAsoiafAnswerActorAdapterHostEstate(root).filter(
    (entry) => entry.severity === "error",
  );
  if (errors.length > 0) {
    throw new Error(`actor adapter parent estate has ${errors.length} verification error(s)`);
  }
}

function parentForPolicy(
  root: string,
  manifestId: string,
  installationId: string,
): Pick<ParentContext, "manifest" | "installation"> {
  validateParentEstate(root);
  const adapter = readAsoiafAnswerActorAdapterHostStatus(root);
  const manifest = unique(adapter.manifests, (entry) => entry.manifestId === manifestId, `manifest ${manifestId}`);
  const installation = unique(
    adapter.installations,
    (entry) => entry.installationId === installationId,
    `installation ${installationId}`,
  );
  if (
    installation.manifestId !== manifest.manifestId
    || installation.manifestFingerprint !== manifest.manifestFingerprint
  ) {
    throw new Error("actor capability installation differs from the requested manifest");
  }
  validateManifestBoundary(manifest);
  return { manifest, installation };
}

function parentForInvocation(root: string, invocationId: string): ParentContext {
  validateParentEstate(root);
  const adapter = readAsoiafAnswerActorAdapterHostStatus(root);
  const runtime = readAsoiafAnswerActorRuntimeStatus(root);
  const invocation = unique(
    adapter.invocations,
    (entry) => entry.invocationId === invocationId,
    `adapter invocation ${invocationId}`,
  );
  const manifest = unique(
    adapter.manifests,
    (entry) => entry.manifestId === invocation.manifestId,
    `adapter manifest ${invocation.manifestId}`,
  );
  const installation = unique(
    adapter.installations,
    (entry) => entry.installationId === invocation.installationId,
    `adapter installation ${invocation.installationId}`,
  );
  const acceptance = unique(
    runtime.acceptances,
    (entry) => entry.acceptanceId === invocation.runtimeAcceptanceId,
    `runtime acceptance ${invocation.runtimeAcceptanceId}`,
  );
  validateManifestBoundary(manifest);
  if (
    installation.manifestId !== manifest.manifestId
    || installation.manifestFingerprint !== manifest.manifestFingerprint
    || invocation.manifestFingerprint !== manifest.manifestFingerprint
    || invocation.installationFingerprint !== installation.installationFingerprint
    || invocation.runtimeAcceptanceFingerprint !== acceptance.acceptanceFingerprint
  ) {
    throw new Error("actor capability invocation differs from parent manifest, installation, or runtime acceptance");
  }
  if (adapter.starts.some((entry) => entry.invocationId === invocation.invocationId)) {
    throw new Error("actor capability broker refuses an invocation already started by the non-isolated adapter host");
  }
  if (adapter.terminals.some((entry) => entry.invocationId === invocation.invocationId)) {
    throw new Error("actor capability broker refuses an invocation already completed by the non-isolated adapter host");
  }
  return { manifest, installation, invocation, acceptance };
}

function validateManifestBoundary(manifest: AsoiafAnswerActorAdapterManifest): void {
  if (
    manifest.shell !== false
    || manifest.inheritEnvironment !== false
    || manifest.workingDirectory !== "ephemeral-empty"
    || manifest.declaredFilesystemAccess !== "adapter-bundle-and-ephemeral-cwd-only"
    || manifest.declaredNetworkAccess !== "none"
    || manifest.declaredChildProcessAccess !== "none"
    || manifest.osIsolationEnforced !== false
  ) {
    throw new Error("adapter manifest does not declare the exact capability-broker predecessor boundary");
  }
}

function validateTransientExecutable(
  manifest: AsoiafAnswerActorAdapterManifest,
  installation: AsoiafAnswerActorAdapterInstallation,
  executablePath: string,
): FileIdentity {
  const executable = fileIdentity(executablePath, "adapter executable");
  if (
    executable.pathDigest !== installation.executablePathDigest
    || executable.digest !== manifest.executableDigest
    || executable.digest !== installation.executableDigest
    || executable.bytes !== manifest.executableBytes
    || executable.bytes !== installation.executableBytes
  ) {
    throw new Error("transient adapter executable differs from retained manifest or installation custody");
  }
  return executable;
}

function validateTransientFiles(
  manifest: AsoiafAnswerActorAdapterManifest,
  installation: AsoiafAnswerActorAdapterInstallation,
  executablePath: string,
  adapterBundlePath: string,
): { executable: FileIdentity; bundle: FileIdentity } {
  const executable = validateTransientExecutable(manifest, installation, executablePath);
  const bundle = fileIdentity(adapterBundlePath, "adapter bundle");
  if (
    bundle.pathDigest !== installation.adapterBundlePathDigest
    || bundle.digest !== manifest.adapterBundleDigest
    || bundle.digest !== installation.adapterBundleDigest
    || bundle.bytes !== manifest.adapterBundleBytes
    || bundle.bytes !== installation.adapterBundleBytes
  ) {
    throw new Error("transient adapter bundle differs from retained manifest or installation custody");
  }
  return { executable, bundle };
}

function decodeInput(value: string, manifest: AsoiafAnswerActorAdapterManifest): Buffer {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error("actor capability inputBase64 is invalid");
  }
  const buffer = Buffer.from(value, "base64");
  if (buffer.length > manifest.maxInputBytes) {
    throw new Error("actor capability input exceeds the adapter manifest ceiling");
  }
  return buffer;
}

function expandedArguments(
  manifest: AsoiafAnswerActorAdapterManifest,
  adapterBundlePath: string,
): string[] {
  return manifest.fixedArgumentTemplate.map((entry) =>
    entry === "{adapterBundle}" ? path.resolve(adapterBundlePath) : entry);
}

function commandDigest(
  policy: AsoiafAnswerActorCapabilityPolicy,
  manifest: AsoiafAnswerActorAdapterManifest,
): `sha256:${string}` {
  return sha256({
    policyFingerprint: policy.policyFingerprint,
    executableDigest: manifest.executableDigest,
    adapterBundleDigest: manifest.adapterBundleDigest,
    fixedArgumentsDigest: manifest.fixedArgumentsDigest,
    environmentDigest: manifest.environmentDigest,
    runtimeLoaderPathDigest: policy.runtimeLoaderPathDigest,
    runtimeLoaderDigest: policy.runtimeLoaderDigest,
    runtimeLoaderBytes: policy.runtimeLoaderBytes,
    shell: false,
    inheritEnvironment: false,
    workingDirectory: "ephemeral-empty",
  });
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

function policyLimits(manifest: AsoiafAnswerActorAdapterManifest): {
  addressSpaceLimitBytes: number;
  cpuSecondsLimit: number;
  fileSizeLimitBytes: number;
  openFileLimit: number;
} {
  return {
    addressSpaceLimitBytes: ADDRESS_SPACE_LIMIT_BYTES,
    cpuSecondsLimit: Math.max(1, Math.ceil(manifest.timeoutMilliseconds / 1000) + 1),
    fileSizeLimitBytes: Math.max(
      MIN_FILE_SIZE_LIMIT_BYTES,
      manifest.maxStdoutBytes,
      manifest.maxStderrBytes,
    ),
    openFileLimit: OPEN_FILE_LIMIT,
  };
}

function inspectCompiler(compilerPath: string): CompilerCustody {
  requireLinuxX64();
  const compiler = fileIdentity(compilerPath, "capability compiler");
  const version = spawnSync(compiler.path, ["--version"], {
    cwd: os.tmpdir(),
    env: { ...COMPILER_ENVIRONMENT },
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });
  if (version.error || version.status !== 0) {
    throw new Error(`capability compiler version probe failed: ${version.error?.message ?? version.stderr}`);
  }
  const compilerVersionDigest = rawDigest(`${version.stdout}\n${version.stderr}`);
  return {
    compiler,
    compilerVersionDigest,
    compilationDigest: sha256({
      sourceDigest: ASOIAF_ANSWER_ACTOR_CAPABILITY_LAUNCHER_SOURCE_DIGEST,
      compilerPathDigest: compiler.pathDigest,
      compilerDigest: compiler.digest,
      compilerBytes: compiler.bytes,
      compilerVersionDigest,
      arguments: COMPILER_ARGUMENTS,
      platform: process.platform,
      architecture: process.arch,
    }),
  };
}

function compileLauncher(compilerPath: string): CompiledLauncher {
  const custody = inspectCompiler(compilerPath);
  const { compiler, compilerVersionDigest, compilationDigest } = custody;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-actor-capability-compiler-"));
  const sourcePath = path.join(directory, "launcher.c");
  const binaryPath = path.join(directory, "launcher");
  fs.writeFileSync(sourcePath, LAUNCHER_SOURCE, "utf8");
  const compile = spawnSync(compiler.path, [...COMPILER_ARGUMENTS, sourcePath, "-o", binaryPath], {
    cwd: directory,
    env: { ...COMPILER_ENVIRONMENT },
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (compile.error || compile.status !== 0) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw new Error(`capability launcher compilation failed: ${compile.error?.message ?? compile.stderr}`);
  }
  const sourceDigest = rawDigest(fs.readFileSync(sourcePath));
  if (sourceDigest !== ASOIAF_ANSWER_ACTOR_CAPABILITY_LAUNCHER_SOURCE_DIGEST) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw new Error("compiled capability launcher source differs from the product source digest");
  }
  const binaryDigest = rawDigest(fs.readFileSync(binaryPath));
  return {
    directory,
    sourcePath,
    binaryPath,
    sourceDigest,
    binaryDigest,
    compiler,
    compilerVersionDigest,
    compilationDigest,
    dispose: () => fs.rmSync(directory, { recursive: true, force: true }),
  };
}

function probeLauncher(binaryPath: string): number {
  const probe = spawnSync(binaryPath, ["--probe"], {
    cwd: os.tmpdir(),
    env: { ...COMPILER_ENVIRONMENT },
    encoding: "utf8",
    timeout: 5_000,
    maxBuffer: 1024 * 1024,
  });
  if (probe.error || probe.status !== 0) {
    throw new Error(`capability launcher kernel probe failed: ${probe.error?.message ?? probe.stderr}`);
  }
  const record = exactObject(JSON.parse(probe.stdout), ["format", "landlockAbi", "architecture"], "capability launcher probe");
  const landlockAbi = requireInteger(Number(record.landlockAbi), "Landlock ABI", MIN_LANDLOCK_ABI, 1024);
  if (record.format !== "axm-asoiaf-answer-actor-isolation-probe/1" || record.architecture !== "x64") {
    throw new Error("capability launcher kernel probe differs from the product contract");
  }
  return landlockAbi;
}

function validateCompiledAgainstPolicy(
  compiled: CompiledLauncher,
  policy: AsoiafAnswerActorCapabilityPolicy,
): void {
  if (
    compiled.sourceDigest !== policy.launcherSourceDigest
    || compiled.binaryDigest !== policy.launcherBinaryDigest
    || compiled.compiler.pathDigest !== policy.compilerPathDigest
    || compiled.compiler.digest !== policy.compilerDigest
    || compiled.compiler.bytes !== policy.compilerBytes
    || compiled.compilerVersionDigest !== policy.compilerVersionDigest
    || compiled.compilationDigest !== policy.compilationDigest
  ) {
    throw new Error("transient capability launcher or compiler differs from retained policy custody");
  }
}

export function retainAsoiafAnswerActorCapabilityPolicy(
  input: AsoiafAnswerActorCapabilityPolicyInput,
): { policy: AsoiafAnswerActorCapabilityPolicy; replayed: boolean } {
  requireLinuxX64();
  const { manifest, installation } = parentForPolicy(input.root, input.manifestId, input.installationId);
  const boundAt = requireTime(input.boundAt, "capability policy binding time");
  const operatorId = requireId(input.operatorId, "capability policy operator");
  if (Date.parse(boundAt) < Date.parse(installation.installedAt)) {
    throw new Error("capability policy binding precedes the adapter installation");
  }
  const executable = validateTransientExecutable(
    manifest,
    installation,
    input.executablePath,
  );
  const runtimeLoader = runtimeLoaderIdentity(executable.path);
  const compilerCustody = inspectCompiler(input.compilerPath);
  const kernelReleaseDigest = sha256(os.release());
  const limits = policyLimits(manifest);
  const existing = readAsoiafAnswerActorCapabilityStatus(input.root).policies.filter((entry) =>
    entry.manifestId === manifest.manifestId
    && entry.manifestFingerprint === manifest.manifestFingerprint
    && entry.installationId === installation.installationId
    && entry.installationFingerprint === installation.installationFingerprint
    && entry.hostId === installation.hostId
    && entry.kernelReleaseDigest === kernelReleaseDigest
    && entry.launcherSourceDigest === ASOIAF_ANSWER_ACTOR_CAPABILITY_LAUNCHER_SOURCE_DIGEST
    && entry.compilerPathDigest === compilerCustody.compiler.pathDigest
    && entry.compilerDigest === compilerCustody.compiler.digest
    && entry.compilerBytes === compilerCustody.compiler.bytes
    && entry.compilerVersionDigest === compilerCustody.compilerVersionDigest
    && entry.compilationDigest === compilerCustody.compilationDigest
    && entry.runtimeLoaderPathDigest === runtimeLoader.pathDigest
    && entry.runtimeLoaderDigest === runtimeLoader.digest
    && entry.runtimeLoaderBytes === runtimeLoader.bytes
    && entry.addressSpaceLimitBytes === limits.addressSpaceLimitBytes
    && entry.cpuSecondsLimit === limits.cpuSecondsLimit
    && entry.fileSizeLimitBytes === limits.fileSizeLimitBytes
    && entry.openFileLimit === limits.openFileLimit
    && entry.boundAt === boundAt
    && entry.operatorId === operatorId);
  if (existing.length > 1) throw new Error("capability policy replay is duplicated");
  if (existing[0]) return { policy: existing[0], replayed: true };
  const compiled = compileLauncher(input.compilerPath);
  try {
    if (compiled.compilationDigest !== compilerCustody.compilationDigest) {
      throw new Error("compiled capability launcher differs from inspected compiler custody");
    }
    const landlockAbi = probeLauncher(compiled.binaryPath);
    const core = {
      format: ASOIAF_ANSWER_ACTOR_CAPABILITY_POLICY_FORMAT,
      manifestId: manifest.manifestId,
      manifestFingerprint: manifest.manifestFingerprint,
      installationId: installation.installationId,
      installationFingerprint: installation.installationFingerprint,
      hostId: installation.hostId,
      platform: "linux" as const,
      architecture: "x64" as const,
      kernelReleaseDigest,
      landlockAbi,
      launcherSourceDigest: compiled.sourceDigest,
      launcherBinaryDigest: compiled.binaryDigest,
      compilerPathDigest: compiled.compiler.pathDigest,
      compilerDigest: compiled.compiler.digest,
      compilerBytes: compiled.compiler.bytes,
      compilerVersionDigest: compiled.compilerVersionDigest,
      compilationDigest: compiled.compilationDigest,
      runtimeLoaderPathDigest: runtimeLoader.pathDigest,
      runtimeLoaderDigest: runtimeLoader.digest,
      runtimeLoaderBytes: runtimeLoader.bytes,
      ...limits,
      noNewPrivileges: true as const,
      landlockFilesystemEnforced: true as const,
      seccompNetworkEnforced: true as const,
      seccompChildProcessEnforced: true as const,
      seccompProcessSignalEnforced: true as const,
      seccompInterprocessMemoryEnforced: true as const,
      executableScope: "manifest-executable-plus-runtime-loader" as const,
      runtimeLoaderExact: true as const,
      cloneThreadAdmitted: true as const,
      clone3Compatibility: "enosys-fallback" as const,
      environmentMode: "manifest-exact" as const,
      inputRelease: "after-isolation-attestation" as const,
      boundAt,
      operatorId,
      rawCompilerPathRetained: false as const,
      rawExecutablePathRetained: false as const,
      rawRuntimeLoaderPathRetained: false as const,
      rawAdapterBundlePathRetained: false as const,
      rawTaskInputRetained: false as const,
      rawTaskOutputRetained: false as const,
      policyAuthority: "kernel-capability-policy-only" as const,
      ...NO_AUTHORITY,
    };
    const policyFingerprint = sha256(core);
    const policy: AsoiafAnswerActorCapabilityPolicy = {
      ...core,
      policyId: collectorContentId("asoiaf-answer-actor-capability-policy", {
        installationId: installation.installationId,
        policyFingerprint,
      }),
      policyFingerprint,
    };
    const paths = asoiafAnswerActorCapabilityBrokerPaths(input.root);
    const persisted = writeExact(digestPath(paths.policies, policyFingerprint), policy);
    refreshState(input.root);
    return { policy: persisted.value, replayed: persisted.replayed };
  } finally {
    compiled.dispose();
  }
}

function parseIsolationReceipt(
  value: Buffer,
  policy: AsoiafAnswerActorCapabilityPolicy,
): AsoiafAnswerActorIsolationReceipt {
  const record = exactObject(JSON.parse(value.toString("utf8")), [
    "format",
    "landlockAbi",
    "noNewPrivileges",
    "landlockFilesystemEnforced",
    "seccompNetworkEnforced",
    "seccompChildProcessEnforced",
    "seccompProcessSignalEnforced",
    "seccompInterprocessMemoryEnforced",
    "executableScope",
    "runtimeLoaderExact",
    "cloneThreadAdmitted",
    "clone3Compatibility",
    "resourceLimitsEnforced",
    "addressSpaceLimitBytes",
    "cpuSecondsLimit",
    "fileSizeLimitBytes",
    "openFileLimit",
    "environmentMode",
    "inputReleased",
  ], "capability isolation receipt");
  const receipt: AsoiafAnswerActorIsolationReceipt = {
    format: record.format as typeof ASOIAF_ANSWER_ACTOR_ISOLATION_RECEIPT_FORMAT,
    landlockAbi: requireInteger(Number(record.landlockAbi), "isolation Landlock ABI", MIN_LANDLOCK_ABI, 1024),
    noNewPrivileges: record.noNewPrivileges as true,
    landlockFilesystemEnforced: record.landlockFilesystemEnforced as true,
    seccompNetworkEnforced: record.seccompNetworkEnforced as true,
    seccompChildProcessEnforced: record.seccompChildProcessEnforced as true,
    seccompProcessSignalEnforced: record.seccompProcessSignalEnforced as true,
    seccompInterprocessMemoryEnforced: record.seccompInterprocessMemoryEnforced as true,
    executableScope: record.executableScope as "manifest-executable-plus-runtime-loader",
    runtimeLoaderExact: record.runtimeLoaderExact as true,
    cloneThreadAdmitted: record.cloneThreadAdmitted as true,
    clone3Compatibility: record.clone3Compatibility as "enosys-fallback",
    resourceLimitsEnforced: record.resourceLimitsEnforced as true,
    addressSpaceLimitBytes: requireInteger(Number(record.addressSpaceLimitBytes), "isolation address-space limit", 1, Number.MAX_SAFE_INTEGER),
    cpuSecondsLimit: requireInteger(Number(record.cpuSecondsLimit), "isolation CPU limit", 1, 24 * 60 * 60),
    fileSizeLimitBytes: requireInteger(Number(record.fileSizeLimitBytes), "isolation file-size limit", 1, MAX_FILE_BYTES),
    openFileLimit: requireInteger(Number(record.openFileLimit), "isolation open-file limit", 4, 4096),
    environmentMode: record.environmentMode as "manifest-exact",
    inputReleased: record.inputReleased as false,
  };
  if (
    receipt.format !== ASOIAF_ANSWER_ACTOR_ISOLATION_RECEIPT_FORMAT
    || receipt.landlockAbi !== policy.landlockAbi
    || receipt.noNewPrivileges !== true
    || receipt.landlockFilesystemEnforced !== true
    || receipt.seccompNetworkEnforced !== true
    || receipt.seccompChildProcessEnforced !== true
    || receipt.seccompProcessSignalEnforced !== true
    || receipt.seccompInterprocessMemoryEnforced !== true
    || receipt.executableScope !== "manifest-executable-plus-runtime-loader"
    || receipt.runtimeLoaderExact !== true
    || receipt.cloneThreadAdmitted !== true
    || receipt.clone3Compatibility !== "enosys-fallback"
    || receipt.resourceLimitsEnforced !== true
    || receipt.addressSpaceLimitBytes !== policy.addressSpaceLimitBytes
    || receipt.cpuSecondsLimit !== policy.cpuSecondsLimit
    || receipt.fileSizeLimitBytes !== policy.fileSizeLimitBytes
    || receipt.openFileLimit !== policy.openFileLimit
    || receipt.environmentMode !== "manifest-exact"
    || receipt.inputReleased !== false
  ) {
    throw new Error("capability isolation receipt differs from retained policy custody");
  }
  return receipt;
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
    throw new Error("isolated adapter stdout is not valid JSON");
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
  ], "isolated adapter output evidence");
  const resultKind = requireId(String(record.resultKind ?? ""), "isolated adapter output result kind");
  if (!manifest.allowedResultKinds.includes(resultKind) || !acceptance.acceptedResultKinds.includes(resultKind)) {
    throw new Error("isolated adapter output result kind is outside manifest or assignment custody");
  }
  const evidence: AsoiafAnswerActorAdapterEvidence = {
    format: record.format as typeof ASOIAF_ANSWER_ACTOR_ADAPTER_OUTPUT_FORMAT,
    invocationId: String(record.invocationId ?? ""),
    invocationFingerprint: requireDigest(String(record.invocationFingerprint ?? ""), "output invocation fingerprint"),
    runtimeExecutionIntentId: String(record.runtimeExecutionIntentId ?? ""),
    runtimeExecutionIntentFingerprint: requireDigest(String(record.runtimeExecutionIntentFingerprint ?? ""), "output runtime intent fingerprint"),
    adapterId: String(record.adapterId ?? ""),
    adapterVersion: String(record.adapterVersion ?? ""),
    resultKind,
    outputDigest: requireDigest(String(record.outputDigest ?? ""), "isolated adapter output digest"),
    outputBytes: requireInteger(Number(record.outputBytes), "isolated adapter output byte count", 1, MAX_STREAM_BYTES),
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
    throw new Error("isolated adapter output evidence differs from invocation custody");
  }
  return evidence;
}

function startCore(input: {
  policy: AsoiafAnswerActorCapabilityPolicy;
  parent: ParentContext;
  startedAt: string;
  operatorId: string;
}): Omit<AsoiafAnswerActorCapabilityStart, "startId" | "startFingerprint"> {
  return {
    format: ASOIAF_ANSWER_ACTOR_CAPABILITY_START_FORMAT,
    policyId: input.policy.policyId,
    policyFingerprint: input.policy.policyFingerprint,
    invocationId: input.parent.invocation.invocationId,
    invocationFingerprint: input.parent.invocation.invocationFingerprint,
    manifestId: input.parent.manifest.manifestId,
    manifestFingerprint: input.parent.manifest.manifestFingerprint,
    installationId: input.parent.installation.installationId,
    installationFingerprint: input.parent.installation.installationFingerprint,
    runtimeExecutionIntentId: input.parent.invocation.runtimeExecutionIntentId,
    runtimeExecutionIntentFingerprint: input.parent.invocation.runtimeExecutionIntentFingerprint,
    providerResultId: input.parent.invocation.providerResultId,
    providerResultFingerprint: input.parent.invocation.providerResultFingerprint,
    commandDigest: commandDigest(input.policy, input.parent.manifest),
    environmentDigest: input.parent.manifest.environmentDigest,
    inputDigest: input.parent.invocation.inputDigest,
    inputBytes: input.parent.invocation.inputBytes,
    launcherSourceDigest: input.policy.launcherSourceDigest,
    launcherBinaryDigest: input.policy.launcherBinaryDigest,
    compilationDigest: input.policy.compilationDigest,
    kernelReleaseDigest: input.policy.kernelReleaseDigest,
    runtimeLoaderPathDigest: input.policy.runtimeLoaderPathDigest,
    runtimeLoaderDigest: input.policy.runtimeLoaderDigest,
    runtimeLoaderBytes: input.policy.runtimeLoaderBytes,
    startedAt: input.startedAt,
    operatorId: input.operatorId,
    shell: false,
    inheritEnvironment: false,
    workingDirectory: "ephemeral-empty",
    inputRelease: "after-isolation-attestation",
    rawInputRetained: false,
    rawCompilerPathRetained: false,
    rawExecutablePathRetained: false,
    rawRuntimeLoaderPathRetained: false,
    rawAdapterBundlePathRetained: false,
    startAuthority: "isolated-process-start-observation-only",
    ...NO_AUTHORITY,
  };
}

function prepareStart(
  input: AsoiafAnswerActorCapabilityStartInput,
): {
  start: AsoiafAnswerActorCapabilityStart;
  replayed: boolean;
  input: Buffer;
  executablePath: string;
  adapterBundlePath: string;
  runtimeLoaderPath: string;
  compiled: CompiledLauncher | null;
  policy: AsoiafAnswerActorCapabilityPolicy;
  parent: ParentContext;
} {
  requireLinuxX64();
  const policy = policyById(input.root, input.policyId);
  const parent = parentForInvocation(input.root, input.invocationId);
  if (
    policy.manifestId !== parent.manifest.manifestId
    || policy.manifestFingerprint !== parent.manifest.manifestFingerprint
    || policy.installationId !== parent.installation.installationId
    || policy.installationFingerprint !== parent.installation.installationFingerprint
    || policy.kernelReleaseDigest !== sha256(os.release())
  ) {
    throw new Error("actor capability policy differs from invocation or live kernel custody");
  }
  const compilerCustody = inspectCompiler(input.compilerPath);
  if (
    compilerCustody.compiler.pathDigest !== policy.compilerPathDigest
    || compilerCustody.compiler.digest !== policy.compilerDigest
    || compilerCustody.compiler.bytes !== policy.compilerBytes
    || compilerCustody.compilerVersionDigest !== policy.compilerVersionDigest
    || compilerCustody.compilationDigest !== policy.compilationDigest
  ) {
    throw new Error("transient capability compiler differs from retained policy custody");
  }
  const transient = validateTransientFiles(
    parent.manifest,
    parent.installation,
    input.executablePath,
    input.adapterBundlePath,
  );
  const runtimeLoader = runtimeLoaderIdentity(transient.executable.path);
  if (
    runtimeLoader.pathDigest !== policy.runtimeLoaderPathDigest
    || runtimeLoader.digest !== policy.runtimeLoaderDigest
    || runtimeLoader.bytes !== policy.runtimeLoaderBytes
  ) {
    throw new Error("transient ELF runtime loader differs from retained capability policy custody");
  }
  const rawInput = decodeInput(input.inputBase64, parent.manifest);
  if (rawDigest(rawInput) !== parent.invocation.inputDigest || rawInput.length !== parent.invocation.inputBytes) {
    throw new Error("transient capability input differs from runtime execution intent custody");
  }
  const startedAt = requireTime(input.startedAt, "capability process start time");
  if (
    Date.parse(startedAt) < Date.parse(parent.invocation.preparedAt)
    || Date.parse(startedAt) >= Date.parse(parent.invocation.expiresAt)
  ) {
    throw new Error("capability process start falls outside the invocation interval");
  }
  const core = startCore({
    policy,
    parent,
    startedAt,
    operatorId: requireId(input.operatorId, "capability start operator"),
  });
  const startFingerprint = sha256(core);
  const start: AsoiafAnswerActorCapabilityStart = {
    ...core,
    startId: collectorContentId("asoiaf-answer-actor-capability-start", {
      invocationId: parent.invocation.invocationId,
      startFingerprint,
    }),
    startFingerprint,
  };
  const existingStart = findStart(input.root, parent.invocation.invocationId);
  if (existingStart) {
    if (stableJson(existingStart) !== stableJson(start)) {
      throw new Error("actor capability invocation already has a different start receipt");
    }
    return {
      start: existingStart,
      replayed: true,
      input: rawInput,
      executablePath: transient.executable.path,
      adapterBundlePath: transient.bundle.path,
      runtimeLoaderPath: runtimeLoader.path,
      compiled: null,
      policy,
      parent,
    };
  }
  if (findTerminal(input.root, parent.invocation.invocationId)) {
    throw new Error("completed capability invocation is missing its retained start receipt");
  }
  const compiled = compileLauncher(input.compilerPath);
  try {
    validateCompiledAgainstPolicy(compiled, policy);
    if (probeLauncher(compiled.binaryPath) !== policy.landlockAbi) {
      throw new Error("live capability Landlock ABI differs from retained policy custody");
    }
    const paths = asoiafAnswerActorCapabilityBrokerPaths(input.root);
    const persisted = writeExact(digestPath(paths.starts, startFingerprint), start);
    refreshState(input.root);
    return {
      start: persisted.value,
      replayed: persisted.replayed,
      input: rawInput,
      executablePath: transient.executable.path,
      adapterBundlePath: transient.bundle.path,
      runtimeLoaderPath: runtimeLoader.path,
      compiled,
      policy,
      parent,
    };
  } catch (error) {
    compiled.dispose();
    throw error;
  }
}

export function startAsoiafAnswerActorCapabilityInvocation(
  input: AsoiafAnswerActorCapabilityStartInput,
): { start: AsoiafAnswerActorCapabilityStart; replayed: boolean } {
  const prepared = prepareStart(input);
  prepared.compiled?.dispose();
  return { start: prepared.start, replayed: prepared.replayed };
}

async function runIsolatedProcess(input: {
  launcherPath: string;
  policy: AsoiafAnswerActorCapabilityPolicy;
  executablePath: string;
  adapterBundlePath: string;
  runtimeLoaderPath: string;
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
    const attestationChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let attestationBytes = 0;
    let isolationReceipt: AsoiafAnswerActorIsolationReceipt | null = null;
    let isolationError: string | null = null;
    let adapterInputReleased = false;
    let timedOut = false;
    let outputLimitExceeded = false;
    let spawnError: string | null = null;
    let settled = false;
    let timer: NodeJS.Timeout | null = null;
    const child = spawn(input.launcherPath, [
      input.executablePath,
      input.adapterBundlePath,
      input.runtimeLoaderPath,
      String(input.policy.addressSpaceLimitBytes),
      String(input.policy.cpuSecondsLimit),
      String(input.policy.fileSizeLimitBytes),
      String(input.policy.openFileLimit),
      "--",
      ...input.arguments,
    ], {
      cwd: input.cwd,
      env: input.environment,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe", "pipe"],
    });
    const attestation = child.stdio[3];
    const finish = (exitCode: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (!isolationReceipt && !isolationError) {
        isolationError = "capability launcher exited without a valid isolation attestation";
      }
      resolve({
        exitCode,
        signal,
        stdoutDigest: `sha256:${stdoutHash.digest("hex")}`,
        stdoutBytes,
        stderrDigest: `sha256:${stderrHash.digest("hex")}`,
        stderrBytes,
        stdoutBuffer: Buffer.concat(stdoutChunks),
        isolationReceipt,
        isolationError,
        adapterInputReleased,
        timedOut,
        outputLimitExceeded,
        spawnError,
        completedAt: new Date().toISOString(),
      });
    };
    const refuseIsolation = (reason: string) => {
      if (!isolationError) isolationError = reason;
      child.kill("SIGKILL");
    };
    child.stdout?.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      stdoutHash.update(buffer);
      stdoutBytes += buffer.length;
      if (stdoutBytes <= input.maxStdoutBytes) stdoutChunks.push(buffer);
      else if (!outputLimitExceeded) {
        outputLimitExceeded = true;
        child.kill("SIGKILL");
      }
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      stderrHash.update(buffer);
      stderrBytes += buffer.length;
      if (stderrBytes > input.maxStderrBytes && !outputLimitExceeded) {
        outputLimitExceeded = true;
        child.kill("SIGKILL");
      }
    });
    if (!attestation || typeof attestation.on !== "function") {
      refuseIsolation("capability launcher attestation pipe is unavailable");
    } else {
      attestation.on("data", (chunk: Buffer | string) => {
        if (isolationReceipt || isolationError) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        attestationBytes += buffer.length;
        if (attestationBytes > MAX_ATTESTATION_BYTES) {
          refuseIsolation("capability launcher attestation exceeds its byte ceiling");
          return;
        }
        attestationChunks.push(buffer);
        const combined = Buffer.concat(attestationChunks);
        const newline = combined.indexOf(0x0a);
        if (newline < 0) return;
        if (combined.subarray(newline + 1).toString("utf8").trim().length > 0) {
          refuseIsolation("capability launcher emitted trailing attestation content");
          return;
        }
        try {
          isolationReceipt = parseIsolationReceipt(combined.subarray(0, newline), input.policy);
          adapterInputReleased = true;
          child.stdin?.end(input.stdin);
        } catch (error) {
          refuseIsolation(error instanceof Error ? error.message : String(error));
        }
      });
    }
    child.on("error", (error) => {
      spawnError = error.message;
      finish(null, null);
    });
    child.on("close", (code, signal) => finish(code, signal));
    timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, input.timeoutMilliseconds);
    child.stdin?.on("error", () => undefined);
  });
}

function buildTerminal(input: {
  start: AsoiafAnswerActorCapabilityStart;
  parent: ParentContext;
  outcome: AsoiafAnswerActorCapabilityTerminalOutcome;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  completedAt: string;
  stdoutDigest: `sha256:${string}`;
  stdoutBytes: number;
  stderrDigest: `sha256:${string}`;
  stderrBytes: number;
  isolationReceipt: AsoiafAnswerActorIsolationReceipt | null;
  evidence: AsoiafAnswerActorAdapterEvidence | null;
  recoveryReason: string | null;
  processLaunched: boolean;
  adapterInputReleased: boolean;
  timedOut: boolean;
  outputLimitExceeded: boolean;
}): AsoiafAnswerActorCapabilityTerminal {
  const completedAt = requireTime(input.completedAt, "capability terminal completion time");
  const core = {
    format: ASOIAF_ANSWER_ACTOR_CAPABILITY_TERMINAL_FORMAT,
    startId: input.start.startId,
    startFingerprint: input.start.startFingerprint,
    policyId: input.start.policyId,
    policyFingerprint: input.start.policyFingerprint,
    invocationId: input.parent.invocation.invocationId,
    invocationFingerprint: input.parent.invocation.invocationFingerprint,
    manifestId: input.parent.manifest.manifestId,
    manifestFingerprint: input.parent.manifest.manifestFingerprint,
    installationId: input.parent.installation.installationId,
    installationFingerprint: input.parent.installation.installationFingerprint,
    runtimeExecutionIntentId: input.parent.invocation.runtimeExecutionIntentId,
    runtimeExecutionIntentFingerprint: input.parent.invocation.runtimeExecutionIntentFingerprint,
    providerResultId: input.parent.invocation.providerResultId,
    providerResultFingerprint: input.parent.invocation.providerResultFingerprint,
    outcome: input.outcome,
    exitCode: input.exitCode,
    signal: input.signal,
    startedAt: input.start.startedAt,
    completedAt,
    durationMilliseconds: Math.max(0, Date.parse(completedAt) - Date.parse(input.start.startedAt)),
    stdoutDigest: input.stdoutDigest,
    stdoutBytes: input.stdoutBytes,
    stderrDigest: input.stderrDigest,
    stderrBytes: input.stderrBytes,
    isolationReceipt: input.isolationReceipt,
    isolationReceiptDigest: input.isolationReceipt ? sha256(input.isolationReceipt) : null,
    adapterEvidence: input.evidence,
    recoveryReason: input.recoveryReason,
    processLaunched: input.processLaunched,
    adapterInputReleased: input.adapterInputReleased,
    timedOut: input.timedOut,
    outputLimitExceeded: input.outputLimitExceeded,
    rawInputRetained: false as const,
    rawStdoutRetained: false as const,
    rawStderrRetained: false as const,
    rawTaskOutputRetained: false as const,
    taskOutcomeDeclared: false as const,
    osIsolationEnforced: input.isolationReceipt !== null,
    terminalAuthority: "kernel-isolation-observation-only" as const,
    ...NO_AUTHORITY,
  };
  const terminalFingerprint = sha256(core);
  return {
    ...core,
    terminalId: collectorContentId("asoiaf-answer-actor-capability-terminal", {
      invocationId: input.parent.invocation.invocationId,
      terminalFingerprint,
    }),
    terminalFingerprint,
  };
}

function persistTerminal(
  root: string,
  terminal: AsoiafAnswerActorCapabilityTerminal,
): { terminal: AsoiafAnswerActorCapabilityTerminal; replayed: boolean } {
  const existing = findTerminal(root, terminal.invocationId);
  if (existing && stableJson(existing) !== stableJson(terminal)) {
    throw new Error("actor capability invocation already has a different terminal receipt");
  }
  const paths = asoiafAnswerActorCapabilityBrokerPaths(root);
  const persisted = writeExact(digestPath(paths.terminals, terminal.terminalFingerprint), terminal);
  const terminals = readAsoiafAnswerActorCapabilityStatus(root).terminals.filter(
    (entry) => entry.invocationId === terminal.invocationId,
  );
  if (terminals.length !== 1) throw new Error("actor capability invocation acquired multiple terminal receipts");
  refreshState(root);
  return { terminal: persisted.value, replayed: persisted.replayed };
}

export async function executeAsoiafAnswerActorCapabilityInvocation(
  input: AsoiafAnswerActorCapabilityExecuteInput,
): Promise<{
  start: AsoiafAnswerActorCapabilityStart;
  terminal: AsoiafAnswerActorCapabilityTerminal;
  startReplayed: boolean;
  terminalReplayed: boolean;
  processLaunched: boolean;
}> {
  const existingTerminal = findTerminal(input.root, input.invocationId);
  const prepared = prepareStart(input);
  if (existingTerminal) {
    prepared.compiled?.dispose();
    return {
      start: prepared.start,
      terminal: existingTerminal,
      startReplayed: true,
      terminalReplayed: true,
      processLaunched: false,
    };
  }
  if (prepared.replayed || !prepared.compiled) {
    throw new Error("actor capability invocation has a retained start without a terminal; recover it before retrying execution");
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-actor-capability-cwd-"));
  try {
    const envelope = Buffer.from(`${JSON.stringify(inputEnvelope(prepared.parent.invocation, prepared.input))}\n`, "utf8");
    const run = await runIsolatedProcess({
      launcherPath: prepared.compiled.binaryPath,
      policy: prepared.policy,
      executablePath: prepared.executablePath,
      adapterBundlePath: prepared.adapterBundlePath,
      runtimeLoaderPath: prepared.runtimeLoaderPath,
      arguments: expandedArguments(prepared.parent.manifest, prepared.adapterBundlePath),
      environment: prepared.parent.manifest.fixedEnvironment,
      cwd: temporary,
      stdin: envelope,
      timeoutMilliseconds: Math.max(
        1,
        Math.min(
          prepared.parent.manifest.timeoutMilliseconds,
          Date.parse(prepared.parent.invocation.expiresAt) - Date.parse(prepared.start.startedAt),
        ),
      ),
      maxStdoutBytes: prepared.parent.manifest.maxStdoutBytes,
      maxStderrBytes: prepared.parent.manifest.maxStderrBytes,
    });
    let outcome: AsoiafAnswerActorCapabilityTerminalOutcome;
    let evidence: AsoiafAnswerActorAdapterEvidence | null = null;
    let recoveryReason: string | null = null;
    if (!run.isolationReceipt) {
      outcome = "isolation-refused";
      recoveryReason = run.isolationError ?? run.spawnError ?? "capability launcher did not establish the retained kernel boundary";
    } else if (run.timedOut) {
      outcome = "timed-out";
      recoveryReason = "isolated adapter process exceeded the manifest timeout";
    } else if (run.outputLimitExceeded) {
      outcome = "protocol-refused";
      recoveryReason = "isolated adapter process exceeded a retained stream ceiling";
    } else if (run.spawnError) {
      outcome = "failed";
      recoveryReason = `capability launcher could not start: ${run.spawnError}`;
    } else if (run.exitCode !== 0) {
      outcome = "failed";
      recoveryReason = `isolated adapter process exited with code ${run.exitCode ?? "null"}`;
    } else {
      try {
        evidence = parseAdapterEvidence(
          run.stdoutBuffer,
          prepared.parent.invocation,
          prepared.parent.manifest,
          prepared.parent.acceptance,
        );
        outcome = "succeeded";
      } catch (error) {
        outcome = "protocol-refused";
        recoveryReason = error instanceof Error ? error.message : String(error);
      }
    }
    const terminal = buildTerminal({
      start: prepared.start,
      parent: prepared.parent,
      outcome,
      exitCode: run.exitCode,
      signal: run.signal,
      completedAt: run.completedAt,
      stdoutDigest: run.stdoutDigest,
      stdoutBytes: run.stdoutBytes,
      stderrDigest: run.stderrDigest,
      stderrBytes: run.stderrBytes,
      isolationReceipt: run.isolationReceipt,
      evidence,
      recoveryReason,
      processLaunched: true,
      adapterInputReleased: run.adapterInputReleased,
      timedOut: run.timedOut,
      outputLimitExceeded: run.outputLimitExceeded,
    });
    const persisted = persistTerminal(input.root, terminal);
    return {
      start: prepared.start,
      terminal: persisted.terminal,
      startReplayed: false,
      terminalReplayed: persisted.replayed,
      processLaunched: true,
    };
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
    prepared.compiled.dispose();
  }
}

export function recoverAsoiafAnswerActorCapabilityInvocation(
  input: AsoiafAnswerActorCapabilityRecoverInput,
): { terminal: AsoiafAnswerActorCapabilityTerminal; replayed: boolean } {
  const start = findStart(input.root, input.invocationId);
  if (!start) throw new Error("actor capability invocation has no retained start to recover");
  const existing = findTerminal(input.root, input.invocationId);
  if (existing) {
    if (existing.outcome !== "interrupted") {
      throw new Error("actor capability invocation already has a non-interrupted terminal receipt");
    }
    return { terminal: existing, replayed: true };
  }
  const parent = parentForInvocation(input.root, input.invocationId);
  const recoveredAt = requireTime(input.recoveredAt, "capability recovery time");
  if (Date.parse(recoveredAt) < Date.parse(start.startedAt)) {
    throw new Error("capability recovery precedes the retained process start");
  }
  const terminal = buildTerminal({
    start,
    parent,
    outcome: "interrupted",
    exitCode: null,
    signal: null,
    completedAt: recoveredAt,
    stdoutDigest: EMPTY_DIGEST,
    stdoutBytes: 0,
    stderrDigest: EMPTY_DIGEST,
    stderrBytes: 0,
    isolationReceipt: null,
    evidence: null,
    recoveryReason: requireReason(input.reason, "capability recovery reason"),
    processLaunched: false,
    adapterInputReleased: false,
    timedOut: false,
    outputLimitExceeded: false,
  });
  return persistTerminal(input.root, terminal);
}

function noAuthorityValid(value: NoAuthority): boolean {
  return value.authority === "none"
    && value.graphEffect === "none"
    && value.canonEffect === "none"
    && value.answerEffect === "none";
}

function verifyDigestDirectory(input: {
  directory: string;
  values: readonly Record<string, unknown>[];
  fingerprintKey: string;
  code: string;
  findings: AsoiafAnswerActorCapabilityFinding[];
}): void {
  const expected = new Set(input.values.map((entry) => {
    const fingerprint = String(entry[input.fingerprintKey] ?? "");
    return `${fingerprint.slice("sha256:".length)}.json`;
  }));
  const actual = fs.existsSync(input.directory)
    ? fs.readdirSync(input.directory).filter((name) => name.endsWith(".json"))
    : [];
  for (const name of actual) {
    if (!/^[a-f0-9]{64}\.json$/.test(name) || !expected.has(name)) {
      input.findings.push(finding(input.code, "error", name, "capability digest directory contains an unbound file"));
    }
  }
}

function secretFindings(root: string): AsoiafAnswerActorCapabilityFinding[] {
  const paths = asoiafAnswerActorCapabilityBrokerPaths(root);
  if (!fs.existsSync(paths.brokerRoot)) return [];
  const findings: AsoiafAnswerActorCapabilityFinding[] = [];
  const names = /(?:^|[._-])(?:cert|certificate|credential|key|pass|password|pin|secret|session|token)(?:[._-]|$)|\.(?:cer|crt|csr|key|p12|pfx|pem)$/i;
  const content = /-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----|-----BEGIN CERTIFICATE(?: REQUEST)?-----|pkcs11:|(?:password|secret|token|session|pin)\s*[=:]/i;
  const visit = (target: string) => {
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      const child = path.join(target, entry.name);
      if (names.test(entry.name)) {
        findings.push(finding("capability-secret-path", "error", child, "capability estate contains a credential-bearing path"));
      }
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile() && fs.statSync(child).size <= 4 * 1024 * 1024) {
        const value = fs.readFileSync(child, "utf8");
        if (content.test(value)) {
          findings.push(finding("capability-secret-content", "error", child, "capability estate contains credential-bearing content"));
        }
      }
    }
  };
  visit(paths.brokerRoot);
  return findings;
}

function checkAuthority(
  value: NoAuthority,
  subjectId: string,
  findings: AsoiafAnswerActorCapabilityFinding[],
): void {
  if (!noAuthorityValid(value)) {
    findings.push(finding("capability-authority", "error", subjectId, "capability object claims graph, canon, answer, or other authority"));
  }
}

export function verifyAsoiafAnswerActorCapabilityBrokerEstate(
  root: string,
): AsoiafAnswerActorCapabilityFinding[] {
  const findings: AsoiafAnswerActorCapabilityFinding[] = [];
  const status = readAsoiafAnswerActorCapabilityStatus(root);
  const adapter = readAsoiafAnswerActorAdapterHostStatus(root);
  const runtime = readAsoiafAnswerActorRuntimeStatus(root);
  for (const parentFinding of verifyAsoiafAnswerActorAdapterHostEstate(root)) {
    findings.push(finding(
      `capability-parent-${parentFinding.code}`,
      parentFinding.severity,
      parentFinding.subjectId,
      parentFinding.detail,
    ));
  }
  const policyIds = new Set<string>();
  for (const policy of status.policies) {
    if (
      policy.format !== ASOIAF_ANSWER_ACTOR_CAPABILITY_POLICY_FORMAT
      || !fingerprintMatches(policy as unknown as Record<string, unknown>, "policyId", "policyFingerprint")
    ) {
      findings.push(finding("capability-policy-fingerprint", "error", policy.policyId, "capability policy format or fingerprint is stale"));
    }
    if (policyIds.has(policy.policyId)) {
      findings.push(finding("capability-policy-duplicate", "error", policy.policyId, "capability policy id is duplicated"));
    }
    policyIds.add(policy.policyId);
    const manifest = adapter.manifests.find((entry) => entry.manifestId === policy.manifestId);
    const installation = adapter.installations.find((entry) => entry.installationId === policy.installationId);
    const limits = manifest ? policyLimits(manifest) : null;
    if (
      !manifest
      || !installation
      || policy.manifestFingerprint !== manifest.manifestFingerprint
      || policy.installationFingerprint !== installation.installationFingerprint
      || installation.manifestId !== manifest.manifestId
      || installation.hostId !== policy.hostId
      || policy.platform !== "linux"
      || policy.architecture !== "x64"
      || policy.launcherSourceDigest !== ASOIAF_ANSWER_ACTOR_CAPABILITY_LAUNCHER_SOURCE_DIGEST
      || !/^sha256:[a-f0-9]{64}$/.test(policy.runtimeLoaderPathDigest)
      || !/^sha256:[a-f0-9]{64}$/.test(policy.runtimeLoaderDigest)
      || !Number.isSafeInteger(policy.runtimeLoaderBytes)
      || policy.runtimeLoaderBytes < 1
      || policy.runtimeLoaderBytes > MAX_FILE_BYTES
      || !limits
      || policy.addressSpaceLimitBytes !== limits.addressSpaceLimitBytes
      || policy.cpuSecondsLimit !== limits.cpuSecondsLimit
      || policy.fileSizeLimitBytes !== limits.fileSizeLimitBytes
      || policy.openFileLimit !== limits.openFileLimit
      || policy.landlockAbi < MIN_LANDLOCK_ABI
      || !policy.noNewPrivileges
      || !policy.landlockFilesystemEnforced
      || !policy.seccompNetworkEnforced
      || !policy.seccompChildProcessEnforced
      || !policy.seccompProcessSignalEnforced
      || !policy.seccompInterprocessMemoryEnforced
      || policy.executableScope !== "manifest-executable-plus-runtime-loader"
      || !policy.runtimeLoaderExact
      || !policy.cloneThreadAdmitted
      || policy.clone3Compatibility !== "enosys-fallback"
      || policy.environmentMode !== "manifest-exact"
      || policy.inputRelease !== "after-isolation-attestation"
    ) {
      findings.push(finding("capability-policy-parent", "error", policy.policyId, "capability policy differs from adapter or kernel contract custody"));
    }
    if (
      policy.rawCompilerPathRetained
      || policy.rawExecutablePathRetained
      || policy.rawRuntimeLoaderPathRetained
      || policy.rawAdapterBundlePathRetained
      || policy.rawTaskInputRetained
      || policy.rawTaskOutputRetained
      || policy.policyAuthority !== "kernel-capability-policy-only"
    ) {
      findings.push(finding("capability-policy-retention", "error", policy.policyId, "capability policy crossed path, task, or authority retention boundary"));
    }
    checkAuthority(policy, policy.policyId, findings);
  }
  const startInvocations = new Set<string>();
  for (const start of status.starts) {
    if (
      start.format !== ASOIAF_ANSWER_ACTOR_CAPABILITY_START_FORMAT
      || !fingerprintMatches(start as unknown as Record<string, unknown>, "startId", "startFingerprint")
    ) {
      findings.push(finding("capability-start-fingerprint", "error", start.startId, "capability start format or fingerprint is stale"));
    }
    if (startInvocations.has(start.invocationId)) {
      findings.push(finding("capability-start-duplicate", "error", start.startId, "adapter invocation has multiple capability starts"));
    }
    startInvocations.add(start.invocationId);
    const policy = status.policies.find((entry) => entry.policyId === start.policyId);
    const invocation = adapter.invocations.find((entry) => entry.invocationId === start.invocationId);
    const manifest = invocation ? adapter.manifests.find((entry) => entry.manifestId === invocation.manifestId) : null;
    const installation = invocation ? adapter.installations.find((entry) => entry.installationId === invocation.installationId) : null;
    if (
      !policy
      || !invocation
      || !manifest
      || !installation
      || start.policyFingerprint !== policy.policyFingerprint
      || start.invocationFingerprint !== invocation.invocationFingerprint
      || start.manifestId !== manifest.manifestId
      || start.manifestFingerprint !== manifest.manifestFingerprint
      || start.installationId !== installation.installationId
      || start.installationFingerprint !== installation.installationFingerprint
      || start.runtimeExecutionIntentId !== invocation.runtimeExecutionIntentId
      || start.runtimeExecutionIntentFingerprint !== invocation.runtimeExecutionIntentFingerprint
      || start.providerResultId !== invocation.providerResultId
      || start.providerResultFingerprint !== invocation.providerResultFingerprint
      || start.commandDigest !== commandDigest(policy, manifest)
      || start.environmentDigest !== manifest.environmentDigest
      || start.inputDigest !== invocation.inputDigest
      || start.inputBytes !== invocation.inputBytes
      || start.launcherSourceDigest !== policy.launcherSourceDigest
      || start.launcherBinaryDigest !== policy.launcherBinaryDigest
      || start.compilationDigest !== policy.compilationDigest
      || start.kernelReleaseDigest !== policy.kernelReleaseDigest
      || start.runtimeLoaderPathDigest !== policy.runtimeLoaderPathDigest
      || start.runtimeLoaderDigest !== policy.runtimeLoaderDigest
      || start.runtimeLoaderBytes !== policy.runtimeLoaderBytes
      || Date.parse(start.startedAt) < Date.parse(invocation.preparedAt)
      || Date.parse(start.startedAt) >= Date.parse(invocation.expiresAt)
    ) {
      findings.push(finding("capability-start-parent", "error", start.startId, "capability start differs from policy or invocation custody"));
    }
    if (adapter.starts.some((entry) => entry.invocationId === start.invocationId)
      || adapter.terminals.some((entry) => entry.invocationId === start.invocationId)) {
      findings.push(finding("capability-start-nonisolated-conflict", "error", start.startId, "parent adapter host also started or completed the invocation"));
    }
    if (
      start.shell
      || start.inheritEnvironment
      || start.workingDirectory !== "ephemeral-empty"
      || start.inputRelease !== "after-isolation-attestation"
      || start.rawInputRetained
      || start.rawCompilerPathRetained
      || start.rawExecutablePathRetained
      || start.rawRuntimeLoaderPathRetained
      || start.rawAdapterBundlePathRetained
      || start.startAuthority !== "isolated-process-start-observation-only"
    ) {
      findings.push(finding("capability-start-retention", "error", start.startId, "capability start crossed process, path, input, or authority boundary"));
    }
    checkAuthority(start, start.startId, findings);
  }
  const terminalInvocations = new Set<string>();
  for (const terminal of status.terminals) {
    if (
      terminal.format !== ASOIAF_ANSWER_ACTOR_CAPABILITY_TERMINAL_FORMAT
      || !fingerprintMatches(terminal as unknown as Record<string, unknown>, "terminalId", "terminalFingerprint")
    ) {
      findings.push(finding("capability-terminal-fingerprint", "error", terminal.terminalId, "capability terminal format or fingerprint is stale"));
    }
    if (terminalInvocations.has(terminal.invocationId)) {
      findings.push(finding("capability-terminal-duplicate", "error", terminal.terminalId, "adapter invocation has multiple capability terminals"));
    }
    terminalInvocations.add(terminal.invocationId);
    const start = status.starts.find((entry) => entry.startId === terminal.startId);
    const policy = status.policies.find((entry) => entry.policyId === terminal.policyId);
    const invocation = adapter.invocations.find((entry) => entry.invocationId === terminal.invocationId);
    const manifest = invocation ? adapter.manifests.find((entry) => entry.manifestId === invocation.manifestId) : null;
    const acceptance = invocation ? runtime.acceptances.find((entry) => entry.acceptanceId === invocation.runtimeAcceptanceId) : null;
    if (
      !start
      || !policy
      || !invocation
      || !manifest
      || !acceptance
      || terminal.startFingerprint !== start.startFingerprint
      || terminal.policyFingerprint !== policy.policyFingerprint
      || terminal.invocationFingerprint !== invocation.invocationFingerprint
      || terminal.manifestId !== invocation.manifestId
      || terminal.manifestFingerprint !== invocation.manifestFingerprint
      || terminal.installationId !== invocation.installationId
      || terminal.installationFingerprint !== invocation.installationFingerprint
      || terminal.runtimeExecutionIntentId !== invocation.runtimeExecutionIntentId
      || terminal.runtimeExecutionIntentFingerprint !== invocation.runtimeExecutionIntentFingerprint
      || terminal.providerResultId !== invocation.providerResultId
      || terminal.providerResultFingerprint !== invocation.providerResultFingerprint
      || terminal.startedAt !== start.startedAt
      || Date.parse(terminal.completedAt) < Date.parse(start.startedAt)
      || (terminal.outcome === "succeeded" && Date.parse(terminal.completedAt) > Date.parse(invocation.expiresAt))
      || terminal.durationMilliseconds !== Math.max(0, Date.parse(terminal.completedAt) - Date.parse(start.startedAt))
    ) {
      findings.push(finding("capability-terminal-parent", "error", terminal.terminalId, "capability terminal differs from start or invocation custody"));
    }
    if (terminal.isolationReceipt) {
      try {
        if (!policy || sha256(terminal.isolationReceipt) !== terminal.isolationReceiptDigest) throw new Error("receipt digest mismatch");
        parseIsolationReceipt(Buffer.from(JSON.stringify(terminal.isolationReceipt), "utf8"), policy);
      } catch {
        findings.push(finding("capability-terminal-isolation", "error", terminal.terminalId, "capability terminal has stale isolation evidence"));
      }
    } else if (terminal.isolationReceiptDigest !== null) {
      findings.push(finding("capability-terminal-isolation-digest", "error", terminal.terminalId, "capability terminal retains an isolation digest without a receipt"));
    }
    if (terminal.outcome === "succeeded") {
      if (
        !terminal.adapterEvidence
        || !terminal.isolationReceipt
        || !terminal.osIsolationEnforced
        || !terminal.adapterInputReleased
        || terminal.exitCode !== 0
        || terminal.timedOut
        || terminal.outputLimitExceeded
      ) {
        findings.push(finding("capability-terminal-success", "error", terminal.terminalId, "successful capability terminal lacks exact isolation or adapter evidence"));
      }
    } else if (terminal.adapterEvidence !== null) {
      findings.push(finding("capability-terminal-failure-evidence", "error", terminal.terminalId, "non-successful capability terminal retained success evidence"));
    }
    if (terminal.outcome === "isolation-refused" && (terminal.isolationReceipt || terminal.osIsolationEnforced || terminal.adapterInputReleased)) {
      findings.push(finding("capability-terminal-isolation-refusal", "error", terminal.terminalId, "isolation refusal claims an established boundary or released input"));
    }
    if (terminal.outcome === "interrupted" && (terminal.processLaunched || terminal.adapterInputReleased || terminal.osIsolationEnforced)) {
      findings.push(finding("capability-terminal-interrupted", "error", terminal.terminalId, "recovered capability terminal claims process, input, or isolation execution"));
    }
    if (
      terminal.rawInputRetained
      || terminal.rawStdoutRetained
      || terminal.rawStderrRetained
      || terminal.rawTaskOutputRetained
      || terminal.taskOutcomeDeclared
      || terminal.terminalAuthority !== "kernel-isolation-observation-only"
    ) {
      findings.push(finding("capability-terminal-retention", "error", terminal.terminalId, "capability terminal crossed raw-data, task-outcome, or authority boundary"));
    }
    if (invocation) {
      const runtimeResult = runtime.results.find(
        (entry) => entry.executionIntentId === invocation.runtimeExecutionIntentId,
      ) ?? null;
      if (terminal.outcome === "succeeded" && terminal.adapterEvidence) {
        if (!runtimeResult) {
          findings.push(finding("capability-terminal-awaiting-runtime-result", "notice", terminal.terminalId, "isolated digest evidence has not yet been admitted as a typed runtime result"));
        } else if (
          runtimeResult.providerResultId !== invocation.providerResultId
          || runtimeResult.providerResultFingerprint !== invocation.providerResultFingerprint
          || runtimeResult.outputDigest !== terminal.adapterEvidence.outputDigest
          || runtimeResult.outputBytes !== terminal.adapterEvidence.outputBytes
          || Date.parse(runtimeResult.completedAt) < Date.parse(terminal.completedAt)
        ) {
          findings.push(finding("capability-terminal-runtime-result", "error", terminal.terminalId, "typed runtime result differs from isolated adapter evidence"));
        }
      } else if (runtimeResult) {
        findings.push(finding("capability-terminal-runtime-contradiction", "error", terminal.terminalId, "runtime retained a typed result for a non-successful isolated process"));
      }
    }
    checkAuthority(terminal, terminal.terminalId, findings);
  }
  for (const start of status.starts) {
    if (!status.terminals.some((entry) => entry.invocationId === start.invocationId)) {
      findings.push(finding("capability-start-incomplete", "warning", start.startId, "capability start has no terminal receipt and requires recovery"));
    }
  }
  verifyDigestDirectory({
    directory: status.paths.policies,
    values: status.policies as unknown as Record<string, unknown>[],
    fingerprintKey: "policyFingerprint",
    code: "capability-policy-file",
    findings,
  });
  verifyDigestDirectory({
    directory: status.paths.starts,
    values: status.starts as unknown as Record<string, unknown>[],
    fingerprintKey: "startFingerprint",
    code: "capability-start-file",
    findings,
  });
  verifyDigestDirectory({
    directory: status.paths.terminals,
    values: status.terminals as unknown as Record<string, unknown>[],
    fingerprintKey: "terminalFingerprint",
    code: "capability-terminal-file",
    findings,
  });
  const expectedState = buildState(root);
  if (stableJson(status.state) !== stableJson(expectedState)) {
    findings.push(finding("capability-state", "error", status.paths.state, "capability state differs from append-only receipts"));
  }
  findings.push(...secretFindings(root));
  return sortedFindings(findings);
}
