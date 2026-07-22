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

compiler_path = Path("src/dark-tomb/compiler-base.ts")
compiler = compiler_path.read_text()
reserve_marker = '''  const tierFor = (responsibility: DarkTombPocketSource["cast"][number]["responsibility"]): string => {
    if (responsibility === "sovereign-exception") return "sovereign";
    if (responsibility === "holds-map-changing-evidence" || responsibility === "understands-quiet-works") return "layer";
    return "local";
  };

  const arc: Arc = {
'''
reserve_replacement = '''  const tierFor = (responsibility: DarkTombPocketSource["cast"][number]["responsibility"]): string => {
    if (responsibility === "sovereign-exception") return "sovereign";
    if (responsibility === "holds-map-changing-evidence" || responsibility === "understands-quiet-works") return "layer";
    return "local";
  };
  // Quiet Tonnage must carry the exact founding cast through retries without
  // turning ordinary upkeep into a silent campaign softlock. Reserve four
  // authored campaign horizons at the maximum tier cost per resident; actual
  // lower tiers and authored rewards remain ordinary surplus.
  const foundingCurrency = Math.max(80, source.identity.estimatedCycles * source.cast.length * 3 * 4);

  const arc: Arc = {
'''
if compiler.count(reserve_marker) != 1:
    raise SystemExit("Expected one Dark Tomb reserve marker")
compiler = compiler.replace(reserve_marker, reserve_replacement, 1)
if compiler.count('resources: { currency: 80, materials: 40, tokens: 4 }') != 1:
    raise SystemExit("Expected one Dark Tomb founding resource marker")
compiler = compiler.replace(
    'resources: { currency: 80, materials: 40, tokens: 4 }',
    'resources: { currency: foundingCurrency, materials: 40, tokens: 4 }',
    1,
)
compiler_path.write_text(compiler)
