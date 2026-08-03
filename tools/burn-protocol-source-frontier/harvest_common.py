from __future__ import annotations

import hashlib
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

TOOL_VERSION = "1.0.0"
FORMAT = "burn-protocol-autonomous-source-harvest/1"
DEFAULT_NAME_PATTERN = r"(?i)(burn|protocol|estate|handoff|source|frontier|episode|local-estate)"
DEFAULT_MAX_CANDIDATE_BYTES = 1_073_741_824
DEFAULT_TOTAL_DOWNLOAD_BYTES = 4_294_967_296
DEFAULT_MAX_REMOTE_ITEMS = 100
USER_AGENT = "burn-protocol-source-harvester/1"


class HarvestError(RuntimeError):
    pass


@dataclass(frozen=True)
class RemoteCandidate:
    kind: str
    repository: str
    identity: str
    name: str
    bytes: int
    download_url: str
    created_at: str | None = None


@dataclass
class CandidateResult:
    kind: str
    identity: str
    name: str
    bytes: int
    sha256: str | None
    outcome: str
    detail: str


def canonical_json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def safe_name(value: str, fallback: str = "candidate.zip") -> str:
    name = Path(value).name or fallback
    name = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip(".-")
    return name or fallback


def load_contract(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HarvestError(f"Cannot read contract {path}: {exc}") from exc
    if value.get("format") != "burn-protocol-source-frontier-recovery-contract/1":
        raise HarvestError("Unsupported recovery contract format.")
    parent = value.get("parent")
    if not isinstance(parent, dict):
        raise HarvestError("Recovery contract parent is missing.")
    for key in ("basename", "bytes", "sha256"):
        if key not in parent:
            raise HarvestError(f"Recovery contract parent.{key} is missing.")
    return value


class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Follow redirects without forwarding credentials across origins."""

    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> urllib.request.Request | None:
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is None:
            return None
        old = urllib.parse.urlparse(req.full_url)
        new = urllib.parse.urlparse(newurl)
        if old.scheme == "https" and new.scheme != "https":
            raise HarvestError(f"Refusing HTTPS downgrade redirect to {newurl}.")
        if (old.scheme, old.hostname, old.port) != (new.scheme, new.hostname, new.port):
            for key in list(redirected.headers):
                if key.lower() in {"authorization", "proxy-authorization"}:
                    redirected.remove_header(key)
            for key in list(redirected.unredirected_hdrs):
                if key.lower() in {"authorization", "proxy-authorization"}:
                    redirected.unredirected_hdrs.pop(key, None)
        return redirected


class GitHubApi:
    def __init__(self, api_url: str, token: str | None, timeout: float) -> None:
        parsed = urllib.parse.urlparse(api_url)
        if parsed.scheme not in {"https", "http"}:
            raise HarvestError("GitHub API URL must use HTTP or HTTPS.")
        if parsed.scheme == "http" and parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
            raise HarvestError("Plain HTTP is permitted only for loopback qualification fixtures.")
        self.api_url = api_url.rstrip("/")
        self.token = token
        self.timeout = timeout
        self.opener = urllib.request.build_opener(SafeRedirectHandler())

    def _headers(self, *, binary: bool = False) -> dict[str, str]:
        headers = {
            "Accept": "application/octet-stream" if binary else "application/vnd.github+json",
            "User-Agent": USER_AGENT,
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _absolute(self, value: str) -> str:
        if value.startswith("http://") or value.startswith("https://"):
            return value
        return f"{self.api_url}/{value.lstrip('/')}"

    def json(self, path: str) -> Any:
        request = urllib.request.Request(self._absolute(path), headers=self._headers())
        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise HarvestError(f"GitHub API request failed for {path}: {exc}") from exc

    def download(self, url: str, destination: Path, max_bytes: int) -> tuple[int, str]:
        request = urllib.request.Request(self._absolute(url), headers=self._headers(binary=True))
        digest = hashlib.sha256()
        total = 0
        try:
            with self.opener.open(request, timeout=self.timeout) as response, destination.open("wb") as output:
                declared = response.headers.get("Content-Length")
                if declared is not None and int(declared) > max_bytes:
                    raise HarvestError(f"Remote candidate declares {declared} bytes, exceeding {max_bytes}.")
                while chunk := response.read(1024 * 1024):
                    total += len(chunk)
                    if total > max_bytes:
                        raise HarvestError(f"Remote candidate exceeded {max_bytes} bytes while downloading.")
                    digest.update(chunk)
                    output.write(chunk)
        except (HarvestError, urllib.error.URLError, urllib.error.HTTPError, OSError, ValueError) as exc:
            destination.unlink(missing_ok=True)
            if isinstance(exc, HarvestError):
                raise
            raise HarvestError(f"Remote candidate download failed for {url}: {exc}") from exc
        return total, digest.hexdigest()
