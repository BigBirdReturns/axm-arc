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
      <CheckItem ok={dramaOk} label={dramaOk ? "Drama resolved" : `${dramaCount} drama unresolved`} />
      <CheckItem ok={rewardsOk} label={rewardsOk ? "Rewards resolved" : `${rewardsTotal - rewardsResolved} reward${rewardsTotal - rewardsResolved === 1 ? "" : "s"} pending`} />
      <CheckItem ok={assignOk} label={assignOk ? `${assignmentCount} contract${assignmentCount === 1 ? "" : "s"} queued` : "No contracts assigned"} />
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
