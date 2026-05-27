export type BlockerCode = "drama_unresolved" | "rewards_pending";

export interface AdvanceBlocker {
  code: BlockerCode;
  message: string;
}

export function getAdvanceBlockers(opts: {
  dramaQueueCount: number;
  pendingRewardChoicesCount: number;
  rewardDecisionsCount: number;
}): AdvanceBlocker[] {
  const blockers: AdvanceBlocker[] = [];

  if (opts.dramaQueueCount > 0) {
    blockers.push({
      code: "drama_unresolved",
      message: `Resolve ${opts.dramaQueueCount} drama card${opts.dramaQueueCount === 1 ? "" : "s"} before advancing.`,
    });
  }

  if (opts.pendingRewardChoicesCount > opts.rewardDecisionsCount) {
    const remaining = opts.pendingRewardChoicesCount - opts.rewardDecisionsCount;
    blockers.push({
      code: "rewards_pending",
      message: `Resolve ${remaining} pending reward decision${remaining === 1 ? "" : "s"} in Reports.`,
    });
  }

  return blockers;
}

export function isAdvanceBlocked(blockers: AdvanceBlocker[]): boolean {
  return blockers.length > 0;
}
