import { useState } from "react";
import type { DramaCard, Organization } from "../../engine/types.js";
import { resolveDramaCard } from "../../engine/drama.js";

interface Props {
  org: Organization;
  setOrg: (o: Organization) => void;
  cycle: number;
}

export function DramaScreen({ org, setOrg, cycle }: Props): JSX.Element {
  const [open, setOpen] = useState<DramaCard | null>(null);
  const queue = org.dramaQueue;

  return (
    <div className="screen">
      <h2>Drama ({queue.length})</h2>
      {queue.length === 0 && <div className="empty">All quiet for now.</div>}
      {queue.map((card) => (
        <div key={card.id} className="card clickable" onClick={() => setOpen(card)}>
          <div className="row between">
            <strong>{card.triggerType}</strong>
            <span className="tiny">Cycle {card.cycleGenerated}</span>
          </div>
          <div className="dim" style={{ marginTop: 4 }}>{card.narrativeText}</div>
          <div className="tiny" style={{ marginTop: 6 }}>{card.options.length} options · tap to resolve</div>
        </div>
      ))}
      {open && (
        <DramaCardModal
          card={open}
          onResolve={(optionId) => {
            const { org: next } = resolveDramaCard(org, open.id, optionId, cycle);
            setOrg(next);
            setOpen(null);
          }}
          onCancel={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function DramaCardModal({
  card,
  onResolve,
  onCancel,
}: {
  card: DramaCard;
  onResolve: (optionId: string) => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h3>{card.triggerType}</h3>
          <button className="icon" onClick={onCancel}>Close</button>
        </div>
        <div className="narrative">{card.narrativeText}</div>
        {card.options.map((opt) => (
          <button
            key={opt.id}
            className="secondary"
            style={{ width: "100%", marginTop: 8, textAlign: "left" }}
            onClick={() => onResolve(opt.id)}
          >
            <strong>{opt.label}</strong>
            <div className="tiny" style={{ marginTop: 4 }}>{opt.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
