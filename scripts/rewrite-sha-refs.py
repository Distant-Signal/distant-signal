#!/usr/bin/env python3
# ruff: noqa: T201  # a CLI whose output (the report) is stdout
"""Point the tracked files' commit SHAs at the rewritten history.

  uv run scripts/rewrite-sha-refs.py --ledger ledger.tsv [--write]

Repo split spec §5.11.8: the phase 1 history rewrite changed every commit
SHA, and the first commit after it replaces each original SHA a tracked
file cites with its rewritten one. A cited commit that folded into a
squashed step points at that step's commit. `.git-blame-ignore-revs`
must end up naming the pinned Prettier commit, which still holds only the
reformat: the run fails (exit 1) if a SHA listed there, once rewritten, is
not a landing commit holding exactly one original commit, since blame
would then skip every change folded into a squashed step.

LEDGER is the migration ledger's `ledger.tsv` (§5.11.9, from
`lucy/ds-migration-ledger`): a header row, then one row per original
commit with at least the `original`, `landing` and `kind` columns.

A token is a 7- to 40-character lower-case hex word that is a prefix of
exactly one original commit. It becomes the landing SHA cut to the same
length, lengthened if that prefix would be ambiguous among the landing
commits. Left alone, since they resolve through the ledger instead:

  - migrations (checksum-locked: an edit would crash-loop the api), and
    any `contract:` header line;
  - docs/specs/repo-split.md, which describes the original history;
  - published chart and image tags (`sha-<sha>`, `.sha.<sha>`), which
    keep their original SHAs.

Without --write it only reports. Run it from the repository root of the
rewritten checkout. Every replacement is listed as
`path:line: old -> new (kind)`. Stdlib only.
"""

import argparse
import csv
import re
import subprocess
import sys
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path

TOKEN = re.compile(r"\b[0-9a-f]{7,40}\b")
SHORTEST = 7
# Paths whose SHAs stay original (see the module docstring).
EXCLUDED = (
    ":(exclude)crates/ds-store/migrations",
    ":(exclude,glob)**/migrations/**",
    ":(exclude)docs/specs/repo-split.md",
    ":(exclude)*.lock",
    ":(exclude)**/package-lock.json",
    ":(exclude)*.svg",
    ":(exclude)*.png",
    ":(exclude)frontend/e2e/visual-baselines",
)
CONTRACT_LINE = re.compile(r"--\s*contract:", re.IGNORECASE)
# A published tag's SHA: `sha-0123abc` (image) or `.sha.0123abc` (chart).
TAG_PREFIX = re.compile(r"(?:\bsha-|\.sha\.)$")
BLAME_IGNORE = ".git-blame-ignore-revs"
FULL_SHA = re.compile(r"[0-9a-f]{40}")


@dataclass(frozen=True)
class Mapping:
    """Where one original commit went."""

    landing: str
    kind: str


@dataclass(frozen=True)
class Replacement:
    """One token to replace on one line."""

    path: str
    line: int
    # The token's offset in its line.
    column: int
    old: str
    new: str
    kind: str


class Ledger:
    """The original-to-landing map, with prefix lookups both ways."""

    def __init__(self, rows: Iterable[dict[str, str]]) -> None:
        """Index the ledger rows by original SHA."""
        self.by_original: dict[str, Mapping] = {}
        # How many ledger rows (original commits) each landing commit holds.
        self.folded_into: dict[str, int] = defaultdict(int)
        for row in rows:
            if row["original"]:
                self.by_original[row["original"]] = Mapping(row["landing"], row["kind"])
            self.folded_into[row["landing"]] += 1
        self._original_prefixes = _prefix_index(self.by_original)
        self._landing_prefixes = _prefix_index(self.folded_into)

    def resolve(self, token: str) -> str | None:
        """Return the one original SHA TOKEN abbreviates, if exactly one."""
        if len(token) == len(next(iter(self.by_original), "")):
            return token if token in self.by_original else None
        matches = self._original_prefixes.get(token[:SHORTEST], [])
        found = [sha for sha in matches if sha.startswith(token)]
        return found[0] if len(found) == 1 else None

    def abbreviate(self, landing: str, length: int) -> str:
        """Return LANDING cut to LENGTH, or longer if that is ambiguous."""
        for size in range(max(length, SHORTEST), len(landing) + 1):
            prefix = landing[:size]
            candidates = self._landing_prefixes.get(prefix[:SHORTEST], [])
            if sum(1 for sha in candidates if sha.startswith(prefix)) == 1:
                return prefix
        return landing


def _prefix_index(shas: Iterable[str]) -> dict[str, list[str]]:
    """Group SHAs by their first SHORTEST characters."""
    index: dict[str, list[str]] = defaultdict(list)
    for sha in shas:
        index[sha[:SHORTEST]].append(sha)
    return index


def read_ledger(path: Path) -> Ledger:
    """Read LEDGER (TSV with a header row)."""
    with path.open(encoding="utf-8", newline="") as handle:
        rows = csv.DictReader(handle, delimiter="\t", quoting=csv.QUOTE_NONE)
        missing = {"original", "landing", "kind"} - set(rows.fieldnames or ())
        if missing:
            msg = f"{path}: missing column(s) {', '.join(sorted(missing))}"
            raise SystemExit(msg)
        return Ledger(rows)


def tracked_files() -> list[str]:
    """Return the tracked text files that may cite a SHA."""
    listed = subprocess.run(  # noqa: S603  # fixed git subcommand
        ["git", "grep", "-lIE", "[0-9a-f]{7,40}", "--", ".", *EXCLUDED],  # noqa: S607  # git from PATH
        check=False,
        stdout=subprocess.PIPE,
        text=True,
    )
    # 1: no file matched.
    if listed.returncode not in {0, 1}:
        raise SystemExit(listed.returncode)
    return [line for line in listed.stdout.split("\n") if line]


def replacements_in(path: str, text: str, ledger: Ledger) -> list[Replacement]:
    """Return the replacements TEXT (the file at PATH) needs."""
    found = []
    for number, line in enumerate(text.split("\n"), start=1):
        if CONTRACT_LINE.search(line):
            continue
        for match in TOKEN.finditer(line):
            if TAG_PREFIX.search(line, 0, match.start()):
                continue
            original = ledger.resolve(match.group(0))
            if original is None:
                continue
            mapping = ledger.by_original[original]
            new = ledger.abbreviate(mapping.landing, len(match.group(0)))
            found.append(
                Replacement(
                    path, number, match.start(), match.group(0), new, mapping.kind
                )
            )
    return found


def apply(text: str, replacements: Sequence[Replacement]) -> str:
    """Return TEXT with each replacement made on its line."""
    lines = text.split("\n")
    # Right to left, so a longer replacement doesn't shift a later column.
    for r in sorted(replacements, key=lambda r: (r.line, r.column), reverse=True):
        line = lines[r.line - 1]
        if line[r.column : r.column + len(r.old)] != r.old:
            msg = f"{r.path}:{r.line}: expected {r.old} at column {r.column}"
            raise ValueError(msg)
        lines[r.line - 1] = line[: r.column] + r.new + line[r.column + len(r.old) :]
    return "\n".join(lines)


def blame_ignore_problems(text: str, ledger: Ledger) -> list[str]:
    """Return an error per SHA in TEXT (the rewritten blame-ignore file) unsafe to skip.

    Each listed SHA must be a landing commit that holds exactly one
    original commit (the pinned reformat, or a step that folded nothing):
    skipping a squashed step would hide every change folded into it.
    """
    problems = []
    listed = 0
    for number, line in enumerate(text.split("\n"), start=1):
        sha = line.strip()
        if not FULL_SHA.fullmatch(sha):
            continue
        listed += 1
        count = ledger.folded_into.get(sha, 0)
        if count != 1:
            what = (
                "is not a rewritten commit"
                if not count
                else (f"holds {count} original commits")
            )
            problems.append(
                f"{BLAME_IGNORE}:{number}: {sha} {what}; list the pinned reformat"
            )
    if not listed:
        problems.append(f"{BLAME_IGNORE}: lists no commit")
    return problems


def main(argv: Sequence[str] | None = None) -> int:
    """Report (and with --write, make) the replacements; returns the status."""
    parser = argparse.ArgumentParser(
        description="Replace original commit SHAs in tracked files with their "
        "rewritten ones, from the migration ledger."
    )
    parser.add_argument("--ledger", type=Path, required=True, help="ledger.tsv")
    parser.add_argument(
        "--write", action="store_true", help="edit the files (default: report)"
    )
    args = parser.parse_args(argv)
    ledger = read_ledger(args.ledger)

    total: list[Replacement] = []
    blame_text = Path(BLAME_IGNORE).read_text(encoding="utf-8")
    for path in tracked_files():
        file = Path(path)
        text = file.read_text(encoding="utf-8")
        found = replacements_in(path, text, ledger)
        if not found:
            continue
        total.extend(found)
        new_text = apply(text, found)
        if path == BLAME_IGNORE:
            blame_text = new_text
        if args.write:
            file.write_text(new_text, encoding="utf-8")
    for r in total:
        print(f"{r.path}:{r.line}: {r.old} -> {r.new} ({r.kind})")
    files = len({r.path for r in total})
    commits = len({r.old for r in total})
    verb = "replaced" if args.write else "would replace"
    print(f"{verb} {len(total)} reference(s) to {commits} commit(s) in {files} file(s)")

    problems = blame_ignore_problems(blame_text, ledger)
    for problem in problems:
        print(f"::error::{problem}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
