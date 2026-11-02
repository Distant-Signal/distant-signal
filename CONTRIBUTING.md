# Contributing

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
