import { t } from "../../i18n/index.js";

export function CycleChecklist({ dramaCount, rewardsResolved, rewardsTotal, assignmentCount }: {
  dramaCount: number;
  rewardsResolved: number;
  rewardsTotal: number;
  assignmentCount: number;
}) {
  const dramaOk = dramaCount === 0;
  const rewardsOk = rewardsTotal === 0 || rewardsResolved >= rewardsTotal;
  const assignOk = assignmentCount > 0;

  return (
    <div className="cycle-checklist">
      <CheckItem ok={dramaOk} label={dramaOk ? t("checklist.dramaResolved") : t("checklist.dramaUnresolved", { n: dramaCount })} />
      <CheckItem ok={rewardsOk} label={rewardsOk ? t("checklist.rewardsResolved") : t("checklist.rewardsPending", { n: rewardsTotal - rewardsResolved })} />
      <CheckItem ok={assignOk} label={assignOk ? t("checklist.contractsQueued", { n: assignmentCount }) : t("checklist.noContracts")} />
    </div>
  );
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`check-item${ok ? " ok" : " blocked"}`}>
      <span className="check-mark">{ok ? "✓" : "✗"}</span>
      <span>{label}</span>
    </div>
  );
}
