import type {
  CanonRecallPacket,
  CanonRecallSourceHint,
} from "../../recall/index.js";
import coreEntities from "./data/core-entities.json";
import lineageClaims from "./data/lineage-claims.json";
import chronologyGeography from "./data/chronology-geography.json";
import actorKnowledge from "./data/actor-knowledge.json";
import materialLogistics from "./data/material-logistics.json";
import magicPhysics from "./data/magic-physics.json";
import narrativeFunctions from "./data/narrative-functions.json";
import adaptationDeltas from "./data/adaptation-deltas.json";
import endgameCoordinates from "./data/endgame-coordinates.json";
import smallfolkSystems from "./data/smallfolk-systems.json";
import sourceHints from "./data/source-hints.json";

export const ASOIAF_MODEL_RECALL_PACKETS = [
  coreEntities,
  lineageClaims,
  chronologyGeography,
  actorKnowledge,
  materialLogistics,
  magicPhysics,
  narrativeFunctions,
  adaptationDeltas,
  endgameCoordinates,
  smallfolkSystems,
] as unknown as CanonRecallPacket[];

export const ASOIAF_RECALL_SOURCE_HINTS =
  sourceHints as CanonRecallSourceHint[];
