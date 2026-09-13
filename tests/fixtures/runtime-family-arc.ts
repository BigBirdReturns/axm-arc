import { MINI_ARC } from "./mini-arc.js";
import { validateArc } from "../../src/engine/schema.js";
import { RUNTIME_FAMILY_EXTENSION_KEY, RUNTIME_FAMILY_FORMAT } from "../../src/engine/runtime-family.js";

/** Unrelated organization simulation: no canonical-story or source-plane data. */
export const DISPATCH_RUNTIME_ARC = validateArc({
  ...structuredClone(MINI_ARC),
  meta: { ...MINI_ARC.meta, id: "dispatch-training", name: "Dispatch Training", domain: "logistics", engineVersion: "1.2.0" },
  extensions: {
    [RUNTIME_FAMILY_EXTENSION_KEY]: { format: RUNTIME_FAMILY_FORMAT, family: "encounter-simulation" },
    "dispatch.audit@7": { retained: ["arrival", 12, true, null] },
  },
});
