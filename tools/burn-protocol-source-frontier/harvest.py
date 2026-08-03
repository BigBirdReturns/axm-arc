#!/usr/bin/env python3
"""Harvest the exact Burn parent or an externally approved frontier packet set.

A remote name or location never grants standing. Exact-parent candidates are
delegated to the fail-closed recovery authority. Recovered packet families are
byte-verified independently and acquire transport standing only through an
external packet-set SHA-256 pin. Neither path authorizes canonical inference.
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
