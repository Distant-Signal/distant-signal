"""No Rust crate reads the web app's files (repo-split spec §5.3).

The api moves to its own repository (phase 9) and the shared crates to
ds-core (phase 4): neither can see `frontend/` then. Where a crate and the
web app must agree, the crate exports the value (the api in
`api-types/api.ts`) and the web app's tests compare their copy against it.

uv run python -m unittest discover -s scripts/tests
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent

# A string literal with `frontend` as one of its path segments:
# "frontend", "frontend/app", "../../frontend/lib/x.ts".
FRONTEND_PATH = re.compile(r'"(?:[^"\n]*[/\\])?frontend(?:[/\\][^"\n]*)?"')


def frontend_paths(source: str) -> list[tuple[int, str]]:
    """Each (line number, line) outside a `//` comment naming `frontend/`."""
    hits: list[tuple[int, str]] = []
    for number, line in enumerate(source.splitlines(), start=1):
        if not line.lstrip().startswith("//") and FRONTEND_PATH.search(line):
            hits.append((number, line.strip()))
    return hits


class FrontendPathTests(unittest.TestCase):
    """The pattern catches a path and leaves prose alone."""

    def test_finds_paths(self) -> None:
        """Joined, relative and `include_str!` paths are all found."""
        for line in (
            'let app = repo_root().join("frontend/app");',
            '.join("../../frontend/components/X.tsx"),',
            'include_str!("../../../frontend/lib/usageEvents.ts")',
            'root.join("frontend")',
        ):
            self.assertEqual(len(frontend_paths(line)), 1, line)

    def test_ignores_comments_and_other_words(self) -> None:
        """Doc comments and unrelated strings are not paths."""
        for line in (
            "/// mirrored in `frontend/lib/usageEvents.ts`",
            '// "frontend/app" used to be read here',
            'let name = "frontend-proxy";',
            'let msg = "the frontend sends this";',
        ):
            self.assertEqual(frontend_paths(line), [], line)


class CratesTests(unittest.TestCase):
    """Every `.rs` file under `crates/`."""

    def test_no_crate_reads_the_frontend(self) -> None:
        """No string literal in a crate is a path into `frontend/`."""
        found = [
            f"{path.relative_to(ROOT)}:{number}: {line}"
            for path in sorted((ROOT / "crates").rglob("*.rs"))
            for number, line in frontend_paths(path.read_text(encoding="utf-8"))
        ]
        self.assertEqual(
            found,
            [],
            "a crate reads the web app's files; export the value instead "
            "(api-types/api.ts) and compare it in a frontend test",
        )


if __name__ == "__main__":
    unittest.main()
