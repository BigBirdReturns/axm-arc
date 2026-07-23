import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileCommonShipPocket } from "../src/common-ship/compiler.js";
import { RELIEF_CIRCUIT_SOURCE } from "../src/common-ship/relief-circuit.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cartridgeDir = resolve(root, "cartridges");
await mkdir(cartridgeDir, { recursive: true });
const arc = compileCommonShipPocket(RELIEF_CIRCUIT_SOURCE);
await Promise.all([
  writeFile(resolve(cartridgeDir, "relief-circuit.ship.json"), `${JSON.stringify(RELIEF_CIRCUIT_SOURCE, null, 2)}\n`, "utf8"),
  writeFile(resolve(cartridgeDir, "relief-circuit.arc.json"), `${JSON.stringify(arc, null, 2)}\n`, "utf8"),
]);
console.log(`Wrote Relief Circuit creator source and engine-${arc.meta.engineVersion} Arc.`);
