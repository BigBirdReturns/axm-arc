from __future__ import annotations

import json
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONTRACT = HERE / "contracts" / "e04c3-source-intake.contract.json"


class BurnSourceHarvesterContractTests(unittest.TestCase):
    def test_e04c3_contract_pins_parent_and_exact_chapter_frontier(self) -> None:
        value = json.loads(CONTRACT.read_text(encoding="utf-8"))
        self.assertEqual(value["parent"]["bytes"], 641_627_846)
        self.assertEqual(
            value["parent"]["sha256"],
            "f67dcd2c632720566e38b04c0a6b844188de24c967a77a4be31978a5ff82349a",
        )
        self.assertEqual(value["evidenceBoundary"]["continuationPanelId"], "E04-C3-P41")
        expected = set(value["selection"]["expectedPaths"])
        self.assertTrue({
            "source/episodes/episode-04.json",
            "source/art/A04C3/chapter.json",
            "source/art/A04C3/lettering.json",
            "source/art/A04C3/panel-art.json",
            "source/art/A04C3/provenance.json",
            "manifests/a04c3-recovery.json",
            "manifests/a04c3-scroll-plates.json",
            "site/assets/art/A04C3/panels/E04-C3-P41.webp",
            "site/assets/art/A04C3/plates/A04C3-plate-01.webp",
        }.issubset(expected))
        self.assertNotIn("requiredScopedClassifications", value["selection"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
