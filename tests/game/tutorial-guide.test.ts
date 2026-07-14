import { describe, expect, it } from "vitest";
import { tutorialStepAutoNavigation } from "../../src/game/components/TutorialGuide.js";

describe("tutorial step navigation", () => {
  it("keeps the opening decision receipt mounted before handing off to Assign", () => {
    expect(tutorialStepAutoNavigation(0, 1)).toBeNull();
  });

  it("still routes later completed steps to their authored destination", () => {
    expect(tutorialStepAutoNavigation(2, 3)).toBe("Reports");
  });
});
