import type { TriagedDrama } from "../../engine/drama-triage.js";

/** Highest-priority badge for the Drama tab. Blocking nags (accent); inbox
 *  informs (muted); ambient NEVER badges — it's summarized by design, not a
 *  demand. Returns null when nothing warrants a badge. */
export function dramaTabBadge(t: TriagedDrama):
  | { label: string; tone: "blocking" | "inbox" }
  | null {
  if (t.blocking.length > 0) return { label: String(t.blocking.length), tone: "blocking" };
  if (t.inbox.length > 0) return { label: String(t.inbox.length), tone: "inbox" };
  return null;
}

/** Reports tab badge: unresolved reward dockets nag (accent); otherwise a
 *  fresh report set shows NEW. Returns null when nothing's pending. */
export function reportsTabBadge(opts: {
  reportCount: number;
  pendingRewardChoices: number;
  resolvedRewardDecisions: number;
}): { label: string; tone: "blocking" | "new" } | null {
  const unresolved = opts.pendingRewardChoices - opts.resolvedRewardDecisions;
  if (unresolved > 0) return { label: String(unresolved), tone: "blocking" };
  if (opts.reportCount > 0) return { label: "NEW", tone: "new" };
  return null;
}
