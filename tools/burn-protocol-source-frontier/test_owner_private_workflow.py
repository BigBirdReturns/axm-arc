from __future__ import annotations

import json
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
WORKFLOW = REPO / ".github" / "workflows" / "burn-protocol-e05c3-source-harvest.yml"
DOC = REPO / "docs" / "BURN_PROTOCOL_OWNER_PRIVATE_SOURCE_HARVEST.md"
AUTONOMOUS_DOC = REPO / "docs" / "BURN_PROTOCOL_AUTONOMOUS_SOURCE_HARVEST.md"
ACTIVE = HERE / "active-frontier.json"


class BurnOwnerPrivateWorkflowTests(unittest.TestCase):
    def test_active_workflow_preserves_public_owner_and_private_best_effort_custody(self) -> None:
        workflow = WORKFLOW.read_text(encoding="utf-8")
        for expected in (
            "BigBirdReturns/axm-arc",
            "BigBirdReturns/axm-world",
            "BigBirdReturns/axm-chat",
            "BigBirdReturns/spectra-genesis",
            "BigBirdReturns/axm-bloodstream",
            "BigBirdReturns/chatgpt-web",
            "BURN_SOURCE_REPOSITORIES",
            "BURN_SOURCE_OWNERS",
            "BURN_SOURCE_OPTIONAL_REPOSITORIES",
            "resolve_owner_scope.py",
            "--optional-repository",
            "optional discovery errors",
            "workstation action         none",
            "BURN_APPROVED_E05C3_PACKET_SET_SHA256S",
            '--approved-packet-set-sha256 "$digest"',
        ):
            self.assertIn(expected, workflow)
        self.assertIn("default: BigBirdReturns", workflow)

    def test_documents_preserve_parent_law_and_record_supersession(self) -> None:
        owner = DOC.read_text(encoding="utf-8")
        autonomous = AUTONOMOUS_DOC.read_text(encoding="utf-8")
        active = json.loads(ACTIVE.read_text(encoding="utf-8"))
        for document in (owner, autonomous):
            self.assertIn("E05-C3-P41", document)
            self.assertIn("641,627,846 bytes", document)
            self.assertIn(
                "f67dcd2c632720566e38b04c0a6b844188de24c967a77a4be31978a5ff82349a",
                document,
            )
            self.assertIn("retired", document)
        self.assertIn("A transport or owner-resolution failure can never appear as source absence.", owner)
        self.assertEqual(len(active["supersededWorkflowPaths"]), 3)


if __name__ == "__main__":
    unittest.main(verbosity=2)
