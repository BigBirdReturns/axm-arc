from pathlib import Path

root = Path(__file__).resolve().parents[1]
source_path = root / "src/dark-tomb/lamp-district.ts"
text = source_path.read_text()

calibrations = {
    "stop-the-cut-order": (9, 6),
    "rewrite-the-grave-skin": (8, 5),
}

for check_id, (before, after) in calibrations.items():
    anchor = f'"id": "{check_id}"'
    start = text.find(anchor)
    if start < 0:
        raise SystemExit(f"Missing Lamp District check {check_id}.")
    next_check = text.find('"id": "', start + len(anchor))
    end = next_check if next_check >= 0 else len(text)
    segment = text[start:end]
    old = f'"threshold": {before}'
    new = f'"threshold": {after}'
    if segment.count(old) != 1:
        raise SystemExit(f"Expected one {old} in {check_id}, found {segment.count(old)}.")
    segment = segment.replace(old, new, 1)
    text = text[:start] + segment + text[end:]

source_path.write_text(text)

# Add a permanent acceptance guard without altering the existing Gate 3 proof.
test_path = root / "tests/dark-tomb/lamp-district-gate4-calibration.test.ts"
test_path.write_text('''import { describe, expect, it } from "vitest";\nimport { LAMP_DISTRICT_SOURCE } from "../../src/dark-tomb/lamp-district.js";\n\ndescribe("Lamp District Gate 4 breach calibration", () => {\n  it("keeps the surface-sacrifice breach inside a bounded direct-player recovery band", () => {\n    const delve = LAMP_DISTRICT_SOURCE.delves.find((entry) => entry.id === "interrupt-the-surface-sacrifice");\n    expect(delve?.checks.map((check) => [check.id, check.threshold])).toEqual([\n      ["stop-the-cut-order", 6],\n      ["rewrite-the-grave-skin", 5],\n    ]);\n  });\n});\n''')

print("Applied the Gate 4 Lamp District breach calibration.")
