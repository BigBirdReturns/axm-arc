from __future__ import annotations

import re
import urllib.parse
from typing import Any, Iterator

from harvest_common import GitHubApi, HarvestError, RemoteCandidate, safe_name


def page_items(api: GitHubApi, path: str, key: str, maximum: int) -> Iterator[dict[str, Any]]:
    page = 1
    yielded = 0
    separator = "&" if "?" in path else "?"
    while yielded < maximum:
        document = api.json(f"{path}{separator}per_page=100&page={page}")
        values = document.get(key) if isinstance(document, dict) else document
        if not isinstance(values, list):
            raise HarvestError(f"GitHub API response for {path} has no {key} list.")
        if not values:
            return
        for value in values:
            if isinstance(value, dict):
                yield value
                yielded += 1
                if yielded >= maximum:
                    return
        if len(values) < 100:
            return
        page += 1


def discover_actions_artifacts(
    api: GitHubApi,
    repository: str,
    pattern: re.Pattern[str],
    maximum: int,
) -> Iterator[RemoteCandidate]:
    quoted = "/".join(urllib.parse.quote(part, safe="") for part in repository.split("/", 1))
    for artifact in page_items(api, f"/repos/{quoted}/actions/artifacts", "artifacts", maximum):
        if artifact.get("expired") is True:
            continue
        name = str(artifact.get("name") or "")
        if not pattern.search(name):
            continue
        artifact_id = artifact.get("id")
        url = artifact.get("archive_download_url") or (
            f"/repos/{quoted}/actions/artifacts/{artifact_id}/zip" if artifact_id is not None else None
        )
        if artifact_id is None or not isinstance(url, str):
            continue
        yield RemoteCandidate(
            kind="actions-artifact",
            repository=repository,
            identity=f"{repository}:artifact:{artifact_id}",
            name=f"{safe_name(name, str(artifact_id))}.zip",
            bytes=int(artifact.get("size_in_bytes") or 0),
            download_url=url,
            created_at=str(artifact.get("created_at")) if artifact.get("created_at") else None,
        )


def discover_release_assets(
    api: GitHubApi,
    repository: str,
    pattern: re.Pattern[str],
    maximum: int,
) -> Iterator[RemoteCandidate]:
    quoted = "/".join(urllib.parse.quote(part, safe="") for part in repository.split("/", 1))
    seen = 0
    for release in page_items(api, f"/repos/{quoted}/releases", "releases", maximum):
        assets = release.get("assets")
        if not isinstance(assets, list):
            continue
        for asset in assets:
            if seen >= maximum or not isinstance(asset, dict):
                return
            seen += 1
            name = str(asset.get("name") or "")
            if not pattern.search(name):
                continue
            asset_id = asset.get("id")
            url = asset.get("url") or asset.get("browser_download_url")
            if asset_id is None or not isinstance(url, str):
                continue
            yield RemoteCandidate(
                kind="release-asset",
                repository=repository,
                identity=f"{repository}:release-asset:{asset_id}",
                name=safe_name(name, f"release-{asset_id}.zip"),
                bytes=int(asset.get("size") or 0),
                download_url=url,
                created_at=str(asset.get("created_at")) if asset.get("created_at") else None,
            )


def explicit_artifact_candidate(api_url: str, value: str) -> RemoteCandidate:
    try:
        repository, identifier = value.rsplit(":", 1)
        artifact_id = int(identifier)
        owner, repo = repository.split("/", 1)
    except (ValueError, TypeError) as exc:
        raise HarvestError(f"Artifact must be owner/repo:id, got {value!r}.") from exc
    quoted = f"{urllib.parse.quote(owner, safe='')}/{urllib.parse.quote(repo, safe='')}"
    return RemoteCandidate(
        kind="actions-artifact",
        repository=repository,
        identity=f"{repository}:artifact:{artifact_id}",
        name=f"artifact-{artifact_id}.zip",
        bytes=0,
        download_url=f"{api_url.rstrip('/')}/repos/{quoted}/actions/artifacts/{artifact_id}/zip",
    )


def explicit_release_candidate(api_url: str, value: str) -> RemoteCandidate:
    try:
        repository, identifier = value.rsplit(":", 1)
        asset_id = int(identifier)
        owner, repo = repository.split("/", 1)
    except (ValueError, TypeError) as exc:
        raise HarvestError(f"Release asset must be owner/repo:id, got {value!r}.") from exc
    quoted = f"{urllib.parse.quote(owner, safe='')}/{urllib.parse.quote(repo, safe='')}"
    return RemoteCandidate(
        kind="release-asset",
        repository=repository,
        identity=f"{repository}:release-asset:{asset_id}",
        name=f"release-asset-{asset_id}.zip",
        bytes=0,
        download_url=f"{api_url.rstrip('/')}/repos/{quoted}/releases/assets/{asset_id}",
    )
