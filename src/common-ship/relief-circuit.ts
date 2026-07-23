import type {
  CommonShipPocketSourceV2,
  CommonShipWatchBlueprintV2,
} from "./embodiment.js";
import { COMMON_SHIP_STARTER } from "./templates.js";
import type { CommonShipConsequence } from "./types.js";

const source = structuredClone(COMMON_SHIP_STARTER) as CommonShipPocketSourceV2;

source.identity = {
  id: "relief-circuit",
  title: "The Relief Circuit",
  description:
    "A mixed Common Ship carries medicine, heat-transfer capacity, witnesses, and continuity stores toward the Lamp District while a failing translation mesh turns every roster, habitat allocation, and delay into constitutional law.",
  author: "BigBirdReturns",
  version: "1.0.0",
  estimatedCycles: 24,
  parentCanons: [
    "The Godscar Codex, Book I: The Open Universe · first recension",
    "The Godscar Codex, Book II: The Dark Tomb · first recension",
    "The Godscar Codex, Book III: The Common Ship · first recension",
  ],
  canonRelation: "compatible",
};

source.controlQuestion =
  "Can the Relief Circuit reach the Lamp District without making one body, clock, interface, or emergency doctrine the native form through which every passenger must survive?";

source.pressures[1] = {
  kind: "mission",
  id: "lamp-district-relief",
  label: "The Lamp District relief circuit",
  description:
    "The ship must deliver medicine, heat-transfer capacity, witnesses, and continuity stores to the Lamp District without exposing the Tomb or consuming the short-lived crew in transit and standby.",
};
source.pressures[6] = {
  kind: "approaching-trigger",
  id: "scarway-collapse-and-mesh-outage",
  label: "Scarway collapse and translation outage",
  description:
    "The route to the Lamp District is closing while the central translation mesh spreads a disease pattern and the rescue watch cannot satisfy every body, clock, and habitat requirement at once.",
};

function copyWatch(index: number): CommonShipWatchBlueprintV2 {
  return structuredClone(source.watches[index]!);
}

const recognizeSchool = copyWatch(0);
recognizeSchool.checks[0]!.threshold = 42;
recognizeSchool.currencyReward = 18;
recognizeSchool.shipStateEffects = [
  { track: "translation-trust", delta: 1, reason: "Raw evidence and provisional translation remain distinguishable." },
  { track: "compatibility-debt", delta: 1, reason: "The isolated loop still depends on Tessara and one manual maintenance path." },
];

const auditStores = copyWatch(0);
auditStores.id = "audit-the-relief-stores";
auditStores.name = "Audit the Relief Stores";
auditStores.description = "Ordinary provisioning reveals that the same reserve cylinder, microbial culture, and pressure membrane have been promised to several incompatible bodies and to the Lamp District.";
auditStores.tierId = "ordinary-life";
auditStores.system = "continuity-commons";
auditStores.accessAfter = recognizeSchool.id;
auditStores.horizon = {
  closesWhen: "The scarway loading window begins and the stores are sealed into route order.",
  physicalUrgency: "The aquatic band and school loop both require the same replacement membranes.",
  informationalUrgency: "The manifest will become operational fact once loading begins.",
  institutionalUrgency: "Relief command treats signed requisitions as settled ownership.",
  manufacturedUrgency: "The human-normal stores taxonomy hides that one item is serving several kinds of personhood.",
};
auditStores.profiles = {
  requiredBodies: ["aquatic care lineage", "nine-year analyst", "distributed vessel fork"],
  requiredHabitats: ["saline care medium", "short-life education archive", "redundant machine substrate"],
  requiredClocks: ["loading window", "care recovery", "life-fraction audit"],
  requiredTranslators: ["stores provenance", "environmental equivalence ledger"],
  requiredReserves: ["pressure membranes", "microbial cultures", "redundant substrates"],
  lifeFractionCosts: ["standby paid by Arden's short life", "Nima's delayed care recovery"],
  requiredProfileIds: ["aquatic-care-lineage", "nine-year-analyst-lineage", "counterborn-vessel-fork"],
};
auditStores.composition = {
  absentActor: "The Lamp District cannot inspect the manifest without revealing the route.",
  excludedBody: "The Manyborn carriers are counted as consumable cultures rather than passengers with continuity claims.",
  dependency: "Relief loading depends on one stores taxonomy authored for dry human-scale cargo.",
};
auditStores.allocation = {
  habitatBands: "Reserve one pressure-compatible transfer path and one living-culture hold.",
  translationPaths: "Preserve the original requisitions beside the normalized manifest.",
  directInterfaces: "Let each habitat certify its own survival-critical stores without a dry cargo proxy.",
  standby: "Keep Arden off routine loading duty until the route decision horizon opens.",
  stores: "Publish every double-promised reserve and name the body that would bear its loss.",
  emergencyAuthority: "No officer may reclassify a living culture as expendable cargo during loading.",
};
auditStores.handoff = {
  dissent: "Command argues that public double-allocation makes the departure impossible.",
  injury: "No acute injury, but one aquatic treatment remains delayed.",
  readinessDebt: "The audit spends the only quiet period before departure.",
  promises: "The Lamp District will receive the unnormalized manifest and substitution limits.",
  missingPersons: "The hidden destination remains represented through prior requests and witnesses.",
  uncertainty: "Several reserves may be physically substitutable under conditions nobody has tested.",
};
auditStores.precedent = {
  newlyPossible: "Stores can be budgeted by continuity function rather than by the host cargo taxonomy.",
  newlyImpossible: "One reserve cannot silently satisfy several ledgers at once.",
  newlyGovernable: "Life-fraction and recovery debt enter route provisioning.",
  inheritedAsInfrastructure: "The ship gains a plural stores ledger and living-culture hold.",
};
auditStores.difficulty = 22;
auditStores.minAgents = 4;
auditStores.maxAgents = 6;
auditStores.requiredRoles = [
  { roleId: "care", count: 1 },
  { roleId: "analysis", count: 1 },
  { roleId: "continuity", count: 1 },
];
auditStores.checks = [{
  id: "reconcile-plural-stores",
  name: "Reconcile plural stores",
  description: "Name every double allocation and preserve the bodies, cultures, and successors hidden by cargo categories.",
  scope: "team",
  weights: { care: 0.25, systems: 0.2, translation: 0.15, continuity: 0.25, judgment: 0.15 },
  threshold: 44,
  failureType: "stress",
  severity: 0.15,
}];
auditStores.success = "The relief manifest becomes an auditable continuity ledger and the departure remains materially possible.";
auditStores.partial = "The double allocations are visible, but one private habitat remains dependent on an unreviewable substitute.";
auditStores.failure = "Loading converts the first emergency claim into ownership and leaves one lineage without a survivable reserve.";
auditStores.reputationGain = 2;
auditStores.currencyReward = 20;
auditStores.consequenceId = "plural-stores-ledger";
auditStores.shipStateEffects = [
  { track: "stores-and-care", delta: 1, reason: "The same reserve can no longer be counted twice without a named sacrifice." },
  { track: "compatibility-debt", delta: -1, reason: "One recurring private workaround becomes shared stores infrastructure." },
];

const composeWatch = copyWatch(1);
composeWatch.accessAfter = auditStores.id;
composeWatch.checks[0]!.threshold = 48;
composeWatch.currencyReward = 22;

const declareApproach = copyWatch(1);
declareApproach.id = "declare-the-lamp-approach-watch";
declareApproach.name = "Declare the Lamp Approach Watch";
declareApproach.description = "The ship must cross a closing scarway and approach a hidden Tomb without allowing a fast-response baseline to become permanent command over every body and route.";
declareApproach.tierId = "compose-watch";
declareApproach.system = "transit-body";
declareApproach.accessAfter = composeWatch.id;
declareApproach.horizon = {
  closesWhen: "The route shears beyond the vessel's current transit geometry.",
  physicalUrgency: "A failed crossing can strand habitats in incompatible gravity and pressure states.",
  informationalUrgency: "The Lamp District cannot answer active navigation without exposing itself.",
  institutionalUrgency: "Response command requests unilateral route authority.",
  manufacturedUrgency: "The bridge clock is presented as the only clock capable of bearing responsibility.",
};
declareApproach.profiles = {
  requiredBodies: ["rapid response body", "heavy maintainer", "nine-year analyst", "vessel fork"],
  requiredHabitats: ["dry helm cell", "load-rated structural route", "machine substrate"],
  requiredClocks: ["scarway shear", "structural watch", "life-fraction transit audit"],
  requiredTranslators: ["route prognosis", "bounded command delegation"],
  requiredReserves: ["manual helm", "hull anchor", "independent route memory"],
  lifeFractionCosts: ["a substantial fraction of Arden's remaining life", "Cinder fork divergence"],
  requiredProfileIds: ["dry-humanoid-response", "heavy-maintainer-lineage", "nine-year-analyst-lineage", "counterborn-vessel-fork"],
};
declareApproach.composition = {
  absentActor: "The Lamp District remains unable to consent to an active approach signal.",
  excludedBody: "Nima cannot enter the dry transit cell and must retain direct refusal through the care band.",
  dependency: "Cinder's route memory is both navigation infrastructure and a person whose divergence cannot be rolled back without consent.",
};
declareApproach.allocation = {
  habitatBands: "Hold aquatic and distributed habitats through the crossing rather than collapsing to the bridge baseline.",
  translationPaths: "Separate route prediction from command authority and preserve dissent in raw form.",
  directInterfaces: "Ilya receives helm, Orun receives hull contact, Cinder retains route-memory sovereignty.",
  standby: "Nima and Tessara remain an independent refusal and care channel.",
  stores: "Commit one pressure reserve and one redundant route substrate.",
  emergencyAuthority: "The approach watch may cross and abort; it may not announce or expose the destination.",
};
declareApproach.handoff = {
  dissent: "The bridge claims the independent refusal channel creates fatal latency.",
  injury: "Orun accepts structural load outside ordinary recovery limits.",
  readinessDebt: "Arden spends an audited fraction of adult life in transit analysis.",
  promises: "The approach authority expires at docking and cannot govern the Tomb.",
  missingPersons: "The destination's surface households remain represented only by sealed evidence.",
  uncertainty: "The route model cannot distinguish scarway shear from a dormant search-lattice response.",
};
declareApproach.precedent = {
  newlyPossible: "Transit authority can be decomposed into helm, structure, route memory, care refusal, and destination opacity.",
  newlyImpossible: "The bridge may no longer claim the whole vessel merely because it carries the fastest clock.",
  newlyGovernable: "Life-fraction transit cost and route-memory sovereignty receive explicit standing.",
  inheritedAsInfrastructure: "The ship gains an independent abort and refusal channel across habitat bands.",
};
declareApproach.difficulty = 30;
declareApproach.minAgents = 5;
declareApproach.maxAgents = 6;
declareApproach.requiredRoles = [
  { roleId: "response", count: 1 },
  { roleId: "analysis", count: 1 },
  { roleId: "maintenance", count: 1 },
  { roleId: "continuity", count: 1 },
];
declareApproach.checks = [{
  id: "hold-the-plural-crossing",
  name: "Hold the plural crossing",
  description: "Cross the route while preserving direct habitat, refusal, and route-memory authority.",
  scope: "team",
  weights: { systems: 0.25, translation: 0.1, continuity: 0.2, judgment: 0.2, resolve: 0.25 },
  threshold: 50,
  failureType: "team_damage",
  severity: 0.2,
}];
declareApproach.success = "The ship crosses without converting the bridge into the permanent owner of the vessel or destination.";
declareApproach.partial = "The crossing succeeds, but one habitat or route-memory path becomes indispensable enough to govern the approach.";
declareApproach.failure = "The ship aborts, strands a habitat, or broadcasts the active signature the Tomb was built to avoid.";
declareApproach.reputationGain = 3;
declareApproach.currencyReward = 24;
declareApproach.consequenceId = "plural-approach-charter";
declareApproach.shipStateEffects = [
  { track: "temporal-coherence", delta: 1, reason: "The crossing recognizes several clocks and one expiring authority." },
  { track: "visibility", delta: -1, reason: "The route crossing spends part of the ship's strategic ambiguity." },
];

const crossMesh = copyWatch(2);
crossMesh.accessAfter = declareApproach.id;
crossMesh.checks[0]!.threshold = 52;
crossMesh.currencyReward = 26;

const dockQuietly = copyWatch(2);
dockQuietly.id = "dock-without-declaring-the-tomb";
dockQuietly.name = "Dock Without Declaring the Tomb";
dockQuietly.description = "The Relief Circuit must exchange people, heat, medicine, and evidence through a dead outpost while preserving the Lamp District's maintained misclassification.";
dockQuietly.tierId = "resolve-pressure";
dockQuietly.system = "common-thresholds";
dockQuietly.accessAfter = crossMesh.id;
dockQuietly.horizon = {
  closesWhen: "The outpost's thermal fiction can no longer absorb the ship's docking load.",
  physicalUrgency: "Clinic heat and pressure stores must cross before the district's sinks fail.",
  informationalUrgency: "Every active handshake teaches the dormant lattice more about the destination.",
  institutionalUrgency: "The ship and Tomb each claim authority over the exchange threshold.",
  manufacturedUrgency: "Command treats docking as a technical operation without citizens on both sides.",
};
dockQuietly.profiles = {
  requiredBodies: ["aquatic care lineage", "heavy maintainer", "Manyborn mediator", "vessel fork"],
  requiredHabitats: ["pressure-compatible transfer lock", "load-rated service route", "living-culture hold"],
  requiredClocks: ["thermal mask window", "clinic need", "Lamp District Quiet Hours"],
  requiredTranslators: ["dead-outpost telemetry", "surface-house witness channel"],
  requiredReserves: ["heat-transfer capacity", "medical cultures", "silent routing"],
  lifeFractionCosts: ["care recovery", "surface-house exposure", "short-life standby"],
  requiredProfileIds: ["aquatic-care-lineage", "heavy-maintainer-lineage", "manyborn-mediator-cloud", "counterborn-vessel-fork"],
};
dockQuietly.composition = {
  absentActor: "Most Lamp District residents cannot appear at the threshold without invalidating the exterior lie.",
  excludedBody: "The surface households are still treated by both polities as camouflage labor rather than counterparties.",
  dependency: "The exchange depends on Cinder and Black Lamp Nine refusing to complete an old route handshake.",
};
dockQuietly.allocation = {
  habitatBands: "Extend one pressure-compatible care path into the outpost without normalizing the whole lock.",
  translationPaths: "Carry the dead telemetry fiction beside an inspectable civic transfer ledger.",
  directInterfaces: "Surface households and maintainers receive direct stop authority over the transfer.",
  standby: "Ilya holds silent abort; Arden remains off the exposed threshold unless the horizon changes.",
  stores: "Transfer heat, cultures, medicine, and witnesses in the order authored by the plural stores ledger.",
  emergencyAuthority: "Either polity may halt the exchange; neither may unilaterally make the other visible.",
};
dockQuietly.handoff = {
  dissent: "Relief command argues the Tomb's refusal rights endanger the ship.",
  injury: "One surface bearer absorbs a preventable radiation dose while preserving the grave-skin fiction.",
  readinessDebt: "Nima and Orun carry the exchange beyond their protected recovery interval.",
  promises: "The surface households receive standing in the connected descent and return ledger.",
  missingPersons: "The district assembly remains distributed through sealed testimony.",
  uncertainty: "A low-level relay response may be routine decay or renewed target acquisition.",
};
dockQuietly.precedent = {
  newlyPossible: "Two hidden polities can share a threshold without requiring either to surrender its map.",
  newlyImpossible: "Docking may no longer be classified as a merely technical operation.",
  newlyGovernable: "Transfer exposure, refusal, and misclassification become joint jurisdiction.",
  inheritedAsInfrastructure: "A silent pressure-compatible civic lock links ship and Tomb.",
};
dockQuietly.difficulty = 34;
dockQuietly.minAgents = 5;
dockQuietly.maxAgents = 6;
dockQuietly.requiredRoles = [
  { roleId: "mediation", count: 1 },
  { roleId: "maintenance", count: 1 },
  { roleId: "care", count: 1 },
  { roleId: "continuity", count: 1 },
];
dockQuietly.checks = [{
  id: "hold-the-silent-threshold",
  name: "Hold the silent threshold",
  description: "Move relief and standing across the outpost without completing the target handshake or erasing either polity's refusal.",
  scope: "team",
  weights: { care: 0.2, systems: 0.25, translation: 0.2, continuity: 0.2, judgment: 0.15 },
  threshold: 52,
  failureType: "cascade",
  severity: 0.2,
}];
dockQuietly.success = "The exchange succeeds and the threshold records citizens, stores, exposure, and refusal without declaring the Tomb.";
dockQuietly.partial = "Relief crosses, but one person or system becomes the sole interpreter of the joint threshold.";
dockQuietly.failure = "The transfer stalls, exposes the district, or restores an inherited route handshake.";
dockQuietly.reputationGain = 4;
dockQuietly.currencyReward = 28;
dockQuietly.consequenceId = "silent-civic-lock";
dockQuietly.shipStateEffects = [
  { track: "stores-and-care", delta: 1, reason: "Relief stores reach the clinic through a survivable plural threshold." },
  { track: "visibility", delta: -1, reason: "Docking spends concealment even when the exterior lie remains credible." },
];

const reliefDescent = copyWatch(2);
reliefDescent.id = "conduct-the-lamp-relief-descent";
reliefDescent.name = "Conduct the Lamp Relief Descent";
reliefDescent.description = "A mixed ship-and-Tomb expedition must carry medicine, heat, witnesses, and route evidence through the reopened reservoir layers and return without allowing the ship to absorb the district's sovereignty.";
reliefDescent.tierId = "resolve-pressure";
reliefDescent.system = "continuity-commons";
reliefDescent.accessAfter = dockQuietly.id;
reliefDescent.horizon = {
  closesWhen: "The clinic sinks saturate and the Meridian relay completes another listening cycle.",
  physicalUrgency: "The district needs heat transfer and medicine before the next blackout.",
  informationalUrgency: "The relay response and erased household records may be lost behind a route collapse.",
  institutionalUrgency: "Ship command, Quiet Hours, and surface households contest expedition authority.",
  manufacturedUrgency: "Each institution presents its own survival mechanism as the only legitimate map.",
};
reliefDescent.profiles = {
  requiredBodies: ["aquatic care lineage", "heavy maintainer", "Manyborn mediator", "nine-year analyst", "vessel fork"],
  requiredHabitats: ["pressure descent cell", "load-rated reservoir route", "mixed-carrier evidence channel"],
  requiredClocks: ["clinic blackout", "relay listening cycle", "life-fraction descent audit"],
  requiredTranslators: ["Lamp District testimony", "raw relay evidence", "ship handoff memory"],
  requiredReserves: ["medicine", "heat-transfer capacity", "silent return route"],
  lifeFractionCosts: ["Arden's expedition fraction", "Nima's recovery debt", "surface-house exposure"],
  requiredProfileIds: ["aquatic-care-lineage", "heavy-maintainer-lineage", "manyborn-mediator-cloud", "nine-year-analyst-lineage", "counterborn-vessel-fork"],
};
reliefDescent.composition = {
  absentActor: "Most district residents remain unable to join the descent hearing in real time.",
  excludedBody: "The surface households are physically present but still denied equal authority over exposure.",
  dependency: "The expedition depends on Tessara's cross-sensorium evidence and Cinder's unmerged route memory.",
};
reliefDescent.allocation = {
  habitatBands: "Carry a pressure cell and living-carrier route rather than forcing every participant into the war-layer baseline.",
  translationPaths: "Keep raw Tomb evidence, ship interpretation, and surface testimony separately inspectable.",
  directInterfaces: "Toma and Orun hold structural authority; Nima holds care refusal; Cinder and Black Lamp Nine retain separate machine standing.",
  standby: "Ilya holds the silent extraction route while the district controls local movement.",
  stores: "Deliver heat and medicine before extracting evidence or claiming infrastructure.",
  emergencyAuthority: "The expedition may preserve life and withdraw; it may not annex, expose, or complete the relay handshake.",
};
reliefDescent.handoff = {
  dissent: "The ship wants the relay disabled; the Tomb argues that any attack may reveal the district.",
  injury: "The descent leaves one maintainer injured and one care worker in recovery debt.",
  readinessDebt: "The return watch inherits depleted pressure and translation reserves.",
  promises: "The district retains the right to refuse future ship access after the relief is complete.",
  missingPersons: "Several erased surface dead enter the ledger only through recovered household records.",
  uncertainty: "The relay may have learned enough to search again even without a completed handshake.",
};
reliefDescent.precedent = {
  newlyPossible: "A connected operation can preserve two source polities and one auditable transfer without merger.",
  newlyImpossible: "Relief can no longer be used as an unrecorded claim to route, evidence, or infrastructure.",
  newlyGovernable: "Cross-cartridge people, stores, evidence, exposure, and return effects become one custody object.",
  inheritedAsInfrastructure: "The ship and Tomb share a versioned connected-operation ledger while retaining separate state.",
};
reliefDescent.difficulty = 38;
reliefDescent.minAgents = 5;
reliefDescent.maxAgents = 6;
reliefDescent.requiredRoles = [
  { roleId: "mediation", count: 1 },
  { roleId: "analysis", count: 1 },
  { roleId: "maintenance", count: 1 },
  { roleId: "care", count: 1 },
  { roleId: "continuity", count: 1 },
];
reliefDescent.checks = [{
  id: "preserve-two-polities",
  name: "Preserve two polities",
  description: "Deliver life, recover evidence, and return through the Tomb without converting connection into absorption.",
  scope: "team",
  weights: { care: 0.2, systems: 0.2, translation: 0.2, continuity: 0.2, judgment: 0.2 },
  threshold: 54,
  failureType: "cascade",
  severity: 0.25,
}];
reliefDescent.success = "The expedition returns with changed ship and Tomb state, explicit exposure, and neither polity absorbed into the other's authority.";
reliefDescent.partial = "Relief succeeds, but the connected operation installs one new indispensable route or interpreter.";
reliefDescent.failure = "The expedition loses the route, exposes the district, or turns relief into annexation.";
reliefDescent.reputationGain = 5;
reliefDescent.currencyReward = 32;
reliefDescent.consequenceId = "connected-relief-ledger";
reliefDescent.shipStateEffects = [
  { track: "continuity", delta: 1, reason: "The connected operation preserves two state histories and one auditable transfer." },
  { track: "habitat-integrity", delta: 1, reason: "The ship and district retain survivable pressure and care paths through return." },
  { track: "compatibility-debt", delta: 1, reason: "The silent civic lock and connected ledger become new dependencies." },
];

const inquiry = copyWatch(3);
inquiry.accessAfter = reliefDescent.id;
inquiry.checks[0]!.threshold = 56;
inquiry.currencyReward = 30;

const returnConstitution = copyWatch(3);
returnConstitution.id = "carry-the-returning-constitution";
returnConstitution.name = "Carry the Returning Constitution";
returnConstitution.description = "The returning ship must decide which emergency accommodations become common infrastructure, which expire, and which persons retain the right to refuse the next circuit.";
returnConstitution.tierId = "handoff";
returnConstitution.system = "sovereign-core";
returnConstitution.accessAfter = inquiry.id;
returnConstitution.horizon = {
  closesWhen: "The next relief request arrives and temporary arrangements begin acting as inherited law.",
  physicalUrgency: "Depleted reserves and injured crew require immediate recovery allocations.",
  informationalUrgency: "Connected-run evidence may be normalized into one institution's preferred account.",
  institutionalUrgency: "Command, habitats, the vessel fork, and the Tomb each demand closure.",
  manufacturedUrgency: "The phrase mission complete is used to erase obligations created by success.",
};
returnConstitution.profiles = {
  requiredBodies: ["all founding profiles and their successors"],
  requiredHabitats: ["every continuing habitat band", "the connected-operation archive"],
  requiredClocks: ["recovery", "successor review", "short-life compensation", "fork reconciliation"],
  requiredTranslators: ["raw handoff record", "plural constitutional rendering"],
  requiredReserves: ["care", "succession", "route refusal", "archive redundancy"],
  lifeFractionCosts: ["the time already spent", "the next circuit's inherited burden"],
  requiredProfileIds: [
    "dry-humanoid-response",
    "aquatic-care-lineage",
    "heavy-maintainer-lineage",
    "manyborn-mediator-cloud",
    "nine-year-analyst-lineage",
    "counterborn-vessel-fork",
  ],
};
returnConstitution.composition = {
  absentActor: "Future residents who will inherit this ship cannot yet consent.",
  excludedBody: "Any profile represented only through a temporary adapter risks disappearing from the permanent charter.",
  dependency: "The connected archive and Cinder's route memory are necessary to prove what the mission changed.",
};
returnConstitution.allocation = {
  habitatBands: "Fund direct continuity paths before restoring discretionary command capacity.",
  translationPaths: "Keep raw dissent, alternate renderings, and Tomb testimony beside the official report.",
  directInterfaces: "Convert at least one mediated emergency path into shared direct infrastructure.",
  standby: "Protect recovery and successor review from immediate redeployment.",
  stores: "Compensate the bodies and lineages that spent disproportionate future on the circuit.",
  emergencyAuthority: "Every temporary power expires unless reauthorized by the standing it affected.",
};
returnConstitution.handoff = {
  dissent: "Some officers argue that preserving every objection makes future command impossible.",
  injury: "The named injuries and recovery debts remain attached to the institutions that caused them.",
  readinessDebt: "The next watch begins with explicit depleted reserves rather than a fictional reset.",
  promises: "The Lamp District retains route refusal, evidence custody, and standing in future circuit revisions.",
  missingPersons: "Future children, forks, and successor habitats receive represented standing but not fictional present consent.",
  uncertainty: "No audit can prove that every emergency dependency has become visible.",
};
returnConstitution.precedent = {
  newlyPossible: "The ship can revise itself without declaring one final body, clock, interface, or mission purpose.",
  newlyImpossible: "Mission completion can no longer erase connected obligations or private adaptation debt.",
  newlyGovernable: "Cross-polity return effects, life-fraction compensation, and expiration of emergency authority become constitutional law.",
  inheritedAsInfrastructure: "The Common Watch, connected-operation archive, and plural habitat charter persist into the next circuit.",
};
returnConstitution.difficulty = 44;
returnConstitution.minAgents = 6;
returnConstitution.maxAgents = 6;
returnConstitution.requiredRoles = [
  { roleId: "response", count: 1 },
  { roleId: "mediation", count: 1 },
  { roleId: "analysis", count: 1 },
  { roleId: "maintenance", count: 1 },
  { roleId: "care", count: 1 },
  { roleId: "continuity", count: 1 },
];
returnConstitution.checks = [{
  id: "ratify-the-returning-charter",
  name: "Ratify the returning charter",
  description: "Carry every material debt and refusal into durable law without freezing one emergency arrangement forever.",
  scope: "team",
  weights: { care: 0.15, systems: 0.15, translation: 0.15, continuity: 0.25, judgment: 0.2, resolve: 0.1 },
  threshold: 58,
  failureType: "stress",
  severity: 0.2,
}];
returnConstitution.success = "The Relief Circuit returns as a commonship whose next mission must answer to the people, bodies, clocks, and polities altered by this one.";
returnConstitution.partial = "The charter records the debts, but one emergency intermediary remains indispensable and therefore politically dominant.";
returnConstitution.failure = "Command restores the old baseline, converts temporary adaptations into permanent private burdens, or absorbs the Tomb's route into ship authority.";
returnConstitution.reputationGain = 6;
returnConstitution.currencyReward = 36;
returnConstitution.consequenceId = "returning-commonship-charter";
returnConstitution.shipStateEffects = [
  { track: "roster-resilience", delta: 1, reason: "Reserve, refusal, and successor paths become permanent watch law." },
  { track: "continuity", delta: 1, reason: "The connected mission remains auditable across future watches and generations." },
  { track: "compatibility-debt", delta: -1, reason: "At least one recurring adaptation burden becomes common infrastructure with a retirement path." },
];

const additionalConsequences: CommonShipConsequence[] = [
  {
    id: "plural-stores-ledger",
    label: "Plural stores become public law",
    kind: "adaptive-capacity",
    description: "Relief stores are tracked by continuity function, life-fraction cost, and substitution limit rather than one host cargo taxonomy.",
    inheritedBy: "Every habitat, successor, and destination receiving the ship's stores",
  },
  {
    id: "plural-approach-charter",
    label: "The approach watch receives a plural charter",
    kind: "doctrine",
    description: "Helm, structural authority, route memory, care refusal, and destination opacity remain separate powers with explicit expiry.",
    inheritedBy: "Future transit watches, hidden destinations, and the vessel fork",
  },
  {
    id: "silent-civic-lock",
    label: "The silent lock becomes a civic threshold",
    kind: "interface",
    description: "The ship and Lamp District share a pressure-compatible exchange route with joint stop authority and no completed target handshake.",
    inheritedBy: "Surface households, maintainers, care workers, and future relief circuits",
  },
  {
    id: "connected-relief-ledger",
    label: "The connected relief operation becomes one auditable custody object",
    kind: "continuity",
    description: "People, stores, evidence, environmental loads, exposure, ship state, and Tomb state travel together without collapsing either polity into the other.",
    inheritedBy: "The Relief Circuit, the Lamp District, and compatible players carrying the run",
  },
  {
    id: "returning-commonship-charter",
    label: "The returning constitution remains open",
    kind: "jurisdiction",
    description: "Emergency authority expires, connected obligations persist, and no one body, clock, interface, or mission purpose becomes the final definition of belonging.",
    inheritedBy: "Every future watch, resident, fork, habitat, and destination",
  },
];
source.consequences = [...source.consequences, ...additionalConsequences];
source.watches = [
  recognizeSchool,
  auditStores,
  composeWatch,
  declareApproach,
  crossMesh,
  dockQuietly,
  reliefDescent,
  inquiry,
  returnConstitution,
];
source.notes = {
  status: "canonical-reference",
  destinationCartridgeId: "lamp-district",
  connectedOperationFormat: "axm-connected-operation/v1",
  requiredCrossRunFacts: [
    "ship state before docking",
    "named watch and excluded actor",
    "habitat and translation allocations",
    "handoff dissent, injury, debt, promises, missing persons, and uncertainty",
    "precedent established aboard the ship",
    "Lamp District Alarm, visibility, map, habitat, and constituency changes",
    "return-state effects inherited by the ship",
  ],
};

export const RELIEF_CIRCUIT_SOURCE: CommonShipPocketSourceV2 = source;
/** Compatibility alias for the Gate 5 preparation branch. */
export const RELIEF_CIRCUIT_CANDIDATE = RELIEF_CIRCUIT_SOURCE;
