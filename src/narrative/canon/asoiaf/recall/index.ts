import {
  buildCanonRecallEstateManifest,
  queryCanonRecallCandidates,
  validateCanonRecallEstate,
  type CanonRecallQuery,
} from "../../recall/index.js";
import {
  ASOIAF_MODEL_RECALL_PACKETS,
  ASOIAF_RECALL_SOURCE_HINTS,
} from "./registry.js";

export {
  ASOIAF_MODEL_RECALL_PACKETS,
  ASOIAF_RECALL_SOURCE_HINTS,
} from "./registry.js";

export const ASOIAF_MODEL_RECALL_MANIFEST = buildCanonRecallEstateManifest(
  ASOIAF_MODEL_RECALL_PACKETS,
  ASOIAF_RECALL_SOURCE_HINTS,
);

export const ASOIAF_MODEL_RECALL_FINDINGS = validateCanonRecallEstate(
  ASOIAF_MODEL_RECALL_PACKETS,
  ASOIAF_RECALL_SOURCE_HINTS,
);

export function queryAsoiafModelRecall(query: CanonRecallQuery) {
  return queryCanonRecallCandidates(ASOIAF_MODEL_RECALL_PACKETS, query);
}
