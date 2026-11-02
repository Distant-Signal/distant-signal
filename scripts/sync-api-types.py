#!/usr/bin/env python3
# ruff: noqa: T201  # a CLI that reports what it wrote (or found stale) on stdout
"""Copy the api's generated TypeScript types into the frontend.

  uv run scripts/sync-api-types.py write   # copy api-types/api.ts to the frontend
  uv run scripts/sync-api-types.py check   # exit 1 if the frontend's copy differs

The api generates api-types/api.ts from its Rust types with ts-rs
(crates/api/src/api_types.rs; its `api_types_are_current` test fails when
that file is stale). The frontend imports its copy, frontend/lib/api-types.ts,
which must match byte for byte. CI's scripts-lint job runs `check`.

Repo-split spec §5.3: once the api has its own repository, this script
reads the file from the pinned api image (frontend/e2e/api-image.txt,
/usr/share/distant-signal/api-types.ts) instead of from api-types/.
Exit status: 0 in sync (or written), 1 stale, 2 the source is missing.
Stdlib only.
"""

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "api-types" / "api.ts"
TARGET = ROOT / "frontend" / "lib" / "api-types.ts"


REGENERATE = "UPDATE_API_TYPES=1 cargo test -p api api_types"


def main(argv: Sequence[str] | None = None) -> int:
    """Copy or check; 0 in sync (or written), 1 stale, 2 no source."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n", 1)[0])
    parser.add_argument("mode", choices=("write", "check"))
    args = parser.parse_args(argv)
    try:
        source = SOURCE.read_bytes()
    except FileNotFoundError:
        print(f"::error file={SOURCE.relative_to(ROOT)}::missing; run `{REGENERATE}`")
        return 2
    target = TARGET.read_bytes() if TARGET.exists() else None
    if args.mode == "write":
        if target != source:
            TARGET.write_bytes(source)
            print(f"wrote {TARGET.relative_to(ROOT)}")
        return 0
    if target != source:
        target_path = TARGET.relative_to(ROOT)
        print(
            f"::error file={target_path}::stale against {SOURCE.relative_to(ROOT)}; "
            "run `uv run scripts/sync-api-types.py write`"
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
