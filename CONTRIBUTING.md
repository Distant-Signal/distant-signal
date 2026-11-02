# Contributing

Start with the organisation's
[contributing guide](https://github.com/Distant-Signal/.github/blob/main/CONTRIBUTING.md):
issues, pull requests, commit identity and the conventions that apply in
every repository. This file adds what is specific to this repository.
[`CLAUDE.md`](CLAUDE.md) lists the exact build, lint and test commands.

## Scripts and their lint

The Python tooling is managed with [uv](https://docs.astral.sh/uv/):
`pyproject.toml` pins the lint tools in its `lint` dependency group,
`uv.lock` pins the full tree, and `.python-version` the interpreter. With uv
installed (e.g. `mise use -g uv`), and the shared CI scripts checked out
beside this repository (`git clone https://github.com/Distant-Signal/ci
../ci`; CI uses the commit `.github/workflows/ci.yml` pins):

```sh
uv run python ../ci/scripts/lint-scripts.py         # what CI's scripts-lint job runs
uv run python ../ci/scripts/lint-scripts.py --fix   # apply shfmt/ruff fixes first
uv run python -m unittest discover -s scripts/tests   # the scripts' tests
uv run scripts/gen-rust-dockerfiles.py --check       # CI's repo-checks job (rewrite without --check)
# Before merging a branch that adds migrations (CI's migration-order job):
uv run scripts/check-migration-order.py "$(git merge-base main HEAD)"
```

A migration with destructive DDL (a `DROP` of a table, column, view or
function, a `RENAME`, a column type change, `SET NOT NULL` on an existing
column) needs a `-- contract: <what> (code stopped using it in <commit>)`
line in its leading comments, and ships a release after the code stopped
using the object; `check-migration-order.py` enforces the header (see its
docstring).

`uv run` creates `.venv/` and installs the `lint` group on first use.
`lint-scripts.py` runs this repository's pinned tools: shellcheck and shfmt
over every `*.sh`, ruff and mypy over `scripts/`, actionlint over the
workflows, hadolint over the Dockerfiles, and Distant-Signal/ci's
`lint-containers.py`.

## Dependency and security scans

What fails CI and what only warns:

- `dependency-scan.yml` (OSV-Scanner over `Cargo.lock`,
  `frontend/package-lock.json` and `uv.lock`) **blocks** on a finding with
  CVSS >= 9.0 that has a fixed version, and on a scan that produced no valid
  JSON. Every other HIGH/CRITICAL (CVSS >= 7.0) finding **warns**: a
  per-finding annotation and a neutral "security findings (non-blocking)"
  check. The daily scheduled run never blocks on findings; it opens or
  updates a `dependency-vulnerability` issue instead. Time-boxed exceptions
  live in `frontend/osv-scanner.toml`.
- `ci.yml`'s `cargo-deny` job **blocks** on `cargo deny check bans licenses
  sources` and on a failed advisory-DB fetch. `cargo deny check advisories`
  (RustSec and yanked crates) only **warns**.

## Commit history and old commit SHAs

This repository's history was rewritten once, when it moved to the
Distant-Signal organisation (November 2026): each step of `main` became
one commit, so every commit SHA from before then changed. SHAs cited in
files were updated to the rewritten commits, except in migrations and
their `contract:` headers, which are checksum-locked and keep the
original SHAs.

To resolve an original SHA (from a migration header, an old chart or image
tag, a deploy record or a commit link), look it up in the migration
ledger. The ledger is owner-only, so outside readers can't resolve old
SHAs apart from old pull request pages, which still show the original
commits.
