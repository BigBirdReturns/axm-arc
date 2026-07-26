import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const GENERATE_SBOM = join(ROOT, "scripts/supply-chain/generate-cyclonedx.mjs");
const GENERATE_PROVENANCE = join(ROOT, "scripts/supply-chain/generate-provenance.mjs");
const VERIFY = join(ROOT, "scripts/supply-chain/verify-offline-evidence.mjs");

function run(script: string, args: string[], cwd = ROOT) {
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
}
function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assembleEvidence(): { dir: string; artifact: string; sbom: string; provenance: string } {
  const dir = mkdtempSync(join(tmpdir(), "axm-arc-evidence-"));
  const artifacts = join(dir, "artifacts");
  const sbomDir = join(dir, "sbom");
  mkdirSync(artifacts, { recursive: true });
  mkdirSync(sbomDir, { recursive: true });
  const artifact = join(artifacts, "axm-arc-game.tar.gz");
  writeFileSync(artifact, "exact-arc-static-product");
  const sbom = join(sbomDir, "axm-arc.cdx.json");
  const commit = "fedcba9876543210fedcba9876543210fedcba98";
  const sbomResult = run(GENERATE_SBOM, [
    "--lock", join(ROOT, "package-lock.json"),
    "--package", join(ROOT, "package.json"),
    "--commit", commit,
    "--output", sbom,
  ]);
  expect(sbomResult.status, sbomResult.stderr || sbomResult.stdout).toBe(0);
  const provenance = join(dir, "provenance.intoto.json");
  const provenanceResult = run(GENERATE_PROVENANCE, [
    "--subject", artifact,
    "--output", provenance,
    "--repository", "BigBirdReturns/axm-arc",
    "--commit", commit,
    "--dependency", `axm-arc-package-lock=${sha256(join(ROOT, "package-lock.json"))}`,
  ]);
  expect(provenanceResult.status, provenanceResult.stderr || provenanceResult.stdout).toBe(0);
  writeFileSync(join(dir, "SHA256SUMS"), [
    `${sha256(artifact)}  artifacts/axm-arc-game.tar.gz`,
    `${sha256(sbom)}  sbom/axm-arc.cdx.json`,
    `${sha256(provenance)}  provenance.intoto.json`,
    "",
  ].join("\n"));
  return { dir, artifact, sbom, provenance };
}

describe("Arc-owned release supply-chain evidence", () => {
  it("generates one deterministic CycloneDX 1.7 dependency graph from the exact lockfile", () => {
    const dir = mkdtempSync(join(tmpdir(), "axm-arc-sbom-"));
    const first = join(dir, "first.cdx.json");
    const second = join(dir, "second.cdx.json");
    const commit = "0123456789abcdef0123456789abcdef01234567";
    for (const output of [first, second]) {
      const result = run(GENERATE_SBOM, [
        "--lock", join(ROOT, "package-lock.json"),
        "--package", join(ROOT, "package.json"),
        "--commit", commit,
        "--output", output,
      ]);
      expect(result.status, result.stderr || result.stdout).toBe(0);
    }
    expect(readFileSync(first)).toEqual(readFileSync(second));
    const document = JSON.parse(readFileSync(first, "utf8"));
    expect(document).toMatchObject({ bomFormat: "CycloneDX", specVersion: "1.7", version: 1 });
    expect(document.components.length).toBeGreaterThan(10);
    expect(document.dependencies.length).toBe(document.components.length + 1);
    expect(document.metadata.component.properties).toEqual(expect.arrayContaining([
      { name: "axm:source-commit", value: commit },
    ]));
  });

  it("generates sorted multi-subject in-toto provenance without Array.map argument leakage", () => {
    const dir = mkdtempSync(join(tmpdir(), "axm-arc-provenance-"));
    const artifacts = join(dir, "artifacts");
    mkdirSync(artifacts, { recursive: true });
    const zeta = join(artifacts, "zeta.bin");
    const alpha = join(artifacts, "alpha.bin");
    writeFileSync(zeta, "zeta");
    writeFileSync(alpha, "alpha");
    const output = join(dir, "provenance.intoto.json");
    const result = run(GENERATE_PROVENANCE, [
      "--subject", zeta,
      "--subject", alpha,
      "--output", output,
      "--repository", "BigBirdReturns/axm-arc",
      "--commit", "0123456789abcdef0123456789abcdef01234567",
    ]);
    expect(result.status, result.stderr || result.stdout).toBe(0);
    const statement = JSON.parse(readFileSync(output, "utf8"));
    expect(statement.subject.map((subject: { name: string }) => subject.name)).toEqual([
      "artifacts/alpha.bin",
      "artifacts/zeta.bin",
    ]);
    expect(statement.predicate.buildDefinition.buildType).toBe("https://axm.tools/build-types/axm-arc-static/v1");
  });

  it("verifies checksums, SBOM structure, and provenance subjects, then refuses tampering", () => {
    const { dir, artifact } = assembleEvidence();
    const verify = run(VERIFY, ["--root", dir]);
    expect(verify.status, verify.stderr || verify.stdout).toBe(0);
    expect(JSON.parse(verify.stdout)).toMatchObject({
      format: "axm-arc-offline-evidence-verification/1",
      status: "pass",
      filesChecked: 3,
      provenanceSubjects: 1,
      sboms: 1,
    });

    writeFileSync(artifact, "tampered-arc-static-product");
    const rejected = run(VERIFY, ["--root", dir]);
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toContain("Checksum mismatch");
  });

  it("refuses checksum paths and symlinks that escape the evidence root", () => {
    const { dir, provenance } = assembleEvidence();
    const outside = join(tmpdir(), `axm-arc-outside-${Date.now()}.bin`);
    writeFileSync(outside, "outside");
    const linked = join(dir, "artifacts", "escaped.bin");
    symlinkSync(outside, linked);
    writeFileSync(join(dir, "SHA256SUMS"), [
      `${sha256(linked)}  artifacts/escaped.bin`,
      `${sha256(provenance)}  provenance.intoto.json`,
      "",
    ].join("\n"));
    const rejected = run(VERIFY, ["--root", dir]);
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toContain("resolves outside evidence root");
  });

  it("requires the Arc artifact to be the subject of any Arc attestation bundle", () => {
    const source = readFileSync(VERIFY, "utf8");
    expect(source).toContain('"artifacts/axm-arc-game.tar.gz"');
    expect(source).toContain("Attested subject is absent from provenance");
    expect(source).not.toContain("rodoh-world-game.tar.gz");
  });
});
