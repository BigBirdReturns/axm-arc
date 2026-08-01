import { describe, expect, it } from "vitest";
import { BURN_PROTOCOL_DISCLOSURE_PROBE } from "../../src/arcs/burn-protocol-disclosure-probe.js";
import {
  BURN_PROTOCOL_CORPUS_PUBLICATION_PROBE,
  BURN_PROTOCOL_V058_SHA256,
} from "../../src/common-ship/burn-protocol-disclosure-probe.js";
import {
  BURN_PROTOCOL_DISCLOSURE_PROBE_PUBLISHED_SOURCE,
  BURN_PROTOCOL_DISCLOSURE_PUBLICATION_THRESHOLDS,
} from "../../src/common-ship/burn-protocol-disclosure-publication.js";
import {
  compileCommonShipPocket,
  readCommonShipPocketExtension,
} from "../../src/common-ship/compiler.js";
import { validateCommonShipPocket } from "../../src/common-ship/schema.js";
import { evaluateComposition } from "../../src/engine/composition.js";
import { runCycle } from "../../src/engine/cycle.js";
import { foundOrganization } from "../../src/engine/founding.js";
import { validateArc } from "../../src/engine/schema.js";

const EXPECTED_CHALLENGES = [
  "open-the-six-repository-hearing",
  "assign-the-six-withdrawal-mandates",
  "repair-the-first-public-corridor",
  "publish-the-read-only-reconstruction",
];

const EXPECTED_CONSEQUENCES = [
  "consequence:archive:six-repository-hearing-open",
  "consequence:jurisdiction:separate-withdrawal-mandates",
  "consequence:route:first-corridor-public-repair",
  "consequence:continuity:read-only-reconstruction-ledger",
];

describe("The Burn Protocol corpus publication probe", () => {
  it("binds only the supplied v0.58.0 status record and states the missing-payload boundary", () => {
    expect(BURN_PROTOCOL_CORPUS_PUBLICATION_PROBE.exactParent).toEqual({
      estateVersion: "0.58.0",
      sha256: BURN_PROTOCOL_V058_SHA256,
      illustratedThrough: "A12C3",
      nextTransaction: "A13C1",
      nextTitle: "Disclosure",
    });
    expect(BURN_PROTOCOL_CORPUS_PUBLICATION_PROBE.corpus).toEqual({
      canonicalEpisodeSources: 13,
      scriptedPanels: 780,
      illustratedPanels: 720,
      completedVisualChapters: 36,
      scrollPlates: 144,
      remainingScriptedPanels: 60,
    });
    expect(BURN_PROTOCOL_CORPUS_PUBLICATION_PROBE.sourceRecord.unavailableEvidence).toEqual(
      expect.arrayContaining([
        "sealed-v0.58.0-estate-zip",
        "panel-and-plate-image-payloads",
        "machine-readable-manifests-and-validation-receipts",
      ]),
    );
    expect(BURN_PROTOCOL_CORPUS_PUBLICATION_PROBE.publication).toMatchObject({
      inheritedHistory: "read-only",
      liveRunAuthority: "counterfactual-only",
      assetPolicy: "no-panel-payloads-in-probe",
    });
  });

  it("validates the calibrated Common Ship publication source and compiles to an engine-1.3 Arc", () => {
    expect(validateCommonShipPocket(BURN_PROTOCOL_DISCLOSURE_PROBE_PUBLISHED_SOURCE)).toEqual({
      ok: true,
      source: BURN_PROTOCOL_DISCLOSURE_PROBE_PUBLISHED_SOURCE,
    });
    expect(BURN_PROTOCOL_DISCLOSURE_PROBE).toEqual(
      compileCommonShipPocket(BURN_PROTOCOL_DISCLOSURE_PROBE_PUBLISHED_SOURCE),
    );
    expect(validateArc(BURN_PROTOCOL_DISCLOSURE_PROBE)).toEqual(
      BURN_PROTOCOL_DISCLOSURE_PROBE,
    );
    expect(BURN_PROTOCOL_DISCLOSURE_PROBE.meta).toMatchObject({
      id: "burn-protocol-disclosure-probe",
      version: "0.1.1",
      domain: "godscar-common-ship",
      engineVersion: "1.3.0",
    });
    expect(BURN_PROTOCOL_DISCLOSURE_PROBE.challenges.map((challenge) => challenge.id)).toEqual(
      EXPECTED_CHALLENGES,
    );
    expect(Object.fromEntries(BURN_PROTOCOL_DISCLOSURE_PROBE.challenges.map((challenge) => [
      challenge.id,
      challenge.mechanicChecks[0]!.difficultyThreshold,
    ]))).toEqual(BURN_PROTOCOL_DISCLOSURE_PUBLICATION_THRESHOLDS);
    expect(readCommonShipPocketExtension(BURN_PROTOCOL_DISCLOSURE_PROBE)).toEqual(
      BURN_PROTOCOL_DISCLOSURE_PROBE_PUBLISHED_SOURCE,
    );
    expect(BURN_PROTOCOL_DISCLOSURE_PROBE.stateDefinitions).toHaveLength(12);
  });

  it("founds deterministically and gives World a feasible named population for every watch", () => {
    const first = foundOrganization(BURN_PROTOCOL_DISCLOSURE_PROBE);
    const second = foundOrganization(BURN_PROTOCOL_DISCLOSURE_PROBE);
    expect(first).toEqual(second);

    const agents = Object.values(first.agents);
    expect(agents).toHaveLength(6);
    expect(agents.map((agent) => agent.compositionProfileId).sort()).toEqual([
      "chain-infrastructure-operator",
      "discovery-reconstruction-platform",
      "kelpien-kinship-mediator",
      "protected-biological-witness",
      "starfleet-command-officer",
      "terran-doctrine-witness",
    ]);

    for (const challenge of BURN_PROTOCOL_DISCLOSURE_PROBE.challenges) {
      const result = evaluateComposition({
        arc: BURN_PROTOCOL_DISCLOSURE_PROBE,
        challenge,
        agents,
      });
      expect(result.feasible, `${challenge.id}: ${result.rejectionReasons.join("; ")}`).toBe(true);
    }
  });

  it("accepts the ordered four-watch campaign through ordinary default founding and runCycle", () => {
    let org = foundOrganization(BURN_PROTOCOL_DISCLOSURE_PROBE);
    const agentIds = Object.keys(org.agents);
    const outcomes: string[] = [];

    for (const challenge of BURN_PROTOCOL_DISCLOSURE_PROBE.challenges) {
      const result = runCycle({
        org,
        arc: BURN_PROTOCOL_DISCLOSURE_PROBE,
        assignments: [{ challengeId: challenge.id, agentIds, tokensSpent: 1 }],
      });
      expect(result.warnings, challenge.id).toEqual([]);
      expect(result.reports, challenge.id).toHaveLength(1);
      expect(result.reports[0]!.outcome, challenge.id).toBe("success");
      outcomes.push(result.reports[0]!.outcome);
      org = result.org;
    }

    expect(outcomes).toEqual(["success", "success", "success", "success"]);
    for (const agent of Object.values(org.agents)) {
      expect(agent.assignmentHistory.map((record) => [record.challengeId, record.outcome])).toEqual(
        EXPECTED_CHALLENGES.map((challengeId) => [challengeId, "success"]),
      );
    }
    for (const stateId of EXPECTED_CONSEQUENCES) {
      expect(org.cartridgeState?.[stateId], stateId).toBe(true);
    }
  });

  it("keeps canonical history read-only and exposes no panel asset path", () => {
    const serialized = JSON.stringify({
      publication: BURN_PROTOCOL_CORPUS_PUBLICATION_PROBE,
      source: BURN_PROTOCOL_DISCLOSURE_PROBE_PUBLISHED_SOURCE,
    });
    expect(serialized).not.toMatch(/\.png|\.jpg|\.webp|panel-raster|scroll-plate/i);
    expect(BURN_PROTOCOL_DISCLOSURE_PROBE_PUBLISHED_SOURCE.notes).toMatchObject({
      canonicalBoundary: {
        inheritedHistory: "read-only",
        liveRuns: "counterfactual-only",
        storyChanges: "none",
        panelPayloads: "not-present",
      },
      receiverCalibration: {
        format: "burn-protocol-live-resolver-calibration/1",
        tokensSpentPerWatch: 1,
        acceptance: "four ordered accepted successes through ordinary runCycle",
      },
    });
  });
});
