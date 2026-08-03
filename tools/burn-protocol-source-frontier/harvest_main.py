from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import tempfile
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

from harvest_archives import copy_tree, local_candidates, nested_zip_candidates, run_recovery, write_receipt
from harvest_common import (
    DEFAULT_MAX_CANDIDATE_BYTES,
    DEFAULT_MAX_REMOTE_ITEMS,
    DEFAULT_NAME_PATTERN,
    DEFAULT_TOTAL_DOWNLOAD_BYTES,
    FORMAT,
    TOOL_VERSION,
    CandidateResult,
    GitHubApi,
    HarvestError,
    load_contract,
    safe_name,
    sha256_file,
)
from harvest_remote import (
    discover_actions_artifacts,
    discover_release_assets,
    explicit_artifact_candidate,
    explicit_release_candidate,
)


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="Autonomously harvest the exact Burn Protocol source parent from remote custody.")
    parser.add_argument("--output", required=True, type=Path, help="Empty harvest output directory to create.")
    parser.add_argument(
        "--contract",
        type=Path,
        default=here / "contracts" / "e04c2-source-intake.contract.json",
        help="Pinned recovery contract.",
    )
    parser.add_argument("--candidate", action="append", default=[], type=Path, help="Local candidate ZIP; repeatable.")
    parser.add_argument(
        "--candidate-directory",
        action="append",
        default=[],
        type=Path,
        help="Recursively scan local ZIPs in this directory; repeatable.",
    )
    parser.add_argument("--repository", action="append", default=[], help="GitHub repository owner/name; repeatable.")
    parser.add_argument("--artifact", action="append", default=[], help="Actions artifact owner/repo:id; repeatable.")
    parser.add_argument("--release-asset", action="append", default=[], help="Release asset owner/repo:id; repeatable.")
    parser.add_argument("--github-api-url", default=os.getenv("GITHUB_API_URL", "https://api.github.com"))
    parser.add_argument("--github-token-env", default="GITHUB_TOKEN")
    parser.add_argument("--name-pattern", default=DEFAULT_NAME_PATTERN)
    parser.add_argument("--max-remote-items", type=int, default=DEFAULT_MAX_REMOTE_ITEMS)
    parser.add_argument("--max-candidate-bytes", type=int, default=DEFAULT_MAX_CANDIDATE_BYTES)
    parser.add_argument("--total-download-bytes", type=int, default=DEFAULT_TOTAL_DOWNLOAD_BYTES)
    parser.add_argument("--packet-limit-bytes", type=int, default=209_715_200)
    parser.add_argument("--max-nested-depth", type=int, default=3)
    parser.add_argument("--max-nested-bytes", type=int, default=2_147_483_648)
    parser.add_argument("--timeout", type=float, default=60.0)
    parser.add_argument("--require-source", action="store_true")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv or [])
    if (
        args.max_remote_items <= 0
        or args.max_candidate_bytes <= 0
        or args.total_download_bytes <= 0
        or args.max_nested_depth < 0
        or args.max_nested_bytes <= 0
    ):
        raise HarvestError("Remote item, byte, and nested-archive ceilings must be valid.")
    contract_path = args.contract.resolve()
    contract = load_contract(contract_path)
    parent = contract["parent"]
    output = args.output.resolve()
    if output.exists():
        if not output.is_dir():
            raise HarvestError(f"Output path is not a directory: {output}")
        if any(output.iterdir()):
            raise HarvestError(f"Output directory is not empty: {output}")
    output.mkdir(parents=True, exist_ok=True)

    pattern = re.compile(args.name_pattern)
    api = GitHubApi(args.github_api_url, os.getenv(args.github_token_env) or None, args.timeout)
    recovery_tool = Path(__file__).resolve().parent / "recover.py"
    checked: list[CandidateResult] = []
    discovery_errors: list[str] = []
    found_status: str | None = None
    found_identity: str | None = None
    downloaded = 0

    def examine(candidate_path: Path, *, kind: str, identity: str, name: str, known_hash: str | None = None) -> bool:
        nonlocal found_status, found_identity
        if not candidate_path.is_file():
            checked.append(CandidateResult(kind, identity, name, 0, None, "missing", "Candidate file does not exist."))
            return False
        size = candidate_path.stat().st_size
        digest = known_hash or sha256_file(candidate_path)
        with tempfile.TemporaryDirectory(prefix="burn-harvest-recover-") as temp:
            code, detail, recovery_output = run_recovery(
                candidate_path, contract_path, recovery_tool, Path(temp), args.packet_limit_bytes
            )
            if code in {0, 3} and recovery_output.is_dir():
                found_status = "verified-frontier-evidence" if code == 0 else "source-required"
                found_identity = identity
                copy_tree(recovery_output, output / "recovery")
                checked.append(CandidateResult(kind, identity, name, size, digest, found_status, detail))
                return True
            checked.append(CandidateResult(kind, identity, name, size, digest, "not-exact-parent", detail))
            return False

    def examine_tree(
        candidate_path: Path,
        *,
        kind: str,
        identity: str,
        name: str,
        known_hash: str | None = None,
    ) -> bool:
        if examine(candidate_path, kind=kind, identity=identity, name=name, known_hash=known_hash):
            return True
        with tempfile.TemporaryDirectory(prefix="burn-harvest-nested-") as temp:
            try:
                for nested, nested_identity in nested_zip_candidates(
                    candidate_path,
                    Path(temp),
                    identity=identity,
                    max_depth=args.max_nested_depth,
                    max_entry_bytes=args.max_candidate_bytes,
                    max_total_bytes=args.max_nested_bytes,
                ):
                    if examine(
                        nested,
                        kind=f"{kind}-nested",
                        identity=nested_identity,
                        name=f"{name}!{nested_identity.rsplit('!', 1)[-1]}",
                    ):
                        return True
            except HarvestError as exc:
                checked.append(
                    CandidateResult(
                        f"{kind}-nested-scan",
                        identity,
                        name,
                        candidate_path.stat().st_size if candidate_path.exists() else 0,
                        known_hash,
                        "nested-scan-refused",
                        str(exc),
                    )
                )
        return False

    try:
        for path in local_candidates(args.candidate, args.candidate_directory):
            if examine_tree(path, kind="local", identity=str(path), name=path.name):
                break

        remote_candidates = []
        if found_status is None:
            remote_candidates.extend(explicit_artifact_candidate(args.github_api_url, value) for value in args.artifact)
            remote_candidates.extend(explicit_release_candidate(args.github_api_url, value) for value in args.release_asset)
            for repository in args.repository:
                try:
                    remote_candidates.extend(discover_actions_artifacts(api, repository, pattern, args.max_remote_items))
                except HarvestError as exc:
                    discovery_errors.append(str(exc))
                try:
                    remote_candidates.extend(discover_release_assets(api, repository, pattern, args.max_remote_items))
                except HarvestError as exc:
                    discovery_errors.append(str(exc))

            unique = {candidate.identity: candidate for candidate in remote_candidates}
            remote_candidates = sorted(
                unique.values(),
                key=lambda candidate: (candidate.created_at or "", candidate.identity),
                reverse=True,
            )
            with tempfile.TemporaryDirectory(prefix="burn-harvest-download-") as temp:
                temp_root = Path(temp)
                for index, candidate in enumerate(remote_candidates, start=1):
                    if candidate.bytes > args.max_candidate_bytes:
                        checked.append(
                            CandidateResult(
                                candidate.kind,
                                candidate.identity,
                                candidate.name,
                                candidate.bytes,
                                None,
                                "skipped-size",
                                f"Metadata exceeds {args.max_candidate_bytes} bytes.",
                            )
                        )
                        continue
                    remaining = args.total_download_bytes - downloaded
                    if remaining <= 0:
                        discovery_errors.append("Total remote download budget exhausted.")
                        break
                    destination = temp_root / f"{index:04d}-{safe_name(candidate.name)}"
                    try:
                        size, digest = api.download(
                            candidate.download_url,
                            destination,
                            min(args.max_candidate_bytes, remaining),
                        )
                    except HarvestError as exc:
                        checked.append(
                            CandidateResult(
                                candidate.kind,
                                candidate.identity,
                                candidate.name,
                                candidate.bytes,
                                None,
                                "download-refused",
                                str(exc),
                            )
                        )
                        continue
                    downloaded += size
                    if examine_tree(
                        destination,
                        kind=candidate.kind,
                        identity=candidate.identity,
                        name=candidate.name,
                        known_hash=digest,
                    ):
                        break

        status = found_status or "source-not-found"
        receipt = {
            "format": FORMAT,
            "toolVersion": TOOL_VERSION,
            "status": status,
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "contract": {"path": str(contract_path), "sha256": sha256_file(contract_path)},
            "parentAuthority": {
                "basename": parent["basename"],
                "bytes": int(parent["bytes"]),
                "sha256": str(parent["sha256"]),
            },
            "foundIdentity": found_identity,
            "repositories": list(args.repository),
            "checked": [asdict(result) for result in checked],
            "summary": {
                "candidates": len(checked),
                "downloadedBytes": downloaded,
                "discoveryErrors": len(discovery_errors),
            },
            "discoveryErrors": discovery_errors,
            "authority": {
                "humanWorkstationRequired": False,
                "admission": "exact-contract-parent-only",
                "canonicalInference": "none",
                "sourceAbsence": "does-not-authorize-fabrication",
            },
        }
        write_receipt(output, receipt)
        print(json.dumps(receipt, indent=2, sort_keys=True))
        if status == "source-not-found" and args.require_source:
            return 4
        return 0 if status != "source-required" else 3
    except Exception:
        if output.exists():
            shutil.rmtree(output, ignore_errors=True)
        raise
