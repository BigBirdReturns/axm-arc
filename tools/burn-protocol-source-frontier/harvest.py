#!/usr/bin/env python3
"""Autonomously harvest the exact Burn Protocol source parent from remote custody.

A remote name or location never grants standing. Every candidate is delegated
to the landed fail-closed recovery authority and only the contract-pinned parent
byte count and SHA-256 can produce E04C2 frontier packets.
"""

from __future__ import annotations

import sys

from harvest_common import HarvestError
from harvest_main import main


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except HarvestError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
