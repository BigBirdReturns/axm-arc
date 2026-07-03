// CLI for the Karazhan completion simulation.
//
//   npm run sim:karazhan -- [--seeds N] [--max-cycles A,B] [--heroic] [--json]
//
// Deterministic: seeds are 1..N, no wall-clock, no Math.random.

import { runSweep, type SimAggregate } from "./karazhan-autoplay.js";
import { KARAZHAN } from "../arcs/index.js";

function arg(name: string): string | null {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? (process.argv[idx + 1] ?? null) : null;
}

const seeds = Number(arg("--seeds") ?? 30);
const maxCyclesList = (arg("--max-cycles") ?? "25,40").split(",").map((s) => Number(s.trim()));
const heroic = process.argv.includes("--heroic");
const asJson = process.argv.includes("--json");

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function printAggregate(agg: SimAggregate): void {
  console.log(`\n== Karazhan sim — seeds 1..${agg.seeds}, maxCycles ${agg.maxCycles}${agg.heroic ? ", HEROIC" : ""} ==`);
  console.log(`clear ${pct(agg.clearRate)} · stall ${pct(agg.stallRate)} · out-of-cycles ${pct(agg.maxCycleRate)} · gate violations ${agg.totalGateViolations}`);
  console.log(`median cycles to wing clear:`);
  for (const tier of KARAZHAN.progressionTiers) {
    const v = agg.medianWingClear[tier.id];
    console.log(`  ${tier.id.padEnd(8)} ${tier.name.padEnd(32)} ${v === null ? "—" : v}`);
  }
  console.log(`attunement timing (median cycle): first key ${agg.medianMastersKey ?? "—"} · half-raid keyed ${agg.medianHalfRaidKey ?? "—"} · urn ${agg.medianUrn ?? "—"} · nightbane access ${agg.medianNightbaneAccess ?? "—"}`);
  if (Object.keys(agg.firstStalls).length > 0) {
    console.log(`first-stall distribution:`);
    for (const [id, n] of Object.entries(agg.firstStalls)) console.log(`  ${id}: ${n}`);
    for (const [reason, n] of Object.entries(agg.stallReasons)) console.log(`  reason · ${reason}: ${n}`);
  }
  console.log(`attempt outcomes (success/partial/failure):`);
  for (const c of KARAZHAN.challenges) {
    const t = agg.attemptTotals[c.id];
    if (!t) { console.log(`  ${c.id.padEnd(14)} never attempted`); continue; }
    console.log(`  ${c.id.padEnd(14)} ${t.success}/${t.partial}/${t.failure}`);
  }
  console.log(`median unspent gold at end: ${agg.medianFinalCurrency} (no upgrades/recruits modeled — unused lever)`);
}

const all: SimAggregate[] = [];
for (const maxCycles of maxCyclesList) {
  const agg = runSweep({ seeds, maxCycles, heroic });
  all.push(agg);
  if (!asJson) printAggregate(agg);
}
if (asJson) {
  console.log(JSON.stringify(all.map(({ runs, ...rest }) => ({ ...rest, runs: runs.map((r) => ({ ...r })) })), null, 2));
}
