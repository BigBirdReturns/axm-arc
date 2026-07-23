import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RELIEF_CIRCUIT } from "../src/arcs/relief-circuit.js";
import { LAMP_DISTRICT } from "../src/arcs/lamp-district.js";
import { foundOrganization } from "../src/engine/founding.js";
import { runCycle } from "../src/engine/cycle.js";
import type { Arc, Organization } from "../src/engine/types.js";
import { bestParty } from "../src/sim/cartridge-conformance.js";
import { buildConnectedOperation } from "../src/engine/connected-operation.js";

function boostedFounding(arc: Arc, seed: number): Organization {
  const org = foundOrganization(arc, { format: "axm-founding-input/1", seed });
  return {
    ...org,
    resources: { ...org.resources, currency: 2000, tokens: arc.maxTokens },
    agents: Object.fromEntries(Object.entries(org.agents).map(([id, agent]) => [id, {
      ...agent,
      attributes: Object.fromEntries(arc.attributes.map((attribute) => [attribute.id, 60])),
      morale: 90,
      stress: 0,
    }])),
  };
}

function complete(arc: Arc, seed: number): Organization {
  let org = boostedFounding(arc, seed);
  for (const challenge of arc.challenges) {
    const plan = bestParty(challenge, org, arc);
    if (!plan) throw new Error(`No legal party for ${arc.meta.id}:${challenge.id}`);
    const cycle = runCycle({ org, arc, assignments: [{ challengeId: challenge.id, agentIds: plan.agentIds, tokensSpent: 0 }] });
    const report = cycle.reports.find((candidate) => candidate.challengeId === challenge.id);
    if (!report || report.outcome !== "success") throw new Error(`${arc.meta.id}:${challenge.id} resolved ${report?.outcome ?? "without report"}`);
    org = cycle.org;
  }
  return org;
}

const sourceOrg = complete(RELIEF_CIRCUIT, 20260723);
const destinationOrg = complete(LAMP_DISTRICT, 20260724);
const { sourceRun } = buildConnectedOperation({
  sourceArc: RELIEF_CIRCUIT,
  sourceOrg,
  destinationArc: LAMP_DISTRICT,
  destinationOrg,
  status: "returned",
  transfer: {
    id: "relief-circuit-lamp-district",
    title: "The Lamp District connected relief descent",
    selectedWatchId: "conduct-the-lamp-relief-descent",
    excludedActor: "Residents who cannot appear at the threshold without invalidating the exterior lie.",
    dependency: "The silent civic lock, Tessara's plural translation, and two separately sovereign machine memories.",
    precedentId: "connected-relief-ledger",
    people: ["Nima Quell", "Orun Sable", "Tessara One", "Arden Pell", "Cinder Continuing", "Sel Aro", "Toma Rill"],
    stores: ["medicine", "heat-transfer capacity", "living cultures", "pressure membranes"],
    evidence: ["surface-house birth ledgers", "salt-vault thermal audit", "Meridian response fragment"],
    translationPaths: ["raw relay evidence", "surface testimony", "ship handoff memory"],
    environmentalLoads: ["pressure descent cell", "thermal mask", "mixed-carrier route"],
    exposureConsequences: ["surface-house radiation", "spent strategic ambiguity", "new silent-lock dependency"],
  },
  returnLedger: {
    sourceStateBefore: { "continuity": 3, "compatibility-debt": 2, "visibility": 2 },
    sourceStateAfter: Object.fromEntries(Object.entries(sourceOrg.cartridgeState ?? {})),
    destinationStateBefore: { "alarm-phase": "hush", "signature-status": "credible", "visibility-status": "hidden" },
    destinationStateAfter: Object.fromEntries(Object.entries(destinationOrg.cartridgeState ?? {})),
    inheritedFacts: [
      "The Relief Circuit and Lamp District retain separate source planes and state sets.",
      "The surface households receive standing in the connected operation.",
      "The silent civic lock remains a dependency with joint refusal authority.",
      "Emergency approach authority expires after return.",
    ],
  },
});

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cartridgeDir = resolve(root, "cartridges");
await mkdir(cartridgeDir, { recursive: true });
await writeFile(
  resolve(cartridgeDir, "relief-circuit-lamp-district.run.json"),
  `${JSON.stringify(sourceRun, null, 2)}\n`,
  "utf8",
);
console.log("Wrote connected Relief Circuit and Lamp District run fixture.");
