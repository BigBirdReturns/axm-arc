import { useState, useEffect } from "react";
import type { Arc, DramaCard, Organization } from "../../engine/types.js";
import type { PendingRewardChoice } from "../../engine/cycle.js";
import { resolveDramaCard } from "../../engine/drama.js";
import { precedentContextSentence } from "../lib/headline.js";
import { agentInitials } from "../lib/ui-helpers.js";

interface Props {
  org: Organization;
  arc: Arc;
  setOrg: (o: Organization) => void;
  cycle: number;
  pendingRewardChoices: PendingRewardChoice[];
}

export function DramaScreen({ org, arc, setOrg, cycle, pendingRewardChoices }: Props): JSX.Element {
  const [openIdx, setOpenIdx] = useState(0);
  const [feedback, setFeedback] = useState<{ label: string; effects: string[] } | null>(null);
  const queue = org.dramaQueue;
  const card = queue[openIdx] ?? null;

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 2500);
    return () => clearTimeout(t);
  }, [feedback]);

  const resolve = (optionId: string) => {
    if (!card) return;
    const option = card.options.find((o) => o.id === optionId);
    const { org: next, revealedHidden } = resolveDramaCard(org, card.id, optionId, cycle);
    const lines = revealedHidden
      .map((e) => {
        if (e.target === "_org_") return `${e.value > 0 ? "+" : ""}${e.value} ${e.type.replace(/_/g, " ")}`;
        const name = org.agents[e.target]?.name?.split(" ")[0];
        return name ? `${e.value > 0 ? "+" : ""}${e.value} ${e.type} · ${name}` : null;
      })
      .filter((s): s is string => s !== null);
    setFeedback({ label: option?.label ?? optionId, effects: lines });
    setOrg(next);
    if (openIdx >= next.dramaQueue.length) setOpenIdx(Math.max(0, next.dramaQueue.length - 1));
  };

  return (
    <div className="screen">
      {feedback && (
        <div className="resolve-toast" onClick={() => setFeedback(null)}>
          <span className="resolve-toast-label">PRECEDENT LOGGED</span>
          <span className="resolve-toast-action">{feedback.label}</span>
          {feedback.effects.length > 0 && (
            <span className="resolve-toast-fx">{feedback.effects.join(" · ")}</span>
          )}
        </div>
      )}
      {queue.length === 0 ? (
        <div className="empty">No drama cards in the queue. Drama generates after each cycle from stress events, relationship shifts, and contract outcomes.</div>
      ) : (
        <>
          <div className="row between" style={{ marginBottom: 16 }}>
            <div>
              <div className="report-meta" style={{ marginBottom: 2 }}>
                Council · Cycle {String(cycle).padStart(2, "0")}
              </div>
              <div className="report-headline" style={{ fontSize: 28, margin: 0 }}>
                {numberWord(queue.length).toUpperCase()} {queue.length === 1 ? "DECISION" : "DECISIONS"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              {queue.map((_, i) => (
                <div
                  key={i}
                  onClick={() => setOpenIdx(i)}
                  style={{
                    width: 20,
                    height: 4,
                    background: i === openIdx ? "var(--accent)" : "var(--rule-dk)",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                />
              ))}
            </div>
          </div>

          {card && (
            <CouncilCard
              card={card}
              index={openIdx}
              total={queue.length}
              org={org}
              arc={arc}
              pendingRewardChoices={pendingRewardChoices}
              onResolve={resolve}
            />
          )}
        </>
      )}

      {org.precedents.length > 0 && (
        <>
          <div className="audit-section" style={{ marginTop: 24 }}>
            Precedent · Last {Math.min(10, org.precedents.length)} Reward Decisions
          </div>
          <div className="precedent-strip">
            {org.precedents.slice(-10).map((p, i) => {
              const letter =
                p.decisionBasis === "merit" ? "M"
                : p.decisionBasis === "seniority" ? "S"
                : p.decisionBasis === "need" ? "N"
                : p.decisionBasis === "rotation" ? "R"
                : "?";
              return <div key={i} className={`p-cell ${p.decisionBasis}`}>{letter}</div>;
            })}
            <div className="p-cell pending">?</div>
          </div>
        </>
      )}
    </div>
  );
}

function CouncilCard({
  card, index, total, org, arc, pendingRewardChoices, onResolve,
}: {
  card: DramaCard; index: number; total: number; org: Organization;
  arc: Arc; pendingRewardChoices: PendingRewardChoice[];
  onResolve: (optionId: string) => void;
}): JSX.Element {
  const isRewardDispute = card.triggerType === "reward_dispute";

  const rewardItem = isRewardDispute
    ? (() => {
        const match = pendingRewardChoices.find((p) =>
          p.eligibleAgentIds.some((id) => card.agentsInvolved.includes(id)),
        );
        return match ? arc.items.find((it) => it.id === match.itemId) ?? null : null;
      })()
    : null;

  const precedentContext = isRewardDispute
    ? precedentContextSentence(org.precedents.filter((p) => p.type === "reward"))
    : null;

  const contextSentence = buildContextSentence(card, org, arc, rewardItem);

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: "16px 16px 0" }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <span className="report-meta" style={{ margin: 0 }}>
            Evidence / {card.triggerType.replace(/_/g, " ")}
          </span>
          <span className="agent-meta">
            Card {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
          </span>
        </div>

        <div className="report-headline" style={{ fontSize: 26, margin: "8px 0 10px" }}>
          {formatCardHeadline(card, rewardItem)}
        </div>

        <p style={{
          fontFamily: "var(--serif)", fontSize: 14, color: "var(--ink-2)",
          lineHeight: 1.65, marginBottom: 12, paddingBottom: 12,
          borderBottom: "1px solid var(--rule)",
        }}>
          {contextSentence}
          {precedentContext && <> {precedentContext}</>}
        </p>
      </div>

      <div>
        {card.options.map((opt, i) => {
          const isDisenchant = opt.id === "disenchant";
          if (isDisenchant) {
            return (
              <div key={opt.id} style={{ borderTop: "1px solid var(--rule)", padding: "12px 16px" }}>
                <button
                  className="secondary"
                  style={{ width: "100%", color: "var(--dim)", borderColor: "var(--rule)" }}
                  onClick={() => onResolve(opt.id)}
                >
                  Disenchant for materials · No drama, no upgrade
                </button>
              </div>
            );
          }

          const agentId = card.agentsInvolved[i % Math.max(card.agentsInvolved.length, 1)];
          const agentObj = agentId ? org.agents[agentId] : undefined;
          const roleObj = agentObj ? arc.roles.find((r) => r.id === agentObj.role) : undefined;
          const upgradeLabel = rewardItem
            ? Object.entries(rewardItem.statBonuses)
                .map(([attr, val]) => `+${val} ${attr.toUpperCase()}`)
                .join(" · ")
            : null;

          return (
            <div key={opt.id} style={{ borderTop: "1px solid var(--rule)", padding: "14px 16px" }}>
              <div className="row" style={{ gap: 10, marginBottom: 12 }}>
                {agentObj && <div className="portrait small">{agentInitials(agentObj.name)}</div>}
                <div style={{ flex: 1 }}>
                  <div className="agent-name" style={{ fontSize: 15 }}>{agentObj?.name ?? opt.label}</div>
                  <div className="agent-meta">
                    {roleObj?.name ?? "Flex"}
                    {agentObj && agentObj.revealedHiddenAttrs > 0
                      ? ` · Loyalty ${agentObj.hiddenAttributes.loyalty} · Ambition ${agentObj.revealedHiddenAttrs > 1 ? agentObj.hiddenAttributes.ambition : "?"}`
                      : ""}
                  </div>
                </div>
                {upgradeLabel && (
                  <div style={{
                    fontFamily: "var(--display)", fontWeight: 800, fontSize: 17,
                    color: "var(--accent)", letterSpacing: "-0.01em",
                    textAlign: "right", flexShrink: 0, lineHeight: 1.1,
                  }}>
                    {upgradeLabel}
                  </div>
                )}
              </div>

              <EffectRows opt={opt} org={org} />

              <button className="primary" style={{ marginTop: 12 }} onClick={() => onResolve(opt.id)}>
                {opt.id === "award_a" || opt.id === "award_b"
                  ? `Award ${agentObj?.name?.split(" ")[0] ?? "agent"}`
                  : opt.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EffectRows({ opt, org }: {
  opt: import("../../engine/types.js").DramaCardOption;
  org: Organization;
}): JSX.Element {
  const basis = inferBasis(opt.id);

  const visibleLines = opt.effects
    .filter((e) => e.type !== "equip_item")
    .map((e) => {
      if (e.target === "_org_") return `${e.value > 0 ? "+" : ""}${e.value} ${e.type} (org-wide)`;
      const name = org.agents[e.target]?.name?.split(" ")[0];
      if (!name) return null;
      return `${e.value > 0 ? "+" : ""}${e.value} ${e.type} on ${name}`;
    })
    .filter((s): s is string => s !== null);

  const hiddenLines = opt.hiddenEffects
    .map((e) => {
      if (e.type.includes("precedent")) return "+precedent consistency · Korrin notices";
      if (e.type.includes("loyalty") && e.value < 0)
        return `-${Math.abs(e.value)} loyalty on three ambitious agents · precedent violation`;
      if (e.type === "affinity_toward_winner") {
        const rawId = e.target.split("_toward_")[0] ?? "";
        const name = org.agents[rawId]?.name?.split(" ")[0];
        return name ? `${e.value < 0 ? "-" : "+"}${Math.abs(e.value)} morale on ${name} (small)` : null;
      }
      const name = org.agents[e.target]?.name?.split(" ")[0];
      return name ? `${e.value > 0 ? "+" : ""}${e.value} ${e.type} on ${name}` : null;
    })
    .filter((s): s is string => s !== null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {basis && (
        <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
          <span className="tag-label basis">BASIS</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.04em" }}>
            {basis}
          </span>
        </div>
      )}
      {visibleLines.length > 0 && (
        <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
          <span className="tag-label visible">VISIBLE</span>
          <span style={{ fontFamily: "var(--serif)", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.4 }}>
            {visibleLines.join(" · ")}
          </span>
        </div>
      )}
      {hiddenLines.length > 0 && (
        <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
          <span className="tag-label hidden">HIDDEN</span>
          <span style={{ fontFamily: "var(--serif)", fontSize: 13, color: "var(--dim)", fontStyle: "italic", lineHeight: 1.4 }}>
            {hiddenLines.join(" · ")}
          </span>
        </div>
      )}
    </div>
  );
}

function formatCardHeadline(
  card: DramaCard,
  item: import("../../engine/types.js").Item | null,
): JSX.Element {
  const type = card.triggerType;
  if (type === "reward_dispute" && item) {
    return <>THE <span style={{ color: "var(--accent)" }}>{item.name.toUpperCase()}</span> DROPPED.</>;
  }
  if (type === "reward_dispute") return <>A REWARD DROPPED.</>;
  if (type === "relationship_transition") return <>RELATIONSHIP <span style={{ color: "var(--accent)" }}>SHIFT</span>.</>;
  if (type === "affliction_threshold") return <>STRESS <span style={{ color: "var(--accent)" }}>THRESHOLD</span> HIT.</>;
  if (type === "morale_extreme") return <>MORALE <span style={{ color: "var(--accent)" }}>EXTREME</span>.</>;
  if (type === "precedent_violation") return <>PRECEDENT <span style={{ color: "var(--accent)" }}>VIOLATION</span>.</>;
  if (type === "prolonged_benching") return <>BENCHING <span style={{ color: "var(--accent)" }}>NOTICED</span>.</>;
  if (type === "rivalrous_perf_gap") return <>RIVALRY <span style={{ color: "var(--accent)" }}>ESCALATING</span>.</>;
  if (type === "bonded_partner_lost") return <>BOND <span style={{ color: "var(--accent)" }}>BROKEN</span>.</>;
  return <>{type.replace(/_/g, " ").toUpperCase()}.</>;
}

function buildContextSentence(
  card: DramaCard,
  org: Organization,
  arc: Arc,
  item: import("../../engine/types.js").Item | null,
): string {
  if (card.triggerType !== "reward_dispute" || !item) return card.narrativeText;

  const eligible = card.agentsInvolved
    .map((id) => org.agents[id])
    .filter((a): a is import("../../engine/types.js").Agent => a !== undefined);

  if (eligible.length < 2) return card.narrativeText;

  const [a, b] = eligible;
  const roleName = arc.roles.find((r) => r.id === a!.role)?.name ?? "agent";
  const parts: string[] = [`Two ${roleName}s are eligible.`];

  const aLast = a!.rewardHistory[a!.rewardHistory.length - 1];
  const bLast = b!.rewardHistory[b!.rewardHistory.length - 1];

  if (!aLast) parts.push(`${a!.name.split(" ")[0]} hasn't received a drop yet.`);
  else if (!bLast) parts.push(`${b!.name.split(" ")[0]} is new and underequipped.`);
  else {
    const aWait = org.cycle - aLast.cycle;
    const bWait = org.cycle - bLast.cycle;
    const longer = aWait > bWait ? a! : b!;
    const wait = Math.max(aWait, bWait);
    if (wait > 2) parts.push(`${longer.name.split(" ")[0]} hasn't received a drop in ${wait} cycles.`);
  }

  return parts.join(" ");
}

function inferBasis(optionId: string): string | null {
  const map: Record<string, string> = {
    award_a: "merit · seniority",
    award_b: "need · rotation",
    promise_rotation: "rotation",
    stay_course: "status quo",
    promote_officer: "favoritism",
    intervene: "direct",
    separate: "separation",
    let_it_play: "non-intervention",
    rest_treatment: "welfare",
    push_through: "output priority",
    bench_indefinitely: "removal",
    acknowledge: "recognition",
    private_talk: "direct",
    ignore: "non-intervention",
    explain: "transparency",
    double_down: "authority",
    revert: "consistency",
    acknowledge_winner: "merit signal",
    mentor_pair: "development",
    ignore_gap: "non-intervention",
    memorial: "acknowledgment",
    new_assignment: "distraction",
    leave_of_absence: "welfare",
  };
  return map[optionId] ?? null;
}

function numberWord(n: number): string {
  const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  return words[n] ?? String(n);
}
