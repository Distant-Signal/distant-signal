"""Tests for scripts/check-sftp-entrypoint.py, offline (--source)."""

import importlib.util
import io
import shutil
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import ModuleType
from typing import override

SCRIPT = Path(__file__).resolve().parents[1] / "check-sftp-entrypoint.py"
COMMIT = "0123456789abcdef0123456789abcdef01234567"


def load() -> ModuleType:
    """Import scripts/check-sftp-entrypoint.py."""
    spec = importlib.util.spec_from_file_location("check_sftp_entrypoint", SCRIPT)
    if spec is None or spec.loader is None:
        msg = f"cannot load {SCRIPT}"
        raise ImportError(msg)
    module = importlib.util.module_from_spec(spec)
    sys.modules["check_sftp_entrypoint"] = module
    spec.loader.exec_module(module)
    return module


cs = load()


class CheckSftpEntrypointTest(unittest.TestCase):
    """The copy against the pinned chart script."""

    @override
    def setUp(self) -> None:
        """Make a root with a pin and a copy, and a chart script."""
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp)
        (self.tmp / "docker").mkdir()
        self.pin = self.tmp / cs.PIN
        self.pin.write_text(f"# a comment\n{COMMIT}\n", encoding="utf-8")
        self.copy = self.tmp / cs.COPY
        self.copy.write_text("#!/bin/sh\necho one\n", encoding="utf-8")
        self.source = self.tmp / "chart.sh"
        self.source.write_text("#!/bin/sh\necho one\n", encoding="utf-8")

    def run_main(self, *args: str) -> tuple[int, str]:
        """Run main on the temporary root with --source."""
        out = io.StringIO()
        with redirect_stdout(out):
            code = cs.main(
                ["--root", str(self.tmp), "--source", str(self.source), *args]
            )
        return code, out.getvalue()

    def test_same(self) -> None:
        """An identical copy passes."""
        self.assertEqual(self.run_main()[0], 0)

    def test_drift_fails_with_a_diff(self) -> None:
        """A changed chart script fails, shows the diff and writes nothing."""
        self.source.write_text("#!/bin/sh\necho two\n", encoding="utf-8")
        code, out = self.run_main()
        self.assertEqual(code, 1)
        self.assertIn("+echo two", out)
        self.assertEqual(self.copy.read_text(encoding="utf-8"), "#!/bin/sh\necho one\n")

    def test_write(self) -> None:
        """--write updates the copy, after which the check passes."""
        self.source.write_text("#!/bin/sh\necho two\n", encoding="utf-8")
        self.assertEqual(self.run_main("--write")[0], 0)
        self.assertEqual(self.run_main()[0], 0)

    def test_bad_pin(self) -> None:
        """A pin without one 40-hex commit is exit 2."""
        self.pin.write_text("# a comment\nmain\n", encoding="utf-8")
        self.assertEqual(self.run_main()[0], 2)

    def test_repository_pin_parses(self) -> None:
        """The repository's own pin names one commit."""
        self.assertRegex(cs.pinned_commit(cs.ROOT), r"^[0-9a-f]{40}$")


if __name__ == "__main__":
    unittest.main()
