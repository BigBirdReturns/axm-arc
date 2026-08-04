from __future__ import annotations

from pathlib import Path

BRANCH = "feature/asoiaf-external-reconciliation-packets-v1"
V3_CARRIER = Path(
    ".github/workflows/apply-and-qualify-asoiaf-structured-observation-admission-v3.yml"
)
BRIDGE = Path("tools/lib/asoiaf-structured-acquisition-reconciliation.ts")
FIXTURE = Path(
    "tests/narrative/canon/asoiaf-structured-acquisition-reconciliation.test.ts"
)
PERMANENT_WORKFLOW = Path(
    ".github/workflows/asoiaf-structured-acquisition-reconciliation.yml"
)
DOCS = Path("docs/ASOIAF_STRUCTURED_ACQUISITION_RECONCILIATION.md")


def extract_v3_source_patch() -> str:
    carrier_text = V3_CARRIER.read_text(encoding="utf-8")
    start = "          python - <<'PY'\n"
    end = "\n          PY\n"
    if start not in carrier_text or end not in carrier_text:
        raise SystemExit("v3 direct-integration carrier is malformed")

    extracted = carrier_text.split(start, 1)[1].split(end, 1)[0]
    script = "\n".join(
        line[10:] if line.startswith("          ") else line
        for line in extracted.splitlines()
    )
    workflow_marker = "\nworkflow_path = Path(workflow)\n"
    if workflow_marker not in script:
        raise SystemExit("cannot isolate the v3 source and fixture patch")

    source_patch = script.split(workflow_marker, 1)[0]

    bad_claim_marker = (
        "      || claim.normalized.normalizedObservationDigest !== "
        "binding.normalizedContentDigest\n"
        "    || claim.normalized.acquisitionRawResponseRetained !== false\n"
    )
    corrected_claim_marker = (
        "      || claim.normalized.normalizedObservationDigest !== "
        "binding.normalizedContentDigest\n"
        "      || claim.normalized.acquisitionRawResponseRetained !== false\n"
    )
    count = source_patch.count(bad_claim_marker)
    if count != 1:
        raise SystemExit(
            "expected one malformed v3 claim-parity marker, "
            f"found {count}"
        )
    return source_patch.replace(
        bad_claim_marker,
        corrected_claim_marker,
        1,
    )


def integrate_permanent_workflow() -> None:
    lines = PERMANENT_WORKFLOW.read_text(encoding="utf-8").splitlines()
    output: list[str] = []
    for index, line in enumerate(lines):
        output.append(line)
        following = lines[index + 1] if index + 1 < len(lines) else ""

        if (
            line
            == "      - 'tools/lib/asoiaf-structured-acquisition-reconciliation.ts'"
            and following
            != "      - 'tools/lib/asoiaf-structured-observation-admission.ts'"
        ):
            output.append(
                "      - 'tools/lib/asoiaf-structured-observation-admission.ts'"
            )

        if (
            line
            == "      - 'tests/narrative/canon/asoiaf-structured-acquisition-reconciliation.test.ts'"
            and following
            != "      - 'tests/narrative/canon/asoiaf-structured-observation-admission.test.ts'"
        ):
            output.append(
                "      - 'tests/narrative/canon/asoiaf-structured-observation-admission.test.ts'"
            )

        if (
            line == "          npm test -- \\\n"
            and following
            == "            tests/narrative/canon/asoiaf-structured-acquisition-reconciliation.test.ts \\\n"
        ):
            output.append(
                "            tests/narrative/canon/asoiaf-structured-observation-admission.test.ts \\\n"
            )

        if (
            "'reviewedObservationParity=required'" in line
            and not any(
                "semanticAdmission=fingerprinted-required" in candidate
                for candidate in lines[index + 1 : index + 6]
            )
        ):
            indent = line[: len(line) - len(line.lstrip())]
            output.extend(
                [
                    f"{indent}'semanticAdmission=fingerprinted-required' \\",
                    f"{indent}'admissionOutcomes=admit-reject-defer' \\",
                    f"{indent}'workIdentityEvidence=retained-required' \\",
                    f"{indent}'questionRelevanceEvidence=retained-required' \\",
                ]
            )

    rendered = "\n".join(output) + "\n"
    PERMANENT_WORKFLOW.write_text(rendered, encoding="utf-8")


def append_documentation() -> None:
    marker = "## Structured observation admission"
    current = DOCS.read_text(encoding="utf-8")
    if marker in current:
        return

    appendix = r'''

## Structured observation admission

Successful acquisition and valid normalized custody are necessary but insufficient for claim construction. Every structured observation requires one fingerprinted named-review disposition before the acquisition-to-review bridge can build a packet: `admit-to-review`, `reject-off-topic`, or `defer-insufficient-identity`.

The disposition binds the exact source, adapter, request, plan fingerprint, acquisition receipt, adapter receipt, observation, candidate, normalized digest, question lanes, work-identity evidence, relevance evidence, outcome, reason, rationale, reviewer, and review time. Admission requires evidence supporting exact identity and question relevance. A lexical collision, continuity mismatch, or unsupported lane remains a rejection. Missing durable identity or relevance remains a defer.

Rejection and defer preserve the acquisition and collector ledgers but cannot construct a reviewed claim, evidence bundle, reconciliation proposal, graph effect, or canon effect. Admitted observations remain supporting-only. The bridge carries the admission identity and fingerprint into the reviewed observation, every normalized evidence record, and packet verification.

This gate was operationalized after the live canary returned a mechanically valid Crossref record whose title overlapped “A Song of Ice and Fire” while its DOI, container, and publisher identified an unrelated work. HTTP success, lexical overlap, and normalized metadata therefore remain insufficient for semantic admission.
'''
    DOCS.write_text(current.rstrip() + appendix + "\n", encoding="utf-8")


def verify_markers() -> None:
    required: dict[Path, tuple[str, ...]] = {
        BRIDGE: (
            'admission: AsoiafStructuredObservationAdmission;',
            'validateAsoiafStructuredObservationAdmission(admission)',
            'observation-not-admitted',
            'assertAsoiafStructuredObservationAdmitted(admission)',
            'claim.normalized.structuredAdmissionFingerprint',
            'structuredAdmissionOutcome: binding.admissionOutcome',
        ),
        FIXTURE: (
            'admission?: AsoiafStructuredObservationAdmission;',
            'refuses an off-topic observation before claim construction',
            'structuredAdmissionOutcome: "admit-to-review"',
        ),
        PERMANENT_WORKFLOW: (
            'asoiaf-structured-observation-admission.test.ts',
            'semanticAdmission=fingerprinted-required',
            'admissionOutcomes=admit-reject-defer',
            'workIdentityEvidence=retained-required',
            'questionRelevanceEvidence=retained-required',
        ),
        DOCS: ("## Structured observation admission",),
    }

    for target, markers in required.items():
        content = target.read_text(encoding="utf-8")
        for marker in markers:
            if marker not in content:
                raise SystemExit(
                    f"{target}: missing permanent admission marker {marker!r}"
                )

    bridge = BRIDGE.read_text(encoding="utf-8")
    if "admission-missing" not in bridge:
        raise SystemExit("bridge does not retain an explicit missing-admission finding")


def main() -> None:
    source_patch = extract_v3_source_patch()
    exec(
        compile(
            source_patch,
            "<structured-observation-admission-v5-source-patch>",
            "exec",
        ),
        {},
    )
    integrate_permanent_workflow()
    append_documentation()
    verify_markers()
    print("STRUCTURED_OBSERVATION_ADMISSION_V5_INTEGRATION_COMPLETE")


if __name__ == "__main__":
    main()
