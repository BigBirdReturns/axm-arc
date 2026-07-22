import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileDarkTombPocket } from "../src/dark-tomb/compiler.js";
import { LAMP_DISTRICT_SOURCE } from "../src/dark-tomb/lamp-district.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cartridgeDir = resolve(root, "cartridges");
await mkdir(cartridgeDir, { recursive: true });

const arc = compileDarkTombPocket(LAMP_DISTRICT_SOURCE);
await Promise.all([
  writeFile(
    resolve(cartridgeDir, "lamp-district.tomb.json"),
    `${JSON.stringify(LAMP_DISTRICT_SOURCE, null, 2)}\n`,
    "utf8",
  ),
  writeFile(
    resolve(cartridgeDir, "lamp-district.arc.json"),
    `${JSON.stringify(arc, null, 2)}\n`,
    "utf8",
  ),
]);

console.log(`Wrote Lamp District creator source and engine-${arc.meta.engineVersion} Arc.`);
