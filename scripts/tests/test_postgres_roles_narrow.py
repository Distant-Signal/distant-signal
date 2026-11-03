"""Tests for scripts/test-postgres-roles.py --narrow (DS-118).

`render_narrowed` renders postgres-grants.sql as if the named roles were
`status: narrow` in db-grants.yaml, so CI ran release D's narrowing before
db-grants.yaml made it (2026-10-28). CI's per-service DB test pass
(.github/db-tests.toml) runs it against Postgres in its "Release D's
narrowed roles" command, and runs the four roles' suites `--observe`d in
its Stage 0b command until their fixtures move to the owner.
"""

import pathlib
import shlex
import tomllib
import unittest
from typing import Any, cast

REPO = pathlib.Path(__file__).resolve().parents[2]
PASSES = REPO / ".github" / "db-tests.toml"
# Release D's narrowed roles: db-grants.yaml's phase 5 `narrow` roles in the
# pinned ds-core (whose own copy of this test checks them against the file).
RELEASE_D = frozenset({"api", "aggregator", "enricher", "notifier"})


def per_service_runs() -> dict[str, list[str]]:
    """Return {db-tests.py pass: test-postgres-roles.py args} from CI's passes.

    Each command in .github/db-tests.toml's pass scripts (what CI's
    rust-db-tests job runs) that runs `test-postgres-roles.py --mode
    per-service -- ... db-tests.py run PASS`, keyed by PASS.
    """
    passes = tomllib.loads(PASSES.read_text(encoding="utf-8"))
    runs: dict[str, list[str]] = {}
    for test_pass in cast("list[dict[str, Any]]", passes["pass"]):
        script = str(test_pass["run"]).replace("\\\n", " ")
        for text in script.splitlines():
            if "scripts/test-postgres-roles.py" not in text:
                continue
            argv = shlex.split(text)
            if "--" not in argv:
                continue
            split = argv.index("--")
            roles_args, command = argv[:split], argv[split + 1 :]
            if "--mode" not in roles_args:
                continue
            if roles_args[roles_args.index("--mode") + 1] != "per-service":
                continue
            db_tests = command.index("scripts/db-tests.py")
            if command[db_tests + 1] == "run":
                runs[command[db_tests + 2]] = roles_args
    return runs


def flag(args: list[str], name: str) -> set[str]:
    """Return the comma-separated roles of --name in args (empty if absent)."""
    if name not in args:
        return set()
    return set(args[args.index(name) + 1].split(","))


class CiInvocationTest(unittest.TestCase):
    """CI's per-service passes (.github/db-tests.toml) against db-grants.yaml."""

    def test_the_stage_0b_pass_observes_exactly_the_release_d_roles(self) -> None:
        """Release D's roles: observed for the full suites, narrowed for the rest.

        The narrowed pass narrows the same roles, and that set is
        db-grants.yaml's phase 5 narrow roles: a role narrowed in
        production without both passes, or a list left behind, fails here.
        """
        release_d = set(RELEASE_D)
        runs = per_service_runs()
        self.assertEqual(set(runs), {"per-service", "narrow"})
        stage_0b = runs["per-service"]
        self.assertIn("--check-setup-job", stage_0b)
        self.assertEqual(flag(stage_0b, "--observe"), release_d)
        self.assertEqual(flag(stage_0b, "--narrow"), set())
        self.assertEqual(flag(runs["narrow"], "--narrow"), release_d)
        self.assertEqual(flag(runs["narrow"], "--observe"), set())


if __name__ == "__main__":
    unittest.main()
