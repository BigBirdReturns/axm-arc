// Validation ergonomics (RFC_WORKSHOP PR 066) — describeValidationErrors is a
// pure display derivation over validateArcJson's real error strings. It never
// re-validates and never rewrites a message; it only extracts a position hint
// when the message already carries one. Covers: a real JSON.parse failure
// (modern V8 "(line N column M)" wording), a constructed "at position N"
// fallback (older V8 wording, computed against the draft text), real schema
// errors (no position at all), and purity of the inputs.

import { describe, it, expect } from "vitest";
import { describeValidationErrors } from "../../src/game/lib/workshop.js";
import { validateArcJson } from "../../src/game/lib/arc-library.js";

describe("describeValidationErrors", () => {
  it("extracts line/column from a real JSON parse failure", () => {
    const draft = "{ not json";
    const result = validateArcJson(draft);
    expect(result.ok).toBe(false);
    const errors = result.ok ? [] : result.errors;

    const view = describeValidationErrors(errors, draft);

    expect(view.count).toBe(errors.length);
    expect(view.items).toHaveLength(errors.length);
    const first = view.items[0];
    expect(first).toBeDefined();
    expect(first?.raw).toBe(errors[0]);
    // This Node/V8 emits "... (line 1 column 3)" for this malformed input.
    expect(first?.line).toBe(1);
    expect(first?.column).toBe(3);
  });

  it("falls back to computing line/column from an 'at position N' message", () => {
    // Older V8 wording carries only a raw character offset, no line/column
    // suffix — describeValidationErrors must compute it from the draft text
    // itself, never guess.
    const draft = "abc\ndefghij";
    //             0123 45678901  (index 3 is the newline; "defghij" starts at 4)
    const errors = ["JSON parse error: boom at position 7"];

    const view = describeValidationErrors(errors, draft);

    expect(view.count).toBe(1);
    const item = view.items[0];
    expect(item).toBeDefined();
    expect(item?.raw).toBe(errors[0]);
    // Position 7 is 'g', the 4th character of the second line ("defghij").
    expect(item?.line).toBe(2);
    expect(item?.column).toBe(4);
  });

  it("gives no position hint for real schema errors", () => {
    const draft = "{}";
    const result = validateArcJson(draft);
    expect(result.ok).toBe(false);
    const errors = result.ok ? [] : result.errors;
    expect(errors.length).toBeGreaterThan(0);

    const view = describeValidationErrors(errors, draft);

    expect(view.count).toBe(errors.length);
    for (let i = 0; i < view.items.length; i++) {
      const item = view.items[i];
      expect(item).toBeDefined();
      expect(item?.raw).toBe(errors[i]);
      expect(item?.line).toBeNull();
      expect(item?.column).toBeNull();
    }
  });

  it("is pure: never mutates its inputs", () => {
    const errors = ["JSON parse error: boom (line 2 column 5)", "some schema error"];
    const errorsCopy = [...errors];
    const draft = "line one\nline two";
    const draftCopy = draft;

    describeValidationErrors(errors, draft);

    expect(errors).toEqual(errorsCopy);
    expect(draft).toBe(draftCopy);
  });
});
