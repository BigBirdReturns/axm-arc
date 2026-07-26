import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const GENERATE_SBOM = join(ROOT, "scripts/supply-chain/generate-cyclonedx.mjs");
const GENERATE_PROVENANCE = join(ROOT, "scripts/supply-chain/generate-provenance.mjs");
const VERIFY = join(ROOT, "scripts/supply-chain/verify-offline-evidence.mjs");
const ARC_SHA = "0123456789abcdef0123456789abcdef01234567";
const WORKFLOW = "BigBirdReturns/axm-arc/.github/workflows/supply-chain-evidence.yml@refs/pull/163/merge";

function run(script: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  return spawnSync(process.execPath, [script, ...args], { cwd: ROOT, env, encoding: "utf8" });
}
function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
function writeLedger(dir: string, names: string[]): void {
  writeFileSync(join(dir, "SHA256SUMS"), [...names.sort().map((name) => `${sha256(join(dir, name))}  ${name}`), ""].join("\n"));
}
function installFakeGh(bin: string, capture: string): void {
  mkdirSync(bin, { recursive: true });
  if (process.platform === "win32") {
    writeFileSync(join(bin, "gh.cmd"), `@echo off\r\necho %* > "${capture}"\r\nexit /b 0\r\n`);
    return;
  }
  const path = join(bin, "gh");
  writeFileSync(path, `#!/bin/sh\nprintf '%s\\n' "$@" > "$FAKE_GH_ARGS"\nexit 0\n`);
  chmodSync(path, 0o755);
}
function buildEvidence() {
  const dir = mkdtempSync(join(tmpdir(), "axm-arc-evidence-"));
  mkdirSync(join(dir, "artifacts"), { recursive: true });
  mkdirSync(join(dir, "sbom"), { recursive: true });
  mkdirSync(join(dir, "attestations"), { recursive: true });
  const artifact = join(dir, "artifacts", "axm-arc-game.tar.gz");
  const sbom = join(dir, "sbom", "axm-arc.cdx.json");
  const provenance = join(dir, "provenance.intoto.json");
  writeFileSync(artifact, "exact-arc-product");
  expect(run(GENERATE_SBOM, [
    "--lock", join(ROOT, "package-lock.json"), "--package", join(ROOT, "package.json"),
    "--commit", ARC_SHA, "--output", sbom,
  ]).status).toBe(0);
  expect(run(GENERATE_PROVENANCE, [
    "--subject", artifact, "--output", provenance,
    "--repository", "BigBirdReturns/axm-arc", "--commit", ARC_SHA,
    "--ref", "refs/pull/163/merge", "--workflow", WORKFLOW,
    "--dependency", `axm-arc-package-lock=${sha256(join(ROOT, "package-lock.json"))}`,
  ]).status).toBe(0);
  const provenanceBundle = join(dir, "attestations", "axm-arc-build-provenance.jsonl");
  const sbomBundle = join(dir, "attestations", "axm-arc-sbom.jsonl");
  const trustedRoot = join(dir, "attestations", "trusted_root.jsonl");
  writeFileSync(provenanceBundle, "fake-provenance-bundle");
  writeFileSync(sbomBundle, "fake-sbom-bundle");
  writeFileSync(trustedRoot, "fake-root");
  const names = [
    "artifacts/axm-arc-game.tar.gz", "sbom/axm-arc.cdx.json", "provenance.intoto.json",
    "attestations/axm-arc-build-provenance.jsonl", "attestations/axm-arc-sbom.jsonl", "attestations/trusted_root.jsonl",
  ];
  writeLedger(dir, names);
  return { dir, artifact, sbom, provenance, provenanceBundle, sbomBundle, trustedRoot, names };
}
function strictArgs(dir: string): string[] {
  return [
    "--root", dir,
    "--require-subject", "artifacts/axm-arc-game.tar.gz", "--exact-subjects",
    "--require-sbom", "sbom/axm-arc.cdx.json", "--exact-sboms",
    "--expected-repository", "BigBirdReturns/axm-arc",
    "--commit", ARC_SHA,
    "--expected-workflow", WORKFLOW,
  ];
}

describe("Arc-owned release supply-chain evidence", () => {
  it("generates deterministic CycloneDX 1.7 and exact contained provenance", () => {
    const evidence = buildEvidence();
    const first = readFileSync(evidence.sbom);
    const second = join(evidence.dir, "sbom", "second.cdx.json");
    expect(run(GENERATE_SBOM, [
      "--lock", join(ROOT, "package-lock.json"), "--package", join(ROOT, "package.json"),
      "--commit", ARC_SHA, "--output", second,
    ]).status).toBe(0);
    expect(readFileSync(second)).toEqual(first);
    const document = JSON.parse(first.toString());
    expect(document).toMatchObject({ bomFormat: "CycloneDX", specVersion: "1.7", version: 1 });
    expect(document.metadata.component.properties).toContainEqual({ name: "axm:source-commit", value: ARC_SHA });
    const statement = JSON.parse(readFileSync(evidence.provenance, "utf8"));
    expect(statement.subject).toEqual([{ name: "artifacts/axm-arc-game.tar.gz", digest: { sha256: sha256(evidence.artifact) } }]);
    expect(statement.predicate.buildDefinition.externalParameters.commit).toBe(ARC_SHA);
  });

  it("verifies the exact ledger, identity, and provenance/SBOM predicates", () => {
    const evidence = buildEvidence();
    const unsigned = run(VERIFY, strictArgs(evidence.dir));
    expect(unsigned.status, unsigned.stderr || unsigned.stdout).toBe(0);
    expect(JSON.parse(unsigned.stdout)).toMatchObject({
      format: "axm-arc-offline-evidence-verification/2", filesChecked: 6, provenanceSubjects: 1, sboms: 1, status: "pass",
    });

    const bin = join(evidence.dir, "bin");
    const capture = join(evidence.dir, "gh-args.txt");
    installFakeGh(bin, capture);
    const env = { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`, FAKE_GH_ARGS: capture };
    const signed = run(VERIFY, [
      ...strictArgs(evidence.dir),
      "--bundle", "attestations/axm-arc-build-provenance.jsonl",
      "--trusted-root", "attestations/trusted_root.jsonl",
      "--repo", "BigBirdReturns/axm-arc",
      "--attested-subject", "artifacts/axm-arc-game.tar.gz",
      "--predicate-type", "https://slsa.dev/provenance/v1",
      "--signer-workflow", "BigBirdReturns/axm-arc/.github/workflows/supply-chain-evidence.yml",
      "--source-digest", ARC_SHA,
      "--source-ref", "refs/heads/main",
      "--require-signature",
    ], env);
    expect(signed.status, signed.stderr || signed.stdout).toBe(0);
    const ghArgs = readFileSync(capture, "utf8");
    expect(ghArgs).toContain(resolve(evidence.artifact));
    expect(ghArgs).toContain("https://slsa.dev/provenance/v1");
    expect(ghArgs).toContain(ARC_SHA);

    const sbomSigned = run(VERIFY, [
      ...strictArgs(evidence.dir),
      "--bundle", "attestations/axm-arc-sbom.jsonl",
      "--trusted-root", "attestations/trusted_root.jsonl",
      "--attested-subject", "artifacts/axm-arc-game.tar.gz",
      "--predicate-type", "https://cyclonedx.org/bom",
      "--require-signature",
    ], env);
    expect(sbomSigned.status, sbomSigned.stderr || sbomSigned.stdout).toBe(0);
    expect(readFileSync(capture, "utf8")).toContain("https://cyclonedx.org/bom");
  });

  it("refuses duplicate ledger paths and unchecksummed provenance subjects", () => {
    const evidence = buildEvidence();
    writeFileSync(join(evidence.dir, "SHA256SUMS"), [
      `${sha256(evidence.artifact)}  artifacts/axm-arc-game.tar.gz`,
      `${sha256(evidence.artifact)}  artifacts/axm-arc-game.tar.gz`, "",
    ].join("\n"));
    const duplicate = run(VERIFY, ["--root", evidence.dir]);
    expect(duplicate.status).not.toBe(0);
    expect(duplicate.stderr).toContain("repeats path");

    writeLedger(evidence.dir, evidence.names.filter((name) => name !== "artifacts/axm-arc-game.tar.gz"));
    const missing = run(VERIFY, ["--root", evidence.dir]);
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain("not covered by SHA256SUMS");
  });

  it("refuses escaped subjects, bundles, and mismatched source identities", () => {
    const evidence = buildEvidence();
    const outside = join(mkdtempSync(join(tmpdir(), "axm-arc-outside-")), "outside.bin");
    writeFileSync(outside, "outside");
    const escaped = run(GENERATE_PROVENANCE, [
      "--subject", outside, "--output", evidence.provenance, "--commit", ARC_SHA,
    ]);
    expect(escaped.status).not.toBe(0);
    expect(escaped.stderr).toContain("outside the evidence root");

    const wrong = run(VERIFY, strictArgs(evidence.dir).map((value) => value === ARC_SHA ? "fedcba9876543210fedcba9876543210fedcba98" : value));
    expect(wrong.status).not.toBe(0);
    expect(wrong.stderr).toContain("commit mismatch");

    const escapedBundle = run(VERIFY, [
      ...strictArgs(evidence.dir), "--bundle", outside,
      "--trusted-root", "attestations/trusted_root.jsonl",
      "--attested-subject", "artifacts/axm-arc-game.tar.gz", "--require-signature",
    ]);
    expect(escapedBundle.status).not.toBe(0);
    expect(escapedBundle.stderr).toContain("escapes evidence root");
  });

  it("refuses tampered exact products", () => {
    const evidence = buildEvidence();
    writeFileSync(evidence.artifact, "tampered-arc-product");
    const rejected = run(VERIFY, strictArgs(evidence.dir));
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toContain("Checksum mismatch");
  });
});
