import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "creator-kit", "release");

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
function copy(source: string, destination: string): void {
  const from = join(ROOT, source);
  const to = join(OUT, destination);
  if (!existsSync(from)) throw new Error(`Creator-kit source is absent: ${source}`);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
}
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const [source, destination] of [
  ["creator-kit/dist/rodoh-cartridge.mjs", "bin/rodoh-cartridge.mjs"],
  ["creator-kit/README.md", "README.md"],
  ["creator-kit/CREATE_YOUR_FIRST_CARTRIDGE.md", "CREATE_YOUR_FIRST_CARTRIDGE.md"],
  ["creator-kit/ERROR_CATALOG.json", "ERROR_CATALOG.json"],
  ["creator-kit/manifest.json", "manifest.json"],
  ["docs/CART1_CANONICALIZATION.md", "contracts/CART1_CANONICALIZATION.md"],
  ["docs/IMPORT_RESOURCE_LIMITS.md", "contracts/IMPORT_RESOURCE_LIMITS.md"],
  ["docs/conformance/cart1-v1-vectors.json", "contracts/cart1-v1-vectors.json"],
  ["docs/ARC_FORMAT.md", "contracts/ARC_FORMAT.md"],
  ["docs/GODSCAR_POCKET_FORMAT.md", "contracts/GODSCAR_POCKET_FORMAT.md"],
  ["docs/DARK_TOMB_POCKET_FORMAT.md", "contracts/DARK_TOMB_POCKET_FORMAT.md"],
  ["docs/COMMON_SHIP_POCKET_FORMAT.md", "contracts/COMMON_SHIP_POCKET_FORMAT.md"],
  ["cartridges/clean-room/orchard-at-low-tide.source.arc.json", "examples/orchard-at-low-tide/orchard-at-low-tide.source.arc.json"],
  ["cartridges/clean-room/orchard-at-low-tide.arc.json", "examples/orchard-at-low-tide/orchard-at-low-tide.arc.json"],
  ["cartridges/clean-room/orchard-at-low-tide.invalid.arc.json", "examples/orchard-at-low-tide/orchard-at-low-tide.invalid.arc.json"],
  ["cartridges/clean-room/orchard-at-low-tide.changed.run.json", "examples/orchard-at-low-tide/orchard-at-low-tide.changed.run.json"],
  ["cartridges/clean-room/manifest.json", "examples/orchard-at-low-tide/manifest.json"],
] as const) {
  copy(source, destination);
}

const files = walk(OUT)
  .filter((path) => !path.endsWith("SHA256SUMS") && !path.endsWith("release-manifest.json"))
  .sort();
const rows = files.map((path) => ({
  path: relative(OUT, path).replace(/\\/g, "/"),
  bytes: readFileSync(path).byteLength,
  sha256: sha256(path),
}));
writeFileSync(join(OUT, "release-manifest.json"), `${JSON.stringify({
  format: "rodoh-creator-recovery-kit-release/1",
  engine: "1.3.0",
  generatedBy: "npm run build:creator-recovery-kit",
  files: rows,
}, null, 2)}\n`);
const withManifest = [...rows, {
  path: "release-manifest.json",
  bytes: readFileSync(join(OUT, "release-manifest.json")).byteLength,
  sha256: sha256(join(OUT, "release-manifest.json")),
}].sort((a, b) => a.path.localeCompare(b.path));
writeFileSync(join(OUT, "SHA256SUMS"), `${withManifest.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n")}\n`);
console.log(JSON.stringify({
  format: "rodoh-creator-recovery-kit-build/1",
  output: relative(ROOT, OUT).replace(/\\/g, "/"),
  files: withManifest.length + 1,
  status: "pass",
}, null, 2));
