from __future__ import annotations

import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CONTRACT = ROOT / "contracts" / "e05c2-source-intake.contract.json"
WORKFLOW = (
    ROOT.parent.parent
    / ".github"
    / "workflows"
    / "burn-protocol-e05c2-source-harvest.yml"
)


class Episode5Chapter2FrontierTest(unittest.TestCase):
    def test_contract_is_exactly_bound_to_e05c2(self) -> None:
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
        self.assertEqual(selection["chapter"], 2)
        self.assertEqual(selection["tokens"], ["episode-05", "e05-c2", "a05c2"])
        expected = set(selection["expectedPaths"])
        self.assertIn("source/art/A05C2/chapter.json", expected)
        self.assertIn("source/art/A05C2/lettering.json", expected)
        self.assertIn("manifests/a05c2-scroll-plates.json", expected)
        self.assertIn("site/assets/art/A05C2/panels/E05-C2-P21.webp", expected)
        self.assertIn("site/assets/art/A05C2/plates/A05C2-plate-01.webp", expected)
        self.assertFalse(any("A05C1" in path or "E05-C1" in path for path in expected))
        self.assertEqual(
            contract["evidenceBoundary"]["continuationPanelId"],
            "E05-C2-P21",
        )
        self.assertFalse(contract["evidenceBoundary"]["exactBytesOrHashesClaimed"])

    def test_workflow_uses_the_e05c2_contract_without_workstation_action(self) -> None:
        workflow = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("e05c2-source-intake.contract.json", workflow)
        self.assertIn("E05-C2-P21", workflow)
        self.assertIn("workstation action         none", workflow)
        self.assertIn('cron: "37 */12 * * *"', workflow)
        self.assertNotIn("e05c1-source-intake.contract.json", workflow)


if __name__ == "__main__":
    unittest.main()
