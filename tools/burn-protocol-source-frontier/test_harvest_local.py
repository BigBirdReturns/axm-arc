from __future__ import annotations

import tempfile
import unittest
import zipfile
from pathlib import Path

from harvest_test_support import read_receipt, run_harvest
from test_recover import PARENT_BASENAME, build_parent, write_contract, zip_info


class BurnSourceHarvesterLocalTests(unittest.TestCase):
    def test_local_exact_parent_is_recovered_without_workstation_authority(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            parent = build_parent(root)
            contract = write_contract(root, parent)
            output = root / "harvest"
            result = run_harvest("--candidate", str(parent), "--contract", str(contract), "--output", str(output))
            self.assertEqual(result.returncode, 0, result.stderr)
            receipt = read_receipt(output)
            self.assertEqual(receipt["status"], "verified-frontier-evidence")
            self.assertFalse(receipt["authority"]["humanWorkstationRequired"])
            self.assertTrue((output / "recovery" / "RECOVERY_RECEIPT.json").is_file())

    def test_recursive_local_sweep_ignores_decoys_and_accepts_nested_parent(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            parent = build_parent(root)
            contract = write_contract(root, parent)
            candidates = root / "candidates"
            candidates.mkdir()
            (candidates / "000-decoy.zip").write_bytes(b"not a zip")
            handoff = candidates / "burn-handoff.zip"
            with zipfile.ZipFile(handoff, "w") as archive:
                archive.writestr(zip_info(f"estate/{PARENT_BASENAME}"), parent.read_bytes())
            output = root / "harvest"
            result = run_harvest(
                "--candidate-directory", str(candidates), "--contract", str(contract), "--output", str(output)
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            receipt = read_receipt(output)
            self.assertEqual(receipt["status"], "verified-frontier-evidence")
            self.assertEqual(receipt["summary"]["candidates"], 2)

    def test_source_absence_is_an_audited_green_result(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            parent = build_parent(root)
            contract = write_contract(root, parent)
            decoy = root / "decoy.zip"
            with zipfile.ZipFile(decoy, "w") as archive:
                archive.writestr(zip_info("README.txt"), b"no source here\n")
            output = root / "harvest"
            result = run_harvest("--candidate", str(decoy), "--contract", str(contract), "--output", str(output))
            self.assertEqual(result.returncode, 0, result.stderr)
            receipt = read_receipt(output)
            self.assertEqual(receipt["status"], "source-not-found")
            self.assertEqual(receipt["checked"][0]["outcome"], "not-exact-parent")
            self.assertTrue((output / "SHA256SUMS").is_file())

    def test_require_source_can_fail_without_destroying_the_absence_receipt(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            parent = build_parent(root)
            contract = write_contract(root, parent)
            decoy = root / "decoy.zip"
            with zipfile.ZipFile(decoy, "w") as archive:
                archive.writestr(zip_info("README.txt"), b"no source here\n")
            output = root / "harvest"
            result = run_harvest(
                "--candidate", str(decoy), "--contract", str(contract), "--output", str(output), "--require-source"
            )
            self.assertEqual(result.returncode, 4, result.stderr)
            self.assertEqual(read_receipt(output)["status"], "source-not-found")


if __name__ == "__main__":
    unittest.main(verbosity=2)
