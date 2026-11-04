## What and why

<!-- One or two sentences. -->

## Checklist

For changes a visitor can see:

- [ ] Screenshots at 390 px and 1366 px wide, in light and dark (four in all)
- [ ] Copy follows [docs/style-guide.md](../docs/style-guide.md), "Writing": sentence case, "Couldn't …" failures, no jargon, `describeFailure` for errors
- [ ] Every new page has a title and a meta description (`pageMetadata`, 20 words or fewer)
- [ ] Every icon-only button has an `aria-label`

For everything:

- [ ] Tests cover the change
- [ ] An API change the frontend needs landed in Distant-Signal/ds-api (with its `docs/api-changelog.md` entry), and `frontend/api-image.txt` pins a build with it
