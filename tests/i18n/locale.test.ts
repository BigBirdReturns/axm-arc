import { describe, expect, it } from "vitest";
import { isLocale } from "../../src/i18n/locale.js";
import { EN_ONLY_IDS, formatMessage, MESSAGES, type MessageId } from "../../src/i18n/messages.js";

describe("locale identifier", () => {
  it("accepts known locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("zh-Hant")).toBe(true);
  });

  it("rejects unknown or missing locales", () => {
    expect(isLocale("zh")).toBe(false);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("formatMessage", () => {
  it("resolves plain string messages in en", () => {
    expect(formatMessage("en", "nav.roster")).toBe("Roster");
    expect(formatMessage("en", "advance.blockedShort")).toBe("Blocked");
  });

  it("resolves plain string messages in zh-Hant", () => {
    expect(formatMessage("zh-Hant", "nav.roster")).toBe("名冊");
    expect(formatMessage("zh-Hant", "advance.blockedShort")).toBe("受阻");
  });

  it("interpolates params in both locales", () => {
    expect(formatMessage("en", "header.situationRoom", { cycle: "03" })).toBe("Situation Room · Cycle 03");
    expect(formatMessage("zh-Hant", "header.situationRoom", { cycle: "03" })).toBe("戰情室 · 週期 03");
    expect(formatMessage("en", "title.colophon", { version: "1.0", engine: "2" })).toBe(
      "AXM Arc · v1.0 · Engine 2",
    );
    expect(formatMessage("zh-Hant", "title.colophon", { version: "1.0", engine: "2" })).toBe(
      "AXM 弧 · v1.0 · 引擎 2",
    );
  });

  it("pluralizes agent counts in en", () => {
    expect(formatMessage("en", "title.agentsCount", { count: 1 })).toBe("1 agent");
    expect(formatMessage("en", "title.agentsCount", { count: 4 })).toBe("4 agents");
  });

  it("falls back to en when zh-Hant is missing a message", () => {
    // "title.designerPrototype" is intentionally left untranslated in the zh-Hant
    // catalog to exercise the fallback path honestly.
    expect(formatMessage("zh-Hant", "title.designerPrototype")).toBe("Designer Prototype");
  });

  it("returns the id itself when missing from every catalog", () => {
    expect(formatMessage("en", "does.not.exist" as never)).toBe("does.not.exist");
  });
});

describe("full-app chrome spot checks", () => {
  it("screen chrome resolves in both locales", () => {
    expect(formatMessage("en", "roster.personnel")).toBe("Personnel");
    expect(formatMessage("zh-Hant", "roster.personnel")).toBe("人員");
    expect(formatMessage("en", "assign.goodPlan")).toBe("Good plan");
    expect(formatMessage("zh-Hant", "assign.goodPlan")).toBe("計畫良好");
    expect(formatMessage("en", "fac.Training.name")).toBe("Training");
    expect(formatMessage("zh-Hant", "fac.Training.name")).toBe("訓練");
    expect(formatMessage("en", "tutorial.skip")).toBe("skip");
    expect(formatMessage("zh-Hant", "tutorial.skip")).toBe("略過");
  });

  it("templated chrome interpolates in both locales", () => {
    expect(formatMessage("en", "checklist.dramaUnresolved", { n: 2 })).toBe("2 drama unresolved");
    expect(formatMessage("zh-Hant", "checklist.dramaUnresolved", { n: 2 })).toBe("2 項劇情未處理");
    expect(formatMessage("en", "blockers.dramaCards", { count: 1 })).toBe("Resolve 1 drama card before advancing.");
    expect(formatMessage("zh-Hant", "blockers.dramaCards", { count: 3 })).toBe("推進前請先處理 3 張劇情卡。");
    expect(formatMessage("en", "drama.decisions", { count: 2 })).toBe("TWO DECISIONS");
    expect(formatMessage("zh-Hant", "drama.decisions", { count: 2 })).toBe("兩項決策");
    expect(formatMessage("en", "reports.absChecksFailedLine", { failed: 1, total: 4, name: "" })).toBe("One mechanic check failed.");
    expect(formatMessage("zh-Hant", "reports.absChecksFailedLine", { failed: 2, total: 4, name: "Vex" })).toBe("4 項機制檢定中有 2 項未過；其中一項靠 Vex 的關鍵堅毅撐了下來。");
  });

  it("headline display values resolve in both locales", () => {
    expect(formatMessage("en", "headline.clean")).toBe("CLEAN.");
    expect(formatMessage("zh-Hant", "headline.clean")).toBe("無傷通關。");
    expect(formatMessage("zh-Hant", "headline.carried", { name: "VEX" })).toBe("VEX 一肩扛起。");
  });
});

describe("catalog coverage guard", () => {
  it("every en message id is present in zh-Hant, or explicitly documented as EN_ONLY", () => {
    const enIds = Object.keys(MESSAGES.en) as MessageId[];
    const zhIds = new Set(Object.keys(MESSAGES["zh-Hant"]));
    const enOnly = new Set(EN_ONLY_IDS);
    const uncovered = enIds.filter((id) => !zhIds.has(id) && !enOnly.has(id));
    expect(uncovered, `ids missing from zh-Hant and not listed in EN_ONLY_IDS:\n${uncovered.join("\n")}`).toEqual([]);
  });

  it("EN_ONLY_IDS are actually missing from zh-Hant (the array stays honest)", () => {
    const zhIds = new Set(Object.keys(MESSAGES["zh-Hant"]));
    for (const id of EN_ONLY_IDS) {
      expect(zhIds.has(id), `"${id}" is listed as EN_ONLY but zh-Hant defines it`).toBe(false);
    }
  });
});
