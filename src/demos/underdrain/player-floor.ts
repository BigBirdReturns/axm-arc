import { validateArc } from "../../engine/schema.js";
import {
  ACTION_PLAYER_EXTENSION_KEY,
  ACTION_PLAYER_PROFILE_FORMAT,
  type ActionPlayerProfile,
} from "../../engine/action/player-profile.js";
import {
  UNDERDRAIN_CHALLENGE_ID,
  UNDERDRAIN_DRAFT_ARC,
  UNDERDRAIN_SERVICE_CHALLENGE_ID,
} from "./arc.js";

export const UNDERDRAIN_ACTION_PLAYER_PROFILE: ActionPlayerProfile = {
  format: ACTION_PLAYER_PROFILE_FORMAT,
  timingProfiles: {
    forgiving: {
      id: "forgiving",
      label: "Forgiving",
      parryCommitTicks: 8,
      parryActiveTicks: 7,
      parryRecoveryTicks: 5,
      dodgeInvulnerableTicks: 7,
      enemyTelegraphScalePermille: 1400,
    },
    standard: {
      id: "standard",
      label: "Standard",
      parryCommitTicks: 5,
      parryActiveTicks: 4,
      parryRecoveryTicks: 7,
      dodgeInvulnerableTicks: 6,
      enemyTelegraphScalePermille: 1150,
    },
    precision: {
      id: "precision",
      label: "Precision",
      parryCommitTicks: 4,
      parryActiveTicks: 2,
      parryRecoveryTicks: 9,
      dodgeInvulnerableTicks: 6,
      enemyTelegraphScalePermille: 1000,
    },
  },
  encounters: {
    [UNDERDRAIN_SERVICE_CHALLENGE_ID]: {
      defaultTimingProfileId: "forgiving",
      allowedTimingProfileIds: ["forgiving"],
    },
    [UNDERDRAIN_CHALLENGE_ID]: {
      defaultTimingProfileId: "forgiving",
      allowedTimingProfileIds: ["forgiving", "standard", "precision"],
    },
  },
  learning: {
    parry: [
      {
        id: "underdrain-parry-teach",
        mechanic: "parry",
        stage: "teach",
        challengeId: UNDERDRAIN_CHALLENGE_ID,
        objectiveId: "diagnose-spore-valves",
        timingProfileId: "forgiving",
        mandatory: false,
        safeOrLowDamage: true,
        requiredCueIds: [
          "cue.enemy-attack-anticipated",
          "cue.enemy-attack-active",
          "cue.defense-window-opened",
          "cue.defense-window-closed",
          "cue.parry-succeeded",
          "cue.enemy-stagger-started",
          "cue.work-window-opened",
          "cue.work-window-closed",
        ],
        advantage: {
          kind: "work_window",
          source: "parry_stagger",
          minimumTicks: 20,
        },
      },
      {
        id: "underdrain-parry-practice",
        mechanic: "parry",
        stage: "practice",
        challengeId: UNDERDRAIN_CHALLENGE_ID,
        objectiveId: "operate-purge-wheel",
        timingProfileId: "standard",
        mandatory: false,
        safeOrLowDamage: false,
        requiredCueIds: [
          "cue.enemy-attack-anticipated",
          "cue.enemy-attack-active",
          "cue.parry-succeeded",
          "cue.enemy-stagger-started",
          "cue.work-window-opened",
          "cue.mechanism-progress",
        ],
        advantage: {
          kind: "work_window",
          source: "parry_stagger",
          minimumTicks: 16,
        },
      },
      {
        id: "underdrain-parry-master",
        mechanic: "parry",
        stage: "master",
        challengeId: UNDERDRAIN_CHALLENGE_ID,
        objectiveId: "open-crown-sluice",
        timingProfileId: "standard",
        mandatory: true,
        safeOrLowDamage: false,
        requiredCueIds: [
          "cue.enemy-attack-anticipated",
          "cue.enemy-attack-active",
          "cue.parry-succeeded",
          "cue.enemy-stagger-started",
          "cue.work-window-opened",
          "cue.work-window-closed",
          "cue.mechanism-progress",
          "cue.objective-completed",
        ],
        advantage: {
          kind: "work_window",
          source: "parry_stagger",
          minimumTicks: 30,
        },
        alternate: {
          kind: "enemy_recovery",
          minimumTicks: 28,
        },
      },
    ],
  },
};

/** Exact Arc authority used by player-facing receivers. The source UNDERDRAIN
 * cartridge remains available unchanged; this derivative adds only Arc-owned
 * timing, cue, and learning law and therefore receives a new cartridge digest. */
export const UNDERDRAIN_PLAYER_ARC = validateArc({
  ...structuredClone(UNDERDRAIN_DRAFT_ARC),
  extensions: {
    ...structuredClone(UNDERDRAIN_DRAFT_ARC.extensions ?? {}),
    [ACTION_PLAYER_EXTENSION_KEY]: structuredClone(UNDERDRAIN_ACTION_PLAYER_PROFILE),
  },
});

export const UNDERDRAIN_PLAYER_SERVICE_CHALLENGE = UNDERDRAIN_PLAYER_ARC.challenges.find(
  (challenge) => challenge.id === UNDERDRAIN_SERVICE_CHALLENGE_ID,
)!;
export const UNDERDRAIN_PLAYER_PUMP_CHALLENGE = UNDERDRAIN_PLAYER_ARC.challenges.find(
  (challenge) => challenge.id === UNDERDRAIN_CHALLENGE_ID,
)!;
