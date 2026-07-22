export const ENGINE_VERSION = "1.3.0";

function numericParts(version: string): [number, number, number] {
  if (!/^\d+(?:\.\d+){0,2}$/.test(version)) {
    throw new Error(`Invalid engine version "${version}"; expected numeric major[.minor[.patch]].`);
  }
  const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
  return [major, minor, patch];
}

export function compareEngineVersions(left: string, right: string): number {
  const a = numericParts(left);
  const b = numericParts(right);
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index]! < b[index]! ? -1 : 1;
  }
  return 0;
}

/** Enforce Arc.meta.engineVersion as a real minimum-runtime contract. */
export function assertEngineCompatible(required: string): void {
  if (compareEngineVersions(required, ENGINE_VERSION) > 0) {
    throw new Error(
      `Arc requires engine ${required}, but this runtime provides ${ENGINE_VERSION}.`,
    );
  }
}
