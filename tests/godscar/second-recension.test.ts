import { describe, expect, it } from "vitest";
import { KIND_GODS_OF_ILYON_BLUEPRINT } from "../../src/godscar/templates.js";
import {
  SECOND_RECENSION_BOOKS_I_III,
  buildConsequencePlaneReceipt,
  parseConsequencePlaneReceipt,
  readSecondRecensionNote,
  type BookIConsequencePlaneLedger,
  type BookIILivingTombLedger,
  type BookIIIExpandedCommonshipLedger,
} from "../../src/godscar/second-recension.js";
import { validateGodscarPocket } from "../../src/godscar/schema.js";
import { DARK_TOMB_STARTER } from "../../src/dark-tomb/templates.js";
import { LAMP_DISTRICT_SOURCE } from "../../src/dark-tomb/lamp-district.js";
import { validateDarkTombPocket } from "../../src/dark-tomb/schema.js";
import { COMMON_SHIP_STARTER } from "../../src/common-ship/templates.js";
import { RELIEF_CIRCUIT_SOURCE } from "../../src/common-ship/relief-circuit.js";
import { validateCommonShipPocket } from "../../src/common-ship/schema.js";

describe("Second Recension addenda for Books I-III", () => {
  it("preserves the first recensions and excludes Book IV from the repo contract", () => {
    expect(SECOND_RECENSION_BOOKS_I_III.preservesFirstRecension).toBe(true);
    expect(SECOND_RECENSION_BOOKS_I_III.bookIVExcluded).toBe(true);
    expect(Object.keys(SECOND_RECENSION_BOOKS_I_III.books)).toEqual(["book-i", "book-ii", "book-iii"]);
    expect(JSON.stringify(SECOND_RECENSION_BOOKS_I_III)).not.toContain("lineage-commons");
  });

  it("attaches the Book I Consequence Plane to Ilyon", () => {
    const note = readSecondRecensionNote(KIND_GODS_OF_ILYON_BLUEPRINT.notes);
    expect(note?.bookId).toBe("book-i");
    const ledger = note!.ledger as BookIConsequencePlaneLedger;
    expect(ledger.scales.map((entry) => entry.scale)).toEqual(["pocket", "route", "sector", "cascade"]);
    expect(ledger.sectorLedger.changedRoutes).toContain("The route to the dead neighboring star becomes public and politically dangerous.");
    expect(ledger.sectorLedger.dissent.length).toBeGreaterThan(0);
    expect(ledger.consequenceTurn).toEqual([
      "receive-bounded-receipt",
      "update-route-and-classification",
      "record-faction-interpretations",
      "preserve-dissent-and-uncertainty",
      "declare-next-pressure",
    ]);
  });

  it("attaches the Book II Living Tomb ledger to the starter and Lamp District", () => {
    const starter = readSecondRecensionNote(DARK_TOMB_STARTER.notes);
    const lamp = readSecondRecensionNote(LAMP_DISTRICT_SOURCE.notes);
    expect(starter?.bookId).toBe("book-ii");
    expect(lamp?.bookId).toBe("book-ii");
    const ledger = lamp!.ledger as BookIILivingTombLedger;
    expect(ledger.lineageScars[0]?.missingFunction).toContain("citizenship");
    expect(ledger.reproductiveOverhead[0]?.wake).toContain("birth");
    expect(ledger.surfaceSovereignty[0]?.population).toBe("Surface-bearer households");
    expect(ledger.negativeConfederation.mapBoundary).toContain("target solution");
    expect(ledger.opening.map((entry) => entry.status)).toContain("bounded");
  });

  it("attaches the Book III Expanded Commonship ledger to the starter and Relief Circuit", () => {
    const starter = readSecondRecensionNote(COMMON_SHIP_STARTER.notes);
    const relief = readSecondRecensionNote(RELIEF_CIRCUIT_SOURCE.notes);
    expect(starter?.bookId).toBe("book-iii");
    expect(relief?.bookId).toBe("book-iii");
    const ledger = relief!.ledger as BookIIIExpandedCommonshipLedger;
    expect(ledger.profileMultiplicity.rule).toContain("Several people");
    expect(ledger.publicGeometry.accessFloor).toEqual(["care", "deliberation", "work", "refuge", "exit"]);
    expect(ledger.preparationLaw.lawfulActions).toContain("train");
    expect(ledger.connectedOperation.requiredFacts).toContain("dissent, uncertainty, obligations, provenance, and consequences");
    expect(ledger.vesselContinuityClaim.currentStatus).toBe("contested");
    expect(ledger.referenceCampaign).toContain("Relief Circuit");
  });

  it("keeps old first-recension sources valid when the addendum note is absent", () => {
    const godscar = structuredClone(KIND_GODS_OF_ILYON_BLUEPRINT);
    const tomb = structuredClone(DARK_TOMB_STARTER);
    const ship = structuredClone(COMMON_SHIP_STARTER);
    delete godscar.notes;
    delete tomb.notes;
    delete ship.notes;
    expect(validateGodscarPocket(godscar).ok).toBe(true);
    expect(validateDarkTombPocket(tomb).ok).toBe(true);
    expect(validateCommonShipPocket(ship).ok).toBe(true);
  });

  it("builds and parses a bounded consequence-plane receipt without universalizing the claim", () => {
    const receipt = buildConsequencePlaneReceipt({
      id: "ilyon-dead-star-sector-turn",
      scale: "sector",
      sourcePocketId: "kind-gods-of-ilyon",
      claim: "The route and evidence alter sector legitimacy without settling Benefactor motive.",
      evidenceTier: "contested-canon",
      provenance: ["cure ledger", "dead-star geometry", "deep-tide testimony"],
      decisions: ["keep the cure", "fork the infrastructure", "publish the dependency map"],
      dissent: ["No single reef nation speaks for the whole ocean."],
      uncertainty: ["The archive establishes sequence more securely than motive."],
      obligations: ["Preserve local refusal and raw evidence."],
      consequences: ["The route is public.", "Faction standing changes."],
      sectorLedger: (readSecondRecensionNote(KIND_GODS_OF_ILYON_BLUEPRINT.notes)!.ledger as BookIConsequencePlaneLedger).sectorLedger,
      reviewAuthority: "The Confluence of Tides and later bounded claimants",
    });
    expect(parseConsequencePlaneReceipt(JSON.parse(JSON.stringify(receipt)))).toEqual(receipt);
  });
});
