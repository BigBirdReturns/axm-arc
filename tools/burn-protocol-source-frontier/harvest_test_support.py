from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
TOOL = HERE / "harvest.py"


def run_harvest(*arguments: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    merged = dict(os.environ)
    if env:
        merged.update(env)
    return subprocess.run(
        [sys.executable, str(TOOL), *arguments],
        text=True,
        capture_output=True,
        check=False,
        env=merged,
    )


def read_receipt(output: Path) -> dict[str, Any]:
    return json.loads((output / "HARVEST_RECEIPT.json").read_text(encoding="utf-8"))


class FixtureApiHandler(BaseHTTPRequestHandler):
    artifact_bytes = b""
    release_bytes = b""
    artifact_status: int | None = None
    observed_artifact_accept: str | None = None
    observed_release_accept: str | None = None

    def log_message(self, format: str, *args: object) -> None:
        return

    def _json(self, value: Any) -> None:
        payload = json.dumps(value).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _bytes(self, value: bytes) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Length", str(len(value)))
        self.end_headers()
        self.wfile.write(value)

    def do_GET(self) -> None:
        if self.path.startswith("/repos/fixture/repo/actions/artifacts?"):
            self._json({
                "artifacts": [{
                    "id": 42,
                    "name": "burn-source-estate",
                    "size_in_bytes": len(self.artifact_bytes),
                    "expired": False,
                    "archive_download_url": (
                        f"http://127.0.0.1:{self.server.server_port}"
                        "/repos/fixture/repo/actions/artifacts/42/zip"
                    ),
                    "created_at": "2026-08-02T00:00:00Z",
                }]
            })
        elif self.path.startswith("/repos/fixture/repo/releases?"):
            self._json([{"assets": []}])
        elif self.path == "/repos/fixture/repo/actions/artifacts/42/zip":
            self.__class__.observed_artifact_accept = self.headers.get("Accept")
            if self.__class__.artifact_status is not None:
                self.send_response(self.__class__.artifact_status)
                self.end_headers()
            elif self.headers.get("Accept") != "application/vnd.github+json":
                self.send_response(415)
                self.end_headers()
            else:
                self._bytes(self.artifact_bytes)
        elif self.path == "/repos/fixture/repo/releases/assets/77":
            self.__class__.observed_release_accept = self.headers.get("Accept")
            if self.headers.get("Accept") != "application/octet-stream":
                self.send_response(415)
                self.end_headers()
            else:
                self._bytes(self.release_bytes)
        else:
            self.send_response(404)
            self.end_headers()


class FixtureServer:
    def __init__(self, artifact: bytes, release: bytes = b"", *, artifact_status: int | None = None) -> None:
        FixtureApiHandler.artifact_bytes = artifact
        FixtureApiHandler.release_bytes = release
        FixtureApiHandler.artifact_status = artifact_status
        FixtureApiHandler.observed_artifact_accept = None
        FixtureApiHandler.observed_release_accept = None
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), FixtureApiHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def __enter__(self) -> str:
        self.thread.start()
        return f"http://127.0.0.1:{self.server.server_port}"

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)
