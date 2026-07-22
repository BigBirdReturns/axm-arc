import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { FIRST_CHARTER, KARAZHAN, KIND_GODS_OF_ILYON } from "../../src/arcs/index.js";
import { auditArcAuthoring } from "../../src/game/lib/authoring-audit.js";
import { compileGodscarJson } from "../../src/game/lib/godscar-forge.js";
import { KIND_GODS_OF_ILYON_BLUEPRINT } from "../../src/godscar/templates.js";
import { cartridgeThemeScope } from "../../src/game/cartridge-theme.js";
import { CartridgeEmblem } from "../../src/game/cartridge-theme.js";
import { cartridgeRolePortraitSpec, CartridgePortrait } from "../../src/game/components/CartridgePortrait.js";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";


function collectPlayerFacingText(value: unknown, key = ""): string[] {
  const displayKeys = new Set([
    "name", "description", "flavorText", "narrative", "label", "text", "title",
    "currencyName", "materialName", "tokenName", "reputationName", "narrativeText",
  ]);
  if (Array.isArray(value)) return value.flatMap((entry) => collectPlayerFacingText(entry, key));
  if (!value || typeof value !== "object") return [];
  const lines: string[] = [];
  for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
    if (typeof child === "string" && displayKeys.has(childKey)) lines.push(child);
    else lines.push(...collectPlayerFacingText(child, childKey));
  }
  return lines;
}

function read(path: string): string {
  return fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Arc product parity contract", () => {

  it("ships the second cartridge as original Waking Tower fiction", () => {
    const text = collectPlayerFacingText(KARAZHAN).join("\n");
    expect(KARAZHAN.meta.name).toBe("The Waking Tower");
    expect(text).toContain("Lamplit Survey");
    const forbidden = [
      /\bKarazhan\b/i, /\bMedivh\b/i, /\bAttumen\b/i, /\bMoroes\b/i,
      /\bMaiden\b/i, /\bCurator\b/i, /\bIllhoof\b/i, /\bAran\b/i,
      /\bNetherspite\b/i, /\bMalchezaar\b/i, /\bNightbane\b/i,
      /\bMaulgar\b/i, /\bGruul\b/i, /\bMagtheridon\b/i, /Violet Eye/i,
      /Hellfire Citadel/i, /\beredar\b/i, /\bfel\b/i, /\bnether\b/i,
      /\binfernal\b/i, /The Master's Key/i, /The Blackened Urn/i,
    ];
    for (const pattern of forbidden) expect(text, pattern.source).not.toMatch(pattern);
  });

  it("keeps every bundled reference cartridge structurally usable for authors", () => {
    for (const arc of [FIRST_CHARTER, KARAZHAN, KIND_GODS_OF_ILYON]) {
      expect(auditArcAuthoring(arc).passes, arc.meta.name).toBe(true);
    }
  });

  it("gives the Designer functional roster, item, challenge, and Arc sections", () => {
    const source = read("src/game/components/DesignerScreen.tsx");
    for (const section of ["roster", "items", "challenges", "arc"]) {
      expect(source).toContain(`draft.section === \"${section}\"`);
    }
    expect(source).toContain("AuthoringAuditPanel");
    expect(source).toContain("exportActiveArc");
    expect(source).not.toContain("Available in a later step");
  });

  it("hands the exact Designer Arc to Workshop ahead of stale browser drafts", () => {
    const app = read("src/game/App.tsx");
    const workshop = read("src/game/components/WorkshopScreen.tsx");
    expect(app).toContain("onOpenWorkshop={() => openWorkshop(arc)}");
    expect(app).toContain("seedArc={workshopSeedArc}");
    expect(workshop).toContain('data-testid="workshop-seeded-arc"');
    expect(workshop).toContain("selectWorkshopDraft(seedArc, loadWorkshopDraft())");
  });

  it("records the Waking Tower source and projection authority without renaming its compatibility id", () => {
    const authority = read("docs/WAKING_TOWER_DESIGN_AUTHORITY.md");
    expect(authority).toContain("The Waking Tower");
    expect(authority).toContain("compatibility id");
    expect(authority).toContain("24d238302d659264552bc002b73aaf3592c1f84e");
    expect(authority).toContain("ac3c4f620cf5df802567c7dd10d3ee972cabfa46");
    expect(authority).toContain("Dark Tomb");
    expect(read("README.md")).toContain("docs/WAKING_TOWER_DESIGN_AUTHORITY.md");
  });

  it("gives Godscar one creator-owned source with guided and exact-source modes", () => {
    const source = read("src/game/components/GodscarForgeScreen.tsx");
    expect(source).toContain('data-testid="godscar-guided-editor"');
    expect(source).toContain('data-testid="godscar-forge-editor"');
    expect(source).toContain("updateEditableGodscarSource");
    expect(source).toContain("compileGodscarJson(text)");
    expect(compileGodscarJson(JSON.stringify(KIND_GODS_OF_ILYON_BLUEPRINT)).ok).toBe(true);
  });

  it("makes local sound and reduced motion reachable in play and every standalone tool", () => {
    const app = read("src/game/App.tsx");
    const title = read("src/game/components/TitleScreen.tsx");
    expect(app).toContain('className="standalone-presentation-controls"');
    expect(app).toContain("<SensorySwitcher />");
    expect(app).toContain("<LocaleSwitcher />");
    expect(title).toContain("<SensorySwitcher />");
    expect(read("src/game/styles.css")).toContain(':root[data-motion="reduced"]');
  });


  it("gives every bundled role a cartridge-owned portrait while imported roles keep honest fallback", () => {
    for (const arc of [FIRST_CHARTER, KARAZHAN, KIND_GODS_OF_ILYON]) {
      for (const role of arc.roles) {
        expect(cartridgeRolePortraitSpec(arc.meta.id, role.id), `${arc.meta.name} · ${role.name}`).not.toBeNull();
        const html = renderToStaticMarkup(React.createElement(CartridgePortrait, {
          arcId: arc.meta.id,
          roleId: role.id,
          name: role.name,
        }));
        expect(html).toContain("cartridge-role-portrait--authored");
        expect(html).toContain(`data-role="${role.id}"`);
      }
    }
    expect(cartridgeRolePortraitSpec("imported-unknown", "operator")).toBeNull();
    expect(renderToStaticMarkup(React.createElement(CartridgePortrait, {
      arcId: "imported-unknown",
      roleId: "operator",
      name: "Unknown Operator",
    }))).toContain("cartridge-role-portrait--fallback");
  });

  it("gives every bundled cartridge an isolated Arc-player material identity", () => {
    expect(cartridgeThemeScope(FIRST_CHARTER.meta.id)).toBe("first-charter");
    expect(cartridgeThemeScope(KARAZHAN.meta.id)).toBe("karazhan");
    expect(cartridgeThemeScope(KIND_GODS_OF_ILYON.meta.id)).toBe("ilyon");
    expect(cartridgeThemeScope("imported-unknown")).toBeNull();

    const css = read("src/game/styles/cartridge-themes.css");
    const app = read("src/game/App.tsx");
    for (const [arcId, scope] of [[FIRST_CHARTER.meta.id, "first-charter"], [KARAZHAN.meta.id, "karazhan"], [KIND_GODS_OF_ILYON.meta.id, "ilyon"]] as const) {
      expect(renderToStaticMarkup(React.createElement(CartridgeEmblem, { arcId }))).toContain(`data-testid="arc-emblem-${scope}"`);
      expect(css).toContain(`data-cartridge="${scope}"`);
    }
    expect(renderToStaticMarkup(React.createElement(CartridgeEmblem, { arcId: "imported-unknown" }))).toBe("");
    expect(app).toContain("cartridgeThemeScope(arc.meta.id)");
    expect(app).toContain("root.removeAttribute(\"data-cartridge\")");
  });


});
