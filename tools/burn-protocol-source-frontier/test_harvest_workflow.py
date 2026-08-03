from __future__ import annotations

import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORKFLOW = HERE.parents[1] / ".github" / "workflows" / "burn-protocol-autonomous-source-harvest.yml"

REQUIRED_REPOSITORIES = {
    "BigBirdReturns/axm-arc",
    "BigBirdReturns/axm-world",
    "BigBirdReturns/axm",
    "BigBirdReturns/axm-core",
    "BigBirdReturns/axm-tools",
    "BigBirdReturns/axm-fleet",
    "BigBirdReturns/axm-console",
    "BigBirdReturns/axm-aide",
}

OPTIONAL_REPOSITORIES = {
    "BigBirdReturns/axm-chat",
    "BigBirdReturns/spectra-genesis",
    "BigBirdReturns/axm-bloodstream",
    "BigBirdReturns/chatgpt-web",
}


class BurnSourceHarvestWorkflowTests(unittest.TestCase):
    def test_default_custody_scope_is_broader_than_arc_and_world(self) -> None:
        workflow = WORKFLOW.read_text(encoding="utf-8")
        for repository in REQUIRED_REPOSITORIES | OPTIONAL_REPOSITORIES:
            self.assertIn(repository, workflow)
        self.assertIn("optional_repositories:", workflow)
        self.assertIn('args+=(--optional-repository "$repository")', workflow)
        self.assertIn("optional discovery errors", workflow)
        self.assertIn("BURN_SOURCE_REPOSITORIES", workflow)
        self.assertIn("BURN_SOURCE_OPTIONAL_REPOSITORIES", workflow)


if __name__ == "__main__":
    unittest.main(verbosity=2)
