from __future__ import annotations

import json
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
WORKFLOW = REPO / ".github" / "workflows" / "burn-protocol-e05c3-source-harvest.yml"
ACTIVE = HERE / "active-frontier.json"

REQUIRED_REPOSITORIES = {"BigBirdReturns/axm-arc", "BigBirdReturns/axm-world"}
OPTIONAL_REPOSITORIES = {
    "BigBirdReturns/axm-chat",
    "BigBirdReturns/spectra-genesis",
    "BigBirdReturns/axm-bloodstream",
    "BigBirdReturns/chatgpt-web",
}


class BurnSourceHarvestWorkflowTests(unittest.TestCase):
    def test_active_workflow_unions_every_remote_custody_surface(self) -> None:
        workflow = WORKFLOW.read_text(encoding="utf-8")
        for repository in REQUIRED_REPOSITORIES | OPTIONAL_REPOSITORIES:
            self.assertIn(repository, workflow)
        for expected in (
            "owners:",
            "optional_repositories:",
            "artifacts:",
            "release_assets:",
            "approved_packet_set_sha256s:",
            "BURN_SOURCE_REPOSITORIES",
            "BURN_SOURCE_OWNERS",
            "BURN_SOURCE_OPTIONAL_REPOSITORIES",
            "BURN_APPROVED_E05C3_PACKET_SET_SHA256S",
            '--artifact "$artifact"',
            '--release-asset "$asset"',
            '--approved-packet-set-sha256 "$digest"',
            "optional discovery errors",
            "packet-set candidates",
            "found packet set",
            "active-frontier.json",
        ):
            self.assertIn(expected, workflow)

    def test_only_the_active_workflow_has_a_production_schedule(self) -> None:
        workflow_root = REPO / ".github" / "workflows"
        scheduled = []
        for path in sorted(workflow_root.glob("burn-protocol*source*harvest.yml")):
            if "schedule:" in path.read_text(encoding="utf-8"):
                scheduled.append(path.name)
        self.assertEqual(scheduled, [WORKFLOW.name])
        active = json.loads(ACTIVE.read_text(encoding="utf-8"))
        self.assertEqual(active["workflowPath"], WORKFLOW.relative_to(REPO).as_posix())


if __name__ == "__main__":
    unittest.main(verbosity=2)
