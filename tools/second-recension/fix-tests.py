from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    target = Path(path)
    text = target.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"Expected one {label}; found {text.count(old)}")
    target.write_text(text.replace(old, new, 1))


replace_once(
    "tests/common-ship/relief-circuit.test.ts",
    'it("is a canon-compatible 1.0 source with a complete Lamp District circuit", () => {',
    'it("is a canon-compatible Second Recension source with a complete Lamp District circuit", () => {',
    "Relief Circuit test title",
)
replace_once(
    "tests/common-ship/relief-circuit.test.ts",
    'version: "1.0.0"',
    'version: "1.1.0"',
    "Relief Circuit version assertion",
)
replace_once(
    "tests/dark-tomb/lamp-district.test.ts",
    'it("is a complete canonical Book II source with eight linked civic and expedition movements", () => {',
    'it("is a complete canonical Book II Second Recension source with eight linked civic and expedition movements", () => {',
    "Lamp District test title",
)
replace_once(
    "tests/dark-tomb/lamp-district.test.ts",
    'version: "1.0.0"',
    'version: "1.1.0"',
    "Lamp District version assertion",
)
print("Updated Second Recension reference test expectations.")
