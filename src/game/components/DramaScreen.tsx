import { useState, useEffect } from "react";
import type { Arc, DramaCard, Organization } from "../../engine/types.js";
import type { PendingRewardChoice } from "../../engine/cycle.js";
import { canApplyDramaEffect, resolveDramaCard } from "../../engine/drama.js";
import { precedentContextSentence } from "../lib/headline.js";
import { CartridgePortrait } from "./CartridgePortrait.js";
import { t, type MessageId } from "../../i18n/index.js";
import { triggerTypeLabel, vocabLabel } from "../../i18n/display.js";
import { MESSAGES } from "../../i18n/messages.js";
import { playArcPresentationCue } from "../lib/sensory-prefs.js";
import { AttendedStamp } from "../../codex/AttendedStamp.js";

interface Props {
  org: Organization;
  arc: Arc;
  setOrg: (o: Organization) => void;
  cycle: number;
  pendingRewardChoices: PendingRewardChoice[];
}

export function dramaResolutionReceiptMessageId(
  precedentsBefore: number,
  precedentsAfter: number,
): "drama.precedentLogged" | "drama.decisionApplied" {
  return precedentsAfter > precedentsBefore ? "drama.precedentLogged" : "drama.decisionApplied";
}

export function DramaScreen({ org, arc, setOrg, cycle, pendingRewardChoices }: Props): JSX.Element {
  const [openIdx, setOpenIdx] = useState(0);
  const [feedback, setFeedback] = useState<{
    label: string;
    effects: string[];
    precedentLogged: boolean;
  } | null>(null);
  const queue = org.dramaQueue;
  const card = queue[openIdx] ?? null;

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 2500);
    return () => clearTimeout(timer);
  }, [feedback]);

  const resolve = (optionId: string) => {
    if (!card) return;
    const option = card.options.find((o) => o.id === optionId);
    const { org: next, appliedVisibleEffects } = resolveDramaCard(org, card.id, optionId, cycle);
    const lines = appliedVisibleEffects
      .map((e) => {
        const delta = `${e.value > 0 ? "+" : ""}${e.value}`;
        if (e.target === "_org_") return `${delta} ${vocabLabel(e.type)}`;
        const name = org.agents[e.target]?.name?.split(" ")[0];
        return name ? `${delta} ${vocabLabel(e.type)} · ${name}` : null;
      })
      .filter((s): s is string => s !== null);
    setFeedback({
      label: option?.label ?? optionId,
      effects: lines,
      precedentLogged: dramaResolutionReceiptMessageId(
        org.precedents.length,
        next.precedents.length,
      ) === "drama.precedentLogged",
    });
    setOrg(next);
    playArcPresentationCue("decision", arc.meta.id);
    if (openIdx >= next.dramaQueue.length) setOpenIdx(Math.max(0, next.dramaQueue.length - 1));
  };

  return (
    <div className="screen">
      {feedback && (
        <div className="resolve-toast" role="status" aria-live="polite" onClick={() => setFeedback(null)}>
          <AttendedStamp show label={t("drama.attended")} />
          <span className="resolve-toast-label">
            {t(feedback.precedentLogged ? "drama.precedentLogged" : "drama.decisionApplied")}
          </span>
          <span className="resolve-toast-action">{feedback.label}</span>
          {feedback.effects.length > 0 && (
            <span className="resolve-toast-fx">{feedback.effects.join(" · ")}</span>
          )}
        </div>
      )}
      {queue.length === 0 ? (
        <div className="empty">{t("drama.empty")}</div>
      ) : (
        <>
          <div className="row between" style={{ marginBottom: 16 }}>
            <div>
              <div className="report-meta" style={{ marginBottom: 2 }}>
                {t("drama.councilCycle", { cycle: String(cycle).padStart(2, "0") })}
              </div>
              <div className="report-headline" style={{ fontSize: 28, margin: 0 }}>
                {t("drama.decisions", { count: queue.length })}
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
            {t("drama.precedentLast", { n: Math.min(10, org.precedents.length) })}
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

  // precedentContextSentence is app-generated narrative (headline.ts); its prose
  // stays English this pass — documented boundary in the catalog header.
  const precedentContext = isRewardDispute
    ? precedentContextSentence(org.precedents.filter((p) => p.type === "reward"))
    : null;

  const contextSentence = buildContextSentence(card, org, arc, rewardItem);

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: "16px 16px 0" }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <span className="report-meta" style={{ margin: 0 }}>
            {t("drama.evidence", { type: triggerTypeLabel(card.triggerType) })}
          </span>
          <span className="agent-meta">
            {t("drama.cardXofY", { x: String(index + 1).padStart(2, "0"), y: String(total).padStart(2, "0") })}
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
                  {t("drama.disenchant")}
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
                {agentObj && <CartridgePortrait arcId={arc.meta.id} roleId={agentObj.role} name={agentObj.name} className="small" />}
                <div style={{ flex: 1 }}>
                  <div className="agent-name" style={{ fontSize: 15 }}>{agentObj?.name ?? opt.label}</div>
                  <div className="agent-meta">
                    {roleObj?.name ?? t("common.flex")}
                    {agentObj && agentObj.revealedHiddenAttrs > 0
                      ? t("drama.hiddenLoyaltyAmbition", {
                          loyalty: agentObj.hiddenAttributes.loyalty,
                          ambition: agentObj.revealedHiddenAttrs > 1 ? agentObj.hiddenAttributes.ambition : "?",
                        })
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
                  ? t("drama.award", { name: agentObj?.name?.split(" ")[0] ?? "agent" })
                  : opt.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function basisLabel(optionId: string): string | null {
  const id = `basis.${optionId}` as MessageId;
  if (MESSAGES.en[id] !== undefined) return t(id);
  return null;
}

function EffectRows({ opt, org }: {
  opt: import("../../engine/types.js").DramaCardOption;
  org: Organization;
}): JSX.Element {
  const basis = basisLabel(opt.id);

  const visibleLines = opt.effects
    .filter((e) => canApplyDramaEffect(org, e))
    .map((e) => {
      const delta = `${e.value > 0 ? "+" : ""}${e.value}`;
      if (e.target === "_org_") return t("drama.orgWide", { delta, type: vocabLabel(e.type) });
      const name = org.agents[e.target]?.name?.split(" ")[0];
      if (!name) return null;
      return t("drama.effectOn", { delta, type: vocabLabel(e.type), name });
    })
    .filter((s): s is string => s !== null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {basis && (
        <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
          <span className="tag-label basis">{t("drama.tagBasis")}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.04em" }}>
            {basis}
          </span>
        </div>
      )}
      {visibleLines.length > 0 && (
        <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
          <span className="tag-label visible">{t("drama.tagVisible")}</span>
          <span style={{ fontFamily: "var(--serif)", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.4 }}>
            {visibleLines.join(" · ")}
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
    // Item name (arc data, verbatim) keeps the accent color; the sentence
    // around it comes from the catalog so word order can differ per locale.
    return <>{t("drama.hlRewardPre")}<span style={{ color: "var(--accent)" }}>{item.name.toUpperCase()}</span>{t("drama.hlRewardPost")}</>;
  }
  if (type === "reward_dispute") return <>{t("drama.hlReward")}</>;
  if (type === "relationship_transition") return <>{t("drama.hlRelationship")}</>;
  if (type === "affliction_threshold") return <>{t("drama.hlAffliction")}</>;
  if (type === "morale_extreme") return <>{t("drama.hlMorale")}</>;
  if (type === "precedent_violation") return <>{t("drama.hlPrecedent")}</>;
  if (type === "prolonged_benching") return <>{t("drama.hlBenching")}</>;
  if (type === "rivalrous_perf_gap") return <>{t("drama.hlRivalry")}</>;
  if (type === "bonded_partner_lost") return <>{t("drama.hlBond")}</>;
  return <>{triggerTypeLabel(type).toUpperCase()}.</>;
}

function buildContextSentence(
  card: DramaCard,
  org: Organization,
  arc: Arc,
  item: import("../../engine/types.js").Item | null,
): string {
  // card.narrativeText is arc DATA — always verbatim.
  if (card.triggerType !== "reward_dispute" || !item) return card.narrativeText;

  const eligible = card.agentsInvolved
    .map((id) => org.agents[id])
    .filter((a): a is import("../../engine/types.js").Agent => a !== undefined);

  if (eligible.length < 2) return card.narrativeText;

  const [a, b] = eligible;
  const roleName = arc.roles.find((r) => r.id === a!.role)?.name ?? "agent";
  const parts: string[] = [t("drama.twoEligible", { role: roleName })];

  const aLast = a!.rewardHistory[a!.rewardHistory.length - 1];
  const bLast = b!.rewardHistory[b!.rewardHistory.length - 1];

  if (!aLast) parts.push(t("drama.noDropYet", { name: a!.name.split(" ")[0]! }));
  else if (!bLast) parts.push(t("drama.newUnderequipped", { name: b!.name.split(" ")[0]! }));
  else {
    const aWait = org.cycle - aLast.cycle;
    const bWait = org.cycle - bLast.cycle;
    const longer = aWait > bWait ? a! : b!;
    const wait = Math.max(aWait, bWait);
    if (wait > 2) parts.push(t("drama.noDropInCycles", { name: longer.name.split(" ")[0]!, n: wait }));
  }

  return parts.join(" ");
}
