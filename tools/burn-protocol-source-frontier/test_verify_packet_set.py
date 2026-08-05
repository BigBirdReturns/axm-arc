from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
TOOL = HERE / "verify_packet_set.py"
FIXED = (1980, 1, 1, 0, 0, 0)
PARENT = "Star_Trek_Discovery_The_Burn_Protocol_Web_Series_v0.62.0.zip"
MANIFEST = "v0.62.0-file-manifest.json"
PARENT_HASH = "f67dcd2c632720566e38b04c0a6b844188de24c967a77a4be31978a5ff82349a"


def sha(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha_file(path: Path) -> str:
    return sha(path.read_bytes())


def canonical(value: object) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def info(name: str) -> zipfile.ZipInfo:
    value = zipfile.ZipInfo(name, FIXED)
    value.compress_type = zipfile.ZIP_STORED
    value.create_system = 3
    value.external_attr = 0o100644 << 16
    return value


def files(change_panel: bool = False) -> dict[str, bytes]:
    panel = b"changed-panel\n" if change_panel else b"panel\n"
    return {
        "source/episodes/episode-05.json": b'{"episode":5}\n',
        "site/data/episode-05.json": b'{"compiled":5}\n',
        "scripts/episode-05-fixture.md": b"# Episode 5\n",
        "source/art/A05C1/chapter.json": b'{"chapter":"E05-C1"}\n',
        "source/art/A05C1/lettering.json": b'{"lettering":true}\n',
        "source/art/A05C1/panel-art.json": b'{"panels":1}\n',
        "source/art/A05C1/provenance.json": b'{"provenance":true}\n',
        "manifests/a05c1-recovery.json": b'{"recovered":true}\n',
        "manifests/a05c1-scroll-plates.json": b'{"plates":1}\n',
        "site/assets/art/A05C1/panels/E05-C1-P01.webp": panel,
        "site/assets/art/A05C1/plates/A05C1-plate-01.webp": b"plate\n",
    }


def classification(path: str) -> str:
    if "/panels/" in path:
        return "panel-raster"
    if "/plates/" in path:
        return "plate-raster"
    if path.startswith("source/episodes/"):
        return "canonical-episode-source"
    if path.startswith("site/data/"):
        return "compiled-reader-source"
    if path.startswith("scripts/"):
        return "canonical-script-render"
    if path.endswith("/chapter.json"):
        return "chapter-source"
    if path.endswith("/lettering.json"):
        return "canonical-lettering"
    if path.endswith("/panel-art.json"):
        return "chapter-panel-art-source"
    if path.endswith("/provenance.json"):
        return "chapter-provenance"
    if path.endswith("-recovery.json"):
        return "chapter-recovery-receipt"
    if path.endswith("-scroll-plates.json"):
        return "plate-map"
    raise AssertionError(path)


def build(root: Path, *, change_panel: bool = False, duplicate_payload: bool = False) -> tuple[Path, Path]:
    source = files(change_panel)
    selected = [
        {"path": path, "bytes": len(data), "sha256": sha(data)}
        for path, data in sorted(source.items())
    ]
    unrelated = {"path": "unrelated/ignored.txt", "bytes": 8, "sha256": sha(b"ignored\n")}
    manifest_bytes = canonical({"format": "fixture-manifest/1", "files": selected + [unrelated]})
    manifest_receipt = {
        "path": MANIFEST,
        "bytes": len(manifest_bytes),
        "sha256": sha(manifest_bytes),
        "records": len(selected) + 1,
        "totalUncompressedBytes": sum(row["bytes"] for row in selected) + unrelated["bytes"],
        "recordCollection": "root.files",
    }
    required = {classification(row["path"]): 1 for row in selected}
    expected = [row["path"] for row in selected]
    contract = {
        "format": "burn-protocol-source-frontier-recovery-contract/1",
        "parent": {
            "basename": PARENT,
            "bytes": 641627846,
            "sha256": PARENT_HASH,
            "manifestBasename": MANIFEST,
        },
        "release": "0.62.0",
        "selection": {
            "episode": 5,
            "chapter": 1,
            "tokens": ["episode-05", "e05-c1", "a05c1"],
            "expectedPaths": expected,
            "requiredClassifications": required,
        },
    }
    contract_path = root / "contract.json"
    contract_path.write_text(json.dumps(contract, indent=2, sort_keys=True) + "\n")
    recovery = root / "recovery"
    recovery.mkdir()
    (recovery / MANIFEST).write_bytes(manifest_bytes)
    (recovery / "SELECTED_MANIFEST.json").write_bytes(
        canonical({"format": "burn-protocol-selected-manifest/1", "files": selected})
    )
    counts: dict[str, int] = {}
    for row in selected:
        kind = classification(row["path"])
        counts[kind] = counts.get(kind, 0) + 1

    groups = [selected[:6], selected[6:]]
    packet_rows = []
    for index, group in enumerate(groups, 1):
        name = f"burn-protocol-v0.62.0-E05-C1-intake-packet-{index:03d}-of-002.zip"
        packet_document = {
            "format": "burn-protocol-source-frontier-packet/1",
            "toolVersion": "fixture",
            "release": "0.62.0",
            "episode": 5,
            "chapter": 1,
            "packet": index,
            "packets": 2,
            "manifest": manifest_receipt,
            "parent": {"basename": PARENT, "bytes": 641627846, "sha256": PARENT_HASH},
            "files": [{**row, "classification": classification(row["path"])} for row in group],
        }
        if duplicate_payload and index == 2:
            duplicate = selected[0]
            packet_document["files"].append(
                {**duplicate, "classification": classification(duplicate["path"])}
            )
        packet_path = recovery / name
        with zipfile.ZipFile(packet_path, "w") as packet:
            packet.writestr(info("PACKET.json"), canonical(packet_document))
            for row in group:
                packet.writestr(info(row["path"]), source[row["path"]])
            if duplicate_payload and index == 2:
                packet.writestr(info(selected[0]["path"]), source[selected[0]["path"]])
        packet_rows.append(
            {
                "path": name,
                "bytes": packet_path.stat().st_size,
                "sha256": sha_file(packet_path),
                "files": len(packet_document["files"]),
                "payloadBytes": sum(row["bytes"] for row in packet_document["files"]),
            }
        )

    receipt = {
        "format": "burn-protocol-source-frontier-recovery/1",
        "toolVersion": "fixture",
        "status": "verified-frontier-evidence",
        "release": "0.62.0",
        "selection": {
            "episode": 5,
            "chapter": 1,
            "tokens": ["episode-05", "e05-c1", "a05c1"],
            "expectedPathsPresent": expected,
            "expectedPathsMissing": [],
            "requiredClassifications": dict(sorted(required.items())),
            "missingClassifications": {},
        },
        "source": {
            "sourceKind": "direct-parent",
            "parent": {"basename": PARENT, "bytes": 641627846, "sha256": PARENT_HASH},
        },
        "manifest": manifest_receipt,
        "selected": {
            "files": len(selected),
            "bytes": sum(row["bytes"] for row in selected),
            "counts": dict(sorted(counts.items())),
        },
        "packets": packet_rows,
    }
    (recovery / "RECOVERY_RECEIPT.json").write_bytes(canonical(receipt))
    sums = []
    for path in sorted(recovery.iterdir()):
        if path.is_file() and path.name != "SHA256SUMS":
            sums.append(f"{sha_file(path)}  {path.name}")
    (recovery / "SHA256SUMS").write_text("\n".join(sums) + "\n")
    return recovery, contract_path


def run(input_path: Path, contract: Path, output: Path, approval: str | None = None) -> subprocess.CompletedProcess[str]:
    arguments = [
        sys.executable,
        str(TOOL),
        "--input",
        str(input_path),
        "--contract",
        str(contract),
        "--output",
        str(output),
    ]
    if approval:
        arguments += ["--approved-packet-set-sha256", approval]
    return subprocess.run(arguments, text=True, capture_output=True, check=False)


class PacketSetTests(unittest.TestCase):
    def test_exact_packet_set_is_byte_verified_but_requires_external_approval(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            recovery, contract = build(root)
            output = root / "out"
            result = run(recovery, contract, output)
            self.assertEqual(result.returncode, 3, result.stderr)
            receipt = json.loads((output / "PACKET_SET_VERIFICATION_RECEIPT.json").read_text())
            self.assertEqual(receipt["status"], "approval-required")
            self.assertEqual(receipt["standing"], "byte-verified-approval-required")
            self.assertEqual(receipt["selected"]["files"], 11)

    def test_external_exact_set_pin_promotes_transport_standing(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            recovery, contract = build(root)
            first = root / "first"
            self.assertEqual(run(recovery, contract, first).returncode, 3)
            digest = json.loads(
                (first / "PACKET_SET_VERIFICATION_RECEIPT.json").read_text()
            )["packetSetSha256"]
            second = root / "second"
            result = run(recovery, contract, second, digest)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(
                json.loads((second / "PACKET_SET_VERIFICATION_RECEIPT.json").read_text())["standing"],
                "transport-approved",
            )

    def test_packet_tamper_is_refused_before_approval(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            recovery, contract = build(root)
            packet = next(recovery.glob("*packet-001*.zip"))
            packet.write_bytes(packet.read_bytes() + b"tamper")
            result = run(recovery, contract, root / "out")
            self.assertEqual(result.returncode, 2)
            self.assertIn("SHA-256 mismatch", result.stderr)

    def test_coherent_different_set_cannot_reuse_old_approval(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            first_root = root / "a"
            first_root.mkdir()
            recovery_a, contract_a = build(first_root)
            first_output = first_root / "out"
            self.assertEqual(run(recovery_a, contract_a, first_output).returncode, 3)
            digest = json.loads(
                (first_output / "PACKET_SET_VERIFICATION_RECEIPT.json").read_text()
            )["packetSetSha256"]

            second_root = root / "b"
            second_root.mkdir()
            recovery_b, contract_b = build(second_root, change_panel=True)
            result = run(recovery_b, contract_b, second_root / "out", digest)
            self.assertEqual(result.returncode, 2)
            self.assertIn("Approved packet-set SHA-256", result.stderr)

    def test_missing_packet_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            recovery, contract = build(root)
            next(recovery.glob("*packet-002*.zip")).unlink()
            result = run(recovery, contract, root / "out")
            self.assertEqual(result.returncode, 2)
            self.assertIn("does not cover the exact", result.stderr)

    def test_duplicate_payload_across_packets_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            recovery, contract = build(root, duplicate_payload=True)
            result = run(recovery, contract, root / "out")
            self.assertEqual(result.returncode, 2)
            self.assertIn("duplicates payload", result.stderr)

    def test_safe_nested_wrapper_is_supported(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            recovery, contract = build(root)
            wrapper = root / "wrapper.zip"
            with zipfile.ZipFile(wrapper, "w") as archive:
                for path in recovery.iterdir():
                    archive.write(path, f"artifact/recovery/{path.name}")
            result = run(wrapper, contract, root / "out")
            self.assertEqual(result.returncode, 3, result.stderr)

    def test_unsafe_wrapper_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _, contract = build(root)
            wrapper = root / "unsafe.zip"
            with zipfile.ZipFile(wrapper, "w") as archive:
                archive.writestr("../escape.txt", b"escape")
            result = run(wrapper, contract, root / "out")
            self.assertEqual(result.returncode, 2)
            self.assertIn("Unsafe path", result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
