/** Operator-specific values for the legal pages (`/privacy`, `/terms`,
 * `/cookies`, `/contact`, `/accessibility`), and the flag that publishes them.
 *
 * DRAFT. The page text under `app/privacy`, `app/terms`, `app/cookies`,
 * `app/contact` and `app/accessibility` was drafted from the 2026-09-27 UK
 * legal compliance gap analysis (LEG-1, LEG-2, LEG-8, LEG-11, LEG-12, LEG-13,
 * LEG-25) and has had engineering reviews on 11 and 12 November 2026; a
 * lawyer's review is pending. It is not legal advice. The operator, and
 * ideally a lawyer, must review every page before `LEGAL_PAGES_PUBLISHED` is
 * switched on.
 *
 * The operator's own details are NOT in the source: each deployment supplies
 * them as server environment variables (chart values `frontend.legal.*`,
 * docs/legal-pages.md), read per request:
 *   LEGAL_OPERATOR_NAME      required: the data controller
 *   LEGAL_CONTACT_EMAIL      required: a monitored inbox
 *   LEGAL_SSO_LOG_RETENTION  required: e.g. "30 days"
 *   LEGAL_LAST_UPDATED       required: e.g. "1 November 2026"; set on go-live
 *   LEGAL_ICO_REGISTRATION   optional: omit when no ICO fee is due
 *   LEGAL_MINIMUM_AGE        optional, default "18"
 *   LEGAL_HOSTING_PROVIDER   optional: who provides our servers, if a third
 *                            party does; omit when we run our own hardware
 * The pages stay unpublished (404, and hidden from the footer) until BOTH:
 *   1. the server env `LEGAL_PAGES_PUBLISHED` is exactly `true`
 *      (chart value `frontend.legalPagesPublished`, off by default), and
 *   2. every required value above is set and valid.
 * A missing or malformed value reads as a `[[LIKE_THIS]]` placeholder, so
 * flipping the flag early can't put a blank or broken value in front of
 * users, and a fork can't publish another operator's details by accident.
 * `LEGAL_PAGES_PREVIEW=true` renders the drafts, placeholders and all, with
 * a "draft" banner and `noindex` for review and for CI's accessibility
 * sweep; see `legalPagesMode`.
 *
 * Every read is `process.env.X` on the server at request time. None of
 * these is `NEXT_PUBLIC_`, so Next never inlines them into a bundle, and
 * every page that uses them is `force-dynamic`. */

import type { Metadata } from 'next';
import { createLogger } from './logger';
import { canonicalPath, fullTitle } from './pageMetadata';

const log = createLogger('lib/legal');

/** Matches a value the operator hasn't filled in (or filled in badly). */
const PLACEHOLDER = /\[\[[A-Z0-9_]+\]\]/;

export interface LegalConfig {
  /** The data controller: an individual's name or a trading name
   * (`LEGAL_OPERATOR_NAME`). */
  OPERATOR_NAME: string;
  /** A monitored inbox for privacy requests, content reports (Online Safety
   * Act 2023 ss. 20-21), complaints and accessibility requests
   * (`LEGAL_CONTACT_EMAIL`). */
  CONTACT_EMAIL: string;
  /** Optional: the ICO data protection fee registration number, if one is
   * held (`LEGAL_ICO_REGISTRATION`). Leave unset when no fee is due (LEG-9);
   * the privacy notice then omits the ICO registration line. */
  ICO_REGISTRATION?: string | undefined;
  /** Minimum age to create an account (`LEGAL_MINIMUM_AGE`, default `'18'`,
   * 13 to 21). 18 is simplest for the OSA children's duties and the
   * Children's Code. */
  MINIMUM_AGE: string;
  /** Optional: who provides the servers the login service and database run
   * on, if a third party does (`LEGAL_HOSTING_PROVIDER`). Unset leaves the
   * hosting provider out of the privacy notice; the operator decides. */
  HOSTING_PROVIDER?: string | undefined;
  /** How long the login service (Authentik) keeps its event logs,
   * including login IP addresses, e.g. `'1 year'`
   * (`LEGAL_SSO_LOG_RETENTION`). */
  SSO_LOG_RETENTION: string;
  /** Date the operator last reviewed the text, e.g. `'1 November 2026'`
   * (`LEGAL_LAST_UPDATED`). Set when the pages go live. */
  LAST_UPDATED: string;
}

type Env = Record<string, string | undefined>;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Printable text without markup characters or control characters. React
 * escapes what it renders; this keeps junk out of metadata and the
 * `mailto:` and security.txt outputs too. */
function plainText(max: number): (value: string) => boolean {
  return (value) => value.length <= max && !/[<>\p{Cc}]/u.test(value);
}

function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@<>"',;:()[\]\\]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(value);
}

function isDate(value: string): boolean {
  const m = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(value);
  const [, dayText, monthName, yearText] = m ?? [];
  if (dayText === undefined || monthName === undefined || yearText === undefined) return false;
  const month = MONTHS.indexOf(monthName);
  if (month < 0) return false;
  const day = Number(dayText);
  const year = Number(yearText);
  const d = new Date(Date.UTC(year, month, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day;
}

function isAge(value: string): boolean {
  return /^\d{2}$/.test(value) && Number(value) >= 13 && Number(value) <= 21;
}

function isIco(value: string): boolean {
  return /^[A-Za-z0-9-]{4,20}$/.test(value);
}

/** One value: trimmed, validated, or the `[[NAME]]` placeholder when it is
 * unset, empty or invalid. */
function field(env: Env, name: string, key: string, ok: (value: string) => boolean): string {
  const value = env[name]?.trim() ?? '';
  return value !== '' && ok(value) ? value : `[[${key}]]`;
}

/** The legal config as the given environment supplies it (`process.env` by
 * default), validated. Missing or invalid values are placeholders, never
 * thrown. */
export function readLegalConfig(env: Env = process.env): LegalConfig {
  const ico = env.LEGAL_ICO_REGISTRATION?.trim() ?? '';
  const age = env.LEGAL_MINIMUM_AGE?.trim() ?? '';
  const hosting = env.LEGAL_HOSTING_PROVIDER?.trim() ?? '';
  return {
    OPERATOR_NAME: field(env, 'LEGAL_OPERATOR_NAME', 'OPERATOR_NAME', plainText(100)),
    CONTACT_EMAIL: field(env, 'LEGAL_CONTACT_EMAIL', 'CONTACT_EMAIL', isEmail),
    ICO_REGISTRATION: ico === '' ? undefined : isIco(ico) ? ico : '[[ICO_REGISTRATION]]',
    HOSTING_PROVIDER: hosting === '' ? undefined : plainText(100)(hosting) ? hosting : '[[HOSTING_PROVIDER]]',
    MINIMUM_AGE: age === '' ? '18' : isAge(age) ? age : '[[MINIMUM_AGE]]',
    SSO_LOG_RETENTION: field(env, 'LEGAL_SSO_LOG_RETENTION', 'SSO_LOG_RETENTION', plainText(60)),
    LAST_UPDATED: field(env, 'LEGAL_LAST_UPDATED', 'LAST_UPDATED', isDate),
  };
}

/** The live config: each field reads `process.env` when accessed, so it
 * reflects the running server's environment, never a build-time snapshot. */
export const LEGAL_CONFIG: LegalConfig = {
  get OPERATOR_NAME() {
    return readLegalConfig().OPERATOR_NAME;
  },
  get CONTACT_EMAIL() {
    return readLegalConfig().CONTACT_EMAIL;
  },
  get ICO_REGISTRATION() {
    return readLegalConfig().ICO_REGISTRATION;
  },
  get HOSTING_PROVIDER() {
    return readLegalConfig().HOSTING_PROVIDER;
  },
  get MINIMUM_AGE() {
    return readLegalConfig().MINIMUM_AGE;
  },
  get SSO_LOG_RETENTION() {
    return readLegalConfig().SSO_LOG_RETENTION;
  },
  get LAST_UPDATED() {
    return readLegalConfig().LAST_UPDATED;
  },
};

/** Names of the config fields still holding a placeholder. */
export function unfilledLegalPlaceholders(config: LegalConfig = readLegalConfig()): string[] {
  return (Object.keys(config) as (keyof LegalConfig)[]).filter((key) => PLACEHOLDER.test(config[key] ?? ''));
}

let warnedPlaceholders = false;

/** Test-only reset for the one-time warning below. */
export function __resetLegalWarningForTests(): void {
  warnedPlaceholders = false;
}

export type LegalPagesMode = 'off' | 'preview' | 'published';

/** How `/privacy`, `/terms`, `/cookies` and `/contact` are served:
 *   - `'published'`: `LEGAL_PAGES_PUBLISHED=true` and every required `LEGAL_*` value set.
 *   - `'preview'`: `LEGAL_PAGES_PREVIEW=true` (and not published). The pages
 *     render with a "draft" banner and `noindex`, placeholders and all, so
 *     the operator can review them on a staging deployment and CI's axe
 *     sweep can reach them. Never set this in production.
 *   - `'off'` (the default): the pages 404 and the footer hides their links.
 *
 * Read from `process.env` at call time, so every caller must render per
 * request (`dynamic = 'force-dynamic'`): the image build never sets these,
 * and a build-time prerender would freeze them off. */
export function legalPagesMode(env: Env = process.env, config: LegalConfig = readLegalConfig(env)): LegalPagesMode {
  if (env.LEGAL_PAGES_PUBLISHED === 'true') {
    const unfilled = unfilledLegalPlaceholders(config);
    if (unfilled.length === 0) return 'published';
    if (!warnedPlaceholders) {
      warnedPlaceholders = true;
      log.warn(
        `LEGAL_PAGES_PUBLISHED is true but these LEGAL_* values are unset or invalid (${unfilled.join(', ')}); ` +
          'the legal pages stay unpublished until they are set (docs/legal-pages.md).',
      );
    }
  }
  return env.LEGAL_PAGES_PREVIEW === 'true' ? 'preview' : 'off';
}

/** Whether the legal pages are live for real (not just previewed). */
export function legalPagesPublished(env: Env = process.env, config: LegalConfig = readLegalConfig(env)): boolean {
  return legalPagesMode(env, config) === 'published';
}

/** Whether the legal pages (and their footer links) render at all. */
export function legalPagesVisible(env: Env = process.env, config: LegalConfig = readLegalConfig(env)): boolean {
  return legalPagesMode(env, config) !== 'off';
}

/** Route names of the account self-service features the privacy notice
 * points to. Keep these in sync with the account page's export and delete
 * controls. */
export const ACCOUNT_ROUTE = '/account';
export const ACCOUNT_EXPORT_LABEL = 'Download my data';
export const ACCOUNT_DELETE_LABEL = 'Delete my account';

/** Footer links for the legal pages, in display order. */
export const LEGAL_LINKS: readonly { href: string; label: string }[] = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/contact', label: 'Contact' },
  { href: '/accessibility', label: 'Accessibility' },
];

/** Metadata for a legal page. Unless the pages are really published
 * (e.g. in preview), it adds `noindex` so a draft never lands in a search
 * index. Call from `generateMetadata` so it is evaluated per request.
 * `path` (`/terms`) is the canonical URL and `og:url`. */
export function legalPageMetadata(
  title: string,
  description: string,
  path: string,
  published: boolean = legalPagesPublished(),
): Metadata {
  const fullPageTitle = fullTitle(title);
  const canonical = canonicalPath(path);
  return {
    title: fullPageTitle,
    description,
    alternates: { canonical },
    openGraph: { title: fullPageTitle, description, type: 'website', url: canonical },
    twitter: { card: 'summary', title: fullPageTitle, description },
    ...(published ? {} : { robots: { index: false, follow: false } }),
  };
}

/** The api's personal-data retention settings, as the privacy notice
 * states them (LEG-5, LEG-28, DQ7). The chart copies the api's own values
 * (`api.pastTravelRetentionDays`, `api.stalePushSubscriptionDays`,
 * `api.inactiveAccountRetentionDays`, `api.regularJourneyRetentionDays`)
 * into the frontend's env, so the
 * notice follows the real configuration; the defaults below match the
 * chart's. 0 means that limit is off. Read per request, like the flags. */
export interface RetentionPolicy {
  /** Tracked trains, tickets and journeys: days after the travel date. */
  pastTravelDays: number;
  /** Push subscriptions: days without a login or renewal. */
  stalePushSubscriptionDays: number;
  /** Whole accounts: days with no login and no live session. OFF (0) by
   * default; the chart's `api.inactiveAccountRetentionDays` turns it on
   * (the period is the operator's decision). */
  inactiveAccountDays: number;
  /** Journeys made from a regular journey that nothing on keeps for Delay
   * Repay: days after their last leg (the api's
   * `REGULAR_JOURNEY_RETENTION_DAYS`, DS-379). OFF (0) by default; the
   * chart sets 90 once the api records each leg's arrival delay. */
  regularJourneyDays: number;
  /** Days a journey or tracked train the user deleted stays in Recently
   * deleted before it is deleted for good (the api's
   * `RECENTLY_DELETED_RETENTION_DAYS`, chart
   * `api.recentlyDeleted.retentionDays`; the api accepts 7 to 31, default
   * 7). 0 leaves the sentences out, and 0 is the default: the chart copies
   * the value into the frontend's env only while
   * `api.recentlyDeleted.enabled` is true. With the feature off the api
   * deletes at once, so the notice must say nothing about a grace period. */
  recentlyDeletedDays: number;
}

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  pastTravelDays: 548,
  stalePushSubscriptionDays: 365,
  inactiveAccountDays: 0,
  regularJourneyDays: 0,
  recentlyDeletedDays: 0,
};

function retentionDays(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

export function retentionPolicy(env: Record<string, string | undefined> = process.env): RetentionPolicy {
  return {
    pastTravelDays: retentionDays(env.RETENTION_PAST_TRAVEL_DAYS, DEFAULT_RETENTION_POLICY.pastTravelDays),
    stalePushSubscriptionDays: retentionDays(
      env.RETENTION_STALE_PUSH_SUBSCRIPTION_DAYS,
      DEFAULT_RETENTION_POLICY.stalePushSubscriptionDays,
    ),
    inactiveAccountDays: retentionDays(
      env.RETENTION_INACTIVE_ACCOUNT_DAYS,
      DEFAULT_RETENTION_POLICY.inactiveAccountDays,
    ),
    regularJourneyDays: retentionDays(env.RETENTION_REGULAR_JOURNEY_DAYS, DEFAULT_RETENTION_POLICY.regularJourneyDays),
    recentlyDeletedDays: retentionDays(
      env.RETENTION_RECENTLY_DELETED_DAYS,
      DEFAULT_RETENTION_POLICY.recentlyDeletedDays,
    ),
  };
}

/** A retention period in plain words: whole months where the day count is
 * one (365 -> "12 months", 548 -> "18 months", 730 -> "24 months"),
 * otherwise days. */
export function describeRetentionDays(days: number): string {
  const months = days / (365.25 / 12);
  const rounded = Math.round(months);
  if (rounded >= 1 && Math.abs(months - rounded) < 0.1) return rounded === 1 ? '1 month' : `${rounded} months`;
  return days === 1 ? '1 day' : `${days} days`;
}
