from __future__ import annotations

import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from harvest_test_support import FixtureServer, read_receipt, run_harvest
from test_recover import PARENT_BASENAME, build_parent, run_tool, write_contract, zip_info
from test_verify_packet_set import build as build_packet_set


def wrap_recovery(root: Path, recovery: Path, name: str = "packet-set.zip") -> Path:
    wrapper = root / name
    with zipfile.ZipFile(wrapper, "w") as archive:
        for path in sorted(recovery.iterdir()):
            if path.is_file():
                archive.write(path, f"artifact/recovery/{path.name}")
    return wrapper


class BurnPacketSetHarvestTests(unittest.TestCase):
    def test_remote_packet_set_is_reported_without_source_standing(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            recovery, contract = build_packet_set(root)
            wrapper = wrap_recovery(root, recovery)
            with FixtureServer(wrapper.read_bytes()) as api_url:
                output = root / "harvest"
                result = run_harvest(
                    "--repository", "fixture/repo",
                    "--github-api-url", api_url,
                    "--contract", str(contract),
                    "--output", str(output),
                )
            self.assertEqual(result.returncode, 3, result.stderr)
            receipt = read_receipt(output)
            self.assertEqual(receipt["status"], "packet-set-approval-required")
            self.assertIsNone(receipt["foundIdentity"])
            self.assertEqual(receipt["summary"]["packetSetCandidates"], 1)
            candidate = receipt["packetSetCandidates"][0]
            self.assertFalse(candidate["approved"])
            self.assertEqual(candidate["standing"], "byte-verified-approval-required")
            self.assertEqual(receipt["checked"][0]["outcome"], "packet-set-approval-required")
            self.assertFalse((output / "packet-set-verification").exists())

    def test_external_packet_set_pin_admits_transport(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            recovery, contract = build_packet_set(root)
            wrapper = wrap_recovery(root, recovery)
            first = root / "first"
            first_result = run_harvest(
                "--candidate", str(wrapper),
                "--contract", str(contract),
                "--output", str(first),
            )
            self.assertEqual(first_result.returncode, 3, first_result.stderr)
            digest = read_receipt(first)["packetSetCandidates"][0]["packetSetSha256"]

            second = root / "second"
            result = run_harvest(
                "--candidate", str(wrapper),
                "--contract", str(contract),
                "--approved-packet-set-sha256", digest,
                "--output", str(second),
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            receipt = read_receipt(second)
            self.assertEqual(receipt["status"], "verified-frontier-packet-set")
            self.assertEqual(receipt["foundEvidenceKind"], "approved-packet-set")
            self.assertEqual(receipt["foundPacketSetSha256"], digest)
            self.assertEqual(receipt["summary"]["approvedPacketSets"], 1)
            verification = json.loads(
                (second / "packet-set-verification" / "PACKET_SET_VERIFICATION_RECEIPT.json").read_text()
            )
            self.assertEqual(verification["standing"], "transport-approved")

    def test_changed_packet_set_cannot_reuse_old_approval(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            first_root = root / "first-set"
            first_root.mkdir()
            recovery_a, contract_a = build_packet_set(first_root)
            wrapper_a = wrap_recovery(first_root, recovery_a)
            first_output = first_root / "harvest"
            self.assertEqual(
                run_harvest(
                    "--candidate", str(wrapper_a),
                    "--contract", str(contract_a),
                    "--output", str(first_output),
                ).returncode,
                3,
            )
            digest = read_receipt(first_output)["packetSetCandidates"][0]["packetSetSha256"]

            second_root = root / "second-set"
            second_root.mkdir()
            recovery_b, contract_b = build_packet_set(second_root, change_panel=True)
            wrapper_b = wrap_recovery(second_root, recovery_b)
            second_output = second_root / "harvest"
            result = run_harvest(
                "--candidate", str(wrapper_b),
                "--contract", str(contract_b),
                "--approved-packet-set-sha256", digest,
                "--output", str(second_output),
            )
            self.assertEqual(result.returncode, 3, result.stderr)
            receipt = read_receipt(second_output)
            self.assertEqual(receipt["status"], "packet-set-approval-required")
            self.assertNotEqual(receipt["packetSetCandidates"][0]["packetSetSha256"], digest)
            self.assertFalse(receipt["packetSetCandidates"][0]["approved"])

    def test_exact_parent_takes_precedence_over_packet_set_material(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            parent = build_parent(root)
            contract = write_contract(root, parent)
            recovery = root / "recovery"
            recovered = run_tool(parent, contract, recovery)
            self.assertEqual(recovered.returncode, 0, recovered.stderr)
            wrapper = root / "parent-and-packets.zip"
            with zipfile.ZipFile(wrapper, "w") as archive:
                archive.writestr(zip_info(f"estate/{PARENT_BASENAME}"), parent.read_bytes())
                for path in sorted(recovery.iterdir()):
                    if path.is_file():
                        archive.write(path, f"recovery/{path.name}")

            output = root / "harvest"
            result = run_harvest(
                "--candidate", str(wrapper),
                "--contract", str(contract),
                "--output", str(output),
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            receipt = read_receipt(output)
            self.assertEqual(receipt["status"], "verified-frontier-evidence")
            self.assertEqual(receipt["foundEvidenceKind"], "exact-parent")
            self.assertEqual(receipt["packetSetCandidates"], [])
            self.assertTrue((output / "recovery" / "RECOVERY_RECEIPT.json").is_file())

    def test_invalid_packet_set_approval_pin_fails_before_search(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            result = run_harvest(
                "--approved-packet-set-sha256", "not-a-digest",
                "--output", str(root / "harvest"),
            )
            self.assertEqual(result.returncode, 2)
            self.assertIn("approved packet set", result.stderr.lower())


if __name__ == "__main__":
    unittest.main(verbosity=2)
