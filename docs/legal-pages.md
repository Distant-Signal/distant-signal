# Legal pages configuration

`/privacy`, `/terms`, `/cookies`, `/contact`, `/accessibility` and
`/.well-known/security.txt` carry the operator's own details. They come from
server environment variables, not source: a fork sets its own, and this
repository holds nobody's. The page text itself is a draft that needs the
operator's (and ideally a lawyer's) review before it is published.

## Environment

| Variable | Required | Meaning | Rules |
|---|---|---|---|
| `LEGAL_PAGES_PUBLISHED` | yes, to go live | `true` publishes the pages and their footer links | exactly `true` |
| `LEGAL_OPERATOR_NAME` | yes | the data controller | up to 100 characters, no `<` or `>`, no control characters |
| `LEGAL_CONTACT_EMAIL` | yes | monitored inbox for privacy requests, content reports and accessibility requests | an email address, up to 254 characters |
| `LEGAL_SSO_LOG_RETENTION` | yes | how long the sign-in service keeps its event logs, e.g. `30 days` | up to 60 characters, same character rules as the name |
| `LEGAL_LAST_UPDATED` | yes | date the text was last reviewed, e.g. `1 November 2026` | `D Month YYYY`, a real date, full English month name |
| `LEGAL_ICO_REGISTRATION` | no | ICO data protection fee registration number; unset leaves the line out | letters, digits and `-`, 4 to 20 characters |
| `LEGAL_MINIMUM_AGE` | no | minimum age to create an account | `13` to `21`, default `18` |
| `LEGAL_PAGES_PREVIEW` | no | `true` renders the drafts with a banner and `noindex`, for review and CI; never in production | exactly `true` |

Values are trimmed. In the Helm chart they are `frontend.legalPagesPublished`
and `frontend.legal.*` (ds-deploy's `docs/legal-pages.md`); locally see
`local.env.example`.

## Behaviour

- The pages are live only when `LEGAL_PAGES_PUBLISHED=true` and every required
  value is set and valid. Anything else, including a malformed value, leaves
  them 404 and hides the footer links. Nothing throws; the server logs the
  names of the offending variables once.
- There are no defaults for the operator's details in source, so an
  unconfigured fork cannot publish another operator's details. The minimum age
  defaults to 18.
- `LAST_UPDATED` is the review date: set `LEGAL_LAST_UPDATED` when the pages go
  live and whenever the text changes. It is a value, not a source edit.
- Values are plain text. React escapes them where they render; the validators
  also reject markup characters, so they cannot reach page metadata, the
  `mailto:` links or security.txt.

## Why a change takes effect without a rebuild

`lib/legal.ts` reads `process.env` on the server when a request arrives
(`LEGAL_CONFIG` is a set of getters, `readLegalConfig` the reader). None of
these variables is `NEXT_PUBLIC_`, so `next build` never inlines them, and
every page that uses them exports `dynamic = 'force-dynamic'` so none is
prerendered. The one client component that needs the minimum age
(`LoginConsentNote`) gets it as a prop from the root layout. Restart or
roll the frontend to pick up a changed environment.

## Tests

`test/legalEnv.ts`'s `stubLegalEnv()` sets example values (`example.com`) for
a test; call `vi.unstubAllEnvs()` afterwards. CI's `frontend-e2e` job sets the
same examples alongside `LEGAL_PAGES_PREVIEW`.
