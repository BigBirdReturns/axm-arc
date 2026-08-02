from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from typing import Iterable

HERE = Path(__file__).resolve().parent
TOOL = HERE / "recover.py"
MANIFEST_BASENAME = "v0.62.0-file-manifest.json"
PARENT_BASENAME = "Star_Trek_Discovery_The_Burn_Protocol_Web_Series_v0.62.0.zip"
FIXED_ZIP_TIME = (1980, 1, 1, 0, 0, 0)

REQUIRED_CLASSIFICATIONS = {
    "canonical-episode-source": 1,
    "compiled-reader-source": 1,
    "canonical-script-render": 1,
    "chapter-source": 1,
    "canonical-lettering": 1,
    "chapter-panel-art-source": 1,
    "chapter-provenance": 1,
    "chapter-recovery-receipt": 1,
    "plate-map": 1,
    "panel-raster": 1,
    "plate-raster": 1,
}


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def zip_info(name: str) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name, date_time=FIXED_ZIP_TIME)
    info.compress_type = zipfile.ZIP_STORED
    info.create_system = 3
    info.external_attr = 0o100644 << 16
    return info


def fixture_files(*, large_assets: bool = False) -> dict[str, bytes]:
    panel = (b"panel-21\n" * 80_000) if large_assets else b"panel-21\n"
    plate = (b"plate-01\n" * 80_000) if large_assets else b"plate-01\n"
    return {
        "source/episodes/episode-04.json": b'{"episode":4}\n',
        "site/data/episode-04.json": b'{"compiled":4}\n',
        "scripts/episode-04-fractured-allegiances.md": b"# Episode 4\n",
        "source/art/A04C2/chapter.json": b'{"chapter":"E04-C2"}\n',
        "source/art/A04C2/lettering.json": b'{"status":"source"}\n',
        "source/art/A04C2/panel-art.json": b'{"panels":1}\n',
        "source/art/A04C2/provenance.json": b'{"authority":"fixture"}\n',
        "manifests/a04c2-recovery.json": b'{"recovery":true}\n',
        "manifests/a04c2-scroll-plates.json": b'{"plates":1}\n',
        "site/assets/art/A04C2/panels/E04-C2-P21.webp": panel,
        "site/assets/art/A04C2/plates/A04C2-plate-01.webp": plate,
        "unrelated/keep-out.txt": b"not selected\n",
    }


def build_parent(
    root: Path,
    *,
    omit: Iterable[str] = (),
    tamper_manifest_path: str | None = None,
    unsafe_entry: str | None = None,
    large_assets: bool = False,
    duplicate_manifest_path: str | None = None,
) -> Path:
    omitted = set(omit)
    files = {path: data for path, data in fixture_files(large_assets=large_assets).items() if path not in omitted}
    records = []
    for path, data in sorted(files.items()):
        digest = sha256_bytes(data)
        if path == tamper_manifest_path:
            digest = "0" * 64
        record = {"path": path, "bytes": len(data), "sha256": digest}
        records.append(record)
        if path == duplicate_manifest_path:
            records.append(dict(record))
    manifest = json.dumps(
        {"format": "burn-protocol-test-manifest/1", "files": records},
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8") + b"\n"

    parent = root / PARENT_BASENAME
    with zipfile.ZipFile(parent, "w", allowZip64=True) as archive:
        archive.writestr(zip_info(MANIFEST_BASENAME), manifest)
        for path, data in sorted(files.items()):
            archive.writestr(zip_info(path), data)
        if unsafe_entry is not None:
            archive.writestr(zip_info(unsafe_entry), b"unsafe\n")
    return parent


def write_contract(root: Path, parent: Path) -> Path:
    contract = {
        "format": "burn-protocol-source-frontier-recovery-contract/1",
        "parent": {
            "basename": PARENT_BASENAME,
            "bytes": parent.stat().st_size,
            "manifestBasename": MANIFEST_BASENAME,
            "sha256": sha256_file(parent),
        },
        "release": "test",
        "selection": {
            "episode": 4,
            "chapter": 2,
            "tokens": ["episode-04", "e04-c2", "a04c2"],
            "requiredClassifications": REQUIRED_CLASSIFICATIONS,
        },
        "evidenceBoundary": {
            "status": "source-required",
            "continuationPanelId": "E04-C2-P21",
            "exactBytesOrHashesClaimed": False,
        },
    }
    path = root / "contract.json"
    path.write_text(json.dumps(contract, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return path


def run_tool(input_path: Path, contract: Path, output: Path, *, max_packet_bytes: int = 209_715_200) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(TOOL),
            "--input",
            str(input_path),
            "--contract",
            str(contract),
            "--output",
            str(output),
            "--max-packet-bytes",
            str(max_packet_bytes),
        ],
        text=True,
        capture_output=True,
        check=False,
    )


def verify_sha256sums(root: Path) -> None:
    lines = (root / "SHA256SUMS").read_text(encoding="utf-8").splitlines()
    assert lines
    for line in lines:
        digest, name = line.split("  ", 1)
        assert sha256_file(root / name) == digest


def output_fingerprint(root: Path) -> list[tuple[str, int, str]]:
    return [
        (path.name, path.stat().st_size, sha256_file(path))
        for path in sorted(root.iterdir(), key=lambda candidate: candidate.name)
        if path.is_file()
    ]


class BurnSourceFrontierRecoveryTests(unittest.TestCase):
    def test_production_contract_pins_only_parent_and_admission_law(self) -> None:
        contract = json.loads(
            (HERE / "contracts" / "e04c2-source-intake.contract.json").read_text(encoding="utf-8")
        )
        self.assertEqual(contract["parent"]["bytes"], 641627846)
        self.assertEqual(
            contract["parent"]["sha256"],
            "f67dcd2c632720566e38b04c0a6b844188de24c967a77a4be31978a5ff82349a",
        )
        self.assertEqual(contract["evidenceBoundary"]["continuationPanelId"], "E04-C2-P21")
        self.assertFalse(contract["evidenceBoundary"]["exactBytesOrHashesClaimed"])
        self.assertNotIn("expectedPaths", contract["selection"])
        self.assertEqual(contract["selection"]["requiredClassifications"], REQUIRED_CLASSIFICATIONS)

    def test_direct_parent_recovers_verified_deterministic_packets(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            parent = build_parent(root, large_assets=True)
            contract = write_contract(root, parent)
            first = root / "first"
            second = root / "second"

            result = run_tool(parent, contract, first, max_packet_bytes=3 * 1024 * 1024)
            self.assertEqual(result.returncode, 0, result.stderr)
            receipt = json.loads((first / "RECOVERY_RECEIPT.json").read_text(encoding="utf-8"))
            self.assertEqual(receipt["status"], "verified-frontier-evidence")
            self.assertEqual(receipt["source"]["sourceKind"], "direct-parent")
            self.assertEqual(receipt["selection"]["missingClassifications"], {})
            self.assertGreaterEqual(len(receipt["packets"]), 2)
            self.assertNotIn("unrelated/keep-out.txt", {
                row["path"] for row in json.loads((first / "SELECTED_MANIFEST.json").read_text())["files"]
            })
            verify_sha256sums(first)

            result_again = run_tool(parent, contract, second, max_packet_bytes=3 * 1024 * 1024)
            self.assertEqual(result_again.returncode, 0, result_again.stderr)
            self.assertEqual(output_fingerprint(first), output_fingerprint(second))

    def test_handoff_with_one_exact_nested_parent_is_accepted(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            parent = build_parent(root)
            contract = write_contract(root, parent)
            handoff = root / "handoff.zip"
            with zipfile.ZipFile(handoff, "w", allowZip64=True) as archive:
                archive.writestr(zip_info(f"estate/{PARENT_BASENAME}"), parent.read_bytes())
                archive.writestr(zip_info("README.txt"), b"fixture handoff\n")

            output = root / "output"
            result = run_tool(handoff, contract, output)
            self.assertEqual(result.returncode, 0, result.stderr)
            receipt = json.loads((output / "RECOVERY_RECEIPT.json").read_text(encoding="utf-8"))
            self.assertEqual(receipt["source"]["sourceKind"], "nested-parent")
            verify_sha256sums(output)

    def test_missing_required_classification_remains_source_required(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            parent = build_parent(root, omit={"manifests/a04c2-scroll-plates.json"})
            contract = write_contract(root, parent)
            output = root / "output"

            result = run_tool(parent, contract, output)
            self.assertEqual(result.returncode, 3, result.stderr)
            receipt = json.loads((output / "RECOVERY_RECEIPT.json").read_text(encoding="utf-8"))
            self.assertEqual(receipt["status"], "source-required")
            self.assertEqual(
                receipt["selection"]["missingClassifications"]["plate-map"],
                {"required": 1, "found": 0},
            )
            verify_sha256sums(output)

    def test_duplicate_manifest_path_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            duplicated = "source/art/A04C2/chapter.json"
            parent = build_parent(root, duplicate_manifest_path=duplicated)
            contract = write_contract(root, parent)
            output = root / "output"

            result = run_tool(parent, contract, output)
            self.assertEqual(result.returncode, 2)
            self.assertIn("duplicates", result.stderr.lower())
            self.assertFalse(output.exists())

    def test_corrupt_pinned_parent_is_a_clean_custody_refusal(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            parent = root / PARENT_BASENAME
            parent.write_bytes(b"not a zip archive\n")
            contract = write_contract(root, parent)
            output = root / "output"

            result = run_tool(parent, contract, output)
            self.assertEqual(result.returncode, 2)
            self.assertIn("archive or filesystem verification failed", result.stderr.lower())
            self.assertFalse(output.exists())

    def test_manifest_digest_mismatch_fails_closed_and_removes_output(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            panel = "site/assets/art/A04C2/panels/E04-C2-P21.webp"
            parent = build_parent(root, tamper_manifest_path=panel)
            contract = write_contract(root, parent)
            output = root / "output"

            result = run_tool(parent, contract, output)
            self.assertEqual(result.returncode, 2)
            self.assertIn("Manifest SHA-256", result.stderr)
            self.assertFalse(output.exists())

    def test_wrong_parent_receipt_fails_before_manifest_use(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            parent = build_parent(root)
            contract = write_contract(root, parent)
            document = json.loads(contract.read_text(encoding="utf-8"))
            document["parent"]["sha256"] = "f" * 64
            contract.write_text(json.dumps(document), encoding="utf-8")
            output = root / "output"

            result = run_tool(parent, contract, output)
            self.assertEqual(result.returncode, 2)
            self.assertIn("Parent SHA-256", result.stderr)
            self.assertFalse(output.exists())

    def test_unsafe_parent_entry_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            parent = build_parent(root, unsafe_entry="../escape.txt")
            contract = write_contract(root, parent)
            output = root / "output"

            result = run_tool(parent, contract, output)
            self.assertEqual(result.returncode, 2)
            self.assertIn("unsafe", result.stderr.lower())
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
