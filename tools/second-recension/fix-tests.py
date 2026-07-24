from pathlib import Path

path = Path("tests/common-ship/relief-circuit.test.ts")
text = path.read_text()
old = 'it("is a canon-compatible 1.0 source with a complete Lamp District circuit", () => {'
new = 'it("is a canon-compatible Second Recension source with a complete Lamp District circuit", () => {'
if text.count(old) != 1:
    raise SystemExit(f"Expected one Relief Circuit test title; found {text.count(old)}")
text = text.replace(old, new, 1)
old = 'version: "1.0.0"'
new = 'version: "1.1.0"'
if text.count(old) != 1:
    raise SystemExit(f"Expected one Relief Circuit version assertion; found {text.count(old)}")
path.write_text(text.replace(old, new, 1))
print("Updated Relief Circuit Second Recension test expectation.")
