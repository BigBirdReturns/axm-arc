// Wipe-diagnosis drill — the raid-night slice, played to a wipe, diagnosed.
// Run: npx vite-node docs/drills/wipe-diagnosis-drill.mts
//
// No browser: the deliverable is a clean console readout (honest before pretty).
// It plays "The First Lockout" boss 3 (The Hollow Choir) with the best legal
// party, finds a seed that wipes, and prints the diagnosis a player would read.
// A second "mid-season" run seasons the roster (stress, low morale, one geared
// striker) so the full factor range shows.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importArcFromJson } from "../../src/game/lib/arc-library.js";
import { resolveChallenge } from "../../src/engine/resolver.js";
import { Rng } from "../../src/engine/prng.js";
import { buildStartingOrg } from "../../src/sim/cartridge-conformance.js";
import { diagnoseWipe, renderDiagnosis } from "../../src/sim/wipe-diagnosis.js";
import type { Agent, Arc, Challenge, Organization } from "../../src/engine/types.js";

(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
} as Storage;

const CHOIR = "the-hollow-choir";
const CARTRIDGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../cartridges/first-lockout.arc.json");
const imported = importArcFromJson(fs.readFileSync(CARTRIDGE, "utf8"));
if (!imported.ok) throw new Error("import failed: " + imported.errors.join("; "));
const arc: Arc = imported.entry.arc;
const choir = arc.challenges.find((c) => c.id === CHOIR)!;

function legalParty(challenge: Challenge, org: Organization): Agent[] {
  const agents = Object.values(org.agents).sort((a, b) => (a.id < b.id ? -1 : 1));
  const size = Math.min(challenge.rosterRequirements.maxAgents, 10);
  const chosen: Agent[] = [];
  for (const req of challenge.rosterRequirements.roleRequirements) {
    for (const a of agents.filter((x) => x.role === req.roleId && !chosen.includes(x)).slice(0, req.count)) chosen.push(a);
  }
  for (const a of agents) { if (chosen.length >= size) break; if (!chosen.includes(a)) chosen.push(a); }
  return chosen.slice(0, size);
}

function play(seed: number, mutate?: (org: Organization) => void) {
  const org = buildStartingOrg(arc, seed, { rosterSize: 12 });
  if (mutate) mutate(org);
  const assignedAgents = legalParty(choir, org);
  const report = resolveChallenge({ challenge: choir, assignedAgents, org, arc, rng: new Rng(0), cycle: 0, collectDiagnostics: true });
  return { org, report };
}

function firstWipe(): number {
  for (let s = 1; s <= 40; s++) if (play(s).report.outcome === "failure") return s;
  throw new Error("no wipe in 1..40");
}

const seed = firstWipe();
console.log(`\n════════ RAID NIGHT · The First Lockout · seed ${seed} ════════`);
console.log("\n─── FRESH ROSTER (opening night) ───\n");
const fresh = play(seed);
console.log(renderDiagnosis(diagnoseWipe(fresh.report, choir, fresh.org, arc)));

console.log("\n\n─── MID-SEASON ROSTER (wear shows) ───\n");
const seasoned = play(seed, (org) => {
  const strikers = Object.values(org.agents).filter((a) => a.role === "striker");
  const bell = arc.items.find((i) => i.id === "choir-silencing-bell");
  strikers.forEach((s, i) => {
    if (i === 0 && bell) s.equippedItems = { ...s.equippedItems, weapon: bell.id }; // one geared up
    else { s.morale = 28; s.stress = 4; } // the rest: burned out mid-season
  });
});
console.log(renderDiagnosis(diagnoseWipe(seasoned.report, choir, seasoned.org, arc)));
console.log("\n════════ end ════════\n");
