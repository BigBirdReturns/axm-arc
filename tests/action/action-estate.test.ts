import { describe, expect, it } from "vitest";
import type { Arc } from "../../src/engine/types.js";
import { FIRST_CHARTER, KARAZHAN, KIND_GODS_OF_ILYON, LAMP_DISTRICT, RELIEF_CIRCUIT } from "../../src/arcs/index.js";
import { ORCHARD_AT_LOW_TIDE } from "../../src/clean-room/orchard-at-low-tide.js";
import { compileActionEncounter } from "../../src/engine/action/compile.js";
import { actionSeed, buildActionReceipt, verifyActionReceipt } from "../../src/engine/action/receipt.js";
import { buildCompetentTrace } from "./helpers.js";

const ESTATE: Arc[] = [
  FIRST_CHARTER,
  KARAZHAN,
  KIND_GODS_OF_ILYON,
  LAMP_DISTRICT,
  RELIEF_CIRCUIT,
  ORCHARD_AT_LOW_TIDE,
];

describe("action-runtime estate acceptance", () => {
  it("compiles and clears every bundled challenge through one fixed-step grammar", () => {
    let challengeCount = 0;
    const receiptDigests = new Set<string>();
    for (const arc of ESTATE) {
      for (const challenge of arc.challenges) {
        challengeCount += 1;
        const spec = compileActionEncounter(arc, challenge);
        const seed = actionSeed(0x5eed_1234, 2, challenge.id, null);
        const { trace, state } = buildCompetentTrace(spec, seed);
        expect(state.result?.outcome, `${arc.meta.id}/${challenge.id}`).toBe("success");
        expect(spec.tickRate).toBe(30);
        expect(spec.objectives.map((objective) => objective.id)).toHaveLength(new Set(spec.objectives.map((objective) => objective.id)).size);
        expect(Math.max(...spec.objectives.map((objective) => objective.enemyCount))).toBeLessThanOrEqual(12);
        expect(trace.reduce((sum, run) => sum + run.ticks, 0)).toBe(state.result?.totalTicks);

        const receipt = buildActionReceipt({
          arc,
          challenge,
          cycle: 2,
          orgSeed: 0x5eed_1234,
          controlledAgentId: "operator",
          partyAgentIds: ["operator"],
          trace,
        });
        expect(verifyActionReceipt({
          arc,
          challenge,
          cycle: 2,
          orgSeed: 0x5eed_1234,
          partyAgentIds: ["operator"],
          receipt,
        }).receipt).toEqual(receipt);
        receiptDigests.add(receipt.receiptDigest);
      }
    }
    expect(challengeCount).toBe(48);
    expect(receiptDigests.size).toBe(challengeCount);
  });

  it("keeps the low-power law bounded to integers, 30 Hz, and twelve active enemies per wave", () => {
    for (const arc of ESTATE) {
      for (const challenge of arc.challenges) {
        const spec = compileActionEncounter(arc, challenge);
        const numericLaw = [
          spec.tickRate,
          spec.maxTicks,
          spec.arena.radius,
          spec.player.maxHealth,
          spec.player.radius,
          spec.player.movePerTick,
          spec.player.dodgePerTick,
          ...spec.player.attacks.flatMap((attack) => [
            attack.startupTicks,
            attack.activeTicks,
            attack.recoveryTicks,
            attack.damage,
            attack.range,
            attack.coneNumerator,
            attack.coneDenominator,
            attack.knockback,
          ]),
          ...Object.values(spec.enemyLaws).flatMap((enemy) => [
            enemy.maxHealth,
            enemy.radius,
            enemy.movePerTick,
            enemy.attackRange,
            enemy.attackDamage,
            enemy.telegraphTicks,
            enemy.activeTicks,
            enemy.recoveryTicks,
            enemy.staggerTicks,
          ]),
        ];
        expect(numericLaw.every(Number.isSafeInteger)).toBe(true);
        expect(spec.tickRate).toBe(30);
        expect(spec.objectives.every((objective) => objective.enemyCount <= 12)).toBe(true);
      }
    }
  });
});
