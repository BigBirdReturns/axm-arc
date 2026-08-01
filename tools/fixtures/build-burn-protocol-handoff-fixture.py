#!/usr/bin/env python3
"""Build deterministic miniature Burn handoffs for verifier qualification.

The fixture preserves the exact structural relationships of the reported
v0.58.0 -> A13C1 handoff while using tiny original payloads. It is test evidence
for the intake mechanism, never a substitute for the private production archive.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from copy import deepcopy
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

FIXED_TIME = (1980, 1, 1, 0, 0, 0)
HANDOFF_BASENAME = "Burn_Protocol_FRESH_SESSION_HANDOFF_v0.58.0_A13C1.zip"
PARENT_BASENAME = "Star_Trek_Discovery_The_Burn_Protocol_Web_Series_v0.58.0.zip"
PARENT_SHA_BASENAME = f"{PARENT_BASENAME}.sha256"

REQUIRED_BASENAMES = [
    PARENT_BASENAME,
    PARENT_SHA_BASENAME,
    "Star_Trek_Discovery_The_Burn_Protocol_Web_Series_v0.58.0.release-verification.json",
    "Star_Trek_Discovery_The_Burn_Protocol_Web_Series_v0.58.0.clean-validation.json",
    "v0.58.0-file-manifest.json",
    "v0.58.0-lineage-ledger.json",
    "v0.57.0-rematerialization-v0.58.0.json",
    "a12c3-panel-contact-sheet.png",
    "a12c3-plate-montage.png",
    "a12c3-underpaint-to-final.png",
    "a12c3-vs-active-floor.png",
    "reader-art-smoke-a12c3-desktop-p41.png",
    "reader-art-smoke-a12c3-desktop-p60.png",
    "reader-art-smoke-a12c3-mobile-p60.png",
    "a12c3-art-audit.json",
    "validation-report-v0.58.0.json",
    "reader-art-smoke-a12c3.json",
    "a12c3-visual-qa.json",
    "a12c3-rejection-log.json",
    "A12C3-art-lock.md",
    "A12C3-execution-report.md",
    "A13C1-production-contract.md",
]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode("utf-8")


def manifest_record(path: str, data: bytes) -> dict[str, object]:
    return {"path": path, "sha256": sha256(data), "bytes": len(data)}


def write_zip(path: Path, payloads: dict[str, bytes]) -> bytes:
    with ZipFile(path, "w") as archive:
        for name in sorted(payloads):
            info = ZipInfo(name, FIXED_TIME)
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, payloads[name])
    return path.read_bytes()


def base_fixture(output: Path) -> tuple[Path, dict[str, object], dict[str, bytes]]:
    parent_payloads = {
        "assets/E12-C3-P01.png": b"fixture-panel-byte-sequence\n",
        "episodes/episode-13.json": json_bytes({"episode": 13, "next": "A13C1"}),
        "state/current-state.json": json_bytes(
            {"estateVersion": "0.58.0", "productionPointer": "A13C1"}
        ),
    }
    parent_manifest = {
        "format": "fixture-parent-manifest/1",
        "files": [
            manifest_record(name, parent_payloads[name]) for name in sorted(parent_payloads)
        ],
    }
    parent_payloads_with_manifest = {
        **parent_payloads,
        "v0.58.0-file-manifest.json": json_bytes(parent_manifest),
    }
    parent_path = output / PARENT_BASENAME
    parent_bytes = write_zip(parent_path, parent_payloads_with_manifest)
    parent_hash = sha256(parent_bytes)

    outer_payloads: dict[str, bytes] = {
        PARENT_BASENAME: parent_bytes,
        PARENT_SHA_BASENAME: f"{parent_hash}  {PARENT_BASENAME}\n".encode(),
        "Star_Trek_Discovery_The_Burn_Protocol_Web_Series_v0.58.0.release-verification.json": json_bytes(
            {"format": "fixture-release-verification/1", "status": "pass"}
        ),
        "Star_Trek_Discovery_The_Burn_Protocol_Web_Series_v0.58.0.clean-validation.json": json_bytes(
            {"format": "fixture-clean-validation/1", "status": "pass"}
        ),
        "v0.58.0-file-manifest.json": json_bytes(parent_manifest),
        "v0.58.0-lineage-ledger.json": json_bytes(
            {"format": "fixture-lineage/1", "exactParent": "0.58.0"}
        ),
        "v0.57.0-rematerialization-v0.58.0.json": json_bytes(
            {"format": "fixture-rematerialization/1", "records": 560}
        ),
        "a12c3-art-audit.json": json_bytes({"checks": 251, "status": "pass"}),
        "validation-report-v0.58.0.json": json_bytes(
            {
                "scriptedPanels": 780,
                "illustratedPanels": 720,
                "visualChapters": 36,
                "scrollPlates": 144,
                "next": "A13C1",
            }
        ),
        "reader-art-smoke-a12c3.json": json_bytes(
            {"desktop": "pass", "mobile": "pass"}
        ),
        "a12c3-visual-qa.json": json_bytes({"status": "accepted"}),
        "a12c3-rejection-log.json": json_bytes({"rejectedFamilies": 2}),
        "A12C3-art-lock.md": b"# A12C3 art lock\n\nFixture only.\n",
        "A12C3-execution-report.md": b"# A12C3 execution report\n\nFixture only.\n",
        "A13C1-production-contract.md": (
            "# A13C1 Disclosure\n\n"
            "Can public truth produce accountable repair without allowing the archive "
            "to become the new sovereign owner?\n"
        ).encode()
        * 4,
        "verify-handoff.mjs": b"#!/usr/bin/env node\nconsole.log('fixture verifier');\n",
    }
    for name in REQUIRED_BASENAMES:
        if name in outer_payloads:
            continue
        if name.endswith(".png"):
            outer_payloads[name] = f"fixture image: {name}\n".encode()
        elif name.endswith(".json"):
            outer_payloads[name] = json_bytes({"fixture": name})
        elif name.endswith(".md"):
            outer_payloads[name] = f"# {name}\n\nFixture only.\n".encode()

    assert len(outer_payloads) == 23, len(outer_payloads)
    outer_manifest = {
        "format": "fixture-outer-manifest/1",
        "files": [
            manifest_record(name, outer_payloads[name]) for name in sorted(outer_payloads)
        ],
    }
    complete_outer = {
        **outer_payloads,
        "handoff-manifest.json": json_bytes(outer_manifest),
    }
    assert len(complete_outer) == 24
    handoff_path = output / HANDOFF_BASENAME
    handoff_bytes = write_zip(handoff_path, complete_outer)

    contract: dict[str, object] = {
        "format": "burn-protocol-handoff-intake-contract/1",
        "handoff": {
            "basename": HANDOFF_BASENAME,
            "sha256": sha256(handoff_bytes),
            "bytes": len(handoff_bytes),
            "entries": 24,
        },
        "parent": {
            "basename": PARENT_BASENAME,
            "sha256": parent_hash,
            "bytes": len(parent_bytes),
            "entries": 4,
            "sha256ReceiptBasename": PARENT_SHA_BASENAME,
            "manifestBasename": "v0.58.0-file-manifest.json",
            "manifestRecords": 3,
            "manifestUncompressedBytes": sum(len(data) for data in parent_payloads.values()),
        },
        "outerManifest": {"records": 23},
        "requiredBasenames": REQUIRED_BASENAMES,
        "verifierPatterns": [r"(?:^|/)verify[^/]*\.(?:py|mjs|js|sh)$"],
        "productionContract": {
            "basename": "A13C1-production-contract.md",
            "minBytes": 1,
            "maxBytes": 10_000,
            "requiredText": ["A13C1", "Disclosure", "public truth", "sovereign owner"],
        },
        "statePointer": {
            "requiredTerms": ["0.58.0", "A13C1"],
            "maxFileBytes": 2_097_152,
        },
        "corpusValidation": {
            "basename": "validation-report-v0.58.0.json",
            "requiredText": ["780", "720", "36", "144", "A13C1"],
        },
        "authority": {
            "inheritedHistory": "read-only",
            "liveRuns": "counterfactual-only",
            "storyChanges": "none",
        },
    }
    return handoff_path, contract, complete_outer


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)

    good_path, good_contract, complete_outer = base_fixture(output)
    (output / "good.contract.json").write_bytes(json_bytes(good_contract))

    hash_tamper = bytearray(good_path.read_bytes())
    hash_tamper[min(100, len(hash_tamper) - 1)] ^= 1
    hash_path = output / "hash-tamper.zip"
    hash_path.write_bytes(hash_tamper)
    hash_contract = deepcopy(good_contract)
    hash_contract["handoff"]["basename"] = hash_path.name
    (output / "hash-tamper.contract.json").write_bytes(json_bytes(hash_contract))

    unsafe_payloads = {**complete_outer, "../escape.txt": b"unsafe\n"}
    unsafe_path = output / "unsafe.zip"
    unsafe_bytes = write_zip(unsafe_path, unsafe_payloads)
    unsafe_contract = deepcopy(good_contract)
    unsafe_contract["handoff"].update(
        {
            "basename": unsafe_path.name,
            "sha256": sha256(unsafe_bytes),
            "bytes": len(unsafe_bytes),
            "entries": 25,
        }
    )
    (output / "unsafe.contract.json").write_bytes(json_bytes(unsafe_contract))

    manifest_tamper_payloads = dict(complete_outer)
    manifest_tamper_payloads["a12c3-art-audit.json"] = json_bytes(
        {"tampered": True}
    )
    manifest_path = output / "manifest-tamper.zip"
    manifest_bytes = write_zip(manifest_path, manifest_tamper_payloads)
    manifest_contract = deepcopy(good_contract)
    manifest_contract["handoff"].update(
        {
            "basename": manifest_path.name,
            "sha256": sha256(manifest_bytes),
            "bytes": len(manifest_bytes),
        }
    )
    (output / "manifest-tamper.contract.json").write_bytes(
        json_bytes(manifest_contract)
    )

    summary = {
        "format": "burn-protocol-handoff-fixture-set/1",
        "classification": "synthetic-mechanism-test-only",
        "good": good_path.name,
        "hashTamper": hash_path.name,
        "unsafe": unsafe_path.name,
        "manifestTamper": manifest_path.name,
    }
    (output / "fixture-set.json").write_bytes(json_bytes(summary))
    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
