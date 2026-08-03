from __future__ import annotations

import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORKFLOW = HERE.parents[1] / ".github" / "workflows" / "burn-protocol-owner-private-source-harvest.yml"
DOC = HERE.parents[1] / "docs" / "BURN_PROTOCOL_OWNER_PRIVATE_SOURCE_HARVEST.md"


class BurnOwnerPrivateWorkflowTests(unittest.TestCase):
    def test_workflow_unions_public_owner_and_private_best_effort_custody(self) -> None:
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
            "approved_packet_set_sha256s:",
            "BURN_APPROVED_PACKET_SET_SHA256S",
            '--approved-packet-set-sha256 "$digest"',
            "packet-set candidates",
            "found packet set",
        ):
            self.assertIn(expected, workflow)
        self.assertIn("default: BigBirdReturns", workflow)
        self.assertIn("burn-protocol-owner-private-source-harvest", workflow)

    def test_document_preserves_exact_parent_and_e05c1_frontier(self) -> None:
        document = DOC.read_text(encoding="utf-8")
        self.assertIn("E04-C3-P60 → E05-C1-P01", document)
        self.assertIn("641,627,846 bytes", document)
        self.assertIn(
            "f67dcd2c632720566e38b04c0a6b844188de24c967a77a4be31978a5ff82349a",
            document,
        )
        self.assertIn("A transport or owner-resolution failure can never appear as source absence.", document)
        self.assertIn("packet-set-approval-required", document)
        self.assertIn("BURN_APPROVED_PACKET_SET_SHA256S", document)
        self.assertIn("does not promote a packet set using a digest learned from the same candidate", document)


if __name__ == "__main__":
    unittest.main(verbosity=2)
