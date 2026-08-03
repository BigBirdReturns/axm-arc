from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from harvest_test_support import FixtureServer

HERE = Path(__file__).resolve().parent
TOOL = HERE / "resolve_owner_scope.py"


def run_scope(*arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(TOOL), *arguments],
        text=True,
        capture_output=True,
        check=False,
    )


class BurnOwnerCustodyScopeTests(unittest.TestCase):
    def test_owner_estate_is_unioned_with_explicit_anchors(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            output = root / "scope.json"
            with FixtureServer(b"unused") as api_url:
                result = run_scope(
                    "--owner", "fixture",
                    "--repository", "fixture/anchor",
                    "--repository", "fixture/repo",
                    "--github-api-url", api_url,
                    "--output", str(output),
                )
            self.assertEqual(result.returncode, 0, result.stderr)
            receipt = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(receipt["owners"], ["fixture"])
            self.assertEqual(receipt["explicitRepositories"], ["fixture/anchor", "fixture/repo"])
            self.assertEqual(
                receipt["repositories"],
                ["fixture/anchor", "fixture/repo", "fixture/decoy"],
            )
            self.assertEqual(receipt["summary"]["repositories"], 3)
            self.assertEqual(receipt["authority"]["sourceStanding"], "none")

    def test_owner_enumeration_failure_is_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            output = root / "scope.json"
            with FixtureServer(b"unused") as api_url:
                result = run_scope(
                    "--owner", "missing",
                    "--github-api-url", api_url,
                    "--output", str(output),
                )
            self.assertEqual(result.returncode, 2)
            self.assertFalse(output.exists())
            self.assertIn("GitHub API request failed", result.stderr)

    def test_scope_output_must_not_be_overwritten(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "scope.json"
            output.write_text("occupied\n", encoding="utf-8")
            result = run_scope("--output", str(output))
            self.assertEqual(result.returncode, 2)
            self.assertEqual(output.read_text(encoding="utf-8"), "occupied\n")


if __name__ == "__main__":
    unittest.main(verbosity=2)
