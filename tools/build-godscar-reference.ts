import { mkdirSync, writeFileSync } from "node:fs";
import { KIND_GODS_OF_ILYON } from "../src/arcs/kind-gods-of-ilyon.js";
import { KIND_GODS_OF_ILYON_BLUEPRINT } from "../src/godscar/templates.js";

mkdirSync("cartridges", { recursive: true });
writeFileSync("cartridges/kind-gods-of-ilyon.pocket.json", `${JSON.stringify(KIND_GODS_OF_ILYON_BLUEPRINT, null, 2)}\n`);
writeFileSync("cartridges/kind-gods-of-ilyon.arc.json", `${JSON.stringify(KIND_GODS_OF_ILYON, null, 2)}\n`);
console.log("Built Ilyon source and compiled cartridge.");
