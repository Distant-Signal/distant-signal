# Frontend design guide

A guide for future frontend design work on Distant Signal. It explains how
the site should look, read and behave, why, and how to keep it from
drifting back into the "assembled without care" look found in the
9 Oct 2026 audit.

[docs/style-guide.md](style-guide.md) holds the canonical rules: palette,
badge colours, components, terminology, units, failure copy, banned
phrases. This guide covers the thinking behind those rules, the patterns
to reach for, the mistakes to avoid, and how to run a design change. It
links to the style guide rather than repeating it. Where the two disagree,
the style guide wins. Update it first.

---

## 1. Who the site is for

**Commuters first, with the detail on hand.**

- **Main reader:** someone checking whether their train is running, late or
  cancelled, often on a phone and in a hurry. Every page must answer their
  question in the first screen, in plain words.
- **Second reader:** a rail enthusiast who wants headcodes, UIDs, sample
  counts and data sources. That detail stays, but it is labelled and
  secondary.

If a design choice helps the enthusiast at the commuter's expense, it's
the wrong choice. Move the detail one level down instead. How a train is
named, and where its headcode and UID go, is in the style guide
([Who we write for](style-guide.md#who-we-write-for)).

## 2. Tone of voice

**Terse and factual, like a departure board.** Say what is true and what to
do next. Nothing else.

The rules (sentence case, no em dashes, ellipses or arrows, "we" for the
site, one-line helper text) are in the style guide's
[Tone](style-guide.md#tone) and [Other rules](style-guide.md#other-rules).
Two reasons behind them that the rules don't say:

- Em dashes are banned outright because the owner called them "a pretty
  obvious tell" of machine-written copy.
- An ellipsis or a "Please try again!" reads as chatter. A plain word beside
  a spinner ("Saving") and a failure that names what broke say the same
  thing faster.

Examples from the audit:

| Instead of | Write |
| --- | --- |
| "Something went wrong. Please try again!" | "Couldn't load this train. Try again." |
| "Incidents archived before this filter existed were only linked up to their line once, in a one-off catch-up run." | (delete it; the reader can't act on it) |
| "Avg delay 0.0 min · 0% cancelled" on a suspended line | "No trains running" |
| "Tracking Train 42" | "08:42 Woking to London Waterloo" |
| "(reported more severe than automatically classified: part suspended)" | (drop it; show the severity) |
| "Your data is stored in localStorage" | "Saved in this browser" |
| "Log in — needs a Distant Signal account" | "Log in (needs a Distant Signal account)" |
| "Someone's tracked journey — log in to see it" | "Log in to see this tracked journey" |
| "SW — South Western Railway" | "South Western Railway (SW)" or "SW · South Western Railway" |
| "—" in an empty numeric cell | "No data", or an aria-hidden "–" with visually hidden "No data" |

## 3. Visual direction

**Consistency first, then a light identity.** No full rebrand. The grape
palette and the signal-arm icon stay.

### Principles

1. **One look per element.** A card, badge, button or tile looks the same
   on every page. If a page needs something different, it needs a new,
   named component, not an inline style.
2. **Styling marks a role.** Borders, fills, radius and shadow say "this
   is a separate, clickable object". Don't put them on everything. A
   non-clickable card has no shadow, and there are no coloured left-border
   accents (see [Spacing, radius and
   elevation](style-guide.md#spacing-radius-and-elevation) for the one
   deliberate exception).
3. **State in form as well as colour.** Severity is shown by the status
   badge's text, not colour alone. Semantic colours (good, warning,
   critical, planned) are separate from the brand accent
   ([Semantic roles](style-guide.md#semantic-roles)).
4. **Summary before detail.** One page-level "Updated 4 min ago", not one
   per card. One line of status, then the breakdown.
5. **Fill the grid.** Pick a column count the items fill. A tile alone on
   the last row at phone width is a bug.
6. **Phone first.** Check every change at 390 px before 1366 px, in light
   and dark.

### Badges

Few, sentence case, in a fixed order, and never for what the severity
already says. Lines, operators and stations are dimmed text, not pills.
The rules, and `BadgeRow`, which enforces the order and the limit of
three, are in the style guide's [Typography](style-guide.md#typography).

### Shared components

Reach for these before writing markup of your own. The style guide's
[Components](style-guide.md#components) and
[Clickable cards](style-guide.md#clickable-cards) have the rules for each.

- `ConfirmActionButton` for any "are you sure?" action.
- `LoginControl` (link or button) for every login prompt.
- `ClickableCard` with a `CardTitleLink` for a card that is one link.
- `ButtonLink` for a link that looks like a button.
- `CopyableLink` / `useShareOrCopy` for anything the visitor copies or
  shares.
- `DelayBadge` and `DELAY_TONE_COLOR` for delays.
- `StatusCard`, `StatusTile`, `StateBadge` and `BadgeRow` for status.
- `PageSkeleton` pieces for a page's `loading.tsx`.
- `tokens` in `lib/theme.ts` for card elevation, status tiles and cards,
  and icon-button sizes ([Design tokens](style-guide.md#design-tokens)).

The wave 2 list this guide once carried (wordmark and link previews,
`/account/preferences`, status cards and badges, station accessibility key
facts, themed charts, page skeletons, split forms) is built; the style
guide's [Changes since the illustrated
guide](style-guide.md#changes-since-the-illustrated-guide) records it. New
work should build on those, not add another one-off.

## 4. Page anatomy

Every page:

- has a title and a one-sentence meta description through
  `pageMetadata(title, description)`;
- has an h1 equal to its nav label
  ([Tone](style-guide.md#tone) lists them);
- answers the commuter's question in the first screen;
- puts enthusiast detail below the fold or behind a disclosure;
- shows failures through `describeFailure(verb, noun, status)`
  ([Failures](style-guide.md#failures));
- has an empty state that says what will appear and how to add the first
  item, rather than a blank area ([States](style-guide.md#states)).

## 5. AI features

Low-key and clearly labelled.

- One label for AI-shaped content: **"AI summary"** (`AiGeneratedBadge`).
  Its tooltip opens on hover and on focus.
- `/chat` is "Ask about trains" (nav label and h1), with the subline "Uses
  Claude with your own API key". The key is set on Preferences; say
  plainly that it is saved in this browser.
- Don't promote AI on the home page or with "AI-powered" labels.

## 6. The tells to avoid

These are what made the site look vibecoded in the audit. Most now have a
rule in the style guide or a check in CI; check new work against them
anyway.

**Visual**

- the default Mantine/Tailwind dashboard look: shadowed tiles with
  coloured left borders, and every card the same;
- all-caps pills everywhere, raw operator codes as badges;
- Unicode arrows and sort glyphs as icons. Routes and links say "to" and
  "Back to"; sort and external-link marks are SVGs;
- inline `style={{…}}` copied between components (now an ESLint error);
- an empty icon button (the old pride toggle);
- US date formats from a component default. Every date field takes
  `PICKER_DATE_FORMAT` ([Units and dates](style-guide.md#units-and-dates)).

**Copy**

- mixed Title Case and sentence case;
- the same page called three names (nav, h1, back link);
- leftover "--", "Copied!", "Please try again";
- em dashes, in prose or as separators;
- an ellipsis on loading text and menu items ("Saving", "Delete line"
  are right);
- curly and straight quotes mixed on one site (use straight);
- the same helper text repeated (the 24-hour hint, four times on one page);
- paragraphs written for the developer;
- pipeline words and raw identifiers as headings
  ([Banned phrases](style-guide.md#banned-phrases)).

**Product**

- a settings control in the nav that nobody needs there;
- several entry points for one task (tracking used to have four);
- legal links missing on a site with accounts. The pages exist but stay off
  until the operator details are set (`LEGAL_*` env, docs/legal-pages.md).

## 7. Guardrails already in place

These run in CI. Don't weaken them to get a change through: fix the copy
or extend the allowlist with a reason.

- **ESLint copy rules** (`frontend/eslint.config.mjs`) and
  **`scripts/check-copy.py`**: what each checks is in the style guide's
  [Writing](style-guide.md#writing) and
  [Banned phrases](style-guide.md#banned-phrases).
- **ESLint, inline styles:** `style` props are banned in app code; the few
  exceptions are listed in [Code
  conventions](style-guide.md#code-conventions).
- **Design tokens:** `tokens` in `lib/theme.ts` is the single source for
  the app's own values.
- **Visual regression:** `frontend/e2e/visual.spec.ts` screenshots the main
  pages at 390 and 1366 px, light and dark, on every PR touching
  `frontend/` ([Visual regression](style-guide.md#visual-regression) has
  how to run and update it).
- **`.github/pull_request_template.md`:** the checklist in section 8.

## 8. How to run a design change

1. **Start from the reader's question.** What is the commuter trying to
   find out on this page? Write it down. The first screen must answer it.
2. **Reuse before inventing.** Check `components/` and the shared
   components above. If a pattern is missing, add a named component, not
   a variant inline.
3. **Write the copy against the style guide.** Use the terminology table,
   units and failure patterns. Read it aloud. If it sounds like a
   brochure or a log line, rewrite it.
4. **Check at 390 px and 1366 px, light and dark.** Look for clipped text,
   lone grid items, and colours that ignore the theme.
5. **Check with a keyboard.** Every control needs a visible focus state and
   a fixed accessible name. Toggles state their value separately.
6. **Run the checks locally** in `frontend/`: `npm run lint`,
   `npx tsc --noEmit`, `npm test`, `npm run format:check`; from the repo
   root, `uv run scripts/check-copy.py`; and for a visual change the
   visual regression run, updating its baselines on purpose.
7. **In the PR,** attach screenshots for both widths and themes, and tick
   the template's checklist: copy follows the style guide's Writing rules,
   every new page has a title and a description, and every icon-only
   button has an `aria-label`.

## 9. Open questions

For the owner to decide:

- turning off Cloudflare's Email Address Obfuscation for the zone.
  `EmailLink` works around it in the rendered HTML, but the address still
  appears in the page's hydration data;
- the legal pages' operator name, contact email, sign-in log retention and
  last-updated date (`LEGAL_*` env, docs/legal-pages.md), so the Privacy,
  Terms and Contact pages can go live.

Decided: `short_name` stays "DS Rail" (12 Oct 2026); the wordmark and
link-preview images shipped in round 2 (14 Oct 2026).

---

*Sources: the 9 Oct 2026 vibecode audit, the owner's decisions that day,
and the wave 1 polish branch. Reviewed against the frontend on
2 Nov 2026.*
