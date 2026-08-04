from __future__ import annotations

import runpy


V5_APPLICATOR = "tools/apply-asoiaf-structured-observation-admission-v5.py"


def correct_fixture_targets(source_patch: str) -> str:
    replacements = (
        (
            "        normalizedContentDigest: NORMALIZED_DIGEST,\n"
            "      rawResponseRetained: false,\n",
            "        normalizedContentDigest: NORMALIZED_DIGEST,\n"
            "        rawResponseRetained: false,\n",
        ),
        (
            "        normalizedObservationDigest: NORMALIZED_DIGEST,\n"
            "      acquisitionRawResponseRetained: false,\n",
            "        normalizedObservationDigest: NORMALIZED_DIGEST,\n"
            "        acquisitionRawResponseRetained: false,\n",
        ),
    )
    corrected = source_patch
    for old, new in replacements:
        count = corrected.count(old)
        if count != 1:
            raise SystemExit(
                "expected one malformed v3 fixture target, "
                f"found {count}: {old!r}"
            )
        corrected = corrected.replace(old, new, 1)
    return corrected


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
    namespace["verify_markers"]()
    print("STRUCTURED_OBSERVATION_ADMISSION_V8_INTEGRATION_COMPLETE")


if __name__ == "__main__":
    main()
