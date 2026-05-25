import { useState } from "react";

const COACH_KEY = "axm-arc:coach-done";

const CARDS = [
  {
    title: "YOU RUN THIS GUILD",
    body: "Six agents. Each with stats you can see, traits you can’t, and opinions about each other. Tap anyone on the Roster to learn what you know about them.",
  },
  {
    title: "CONTRACTS COST TOKENS",
    body: "Go to Assign. Pick a contract. Slot your roster. Each run costs 1 lockout token — you get 2 per cycle, so choose carefully.",
  },
  {
    title: "THE ENGINE RESOLVES",
    body: "Hit Advance Cycle. The engine runs every check deterministically. Same roster, same seed, same result. You’ll see what happened in the Field Report.",
  },
  {
    title: "DRAMA IS MECHANICAL",
    body: "Stress cascades. Relationships shift. Drama cards fire. These aren’t flavor — they have stat effects. Resolve them before you can advance again.",
  },
];

export function useCoachDone(): [boolean, () => void] {
  const [done, setDone] = useState(() => {
    try {
      return localStorage.getItem(COACH_KEY) === "1";
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    try {
      localStorage.setItem(COACH_KEY, "1");
    } catch {
      /* noop */
    }
    setDone(true);
  };

  return [done, dismiss];
}

export function CoachOverlay({ onDismiss }: { onDismiss: () => void }): JSX.Element {
  const [step, setStep] = useState(0);
  const card = CARDS[step]!;
  const isLast = step === CARDS.length - 1;

  const advance = () => {
    if (isLast) {
      onDismiss();
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="coach-backdrop" onClick={advance}>
      <div className="coach-card" onClick={(e) => e.stopPropagation()}>
        <div className="coach-step">
          {step + 1}/{CARDS.length}
        </div>
        <h2 className="coach-title">{card.title}</h2>
        <p className="coach-body">{card.body}</p>
        <button className="primary accent" onClick={advance}>
          {isLast ? "Got it" : "Next"}
        </button>
      </div>
    </div>
  );
}
