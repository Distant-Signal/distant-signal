"""Tests for scripts/sync-api-types.py, on files in a temporary directory.

uv run python -m unittest discover -s scripts/tests
"""

import importlib.util
import io
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
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


class SyncTests(unittest.TestCase):
    """`write` copies the api's file; `check` fails until it has."""

    @override
    def setUp(self) -> None:
        """Point the script at an empty temporary repo."""
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.source = self.root / "api-types" / "api.ts"
        self.target = self.root / "frontend" / "lib" / "api-types.ts"
        self.target.parent.mkdir(parents=True)
        for name, value in (
            ("ROOT", self.root),
            ("SOURCE", self.source),
            ("TARGET", self.target),
        ):
            patcher = mock.patch.object(sync, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def run_mode(self, mode: str) -> tuple[int, str]:
        """Run the script in `mode`; its exit status and output."""
        out = io.StringIO()
        with redirect_stdout(out):
            status = sync.main([mode])
        return status, out.getvalue()

    def test_missing_source_is_status_2(self) -> None:
        """No api-types/api.ts: exit 2."""
        status, out = self.run_mode("check")
        self.assertEqual(status, 2)
        self.assertIn("::error file=api-types/api.ts::", out)

    def test_check_fails_until_written(self) -> None:
        """A missing copy is stale; `write` makes it match."""
        self.source.parent.mkdir()
        self.source.write_bytes(b"export type A = string;\n")
        status, out = self.run_mode("check")
        self.assertEqual(status, 1)
        self.assertIn("::error file=frontend/lib/api-types.ts::stale", out)
        self.assertEqual(self.run_mode("write")[0], 0)
        self.assertEqual(self.target.read_bytes(), self.source.read_bytes())
        self.assertEqual(self.run_mode("check"), (0, ""))

    def test_check_is_byte_for_byte(self) -> None:
        """A line-ending difference is stale too."""
        self.source.parent.mkdir()
        self.source.write_bytes(b"export type A = string;\n")
        self.target.write_bytes(b"export type A = string;\r\n")
        self.assertEqual(self.run_mode("check")[0], 1)


if __name__ == "__main__":
    unittest.main()
