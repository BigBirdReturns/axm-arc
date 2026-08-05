from __future__ import annotations

import json
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONTRACT = HERE / "contracts" / "e05c1-source-intake.contract.json"


class BurnSourceHarvesterContractTests(unittest.TestCase):
    def test_e05c1_contract_pins_parent_without_inventing_episode_five_identity(self) -> None:
        value = json.loads(CONTRACT.read_text(encoding="utf-8"))
        self.assertEqual(value["parent"]["bytes"], 641_627_846)
        self.assertEqual(
            value["parent"]["sha256"],
            "f67dcd2c632720566e38b04c0a6b844188de24c967a77a4be31978a5ff82349a",
        )
        self.assertEqual(value["selection"]["episode"], 5)
        self.assertEqual(value["selection"]["chapter"], 1)
        self.assertEqual(value["evidenceBoundary"]["continuationPanelId"], "E05-C1-P01")
        expected = set(value["selection"]["expectedPaths"])
        self.assertTrue({
            "source/episodes/episode-05.json",
            "site/data/episode-05.json",
            "source/art/A05C1/chapter.json",
            "source/art/A05C1/lettering.json",
            "source/art/A05C1/panel-art.json",
            "source/art/A05C1/provenance.json",
            "manifests/a05c1-recovery.json",
            "manifests/a05c1-scroll-plates.json",
            "site/assets/art/A05C1/panels/E05-C1-P01.webp",
            "site/assets/art/A05C1/plates/A05C1-plate-01.webp",
        }.issubset(expected))
        self.assertFalse(any(path.startswith("scripts/episode-05-") for path in expected))
        self.assertEqual(
            value["selection"]["requiredClassifications"]["canonical-script-render"],
            1,
        )
        self.assertFalse(value["evidenceBoundary"]["exactBytesOrHashesClaimed"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
