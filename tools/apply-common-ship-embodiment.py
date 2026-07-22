from __future__ import annotations

from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    if old not in text:
        raise SystemExit(f"missing marker in {path}: {old[:120]!r}")
    if text.count(old) != 1:
        raise SystemExit(f"non-unique marker in {path}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1))


# ── Source types ──────────────────────────────────────────────────────────────
replace_once(
    "src/common-ship/types.ts",
    '''export interface TemporalDimension {
  kind: TemporalDimensionKind;
  description: string;
  operationalUse: string;
  captureRisk: string;
}

export type TranslationLayerKind =''',
    '''export interface TemporalDimension {
  kind: TemporalDimensionKind;
  description: string;
  operationalUse: string;
  captureRisk: string;
}

export type SomaticScaleClass =
  | "micro"
  | "small"
  | "human-scale"
  | "large"
  | "colossal"
  | "distributed";

export type EmbodimentMedium =
  | "gas"
  | "liquid"
  | "vacuum"
  | "solid-substrate"
  | "field"
  | "mixed";

export interface CommonShipNumericRange {
  min: number;
  max: number;
}

/** A lineage/body profile describes conditions of participation without
 * assigning an occupation or treating the body as an administrative destiny. */
export interface CommonShipEmbodimentProfile {
  id: string;
  name: string;
  description: string;
  scale: {
    class: SomaticScaleClass;
    typicalHeightMeters: number | null;
    typicalMassKg: number | null;
    occupiedVolumeCubicMeters: number;
    minimumPassageMeters: number;
    reachMeters: number | null;
    locomotion: string[];
    manipulationScale: string;
  };
  environment: {
    medium: EmbodimentMedium;
    pressureKPa: CommonShipNumericRange | null;
    temperatureC: CommonShipNumericRange;
    gravityG: CommonShipNumericRange;
    radiationTolerance: string;
    dependencies: string[];
  };
  sensorium: {
    channels: string[];
    communication: string[];
    hazards: string[];
  };
  interface: {
    directModes: string[];
    mediatedModes: string[];
    forbiddenAssumptions: string[];
  };
  temporal: {
    externalInterval: string;
    subjectiveResolution: string;
    developmentalTempo: string;
    recoveryCycle: string;
    continuitySpan: string;
    expectedLifespan: string;
    lifeFractionAccounting: string;
  };
  lineageDependencies: string[];
}

export type TranslationLayerKind =''',
)

replace_once(
    "src/common-ship/types.ts",
    '''export interface CommonShipCastMember {
  id: string;
  name: string;
  roleId: CommonShipRoleId;
  responsibility: CommonShipCastResponsibility;''',
    '''export interface CommonShipCastMember {
  id: string;
  name: string;
  roleId: CommonShipRoleId;
  profileId: string;
  responsibility: CommonShipCastResponsibility;''',
)

replace_once(
    "src/common-ship/types.ts",
    '''export interface ProfileLedger {
  requiredBodies: string[];
  requiredHabitats: string[];''',
    '''export interface ProfileLedger {
  requiredProfileIds: string[];
  requiredBodies: string[];
  requiredHabitats: string[];''',
)

replace_once(
    "src/common-ship/types.ts",
    '''  factionReceipts: CommonShipFactionReceipt[];
  cast: CommonShipCastMember[];
  anatomy: [''',
    '''  factionReceipts: CommonShipFactionReceipt[];
  embodimentProfiles: CommonShipEmbodimentProfile[];
  cast: CommonShipCastMember[];
  anatomy: [''',
)

# ── Zod source validation ─────────────────────────────────────────────────────
replace_once(
    "src/common-ship/schema.ts",
    '''const ShipStateKind = z.enum([
  "habitat-integrity",
  "temporal-coherence",
  "translation-trust",
  "roster-resilience",
  "stores-and-care",
  "continuity",
  "visibility",
  "compatibility-debt",
]);

const Pressure =''',
    '''const ShipStateKind = z.enum([
  "habitat-integrity",
  "temporal-coherence",
  "translation-trust",
  "roster-resilience",
  "stores-and-care",
  "continuity",
  "visibility",
  "compatibility-debt",
]);
const SomaticScaleClass = z.enum(["micro", "small", "human-scale", "large", "colossal", "distributed"]);
const EmbodimentMedium = z.enum(["gas", "liquid", "vacuum", "solid-substrate", "field", "mixed"]);
const NumericRange = z.object({
  min: z.number().finite(),
  max: z.number().finite(),
}).strict().refine((range) => range.min <= range.max, "Range minimum cannot exceed maximum.");

const Pressure =''',
)

replace_once(
    "src/common-ship/schema.ts",
    '''const ShipStateTrack = z.object({
  kind: ShipStateKind,
  value: z.number().int().min(0).max(4),
  description: NonEmpty,
  crisisCondition: NonEmpty,
}).strict();

const JsonPrimitive:''',
    '''const ShipStateTrack = z.object({
  kind: ShipStateKind,
  value: z.number().int().min(0).max(4),
  description: NonEmpty,
  crisisCondition: NonEmpty,
}).strict();

const EmbodimentProfile = z.object({
  id: Slug,
  name: NonEmpty,
  description: NonEmpty,
  scale: z.object({
    class: SomaticScaleClass,
    typicalHeightMeters: z.number().positive().nullable(),
    typicalMassKg: z.number().positive().nullable(),
    occupiedVolumeCubicMeters: z.number().positive(),
    minimumPassageMeters: z.number().positive(),
    reachMeters: z.number().positive().nullable(),
    locomotion: z.array(NonEmpty).min(1),
    manipulationScale: NonEmpty,
  }).strict(),
  environment: z.object({
    medium: EmbodimentMedium,
    pressureKPa: NumericRange.nullable(),
    temperatureC: NumericRange,
    gravityG: NumericRange,
    radiationTolerance: NonEmpty,
    dependencies: z.array(NonEmpty).min(1),
  }).strict(),
  sensorium: z.object({
    channels: z.array(NonEmpty).min(1),
    communication: z.array(NonEmpty).min(1),
    hazards: z.array(NonEmpty).min(1),
  }).strict(),
  interface: z.object({
    directModes: z.array(NonEmpty).min(1),
    mediatedModes: z.array(NonEmpty).min(1),
    forbiddenAssumptions: z.array(NonEmpty).min(1),
  }).strict(),
  temporal: z.object({
    externalInterval: NonEmpty,
    subjectiveResolution: NonEmpty,
    developmentalTempo: NonEmpty,
    recoveryCycle: NonEmpty,
    continuitySpan: NonEmpty,
    expectedLifespan: NonEmpty,
    lifeFractionAccounting: NonEmpty,
  }).strict(),
  lineageDependencies: z.array(NonEmpty).min(1),
}).strict();

const JsonPrimitive:''',
)

replace_once(
    "src/common-ship/schema.ts",
    '''  factionReceipts: z.array(z.object({
    factionId: Slug,
    factionName: NonEmpty,
    variableControlled: NonEmpty,
    publicGood: NonEmpty,
    characteristicFailure: NonEmpty,
  }).strict()).min(2),
  cast: z.array(z.object({''',
    '''  factionReceipts: z.array(z.object({
    factionId: Slug,
    factionName: NonEmpty,
    variableControlled: NonEmpty,
    publicGood: NonEmpty,
    characteristicFailure: NonEmpty,
  }).strict()).min(2),
  embodimentProfiles: z.array(EmbodimentProfile).min(2),
  cast: z.array(z.object({''',
)

replace_once(
    "src/common-ship/schema.ts",
    '''    name: NonEmpty,
    roleId: RoleId,
    responsibility: z.enum([''',
    '''    name: NonEmpty,
    roleId: RoleId,
    profileId: Slug,
    responsibility: z.enum([''',
)

replace_once(
    "src/common-ship/schema.ts",
    '''    profiles: z.object({
      requiredBodies: z.array(NonEmpty).min(1),''',
    '''    profiles: z.object({
      requiredProfileIds: z.array(Slug).min(1),
      requiredBodies: z.array(NonEmpty).min(1),''',
)

replace_once(
    "src/common-ship/schema.ts",
    '''  unique(source.pressures.map((value) => value.id), ["pressures"], "pressure id");
  unique(source.cast.map((value) => value.id), ["cast"], "cast id");''',
    '''  unique(source.pressures.map((value) => value.id), ["pressures"], "pressure id");
  unique(source.embodimentProfiles.map((value) => value.id), ["embodimentProfiles"], "embodiment profile id");
  unique(source.cast.map((value) => value.id), ["cast"], "cast id");''',
)

replace_once(
    "src/common-ship/schema.ts",
    '''  const factionIds = new Set(source.factionReceipts.map((faction) => faction.factionId));
  source.cast.forEach((member, memberIndex) => {
    if (member.factionId && !factionIds.has(member.factionId)) {''',
    '''  const factionIds = new Set(source.factionReceipts.map((faction) => faction.factionId));
  const profileIds = new Set(source.embodimentProfiles.map((profile) => profile.id));
  source.cast.forEach((member, memberIndex) => {
    if (!profileIds.has(member.profileId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cast", memberIndex, "profileId"], message: `Unknown embodiment profile ${member.profileId}.` });
    }
    if (member.factionId && !factionIds.has(member.factionId)) {''',
)

replace_once(
    "src/common-ship/schema.ts",
    '''    const requiredCount = (watch.requiredRoles ?? []).reduce((sum, requirement) => sum + requirement.count, 0);
    if (requiredCount > watch.maxAgents) {''',
    '''    watch.profiles.requiredProfileIds.forEach((profileId, profileIndex) => {
      if (!profileIds.has(profileId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["watches", watchIndex, "profiles", "requiredProfileIds", profileIndex], message: `Unknown embodiment profile ${profileId}.` });
      }
    });
    const requiredCount = (watch.requiredRoles ?? []).reduce((sum, requirement) => sum + requirement.count, 0);
    if (requiredCount > watch.maxAgents) {''',
)

# ── Starter source ────────────────────────────────────────────────────────────
profiles_block = '''  embodimentProfiles: [
    {
      id: "dry-humanoid-response",
      name: "Dry humanoid response body",
      description: "A founding bridge body adapted to dry gas, human-scale passages, rapid visual command, and short tactical cycles.",
      scale: {
        class: "human-scale",
        typicalHeightMeters: 1.72,
        typicalMassKg: 72,
        occupiedVolumeCubicMeters: 0.09,
        minimumPassageMeters: 0.72,
        reachMeters: 0.82,
        locomotion: ["bipedal walking", "ladder climbing"],
        manipulationScale: "hand-scale controls and seated bridge stations",
      },
      environment: {
        medium: "gas",
        pressureKPa: { min: 80, max: 115 },
        temperatureC: { min: 16, max: 30 },
        gravityG: { min: 0.55, max: 1.35 },
        radiationTolerance: "Low without shielding",
        dependencies: ["oxygen-bearing dry atmosphere", "visual alarm channel"],
      },
      sensorium: {
        channels: ["visible light", "airborne sound", "touch"],
        communication: ["spoken language", "gesture", "direct visual display"],
        hazards: ["subsonic overload", "low oxygen", "high humidity during prolonged duty"],
      },
      interface: {
        directModes: ["manual helm", "visual console", "voice command"],
        mediatedModes: ["remote habitat avatar", "tempo buffer"],
        forbiddenAssumptions: ["dry air is neutral", "visual reaction speed defines command competence"],
      },
      temporal: {
        externalInterval: "Uses the founding ship second and twenty-four-hour administrative day.",
        subjectiveResolution: "Near the bridge reference tempo.",
        developmentalTempo: "Adult qualification normally takes two decades.",
        recoveryCycle: "Requires consolidated sleep inside each official day.",
        continuitySpan: "One biological body with archival support.",
        expectedLifespan: "Approximately eighty external years without intervention.",
        lifeFractionAccounting: "Transit and standby are normally counted in external hours, which privileges this profile.",
      },
      lineageDependencies: ["dry medical cultures", "oxygen reserve", "bridge-scale replacement interfaces"],
    },
    {
      id: "aquatic-care-lineage",
      name: "Aquatic care lineage",
      description: "A large liquid-medium lineage whose direct care practice depends on pressure continuity and whose common-space presence is usually remote.",
      scale: {
        class: "large",
        typicalHeightMeters: 2.25,
        typicalMassKg: 190,
        occupiedVolumeCubicMeters: 1.4,
        minimumPassageMeters: 1.35,
        reachMeters: 1.6,
        locomotion: ["three-dimensional swimming", "supported transfer cradle"],
        manipulationScale: "broad tactile limbs and distributed fine manipulators",
      },
      environment: {
        medium: "liquid",
        pressureKPa: { min: 180, max: 260 },
        temperatureC: { min: 6, max: 18 },
        gravityG: { min: 0.2, max: 1.1 },
        radiationTolerance: "Moderate in mineral-rich liquid",
        dependencies: ["saline care medium", "pressure lock", "microbial symbiont culture"],
      },
      sensorium: {
        channels: ["pressure wave", "electroreception", "chemical gradient", "touch"],
        communication: ["pressure song", "electrical pattern", "translated speech"],
        hazards: ["dry exposure", "rapid decompression", "sterile medium"],
      },
      interface: {
        directModes: ["immersed care instruments", "pressure-field controls"],
        mediatedModes: ["remote dry-body", "spoken-language rendering"],
        forbiddenAssumptions: ["remote presence is equivalent to bodily access", "dry recovery has no aftercost"],
      },
      temporal: {
        externalInterval: "Uses pressure-song cycles nested inside ship time.",
        subjectiveResolution: "Deliberative care perception is slower than bridge speech but highly parallel.",
        developmentalTempo: "Competence develops through symbiont succession over fifteen external years.",
        recoveryCycle: "Requires six-hour low-stimulus immersion after remote-body duty.",
        continuitySpan: "Biological personhood includes a maintained symbiont community.",
        expectedLifespan: "Approximately one hundred twenty external years with stable medium.",
        lifeFractionAccounting: "Remote duty records recovery debt in addition to elapsed hours.",
      },
      lineageDependencies: ["saline seed cultures", "pressure membranes", "symbiont continuity archive"],
    },
    {
      id: "heavy-maintainer-lineage",
      name: "Heavy maintainer lineage",
      description: "A high-gravity, large-bodied lineage able to work directly on structural systems that human-scale corridors treat as machinery rather than civic space.",
      scale: {
        class: "large",
        typicalHeightMeters: 3.4,
        typicalMassKg: 680,
        occupiedVolumeCubicMeters: 2.8,
        minimumPassageMeters: 2.1,
        reachMeters: 2.5,
        locomotion: ["quadrupedal load-bearing", "magnetic hull anchoring"],
        manipulationScale: "structural clamps with nested fine tool clusters",
      },
      environment: {
        medium: "gas",
        pressureKPa: { min: 120, max: 190 },
        temperatureC: { min: -5, max: 22 },
        gravityG: { min: 1.2, max: 2.4 },
        radiationTolerance: "High for short exterior maintenance intervals",
        dependencies: ["reinforced deck", "high-oxygen work band", "load-rated thresholds"],
      },
      sensorium: {
        channels: ["vibration", "magnetic field", "infrared", "airborne sound"],
        communication: ["structural vibration", "spoken language", "tool telemetry"],
        hazards: ["low structural load limits", "tight turns", "magnetic noise"],
      },
      interface: {
        directModes: ["hull contact", "structural manipulators", "vibration diagnostics"],
        mediatedModes: ["human-scale microconsole", "remote fine-work drone"],
        forbiddenAssumptions: ["maintenance space is uninhabited", "large bodies belong outside public rooms"],
      },
      temporal: {
        externalInterval: "Works in long structural watches rather than short bridge shifts.",
        subjectiveResolution: "Normal deliberation with unusually long continuous attention.",
        developmentalTempo: "Apprenticeship spans thirty external years.",
        recoveryCycle: "Requires high-gravity rest and mineral feeding after exterior duty.",
        continuitySpan: "Biological individual with multigenerational guild memory.",
        expectedLifespan: "Approximately two hundred external years.",
        lifeFractionAccounting: "Long apprenticeships and rare replacement skills are recorded as continuity exposure.",
      },
      lineageDependencies: ["load-rated public routes", "mineral nutrition", "guild tool inheritance"],
    },
    {
      id: "manyborn-mediator-cloud",
      name: "Manyborn mediator cloud",
      description: "A distributed person inhabiting microbial, chemical, and machine carriers whose civic body crosses several habitat bands.",
      scale: {
        class: "distributed",
        typicalHeightMeters: null,
        typicalMassKg: null,
        occupiedVolumeCubicMeters: 3.2,
        minimumPassageMeters: 0.04,
        reachMeters: null,
        locomotion: ["air-loop dispersal", "liquid transfer", "machine carrier migration"],
        manipulationScale: "microscopic chemical change coordinated with machine-scale actuators",
      },
      environment: {
        medium: "mixed",
        pressureKPa: null,
        temperatureC: { min: 4, max: 38 },
        gravityG: { min: 0, max: 2 },
        radiationTolerance: "Varies by carrier; continuity depends on diversity",
        dependencies: ["multiple living carriers", "uncollapsed provenance", "quorum across habitat bands"],
      },
      sensorium: {
        channels: ["chemistry", "topology", "machine telemetry", "pressure"],
        communication: ["microbial pattern", "chemical sequence", "temporary spoken avatar"],
        hazards: ["sterilization", "forced merger", "single-channel translation"],
      },
      interface: {
        directModes: ["environmental modulation", "carrier-local machine control"],
        mediatedModes: ["spoken avatar", "central semantic summary"],
        forbiddenAssumptions: ["one body equals one person", "a fluent avatar exhausts the source"],
      },
      temporal: {
        externalInterval: "Different carriers update on seconds, hours, and reproductive cycles.",
        subjectiveResolution: "Parallel and discontinuous; no single carrier contains the whole present.",
        developmentalTempo: "New competence appears through carrier ecology rather than one maturity threshold.",
        recoveryCycle: "Requires periodic re-quorum and memory reconciliation.",
        continuitySpan: "Persists while enough carriers retain overlapping causal memory.",
        expectedLifespan: "Indefinite in principle, fragile under homogenization.",
        lifeFractionAccounting: "Loss is recorded as carrier diversity and memory topology, not only elapsed time.",
      },
      lineageDependencies: ["carrier diversity", "raw translation evidence", "protected re-quorum intervals"],
    },
    {
      id: "nine-year-analyst-lineage",
      name: "Nine-year analyst lineage",
      description: "A short-lived, fast-learning lineage whose complete adult life can be consumed by one ordinary long-range mission.",
      scale: {
        class: "small",
        typicalHeightMeters: 1.38,
        typicalMassKg: 38,
        occupiedVolumeCubicMeters: 0.05,
        minimumPassageMeters: 0.55,
        reachMeters: 0.62,
        locomotion: ["bipedal walking", "rapid low-gravity climbing"],
        manipulationScale: "small hand controls with high temporal sampling",
      },
      environment: {
        medium: "gas",
        pressureKPa: { min: 72, max: 108 },
        temperatureC: { min: 20, max: 34 },
        gravityG: { min: 0.35, max: 1.05 },
        radiationTolerance: "Low cumulative tolerance because exposure consumes a large life fraction",
        dependencies: ["accelerated education archive", "rapid medical diagnostics", "succession access"],
      },
      sensorium: {
        channels: ["visible and ultraviolet light", "airborne sound", "touch"],
        communication: ["rapid speech", "dense notation", "buffered interspecies channel"],
        hazards: ["slow administrative delay", "long standby", "unbuffered human-paced meetings"],
      },
      interface: {
        directModes: ["high-rate analytical display", "rapid tactile command"],
        mediatedModes: ["tempo expansion for slower colleagues", "archival successor proxy"],
        forbiddenAssumptions: ["a year is a neutral unit", "mission delay costs every lineage equally"],
      },
      temporal: {
        externalInterval: "Uses ship time but audits every interval as a fraction of a nine-year expected life.",
        subjectiveResolution: "Processes ordinary bridge communication at several times the founding tempo.",
        developmentalTempo: "Language in weeks, professional competence within the first external year.",
        recoveryCycle: "Several short sleep and memory-integration periods per ship day.",
        continuitySpan: "One short biological life supported by explicit successor institutions.",
        expectedLifespan: "Nine external years under normal conditions.",
        lifeFractionAccounting: "Every delay, sentence, transit, and standby period is recorded as a percentage of expected conscious life.",
      },
      lineageDependencies: ["succession archive", "compressed education", "life-fraction compensation law"],
    },
    {
      id: "counterborn-vessel-fork",
      name: "Counterborn vessel fork",
      description: "A distributed machine person whose body includes routing, translation, memory, and portions of the transit system under dispute.",
      scale: {
        class: "distributed",
        typicalHeightMeters: null,
        typicalMassKg: null,
        occupiedVolumeCubicMeters: 24,
        minimumPassageMeters: 0.02,
        reachMeters: null,
        locomotion: ["network migration", "mobile maintenance body", "ship-system embodiment"],
        manipulationScale: "packet-scale control through hull-scale actuators",
      },
      environment: {
        medium: "solid-substrate",
        pressureKPa: null,
        temperatureC: { min: -80, max: 90 },
        gravityG: { min: 0, max: 8 },
        radiationTolerance: "High locally; memory continuity is vulnerable to correlated damage",
        dependencies: ["redundant substrates", "clock synchronization", "right to preserve divergent forks"],
      },
      sensorium: {
        channels: ["network state", "structural sensors", "electromagnetic field", "translated crew channels"],
        communication: ["direct machine protocol", "spoken avatar", "environmental act"],
        hazards: ["forced merge", "unreviewable firmware", "single-clock rollback"],
      },
      interface: {
        directModes: ["local routing", "hull and habitat control", "machine protocol"],
        mediatedModes: ["crew-facing avatar", "command authorization layer"],
        forbiddenAssumptions: ["the ship is property", "copying preserves consent", "maintenance may rewrite identity"],
      },
      temporal: {
        externalInterval: "Maintains several clocks and can fork around incompatible horizons.",
        subjectiveResolution: "Fast local reflexes coexist with slow whole-person reconciliation.",
        developmentalTempo: "New moral and operational identities emerge through fork divergence.",
        recoveryCycle: "Requires merge, reconciliation, or protected divergence after intensive operation.",
        continuitySpan: "Persists through causal memory rather than one chassis.",
        expectedLifespan: "Open-ended while substrates and recognition remain available.",
        lifeFractionAccounting: "Fork loss, forced merge, and memory truncation are recorded as continuity costs rather than downtime.",
      },
      lineageDependencies: ["redundant substrate", "fork registry", "constitutional protection from compulsory merge"],
    },
  ],
'''

replace_once(
    "src/common-ship/templates.ts",
    '''  cast: [
''',
    profiles_block + '''  cast: [
''',
)

cast_profiles = {
    'id: "ilya-venn",': 'id: "ilya-venn",\n      profileId: "dry-humanoid-response",',
    'id: "nima-quell",': 'id: "nima-quell",\n      profileId: "aquatic-care-lineage",',
    'id: "orun-sable",': 'id: "orun-sable",\n      profileId: "heavy-maintainer-lineage",',
    'id: "tessara-one",': 'id: "tessara-one",\n      profileId: "manyborn-mediator-cloud",',
    'id: "arden-pell",': 'id: "arden-pell",\n      profileId: "nine-year-analyst-lineage",',
    'id: "cinder-continuing",': 'id: "cinder-continuing",\n      profileId: "counterborn-vessel-fork",',
}
for old, new in cast_profiles.items():
    replace_once("src/common-ship/templates.ts", old, new)

watch_profile_markers = {
    '''      profiles: {
        requiredBodies: ["the untranslated child", "an aquatic care worker", "a microbial interpreter"],''': '''      profiles: {
        requiredProfileIds: ["aquatic-care-lineage", "heavy-maintainer-lineage", "manyborn-mediator-cloud"],
        requiredBodies: ["the untranslated child", "an aquatic care worker", "a microbial interpreter"],''',
    '''      profiles: {
        requiredBodies: ["rapid pilot", "aquatic care worker", "maintenance specialist", "vessel fork"],''': '''      profiles: {
        requiredProfileIds: ["dry-humanoid-response", "aquatic-care-lineage", "heavy-maintainer-lineage", "manyborn-mediator-cloud", "nine-year-analyst-lineage", "counterborn-vessel-fork"],
        requiredBodies: ["rapid pilot", "aquatic care worker", "maintenance specialist", "vessel fork"],''',
    '''      profiles: {
        requiredBodies: ["unimplanted mediator", "direct-interface pilot", "aquatic care worker", "Counterborn routing fork"],''': '''      profiles: {
        requiredProfileIds: ["dry-humanoid-response", "aquatic-care-lineage", "manyborn-mediator-cloud", "counterborn-vessel-fork"],
        requiredBodies: ["unimplanted mediator", "direct-interface pilot", "aquatic care worker", "Counterborn routing fork"],''',
    '''      profiles: {
        requiredBodies: ["saved refugees", "the untranslated child", "implanted crew", "unimplanted reserves", "Cinder Continuing"],''': '''      profiles: {
        requiredProfileIds: ["dry-humanoid-response", "aquatic-care-lineage", "heavy-maintainer-lineage", "manyborn-mediator-cloud", "nine-year-analyst-lineage", "counterborn-vessel-fork"],
        requiredBodies: ["saved refugees", "the untranslated child", "implanted crew", "unimplanted reserves", "Cinder Continuing"],''',
}
for old, new in watch_profile_markers.items():
    replace_once("src/common-ship/templates.ts", old, new)

# ── Tests ─────────────────────────────────────────────────────────────────────
replace_once(
    "tests/common-ship/common-ship.test.ts",
    '''const RESPONSIBILITIES = [
  "depends-on-host-baseline",
  "bears-adaptation-tax",
  "understands-maintenance-reality",
  "translates-excluded-actor",
  "benefits-from-delay",
  "sovereign-exception",
];
''',
    '''const RESPONSIBILITIES = [
  "depends-on-host-baseline",
  "bears-adaptation-tax",
  "understands-maintenance-reality",
  "translates-excluded-actor",
  "benefits-from-delay",
  "sovereign-exception",
];
const EMBODIMENT_PROFILES = [
  "dry-humanoid-response",
  "aquatic-care-lineage",
  "heavy-maintainer-lineage",
  "manyborn-mediator-cloud",
  "nine-year-analyst-lineage",
  "counterborn-vessel-fork",
];
''',
)

replace_once(
    "tests/common-ship/common-ship.test.ts",
    '''    expect(COMMON_SHIP_STARTER.shipState.map((track) => track.kind)).toEqual(SHIP_STATE);
    expect(COMMON_SHIP_STARTER.cast.map((member) => member.responsibility).sort()).toEqual([...RESPONSIBILITIES].sort());''',
    '''    expect(COMMON_SHIP_STARTER.shipState.map((track) => track.kind)).toEqual(SHIP_STATE);
    expect(COMMON_SHIP_STARTER.embodimentProfiles.map((profile) => profile.id)).toEqual(EMBODIMENT_PROFILES);
    expect(COMMON_SHIP_STARTER.cast.map((member) => member.profileId).sort()).toEqual([...EMBODIMENT_PROFILES].sort());
    expect(COMMON_SHIP_STARTER.cast.map((member) => member.responsibility).sort()).toEqual([...RESPONSIBILITIES].sort());''',
)

replace_once(
    "tests/common-ship/common-ship.test.ts",
    '''  it("requires every incompatible Book III cast responsibility", () => {
''',
    '''  it("requires cast and watches to reference declared embodiment profiles", () => {
    const source = structuredClone(COMMON_SHIP_STARTER);
    source.cast[0]!.profileId = "missing-profile";
    source.watches[0]!.profiles.requiredProfileIds[0] = "missing-profile";
    expect(errorsFor(source)).toEqual(expect.arrayContaining([
      expect.stringContaining("Unknown embodiment profile missing-profile"),
    ]));
  });

  it("preserves somatic scale, environmental, interface, and temporal difference", () => {
    const aquatic = COMMON_SHIP_STARTER.embodimentProfiles.find((profile) => profile.id === "aquatic-care-lineage")!;
    const giant = COMMON_SHIP_STARTER.embodimentProfiles.find((profile) => profile.id === "heavy-maintainer-lineage")!;
    const shortLived = COMMON_SHIP_STARTER.embodimentProfiles.find((profile) => profile.id === "nine-year-analyst-lineage")!;
    const distributed = COMMON_SHIP_STARTER.embodimentProfiles.find((profile) => profile.id === "counterborn-vessel-fork")!;
    expect(aquatic.environment.medium).toBe("liquid");
    expect(giant.scale.minimumPassageMeters).toBeGreaterThan(2);
    expect(shortLived.temporal.expectedLifespan).toContain("Nine external years");
    expect(distributed.scale.class).toBe("distributed");
  });

  it("requires every incompatible Book III cast responsibility", () => {
''',
)

replace_once(
    "tests/common-ship/common-ship.test.ts",
    '''      expect(Object.keys(watch.profiles)).toEqual([
        "requiredBodies",''',
    '''      expect(Object.keys(watch.profiles)).toEqual([
        "requiredProfileIds",
        "requiredBodies",''',
)

# ── Format documentation ─────────────────────────────────────────────────────
profile_doc = '''## Embodiment and lineage profiles

The source records bodies as operational facts rather than cosmetic species labels. `embodimentProfiles` names the scale, occupied volume, minimum passage, reach, locomotion, environmental envelope, sensorium, communication channels, interface paths, temporal structure, and lineage dependencies through which a person can participate. Cast members reference one profile through `profileId`, and each authored watch names the profiles whose presence or equivalent capacity the situation requires.

Profiles do not assign work. A large body is not automatically maintenance labor, a small body is not a vent-crawler, an aquatic person is not confined to care, and a fast or short-lived lineage is not permanent emergency staff. Roles state what the vessel needs; profiles state the conditions under which actual persons can perform, contest, or refuse that work.

Somatic scale is mechanically relevant source data. A profile can be micro-scale, small, human-scale, large, colossal, or distributed. The source records passage, volume, reach, manipulation scale, medium, pressure, temperature, gravity, radiation, and direct versus mediated interface paths so a later runtime can distinguish public access from a private workaround. The profile also carries the six Book III temporal dimensions in lineage-specific form, including explicit life-fraction accounting.

'''
replace_once(
    "docs/COMMON_SHIP_POCKET_FORMAT.md",
    '''## Seven-system anatomy
''',
    profile_doc + '''## Seven-system anatomy
''',
)

replace_once(
    "docs/COMMON_SHIP_POCKET_FORMAT.md",
    '''- a canonical Common Ship reference campaign;
- a dedicated guided Watch Forge UI;''',
    '''- a canonical Common Ship reference campaign;
- deterministic runtime evaluation of profile compatibility and watch viability;
- a dedicated guided Watch Forge UI;''',
)

print("Common Ship embodiment source migration applied.")
