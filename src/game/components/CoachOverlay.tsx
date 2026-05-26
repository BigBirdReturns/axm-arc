import { useState } from "react";
import { createPortal } from "react-dom";

const COACH_KEY = "axm-arc:coach-done";

function makeCards(vetName: string, recName: string) {
  const vet = vetName.split(" ")[0]!;
  const rec = recName.split(" ")[0]!;
  return [
    {
      title: "SOMETHING ALREADY HAPPENED",
      body: `${vet} and ${rec} are both skirmishers. ${vet} has history. ${rec} arrived with ambition. The tension is already there — and the first decision about them is queued before you've run a single contract.`,
    },
    {
      title: "DRAMA COMES FIRST",
      body: `There's a card in the Drama queue. Two options, real stat effects. You can't advance to the next cycle until the queue is clear. Resolve it, then assign contracts.`,
    },
    {
      title: "ASSIGN AND ADVANCE",
      body: `Go to Assign. Pick a contract — start with The Cellar. Slot your agents. You have 2 lockout tokens this cycle. Hit Advance Cycle when you're ready.`,
    },
    {
      title: "READ THE FIELD REPORT",
      body: `After the cycle runs, go to Reports. Stress gains, loot drops, maybe another drama card. The engine is showing you what happened. That report is the whole point.`,
    },
  ];
}

export function useCoachDone(): [boolean, () => void, () => void] {
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

  const reset = () => {
    try {
      localStorage.removeItem(COACH_KEY);
    } catch {
      /* noop */
    }
    setDone(false);
  };

  return [done, dismiss, reset];
}

export function CoachOverlay({
  onDismiss,
  skirmisherNames,
}: {
  onDismiss: () => void;
  skirmisherNames: [string, string];
}): JSX.Element {
  const [step, setStep] = useState(0);
  const CARDS = makeCards(skirmisherNames[0], skirmisherNames[1]);
  const card = CARDS[step]!;
  const isLast = step === CARDS.length - 1;

  const advance = () => {
    if (isLast) {
      onDismiss();
    } else {
      setStep(step + 1);
    }
  };

  return createPortal(
    <div className="coach-backdrop" onClick={advance}>
      <div className="coach-card" onClick={(e) => e.stopPropagation()}>
        <div className="coach-step">
          {step + 1}/{CARDS.length}
        </div>
        <h2 className="coach-title">{card.title}</h2>
        <p className="coach-body">{card.body}</p>
        <button className="primary accent" onClick={advance}>
          {isLast ? "Let's go" : "Next"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
