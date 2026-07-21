import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KIND_GODS_OF_ILYON } from "../../src/arcs/kind-gods-of-ilyon.js";
import { compileGodscarPocket } from "../../src/godscar/compiler.js";
import { validateArc } from "../../src/engine/schema.js";

describe("published Godscar reference artifacts", () => {
  it("compiles the published source into the exact published Arc", () => {
    const source = JSON.parse(readFileSync("cartridges/kind-gods-of-ilyon.pocket.json", "utf8"));
    const publishedArc = JSON.parse(readFileSync("cartridges/kind-gods-of-ilyon.arc.json", "utf8"));
    expect(compileGodscarPocket(source)).toEqual(publishedArc);
    expect(validateArc(publishedArc)).toEqual(KIND_GODS_OF_ILYON);
  });
});
