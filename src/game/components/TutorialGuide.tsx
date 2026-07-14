import { useEffect, useState } from "react";
import { t, type MessageId } from "../../i18n/index.js";

type Tab = "Roster" | "Assign" | "Drama" | "Base" | "Reports";

const TUTORIAL_KEY = "axm-arc:tutorial:v1";

interface Step {
  messageId: MessageId;
  tab: Tab;
  pulseTab?: Tab;
  pulseAdvance?: boolean;
}

const STEPS: Step[] = [
  { messageId: "tutorial.step0", tab: "Drama" },
  { messageId: "tutorial.step1", tab: "Assign", pulseTab: "Assign" },
  { messageId: "tutorial.step2", tab: "Assign", pulseAdvance: true },
  { messageId: "tutorial.step3", tab: "Reports" },
];

export function tutorialStepAutoNavigation(previousStep: number, nextStep: number): Tab | null {
  if (previousStep === nextStep) return null;
  // Resolving the opening drama creates a consequence receipt in the Drama
  // screen. Leave that receipt mounted; the Assign pulse is the handoff.
  if (previousStep === 0 && nextStep === 1) return null;
  return STEPS[nextStep]?.tab ?? null;
}

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
    const target = tutorialStepAutoNavigation(prevStep, step);
    if (step !== prevStep) {
      if (target) setTab(target);
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
      <span className="tutorial-msg">{t(s.messageId)}</span>
      <button className="tutorial-skip" onClick={onDismiss}>
        {t("tutorial.skip")}
      </button>
    </div>
  );
}
