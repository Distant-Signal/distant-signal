#!/usr/bin/env python3
# ruff: noqa: T201  # a CLI that reports what it wrote (or found stale) on stdout
"""Copy the api's generated types and OpenAPI document into the frontend.

  uv run scripts/sync-api-types.py write   # copy api-types/ files to the frontend
  uv run scripts/sync-api-types.py check   # exit 1 if a frontend copy differs

The api generates two files the frontend reads, and the frontend keeps a
byte-for-byte copy of each (CI's repo-checks job runs `check`):

  - api-types/api.ts, from its Rust types with ts-rs
    (crates/api/src/api_types.rs; its `api_types_are_current` test fails
    when that file is stale), copied to frontend/lib/api-types.ts;
  - api-types/openapi/v1.json, the personal-token API's OpenAPI document
    (`openapi_document_is_current`), copied to
    frontend/lib/openapi-v1.json for the /developers/api reference.

Repo-split spec §5.3: once the api has its own repository, this script
reads the files from the pinned api image (frontend/e2e/api-image.txt,
/usr/share/distant-signal/) instead of from api-types/.
Exit status: 0 in sync (or written), 1 stale, 2 a source is missing.
Stdlib only.
"""

import argparse
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Copy:
    """A generated file and the frontend's copy of it."""

    source: Path
    target: Path
    regenerate: str


COPIES: tuple[Copy, ...] = (
    Copy(
        ROOT / "api-types" / "api.ts",
        ROOT / "frontend" / "lib" / "api-types.ts",
        "UPDATE_API_TYPES=1 cargo test -p api api_types",
    ),
    Copy(
        ROOT / "api-types" / "openapi" / "v1.json",
        ROOT / "frontend" / "lib" / "openapi-v1.json",
        "UPDATE_OPENAPI=1 cargo test -p api openapi_document_is_current",
    ),
)


def sync(copy: Copy, mode: str) -> int:
    """Copy or check one file; 0 in sync (or written), 1 stale, 2 no source."""
    try:
        source = copy.source.read_bytes()
    except FileNotFoundError:
        source_path = copy.source.relative_to(ROOT)
        print(f"::error file={source_path}::missing; run `{copy.regenerate}`")
        return 2
    target = copy.target.read_bytes() if copy.target.exists() else None
    if mode == "write":
        if target != source:
            copy.target.write_bytes(source)
            print(f"wrote {copy.target.relative_to(ROOT)}")
        return 0
    if target != source:
        print(
            f"::error file={copy.target.relative_to(ROOT)}::stale against "
            f"{copy.source.relative_to(ROOT)}; "
            "run `uv run scripts/sync-api-types.py write`"
        )
        return 1
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    """Copy or check every file; the worst status of them."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n", 1)[0])
    parser.add_argument("mode", choices=("write", "check"))
    args = parser.parse_args(argv)
    return max(sync(copy, args.mode) for copy in COPIES)


if __name__ == "__main__":
    sys.exit(main())
