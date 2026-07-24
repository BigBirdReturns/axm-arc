import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ORCHARD_AT_LOW_TIDE } from "../../src/clean-room/orchard-at-low-tide.js";
import { validateArc } from "../../src/engine/schema.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";
import { parsePortableRun } from "../../src/engine/portable-run.js";
import { foundOrganization } from "../../src/engine/founding.js";
import { projectMechanics } from "../../src/engine/projections.js";
import { runSweep } from "../../src/sim/cartridge-conformance.js";

const dir = new URL("../../cartridges/clean-room/", import.meta.url);
const sourceText = readFileSync(new URL("orchard-at-low-tide.source.arc.json", dir), "utf8");
const compiledText = readFileSync(new URL("orchard-at-low-tide.arc.json", dir), "utf8");
const malformedText = readFileSync(new URL("orchard-at-low-tide.invalid.arc.json", dir), "utf8");
const changedRunText = readFileSync(new URL("orchard-at-low-tide.changed.run.json", dir), "utf8");
const manifest = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8")) as {
  format: string;
  programOfRecord: null;
  cartridgeDigest: string;
  runIntegrityDigest: string;
  files: Record<string, { path: string; sha256: string; bytes: number }>;
};

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function party(org: ReturnType<typeof foundOrganization>, ids: string[]) {
  return ids.map((id) => {
    const agent = org.agents[id];
    if (!agent) throw new Error(`Missing founder ${id}.`);
    return agent;
  });
}

describe("Gate 7A clean-room generic cartridge", () => {
  it("keeps exact editable source and executable generic Arc bytes identical", () => {
    const source = validateArc(JSON.parse(sourceText));
    const compiled = validateArc(JSON.parse(compiledText));
    expect(source).toEqual(ORCHARD_AT_LOW_TIDE);
    expect(compiled).toEqual(ORCHARD_AT_LOW_TIDE);
    expect(sourceText).toBe(compiledText);
    expect(cartridgeDigest(compiled)).toBe(manifest.cartridgeDigest);
    expect(manifest.format).toBe("rodoh-clean-room-custody/1");
    expect(manifest.programOfRecord).toBeNull();
  });

  it("refuses the malformed companion fixture without repairing it", () => {
    expect(() => validateArc(JSON.parse(malformedText))).toThrow(/minAgents|maxAgents|roster/i);
  });

  it("completes sixteen deterministic seeds without access bypasses, stalls, or warnings", () => {
    const sweep = runSweep(ORCHARD_AT_LOW_TIDE, { seeds: 16, maxCycles: 80 });
    expect(sweep.clearRate).toBe(1);
    expect(sweep.stallRate).toBe(0);
    expect(sweep.maxCycleRate).toBe(0);
    expect(sweep.totalGateViolations).toBe(0);
    expect(sweep.runs.every((run) => run.warnings.length === 0)).toBe(true);
  });

  it("makes distinct roster choices produce materially different projections", () => {
    const org = foundOrganization(ORCHARD_AT_LOW_TIDE, { format: "axm-founding-input/1", seed: 42 });

    const census = ORCHARD_AT_LOW_TIDE.challenges.find((challenge) => challenge.id === "count-the-brackish-wells")!;
    const broadCensus = projectMechanics({
      challenge: census,
      assignedAgents: party(org, ["founder:edda-loom", "founder:malk-ir", "founder:ruun-vale", "founder:sol-vey"]),
      org,
      arc: ORCHARD_AT_LOW_TIDE,
    });
    const narrowCensus = projectMechanics({
      challenge: census,
      assignedAgents: party(org, ["founder:tavi-reed", "founder:pera-moss", "founder:ruun-vale"]),
      org,
      arc: ORCHARD_AT_LOW_TIDE,
    });
    expect(broadCensus[0]!.margin).toBeGreaterThan(narrowCensus[0]!.margin);

    const exchange = ORCHARD_AT_LOW_TIDE.challenges.find((challenge) => challenge.id === "negotiate-the-graft-exchange")!;
    const seniorExchange = projectMechanics({
      challenge: exchange,
      assignedAgents: party(org, ["founder:sol-vey", "founder:malk-ir", "founder:ruun-vale"]),
      org,
      arc: ORCHARD_AT_LOW_TIDE,
    });
    const juniorExchange = projectMechanics({
      challenge: exchange,
      assignedAgents: party(org, ["founder:tavi-reed", "founder:pera-moss", "founder:ruun-vale"]),
      org,
      arc: ORCHARD_AT_LOW_TIDE,
    });
    expect(seniorExchange[0]!.margin - juniorExchange[0]!.margin).toBeGreaterThanOrEqual(5);
    expect(census.resourceSpend?.maxTokens).toBe(1);
    expect(exchange.resourceSpend?.maxTokens).toBe(2);
  });

  it("preserves unknown cartridge and run namespaces through exact changed-run restore", () => {
    const restored = parsePortableRun(changedRunText);
    expect(restored.authoredArcDigest).toBe(manifest.cartridgeDigest);
    expect(restored.run.integrity.digest).toBe(manifest.runIntegrityDigest);
    expect(restored.arc.extensions?.["unfamiliar.garden-memory@7"]).toEqual(
      ORCHARD_AT_LOW_TIDE.extensions?.["unfamiliar.garden-memory@7"],
    );
    expect(restored.extensions["holder.field-notes@1"]).toEqual({
      status: "changed-run",
      observations: ["the hidden wells entered the census", "the ninth field remains revisable"],
      arbitraryUnknown: { code: 71, nested: [true, "silt"] },
    });
    expect(restored.org.cartridgeState).toMatchObject({
      "water-reserve": 4,
      "seed-diversity": 4,
      "public-memory": 3,
      "monopoly-debt": 0,
      "season-charter": "shared",
      "field-census-published": true,
    });
  });

  it("records deterministic file custody and byte counts", () => {
    const byKey = {
      source: sourceText,
      compiled: compiledText,
      malformed: malformedText,
      changedRun: changedRunText,
    };
    for (const [key, text] of Object.entries(byKey)) {
      expect(manifest.files[key]?.sha256).toBe(sha256(text));
      expect(manifest.files[key]?.bytes).toBe(Buffer.byteLength(text, "utf8"));
    }
  });
});
