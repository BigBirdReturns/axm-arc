from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"Expected exactly one marker in {path}: {old!r}; found {text.count(old)}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "src/engine/composition.ts",
    "  const matching = ctx.agents.filter((agent) => profileFor(agent, ctx)?.tags.includes(constraint.tag) ?? false);",
    "  if (constraint.kind != \"redundancy\") throw new Error(`Unsupported composition constraint ${constraint.kind}.`);\n  const matching = ctx.agents.filter((agent) => profileFor(agent, ctx)?.tags.includes(constraint.tag) ?? false);",
)

replace_once(
    "src/engine/state.ts",
    "    } else {\n      if (definition.kind !== \"enum\" || typeof before !== \"string\") {",
    "    } else {\n      if (effect.operation !== \"transition\") throw new CartridgeStateError(`Unsupported state operation ${effect.operation}.`);\n      if (definition.kind !== \"enum\" || typeof before !== \"string\") {",
)

replace_once(
    "src/engine/schema.ts",
    "export const ArcSchema: z.ZodType<Arc> = z.unknown().superRefine((input, ctx) => {",
    "export const ArcSchema: z.ZodType<Arc, z.ZodTypeDef, unknown> = z.unknown().superRefine((input, ctx) => {",
)

replace_once(
    "src/engine/save.ts",
    "export const SAVE_VERSION = 3;\n",
    "export const SAVE_VERSION = 3;\n\nexport function mapToArray<K, V>(map: Map<K, V>): [K, V][] {\n  return [...map.entries()];\n}\n\nexport function arrayToMap<K, V>(entries: [K, V][]): Map<K, V> {\n  return new Map(entries);\n}\n",
)

p = Path("src/dark-tomb/compiler.ts")
text = p.read_text()
if ".longAlarm" not in text:
    raise SystemExit("Dark Tomb compiler no longer contains longAlarm marker")
p.write_text(text.replace(".longAlarm", ".alarm"))

replace_once(
    "tests/common-ship/common-ship.test.ts",
    'expect(arc.meta.engineVersion).toBe("1.2.0");',
    'expect(arc.meta.engineVersion).toBe("1.3.0");',
)
replace_once(
    "tests/dark-tomb/dark-tomb.test.ts",
    'expect(arc.meta.engineVersion).toBe("1.2.0");',
    'expect(arc.meta.engineVersion).toBe("1.3.0");',
)
replace_once(
    "tests/engine/schema.test.ts",
    '''        engineVersion: "1.3.0",
      },
    }))).toThrow(/requires engine 1\.3\.0.*provides 1\.2\.0/);''',
    '''        engineVersion: "1.4.0",
      },
    }))).toThrow(/requires engine 1\.4\.0.*provides 1\.3\.0/);''',
)
