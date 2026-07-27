import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileActionEncounter } from "../../src/engine/action/compile.js";
import { actionSeed, buildActionReceipt } from "../../src/engine/action/receipt.js";
import {
  commitNarrativeSelection,
  ingestAcceptedActionReceipt,
  sortNarrativeCandidates,
} from "../../src/narrative/index.js";
import {
  UNDERDRAIN_ACTION_NARRATIVE_BINDING,
  UNDERDRAIN_ACTION_PROFILE,
  UNDERDRAIN_CHALLENGE,
  UNDERDRAIN_CONSTITUTION,
  UNDERDRAIN_DRAFT_ARC,
  UNDERDRAIN_STANDALONE_MANIFEST,
  UNDERDRAIN_STRATEGY_IDS,
  buildUnderdrainPreActionState,
} from "../../src/demos/underdrain/index.js";
import { buildCompetentTrace, buildIdleTrace } from "../action/helpers.js";

describe("UNDERDRAIN standalone authoring estate", () => {
  it("compiles the original cartridge through the ordinary action grammar", () => {
    const spec = compileActionEncounter(UNDERDRAIN_DRAFT_ARC, UNDERDRAIN_CHALLENGE);
    expect(spec).toMatchObject({
      format: "axm-action-spec/1",
      tickRate: 30,
      maxTicks: 90 * 30,
      arena: { kit: "lane" },
      player: { kit: "hammer" },
    });
    expect(spec.objectives.map((objective) => objective.id)).toEqual(
      UNDERDRAIN_ACTION_PROFILE.encounters[UNDERDRAIN_CHALLENGE.id]?.objectiveOrder,
    );
    expect(spec.objectives.map((objective) => objective.enemyKit)).toEqual([
      "skirmisher",
      "swarm",
      "breaker",
    ]);
    expect(compileActionEncounter(UNDERDRAIN_DRAFT_ARC, UNDERDRAIN_CHALLENGE, "service-tunnel").specDigest)
      .not.toBe(spec.specDigest);
    expect(compileActionEncounter(UNDERDRAIN_DRAFT_ARC, UNDERDRAIN_CHALLENGE, "truce-offer").specDigest)
      .not.toBe(spec.specDigest);
  });

  it("authors all three methods through one stable-character episode rail", () => {
    for (const strategy of UNDERDRAIN_STRATEGY_IDS) {
      const state = buildUnderdrainPreActionState(strategy);
      expect(state.ledger.beats.map((beat) => beat.beatFunction)).toEqual([
        "establish",
        "pressure",
        "escalate",
        "reveal",
        "choose",
      ]);
      expect(state.tracks).toEqual([
        expect.objectContaining({
          id: "underdrain-war",
          railId: "municipal-episode",
          currentFunction: "choose",
          status: "open",
        }),
      ]);
      expect(state.ledger.obligations.filter((entry) => entry.status === "open").map((entry) => entry.id))
        .toEqual(expect.arrayContaining([
          "keep-water-running",
          "refund-drain-caps",
          "expose-enzyme-poisoning",
        ]));
      expect(state.ledger.beats.at(-1)?.candidateId).toContain(strategy);
    }
  });

  it("returns a real accepted action receipt into narrative consequence authority", () => {
    const narrativeState = buildUnderdrainPreActionState("emergency-plan");
    const spec = compileActionEncounter(UNDERDRAIN_DRAFT_ARC, UNDERDRAIN_CHALLENGE);
    const orgSeed = 0x5eed_2026;
    const seed = actionSeed(orgSeed, narrativeState.cycle, UNDERDRAIN_CHALLENGE.id, null);
    const { trace, state: terminal } = buildCompetentTrace(spec, seed);
    expect(terminal.result?.outcome).toBe("success");

    const accepted = buildActionReceipt({
      arc: UNDERDRAIN_DRAFT_ARC,
      challenge: UNDERDRAIN_CHALLENGE,
      cycle: narrativeState.cycle,
      orgSeed,
      controlledAgentId: "rhea-venn",
      partyAgentIds: ["rhea-venn"],
      trace,
    });
    const ingestion = ingestAcceptedActionReceipt({
      arc: UNDERDRAIN_DRAFT_ARC,
      challenge: UNDERDRAIN_CHALLENGE,
      cycle: narrativeState.cycle,
      orgSeed,
      partyAgentIds: ["rhea-venn"],
      narrativeState,
      binding: UNDERDRAIN_ACTION_NARRATIVE_BINDING,
      receipt: accepted,
    });
    expect(ingestion.fact).toMatchObject({
      type: "accepted-action-result",
      receiptRef: accepted.receiptDigest,
      data: { outcome: "success" },
    });
    const selection = sortNarrativeCandidates(UNDERDRAIN_CONSTITUTION, ingestion.state, [ingestion.candidate]);
    expect(selection.selectedCandidateId).toBe(ingestion.candidate.id);
    const committed = commitNarrativeSelection(
      UNDERDRAIN_CONSTITUTION,
      ingestion.state,
      [ingestion.candidate],
      selection,
    );
    expect(committed.state.ledger.beats.at(-1)).toMatchObject({
      beatFunction: "consequence",
      presentationKey: "underdrain.consequence.success",
      roleBindings: { controlled: "rhea-venn" },
    });
    expect(committed.state.ledger.obligations.find((entry) => entry.id === "keep-water-running")?.status)
      .toBe("resolved");
    expect(committed.state.ledger.obligations.find((entry) => entry.id === "honor-fungal-embassy")?.status)
      .toBe("open");
  });

  it("keeps failure as failure and pins the standalone manifest", () => {
    const narrativeState = buildUnderdrainPreActionState("service-tunnel");
    const spec = compileActionEncounter(UNDERDRAIN_DRAFT_ARC, UNDERDRAIN_CHALLENGE, "service-tunnel");
    const orgSeed = 0x0bad_f00d;
    const seed = actionSeed(orgSeed, narrativeState.cycle, UNDERDRAIN_CHALLENGE.id, "service-tunnel");
    const { trace, state: terminal } = buildIdleTrace(spec, seed);
    expect(terminal.result?.outcome).toBe("failure");
    const accepted = buildActionReceipt({
      arc: UNDERDRAIN_DRAFT_ARC,
      challenge: UNDERDRAIN_CHALLENGE,
      difficultyModeId: "service-tunnel",
      cycle: narrativeState.cycle,
      orgSeed,
      controlledAgentId: "rhea-venn",
      partyAgentIds: ["rhea-venn"],
      trace,
    });
    const ingestion = ingestAcceptedActionReceipt({
      arc: UNDERDRAIN_DRAFT_ARC,
      challenge: UNDERDRAIN_CHALLENGE,
      difficultyModeId: "service-tunnel",
      cycle: narrativeState.cycle,
      orgSeed,
      partyAgentIds: ["rhea-venn"],
      narrativeState,
      binding: UNDERDRAIN_ACTION_NARRATIVE_BINDING,
      receipt: accepted,
    });
    expect(ingestion.receipt.actionOutcome).toBe("failure");
    expect(ingestion.candidate.presentationKey).toBe("underdrain.consequence.failure");
    expect(ingestion.candidate.opensObligations.map((entry) => entry.id)).toEqual([
      "restore-crown-pump",
      "pay-substrate-invoice",
    ]);

    const bytes = readFileSync(new URL("../../examples/underdrain-draft/authoring.json", import.meta.url));
    expect(JSON.parse(bytes.toString("utf8"))).toEqual(UNDERDRAIN_STANDALONE_MANIFEST);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "6703fe3e424a41d1f86d46ed32bc48c9306676aa0d4336561edf462140fb3bbf",
    );
  });
});
