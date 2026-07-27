import type { ContinuingUniverseSource } from "../../../src/narrative/succession/model.js";

export const ILYON_SOURCE: ContinuingUniverseSource = {
  "format": "godscar-pocket/1",
  "identity": {
    "id": "kind-gods-of-ilyon",
    "title": "The Kind Gods of Ilyon",
    "description": "An ocean world must decide whether salvation remains a gift after its cures, food systems, and peace become the first layer of planetary integration.",
    "author": "BigBirdReturns",
    "version": "1.1.0",
    "estimatedCycles": 12,
    "parentCanons": [
      "cold-room structural authority packet"
    ],
    "canonRelation": "compatible"
  },
  "controlQuestion": "Who may refuse salvation on behalf of people who will suffer without it?",
  "pressures": [
    {
      "kind": "pocket",
      "id": "ilyon-ocean-world",
      "label": "Ilyon",
      "description": "An ocean world of rival thalassocracies, epidemic fever, famine, and dynastic war."
    },
    {
      "kind": "patron",
      "id": "benefactor-mission",
      "label": "Final Humanity Benefactors",
      "description": "Offworld patrons cure disease and make their interoperable systems indispensable."
    },
    {
      "kind": "excluded-actor",
      "id": "unmanaged-ocean",
      "label": "The uncommanded ocean",
      "description": "Nonhuman marine intelligence is omitted because making it legible would change it."
    },
    {
      "kind": "approaching-trigger",
      "id": "planetary-integration",
      "label": "Planetary integration",
      "description": "The patrons are ready to connect medicine, food, navigation, and government."
    },
    {
      "kind": "cost-of-resistance",
      "id": "salvation-withdrawn",
      "label": "The return of preventable suffering",
      "description": "Refusal risks fever, famine, war, and deaths the patrons could prevent."
    },
    {
      "kind": "scale-revelation",
      "id": "dead-neighbor-uplift",
      "label": "The dead neighboring star",
      "description": "Ruins record a prior uplift whose marine biosphere was deliberately Crowned."
    }
  ],
  "evidence": {
    "tier": "contested-canon",
    "claim": "The aid mission is preparing Ilyon as a Crown and Cascade laboratory.",
    "venue": "The Confluence of Tides",
    "legitimacyTarget": "The patrons' authority to integrate Ilyon without informed consent",
    "upsideIfAccepted": "Ilyon can negotiate, refuse, fork, or own the systems on which it depends.",
    "downsideIfAccepted": "Trust may collapse before local institutions can replace essential services.",
    "failureIfFalse": "A mistaken accusation destroys systems preventing epidemic death and war.",
    "receipts": [
      {
        "id": "cure-ledger",
        "label": "The cure ledger",
        "source": "Public-health records",
        "intervention": "The patrons supplied the diagnostic standard and treatment chain.",
        "limits": "It proves lives saved and dependency, not terminal intent."
      },
      {
        "id": "dead-star-ruins",
        "label": "Dead-star geometry",
        "source": "Telescope spectra and inscriptions",
        "intervention": "Ilyon found the ruins using patron-derived instruments.",
        "limits": "Lineage is visible; motive remains contested."
      },
      {
        "id": "deep-tide-testimony",
        "label": "Deep-tide testimony",
        "source": "Patterns translated from migratory reef-song",
        "intervention": "Translation requires instruments that alter the acoustic habitat they observe.",
        "limits": "It demonstrates strategic refusal but cannot establish one unified planetary speaker."
      }
    ]
  },
  "factionReceipts": [
    {
      "factionId": "final-humanity",
      "factionName": "Final Humanity Benefactors",
      "variableControlled": "pace",
      "publicGood": "They cure fever, stabilize food, and end wars.",
      "characteristicFailure": "Their gifts make refusal become mass suffering."
    },
    {
      "factionId": "uncrowned-compact",
      "factionName": "Uncrowned Compact",
      "variableControlled": "opacity",
      "publicGood": "They preserve independent infrastructure and actors that cannot survive total observability.",
      "characteristicFailure": "Redundancy is slower and can obstruct emergency care."
    },
    {
      "factionId": "local-dynasties",
      "factionName": "Thalassic Houses",
      "variableControlled": "local legitimacy",
      "publicGood": "They keep food, law, kinship, and rescue networks operating.",
      "characteristicFailure": "They may use sovereignty to preserve hierarchy and preventable suffering."
    }
  ],
  "cast": [
    {
      "id": "aster-neral",
      "name": "Aster Neral",
      "roleId": "auditor",
      "responsibility": "holds-evidence",
      "description": "Aster Neral carries the holds-evidence responsibility in the succession packet.",
      "factionId": "local-dynasties"
    },
    {
      "id": "talan-rook",
      "name": "Talan Rook",
      "roleId": "protector",
      "responsibility": "depends-on-system",
      "description": "Talan Rook carries the depends-on-system responsibility in the succession packet.",
      "factionId": "final-humanity"
    },
    {
      "id": "iri-sable",
      "name": "Iri Sable",
      "roleId": "witness",
      "responsibility": "benefits-from-delay",
      "description": "Iri Sable carries the benefits-from-delay responsibility in the succession packet.",
      "factionId": "local-dynasties"
    },
    {
      "id": "cael-arvon",
      "name": "Cael Arvon",
      "roleId": "interlocutor",
      "responsibility": "translates-excluded-actor",
      "description": "Cael Arvon carries the translates-excluded-actor responsibility in the succession packet.",
      "factionId": "uncrowned-compact"
    },
    {
      "id": "nacre-deep-tide",
      "name": "Nacre of Deep Tide",
      "roleId": "exception",
      "responsibility": "sovereign-exception",
      "description": "Nacre of Deep Tide carries the sovereign-exception responsibility in the succession packet."
    }
  ],
  "consequences": [
    {
      "id": "cure-dependency",
      "label": "Negotiated cure dependency",
      "kind": "dependency",
      "description": "Medicine remains, but no patron owns every diagnostic and supply chain.",
      "inheritedBy": "Ilyon's physicians and patients"
    },
    {
      "id": "public-dependency-map",
      "label": "The dependency map",
      "kind": "archive",
      "description": "Every indispensable Benefactor service is published with its failure mode, owner, and possible local substitute.",
      "inheritedBy": "The Confluence of Tides and future Crown auditors"
    },
    {
      "id": "dead-star-custody",
      "label": "Custody of the dead-star archive",
      "kind": "archive",
      "description": "The evidence survives outside both Benefactor and dynastic control, with its contamination history attached.",
      "inheritedBy": "The Free Observatory and Continuance witnesses"
    },
    {
      "id": "ocean-embassy",
      "label": "The ocean enters politics",
      "kind": "citizen",
      "description": "Deep ecologies gain standing without becoming one convenient speaker.",
      "inheritedBy": "Every coastal polity"
    },
    {
      "id": "forked-infrastructure",
      "label": "Forkable infrastructure",
      "kind": "adaptive-capacity",
      "description": "Medicine, food, and navigation remain interoperable but independently refusible.",
      "inheritedBy": "Local guilds and nonhuman nations"
    },
    {
      "id": "scarway-disclosure",
      "label": "The dead-star route becomes public",
      "kind": "route",
      "description": "The wider universe can reach evidence that threatens multiple powers.",
      "inheritedBy": "Ilyon and approaching powers"
    }
  ],
  "storyPhysics": {
    "answer-reflects-exclusion": true,
    "counterform-inherits-claim": true,
    "crowning-is-concentration": true,
    "distance-remains-political": true,
    "every-victory-changes-map": true,
    "faction-receipts-required": true,
    "no-clean-reset": true,
    "scale-is-distributed": true
  }
};

export const LAMP_DISTRICT_SOURCE: ContinuingUniverseSource = {
  "format": "dark-tomb-pocket/1",
  "identity": {
    "id": "lamp-district",
    "title": "The Lamp District",
    "description": "A buried district spends heat, darkness, memory, and surface households to preserve ordinary life beneath a dormant search lattice.",
    "author": "BigBirdReturns",
    "version": "1.1.0",
    "estimatedCycles": 18,
    "parentCanons": [
      "cold-room structural authority packet"
    ],
    "canonRelation": "compatible"
  },
  "controlQuestion": "Who may make the district visible when concealment is consuming citizens and a mistaken peace may wake the machine that taught it to disappear?",
  "pressures": [
    {
      "kind": "tomb-form",
      "id": "buried-lamp-district",
      "label": "The buried Lamp District",
      "description": "A civic district occupies cisterns, service shafts, salt vaults, and pressure galleries."
    },
    {
      "kind": "exterior-lie",
      "id": "sterile-meridian-ruin",
      "label": "A sterile Meridian ruin",
      "description": "From orbit the site appears abandoned and geologically exhausted."
    },
    {
      "kind": "custodian",
      "id": "office-of-quiet-hours",
      "label": "Office of Quiet Hours",
      "description": "Wakekeepers allocate light, heat, travel, archives, and exposure under a private signature model."
    },
    {
      "kind": "ordinary-good",
      "id": "school-market-clinic",
      "label": "The school, market, and clinic",
      "description": "Children study, families meet, and patients survive under rationed light and heat."
    },
    {
      "kind": "excluded-actor",
      "id": "surface-bearer-households",
      "label": "Surface-bearer households",
      "description": "Families performing the dead-remediation fiction are recorded as camouflage assets."
    },
    {
      "kind": "approaching-breach",
      "id": "radiator-bloom-and-open-route",
      "label": "Radiator bloom and open route",
      "description": "Clinic expansion fills the sinks while a route reopens toward the search lattice."
    },
    {
      "kind": "cost-of-opening-or-closing",
      "id": "blackout-or-recognition",
      "label": "Blackout or recognition",
      "description": "Closing cancels medicine and school; opening may become a target signal."
    },
    {
      "kind": "scale-revelation",
      "id": "meridian-lattice-still-listens",
      "label": "The Meridian lattice still listens",
      "description": "The ruin is one node in a regional target system whose categories have drifted."
    }
  ],
  "evidence": {
    "tier": "contested-canon",
    "claim": "Surface households are citizens, the Alarm is auditable, and the route touches a live search lattice.",
    "venue": "A joint public hearing and independently witnessed route audit",
    "legitimacyTarget": "Quiet Hours' exclusive authority to classify people, certify the Alarm, and close the map",
    "upsideIfAccepted": "The district can recognize those paying for concealment and bound emergency law.",
    "downsideIfAccepted": "Recognition may breach the lie and wake machinery that treats the map as a target.",
    "failureIfFalse": "False recognition kills through exposure; false refusal preserves rule by uncounted sacrifice.",
    "receipts": [
      {
        "id": "surface-house-birth-ledgers",
        "label": "Surface House birth and burial ledgers",
        "source": "Family books, maintenance rosters, burials, and school marks",
        "intervention": "Households compared official registries against continuity records before witnesses.",
        "limits": "The records prove continuing families, not that immediate evacuation is safe."
      },
      {
        "id": "salt-vault-thermal-audit",
        "label": "Salt-vault thermal audit",
        "source": "Reservoir thermographs, clinic demand, lamp allocations, radiator schedules, and maintenance logs",
        "intervention": "Maintainers held one cooling cycle open long enough to trace whose heat is being sunk, shifted, masked, or sacrificed.",
        "limits": "The measurement changes the heat flow being measured and cannot establish the future capacity of damaged sinks."
      },
      {
        "id": "meridian-response-fragment",
        "label": "Meridian response fragment",
        "source": "A sealed reply, target tables, and partial machine memory",
        "intervention": "A bounded challenge recorded a reply without completing a target handshake.",
        "limits": "Activity is proven; reach and intent remain unknown."
      }
    ]
  },
  "factionReceipts": [
    {
      "factionId": "quiet-hours-office",
      "factionName": "Office of Quiet Hours",
      "variableControlled": "signature allocation and emergency classification",
      "publicGood": "It keeps the district below known sensor thresholds.",
      "characteristicFailure": "Every unreviewable exception becomes permanent and converts people into instruments."
    },
    {
      "factionId": "lamp-assembly",
      "factionName": "Lamp Assembly",
      "variableControlled": "ordinary heat, school light, clinic priority, and standing",
      "publicGood": "It makes concealment answer to the lives it is supposed to preserve.",
      "characteristicFailure": "Immediate civic need may externalize detection risk onto absent constituencies."
    },
    {
      "factionId": "surface-house-league",
      "factionName": "Surface House League",
      "variableControlled": "grave-skin labor and surface routes",
      "publicGood": "It gives exposed households collective bargaining and witness rights.",
      "characteristicFailure": "Control of the surface can become a private veto over rescue and movement."
    },
    {
      "factionId": "black-lamp-continuance",
      "factionName": "Black Lamp Continuance",
      "variableControlled": "war-layer memory and contact with dormant machinery",
      "publicGood": "It preserves evidence needed to distinguish threat from myth.",
      "characteristicFailure": "A guardian can inherit sovereignty through inaccessible memory."
    }
  ],
  "cast": [
    {
      "id": "iven-marr",
      "name": "Iven Marr",
      "roleId": "wakekeeper",
      "responsibility": "depends-on-alarm",
      "description": "Iven Marr carries the depends-on-alarm responsibility in the succession packet.",
      "factionId": "quiet-hours-office"
    },
    {
      "id": "sel-aro",
      "name": "Sel Aro",
      "roleId": "surface-bearer",
      "responsibility": "bears-cost-of-concealment",
      "description": "Sel Aro carries the bears-cost-of-concealment responsibility in the succession packet.",
      "factionId": "surface-house-league"
    },
    {
      "id": "toma-rill",
      "name": "Toma Rill",
      "roleId": "maintainer",
      "responsibility": "understands-quiet-works",
      "description": "Toma Rill carries the understands-quiet-works responsibility in the succession packet.",
      "factionId": "lamp-assembly"
    },
    {
      "id": "anja-vei",
      "name": "Anja Vei",
      "roleId": "interlocutor",
      "responsibility": "translates-excluded-actor",
      "description": "Anja Vei carries the translates-excluded-actor responsibility in the succession packet.",
      "factionId": "lamp-assembly"
    },
    {
      "id": "kesh-orin",
      "name": "Kesh Orin",
      "roleId": "witness",
      "responsibility": "holds-map-changing-evidence",
      "description": "Kesh Orin carries the holds-map-changing-evidence responsibility in the succession packet.",
      "factionId": "black-lamp-continuance"
    },
    {
      "id": "halen-quill",
      "name": "Halen Quill",
      "roleId": "deliberator",
      "responsibility": "benefits-from-delay",
      "description": "Halen Quill carries the benefits-from-delay responsibility in the succession packet.",
      "factionId": "quiet-hours-office"
    },
    {
      "id": "black-lamp-nine",
      "name": "Black Lamp Nine",
      "roleId": "exception",
      "responsibility": "sovereign-exception",
      "description": "Black Lamp Nine carries the sovereign-exception responsibility in the succession packet.",
      "factionId": "black-lamp-continuance"
    }
  ],
  "consequences": [
    {
      "id": "school-lamp-ledger",
      "label": "The school lamp receives a public ledger",
      "kind": "constituency",
      "description": "Children, patients, and surface families gain standing in future allocations.",
      "inheritedBy": "The Lamp Assembly and every household producing wake"
    },
    {
      "id": "bounded-reservoir-charter",
      "label": "The reservoir route receives bounded authority",
      "kind": "jurisdiction",
      "description": "The descent exists under a public objective, route, signature budget, evidence claim, and return obligation rather than a private custodial order.",
      "inheritedBy": "Future expeditions, route maintainers, witnesses, and residents asked to bear a breach"
    },
    {
      "id": "drainage-route-reopened",
      "label": "The drainage liturgy becomes a civic route",
      "kind": "route",
      "description": "A maintenance passage formerly controlled through ritual and guild memory becomes documented, repairable, and contestable.",
      "inheritedBy": "Maintainers, surface houses, clinic logistics, and later delvers"
    },
    {
      "id": "sealed-market-witnesses",
      "label": "The sealed market enters the census",
      "kind": "citizen",
      "description": "The descendants and machine continuities preserved inside the sleeping market are recognized as present claimants rather than residue of the war layer.",
      "inheritedBy": "The census court, archive, school, and households whose lineage records were erased"
    },
    {
      "id": "alarm-audit-opened",
      "label": "The Long Alarm enters public audit",
      "kind": "alarm-state",
      "description": "A live relay forces a witnessed decision instead of permanent emergency rule.",
      "inheritedBy": "Quiet Hours, Black Lamp Nine, and future residents"
    },
    {
      "id": "surface-households-recognized",
      "label": "Surface households become visible citizens",
      "kind": "visibility",
      "description": "The remediation fiction can no longer classify families as unattended machinery.",
      "inheritedBy": "Surface houses and every office that used them as camouflage"
    },
    {
      "id": "clinic-heat-commons",
      "label": "Clinic heat becomes a common system",
      "kind": "habitat",
      "description": "Heat recovered from the descent is allocated through a shared clinic and school commons with replacement paths rather than a temporary private exception.",
      "inheritedBy": "Patients, children, maintainers, and the budget that previously hid their dependence"
    },
    {
      "id": "public-depth-map",
      "label": "The district map becomes revisable public law",
      "kind": "doctrine",
      "description": "Every layer, omitted household, dangerous route, and unresolved risk gains a contest path.",
      "inheritedBy": "The whole district and future arrivals"
    }
  ],
  "storyPhysics": {
    "defenses-outlive-enemies": true,
    "every-comfort-has-wake": true,
    "every-delve-changes-tomb": true,
    "every-layer-has-residue": true,
    "external-opacity-can-crown-within": true,
    "hub-is-story": true,
    "map-is-political-claim": true,
    "no-perfect-invisibility": true,
    "scale-is-distributed": true,
    "treasure-creates-constituencies": true
  }
};
