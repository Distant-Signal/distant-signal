#!/usr/bin/env python3
# ruff: noqa: T201  # a CLI whose output (the drift) is stdout
"""Check the dev stack's SFTP entrypoint against ds-deploy's pinned copy.

  uv run scripts/check-sftp-entrypoint.py [--write] [--source FILE]

docker/schedule-sftp-entrypoint.sh is a copy of
charts/distant-signal/files/schedule-sftp-entrypoint.sh in
Distant-Signal/ds-deploy (repo split spec §9 phase 5), which the chart
embeds; docker-compose.yml mounts the copy into the dev stack's sftpgo
container. docker/schedule-sftp-entrypoint.ds-deploy pins the ds-deploy
commit (its last line), and Renovate moves it to ds-deploy's main.

This fetches the chart's script at that commit and exits 1, with a diff,
when the copy differs; --write updates the copy instead. --source FILE
reads the chart's script from FILE (tests, or a local ds-deploy checkout).
Exit 2 when the pin is malformed or the script can't be fetched. Stdlib
only.
"""

import argparse
import difflib
import re
import sys
import urllib.request
from collections.abc import Sequence
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COPY = Path("docker/schedule-sftp-entrypoint.sh")
PIN = Path("docker/schedule-sftp-entrypoint.ds-deploy")
CHART_PATH = "charts/distant-signal/files/schedule-sftp-entrypoint.sh"
RAW = "https://raw.githubusercontent.com/Distant-Signal/ds-deploy"
COMMIT = re.compile(r"[0-9a-f]{40}")


class InputError(Exception):
    """A malformed pin or an unreachable source: exit 2."""


def pinned_commit(root: Path) -> str:
    """Return the ds-deploy commit the pin file's last line names."""
    lines = [
        line.strip()
        for line in (root / PIN).read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    ]
    if len(lines) != 1 or not COMMIT.fullmatch(lines[0]):
        msg = f"{PIN} must end with one 40-hex ds-deploy commit"
        raise InputError(msg)
    return lines[0]


def fetch(commit: str) -> bytes:
    """Return the chart's script at COMMIT."""
    url = f"{RAW}/{commit}/{CHART_PATH}"
    try:
        with urllib.request.urlopen(url, timeout=30) as response:  # noqa: S310
            data: bytes = response.read()
    except OSError as error:
        msg = f"cannot fetch {url}: {error}"
        raise InputError(msg) from error
    return data


def main(argv: Sequence[str] | None = None) -> int:
    """Check or write the copy; see the module docstring."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n", 1)[0])
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--source", type=Path)
    parser.add_argument("--root", type=Path, default=ROOT, help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    try:
        commit = pinned_commit(args.root)
        want = args.source.read_bytes() if args.source else fetch(commit)
    except InputError as error:
        print(f"::error::{error}")
        return 2
    copy = args.root / COPY
    have = copy.read_bytes() if copy.is_file() else b""
    if have == want:
        print(f"{COPY} matches ds-deploy {commit[:12]}")
        return 0
    if args.write:
        copy.write_bytes(want)
        copy.chmod(0o755)
        print(f"wrote {COPY} from ds-deploy {commit[:12]}")
        return 0
    diff = difflib.unified_diff(
        have.decode("utf-8", "replace").splitlines(keepends=True),
        want.decode("utf-8", "replace").splitlines(keepends=True),
        str(COPY),
        f"ds-deploy@{commit[:12]}:{CHART_PATH}",
    )
    sys.stdout.writelines(diff)
    print(f"::error file={COPY}::differs from ds-deploy {commit[:12]}'s {CHART_PATH}")
    print("run `uv run scripts/check-sftp-entrypoint.py --write` and commit the result")
    return 1


if __name__ == "__main__":
    sys.exit(main())
