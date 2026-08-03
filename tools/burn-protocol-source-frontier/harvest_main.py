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
from typing import Any, Sequence

from harvest_archives import (
    copy_tree,
    has_packet_set_markers,
    local_candidates,
    nested_zip_candidates,
    run_packet_set_verification,
    run_recovery,
    write_receipt,
)
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

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
PACKET_SET_RECEIPT_FORMAT = "burn-protocol-source-frontier-packet-set-verification/1"


def normalize_digest(value: str, label: str) -> str:
    digest = value.lower().removeprefix("sha256:").strip()
    if not SHA256_RE.fullmatch(digest):
        raise HarvestError(f"{label} must be one 64-character SHA-256 digest.")
    return digest


def load_packet_set_receipt(output: Path) -> dict[str, Any]:
    path = output / "PACKET_SET_VERIFICATION_RECEIPT.json"
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HarvestError(f"Cannot read packet-set verification receipt: {exc}") from exc
    if not isinstance(value, dict) or value.get("format") != PACKET_SET_RECEIPT_FORMAT:
        raise HarvestError("Packet-set verifier emitted an unsupported receipt.")
    normalize_digest(str(value.get("packetSetSha256") or ""), "packet-set identity")
    return value


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(
        description="Autonomously harvest the exact Burn Protocol source parent or an approved frontier packet set."
    )
    parser.add_argument("--output", required=True, type=Path, help="Empty harvest output directory to create.")
    parser.add_argument(
        "--contract",
        type=Path,
        default=here / "contracts" / "e05c1-source-intake.contract.json",
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
    parser.add_argument("--repository", action="append", default=[], help="Required GitHub repository owner/name; repeatable.")
    parser.add_argument(
        "--optional-repository",
        action="append",
        default=[],
        help="Best-effort GitHub repository owner/name; inaccessible discovery is recorded but does not invalidate required-scope absence.",
    )
    parser.add_argument("--artifact", action="append", default=[], help="Actions artifact owner/repo:id; repeatable.")
    parser.add_argument("--release-asset", action="append", default=[], help="Release asset owner/repo:id; repeatable.")
    parser.add_argument(
        "--approved-packet-set-sha256",
        action="append",
        default=[],
        help="Externally admitted frontier packet-set identity; repeatable.",
    )
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
    approved_packet_sets = {
        normalize_digest(value, "approved packet set")
        for value in args.approved_packet_set_sha256
    }
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
    tools_root = Path(__file__).resolve().parent
    recovery_tool = tools_root / "recover.py"
    packet_set_tool = tools_root / "verify_packet_set.py"
    checked: list[CandidateResult] = []
    packet_set_candidates: list[dict[str, Any]] = []
    discovery_errors: list[str] = []
    optional_discovery_errors: list[str] = []
    required_repositories = list(dict.fromkeys(args.repository))
    optional_repositories = [
        repository
        for repository in dict.fromkeys(args.optional_repository)
        if repository not in required_repositories
    ]
    found_status: str | None = None
    found_identity: str | None = None
    found_evidence_kind: str | None = None
    found_packet_set_sha256: str | None = None
    downloaded = 0

    def verify_packet_candidate(
        candidate_path: Path,
        *,
        kind: str,
        identity: str,
        name: str,
        size: int,
        digest: str,
        temporary_root: Path,
    ) -> str:
        nonlocal found_status, found_identity, found_evidence_kind, found_packet_set_sha256
        code, detail, verification_output = run_packet_set_verification(
            candidate_path,
            contract_path,
            packet_set_tool,
            temporary_root,
        )
        if code not in {0, 3} or not verification_output.is_dir():
            return "none"
        receipt = load_packet_set_receipt(verification_output)
        packet_set_sha256 = normalize_digest(
            str(receipt.get("packetSetSha256") or ""),
            "packet-set identity",
        )
        approved = packet_set_sha256 in approved_packet_sets
        if approved:
            code, detail, verification_output = run_packet_set_verification(
                candidate_path,
                contract_path,
                packet_set_tool,
                temporary_root,
                packet_set_sha256,
            )
            if code != 0 or not verification_output.is_dir():
                raise HarvestError(
                    f"Externally pinned packet set {packet_set_sha256} failed approval replay: {detail}"
                )
            receipt = load_packet_set_receipt(verification_output)
            if receipt.get("standing") != "transport-approved":
                raise HarvestError("Externally pinned packet set did not acquire transport-approved standing.")

        recovery_status = str(receipt.get("recoveryStatus") or "")
        candidate_record = {
            "identity": identity,
            "kind": kind,
            "name": name,
            "candidateBytes": size,
            "candidateSha256": digest,
            "packetSetSha256": packet_set_sha256,
            "standing": receipt.get("standing"),
            "recoveryStatus": recovery_status,
            "approved": approved,
            "selected": receipt.get("selected"),
            "packets": receipt.get("packets"),
        }
        packet_set_candidates.append(candidate_record)

        if not approved:
            checked.append(
                CandidateResult(
                    kind,
                    identity,
                    name,
                    size,
                    digest,
                    "packet-set-approval-required",
                    f"Byte-verified packet set {packet_set_sha256} requires an external approval pin.",
                )
            )
            return "packet-set"

        found_status = (
            "verified-frontier-packet-set"
            if recovery_status == "verified-frontier-evidence"
            else "source-required-packet-set"
        )
        found_identity = identity
        found_evidence_kind = "approved-packet-set"
        found_packet_set_sha256 = packet_set_sha256
        copy_tree(verification_output, output / "packet-set-verification")
        checked.append(
            CandidateResult(
                kind,
                identity,
                name,
                size,
                digest,
                found_status,
                f"Transport-approved packet set {packet_set_sha256}; recovery status {recovery_status}.",
            )
        )
        return "accepted"

    def examine(
        candidate_path: Path,
        *,
        kind: str,
        identity: str,
        name: str,
        known_hash: str | None = None,
    ) -> str:
        nonlocal found_status, found_identity, found_evidence_kind
        if not candidate_path.is_file():
            checked.append(CandidateResult(kind, identity, name, 0, None, "missing", "Candidate file does not exist."))
            return "none"
        size = candidate_path.stat().st_size
        digest = known_hash or sha256_file(candidate_path)
        with tempfile.TemporaryDirectory(prefix="burn-harvest-recover-") as temp:
            temporary_root = Path(temp)
            code, detail, recovery_output = run_recovery(
                candidate_path, contract_path, recovery_tool, temporary_root, args.packet_limit_bytes
            )
            if code in {0, 3} and recovery_output.is_dir():
                found_status = "verified-frontier-evidence" if code == 0 else "source-required"
                found_identity = identity
                found_evidence_kind = "exact-parent"
                copy_tree(recovery_output, output / "recovery")
                checked.append(CandidateResult(kind, identity, name, size, digest, found_status, detail))
                return "accepted"

            if has_packet_set_markers(candidate_path):
                packet_disposition = verify_packet_candidate(
                    candidate_path,
                    kind=kind,
                    identity=identity,
                    name=name,
                    size=size,
                    digest=digest,
                    temporary_root=temporary_root,
                )
                if packet_disposition != "none":
                    return packet_disposition

            checked.append(CandidateResult(kind, identity, name, size, digest, "not-exact-parent", detail))
            return "none"

    def examine_tree(
        candidate_path: Path,
        *,
        kind: str,
        identity: str,
        name: str,
        known_hash: str | None = None,
    ) -> bool:
        disposition = examine(
            candidate_path,
            kind=kind,
            identity=identity,
            name=name,
            known_hash=known_hash,
        )
        if disposition == "accepted":
            return True
        if disposition == "packet-set":
            return False
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
                    nested_disposition = examine(
                        nested,
                        kind=f"{kind}-nested",
                        identity=nested_identity,
                        name=f"{name}!{nested_identity.rsplit('!', 1)[-1]}",
                    )
                    if nested_disposition == "accepted":
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
            remote_candidates.extend(
                explicit_artifact_candidate(args.github_api_url, value)
                for value in args.artifact
            )
            remote_candidates.extend(
                explicit_release_candidate(args.github_api_url, value)
                for value in args.release_asset
            )

            def discover_repository(repository: str, errors: list[str]) -> None:
                try:
                    remote_candidates.extend(
                        discover_actions_artifacts(api, repository, pattern, args.max_remote_items)
                    )
                except HarvestError as exc:
                    errors.append(str(exc))
                try:
                    remote_candidates.extend(
                        discover_release_assets(api, repository, pattern, args.max_remote_items)
                    )
                except HarvestError as exc:
                    errors.append(str(exc))

            for repository in required_repositories:
                discover_repository(repository, discovery_errors)
            for repository in optional_repositories:
                discover_repository(repository, optional_discovery_errors)

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

        transport_failures = sum(result.outcome == "download-refused" for result in checked)
        approved_packet_count = sum(bool(candidate["approved"]) for candidate in packet_set_candidates)
        if found_status is not None:
            status = found_status
        elif discovery_errors or transport_failures:
            status = "harvest-error"
        elif packet_set_candidates:
            status = "packet-set-approval-required"
        else:
            status = "source-not-found"
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
            "foundEvidenceKind": found_evidence_kind,
            "foundPacketSetSha256": found_packet_set_sha256,
            "approvedPacketSetSha256s": sorted(approved_packet_sets),
            "packetSetCandidates": packet_set_candidates,
            "repositories": required_repositories,
            "optionalRepositories": optional_repositories,
            "scope": {
                "requiredRepositories": required_repositories,
                "optionalRepositories": optional_repositories,
                "requiredDiscoveryComplete": not discovery_errors,
                "optionalDiscoveryComplete": not optional_discovery_errors,
                "sourceNotFoundAuthority": "required-repositories-only",
            },
            "checked": [asdict(result) for result in checked],
            "summary": {
                "candidates": len(checked),
                "packetSetCandidates": len(packet_set_candidates),
                "approvedPacketSets": approved_packet_count,
                "downloadedBytes": downloaded,
                "discoveryErrors": len(discovery_errors),
                "transportFailures": transport_failures,
                "optionalDiscoveryErrors": len(optional_discovery_errors),
            },
            "discoveryErrors": discovery_errors,
            "optionalDiscoveryErrors": optional_discovery_errors,
            "authority": {
                "humanWorkstationRequired": False,
                "parentAdmission": "exact-contract-parent-only",
                "packetSetAdmission": "external-packet-set-sha256-pin-only",
                "packetSetStanding": "transport-only-and-does-not-authorize-source-amendment",
                "canonicalInference": "none",
                "sourceAbsence": "requires-complete-required-repository-enumeration-and-download-and-does-not-authorize-fabrication",
                "optionalRepositoryGaps": "recorded-separately-and-excluded-from-required-scope-absence-authority",
            },
        }
        write_receipt(output, receipt)
        print(json.dumps(receipt, indent=2, sort_keys=True))
        if status == "source-not-found" and args.require_source:
            return 4
        if status in {
            "source-required",
            "source-required-packet-set",
            "packet-set-approval-required",
        }:
            return 3
        if status == "harvest-error":
            return 2
        return 0
    except Exception:
        if output.exists():
            shutil.rmtree(output, ignore_errors=True)
        raise
