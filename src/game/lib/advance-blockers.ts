import { t } from "../../i18n/index.js";

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
      message: t("blockers.dramaCards", { count: opts.dramaQueueCount }),
    });
  }

  if (opts.pendingRewardChoicesCount > opts.rewardDecisionsCount) {
    const remaining = opts.pendingRewardChoicesCount - opts.rewardDecisionsCount;
    blockers.push({
      code: "rewards_pending",
      message: t("blockers.rewardDecisions", { count: remaining }),
    });
  }

  return blockers;
}

export function isAdvanceBlocked(blockers: AdvanceBlocker[]): boolean {
  return blockers.length > 0;
}
