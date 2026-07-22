import type {
  CommonShipCastMember,
  CommonShipPocketSource,
  CommonShipWatchBlueprint,
  ProfileLedger,
} from "./types.js";

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

/**
 * A profile describes conditions of participation without assigning an
 * occupation or treating the body as an administrative destiny.
 */
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

export interface CommonShipCastMemberV2 extends CommonShipCastMember {
  profileId: string;
}

export interface CommonShipProfileLedgerV2 extends ProfileLedger {
  requiredProfileIds: string[];
}

export interface CommonShipWatchBlueprintV2
  extends Omit<CommonShipWatchBlueprint, "profiles"> {
  profiles: CommonShipProfileLedgerV2;
}

export interface CommonShipPocketSourceV2
  extends Omit<CommonShipPocketSource, "cast" | "watches"> {
  embodimentProfiles: CommonShipEmbodimentProfile[];
  cast: CommonShipCastMemberV2[];
  watches: CommonShipWatchBlueprintV2[];
}

export const COMMON_SHIP_STARTER_EMBODIMENT_PROFILES: CommonShipEmbodimentProfile[] = [
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
      hazards: ["subsonic overload", "low oxygen", "prolonged high humidity"],
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
      recoveryCycle: "Requires six hours of low-stimulus immersion after remote-body duty.",
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
      developmentalTempo: "Language in weeks and professional competence within the first external year.",
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
];

const STARTER_CAST_PROFILE_IDS: Record<string, string> = {
  "ilya-venn": "dry-humanoid-response",
  "nima-quell": "aquatic-care-lineage",
  "orun-sable": "heavy-maintainer-lineage",
  "tessara-one": "manyborn-mediator-cloud",
  "arden-pell": "nine-year-analyst-lineage",
  "cinder-continuing": "counterborn-vessel-fork",
};

const STARTER_WATCH_PROFILE_IDS: Record<string, string[]> = {
  "recognize-the-school-loop": [
    "aquatic-care-lineage",
    "heavy-maintainer-lineage",
    "manyborn-mediator-cloud",
  ],
  "compose-the-three-clock-watch": [
    "dry-humanoid-response",
    "aquatic-care-lineage",
    "heavy-maintainer-lineage",
    "manyborn-mediator-cloud",
    "nine-year-analyst-lineage",
    "counterborn-vessel-fork",
  ],
  "cross-the-infected-mesh": [
    "dry-humanoid-response",
    "aquatic-care-lineage",
    "manyborn-mediator-cloud",
    "counterborn-vessel-fork",
  ],
  "conduct-the-commonship-inquiry": [
    "dry-humanoid-response",
    "aquatic-care-lineage",
    "heavy-maintainer-lineage",
    "manyborn-mediator-cloud",
    "nine-year-analyst-lineage",
    "counterborn-vessel-fork",
  ],
};

export function addStarterEmbodimentProfiles(
  base: CommonShipPocketSource,
): CommonShipPocketSourceV2 {
  const cast = base.cast.map((member) => {
    const profileId = STARTER_CAST_PROFILE_IDS[member.id];
    if (!profileId) throw new Error(`No starter embodiment profile for cast member ${member.id}.`);
    return { ...member, profileId };
  });
  const watches = base.watches.map((watch) => {
    const requiredProfileIds = STARTER_WATCH_PROFILE_IDS[watch.id];
    if (!requiredProfileIds) throw new Error(`No starter profile requirements for watch ${watch.id}.`);
    return {
      ...watch,
      profiles: { ...watch.profiles, requiredProfileIds: [...requiredProfileIds] },
    };
  });
  return {
    ...base,
    embodimentProfiles: COMMON_SHIP_STARTER_EMBODIMENT_PROFILES.map((profile) => ({
      ...profile,
      scale: { ...profile.scale, locomotion: [...profile.scale.locomotion] },
      environment: {
        ...profile.environment,
        pressureKPa: profile.environment.pressureKPa
          ? { ...profile.environment.pressureKPa }
          : null,
        temperatureC: { ...profile.environment.temperatureC },
        gravityG: { ...profile.environment.gravityG },
        dependencies: [...profile.environment.dependencies],
      },
      sensorium: {
        channels: [...profile.sensorium.channels],
        communication: [...profile.sensorium.communication],
        hazards: [...profile.sensorium.hazards],
      },
      interface: {
        directModes: [...profile.interface.directModes],
        mediatedModes: [...profile.interface.mediatedModes],
        forbiddenAssumptions: [...profile.interface.forbiddenAssumptions],
      },
      temporal: { ...profile.temporal },
      lineageDependencies: [...profile.lineageDependencies],
    })),
    cast,
    watches,
  };
}
