import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const COACH_KEY = "axm-arc:coach-done";

type Tab = "Roster" | "Assign" | "Drama" | "Base" | "Reports";

interface CoachCard {
  title: string;
  body: string;
  tab: Tab;
}

function makeCards(vetName: string, recName: string): CoachCard[] {
  const vet = vetName.split(" ")[0]!;
  const rec = recName.split(" ")[0]!;
  return [
    {
      tab: "Drama",
      title: "SOMETHING ALREADY HAPPENED",
      body: `${vet} and ${rec} are both skirmishers. ${vet} has history. ${rec} arrived with ambition. The tension is already there — and a decision about them is queued before you've run a single contract.`,
    },
    {
      tab: "Drama",
      title: "DRAMA COMES FIRST",
      body: `One card in the queue. Two options, real stat effects. Visible effects apply immediately — hidden effects surface later. You can't advance to the next cycle until the queue is clear.`,
    },
    {
      tab: "Assign",
      title: "THEN ASSIGN AND ADVANCE",
      body: `Pick a contract — start with The Cellar. Slot your agents. You have 2 lockout tokens this cycle. When the queue is clear and agents are slotted, hit Advance Cycle.`,
    },
    {
      tab: "Reports",
      title: "READ THE FIELD REPORT",
      body: `After the cycle runs, the Field Report shows stress gains, loot drops, and any new drama cards. That report is the engine showing you what happened. It's the whole point.`,
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
  setTab,
}: {
  onDismiss: () => void;
  skirmisherNames: [string, string];
  setTab: (tab: Tab) => void;
}): JSX.Element {
  const [step, setStep] = useState(0);
  const CARDS = makeCards(skirmisherNames[0], skirmisherNames[1]);
  const card = CARDS[step]!;
  const isLast = step === CARDS.length - 1;

  // Navigate to the relevant tab when each card is shown
  useEffect(() => {
    setTab(card.tab);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

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
          {isLast ? "Let's go" : "Next →"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
