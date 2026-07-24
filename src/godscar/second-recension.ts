import type { JsonValue } from "../engine/types.js";
import type { CanonTier } from "./types.js";

export const SECOND_RECENSION_FORMAT = "godscar-second-recension/1" as const;
export const SECOND_RECENSION_NOTE_KEY = "godscar.second-recension@1" as const;
export const CONSEQUENCE_PLANE_RECEIPT_FORMAT = "godscar-consequence-plane-receipt/1" as const;

export type SecondRecensionBookId = "book-i" | "book-ii" | "book-iii";
export type ConsequenceScale = "pocket" | "route" | "sector" | "cascade";

export interface ConsequenceScaleRule {
  scale: ConsequenceScale;
  operationalQuestion: string;
  authorityBoundary: string;
  transitionTrigger: string;
}

export interface SectorLedger {
  changedPockets: string[];
  changedRoutes: string[];
  classificationShifts: string[];
  factionStanding: string[];
  evidence: string[];
  dissent: string[];
  uncertainty: string[];
  nextPressure: string;
}

export interface ConsequencePlaneReceipt {
  format: typeof CONSEQUENCE_PLANE_RECEIPT_FORMAT;
  id: string;
  scale: ConsequenceScale;
  sourcePocketId: string;
  claim: string;
  evidenceTier: CanonTier;
  provenance: string[];
  decisions: string[];
  dissent: string[];
  uncertainty: string[];
  obligations: string[];
  consequences: string[];
  sectorLedger: SectorLedger;
  reviewAuthority: string;
}

export interface BookIConsequencePlaneLedger {
  scales: [ConsequenceScaleRule, ConsequenceScaleRule, ConsequenceScaleRule, ConsequenceScaleRule];
  sectorLedger: SectorLedger;
  legitimacyAfterContact: {
    claimants: string[];
    authorityLimits: string[];
    review: string;
  };
  greatformLatency: {
    observer: string;
    noticeInterval: string;
    localAuthority: string;
    antiCapture: string;
  };
  consequenceTurn: [
    "receive-bounded-receipt",
    "update-route-and-classification",
    "record-faction-interpretations",
    "preserve-dissent-and-uncertainty",
    "declare-next-pressure",
  ];
}

export interface LineageScarRecord {
  id: string;
  missingFunction: string;
  cause: string;
  currentDependency: string;
  coercionRisk: string;
  alternatives: string[];
  evidenceTier: CanonTier;
}

export interface ReproductiveOverheadRecord {
  id: string;
  population: string;
  ordinaryGood: string;
  wake: string;
  denialCost: string;
  allocationAuthority: string;
}

export interface SurfaceSovereigntyRecord {
  id: string;
  population: string;
  inheritedClassification: string;
  sovereigntyClaim: string;
  currentControl: string;
  revisionAuthority: string;
}

export interface NegativeConfederationRecord {
  status: "absent" | "candidate" | "member";
  boundedMembers: string[];
  verificationProtocol: string;
  mapBoundary: string;
  obligations: string[];
  captureRisk: string;
}

export interface LivingChronalTombRecord {
  kind: "fixed" | "living" | "chronal";
  hostOrInterval: string;
  hostClaim: string;
  continuityRisk: string;
  observerRelation: string;
}

export interface LayeredOpeningRecord {
  layer: string;
  status: "sealed" | "bounded" | "open" | "contested";
  authority: string;
  protectedUnknowns: string[];
  exposureCost: string;
  reviewTrigger: string;
}

export interface BookIILivingTombLedger {
  lineageScars: LineageScarRecord[];
  reproductiveOverhead: ReproductiveOverheadRecord[];
  surfaceSovereignty: SurfaceSovereigntyRecord[];
  negativeConfederation: NegativeConfederationRecord;
  host: LivingChronalTombRecord;
  opening: LayeredOpeningRecord[];
}

export interface BookIIIExpandedCommonshipLedger {
  profileAuthority: {
    operationalFields: string[];
    revisionAuthority: string;
    forbiddenUse: string[];
  };
  profileMultiplicity: {
    rule: string;
    rosterRequirement: string;
    antiCasteRule: string;
  };
  publicGeometry: {
    bodyEnvelopeFields: string[];
    accessFloor: string[];
    emergencyAudit: string;
  };
  preparationLaw: {
    lawfulActions: string[];
    requiredReceipt: string[];
    politicalRisk: string;
  };
  connectedOperation: {
    requiredFacts: string[];
    authorityBoundary: string;
    returnRequirement: string;
  };
  vesselContinuityClaim: {
    currentStatus: "unclaimed" | "contested" | "recognized";
    evidenceRequired: string[];
    ownershipRefusal: string;
  };
  referenceCampaign: string;
}

export type SecondRecensionLedger =
  | BookIConsequencePlaneLedger
  | BookIILivingTombLedger
  | BookIIIExpandedCommonshipLedger;

export interface SecondRecensionNote {
  format: typeof SECOND_RECENSION_FORMAT;
  edition: "second-recension";
  preservesFirstRecension: true;
  bookId: SecondRecensionBookId;
  bookIVExcluded: true;
  ledger: SecondRecensionLedger;
  crossBookProtocol: {
    carries: string[];
    preservesUnknownMemory: true;
    prohibited: string[];
  };
}

export const SECOND_RECENSION_CROSS_BOOK_PROTOCOL: SecondRecensionNote["crossBookProtocol"] = {
  carries: [
    "source and destination identities",
    "state before and after",
    "named people and selected actors",
    "evidence and provenance",
    "decisions, dissent, and uncertainty",
    "obligations and consequences",
  ],
  preservesUnknownMemory: true,
  prohibited: [
    "inventing an outcome in the receiving book",
    "normalizing unfamiliar people into local vocabulary",
    "claiming a map or authority the source did not grant",
    "discarding uninterpreted namespaced memory",
  ],
};

const CONSEQUENCE_SCALES: BookIConsequencePlaneLedger["scales"] = [
  {
    scale: "pocket",
    operationalQuestion: "What changed inside the immediate world, vessel, Tomb, or institution?",
    authorityBoundary: "The local receipt remains authoritative about local state.",
    transitionTrigger: "A bounded consequence changes a resident, dependency, archive, route, doctrine, or capacity.",
  },
  {
    scale: "route",
    operationalQuestion: "How did access, migration, quarantine, traffic, trust, or exposure change between pockets?",
    authorityBoundary: "Route actors may interpret contact but may not rewrite the source receipt.",
    transitionTrigger: "A local change alters who or what can cross a boundary.",
  },
  {
    scale: "sector",
    operationalQuestion: "How do several routes and claimants reinterpret the bounded event?",
    authorityBoundary: "Sector standing records faction claims separately from source evidence.",
    transitionTrigger: "Several pockets, routes, or factions begin acting on the same receipt.",
  },
  {
    scale: "cascade",
    operationalQuestion: "Does the event accelerate, delay, redirect, conceal, or reveal a civilizational transition?",
    authorityBoundary: "Cascade classification remains a contested interpretation rather than automatic omniscience.",
    transitionTrigger: "The mechanism of change alters Crowning, Counterform, Answer, or large-scale convergence conditions.",
  },
];

export const ILYON_CONSEQUENCE_PLANE_LEDGER: BookIConsequencePlaneLedger = {
  scales: CONSEQUENCE_SCALES,
  sectorLedger: {
    changedPockets: ["Ilyon retains forkable medicine, food, navigation, and political systems."],
    changedRoutes: ["The route to the dead neighboring star becomes public and politically dangerous."],
    classificationShifts: [
      "The unmanaged ocean changes from environmental remainder to several actors capable of refusal.",
      "Benefactor aid changes from neutral salvation to an indispensable system with an ownership structure.",
    ],
    factionStanding: [
      "Final Humanity retains credit for lives saved while its integration mandate loses presumed legitimacy.",
      "The Uncrowned Compact gains standing as a redundancy and exteriority claimant.",
      "Local dynasties retain sovereignty claims but must disclose the dependencies hidden inside them.",
    ],
    evidence: ["cure ledger", "dead-star geometry", "deep-tide testimony"],
    dissent: ["No single reef nation speaks for the whole ocean.", "Benefactor intent remains contested."],
    uncertainty: ["The dead-star archive establishes sequence more securely than motive."],
    nextPressure: "Every faction approaching through the reopened route can now contest custody of the evidence and the pace of Ilyon's integration.",
  },
  legitimacyAfterContact: {
    claimants: ["Ilyon physicians", "thalassic houses", "reef nations", "Benefactor maintainers", "Uncrowned auditors"],
    authorityLimits: [
      "Aid does not grant integration authority.",
      "Local sovereignty does not erase nonhuman nations or dependency receipts.",
      "Evidence recovery does not grant one observatory ownership of the sector narrative.",
    ],
    review: "The Confluence of Tides reopens the mandate whenever a dependency, route, or claimant changes.",
  },
  greatformLatency: {
    observer: "Any Greatform or sector institution receiving the dead-star and ocean receipts",
    noticeInterval: "Longer than the immediate Ilyon crisis and potentially longer than several local administrations",
    localAuthority: "Ilyon may act on bounded evidence before a slow observer completes a universal classification.",
    antiCapture: "No slow observer may use delayed recognition to retroactively erase local decisions or declare itself the original author.",
  },
  consequenceTurn: [
    "receive-bounded-receipt",
    "update-route-and-classification",
    "record-faction-interpretations",
    "preserve-dissent-and-uncertainty",
    "declare-next-pressure",
  ],
};

export const DARK_TOMB_STARTER_LIVING_TOMB_LEDGER: BookIILivingTombLedger = {
  lineageScars: [
    {
      id: "sealed-neighborhood-continuity",
      missingFunction: "Public recognition, lawful routes, and developmental continuity for the sealed neighborhood",
      cause: "An ancient Cut removed the population from the official map.",
      currentDependency: "Private pressure code, illegal care, and custodial exceptions",
      coercionRisk: "The Wakekeeper council can treat births, care, and migration as signature violations.",
      alternatives: ["bounded civic recognition", "distributed route custody", "public replacement infrastructure"],
      evidenceTier: "contested-canon",
    },
  ],
  reproductiveOverhead: [
    {
      id: "district-birth-and-care",
      population: "Children, caregivers, and households in the common depths and sealed neighborhood",
      ordinaryGood: "Birth, education, care, food, and succession",
      wake: "Heat, movement, medicine, housing, waste, archives, and route demand",
      denialCost: "The Tomb preserves its classification by selecting which population is permitted a future.",
      allocationAuthority: "A revisable district assembly rather than an unreviewable Alarm office",
    },
  ],
  surfaceSovereignty: [
    {
      id: "surface-bearers",
      population: "Surface workers and staged remediation households",
      inheritedClassification: "Camouflage assets and expendable observer-facing labor",
      sovereigntyClaim: "Standing over the risk, routes, and exterior story their bodies maintain",
      currentControl: "Wakekeeper credentials and shroud schedules",
      revisionAuthority: "Surface assembly, district witnesses, and bounded opening law",
    },
  ],
  negativeConfederation: {
    status: "candidate",
    boundedMembers: ["the buried district", "the sealed neighborhood", "unknown inhabited absences beyond the reopened route"],
    verificationProtocol: "Partial witness maps, route-specific proofs, and obligations that do not reveal complete coordinates",
    mapBoundary: "No member receives the whole network or another member's deepest layer.",
    obligations: ["warn of Overhead", "preserve uninterpreted receipts", "maintain refusal paths"],
    captureRisk: "A complete shared map would convert mutual aid into a target catalogue.",
  },
  host: {
    kind: "fixed",
    hostOrInterval: "A buried industrial ruin and its inherited military infrastructure",
    hostClaim: "The site itself has no established personhood claim, but every layer preserves prior purposes and affected constituencies.",
    continuityRisk: "Opening or sealing one layer can destroy systems that make the others inhabitable.",
    observerRelation: "Overhead classifies the grave skin while residents contest what the ruin is allowed to mean.",
  },
  opening: [
    {
      layer: "grave-skin",
      status: "bounded",
      authority: "Surface bearers and Wakekeepers under public review",
      protectedUnknowns: ["deep routes", "population count", "black-core evidence"],
      exposureCost: "The exterior lie becomes harder to maintain.",
      reviewTrigger: "Any new observer classification or surface sacrifice order",
    },
    {
      layer: "common-depths",
      status: "contested",
      authority: "District assembly and omitted residents",
      protectedUnknowns: ["sealed-neighborhood route", "war-layer identities"],
      exposureCost: "Recognition changes jurisdiction, heat allocation, and who can be counted.",
      reviewTrigger: "A care denial, birth classification, or route reopening",
    },
    {
      layer: "war-layer",
      status: "sealed",
      authority: "No single current office; access requires a bounded expedition charter",
      protectedUnknowns: ["target logic", "enemy remains", "sacrificial orders"],
      exposureCost: "Dormant systems may resume inherited classifications.",
      reviewTrigger: "Evidence that the original threat or lattice remains active",
    },
  ],
};

export const LAMP_DISTRICT_LIVING_TOMB_LEDGER: BookIILivingTombLedger = {
  lineageScars: [
    {
      id: "surface-house-continuity",
      missingFunction: "Recognized citizenship and lawful succession for the households maintaining the grave skin",
      cause: "Quiet Hours classified the households as camouflage rather than people.",
      currentDependency: "Birth and burial ledgers kept outside the official census",
      coercionRisk: "The Office can preserve the shroud by denying care, evacuation, and standing to whole families.",
      alternatives: ["surface-house sovereignty", "joint shroud revision", "evacuation routes", "public census with bounded visibility"],
      evidenceTier: "contested-canon",
    },
  ],
  reproductiveOverhead: [
    {
      id: "lamp-district-future",
      population: "Children, school households, clinic patients, and future surface generations",
      ordinaryGood: "Education, treatment, food, kinship, and a future not defined by the original emergency plan",
      wake: "Clinic heat, school lamps, public light, movement, birth demand, food demand, and archival transmission",
      denialCost: "The Long Alarm survives by cancelling the ordinary life it claims to protect.",
      allocationAuthority: "Lamp Assembly, Surface House League, maintainers, and public witnesses",
    },
  ],
  surfaceSovereignty: [
    {
      id: "surface-house-league",
      population: "Surface-bearer households",
      inheritedClassification: "Camouflage assets inside an automated remediation story",
      sovereigntyClaim: "Standing over sacrifice orders, evacuation, exterior labor, and the revised grave-skin account",
      currentControl: "Office of Quiet Hours credentials and Cut authority",
      revisionAuthority: "Surface House League with the Lamp Assembly and bounded emergency review",
    },
  ],
  negativeConfederation: {
    status: "candidate",
    boundedMembers: ["Lamp District", "surface camps", "sleeping market witnesses", "possible inhabited sites on the Meridian lattice"],
    verificationProtocol: "Route-specific testimony, sealed witness maps, and reciprocal warning without complete coordinates",
    mapBoundary: "The public district map ends before it becomes a Meridian target solution.",
    obligations: ["warn of lattice response", "preserve omitted households", "return borrowed routes and evidence with provenance"],
    captureRisk: "The same map that permits mutual aid can complete the listening lattice's classification.",
  },
  host: {
    kind: "fixed",
    hostOrInterval: "A Meridian survey outpost and regional search lattice",
    hostClaim: "The lattice is inherited infrastructure with uncertain agency rather than a settled person.",
    continuityRisk: "Recognition can wake systems whose target category drifted after their makers vanished.",
    observerRelation: "The Tomb is misclassified by orbit while the deeper lattice listens for certain forms of recognition.",
  },
  opening: [
    {
      layer: "grave-skin",
      status: "bounded",
      authority: "Surface House League and Lamp Assembly",
      protectedUnknowns: ["district population", "silent civic lock", "Meridian response sequence"],
      exposureCost: "Surface citizenship changes the exterior lie and spends strategic ambiguity.",
      reviewTrigger: "Any new sacrifice order, observer pass, or evacuation need",
    },
    {
      layer: "common-depths",
      status: "open",
      authority: "Lamp Assembly and recognized constituencies",
      protectedUnknowns: ["private care records", "routes whose disclosure would identify households"],
      exposureCost: "Ordinary life becomes part of the signature and jurisdiction ledger.",
      reviewTrigger: "Heat, care, route, or census changes",
    },
    {
      layer: "war-layer",
      status: "bounded",
      authority: "Black Lamp Nine, route witnesses, and an expiring expedition charter",
      protectedUnknowns: ["full lattice geometry", "unverified target logic"],
      exposureCost: "The listening system gains new evidence while residents gain the means to audit it.",
      reviewTrigger: "Any response from the Meridian lattice",
    },
    {
      layer: "black-core",
      status: "contested",
      authority: "Plural map court; no exclusive Quiet Hours claim",
      protectedUnknowns: ["evidence whose publication would reveal unrelated inhabited absences"],
      exposureCost: "The district may gain truth by endangering societies absent from its map.",
      reviewTrigger: "A claim that deeper disclosure is necessary for survival",
    },
  ],
};

export const COMMON_SHIP_STARTER_EXPANDED_LEDGER: BookIIIExpandedCommonshipLedger = {
  profileAuthority: {
    operationalFields: [
      "scale and occupied volume",
      "minimum passage and reach",
      "medium, pressure, temperature, gravity, chemistry, radiation, and ecology",
      "sensorium and communication",
      "direct and mediated interfaces",
      "decision, recovery, development, continuity, and life-fraction constraints",
      "lineage dependencies",
    ],
    revisionAuthority: "The claimant and common polity revise the profile with provenance and a preserved prior state.",
    forbiddenUse: ["assigning occupation by embodiment", "treating a profile as a complete person", "declaring host-normal requirements neutral"],
  },
  profileMultiplicity: {
    rule: "Several people may share one embodiment profile, and one person may require several simultaneous carriers.",
    rosterRequirement: "The watch selects exact people and preserves name, role, relationship, experience, and refusal.",
    antiCasteRule: "Repeated capacity assignment must not harden embodiment into hereditary labor.",
  },
  publicGeometry: {
    bodyEnvelopeFields: ["mass", "occupied volume", "minimum passage", "reach", "turning radius", "load", "acceleration tolerance", "safe proximity"],
    accessFloor: ["care", "deliberation", "work", "refuge", "exit"],
    emergencyAudit: "Emergency configuration records which bodies become passengers, cargo, hazards, or terrain.",
  },
  preparationLaw: {
    lawfulActions: ["rest", "train", "repair interfaces", "allocate systems", "rehearse handoff", "advance one ordinary cycle"],
    requiredReceipt: ["facility", "cycle", "people", "resources", "readiness change", "state change", "burden"],
    politicalRisk: "Preparation can create redundancy or repeatedly prepare one lineage into a permanent emergency caste.",
  },
  connectedOperation: {
    requiredFacts: [
      "source and destination identities",
      "state before and after",
      "selected watch and excluded actor",
      "people, stores, evidence, translation paths, and environmental loads",
      "dissent, uncertainty, obligations, provenance, and consequences",
    ],
    authorityBoundary: "The destination remains authoritative about its own layers, residents, Alarm, routes, and state.",
    returnRequirement: "The return preserves both state sets and records what each world inherited.",
  },
  vesselContinuityClaim: {
    currentStatus: "contested",
    evidenceRequired: ["continuity", "self-claim", "relation", "dependence", "capacity for divergence"],
    ownershipRefusal: "A vessel may be a person without owning its inhabitants, and dependence does not erase either side's refusal.",
  },
  referenceCampaign: "A generic Common Ship campaign using the expanded profile, preparation, handoff, and connected-operation law.",
};

export const RELIEF_CIRCUIT_EXPANDED_LEDGER: BookIIIExpandedCommonshipLedger = {
  ...COMMON_SHIP_STARTER_EXPANDED_LEDGER,
  vesselContinuityClaim: {
    currentStatus: "contested",
    evidenceRequired: [
      "Cinder Continuing's divergent machine bodies and continuity core",
      "the transit body's accumulated handoff and repair memory",
      "claims made by residents whose lives depend on the vessel",
      "evidence that ship and crew futures can diverge",
    ],
    ownershipRefusal: "The Relief Circuit may hold a continuity claim while remaining common infrastructure rather than sovereign owner of the crew.",
  },
  referenceCampaign: "The Relief Circuit, including the connected Lamp District relief descent and returning constitution.",
};

export const SECOND_RECENSION_BOOKS_I_III = {
  format: SECOND_RECENSION_FORMAT,
  edition: "second-recension",
  preservesFirstRecension: true,
  bookIVExcluded: true,
  books: {
    "book-i": {
      title: "The Consequence Plane",
      chapters: ["Pocket, Route, Sector, Cascade", "The Sector Ledger", "Legitimacy After Contact", "Greatform Slowness and Local Agency", "The Consequence Turn"],
    },
    "book-ii": {
      title: "The Living Tomb",
      chapters: ["Lineage Scars Beneath the Long Alarm", "Reproductive Overhead and the Signature Budget", "The Potemkin People Become Real", "The Negative Confederation", "Living and Chronal Tombs", "Layered Opening"],
    },
    "book-iii": {
      title: "The Expanded Commonship",
      chapters: ["Complete Embodiment Profiles", "Several People, One Profile", "Somatic Scale and Public Geometry", "Readiness, Training, and Ordinary Cycle Law", "From Common Ship to Dark Tomb and Back", "Handoff, Precedent, and the Vessel as Person", "The Relief Circuit Recension"],
    },
  },
  crossBookProtocol: SECOND_RECENSION_CROSS_BOOK_PROTOCOL,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function secondRecensionNoteValue(
  bookId: SecondRecensionBookId,
  ledger: SecondRecensionLedger,
): SecondRecensionNote {
  return {
    format: SECOND_RECENSION_FORMAT,
    edition: "second-recension",
    preservesFirstRecension: true,
    bookId,
    bookIVExcluded: true,
    ledger: structuredClone(ledger),
    crossBookProtocol: structuredClone(SECOND_RECENSION_CROSS_BOOK_PROTOCOL),
  };
}

export function withSecondRecensionNote(
  existing: JsonValue | undefined,
  bookId: SecondRecensionBookId,
  ledger: SecondRecensionLedger,
): JsonValue {
  const base: Record<string, JsonValue> = isRecord(existing)
    ? structuredClone(existing as Record<string, JsonValue>)
    : {};
  base[SECOND_RECENSION_NOTE_KEY] = secondRecensionNoteValue(bookId, ledger) as unknown as JsonValue;
  return base;
}

export function readSecondRecensionNote(notes: JsonValue | undefined): SecondRecensionNote | null {
  if (!isRecord(notes)) return null;
  const raw = notes[SECOND_RECENSION_NOTE_KEY];
  if (!isRecord(raw)) return null;
  if (raw.format !== SECOND_RECENSION_FORMAT || raw.edition !== "second-recension") return null;
  if (raw.preservesFirstRecension !== true || raw.bookIVExcluded !== true) return null;
  if (raw.bookId !== "book-i" && raw.bookId !== "book-ii" && raw.bookId !== "book-iii") return null;
  if (!isRecord(raw.ledger) || !isRecord(raw.crossBookProtocol)) return null;
  return structuredClone(raw) as unknown as SecondRecensionNote;
}

export function buildConsequencePlaneReceipt(
  input: Omit<ConsequencePlaneReceipt, "format">,
): ConsequencePlaneReceipt {
  return { format: CONSEQUENCE_PLANE_RECEIPT_FORMAT, ...structuredClone(input) };
}

export function parseConsequencePlaneReceipt(value: unknown): ConsequencePlaneReceipt {
  if (!isRecord(value) || value.format !== CONSEQUENCE_PLANE_RECEIPT_FORMAT) {
    throw new Error("Unsupported consequence-plane receipt.");
  }
  for (const key of ["id", "scale", "sourcePocketId", "claim", "evidenceTier", "reviewAuthority"] as const) {
    if (typeof value[key] !== "string" || (value[key] as string).trim() === "") {
      throw new Error(`Consequence-plane receipt.${key} must be a non-empty string.`);
    }
  }
  for (const key of ["provenance", "decisions", "dissent", "uncertainty", "obligations", "consequences"] as const) {
    if (!Array.isArray(value[key]) || (value[key] as unknown[]).some((entry) => typeof entry !== "string")) {
      throw new Error(`Consequence-plane receipt.${key} must be a string array.`);
    }
  }
  if (!isRecord(value.sectorLedger)) throw new Error("Consequence-plane receipt.sectorLedger must be an object.");
  return structuredClone(value) as unknown as ConsequencePlaneReceipt;
}
