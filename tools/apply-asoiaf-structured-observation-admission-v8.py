from __future__ import annotations

import runpy
from pathlib import Path


V5_APPLICATOR = "tools/apply-asoiaf-structured-observation-admission-v5.py"


def correct_fixture_targets(source_patch: str) -> str:
    replacements = (
        (
            "        normalizedContentDigest: NORMALIZED_DIGEST,\n"
            "      rawResponseRetained: false,\n",
            "        normalizedContentDigest: NORMALIZED_DIGEST,\n"
            "        rawResponseRetained: false,\n",
            1,
        ),
        (
            "        normalizedObservationDigest: NORMALIZED_DIGEST,\n"
            "      acquisitionRawResponseRetained: false,\n",
            "        normalizedObservationDigest: NORMALIZED_DIGEST,\n"
            "        acquisitionRawResponseRetained: false,\n",
            2,
        ),
    )
    corrected = source_patch
    for old, new, expected in replacements:
        count = corrected.count(old)
        if count != expected:
            raise SystemExit(
                f"expected {expected} malformed v3 fixture target copies, "
                f"found {count}: {old!r}"
            )
        corrected = corrected.replace(old, new)
    return corrected


def normalize_documentation_eof(docs_path: Path) -> None:
    content = docs_path.read_text(encoding="utf-8")
    docs_path.write_text(content.rstrip() + "\n", encoding="utf-8")


def main() -> None:
    namespace = runpy.run_path(
        V5_APPLICATOR,
        run_name="asoiaf_structured_observation_admission_v5",
    )
    source_patch = namespace["extract_v3_source_patch"]()
    source_patch = correct_fixture_targets(source_patch)
    exec(
        compile(
            source_patch,
            "<structured-observation-admission-v8-source-patch>",
            "exec",
        ),
        {},
    )
    namespace["integrate_permanent_workflow"]()
    namespace["append_documentation"]()
    normalize_documentation_eof(namespace["DOCS"])
    namespace["verify_markers"]()
    print("STRUCTURED_OBSERVATION_ADMISSION_V10_INTEGRATION_COMPLETE")


if __name__ == "__main__":
    main()
