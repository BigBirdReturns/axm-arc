import { useEffect, useState } from "react";

type Tab = "Roster" | "Assign" | "Drama" | "Base" | "Reports";

const TUTORIAL_KEY = "axm-arc:tutorial:v1";

interface Step {
  message: string;
  tab: Tab;
  pulseTab?: Tab;
  pulseAdvance?: boolean;
}

const STEPS: Step[] = [
  {
    message: "A rivalry is already brewing. Resolve the drama card below.",
    tab: "Drama",
  },
  {
    message:
      "Good. Now go to Assign — use the recommended roster and read why each check passes or fails.",
    tab: "Assign",
    pulseTab: "Assign",
  },
  {
    message:
      "Agents slotted. If the readout says Good or Risky, hit Advance Cycle. If it says Not ready, build Training or adjust the roster.",
    tab: "Assign",
    pulseAdvance: true,
  },
  {
    message:
      "Your first Field Report. The loop is contract → report → loot/base upgrade → harder contract.",
    tab: "Reports",
  },
];

export function deriveTutorialStep(
  active: boolean,
  dramaQueueLength: number,
  assignmentCount: number,
  cycle: number,
  reportCount: number,
): number | null {
  if (!active) return null;
  if (dramaQueueLength > 0) return 0;
  if (cycle === 0 && assignmentCount === 0) return 1;
  if (cycle === 0 && assignmentCount > 0) return 2;
  if (cycle > 0 && reportCount > 0) return 3;
  return null;
}

export function useTutorial() {
  const [active, setActive] = useState(() => {
    try {
      return localStorage.getItem(TUTORIAL_KEY) === "active";
    } catch {
      return false;
    }
  });

  const start = () => {
    try {
      localStorage.setItem(TUTORIAL_KEY, "active");
    } catch {
      /* noop */
    }
    setActive(true);
  };

  const dismiss = () => {
    try {
      localStorage.setItem(TUTORIAL_KEY, "done");
    } catch {
      /* noop */
    }
    setActive(false);
  };

  return { active, start, dismiss };
}

export function tutorialPulseTab(step: number | null): Tab | null {
  if (step === null) return null;
  return STEPS[step]?.pulseTab ?? null;
}

export function tutorialPulseAdvance(step: number | null): boolean {
  if (step === null) return false;
  return STEPS[step]?.pulseAdvance ?? false;
}

export function TutorialGuide({
  step,
  setTab,
  onDismiss,
}: {
  step: number;
  setTab: (tab: Tab) => void;
  onDismiss: () => void;
}): JSX.Element | null {
  const s = STEPS[step];
  if (!s) return null;

  const [prevStep, setPrevStep] = useState(step);

  // Auto-navigate to the relevant tab when advancing to a new step
  useEffect(() => {
    if (step !== prevStep) {
      setTab(s.tab);
      setPrevStep(step);
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate on first mount too
  useEffect(() => {
    setTab(s.tab);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="tutorial-nudge">
      <div className="tutorial-step">
        {step + 1}/{STEPS.length}
      </div>
      <span className="tutorial-msg">{s.message}</span>
      <button className="tutorial-skip" onClick={onDismiss}>
        skip
      </button>
    </div>
  );
}
