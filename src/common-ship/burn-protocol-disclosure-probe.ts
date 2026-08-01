import type {
  CommonShipEmbodimentProfile,
  CommonShipPocketSourceV2,
  CommonShipWatchBlueprintV2,
} from "./embodiment.js";
import { COMMON_SHIP_STARTER } from "./templates.js";

export const BURN_PROTOCOL_V058_SHA256 =
  "b3b299e14d8c22cde88629eb6bc4d197b8f8015eec7bf46b95f0de2a31b5f0df" as const;

export const BURN_PROTOCOL_CORPUS_PUBLICATION_PROBE = {
  format: "rodoh-corpus-publication-probe/1",
  id: "burn-protocol-v0-58-0-a13c1",
  classification: "metadata-only-private-branch-probe",
  sourceRecord: {
    title: "A12C3 is complete and sealed as v0.58.0",
    availableEvidence: "supplied-status-record",
    unavailableEvidence: [
      "sealed-v0.58.0-estate-zip",
      "a13c1-fresh-session-handoff-zip",
      "panel-and-plate-image-payloads",
      "machine-readable-manifests-and-validation-receipts",
    ],
  },
  exactParent: {
    estateVersion: "0.58.0",
    sha256: BURN_PROTOCOL_V058_SHA256,
    illustratedThrough: "A12C3",
    nextTransaction: "A13C1",
    nextTitle: "Disclosure",
  },
  corpus: {
    canonicalEpisodeSources: 13,
    scriptedPanels: 780,
    illustratedPanels: 720,
    completedVisualChapters: 36,
    scrollPlates: 144,
    remainingScriptedPanels: 60,
  },
  publication: {
    cartridgeId: "burn-protocol-disclosure-probe",
    sourcePlane: "common-ship-pocket/1",
    worldReceiver: "common-ship",
    inheritedHistory: "read-only",
    liveRunAuthority: "counterfactual-only",
    assetPolicy: "no-panel-payloads-in-probe",
  },
  controlQuestion:
    "Can public truth produce accountable repair without allowing Starfleet, the former Chain, the hearing, or the archive itself to become the new sovereign owner of the record?",
} as const;

const source = structuredClone(COMMON_SHIP_STARTER) as CommonShipPocketSourceV2;
source.identity = {
  id: "burn-protocol-disclosure-probe",
  title: "The Burn Protocol: Disclosure and Repair",
  description:
    "A metadata-only publication probe that converts the sealed A12C3 aftermath and contracted A13C1 hearing into four deterministic governance watches for Rodoh.",
  author: "The Burn Project",
  version: "0.1.0",
  estimatedCycles: 4,
  parentCanons: [
    "The Burn Protocol sealed estate v0.58.0 through A12C3",
    "The Burn Protocol A13C1 production contract: Disclosure",
  ],
  canonRelation: "private-branch",
};
source.controlQuestion = BURN_PROTOCOL_CORPUS_PUBLICATION_PROBE.controlQuestion;

source.pressures = [
  ["vessel-form", "six-repository-hearing", "Six-repository hearing", "Six independently governed repositories preserve one hearing without creating a sovereign transcript."],
  ["mission", "public-reconstruction", "Public reconstruction", "Discovery and six bounded mandates must restore damaged corridors while producing evidence that can fail publicly."],
  ["host-baseline", "starfleet-exclusive-jurisdiction", "Starfleet exclusive jurisdiction", "Starfleet inherited the capacity to classify failure, authorize repair, and publish the official record as one institutional act."],
  ["temporal-conflict", "incompatible-repair-clocks", "Incompatible repair clocks", "Repositories, ships, communities, and protected witnesses deliberate and withdraw on incompatible clocks."],
  ["ordinary-good", "six-public-relief-routes", "Six public relief routes", "Food, medicine, transit, family contact, and corridor repair must continue while responsibility remains contested."],
  ["excluded-actor", "protected-sukal-disclosure", "Su'Kal's protected disclosure authority", "The hearing seeks certainty while Su'Kal's historical record, biological access, and right to refuse remain distinct claims."],
  ["approaching-trigger", "repair-before-record-closes", "Repair before the record closes", "Corridor dependencies worsen while political actors press the hearing to freeze a single explanation."],
  ["cost-of-adaptation", "incomplete-mandates-and-withdrawal", "Incomplete mandates and withdrawal", "Separate withdrawal rights preserve local authority but can strand shared repair and externalize cost."],
  ["scale-revelation", "archive-can-become-sovereign", "The archive can become sovereign", "A record designed to prevent capture can become the only route through which later actors are recognized or authorized."],
].map(([kind, id, label, description]) => ({ kind, id, label, description })) as unknown as CommonShipPocketSourceV2["pressures"];

source.evidence = {
  tier: "contested-canon",
  claim: "Six independent repositories can preserve one public hearing and reconstruct accountable overlap after local action without owning contemporaneous truth.",
  venue: "The open A13C1 hearing and first reconstruction cycle",
  legitimacyTarget: "Starfleet's inherited combination of failure classification, archive custody, and repair jurisdiction",
  upsideIfAccepted: "The record creates visible obligations, bounded mandates, withdrawal rights, and repair evidence without restoring a sovereign center.",
  downsideIfAccepted: "Fragmented custody may delay action and permit responsibility to move between repositories.",
  failureIfFalse: "The hearing either recentralizes authority or produces a record too weak to govern repair.",
  receipts: [{
    id: "v058-status-record",
    label: "v0.58.0 production status record",
    source: "The supplied markdown record naming the sealed parent, corpus counts, A12C3 qualification, and A13C1 production pointer",
    intervention: "This probe binds only the stated checksum, counts, lineage boundary, and control question into a non-bundled source and Arc.",
    limits: "The ZIPs, images, manifests, audit JSON, and complete production-contract bytes were unavailable and are not independently revalidated.",
  }],
};

const factionRows: Array<[string, string, string, string, string]> = [
  ["starfleet", "Starfleet", "jurisdiction, fleet capacity, and the inherited official record", "Coordinate scarce repair and disclose institutional failure.", "Disclosure becomes self-absolution while custody and repair authority remain exclusive."],
  ["former-chain", "Former Chain infrastructure", "maintenance networks, title history, and coercive ownership residue", "Retain practical knowledge needed to keep corridors functioning.", "Maintenance becomes a route for coercive ownership, profit, or unpaid public cost to survive."],
  ["public-repositories", "Six public repositories", "custody, comparison, public access, and later reconstruction", "Prevent one institution from editing the only record.", "Indexing rules become distributed sovereign authority."],
  ["protected-witnesses", "Protected witnesses and affected communities", "disclosure consent, kinship standing, local withdrawal, and repair cost", "Preserve authority over access, representation, and refusal.", "Privacy or local refusal conceals shared dependencies and public cost."],
];
source.factionReceipts = factionRows.map(([
  factionId,
  factionName,
  variableControlled,
  publicGood,
  characteristicFailure,
]) => ({ factionId, factionName, variableControlled, publicGood, characteristicFailure }));

const cast: Array<[string, string, CommonShipPocketSourceV2["cast"][number]["roleId"], CommonShipPocketSourceV2["cast"][number]["responsibility"], string, string, string]> = [
  ["vance", "Admiral Vance", "response", "depends-on-host-baseline", "Enters Starfleet's failures while operating through its fastest repair baseline.", "starfleet", "starfleet-command-officer"],
  ["osyraa", "Osyraa", "maintenance", "understands-maintenance-reality", "Separates useful infrastructure from coercive ownership, profit, and unpaid public cost.", "former-chain", "chain-infrastructure-operator"],
  ["georgiou", "Philippa Georgiou", "analysis", "benefits-from-delay", "Names the Terran doctrine while leaving her approving seal visible.", "public-repositories", "terran-doctrine-witness"],
  ["saru", "Saru", "mediation", "translates-excluded-actor", "Enters kinship as relationship rather than authority over another person's history.", "protected-witnesses", "kelpien-kinship-mediator"],
  ["sukal", "Su'Kal", "care", "bears-adaptation-tax", "Determines what may be disclosed and bears the cost of demands for biological certainty.", "protected-witnesses", "protected-biological-witness"],
  ["discovery", "USS Discovery reconstruction platform", "continuity", "sovereign-exception", "Carries damaged mobility, archive lineage, and reconstruction capacity that could become another exclusive mandate.", "starfleet", "discovery-reconstruction-platform"],
];
source.cast = cast.map(([id, name, roleId, responsibility, description, factionId, profileId]) => ({
  id, name, roleId, responsibility, description, factionId, profileId,
}));

function profileFrom(
  template: CommonShipEmbodimentProfile,
  id: string,
  name: string,
  description: string,
  dependencies: string[],
  forbiddenAssumptions: string[],
): CommonShipEmbodimentProfile {
  const profile = structuredClone(template);
  profile.id = id;
  profile.name = name;
  profile.description = description;
  profile.environment.dependencies = dependencies;
  profile.sensorium.communication = ["direct statement", "source-preserving public record", "bounded refusal"];
  profile.interface.forbiddenAssumptions = forbiddenAssumptions;
  profile.temporal.externalInterval = "Uses public hearing time while retaining a separately governed deliberation and withdrawal clock.";
  profile.temporal.subjectiveResolution = "Can act inside fleet time without treating rapid judgment as settled public authority.";
  profile.temporal.developmentalTempo = "Standing derives from lived institutional or cultural history rather than one qualification scale.";
  profile.temporal.recoveryCycle = "Requires protected intervals in which testimony, command, or analysis is not permanently available.";
  profile.temporal.continuitySpan = "A continuing person or platform whose copied record does not transfer authority over the source.";
  profile.temporal.expectedLifespan = "The probe records no medical prognosis.";
  profile.temporal.lifeFractionAccounting = "Delay, exposure, repair labor, and witness burden remain attached to named actors.";
  profile.lineageDependencies = [...dependencies, "independent evidence custody"];
  return profile;
}

const human = source.embodimentProfiles[0]!;
const vessel = source.embodimentProfiles[5]!;
source.embodimentProfiles = [
  profileFrom(human, "starfleet-command-officer", "Starfleet command officer", "Immediate access to fleet procedure and the institution under review.", ["fleet channel", "public failure record", "bounded repair authority"], ["command access equals legitimacy", "institutional confession completes accountability"]),
  profileFrom(human, "chain-infrastructure-operator", "Former Chain infrastructure operator", "Practical maintenance knowledge entangled with former ownership and profit.", ["local maintainers", "title-release receipt", "public-cost ledger"], ["useful infrastructure validates ownership", "local duty cancels public debt"]),
  profileFrom(human, "terran-doctrine-witness", "Terran doctrine witness", "Adversarial doctrine witness retaining visible responsibility for prior approval.", ["visible approving seal", "doctrine comparison", "cross-examination"], ["correct diagnosis erases complicity", "strategic ambiguity is neutral"]),
  profileFrom(human, "kelpien-kinship-mediator", "Kelpien kinship mediator", "Relational access and obligation without authority over Su'Kal's disclosure.", ["kinship standing", "consent boundary", "non-proprietary cultural record"], ["kinship transfers consent", "cultural fluency grants representation authority"]),
  profileFrom(human, "protected-biological-witness", "Protected biological witness", "A body and historical recording that remain evidence sources without becoming public infrastructure.", ["private biological access", "historical recording", "right to refuse prediction"], ["certainty justifies bodily access", "historical evidence authorizes prediction"]),
  profileFrom(vessel, "discovery-reconstruction-platform", "Discovery reconstruction platform", "A damaged distributed vessel whose hull, archive, command, and public mission remain separable authorities.", ["local-physics navigation", "half jump envelope", "dark spore manifold", "six evidence shards"], ["complete record establishes jurisdiction", "repair capacity creates corridor ownership"]),
];

const anatomyText = [
  ["The damaged reconstruction fleet", "Six ships, Discovery, and Su'Kal's capsule move repair capacity without occupying a sovereign center.", "Public corridor repair under incomplete mandates.", "The most mobile ship should inherit route command.", "Each mandate holder and affected community retains stop and withdrawal authority."],
  ["The repair corridors", "Damaged stations, routes, and communities remain inhabited environments rather than abstract targets.", "Keep six public relief routes active.", "Stability can be measured without naming who bears interruption.", "Affected communities and local maintainers share revision authority."],
  ["The open hearing", "Testimony, title release, evidence transfer, and withdrawal notices move authority between institutions.", "Convert history into obligations that can fail publicly.", "Participation implies acceptance of hearing jurisdiction.", "Participants retain correction, refusal, and withdrawal paths."],
  ["The six-repository mesh", "Independent custody preserves evidence, omitted context, and later comparison without one live success clock.", "Compare testimony and repair receipts after action.", "A common index is required for public truth.", "Repositories publish discrepancies without surrendering custody."],
  ["The mandate lattice", "Roles, expiry, withdrawal, reserves, and local stop rights assemble temporary repair polities.", "Issue six incomplete assignments.", "Fleet availability and authority are the same variable.", "Mandates expire locally and remain publicly reviewable."],
  ["The public continuity commons", "Relief routes, kinship, archives, and repair obligations survive any one hearing or watch.", "Carry ordinary life and unresolved obligations into later cycles.", "The official archive owns continuity.", "Source actors and affected communities retain standing in later use."],
  ["The rootless reconstruction charter", "The hearing defines what remains common without allowing record or repair to become ownership.", "Bound public reconstruction after A12C3.", "The institution that publishes the record should govern repair.", "No new jurisdiction is valid without bounded purpose, expiry, and withdrawal."],
] as const;
source.anatomy = source.anatomy.map((item, index) => {
  const [label, description, currentUse, hostAssumption, revisionAuthority] = anatomyText[index]!;
  return { ...item, label, description, currentUse, hostAssumption, revisionAuthority };
}) as unknown as CommonShipPocketSourceV2["anatomy"];

const temporalText = [
  ["Shared timestamps sequence the hearing without proving one sovereign account.", "Repository comparison, repair windows, and mandate expiry.", "A common timestamp becomes a common authority clock."],
  ["Actors perceive urgency and evidence at different resolutions.", "Fleet response, protected testimony, and delayed reconstruction.", "Fast judgment becomes permanent proxy for slower standing."],
  ["Institutional, cultural, and personal standing mature on different scales.", "Qualification, kinship, disclosure, and succession.", "One institutional career becomes the definition of competence."],
  ["Repair, testimony, and command consume distinct recovery intervals.", "Standby, witness access, and maintenance duty.", "Availability becomes administrative property."],
  ["People, ships, and repositories persist through different succession mechanisms.", "Archive custody, ship handoff, and protected history.", "The longest-lived custodian converts memory into ownership."],
  ["Delay and exposure are recorded as portions of meaningful future and public capacity.", "Route choice, witness burden, and repair allocation.", "A comparative ledger becomes a false exchange rate for lives."],
] as const;
source.temporalProfile = source.temporalProfile.map((item, index) => {
  const [description, operationalUse, captureRisk] = temporalText[index]!;
  return { ...item, description, operationalUse, captureRisk };
}) as unknown as CommonShipPocketSourceV2["temporalProfile"];

const translationText = [
  ["Claims and implications remain attached to source actors.", "Witnesses, repository copies, and public cross-examination.", "Fluent synthesis conceals incompatible categories.", "Sources retain correction and refusal rights."],
  ["Turn-taking and decision horizons are coordinated without one present-tense proxy.", "Bounded mandates, asynchronous testimony, and expiry.", "Summary becomes the continuing will of an absent actor.", "Delegation expires and remains auditable."],
  ["Recordings, telemetry, bodily evidence, and local conditions remain separately legible.", "Raw corridor evidence and protected testimony.", "Preferred rendering erases the source channel.", "Raw and alternate channels remain available."],
  ["Controls and archive access are mapped without compulsory mediation.", "Repair stops, repository corrections, and witness access.", "Access depends on one intermediary.", "Direct and inspectable paths remain contestable."],
  ["Corridor and hearing environments are bridged without treating Starfleet procedure as neutral.", "Local repair, public access, and protected evidence.", "One authority space becomes the native environment.", "Baselines are marked and jurisdiction limited."],
  ["The system names who may certify, override, or act through a record.", "Hearing procedure, local withdrawal, and repository governance.", "The useful translator becomes the only representative institution.", "No intermediary becomes indispensable without review."],
  ["Dissent, injury, cost, missing actors, and uncertainty survive handoff.", "Later reconstruction and mandate review.", "Operational summary erases claims that challenge the receiver.", "Source evidence and unresolved standing remain attached."],
] as const;
source.translationStack = source.translationStack.map((item, index) => {
  const [description, intermediary, failureMode, refusalPath] = translationText[index]!;
  return { ...item, description, intermediary, failureMode, refusalPath };
}) as unknown as CommonShipPocketSourceV2["translationStack"];

const testText = [
  ["Every required public function is performable by the actual roster.", "Response, maintenance, analysis, mediation, care, and continuity remain represented.", "One person or institution becomes an unreviewable veto."],
  ["Local action, testimony, withdrawal, and later reconstruction overlap lawfully.", "Rapid authority expires while slower actors retain standing.", "Temporary latency becomes permanent incapacity."],
  ["Actors remain whole in hearing, repair, and protected evidence environments.", "No function depends on repeated disabling access.", "Absence from the common space is treated as ordinary operation."],
  ["No one repository or interpreter can silence a required actor.", "Plural copies, raw evidence, and correction paths survive failure.", "The translator governs by becoming the only institutional route."],
  ["The next cycle inherits evidence, dissent, authority, and unfinished obligations.", "Costs and promises remain attached to named sources.", "Responsibility is erased as a new technical fact."],
  ["Delay, repair, exposure, and review burdens do not repeatedly fall on the same actors.", "Disproportionate sacrifice creates visible standing or compensation.", "External time conceals whose future is being spent."],
] as const;
source.watchTests = source.watchTests.map((item, index) => {
  const [description, passCondition, failureConsequence] = testText[index]!;
  return { ...item, description, passCondition, failureConsequence };
}) as unknown as CommonShipPocketSourceV2["watchTests"];

const stateText = [
  [2, "Six public routes retain survivable local repair paths.", "At 0, ordinary relief access fails."],
  [2, "Mandates, testimony, withdrawal, and reconstruction can hand responsibility across clocks.", "At 0, no legitimate shared action can be assembled."],
  [2, "Representations preserve provenance, disagreement, and refusal.", "At 0, fluent publication no longer establishes accountable understanding."],
  [2, "Separate ships, repositories, and local stop paths survive correlated loss.", "At 0, one actor becomes the universal fallback."],
  [2, "Relief and repair reserves support continued ordinary life.", "At 0, repair requires irreversible sacrifice."],
  [3, "The sealed history and current obligations remain linked without one owner.", "At 0, later action loses a shared account of what it inherits."],
  [2, "Evidence is public enough for review without collapsing protected boundaries.", "At 0, either concealment or public legitimacy fails."],
  [2, "Private workarounds and indispensable actors remain visible as debt.", "At 4, a repository, ship, or intermediary governs through indispensability."],
] as const;
source.shipState = source.shipState.map((item, index) => {
  const [value, description, crisisCondition] = stateText[index]!;
  return { ...item, value, description, crisisCondition };
}) as unknown as CommonShipPocketSourceV2["shipState"];

source.consequences = [
  { id: "six-repository-hearing-open", label: "The hearing remains open in six repositories", kind: "archive", description: "No sovereign transcript closes the record before repair produces new evidence.", inheritedBy: "Every repository, witness, mandate holder, and affected community" },
  { id: "separate-withdrawal-mandates", label: "Six mandates retain separate withdrawal rights", kind: "jurisdiction", description: "Repair assignments remain incomplete, expiring, and locally withdrawable.", inheritedBy: "Six ships, corridor communities, maintainers, and later review" },
  { id: "first-corridor-public-repair", label: "The first corridor repair remains public and reversible", kind: "route", description: "Relief continues through a repair whose stop authority, cost, and evidence remain inspectable.", inheritedBy: "Corridor communities, relief operators, repositories, and later crews" },
  { id: "read-only-reconstruction-ledger", label: "The read-only reconstruction remains bounded", kind: "continuity", description: "Post-action comparison preserves discrepancies without becoming a live command clock.", inheritedBy: "All later repair cycles and public uses of the record" },
];

interface WatchInput {
  id: string;
  name: string;
  description: string;
  tierId: CommonShipWatchBlueprintV2["tierId"];
  system: CommonShipWatchBlueprintV2["system"];
  accessAfter?: string;
  profiles: string[];
  roles: CommonShipWatchBlueprintV2["requiredRoles"];
  weights: CommonShipWatchBlueprintV2["checks"][number]["weights"];
  threshold: number;
  difficulty: number;
  consequenceId: string;
  effects: CommonShipWatchBlueprintV2["shipStateEffects"];
  action: string;
  horizon: string;
}

const starterWatches = structuredClone(source.watches);
function burnWatch(index: number, input: WatchInput): CommonShipWatchBlueprintV2 {
  const base = structuredClone(starterWatches[index]!);
  return {
    ...base,
    id: input.id,
    name: input.name,
    description: input.description,
    tierId: input.tierId,
    system: input.system,
    ...(input.accessAfter ? { accessAfter: input.accessAfter } : {}),
    horizon: {
      closesWhen: input.horizon,
      physicalUrgency: "Public relief and damaged corridor systems continue to degrade.",
      informationalUrgency: "The intervention will change the evidence available to later review.",
      institutionalUrgency: "Participants seek proof that the hearing can govern repair.",
      manufacturedUrgency: "A complete central answer is presented as the only way to act.",
    },
    profiles: {
      requiredBodies: ["institutional actor", "local operator", "protected witness", "public custodian", "reconstruction platform"],
      requiredHabitats: ["open hearing", "damaged corridor", "independent repositories"],
      requiredClocks: ["local action", "withdrawal", "public review", "later reconstruction"],
      requiredTranslators: ["source testimony", "raw telemetry", "read-only hashes"],
      requiredReserves: ["local stop path", "uncommitted repair reserve", "independent custody"],
      lifeFractionCosts: ["witness exposure", "repair labor", "delayed relief", "audit capacity"],
      requiredProfileIds: input.profiles,
    },
    composition: {
      absentActor: "No actor possesses the complete contemporaneous record or dependency graph.",
      excludedBody: "Deferred communities and protected refusals remain visible without invented content.",
      dependency: "The action depends on independent custody and a locally exercisable stop path.",
    },
    allocation: {
      habitatBands: "Preserve ordinary relief and local survival thresholds through a reversible path.",
      translationPaths: "Keep source testimony, raw telemetry, and later comparison separately inspectable.",
      directInterfaces: "Local operators and source actors retain stop, correction, and withdrawal authority.",
      standby: "Keep one reserve outside the active mandate and prevent Discovery from becoming the universal fallback.",
      stores: "Spend repair and audit capacity against named dependencies and public cost.",
      emergencyAuthority: "Preserve life and withdraw locally without claiming route, record, or continuing jurisdiction.",
    },
    handoff: {
      dissent: "Participants dispute whether bounded authority is sufficient for shared responsibility.",
      injury: "Exposure, interruption, and repair cost remain attached to named actors.",
      readinessDebt: "The next cycle inherits depleted reserves and unresolved dependencies.",
      promises: "Every mandate, refusal, discrepancy, and deferred route remains reviewable.",
      missingPersons: "No complete contemporaneous observer can be reconstructed after the fact.",
      uncertainty: "Compatible records do not prove one settled interpretation or rightful owner.",
    },
    precedent: {
      newlyPossible: `${input.action} without transferring ownership to the actor performing it.`,
      newlyImpossible: "A clean success summary may no longer erase withdrawal, cost, discrepancy, or protected refusal.",
      newlyGovernable: "Expiry, local stop authority, source evidence, and unresolved obligation become public variables.",
      inheritedAsInfrastructure: "A bounded mandate and read-only evidence path persist into the next cycle.",
    },
    difficulty: input.difficulty,
    minAgents: 5,
    maxAgents: 6,
    requiredRoles: input.roles,
    checks: [{
      id: `${input.id}-check`,
      name: input.action,
      description: `${input.action} while preserving local withdrawal, public evidence, and a non-sovereign record.`,
      scope: "team",
      weights: input.weights,
      threshold: input.threshold,
      failureType: input.tierId === "resolve-pressure" ? "cascade" : "stress",
      severity: input.tierId === "resolve-pressure" ? 0.3 : 0.2,
    }],
    success: `${input.action}; the result remains bounded, public, reversible where material, and separately held.`,
    partial: `${input.action}; one ship, repository, or intermediary nevertheless becomes practically indispensable.`,
    failure: `The attempt to ${input.action.toLowerCase()} recentralizes authority, erases protected standing, or leaves repair without accountable evidence.`,
    reputationGain: input.tierId === "resolve-pressure" ? 5 : 4,
    currencyReward: input.tierId === "resolve-pressure" ? 30 : 24,
    consequenceId: input.consequenceId,
    shipStateEffects: input.effects,
  };
}

const hearingProfiles = [
  "starfleet-command-officer",
  "chain-infrastructure-operator",
  "terran-doctrine-witness",
  "kelpien-kinship-mediator",
  "protected-biological-witness",
];
const repairProfiles = [
  "starfleet-command-officer",
  "chain-infrastructure-operator",
  "kelpien-kinship-mediator",
  "protected-biological-witness",
  "discovery-reconstruction-platform",
];
const reviewProfiles = [
  "chain-infrastructure-operator",
  "terran-doctrine-witness",
  "kelpien-kinship-mediator",
  "protected-biological-witness",
  "discovery-reconstruction-platform",
];
source.watches = [
  burnWatch(0, {
    id: "open-the-six-repository-hearing",
    name: "Open the Six-Repository Hearing",
    description: "Enter institutional failure, title history, complicity, kinship, and protected disclosure into six independently governed copies.",
    tierId: "ordinary-life",
    system: "common-thresholds",
    profiles: hearingProfiles,
    roles: [{ roleId: "response", count: 1 }, { roleId: "maintenance", count: 1 }, { roleId: "analysis", count: 1 }, { roleId: "mediation", count: 1 }, { roleId: "care", count: 1 }],
    weights: { care: 0.15, systems: 0.1, translation: 0.2, continuity: 0.2, judgment: 0.25, resolve: 0.1 },
    threshold: 50,
    difficulty: 26,
    consequenceId: "six-repository-hearing-open",
    effects: [{ track: "translation-trust", delta: 1, reason: "Source, disagreement, and refusal remain separately inspectable." }, { track: "visibility", delta: 1, reason: "Institutional failure enters six public copies." }],
    action: "Open one hearing without creating a sovereign transcript",
    horizon: "The hearing is pressed to close before the first repair produces new evidence.",
  }),
  burnWatch(1, {
    id: "assign-the-six-withdrawal-mandates",
    name: "Assign the Six Withdrawal Mandates",
    description: "Prioritize corridor repair through dependency, evidence quality, and reversibility while preserving separate withdrawal rights.",
    tierId: "compose-watch",
    system: "watch-lattice",
    accessAfter: "open-the-six-repository-hearing",
    profiles: repairProfiles,
    roles: [{ roleId: "response", count: 1 }, { roleId: "maintenance", count: 1 }, { roleId: "mediation", count: 1 }, { roleId: "care", count: 1 }, { roleId: "continuity", count: 1 }],
    weights: { care: 0.15, systems: 0.25, translation: 0.1, continuity: 0.15, judgment: 0.25, resolve: 0.1 },
    threshold: 54,
    difficulty: 30,
    consequenceId: "separate-withdrawal-mandates",
    effects: [{ track: "roster-resilience", delta: 1, reason: "Six mandates and one reserve separate failure modes." }, { track: "temporal-coherence", delta: 1, reason: "Expiry and withdrawal connect local clocks to public review." }, { track: "compatibility-debt", delta: 1, reason: "Incomplete mandates leave dependencies for later reconciliation." }],
    action: "Issue six incomplete, expiring, independently withdrawable repair mandates",
    horizon: "Route degradation removes the evidence needed to compare reversible assignments.",
  }),
  burnWatch(2, {
    id: "repair-the-first-public-corridor",
    name: "Repair the First Public Corridor",
    description: "Execute one reversible repair while relief remains active, local withdrawal stays real, and new facts enter independent custody.",
    tierId: "resolve-pressure",
    system: "transit-body",
    accessAfter: "assign-the-six-withdrawal-mandates",
    profiles: repairProfiles,
    roles: [{ roleId: "response", count: 1 }, { roleId: "maintenance", count: 1 }, { roleId: "mediation", count: 1 }, { roleId: "care", count: 1 }, { roleId: "continuity", count: 1 }],
    weights: { care: 0.2, systems: 0.25, translation: 0.15, continuity: 0.1, judgment: 0.15, resolve: 0.15 },
    threshold: 56,
    difficulty: 36,
    consequenceId: "first-corridor-public-repair",
    effects: [{ track: "habitat-integrity", delta: 1, reason: "One relief corridor gains a reversible repair path." }, { track: "stores-and-care", delta: 1, reason: "Ordinary relief continues through the intervention." }, { track: "visibility", delta: -1, reason: "Local action cannot be understood contemporaneously by every repository." }],
    action: "Repair one public corridor while preserving relief and local withdrawal",
    horizon: "The local relief reserve reaches its minimum survivable threshold.",
  }),
  burnWatch(3, {
    id: "publish-the-read-only-reconstruction",
    name: "Publish the Read-Only Reconstruction",
    description: "Compare six independently governed copies after action while preserving discrepancy, refusal, and the limits of later knowledge.",
    tierId: "handoff",
    system: "continuity-commons",
    accessAfter: "repair-the-first-public-corridor",
    profiles: reviewProfiles,
    roles: [{ roleId: "maintenance", count: 1 }, { roleId: "analysis", count: 1 }, { roleId: "mediation", count: 1 }, { roleId: "care", count: 1 }, { roleId: "continuity", count: 1 }],
    weights: { care: 0.1, systems: 0.1, translation: 0.25, continuity: 0.25, judgment: 0.25, resolve: 0.05 },
    threshold: 54,
    difficulty: 32,
    consequenceId: "read-only-reconstruction-ledger",
    effects: [{ track: "continuity", delta: 1, reason: "The hearing and repair remain linked through source-preserving receipts." }, { track: "translation-trust", delta: 1, reason: "Discrepancy and refusal survive comparison." }, { track: "compatibility-debt", delta: -1, reason: "One cycle of comparison becomes shared public infrastructure." }],
    action: "Reconstruct accountable overlap after action without inheriting command",
    horizon: "The next repair cycle begins using the first operation as precedent.",
  }),
];

source.notes = {
  status: "publication-probe",
  sourceRecord: "supplied-v0.58.0-status-markdown",
  exactParentSha256: BURN_PROTOCOL_V058_SHA256,
  illustratedThrough: "A12C3",
  nextTransaction: "A13C1",
  nextTitle: "Disclosure",
  corpusCounts: BURN_PROTOCOL_CORPUS_PUBLICATION_PROBE.corpus,
  canonicalBoundary: {
    inheritedHistory: "read-only",
    liveRuns: "counterfactual-only",
    storyChanges: "none",
    panelPayloads: "not-present",
  },
  intendedWorldSurface: ["common-ship", "hall", "graph", "report"],
};

export const BURN_PROTOCOL_DISCLOSURE_PROBE_SOURCE: CommonShipPocketSourceV2 = source;
