import { useState } from "react";
import type { DramaCard, Organization } from "../../engine/types.js";
import { resolveDramaCard } from "../../engine/drama.js";

interface Props {
  org: Organization;
  setOrg: (o: Organization) => void;
  cycle: number;
}

export function DramaScreen({ org, setOrg, cycle }: Props): JSX.Element {
  const [openIdx, setOpenIdx] = useState(0);
  const queue = org.dramaQueue;
  const card = queue[openIdx] ?? null;

  const resolve = (optionId: string) => {
    if (!card) return;
    const { org: next } = resolveDramaCard(org, card.id, optionId, cycle);
    setOrg(next);
    if (openIdx >= next.dramaQueue.length) setOpenIdx(Math.max(0, next.dramaQueue.length - 1));
  };

  return (
    <div className="screen">
      {queue.length === 0 ? (
        <div className="empty">All quiet for now.</div>
      ) : (
        <>
          <div className="row between" style={{ marginBottom: 12 }}>
            <div>
              <div className="report-meta" style={{ marginBottom: 2 }}>Council · Cycle {String(cycle).padStart(2, "0")}</div>
              <div className="report-headline" style={{ fontSize: 24 }}>
                {queue.length === 1 ? "One Decision" : `${numberWord(queue.length)} Decisions`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
              <span className="agent-meta" style={{ marginRight: 8 }}>Pending</span>
              {queue.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 18,
                    height: 18,
                    background: i === openIdx ? "var(--accent)" : "var(--ink)",
                    cursor: "pointer",
                  }}
                  onClick={() => setOpenIdx(i)}
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
              onResolve={resolve}
            />
          )}
        </>
      )}

      {org.precedents.length > 0 && (
        <>
          <div className="audit-section">Precedent · Last {Math.min(10, org.precedents.length)} Reward Decisions</div>
          <div className="precedent-strip">
            {org.precedents.slice(-10).map((p, i) => {
              const letter = p.decisionBasis === "merit" ? "M"
                : p.decisionBasis === "seniority" ? "S"
                : p.decisionBasis === "need" ? "N"
                : p.decisionBasis === "rotation" ? "R"
                : "?";
              return (
                <div key={i} className={`p-cell ${p.decisionBasis}`}>{letter}</div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CouncilCard({
  card,
  index,
  total,
  org,
  onResolve,
}: {
  card: DramaCard;
  index: number;
  total: number;
  org: Organization;
  onResolve: (optionId: string) => void;
}): JSX.Element {
  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: "14px 14px 0" }}>
        <div className="row between">
          <span className="report-meta" style={{ margin: 0 }}>
            Evidence / {card.triggerType.replace(/_/g, " ")}
          </span>
          <span className="agent-meta">Card {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}</span>
        </div>

        <div className="report-headline" style={{ fontSize: 22, margin: "8px 0" }}>
          {formatCardHeadline(card)}
        </div>

        <p style={{ fontFamily: "var(--serif)", fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 12 }}>
          {card.narrativeText}
        </p>
      </div>

      <div style={{ borderTop: "1px solid var(--rule)" }}>
        {card.options.map((opt) => {
          const agentsInvolved = card.agentsInvolved.map((id) => org.agents[id]?.name ?? id);

          return (
            <div key={opt.id} style={{ padding: 14, borderBottom: "1px solid var(--rule)" }}>
              <div className="row" style={{ gap: 12, marginBottom: 8 }}>
                {agentsInvolved.length > 0 && (
                  <div className="portrait small">
                    {(org.agents[card.agentsInvolved[0] ?? ""]?.name ?? "??").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div className="agent-name" style={{ fontSize: 14 }}>{opt.label}</div>
                </div>
              </div>

              {opt.effects.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <span className="badge role" style={{ marginRight: 6 }}>Visible</span>
                  <span style={{ fontFamily: "var(--serif)", fontSize: 13, color: "var(--ink-2)" }}>
                    {opt.effects.map((e) => `${e.value >= 0 ? "+" : ""}${e.value} ${e.type} on ${org.agents[e.target]?.name ?? e.target}`).join("; ")}
                  </span>
                </div>
              )}

              {opt.hiddenEffects.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <span className="badge pending" style={{ marginRight: 6 }}>Hidden</span>
                  <span style={{ fontFamily: "var(--serif)", fontSize: 13, color: "var(--dim)", fontStyle: "italic" }}>
                    {opt.hiddenEffects.length} hidden consequence{opt.hiddenEffects.length > 1 ? "s" : ""}
                  </span>
                </div>
              )}

              <button
                className="primary"
                style={{ marginTop: 4 }}
                onClick={() => onResolve(opt.id)}
              >
                {opt.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatCardHeadline(card: DramaCard): JSX.Element {
  const type = card.triggerType;
  if (type.includes("reward")) return <>{card.narrativeText.split(".")[0]}.</>;
  if (type.includes("relationship")) return <>Relationship shift.</>;
  if (type.includes("affliction")) return <>Stress <span className="accent">threshold</span> hit.</>;
  if (type.includes("morale")) return <>Morale <span className="accent">extreme</span>.</>;
  if (type.includes("precedent")) return <>Precedent <span className="accent">violation</span>.</>;
  return <>{type.replace(/_/g, " ")}.</>;
}

function numberWord(n: number): string {
  const words = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  return words[n] ?? String(n);
}
