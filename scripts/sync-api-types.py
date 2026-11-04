#!/usr/bin/env python3
# ruff: noqa: T201  # a CLI that reports what it wrote (or found stale) on stdout
"""Copy the api's generated types and OpenAPI document into the frontend.

  uv run scripts/sync-api-types.py write   # copy them into the frontend
  uv run scripts/sync-api-types.py check   # exit 1 if a frontend copy differs
  uv run scripts/sync-api-types.py pin build.<run>-<sha> | --latest
  uv run scripts/sync-api-types.py verify-pin [--remote URL]

The api generates two files the frontend reads, and the frontend keeps a
byte-for-byte copy of each (CI's repo-checks job runs `check`):

  - api-types/api.ts, from its Rust types with ts-rs
    (crates/api/src/api_types.rs; its `api_types_are_current` test fails
    when that file is stale), copied to frontend/lib/api-types.ts;
  - api-types/openapi/v1.json, the personal-token API's OpenAPI document
    (`openapi_document_is_current`), copied to
    frontend/lib/openapi-v1.json for the /developers/api reference.

Where `write` and `check` read them (--from, repo split spec §5.3):

  tree   api-types/ in this checkout, while the api lives here;
  image  the api image frontend/api-image.txt pins, which carries both
         files under /usr/share/distant-signal/ (docker/api.Dockerfile),
         once the api has its own repository;
  auto   (the default) tree when api-types/ exists, else image.

The pin is one line, `<repository>:build.<run>-<commit>@sha256:<digest>`
(lines starting with # are comments). Reading the image checks every
byte against the pin: the tag must still name the pinned digest, the
manifest must hash to it, and each layer read must hash to the digest
its manifest gives. Only the image's top layers are downloaded, newest
first, until both files are found; the registry is read anonymously, as
the cluster pulls.

`pin` writes the pin for a build tag (or, with --latest, the newest
`build.<run>-<commit>` tag in the repository), then the copies from that
image: the hand bump while Renovate is idle. `verify-pin` checks that the
pinned image's files are the ones its commit (the tag's
`build.<run>-<commit>`) generated, fetching the commit from --remote
(default origin) when the checkout doesn't have it.

Exit status: 0 in sync (or written), 1 stale, 2 a source is missing or
can't be read or verified. Stdlib only.
"""

import argparse
import gzip
import hashlib
import io
import json
import re
import subprocess
import sys
import tarfile
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, override

ROOT = Path(__file__).resolve().parent.parent
PIN = ROOT / "frontend" / "api-image.txt"
TREE = ROOT / "api-types"
API_REPOSITORY = "ghcr.io/distant-signal/images/api"
PIN_HEADER = """\
# The api image the frontend's types, OpenAPI copy and e2e come from (repo
# split spec §5.3): `uv run scripts/sync-api-types.py pin --latest` bumps it
# and rewrites frontend/lib/api-types.ts and openapi-v1.json from it.
"""


@dataclass(frozen=True)
class Copy:
    """A generated file, where the api image carries it, and the frontend's copy."""

    source: Path
    image_path: str
    target: Path
    regenerate: str


COPIES: tuple[Copy, ...] = (
    Copy(
        ROOT / "api-types" / "api.ts",
        "usr/share/distant-signal/api-types.ts",
        ROOT / "frontend" / "lib" / "api-types.ts",
        "UPDATE_API_TYPES=1 cargo test -p api api_types",
    ),
    Copy(
        ROOT / "api-types" / "openapi" / "v1.json",
        "usr/share/distant-signal/openapi-v1.json",
        ROOT / "frontend" / "lib" / "openapi-v1.json",
        "UPDATE_OPENAPI=1 cargo test -p api openapi_document_is_current",
    ),
)


class SourceError(Exception):
    """A source that is missing or can't be read or verified: exit 2."""


# --- the pin --------------------------------------------------------------

BUILD_TAG = re.compile(r"build\.(\d+)-([0-9a-f]{7,40})")
PIN_LINE = re.compile(
    r"(?P<repository>[a-z0-9.-]+(?::\d+)?/[a-z0-9._/-]+)"
    r":(?P<tag>[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})"
    r"@(?P<digest>sha256:[0-9a-f]{64})"
)


@dataclass(frozen=True)
class Pin:
    """An image reference pinned by tag and digest."""

    repository: str
    tag: str
    digest: str

    @property
    def host(self) -> str:
        """The registry host."""
        return self.repository.partition("/")[0]

    @property
    def name(self) -> str:
        """The repository name within the registry."""
        return self.repository.partition("/")[2]

    @property
    def commit(self) -> str | None:
        """The commit a `build.<run>-<commit>` tag names."""
        match = BUILD_TAG.fullmatch(self.tag)
        return match.group(2) if match else None

    @override
    def __str__(self) -> str:
        """Return the reference as the pin file writes it."""
        return f"{self.repository}:{self.tag}@{self.digest}"


def parse_pin(text: str, where: str = "the pin") -> Pin:
    """Return the one reference in TEXT (a pin file's content)."""
    lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    if len(lines) != 1 or not (match := PIN_LINE.fullmatch(lines[0])):
        msg = f"{where}: expected one <repository>:<tag>@sha256:<digest> line"
        raise SourceError(msg)
    return Pin(**match.groupdict())


def read_pin(path: Path) -> Pin:
    """Return the pin in PATH."""
    try:
        text = path.read_text("utf-8")
    except FileNotFoundError:
        msg = f"{path.relative_to(ROOT)} is missing; run `{PROG} pin --latest`"
        raise SourceError(msg) from None
    return parse_pin(text, str(path.relative_to(ROOT)))


# --- the registry ---------------------------------------------------------

Fetch = Callable[[str, Mapping[str, str]], tuple[bytes, Mapping[str, str]]]
INDEX_TYPES = (
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
)
MANIFEST_TYPES = ", ".join(
    (
        INDEX_TYPES[0],
        "application/vnd.oci.image.manifest.v1+json",
        INDEX_TYPES[1],
        "application/vnd.docker.distribution.manifest.v2+json",
    )
)


def http_fetch(url: str, headers: Mapping[str, str]) -> tuple[bytes, Mapping[str, str]]:
    """GET URL; return the body and headers. HTTP errors raise."""
    request = urllib.request.Request(url, headers=dict(headers))  # noqa: S310  # https registry URLs
    with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310  # same
        return response.read(), dict(response.headers)


def sha256(data: bytes) -> str:
    """DATA's digest, as a registry writes it."""
    return f"sha256:{hashlib.sha256(data).hexdigest()}"


class Registry:
    """Anonymous reads from one repository of an OCI registry."""

    def __init__(self, host: str, name: str, fetch: Fetch = http_fetch) -> None:
        """Read HOST's NAME repository through FETCH."""
        self.base = f"https://{host}/v2/{name}"
        self.fetch = fetch
        self.token: str | None = None

    def get(self, path: str, accept: str | None = None) -> bytes:
        """GET base/PATH, with an anonymous token once the registry asks."""
        for attempt in range(1, 4):
            headers = {"Accept": accept} if accept else {}
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
            try:
                return self.fetch(f"{self.base}/{path}", headers)[0]
            except urllib.error.HTTPError as error:
                if error.code == 401 and self.token is None:  # noqa: PLR2004  # Unauthorized
                    self.token = self.bearer_token(
                        error.headers.get("WWW-Authenticate", "")
                    )
                    continue
                if error.code < 500 or attempt == 3:  # noqa: PLR2004  # a client error, or the last try
                    msg = f"{self.base}/{path}: HTTP {error.code}"
                    raise SourceError(msg) from error
            except (urllib.error.URLError, TimeoutError) as error:
                if attempt == 3:  # noqa: PLR2004  # the last try
                    msg = f"{self.base}/{path}: {error}"
                    raise SourceError(msg) from error
            time.sleep(5 * attempt)
        msg = f"{self.base}/{path}: no answer"
        raise SourceError(msg)

    def bearer_token(self, challenge: str) -> str:
        """Return an anonymous token for a `Bearer realm=...` challenge."""
        params = dict(re.findall(r'(\w+)="([^"]*)"', challenge))
        realm = params.pop("realm", "")
        if not realm.startswith("https://"):
            msg = f"unexpected registry auth challenge: {challenge!r}"
            raise SourceError(msg)
        query = "&".join(
            f"{k}={urllib.parse.quote(v, safe=':/')}" for k, v in params.items()
        )
        body, _ = self.fetch(f"{realm}?{query}", {})
        reply = json.loads(body)
        token = reply.get("token") or reply.get("access_token")
        if not isinstance(token, str):
            msg = f"no token from {realm}"
            raise SourceError(msg)
        return token

    def tag_digest(self, tag: str) -> str:
        """Return the digest TAG names now (the hash of its manifest)."""
        return sha256(self.get(f"manifests/{tag}", MANIFEST_TYPES))

    def tags(self) -> list[str]:
        """Every tag in the repository."""
        body = self.get("tags/list?n=100000")
        return [str(t) for t in json.loads(body).get("tags") or []]

    def manifest(self, digest: str) -> dict[str, Any]:
        """Return DIGEST's image manifest (linux/amd64 of an index), verified."""
        body = self.get(f"manifests/{digest}", MANIFEST_TYPES)
        if sha256(body) != digest:
            msg = f"{self.base}: the manifest for {digest} hashes to {sha256(body)}"
            raise SourceError(msg)
        manifest: dict[str, Any] = json.loads(body)
        if manifest.get("mediaType") in INDEX_TYPES or "manifests" in manifest:
            chosen = [
                m["digest"]
                for m in manifest["manifests"]
                if m.get("platform", {}).get("os") == "linux"
                and m.get("platform", {}).get("architecture") == "amd64"
            ]
            if not chosen:
                msg = f"{self.base}@{digest}: no linux/amd64 image in its index"
                raise SourceError(msg)
            return self.manifest(chosen[0])
        return manifest

    def blob(self, digest: str) -> bytes:
        """Return the blob DIGEST names, verified."""
        body = self.get(f"blobs/{digest}")
        if sha256(body) != digest:
            msg = f"{self.base}: the blob served for {digest} hashes to {sha256(body)}"
            raise SourceError(msg)
        return body


def layer_tar(media_type: str, blob: bytes) -> bytes:
    """Return a layer blob decompressed to its tar."""
    if media_type.endswith(("tar+gzip", ".tar.gzip")):
        return gzip.decompress(blob)
    if media_type.endswith("tar+zstd"):
        try:
            from compression import zstd  # type: ignore[import-not-found,unused-ignore]  # noqa: PLC0415  # Python 3.14+
        except ImportError:
            msg = "a zstd layer needs Python 3.14 or later"
            raise SourceError(msg) from None
        return bytes(zstd.decompress(blob))
    if media_type.endswith((".tar", ".tar.v1")):
        return blob
    msg = f"unknown layer type {media_type}"
    raise SourceError(msg)


def image_files(
    pin: Pin, paths: Sequence[str], fetch: Fetch = http_fetch
) -> dict[str, bytes]:
    """Return the files at PATHS in the image PIN names, every byte verified."""
    registry = Registry(pin.host, pin.name, fetch)
    if (now := registry.tag_digest(pin.tag)) != pin.digest:
        msg = f"{pin}: the tag now names {now}, not the pinned digest"
        raise SourceError(msg)
    manifest = registry.manifest(pin.digest)
    found: dict[str, bytes | None] = {}
    for layer in reversed(manifest.get("layers", [])):
        if len(found) == len(paths):
            break
        data = layer_tar(layer.get("mediaType", ""), registry.blob(layer["digest"]))
        with tarfile.open(fileobj=io.BytesIO(data)) as tar:
            for member in tar:
                name = member.name.removeprefix("./").lstrip("/")
                folder, _, base = name.rpartition("/")
                if base.startswith(".wh."):  # a whiteout: deleted in this layer
                    deleted = f"{folder}/{base.removeprefix('.wh.')}".lstrip("/")
                    if deleted in paths:
                        found.setdefault(deleted, None)
                    continue
                if name in paths and name not in found and member.isfile():
                    extracted = tar.extractfile(member)
                    found[name] = extracted.read() if extracted else None
    missing = [p for p in paths if found.get(p) is None]
    if missing:
        msg = f"{pin}: the image has no /{', /'.join(missing)}"
        raise SourceError(msg)
    return {p: v for p, v in found.items() if v is not None}


def latest_build(registry: Registry) -> str:
    """Return the newest `build.<run>-<commit>` tag (run ids only grow)."""
    builds = [
        (int(m.group(1)), t) for t in registry.tags() if (m := BUILD_TAG.fullmatch(t))
    ]
    if not builds:
        msg = f"{registry.base}: no build.<run>-<commit> tag"
        raise SourceError(msg)
    return max(builds)[1]


# --- the copies -----------------------------------------------------------

PROG = "uv run scripts/sync-api-types.py"


def tree_sources() -> dict[Copy, bytes]:
    """Each copy's source in api-types/."""
    sources, missing = {}, []
    for copy in COPIES:
        try:
            sources[copy] = copy.source.read_bytes()
        except FileNotFoundError:
            rel = copy.source.relative_to(ROOT)
            missing.append(f"::error file={rel}::missing; run `{copy.regenerate}`")
    if missing:
        raise SourceError("\n".join(missing))
    return sources


def image_sources(pin: Pin, fetch: Fetch) -> dict[Copy, bytes]:
    """Each copy's source in the pinned api image."""
    files = image_files(pin, [c.image_path for c in COPIES], fetch)
    return {copy: files[copy.image_path] for copy in COPIES}


def sync(copy: Copy, source: bytes, mode: str, origin: str) -> int:
    """Copy or check one file; 0 in sync (or written), 1 stale."""
    target = copy.target.read_bytes() if copy.target.exists() else None
    if mode == "write":
        if target != source:
            copy.target.write_bytes(source)
            print(f"wrote {copy.target.relative_to(ROOT)}")
        return 0
    if target != source:
        print(
            f"::error file={copy.target.relative_to(ROOT)}::stale against {origin}; "
            f"run `{PROG} write`"
        )
        return 1
    return 0


def sources_for(
    choice: str, fetch: Fetch
) -> tuple[dict[Copy, bytes], Callable[[Copy], str]]:
    """Return the sources --from CHOICE selects, and how a message names each."""
    if choice == "auto":
        choice = "tree" if TREE.is_dir() else "image"
    if choice == "tree":
        return tree_sources(), lambda c: str(c.source.relative_to(ROOT))
    pin = read_pin(PIN)
    image = f"{pin.repository}:{pin.tag}"
    return image_sources(pin, fetch), lambda c: f"/{c.image_path} in {image}"


def verify_pin(remote: str, fetch: Fetch) -> int:
    """0 when the pinned image's files are its commit's api-types/, else 1."""
    pin = read_pin(PIN)
    if pin.commit is None:
        msg = f"{pin}: the tag names no commit (build.<run>-<commit>)"
        raise SourceError(msg)

    def git(*args: str) -> subprocess.CompletedProcess[bytes]:
        command = ["git", *args]
        return subprocess.run(command, cwd=ROOT, capture_output=True, check=False)  # noqa: S603  # git from PATH

    if git("cat-file", "-e", f"{pin.commit}^{{commit}}").returncode != 0:
        git("fetch", "--no-tags", "--depth=1", remote, pin.commit)
    status = 0
    sources = image_sources(pin, fetch)
    for copy in COPIES:
        rel = copy.source.relative_to(ROOT).as_posix()
        shown = git("show", f"{pin.commit}:{rel}")
        if shown.returncode != 0:
            msg = f"{pin.commit}:{rel} is not readable (fetched from {remote}?)"
            raise SourceError(msg)
        if shown.stdout != sources[copy]:
            print(f"::error::/{copy.image_path} in {pin} is not {rel} at {pin.commit}")
            status = 1
    if status == 0:
        print(f"{pin}: both files are {pin.commit[:12]}'s api-types/")
    return status


def write_pin(tag: str | None, fetch: Fetch) -> int:
    """Pin TAG (None: the newest build), then write the copies from it."""
    host, _, name = API_REPOSITORY.partition("/")
    if PIN.exists():
        current = read_pin(PIN)
        host, name = current.host, current.name
    registry = Registry(host, name, fetch)
    tag = tag or latest_build(registry)
    pin = Pin(f"{host}/{name}", tag, registry.tag_digest(tag))
    sources = image_sources(pin, fetch)
    PIN.parent.mkdir(parents=True, exist_ok=True)
    PIN.write_text(f"{PIN_HEADER}{pin}\n", "utf-8")
    print(f"pinned {pin}")
    for copy in COPIES:
        sync(copy, sources[copy], "write", "")
    return 0


def main(argv: Sequence[str] | None = None, fetch: Fetch = http_fetch) -> int:
    """Run one mode; the worst status of its files."""
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n\n", 1)[0])
    modes = parser.add_subparsers(dest="mode", required=True)
    for mode in ("write", "check"):
        sub = modes.add_parser(mode)
        sub.add_argument(
            "--from", dest="source", choices=("auto", "tree", "image"), default="auto"
        )
    pin = modes.add_parser("pin")
    which = pin.add_mutually_exclusive_group(required=True)
    which.add_argument("tag", nargs="?", help="a build.<run>-<commit> tag")
    which.add_argument("--latest", action="store_true", help="the newest build tag")
    verify = modes.add_parser("verify-pin")
    verify.add_argument(
        "--remote", default="origin", help="where to fetch the commit from"
    )
    args = parser.parse_args(argv)
    try:
        if args.mode == "pin":
            return write_pin(None if args.latest else args.tag, fetch)
        if args.mode == "verify-pin":
            return verify_pin(args.remote, fetch)
        sources, origin = sources_for(args.source, fetch)
    except SourceError as error:
        text = str(error)
        print(text if text.startswith("::error") else f"::error::{text}")
        return 2
    return max(sync(c, sources[c], args.mode, origin(c)) for c in COPIES)


if __name__ == "__main__":
    sys.exit(main())
