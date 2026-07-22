import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { dramaResolutionReceiptMessageId } from "../../src/game/components/DramaScreen.js";

describe("drama resolution receipt", () => {
  it("calls an ordinary decision applied instead of inventing a precedent", () => {
    expect(dramaResolutionReceiptMessageId(0, 0)).toBe("drama.decisionApplied");
  });

  it("says a precedent was logged only when the record grew", () => {
    expect(dramaResolutionReceiptMessageId(2, 3)).toBe("drama.precedentLogged");
  });
  it("mounts the attended stamp in the committed decision receipt", () => {
    const source = fs.readFileSync(new URL("../../src/game/components/DramaScreen.tsx", import.meta.url), "utf8");
    expect(source).toContain("<AttendedStamp show");
    expect(source).toContain('t("drama.attended")');
  });

});
