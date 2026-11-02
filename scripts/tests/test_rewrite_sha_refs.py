"""Tests for scripts/rewrite-sha-refs.py.

  uv run python -m unittest discover -s scripts/tests

Runs the matching, replacement and blame-ignore checks over a small
made-up ledger.
"""

import importlib.util
import sys
import unittest
from pathlib import Path
from types import ModuleType
from typing import override

SCRIPT = Path(__file__).resolve().parent.parent / "rewrite-sha-refs.py"


def _load() -> ModuleType:
    spec = importlib.util.spec_from_file_location("rewrite_sha_refs", SCRIPT)
    if spec is None or spec.loader is None:
        msg = f"cannot load {SCRIPT}"
        raise ImportError(msg)
    module = importlib.util.module_from_spec(spec)
    sys.modules["rewrite_sha_refs"] = module
    spec.loader.exec_module(module)
    return module


rsr = _load()
STEP = "aaaaaaa1" + "0" * 32
FOLDED = "bbbbbbb2" + "0" * 32
PINNED = "ccccccc3" + "0" * 32
# Two originals sharing a 7-character prefix.
TWIN_A = "ddddddd4a" + "0" * 31
TWIN_B = "ddddddd4b" + "0" * 31
NEW_STEP = "1111111a" + "0" * 32
NEW_SQUASH = "2222222b" + "0" * 32
NEW_PIN = "3333333c" + "0" * 32
# Two landing commits sharing a 7-character prefix.
NEW_TWIN_A = "4444444d1" + "0" * 31
NEW_TWIN_B = "4444444d2" + "0" * 31
ROWS = [
    {"original": STEP, "landing": NEW_STEP, "kind": "step"},
    {"original": FOLDED, "landing": NEW_SQUASH, "kind": "folded"},
    {"original": "eeeeeee5" + "0" * 32, "landing": NEW_SQUASH, "kind": "step"},
    {"original": PINNED, "landing": NEW_PIN, "kind": "pinned"},
    {"original": TWIN_A, "landing": NEW_TWIN_A, "kind": "step"},
    {"original": TWIN_B, "landing": NEW_TWIN_B, "kind": "step"},
]


class LedgerTest(unittest.TestCase):
    """Prefix resolution both ways."""

    @override
    def setUp(self) -> None:
        """Build the ledger."""
        self.ledger = rsr.Ledger(ROWS)

    def test_resolve(self) -> None:
        """Full and unique short SHAs resolve; others don't."""
        self.assertEqual(self.ledger.resolve(STEP), STEP)
        self.assertEqual(self.ledger.resolve(STEP[:7]), STEP)
        self.assertEqual(self.ledger.resolve(TWIN_A[:9]), TWIN_A)
        self.assertIsNone(self.ledger.resolve(TWIN_A[:7]))
        self.assertIsNone(self.ledger.resolve("0123abc"))

    def test_abbreviate_keeps_length_unless_ambiguous(self) -> None:
        """The new SHA keeps the old length, longer only if ambiguous."""
        self.assertEqual(self.ledger.abbreviate(NEW_STEP, 8), NEW_STEP[:8])
        self.assertEqual(self.ledger.abbreviate(NEW_STEP, 40), NEW_STEP)
        self.assertEqual(self.ledger.abbreviate(NEW_TWIN_A, 7), NEW_TWIN_A[:9])


class ReplaceTest(unittest.TestCase):
    """What gets replaced in a file, and how."""

    @override
    def setUp(self) -> None:
        """Build the ledger."""
        self.ledger = rsr.Ledger(ROWS)

    def rewrite(self, text: str) -> str:
        """Return TEXT with its replacements applied."""
        return str(rsr.apply(text, rsr.replacements_in("f", text, self.ledger)))

    def test_short_and_full_shas_are_replaced(self) -> None:
        """A step maps to its commit, a folded one to its squash."""
        text = f"see {STEP[:8]} and `{FOLDED}`.\nnot a commit: 0123abc\n"
        self.assertEqual(
            self.rewrite(text),
            f"see {NEW_STEP[:8]} and `{NEW_SQUASH}`.\nnot a commit: 0123abc\n",
        )

    def test_contract_headers_and_tags_are_kept(self) -> None:
        """Contract headers and published tags keep their original SHAs."""
        text = (
            f"-- contract: drop x (code stopped using it in {STEP[:8]})\n"
            f"image sha-{STEP[:7]}, chart 0.4.2+build.9.sha.{STEP[:7]}\n"
            f"but {STEP[:7]} here\n"
        )
        self.assertEqual(
            self.rewrite(text),
            text.replace(f"but {STEP[:7]}", f"but {NEW_STEP[:7]}"),
        )


class BlameIgnoreTest(unittest.TestCase):
    """The rewritten .git-blame-ignore-revs must list only safe commits."""

    @override
    def setUp(self) -> None:
        """Build the ledger."""
        self.ledger = rsr.Ledger(ROWS)

    def test_pinned_commit_passes(self) -> None:
        """A landing commit holding one original is fine."""
        self.assertEqual(
            rsr.blame_ignore_problems(f"# x\n{NEW_PIN}\n", self.ledger), []
        )

    def test_squash_and_unknown_fail(self) -> None:
        """A squash of several originals, or an unknown SHA, fails."""
        problems = rsr.blame_ignore_problems(f"{NEW_SQUASH}\n{PINNED}\n", self.ledger)
        self.assertEqual(len(problems), 2)
        self.assertIn("holds 2 original commits", problems[0])
        self.assertIn("is not a rewritten commit", problems[1])

    def test_empty_file_fails(self) -> None:
        """A file listing nothing fails."""
        self.assertEqual(
            rsr.blame_ignore_problems("# nothing\n", self.ledger),
            [f"{rsr.BLAME_IGNORE}: lists no commit"],
        )


if __name__ == "__main__":
    unittest.main()
