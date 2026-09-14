import { validateArc } from "../engine/schema.js";
import {
  RUNTIME_FAMILY_EXTENSION_KEY,
  RUNTIME_FAMILY_FORMAT,
} from "../engine/runtime-family.js";
import {
  STRATEGY_BOARD_PROGRAM_EXTENSION_KEY,
  STRATEGY_BOARD_PROGRAM_FORMAT,
  type StrategyBoardProgram,
} from "../engine/strategy-board/program.js";
import {
  STRATEGY_BOARD_DRIVER_EXTENSION_KEY,
  STRATEGY_BOARD_DRIVER_FORMAT,
  type StrategyBoardDriverContract,
} from "../engine/strategy-board/driver.js";
import { KIND_GODS_OF_ILYON } from "./kind-gods-of-ilyon.js";

export const ILYON_CROWN_TIDES_PROGRAM: StrategyBoardProgram = {
  format: STRATEGY_BOARD_PROGRAM_FORMAT,
  definition: {
    id: "ilyon-crown-tides-board",
    name: "Ilyon: Crown Tides",
    description: "Keep the cure alive long enough to make it refusible before Benefactor integration turns relief into sovereignty.",
    seatCountRange: { min: 2, max: 2 },
    resources: [
      { id: "capacity", name: "Capacity", description: "Deployable people, ships, maintenance time, and political attention." },
      { id: "care", name: "Care", description: "Lives kept stable while the constitutional fight continues." },
      { id: "evidence", name: "Evidence", description: "Publicly defensible proof of dependency and Benefactor intent." },
      { id: "refusal", name: "Refusal Capacity", description: "Services Ilyon can keep operating after saying no." },
      { id: "integration", name: "Integration Lock", description: "How much indispensable infrastructure now depends on one Benefactor system." },
    ],
    doctrines: [
      {
        id: "uncrowned-compact",
        name: "Uncrowned Compact",
        description: "Keep people alive while making the systems that save them locally refusible.",
        startingResources: [
          { resourceId: "capacity", amount: 9 },
          { resourceId: "care", amount: 3 },
          { resourceId: "evidence", amount: 1 },
          { resourceId: "refusal", amount: 0 },
          { resourceId: "integration", amount: 0 },
        ],
        permittedActionIds: ["stabilize-locally", "fork-the-cure", "publish-dependency", "convene-ocean"],
      },
      {
        id: "benefactor-mission",
        name: "Final Humanity Benefactors",
        description: "Save lives quickly enough that one interoperable order becomes the only responsible choice.",
        startingResources: [
          { resourceId: "capacity", amount: 9 },
          { resourceId: "care", amount: 4 },
          { resourceId: "evidence", amount: 0 },
          { resourceId: "refusal", amount: 0 },
          { resourceId: "integration", amount: 2 },
        ],
        permittedActionIds: ["standardize-care", "bind-infrastructure", "mission-logistics"],
      },
    ],
    spaces: [
      { id: "confluence", name: "Confluence of Tides", type: "start", region: "council", adjacentSpaceIds: ["fever-ward", "grain-harbor", "free-observatory"] },
      { id: "fever-ward", name: "Fever Wards", type: "asset", region: "living-shoals", adjacentSpaceIds: ["confluence", "integration-spine"], assetId: "cure-relay" },
      { id: "grain-harbor", name: "Grain Harbor", type: "asset", region: "living-shoals", adjacentSpaceIds: ["confluence", "integration-spine"], assetId: "harvest-grid" },
      { id: "free-observatory", name: "Free Observatory", type: "asset", region: "outer-shoals", adjacentSpaceIds: ["confluence", "deep-tide"], assetId: "archive-array" },
      { id: "deep-tide", name: "Deep-Tide Embassy", type: "asset", region: "outer-shoals", adjacentSpaceIds: ["free-observatory", "integration-spine"], assetId: "reef-listener" },
      { id: "integration-spine", name: "Integration Spine", type: "asset", region: "benefactor-mesh", adjacentSpaceIds: ["fever-ward", "grain-harbor", "deep-tide"], assetId: "interop-spine" },
    ],
    controlAssets: [
      {
        id: "cure-relay", name: "Cure Relay", description: "The daily chain that keeps the fever wards alive.",
        sitedOnSpaceId: "fever-ward", ownershipModel: "buyable", effectScope: "owner",
        acquisitionCost: { resourceId: "capacity", amount: 2 },
        income: { resourceId: "care", amountPerQuarter: 1 },
        toll: { resourceId: "capacity", amount: 1, chargedWhen: "nonOwnerOccupant", eventKind: "tollPayment" },
      },
      {
        id: "harvest-grid", name: "Harvest Grid", description: "Port routing, crop forecasts, and preserved food stocks across the inhabited shoals.",
        sitedOnSpaceId: "grain-harbor", ownershipModel: "buyable", effectScope: "owner",
        acquisitionCost: { resourceId: "capacity", amount: 2 },
        income: { resourceId: "capacity", amountPerQuarter: 1 },
        toll: { resourceId: "capacity", amount: 1, chargedWhen: "nonOwnerOccupant", eventKind: "tollPayment" },
      },
      {
        id: "archive-array", name: "Dead-Star Archive Array", description: "The independent telescope and custody chain for the neighboring-system evidence.",
        sitedOnSpaceId: "free-observatory", ownershipModel: "buyable", effectScope: "owner",
        acquisitionCost: { resourceId: "capacity", amount: 2 },
        income: { resourceId: "evidence", amountPerQuarter: 1 },
        toll: { resourceId: "capacity", amount: 1, chargedWhen: "nonOwnerOccupant", eventKind: "tollPayment" },
      },
      {
        id: "reef-listener", name: "Reef Listener", description: "A deliberately incomplete translation layer that gives deep ecologies standing without flattening them into one voice.",
        sitedOnSpaceId: "deep-tide", ownershipModel: "buyable", effectScope: "owner",
        acquisitionCost: { resourceId: "capacity", amount: 2 },
        income: { resourceId: "refusal", amountPerQuarter: 1 },
        toll: { resourceId: "capacity", amount: 1, chargedWhen: "nonOwnerOccupant", eventKind: "tollPayment" },
      },
      {
        id: "interop-spine", name: "Interoperability Spine", description: "The single routing layer that can make medicine, harvests, navigation, and governance inseparable.",
        sitedOnSpaceId: "integration-spine", ownershipModel: "buyable", effectScope: "owner",
        acquisitionCost: { resourceId: "capacity", amount: 3 },
        income: { resourceId: "integration", amountPerQuarter: 1 },
        toll: { resourceId: "capacity", amount: 1, chargedWhen: "nonOwnerOccupant", eventKind: "tollPayment" },
      },
    ],
    auctions: [],
    programActions: [
      {
        id: "stabilize-locally", name: "Stabilize locally", description: "Spend scarce local capacity to keep wards and food routes alive without adding another dependency.",
        target: "self", honoredBy: "programAction",
        cost: [{ resourceId: "capacity", delta: -1, eventKind: "programActionCost" }],
        effect: { summary: "Gain 2 Care.", mutations: [{ resourceId: "care", delta: 2, eventKind: "programActionYield" }] },
      },
      {
        id: "fork-the-cure", name: "Fork the cure", description: "Duplicate diagnostics and supply knowledge locally, accepting short-term strain to create a real right of refusal.",
        target: "self", honoredBy: "programAction",
        cost: [{ resourceId: "capacity", delta: -2, eventKind: "programActionCost" }],
        effect: {
          summary: "Trade 1 Care for 3 Refusal Capacity.",
          mutations: [
            { resourceId: "care", delta: -1, eventKind: "programActionYield" },
            { resourceId: "refusal", delta: 3, eventKind: "programActionYield" },
          ],
        },
      },
      {
        id: "publish-dependency", name: "Publish the dependency map", description: "Make every indispensable service, owner, failure mode, and possible substitute visible to the public.",
        target: "self", honoredBy: "programAction",
        cost: [{ resourceId: "capacity", delta: -1, eventKind: "programActionCost" }],
        effect: { summary: "Gain 2 Evidence.", mutations: [{ resourceId: "evidence", delta: 2, eventKind: "programActionYield" }] },
      },
      {
        id: "convene-ocean", name: "Convene the ocean", description: "Spend verified evidence to give incompatible deep ecologies political standing without inventing one planetary voice.",
        target: "self", honoredBy: "programAction",
        cost: [{ resourceId: "evidence", delta: -2, eventKind: "programActionCost" }],
        effect: { summary: "Convert 2 Evidence into 3 Refusal Capacity.", mutations: [{ resourceId: "refusal", delta: 3, eventKind: "programActionYield" }] },
      },
      {
        id: "standardize-care", name: "Standardize care", description: "Improve treatment by moving diagnostics, logistics, and records onto one Benefactor standard.",
        target: "self", honoredBy: "programAction",
        cost: [{ resourceId: "capacity", delta: -2, eventKind: "programActionCost" }],
        effect: {
          summary: "Gain 2 Care and 2 Integration Lock.",
          mutations: [
            { resourceId: "care", delta: 2, eventKind: "programActionYield" },
            { resourceId: "integration", delta: 2, eventKind: "programActionYield" },
          ],
        },
      },
      {
        id: "bind-infrastructure", name: "Bind the infrastructure", description: "Join food, navigation, medicine, and mediation so each service becomes safer and harder to refuse independently.",
        target: "self", honoredBy: "programAction",
        cost: [{ resourceId: "capacity", delta: -2, eventKind: "programActionCost" }],
        effect: {
          summary: "Gain 3 Integration Lock but consume 1 Care during migration.",
          mutations: [
            { resourceId: "care", delta: -1, eventKind: "programActionYield" },
            { resourceId: "integration", delta: 3, eventKind: "programActionYield" },
          ],
        },
      },
      {
        id: "mission-logistics", name: "Replenish the mission", description: "Pause political integration long enough to restore ships, technicians, and replacement stock.",
        target: "self", honoredBy: "programAction",
        cost: [],
        effect: { summary: "Gain 3 Capacity.", mutations: [{ resourceId: "capacity", delta: 3, eventKind: "programActionYield" }] },
      },
    ],
    interferences: [
      {
        id: "public-audit", name: "Public audit", description: "Force the Benefactors to expose the dependency created by the action they just took.",
        interferableActionIds: ["standardize-care", "bind-infrastructure"],
        honoredBy: "reactionInterference",
        cost: [{ resourceId: "evidence", delta: -1, eventKind: "interferenceCost" }],
        effect: { summary: "Reduce the active Benefactor seat's Integration Lock by 2.", mutations: [{ resourceId: "integration", delta: -2, eventKind: "programActionYield" }] },
      },
      {
        id: "dependency-leverage", name: "Dependency leverage", description: "Make the immediate human cost of forking an indispensable system impossible to ignore.",
        interferableActionIds: ["fork-the-cure", "convene-ocean"],
        honoredBy: "reactionInterference",
        cost: [{ resourceId: "care", delta: -1, eventKind: "interferenceCost" }],
        effect: { summary: "Reduce the active Uncrowned seat's Refusal Capacity by 1.", mutations: [{ resourceId: "refusal", delta: -1, eventKind: "programActionYield" }] },
      },
      {
        id: "discredit-map", name: "Discredit the map", description: "Turn uncertainty in the dependency audit into a reason to delay public conclusions.",
        interferableActionIds: ["publish-dependency"],
        honoredBy: "reactionInterference",
        cost: [{ resourceId: "capacity", delta: -1, eventKind: "interferenceCost" }],
        effect: { summary: "Reduce the active Uncrowned seat's Evidence by 1.", mutations: [{ resourceId: "evidence", delta: -1, eventKind: "programActionYield" }] },
      },
    ],
    obligations: [],
    milestones: [
      {
        id: "care-without-command", name: "Care without command", description: "Ilyon can keep essential services alive while refusing a single owner.",
        requirements: { resourceThresholds: [{ resourceId: "care", atLeast: 4 }, { resourceId: "refusal", atLeast: 4 }] },
        reward: { mutations: [{ resourceId: "capacity", delta: 1, eventKind: "milestoneReward" }], unlocks: [] },
        contributesToEndingId: "uncrowned-federation",
      },
      {
        id: "public-proof", name: "Public proof", description: "The dependency claim is independently legible and cannot be recalled by either faction.",
        requirements: { resourceThresholds: [{ resourceId: "evidence", atLeast: 4 }], ownedAssetIds: ["archive-array"] },
        reward: { mutations: [{ resourceId: "capacity", delta: 1, eventKind: "milestoneReward" }], unlocks: [] },
        contributesToEndingId: "uncrowned-federation",
      },
      {
        id: "uncrowned-ready", name: "Uncrowned network", description: "The refusal is no longer symbolic: evidence and independently operated systems can survive withdrawal.",
        requirements: { resourceThresholds: [{ resourceId: "refusal", atLeast: 8 }, { resourceId: "evidence", atLeast: 5 }], ownedAssetIds: ["archive-array", "reef-listener"] },
        reward: { mutations: [], unlocks: [] },
        contributesToEndingId: "uncrowned-federation",
      },
      {
        id: "indispensable-grid", name: "Indispensable grid", description: "Benefactor care is materially superior and visibly bound into the systems people rely on.",
        requirements: { resourceThresholds: [{ resourceId: "care", atLeast: 6 }, { resourceId: "integration", atLeast: 6 }], ownedAssetIds: ["cure-relay"] },
        reward: { mutations: [{ resourceId: "capacity", delta: 1, eventKind: "milestoneReward" }], unlocks: [] },
        contributesToEndingId: "planetary-crown",
      },
      {
        id: "crown-ready", name: "Planetary closure", description: "The cure relay and interoperability spine make withdrawal look less like sovereignty than deliberate harm.",
        requirements: { resourceThresholds: [{ resourceId: "integration", atLeast: 10 }], ownedAssetIds: ["cure-relay", "interop-spine"] },
        reward: { mutations: [], unlocks: [] },
        contributesToEndingId: "planetary-crown",
      },
    ],
    endings: [
      {
        id: "uncrowned-federation", name: "Uncrowned Federation",
        description: "Ilyon keeps the benefits of the intervention while no actor retains the power to make them non-refusible.",
        condition: { type: "evidenceOverwhelms", note: "Execution law requires all three Uncrowned milestones." },
        scoringNote: "The player wins by preserving care, public proof, and actual exit capacity together.",
      },
      {
        id: "planetary-crown", name: "Planetary Crown",
        description: "Benefactor integration becomes the only system capable of maintaining the lives and services now built around it.",
        condition: { type: "inevitabilityReached", note: "Execution law requires both Benefactor milestones." },
        scoringNote: "The Benefactor seat wins by making integration materially indispensable before refusal becomes viable.",
      },
    ],
  },
  executionRules: {
    version: 1,
    startSpaceId: "confluence",
    movement: "adjacentInput",
    reactionLimitPerSeat: 1,
    interferenceEffect: "activeSeatMutations",
    obligationDoctrineIds: {},
    endings: [
      { endingId: "uncrowned-federation", milestoneIds: ["care-without-command", "public-proof", "uncrowned-ready"] },
      { endingId: "planetary-crown", milestoneIds: ["indispensable-grid", "crown-ready"] },
    ],
  },
};

export const ILYON_CROWN_TIDES_DRIVER: StrategyBoardDriverContract = {
  format: STRATEGY_BOARD_DRIVER_FORMAT,
  doctrines: [
    { doctrineId: "uncrowned-compact", control: "human" },
    {
      doctrineId: "benefactor-mission",
      control: "automatic",
      movementPriority: ["fever-ward", "integration-spine", "grain-harbor", "confluence", "free-observatory", "deep-tide"],
      buyPriority: ["purchase", "pass"],
      programActionPriority: ["standardize-care", "bind-infrastructure", "mission-logistics"],
      interferencePriority: ["discredit-map", "dependency-leverage"],
    },
  ],
};

export const ILYON_CROWN_TIDES = validateArc({
  ...structuredClone(KIND_GODS_OF_ILYON),
  meta: {
    ...KIND_GODS_OF_ILYON.meta,
    id: "ilyon-crown-tides",
    name: "Ilyon: Crown Tides",
    description: "A two-sided strategy race over whether the systems saving Ilyon remain gifts that can be refused or become the machinery of a Planetary Crown.",
    version: "0.1.0",
    domain: "godscar-strategy",
  },
  extensions: {
    ...structuredClone(KIND_GODS_OF_ILYON.extensions ?? {}),
    [RUNTIME_FAMILY_EXTENSION_KEY]: { format: RUNTIME_FAMILY_FORMAT, family: "strategy-board" },
    [STRATEGY_BOARD_PROGRAM_EXTENSION_KEY]: structuredClone(ILYON_CROWN_TIDES_PROGRAM),
    [STRATEGY_BOARD_DRIVER_EXTENSION_KEY]: structuredClone(ILYON_CROWN_TIDES_DRIVER),
  },
});
