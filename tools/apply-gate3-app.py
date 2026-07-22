from pathlib import Path

path = Path("src/game/App.tsx")
text = path.read_text()

def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one App marker, found {count}: {old[:80]!r}")
    text = text.replace(old, new, 1)

replace_once(
    "  KIND_GODS_OF_ILYON,\n} from \"../arcs/index.js\";",
    "  KIND_GODS_OF_ILYON,\n  LAMP_DISTRICT,\n} from \"../arcs/index.js\";",
)
replace_once(
    'import { GodscarForgeScreen } from "./components/GodscarForgeScreen.js";\n',
    'import { GodscarForgeScreen } from "./components/GodscarForgeScreen.js";\nimport { DarkTombForgeScreen } from "./components/DarkTombForgeScreen.js";\n',
)
replace_once(
    "  ensureBundledArc(KIND_GODS_OF_ILYON);\n",
    "  ensureBundledArc(KIND_GODS_OF_ILYON);\n  ensureBundledArc(LAMP_DISTRICT);\n",
)
replace_once(
    'useState<"title" | "play" | "library" | "designer" | "workshop" | "godscar" | "raidnight" | "guildhall" | "archive">("title")',
    'useState<"title" | "play" | "library" | "designer" | "workshop" | "godscar" | "darktomb" | "raidnight" | "guildhall" | "archive">("title")',
)
replace_once(
    '        onOpenGodscar={() => setMode("godscar")}\n',
    '        onOpenGodscar={() => setMode("godscar")}\n        onOpenDarkTomb={() => setMode("darktomb")}\n',
)
marker = '''  if (mode === "raidnight") {
    return <>{standaloneControls}<RaidNightScreen onBack={() => setMode("title")} /></>;
  }
'''
insert = '''  if (mode === "darktomb") {
    return (
      <>{standaloneControls}<DarkTombForgeScreen
        onBack={() => setMode("title")}
        onOpenLibrary={() => setMode("library")}
        onPlayArc={(nextArc) => {
          const active = saveActiveArc(nextArc);
          if (!active.ok) { setSaveFailure(active.message); return; }
          restoreClientState(nextArc);
          setMode("title");
        }}
      /></>
    );
  }

''' + marker
replace_once(marker, insert)
path.write_text(text)
