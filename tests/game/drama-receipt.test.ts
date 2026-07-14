import { describe, expect, it } from "vitest";
import { dramaResolutionReceiptMessageId } from "../../src/game/components/DramaScreen.js";

describe("drama resolution receipt", () => {
  it("calls an ordinary decision applied instead of inventing a precedent", () => {
    expect(dramaResolutionReceiptMessageId(0, 0)).toBe("drama.decisionApplied");
  });

  it("says a precedent was logged only when the record grew", () => {
    expect(dramaResolutionReceiptMessageId(2, 3)).toBe("drama.precedentLogged");
  });
});
