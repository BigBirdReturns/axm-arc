from pathlib import Path

ROOT = Path.cwd()


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"Expected one occurrence in {path}: {old[:100]!r}; found {text.count(old)}")
    target.write_text(text.replace(old, new, 1))


replace_once(
    "src/godscar/templates.ts",
    '  notes: withSecondRecensionNote(undefined, "book-i", ILYON_CONSEQUENCE_PLANE_LEDGER),\n  beats: [\n',
    '  beats: [\n',
)
replace_once(
    "src/godscar/templates.ts",
    '  notes: {\n    foundation: "The Godscar Codex, Book I: The Open Universe",\n    intent: "Reference cartridge demonstrating the six-pressure Story Engine, disciplined canon uncertainty, faction receipts, and persistent consequences.",\n  },\n',
    '  notes: withSecondRecensionNote({\n    foundation: "The Godscar Codex, Book I: The Open Universe",\n    intent: "Reference cartridge demonstrating the six-pressure Story Engine, disciplined canon uncertainty, faction receipts, and persistent consequences.",\n  }, "book-i", ILYON_CONSEQUENCE_PLANE_LEDGER),\n',
)

replace_once(
    "src/dark-tomb/templates.ts",
    '  notes: withSecondRecensionNote(undefined, "book-ii", DARK_TOMB_STARTER_LIVING_TOMB_LEDGER),\n  delves: [\n',
    '  delves: [\n',
)
replace_once(
    "src/dark-tomb/templates.ts",
    '  notes: {\n    status: "private authoring seed",\n    instruction: "Replace every local particular. Preserve the eight-pressure mechanism, evidence discipline, incompatible responsibilities, classification-changing escalation, and inherited consequence.",\n  },\n',
    '  notes: withSecondRecensionNote({\n    status: "private authoring seed",\n    instruction: "Replace every local particular. Preserve the eight-pressure mechanism, evidence discipline, incompatible responsibilities, classification-changing escalation, and inherited consequence.",\n  }, "book-ii", DARK_TOMB_STARTER_LIVING_TOMB_LEDGER),\n',
)

replace_once(
    "src/dark-tomb/lamp-district.ts",
    '  "notes": withSecondRecensionNote(undefined, "book-ii", LAMP_DISTRICT_LIVING_TOMB_LEDGER),\n  "delves": [\n',
    '  "delves": [\n',
)
replace_once(
    "src/dark-tomb/lamp-district.ts",
    '  "notes": {\n    "authority": "The Godscar Codex, Book II: The Dark Tomb · foundational canon · first recension · July 2026",\n    "status": "Canonical RODOH Gate 3 reference campaign",\n    "acceptance": "Ordinary life → authority → descent → classification reversal → Alarm audit → visible return → changed hub"\n  }\n',
    '  "notes": withSecondRecensionNote({\n    "authority": "The Godscar Codex, Book II: The Dark Tomb · foundational canon · first recension · July 2026",\n    "status": "Canonical RODOH Gate 3 reference campaign",\n    "acceptance": "Ordinary life → authority → descent → classification reversal → Alarm audit → visible return → changed hub"\n  }, "book-ii", LAMP_DISTRICT_LIVING_TOMB_LEDGER)\n',
)

print("Reconciled existing notes with Second Recension notes.")
