import type { ActionAdjudicationSummary } from "./action/types.js";

declare module "./types.js" {
  interface RunReport {
    /** Exact replayable evidence when the challenge was adjudicated by the
     * engine-owned fixed-step action runtime rather than the statistical resolver. */
    action?: ActionAdjudicationSummary;
  }
}
