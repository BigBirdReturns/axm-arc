from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Sequence

from harvest_common import GitHubApi, HarvestError, canonical_json_bytes
from harvest_remote import discover_owner_repositories

FORMAT = "burn-protocol-owner-custody-scope/1"
TOOL_VERSION = "1.0.0"


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Resolve explicit repositories and bounded public owner estates into one required Burn custody scope."
    )
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--repository", action="append", default=[])
    parser.add_argument("--owner", action="append", default=[])
    parser.add_argument("--max-owner-repositories", type=int, default=100)
    parser.add_argument("--github-api-url", default=os.getenv("GITHUB_API_URL", "https://api.github.com"))
    parser.add_argument("--github-token-env", default="GITHUB_TOKEN")
    parser.add_argument("--timeout", type=float, default=60.0)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv or [])
    if args.max_owner_repositories <= 0:
        raise HarvestError("Owner repository ceiling must be positive.")

    output = args.output.resolve()
    if output.exists():
        raise HarvestError(f"Scope output already exists: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)

    owners = list(dict.fromkeys(args.owner))
    explicit = list(dict.fromkeys(args.repository))
    repositories = list(explicit)
    api = GitHubApi(
        args.github_api_url,
        os.getenv(args.github_token_env) or None,
        args.timeout,
    )

    try:
        for owner in owners:
            repositories.extend(
                discover_owner_repositories(api, owner, args.max_owner_repositories)
            )
    except HarvestError as exc:
        print(str(exc), file=sys.stderr)
        output.unlink(missing_ok=True)
        return 2

    repositories = list(dict.fromkeys(repositories))
    receipt = {
        "format": FORMAT,
        "toolVersion": TOOL_VERSION,
        "owners": owners,
        "explicitRepositories": explicit,
        "repositories": repositories,
        "summary": {
            "owners": len(owners),
            "explicitRepositories": len(explicit),
            "repositories": len(repositories),
        },
        "authority": {
            "scopeOnly": True,
            "sourceStanding": "none",
            "ownerEnumeration": "public-repositories-only",
            "exactParentAdmission": "delegated-to-burn-source-harvester",
        },
    }
    output.write_bytes(canonical_json_bytes(receipt))
    print(json.dumps(receipt, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except HarvestError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(2)
