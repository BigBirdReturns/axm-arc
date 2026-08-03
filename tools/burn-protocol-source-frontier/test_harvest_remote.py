from __future__ import annotations

import tempfile
import threading
import unittest
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from harvest_common import GitHubApi
from harvest_test_support import FixtureApiHandler, FixtureServer, read_receipt, run_harvest
from test_recover import PARENT_BASENAME, build_parent, write_contract, zip_info


class RedirectSinkHandler(BaseHTTPRequestHandler):
    observed_authorization: str | None = None
    observed_accept: str | None = None
    payload = b"redirected\n"

    def log_message(self, format: str, *args: object) -> None:
        return

    def do_GET(self) -> None:
        self.__class__.observed_authorization = self.headers.get("Authorization")
        self.__class__.observed_accept = self.headers.get("Accept")
        self.send_response(200)
        self.send_header("Content-Length", str(len(self.payload)))
        self.end_headers()
        self.wfile.write(self.payload)


class RedirectSourceHandler(BaseHTTPRequestHandler):
    target = ""
    observed_accept: str | None = None

    def log_message(self, format: str, *args: object) -> None:
        return

    def do_GET(self) -> None:
        self.__class__.observed_accept = self.headers.get("Accept")
        self.send_response(302)
        self.send_header("Location", self.target)
        self.end_headers()


class BurnSourceHarvesterRemoteTests(unittest.TestCase):
    def artifact_with_parent(self, root: Path) -> tuple[Path, Path, Path]:
        parent = build_parent(root)
        contract = write_contract(root, parent)
        artifact = root / "artifact.zip"
        with zipfile.ZipFile(artifact, "w") as archive:
            archive.writestr(zip_info(f"nested/{PARENT_BASENAME}"), parent.read_bytes())
        return parent, contract, artifact

    def test_owner_sweep_enumerates_repositories_before_artifact_discovery(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _, contract, artifact = self.artifact_with_parent(root)
            with FixtureServer(artifact.read_bytes()) as api_url:
                output = root / "harvest"
                result = run_harvest(
                    "--owner", "fixture", "--github-api-url", api_url,
                    "--contract", str(contract), "--output", str(output),
                )
            self.assertEqual(result.returncode, 0, result.stderr)
            receipt = read_receipt(output)
            self.assertEqual(receipt["owners"], ["fixture"])
            self.assertEqual(receipt["repositories"], ["fixture/decoy", "fixture/repo"])
            self.assertEqual(receipt["summary"]["repositories"], 2)
            self.assertEqual(receipt["foundIdentity"], "fixture/repo:artifact:42")

    def test_github_artifact_sweep_downloads_and_recovers_exact_parent(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _, contract, artifact = self.artifact_with_parent(root)
            with FixtureServer(artifact.read_bytes()) as api_url:
                output = root / "harvest"
                result = run_harvest(
                    "--repository", "fixture/repo", "--github-api-url", api_url,
                    "--contract", str(contract), "--output", str(output),
                )
            self.assertEqual(result.returncode, 0, result.stderr)
            receipt = read_receipt(output)
            self.assertEqual(receipt["foundIdentity"], "fixture/repo:artifact:42")
            self.assertGreater(receipt["summary"]["downloadedBytes"], 0)
            self.assertEqual(FixtureApiHandler.observed_artifact_accept, "application/vnd.github+json")

    def test_remote_artifact_recurses_through_a_nested_landing_kit(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            parent = build_parent(root)
            contract = write_contract(root, parent)
            inner = root / "inner-kit.zip"
            with zipfile.ZipFile(inner, "w") as archive:
                archive.writestr(zip_info(f"estate/{PARENT_BASENAME}"), parent.read_bytes())
            outer = root / "artifact.zip"
            with zipfile.ZipFile(outer, "w") as archive:
                archive.writestr(zip_info("kits/source-frontier-kit.zip"), inner.read_bytes())
            with FixtureServer(outer.read_bytes()) as api_url:
                output = root / "harvest"
                result = run_harvest(
                    "--repository", "fixture/repo", "--github-api-url", api_url,
                    "--contract", str(contract), "--output", str(output),
                )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("!kits/source-frontier-kit.zip", read_receipt(output)["foundIdentity"])

    def test_remote_size_ceiling_refuses_metadata_without_downloading(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _, contract, artifact = self.artifact_with_parent(root)
            with FixtureServer(artifact.read_bytes()) as api_url:
                output = root / "harvest"
                result = run_harvest(
                    "--repository", "fixture/repo", "--github-api-url", api_url,
                    "--contract", str(contract), "--output", str(output), "--max-candidate-bytes", "1",
                )
            self.assertEqual(result.returncode, 0, result.stderr)
            receipt = read_receipt(output)
            self.assertEqual(receipt["checked"][0]["outcome"], "skipped-size")
            self.assertEqual(receipt["summary"]["downloadedBytes"], 0)

    def test_explicit_artifact_reference_does_not_depend_on_listing(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _, contract, artifact = self.artifact_with_parent(root)
            with FixtureServer(artifact.read_bytes()) as api_url:
                output = root / "harvest"
                result = run_harvest(
                    "--artifact", "fixture/repo:42", "--github-api-url", api_url,
                    "--contract", str(contract), "--output", str(output),
                )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(read_receipt(output)["foundIdentity"], "fixture/repo:artifact:42")

    def test_explicit_release_asset_reference_is_supported(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _, contract, release = self.artifact_with_parent(root)
            with FixtureServer(b"unused", release.read_bytes()) as api_url:
                output = root / "harvest"
                result = run_harvest(
                    "--release-asset", "fixture/repo:77", "--github-api-url", api_url,
                    "--contract", str(contract), "--output", str(output),
                )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(read_receipt(output)["foundIdentity"], "fixture/repo:release-asset:77")
            self.assertEqual(FixtureApiHandler.observed_release_accept, "application/octet-stream")

    def test_remote_download_refusal_is_harvest_error_not_source_absence(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _, contract, artifact = self.artifact_with_parent(root)
            with FixtureServer(artifact.read_bytes(), artifact_status=415) as api_url:
                output = root / "harvest"
                result = run_harvest(
                    "--repository", "fixture/repo", "--github-api-url", api_url,
                    "--contract", str(contract), "--output", str(output),
                )
            self.assertEqual(result.returncode, 2, result.stderr)
            receipt = read_receipt(output)
            self.assertEqual(receipt["status"], "harvest-error")
            self.assertEqual(receipt["summary"]["downloadedBytes"], 0)
            self.assertEqual(receipt["summary"]["transportFailures"], 1)
            self.assertEqual(receipt["checked"][0]["outcome"], "download-refused")

    def test_cross_origin_redirect_does_not_forward_github_token(self) -> None:
        RedirectSinkHandler.observed_authorization = None
        RedirectSinkHandler.observed_accept = None
        RedirectSourceHandler.observed_accept = None
        sink = ThreadingHTTPServer(("127.0.0.1", 0), RedirectSinkHandler)
        sink_thread = threading.Thread(target=sink.serve_forever, daemon=True)
        sink_thread.start()
        source = ThreadingHTTPServer(("127.0.0.1", 0), RedirectSourceHandler)
        RedirectSourceHandler.target = f"http://localhost:{sink.server_port}/payload"
        source_thread = threading.Thread(target=source.serve_forever, daemon=True)
        source_thread.start()
        try:
            with tempfile.TemporaryDirectory() as temp:
                destination = Path(temp) / "candidate.zip"
                api = GitHubApi(f"http://127.0.0.1:{source.server_port}", "secret-token", 5.0)
                size, _ = api.download(
                    "/repos/fixture/repo/actions/artifacts/42/zip",
                    destination,
                    1024,
                )
                self.assertEqual(size, len(RedirectSinkHandler.payload))
                self.assertEqual(RedirectSourceHandler.observed_accept, "application/vnd.github+json")
                self.assertIsNone(RedirectSinkHandler.observed_authorization)
                self.assertEqual(RedirectSinkHandler.observed_accept, "*/*")
        finally:
            source.shutdown(); source.server_close(); source_thread.join(timeout=5)
            sink.shutdown(); sink.server_close(); sink_thread.join(timeout=5)


if __name__ == "__main__":
    unittest.main(verbosity=2)
