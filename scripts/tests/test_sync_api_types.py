"""Tests for scripts/sync-api-types.py, on files in a temporary directory.

The registry is a dict behind the script's `fetch` hook: no network.

uv run python -m unittest discover -s scripts/tests
"""

import gzip
import hashlib
import importlib.util
import io
import json
import subprocess
import sys
import tarfile
import tempfile
import unittest
import urllib.error
from collections.abc import Mapping
from contextlib import redirect_stdout
from email.message import Message
from pathlib import Path
from types import ModuleType
from typing import override
from unittest import mock

SCRIPT = Path(__file__).resolve().parent.parent / "sync-api-types.py"


def _load() -> ModuleType:
    spec = importlib.util.spec_from_file_location("sync_api_types", SCRIPT)
    if spec is None or spec.loader is None:
        msg = f"cannot load {SCRIPT}"
        raise ImportError(msg)
    module = importlib.util.module_from_spec(spec)
    sys.modules["sync_api_types"] = module
    spec.loader.exec_module(module)
    return module


sync = _load()

TYPES = b"export type A = string;\n"
OPENAPI = b'{"openapi": "3.1.0"}\n'
TYPES_PATH = "usr/share/distant-signal/api-types.ts"
OPENAPI_PATH = "usr/share/distant-signal/openapi-v1.json"
REPO = "ghcr.io/distant-signal/images/api"
BASE = "https://ghcr.io/v2/distant-signal/images/api"
COMMIT = "c4cff60c9379e31464573c53a9ad2e2d1582e400"
TAG = f"build.41810476990-{COMMIT}"
OCI_MANIFEST = "application/vnd.oci.image.manifest.v1+json"
GZIP_LAYER = "application/vnd.oci.image.layer.v1.tar+gzip"


def digest(data: bytes) -> str:
    """Return DATA's registry digest."""
    return f"sha256:{hashlib.sha256(data).hexdigest()}"


def layer(files: Mapping[str, bytes]) -> bytes:
    """Return a gzipped tar of FILES (an empty value is a whiteout)."""
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w") as tar:
        for name, data in files.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
    return gzip.compress(buffer.getvalue(), mtime=0)


class FakeRegistry:
    """An anonymous registry: URL -> body, with an optional token challenge."""

    def __init__(self) -> None:
        """Start empty."""
        self.bodies: dict[str, bytes] = {}
        self.challenge = False
        self.requests: list[str] = []

    def image(self, tag: str, *layers: Mapping[str, bytes]) -> str:
        """Serve an image of LAYERS (oldest first) at TAG; return its digest."""
        blobs = [layer(files) for files in layers]
        for blob in blobs:
            self.bodies[f"{BASE}/blobs/{digest(blob)}"] = blob
        config = b"{}"
        self.bodies[f"{BASE}/blobs/{digest(config)}"] = config
        manifest = json.dumps(
            {
                "schemaVersion": 2,
                "mediaType": OCI_MANIFEST,
                "config": {"digest": digest(config)},
                "layers": [
                    {"mediaType": GZIP_LAYER, "digest": digest(b)} for b in blobs
                ],
            }
        ).encode()
        self.bodies[f"{BASE}/manifests/{tag}"] = manifest
        self.bodies[f"{BASE}/manifests/{digest(manifest)}"] = manifest
        return digest(manifest)

    def fetch(
        self, url: str, headers: Mapping[str, str]
    ) -> tuple[bytes, Mapping[str, str]]:
        """Serve URL, asking for a token first when `challenge` is set."""
        self.requests.append(url)
        if url.startswith("https://ghcr.io/token?"):
            return b'{"token": "anonymous"}', {}
        if self.challenge and headers.get("Authorization") != "Bearer anonymous":
            fields = Message()
            fields["WWW-Authenticate"] = (
                'Bearer realm="https://ghcr.io/token",service="ghcr.io",'
                'scope="repository:distant-signal/images/api:pull"'
            )
            raise urllib.error.HTTPError(url, 401, "Unauthorized", fields, None)
        if url not in self.bodies:
            raise urllib.error.HTTPError(url, 404, "Not Found", Message(), None)
        return self.bodies[url], {}


class SyncCase(unittest.TestCase):
    """A temporary repo with both copies' places and a fake registry."""

    @override
    def setUp(self) -> None:
        """Point the script at an empty temporary repo."""
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.source = self.root / "api-types" / "api.ts"
        self.target = self.root / "frontend" / "lib" / "api-types.ts"
        self.json_source = self.root / "api-types" / "openapi" / "v1.json"
        self.json_target = self.root / "frontend" / "lib" / "openapi-v1.json"
        self.pin = self.root / "frontend" / "api-image.txt"
        self.target.parent.mkdir(parents=True)
        copies = (
            sync.Copy(self.source, TYPES_PATH, self.target, "regenerate types"),
            sync.Copy(
                self.json_source, OPENAPI_PATH, self.json_target, "regenerate openapi"
            ),
        )
        patches = {
            "ROOT": self.root,
            "COPIES": copies,
            "TREE": self.root / "api-types",
            "PIN": self.pin,
        }
        for name, value in patches.items():
            patcher = mock.patch.object(sync, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        sleep = mock.patch.object(sync.time, "sleep")
        sleep.start()
        self.addCleanup(sleep.stop)
        self.registry = FakeRegistry()

    def write_sources(self) -> None:
        """Both generated files, with content."""
        self.json_source.parent.mkdir(parents=True)
        self.source.write_bytes(TYPES)
        self.json_source.write_bytes(OPENAPI)

    def serve_image(self, tag: str = TAG) -> str:
        """Serve an api image with both files at TAG; return its digest."""
        return self.registry.image(
            tag,
            {"usr/local/bin/api": b"\x7fELF"},
            {TYPES_PATH: TYPES},
            {OPENAPI_PATH: OPENAPI},
        )

    def write_pin(self, image_digest: str, tag: str = TAG) -> None:
        """Pin REPO:TAG@IMAGE_DIGEST."""
        self.pin.parent.mkdir(parents=True, exist_ok=True)
        self.pin.write_text(f"# a comment\n{REPO}:{tag}@{image_digest}\n", "utf-8")

    def run_mode(self, *args: str) -> tuple[int, str]:
        """Run the script with ARGS; its exit status and output."""
        out = io.StringIO()
        with redirect_stdout(out):
            status = sync.main(list(args), fetch=self.registry.fetch)
        return status, out.getvalue()


class TreeTests(SyncCase):
    """`write` copies api-types/; `check` fails until it has."""

    def test_missing_source_is_status_2(self) -> None:
        """No generated files: exit 2, naming each."""
        self.source.parent.mkdir()
        status, out = self.run_mode("check")
        self.assertEqual(status, 2)
        self.assertIn("::error file=api-types/api.ts::", out)
        self.assertIn("::error file=api-types/openapi/v1.json::", out)

    def test_check_fails_until_written(self) -> None:
        """Missing copies are stale; `write` makes them match."""
        self.write_sources()
        status, out = self.run_mode("check")
        self.assertEqual(status, 1)
        self.assertIn("::error file=frontend/lib/api-types.ts::stale", out)
        self.assertIn("::error file=frontend/lib/openapi-v1.json::stale", out)
        self.assertEqual(self.run_mode("write")[0], 0)
        self.assertEqual(self.target.read_bytes(), self.source.read_bytes())
        self.assertEqual(self.json_target.read_bytes(), self.json_source.read_bytes())
        self.assertEqual(self.run_mode("check"), (0, ""))

    def test_one_stale_copy_fails(self) -> None:
        """The types in sync but the OpenAPI copy stale: still exit 1."""
        self.write_sources()
        self.run_mode("write")
        self.json_target.write_bytes(b"{}\n")
        status, out = self.run_mode("check")
        self.assertEqual(status, 1)
        self.assertNotIn("api-types.ts", out)
        self.assertIn("openapi-v1.json::stale", out)

    def test_check_is_byte_for_byte(self) -> None:
        """A line-ending difference is stale too."""
        self.write_sources()
        self.run_mode("write")
        self.target.write_bytes(b"export type A = string;\r\n")
        self.assertEqual(self.run_mode("check")[0], 1)

    def test_auto_reads_the_tree_while_it_exists(self) -> None:
        """With api-types/ present, no pin is needed and no request made."""
        self.write_sources()
        self.assertEqual(self.run_mode("write")[0], 0)
        self.assertEqual(self.registry.requests, [])


class ImageTests(SyncCase):
    """--from image reads the pinned image, verifying every byte."""

    def test_auto_reads_the_pinned_image_without_a_tree(self) -> None:
        """No api-types/: `write` copies both files out of the pinned image."""
        self.write_pin(self.serve_image())
        self.assertEqual(self.run_mode("write")[0], 0)
        self.assertEqual(self.target.read_bytes(), TYPES)
        self.assertEqual(self.json_target.read_bytes(), OPENAPI)
        self.assertEqual(self.run_mode("check"), (0, ""))

    def test_stale_against_the_image(self) -> None:
        """A copy that differs from the image's file is stale, naming the image."""
        self.write_pin(self.serve_image())
        self.run_mode("write")
        self.target.write_bytes(b"old\n")
        status, out = self.run_mode("check", "--from", "image")
        self.assertEqual(status, 1)
        self.assertIn(f"stale against /{TYPES_PATH} in {REPO}:{TAG}", out)

    def test_only_the_top_layers_are_downloaded(self) -> None:
        """The binary's layer, below both files, is never fetched."""
        self.write_pin(self.serve_image())
        self.run_mode("write")
        blobs = [u for u in self.registry.requests if "/blobs/" in u]
        self.assertEqual(len(blobs), 2)

    def test_anonymous_token(self) -> None:
        """A 401 challenge gets an anonymous token, then the reads succeed."""
        self.registry.challenge = True
        self.write_pin(self.serve_image())
        self.assertEqual(self.run_mode("write")[0], 0)
        self.assertTrue(self.registry.requests[1].startswith("https://ghcr.io/token?"))

    def test_moved_tag_fails(self) -> None:
        """The tag naming another digest than the pin's is exit 2."""
        pinned = self.serve_image()
        self.registry.image(TAG, {TYPES_PATH: b"new\n"}, {OPENAPI_PATH: OPENAPI})
        self.write_pin(pinned)
        status, out = self.run_mode("check")
        self.assertEqual(status, 2)
        self.assertIn("the tag now names", out)

    def test_tampered_layer_fails(self) -> None:
        """A blob whose bytes don't hash to its digest is exit 2."""
        self.write_pin(self.serve_image())
        for url in [u for u in self.registry.bodies if "/blobs/" in u]:
            self.registry.bodies[url] += b"x"
        status, out = self.run_mode("check")
        self.assertEqual(status, 2)
        self.assertIn("hashes to", out)

    def test_an_image_without_the_openapi_document(self) -> None:
        """An image built before it carried v1.json: exit 2, naming the file."""
        self.write_pin(self.registry.image(TAG, {TYPES_PATH: TYPES}))
        status, out = self.run_mode("check")
        self.assertEqual(status, 2)
        self.assertIn(f"has no /{OPENAPI_PATH}", out)

    def test_a_whiteout_hides_an_older_file(self) -> None:
        """A file deleted in a later layer is missing."""
        image = self.registry.image(
            TAG,
            {TYPES_PATH: TYPES, OPENAPI_PATH: OPENAPI},
            {"usr/share/distant-signal/.wh.openapi-v1.json": b""},
        )
        self.write_pin(image)
        status, out = self.run_mode("check")
        self.assertEqual(status, 2)
        self.assertIn(f"has no /{OPENAPI_PATH}", out)

    def test_an_index_resolves_to_linux_amd64(self) -> None:
        """A pinned index is verified, then its linux/amd64 image read."""
        image = self.serve_image("inner")
        index = json.dumps(
            {
                "mediaType": "application/vnd.oci.image.index.v1+json",
                "manifests": [
                    {"digest": "sha256:" + "0" * 64, "platform": {"os": "unknown"}},
                    {
                        "digest": image,
                        "platform": {"os": "linux", "architecture": "amd64"},
                    },
                ],
            }
        ).encode()
        self.registry.bodies[f"{BASE}/manifests/{TAG}"] = index
        self.registry.bodies[f"{BASE}/manifests/{digest(index)}"] = index
        self.write_pin(digest(index))
        self.assertEqual(self.run_mode("write")[0], 0)
        self.assertEqual(self.json_target.read_bytes(), OPENAPI)

    def test_a_missing_pin(self) -> None:
        """No api-types/ and no pin: exit 2, saying how to pin."""
        status, out = self.run_mode("check")
        self.assertEqual(status, 2)
        self.assertIn("pin --latest", out)

    def test_a_malformed_pin(self) -> None:
        """A pin without a digest is exit 2."""
        self.pin.parent.mkdir(parents=True, exist_ok=True)
        self.pin.write_text(f"{REPO}:{TAG}\n", "utf-8")
        status, out = self.run_mode("check")
        self.assertEqual(status, 2)
        self.assertIn("expected one", out)


class PinTests(SyncCase):
    """`pin` writes the pin and the copies."""

    def test_pin_latest(self) -> None:
        """--latest takes the highest run id, not the last listed tag."""
        self.serve_image()
        older = self.registry.image(
            f"build.9-{'a' * 40}", {TYPES_PATH: b"old\n", OPENAPI_PATH: OPENAPI}
        )
        self.registry.bodies[f"{BASE}/tags/list?n=100000"] = json.dumps(
            {"tags": [TAG, f"build.9-{'a' * 40}", "main", "sha256-abc.sig"]}
        ).encode()
        status, out = self.run_mode("pin", "--latest")
        self.assertEqual(status, 0, out)
        pin = sync.read_pin(self.pin)
        self.assertEqual((pin.tag, pin.commit), (TAG, COMMIT))
        self.assertNotEqual(pin.digest, older)
        self.assertEqual(self.target.read_bytes(), TYPES)
        self.assertEqual(self.run_mode("check"), (0, ""))

    def test_pin_a_tag_keeps_the_pins_repository(self) -> None:
        """An explicit tag; the existing pin's repository is kept."""
        image = self.serve_image()
        self.write_pin("sha256:" + "1" * 64, "build.1-abcdef0")
        self.assertEqual(self.run_mode("pin", TAG)[0], 0)
        self.assertEqual(str(sync.read_pin(self.pin)), f"{REPO}:{TAG}@{image}")

    def test_pin_an_unknown_tag(self) -> None:
        """A tag the registry doesn't have is exit 2 and writes nothing."""
        status, _ = self.run_mode("pin", "build.1-abcdef0")
        self.assertEqual(status, 2)
        self.assertFalse(self.pin.exists())


class VerifyPinTests(SyncCase):
    """`verify-pin` compares the image with its commit's api-types/."""

    def git(self, *args: str) -> str:
        """Run git in the temporary repo."""
        command = ["git", "-C", str(self.root), *args]
        done = subprocess.run(command, check=True, capture_output=True, text=True)  # noqa: S603  # git from PATH
        return done.stdout.strip()

    def commit_sources(self) -> str:
        """Commit api-types/ in a fresh repo; return the commit."""
        self.git("init", "-q")
        self.write_sources()
        self.git("add", "api-types")
        self.git(
            "-c", "user.name=t", "-c", "user.email=t@example.invalid",
            "commit", "-q", "-m", "types",
        )  # fmt: skip
        return self.git("rev-parse", "HEAD")

    def test_the_image_is_its_commit(self) -> None:
        """Equal files: exit 0."""
        commit = self.commit_sources()
        tag = f"build.5-{commit}"
        self.write_pin(self.serve_image(tag), tag)
        status, out = self.run_mode("verify-pin")
        self.assertEqual(status, 0, out)

    def test_an_image_that_differs_from_its_commit(self) -> None:
        """A file the commit didn't generate: exit 1."""
        commit = self.commit_sources()
        tag = f"build.5-{commit}"
        image = self.registry.image(
            tag, {TYPES_PATH: b"other\n", OPENAPI_PATH: OPENAPI}
        )
        self.write_pin(image, tag)
        status, out = self.run_mode("verify-pin")
        self.assertEqual(status, 1)
        self.assertIn(f"/{TYPES_PATH} in", out)

    def test_a_tag_without_a_commit(self) -> None:
        """A tag that names no commit can't be verified: exit 2."""
        self.write_pin(self.serve_image("main"), "main")
        self.assertEqual(self.run_mode("verify-pin")[0], 2)


if __name__ == "__main__":
    unittest.main()
