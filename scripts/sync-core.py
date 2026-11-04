#!/usr/bin/env python3
# ruff: noqa: T201  # a CLI whose output (the stale files) is stdout
"""Vendor ds-core's access files from the release core-version names.

  uv run scripts/sync-core.py [--check] [--assets-dir DIR]

Repo split spec §5.1. Every ds-core tag vX.Y.Z publishes signed GitHub
release assets. The web app's tests check /attribution against the line
catalogue validator's site credits, one of them:

  site-credits.json       -> frontend/lib/site-credits.json

The other six (the chart's access files and the Redis ACL renderer) are
Distant-Signal/ds-deploy's, which vendors them with its own copy of this
script (repo split phase 5).

The version is the one line of `core-version` (Renovate's ds-core group
bumps it). For each asset this downloads
`<asset>` and `<asset>.sigstore.json` (cosign sign-blob's bundle) from
https://github.com/Distant-Signal/ds-core/releases/download/<version>/,
verifies the bundle with `cosign verify-blob` against ds-core's release
workflow at that tag, and then writes the copy, or with --check writes
nothing and exits 1 naming each copy that differs. --assets-dir DIR reads
the assets from DIR instead of downloading them (still verified).

Where a Cargo.toml exists (no longer here since repo split phase 9, which
moved the last Rust crates out; the check stays for a repository that has
one), every ds-core `tag =` in its [workspace.dependencies] must be
core-version. A disagreement is exit 1, with or without --check.

Exit 2 when an asset can't be fetched or doesn't verify. Stdlib only;
needs cosign on PATH.
"""

import argparse
import shutil
import subprocess
import sys
import tempfile
import tomllib
import urllib.request
from collections.abc import Sequence
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION_FILE = Path("core-version")
REPOSITORY = "Distant-Signal/ds-core"
RELEASES = f"https://github.com/{REPOSITORY}/releases/download"
ISSUER = "https://token.actions.githubusercontent.com"
CORE_GIT = f"https://github.com/{REPOSITORY}"

# (release asset, vendored copy relative to the repository root)
ASSETS = (("site-credits.json", Path("frontend/lib/site-credits.json")),)


class AssetError(Exception):
    """An asset that can't be fetched or doesn't verify: exit 2."""


def identity(version: str) -> str:
    """Return the certificate identity ds-core's release workflow signs as."""
    return (
        f"https://github.com/{REPOSITORY}/.github/workflows/release.yml"
        f"@refs/tags/{version}"
    )


def read_version(root: Path) -> str:
    """Return core-version's version."""
    version = (root / VERSION_FILE).read_text(encoding="utf-8").strip()
    if not version.startswith("v") or version.count(".") != 2:  # noqa: PLR2004
        msg = f"{VERSION_FILE} must hold one vX.Y.Z version, got {version!r}"
        raise AssetError(msg)
    return version


def pin_problems(root: Path, version: str) -> list[str]:
    """Return where Cargo.toml pins a ds-core other than VERSION."""
    problems: list[str] = []
    cargo = root / "Cargo.toml"
    if cargo.is_file():
        deps = tomllib.loads(cargo.read_text(encoding="utf-8"))
        core = {
            name: spec
            for name, spec in deps.get("workspace", {}).get("dependencies", {}).items()
            if isinstance(spec, dict) and spec.get("git") == CORE_GIT
        }
        problems += [
            f"Cargo.toml: {name} is on {spec.get('tag')!r}, {VERSION_FILE} {version}"
            for name, spec in sorted(core.items())
            if spec.get("tag") != version
        ]
    return problems


def download(url: str, target: Path) -> None:
    """Fetch URL into TARGET."""
    if not url.startswith("https://"):
        msg = f"refusing a non-https URL: {url}"
        raise AssetError(msg)
    try:
        with urllib.request.urlopen(url, timeout=60) as response:  # noqa: S310
            target.write_bytes(response.read())
    except OSError as error:
        msg = f"cannot fetch {url}: {error}"
        raise AssetError(msg) from error


def fetch(version: str, assets_dir: Path | None, work: Path) -> dict[str, Path]:
    """Return every asset and its bundle, downloaded into WORK or from ASSETS_DIR."""
    found: dict[str, Path] = {}
    for name, _ in ASSETS:
        for file in (name, f"{name}.sigstore.json"):
            if assets_dir is not None:
                if not (assets_dir / file).is_file():
                    msg = f"{assets_dir / file} is missing"
                    raise AssetError(msg)
                shutil.copy(assets_dir / file, work / file)
            else:
                download(f"{RELEASES}/{version}/{file}", work / file)
        found[name] = work / name
    return found


def verify(version: str, asset: Path, cosign: str) -> None:
    """Verify ASSET's bundle against ds-core's release workflow at VERSION."""
    result = subprocess.run(  # noqa: S603
        [
            cosign,
            "verify-blob",
            "--bundle",
            f"{asset}.sigstore.json",
            "--certificate-identity",
            identity(version),
            "--certificate-oidc-issuer",
            ISSUER,
            str(asset),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        msg = (
            f"{asset.name} doesn't verify as {identity(version)}: "
            f"{result.stderr.strip()}"
        )
        raise AssetError(msg)


def main(argv: Sequence[str] | None = None) -> int:
    """Vendor or check the core files; see the module docstring."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n", 1)[0])
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--assets-dir", type=Path)
    parser.add_argument("--cosign", default=shutil.which("cosign") or "cosign")
    parser.add_argument("--root", type=Path, default=ROOT, help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    try:
        version = read_version(args.root)
        problems = pin_problems(args.root, version)
        with tempfile.TemporaryDirectory() as tmp:
            assets = fetch(version, args.assets_dir, Path(tmp))
            for path in assets.values():
                verify(version, path, args.cosign)
            stale = []
            for name, copy in ASSETS:
                data = assets[name].read_bytes()
                target = args.root / copy
                if target.is_file() and target.read_bytes() == data:
                    continue
                stale.append(copy)
                if not args.check:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(data)
    except AssetError as error:
        print(f"::error::{error}")
        return 2
    for problem in problems:
        print(f"::error::{problem}")
    if args.check and stale:
        for copy in stale:
            print(
                f"::error file={copy}::differs from ds-core {version}'s release asset"
            )
        print("run `uv run scripts/sync-core.py` and commit the result")
        return 1
    if problems:
        return 1
    verb = "checked" if args.check else "wrote"
    print(f"{verb} {len(ASSETS)} file(s) from ds-core {version} ({len(stale)} changed)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
