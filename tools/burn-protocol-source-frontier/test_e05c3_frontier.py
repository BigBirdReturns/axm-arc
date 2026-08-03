from __future__ import annotations

import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
CONTRACT = ROOT / "contracts" / "e05c3-source-intake.contract.json"
WORKFLOW = REPO / ".github" / "workflows" / "burn-protocol-e05c3-source-harvest.yml"
ACTIVE = ROOT / "active-frontier.json"


class Episode5Chapter3FrontierTest(unittest.TestCase):
    def test_contract_is_exactly_bound_to_e05c3(self) -> None:
        contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
        self.assertEqual(
            contract["format"],
            "burn-protocol-source-frontier-recovery-contract/1",
        )
        self.assertEqual(contract["release"], "0.62.0")
        self.assertEqual(contract["parent"]["bytes"], 641_627_846)
        self.assertEqual(
            contract["parent"]["sha256"],
            "f67dcd2c632720566e38b04c0a6b844188de24c967a77a4be31978a5ff82349a",
        )
        selection = contract["selection"]
        self.assertEqual(selection["episode"], 5)
        self.assertEqual(selection["chapter"], 3)
        self.assertEqual(selection["tokens"], ["episode-05", "e05-c3", "a05c3"])
        expected = set(selection["expectedPaths"])
        self.assertIn("source/art/A05C3/chapter.json", expected)
        self.assertIn("source/art/A05C3/lettering.json", expected)
        self.assertIn("source/art/A05C3/panel-art.json", expected)
        self.assertIn("source/art/A05C3/provenance.json", expected)
        self.assertIn("manifests/a05c3-recovery.json", expected)
        self.assertIn("manifests/a05c3-scroll-plates.json", expected)
        self.assertIn("site/assets/art/A05C3/panels/E05-C3-P41.webp", expected)
        self.assertIn("site/assets/art/A05C3/plates/A05C3-plate-01.webp", expected)
        self.assertFalse(any("A05C2" in path or "E05-C2" in path for path in expected))
        self.assertEqual(
            contract["evidenceBoundary"]["continuationPanelId"],
            "E05-C3-P41",
        )
        self.assertFalse(contract["evidenceBoundary"]["exactBytesOrHashesClaimed"])

    def test_active_record_binds_the_singular_e05c3_workflow(self) -> None:
        active = json.loads(ACTIVE.read_text(encoding="utf-8"))
        workflow = WORKFLOW.read_text(encoding="utf-8")
        self.assertEqual(active["format"], "burn-protocol-active-source-frontier/1")
        self.assertEqual(active["acceptedThrough"], "E05-C2-P40")
        self.assertEqual(active["frontier"], "E05-C3-P41")
        self.assertEqual(active["episode"], 5)
        self.assertEqual(active["chapter"], 3)
        self.assertEqual(
            active["contractPath"],
            CONTRACT.relative_to(REPO).as_posix(),
        )
        self.assertEqual(active["workflowPath"], WORKFLOW.relative_to(REPO).as_posix())
        self.assertIn("e05c3-source-intake.contract.json", workflow)
        self.assertIn("active-frontier.json", workflow)
        self.assertIn("workstation action         none", workflow)
        self.assertIn('cron: "37 */12 * * *"', workflow)
        self.assertNotIn("e05c2-source-intake.contract.json", workflow)


if __name__ == "__main__":
    unittest.main(verbosity=2)
